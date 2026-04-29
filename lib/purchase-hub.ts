
export interface Supplier {
  id: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PurchaseOrderItemInput {
  medicationId: string;
  medicationName: string;
  quantity?: number;
  requestedQuantity?: number;
  receivedQuantity?: number;
  unitCost: number;
  batchNumber?: string;
  expiryDate?: string;
}

export interface PurchaseOrderItem extends PurchaseOrderItemInput {
  lineTotal: number;
}

export type PurchaseOrderStatus = "draft" | "ordered" | "received" | "cancelled";
export type PurchaseDocumentType = "rfq" | "purchaseOrder" | "invoice";

export interface PurchaseOrder {
  id: string;
  documentType: PurchaseDocumentType;
  sourceDocumentId?: string;
  convertedDocumentIds?: string[];
  reference?: string;
  supplierId: string;
  supplierName: string;
  status: PurchaseOrderStatus;
  paymentTerms?: string;
  notes?: string;
  orderedAt?: string;
  dueDate?: string;
  receivedAt?: string;
  items: PurchaseOrderItem[];
  subtotalAmount: number;
  taxAmount: number;
  adjustmentAmount: number;
  deliveryCharge: number;
  paidAmount: number;
  totalAmount: number;
  amountDue: number;
  createdAt?: Date;
  updatedAt?: Date;
}


export async function getSuppliers(): Promise<Supplier[]> {
  try {
    const res = await fetch('/api/suppliers');
    if (!res.ok) return [];
    const data = await res.json();
    return data.suppliers ?? [];
  } catch {
    return [];
  }
}

export async function createSupplier(
  data: Omit<Supplier, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  const res = await fetch('/api/suppliers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error ?? 'Failed to create supplier');
  }
  const result = await res.json();
  return result.supplier.id;
}

export async function updateSupplier(id: string, data: Partial<Supplier>): Promise<void> {
  const res = await fetch('/api/suppliers', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, ...data }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error ?? 'Failed to update supplier');
  }
}

export async function deleteSupplier(id: string): Promise<void> {
  const res = await fetch(`/api/suppliers?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error ?? 'Failed to delete supplier');
  }
}

async function purchasesFetch(path: string, init?: RequestInit): Promise<any> {
  const res = await fetch(path, init);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error ?? `Purchase request failed (${res.status})`);
  }
  return res.json();
}

export async function getPurchaseOrders(): Promise<PurchaseOrder[]> {
  try {
    const data = await purchasesFetch('/api/purchases');
    return data.purchaseOrders ?? [];
  } catch {
    return [];
  }
}

export async function createPurchaseOrder(input: {
  documentType?: PurchaseDocumentType;
  reference?: string;
  supplierId: string;
  supplierName: string;
  paymentTerms?: string;
  orderedAt?: string;
  dueDate?: string;
  notes?: string;
  status: PurchaseOrderStatus;
  taxAmount?: number;
  adjustmentAmount?: number;
  deliveryCharge?: number;
  paidAmount?: number;
  items: PurchaseOrderItemInput[];
}): Promise<string> {
  const data = await purchasesFetch('/api/purchases', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return data.id;
}

export async function convertPurchaseDocument(input: {
  sourceId: string;
  targetType: PurchaseDocumentType;
  reference?: string;
  paymentTerms?: string;
  orderedAt?: string;
  dueDate?: string;
  notes?: string;
  taxAmount?: number;
  adjustmentAmount?: number;
  deliveryCharge?: number;
  paidAmount?: number;
}): Promise<string> {
  const data = await purchasesFetch('/api/purchases', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: input.sourceId, action: 'convert', ...input }),
  });
  return data.id;
}

export async function updatePurchaseOrder(
  id: string,
  input: Partial<Omit<PurchaseOrder, "id" | "createdAt" | "updatedAt">>
): Promise<void> {
  await purchasesFetch('/api/purchases', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, ...input }),
  });
}

export async function receivePurchaseOrder(id: string): Promise<void> {
  await purchasesFetch('/api/purchases', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, action: 'receive' }),
  });
}

export async function getPurchaseOrderById(id: string): Promise<PurchaseOrder | null> {
  try {
    const data = await purchasesFetch(`/api/purchases?id=${encodeURIComponent(id)}`);
    return data.purchaseOrder ?? null;
  } catch {
    return null;
  }
}
