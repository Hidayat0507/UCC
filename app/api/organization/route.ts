import { NextRequest, NextResponse } from 'next/server';
import { requireClinicAuth } from '@/lib/server/medplum-auth';
import { handleRouteError } from '@/lib/server/route-helpers';
import {
  getParentOrganizationFromMedplum,
  updateParentOrganizationInMedplum,
} from '@/lib/fhir/admin-service';

export async function GET(request: NextRequest) {
  try {
    await requireClinicAuth(request);
    const org = await getParentOrganizationFromMedplum();
    return NextResponse.json({
      success: true,
      organization: org
        ? { name: org.name, phone: org.phone ?? null, address: org.address ?? null, logoUrl: org.logoUrl ?? null }
        : null,
    });
  } catch (error) {
    return handleRouteError(error, 'GET /api/organization');
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireClinicAuth(request);
    const { name, phone, address, logoUrl } = await request.json();
    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }
    const existing = await getParentOrganizationFromMedplum();
    if (!existing?.id) {
      return NextResponse.json({ error: 'No organisation found to update' }, { status: 404 });
    }
    const updated = await updateParentOrganizationInMedplum(existing.id, {
      name,
      phone: phone || undefined,
      address: address || undefined,
      logoUrl: logoUrl || undefined,
    });
    return NextResponse.json({
      success: true,
      organization: {
        name: updated.name,
        phone: updated.phone ?? null,
        address: updated.address ?? null,
        logoUrl: updated.logoUrl ?? null,
      },
    });
  } catch (error) {
    return handleRouteError(error, 'PUT /api/organization');
  }
}
