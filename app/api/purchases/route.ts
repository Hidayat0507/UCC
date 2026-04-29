import { NextRequest, NextResponse } from 'next/server';
import type { Basic } from '@medplum/fhirtypes';
import { requireClinicAuth } from '@/lib/server/medplum-auth';
import { handleRouteError } from '@/lib/server/route-helpers';
import {
  getInventoryMedicationByIdFromMedplum,
  updateInventoryMedicationInMedplum,
} from '@/lib/fhir/inventory-service';

const CODE_SYSTEM = 'urn:iatrum:resource-type';
const CODE_VALUE = 'purchase-order';
const CLINIC_SYSTEM = 'clinic';
const DATA_EXT = 'urn:iatrum:purchase-order/data';

function normalizeItems(items: any[]): any[] {
  return (items ?? []).map((item) => {
    const qty =
      Number(item.requestedQuantity ?? item.quantity ?? item.receivedQuantity ?? 0) || 0;
    const cost = Number(item.unitCost) || 0;
    return {
      ...item,
      quantity: Number(item.quantity ?? qty) || 0,
      requestedQuantity: qty,
      receivedQuantity: Number(item.receivedQuantity ?? 0) || 0,
      unitCost: cost,
      lineTotal: qty * cost,
      batchNumber: item.batchNumber || '',
      expiryDate: item.expiryDate || '',
    };
  });
}

function computeAmounts(items: any[], input: any) {
  const subtotalAmount = items.reduce((s: number, i: any) => s + i.lineTotal, 0);
  const taxAmount = Number(input.taxAmount || 0);
  const adjustmentAmount = Number(input.adjustmentAmount || 0);
  const deliveryCharge = Number(input.deliveryCharge || 0);
  const paidAmount = Number(input.paidAmount || 0);
  const totalAmount = subtotalAmount + taxAmount + adjustmentAmount + deliveryCharge;
  return {
    subtotalAmount,
    taxAmount,
    adjustmentAmount,
    deliveryCharge,
    paidAmount,
    totalAmount,
    amountDue: Math.max(0, totalAmount - paidAmount),
  };
}

function toBasic(data: any, clinicId: string): Basic {
  return {
    resourceType: 'Basic',
    code: { coding: [{ system: CODE_SYSTEM, code: CODE_VALUE }] },
    identifier: [{ system: CLINIC_SYSTEM, value: clinicId }],
    extension: [{ url: DATA_EXT, valueString: JSON.stringify(data) }],
  };
}

function fromBasic(resource: Basic): any {
  const raw = resource.extension?.find((e) => e.url === DATA_EXT)?.valueString;
  if (!raw) throw new Error('Malformed purchase order resource');
  return { ...JSON.parse(raw), id: resource.id };
}

function belongsToClinic(resource: Basic, clinicId: string) {
  return resource.identifier?.some(
    (i) => i.system === CLINIC_SYSTEM && i.value === clinicId
  );
}

export async function GET(req: NextRequest) {
  try {
    const { medplum, clinicId } = await requireClinicAuth(req);
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (id) {
      const resource = await medplum.readResource('Basic', id) as Basic;
      if (!belongsToClinic(resource, clinicId)) {
        return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, purchaseOrder: fromBasic(resource) });
    }

    const resources = await medplum.searchResources('Basic', {
      code: `${CODE_SYSTEM}|${CODE_VALUE}`,
      _count: '500',
      _sort: '-_lastUpdated',
    });
    const orders = (resources ?? [])
      .filter((r) => belongsToClinic(r, clinicId))
      .map(fromBasic);
    return NextResponse.json({ success: true, purchaseOrders: orders });
  } catch (error) {
    return handleRouteError(error, 'GET /api/purchases');
  }
}

