import { db } from "./firebase";
import {
  Timestamp,
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  updateDoc,
  type DocumentData,
} from "firebase/firestore";

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

const SUPPLIERS = "inventorySuppliers";
const PURCHASE_ORDERS = "inventoryPurchaseOrders";
const MEDICATIONS = "medications";

function convertTimestamps<T extends DocumentData>(data: T): T {
  const result = { ...data } as DocumentData;
  if (result.createdAt?.toDate) result.createdAt = result.createdAt.toDate();
  if (result.updatedAt?.toDate) result.updatedAt = result.updatedAt.toDate();
  return result as T;
}

function normalizeItems(items: PurchaseOrderItemInput[]): PurchaseOrderItem[] {
  return items.map((item) => ({
    ...item,
    quantity: Number(item.quantity ?? item.requestedQuantity ?? item.receivedQuantity ?? 0) || 0,
    requestedQuantity: Number(item.requestedQuantity ?? item.quantity ?? 0) || 0,
    receivedQuantity: Number(item.receivedQuantity ?? 0) || 0,
    unitCost: Number(item.unitCost) || 0,
    lineTotal:
      (Number(item.requestedQuantity ?? item.quantity ?? item.receivedQuantity ?? 0) || 0) *
      (Number(item.unitCost) || 0),
    batchNumber: item.batchNumber || "",
    expiryDate: item.expiryDate || "",
  }));
}

export async function getSuppliers(): Promise<Supplier[]> {
  const snapshot = await getDocs(query(collection(db, SUPPLIERS), orderBy("name")));
  return snapshot.docs.map((entry) => ({
    id: entry.id,
    ...convertTimestamps(entry.data()),
  })) as Supplier[];
}

export async function createSupplier(
  data: Omit<Supplier, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  const now = Timestamp.now();
  const docRef = await addDoc(collection(db, SUPPLIERS), {
    ...data,
    createdAt: now,
    updatedAt: now,
  });
  return docRef.id;
}

export async function updateSupplier(id: string, data: Partial<Supplier>): Promise<void> {
  await updateDoc(doc(db, SUPPLIERS, id), {
    ...data,
    updatedAt: Timestamp.now(),
  });
}

export async function deleteSupplier(id: string): Promise<void> {
  await deleteDoc(doc(db, SUPPLIERS, id));
}

