import type { ChargeItem, Invoice, Money } from '@medplum/fhirtypes';
import type { Consultation, Patient } from '@/lib/models';
import { getMedplumClient } from './patient-service';

const CHARGE_ITEM_IDENTIFIER_SYSTEM = 'https://ucc.emr/billing/charge-item';
const INVOICE_IDENTIFIER_SYSTEM = 'https://ucc.emr/billing/invoice';
const CURRENCY = 'MYR';
const DEFAULT_CONSULTATION_FEE = 50;

type BillLine = {
  key: string;
  type: 'prescription' | 'procedure';
  title: string;
  description?: string;
  amount: number;
};

function toMoney(amount: number): Money {
  return {
    value: Number(amount.toFixed(2)),
    currency: CURRENCY,
  };
}

function buildBillLines(consultation: Consultation): BillLine[] {
  const prescriptions = (consultation.prescriptions || []).map((prescription, index) => ({
    key: `rx-${index}`,
    type: 'prescription' as const,
    title: prescription.medication?.name || 'Medication',
    description: [prescription.medication?.strength, prescription.frequency, prescription.duration]
      .filter(Boolean)
      .join(' · '),
    amount: prescription.price ?? 0,
  }));

  const procedures = (consultation.procedures || []).map((procedure, index) => ({
    key: `proc-${index}`,
    type: 'procedure' as const,
    title: procedure.name,
    description: procedure.notes || '',
    amount: procedure.price ?? 0,
  }));

  const billableLines = [...prescriptions, ...procedures].filter((line) => line.amount > 0);
  if (billableLines.length > 0) {
    return billableLines;
  }

  return [
    {
      key: 'consultation-fee',
      type: 'procedure',
      title: 'Consultation Fee',
      description: 'Default consultation charge',
      amount: DEFAULT_CONSULTATION_FEE,
    },
  ];
}

async function upsertChargeItem(
  patientId: string,
  encounterId: string,
  consultationDate: Date,
  line: BillLine
): Promise<ChargeItem> {
  const medplum = await getMedplumClient();
  const identifier = `${encounterId}:${line.key}`;

  const existing = await medplum.searchOne('ChargeItem', {
    identifier: `${CHARGE_ITEM_IDENTIFIER_SYSTEM}|${identifier}`,
  });

  const resource: ChargeItem = {
    ...(existing || { resourceType: 'ChargeItem' }),
    identifier: [
      {
        system: CHARGE_ITEM_IDENTIFIER_SYSTEM,
        value: identifier,
      },
    ],
    status: 'billable',
    code: {
      text: line.title,
    },
    subject: {
      reference: `Patient/${patientId}`,
    },
    context: {
      reference: `Encounter/${encounterId}`,
    },
    occurrenceDateTime: consultationDate.toISOString(),
    quantity: {
      value: 1,
    },
    priceOverride: toMoney(line.amount),
    overrideReason: line.description || `${line.type} charge`,
  };

  if (existing?.id) {
    return (await medplum.updateResource(resource)) as ChargeItem;
  }

  return (await medplum.createResource(resource)) as ChargeItem;
}

export async function saveConsultationInvoice(
  patient: Patient,
  consultation: Consultation
): Promise<{ invoice: Invoice; chargeItems: ChargeItem[] }> {
  const medplum = await getMedplumClient();
  const encounterId = consultation.id;

  if (!encounterId) {
    throw new Error('Consultation is missing Encounter ID');
  }

  const billLines = buildBillLines(consultation);
  const consultationDate =
    consultation.date instanceof Date ? consultation.date : new Date(consultation.date);
  const chargeItems = await Promise.all(
    billLines.map((line) => upsertChargeItem(patient.id, encounterId, consultationDate, line))
  );

  const invoiceIdentifier = encounterId;
  const existingInvoice = await medplum.searchOne('Invoice', {
    identifier: `${INVOICE_IDENTIFIER_SYSTEM}|${invoiceIdentifier}`,
  });

  const total = billLines.reduce((sum, line) => sum + line.amount, 0);
  const invoice: Invoice = {
    ...(existingInvoice || { resourceType: 'Invoice' }),
    identifier: [
      {
        system: INVOICE_IDENTIFIER_SYSTEM,
        value: invoiceIdentifier,
      },
    ],
    status: 'issued',
    subject: {
      reference: `Patient/${patient.id}`,
      display: patient.fullName,
    },
    date: new Date().toISOString(),
    lineItem: chargeItems
      .filter((chargeItem) => chargeItem.id)
      .map((chargeItem) => ({
        chargeItemReference: {
          reference: `ChargeItem/${chargeItem.id}`,
        },
        priceComponent: [
          {
            type: 'base',
            amount: chargeItem.priceOverride || toMoney(0),
          },
        ],
      })),
    totalNet: toMoney(total),
    totalGross: toMoney(total),
  };

  const savedInvoice = existingInvoice?.id
    ? ((await medplum.updateResource(invoice)) as Invoice)
    : ((await medplum.createResource(invoice)) as Invoice);

  return {
    invoice: savedInvoice,
    chargeItems,
  };
}
