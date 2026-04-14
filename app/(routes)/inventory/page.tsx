"use client";

import * as React from "react";
import {
  AlertCircle,
  CheckCircle2,
  Landmark,
  Package,
  Pill,
  Stethoscope,
} from "lucide-react";

import { AddMedicationForm } from "@/components/inventory/add-medication-form";
import { InventoryTable } from "@/components/inventory/inventory-table";
import { PurchaseOrdersPanel } from "@/components/inventory/purchase-orders-panel";
import ProceduresTable from "@/components/inventory/procedures-table";
import { SuppliersPanel } from "@/components/inventory/suppliers-panel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/use-toast";
import {
  createMedication,
  deleteMedication,
  getMedications,
  type Medication,
  updateMedication,
} from "@/lib/inventory";
import {
  createProcedure,
  deleteProcedure,
  getProcedures,
  type ProcedureItem,
  updateProcedure,
} from "@/lib/procedures";
import {
  convertPurchaseDocument,
  createPurchaseOrder,
  createSupplier,
  deleteSupplier,
  getPurchaseOrders,
  getSuppliers,
  receivePurchaseOrder,
  type PurchaseDocumentType,
  type PurchaseOrder,
  type Supplier,
  updateSupplier,
} from "@/lib/purchase-hub";

type InventoryTab = "overview" | "items" | "purchases" | "suppliers" | "procedures";

