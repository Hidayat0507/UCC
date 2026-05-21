"use client";

import * as React from "react";
import {
  AlertCircle,
  CheckCircle2,
  Package,
} from "lucide-react";

import { AddMedicationForm } from "@/components/inventory/add-medication-form";
import { InventoryTable } from "@/components/inventory/inventory-table";
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

type InventoryTab = "overview" | "items";

export default function InventoryPage() {
  const [activeTab, setActiveTab] = React.useState<InventoryTab>("overview");
  const [showAddDialog, setShowAddDialog] = React.useState(false);
  const [medications, setMedications] = React.useState<Medication[]>([]);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [overviewFilter, setOverviewFilter] = React.useState("All");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    void loadInventoryWorkspace();
  }, []);

  async function loadInventoryWorkspace() {
    try {
      const medicationData = await getMedications();
      setMedications(medicationData);
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

  const lowStockItems = medications.filter((medication) => medication.stock <= medication.minimumStock);
  const outOfStockItems = medications.filter((medication) => medication.stock === 0);
  const selectedMedication = lowStockItems[0] ?? medications[0] ?? null;
  const overviewMedications = React.useMemo(() => {
    if (overviewFilter === "All") return medications;
    if (overviewFilter === "Out of stock") return medications.filter((m) => m.stock === 0);
    if (overviewFilter === "Order soon") return medications.filter((m) => m.stock <= m.minimumStock);
    return medications.filter((m) => m.category === overviewFilter);
  }, [medications, overviewFilter]);

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
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to save medication.",
        variant: "destructive",
      });
      throw err;
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
      await deleteMedication(id);
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
          Manage medication stock, pricing, and reorder thresholds.
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
                      onClick={() => setOverviewFilter(label)}
                      className={[
                        "rounded-full px-3 py-1 transition",
                        overviewFilter === label
                          ? "bg-slate-900 text-white hover:bg-slate-800"
                          : "text-slate-600 hover:bg-slate-100",
                      ].join(" ")}
                    >
                      {label}
                    </button>
                  ))}
                  {Array.from(new Set(medications.map((item) => item.category))).slice(0, 3).map((category) => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setOverviewFilter(category)}
                      className={[
                        "rounded-full px-3 py-1 transition",
                        overviewFilter === category
                          ? "bg-slate-900 text-white hover:bg-slate-800"
                          : "text-slate-600 hover:bg-slate-100",
                      ].join(" ")}
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
                      {overviewMedications.slice(0, 6).map((item) => (
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
                      {overviewMedications.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                            No inventory items yet.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>

                {overviewMedications.length > 0 ? (
                  <div className="flex items-center justify-between pt-1 text-xs text-slate-500">
                    <span>
                      Showing {Math.min(6, overviewMedications.length)} of {overviewMedications.length}
                      {overviewFilter !== "All" ? ` matching "${overviewFilter}"` : ""}
                    </span>
                    {overviewMedications.length > 6 ? (
                      <button
                        type="button"
                        className="text-slate-700 underline hover:text-slate-900"
                        onClick={() => setActiveTab("items")}
                      >
                        View all
                      </button>
                    ) : null}
                  </div>
                ) : null}
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

            </div>
          </div>
        </TabsContent>

        <TabsContent value="items" className="space-y-6">
          <Card className="border-slate-200/80 shadow-sm">
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Medication inventory</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Continue managing stock directly from this table.
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
                      Create a medication inventory item for stock tracking.
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