export async function getPurchaseOrders(): Promise<PurchaseOrder[]> {
  const snapshot = await getDocs(
    query(collection(db, PURCHASE_ORDERS), orderBy("createdAt", "desc"))
  );
  return snapshot.docs.map((entry) => {
    const data = convertTimestamps(entry.data()) as Partial<PurchaseOrder>;
    const subtotalAmount = Number(data.subtotalAmount ?? data.totalAmount ?? 0);
    const taxAmount = Number(data.taxAmount || 0);
    const adjustmentAmount = Number(data.adjustmentAmount || 0);
    const deliveryCharge = Number(data.deliveryCharge || 0);
    const paidAmount = Number(data.paidAmount || 0);
    const totalAmount = Number(data.totalAmount ?? subtotalAmount + taxAmount + adjustmentAmount + deliveryCharge);
    return {
      id: entry.id,
      ...data,
      documentType: data.documentType || "purchaseOrder",
      sourceDocumentId: data.sourceDocumentId || "",
      convertedDocumentIds: data.convertedDocumentIds || [],
      reference: data.reference || "",
      paymentTerms: data.paymentTerms || "",
      dueDate: data.dueDate || "",
      subtotalAmount,
      taxAmount,
      adjustmentAmount,
      deliveryCharge,
      paidAmount,
      totalAmount,
      amountDue: Number(data.amountDue ?? Math.max(0, totalAmount - paidAmount)),
    };
  }) as PurchaseOrder[];
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
  const items = normalizeItems(input.items);
  const subtotalAmount = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const taxAmount = Number(input.taxAmount || 0);
  const adjustmentAmount = Number(input.adjustmentAmount || 0);
  const deliveryCharge = Number(input.deliveryCharge || 0);
  const paidAmount = Number(input.paidAmount || 0);
  const totalAmount = subtotalAmount + taxAmount + adjustmentAmount + deliveryCharge;
  const amountDue = Math.max(0, totalAmount - paidAmount);
  const now = Timestamp.now();
  const docRef = await addDoc(collection(db, PURCHASE_ORDERS), {
    documentType: input.documentType || "purchaseOrder",
    sourceDocumentId: "",
    convertedDocumentIds: [],
    reference: input.reference || "",
    supplierId: input.supplierId,
    supplierName: input.supplierName,
    paymentTerms: input.paymentTerms || "",
    orderedAt: input.orderedAt || "",
    dueDate: input.dueDate || "",
    notes: input.notes || "",
    status: input.status,
    items,
    subtotalAmount,
    taxAmount,
    adjustmentAmount,
    deliveryCharge,
    paidAmount,
    totalAmount,
    amountDue,
    createdAt: now,
    updatedAt: now,
  });
  return docRef.id;
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
  return runTransaction(db, async (transaction) => {
    const sourceRef = doc(db, PURCHASE_ORDERS, input.sourceId);
    const sourceSnapshot = await transaction.get(sourceRef);
    if (!sourceSnapshot.exists()) {
      throw new Error("Source purchase document not found");
    }

    const source = sourceSnapshot.data() as PurchaseOrder;
    const sourceType = source.documentType || "purchaseOrder";
    if (sourceType === input.targetType) {
      throw new Error("Source and target document types must be different");
    }
    if (sourceType === "rfq" && input.targetType !== "purchaseOrder") {
      throw new Error("RFQ can only be converted into purchase order");
    }
    if (sourceType === "purchaseOrder" && input.targetType !== "invoice") {
      throw new Error("Purchase order can only be converted into invoice");
    }
    if (sourceType === "invoice") {
      throw new Error("Invoice cannot be converted to another document");
    }

    const newDocRef = doc(collection(db, PURCHASE_ORDERS));
    const now = Timestamp.now();
    const items = normalizeItems(source.items || []);
    const subtotalAmount = items.reduce((sum, item) => sum + item.lineTotal, 0);
    const taxAmount = Number(input.taxAmount ?? source.taxAmount ?? 0);
    const adjustmentAmount = Number(input.adjustmentAmount ?? source.adjustmentAmount ?? 0);
    const deliveryCharge = Number(input.deliveryCharge ?? source.deliveryCharge ?? 0);
    const paidAmount = Number(input.paidAmount ?? source.paidAmount ?? 0);
    const totalAmount = subtotalAmount + taxAmount + adjustmentAmount + deliveryCharge;
    const amountDue = Math.max(0, totalAmount - paidAmount);

    transaction.set(newDocRef, {
      documentType: input.targetType,
      sourceDocumentId: input.sourceId,
      convertedDocumentIds: [],
      reference: input.reference || "",
      supplierId: source.supplierId,
      supplierName: source.supplierName,
      paymentTerms: input.paymentTerms ?? source.paymentTerms ?? "",
      orderedAt: input.orderedAt || "",
      dueDate: input.dueDate ?? source.dueDate ?? "",
      notes: input.notes ?? source.notes ?? "",
      status: "ordered",
      items,
      subtotalAmount,
      taxAmount,
      adjustmentAmount,
      deliveryCharge,
      paidAmount,
      totalAmount,
      amountDue,
      createdAt: now,
      updatedAt: now,
    });

    transaction.update(sourceRef, {
      convertedDocumentIds: arrayUnion(newDocRef.id),
      updatedAt: now,
    });

    return newDocRef.id;
  });
}

