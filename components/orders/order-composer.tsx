"use client";

import * as React from "react";
import { Search, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { fetchOrganizationDetails, type OrganizationDetails } from "@/lib/org";
import { DEFAULT_MC_TEMPLATE, DEFAULT_REFERRAL_TEMPLATE } from "@/lib/document-templates";
import { formatDisplayDate } from "@/lib/utils";

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
  patient?: { id: string; fullName: string; nric: string } | null;
}

function calcMcEndDate(startDate: string, numDays: number): string {
  if (!startDate || numDays <= 0) return "N/A";
  const d = new Date(startDate);
  d.setDate(d.getDate() + numDays - 1);
  return formatDisplayDate(d);
}

const PRIMARY = "#1e3a5f";
const MUTED = "#6b7280";
const BODY = "#111827";

function DocLetterhead({ organization }: { organization: OrganizationDetails | null }) {
  const hasLetterhead = Boolean(organization?.name || organization?.address || organization?.phone);
  if (!hasLetterhead) return null;
  return (
    <div style={{ display: "flex", alignItems: "flex-start", marginBottom: 10 }}>
      {organization?.logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt="" src={organization.logoUrl} style={{ width: 56, height: 56, objectFit: "contain", marginRight: 12, flexShrink: 0 }} />
      )}
      <div>
        {organization?.name && <p style={{ fontSize: 14, fontWeight: 700, color: PRIMARY, margin: 0, marginBottom: 2 }}>{organization.name}</p>}
        {organization?.address && <p style={{ fontSize: 9, color: MUTED, margin: 0, lineHeight: 1.4 }}>{organization.address}</p>}
        {organization?.phone && <p style={{ fontSize: 9, color: MUTED, margin: 0, lineHeight: 1.4 }}>Tel: {organization.phone}</p>}
      </div>
    </div>
  );
}

function McDocumentPreview({
  patient,
  issuedDate,
  startDate,
  endDate,
  numDays,
  doctorName,
  organization,
}: {
  patient: { fullName: string; nric: string } | null;
  issuedDate: string;
  startDate: string;
  endDate: string;
  numDays: number;
  doctorName: string;
  organization: OrganizationDetails | null;
}) {
  return (
    <div style={{ fontFamily: "Helvetica, Arial, sans-serif", padding: "32px 32px 32px 32px", fontSize: 11, color: BODY, backgroundColor: "white", minHeight: "100%", boxSizing: "border-box" }}>
      <DocLetterhead organization={organization} />
      <div style={{ borderBottom: `2px solid ${PRIMARY}` }} />
      <div style={{ padding: "8px 0", textAlign: "center" }}>
        <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: 2, color: PRIMARY }}>MEDICAL CERTIFICATE</span>
      </div>
      <div style={{ borderBottom: `0.5px solid ${PRIMARY}` }} />
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14, marginBottom: 16 }}>
        <span style={{ fontSize: 10, color: MUTED, marginRight: 4 }}>Date Issued:</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: BODY }}>{issuedDate}</span>
      </div>
      <div style={{ border: "1px solid #d1d5db", borderRadius: 4, padding: "10px 14px", marginBottom: 20, backgroundColor: "#f9fafb" }}>
        <div style={{ display: "flex", marginBottom: 6 }}>
          <span style={{ width: 100, fontSize: 10, color: MUTED, fontWeight: 700, flexShrink: 0 }}>Patient Name</span>
          <span style={{ fontSize: 11, color: BODY }}>{patient?.fullName ?? "—"}</span>
        </div>
        <div style={{ display: "flex" }}>
          <span style={{ width: 100, fontSize: 10, color: MUTED, fontWeight: 700, flexShrink: 0 }}>NRIC / ID</span>
          <span style={{ fontSize: 11, color: BODY }}>{patient?.nric ?? "—"}</span>
        </div>
      </div>
      <p style={{ fontSize: 11, lineHeight: 1.6, color: BODY, marginBottom: 32 }}>
        This is to certify that the above-named patient was examined at our clinic and is certified medically unfit for work/school from{" "}
        <strong>{startDate}</strong> to <strong>{endDate}</strong> ({numDays} day{numDays > 1 ? "s" : ""}).
      </p>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: "auto" }}>
        <div style={{ width: 200 }}>
          <div style={{ borderBottom: `1px solid ${BODY}`, width: 160, marginBottom: 6 }} />
          <p style={{ fontSize: 11, fontWeight: 700, color: BODY, margin: 0, marginBottom: 2 }}>{doctorName || " "}</p>
          <p style={{ fontSize: 10, color: MUTED, margin: 0, marginBottom: 2 }}>Medical Practitioner</p>
          <p style={{ fontSize: 10, color: MUTED, margin: 0 }}>Date: {issuedDate}</p>
        </div>
        <div style={{ width: 80, height: 80, border: "1px dashed #d1d5db", borderRadius: 4, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 8, color: "#9ca3af", textAlign: "center" }}>Clinic</span>
          <span style={{ fontSize: 8, color: "#9ca3af", textAlign: "center" }}>Stamp</span>
        </div>
      </div>
    </div>
  );
}

