/**
 * API endpoint to order imaging studies
 * 
 * POST /api/imaging/order
 */

import { NextRequest, NextResponse } from 'next/server';
import { createImagingOrder, type ImagingOrderRequest } from '@/lib/fhir/imaging-service';
import { getMedplumForRequest } from '@/lib/server/medplum-auth';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const medplum = await getMedplumForRequest(request);
    const body: ImagingOrderRequest = await request.json();

    // Validate required fields
    if (!body.patientId) {
      return NextResponse.json(
        { error: 'patientId is required' },
        { status: 400 }
      );
    }

    if (!body.procedures || !Array.isArray(body.procedures) || body.procedures.length === 0) {
      return NextResponse.json(
        { error: 'procedures array is required and must not be empty' },
        { status: 400 }
      );
    }

    if (!body.clinicalIndication?.trim()) {
      return NextResponse.json(
        { error: 'clinicalIndication is required for imaging orders' },
        { status: 400 }
      );
    }

    // Create the imaging order
    const serviceRequestId = await createImagingOrder(body, medplum);

    return NextResponse.json({
      success: true,
      serviceRequestId,
      message: `Imaging order created for ${body.procedures.length} procedures`,
    });

  } catch (error: any) {
    console.error('Error creating imaging order:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to create imaging order',
        details: error.message 
      },
      { status: 500 }
    );
  }
}








