import { db } from "./firebase";
import {
  Timestamp,
  addDoc,
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
} from "firebase/firestore";
import { safeToISOString } from "./utils";
import { QueueStatus, BillableConsultation, TriageData } from "./types";
import { getAllPatientsFromMedplum, getPatientFromMedplum, getMedplumClient } from "./fhir/patient-service";
import {
  getTriageQueueForToday,
  getTriageForPatient,
  saveTriageEncounter,
  updateQueueStatusForPatient,
  updateTriageEncounter,
  checkInPatientInTriage,
} from "./fhir/triage-service";
import { getPatientConsultationsFromMedplum, getConsultationFromMedplum, saveConsultationToMedplum } from "./fhir/consultation-service";
import {
  getPatientReferralsFromMedplum,
  getReferralFromMedplum,
  saveReferralToMedplum,
  updateReferralInMedplum,
} from "./fhir/referral-service";

export interface Patient {
  id: string;
  fullName: string;
  nric: string;
  dateOfBirth: Date | string;
  gender: "male" | "female" | "other";
  email: string;
  phone: string;
  address: string;
  postalCode: string;
  lastVisit?: Date | string;
  upcomingAppointment?: Date | string;
  emergencyContact: {
    name: string;
    relationship: string;
    phone: string;
  };
  medicalHistory: {
    allergies: string[];
    conditions: string[];
    medications: string[];
  };
  createdAt: Date | string;
  updatedAt?: Date | string;
  queueStatus?: QueueStatus;
  queueAddedAt?: Date | string | null;
  triage?: TriageData;
}

export interface Consultation {
  id?: string;
  patientId: string;
  date: Date;
  type?: string;
  doctor?: string;
  chiefComplaint?: string;
  diagnosis: string;
  procedures: ProcedureRecord[];
  notes?: string;
  progressNote?: string;
  prescriptions: Prescription[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ProcedureRecord {
  name: string;
  price?: number;
  notes?: string;
  procedureId?: string;
  codingSystem?: string;
  codingCode?: string;
  codingDisplay?: string;
}

export interface Prescription {
  medication: {
    id: string;
    name: string;
    strength?: string;
  };
  frequency: string;
  duration: string;
  expiryDate?: string;
  price?: number;
}

export type AppointmentStatus =
  | "scheduled"
  | "checked_in"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "no_show";

export interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  patientContact?: string;
  clinician: string;
  reason: string;
  type?: string;
  location?: string;
  notes?: string;
  status: AppointmentStatus;
  scheduledAt: Date | string;
  durationMinutes?: number;
  createdAt: Date | string;
  updatedAt?: Date | string;
  checkInTime?: Date | string | null;
  completedAt?: Date | string | null;
  cancelledAt?: Date | string | null;
}

const PATIENTS = "patients";
const CONSULTATIONS = "consultations";
const PATIENT_DOCUMENTS = "documents";

type TimestampInput = Timestamp | Date | string | null | undefined;

type DocWithData = {
  id: string;
  data(): DocumentData | undefined;
};

const TIMESTAMP_FIELDS = [
  "createdAt",
  "updatedAt",
  "date",
  "lastVisit",
  "upcomingAppointment",
  "dateOfBirth",
  "queueAddedAt",
  "scheduledAt",
  "checkInTime",
  "completedAt",
  "cancelledAt",
] as const;

function coerceDate(value: TimestampInput): Date | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (value instanceof Timestamp) {
    return value.toDate();
  }

  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

function convertTimestamps(data: DocumentData): DocumentData {
  const result: Record<string, unknown> = { ...data };

  for (const field of TIMESTAMP_FIELDS) {
    if (!(field in result)) {
      continue;
    }

    const value = result[field];
    if (value === null || value === undefined || value === "") {
      continue;
    }

    const coerced = coerceDate(value as TimestampInput);
    result[field] = coerced ?? null;
  }

  return result;
}

function mapDocument<T>(doc: DocWithData): T {
  const data = doc.data() ?? {};
  return { id: doc.id, ...convertTimestamps(data) } as T;
}

function toIsoIfPossible(value: Date | string | null | undefined) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "string") {
    return safeToISOString(value) ?? value;
  }

  return value;
}

