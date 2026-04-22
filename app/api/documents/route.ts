import { NextRequest, NextResponse } from 'next/server';
import { createPatientDocument, deletePatientDocument, listPatientDocuments } from '@/lib/fhir/document-service';
import { getMedplumForRequest } from '@/lib/server/medplum-auth';
import { handleRouteError } from '@/lib/server/route-helpers';

export async function GET(request: NextRequest) {
  try {
    const medplum = await getMedplumForRequest(request);
    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get('patientId');
    if (!patientId) {
      return NextResponse.json({ error: 'Missing patientId' }, { status: 400 });
    }

    const docs = await listPatientDocuments(medplum, patientId);
    return NextResponse.json({ success: true, documents: docs });
  } catch (error) {
    return handleRouteError(error, 'GET /api/documents');
  }
}

export async function POST(request: NextRequest) {
  try {
    const medplum = await getMedplumForRequest(request);
    const body = await request.json();
    const { patientId, title, url, contentType, size, uploadedBy, storagePath } = body || {};

    if (!patientId || !title || !url || !contentType) {
      return NextResponse.json({ error: 'Missing required fields: patientId, title, url, contentType' }, { status: 400 });
    }

    const id = await createPatientDocument(medplum, { patientId, title, url, contentType, size, uploadedBy, storagePath });
    return NextResponse.json({ success: true, id });
  } catch (error) {
    return handleRouteError(error, 'POST /api/documents');
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const medplum = await getMedplumForRequest(request);
    const body = await request.json();
    const { id } = body || {};
    if (!id) {
      return NextResponse.json({ error: 'Missing document id' }, { status: 400 });
    }

    await deletePatientDocument(medplum, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRouteError(error, 'DELETE /api/documents');
  }
}
