/**
 * API endpoint to receive imaging studies from PACS
 * 
 * This endpoint accepts DICOM study information and creates FHIR
 * ImagingStudy resources in Medplum.
 * 
 * POST /api/imaging/receive
 */

import { NextRequest, NextResponse } from 'next/server';
import { receiveImagingStudy, type ImagingStudyData } from '@/lib/fhir/imaging-service';
import { getAdminMedplum } from '@/lib/server/medplum-admin';

export const runtime = 'nodejs';

interface ReceiveImagingStudyRequest {
  serviceRequestId: string;
  study: ImagingStudyData;
  apiKey?: string; // For authentication from external PACS
}

export async function POST(request: NextRequest) {
  try {
    const body: ReceiveImagingStudyRequest = await request.json();

    // Validate API key if provided (optional - implement your own auth)
    const expectedApiKey = process.env.PACS_API_KEY;
    if (expectedApiKey && body.apiKey !== expectedApiKey) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid API key' },
        { status: 401 }
      );
    }

    // Validate required fields
    if (!body.serviceRequestId) {
      return NextResponse.json(
        { error: 'serviceRequestId is required' },
        { status: 400 }
      );
    }

    if (!body.study) {
      return NextResponse.json(
        { error: 'study data is required' },
        { status: 400 }
      );
    }

    if (!body.study.studyUid) {
      return NextResponse.json(
        { error: 'study.studyUid is required' },
        { status: 400 }
      );
    }

    // Process the imaging study
    const medplum = await getAdminMedplum();
    const studyId = await receiveImagingStudy(
      body.serviceRequestId,
      body.study,
      medplum
    );

    return NextResponse.json({
      success: true,
      imagingStudyId: studyId,
      message: 'Imaging study received and stored successfully',
    });

  } catch (error: any) {
    console.error('Error receiving imaging study:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to receive imaging study',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

// Example curl request:
/*
curl -X POST http://localhost:3000/api/imaging/receive \
  -H "Content-Type: application/json" \
  -d '{
    "serviceRequestId": "service-request-456",
    "apiKey": "your-api-key",
    "study": {
      "studyUid": "1.2.840.113619.2.55.3.2831196886.123.1234567890",
      "accessionNumber": "ACC-2024-001",
      "modality": "DX",
      "description": "Chest X-ray 2 views",
      "numberOfSeries": 2,
      "numberOfInstances": 4,
      "started": "2024-12-01T10:30:00Z",
      "series": [
        {
          "uid": "1.2.840.113619.2.55.3.2831196886.123.1234567890.1",
          "number": 1,
          "modality": "DX",
          "description": "PA View",
          "numberOfInstances": 2,
          "bodySite": "Chest",
          "started": "2024-12-01T10:30:00Z",
          "endpoint": "https://pacs.example.com/wado/studies/1.2.840.113619.../series/1"
        },
        {
          "uid": "1.2.840.113619.2.55.3.2831196886.123.1234567890.2",
          "number": 2,
          "modality": "DX",
          "description": "Lateral View",
          "numberOfInstances": 2,
          "bodySite": "Chest",
          "started": "2024-12-01T10:31:00Z",
          "endpoint": "https://pacs.example.com/wado/studies/1.2.840.113619.../series/2"
        }
      ],
      "pacsUrl": "https://pacs.example.com/viewer?studyUid=1.2.840.113619..."
    }
  }'
*/








