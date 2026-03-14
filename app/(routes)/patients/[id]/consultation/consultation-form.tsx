"use client";

import { useState, useEffect, useMemo, useCallback, FormEvent, KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";
import { ArrowLeft, Mic } from "lucide-react";
import { Prescription, ProcedureRecord } from "@/lib/models";
import { safeToISOString } from "@/lib/utils";
import { OrderComposer } from "@/components/orders/order-composer";
import { PatientCard, SerializedPatient } from "@/components/patients/patient-card";
import { useToast } from "@/components/ui/use-toast";
import { useRouter } from "next/navigation";
import { getProcedures } from "@/lib/procedures";
import SoapRewriteButton from "./soap-rewrite-button";
import ReferralLetterButton from "./referral-letter-button";
import { executeSmartTextCommand, type SmartTextContext } from "@/lib/smart-text";
import type { SerializedConsultation } from "@/lib/types";
import { SOAP_REWRITE_ENABLED, TRANSCRIBE_ENABLED } from "@/lib/features";
import { getPatient } from "@/lib/fhir/patient-client";
import { LAB_TESTS, type LabTestCode } from "@/lib/fhir/lab-service";
import { IMAGING_PROCEDURES, type ImagingProcedureCode } from "@/lib/fhir/imaging-service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DiagnosisSearch } from "@/components/diagnosis-search";

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
  const updateQueueStatus = async (status: "arrived" | "waiting" | "in_consultation" | "completed" | "meds_and_bills" | null) => {
    const response = await fetch("/api/queue", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ patientId, status }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || "Failed to update queue status");
    }
  };

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
  const [clinicalNotes, setClinicalNotes] = useState(
    initialConsultation?.notes ?? initialConsultation?.chiefComplaint ?? ""
  );
  const [diagnosis, setDiagnosis] = useState(initialConsultation?.diagnosis ?? "");
  const [procedureEntries, setProcedureEntries] = useState<ProcedureRecord[]>(
    initialConsultation?.procedures ? [...initialConsultation.procedures] : []
  );
  const [prescriptions, setPrescriptions] = useState<Prescription[]>(
    initialConsultation?.prescriptions ? [...initialConsultation.prescriptions] : []
  );
  const [labSelections, setLabSelections] = useState<LabTestCode[]>([]);
  const [imagingSelections, setImagingSelections] = useState<ImagingProcedureCode[]>([]);
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

  // Procedures managed by OrderComposer
  const [procedureOptions, setProcedureOptions] = useState<{ id: string; label: string; price?: number; codingSystem?: string; codingCode?: string; codingDisplay?: string }[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const list = await getProcedures();
        setProcedureOptions(list.map(p => ({ id: p.id, label: p.name, price: p.defaultPrice, codingSystem: p.codingSystem, codingCode: p.codingCode, codingDisplay: p.codingDisplay })));
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

  const toggleLab = useCallback((code: LabTestCode) => {
    setLabSelections((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  }, []);

  const toggleImaging = useCallback((code: ImagingProcedureCode) => {
    setImagingSelections((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  }, []);

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
        description: "Please fill in Consultation Note and Diagnosis",
        variant: "destructive"
      });
      return;
    }

    try {
      setSubmitting(true);
      const consultationData = {
        patientId,
        diagnosis,
        procedures: procedureEntries, // From order composer
        notes: clinicalNotes,
        prescriptions: prescriptions // Assuming prescriptions state already holds objects with price?
      };

      if (isEditMode && initialConsultation?.id) {
        // Note: In FHIR, Encounters are typically immutable
        // Best practice is to create amendment Observations rather than updating
        toast({
          title: "Edit Mode",
          description: "FHIR Encounters are immutable. Please create a new consultation for changes.",
          variant: "destructive",
        });
        return;
      }

      // 🎯 SAVE TO MEDPLUM (FHIR) - Source of Truth
      const { saveConsultation } = await import('@/lib/fhir/consultation-client');
      const newConsultationId = await saveConsultation(consultationData);

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
              clinicalNotes: clinicalNotes,
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
              clinicalQuestion: undefined,
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

      console.log(`✅ Consultation saved to Medplum FHIR: ${newConsultationId}`);

      let queueUpdateFailed = false;
      try {
        // Update queue status AFTER successful consultation save
        await updateQueueStatus(patientId, "meds_and_bills");
      } catch (queueError) {
        queueUpdateFailed = true;
        console.error('Queue status update failed:', queueError);
      }

      const orderMessage = orderErrors.length
        ? `Consultation saved. Orders with issues: ${orderErrors.join(', ')}.`
        : "Consultation has been successfully recorded to FHIR and orders placed.";
      const queueMessage = queueUpdateFailed ? " Queue status update failed." : "";

      toast({
        title: "Consultation Saved",
        description: `${orderMessage}${queueMessage}`,
        variant: orderErrors.length || queueUpdateFailed ? "destructive" : "default",
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

          {/* Middle: Consultation Note & Diagnosis (largest column) */}
          <div className="md:col-span-6 space-y-3">
            <div className="space-y-1">
              <Textarea
                placeholder="Consultation note"
                className="min-h-[260px]"
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
                sourceText={[clinicalNotes, diagnosis].filter(Boolean).join("\n\n")}
                patient={patient}
              />
            </div>
            <DiagnosisSearch value={diagnosis} onChange={setDiagnosis} />
          </div>

          {/* Right: Orders (Meds + Procedures) */}
          <div className="md:col-span-3 space-y-2 sticky top-2 self-start">
            <OrderComposer
              procedureOptions={procedureOptions}
              initialPrescriptions={prescriptions}
              initialProcedures={procedureEntries}
              onPrescriptionsChange={setPrescriptions}
              onProceduresChange={setProcedureEntries}
            />
            <div className="border rounded-md p-3 space-y-3">
              <div>
                <p className="text-sm font-semibold">Lab Orders (FHIR ServiceRequest)</p>
                <div className="space-y-1 max-h-36 overflow-auto pr-1">
                  {labOptions.map((lab) => (
                    <label key={lab.code} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={labSelections.includes(lab.code)}
                        onChange={() => toggleLab(lab.code)}
                      />
                      <span>{lab.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold">Imaging Orders (PACS)</p>
                <div className="space-y-1 max-h-36 overflow-auto pr-1">
                  {imagingOptions.map((img) => (
                    <label key={img.code} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={imagingSelections.includes(img.code)}
                        onChange={() => toggleImaging(img.code)}
                      />
                      <span>{img.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-4">
          <Button variant="outline" type="button" asChild>
            <Link href={`/patients/${patientId}`}>Cancel</Link>
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? (isEditMode ? "Updating..." : "Saving...") : isEditMode ? "Update Consultation" : "Sign Order"}
          </Button>
        </div>
      </form>
    </div>
  );
}
