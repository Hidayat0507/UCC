"use client";

import { Fragment, FormEvent, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { useToast } from "@/components/ui/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { OrderComposer, buildSignedDocumentNote } from "@/components/orders/order-composer";
import PatientDocuments from "@/components/patients/patient-documents";
import { LabResultsView } from "@/components/labs/lab-results-view";
import { ImagingResultsView } from "@/components/imaging/imaging-results-view";
import { getMedications } from "@/lib/inventory";
import { getProcedures } from "@/lib/procedures";
import { formatPrescriptionLine } from "@/lib/prescriptions";
import { getClinicalCatalog, type ClinicalCatalogItem } from "@/lib/clinical-catalog";
import { cn, formatDisplayDate } from "@/lib/utils";
import type { Prescription, ProcedureRecord } from "@/lib/models";
import type { SerializedPatient } from "@/components/patients/patient-card";
import type { TreatmentPlanEntry, TreatmentPlanSummary } from "@/lib/treatment-plan";
import type { QueueStatus } from "@/lib/types";
import ReferralMCSection from "./referral-mc-section";

type ProfileTab = "history" | "labs-imaging" | "documents";
type DrawerMode = "consult" | "treatment";

type MedicalHistory = {
  allergies?: string[];
  conditions?: string[];
  medications?: string[];
};

type ProfileConsultation = {
  id?: string;
  patientId: string;
  date?: string | null;
  chiefComplaint: string;
  diagnosis: string;
  notes?: string;
  progressNote?: string | null;
  procedures?: ProcedureRecord[];
  prescriptions?: Prescription[];
};

interface PatientProfileWorkspaceProps {
  patientId: string;
  patient: SerializedPatient;
  consultations: ProfileConsultation[];
  patientAge: number | null;
  medicalHistory: MedicalHistory;
}

const emptyTreatmentSummary: TreatmentPlanSummary = {
  subtotal: 0,
  total: 0,
  currency: "MYR",
  itemCount: 0,
};
const emptyTreatmentEntries: TreatmentPlanEntry[] = [];
const emptyPackages: [] = [];
const consultationServiceCatalogItem = {
  id: "consultation-fee",
  name: "Consultation Fee",
  unitPrice: 0,
};

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, "").trim();
}

function patientFacingProcedureNote(value: string | undefined, category?: string) {
  const text = value?.trim() || "";
  if (!text) return "";

  if (category === "documents" && text.startsWith("{")) {
    try {
      const parsed = JSON.parse(text) as { kind?: string };
      if (parsed.kind === "referral" || parsed.kind === "mc") {
        return "";
      }
    } catch {
      return "";
    }
  }

  return text;
}

function consultationPreviewText(value: string | undefined) {
  return stripHtml(value || "") || "—";
}

function isDocumentProcedure(procedure: ProcedureRecord) {
  return procedure.category === "documents";
}

function consultationVisitKey(consultation: ProfileConsultation): string {
  const dateKey = consultation.date ? consultation.date.slice(0, 10) : "";
  return [
    dateKey,
    stripHtml(consultation.chiefComplaint).toLowerCase(),
    consultation.diagnosis.trim().toLowerCase(),
  ].join("|");
}

function mergeByVisit(consultations: ProfileConsultation[]): ProfileConsultation[] {
  const visits = new Map<string, ProfileConsultation>();

  for (const consultation of consultations) {
    const key = consultation.id ?? consultationVisitKey(consultation);
    const existing = visits.get(key);

    if (!existing) {
      visits.set(key, {
        ...consultation,
        procedures: [...(consultation.procedures || [])],
        prescriptions: [...(consultation.prescriptions || [])],
      });
      continue;
    }

    existing.procedures = [...(existing.procedures || []), ...(consultation.procedures || [])];
    existing.prescriptions = [...(existing.prescriptions || []), ...(consultation.prescriptions || [])];
    existing.notes = existing.notes || consultation.notes;
    existing.progressNote = existing.progressNote || consultation.progressNote;
  }

  return Array.from(visits.values());
}

