/**
 * Appointment API - FHIR via Medplum
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  saveAppointmentToMedplum,
  getAppointmentFromMedplum,
  getPatientAppointmentsFromMedplum,
  getUpcomingAppointments,
  updateAppointmentStatus,
  rescheduleAppointment,
} from '@/lib/fhir/appointment-service';
import { getMedplumForRequest } from '@/lib/server/medplum-auth';
import { handleRouteError } from '@/lib/server/route-helpers';

/**
 * POST - Create a new appointment
 */
export async function POST(request: NextRequest) {
  try {
    const medplum = await getMedplumForRequest(request);
    const appointmentData = await request.json();

    if (!appointmentData.patientId || !appointmentData.patientName || !appointmentData.clinician ||
        !appointmentData.reason || !appointmentData.scheduledAt) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const appointmentId = await saveAppointmentToMedplum(medplum, appointmentData);

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
    const medplum = await getMedplumForRequest(request);
    const { searchParams } = new URL(request.url);
    const appointmentId = searchParams.get('id');
    const patientId = searchParams.get('patientId');

    if (appointmentId) {
      const appointment = await getAppointmentFromMedplum(medplum, appointmentId);
      if (!appointment) {
        return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, appointment });
    }

    if (patientId) {
      const appointments = await getPatientAppointmentsFromMedplum(medplum, patientId);
      return NextResponse.json({ success: true, count: appointments.length, appointments });
    }

    // No filter — return upcoming appointments for the dashboard
    const appointments = await getUpcomingAppointments(medplum);
    return NextResponse.json({ success: true, count: appointments.length, appointments });
  } catch (error) {
    return handleRouteError(error, 'GET /api/appointments');
  }
}

/**
 * PATCH - Update appointment status
 */
export async function PATCH(request: NextRequest) {
  try {
    const medplum = await getMedplumForRequest(request);
    const { appointmentId, status, scheduledAt } = await request.json();

    if (!appointmentId) {
      return NextResponse.json({ error: 'Missing appointmentId' }, { status: 400 });
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
