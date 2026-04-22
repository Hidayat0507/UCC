/**
 * API endpoint to get lab results
 * 
 * GET /api/labs/results?patientId=xxx
 * GET /api/labs/results?encounterId=xxx
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPatientLabResults, getEncounterLabResults } from '@/lib/fhir/lab-service';
import { getMedplumForRequest } from '@/lib/server/medplum-auth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const medplum = await getMedplumForRequest(request);
    const searchParams = request.nextUrl.searchParams;
    const patientId = searchParams.get('patientId');
    const encounterId = searchParams.get('encounterId');

    if (!patientId && !encounterId) {
      return NextResponse.json(
        { error: 'Either patientId or encounterId is required' },
        { status: 400 }
      );
    }

    let reports;
    if (encounterId) {
      reports = await getEncounterLabResults(encounterId, medplum);
    } else if (patientId) {
      reports = await getPatientLabResults(patientId, medplum);
    }

    return NextResponse.json({
      success: true,
      reports,
    });

  } catch (error: any) {
    console.error('Error getting lab results:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to get lab results',
        details: error.message 
      },
      { status: 500 }
    );
  }
}








