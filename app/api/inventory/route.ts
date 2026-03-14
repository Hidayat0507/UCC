import { NextRequest, NextResponse } from 'next/server';
import { getClinicIdFromRequest } from '@/lib/server/clinic';
import {
  createInventoryMedicationInMedplum,
  deleteInventoryMedicationInMedplum,
  getInventoryMedicationByIdFromMedplum,
  getInventoryMedicationsFromMedplum,
  updateInventoryMedicationInMedplum,
} from '@/lib/fhir/inventory-service';

function resolveClinicId(clinicId: string | null): string | null {
  if (clinicId) return clinicId;
  if (process.env.NODE_ENV !== 'production') {
    const fallback = process.env.NEXT_PUBLIC_DEFAULT_CLINIC_ID || 'default';
    console.warn('⚠️  No clinicId found, using default for development:', fallback);
    return fallback;
  }
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const clinicId = resolveClinicId(await getClinicIdFromRequest(request));

    if (!clinicId) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Missing clinicId. Please set NEXT_PUBLIC_DEFAULT_CLINIC_ID for development or access via clinic subdomain.',
        },
        { status: 400 }
      );
    }

    if (id) {
      const medication = await getInventoryMedicationByIdFromMedplum(id, clinicId);
      if (!medication) {
        return NextResponse.json({ success: false, error: 'Medication not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, medication });
    }

    const medications = await getInventoryMedicationsFromMedplum(clinicId);
    return NextResponse.json({ success: true, medications, count: medications.length });
  } catch (error: any) {
    console.error('❌ Failed to get medications:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get medications' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const clinicId = resolveClinicId(await getClinicIdFromRequest(request));
    if (!clinicId) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Missing clinicId. Please set NEXT_PUBLIC_DEFAULT_CLINIC_ID for development or access via clinic subdomain.',
        },
        { status: 400 }
      );
    }

    const data = await request.json();
    if (!data?.name) {
      return NextResponse.json({ success: false, error: 'Missing required field: name' }, { status: 400 });
    }

    const medicationId = await createInventoryMedicationInMedplum(data, clinicId);
    return NextResponse.json({
      success: true,
      medicationId,
      message: 'Medication saved to FHIR successfully',
    });
  } catch (error: any) {
    console.error('❌ Failed to save medication:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to save medication' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const clinicId = resolveClinicId(await getClinicIdFromRequest(request));
    if (!clinicId) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Missing clinicId. Please set NEXT_PUBLIC_DEFAULT_CLINIC_ID for development or access via clinic subdomain.',
        },
        { status: 400 }
      );
    }

    const { medicationId, ...updates } = await request.json();
    if (!medicationId) {
      return NextResponse.json({ success: false, error: 'Missing medicationId' }, { status: 400 });
    }

    await updateInventoryMedicationInMedplum(medicationId, updates, clinicId);
    return NextResponse.json({ success: true, message: 'Medication updated successfully' });
  } catch (error: any) {
    console.error('❌ Failed to update medication:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update medication' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const clinicId = resolveClinicId(await getClinicIdFromRequest(request));
    if (!clinicId) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Missing clinicId. Please set NEXT_PUBLIC_DEFAULT_CLINIC_ID for development or access via clinic subdomain.',
        },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing medication id' }, { status: 400 });
    }

    await deleteInventoryMedicationInMedplum(id, clinicId);
    return NextResponse.json({ success: true, message: 'Medication deleted successfully' });
  } catch (error: any) {
    console.error('❌ Failed to delete medication:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete medication' },
      { status: 500 }
    );
  }
}
