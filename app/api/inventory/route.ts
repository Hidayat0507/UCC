import { NextRequest, NextResponse } from 'next/server';
import {
  createInventoryMedicationInMedplum,
  deleteInventoryMedicationInMedplum,
  getInventoryMedicationByIdFromMedplum,
  getInventoryMedicationsFromMedplum,
  updateInventoryMedicationInMedplum,
} from '@/lib/fhir/inventory-service';
import { requireClinicAuth } from '@/lib/server/medplum-auth';
import { handleRouteError } from '@/lib/server/route-helpers';

export async function GET(request: NextRequest) {
  try {
    const { medplum, clinicId } = await requireClinicAuth(request);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      const medication = await getInventoryMedicationByIdFromMedplum(medplum, id, clinicId);
      if (!medication) {
        return NextResponse.json({ success: false, error: 'Medication not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, medication });
    }

    const medications = await getInventoryMedicationsFromMedplum(medplum, clinicId);
    return NextResponse.json({ success: true, medications, count: medications.length });
  } catch (error) {
    return handleRouteError(error, 'GET /api/inventory');
  }
}

export async function POST(request: NextRequest) {
  try {
    const { medplum, clinicId } = await requireClinicAuth(request);
    const data = await request.json();

    if (!data?.name) {
      return NextResponse.json({ success: false, error: 'Missing required field: name' }, { status: 400 });
    }

    const medicationId = await createInventoryMedicationInMedplum(medplum, data, clinicId);
    return NextResponse.json({
      success: true,
      medicationId,
      message: 'Medication saved to FHIR successfully',
    });
  } catch (error) {
    return handleRouteError(error, 'POST /api/inventory');
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { medplum, clinicId } = await requireClinicAuth(request);
    const { medicationId, ...updates } = await request.json();

    if (!medicationId) {
      return NextResponse.json({ success: false, error: 'Missing medicationId' }, { status: 400 });
    }

    await updateInventoryMedicationInMedplum(medplum, medicationId, updates, clinicId);
    return NextResponse.json({ success: true, message: 'Medication updated successfully' });
  } catch (error) {
    return handleRouteError(error, 'PATCH /api/inventory');
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { medplum, clinicId } = await requireClinicAuth(request);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing medication id' }, { status: 400 });
    }

    await deleteInventoryMedicationInMedplum(medplum, id, clinicId);
    return NextResponse.json({ success: true, message: 'Medication deleted successfully' });
  } catch (error) {
    return handleRouteError(error, 'DELETE /api/inventory');
  }
}
