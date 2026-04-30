"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { PDFViewer, pdf } from "@react-pdf/renderer";
import {
  Bold,
  CalendarDays,
  Download,
  FileText,
  Italic,
  List,
  MoreHorizontal,
  Plus,
  Redo2,
  Search,
  Table2,
  Trash2,
  Underline,
  Undo2,
} from "lucide-react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { saveReferral, getPatientReferrals, type Referral } from "@/lib/fhir/referral-client";
import ReferralDocument from "@/components/referrals/referral-document";
import { fetchOrganizationDetails, type OrganizationDetails } from "@/lib/org";

function formatDateLabel(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return format(date, "dd MMM yyyy");
}

function toDateInputValue(value: Date): string {
  return format(value, "yyyy-MM-dd");
}

function formatInputDate(value: string): string {
  if (!value) return "-";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return format(parsed, "dd MMM yyyy");
}

function calculatePatientAgeLabel(dateOfBirth?: string | null): string {
  if (!dateOfBirth) return "Age not recorded";
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return "Age not recorded";
  const now = new Date();
  let years = now.getFullYear() - dob.getFullYear();
  const monthDelta = now.getMonth() - dob.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < dob.getDate())) {
    years -= 1;
  }
  return years >= 0 ? `${years} years old` : "Age not recorded";
}

const documentTemplates = [
  {
    id: "mc",
    title: "MEDICAL CERTIFICATE (MC)",
    status: "In stock",
    category: "Documents",
    price: "RM 0.00",
  },
  {
    id: "referral",
    title: "REFERRAL LETTER",
    status: "In stock",
    category: "Documents",
    price: "RM 0.00",
  },
  {
    id: "quarantine",
    title: "QUARANTINE LETTER",
    status: "In stock",
    category: "Documents",
    price: "RM 0.00",
  },
] as const;

type DocumentTemplateId = (typeof documentTemplates)[number]["id"];

interface ReferralMCSectionProps {
  patient: any;
}

