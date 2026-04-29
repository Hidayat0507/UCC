import { NextRequest, NextResponse } from 'next/server';
import { requireClinicAuth } from '@/lib/server/medplum-auth';
import { handleRouteError } from '@/lib/server/route-helpers';
import { getPractitionersFromMedplum } from '@/lib/fhir/admin-service';

export async function GET(request: NextRequest) {
  try {
    const { medplum } = await requireClinicAuth(request);
    const practitioners = await getPractitionersFromMedplum(medplum);
    return NextResponse.json({ success: true, practitioners });
  } catch (error) {
    return handleRouteError(error);
  }
}
