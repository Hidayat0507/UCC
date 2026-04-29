export const dynamic = "force-dynamic";
export const metadata = {
  title: "Check-in",
};

import { getPatientFromMedplum } from "@/lib/fhir/patient-service";
import { notFound } from "next/navigation";
import TriageForm from "@/components/triage/triage-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { getTriageForPatient } from "@/lib/fhir/triage-service";
import { mergePatientWithTriageForCheckIn } from "@/lib/fhir/merge-check-in-patient";

interface CheckInPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ visitType?: string }>;
}

export default async function CheckInPage({ params, searchParams }: CheckInPageProps) {
  const { id } = await params;
  const { visitType } = await searchParams;
  const [patient, triage] = await Promise.all([
    getPatientFromMedplum(id),
    getTriageForPatient(id),
  ]);

  if (!patient) {
    notFound();
  }

  const patientWithTriage = mergePatientWithTriageForCheckIn(
    { ...patient } as Record<string, unknown>,
    triage,
    visitType
  );

  const inQueue = Boolean(patientWithTriage.queueStatus);
  const alreadyTriaged = inQueue || Boolean(patientWithTriage.triage?.isTriaged);

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Check-in</h1>
        <p className="mt-1 text-sm text-muted-foreground md:text-base">
          Reception and visit details for {patientWithTriage.fullName}
        </p>
      </div>

      {alreadyTriaged && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {inQueue ? (
              <>
                This patient is in the queue
                {patientWithTriage.triage?.triageLevel != null
                  ? ` (triage level ${patientWithTriage.triage.triageLevel})`
                  : ""}
                . You can update the information below.
              </>
            ) : (
              <>Triage was started for this patient. You can update the information below.</>
            )}
          </AlertDescription>
        </Alert>
      )}

      {(patientWithTriage.medicalHistory?.allergies?.length > 0 ||
        patientWithTriage.medicalHistory?.conditions?.length > 0) && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="space-y-1">
            <div className="font-semibold">Medical Alerts:</div>
            {patientWithTriage.medicalHistory.allergies?.length > 0 && (
              <div>
                <span className="font-medium">Allergies:</span>{" "}
                {patientWithTriage.medicalHistory.allergies.join(", ")}
              </div>
            )}
            {patientWithTriage.medicalHistory.conditions?.length > 0 && (
              <div>
                <span className="font-medium">Conditions:</span>{" "}
                {patientWithTriage.medicalHistory.conditions.join(", ")}
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      <TriageForm patient={patientWithTriage} />
    </div>
  );
}
