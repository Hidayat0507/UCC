export const dynamic = 'force-dynamic';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Calendar, AlertCircle, ClipboardList, Pencil } from "lucide-react";
import Link from "next/link";
import { getPatientFromMedplum } from "@/lib/fhir/patient-service";
import { getPatientConsultationsFromMedplum } from "@/lib/fhir/consultation-service";
import { getPatientAppointmentsFromMedplum } from "@/lib/fhir/appointment-service";
import { getAdminMedplum } from "@/lib/server/medplum-admin";
import { formatDisplayDate, calculateAge, safeToISOString } from "@/lib/utils";
import { PatientCard } from "@/components/patients/patient-card";
import type { SerializedPatient } from "@/components/patients/patient-card";
import { notFound } from 'next/navigation';
import { getTriageForPatient } from "@/lib/fhir/triage-service";
import PatientProfileWorkspace from "./patient-profile-workspace";

interface PatientProfilePageProps {
  params: Promise<{ id: string }>;
}

export default async function PatientProfilePage({ params }: PatientProfilePageProps) {
  const { id } = await params;
  const medplum = await getAdminMedplum();

  // Fetch data in parallel from Medplum FHIR (source of truth)
  const [patientData, consultationsData, triageData, appointmentsData] = await Promise.all([
    getPatientFromMedplum(id), // 🎯 Read from Medplum FHIR
    getPatientConsultationsFromMedplum(id), // 🎯 Read from Medplum FHIR
    getTriageForPatient(id),
    getPatientAppointmentsFromMedplum(medplum, id),
  ]);

  if (!patientData) {
    notFound();
  }

  const medicalHistory = patientData.medicalHistory ?? {
    allergies: [],
    conditions: [],
    medications: [],
  };
  const vitals = triageData.triage?.vitalSigns;

  const upcomingAppointment = appointmentsData
    .filter((appointment) => {
      const scheduledAt = appointment.scheduledAt instanceof Date ? appointment.scheduledAt : new Date(appointment.scheduledAt);
      return (
        !Number.isNaN(scheduledAt.getTime()) &&
        scheduledAt.getTime() >= Date.now() &&
        ["booked", "arrived", "pending", "proposed"].includes(appointment.status)
      );
    })
    .sort((a, b) => {
      const aTime = new Date(a.scheduledAt).getTime();
      const bTime = new Date(b.scheduledAt).getTime();
      return aTime - bTime;
    })[0];

  // Serialize patient data
  const patient: SerializedPatient = {
    ...patientData,
    email: patientData.email ?? "",
    postalCode: patientData.postalCode ?? "",
    emergencyContact: patientData.emergencyContact ?? {
      name: "",
      relationship: "",
      phone: "",
    },
    medicalHistory,
    triage: triageData.triage as any,
    queueStatus: triageData.queueStatus ?? null,
    dateOfBirth: safeToISOString(patientData.dateOfBirth),
    lastVisit: safeToISOString((patientData as any).lastVisit),
    upcomingAppointment: safeToISOString(upcomingAppointment?.scheduledAt) ?? safeToISOString((patientData as any).upcomingAppointment),
    // Add other potential date/timestamp fields here if they exist on Patient model
    createdAt: safeToISOString((patientData as any).createdAt),
    updatedAt: safeToISOString((patientData as any).updatedAt),
    queueAddedAt: safeToISOString(triageData.queueAddedAt ?? null),
  };

  const patientAge = calculateAge(patient.dateOfBirth);

  // Serialize consultations data
  const consultations = consultationsData.map(consultation => ({
    ...consultation,
    date: safeToISOString(consultation.date),
    // Add other potential date/timestamp fields here if they exist on Consultation model
  }));

  const hasAllergies = medicalHistory.allergies?.length > 0;
  const medicalAlert = hasAllergies;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold tracking-tight">{patient.fullName}</h1>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button asChild variant="outline">
            <Link href={`/patients/${id}/check-in`}>
              <ClipboardList className="mr-2 h-4 w-4" /> Check-in
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/patients/${id}/edit`}>
              <Pencil className="mr-2 h-4 w-4" /> Edit Patient
            </Link>
          </Button>
        </div>
      </div>

      {/* Display Medical Alert based on internal data */}
      {medicalAlert && (
        <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Medical Alert</AlertTitle>
            <AlertDescription>
            {`Allergies: ${Array.isArray(medicalHistory.allergies) ? medicalHistory.allergies.join(', ') : medicalHistory.allergies}.`}
            </AlertDescription>
          </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[180px_minmax(0,1fr)]">
        <aside className="space-y-4">
          {/* Internal Patient Card */}
          <PatientCard patient={patient} />

          {/* Latest Vitals */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Latest Vitals</CardTitle>
              <CardDescription>From last triage (if available)</CardDescription>
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

          {/* Upcoming Appointment Card (using internal data) */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Upcoming Appointment</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold">
                {patient.upcomingAppointment ? formatDisplayDate(patient.upcomingAppointment) : 'None'}
              </div>
              {/* Optionally add time if available */}
            </CardContent>
          </Card>
        </aside>

        <PatientProfileWorkspace
          patientId={id}
          patient={patient}
          consultations={consultations}
          patientAge={patientAge}
          medicalHistory={medicalHistory}
        />
      </div>
    </div>
  );
}
