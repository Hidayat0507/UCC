"use client";

import * as React from "react";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  PackageCheck,
  Plus,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { Medication } from "@/lib/inventory";
import type {
  PurchaseDocumentType,
  PurchaseOrder,
  PurchaseOrderStatus,
  Supplier,
} from "@/lib/purchase-hub";

interface PurchaseOrdersPanelProps {
  medications: Medication[];
  purchaseOrders: PurchaseOrder[];
  suppliers: Supplier[];
  autoCreate?: PurchaseDocumentType | null;
  onAutoCreateConsumed?: () => void;
  onCreate: (input: {
    documentType: PurchaseDocumentType;
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
    items: Array<{
      medicationId: string;
      medicationName: string;
      quantity?: number;
      requestedQuantity?: number;
      receivedQuantity?: number;
      unitCost: number;
      batchNumber?: string;
      expiryDate?: string;
    }>;
  }) => Promise<void>;
  onReceive: (id: string) => Promise<void>;
  onConvert: (id: string, targetType: PurchaseDocumentType) => Promise<void>;
}

const typeLabels: Record<PurchaseDocumentType, string> = {
  rfq: "Request for quotation",
  purchaseOrder: "Purchase order",
  invoice: "Supplier invoice",
};

const statusClasses: Record<PurchaseOrderStatus, string> = {
  draft: "bg-slate-100 text-slate-700",
  ordered: "bg-amber-100 text-amber-800",
  received: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-rose-100 text-rose-800",
};

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

