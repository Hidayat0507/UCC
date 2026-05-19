/**
 * Appointment API - FHIR via Medplum
 *
 * All operations are scoped to the authenticated clinic. Clinic ownership is
 * verified via the appointment's Patient participant: a patient must belong to
 * the current clinic (managingOrganization or clinic identifier) before the
 * appointment is returned or mutated.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  saveAppointmentToMedplum,
  getAppointmentFromMedplum,
  getPatientAppointmentsFromMedplum,
  getUpcomingAppointments,
  updateAppointmentStatus,
  rescheduleAppointment,
  deleteAppointment,
  type SavedAppointment,
} from '@/lib/fhir/appointment-service';
import { getPatientFromMedplum } from '@/lib/fhir/patient-service';
import { createAppointmentReminderFollowUp } from '@/lib/fhir/communication-service';
import { requireClinicAuth } from '@/lib/server/medplum-auth';
import { handleRouteError } from '@/lib/server/route-helpers';
import type { MedplumClient } from '@medplum/core';

/**
 * Read an appointment and verify it belongs to the given clinic via its patient.
 * Returns the appointment if access is allowed, null otherwise.
 */
async function getAppointmentForClinic(
  medplum: MedplumClient,
  appointmentId: string,
  clinicId: string
): Promise<SavedAppointment | null> {
  const appointment = await getAppointmentFromMedplum(medplum, appointmentId);
  if (!appointment) return null;
  const patient = await getPatientFromMedplum(appointment.patientId, clinicId, medplum, { includeMedicalHistory: false });
  if (!patient) return null;
  return appointment;
}

/**
 * POST - Create a new appointment
 */
export async function POST(request: NextRequest) {
  try {
    const { medplum, clinicId } = await requireClinicAuth(request);
    const appointmentData = await request.json();

    if (!appointmentData.patientId || !appointmentData.patientName || !appointmentData.clinician ||
        !appointmentData.reason || !appointmentData.scheduledAt) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const appointmentId = await saveAppointmentToMedplum(medplum, appointmentData);
    try {
      await createAppointmentReminderFollowUp(medplum, { clinicId, appointmentId });
    } catch (followUpError) {
      console.error('[appointments] Appointment saved but reminder follow-up creation failed', appointmentId, followUpError);
    }
    return NextResponse.json({
      success: true,
      appointmentId,
      message: 'Appointment saved to FHIR successfully',
    });
  } catch (error) {
    return handleRouteError(error, 'POST /api/appointments');
  }
}

/**
 * GET - Get appointments
 */
export async function GET(request: NextRequest) {
  try {
    const { medplum, clinicId } = await requireClinicAuth(request);
    const { searchParams } = new URL(request.url);
    const appointmentId = searchParams.get('id');
    const patientId = searchParams.get('patientId');

    if (appointmentId) {
      const appointment = await getAppointmentForClinic(medplum, appointmentId, clinicId);
      if (!appointment) {
        return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, appointment });
    }

    if (patientId) {
      const patient = await getPatientFromMedplum(patientId, clinicId, medplum, { includeMedicalHistory: false });
      if (!patient) {
        return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
      }
      const appointments = await getPatientAppointmentsFromMedplum(medplum, patientId);
      return NextResponse.json({ success: true, count: appointments.length, appointments });
    }

    // No filter — return upcoming appointments scoped to this clinic
    const all = await getUpcomingAppointments(medplum);
    const filtered = (
      await Promise.all(
        all.map(async (appt) => {
          const patient = await getPatientFromMedplum(appt.patientId, clinicId, medplum, { includeMedicalHistory: false });
          return patient ? appt : null;
        })
      )
    ).filter((a): a is SavedAppointment => a !== null);

    return NextResponse.json({ success: true, count: filtered.length, appointments: filtered });
  } catch (error) {
    return handleRouteError(error, 'GET /api/appointments');
  }
}

/**
 * PATCH - Update appointment status or reschedule
 */
export async function PATCH(request: NextRequest) {
  try {
    const { medplum, clinicId } = await requireClinicAuth(request);
    const { appointmentId, status, scheduledAt } = await request.json();

    if (!appointmentId) {
      return NextResponse.json({ error: 'Missing appointmentId' }, { status: 400 });
    }

    const appointment = await getAppointmentForClinic(medplum, appointmentId, clinicId);
    if (!appointment) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });
    }

    if (status) {
      await updateAppointmentStatus(medplum, appointmentId, status);
    }

    if (scheduledAt) {
      await rescheduleAppointment(medplum, appointmentId, scheduledAt);
    }

    if (!status && !scheduledAt) {
      return NextResponse.json({ error: 'No update fields provided' }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: 'Appointment updated successfully' });
  } catch (error) {
    return handleRouteError(error, 'PATCH /api/appointments');
  }
}

/**
 * DELETE - Delete an appointment
 */
export async function DELETE(request: NextRequest) {
  try {
    const { medplum, clinicId } = await requireClinicAuth(request);
    const { appointmentId } = await request.json();

    if (!appointmentId) {
      return NextResponse.json({ error: 'Missing appointmentId' }, { status: 400 });
    }

    const appointment = await getAppointmentForClinic(medplum, appointmentId, clinicId);
    if (!appointment) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });
    }

    await deleteAppointment(medplum, appointmentId);
    return NextResponse.json({ success: true, message: 'Appointment deleted successfully' });
  } catch (error) {
    return handleRouteError(error, 'DELETE /api/appointments');
  }
}