function ReferralDocumentPreview({
  letterText,
  organization,
  metadata,
}: {
  letterText: string;
  organization: OrganizationDetails | null;
  metadata?: { patientName?: string | null; patientId?: string | null; toLine?: string | null } | null;
}) {
  const recipientName = metadata?.toLine ?? null;
  const hasRecipient = Boolean(recipientName);
  const hasPatient = Boolean(metadata?.patientName);
  const patientMetaParts = [metadata?.patientId ? `NRIC: ${metadata.patientId}` : null].filter(Boolean).join("  |  ");

  return (
    <div style={{ fontFamily: "Helvetica, Arial, sans-serif", padding: "32px", fontSize: 11, color: BODY, backgroundColor: "white", minHeight: "100%", boxSizing: "border-box" }}>
      <DocLetterhead organization={organization} />
      <div style={{ borderBottom: `2px solid ${PRIMARY}` }} />
      <div style={{ padding: "8px 0", textAlign: "center" }}>
        <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: 2, color: PRIMARY }}>REFERRAL LETTER</span>
      </div>
      <div style={{ borderBottom: `0.5px solid #d1d5db` }} />
      {hasRecipient && (
        <div style={{ marginBottom: 14, marginTop: 14 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: BODY, margin: 0, marginBottom: 3 }}>To:</p>
          <p style={{ fontSize: 11, color: BODY, margin: 0 }}>{recipientName}</p>
        </div>
      )}
      {hasPatient && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", marginBottom: 3 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: BODY, marginRight: 6, width: 28, flexShrink: 0 }}>Re:</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: BODY }}>{metadata!.patientName}</span>
          </div>
          {patientMetaParts && <p style={{ fontSize: 9, color: MUTED, margin: 0, marginLeft: 34 }}>{patientMetaParts}</p>}
        </div>
      )}
      <div style={{ borderBottom: `0.5px solid #d1d5db`, marginBottom: 14 }} />
      <div style={{ marginBottom: 28 }}>
        {letterText.split(/\r?\n/).map((line, i) => (
          <p key={i} style={{ fontSize: 11, lineHeight: 1.6, color: BODY, margin: 0, marginBottom: 6 }}>{line || " "}</p>
        ))}
      </div>
      <div>
        <div style={{ borderBottom: `1px solid ${BODY}`, width: 160, marginBottom: 6 }} />
        <p style={{ fontSize: 11, fontWeight: 700, color: BODY, margin: 0, marginBottom: 2 }}>{organization?.name ?? " "}</p>
      </div>
    </div>
  );
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

function documentKind(item: CatalogItem): "mc" | "referral" | null {
  if (item.meta?.kind === "mc" || item.id === "letter-mc") return "mc";
  if (item.meta?.kind === "referral" || item.id === "letter-referral") return "referral";
  return null;
}

function documentDisplayName(item: CatalogItem): string {
  const kind = documentKind(item);
  if (kind === "mc") return "MEDICAL CERTIFICATE (MC)";
  if (kind === "referral") return "REFERRAL LETTER";
  return item.name;
}

