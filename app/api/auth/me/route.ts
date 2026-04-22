/**
 * GET /api/auth/me
 * Returns current Medplum practitioner profile.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getCurrentProfile,
  getProfileRole,
  getMedplumForRequest,
} from '@/lib/server/medplum-auth';

export async function GET(req: NextRequest) {
  try {
    const [profile, medplum] = await Promise.all([
      getCurrentProfile(req),
      getMedplumForRequest(req),
    ]);
    const me = await medplum.get('auth/me').catch(() => null);

    return NextResponse.json({
      authenticated: true,
      isAdmin: me?.membership?.admin === true,
      profile,
      summary: {
        id: profile.id,
        resourceType: profile.resourceType,
        name: (profile as any).name?.[0]?.text || 'Unknown',
        email:
          (profile as any).telecom?.find((t: any) => t.system === 'email')
            ?.value ?? null,
        role: getProfileRole(profile),
        provider: 'medplum',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { authenticated: false, error: error.message || 'Not authenticated' },
      { status: 401 }
    );
  }
}