function getApiBaseUrl() {
  if (typeof window !== "undefined") {
    return "";
  }
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000";
  return baseUrl.replace(/\/$/, "");
}

function normalizeAppointmentDates(appointment: Appointment): Appointment {
  return {
    ...appointment,
    scheduledAt: coerceDate(appointment.scheduledAt) ?? appointment.scheduledAt,
    createdAt: coerceDate(appointment.createdAt) ?? appointment.createdAt,
    updatedAt: coerceDate(appointment.updatedAt) ?? appointment.updatedAt,
    checkInTime: coerceDate(appointment.checkInTime) ?? appointment.checkInTime,
    completedAt: coerceDate(appointment.completedAt) ?? appointment.completedAt,
    cancelledAt: coerceDate(appointment.cancelledAt) ?? appointment.cancelledAt,
  };
}

function serializeQueuePatient(patient: Patient): Patient {
  return {
    ...patient,
    createdAt: toIsoIfPossible(patient.createdAt) ?? patient.createdAt,
    updatedAt: toIsoIfPossible(patient.updatedAt) ?? patient.updatedAt,
    queueAddedAt: toIsoIfPossible(patient.queueAddedAt) ?? patient.queueAddedAt ?? null,
    dateOfBirth: toIsoIfPossible(patient.dateOfBirth) ?? patient.dateOfBirth,
    lastVisit: toIsoIfPossible(patient.lastVisit) ?? patient.lastVisit,
    upcomingAppointment: toIsoIfPossible(patient.upcomingAppointment) ?? patient.upcomingAppointment,
  };
}

export async function getPatients(): Promise<Patient[]> {
  const patients = await getAllPatientsFromMedplum(300);
  const enriched = await Promise.all(
    patients.map(async (p) => {
      const triage = await getTriageForPatient(p.id);
      return {
        ...(p as any),
        triage: triage.triage,
        queueStatus: triage.queueStatus ?? null,
        queueAddedAt: triage.queueAddedAt ?? null,
      } as Patient;
    })
  );
  return enriched;
}

export async function getPatientById(id: string): Promise<Patient | null> {
  const [patient, triage] = await Promise.all([
    getPatientFromMedplum(id),
    getTriageForPatient(id),
  ]);
  if (!patient) return null;
  return {
    ...(patient as any),
    triage: triage.triage,
    queueStatus: triage.queueStatus ?? null,
    queueAddedAt: triage.queueAddedAt ?? null,
  } as Patient;
}

export async function createPatient(data: Omit<Patient, "id" | "createdAt" | "updatedAt">): Promise<string> {
  // Use Medplum as ONLY source of truth
  const { savePatientToMedplum } = await import('@/lib/fhir/patient-service');
  
  const patientData = {
    fullName: data.fullName,
    nric: data.nric,
    dateOfBirth: data.dateOfBirth,
    gender: data.gender,
    email: data.email || '',
    phone: data.phone,
    address: data.address,
    postalCode: data.postalCode,
    emergencyContact: data.emergencyContact,
    medicalHistory: data.medicalHistory,
  };
  
  // Save directly to Medplum (source of truth)
  const medplumId = await savePatientToMedplum(patientData);
  
  console.log(`✅ Patient created in Medplum: ${medplumId}`);
  return medplumId;
}

export async function getAppointments(statuses?: AppointmentStatus[]): Promise<Appointment[]> {
  const params = new URLSearchParams();
  if (statuses && statuses.length > 0) {
    params.set("status", statuses.join(","));
  }
  const queryString = params.toString();
  const baseUrl = getApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/appointments${queryString ? `?${queryString}` : ""}`, {
    cache: "no-store",
  });
  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error || "Failed to load appointments");
  }

  return (data.appointments as Appointment[]).map((appointment) => normalizeAppointmentDates(appointment));
}

export async function getAppointmentById(id: string): Promise<Appointment | null> {
  const baseUrl = getApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/appointments?id=${encodeURIComponent(id)}`, {
    cache: "no-store",
  });
  const data = await response.json();

  if (response.status === 404) {
    return null;
  }

  if (!response.ok || !data.success) {
    throw new Error(data.error || "Failed to get appointment");
  }

  return normalizeAppointmentDates(data.appointment as Appointment);
}