export default function InventoryPage() {
  const [activeTab, setActiveTab] = React.useState<InventoryTab>("overview");
  const [showAddDialog, setShowAddDialog] = React.useState(false);
  const [medications, setMedications] = React.useState<Medication[]>([]);
  const [procedures, setProcedures] = React.useState<ProcedureItem[]>([]);
  const [suppliers, setSuppliers] = React.useState<Supplier[]>([]);
  const [purchaseOrders, setPurchaseOrders] = React.useState<PurchaseOrder[]>([]);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [procSearch, setProcSearch] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    void loadInventoryWorkspace();
  }, []);

  async function loadInventoryWorkspace() {
    try {
      const [medicationData, procedureData, supplierData, purchaseOrderData] = await Promise.all([
        getMedications(),
        getProcedures(),
        getSuppliers(),
        getPurchaseOrders(),
      ]);
      setMedications(medicationData);
      setProcedures(procedureData);
      setSuppliers(supplierData);
      setPurchaseOrders(purchaseOrderData);
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Failed to load inventory workspace");
    } finally {
      setLoading(false);
    }
  }

  async function reloadMedications() {
    setMedications(await getMedications());
  }

  async function reloadProcedures() {
    setProcedures(await getProcedures());
  }

  async function reloadSuppliers() {
    setSuppliers(await getSuppliers());
  }

  async function reloadPurchaseOrders() {
    setPurchaseOrders(await getPurchaseOrders());
  }

  const lowStockItems = medications.filter((medication) => medication.stock <= medication.minimumStock);
  const outOfStockItems = medications.filter((medication) => medication.stock === 0);
  const inventoryValue = medications.reduce(
    (sum, medication) => sum + medication.stock * (medication.unitPrice || 0),
    0
  );
  const pendingOrders = purchaseOrders.filter((order) => order.status === "ordered");
  const selectedMedication = lowStockItems[0] ?? medications[0] ?? null;
  const stockReceived = purchaseOrders
    .filter((order) => order.status === "received")
    .reduce(
      (sum, order) =>
        sum +
        order.items.reduce(
          (itemSum, item) =>
            itemSum + Number(item.receivedQuantity ?? item.requestedQuantity ?? item.quantity ?? 0),
          0
        ),
      0
    );
  const stockPending = pendingOrders.reduce(
    (sum, order) =>
      sum +
      order.items.reduce(
        (itemSum, item) =>
          itemSum + Number(item.requestedQuantity ?? item.quantity ?? item.receivedQuantity ?? 0),
        0
      ),
    0
  );
  const totalTrackedStock = stockReceived + stockPending;
  const receivedPercentage = totalTrackedStock === 0 ? 0 : Math.round((stockReceived / totalTrackedStock) * 100);

  async function handleAddMedication(data: Omit<Medication, "id" | "createdAt" | "updatedAt">) {
    try {
      await createMedication(data);
      await reloadMedications();
      setShowAddDialog(false);
      toast({
        title: "Medication added",
        description: "The medication is now available in inventory.",
      });
    } catch (err) {
      console.error("Failed to add medication:", err);
      setError("Failed to add medication");
    }
  }

  async function handleEditMedication(id: string, data: Partial<Medication>) {
    try {
      await updateMedication(id, data);
      await reloadMedications();
      toast({
        title: "Medication updated",
        description: "The medication record has been updated.",
      });
    } catch (err) {
      console.error("Error updating medication:", err);
      toast({
        title: "Error",
        description: "Failed to update medication. Please try again.",
        variant: "destructive",
      });
    }
  }

  async function handleDeleteMedication(id: string) {
    try {
      const success = await deleteMedication(id);
      if (!success) throw new Error("Delete failed");
      await reloadMedications();
      toast({
        title: "Medication deleted",
        description: "The medication has been removed from inventory.",
      });
    } catch (err) {
      console.error(err);
      toast({
        title: "Error",
        description: "Failed to delete medication.",
        variant: "destructive",
      });
    }
  }

  async function handleCreateSupplier(data: Omit<Supplier, "id" | "createdAt" | "updatedAt">) {
    await createSupplier(data);
    await reloadSuppliers();
    toast({
      title: "Supplier saved",
      description: "The supplier can now be used in purchase orders.",
    });
  }

  async function handleUpdateSupplier(id: string, data: Partial<Supplier>) {
    await updateSupplier(id, data);
    await reloadSuppliers();
    toast({
      title: "Supplier updated",
      description: "Supplier details have been updated.",
    });
  }

  async function handleDeleteSupplier(id: string) {
    try {
      await deleteSupplier(id);
      await reloadSuppliers();
      toast({
        title: "Supplier deleted",
        description: "The supplier record has been removed.",
      });
    } catch (err) {
      console.error(err);
      toast({
        title: "Error",
        description: "Failed to delete supplier.",
        variant: "destructive",
      });
    }
  }

  async function handleCreatePurchaseOrder(input: {
    documentType: PurchaseDocumentType;
    reference?: string;
    supplierId: string;
    supplierName: string;
    paymentTerms?: string;
    orderedAt?: string;
    dueDate?: string;
    notes?: string;
    status: "draft" | "ordered" | "received" | "cancelled";
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
  }) {
    await createPurchaseOrder(input);
    await reloadPurchaseOrders();
    toast({
      title: "Purchase document created",
      description: "The purchase document has been saved.",
    });
  }

  async function handleReceivePurchaseOrder(id: string) {
    try {
      await receivePurchaseOrder(id);
      await Promise.all([reloadPurchaseOrders(), reloadMedications()]);
      toast({
        title: "Stock received",
        description: "The purchase order is marked received and stock has been updated.",
      });
    } catch (err) {
      console.error(err);
      toast({
        title: "Receive failed",
        description: err instanceof Error ? err.message : "Failed to receive purchase order.",
        variant: "destructive",
      });
    }
  }

  async function handleConvertPurchaseDocument(id: string, targetType: PurchaseDocumentType) {
    try {
      await convertPurchaseDocument({ sourceId: id, targetType });
      await reloadPurchaseOrders();
      toast({
        title: "Document converted",
        description:
          targetType === "purchaseOrder"
            ? "RFQ converted to purchase order."
            : "Purchase order converted to supplier invoice.",
      });
    } catch (err) {
      console.error(err);
      toast({
        title: "Conversion failed",
        description: err instanceof Error ? err.message : "Unable to convert purchase document.",
        variant: "destructive",
      });
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Inventory</h1>
        <p className="text-sm text-muted-foreground">
          Existing stock management, plus supplier-led purchasing and stock receiving.
        </p>
      </div>

      {lowStockItems.length > 0 ? (
        <Alert className="border-amber-200 bg-amber-50 text-amber-950">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Low stock attention</AlertTitle>
          <AlertDescription>
            {lowStockItems.map((item) => item.name).join(", ")} {lowStockItems.length === 1 ? "is" : "are"} at or below the minimum stock threshold.
          </AlertDescription>
        </Alert>
      ) : null}

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as InventoryTab)} className="space-y-6">
        <TabsList className="h-auto flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2">
          <TabsTrigger value="overview" className="rounded-xl">Overview</TabsTrigger>
          <TabsTrigger value="items" className="rounded-xl">Items</TabsTrigger>
          <TabsTrigger value="purchases" className="rounded-xl">Purchases</TabsTrigger>
          <TabsTrigger value="suppliers" className="rounded-xl">Suppliers</TabsTrigger>
          <TabsTrigger value="procedures" className="rounded-xl">Procedures</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[1.55fr_0.75fr]">
            <Card className="border-slate-200/80 shadow-sm">
              <CardContent className="space-y-5 p-5">
                <div className="grid gap-3 md:grid-cols-3">
                  <MetricCard
                    icon={<CheckCircle2 className="h-4 w-4 text-emerald-700" />}
                    label="In stock"
                    value={`${medications.length - outOfStockItems.length} inventories`}
                    hint="Available for use"
                  />
                  <MetricCard
                    icon={<AlertCircle className="h-4 w-4 text-rose-700" />}
                    label="Out of stock"
                    value={`${outOfStockItems.length} inventories`}
                    hint="Needs replenishment"
                  />
                  <MetricCard
                    icon={<Package className="h-4 w-4 text-amber-700" />}
                    label="Order soon"
                    value={`${lowStockItems.length} inventories`}
                    hint="At or below threshold"
                  />
                </div>

                <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3 text-sm">
                  {["All", "Order soon", "Out of stock"].map((label) => (
                    <button
                      key={label}
                      type="button"
                      className="rounded-full px-3 py-1 text-slate-600 transition hover:bg-slate-100"
                    >
                      {label}
                    </button>
                  ))}
                  {Array.from(new Set(medications.map((item) => item.category))).slice(0, 3).map((category) => (
                    <button
                      key={category}
                      type="button"
                      className="rounded-full px-3 py-1 text-slate-600 transition hover:bg-slate-100"
                    >
                      {category}
                    </button>
                  ))}
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-200/80">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3 font-medium">Name</th>
                        <th className="px-4 py-3 font-medium">Stocks</th>
                        <th className="px-4 py-3 font-medium">Unit Price</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {medications.slice(0, 6).map((item) => (
                        <tr key={item.id} className="border-t border-slate-100">
                          <td className="px-4 py-3 font-medium text-slate-900">{item.name}</td>
                          <td className="px-4 py-3">{item.stock} {item.unit}</td>
                          <td className="px-4 py-3">RM {item.unitPrice.toFixed(2)}</td>
                          <td className="px-4 py-3">
                            <Badge
                              variant="secondary"
                              className={
                                item.stock === 0
                                  ? "bg-rose-100 text-rose-700"
                                  : item.stock <= item.minimumStock
                                    ? "bg-amber-100 text-amber-700"
                                    : "bg-emerald-100 text-emerald-700"
                              }
                            >
                              {item.stock === 0 ? "Out of stock" : item.stock <= item.minimumStock ? "Order soon" : "In stock"}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                      {medications.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                            No inventory items yet.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card className="border-slate-200/80 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Selected item</CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedMedication ? (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                      <p className="font-medium text-slate-950">{selectedMedication.name}</p>
                      <div className="mt-4 grid gap-3 text-sm text-slate-600">
                        <div className="flex items-center justify-between">
                          <span>Stock</span>
                          <span>{selectedMedication.stock} {selectedMedication.unit}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Minimum</span>
                          <span>{selectedMedication.minimumStock}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Category</span>
                          <span>{selectedMedication.category}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Unit price</span>
                          <span>RM {selectedMedication.unitPrice.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-8 text-center text-sm text-muted-foreground">
                      No items selected yet.
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-slate-200/80 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Create a new</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3">
                  <Button variant="outline" disabled className="justify-start rounded-xl">
                    Quotation
                  </Button>
                  <Button className="justify-start rounded-xl" onClick={() => setActiveTab("purchases")}>
                    Purchase order
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
            <Card className="border-slate-200/80 shadow-sm">
              <CardHeader>
                <CardTitle>Purchases</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-3">
                <PurchaseSummaryCard label="Pending payment" value={`RM ${pendingOrders.reduce((sum, order) => sum + order.totalAmount, 0).toFixed(2)}`} tone="amber" />
                <PurchaseSummaryCard label="Inventory value" value={`RM ${inventoryValue.toFixed(2)}`} tone="slate" />
                <PurchaseSummaryCard label="Received orders" value={purchaseOrders.filter((order) => order.status === "received").length.toString()} tone="emerald" />
              </CardContent>
            </Card>

            <Card className="border-slate-200/80 shadow-sm">
              <CardHeader>
                <CardTitle>Inventory</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-2xl font-semibold tracking-tight text-slate-950">{stockReceived} stock received</p>
                  <p className="text-sm text-muted-foreground">
                    out of {totalTrackedStock} tracked units across purchase orders
                  </p>
                </div>
                <div className="h-2 rounded-full bg-slate-100">
                  <div
                    className="h-2 rounded-full bg-emerald-400 transition-all"
                    style={{ width: `${receivedPercentage}%` }}
                  />
                </div>
                <p className="text-right text-xs text-muted-foreground">{receivedPercentage}%</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="items" className="space-y-6">
          <Card className="border-slate-200/80 shadow-sm">
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Medication inventory</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Continue managing stock directly while the purchase hub feeds new stock into this table.
                </p>
              </div>
              <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogTrigger asChild>
                  <Button>Add medication</Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Add new medication</DialogTitle>
                    <DialogDescription>
                      Create an inventory item that can also be referenced in purchase orders.
                    </DialogDescription>
                  </DialogHeader>
                  <AddMedicationForm onSubmit={handleAddMedication} onCancel={() => setShowAddDialog(false)} />
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <InventoryTable
                medications={medications}
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                onEdit={handleEditMedication}
                onDelete={handleDeleteMedication}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="purchases" className="space-y-6">
          <PurchaseOrdersPanel
            medications={medications}
            purchaseOrders={purchaseOrders}
            suppliers={suppliers}
            onCreate={handleCreatePurchaseOrder}
            onReceive={handleReceivePurchaseOrder}
            onConvert={handleConvertPurchaseDocument}
          />
        </TabsContent>

        <TabsContent value="suppliers" className="space-y-6">
          <SuppliersPanel
            suppliers={suppliers}
            onCreate={handleCreateSupplier}
            onUpdate={handleUpdateSupplier}
            onDelete={handleDeleteSupplier}
          />
        </TabsContent>

        <TabsContent value="procedures" className="space-y-6">
          <Card className="border-slate-200/80 shadow-sm">
            <CardHeader>
              <CardTitle>Procedures and charges</CardTitle>
              <p className="text-sm text-muted-foreground">
                Maintain billable procedures separately from medication stock and purchase documents.
              </p>
            </CardHeader>
            <CardContent>
              <ProceduresTable
                procedures={procedures}
                searchTerm={procSearch}
                onSearchChange={setProcSearch}
                onCreate={async (data) => {
                  await createProcedure(data);
                  await reloadProcedures();
                }}
                onUpdate={async (id, data) => {
                  await updateProcedure(id, data);
                  await reloadProcedures();
                }}
                onDelete={async (id) => {
                  await deleteProcedure(id);
                  await reloadProcedures();
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2 text-sm text-slate-600">
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </div>
  );
}

function PurchaseSummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "amber" | "slate" | "emerald";
}) {
  const toneClasses = {
    amber: "border-amber-200 bg-amber-50/70 text-amber-950",
    slate: "border-slate-200 bg-slate-50/70 text-slate-950",
    emerald: "border-emerald-200 bg-emerald-50/70 text-emerald-950",
  } as const;

  return (
    <div className={`rounded-2xl border p-4 ${toneClasses[tone]}`}>
      <p className="text-sm">{label}</p>
      <p className="mt-3 text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}
