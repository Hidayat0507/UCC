/**
 * API endpoint to receive imaging reports from radiologists
 * 
 * This endpoint accepts radiology interpretations and creates FHIR
 * DiagnosticReport resources linked to ImagingStudy.
 * 
 * POST /api/imaging/report
 */

import { NextRequest, NextResponse } from 'next/server';
import { createImagingReport } from '@/lib/fhir/imaging-service';
import { getAdminMedplum } from '@/lib/server/medplum-admin';

export const runtime = 'nodejs';

interface CreateImagingReportRequest {
  imagingStudyId: string;
  findings: string;
  impression: string;
  status?: 'preliminary' | 'final';
  radiologist?: string;
  apiKey?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: CreateImagingReportRequest = await request.json();
    const medplum = await getAdminMedplum();

    // Validate API key
    const expectedApiKey = process.env.PACS_API_KEY;
    if (expectedApiKey && body.apiKey !== expectedApiKey) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid API key' },
        { status: 401 }
      );
    }

    // Validate required fields
    if (!body.imagingStudyId) {
      return NextResponse.json(
        { error: 'imagingStudyId is required' },
        { status: 400 }
      );
    }

    if (!body.findings || !body.impression) {
      return NextResponse.json(
        { error: 'findings and impression are required' },
        { status: 400 }
      );
    }

    // Create the imaging report
    const reportId = await createImagingReport(
      body.imagingStudyId,
      body.findings,
      body.impression,
      body.status || 'final',
      body.radiologist,
      medplum
    );

    return NextResponse.json({
      success: true,
      diagnosticReportId: reportId,
      message: 'Imaging report created successfully',
    });

  } catch (error: any) {
    console.error('Error creating imaging report:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to create imaging report',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

// Example curl request:
/*
curl -X POST http://localhost:3000/api/imaging/report \
  -H "Content-Type: application/json" \
  -d '{
    "imagingStudyId": "imaging-study-123",
    "apiKey": "your-api-key",
    "findings": "The lungs are clear without focal consolidation, pleural effusion, or pneumothorax. The cardiac silhouette is normal in size. The mediastinal contours are unremarkable. The osseous structures are intact.",
    "impression": "Normal chest radiograph. No acute cardiopulmonary abnormality.",
    "status": "final",
    "radiologist": "Dr. Jane Smith, MD"
  }'
*/







