export const dynamic = 'force-dynamic';

import { getPatientFromMedplum } from "@/lib/fhir/patient-service";
import { notFound } from "next/navigation";
import TriageForm from "@/components/triage/triage-form";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { getTriageForPatient } from "@/lib/fhir/triage-service";


interface TriagePageProps {
  params: Promise<{ id: string }>;
}

export default async function TriagePage({ params }: TriagePageProps) {
  const { id } = await params;
  const [patient, triage] = await Promise.all([
    getPatientFromMedplum(id),
    getTriageForPatient(id),
  ]);

  if (!patient) {
    notFound();
  }

  const patientWithTriage = {
    ...patient,
    triage: triage.triage,
    queueStatus: triage.queueStatus ?? null,
    queueAddedAt: triage.queueAddedAt ?? null,
    visitIntent: triage.visitIntent ?? patient.visitIntent,
    payerType: triage.payerType ?? patient.payerType,
    paymentMethod: triage.paymentMethod ?? patient.paymentMethod,
    billingPerson: triage.billingPerson ?? patient.billingPerson,
    dependentName: triage.dependentName ?? patient.dependentName,
    dependentRelationship: triage.dependentRelationship ?? patient.dependentRelationship,
    dependentPhone: triage.dependentPhone ?? patient.dependentPhone,
    assignedClinician: triage.assignedClinician ?? patient.assignedClinician,
  } as any;

  // Check if patient is already triaged and in queue
  const alreadyTriaged = patientWithTriage.triage?.isTriaged && patientWithTriage.queueStatus;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Triage Assessment</h1>
        <p className="text-muted-foreground mt-2">
          Complete triage assessment for {patientWithTriage.fullName}
        </p>
      </div>

      {alreadyTriaged && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            This patient has already been triaged (Level {patientWithTriage.triage?.triageLevel}) and is currently in the queue.
            You can update the triage information below.
          </AlertDescription>
        </Alert>
      )}

      {/* Medical Alerts */}
      {(patientWithTriage.medicalHistory?.allergies?.length > 0 || patientWithTriage.medicalHistory?.conditions?.length > 0) && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="space-y-1">
            <div className="font-semibold">Medical Alerts:</div>
            {patientWithTriage.medicalHistory.allergies?.length > 0 && (
              <div>
                <span className="font-medium">Allergies:</span> {patientWithTriage.medicalHistory.allergies.join(", ")}
              </div>
            )}
            {patientWithTriage.medicalHistory.conditions?.length > 0 && (
              <div>
                <span className="font-medium">Conditions:</span> {patientWithTriage.medicalHistory.conditions.join(", ")}
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      <TriageForm patient={patientWithTriage} />
    </div>
  );
}
