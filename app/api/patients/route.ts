/**
 * Patient API - FHIR via Medplum
 * Replaces Firebase as source of truth
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireClinicAuth } from '@/lib/server/medplum-auth';
import { handleRouteError } from '@/lib/server/route-helpers';
import {
  savePatientToMedplum,
  getPatientFromMedplum,
  getAllPatientsFromMedplum,
  searchPatientsInMedplum,
  updatePatientInMedplum,
} from '@/lib/fhir/patient-service';

/**
 * POST - Create a new patient in Medplum
 */
export async function POST(request: NextRequest) {
  try {
    const { medplum, clinicId } = await requireClinicAuth(request);
    const patientData = await request.json();

    // Validate required fields
    if (!patientData.fullName || !patientData.nric || !patientData.dateOfBirth || !patientData.gender) {
      return NextResponse.json(
        { error: 'Missing required fields: fullName, nric, dateOfBirth, gender' },
        { status: 400 }
      );
    }

    const patientId = await savePatientToMedplum(patientData, clinicId ?? undefined, medplum);

    return NextResponse.json({
      success: true,
      patientId,
      message: 'Patient saved to FHIR successfully',
    });
  } catch (error) {
    return handleRouteError(error, 'POST /api/patients');
  }
}

/**
 * GET - Get patients
 * Query params:
 * - id: Get specific patient by ID
 * - search: Search patients by name/NRIC
 * - limit: Get all patients (default 100)
 */
export async function GET(request: NextRequest) {
  try {
    const { medplum, clinicId } = await requireClinicAuth(request);
    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get('id');
    const searchQuery = searchParams.get('search');
    const limit = searchParams.get('limit');

    // Get specific patient
    if (patientId) {
      const patient = await getPatientFromMedplum(patientId, clinicId, medplum);
      if (!patient) {
        return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, patient });
    }

    // Search patients
    if (searchQuery) {
      const patients = await searchPatientsInMedplum(searchQuery, clinicId, medplum);
      return NextResponse.json({
        success: true,
        count: patients.length,
        patients,
      });
    }

    // Get all patients
    const limitNum = limit ? parseInt(limit) : 100;
    const patients = await getAllPatientsFromMedplum(limitNum, clinicId, medplum);
    return NextResponse.json({
      success: true,
      count: patients.length,
      patients,
    });
  } catch (error) {
    return handleRouteError(error, 'GET /api/patients');
  }
}

/**
 * PATCH - Update a patient
 */
export async function PATCH(request: NextRequest) {
  try {
    const { medplum, clinicId } = await requireClinicAuth(request);
    const { patientId, ...updates } = await request.json();

    if (!patientId) {
      return NextResponse.json({ error: 'Missing patientId' }, { status: 400 });
    }

    await updatePatientInMedplum(patientId, updates, clinicId, medplum);

    return NextResponse.json({
      success: true,
      message: 'Patient updated successfully',
    });
  } catch (error) {
    return handleRouteError(error, 'PATCH /api/patients');
  }
}