export async function POST(req: NextRequest) {
  try {
    const { medplum, clinicId } = await requireClinicAuth(req);
    const input = await req.json();

    if (!input.supplierId || !input.supplierName) {
      return NextResponse.json(
        { success: false, error: 'supplierId and supplierName are required' },
        { status: 400 }
      );
    }

    const items = normalizeItems(input.items ?? []);
    const amounts = computeAmounts(items, input);

    const data = {
      documentType: input.documentType || 'purchaseOrder',
      sourceDocumentId: '',
      convertedDocumentIds: [],
      reference: input.reference || '',
      supplierId: input.supplierId,
      supplierName: input.supplierName,
      paymentTerms: input.paymentTerms || '',
      orderedAt: input.orderedAt || '',
      dueDate: input.dueDate || '',
      notes: input.notes || '',
      status: input.status || 'draft',
      items,
      ...amounts,
    };

    const created = await medplum.createResource(toBasic(data, clinicId));
    return NextResponse.json({ success: true, id: created.id, purchaseOrder: fromBasic(created) });
  } catch (error) {
    return handleRouteError(error, 'POST /api/purchases');
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { medplum, clinicId } = await requireClinicAuth(req);
    const body = await req.json();
    const { id, action, ...rest } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
    }

    const existing = await medplum.readResource('Basic', id) as Basic;
    if (!belongsToClinic(existing, clinicId)) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }
    const current = fromBasic(existing);

    // ── Receive purchase order ─────────────────────────────────────────
    if (action === 'receive') {
      if (current.status === 'received' || current.documentType !== 'purchaseOrder') {
        return NextResponse.json({ success: false, error: 'Cannot receive this document' }, { status: 400 });
      }

      for (const item of current.items ?? []) {
        const medication = await getInventoryMedicationByIdFromMedplum(
          medplum,
          item.medicationId,
          clinicId
        );
        if (!medication) continue;

        const qty =
          Number(item.receivedQuantity ?? item.requestedQuantity ?? item.quantity ?? 0) || 0;
        await updateInventoryMedicationInMedplum(medplum, item.medicationId, {
          stock: medication.stock + qty,
          unitPrice: Number(item.unitCost) || medication.unitPrice,
        }, clinicId);
      }

      const updated = { ...current, status: 'received', receivedAt: new Date().toISOString() };
      const saved = await medplum.updateResource({ ...toBasic(updated, clinicId), id });
      return NextResponse.json({ success: true, purchaseOrder: fromBasic(saved) });
    }

    // ── Convert purchase document ──────────────────────────────────────
    if (action === 'convert') {
      const { targetType } = rest;
      const sourceType = current.documentType || 'purchaseOrder';
      if (sourceType === targetType) {
        return NextResponse.json({ success: false, error: 'Same document type' }, { status: 400 });
      }
      if (sourceType === 'rfq' && targetType !== 'purchaseOrder') {
        return NextResponse.json({ success: false, error: 'RFQ can only convert to purchase order' }, { status: 400 });
      }
      if (sourceType === 'purchaseOrder' && targetType !== 'invoice') {
        return NextResponse.json({ success: false, error: 'Purchase order can only convert to invoice' }, { status: 400 });
      }
      if (sourceType === 'invoice') {
        return NextResponse.json({ success: false, error: 'Invoice cannot be converted' }, { status: 400 });
      }

      const items = normalizeItems(current.items ?? []);
      const amounts = computeAmounts(items, { ...current, ...rest });

      const newData = {
        documentType: targetType,
        sourceDocumentId: id,
        convertedDocumentIds: [],
        reference: rest.reference || current.reference || '',
        supplierId: current.supplierId,
        supplierName: current.supplierName,
        paymentTerms: rest.paymentTerms ?? current.paymentTerms ?? '',
        orderedAt: rest.orderedAt || '',
        dueDate: rest.dueDate ?? current.dueDate ?? '',
        notes: rest.notes ?? current.notes ?? '',
        status: 'ordered',
        items,
        ...amounts,
      };
      const created = await medplum.createResource(toBasic(newData, clinicId));

      // Link the source document
      const updatedSource = {
        ...current,
        convertedDocumentIds: [...(current.convertedDocumentIds ?? []), created.id],
      };
      await medplum.updateResource({ ...toBasic(updatedSource, clinicId), id });

      return NextResponse.json({ success: true, id: created.id, purchaseOrder: fromBasic(created) });
    }

    // ── Plain field update ─────────────────────────────────────────────
    let updated = { ...current, ...rest };
    if (rest.items) {
      const items = normalizeItems(rest.items);
      const amounts = computeAmounts(items, { ...current, ...rest });
      updated = { ...updated, items, ...amounts };
    }
    const saved = await medplum.updateResource({ ...toBasic(updated, clinicId), id });
    return NextResponse.json({ success: true, purchaseOrder: fromBasic(saved) });
  } catch (error) {
    return handleRouteError(error, 'PATCH /api/purchases');
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { medplum, clinicId } = await requireClinicAuth(req);
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
    }
    const existing = await medplum.readResource('Basic', id) as Basic;
    if (!belongsToClinic(existing, clinicId)) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }
    await medplum.deleteResource('Basic', id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRouteError(error, 'DELETE /api/purchases');
  }
}
