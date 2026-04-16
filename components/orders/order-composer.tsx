"use client";

import * as React from "react";
import { Search, Trash2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import {
  computeTreatmentPlanSummary,
  type TreatmentPlanEntry,
  type TreatmentPlanEntryInput,
  type TreatmentPlanSummary,
  type TreatmentPlanTab,
} from "@/lib/treatment-plan";

type CatalogItem = {
  id: string;
  name: string;
  unitPrice?: number;
  meta?: Record<string, string>;
};

interface OrderComposerProps {
  draftId: string;
  patientId: string;
  consultationId?: string;
  initialEntries?: TreatmentPlanEntry[];
  items: CatalogItem[];
  services: CatalogItem[];
  packages?: CatalogItem[];
  documents?: CatalogItem[];
  loadingCatalog?: boolean;
  onPlanChange?: (entries: TreatmentPlanEntry[], summary: TreatmentPlanSummary) => void;
  submitLabel?: string;
  submitting?: boolean;
}

const TABS: Array<{ key: TreatmentPlanTab; label: string }> = [
  { key: "items", label: "Items" },
  { key: "services", label: "Services" },
  { key: "packages", label: "Packages" },
  { key: "documents", label: "Documents" },
];

const TAB_EMPTY: Record<TreatmentPlanTab, string> = {
  items: "No inventory items in this catalog yet.",
  services: "No services in this catalog yet.",
  packages: "No packages in this catalog yet.",
  documents: "No documents in this catalog yet.",
};

function isDraftPersistenceUnavailable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("UNAUTHENTICATED") ||
    message.includes("invalid authentication credentials") ||
    message.includes("Failed to load treatment plan draft") ||
    message.includes("Failed to save treatment plan entry") ||
    message.includes("Failed to delete entry")
  );
}