export default function ReferralMCSection({ patient }: ReferralMCSectionProps) {
  const { toast } = useToast();
  const [showSelectorDialog, setShowSelectorDialog] = useState(false);
  const [activeDocument, setActiveDocument] = useState<DocumentTemplateId | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDocuments, setSelectedDocuments] = useState<DocumentTemplateId[]>([]);

  const today = useMemo(() => toDateInputValue(new Date()), []);
  const [mcVisitDate, setMcVisitDate] = useState(today);
  const [mcDays, setMcDays] = useState(1);
  const [mcStartDate, setMcStartDate] = useState(today);
  const [mcEndDate, setMcEndDate] = useState(today);
  const [mcDiagnosis, setMcDiagnosis] = useState("");
  const [mcDependent, setMcDependent] = useState("");

  const [referralTo, setReferralTo] = useState("(Insert Hosp name)");
  const [referralNotes, setReferralNotes] = useState("Please include any medical information you deem relevant for the referral");
  const [referralDiagnosis, setReferralDiagnosis] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState<Referral | null>(null);
  const [organization, setOrganization] = useState<OrganizationDetails | null>(null);

  const patientAgeLabel = calculatePatientAgeLabel(patient.dateOfBirth);
  const doctorName = organization?.name || "KLINIK DR HASSEENAH HASSEENAH";

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const list = await getPatientReferrals(patient.id);
        if (!active) return;
        setReferrals(list as any);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [patient.id]);

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

  useEffect(() => {
    if (!mcStartDate || mcDays < 1) return;
    const start = new Date(`${mcStartDate}T00:00:00`);
    if (Number.isNaN(start.getTime())) return;
    start.setDate(start.getDate() + mcDays - 1);
    setMcEndDate(toDateInputValue(start));
  }, [mcDays, mcStartDate]);

  const filteredTemplates = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    if (!term) return documentTemplates;
    return documentTemplates.filter((template) => {
      return `${template.title} ${template.category}`.toLowerCase().includes(term);
    });
  }, [searchQuery]);

  function openTemplate(templateId: DocumentTemplateId) {
    if (!selectedDocuments.includes(templateId)) {
      setSelectedDocuments((current) => [...current, templateId]);
    }
    setActiveDocument(templateId);
  }

  function removeTemplate(templateId: DocumentTemplateId) {
    setSelectedDocuments((current) => current.filter((id) => id !== templateId));
    if (activeDocument === templateId) {
      setActiveDocument(null);
    }
  }

  function closeDocumentDialog() {
    setActiveDocument(null);
  }

  function handleCompleteLater() {
    toast({ title: "Document saved as incomplete" });
    closeDocumentDialog();
  }

  function handleCompleteMC(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    toast({ title: "Medical certificate completed", description: "The MC is ready for review and printing." });
    closeDocumentDialog();
  }

  const referralLetterText = useMemo(() => {
    return [
      "REFERRAL LETTER",
      `Date: ${formatInputDate(today)}`,
      `Referral to: ${referralTo}`,
      "",
      "Patient's Detail:",
      `Name: ${patient.fullName}`,
      `Age: ${patientAgeLabel}`,
      `ID No: ${patient.nric || "-"}`,
      `Address: ${patient.address || "-"}`,
      `Gender: ${patient.gender || "-"}`,
      "",
      `Notes: ${referralNotes}`,
      `Diagnosis: ${referralDiagnosis || "{{diagnosis}}"}`,
      "",
      "Thank you.",
      "",
      "Signature:",
      "................................................",
      `${doctorName} (MMC: {{doctor_mmc_no }})`,
    ].join("\n");
  }, [doctorName, patient.address, patient.fullName, patient.gender, patient.nric, patientAgeLabel, referralDiagnosis, referralNotes, referralTo, today]);

  async function handleCompleteReferral(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setSubmitting(true);
      const id = await saveReferral({
        patientId: patient.id,
        date: new Date(),
        specialty: "Referral Letter",
        facility: referralTo,
        reason: referralDiagnosis || "Referral letter",
        clinicalInfo: referralLetterText,
      });
      const list = await getPatientReferrals(patient.id);
      setReferrals(list as any);
      toast({ title: "Referral saved", description: `Referral letter saved to FHIR (${id}).` });
      closeDocumentDialog();
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Failed to save referral.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle>Patient Documents</CardTitle>
              <CardDescription>Create MCs, referral letters, and other patient documents.</CardDescription>
            </div>
            <Dialog open={showSelectorDialog} onOpenChange={setShowSelectorDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Create document
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto p-0">
                <DialogHeader className="border-b px-6 py-4">
                  <DialogTitle>Treatment plan</DialogTitle>
                  <DialogDescription>Search and select the document you want to add into the patient profile.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-6 p-6 lg:grid-cols-[1fr_360px]">
                  <div className="space-y-4">
                    <div className="rounded-lg border bg-muted/20 p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">Search and select the item you want add into treatment panel</p>
                          <p className="text-xs text-muted-foreground">Search inventory and services</p>
                        </div>
                        <Badge variant="secondary">Documents</Badge>
                      </div>
                      <div className="relative">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          value={searchQuery}
                          onChange={(event) => setSearchQuery(event.target.value)}
                          placeholder="Search inventory and services"
                          className="pl-9"
                        />
                      </div>
                      <div className="mt-4 rounded-md border bg-background">
                        <div className="border-b px-3 py-2 text-xs font-medium text-muted-foreground">Existing documents</div>
                        {filteredTemplates.length === 0 ? (
                          <div className="px-3 py-8 text-center text-sm text-muted-foreground">No results match</div>
                        ) : (
                          <div className="divide-y">
                            {filteredTemplates.map((template) => (
                              <button
                                key={template.id}
                                type="button"
                                onClick={() => openTemplate(template.id)}
                                className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left hover:bg-muted/50"
                              >
                                <div>
                                  <p className="text-sm font-semibold">{template.title}</p>
                                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                                    <span>{template.status}</span>
                                    <span>{template.category}</span>
                                  </div>
                                </div>
                                <span className="text-sm font-medium">{template.price}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border bg-card p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-sm font-semibold">Selected documents</p>
                      <span className="text-xs text-muted-foreground">Total RM 0.00</span>
                    </div>
                    {selectedDocuments.length === 0 ? (
                      <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                        No treatment and services selected yet
                        <br />
                        Selected documents will show up here
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {selectedDocuments.map((id) => {
                          const template = documentTemplates.find((item) => item.id === id)!;
                          return (
                            <div key={id} className="rounded-md border p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold">{template.title}</p>
                                  <button type="button" onClick={() => openTemplate(id)} className="text-xs text-primary underline-offset-2 hover:underline">
                                    Incomplete | Continue
                                  </button>
                                </div>
                                <Button type="button" variant="ghost" size="sm" onClick={() => removeTemplate(id)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                              <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                                <span>Quantity<br /><strong className="text-foreground">1</strong></span>
                                <span>Price tier<br /><strong className="text-foreground">Panel Rate</strong></span>
                                <span>Amount<br /><strong className="text-foreground">RM 0.00</strong></span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border p-4">
              <p className="text-sm font-semibold">MEDICAL CERTIFICATE (MC)</p>
              <p className="mt-1 text-xs text-muted-foreground">Structured MC form with live preview.</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-sm font-semibold">REFERRAL LETTER</p>
              <p className="mt-1 text-xs text-muted-foreground">Rich text editor, smart fields, and preview.</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-sm font-semibold">Memo</p>
              <p className="mt-1 text-xs text-muted-foreground">Search currently returns no memo template.</p>
            </div>
          </div>
          {loading && <p className="text-sm text-muted-foreground">Loading saved referrals…</p>}
          {!loading && referrals.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-medium">Saved referral letters</p>
              {referrals.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-lg border p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{r.specialty} Referral</p>
                      <p className="text-sm text-muted-foreground">
                        {[r.facility, r.department].filter(Boolean).join(" • ")} - {r.date ? format(new Date(r.date), "dd MMM yyyy") : "N/A"}
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setViewing(r)}>View</Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={activeDocument === "mc"} onOpenChange={(open) => !open && closeDocumentDialog()}>
        <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto p-0">
          <form onSubmit={handleCompleteMC}>
            <DialogHeader className="border-b px-6 py-4">
              <DialogTitle>MEDICAL CERTIFICATE (MC)</DialogTitle>
              <DialogDescription>Fill out information below to complete document</DialogDescription>
            </DialogHeader>
            <div className="grid gap-6 p-6 lg:grid-cols-[420px_1fr]">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Date of visit</Label>
                  <div className="relative">
                    <Input type="date" value={mcVisitDate} onChange={(event) => setMcVisitDate(event.target.value)} />
                    <CalendarDays className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Doctor</Label>
                  <Input value={doctorName} readOnly />
                </div>
                <div className="space-y-2">
                  <Label>No of days</Label>
                  <Input type="number" min="1" value={mcDays} onChange={(event) => setMcDays(Number(event.target.value || 1))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Start date</Label>
                    <Input type="date" value={mcStartDate} onChange={(event) => setMcStartDate(event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>End date</Label>
                    <Input type="date" value={mcEndDate} onChange={(event) => setMcEndDate(event.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Diagnosis</Label>
                  <Input placeholder="Select diagnosis" value={mcDiagnosis} onChange={(event) => setMcDiagnosis(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>This patient is dependent of (Optional)</Label>
                  <Input placeholder="Enter patient name, NRIC or phone number" value={mcDependent} onChange={(event) => setMcDependent(event.target.value)} />
                  <button type="button" className="text-xs text-primary underline-offset-2 hover:underline">Enter Dependent Info Manually</button>
                </div>
              </div>
              <div>
                <p className="mb-2 text-sm font-semibold">Document preview</p>
                <div className="min-h-[520px] rounded-lg border bg-white p-8 text-sm leading-7 shadow-sm">
                  <h3 className="text-center text-lg font-bold">MEDICAL CERTIFICATE</h3>
                  <p className="mt-8 text-right">Date: {formatInputDate(mcVisitDate)}</p>
                  <p className="mt-8">To whom it may concern:</p>
                  <p className="mt-4">
                    I, {doctorName} have carefully examine Mr/Mrs. {patient.fullName}, {patient.nric || "-"}, {patientAgeLabel}.
                    I certify that he/she is suffering from {mcDiagnosis || "________________"}.
                  </p>
                  <p className="mt-4">
                    I consider that a period of absence from duty of {formatInputDate(mcStartDate)} until {formatInputDate(mcEndDate)} is necessary for the health restoration.
                  </p>
                  {mcDependent ? <p className="mt-4">Dependent of: {mcDependent}</p> : null}
                  <p className="mt-8">MC No: {"{MC No}"}</p>
                </div>
              </div>
            </div>
            <DialogFooter className="border-t px-6 py-4">
              <Button type="button" variant="outline" onClick={handleCompleteLater}>Complete later</Button>
              <Button type="submit">Complete document</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={activeDocument === "referral"} onOpenChange={(open) => !open && closeDocumentDialog()}>
        <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto p-0">
          <form onSubmit={handleCompleteReferral}>
            <DialogHeader className="border-b px-6 py-4">
              <DialogTitle>REFERRAL LETTER</DialogTitle>
              <DialogDescription>Editor</DialogDescription>
            </DialogHeader>
            <div className="grid gap-6 p-6 lg:grid-cols-[1fr_380px]">
              <div className="space-y-4">
                <div>
                  <p className="mb-2 text-sm font-medium">Compose content</p>
                  <div className="rounded-lg border bg-background">
                    <div className="flex flex-wrap items-center gap-1 border-b p-2">
                      <Button type="button" variant="ghost" size="sm">Font Size</Button>
                      <Button type="button" variant="ghost" size="icon"><Bold className="h-4 w-4" /></Button>
                      <Button type="button" variant="ghost" size="icon"><Italic className="h-4 w-4" /></Button>
                      <Button type="button" variant="ghost" size="icon"><Underline className="h-4 w-4" /></Button>
                      <Button type="button" variant="ghost" size="sm">Align</Button>
                      <Button type="button" variant="ghost" size="icon"><List className="h-4 w-4" /></Button>
                      <Button type="button" variant="ghost" size="icon" disabled><Undo2 className="h-4 w-4" /></Button>
                      <Button type="button" variant="ghost" size="icon" disabled><Redo2 className="h-4 w-4" /></Button>
                      <Button type="button" variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                      <Button type="button" variant="ghost" size="icon"><Table2 className="h-4 w-4" /></Button>
                    </div>
                    <div className="space-y-4 p-4">
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Referral to:</Label>
                          <Input value={referralTo} onChange={(event) => setReferralTo(event.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label>Diagnosis</Label>
                          <Input value={referralDiagnosis} onChange={(event) => setReferralDiagnosis(event.target.value)} placeholder="{{diagnosis}}" />
                        </div>
                      </div>
                      <Textarea className="min-h-[260px] font-mono text-sm" value={referralLetterText} readOnly />
                      <div className="space-y-2">
                        <Label>Notes</Label>
                        <Textarea value={referralNotes} onChange={(event) => setReferralNotes(event.target.value)} />
                      </div>
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold">Insert smart fields</p>
                  <p className="text-xs text-muted-foreground">This fields allow system to automatically insert existing data. No manual editing needed</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {["Patient name", "Doctor name", "Visit date", "Identification", "Age", "Time in", "Diagnosis"].map((field) => (
                      <Button key={field} type="button" variant="outline" size="sm">{field}</Button>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <p className="mb-2 text-sm font-semibold">Document preview</p>
                <div className="min-h-[540px] rounded-lg border bg-white p-6 text-sm leading-7 shadow-sm">
                  <h3 className="text-center text-lg font-bold">REFERRAL LETTER</h3>
                  <p className="mt-6">Date: <strong>{formatInputDate(today)}</strong></p>
                  <p>Referral to: <strong>{referralTo}</strong></p>
                  <p className="mt-4 font-semibold underline">Patient&apos;s Detail:</p>
                  <table className="mt-2 w-full text-sm">
                    <tbody>
                      <tr><td className="w-24 font-medium">Name:</td><td>{patient.fullName}</td></tr>
                      <tr><td className="font-medium">Age:</td><td>{patientAgeLabel}</td></tr>
                      <tr><td className="font-medium">ID No:</td><td>{patient.nric || "-"}</td></tr>
                      <tr><td className="font-medium">Address:</td><td>{patient.address || "-"}</td></tr>
                      <tr><td className="font-medium">Gender:</td><td>{patient.gender || "-"}</td></tr>
                    </tbody>
                  </table>
                  <p className="mt-4"><strong>Notes:</strong> {referralNotes}</p>
                  <p><strong>Diagnosis:</strong> {referralDiagnosis || "{{diagnosis}}"}</p>
                  <p className="mt-4">Thank you.</p>
                  <p className="mt-8">Signature:</p>
                  <p>................................................</p>
                  <p>{doctorName} (MMC: {"{{doctor_mmc_no }}"})</p>
                </div>
              </div>
            </div>
            <DialogFooter className="border-t px-6 py-4">
              <Button type="button" variant="outline" onClick={handleCompleteLater}>Complete later</Button>
              <Button type="submit" disabled={submitting}>{submitting ? "Completing…" : "Complete document"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={activeDocument === "quarantine"} onOpenChange={(open) => !open && closeDocumentDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>QUARANTINE LETTER</DialogTitle>
            <DialogDescription>This document template is available in the selector but has not been configured yet.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCompleteLater}>Complete later</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewing} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="w-[95vw] overflow-hidden p-0 sm:max-w-3xl">
          <div className="flex h-[85vh] flex-col">
            <DialogHeader className="space-y-2 border-b px-6 py-4">
              <DialogTitle>Referral Letter</DialogTitle>
              <DialogDescription>{viewing ? `${viewing.specialty} - ${viewing.facility}` : ""}</DialogDescription>
            </DialogHeader>

            <div className="min-h-0 flex-1 px-6 py-4">
              {viewing && (
                <div className="flex h-full flex-col gap-4">
                  <div className="min-h-0 flex-1 overflow-hidden rounded-lg border">
                    <PDFViewer className="h-full w-full">
                      <ReferralDocument
                        letterText={(viewing as any).letterText || ""}
                        organization={organization}
                        metadata={{
                          dateLabel: viewing.date ? format(new Date(viewing.date), "dd MMM yyyy") : null,
                          patientName: patient.fullName,
                          patientId: patient.nric,
                          patientDateOfBirth: formatDateLabel(patient.dateOfBirth),
                          patientPhone: patient.phone ?? null,
                          patientEmail: patient.email ?? null,
                          specialty: viewing.specialty,
                          facility: viewing.facility,
                          department: viewing.department ?? null,
                          doctorName: viewing.doctorName ?? null,
                          toLine: [viewing.department, viewing.facility].filter(Boolean).join(", ") || null,
                          fromLine: organization?.name ?? null,
                        }}
                      />
                    </PDFViewer>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t px-6 py-4">
              <Button variant="outline" onClick={() => setViewing(null)}>Close</Button>
              <Button
                onClick={async () => {
                  if (!viewing) return;
                  const blob = await pdf(
                    <ReferralDocument
                      letterText={(viewing as any).letterText || ""}
                      organization={organization}
                      metadata={{
                        dateLabel: viewing.date ? format(new Date(viewing.date), "dd MMM yyyy") : null,
                        patientName: patient.fullName,
                        patientId: patient.nric,
                        patientDateOfBirth: formatDateLabel(patient.dateOfBirth),
                        patientPhone: patient.phone ?? null,
                        patientEmail: patient.email ?? null,
                        specialty: viewing.specialty,
                        facility: viewing.facility,
                        department: viewing.department ?? null,
                        doctorName: viewing.doctorName ?? null,
                        toLine: [viewing.department, viewing.facility].filter(Boolean).join(", ") || null,
                        fromLine: organization?.name ?? null,
                      }}
                    />
                  ).toBlob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `referral-${patient.id}.pdf`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                disabled={!viewing}
              >
                <Download className="mr-2 h-4 w-4" /> Download PDF
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
