import type { MedplumClient } from "@medplum/core";
import type { Extension, Invoice, InvoiceLineItem } from "@medplum/fhirtypes";
import { updateQueueStatusForPatient } from "@/lib/fhir/triage-service";

export type CheckoutPaymentMethod = "cash" | "card" | "qr" | "panel";

export type CheckoutInvoiceItem = {
  id: string;
  name: string;
  description?: string;
  type: "Item" | "Service";
  quantity: number;
  price: number;
};

export type CompleteCheckoutInput = {
  consultationId: string;
  patientId: string;
  clinicId: string;
  items: CheckoutInvoiceItem[];
  paymentMethod: CheckoutPaymentMethod;
  paidAmount: number;
  totalAmount: number;
};

const CURRENCY = "MYR";
const INVOICE_IDENTIFIER_SYSTEM = "https://ucc.emr/invoice/consultation";
const ENCOUNTER_EXTENSION_URL = "https://ucc.emr/invoice/encounter";
const CLINIC_EXTENSION_URL = "https://ucc.emr/invoice/clinic-id";
const PAYMENT_METHOD_EXTENSION_URL = "https://ucc.emr/invoice/payment-method";
const PAID_AMOUNT_EXTENSION_URL = "https://ucc.emr/invoice/paid-amount";
const BALANCE_EXTENSION_URL = "https://ucc.emr/invoice/balance";
const CHECKOUT_SOURCE_EXTENSION_URL = "https://ucc.emr/invoice/checkout-source";
const ITEM_TYPE_EXTENSION_URL = "https://ucc.emr/invoice/line-item-type";
const ITEM_QUANTITY_EXTENSION_URL = "https://ucc.emr/invoice/line-item-quantity";
const ITEM_SOURCE_ID_EXTENSION_URL = "https://ucc.emr/invoice/line-item-source-id";
const ITEM_DESCRIPTION_EXTENSION_URL = "https://ucc.emr/invoice/line-item-description";

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function moneyExtension(url: string, value: number): Extension {
  return {
    url,
    valueMoney: {
      value: roundMoney(value),
      currency: CURRENCY,
    },
  };
}

function buildLineItem(item: CheckoutInvoiceItem, index: number): InvoiceLineItem {
  const quantity = Number.isFinite(item.quantity) && item.quantity > 0 ? item.quantity : 1;
  const unitPrice = Number.isFinite(item.price) && item.price >= 0 ? item.price : 0;
  const lineTotal = roundMoney(quantity * unitPrice);
  const name = cleanText(item.name) || "Checkout item";
  const description = cleanText(item.description);

  return {
    sequence: index + 1,
    chargeItemCodeableConcept: {
      text: name,
      coding: [
        {
          system: "https://ucc.emr/checkout-item-type",
          code: item.type.toLowerCase(),
          display: item.type,
        },
      ],
    },
    priceComponent: [
      {
        type: "base",
        amount: {
          value: lineTotal,
          currency: CURRENCY,
        },
      },
    ],
    extension: [
      { url: ITEM_TYPE_EXTENSION_URL, valueString: item.type },
      { url: ITEM_QUANTITY_EXTENSION_URL, valueDecimal: quantity },
      { url: ITEM_SOURCE_ID_EXTENSION_URL, valueString: cleanText(item.id) || `line-${index + 1}` },
      ...(description ? [{ url: ITEM_DESCRIPTION_EXTENSION_URL, valueString: description }] : []),
    ],
  };
}

