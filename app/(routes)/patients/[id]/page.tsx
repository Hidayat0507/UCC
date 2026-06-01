export const dynamic = 'force-dynamic';

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardList, Pencil, Phone } from "lucide-react";
import Link from "next/link";
import { getPatientFromMedplum } from "@/lib/fhir/patient-service";
import { getPatientConsultationsFromMedplum } from "@/lib/fhir/consultation-service";
import { getPatientAppointmentsFromMedplum } from "@/lib/fhir/appointment-service";
import { getAdminMedplum } from "@/lib/server/medplum-admin";
import { formatDisplayDate, calculateAge, safeToISOString } from "@/lib/utils";
import type { SerializedPatient } from "@/components/patients/patient-card";
import { notFound } from 'next/navigation';
import { getTriageForPatient } from "@/lib/fhir/triage-service";
import PatientProfileWorkspace from "./patient-profile-workspace";

function getCurrentTimestamp(): number {
  return Date.now();
}

interface PatientProfilePageProps {
  params: Promise<{ id: string }>;
}

export default async function PatientProfilePage({ params }: PatientProfilePageProps) {
  const { id } = await params;
  const medplum = await getAdminMedplum();

  // Fetch data in parallel from Medplum FHIR (source of truth)
  const [patientData, consultationsData, triageData, appointmentsData] = await Promise.all([
    getPatientFromMedplum(id),
    getPatientConsultationsFromMedplum(id),
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
  const nowMs = getCurrentTimestamp();

  const upcomingAppointment = appointmentsData
    .filter((appointment) => {
      const scheduledAt = appointment.scheduledAt instanceof Date ? appointment.scheduledAt : new Date(appointment.scheduledAt);
      return (
        !Number.isNaN(scheduledAt.getTime()) &&
        scheduledAt.getTime() >= nowMs &&
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
    createdAt: safeToISOString((patientData as any).createdAt),
    updatedAt: safeToISOString((patientData as any).updatedAt),
    queueAddedAt: safeToISOString(triageData.queueAddedAt ?? null),
  };

  const patientAge = calculateAge(patient.dateOfBirth);

  // Serialize consultations data
  const consultations = consultationsData.map(consultation => ({
    ...consultation,
    date: safeToISOString(consultation.date),
  }));

  const realAllergies = (medicalHistory.allergies ?? []).filter(
    (a) => !/^no known/i.test(a.trim())
  );
  const medicalAlert = realAllergies.length > 0;

  const initials = patient.fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0].toUpperCase())
    .join("");

  const ec = patient.emergencyContact;
  const hasEmergencyContact = Boolean(ec?.name?.trim() || ec?.phone?.trim());

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <p className="text-sm text-muted-foreground">
        <Link href="/patients" className="hover:text-foreground transition-colors">Patients</Link>
        {" / "}
        <span>{patient.fullName}</span>
      </p>

      {/* Banner card */}
      <Card className="bg-muted/30 border rounded-xl">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-4">
            {/* Left: avatar + name + info row */}
            <div className="flex items-start gap-4 min-w-0">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground text-xl font-semibold">
                {initials}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-semibold text-foreground leading-tight">{patient.fullName}</h1>
                  {!patient.lastVisit && (
                    <Badge variant="secondary" className="text-[11px]">New patient</Badge>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-[auto_auto_auto_auto] gap-x-6 gap-y-1 text-sm mt-2">
                  <span className="text-muted-foreground">IC number</span>
                  <span className="font-medium">{patient.nric || "—"}</span>
                  <span className="text-muted-foreground">Phone</span>
                  <span className="font-medium">{patient.phone || "—"}</span>

                  <span className="text-muted-foreground">Age</span>
                  <span className="font-medium">{patientAge !== null ? `${patientAge} years` : "—"}</span>
                  <span className="text-muted-foreground">Email</span>
                  <span className="font-medium">{patient.email || "N/A"}</span>

                  <span className="text-muted-foreground">Gender</span>
                  <span className="font-medium capitalize">{patient.gender || "—"}</span>
                  <span className="text-muted-foreground">Date of birth</span>
                  <span className="font-medium">{patient.dateOfBirth ? formatDisplayDate(patient.dateOfBirth) : "—"}</span>
                </div>
              </div>
            </div>

            {/* Right: action buttons */}
            <div className="flex gap-2 flex-wrap justify-end shrink-0">
              <Button asChild size="sm" variant="outline">
                <Link href={`/patients/${id}/check-in`}>
                  <ClipboardList className="mr-2 h-4 w-4" />
                  Check-in
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href={`/patients/${id}/edit`}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit patient
                </Link>
              </Button>
            </div>
          </div>

          {/* Stat row */}
          <div className="mt-4 border-t border-border pt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Last completed visit</p>
              <p className="mt-0.5 font-medium">
                {patient.lastVisit ? formatDisplayDate(patient.lastVisit) : "No visits yet"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total visits</p>
              <p className="mt-0.5 font-medium">{consultations.length}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Upcoming appointment</p>
              <p className="mt-0.5 font-medium">
                {patient.upcomingAppointment ? formatDisplayDate(patient.upcomingAppointment) : "None scheduled"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Medical alert</p>
              {medicalAlert ? (
                <div className="mt-0.5 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-destructive inline-block shrink-0" />
                  <span className="text-destructive font-medium truncate text-sm">
                    {realAllergies.slice(0, 2).join(", ")}
                    {realAllergies.length > 2 ? ` +${realAllergies.length - 2} more` : ""}
                  </span>
                </div>
              ) : (
                <div className="mt-0.5 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-500 inline-block shrink-0" />
                  <span className="text-muted-foreground">None</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main content */}
      <div className="flex gap-6 items-start">
        {/* Left sidebar */}
        <aside className="w-[220px] shrink-0 sticky top-6 space-y-4">
          {/* Latest vitals */}
          <Card>
            <CardHeader className="px-4 pt-4 pb-2">
              <CardTitle className="text-sm font-medium">
                Latest vitals
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 grid grid-cols-2 gap-2">
              {[
                {
                  label: "BP",
                  value: vitals?.bloodPressureSystolic && vitals?.bloodPressureDiastolic
                    ? `${vitals.bloodPressureSystolic}/${vitals.bloodPressureDiastolic}`
                    : "—",
                },
                {
                  label: "HR",
                  value: vitals?.heartRate ? `${vitals.heartRate} bpm` : "—",
                },
                {
                  label: "Temp",
                  value: vitals?.temperature ? `${vitals.temperature} °C` : "—",
                },
                {
                  label: "SpO₂",
                  value: vitals?.oxygenSaturation ? `${vitals.oxygenSaturation}%` : "—",
                },
                {
                  label: "Weight",
                  value: vitals?.weight ? `${vitals.weight} kg` : "—",
                },
                {
                  label: "Height",
                  value: vitals?.height ? `${vitals.height} cm` : "—",
                },
              ].map(({ label, value }) => (
                <div key={label} className="bg-muted rounded-md p-2 text-center">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-sm font-medium mt-0.5">{value}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Emergency contact */}
          <Card>
            <CardHeader className="px-4 pt-4 pb-2">
              <CardTitle className="text-sm font-medium">
                Emergency contact
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {hasEmergencyContact ? (
                <div className="space-y-1 text-sm">
                  <p className="font-medium">{ec?.name || "—"}</p>
                  {ec?.relationship && (
                    <p className="text-xs text-muted-foreground capitalize">{ec.relationship}</p>
                  )}
                  {ec?.phone && (
                    <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                      <Phone className="h-3 w-3" />
                      {ec.phone}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Not recorded</p>
              )}
            </CardContent>
          </Card>
        </aside>

        {/* Right: tabs workspace */}
        <div className="flex-1 min-w-0">
          <PatientProfileWorkspace
            patientId={id}
            patient={patient}
            consultations={consultations}
            patientAge={patientAge}
            medicalHistory={medicalHistory}
          />
        </div>
      </div>
    </div>
  );
}