export default function PatientProfileWorkspace({
  patientId,
  patient,
  consultations,
  patientAge,
  medicalHistory,
}: PatientProfileWorkspaceProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<ProfileTab>("history");
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("consult");
  const [panelOpen, setPanelOpen] = useState(false);
  const [selectedConsultation, setSelectedConsultation] = useState<ProfileConsultation | null>(null);
  const [clinicalNotes, setClinicalNotes] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [consultSubmitting, setConsultSubmitting] = useState(false);
  const [treatmentSubmitting, setTreatmentSubmitting] = useState(false);
  const [treatmentEntries, setTreatmentEntries] = useState<TreatmentPlanEntry[]>([]);
  const [treatmentSummary, setTreatmentSummary] = useState<TreatmentPlanSummary>(emptyTreatmentSummary);
  const [queueStatus, setQueueStatus] = useState<QueueStatus>(patient.queueStatus ?? null);
  const [procedureOptions, setProcedureOptions] = useState<
    { id: string; label: string; price?: number; codingSystem?: string; codingCode?: string; codingDisplay?: string }[]
  >([]);
  const [medicationOptions, setMedicationOptions] = useState<{ id: string; name: string; unitPrice: number }[]>([]);
  const [labCatalog, setLabCatalog] = useState<ClinicalCatalogItem[]>([]);
  const [imagingCatalog, setImagingCatalog] = useState<ClinicalCatalogItem[]>([]);
  const [documentCatalog, setDocumentCatalog] = useState<ClinicalCatalogItem[]>([]);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const [procedures, medications, labs, imaging, documents] = await Promise.all([
          getProcedures(),
          getMedications(),
          getClinicalCatalog("lab"),
          getClinicalCatalog("imaging"),
          getClinicalCatalog("document"),
        ]);
        if (!active) return;
        setProcedureOptions(
          procedures.map((procedure) => ({
            id: procedure.id,
            label: procedure.name,
            price: procedure.defaultPrice,
            codingSystem: procedure.codingSystem,
            codingCode: procedure.codingCode,
            codingDisplay: procedure.codingDisplay,
          }))
        );
        setMedicationOptions(
          medications.map((medication) => ({
            id: medication.id,
            name: medication.name,
            unitPrice: medication.unitPrice || 0,
          }))
        );
        setLabCatalog(labs.filter((item) => item.active));
        setImagingCatalog(imaging.filter((item) => item.active));
        setDocumentCatalog(documents.filter((item) => item.active));
      } catch (error) {
        console.error("Failed to load treatment catalogs:", error);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (queueStatus !== "arrived" && queueStatus !== "waiting") return;

    void updateQueueStatus("in_consultation").catch((error) => {
      toast({
        title: "Queue Status Not Updated",
        description: error instanceof Error ? error.message : "Failed to mark patient as in consultation.",
        variant: "destructive",
      });
    });
  }, [queueStatus]);

  const visibleConsultations = useMemo(() => mergeByVisit(consultations), [consultations]);

  const latestConsultation = useMemo(() => {
    return [...visibleConsultations]
      .filter((consultation) => consultation.chiefComplaint && consultation.diagnosis)
      .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())[0];
  }, [visibleConsultations]);

  const treatmentItemsCatalog = useMemo(
    () =>
      medicationOptions.map((item) => ({
        id: item.id,
        name: item.name,
        unitPrice: item.unitPrice,
      })),
    [medicationOptions]
  );

  const treatmentServicesCatalog = useMemo(
    () => {
      const catalog = procedureOptions.map((item) => ({
        id: item.id,
        name: item.label,
        unitPrice: item.price || 0,
      }));
      const labServices = labCatalog.map((item) => ({
        id: `lab-${item.id}`,
        name: `Lab: ${item.display || item.name}`,
        unitPrice: item.defaultPrice || 0,
        meta: {
          kind: "lab",
          code: item.code || item.id,
          display: item.display || item.name,
          system: item.system || "",
        },
      }));
      const imagingServices = imagingCatalog
        .filter((item) => !item.modality || item.modality === "DX")
        .map((item) => ({
          id: `imaging-${item.id}`,
          name: `Imaging: ${item.display || item.name}${item.modality ? ` (${item.modality})` : ""}`,
          unitPrice: item.defaultPrice || 0,
          meta: {
            kind: "imaging",
            code: item.code || item.id,
            display: item.display || item.name,
            system: item.system || "",
            modality: item.modality || "",
          },
        }));
      const hasConsultationService = catalog.some((item) => /\bconsultation\b/i.test(item.name));
      const serviceCatalog = hasConsultationService ? catalog : [consultationServiceCatalogItem, ...catalog];

      return [...serviceCatalog, ...labServices, ...imagingServices];
    },
    [imagingCatalog, labCatalog, procedureOptions]
  );

  const treatmentDocumentsCatalog = useMemo(
    () => [
      ...documentCatalog.flatMap((item) => {
        const key = `${item.code || item.id} ${item.name}`.toLowerCase();
        const kind = key.includes("mc") || key.includes("medical certificate")
          ? "mc"
          : key.includes("referral")
            ? "referral"
            : null;
        if (!kind) return [];
        return [{
          id: item.code === "letter-mc" || item.id === "letter-mc" ? "letter-mc" : item.code === "letter-referral" || item.id === "letter-referral" ? "letter-referral" : item.id,
          name: item.display || item.name,
          unitPrice: item.defaultPrice || 0,
          meta: { kind },
        }];
      }),
    ],
    [documentCatalog]
  );

  const handleTreatmentPlanChange = useCallback((entries: TreatmentPlanEntry[], summary: TreatmentPlanSummary) => {
    setTreatmentEntries(entries);
    setTreatmentSummary(summary);
  }, []);

  function handleTabChange(value: string) {
    setActiveTab(value as ProfileTab);
  }

  async function updateQueueStatus(status: Exclude<QueueStatus, null>) {
    const response = await fetch("/api/queue", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patientId, status }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.success) {
      throw new Error(data?.error || "Failed to update queue status");
    }
    setQueueStatus(status);
  }

  function openConsultPanel() {
    if (drawerMode === "consult" && panelOpen) {
      setPanelOpen(false);
      return;
    }

    setDrawerMode("consult");
    setPanelOpen(true);
  }

  async function handleConsultSign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (consultSubmitting) return;

    if (!stripHtml(clinicalNotes) || !diagnosis.trim()) {
      toast({
        title: "Validation Error",
        description: "Please fill in clinical notes and diagnosis before signing.",
        variant: "destructive",
      });
      return;
    }

    try {
      setConsultSubmitting(true);
      const response = await fetch("/api/consultations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          chiefComplaint: clinicalNotes,
          diagnosis: diagnosis.trim(),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Failed to save consultation");
      }

      const signedConsultationId = typeof data.consultationId === "string" ? data.consultationId : "";
      if (signedConsultationId && treatmentEntries.length > 0) {
        try {
          const targetDraftId = `profile-treatment-${patientId}-${signedConsultationId}`;
          for (const entry of treatmentEntries) {
            const draftResponse = await fetch("/api/consultations/plan", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                draftId: targetDraftId,
                patientId,
                consultationId: signedConsultationId,
                entry,
              }),
            });
            const draftData = await draftResponse.json().catch(() => ({}));
            if (!draftResponse.ok || !draftData?.success) {
              throw new Error(draftData?.error || "Failed to move treatment draft to signed consult.");
            }
          }
        } catch (draftError) {
          console.error("Failed to move treatment draft after consult sign:", draftError);
          toast({
            title: "Treatment Draft Not Moved",
            description:
              draftError instanceof Error
                ? draftError.message
                : "The consult was signed, but the existing treatment draft may need to be re-added.",
            variant: "destructive",
          });
        }
      }

      toast({
        title: "Consult Signed",
        description: "Clinical notes and diagnosis were saved.",
      });
      if (queueStatus && queueStatus !== "completed") {
        setQueueStatus("meds_and_bills");
      }
      setClinicalNotes("");
      setDiagnosis("");
      setPanelOpen(false);
      router.refresh();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save consultation.",
        variant: "destructive",
      });
    } finally {
      setConsultSubmitting(false);
    }
  }

  async function handleTreatmentSign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (treatmentSubmitting) return;

    if (!latestConsultation) {
      toast({
        title: "Consult Required",
        description: "Please sign a consult before signing treatment.",
        variant: "destructive",
      });
      return;
    }

    if (!latestConsultation.id) {
      toast({
        title: "Consult Missing ID",
        description: "Refresh the patient profile and try signing treatment again.",
        variant: "destructive",
      });
      return;
    }

    if (treatmentEntries.length === 0) {
      toast({
        title: "No Treatment Added",
        description: "Add at least one treatment item before signing.",
        variant: "destructive",
      });
      return;
    }

    const orderedTreatmentEntries = [...treatmentEntries]
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((entry, orderIndex) => ({ ...entry, orderIndex }));
    const medicationEntries = orderedTreatmentEntries.filter((entry) => entry.tab === "items");
    const serviceEntries = orderedTreatmentEntries.filter((entry) => entry.tab === "services" || entry.tab === "packages");
    const documentEntries = orderedTreatmentEntries.filter((entry) => entry.tab === "documents");
    const prescriptions: Prescription[] = medicationEntries.map((entry) => ({
      medication: {
        id: entry.catalogRef || entry.id,
        name: entry.name,
        strength: entry.dosage,
      },
      frequency: entry.frequency || "",
      duration: entry.duration || "",
      quantity: entry.quantity,
      orderIndex: entry.orderIndex,
      category: "items",
      price: entry.unitPrice,
    }));
    const billableProcedureEntries = [...serviceEntries, ...documentEntries];
    const procedures: ProcedureRecord[] = billableProcedureEntries.map((entry) => ({
      name: entry.name,
      quantity: entry.quantity,
      orderIndex: entry.orderIndex,
      category: entry.tab,
      price: entry.unitPrice,
      notes: entry.tab === "documents" ? buildSignedDocumentNote(entry) : entry.instruction,
      procedureId: entry.catalogRef,
    }));
    const clinicalServiceEntries = [...serviceEntries, ...documentEntries];
    const labSelections = clinicalServiceEntries
      .filter((entry) => entry.meta?.kind === "lab")
      .map((entry) => ({
        code: entry.meta?.code || entry.catalogRef || entry.id,
        display: entry.meta?.display || entry.name.replace(/^Lab:\s*/, ""),
        system: entry.meta?.system || "http://loinc.org",
      }));
    const imagingSelections = clinicalServiceEntries
      .filter((entry) => entry.meta?.kind === "imaging")
      .map((entry) => ({
        code: entry.meta?.code || entry.catalogRef || entry.id,
        display: entry.meta?.display || entry.name.replace(/^Imaging:\s*/, ""),
        system: entry.meta?.system || "http://loinc.org",
        modality: entry.meta?.modality || "DX",
      }));

    try {
      setTreatmentSubmitting(true);
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consultationId: latestConsultation.id,
          procedures,
          prescriptions,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Failed to save treatment");
      }

      const consultationId = latestConsultation.id;
      const orderErrors: string[] = [];
      if (labSelections.length) {
        try {
          const labResponse = await fetch("/api/labs/order", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              patientId,
              encounterId: consultationId,
              tests: labSelections,
              priority: "routine",
              clinicalNotes: latestConsultation.chiefComplaint,
            }),
          });
          if (!labResponse.ok) {
            const labData = await labResponse.json().catch(() => ({}));
            throw new Error(labData?.error || "Lab order failed");
          }
        } catch (error) {
          console.error("Lab order error:", error);
          orderErrors.push("labs");
        }
      }

      if (imagingSelections.length) {
        try {
          const imagingResponse = await fetch("/api/imaging/order", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              patientId,
              encounterId: consultationId,
              procedures: imagingSelections,
              priority: "routine",
              clinicalIndication: latestConsultation.diagnosis || latestConsultation.chiefComplaint,
              clinicalQuestion: latestConsultation.chiefComplaint,
              orderedBy: undefined,
            }),
          });
          if (!imagingResponse.ok) {
            const imagingData = await imagingResponse.json().catch(() => ({}));
            throw new Error(imagingData?.error || "Imaging order failed");
          }
        } catch (error) {
          console.error("Imaging order error:", error);
          orderErrors.push("imaging");
        }
      }

      toast({
        title: "Treatment Signed",
        description: orderErrors.length
          ? `Treatment saved. Orders with issues: ${orderErrors.join(", ")}.`
          : "Treatment visit was saved.",
        variant: orderErrors.length ? "destructive" : "default",
      });
      setPanelOpen(false);
      router.refresh();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save treatment.",
        variant: "destructive",
      });
    } finally {
      setTreatmentSubmitting(false);
    }
  }

  return (
    <>
      <Tabs value={activeTab} onValueChange={handleTabChange} className="flex flex-col gap-3">
        <TabsList className="w-auto">
          <TabsTrigger value="history" className="px-3 text-xs">Consultation History</TabsTrigger>
          <TabsTrigger value="labs-imaging" className="px-3 text-xs">Labs & Imaging</TabsTrigger>
          <TabsTrigger value="documents" className="px-3 text-xs">Documents</TabsTrigger>
        </TabsList>

        {/* Content row: main tab content + action panel */}
        <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1">
            <TabsContent value="history" className="mt-0">
              <div className="mb-3 flex justify-end">
                <Tabs value={panelOpen ? drawerMode : ""}>
                  <TabsList>
                    <TabsTrigger
                      value="consult"
                      className="px-3 text-xs"
                      onClick={() => {
                        openConsultPanel();
                      }}
                    >Consult</TabsTrigger>
                    <TabsTrigger
                      value="treatment"
                      className="px-3 text-xs"
                      onClick={() => {
                        if (drawerMode === "treatment" && panelOpen) setPanelOpen(false);
                        else { setDrawerMode("treatment"); setPanelOpen(true); }
                      }}
                    >Treatment</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              <Card>
                <CardContent className="space-y-4">
                  {visibleConsultations.length > 0 ? (
                    <>
                      <div className="md:hidden space-y-3">
                        {visibleConsultations.map((consultation) => (
                          <button
                            key={consultation.id}
                            type="button"
                            className={cn(
                              "w-full rounded-lg border bg-card p-4 text-left transition-colors hover:bg-muted/40",
                              selectedConsultation?.id === consultation.id && "border-primary bg-muted/40"
                            )}
                            onClick={() => {
                              setSelectedConsultation((current) =>
                                current?.id === consultation.id ? null : consultation
                              );
                            }}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-medium">{formatDisplayDate(consultation.date)}</p>
                                <p className="mt-1 text-xs text-muted-foreground">Consultation</p>
                              </div>
                              <p className="text-xs text-muted-foreground">{consultation.prescriptions?.length || 0} items</p>
                            </div>
                            <div className="mt-3 space-y-2">
                              <div>
                                <p className="text-xs text-muted-foreground">Clinical notes</p>
                                <p className="text-sm">{consultationPreviewText(consultation.chiefComplaint)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Diagnosis</p>
                                <p className="text-sm">{consultation.diagnosis || "—"}</p>
                              </div>
                            </div>
                          </button>
                        ))}
                        {selectedConsultation && (
                          <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
                            <div>
                              <p className="text-sm font-medium">{formatDisplayDate(selectedConsultation.date)}</p>
                              <p className="text-sm text-muted-foreground">{consultationPreviewText(selectedConsultation.chiefComplaint)}</p>
                            </div>
                            <div>
                              <p className="mb-1 text-sm font-medium">Diagnosis</p>
                              <p className="text-sm text-muted-foreground">{selectedConsultation.diagnosis || "—"}</p>
                            </div>
                            {selectedConsultation.notes && (
                              <div>
                                <p className="mb-1 text-sm font-medium">Notes</p>
                                <div className="rich-text-display text-sm text-muted-foreground" dangerouslySetInnerHTML={{ __html: selectedConsultation.notes }} />
                              </div>
                            )}
                            {selectedConsultation.progressNote && (
                              <div>
                                <p className="mb-1 text-sm font-medium">Progress Note</p>
                                <div className="rich-text-display text-sm text-muted-foreground" dangerouslySetInnerHTML={{ __html: selectedConsultation.progressNote }} />
                              </div>
                            )}
                            {selectedConsultation.prescriptions && selectedConsultation.prescriptions.length > 0 && (
                              <div>
                                <p className="mb-2 text-sm font-medium">Prescriptions</p>
                                <ul className="space-y-1">
                                  {selectedConsultation.prescriptions.map((rx, i) => (
                                    <li key={i} className="text-sm text-muted-foreground">
                                      {formatPrescriptionLine(rx)}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {selectedConsultation.procedures?.some((proc) => !isDocumentProcedure(proc)) && (
                              <div>
                                <p className="mb-2 text-sm font-medium">Services</p>
                                <ul className="space-y-1">
                                  {selectedConsultation.procedures
                                    .filter((proc) => !isDocumentProcedure(proc))
                                    .map((proc, i) => (
                                      <ProcedureListItem key={i} procedure={proc} />
                                    ))}
                                </ul>
                              </div>
                            )}
                            {selectedConsultation.procedures?.some(isDocumentProcedure) && (
                              <div>
                                <p className="mb-2 text-sm font-medium">Documents</p>
                                <ul className="space-y-1">
                                  {selectedConsultation.procedures
                                    .filter(isDocumentProcedure)
                                    .map((proc, i) => (
                                      <ProcedureListItem key={i} procedure={proc} />
                                    ))}
                                </ul>
                              </div>
                            )}
                            {selectedConsultation.id && (
                              <div className="flex flex-wrap gap-2 border-t pt-3">
                                <Button variant="outline" size="sm" asChild>
                                  <Link href={`/consultations/${selectedConsultation.id}`}>Open full</Link>
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="hidden md:block">
                        <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Complaint</TableHead>
                            <TableHead>Diagnosis</TableHead>
                            <TableHead>Prescriptions</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {visibleConsultations.map((consultation) => (
                            <Fragment key={consultation.id}>
                              <TableRow
                                data-selected={selectedConsultation?.id === consultation.id ? true : undefined}
                                aria-selected={selectedConsultation?.id === consultation.id}
                                className={cn(
                                  "cursor-pointer",
                                  selectedConsultation?.id === consultation.id && "bg-muted/50"
                                )}
                                onClick={() => {
                                  setSelectedConsultation((current) =>
                                    current?.id === consultation.id ? null : consultation
                                  );
                                }}
                              >
                                <TableCell className="font-medium">{formatDisplayDate(consultation.date)}</TableCell>
                                <TableCell>Consultation</TableCell>
                                <TableCell className="max-w-[200px] truncate">{consultationPreviewText(consultation.chiefComplaint)}</TableCell>
                                <TableCell className="max-w-[200px] truncate">{consultation.diagnosis}</TableCell>
                                <TableCell>{consultation.prescriptions?.length || 0} items</TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                                    <Button variant="outline" size="sm" asChild>
                                      <Link href={`/consultations/${consultation.id}`}>View</Link>
                                    </Button>
                                    <Button size="sm" asChild>
                                      <Link href={`/consultations/${consultation.id}/edit`}>Edit</Link>
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                              {selectedConsultation?.id === consultation.id && (
                                <TableRow className="hover:bg-transparent">
                                  <TableCell colSpan={6} className="bg-muted/30 px-6 pb-5 pt-3">
                                    <div className="space-y-4">
                                      <div>
                                        <p className="mb-1 text-sm font-medium">Clinical Notes</p>
                                        <div className="rich-text-display text-sm text-muted-foreground" dangerouslySetInnerHTML={{ __html: consultation.chiefComplaint }} />
                                      </div>
                                      <div>
                                        <p className="mb-1 text-sm font-medium">Diagnosis</p>
                                        <p className="text-sm text-muted-foreground">{consultation.diagnosis || "—"}</p>
                                      </div>
                                      {consultation.notes && (
                                        <div>
                                          <p className="mb-1 text-sm font-medium">Notes</p>
                                          <div className="rich-text-display text-sm text-muted-foreground" dangerouslySetInnerHTML={{ __html: consultation.notes }} />
                                        </div>
                                      )}
                                      {consultation.progressNote && (
                                        <div>
                                          <p className="mb-1 text-sm font-medium">Progress Note</p>
                                          <div className="rich-text-display text-sm text-muted-foreground" dangerouslySetInnerHTML={{ __html: consultation.progressNote }} />
                                        </div>
                                      )}
                                      {consultation.prescriptions && consultation.prescriptions.length > 0 && (
                                        <div>
                                          <p className="mb-2 text-sm font-medium">Prescriptions</p>
                                          <ul className="space-y-1">
                                            {consultation.prescriptions.map((rx, i) => (
                                              <li key={i} className="text-sm text-muted-foreground">
                                                {formatPrescriptionLine(rx)}
                                              </li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}
                                      {consultation.procedures?.some((proc) => !isDocumentProcedure(proc)) && (
                                        <div>
                                          <p className="mb-2 text-sm font-medium">Services</p>
                                          <ul className="space-y-1">
                                            {consultation.procedures
                                              .filter((proc) => !isDocumentProcedure(proc))
                                              .map((proc, i) => (
                                                <ProcedureListItem key={i} procedure={proc} />
                                              ))}
                                          </ul>
                                        </div>
                                      )}
                                      {consultation.procedures?.some(isDocumentProcedure) && (
                                        <div>
                                          <p className="mb-2 text-sm font-medium">Documents</p>
                                          <ul className="space-y-1">
                                            {consultation.procedures
                                              .filter(isDocumentProcedure)
                                              .map((proc, i) => (
                                                <ProcedureListItem key={i} procedure={proc} />
                                              ))}
                                          </ul>
                                        </div>
                                      )}
                                      {consultation.id && (
                                        <div className="flex flex-wrap gap-2 border-t pt-3">
                                          <Button variant="outline" size="sm" asChild>
                                            <Link href={`/consultations/${consultation.id}`}>Open full</Link>
                                          </Button>
                                        </div>
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )}
                            </Fragment>
                          ))}
                        </TableBody>
                      </Table>
                      </div>
                    </>
                  ) : (
                    <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                      <p className="font-medium text-foreground">No consultation history yet.</p>
                      <p className="mt-1">Start the first consult to build the record here.</p>
                      <Button type="button" variant="outline" size="sm" className="mt-4" onClick={openConsultPanel}>
                        Start consult
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>


            <TabsContent value="labs-imaging" className="mt-0">
              <div className="grid gap-4 lg:grid-cols-2">
                <LabResultsView patientId={patientId} />
                <ImagingResultsView patientId={patientId} />
              </div>
            </TabsContent>

            <TabsContent value="documents" className="mt-0">
              <div className="grid gap-4">
                <Suspense fallback={<div>Loading documents...</div>}>
                  <ReferralMCSection patient={patient} consultations={visibleConsultations} />
                </Suspense>
                <PatientDocuments patientId={patientId} />
              </div>
            </TabsContent>
          </div>

          {panelOpen && (
            <div className="w-full lg:w-[480px] lg:shrink-0 lg:sticky lg:top-6">
              <div className="flex flex-col rounded-lg border bg-card shadow-sm">
                <div className="flex items-center justify-between border-b px-5 py-3">
                  <div>
                    <p className="text-sm font-medium capitalize">{drawerMode}</p>
                    <p className="text-xs text-muted-foreground">Patient profile workspace</p>
                  </div>
                  <Button variant="ghost" size="sm" type="button" onClick={() => setPanelOpen(false)}>
                    Close
                  </Button>
                </div>
                {drawerMode === "consult" && (
                  <form onSubmit={handleConsultSign} className="flex flex-col">
                    <div className="space-y-4 px-5 py-4">
                      <RichTextEditor
                        placeholder="Clinical notes"
                        minHeight="360px"
                        value={clinicalNotes}
                        onChange={setClinicalNotes}
                      />
                      <Input
                        placeholder="Condition (diagnosis)"
                        value={diagnosis}
                        onChange={(event) => setDiagnosis(event.target.value)}
                      />
                    </div>
                    <div className="border-t px-5 py-4">
                      <Button type="submit" disabled={consultSubmitting} className="w-full">
                        {consultSubmitting ? "Signing..." : "Sign"}
                      </Button>
                    </div>
                  </form>
                )}
                {drawerMode === "treatment" && (
                  <form onSubmit={handleTreatmentSign} className="flex flex-col">
                    <div className="space-y-3 px-5 py-4">
                      <OrderComposer
                        draftId={`profile-treatment-${patientId}-${latestConsultation?.id || "pending"}`}
                        patientId={patientId}
                        consultationId={latestConsultation?.id}
                        initialEntries={emptyTreatmentEntries}
                        persistDrafts
                        items={treatmentItemsCatalog}
                        services={treatmentServicesCatalog}
                        packages={emptyPackages}
                        documents={treatmentDocumentsCatalog}
                        onPlanChange={handleTreatmentPlanChange}
                        submitLabel="Sign"
                        submitting={treatmentSubmitting}
                        patient={patient}
                      />
                      <div className="rounded-md border p-3 text-xs text-muted-foreground">
                        Current order total: <span className="font-semibold">RM {treatmentSummary.total.toFixed(2)}</span>
                      </div>
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}
        </div>
      </Tabs>

    </>
  );
}

function ProcedureListItem({ procedure }: { procedure: ProcedureRecord }) {
  const note = patientFacingProcedureNote(procedure.notes, procedure.category);

  return (
    <li className="text-sm text-muted-foreground">
      {procedure.name}
      {note ? ` — ${note}` : ""}
    </li>
  );
}
