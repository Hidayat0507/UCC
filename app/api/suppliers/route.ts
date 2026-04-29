import { NextRequest, NextResponse } from 'next/server';
import type { Organization } from '@medplum/fhirtypes';
import { requireClinicAuth } from '@/lib/server/medplum-auth';
import { handleRouteError } from '@/lib/server/route-helpers';

const SUPPLIER_SYSTEM = 'urn:iatrum:organization-type';
const SUPPLIER_CODE = 'supplier';
const CLINIC_SYSTEM = 'clinic';
const EXT_BASE = 'urn:iatrum:supplier';

function toOrg(data: Record<string, any>, clinicId: string): Organization {
  const telecom: Organization['telecom'] = [];
  if (data.phone) telecom.push({ system: 'phone', value: data.phone });
  if (data.email) telecom.push({ system: 'email', value: data.email });

  const extension: Organization['extension'] = [];
  if (data.contactPerson) extension.push({ url: `${EXT_BASE}/contactPerson`, valueString: data.contactPerson });
  if (data.notes) extension.push({ url: `${EXT_BASE}/notes`, valueString: data.notes });

  return {
    resourceType: 'Organization',
    identifier: [
      { system: SUPPLIER_SYSTEM, value: SUPPLIER_CODE },
      { system: CLINIC_SYSTEM, value: clinicId },
    ],
    name: data.name,
    ...(telecom.length > 0 ? { telecom } : {}),
    ...(data.address ? { address: [{ text: data.address }] } : {}),
    ...(extension.length > 0 ? { extension } : {}),
  };
}

function fromOrg(org: Organization) {
  return {
    id: org.id,
    name: org.name ?? '',
    contactPerson: org.extension?.find(e => e.url === `${EXT_BASE}/contactPerson`)?.valueString,
    phone: org.telecom?.find(t => t.system === 'phone')?.value,
    email: org.telecom?.find(t => t.system === 'email')?.value,
    address: org.address?.[0]?.text,
    notes: org.extension?.find(e => e.url === `${EXT_BASE}/notes`)?.valueString,
    createdAt: org.meta?.lastUpdated,
    updatedAt: org.meta?.lastUpdated,
  };
}

function belongsToClinic(org: Organization, clinicId: string) {
  return org.identifier?.some(i => i.system === CLINIC_SYSTEM && i.value === clinicId);
}

export async function GET(req: NextRequest) {
  try {
    const { medplum, clinicId } = await requireClinicAuth(req);
    const orgs = await medplum.searchResources('Organization', {
      identifier: `${SUPPLIER_SYSTEM}|${SUPPLIER_CODE}`,
      _count: '200',
    });
    const suppliers = (orgs ?? [])
      .filter(org => belongsToClinic(org, clinicId))
      .map(fromOrg);
    return NextResponse.json({ success: true, suppliers });
  } catch (error) {
    return handleRouteError(error, 'GET /api/suppliers');
  }
}

export async function POST(req: NextRequest) {
  try {
    const { medplum, clinicId } = await requireClinicAuth(req);
    const data = await req.json();
    if (!data?.name?.trim()) {
      return NextResponse.json({ success: false, error: 'name is required' }, { status: 400 });
    }
    const created = await medplum.createResource(toOrg(data, clinicId));
    return NextResponse.json({ success: true, supplier: fromOrg(created) });
  } catch (error) {
    return handleRouteError(error, 'POST /api/suppliers');
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { medplum, clinicId } = await requireClinicAuth(req);
    const { id, ...data } = await req.json();
    if (!id) {
      return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
    }
    const existing = await medplum.readResource('Organization', id) as Organization;
    if (!belongsToClinic(existing, clinicId)) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }
    const merged = { ...fromOrg(existing), ...data };
    const updated = await medplum.updateResource({ ...toOrg(merged, clinicId), id });
    return NextResponse.json({ success: true, supplier: fromOrg(updated) });
  } catch (error) {
    return handleRouteError(error, 'PATCH /api/suppliers');
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { medplum, clinicId } = await requireClinicAuth(req);
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
    }
    const existing = await medplum.readResource('Organization', id) as Organization;
    if (!belongsToClinic(existing, clinicId)) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }
    await medplum.deleteResource('Organization', id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRouteError(error, 'DELETE /api/suppliers');
  }
}