export interface CreateAppointmentInput {
  patientId: string;
  patientName: string;
  patientContact?: string;
  clinician: string;
  reason: string;
  type?: string;
  location?: string;
  notes?: string;
  scheduledAt: Date | string;
  durationMinutes?: number;
  status?: AppointmentStatus;
}

export async function createAppointment(appointment: CreateAppointmentInput): Promise<string> {
  const baseUrl = getApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/appointments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...appointment,
      status: appointment.status ?? "scheduled",
    }),
  });
  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error || "Failed to save appointment");
  }

  return data.appointmentId as string;
}

export async function updateAppointment(id: string, data: Partial<Appointment>): Promise<void> {
  const baseUrl = getApiBaseUrl();
  const payload: Record<string, unknown> = {
    appointmentId: id,
  };

  if (data.status) {
    payload.status = data.status;
  }
  if (data.checkInTime !== undefined) {
    payload.checkInTime = toIsoIfPossible(data.checkInTime as Date | string | null | undefined);
  }
  if (data.completedAt !== undefined) {
    payload.completedAt = toIsoIfPossible(data.completedAt as Date | string | null | undefined);
  }
  if (data.cancelledAt !== undefined) {
    payload.cancelledAt = toIsoIfPossible(data.cancelledAt as Date | string | null | undefined);
  }

  const response = await fetch(`${baseUrl}/api/appointments`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const dataResponse = await response.json();

  if (!response.ok || !dataResponse.success) {
    throw new Error(dataResponse.error || "Failed to update appointment");
  }
}

export async function getConsultationsByPatientId(patientId: string): Promise<Consultation[]> {
  const consultations = await getPatientConsultationsFromMedplum(patientId);
  return consultations as unknown as Consultation[];
}

export async function getConsultationById(id: string): Promise<Consultation | null> {
  const consultation = await getConsultationFromMedplum(id);
  return (consultation as unknown as Consultation) ?? null;
}

export async function createConsultation(
  consultation: Omit<Consultation, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  const patient = await getPatientFromMedplum(consultation.patientId);
  if (!patient) {
    throw new Error("Patient not found in Medplum");
  }

  const encounterId = await saveConsultationToMedplum(
    {
      patientId: consultation.patientId,
      chiefComplaint: consultation.chiefComplaint,
      diagnosis: consultation.diagnosis,
      procedures: consultation.procedures,
      notes: consultation.notes,
      progressNote: (consultation as any).progressNote,
      prescriptions: consultation.prescriptions as any,
      date: consultation.date,
    },
    {
      id: patient.id,
      name: (patient as any).fullName || (patient as any).name || "",
      ic: (patient as any).nric || "",
      dob:
        patient.dateOfBirth instanceof Date
          ? patient.dateOfBirth
          : new Date((patient as any).dateOfBirth),
      gender: (patient as any).gender,
      phone: (patient as any).phone,
      address: (patient as any).address,
    }
  );

  return encounterId;
}

export async function updateConsultation(id: string, data: Partial<Consultation>): Promise<void> {
  const medplum = await getMedplumClient();

  // For now, support updating notes/progress via an Observation amendment.
  if (data.notes) {
    await medplum.createResource({
      resourceType: 'Observation',
      status: 'final',
      encounter: { reference: `Encounter/${id}` },
      code: {
        coding: [{ system: 'http://loinc.org', code: '48767-8', display: 'Clinical note' }],
        text: 'Clinical Notes',
      },
      valueString: data.notes,
      effectiveDateTime: new Date().toISOString(),
    });
  }
}

export async function getTodaysQueue(): Promise<Patient[]> {
  return getTriagedPatientsQueue();
}

export async function addPatientToQueue(patientId: string): Promise<void> {
  await updateQueueStatusForPatient(patientId, "waiting");
}

export async function removePatientFromQueue(patientId: string): Promise<void> {
  await updateQueueStatusForPatient(patientId, null);
}

export async function updateQueueStatus(patientId: string, status: QueueStatus): Promise<void> {
  await updateQueueStatusForPatient(patientId, status);
}

export async function getConsultationsWithDetails(statuses: QueueStatus[]): Promise<BillableConsultation[]> {
  try {
    const validStatuses = statuses.filter((status): status is Exclude<QueueStatus, null> => Boolean(status));
    if (validStatuses.length === 0) {
      return [];
    }

    const medplum = await getMedplumClient();
    let encounters: any[] = [];
    let searchUrl: string | undefined;

    do {
      const page = await medplum.searchResources<any>('Encounter', {
        status: 'triaged,in-progress,finished',
        _count: '100',
        _sort: '-date',
        ...(searchUrl ? { _url: searchUrl } : {}),
      } as any);

      encounters = encounters.concat(page ?? []);

      // Medplum search pages include next link in page.links
      const nextLink = (page as any)?.[Symbol.iterator] ? undefined : (page as any)?.links?.find((l: any) => l.relation === 'next');
      searchUrl = nextLink?.url;
    } while (searchUrl);

    const parseQueueStatus = (enc: any): { queueStatus: QueueStatus; queueAddedAt?: string | null } => {
      const ext = (enc.extension || []).find((e: any) => e.url === 'https://ucc.emr/triage-encounter');
      const getSub = (key: string) => ext?.extension?.find((e: any) => e.url === key);
      const queueStatus = (getSub('queueStatus')?.valueString as QueueStatus) ?? null;
      const queueAddedAt = getSub('queueAddedAt')?.valueDateTime ?? enc.period?.start ?? null;
      return {
        queueStatus:
          queueStatus ??
          (enc.status === 'triaged'
            ? 'waiting'
            : enc.status === 'in-progress'
            ? 'in_consultation'
            : enc.status === 'finished'
            ? 'completed'
            : null),
        queueAddedAt,
      };
    };

    const consultations = (
      await Promise.all(
        encounters.map(async (enc: any) => {
          const { queueStatus } = parseQueueStatus(enc);
          if (!queueStatus || !validStatuses.includes(queueStatus)) {
            return null;
          }

          const consultation = await getConsultationFromMedplum(enc.id);
          if (!consultation) return null;
          const patientId = enc.subject?.reference?.replace('Patient/', '') || consultation.patientId;
          if (!patientId) return null;

          const patient = await getPatientFromMedplum(patientId);

          return {
            id: consultation.id,
            patientId,
            patientFullName: patient?.fullName ?? consultation.patientName ?? '',
            queueStatus,
            date: safeToISOString((consultation as any).date) ?? null,
            createdAt: safeToISOString((consultation as any).createdAt) ?? null,
            updatedAt: safeToISOString((consultation as any).updatedAt) ?? null,
            type: (consultation as any).type,
            doctor: (consultation as any).doctor,
            chiefComplaint: (consultation as any).chiefComplaint,
            diagnosis: (consultation as any).diagnosis,
            procedures: (consultation as any).procedures,
            notes: (consultation as any).notes,
            prescriptions: (consultation as any).prescriptions,
          } satisfies BillableConsultation;
        })
      )
    ).filter((c): c is BillableConsultation => Boolean(c));

    return consultations.sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      return dateB - dateA;
    });
  } catch (error) {
    console.error("Error in getConsultationsWithDetails:", error);
    return [];
  }
}