function validateCheckoutInput(input: CompleteCheckoutInput): {
  normalizedItems: CheckoutInvoiceItem[];
  normalizedPaidAmount: number;
  normalizedTotalAmount: number;
} {
  if (!cleanText(input.consultationId) || !cleanText(input.patientId) || !cleanText(input.clinicId)) {
    throw new Error("consultationId, patientId, and clinicId are required");
  }

  if (!["cash", "card", "qr", "panel"].includes(input.paymentMethod)) {
    throw new Error("Invalid payment method");
  }

  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new Error("At least one invoice item is required");
  }

  const normalizedItems = input.items.map((item) => ({
    id: cleanText(item.id),
    name: cleanText(item.name),
    description: cleanText(item.description),
    type: item.type,
    quantity: Number(item.quantity),
    price: Number(item.price),
  }));

  if (
    normalizedItems.some(
      (item) =>
        !item.name ||
        !["Item", "Service"].includes(item.type) ||
        !Number.isFinite(item.quantity) ||
        item.quantity <= 0 ||
        !Number.isFinite(item.price) ||
        item.price < 0
    )
  ) {
    throw new Error("Invoice items must include valid name, type, quantity, and price");
  }

  const calculatedTotal = roundMoney(
    normalizedItems.reduce((sum, item) => sum + item.quantity * item.price, 0)
  );
  const normalizedTotalAmount = roundMoney(Number(input.totalAmount));
  const normalizedPaidAmount = roundMoney(Number(input.paidAmount));

  if (!Number.isFinite(normalizedTotalAmount) || normalizedTotalAmount < 0) {
    throw new Error("totalAmount must be a valid amount");
  }

  if (Math.abs(calculatedTotal - normalizedTotalAmount) > 0.01) {
    throw new Error("totalAmount does not match invoice items");
  }

  if (!Number.isFinite(normalizedPaidAmount) || normalizedPaidAmount < 0) {
    throw new Error("paidAmount must be a valid amount");
  }

  if (normalizedPaidAmount + 0.01 < normalizedTotalAmount) {
    throw new Error("Full payment is required before checkout completion");
  }

  return { normalizedItems, normalizedPaidAmount, normalizedTotalAmount };
}

async function findExistingInvoice(
  medplum: MedplumClient,
  consultationId: string
): Promise<Invoice | undefined> {
  const matches = await medplum.searchResources("Invoice", {
    identifier: `${INVOICE_IDENTIFIER_SYSTEM}|${consultationId}`,
    _count: "1",
  });
  return matches?.[0] as Invoice | undefined;
}

export async function completeCheckoutInvoice(
  medplum: MedplumClient,
  input: CompleteCheckoutInput
): Promise<Invoice> {
  const { normalizedItems, normalizedPaidAmount, normalizedTotalAmount } = validateCheckoutInput(input);
  const balance = roundMoney(Math.max(normalizedTotalAmount - normalizedPaidAmount, 0));
  const now = new Date().toISOString();
  const existing = await findExistingInvoice(medplum, input.consultationId);

  const invoice: Invoice = {
    ...(existing ?? {}),
    resourceType: "Invoice",
    status: "balanced",
    identifier: [
      {
        system: INVOICE_IDENTIFIER_SYSTEM,
        value: input.consultationId,
      },
    ],
    type: {
      text: "Clinic checkout invoice",
      coding: [
        {
          system: "https://ucc.emr/invoice-type",
          code: "clinic-checkout",
          display: "Clinic checkout",
        },
      ],
    },
    subject: {
      reference: `Patient/${input.patientId}`,
    },
    date: now,
    lineItem: normalizedItems.map(buildLineItem),
    totalNet: {
      value: normalizedTotalAmount,
      currency: CURRENCY,
    },
    totalGross: {
      value: normalizedTotalAmount,
      currency: CURRENCY,
    },
    totalPriceComponent: [
      {
        type: "base",
        amount: {
          value: normalizedTotalAmount,
          currency: CURRENCY,
        },
      },
    ],
    paymentTerms: `Paid by ${input.paymentMethod.toUpperCase()} at checkout`,
    extension: [
      { url: ENCOUNTER_EXTENSION_URL, valueReference: { reference: `Encounter/${input.consultationId}` } },
      { url: CLINIC_EXTENSION_URL, valueString: input.clinicId },
      { url: PAYMENT_METHOD_EXTENSION_URL, valueCode: input.paymentMethod },
      moneyExtension(PAID_AMOUNT_EXTENSION_URL, normalizedPaidAmount),
      moneyExtension(BALANCE_EXTENSION_URL, balance),
      { url: CHECKOUT_SOURCE_EXTENSION_URL, valueString: "orders-checkout" },
    ],
    note: [
      {
        time: now,
        text: "Checkout completed from UCC Billing & Documents.",
      },
    ],
  };

  const saved = existing?.id
    ? await medplum.updateResource(invoice)
    : await medplum.createResource<Invoice>(invoice);

  try {
    await updateQueueStatusForPatient(input.patientId, "completed", medplum, input.clinicId);
  } catch (err) {
    console.error("[billing-service] Invoice saved but queue status update failed for patient", input.patientId, err);
  }

  return saved;
}
