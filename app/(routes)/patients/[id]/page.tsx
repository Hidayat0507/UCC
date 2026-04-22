export const dynamic = 'force-dynamic';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Calendar, FileText, AlertCircle, User, Phone, Mail, Heart, Users, ClipboardList } from "lucide-react";
import Link from "next/link";
import { getPatientFromMedplum } from "@/lib/fhir/patient-service";
import { getPatientConsultationsFromMedplum } from "@/lib/fhir/consultation-service";
import { getPatientAppointmentsFromMedplum } from "@/lib/fhir/appointment-service";
import { getAdminMedplum } from "@/lib/server/medplum-admin";
import { formatDisplayDate, calculateAge, safeToISOString } from "@/lib/utils";
import ReferralMCSection from "./referral-mc-section";
import { Suspense } from 'react';
import { PatientCard } from "@/components/patients/patient-card";
import type { SerializedPatient } from "@/components/patients/patient-card";
import { LabResultsView } from "@/components/labs/lab-results-view";
import { ImagingResultsView } from "@/components/imaging/imaging-results-view";
import { notFound } from 'next/navigation';
import { getTriageForPatient } from "@/lib/fhir/triage-service";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import PatientDocuments from "@/components/patients/patient-documents";

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

  // Check for medical alerts based on INTERNAL data
  const hasAllergies = medicalHistory.allergies?.length > 0;
  const hasConditions = medicalHistory.conditions?.length > 0;
  const medicalAlert = hasAllergies || hasConditions;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">{patient.fullName}</h1>
        <div className="flex items-center gap-2">
          {/* Triage Button - Show if not triaged or not in queue */}
          {(!patient.triage?.isTriaged || !patient.queueStatus) && (
            <Button asChild variant="outline">
              <Link href={`/patients/${id}/triage`}>
                <ClipboardList className="mr-2 h-4 w-4" /> Triage
              </Link>
            </Button>
          )}
          {/* Add back New Consultation Button */}
          <Button asChild>
            <Link href={`/patients/${id}/consultation`}>
              <FileText className="mr-2 h-4 w-4" /> New Consultation
            </Link>
          </Button>
          {/* Add other actions like Edit Patient if needed */}
        </div>
      </div>

      {/* Display Medical Alert based on internal data */}
      {medicalAlert && (
        <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Medical Alert</AlertTitle>
            <AlertDescription>
            {hasAllergies && `Allergies: ${Array.isArray(medicalHistory.allergies) ? medicalHistory.allergies.join(', ') : medicalHistory.allergies}. `}
            {hasConditions && `Conditions: ${Array.isArray(medicalHistory.conditions) ? medicalHistory.conditions.join(', ') : medicalHistory.conditions}.`}
            </AlertDescription>
          </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-3">
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

        {/* Last Visit Card (using internal data) */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold">Last Visit</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">
              {patient.lastVisit ? formatDisplayDate(patient.lastVisit) : 'N/A'}
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
      </div>

      {/* Tabs Section */}
      <Tabs defaultValue="history">
        <TabsList>
          <TabsTrigger value="history">Consultation History</TabsTrigger>
          <TabsTrigger value="details">Patient Details</TabsTrigger>
          <TabsTrigger value="labs-imaging">Labs & Imaging</TabsTrigger>
          <TabsTrigger value="referral-mc">Referral / MC</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        {/* Consultation History Tab */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Consultation History</CardTitle>
              <CardDescription>
                Past consultations for {patient.fullName}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {consultations.length > 0 ? (
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
                    {consultations.map((consultation) => (
                      <TableRow key={consultation.id}>
                        <TableCell className="font-medium">
                          {formatDisplayDate(consultation.date)}
                        </TableCell>
                        <TableCell>
                          {'Consultation'}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {consultation.chiefComplaint}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {consultation.diagnosis}
                        </TableCell>
                        <TableCell>
                          {consultation.prescriptions?.length || 0} items
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" asChild>
                              <Link href={`/consultations/${consultation.id}`}>View</Link>
                            </Button>
                            <Button size="sm" asChild>
                              <Link href={`/consultations/${consultation.id}/edit`}>Edit</Link>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground">No consultation history found.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Patient Details Tab */}
        <TabsContent value="details">
          <Card>
            <CardHeader>
              <CardTitle>Contact & Personal Information</CardTitle>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center">
                  <Mail className="h-4 w-4 mr-2 text-muted-foreground" />
                  <span>{patient.email}</span>
                </div>
                <div className="flex items-center">
                  <Phone className="h-4 w-4 mr-2 text-muted-foreground" />
                  <span>{patient.phone}</span>
                </div>
                <div className="flex items-center">
                  <User className="h-4 w-4 mr-2 text-muted-foreground" />
                  <span>
                    {patient.gender} | Age: {patientAge !== null ? patientAge : "N/A"}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <p className="font-medium">Address</p>
                <p className="text-muted-foreground">
                  {patient.address}<br />
                  {patient.postalCode}
                </p>
              </div>
              <div className="space-y-2">
                <p className="font-medium">Emergency Contact</p>
                <div className="text-muted-foreground">
                  <p>{patient.emergencyContact?.name} ({patient.emergencyContact?.relationship})</p>
                  <p>{patient.emergencyContact?.phone}</p>
                </div>
              </div>
              <div className="space-y-2">
                <p className="font-medium">Medical History</p>
                <ul className="list-disc list-inside text-muted-foreground">
                  <li>Allergies: {Array.isArray(medicalHistory.allergies) && medicalHistory.allergies.length > 0 ? medicalHistory.allergies.join(', ') : 'None'}</li>
                  <li>Conditions: {Array.isArray(medicalHistory.conditions) && medicalHistory.conditions.length > 0 ? medicalHistory.conditions.join(', ') : 'None'}</li>
                  <li>Medications: {Array.isArray(medicalHistory.medications) && medicalHistory.medications.length > 0 ? medicalHistory.medications.join(', ') : 'None'}</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="labs-imaging">
          <div className="grid gap-4 lg:grid-cols-2">
            <LabResultsView patientId={id} />
            <ImagingResultsView patientId={id} />
          </div>
        </TabsContent>

        {/* Referral / MC Tab */}
        <TabsContent value="referral-mc">
          <Suspense fallback={<div>Loading form...</div>}>
            <ReferralMCSection patient={patient} />
          </Suspense>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents">
          {/* Client-side uploader and list */}
          <PatientDocuments patientId={id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
