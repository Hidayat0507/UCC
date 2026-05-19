import type { MedplumClient } from "@medplum/core";
import type { Extension, Invoice, InvoiceLineItem } from "@medplum/fhirtypes";
import { randomUUID } from "crypto";
import { updateQueueStatusForPatient } from "@/lib/fhir/triage-service";
import { createReviewFollowUpForCheckout } from "@/lib/fhir/communication-service";

export type CheckoutPaymentMethod = "cash" | "card" | "qr" | "panel";

export type CheckoutInvoiceItem = {
  id: string;
  name: string;
  description?: string;
  type: "Item" | "Service" | "Package" | "Document";
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
  invoiceNumber?: string;
};

export type CompleteCheckoutResult = {
  invoice: Invoice;
  queueUpdateError?: string;
};

const CURRENCY = "MYR";
const INVOICE_IDENTIFIER_SYSTEM = "https://ucc.emr/invoice/consultation";
const INVOICE_NUMBER_IDENTIFIER_SYSTEM = "https://ucc.emr/invoice/number";
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

export function getInvoiceNumber(invoice: Pick<Invoice, "identifier" | "id"> | null | undefined): string {
  return getStoredInvoiceNumber(invoice) || invoice?.id || "";
}

function getStoredInvoiceNumber(invoice: Pick<Invoice, "identifier"> | null | undefined): string {
  return invoice?.identifier?.find((identifier) => identifier.system === INVOICE_NUMBER_IDENTIFIER_SYSTEM)?.value || "";
}

function formatInvoiceNumber(date: Date): string {
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const suffix = randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
  return `INV-${yyyy}${mm}${dd}-${suffix}`;
}

function isValidInvoiceNumber(value: string): boolean {
  return /^[A-Z0-9/-]{1,50}$/.test(value);
}

async function isInvoiceNumberAvailable(
  medplum: MedplumClient,
  invoiceNumber: string,
  existingInvoiceId?: string
): Promise<boolean> {
  const existing = await medplum.searchResources("Invoice", {
    identifier: `${INVOICE_NUMBER_IDENTIFIER_SYSTEM}|${invoiceNumber}`,
    _count: "1",
  });
  return !existing?.some((invoice) => invoice.id !== existingInvoiceId);
}

export async function generateInvoiceNumber(medplum: MedplumClient, date = new Date()): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const invoiceNumber = formatInvoiceNumber(date);
    if (await isInvoiceNumberAvailable(medplum, invoiceNumber)) {
      return invoiceNumber;
    }
  }

  throw new Error("Failed to generate a unique invoice number");
}

function buildInvoiceIdentifiers(existing: Invoice | undefined, consultationId: string, invoiceNumber: string) {
  const preservedIdentifiers =
    existing?.identifier?.filter(
      (identifier) =>
        identifier.system !== INVOICE_IDENTIFIER_SYSTEM &&
        identifier.system !== INVOICE_NUMBER_IDENTIFIER_SYSTEM
    ) || [];

  return [
    ...preservedIdentifiers,
    {
      system: INVOICE_IDENTIFIER_SYSTEM,
      value: consultationId,
    },
    {
      system: INVOICE_NUMBER_IDENTIFIER_SYSTEM,
      value: invoiceNumber,
    },
  ];
}

async function resolveInvoiceNumber(
  medplum: MedplumClient,
  existing: Invoice | undefined,
  proposedInvoiceNumber: string | undefined,
  date: Date
): Promise<string> {
  const storedInvoiceNumber = getStoredInvoiceNumber(existing);
  if (storedInvoiceNumber) return storedInvoiceNumber;

  const cleaned = cleanText(proposedInvoiceNumber).toUpperCase();
  if (
    cleaned &&
    isValidInvoiceNumber(cleaned) &&
    await isInvoiceNumberAvailable(medplum, cleaned, existing?.id)
  ) {
    return cleaned;
  }

  return generateInvoiceNumber(medplum, date);
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
        !["Item", "Service", "Package", "Document"].includes(item.type) ||
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
): Promise<CompleteCheckoutResult> {
  const { normalizedItems, normalizedPaidAmount, normalizedTotalAmount } = validateCheckoutInput(input);
  const balance = roundMoney(Math.max(normalizedTotalAmount - normalizedPaidAmount, 0));
  const nowDate = new Date();
  const now = nowDate.toISOString();
  const existing = await findExistingInvoice(medplum, input.consultationId);
  const invoiceNumber = await resolveInvoiceNumber(medplum, existing, input.invoiceNumber, nowDate);

  const invoice: Invoice = {
    ...(existing ?? {}),
    resourceType: "Invoice",
    status: "balanced",
    identifier: buildInvoiceIdentifiers(existing, input.consultationId, invoiceNumber),
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
    const message = err instanceof Error ? err.message : "Queue status update failed";
    return { invoice: saved, queueUpdateError: message };
  }

  try {
    await createReviewFollowUpForCheckout(medplum, {
      clinicId: input.clinicId,
      consultationId: input.consultationId,
      patientId: input.patientId,
    });
  } catch (err) {
    console.error("[billing-service] Checkout completed but review follow-up creation failed", input.patientId, err);
  }

  return { invoice: saved };
}

export async function getInvoice(medplum: MedplumClient, invoiceId: string): Promise<Invoice | null> {
  try {
    return await medplum.readResource("Invoice", invoiceId) as Invoice;
  } catch {
    return null;
  }
}

export async function getPatientInvoices(medplum: MedplumClient, patientId: string): Promise<Invoice[]> {
  const results = await medplum.searchResources("Invoice", {
    subject: `Patient/${patientId}`,
    _sort: "-date",
  });
  return results as Invoice[];
}

export async function getConsultationInvoice(medplum: MedplumClient, consultationId: string): Promise<Invoice | null> {
  const results = await medplum.searchResources("Invoice", {
    identifier: `${INVOICE_IDENTIFIER_SYSTEM}|${consultationId}`,
    _count: "1",
  });
  return (results?.[0] as Invoice) ?? null;
}

export async function voidInvoice(medplum: MedplumClient, invoiceId: string): Promise<Invoice> {
  const invoice = await medplum.readResource("Invoice", invoiceId) as Invoice;
  return medplum.updateResource({ ...invoice, status: "cancelled" });
}

export async function deleteInvoice(medplum: MedplumClient, invoiceId: string): Promise<void> {
  await medplum.deleteResource("Invoice", invoiceId);
}
