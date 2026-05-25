"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
// import { PDFViewer, pdf } from "@react-pdf/renderer"; // replaced with HTML template approach
import { Download, FileText, Loader2, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { getPatientReferrals, deleteReferral, type Referral } from "@/lib/fhir/referral-client";
// import ReferralDocument from "@/components/referrals/referral-document"; // replaced with HTML template approach
// import { McDocument } from "@/components/mc/mc-document"; // kept as fallback
import { fetchOrganizationDetails, type OrganizationDetails } from "@/lib/org";
import { DEFAULT_MC_TEMPLATE, DEFAULT_REFERRAL_TEMPLATE } from "@/lib/document-templates";
import type { ProcedureRecord } from "@/lib/models";

function formatDateLabel(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return format(date, "dd MMM yyyy");
}

function calcMcEndDate(startDate: string | null | undefined, numDays: number): string {
  if (!startDate || numDays <= 0) return formatDateLabel(new Date()) || "";
  const date = new Date(startDate);
  if (Number.isNaN(date.getTime())) return formatDateLabel(new Date()) || "";
  date.setDate(date.getDate() + numDays - 1);
  return formatDateLabel(date) || "";
}

function calcAge(dob: string | Date | null | undefined): string {
  if (!dob) return "";
  const date = dob instanceof Date ? dob : new Date(String(dob));
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  let age = now.getFullYear() - date.getFullYear();
  if (
    now.getMonth() < date.getMonth() ||
    (now.getMonth() === date.getMonth() && now.getDate() < date.getDate())
  )
    age--;
  return String(age);
}

interface ReferralMCSectionProps {
  patient: any;
  consultations?: Array<{
    id?: string;
    date?: string | Date | null;
    procedures?: ProcedureRecord[];
  }>;
}

type SignedDocument = {
  id: string;
  kind: "mc" | "referral";
  title: string;
  date: string | Date | null | undefined;
  status?: string;
  details: Record<string, string>;
  consultationId: string;
  procedureIndex: number;
  procedure: ProcedureRecord;
};

function parseSignedDocumentNote(value?: string): Record<string, string> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, string>;
    }
  } catch {
    return {};
  }
  return {};
}

function signedDocumentKind(procedure: ProcedureRecord): "mc" | "referral" | null {
  const details = parseSignedDocumentNote(procedure.notes);
  if (details.kind === "mc" || details.kind === "referral") return details.kind;

  const key = `${procedure.procedureId || ""} ${procedure.name || ""}`.toLowerCase();
  if (key.includes("letter-mc") || key.includes("medical certificate") || /\bmc\b/.test(key)) return "mc";
  if (key.includes("letter-referral") || key.includes("referral")) return "referral";
  return null;
}

function getSignedDocuments(consultations: ReferralMCSectionProps["consultations"] = []): SignedDocument[] {
  return consultations.flatMap((consultation) =>
    (consultation.procedures || []).flatMap((procedure, index): SignedDocument[] => {
      if (procedure.category !== "documents") return [];

      const details = parseSignedDocumentNote(procedure.notes);
      const kind = signedDocumentKind(procedure);
      if (!kind) return [];

      return [
        {
          id: `${consultation.id || "consultation"}-${procedure.procedureId || procedure.name}-${index}`,
          kind,
          title:
            details.title ||
            procedure.name ||
            (kind === "mc" ? "Medical Certificate (MC)" : "Referral Letter"),
          date: consultation.date,
          status: details.status || undefined,
          details,
          consultationId: consultation.id || "",
          procedureIndex: index,
          procedure,
        },
      ];
    })
  );
}

function fillPlaceholders(html: string, data: Record<string, string>): string {
  return Object.entries(data).reduce((acc, [k, v]) => acc.replaceAll(k, v), html);
}