export function OrderComposer({
  draftId,
  patientId,
  consultationId,
  initialEntries = [],
  items,
  services,
  packages = [],
  documents = [],
  loadingCatalog = false,
  onPlanChange,
  submitLabel = "Sign Order",
  submitting = false,
}: OrderComposerProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = React.useState<TreatmentPlanTab>("items");
  const [query, setQuery] = React.useState("");
  const [entries, setEntries] = React.useState<TreatmentPlanEntry[]>([]);
  const [summary, setSummary] = React.useState<TreatmentPlanSummary>(() => computeTreatmentPlanSummary([]));
  const [hydrated, setHydrated] = React.useState(false);
  const [savingIds, setSavingIds] = React.useState<Record<string, boolean>>({});
  const [persistenceDisabled, setPersistenceDisabled] = React.useState(false);

  const catalogByTab = React.useMemo<Record<TreatmentPlanTab, CatalogItem[]>>(
    () => ({
      items,
      services,
      packages,
      documents,
    }),
    [items, services, packages, documents]
  );

  const publishPlan = React.useCallback(
    (nextEntries: TreatmentPlanEntry[]) => {
      const nextSummary = computeTreatmentPlanSummary(nextEntries);
      setEntries(nextEntries);
      setSummary(nextSummary);
      onPlanChange?.(nextEntries, nextSummary);
    },
    [onPlanChange]
  );

  const loadDraft = React.useCallback(async () => {
    const response = await fetch(
      `/api/consultations/plan?draftId=${encodeURIComponent(draftId)}&patientId=${encodeURIComponent(
        patientId
      )}${consultationId ? `&consultationId=${encodeURIComponent(consultationId)}` : ""}`,
      { cache: "no-store" }
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.success) {
      throw new Error(data?.error || "Failed to load treatment plan draft");
    }
    return data.plan as { entries: TreatmentPlanEntry[]; summary: TreatmentPlanSummary };
  }, [consultationId, draftId, patientId]);

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const plan = await loadDraft();
        if (!active) return;
        if (plan.entries.length > 0) {
          publishPlan(plan.entries);
          return;
        }
        publishPlan(initialEntries);
      } catch (error) {
        if (!active) return;
        publishPlan(initialEntries);
        if (isDraftPersistenceUnavailable(error)) {
          setPersistenceDisabled(true);
        }
        console.error("Failed to hydrate treatment plan draft:", error);
      } finally {
        if (active) setHydrated(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [initialEntries, loadDraft, publishPlan]);

  const filteredCatalog = React.useMemo(() => {
    const tabItems = catalogByTab[activeTab];
    const term = query.trim().toLowerCase();
    if (!term) return tabItems;
    return tabItems.filter((item) => item.name.toLowerCase().includes(term));
  }, [activeTab, catalogByTab, query]);

  const persistEntry = React.useCallback(
    async (entry: TreatmentPlanEntryInput, rollback: () => void) => {
      if (persistenceDisabled) {
        return;
      }
      const pendingKey = entry.id || `${entry.tab}:${entry.catalogRef || entry.name}`;
      setSavingIds((prev) => ({ ...prev, [pendingKey]: true }));
      try {
        const response = await fetch("/api/consultations/plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ draftId, patientId, consultationId, entry }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data?.success) {
          throw new Error(data?.error || "Failed to save treatment plan entry");
        }
        publishPlan(data.plan.entries as TreatmentPlanEntry[]);
      } catch (error) {
        if (isDraftPersistenceUnavailable(error)) {
          setPersistenceDisabled(true);
          return;
        }
        rollback();
        toast({
          title: "Autosave failed",
          description: error instanceof Error ? error.message : "Failed to save treatment plan changes.",
          variant: "destructive",
        });
      } finally {
        setSavingIds((prev) => {
          const next = { ...prev };
          delete next[pendingKey];
          return next;
        });
      }
    },
    [consultationId, draftId, patientId, persistenceDisabled, publishPlan, toast]
  );

  const addCatalogItem = React.useCallback(
    async (tab: TreatmentPlanTab, item: CatalogItem) => {
      const nowIso = new Date().toISOString();
      const optimistic: TreatmentPlanEntry = {
        id: crypto.randomUUID(),
        tab,
        catalogRef: item.id,
        name: item.name,
        quantity: 1,
        unitPrice: Number(item.unitPrice || 0),
        lineTotal: Number((item.unitPrice || 0).toFixed(2)),
        meta: item.meta,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      const prev = entries;
      publishPlan([...prev, optimistic]);
      await persistEntry(
        {
          id: optimistic.id,
          tab: optimistic.tab,
          catalogRef: optimistic.catalogRef,
          name: optimistic.name,
          quantity: optimistic.quantity,
          unitPrice: optimistic.unitPrice,
          meta: optimistic.meta,
        },
        () => publishPlan(prev)
      );
    },
    [entries, persistEntry, publishPlan]
  );

  const addManualItem = React.useCallback(async () => {
    await addCatalogItem(activeTab, {
      id: `manual-${crypto.randomUUID()}`,
      name: `Custom ${activeTab.slice(0, -1)} entry`,
      unitPrice: 0,
      meta: { source: "manual" },
    });
  }, [activeTab, addCatalogItem]);

  const removeEntry = React.useCallback(
    async (entry: TreatmentPlanEntry) => {
      const prev = entries;
      const next = prev.filter((item) => item.id !== entry.id);
      publishPlan(next);
      if (persistenceDisabled) {
        return;
      }
      try {
        const response = await fetch("/api/consultations/plan", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ draftId, entryId: entry.id }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data?.success) {
          throw new Error(data?.error || "Failed to delete entry");
        }
        publishPlan(data.plan.entries as TreatmentPlanEntry[]);
      } catch (error) {
        if (isDraftPersistenceUnavailable(error)) {
          setPersistenceDisabled(true);
          return;
        }
        publishPlan(prev);
        toast({
          title: "Autosave failed",
          description: error instanceof Error ? error.message : "Failed to delete treatment plan entry.",
          variant: "destructive",
        });
      }
    },
    [draftId, entries, persistenceDisabled, publishPlan, toast]
  );

  const updateEntryField = React.useCallback(
    async (entry: TreatmentPlanEntry, patch: Partial<TreatmentPlanEntryInput>) => {
      const prev = entries;
      const next = prev.map((item) => {
        if (item.id !== entry.id) return item;
        const quantity = Number(patch.quantity ?? item.quantity);
        const unitPrice = Number(patch.unitPrice ?? item.unitPrice);
        return {
          ...item,
          ...patch,
          quantity,
          unitPrice,
          lineTotal: Number((quantity * unitPrice).toFixed(2)),
          updatedAt: new Date().toISOString(),
        };
      });
      publishPlan(next);
      await persistEntry(
        {
          id: entry.id,
          tab: entry.tab,
          catalogRef: entry.catalogRef,
          name: (patch.name ?? entry.name) as string,
          quantity: Number(patch.quantity ?? entry.quantity),
          unitPrice: Number(patch.unitPrice ?? entry.unitPrice),
          instruction: patch.instruction ?? entry.instruction,
          dosage: patch.dosage ?? entry.dosage,
          frequency: patch.frequency ?? entry.frequency,
          duration: patch.duration ?? entry.duration,
          meta: patch.meta ?? entry.meta,
        },
        () => publishPlan(prev)
      );
    },
    [entries, persistEntry, publishPlan]
  );

  const tabEntries = React.useMemo(
    () => entries.filter((entry) => entry.tab === activeTab),
    [activeTab, entries]
  );

  return (
    <Card className="h-full md:sticky md:top-2">
      <CardHeader className="pb-3">
        <CardTitle>Order Composer</CardTitle>
        <CardDescription>Autosaved draft with real-time billing totals.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TreatmentPlanTab)}>
          <TabsList className="grid w-full grid-cols-4">
            {TABS.map((tab) => (
              <TabsTrigger key={tab.key} value={tab.key}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {TABS.map((tab) => (
            <TabsContent key={tab.key} value={tab.key} className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    className="pl-8"
                    placeholder={`Search ${tab.label.toLowerCase()} catalog`}
                  />
                </div>
                <Button type="button" variant="outline" onClick={addManualItem}>
                  Add custom
                </Button>
              </div>

              <div className="max-h-40 space-y-1 overflow-auto rounded-md border p-2">
                {loadingCatalog ? <p className="text-xs text-muted-foreground">Loading catalog...</p> : null}
                {!loadingCatalog && filteredCatalog.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{TAB_EMPTY[tab.key]}</p>
                ) : null}
                {filteredCatalog.map((item) => (
                  <button
                    key={`${tab.key}-${item.id}`}
                    type="button"
                    className="w-full rounded-md border px-2 py-1 text-left text-sm hover:bg-muted"
                    onClick={() => addCatalogItem(tab.key, item)}
                  >
                    <div className="flex items-center justify-between">
                      <span>{item.name}</span>
                      <span className="text-xs text-muted-foreground">RM {(item.unitPrice || 0).toFixed(2)}</span>
                    </div>
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                {tabEntries.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No entries added yet.</p>
                ) : null}

                {tabEntries.map((entry) => (
                  <div key={entry.id} className="space-y-2 rounded-md border p-2">
                    <div className="flex items-center justify-between gap-2">
                      <Input
                        value={entry.name}
                        onChange={(event) => {
                          const next = entries.map((item) =>
                            item.id === entry.id ? { ...item, name: event.target.value } : item
                          );
                          publishPlan(next);
                        }}
                        onBlur={(event) => void updateEntryField(entry, { name: event.target.value })}
                      />
                      <Button type="button" variant="ghost" size="icon" onClick={() => void removeEntry(entry)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Qty</Label>
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          value={entry.quantity}
                          onChange={(event) => {
                            const value = Number(event.target.value || 0);
                            const next = entries.map((item) =>
                              item.id === entry.id
                                ? {
                                    ...item,
                                    quantity: value,
                                    lineTotal: Number((value * item.unitPrice).toFixed(2)),
                                  }
                                : item
                            );
                            publishPlan(next);
                          }}
                          onBlur={(event) => void updateEntryField(entry, { quantity: Number(event.target.value || 0) })}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Unit Price</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={entry.unitPrice}
                          onChange={(event) => {
                            const value = Number(event.target.value || 0);
                            const next = entries.map((item) =>
                              item.id === entry.id
                                ? {
                                    ...item,
                                    unitPrice: value,
                                    lineTotal: Number((value * item.quantity).toFixed(2)),
                                  }
                                : item
                            );
                            publishPlan(next);
                          }}
                          onBlur={(event) => void updateEntryField(entry, { unitPrice: Number(event.target.value || 0) })}
                        />
                      </div>
                    </div>

                    <Input
                      placeholder="Instruction"
                      value={entry.instruction || ""}
                      onChange={(event) => {
                        const next = entries.map((item) =>
                          item.id === entry.id ? { ...item, instruction: event.target.value } : item
                        );
                        publishPlan(next);
                      }}
                      onBlur={(event) => void updateEntryField(entry, { instruction: event.target.value })}
                    />

                    {(entry.tab === "items" || entry.tab === "services") && (
                      <div className="grid grid-cols-3 gap-2">
                        <Input
                          placeholder="Dosage"
                          value={entry.dosage || ""}
                          onChange={(event) => {
                            const next = entries.map((item) =>
                              item.id === entry.id ? { ...item, dosage: event.target.value } : item
                            );
                            publishPlan(next);
                          }}
                          onBlur={(event) => void updateEntryField(entry, { dosage: event.target.value })}
                        />
                        <Input
                          placeholder="Frequency"
                          value={entry.frequency || ""}
                          onChange={(event) => {
                            const next = entries.map((item) =>
                              item.id === entry.id ? { ...item, frequency: event.target.value } : item
                            );
                            publishPlan(next);
                          }}
                          onBlur={(event) => void updateEntryField(entry, { frequency: event.target.value })}
                        />
                        <Input
                          placeholder="Duration"
                          value={entry.duration || ""}
                          onChange={(event) => {
                            const next = entries.map((item) =>
                              item.id === entry.id ? { ...item, duration: event.target.value } : item
                            );
                            publishPlan(next);
                          }}
                          onBlur={(event) => void updateEntryField(entry, { duration: event.target.value })}
                        />
                      </div>
                    )}

                    <div className="text-right text-xs text-muted-foreground">
                      Line total: RM {entry.lineTotal.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>
          ))}
        </Tabs>

        <div className="sticky bottom-0 space-y-2 border-t bg-background pt-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span>RM {summary.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between text-sm font-semibold">
            <span>Total</span>
            <span>RM {summary.total.toFixed(2)}</span>
          </div>
          <Button type="submit" className="w-full" disabled={!hydrated || submitting}>
            {submitting ? "Saving..." : submitLabel}
          </Button>
          <p className="text-[11px] text-muted-foreground">
            {Object.keys(savingIds).length > 0 ? "Autosaving order composer..." : "All changes autosaved."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