export interface Referral {
  id?: string;
  patientId: string;
  date: Date;
  specialty: string;
  facility: string;
  department?: string;
  doctorName?: string;
  urgency?: "routine" | "urgent" | "stat" | "asap";
  reason?: string;
  clinicalInfo?: string;
  letterText?: string;
  status?: "draft" | "active" | "on-hold" | "revoked" | "completed" | "entered-in-error" | "unknown";
  createdAt?: Date;
  updatedAt?: Date;
}

export async function createReferral(referral: Omit<Referral, "id" | "createdAt" | "updatedAt">): Promise<string> {
  const now = new Date();
  const date = referral.date ?? now;

  return saveReferralToMedplum({
    patientId: referral.patientId,
    specialty: referral.specialty,
    facility: referral.facility,
    department: referral.department,
    doctorName: referral.doctorName,
    urgency: referral.urgency,
    reason: referral.reason,
    clinicalInfo: referral.clinicalInfo,
    letterText: referral.letterText,
    date,
  });
}

export async function getReferralsByPatientId(patientId: string): Promise<Referral[]> {
  const referrals = await getPatientReferralsFromMedplum(patientId);
  return referrals.map((referral) => ({
    id: referral.id,
    patientId: referral.patientId,
    date: referral.date instanceof Date ? referral.date : new Date(referral.date),
    specialty: referral.specialty,
    facility: referral.facility,
    department: referral.department,
    doctorName: referral.doctorName,
    urgency: referral.urgency as Referral["urgency"],
    reason: referral.reason,
    clinicalInfo: referral.clinicalInfo,
    letterText: referral.letterText,
    status: referral.status,
    createdAt: referral.createdAt,
  }));
}