export function buildSignedDocumentNote(entry: TreatmentPlanEntry): string | undefined {
  const kind = documentKind({ id: entry.catalogRef || "", name: entry.name, meta: entry.meta });
  if (!kind) return entry.instruction;

  return JSON.stringify({
    kind,
    status: entry.meta?.documentStatus || "completed",
    title: entry.name,
    instruction: entry.instruction || "",
    mcDays: entry.meta?.mcDays || "",
    mcDiagnosis: entry.meta?.mcDiagnosis || "",
    mcStartDate: entry.meta?.mcStartDate || "",
    mcDoctorName: entry.meta?.mcDoctorName || "",
    referralTo: entry.meta?.referralTo || "",
    referralDiagnosis: entry.meta?.referralDiagnosis || "",
    referralContent: entry.meta?.referralContent || "",
  });
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
  patient = null,
}: OrderComposerProps) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [entries, setEntries] = React.useState<TreatmentPlanEntry[]>([]);
  const [summary, setSummary] = React.useState<TreatmentPlanSummary>(() => computeTreatmentPlanSummary([]));
  const [hydrated, setHydrated] = React.useState(false);
  const [savingIds, setSavingIds] = React.useState<Record<string, boolean>>({});
  const [persistenceDisabled, setPersistenceDisabled] = React.useState(!persistDrafts);
  const [detailEntryId, setDetailEntryId] = React.useState<string | null>(null);
  const [editingDocumentEntryId, setEditingDocumentEntryId] = React.useState<string | null>(null);
  const [mcDays, setMcDays] = React.useState(1);
  const [mcDiagnosis, setMcDiagnosis] = React.useState("");
  const [mcStartDate, setMcStartDate] = React.useState(() => new Date().toISOString().split("T")[0]);
  const [mcDoctorName, setMcDoctorName] = React.useState("");
  const [referralTo, setReferralTo] = React.useState("(Insert Hosp name)");
  const [referralDiagnosis, setReferralDiagnosis] = React.useState("");
  const [referralContent, setReferralContent] = React.useState(
    "Please include any medical information you deem relevant for the referral"
  );
  const [organization, setOrganization] = React.useState<OrganizationDetails | null>(null);
  const [orgLoaded, setOrgLoaded] = React.useState(false);
  const [mcTemplateHtml, setMcTemplateHtml] = React.useState<string | null>(null);
  const [referralTemplateHtml, setReferralTemplateHtml] = React.useState<string | null>(null);


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
      const h = `${documentDisplayName(item)} ${item.name} ${kindLabel}`.toLowerCase();
      return h.includes(term);
    });
  }, [unifiedCatalogRows, searchQuery]);

  const sortedEntries = React.useMemo(
    () => [...entries].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [entries]
  );

  const detailEntry = detailEntryId ? entries.find((e) => e.id === detailEntryId) : undefined;
  const editingDocumentEntry = editingDocumentEntryId
    ? entries.find((e) => e.id === editingDocumentEntryId)
    : undefined;
  const editingDocumentKind =
    editingDocumentEntry?.catalogRef === "letter-mc" || editingDocumentEntry?.meta?.kind === "mc"
      ? "mc"
      : editingDocumentEntry?.catalogRef === "letter-referral" || editingDocumentEntry?.meta?.kind === "referral"
      ? "referral"
      : null;

  React.useEffect(() => {
    if (detailEntryId && !entries.some((e) => e.id === detailEntryId)) {
      setDetailEntryId(null);
    }
  }, [entries, detailEntryId]);

  React.useEffect(() => {
    if (editingDocumentEntryId && !entries.some((e) => e.id === editingDocumentEntryId)) {
      setEditingDocumentEntryId(null);
    }
  }, [entries, editingDocumentEntryId]);

  React.useEffect(() => {
    if (!editingDocumentEntry || orgLoaded) return;
    Promise.all([
      fetchOrganizationDetails(),
      fetch("/api/document-templates?type=mc").then((r) => r.ok ? r.json() : null).catch(() => null),
      fetch("/api/document-templates?type=referral").then((r) => r.ok ? r.json() : null).catch(() => null),
    ]).then(([info, mcData, refData]) => {
      setOrganization(info);
      setMcTemplateHtml(mcData?.html ?? DEFAULT_MC_TEMPLATE);
      setReferralTemplateHtml(refData?.html ?? DEFAULT_REFERRAL_TEMPLATE);
    }).finally(() => setOrgLoaded(true));
  }, [editingDocumentEntry, orgLoaded]);

  const publishPlan = React.useCallback(
    (nextEntries: TreatmentPlanEntry[]) => {
      const nextSummary = computeTreatmentPlanSummary(nextEntries);
      setEntries(nextEntries);
      setSummary(nextSummary);
      onPlanChange?.(nextEntries, nextSummary);
    },
    [onPlanChange]
  );

  const mcPreviewHtml = React.useMemo(() => {
    if (!mcTemplateHtml) return null;
    const endDate = calcMcEndDate(mcStartDate, mcDays);
    const data: Record<string, string> = {
      clinicName: organization?.name ?? "",
      clinicAddress: organization?.address ?? "",
      clinicPhone: organization?.phone ?? "",
      patientName: patient?.fullName ?? "",
      patientNric: patient?.nric ?? "",
      patientDob: "",
      mcDays: String(mcDays),
      mcStartDate: formatDisplayDate(new Date(mcStartDate)),
      mcEndDate: endDate,
      diagnosis: mcDiagnosis,
      doctorName: mcDoctorName,
      date: formatDisplayDate(new Date()),
    };
    return Object.entries(data).reduce(
      (acc, [k, v]) => acc.replaceAll(`{{${k}}}`, v),
      mcTemplateHtml
    );
  }, [mcTemplateHtml, mcDays, mcStartDate, mcDiagnosis, mcDoctorName, organization, patient]);

  const referralPreviewHtml = React.useMemo(() => {
    if (!referralTemplateHtml) return null;
    const data: Record<string, string> = {
      clinicName: organization?.name ?? "",
      clinicAddress: organization?.address ?? "",
      clinicPhone: organization?.phone ?? "",
      patientName: patient?.fullName ?? "",
      patientNric: patient?.nric ?? "",
      patientAge: "",
      referralTo: referralTo,
      referralFrom: organization?.name ?? "",
      referralBody: referralContent,
      diagnosis: referralDiagnosis,
      doctorName: organization?.name ?? "",
      date: formatDisplayDate(new Date()),
    };
    return Object.entries(data).reduce(
      (acc, [k, v]) => acc.replaceAll(`{{${k}}}`, v),
      referralTemplateHtml
    );
  }, [referralTemplateHtml, referralTo, referralContent, referralDiagnosis, organization, patient]);

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
        name: documentDisplayName(item),
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
      setEditingDocumentEntryId((id) => (id === entry.id ? null : id));
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

  function handlePickerRowClick(row: { tab: TreatmentPlanTab; item: CatalogItem; kindLabel: string }) {
    void addCatalogItem(row.tab, row.item);
    setSearchQuery("");
  }

  async function handleCompleteDocumentDialog(status: "draft" | "completed") {
    if (!editingDocumentEntry) return;
    await updateEntryField(editingDocumentEntry, {
      meta: {
        ...(editingDocumentEntry.meta || {}),
        documentStatus: status,
        ...(editingDocumentKind === "mc"
          ? { mcDays: String(mcDays), mcDiagnosis, mcStartDate, mcDoctorName }
          : {}),
        ...(editingDocumentKind === "referral" ? { referralTo, referralDiagnosis, referralContent } : {}),
      },
    });
    toast({
      title: status === "completed" ? "Document completed" : "Document saved as incomplete",
      description: `${editingDocumentEntry.name} updated.`,
    });
    setEditingDocumentEntryId(null);
    setMcStartDate(new Date().toISOString().split("T")[0]);
    setMcDoctorName("");
  }

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
                  onClick={() => handlePickerRowClick(row)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 flex-1 truncate">{documentDisplayName(row.item)}</span>
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
              sortedEntries.map((entry) => {
                const openEntry = () => {
                  const kind = documentKind({ id: entry.catalogRef || "", name: entry.name, meta: entry.meta });
                  if (entry.tab === "documents" && kind !== null) {
                    setMcDays(Number(entry.meta?.mcDays || 1));
                    setMcDiagnosis(entry.meta?.mcDiagnosis || "");
                    setMcStartDate(entry.meta?.mcStartDate || new Date().toISOString().split("T")[0]);
                    setMcDoctorName(entry.meta?.mcDoctorName || "");
                    setReferralTo(entry.meta?.referralTo || "(Insert Hosp name)");
                    setReferralDiagnosis(entry.meta?.referralDiagnosis || "");
                    setReferralContent(
                      entry.meta?.referralContent ||
                        "Please include any medical information you deem relevant for the referral"
                    );
                    setEditingDocumentEntryId(entry.id);
                  } else {
                    setDetailEntryId(entry.id);
                  }
                };

                return (
                  <div
                    key={entry.id}
                    role="button"
                    tabIndex={0}
                    className="flex w-full items-center justify-between gap-2 rounded-md border bg-card px-3 py-2 text-left text-sm hover:bg-muted/50"
                    onClick={openEntry}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openEntry();
                      }
                    }}
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
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                      aria-label={`Remove ${entry.name}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        void removeEntry(entry);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })
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

      <Dialog open={Boolean(editingDocumentEntry)} onOpenChange={(open) => !open && setEditingDocumentEntryId(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>{editingDocumentEntry?.name ?? "Document"}</DialogTitle>
            <DialogDescription>
              Fill out information below to complete document.
            </DialogDescription>
          </DialogHeader>
          {editingDocumentKind === "mc" ? (
            <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">No of days</Label>
                  <Input
                    type="number"
                    min="1"
                    value={mcDays}
                    onChange={(event) => setMcDays(Number(event.target.value || 1))}
                  />
                </div>
                <div>
                  <Label className="text-xs">Start date</Label>
                  <Input
                    type="date"
                    value={mcStartDate}
                    onChange={(event) => setMcStartDate(event.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Doctor&apos;s name</Label>
                  <Input
                    placeholder="Dr. ..."
                    value={mcDoctorName}
                    onChange={(event) => setMcDoctorName(event.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Diagnosis</Label>
                  <Input
                    placeholder="Diagnosis"
                    value={mcDiagnosis}
                    onChange={(event) => setMcDiagnosis(event.target.value)}
                  />
                </div>
              </div>
              <div className="rounded-lg border overflow-hidden h-[420px]">
                {mcPreviewHtml ? (
                  <iframe srcDoc={mcPreviewHtml} className="w-full h-full" title="MC preview" />
                ) : (
                  <div className="overflow-auto h-full">
                    <McDocumentPreview
                      patient={patient}
                      issuedDate={formatDisplayDate(new Date())}
                      startDate={formatDisplayDate(new Date(mcStartDate))}
                      endDate={calcMcEndDate(mcStartDate, mcDays)}
                      numDays={mcDays}
                      doctorName={mcDoctorName}
                      organization={organization}
                    />
                  </div>
                )}
              </div>
            </div>
          ) : null}
          {editingDocumentKind === "referral" ? (
            <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Referral to:</Label>
                  <Input value={referralTo} onChange={(event) => setReferralTo(event.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Diagnosis</Label>
                  <Input
                    placeholder="Diagnosis"
                    value={referralDiagnosis}
                    onChange={(event) => setReferralDiagnosis(event.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Compose content</Label>
                  <Textarea
                    className="min-h-40"
                    value={referralContent}
                    onChange={(event) => setReferralContent(event.target.value)}
                  />
                </div>
                <div className="rounded-md border p-2 text-xs text-muted-foreground">
                  <p className="font-semibold text-foreground">Insert smart fields</p>
                  <p>Patient name · Doctor name · Visit date · Identification · Age · Time in · Diagnosis</p>
                </div>
              </div>
              <div className="rounded-lg border overflow-hidden h-[420px]">
                {referralPreviewHtml ? (
                  <iframe srcDoc={referralPreviewHtml} className="w-full h-full" title="Referral preview" />
                ) : (
                  <div className="overflow-auto h-full">
                    <ReferralDocumentPreview
                      letterText={referralContent}
                      organization={organization}
                      metadata={{
                        patientName: patient?.fullName ?? null,
                        patientId: patient?.nric ?? null,
                        toLine: referralTo,
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" onClick={() => void handleCompleteDocumentDialog("completed")}>
              Complete document
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
