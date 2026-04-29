/**
 * Appointment Service - Medplum FHIR as Source of Truth
 */

import { MedplumClient } from '@medplum/core';
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
}

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
    };
  } catch (error) {
    console.error('Failed to get appointment from Medplum:', error);
    return null;
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

    const mapped = await Promise.all(
      appointments.map(async (appt) => {
        const saved = await getAppointmentFromMedplum(medplum, appt.id!);
        return saved;
      })
    );

    return mapped.filter((a): a is SavedAppointment => a !== null);
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
    const now = new Date().toISOString();
    const appointments = await medplum.searchResources('Appointment', {
      date: `ge${now}`,
      _sort: 'date',
      _count: String(limit),
    });

    const mapped = await Promise.all(
      appointments.map(appt => getAppointmentFromMedplum(medplum, appt.id!))
    );

    return mapped.filter((a): a is SavedAppointment => a !== null);
  } catch (error) {
    console.error('Failed to list upcoming appointments:', error);
    return [];
  }
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
  await medplum.updateResource({ ...appointment, status });
  console.log(`✅ Updated Appointment ${appointmentId} status to ${status}`);
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