export default function ReferralMCSection({ patient, consultations = [] }: ReferralMCSectionProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<Referral | null>(null);
  const [viewingSigned, setViewingSigned] = useState<SignedDocument | null>(null);
  const [editingSigned, setEditingSigned] = useState<SignedDocument | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [savingSigned, setSavingSigned] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [organization, setOrganization] = useState<OrganizationDetails | null>(null);
  const [viewingHtml, setViewingHtml] = useState<string | null>(null);
  const [viewingHtmlLoading, setViewingHtmlLoading] = useState(false);
  const signedDocuments = getSignedDocuments(consultations);

  const loadReferrals = useCallback(() => {
    let active = true;
    (async () => {
      try {
        setLoadError(null);
        const list = await getPatientReferrals(patient.id);
        if (!active) return;
        setReferrals(list as any);
      } catch (error) {
        if (!active) return;
        setLoadError(error instanceof Error ? error.message : "Failed to load documents.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [patient.id]);

  useEffect(() => loadReferrals(), [loadReferrals]);

  useEffect(() => {
    let active = true;
    (async () => {
      const orgDetails = await fetchOrganizationDetails();
      if (!active) return;
      setOrganization(orgDetails);
    })();
    return () => {
      active = false;
    };
  }, []);

  async function handleDelete(referralId: string) {
    setDeleting(referralId);
    try {
      await deleteReferral(referralId);
      setReferrals((prev) => prev.filter((r) => r.id !== referralId));
      toast({ title: "Document deleted" });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err?.message || "Failed to delete document.",
        variant: "destructive",
      });
    } finally {
      setDeleting(null);
    }
  }

  function startEditSignedDocument(doc: SignedDocument) {
    setEditingSigned(doc);
    setEditForm({
      ...doc.details,
      mcDays: doc.details.mcDays || "1",
      mcStartDate: doc.details.mcStartDate || new Date().toISOString().slice(0, 10),
      mcDiagnosis: doc.details.mcDiagnosis || "",
      mcDoctorName: doc.details.mcDoctorName || "",
      referralTo: doc.details.referralTo || "",
      referralDiagnosis: doc.details.referralDiagnosis || "",
      referralContent: doc.details.referralContent || "",
    });
  }

  async function updateSignedDocumentProcedures(doc: SignedDocument, procedures: ProcedureRecord[]) {
    if (!doc.consultationId) {
      throw new Error("This generated document is missing its consultation reference.");
    }

    const response = await fetch("/api/consultations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ consultationId: doc.consultationId, procedures }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(payload?.error || payload?.message || "Failed to update generated document.");
    }
  }

  function getConsultationProcedures(doc: SignedDocument) {
    const consultation = consultations.find((item) => item.id === doc.consultationId);
    return consultation?.procedures || [];
  }

  async function handleSaveSignedDocument() {
    if (!editingSigned) return;

    const currentProcedures = getConsultationProcedures(editingSigned);
    if (!currentProcedures[editingSigned.procedureIndex]) {
      toast({
        title: "Document not found",
        description: "Refresh the page and try again.",
        variant: "destructive",
      });
      return;
    }

    const title = editingSigned.kind === "mc" ? "MEDICAL CERTIFICATE (MC)" : "REFERRAL LETTER";
    const details = {
      ...editingSigned.details,
      ...editForm,
      kind: editingSigned.kind,
      title,
      status: editingSigned.status || editingSigned.details.status || "completed",
    };
    const updatedProcedure: ProcedureRecord = {
      ...editingSigned.procedure,
      name: title,
      category: "documents",
      notes: JSON.stringify(details),
    };

    setSavingSigned(true);
    try {
      const nextProcedures = currentProcedures.map((procedure, index) =>
        index === editingSigned.procedureIndex ? updatedProcedure : procedure
      );
      await updateSignedDocumentProcedures(editingSigned, nextProcedures);
      setEditingSigned(null);
      setEditForm({});
      toast({ title: "Document updated" });
      router.refresh();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err?.message || "Failed to update generated document.",
        variant: "destructive",
      });
    } finally {
      setSavingSigned(false);
    }
  }

  async function handleDeleteSignedDocument(doc: SignedDocument) {
    const currentProcedures = getConsultationProcedures(doc);
    if (!currentProcedures[doc.procedureIndex]) {
      toast({
        title: "Document not found",
        description: "Refresh the page and try again.",
        variant: "destructive",
      });
      return;
    }

    setDeleting(doc.id);
    try {
      const nextProcedures = currentProcedures.filter((_, index) => index !== doc.procedureIndex);
      await updateSignedDocumentProcedures(doc, nextProcedures);
      if (viewingSigned?.id === doc.id) setViewingSigned(null);
      if (editingSigned?.id === doc.id) setEditingSigned(null);
      toast({ title: "Document deleted" });
      router.refresh();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err?.message || "Failed to delete generated document.",
        variant: "destructive",
      });
    } finally {
      setDeleting(null);
    }
  }

  async function buildDocumentHtml(doc: SignedDocument): Promise<string> {
    const res = await fetch(`/api/document-templates?type=${doc.kind}`);
    let html: string;
    if (res.ok) {
      html = (await res.json()).html;
    } else {
      const body = await res.json().catch(() => null);
      console.warn("Template fetch failed:", body?.error ?? `HTTP ${res.status}`, "— using default");
      html = doc.kind === "mc" ? DEFAULT_MC_TEMPLATE : DEFAULT_REFERRAL_TEMPLATE;
    }
    const today = new Date().toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const issuedDate = formatDateLabel(doc.date) || today;
    const data: Record<string, string> =
      doc.kind === "mc"
        ? {
            "{{clinicName}}": organization?.name || "",
            "{{clinicAddress}}": organization?.address || "",
            "{{clinicPhone}}": organization?.phone || "",
            "{{patientName}}": patient.fullName || "",
            "{{patientNric}}": patient.nric || "",
            "{{patientDob}}": formatDateLabel(patient.dateOfBirth) || "",
            "{{mcDays}}": doc.details.mcDays || "1",
            "{{mcStartDate}}": formatDateLabel(doc.details.mcStartDate) || issuedDate,
            "{{mcEndDate}}": calcMcEndDate(
              doc.details.mcStartDate,
              Number(doc.details.mcDays || 1)
            ),
            "{{diagnosis}}": doc.details.mcDiagnosis || "",
            "{{doctorName}}": doc.details.mcDoctorName || "",
            "{{date}}": today,
          }
        : {
            "{{clinicName}}": organization?.name || "",
            "{{clinicAddress}}": organization?.address || "",
            "{{clinicPhone}}": organization?.phone || "",
            "{{patientName}}": patient.fullName || "",
            "{{patientNric}}": patient.nric || "",
            "{{patientAge}}": calcAge(patient.dateOfBirth),
            "{{referralTo}}": doc.details.referralTo || "",
            "{{referralFrom}}":
              doc.details.referralFrom ||
              doc.details.mcDoctorName ||
              organization?.name ||
              "",
            "{{referralBody}}": doc.details.referralContent || "",
            "{{diagnosis}}": doc.details.referralDiagnosis || "",
            "{{doctorName}}": doc.details.mcDoctorName || "",
            "{{date}}": today,
          };
    return fillPlaceholders(html, data);
  }

  async function buildLegacyReferralHtml(r: Referral): Promise<string> {
    const res = await fetch("/api/document-templates?type=referral");
    let html: string;
    if (res.ok) {
      html = (await res.json()).html;
    } else {
      const body = await res.json().catch(() => null);
      console.warn("Template fetch failed:", body?.error ?? `HTTP ${res.status}`, "— using default");
      html = DEFAULT_REFERRAL_TEMPLATE;
    }
    const today = new Date().toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const dateLabel = r.date ? format(new Date(r.date), "dd MMM yyyy") : today;
    const toLine = [r.department, r.facility].filter(Boolean).join(", ") || "";
    const data: Record<string, string> = {
      "{{clinicName}}": organization?.name || "",
      "{{clinicAddress}}": organization?.address || "",
      "{{clinicPhone}}": organization?.phone || "",
      "{{patientName}}": patient.fullName || "",
      "{{patientNric}}": patient.nric || "",
      "{{patientAge}}": calcAge(patient.dateOfBirth),
      "{{referralTo}}": toLine,
      "{{referralFrom}}": r.doctorName || organization?.name || "",
      "{{referralBody}}": (r as any).letterText || "",
      "{{diagnosis}}": r.specialty || "",
      "{{doctorName}}": r.doctorName || "",
      "{{date}}": dateLabel,
    };
    return fillPlaceholders(html, data);
  }

  function openPrintWindow(html: string) {
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (win) win.addEventListener("load", () => win.print());
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  async function openSignedDocumentViewer(doc: SignedDocument) {
    setViewingSigned(doc);
    setViewingHtml(null);
    setViewingHtmlLoading(true);
    try {
      const html = await buildDocumentHtml(doc);
      setViewingHtml(html);
    } catch (err: any) {
      toast({
        title: "Preview failed",
        description: err?.message || "Could not load document preview.",
        variant: "destructive",
      });
    } finally {
      setViewingHtmlLoading(false);
    }
  }

  async function openLegacyReferralViewer(r: Referral) {
    setViewing(r);
    setViewingHtml(null);
    setViewingHtmlLoading(true);
    try {
      const html = await buildLegacyReferralHtml(r);
      setViewingHtml(html);
    } catch (err: any) {
      toast({
        title: "Preview failed",
        description: err?.message || "Could not load document preview.",
        variant: "destructive",
      });
    } finally {
      setViewingHtmlLoading(false);
    }
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Generated Documents</CardTitle>
          <CardDescription>Saved MCs and referral letters.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading documents…
            </div>
          )}
          {!loading && loadError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
              <p className="text-sm font-medium text-destructive">Could not load generated documents.</p>
              <p className="mt-1 text-sm text-muted-foreground">{loadError}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => loadReferrals()}
              >
                Retry
              </Button>
            </div>
          )}
          {!loading && !loadError && referrals.length === 0 && signedDocuments.length === 0 && (
            <div className="rounded-lg border border-dashed p-4">
              <p className="text-sm font-medium">No generated documents yet.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Signed MCs and referral letters will appear here after a consult is completed.
              </p>
            </div>
          )}
          {signedDocuments.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/40"
            >
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-4 text-left"
                onClick={() => openSignedDocumentViewer(doc)}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium">
                    {doc.kind === "mc" ? "Medical Certificate (MC)" : "Referral Letter"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {[
                      doc.kind === "mc"
                        ? [
                            doc.details.mcDays
                              ? `${doc.details.mcDays} day${doc.details.mcDays === "1" ? "" : "s"}`
                              : null,
                            doc.details.mcStartDate
                              ? `from ${formatDateLabel(doc.details.mcStartDate)}`
                              : null,
                            doc.details.mcDiagnosis,
                          ]
                            .filter(Boolean)
                            .join(" • ")
                        : [doc.details.referralTo, doc.details.referralDiagnosis]
                            .filter(Boolean)
                            .join(" • "),
                      doc.date ? formatDateLabel(doc.date) : null,
                      doc.status,
                    ]
                      .filter(Boolean)
                      .join(" — ")}
                  </p>
                </div>
              </button>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => startEditSignedDocument(doc)}>
                  <Pencil className="h-4 w-4" />
                  <span className="sr-only">Edit document</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={deleting === doc.id}
                  onClick={() => handleDeleteSignedDocument(doc)}
                >
                  {deleting === doc.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 text-destructive" />
                  )}
                  <span className="sr-only">Delete document</span>
                </Button>
              </div>
            </div>
          ))}
          {referrals.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/40"
            >
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-4 text-left"
                onClick={() => openLegacyReferralViewer(r)}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium">{r.specialty} Referral</p>
                  <p className="text-sm text-muted-foreground">
                    {[r.facility, r.department].filter(Boolean).join(" • ")}
                    {r.date ? ` — ${format(new Date(r.date), "dd MMM yyyy")}` : ""}
                  </p>
                </div>
              </button>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={deleting === r.id}
                  onClick={() => handleDelete(r.id)}
                >
                  {deleting === r.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 text-destructive" />
                  )}
                </Button>
              </div>
            </div>
          ))}
          {!loading && !loadError && referrals.length === 0 && signedDocuments.length > 0 && (
            <p className="text-sm text-muted-foreground">Referral letters are not saved yet.</p>
          )}
        </CardContent>
      </Card>

      {/* Edit dialog — unchanged */}
      <Dialog
        open={!!editingSigned}
        onOpenChange={(open) => {
          if (!open) {
            setEditingSigned(null);
            setEditForm({});
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Edit {editingSigned?.kind === "mc" ? "Medical Certificate (MC)" : "Referral Letter"}
            </DialogTitle>
            <DialogDescription>
              Update the saved generated document. The PDF preview will use these values.
            </DialogDescription>
          </DialogHeader>

          {editingSigned?.kind === "mc" && (
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="mc-days">MC days</Label>
                <Input
                  id="mc-days"
                  type="number"
                  min="1"
                  value={editForm.mcDays || ""}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, mcDays: event.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="mc-start-date">Start date</Label>
                <Input
                  id="mc-start-date"
                  type="date"
                  value={editForm.mcStartDate || ""}
                  onChange={(event) =>
                    setEditForm((prev) => ({ ...prev, mcStartDate: event.target.value }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="mc-diagnosis">Diagnosis / reason</Label>
                <Textarea
                  id="mc-diagnosis"
                  value={editForm.mcDiagnosis || ""}
                  onChange={(event) =>
                    setEditForm((prev) => ({ ...prev, mcDiagnosis: event.target.value }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="mc-doctor">Doctor name</Label>
                <Input
                  id="mc-doctor"
                  value={editForm.mcDoctorName || ""}
                  onChange={(event) =>
                    setEditForm((prev) => ({ ...prev, mcDoctorName: event.target.value }))
                  }
                />
              </div>
            </div>
          )}

          {editingSigned?.kind === "referral" && (
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="referral-to">Referral to</Label>
                <Input
                  id="referral-to"
                  value={editForm.referralTo || ""}
                  onChange={(event) =>
                    setEditForm((prev) => ({ ...prev, referralTo: event.target.value }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="referral-diagnosis">Diagnosis / specialty</Label>
                <Input
                  id="referral-diagnosis"
                  value={editForm.referralDiagnosis || ""}
                  onChange={(event) =>
                    setEditForm((prev) => ({ ...prev, referralDiagnosis: event.target.value }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="referral-content">Letter content</Label>
                <Textarea
                  id="referral-content"
                  className="min-h-40"
                  value={editForm.referralContent || ""}
                  onChange={(event) =>
                    setEditForm((prev) => ({ ...prev, referralContent: event.target.value }))
                  }
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEditingSigned(null);
                setEditForm({});
              }}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleSaveSignedDocument} disabled={savingSigned}>
              {savingSigned && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View signed document — HTML template iframe */}
      <Dialog
        open={!!viewingSigned}
        onOpenChange={(open) => {
          if (!open) {
            setViewingSigned(null);
            setViewingHtml(null);
          }
        }}
      >
        <DialogContent className="w-[95vw] overflow-hidden p-0 sm:max-w-5xl">
          <div className="flex h-[90vh] flex-col">
            <DialogHeader className="space-y-2 border-b px-6 py-4">
              <DialogTitle>
                {viewingSigned?.kind === "mc" ? "Medical Certificate (MC)" : "Referral Letter"}
              </DialogTitle>
              <DialogDescription>
                {viewingSigned ? formatDateLabel(viewingSigned.date) : ""}
              </DialogDescription>
            </DialogHeader>

            <div className="min-h-0 flex-1 px-6 py-4">
              {viewingHtmlLoading && (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}
              {!viewingHtmlLoading && viewingHtml && (
                <iframe
                  srcDoc={viewingHtml}
                  className="h-full w-full rounded-lg border"
                  title="Document preview"
                />
              )}
            </div>

            <div className="flex justify-end gap-2 border-t px-6 py-4">
              <Button
                variant="outline"
                onClick={() => {
                  setViewingSigned(null);
                  setViewingHtml(null);
                }}
              >
                Close
              </Button>
              <Button
                disabled={!viewingHtml}
                onClick={() => viewingHtml && openPrintWindow(viewingHtml)}
              >
                <Download className="mr-2 h-4 w-4" /> Print / Save PDF
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View legacy FHIR referral — HTML template iframe */}
      <Dialog
        open={!!viewing}
        onOpenChange={(open) => {
          if (!open) {
            setViewing(null);
            setViewingHtml(null);
          }
        }}
      >
        <DialogContent className="w-[95vw] overflow-hidden p-0 sm:max-w-5xl">
          <div className="flex h-[90vh] flex-col">
            <DialogHeader className="space-y-2 border-b px-6 py-4">
              <DialogTitle>Referral Letter</DialogTitle>
              <DialogDescription>
                {viewing ? `${viewing.specialty} — ${viewing.facility}` : ""}
              </DialogDescription>
            </DialogHeader>

            <div className="min-h-0 flex-1 px-6 py-4">
              {viewingHtmlLoading && (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}
              {!viewingHtmlLoading && viewingHtml && (
                <iframe
                  srcDoc={viewingHtml}
                  className="h-full w-full rounded-lg border"
                  title="Document preview"
                />
              )}
            </div>

            <div className="flex justify-end gap-2 border-t px-6 py-4">
              <Button
                variant="outline"
                onClick={() => {
                  setViewing(null);
                  setViewingHtml(null);
                }}
              >
                Close
              </Button>
              <Button
                disabled={!viewingHtml}
                onClick={() => viewingHtml && openPrintWindow(viewingHtml)}
              >
                <Download className="mr-2 h-4 w-4" /> Print / Save PDF
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
