"use client";

import { useState, useEffect, useMemo, useCallback, FormEvent, KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";
import { ArrowLeft, Mic } from "lucide-react";
import { Prescription, ProcedureRecord } from "@/lib/models";
import { safeToISOString } from "@/lib/utils";
import { PatientCard, SerializedPatient } from "@/components/patients/patient-card";
import { useToast } from "@/components/ui/use-toast";
import { useRouter } from "next/navigation";
import { getProcedures } from "@/lib/procedures";
import { getMedications } from "@/lib/inventory";
import SoapRewriteButton from "./soap-rewrite-button";
import ReferralLetterButton from "./referral-letter-button";
import { executeSmartTextCommand, type SmartTextContext } from "@/lib/smart-text";
import type { SerializedConsultation } from "@/lib/types";
import { SOAP_REWRITE_ENABLED, TRANSCRIBE_ENABLED } from "@/lib/features";
import { getPatient } from "@/lib/fhir/patient-client";
import { LAB_TESTS, type LabTestCode } from "@/lib/fhir/lab-constants";
import { IMAGING_PROCEDURES, type ImagingProcedureCode } from "@/lib/fhir/imaging-service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { OrderComposer } from "@/components/orders/order-composer";
import { type TreatmentPlanEntry, type TreatmentPlanSummary } from "@/lib/treatment-plan";

// Load procedures from DB

interface ConsultationFormProps {
  patientId: string;
  initialPatient?: SerializedPatient;
  initialConsultation?: SerializedConsultation | null;
}

export default function ConsultationForm({
  patientId,
  initialPatient,
  initialConsultation = null,
}: ConsultationFormProps) {
  const [patient, setPatient] = useState<SerializedPatient | null>(initialPatient ?? null);
  const [loading, setLoading] = useState(!initialPatient);
  const isEditMode = Boolean(initialConsultation?.id);
  const [smartTextState, setSmartTextState] = useState<{
    field: string;
    command: string;
    status: "loading" | "success" | "error";
    message?: string;
  } | null>(null);
  
  // Form state
  const [clinicalNotes, setClinicalNotes] = useState(initialConsultation?.chiefComplaint ?? "");
  const [diagnosis, setDiagnosis] = useState(initialConsultation?.diagnosis ?? "");
  const [progressNote, setProgressNote] = useState(initialConsultation?.progressNote ?? "");
  const [additionalNotes, setAdditionalNotes] = useState(initialConsultation?.notes ?? "");
  const [treatmentEntries, setTreatmentEntries] = useState<TreatmentPlanEntry[]>([]);
  const [treatmentSummary, setTreatmentSummary] = useState<TreatmentPlanSummary>({
    subtotal: 0,
    total: 0,
    currency: "MYR",
    itemCount: 0,
  });
  const [submitting, setSubmitting] = useState(false);

  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    // If we already have initial patient for this id, skip fetching
    if (initialPatient && initialPatient.id === patientId) {
      setLoading(false);
      return;
    }
    let isActive = true;
    async function loadPatient() {
      try {
        const patientData = await getPatient(patientId);
        if (!isActive) return;
        if (patientData) {
          const serializedPatient: SerializedPatient = {
            ...patientData,
            email: patientData.email ?? "",
            postalCode: patientData.postalCode ?? "",
            emergencyContact: patientData.emergencyContact ?? { name: "", relationship: "", phone: "" },
            medicalHistory: patientData.medicalHistory ?? { allergies: [], conditions: [], medications: [] },
            triage: (patientData as any).triage,
            queueStatus: (patientData as any).queueStatus ?? null,
            dateOfBirth: safeToISOString(patientData.dateOfBirth),
            lastVisit: safeToISOString((patientData as any).lastVisit),
            upcomingAppointment: safeToISOString((patientData as any).upcomingAppointment),
            createdAt: safeToISOString((patientData as any).createdAt),
            updatedAt: safeToISOString((patientData as any).updatedAt),
            queueAddedAt: safeToISOString((patientData as any).queueAddedAt),
          };
          setPatient(serializedPatient);
        } else {
          setPatient(null);
        }
      } catch (error) {
        console.error('Error loading patient:', error);
      } finally {
        if (isActive) setLoading(false);
      }
    }
    loadPatient();
    return () => {
      isActive = false;
    };
  }, [patientId, initialPatient]);

  const [procedureOptions, setProcedureOptions] = useState<{ id: string; label: string; price?: number; codingSystem?: string; codingCode?: string; codingDisplay?: string }[]>([]);
  const [medicationOptions, setMedicationOptions] = useState<{ id: string; name: string; unitPrice: number }[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [procedures, medications] = await Promise.all([getProcedures(), getMedications()]);
        setProcedureOptions(
          procedures.map((p) => ({
            id: p.id,
            label: p.name,
            price: p.defaultPrice,
            codingSystem: p.codingSystem,
            codingCode: p.codingCode,
            codingDisplay: p.codingDisplay,
          }))
        );
        setMedicationOptions(
          medications.map((m) => ({
            id: m.id,
            name: m.name,
            unitPrice: m.unitPrice || 0,
          }))
        );
      } catch (e) {
        // ignore
      }
    })();
  }, []);

  const smartTextContext = useMemo<SmartTextContext>(
    () => ({
      patientId: patient?.id ?? patientId,
      patient,
    }),
    [patientId, patient]
  );

  const labOptions = useMemo(
    () =>
      Object.entries(LAB_TESTS).map(([code, meta]) => ({
        code: code as LabTestCode,
        label: meta.display,
      })),
    []
  );

  const imagingOptions = useMemo(
    () =>
      Object.entries(IMAGING_PROCEDURES)
        .filter(([, meta]) => meta.modality === 'DX')
        .map(([code, meta]) => ({
          code: code as ImagingProcedureCode,
          label: `${meta.display} (${meta.modality})`,
        })),
    []
  );

  useEffect(() => {
    if (!smartTextState || smartTextState.status === "loading") {
      return;
    }

    const timeout = window.setTimeout(
      () => setSmartTextState(null),
      smartTextState.status === "error" ? 6000 : 4000
    );

    return () => window.clearTimeout(timeout);
  }, [smartTextState]);

  const smartTextMessage = useCallback(
    (field: string) => {
      if (!smartTextState || smartTextState.field !== field) {
        return null;
      }

      const tone =
        smartTextState.status === "error"
          ? "text-destructive"
          : smartTextState.status === "success"
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-muted-foreground";

      const text =
        smartTextState.status === "loading"
          ? `Smart text ${smartTextState.command} generating…`
          : smartTextState.message ?? "Smart text updated.";

      return <p className={`text-xs ${tone}`}>{text}</p>;
    },
    [smartTextState]
  );

  const treatmentDraftId = useMemo(
    () => (isEditMode && initialConsultation?.id ? `consultation-${initialConsultation.id}` : `patient-${patientId}`),
    [initialConsultation?.id, isEditMode, patientId]
  );

  const initialTreatmentEntries = useMemo<TreatmentPlanEntry[]>(() => {
    const now = new Date().toISOString();
    const fromPrescriptions =
      initialConsultation?.prescriptions?.map((item, index) => ({
        id: `rx-${index}-${item.medication.id}`,
        tab: "items" as const,
        catalogRef: item.medication.id,
        name: item.medication.name,
        quantity: 1,
        unitPrice: Number(item.price || 0),
        lineTotal: Number((item.price || 0).toFixed(2)),
        dosage: item.medication.strength,
        frequency: item.frequency,
        duration: item.duration,
        createdAt: now,
        updatedAt: now,
      })) || [];

    const fromProcedures =
      initialConsultation?.procedures?.map((item, index) => ({
        id: `proc-${index}-${item.procedureId || item.name}`,
        tab: "services" as const,
        catalogRef: item.procedureId,
        name: item.name,
        quantity: 1,
        unitPrice: Number(item.price || 0),
        lineTotal: Number(item.price || 0),
        instruction: item.notes,
        createdAt: now,
        updatedAt: now,
      })) || [];

    return [...fromPrescriptions, ...fromProcedures];
  }, [initialConsultation?.prescriptions, initialConsultation?.procedures]);

  const handleSmartTextKeyDown = useCallback(
    (field: string, setter: (value: string) => void) =>
      async (event: KeyboardEvent<HTMLTextAreaElement>) => {
        const triggerKeys = new Set([" ", "Enter", "Tab"]);
        if (!triggerKeys.has(event.key)) {
          return;
        }

        const textarea = event.currentTarget;
        const selectionStart = textarea.selectionStart ?? 0;
        const selectionEnd = textarea.selectionEnd ?? 0;

        if (selectionStart !== selectionEnd) {
          return;
        }

        const currentValue = textarea.value;
        const preceding = currentValue.slice(0, selectionStart);
        const match = preceding.match(/(?:^|\s)(\.[a-zA-Z0-9_-]+)$/);

        if (!match) {
          return;
        }

        const commandKey = match[1].toLowerCase();
        const startIndex = selectionStart - commandKey.length;

        if (startIndex < 0) {
          return;
        }

        event.preventDefault();
        const triggerKey = event.key;

        setSmartTextState({
          field,
          command: commandKey,
          status: "loading",
        });

        try {
          const result = await executeSmartTextCommand(commandKey, smartTextContext);

          if (!result) {
            setSmartTextState({
              field,
              command: commandKey,
              status: "error",
              message: "Unknown smart text command.",
            });
            return;
          }

          const trailing = triggerKey === "Enter" ? "\n" : triggerKey === " " ? " " : "";
          const before = currentValue.slice(0, startIndex);
          const after = currentValue.slice(selectionEnd);
          const nextValue = `${before}${result.text}${trailing}${after}`;

          setter(nextValue);

          const cursor = before.length + result.text.length + trailing.length;
          requestAnimationFrame(() => {
            textarea.selectionStart = cursor;
            textarea.selectionEnd = cursor;
          });

          setSmartTextState({
            field,
            command: commandKey,
            status: "success",
            message: result.meta ?? "Smart text inserted.",
          });
        } catch (error) {
          console.error("Smart text insertion failed:", error);
          setSmartTextState({
            field,
            command: commandKey,
            status: "error",
            message: "Failed to insert smart text. Try again.",
          });
        }
      },
    [smartTextContext]
  );

  const transcriptionHref = useMemo(() => {
    if (!TRANSCRIBE_ENABLED) {
      return null;
    }
    if (isEditMode && initialConsultation?.id) {
      return `/consultations/transcribe?consultationId=${initialConsultation.id}`;
    }
    return `/consultations/transcribe?patientId=${patientId}`;
  }, [isEditMode, initialConsultation?.id, patientId]);

  useEffect(() => {
    if (!TRANSCRIBE_ENABLED) {
      return;
    }

    const key =
      isEditMode && initialConsultation?.id
        ? `consultation_transcription_${initialConsultation.id}`
        : `consultation_transcription_patient_${patientId}`;

    if (typeof window === "undefined") {
      return;
    }

    try {
      const stored = localStorage.getItem(key);
      if (stored && stored.trim() && stored.trim() !== clinicalNotes.trim()) {
        setClinicalNotes(stored);
        toast({
          title: "Transcription imported",
          description: "We inserted the summary captured from the transcription workspace.",
        });
        localStorage.removeItem(key);
      }
    } catch {
      // ignore storage errors
    }
  }, [clinicalNotes, initialConsultation?.id, isEditMode, patientId, toast]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;

    // Validate form
    if (!clinicalNotes.trim() || !diagnosis.trim()) {
      toast({
        title: "Validation Error",
        description: "Please fill in Chief Complaint and Diagnosis",
        variant: "destructive"
      });
      return;
    }

    try {
      setSubmitting(true);
      const medicationEntries = treatmentEntries.filter((entry) => entry.tab === "items");
      const serviceEntries = treatmentEntries.filter(
        (entry) => entry.tab === "services" || entry.tab === "packages"
      );
      const documentEntries = treatmentEntries.filter((entry) => entry.tab === "documents");

      const prescriptions: Prescription[] = medicationEntries.map((entry) => ({
        medication: {
          id: entry.catalogRef || entry.id,
          name: entry.name,
        },
        frequency: entry.frequency || "",
        duration: entry.duration || "",
        price: entry.unitPrice,
      }));

      const procedureEntries: ProcedureRecord[] = serviceEntries.map((entry) => ({
        name: entry.name,
        price: entry.unitPrice,
        notes: entry.instruction,
        procedureId: entry.catalogRef,
      }));

      const labSelections = documentEntries
        .filter((entry) => entry.meta?.kind === "lab")
        .map((entry) => entry.meta?.code as LabTestCode)
        .filter(Boolean);

      const imagingSelections = documentEntries
        .filter((entry) => entry.meta?.kind === "imaging")
        .map((entry) => entry.meta?.code as ImagingProcedureCode)
        .filter(Boolean);

      const consultationData = {
        patientId,
        chiefComplaint: clinicalNotes,
        diagnosis,
        procedures: procedureEntries,
        notes: additionalNotes,
        progressNote,
        prescriptions,
      };

      let newConsultationId: string;

      if (isEditMode && initialConsultation?.id) {
        // PATCH the existing consultation via the API
        const res = await fetch('/api/consultations', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            consultationId: initialConsultation.id,
            chiefComplaint: clinicalNotes,
            diagnosis,
            notes: additionalNotes,
            progressNote,
            procedures: procedureEntries,
            prescriptions,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to update consultation');
        }
        newConsultationId = initialConsultation.id;
      } else {
        // 🎯 SAVE TO MEDPLUM (FHIR) - Source of Truth
        const { saveConsultation } = await import('@/lib/fhir/consultation-client');
        newConsultationId = await saveConsultation(consultationData);
      }

      const orderErrors: string[] = [];

      if (labSelections.length) {
        try {
          const res = await fetch('/api/labs/order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              patientId,
              encounterId: newConsultationId,
              tests: labSelections,
              priority: 'routine',
              clinicalNotes: additionalNotes || clinicalNotes,
            }),
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || 'Lab order failed');
          }
        } catch (err) {
          console.error('Lab order error:', err);
          orderErrors.push('labs');
        }
      }

      if (imagingSelections.length) {
        try {
          const res = await fetch('/api/imaging/order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              patientId,
              encounterId: newConsultationId,
              procedures: imagingSelections,
              priority: 'routine',
              clinicalIndication: diagnosis || clinicalNotes,
              clinicalQuestion: additionalNotes || undefined,
              orderedBy: undefined,
            }),
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || 'Imaging order failed');
          }
        } catch (err) {
          console.error('Imaging order error:', err);
          orderErrors.push('imaging');
        }
      }

      if (!newConsultationId) {
        throw new Error("Failed to save consultation");
      }

      console.log(`✅ Consultation ${isEditMode ? 'updated' : 'saved'} in Medplum FHIR: ${newConsultationId}`);

      let queueAdvanceError: string | null = null;
      let finalQueueStatus = "meds_and_bills";

      // Queue progression is downstream of the clinical save. It should not
      // cause the UI to report that the consultation itself failed.
      if (!isEditMode) {
        try {
          const response = await fetch('/api/queue', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ patientId, status: 'meds_and_bills' }),
          });

          if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.error || 'Failed to update queue status');
          }
          const queueResult = await response.json().catch(() => ({}));
          finalQueueStatus = queueResult?.finalQueueStatus || finalQueueStatus;
        } catch (error) {
          console.error('Error updating queue status:', error);
          queueAdvanceError = error instanceof Error ? error.message : 'Failed to update queue status';
        }
      }

      const actionLabel = isEditMode ? 'updated' : 'saved';
      const issueMessages: string[] = [];
      if (orderErrors.length) {
        issueMessages.push(`Orders with issues: ${orderErrors.join(', ')}`);
      }
      if (queueAdvanceError) {
        issueMessages.push('Queue status did not update automatically');
      }

      const orderMessage = issueMessages.length
        ? `Consultation ${actionLabel}. ${issueMessages.join('. ')}.`
        : isEditMode
          ? 'Consultation updated successfully.'
          : 'Consultation recorded to FHIR and orders placed.';

      toast({
        title: isEditMode ? 'Consultation Updated' : 'Consultation Saved',
        description: orderMessage,
        variant: issueMessages.length ? 'destructive' : 'default',
      });
      console.log("Consultation completion:", {
        consultationId: newConsultationId,
        finalQueueStatus,
        patientId,
      });

      router.push(`/patients/${patientId}`);
    } catch (error) {
      console.error('Error saving consultation:', error);
      toast({
        title: "Error",
        description: "Failed to save consultation. Please try again.",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="p-6">Loading patient data...</div>;
  }

  if (!patient) {
    return <div className="p-6">Patient not found</div>;
  }

  const vitals = patient.triage?.vitalSigns;
  const treatmentItemsCatalog = medicationOptions.map((item) => ({
    id: item.id,
    name: item.name,
    unitPrice: item.unitPrice,
  }));

  const treatmentServicesCatalog = procedureOptions.map((item) => ({
    id: item.id,
    name: item.label,
    unitPrice: item.price || 0,
  }));

  const treatmentDocumentsCatalog = [
    ...labOptions.map((lab) => ({
      id: `lab-${lab.code}`,
      name: `Lab: ${lab.label}`,
      unitPrice: 0,
      meta: { kind: "lab", code: lab.code },
    })),
    ...imagingOptions.map((img) => ({
      id: `imaging-${img.code}`,
      name: `Imaging: ${img.label}`,
      unitPrice: 0,
      meta: { kind: "imaging", code: img.code },
    })),
  ];

  return (
    <div className="container max-w-7xl py-6">
      <div className="mb-6">
        <Link
          href={`/patients/${patientId}`}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Patient Profile
        </Link>
      </div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">
          {isEditMode ? "Edit Consultation" : "New Consultation"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isEditMode
            ? "Update the consultation notes and orders below."
            : "Record the patient's consultation details below."}
        </p>
      </div>

      {/* Consultation Form */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-start">
          {/* Left: Patient Details */}
          <div className="md:col-span-3 space-y-2 sticky top-2 self-start">
            {patient && <PatientCard patient={patient} compact />}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Latest Vitals</CardTitle>
                <CardDescription>From triage</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">BP</p>
                  <p className="font-medium">
                    {vitals?.bloodPressureSystolic && vitals?.bloodPressureDiastolic
                      ? `${vitals.bloodPressureSystolic}/${vitals.bloodPressureDiastolic} mmHg`
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">HR</p>
                  <p className="font-medium">
                    {vitals?.heartRate ? `${vitals.heartRate} bpm` : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">RR</p>
                  <p className="font-medium">
                    {vitals?.respiratoryRate ? `${vitals.respiratoryRate} /min` : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Temp</p>
                  <p className="font-medium">
                    {vitals?.temperature ? `${vitals.temperature} °C` : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">SpO₂</p>
                  <p className="font-medium">
                    {vitals?.oxygenSaturation ? `${vitals.oxygenSaturation}%` : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Pain</p>
                  <p className="font-medium">
                    {typeof vitals?.painScore === "number" ? vitals.painScore : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Weight</p>
                  <p className="font-medium">
                    {vitals?.weight ? `${vitals.weight} kg` : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Height</p>
                  <p className="font-medium">
                    {vitals?.height ? `${vitals.height} cm` : "—"}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Middle: Chief Complaint & Diagnosis (largest column) */}
          <div className="md:col-span-6 space-y-3">
            <div className="space-y-1">
              <Textarea
                placeholder="Clinical notes"
                className="min-h-[200px]"
                value={clinicalNotes}
                onChange={(e) => setClinicalNotes(e.target.value)}
                onKeyDown={handleSmartTextKeyDown("clinicalNotes", setClinicalNotes)}
              />
              {smartTextMessage("clinicalNotes")}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {SOAP_REWRITE_ENABLED ? (
                <SoapRewriteButton
                  sourceText={clinicalNotes}
                  onInsert={(note) => setClinicalNotes(note)}
                />
              ) : null}
              {transcriptionHref ? (
                <Button variant="outline" size="sm" asChild>
                  <Link href={transcriptionHref} className="inline-flex items-center gap-2">
                    <Mic className="h-4 w-4" />
                    Transcribe conversation
                  </Link>
                </Button>
              ) : null}
              <ReferralLetterButton
                sourceText={[clinicalNotes, diagnosis, additionalNotes].filter(Boolean).join("\n\n")}
                patient={patient}
              />
            </div>
            <Input
              placeholder="Condition (diagnosis)"
              className="mt-2"
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
            />
            <div className="space-y-1">
              <Textarea
                placeholder="Progress note"
                className="min-h-[120px]"
                value={progressNote}
                onChange={(e) => setProgressNote(e.target.value)}
                onKeyDown={handleSmartTextKeyDown("progressNote", setProgressNote)}
              />
              {smartTextMessage("progressNote")}
            </div>
            <div className="space-y-1">
              <Textarea
                placeholder="Additional notes"
                className="min-h-[160px]"
                value={additionalNotes}
                onChange={(e) => setAdditionalNotes(e.target.value)}
                onKeyDown={handleSmartTextKeyDown("additionalNotes", setAdditionalNotes)}
              />
              {smartTextMessage("additionalNotes")}
            </div>
          </div>

          {/* Right: Yezza-style treatment plan workspace */}
          <div className="md:col-span-3 space-y-2 sticky top-2 self-start">
            <OrderComposer
              draftId={treatmentDraftId}
              patientId={patientId}
              consultationId={initialConsultation?.id || undefined}
              initialEntries={initialTreatmentEntries}
              items={treatmentItemsCatalog}
              services={treatmentServicesCatalog}
              packages={[]}
              documents={treatmentDocumentsCatalog}
              onPlanChange={(entries, summary) => {
                setTreatmentEntries(entries);
                setTreatmentSummary(summary);
              }}
              submitLabel={isEditMode ? "Update Consultation" : "Sign Order"}
              submitting={submitting}
            />
            <div className="rounded-md border p-3 text-xs text-muted-foreground">
              Autosaved draft total: <span className="font-semibold">RM {treatmentSummary.total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
