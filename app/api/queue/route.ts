import { NextRequest, NextResponse } from 'next/server';
import {
  checkInPatientInTriage,
  getTriageQueueForToday,
  updateQueueStatusForPatient,
} from '@/lib/fhir/triage-service';
import { requireClinicAuth } from '@/lib/server/medplum-auth';
import { handleRouteError } from '@/lib/server/route-helpers';

export async function GET(req: NextRequest) {
  try {
    const { medplum, clinicId } = await requireClinicAuth(req);
    const patients = await getTriageQueueForToday(200, medplum, clinicId);
    return NextResponse.json({ success: true, patients });
  } catch (error) {
    return handleRouteError(error, 'GET /api/queue');
  }
}

export async function POST(req: NextRequest) {
  try {
    const { medplum, clinicId } = await requireClinicAuth(req);
    const { patientId } = await req.json();
    if (!patientId) {
      return NextResponse.json({ success: false, error: 'patientId is required' }, { status: 400 });
    }
    await checkInPatientInTriage(patientId, undefined, medplum, clinicId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRouteError(error, 'POST /api/queue');
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { medplum, clinicId } = await requireClinicAuth(req);
    const { patientId } = await req.json();
    if (!patientId) {
      return NextResponse.json({ success: false, error: 'patientId is required' }, { status: 400 });
    }
    await updateQueueStatusForPatient(patientId, null, medplum, clinicId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRouteError(error, 'DELETE /api/queue');
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { medplum, clinicId } = await requireClinicAuth(req);
    const { patientId, status } = await req.json();
    if (!patientId || typeof status === 'undefined') {
      return NextResponse.json({ success: false, error: 'patientId and status are required' }, { status: 400 });
    }
    await updateQueueStatusForPatient(patientId, status, medplum, clinicId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRouteError(error, 'PATCH /api/queue');
  }
}
