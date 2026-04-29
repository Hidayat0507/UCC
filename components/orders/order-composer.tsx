"use client";

import * as React from "react";
import { Search, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  persistDrafts?: boolean;
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

function kindLabelForTab(tab: TreatmentPlanTab): string {
  switch (tab) {
    case "items":
      return "Medication";
    case "services":
      return "Service";
    case "packages":
      return "Package";
    case "documents":
      return "Document";
    default:
      return tab;
  }
}

function isDraftPersistenceUnavailable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("UNAUTHENTICATED") ||
    message.includes("invalid authentication credentials") ||
    message.includes("persistence is unavailable") ||
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
  persistDrafts = false,
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
  const [searchQuery, setSearchQuery] = React.useState("");
  const [entries, setEntries] = React.useState<TreatmentPlanEntry[]>([]);
  const [summary, setSummary] = React.useState<TreatmentPlanSummary>(() => computeTreatmentPlanSummary([]));
  const [hydrated, setHydrated] = React.useState(false);
  const [savingIds, setSavingIds] = React.useState<Record<string, boolean>>({});
  const [persistenceDisabled, setPersistenceDisabled] = React.useState(!persistDrafts);
  const [detailEntryId, setDetailEntryId] = React.useState<string | null>(null);

  const catalogByTab = React.useMemo<Record<TreatmentPlanTab, CatalogItem[]>>(
    () => ({
      items,
      services,
      packages,
      documents,
    }),
    [items, services, packages, documents]
  );

  const unifiedCatalogRows = React.useMemo(
    () =>
      TABS.flatMap((tab) =>
        catalogByTab[tab.key].map((item) => ({
          tab: tab.key,
          item,
          kindLabel: kindLabelForTab(tab.key),
        }))
      ),
    [catalogByTab]
  );

  const filteredPickerRows = React.useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    if (!term) return [];
    return unifiedCatalogRows.filter(({ item, kindLabel }) => {
      const h = `${item.name} ${kindLabel}`.toLowerCase();
      return h.includes(term);
    });
  }, [unifiedCatalogRows, searchQuery]);

  const sortedEntries = React.useMemo(
    () => [...entries].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [entries]
  );

  const detailEntry = detailEntryId ? entries.find((e) => e.id === detailEntryId) : undefined;

  React.useEffect(() => {
    if (detailEntryId && !entries.some((e) => e.id === detailEntryId)) {
      setDetailEntryId(null);
    }
  }, [entries, detailEntryId]);

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
    return data as {
      plan: { entries: TreatmentPlanEntry[]; summary: TreatmentPlanSummary };
      persistenceAvailable?: boolean;
    };
  }, [consultationId, draftId, patientId]);

  React.useEffect(() => {
    if (!persistDrafts) {
      publishPlan(initialEntries);
      setHydrated(true);
      return;
    }

    let active = true;
    (async () => {
      try {
        const data = await loadDraft();
        if (!active) return;
        if (data.persistenceAvailable === false) {
          setPersistenceDisabled(true);
        }
        if (data.plan.entries.length > 0) {
          publishPlan(data.plan.entries);
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
  }, [initialEntries, loadDraft, persistDrafts, publishPlan]);

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
        if (data?.persistenceAvailable === false) {
          setPersistenceDisabled(true);
          return;
        }
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

  const removeEntry = React.useCallback(
    async (entry: TreatmentPlanEntry) => {
      const prev = entries;
      const next = prev.filter((item) => item.id !== entry.id);
      publishPlan(next);
      setDetailEntryId((id) => (id === entry.id ? null : id));
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
        if (data?.persistenceAvailable === false) {
          setPersistenceDisabled(true);
          return;
        }
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

  return (
    <div className="flex h-full flex-col md:sticky md:top-2">
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="pl-8"
            />
          </div>

          {loadingCatalog ? (
            <p className="text-xs text-muted-foreground">Loading catalog…</p>
          ) : null}
          {searchQuery.trim() && !loadingCatalog && filteredPickerRows.length === 0 ? (
            <p className="text-xs text-muted-foreground">No matches.</p>
          ) : null}
          {filteredPickerRows.length > 0 ? (
            <div className="max-h-40 space-y-1 overflow-auto">
              {filteredPickerRows.map((row) => (
                <button
                  key={`${row.tab}-${row.item.id}`}
                  type="button"
                  className="w-full rounded-md border px-2 py-1.5 text-left text-sm hover:bg-muted"
                  onClick={() => {
                    void addCatalogItem(row.tab, row.item);
                    setSearchQuery("");
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 flex-1 truncate">{row.item.name}</span>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant="secondary" className="text-[10px] font-normal">
                        {row.kindLabel}
                      </Badge>
                      <span className="text-xs text-muted-foreground">RM {(row.item.unitPrice || 0).toFixed(2)}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : null}

          <div className="space-y-2">
            <p className="text-sm font-medium">Order</p>
            {sortedEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No line items yet.</p>
            ) : (
              sortedEntries.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  className="flex w-full items-center justify-between gap-2 rounded-md border bg-card px-3 py-2 text-left text-sm hover:bg-muted/50"
                  onClick={() => setDetailEntryId(entry.id)}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <Badge variant="outline" className="shrink-0 text-[10px] font-normal">
                      {kindLabelForTab(entry.tab)}
                    </Badge>
                    <span className="truncate font-medium">{entry.name}</span>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {entry.quantity} × RM {entry.unitPrice.toFixed(2)}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="shrink-0 space-y-2 border-t bg-background pt-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span>RM {summary.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between text-sm font-semibold">
            <span>Total</span>
            <span>RM {summary.total.toFixed(2)}</span>
          </div>
          <Button type="submit" className="w-full" disabled={!hydrated || submitting}>
            {submitting ? "Saving…" : submitLabel}
          </Button>
          <p className="text-[11px] text-muted-foreground">
            {Object.keys(savingIds).length > 0 ? "Autosaving order composer…" : "All changes autosaved."}
          </p>
        </div>
      </div>

      <Dialog open={Boolean(detailEntry)} onOpenChange={(open) => !open && setDetailEntryId(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Line item</DialogTitle>
            <DialogDescription>{detailEntry?.name}</DialogDescription>
          </DialogHeader>
          {detailEntry ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{kindLabelForTab(detailEntry.tab)}</Badge>
              </div>
              <div>
                <Label className="text-xs">Name</Label>
                <Input
                  value={detailEntry.name}
                  onChange={(event) => {
                    const next = entries.map((item) =>
                      item.id === detailEntry.id ? { ...item, name: event.target.value } : item
                    );
                    publishPlan(next);
                  }}
                  onBlur={(event) => void updateEntryField(detailEntry, { name: event.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Qty</Label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={detailEntry.quantity}
                    onChange={(event) => {
                      const value = Number(event.target.value || 0);
                      const next = entries.map((item) =>
                        item.id === detailEntry.id
                          ? {
                              ...item,
                              quantity: value,
                              lineTotal: Number((value * item.unitPrice).toFixed(2)),
                            }
                          : item
                      );
                      publishPlan(next);
                    }}
                    onBlur={(event) =>
                      void updateEntryField(detailEntry, { quantity: Number(event.target.value || 0) })
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs">Unit Price</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={detailEntry.unitPrice}
                    onChange={(event) => {
                      const value = Number(event.target.value || 0);
                      const next = entries.map((item) =>
                        item.id === detailEntry.id
                          ? {
                              ...item,
                              unitPrice: value,
                              lineTotal: Number((value * item.quantity).toFixed(2)),
                            }
                          : item
                      );
                      publishPlan(next);
                    }}
                    onBlur={(event) =>
                      void updateEntryField(detailEntry, { unitPrice: Number(event.target.value || 0) })
                    }
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">Instruction</Label>
                <Input
                  placeholder="Instruction"
                  value={detailEntry.instruction || ""}
                  onChange={(event) => {
                    const next = entries.map((item) =>
                      item.id === detailEntry.id ? { ...item, instruction: event.target.value } : item
                    );
                    publishPlan(next);
                  }}
                  onBlur={(event) => void updateEntryField(detailEntry, { instruction: event.target.value })}
                />
              </div>
              {(detailEntry.tab === "items" || detailEntry.tab === "services") && (
                <div className="grid grid-cols-3 gap-2">
                  <Input
                    placeholder="Dosage"
                    value={detailEntry.dosage || ""}
                    onChange={(event) => {
                      const next = entries.map((item) =>
                        item.id === detailEntry.id ? { ...item, dosage: event.target.value } : item
                      );
                      publishPlan(next);
                    }}
                    onBlur={(event) => void updateEntryField(detailEntry, { dosage: event.target.value })}
                  />
                  <Input
                    placeholder="Frequency"
                    value={detailEntry.frequency || ""}
                    onChange={(event) => {
                      const next = entries.map((item) =>
                        item.id === detailEntry.id ? { ...item, frequency: event.target.value } : item
                      );
                      publishPlan(next);
                    }}
                    onBlur={(event) => void updateEntryField(detailEntry, { frequency: event.target.value })}
                  />
                  <Input
                    placeholder="Duration"
                    value={detailEntry.duration || ""}
                    onChange={(event) => {
                      const next = entries.map((item) =>
                        item.id === detailEntry.id ? { ...item, duration: event.target.value } : item
                      );
                      publishPlan(next);
                    }}
                    onBlur={(event) => void updateEntryField(detailEntry, { duration: event.target.value })}
                  />
                </div>
              )}
              <p className="text-right text-xs text-muted-foreground">
                Line total: RM {detailEntry.lineTotal.toFixed(2)}
              </p>
            </div>
          ) : null}
          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
            <Button type="button" variant="destructive" onClick={() => detailEntry && void removeEntry(detailEntry)}>
              <Trash2 className="mr-2 h-4 w-4" />
              Remove
            </Button>
            <Button type="button" variant="default" onClick={() => setDetailEntryId(null)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