export function PurchaseOrdersPanel({
  medications,
  purchaseOrders,
  suppliers,
  autoCreate,
  onAutoCreateConsumed,
  onCreate,
  onReceive,
  onConvert,
}: PurchaseOrdersPanelProps) {
  const [searchTerm, setSearchTerm] = React.useState("");
  const [supplierFilter, setSupplierFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [referenceFilter, setReferenceFilter] = React.useState("");
  const [showDocumentSelector, setShowDocumentSelector] = React.useState(false);
  const [showCreateOrder, setShowCreateOrder] = React.useState(false);
  const [selectedDocumentType, setSelectedDocumentType] =
    React.useState<PurchaseDocumentType>("purchaseOrder");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState<(typeof PAGE_SIZE_OPTIONS)[number]>(10);

  React.useEffect(() => {
    if (autoCreate) {
      queueMicrotask(() => {
        setSelectedDocumentType(autoCreate);
        setShowCreateOrder(true);
        onAutoCreateConsumed?.();
      });
    }
  }, [autoCreate, onAutoCreateConsumed]);

  const filteredOrders = React.useMemo(
    () =>
      purchaseOrders.filter((order) => {
        const query = searchTerm.toLowerCase();
        const matchesSearch =
          order.supplierName.toLowerCase().includes(query) ||
          (order.reference || "").toLowerCase().includes(query) ||
          order.status.toLowerCase().includes(query) ||
          order.items.some((item) => item.medicationName.toLowerCase().includes(query));
        const matchesSupplier = supplierFilter === "all" || order.supplierId === supplierFilter;
        const matchesStatus = statusFilter === "all" || order.status === statusFilter;
        const matchesReference =
          referenceFilter.trim().length === 0 ||
          (order.reference || "").toLowerCase().includes(referenceFilter.toLowerCase());
        return matchesSearch && matchesSupplier && matchesStatus && matchesReference;
      }),
    [purchaseOrders, referenceFilter, searchTerm, statusFilter, supplierFilter]
  );
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = filteredOrders.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const pageEnd = Math.min(currentPage * pageSize, filteredOrders.length);
  const paginatedOrders = filteredOrders.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-6">
      <Card className="border-slate-200/80 shadow-sm">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-xl">Purchase documents</CardTitle>
            <p className="text-sm text-muted-foreground">
              Supplier-led RFQ, purchase order and invoice flows.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Input
              placeholder="Search orders, supplier, item"
              value={searchTerm}
              onChange={(event) => {
                setSearchTerm(event.target.value);
                setPage(1);
              }}
              className="sm:w-72"
            />
            <Button className="gap-2" onClick={() => setShowDocumentSelector(true)}>
              <Plus className="h-4 w-4" />
              Create new
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid gap-3 border-b border-slate-200 pb-4 md:grid-cols-4">
            <Select
              value={supplierFilter}
              onValueChange={(value) => {
                setSupplierFilter(value);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Supplier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All suppliers</SelectItem>
                {suppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Reference"
              value={referenceFilter}
              onChange={(event) => {
                setReferenceFilter(event.target.value);
                setPage(1);
              }}
            />
            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="ordered">Ordered</SelectItem>
                <SelectItem value="received">Received</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center justify-end">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setSupplierFilter("all");
                  setReferenceFilter("");
                  setStatusFilter("all");
                  setSearchTerm("");
                  setPage(1);
                }}
              >
                Reset filters
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200/80">
            <Table className="min-w-[920px]">
              <TableHeader>
                <TableRow className="bg-slate-50/80">
                  <TableHead>Document</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Requested / Received</TableHead>
                  <TableHead>Amount due</TableHead>
                  <TableHead className="w-[160px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
                      No purchase documents yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell>
                        <Badge variant="secondary" className="bg-slate-100 text-slate-700">
                          {typeLabels[order.documentType || "purchaseOrder"]}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium text-slate-900">{order.supplierName}</TableCell>
                      <TableCell>{order.reference || "-"}</TableCell>
                      <TableCell>
                        <Badge className={statusClasses[order.status]}>{order.status}</Badge>
                      </TableCell>
                      <TableCell>
                        {order.items.reduce(
                          (sum, item) =>
                            sum + Number(item.requestedQuantity ?? item.quantity ?? item.receivedQuantity ?? 0),
                          0
                        )}{" "}
                        /{" "}
                        {order.items.reduce((sum, item) => sum + Number(item.receivedQuantity ?? 0), 0)}
                      </TableCell>
                      <TableCell>RM {order.amountDue.toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {order.documentType === "rfq" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onConvert(order.id, "purchaseOrder")}
                            >
                              Create PO
                            </Button>
                          ) : null}
                          {order.documentType === "purchaseOrder" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onConvert(order.id, "invoice")}
                            >
                              Create invoice
                            </Button>
                          ) : null}
                          {order.documentType === "purchaseOrder" && order.status === "ordered" ? (
                            <Button size="sm" className="gap-2" onClick={() => onReceive(order.id)}>
                              <PackageCheck className="h-4 w-4" />
                              Receive
                            </Button>
                          ) : null}
                          {order.documentType === "invoice" && order.status === "ordered" ? (
                            <span className="text-sm text-muted-foreground">Awaiting payment settlement</span>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {filteredOrders.length > 0 ? (
            <div className="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <div>
                Showing {pageStart}-{pageEnd} of {filteredOrders.length} documents
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={String(pageSize)}
                  onValueChange={(value) => {
                    setPageSize(Number(value) as (typeof PAGE_SIZE_OPTIONS)[number]);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="h-9 w-[118px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZE_OPTIONS.map((size) => (
                      <SelectItem key={size} value={String(size)}>
                        {size} / page
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={currentPage <= 1}
                >
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Previous
                </Button>
                <span className="min-w-20 text-center">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  disabled={currentPage >= totalPages}
                >
                  Next
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={showDocumentSelector} onOpenChange={setShowDocumentSelector}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Create new document</DialogTitle>
            <DialogDescription>
              Choose the purchase document type to start the workflow.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            {(Object.keys(typeLabels) as PurchaseDocumentType[]).map((documentType) => (
              <button
                key={documentType}
                type="button"
                className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-left transition hover:border-emerald-300 hover:bg-emerald-50"
                onClick={() => {
                  setSelectedDocumentType(documentType);
                  setShowDocumentSelector(false);
                  setShowCreateOrder(true);
                }}
              >
                <div className="space-y-1">
                  <p className="font-semibold text-slate-950">{typeLabels[documentType]}</p>
                  <p className="text-sm text-muted-foreground">
                    {documentType === "rfq"
                      ? "Prepare vendor request pricing before ordering."
                      : documentType === "invoice"
                        ? "Record supplier invoice with payment details."
                        : "Create and track supplier ordering with receiving workflow."}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-emerald-700" />
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showCreateOrder} onOpenChange={setShowCreateOrder}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Create {typeLabels[selectedDocumentType]}</DialogTitle>
            <DialogDescription>
              Fill in supplier and line items to create this purchase document.
            </DialogDescription>
          </DialogHeader>
          <PurchaseOrderForm
            documentType={selectedDocumentType}
            medications={medications}
            suppliers={suppliers}
            onCancel={() => setShowCreateOrder(false)}
            onSubmit={async (data) => {
              await onCreate(data);
              setShowCreateOrder(false);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PurchaseOrderForm({
  documentType,
  medications,
  suppliers,
  onSubmit,
  onCancel,
}: {
  documentType: PurchaseDocumentType;
  medications: Medication[];
  suppliers: Supplier[];
  onSubmit: (input: {
    documentType: PurchaseDocumentType;
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
    items: Array<{
      medicationId: string;
      medicationName: string;
      quantity?: number;
      requestedQuantity?: number;
      receivedQuantity?: number;
      unitCost: number;
      batchNumber?: string;
      expiryDate?: string;
    }>;
  }) => Promise<void>;
  onCancel: () => void;
}) {
  const [supplierId, setSupplierId] = React.useState("");
  const [reference, setReference] = React.useState("");
  const [paymentTerms, setPaymentTerms] = React.useState("");
  const [orderedAt, setOrderedAt] = React.useState("");
  const [dueDate, setDueDate] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [status, setStatus] = React.useState<PurchaseOrderStatus>(documentType === "rfq" ? "draft" : "ordered");
  const [taxAmount, setTaxAmount] = React.useState("");
  const [adjustmentAmount, setAdjustmentAmount] = React.useState("");
  const [deliveryCharge, setDeliveryCharge] = React.useState("");
  const [paidAmount, setPaidAmount] = React.useState("");
  const [items, setItems] = React.useState([
    {
      medicationId: "",
      medicationName: "",
      requestedQuantity: "1",
      receivedQuantity: documentType === "invoice" ? "1" : "",
      unitCost: "",
      batchNumber: "",
      expiryDate: "",
    },
  ]);

  const supplier = suppliers.find((entry) => entry.id === supplierId);
  const hasValidLineItem = items.some((item) => item.medicationId && Number(item.requestedQuantity) > 0);
  const canSubmit = Boolean(supplier && hasValidLineItem);
  const validationHints: string[] = [];
  if (!supplier) validationHints.push("select a supplier");
  if (!hasValidLineItem) validationHints.push("add at least one line item with quantity above 0");
  const subtotal = items.reduce(
    (sum, item) => sum + (Number(item.requestedQuantity) || 0) * (Number(item.unitCost) || 0),
    0
  );
  const total = subtotal + (Number(taxAmount) || 0) + (Number(adjustmentAmount) || 0) + (Number(deliveryCharge) || 0);
  const amountDue = Math.max(0, total - (Number(paidAmount) || 0));

  function updateItem(index: number, next: Partial<(typeof items)[number]>) {
    setItems((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...next } : item)));
  }

  return (
    <form
      className="space-y-6"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!supplier) return;
        const normalizedItems = items
          .filter((item) => item.medicationId && Number(item.requestedQuantity) > 0)
          .map((item) => ({
            ...item,
            requestedQuantity: Number(item.requestedQuantity) || 0,
            receivedQuantity: Number(item.receivedQuantity) || 0,
            unitCost: Number(item.unitCost) || 0,
          }));
        await onSubmit({
          documentType,
          reference: reference.trim() || undefined,
          supplierId: supplier.id,
          supplierName: supplier.name,
          paymentTerms: paymentTerms.trim() || undefined,
          orderedAt,
          dueDate,
          notes,
          status,
          taxAmount: Number(taxAmount) || 0,
          adjustmentAmount: Number(adjustmentAmount) || 0,
          deliveryCharge: Number(deliveryCharge) || 0,
          paidAmount: Number(paidAmount) || 0,
          items: normalizedItems,
        });
      }}
    >
      <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label>Document type</Label>
          <Input value={typeLabels[documentType]} disabled />
        </div>
        <div className="space-y-2">
          <Label>Reference</Label>
          <Input value={reference} onChange={(event) => setReference(event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Supplier</Label>
          <Select value={supplierId} onValueChange={setSupplierId}>
            <SelectTrigger>
              <SelectValue placeholder="Select supplier" />
            </SelectTrigger>
            <SelectContent>
              {suppliers.map((supplierOption) => (
                <SelectItem key={supplierOption.id} value={supplierOption.id}>
                  {supplierOption.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Document date</Label>
          <Input type="date" value={orderedAt} onChange={(event) => setOrderedAt(event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Due date</Label>
          <Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Payment terms</Label>
          <Input value={paymentTerms} onChange={(event) => setPaymentTerms(event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={status} onValueChange={(value) => setStatus(value as PurchaseOrderStatus)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="ordered">Ordered</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="received">Received</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/70 px-4 py-3">
          <p className="font-medium text-slate-950">Line items</p>
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={() =>
              setItems((current) => [
                ...current,
                {
                  medicationId: "",
                  medicationName: "",
                  requestedQuantity: "1",
                  receivedQuantity: "",
                  unitCost: "",
                  batchNumber: "",
                  expiryDate: "",
                },
              ])
            }
          >
            <Plus className="h-4 w-4" />
            Add line
          </Button>
        </div>

        <div className="space-y-4 p-4">
          {items.map((item, index) => (
            <div key={`item-${index}`} className="grid gap-3 rounded-2xl border border-slate-200 p-4 md:grid-cols-12">
              <div className="space-y-2 md:col-span-3">
                <Label>Medication</Label>
                <Select
                  value={item.medicationId}
                  onValueChange={(value) => {
                    const medication = medications.find((entry) => entry.id === value);
                    updateItem(index, {
                      medicationId: value,
                      medicationName: medication?.name || "",
                      unitCost: medication?.unitPrice ? String(medication.unitPrice) : "",
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select medication" />
                  </SelectTrigger>
                  <SelectContent>
                    {medications.map((medication) => (
                      <SelectItem key={medication.id} value={medication.id}>
                        {medication.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-1">
                <Label>Req</Label>
                <Input
                  type="number"
                  min="1"
                  value={item.requestedQuantity}
                  onChange={(event) => updateItem(index, { requestedQuantity: event.target.value })}
                />
              </div>
              <div className="space-y-2 md:col-span-1">
                <Label>Rec</Label>
                <Input
                  type="number"
                  min="0"
                  value={item.receivedQuantity}
                  onChange={(event) => updateItem(index, { receivedQuantity: event.target.value })}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Unit cost</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.unitCost}
                  onChange={(event) => updateItem(index, { unitCost: event.target.value })}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Batch</Label>
                <Input value={item.batchNumber} onChange={(event) => updateItem(index, { batchNumber: event.target.value })} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Expiry</Label>
                <Input type="date" value={item.expiryDate} onChange={(event) => updateItem(index, { expiryDate: event.target.value })} />
              </div>
              <div className="flex items-end md:col-span-1">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={items.length === 1}
                  onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                >
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Notes</Label>
        <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} />
      </div>

      <div className="grid gap-3 rounded-2xl border border-slate-200 p-4 md:grid-cols-4">
        <div className="space-y-2">
          <Label>Tax</Label>
          <Input type="number" value={taxAmount} onChange={(event) => setTaxAmount(event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Adjustment</Label>
          <Input type="number" value={adjustmentAmount} onChange={(event) => setAdjustmentAmount(event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Delivery</Label>
          <Input type="number" value={deliveryCharge} onChange={(event) => setDeliveryCharge(event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Paid</Label>
          <Input type="number" value={paidAmount} onChange={(event) => setPaidAmount(event.target.value)} />
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Subtotal RM {subtotal.toFixed(2)} · Total RM {total.toFixed(2)}
          </p>
          <p className="text-2xl font-semibold tracking-tight text-slate-950">Amount due RM {amountDue.toFixed(2)}</p>
          {!canSubmit ? (
            <p className="mt-2 text-sm text-amber-700" role="status" aria-live="polite">
              To continue, {validationHints.join(" and ")}.
            </p>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={!canSubmit}>
            Save document
          </Button>
        </div>
      </div>
    </form>
  );
}