export async function getReferralById(id: string): Promise<Referral | null> {
  const referral = await getReferralFromMedplum(id);
  if (!referral) {
    return null;
  }
  return {
    id: referral.id,
    patientId: referral.patientId,
    date: referral.date instanceof Date ? referral.date : new Date(referral.date),
    specialty: referral.specialty,
    facility: referral.facility,
    department: referral.department,
    doctorName: referral.doctorName,
    urgency: referral.urgency as Referral["urgency"],
    reason: referral.reason,
    clinicalInfo: referral.clinicalInfo,
    letterText: referral.letterText,
    status: referral.status,
    createdAt: referral.createdAt,
  };
}

export async function updateReferral(id: string, data: Partial<Referral>): Promise<void> {
  await updateReferralInMedplum(id, {
    patientId: data.patientId,
    specialty: data.specialty,
    facility: data.facility,
    department: data.department,
    doctorName: data.doctorName,
    urgency: data.urgency,
    reason: data.reason,
    clinicalInfo: data.clinicalInfo,
    letterText: data.letterText,
    date: data.date,
    status: data.status,
  });
}

export interface PatientDocument {
  id: string;
  fileName: string;
  contentType: string;
  size: number;
  storagePath: string;
  downloadUrl: string;
  uploadedAt: Date | string;
  uploadedBy?: string | null;
}

export async function getPatientDocuments(patientId: string): Promise<PatientDocument[]> {
  const documentsCollection = collection(db, PATIENTS, patientId, PATIENT_DOCUMENTS);
  const snapshot = await getDocs(documentsCollection);
  return snapshot.docs.map((docSnap) => mapDocument<PatientDocument>(docSnap));
}

export async function getAllPatientDocuments(): Promise<(PatientDocument & { patientId: string })[]> {
  const snapshot = await getDocs(collectionGroup(db, PATIENT_DOCUMENTS));
  return snapshot.docs.map((docSnap) => {
    const document = mapDocument<PatientDocument>(docSnap);
    const segments = docSnap.ref.path.split("/");
    const patientId = segments.length >= 2 ? segments[1] : "";
    return { ...document, patientId };
  });
}

// Triage Functions
export async function triagePatient(patientId: string, triageData: Omit<TriageData, 'triageAt' | 'isTriaged'>): Promise<void> {
  await saveTriageEncounter(patientId, triageData);
}

export async function updateTriageData(patientId: string, triageData: Partial<TriageData>): Promise<void> {
  await updateTriageEncounter(patientId, triageData);
}

export async function getTriagedPatientsQueue(): Promise<Patient[]> {
  const patients = await getTriageQueueForToday();
  return patients as unknown as Patient[];
}

export async function checkInPatient(patientId: string, chiefComplaint?: string): Promise<string> {
  return checkInPatientInTriage(patientId, chiefComplaint);
}
