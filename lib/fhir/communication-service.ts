import type { MedplumClient } from "@medplum/core";
import type { Communication } from "@medplum/fhirtypes";

const FOLLOW_UP_CATEGORY_SYSTEM = "https://ucc.emr/communication-category";
const CLINIC_ID_EXTENSION_URL = "https://ucc.emr/communication/clinic-id";
const DUE_DATE_EXTENSION_URL = "https://ucc.emr/communication/due-date";
const PATIENT_NAME_EXTENSION_URL = "https://ucc.emr/communication/patient-name";

export type FollowUpType = "review-request" | "appointment-reminder";
export type FollowUpStatus = "preparation" | "in-progress" | "completed" | "stopped";

export interface CreateFollowUpInput {
  patientId?: string;
  patientName: string;
  clinicId: string;
  type: FollowUpType;
  message: string;
  dueDate?: string;
}

export interface FollowUp {
  id: string;
  patientId: string;
  patientName: string;
  type: FollowUpType;
  message: string;
  dueDate?: string;
  status: FollowUpStatus;
  createdAt: string;
  clinicId: string;
}

export function getFollowUpClinicId(comm: Communication): string {
  return comm.extension?.find((e) => e.url === CLINIC_ID_EXTENSION_URL)?.valueString ?? "";
}

function getExtensionString(comm: Communication, url: string): string {
  return comm.extension?.find((e) => e.url === url)?.valueString ?? "";
}

function getExtensionDateTime(comm: Communication, url: string): string | undefined {
  return comm.extension?.find((e) => e.url === url)?.valueDateTime ?? undefined;
}

function mapCommunicationToFollowUp(comm: Communication): FollowUp {
  const type = (comm.category?.[0]?.coding?.[0]?.code ?? "review-request") as FollowUpType;
  const status = (comm.status ?? "preparation") as FollowUpStatus;
  const patientName =
    getExtensionString(comm, PATIENT_NAME_EXTENSION_URL) || comm.subject?.display || "";
  const patientId = comm.subject?.reference?.replace("Patient/", "") ?? "";
  const message = comm.payload?.[0]?.contentString ?? "";
  const dueDate = getExtensionDateTime(comm, DUE_DATE_EXTENSION_URL);
  const clinicId = getExtensionString(comm, CLINIC_ID_EXTENSION_URL);
  const createdAt = comm.meta?.lastUpdated ?? new Date().toISOString();

  return { id: comm.id!, patientId, patientName, type, message, dueDate, status, createdAt, clinicId };
}

export async function createFollowUp(
  medplum: MedplumClient,
  input: CreateFollowUpInput
): Promise<FollowUp> {
  const comm: Communication = {
    resourceType: "Communication",
    status: "preparation",
    category: [
      {
        coding: [
          {
            system: FOLLOW_UP_CATEGORY_SYSTEM,
            code: input.type,
            display: input.type === "review-request" ? "Review Request" : "Appointment Reminder",
          },
        ],
      },
    ],
    subject: {
      reference: input.patientId ? `Patient/${input.patientId}` : undefined,
      display: input.patientName,
    },
    payload: [{ contentString: input.message }],
    extension: [
      { url: CLINIC_ID_EXTENSION_URL, valueString: input.clinicId },
      { url: PATIENT_NAME_EXTENSION_URL, valueString: input.patientName },
      ...(input.dueDate ? [{ url: DUE_DATE_EXTENSION_URL, valueDateTime: input.dueDate }] : []),
    ],
  };

  const saved = await medplum.createResource(comm);
  return mapCommunicationToFollowUp(saved as Communication);
}

export async function getPatientFollowUps(
  medplum: MedplumClient,
  patientId: string
): Promise<FollowUp[]> {
  const results = await medplum.searchResources("Communication", {
    subject: `Patient/${patientId}`,
    _sort: "-_lastUpdated",
    _count: "100",
  });
  return (results as Communication[]).map(mapCommunicationToFollowUp);
}

export async function getAllFollowUps(
  medplum: MedplumClient,
  clinicId?: string
): Promise<FollowUp[]> {
  const results = await medplum.searchResources("Communication", {
    _sort: "-_lastUpdated",
    _count: "200",
  });
  const followUps = (results as Communication[])
    .filter((c) => c.category?.[0]?.coding?.[0]?.system === FOLLOW_UP_CATEGORY_SYSTEM)
    .map(mapCommunicationToFollowUp);
  if (!clinicId) return followUps;
  return followUps.filter((f) => f.clinicId === clinicId);
}

export async function updateFollowUpStatus(
  medplum: MedplumClient,
  id: string,
  status: FollowUpStatus
): Promise<FollowUp> {
  const comm = (await medplum.readResource("Communication", id)) as Communication;
  const updated = await medplum.updateResource({
    ...comm,
    status,
    ...(status === "completed" ? { sent: new Date().toISOString() } : {}),
  });
  return mapCommunicationToFollowUp(updated as Communication);
}

export async function deleteFollowUp(medplum: MedplumClient, id: string): Promise<void> {
  await medplum.deleteResource("Communication", id);
}
