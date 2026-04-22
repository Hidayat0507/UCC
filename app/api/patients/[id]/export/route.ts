import { NextRequest, NextResponse } from 'next/server';
import { exportPatientBundle } from '@/lib/fhir/patient-export-service';
import { writeServerAuditLog } from '@/lib/server/logging';
import { getCurrentProfile } from '@/lib/server/medplum-auth';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json({ error: 'Missing patient id' }, { status: 400 });
    }

    let userId = 'system';
    try {
      const profile = await getCurrentProfile(request);
      userId = profile.id ?? 'unknown';
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const bundle = await exportPatientBundle(id);

    await writeServerAuditLog({
      action: 'patient_fhir_export',
      subjectType: 'patient',
      subjectId: id,
      userId,
      metadata: {
        entryCount: bundle.entry?.length ?? 0,
      },
    });

    return new NextResponse(JSON.stringify(bundle, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/fhir+json; charset=utf-8',
        'Content-Disposition': `attachment; filename=\"patient-${id}-export.json\"`,
      },
    });
  } catch (error: any) {
    console.error('[patient export] Failed to export patient bundle:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to export patient bundle' },
      { status: 500 }
    );
  }
}
