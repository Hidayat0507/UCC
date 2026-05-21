/**
 * Consultation API - FHIR via Medplum
 * This replaces Firebase as the source of truth
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  saveConsultationToMedplum,
  getConsultationFromMedplum,
  getPatientConsultationsFromMedplum,
  getRecentConsultationsFromMedplum,
  updateConsultationInMedplum,
  deleteConsultationFromMedplum,
} from '@/lib/fhir/consultation-service';
import { getPatientFromMedplum } from '@/lib/fhir/patient-service';
import { getTriageForPatient, updateQueueStatusForPatient } from '@/lib/fhir/triage-service';
import { requireClinicAuth } from '@/lib/server/medplum-auth';
import { handleRouteError } from '@/lib/server/route-helpers';

const procedureItemSchema = z.object({
  name: z.string(),
  price: z.number().optional(),
  quantity: z.number().optional(),
  orderIndex: z.number().optional(),
  category: z.string().optional(),
  notes: z.string().optional(),
  procedureId: z.string().optional(),
  codingSystem: z.string().optional(),
  codingCode: z.string().optional(),
  codingDisplay: z.string().optional(),
});

const prescriptionItemSchema = z.object({
  medication: z.object({ id: z.string(), name: z.string() }),
  frequency: z.string(),
  duration: z.string(),
  quantity: z.number().optional(),
  orderIndex: z.number().optional(),
  category: z.string().optional(),
  price: z.number().optional(),
  strength: z.string().optional(),
});

const postConsultationSchema = z.object({
  patientId: z.string().min(1),
  chiefComplaint: z.string().min(1),
  diagnosis: z.string().min(1),
  notes: z.string().optional(),
  progressNote: z.string().optional(),
  procedures: z.array(procedureItemSchema).optional(),
  prescriptions: z.array(prescriptionItemSchema).optional(),
});

const patchConsultationSchema = z.object({
  consultationId: z.string().min(1),
  chiefComplaint: z.string().optional(),
  diagnosis: z.string().optional(),
  notes: z.string().optional(),
  progressNote: z.string().optional(),
  procedures: z.array(procedureItemSchema).optional(),
  prescriptions: z.array(prescriptionItemSchema).optional(),
});

/**
 * POST - Create a new consultation in Medplum
 */
export async function POST(request: NextRequest) {
  try {
    const { medplum, clinicId } = await requireClinicAuth(request);
    const parsed = postConsultationSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { patientId, chiefComplaint, diagnosis, procedures, notes, progressNote, prescriptions } = parsed.data;

    // 🎯 Get patient data from MEDPLUM (FHIR) - Source of Truth
    const patient = await getPatientFromMedplum(patientId, clinicId ?? undefined, medplum);
    if (!patient) {
      return NextResponse.json({ error: 'Patient not found in FHIR' }, { status: 404 });
    }

    // Save to Medplum as FHIR
    const encounterId = await saveConsultationToMedplum(
      {
        patientId,
        chiefComplaint,
        diagnosis,
        procedures,
        notes,
        progressNote,
        prescriptions,
        date: new Date(),
      },
      {
        id: patientId,
        name: (patient as any).name || (patient as any).fullName || '',
        ic: (patient as any).ic || (patient as any).nric || '',
        dob: (patient as any).dob instanceof Date ? (patient as any).dob : (patient as any).dob?.toDate?.(),
        gender: (patient as any).gender || '',
        phone: (patient as any).phoneNumber || (patient as any).phone || '',
        address: (patient as any).address || '',
      },
      clinicId ?? undefined,
      medplum
    );

    console.log(`✅ Consultation saved to Medplum: ${encounterId}`);

    try {
      const triage = await getTriageForPatient(patientId, medplum, clinicId ?? undefined);
      if (triage.queueStatus && triage.queueStatus !== 'completed') {
        await updateQueueStatusForPatient(patientId, 'meds_and_bills', medplum, clinicId ?? undefined);
      }
    } catch (queueError) {
      console.error('[consultations] Consultation saved but queue status update failed for patient', patientId, queueError);
    }

    return NextResponse.json({
      success: true,
      consultationId: encounterId,
      patientId,
      message: 'Consultation saved successfully',
    });
  } catch (error) {
    return handleRouteError(error, 'POST /api/consultations');
  }
}

/**
 * GET - Get consultations
 * Query params:
 * - patientId: Get consultations for specific patient
 * - id: Get specific consultation by ID
 * - recent: Get recent consultations (limit)
 */
export async function GET(request: NextRequest) {
  try {
    const { medplum, clinicId } = await requireClinicAuth(request);
    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get('patientId');
    const consultationId = searchParams.get('id');
    const recent = searchParams.get('recent');

    // Get specific consultation
    if (consultationId) {
      const consultation = await getConsultationFromMedplum(consultationId, clinicId, medplum);
      if (!consultation) {
        return NextResponse.json({ error: 'Consultation not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, consultation });
    }

    // Get consultations for a patient
    if (patientId) {
      const consultations = await getPatientConsultationsFromMedplum(patientId, clinicId, medplum);
      return NextResponse.json({
        success: true,
        count: consultations.length,
        consultations,
      });
    }

    // Get recent consultations
    if (recent) {
      const limit = parseInt(recent) || 10;
      const consultations = await getRecentConsultationsFromMedplum(limit, clinicId, medplum);
      return NextResponse.json({
        success: true,
        count: consultations.length,
        consultations,
      });
    }

    return NextResponse.json({ error: 'Missing query parameter: patientId, id, or recent' }, { status: 400 });
  } catch (error) {
    return handleRouteError(error, 'GET /api/consultations');
  }
}

/**
 * PATCH - Update an existing consultation
 * Body: { consultationId, chiefComplaint?, diagnosis?, notes?, progressNote?, procedures?, prescriptions? }
 */
export async function PATCH(request: NextRequest) {
  try {
    const { medplum, clinicId } = await requireClinicAuth(request);
    const parsed = patchConsultationSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { consultationId, ...updates } = parsed.data;

    await updateConsultationInMedplum(consultationId, updates, clinicId, medplum);

    return NextResponse.json({
      success: true,
      message: 'Consultation updated successfully',
    });
  } catch (error) {
    return handleRouteError(error, 'PATCH /api/consultations');
  }
}

/**
 * DELETE - Delete a consultation and all linked FHIR resources
 * Body: { consultationId }
 */
export async function DELETE(request: NextRequest) {
  try {
    const { medplum, clinicId } = await requireClinicAuth(request);
    const body = await request.json();
    const { consultationId } = body;

    if (!consultationId) {
      return NextResponse.json({ error: 'Missing consultationId' }, { status: 400 });
    }

    await deleteConsultationFromMedplum(consultationId, clinicId, medplum);
    return NextResponse.json({ success: true, message: 'Consultation deleted successfully' });
  } catch (error) {
    return handleRouteError(error, 'DELETE /api/consultations');
  }
}
