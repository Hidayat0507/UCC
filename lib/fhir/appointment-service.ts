/**
 * Appointment Service - Medplum FHIR as Source of Truth
 */

import { MedplumClient, OperationOutcomeError, getStatus } from '@medplum/core';
import type { Appointment as FHIRAppointment } from '@medplum/fhirtypes';

/** Relative `Patient/id` or absolute server URL ending with `Patient/id`. */
function patientIdFromActorReference(ref: string | undefined): string {
  if (!ref) return '';
  const m = ref.match(/Patient\/([^/?#]+)/i);
  return m?.[1]?.trim() ?? '';
}

function isPatientParticipantReference(ref: string | undefined): boolean {
  return patientIdFromActorReference(ref).length > 0;
}

export interface AppointmentData {
  patientId: string;
  patientName: string;
  patientContact?: string;
  clinician: string;
  reason: string;
  type?: string;
  location?: string;
  notes?: string;
  status: 'proposed' | 'pending' | 'booked' | 'arrived' | 'fulfilled' | 'cancelled' | 'noshow';
  scheduledAt: Date | string;
  durationMinutes?: number;
}

export interface SavedAppointment extends AppointmentData {
  id: string;
  createdAt: Date;
  checkinAt?: string;
  completedAt?: string;
  cancelledAt?: string;
}

const EXT_CHECKIN   = 'urn:iatrum:appointment/checkin-at';
const EXT_COMPLETED = 'urn:iatrum:appointment/completed-at';
const EXT_CANCELLED = 'urn:iatrum:appointment/cancelled-at';

/**
 * Save appointment to Medplum
 */
export async function saveAppointmentToMedplum(medplum: MedplumClient, appointmentData: AppointmentData): Promise<string> {
  const scheduledTime = typeof appointmentData.scheduledAt === 'string'
    ? appointmentData.scheduledAt
    : appointmentData.scheduledAt.toISOString();

  const endTime = new Date(scheduledTime);
  if (appointmentData.durationMinutes) {
    endTime.setMinutes(endTime.getMinutes() + appointmentData.durationMinutes);
  } else {
    endTime.setMinutes(endTime.getMinutes() + 30);
  }

  const fhirAppointment: FHIRAppointment = {
    resourceType: 'Appointment',
    status: appointmentData.status,
    start: scheduledTime,
    end: endTime.toISOString(),
    minutesDuration: appointmentData.durationMinutes || 30,
    participant: [
      {
        actor: {
          reference: `Patient/${appointmentData.patientId}`,
          display: appointmentData.patientName,
        },
        status: 'accepted',
      },
      {
        actor: {
          display: appointmentData.clinician,
        },
        status: 'accepted',
      },
    ],
    reasonCode: appointmentData.reason ? [{ text: appointmentData.reason }] : undefined,
    appointmentType: appointmentData.type ? { text: appointmentData.type } : undefined,
    comment: appointmentData.notes,
  };

  const saved = await medplum.createResource(fhirAppointment);
  console.log(`✅ Created FHIR Appointment: ${saved.id}`);

  return saved.id!;
}

/**
 * Get appointment from Medplum
 */
export async function getAppointmentFromMedplum(medplum: MedplumClient, appointmentId: string): Promise<SavedAppointment | null> {
  try {
    const fhirAppt = await medplum.readResource('Appointment', appointmentId);

    const patientParticipant = fhirAppt.participant?.find((p) => isPatientParticipantReference(p.actor?.reference));
    const clinicianParticipant = fhirAppt.participant?.find((p) => !isPatientParticipantReference(p.actor?.reference));

    const ext = fhirAppt.extension ?? [];
    return {
      id: fhirAppt.id!,
      patientId: patientIdFromActorReference(patientParticipant?.actor?.reference) || '',
      patientName: patientParticipant?.actor?.display || '',
      clinician: clinicianParticipant?.actor?.display || '',
      reason: fhirAppt.reasonCode?.[0]?.text || '',
      type: fhirAppt.appointmentType?.text,
      notes: fhirAppt.comment,
      status: fhirAppt.status as any,
      scheduledAt: fhirAppt.start ? new Date(fhirAppt.start) : new Date(),
      durationMinutes: fhirAppt.minutesDuration,
      createdAt: fhirAppt.meta?.lastUpdated ? new Date(fhirAppt.meta.lastUpdated) : new Date(),
      checkinAt:   ext.find(e => e.url === EXT_CHECKIN)?.valueDateTime,
      completedAt: ext.find(e => e.url === EXT_COMPLETED)?.valueDateTime,
      cancelledAt: ext.find(e => e.url === EXT_CANCELLED)?.valueDateTime,
    };
  } catch (error) {
    if (error instanceof OperationOutcomeError && getStatus(error.outcome) === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Get patient appointments from Medplum
 */
export async function getPatientAppointmentsFromMedplum(medplum: MedplumClient, patientId: string): Promise<SavedAppointment[]> {
  try {
    const appointments = await medplum.searchResources('Appointment', {
      actor: `Patient/${patientId}`,
      _sort: '-date',
    });

    return appointments.map((fhirAppt) => {
      const patientParticipant = fhirAppt.participant?.find((p) => isPatientParticipantReference(p.actor?.reference));
      const clinicianParticipant = fhirAppt.participant?.find((p) => !isPatientParticipantReference(p.actor?.reference));
      const ext = fhirAppt.extension ?? [];
      return {
        id: fhirAppt.id!,
        patientId: patientIdFromActorReference(patientParticipant?.actor?.reference) || '',
        patientName: patientParticipant?.actor?.display || '',
        clinician: clinicianParticipant?.actor?.display || '',
        reason: fhirAppt.reasonCode?.[0]?.text || '',
        type: fhirAppt.appointmentType?.text,
        notes: fhirAppt.comment,
        status: fhirAppt.status as any,
        scheduledAt: fhirAppt.start ? new Date(fhirAppt.start) : new Date(),
        durationMinutes: fhirAppt.minutesDuration,
        createdAt: fhirAppt.meta?.lastUpdated ? new Date(fhirAppt.meta.lastUpdated) : new Date(),
        checkinAt:   ext.find(e => e.url === EXT_CHECKIN)?.valueDateTime,
        completedAt: ext.find(e => e.url === EXT_COMPLETED)?.valueDateTime,
        cancelledAt: ext.find(e => e.url === EXT_CANCELLED)?.valueDateTime,
      } as SavedAppointment;
    });
  } catch (error) {
    console.error('Failed to get patient appointments from Medplum:', error);
    return [];
  }
}

/**
 * List upcoming appointments (clinic-wide, sorted by date, limited to next 50)
 */
export async function getUpcomingAppointments(medplum: MedplumClient, limit = 50): Promise<SavedAppointment[]> {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const appointments = await medplum.searchResources('Appointment', {
      date: `ge${startOfToday.toISOString()}`,
      _sort: 'date',
      _count: String(limit),
    });

    return appointments.map((fhirAppt) => {
      const patientParticipant = fhirAppt.participant?.find((p) => isPatientParticipantReference(p.actor?.reference));
      const clinicianParticipant = fhirAppt.participant?.find((p) => !isPatientParticipantReference(p.actor?.reference));
      const ext = fhirAppt.extension ?? [];
      return {
        id: fhirAppt.id!,
        patientId: patientIdFromActorReference(patientParticipant?.actor?.reference) || '',
        patientName: patientParticipant?.actor?.display || '',
        clinician: clinicianParticipant?.actor?.display || '',
        reason: fhirAppt.reasonCode?.[0]?.text || '',
        type: fhirAppt.appointmentType?.text,
        notes: fhirAppt.comment,
        status: fhirAppt.status as any,
        scheduledAt: fhirAppt.start ? new Date(fhirAppt.start) : new Date(),
        durationMinutes: fhirAppt.minutesDuration,
        createdAt: fhirAppt.meta?.lastUpdated ? new Date(fhirAppt.meta.lastUpdated) : new Date(),
        checkinAt:   ext.find(e => e.url === EXT_CHECKIN)?.valueDateTime,
        completedAt: ext.find(e => e.url === EXT_COMPLETED)?.valueDateTime,
        cancelledAt: ext.find(e => e.url === EXT_CANCELLED)?.valueDateTime,
      } as SavedAppointment;
    });
  } catch (error) {
    console.error('Failed to list upcoming appointments:', error);
    return [];
  }
}

/**
 * List upcoming appointments scoped to a single clinic.
 *
 * Before: 1 call to fetch appointments + 1 call per appointment to verify patient ownership (N+1).
 * After:  1 call to fetch appointments + 1 batch Patient search to verify ownership = 2 calls total.
 */
export async function getUpcomingAppointmentsForClinic(
  medplum: MedplumClient,
  clinicId: string,
  limit = 50
): Promise<SavedAppointment[]> {
  const all = await getUpcomingAppointments(medplum, limit);
  if (all.length === 0) return [];

  const uniquePatientIds = [...new Set(all.map((a) => a.patientId).filter(Boolean))];
  if (uniquePatientIds.length === 0) return [];

  // Single batch Patient search — no per-row lookup.
  const patients = await medplum.searchResources('Patient', {
    _id: uniquePatientIds.join(','),
    _count: String(uniquePatientIds.length),
  });

  // Replicate the same two-path ownership check used by patient-service.ts matchesClinic().
  const validIds = new Set(
    patients
      .filter((p) => {
        const byIdentifier = p.identifier?.some(
          (id) => id.system === 'clinic' && id.value === clinicId
        );
        const byOrg = p.managingOrganization?.reference === `Organization/${clinicId}`;
        return byIdentifier || byOrg;
      })
      .map((p) => p.id!)
  );

  return all.filter((a) => validIds.has(a.patientId));
}

/**
 * Update appointment status
 */
export async function updateAppointmentStatus(
  medplum: MedplumClient,
  appointmentId: string,
  status: 'proposed' | 'pending' | 'booked' | 'arrived' | 'fulfilled' | 'cancelled' | 'noshow'
): Promise<void> {
  const appointment = await medplum.readResource('Appointment', appointmentId);

  const timestampExtUrl =
    status === 'arrived'   ? EXT_CHECKIN :
    status === 'fulfilled' ? EXT_COMPLETED :
    (status === 'cancelled' || status === 'noshow') ? EXT_CANCELLED :
    null;

  // Preserve all existing extensions; only add the new checkpoint timestamp if not already set.
  const existingExts = appointment.extension ?? [];
  const alreadyStamped = timestampExtUrl && existingExts.some(e => e.url === timestampExtUrl);
  const extension = timestampExtUrl && !alreadyStamped
    ? [...existingExts, { url: timestampExtUrl, valueDateTime: new Date().toISOString() }]
    : existingExts;

  await medplum.updateResource({
    ...appointment,
    status,
    ...(extension.length > 0 ? { extension } : {}),
  });
  console.log(`✅ Updated Appointment ${appointmentId} status to ${status}`);
}

/**
 * Delete an appointment from Medplum.
 */
export async function deleteAppointment(medplum: MedplumClient, appointmentId: string): Promise<void> {
  await medplum.deleteResource('Appointment', appointmentId);
  console.log(`✅ Deleted Appointment ${appointmentId}`);
}

/**
 * Reschedule appointment start/end while keeping status simple.
 */
export async function rescheduleAppointment(
  medplum: MedplumClient,
  appointmentId: string,
  scheduledAt: Date | string
): Promise<void> {
  const appointment = await medplum.readResource('Appointment', appointmentId);
  const startIso = typeof scheduledAt === 'string' ? new Date(scheduledAt).toISOString() : scheduledAt.toISOString();
  const duration = appointment.minutesDuration ?? 30;
  const end = new Date(startIso);
  end.setMinutes(end.getMinutes() + duration);

  await medplum.updateResource({
    ...appointment,
    start: startIso,
    end: end.toISOString(),
    status: appointment.status === 'cancelled' || appointment.status === 'noshow' ? 'booked' : appointment.status,
  });
  console.log(`✅ Rescheduled Appointment ${appointmentId} to ${startIso}`);
}
