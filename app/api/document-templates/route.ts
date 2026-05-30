import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/medplum-auth';
import { getClinicIdFromRequest } from '@/lib/server/clinic';
import { handleRouteError } from '@/lib/server/route-helpers';
import { getTemplate, saveTemplate } from '@/lib/fhir/document-template-service';

export const runtime = 'nodejs';

function isValidType(value: unknown): value is 'mc' | 'referral' {
  return value === 'mc' || value === 'referral';
}

export async function GET(req: NextRequest) {
  try {
    const medplum = await requireAuth(req);
    const type = req.nextUrl.searchParams.get('type');
    if (!isValidType(type)) {
      return NextResponse.json({ error: 'type must be mc or referral' }, { status: 400 });
    }
    const clinicId = await getClinicIdFromRequest(req);
    const html = await getTemplate(type, clinicId ?? 'default', medplum);
    return NextResponse.json({ html });
  } catch (error) {
    return handleRouteError(error, 'GET /api/document-templates');
  }
}

export async function POST(req: NextRequest) {
  try {
    const medplum = await requireAuth(req);
    const body = await req.json().catch(() => null);
    if (!body || !isValidType(body.type) || typeof body.html !== 'string' || !body.html.trim()) {
      return NextResponse.json({ error: 'type (mc|referral) and html are required' }, { status: 400 });
    }
    const clinicId = await getClinicIdFromRequest(req);
    await saveTemplate(body.type, body.html, clinicId ?? 'default', medplum);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRouteError(error, 'POST /api/document-templates');
  }
}