export async function updatePurchaseOrder(
  id: string,
  input: Partial<Omit<PurchaseOrder, "id" | "createdAt" | "updatedAt">>
): Promise<void> {
  const nextData: Record<string, unknown> = {
    ...input,
    updatedAt: Timestamp.now(),
  };
  if (input.items) {
    const items = normalizeItems(input.items);
    const subtotalAmount = items.reduce((sum, item) => sum + item.lineTotal, 0);
    const taxAmount = Number((input as Partial<PurchaseOrder>).taxAmount || 0);
    const adjustmentAmount = Number((input as Partial<PurchaseOrder>).adjustmentAmount || 0);
    const deliveryCharge = Number((input as Partial<PurchaseOrder>).deliveryCharge || 0);
    const paidAmount = Number((input as Partial<PurchaseOrder>).paidAmount || 0);
    nextData.items = items;
    nextData.subtotalAmount = subtotalAmount;
    nextData.taxAmount = taxAmount;
    nextData.adjustmentAmount = adjustmentAmount;
    nextData.deliveryCharge = deliveryCharge;
    nextData.paidAmount = paidAmount;
    nextData.totalAmount = subtotalAmount + taxAmount + adjustmentAmount + deliveryCharge;
    nextData.amountDue = Math.max(0, subtotalAmount + taxAmount + adjustmentAmount + deliveryCharge - paidAmount);
  }
  await updateDoc(doc(db, PURCHASE_ORDERS, id), nextData);
}

export async function receivePurchaseOrder(id: string): Promise<void> {
  await runTransaction(db, async (transaction) => {
    const poRef = doc(db, PURCHASE_ORDERS, id);
    const poSnap = await transaction.get(poRef);

    if (!poSnap.exists()) {
      throw new Error("Purchase order not found");
    }

    const purchaseOrder = {
      id: poSnap.id,
      ...poSnap.data(),
    } as PurchaseOrder;

    if (purchaseOrder.status === "received" || purchaseOrder.documentType !== "purchaseOrder") {
      return;
    }

    for (const item of purchaseOrder.items || []) {
      const medicationRef = doc(db, MEDICATIONS, item.medicationId);
      const medicationSnap = await transaction.get(medicationRef);

      if (!medicationSnap.exists()) {
        throw new Error(`Medication ${item.medicationName} not found`);
      }

      const medication = medicationSnap.data();
      const currentStock = Number(medication.stock) || 0;
      const quantityToReceive = Number(item.receivedQuantity ?? item.requestedQuantity ?? item.quantity ?? 0) || 0;

      transaction.update(medicationRef, {
        stock: currentStock + quantityToReceive,
        unitPrice: Number(item.unitCost) || medication.unitPrice || 0,
        updatedAt: Timestamp.now(),
      });
    }

    transaction.update(poRef, {
      status: "received",
      receivedAt: new Date().toISOString(),
      updatedAt: Timestamp.now(),
    });
  });
}

export async function getPurchaseOrderById(id: string): Promise<PurchaseOrder | null> {
  const ref = doc(db, PURCHASE_ORDERS, id);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) return null;
  const data = convertTimestamps(snapshot.data()) as Partial<PurchaseOrder>;
  const subtotalAmount = Number(data.subtotalAmount ?? data.totalAmount ?? 0);
  const taxAmount = Number(data.taxAmount || 0);
  const adjustmentAmount = Number(data.adjustmentAmount || 0);
  const deliveryCharge = Number(data.deliveryCharge || 0);
  const paidAmount = Number(data.paidAmount || 0);
  const totalAmount = Number(data.totalAmount ?? subtotalAmount + taxAmount + adjustmentAmount + deliveryCharge);
  return {
    id: snapshot.id,
    ...data,
    documentType: data.documentType || "purchaseOrder",
    sourceDocumentId: data.sourceDocumentId || "",
    convertedDocumentIds: data.convertedDocumentIds || [],
    reference: data.reference || "",
    paymentTerms: data.paymentTerms || "",
    dueDate: data.dueDate || "",
    subtotalAmount,
    taxAmount,
    adjustmentAmount,
    deliveryCharge,
    paidAmount,
    totalAmount,
    amountDue: Number(data.amountDue ?? Math.max(0, totalAmount - paidAmount)),
  } as PurchaseOrder;
}
