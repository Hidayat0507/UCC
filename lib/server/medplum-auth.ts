/**
 * Server-side Medplum authentication helpers
 * For use in API routes, Server Components, and Server Actions
 */

import { MedplumClient, type ProfileResource } from '@medplum/core';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { SESSION_COOKIE } from '@/lib/server/cookie-constants';
import { AuthError } from '@/lib/server/route-helpers';
import { env } from '@/lib/env';
// Re-export so callers can import getAdminMedplum from either file.
export { getAdminMedplum } from './medplum-admin';

/**
 * Decode a JWT payload without verifying the signature — only used to read
 * the `exp` claim locally so we can reject obviously expired tokens before
 * touching the network.
 */
function getJwtExpiry(token: string): number | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf8')
    );
    return typeof payload.exp === 'number' ? payload.exp : null;
  } catch {
    return null;
  }
}

/**
 * Get authenticated Medplum client for the current user.
 *
 * Reads the access token from the Authorization header or the session cookie.
 * Does NOT make a Medplum API call — validation is lazy (the first FHIR
 * operation will fail with a clear error if the token is invalid).
 * Expired tokens are rejected immediately via local JWT decode.
 */
export async function getMedplumForRequest(req?: NextRequest): Promise<MedplumClient> {
  const medplum = new MedplumClient({ baseUrl: env.MEDPLUM_BASE_URL });

  let accessToken: string | null = null;

  if (req) {
    const authHeader = req.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      accessToken = authHeader.substring(7);
    }
  }

  if (!accessToken) {
    const cookieStore = await cookies();
    accessToken = cookieStore.get(SESSION_COOKIE)?.value || null;
  }

  if (!accessToken) {
    throw new AuthError('No access token found. User not authenticated.');
  }

  // Reject expired tokens locally — no network round-trip required.
  const exp = getJwtExpiry(accessToken);
  if (exp !== null && exp < Math.floor(Date.now() / 1000)) {
    throw new AuthError('Session expired. Please sign in again.');
  }

  medplum.setAccessToken(accessToken);
  return medplum;
}

/**
 * Get the current user's Medplum profile.
 * Makes exactly one API call (GET /auth/me) and only when the profile is
 * explicitly needed — not on every request.
 */
export async function getCurrentProfile(req?: NextRequest): Promise<ProfileResource> {
  const medplum = await getMedplumForRequest(req);
  const profile = await medplum.getProfileAsync();
  if (!profile) {
    throw new Error('No Medplum profile available');
  }
  return profile as ProfileResource;
}

async function isPlatformAdmin(medplum: MedplumClient): Promise<boolean> {
  try {
    const me = await medplum.get('auth/me');
    return me?.membership?.admin === true;
  } catch {
    return false;
  }
}

async function resolveClinicOrganizationIds(
  medplum: MedplumClient,
  clinicId: string
): Promise<Set<string>> {
  const ids = new Set<string>();

  const organizations = await medplum.searchResources('Organization', {
    identifier: `clinic|${clinicId}`,
    _count: '10',
  });

  for (const org of organizations ?? []) {
    if (org.id) {
      ids.add(org.id);
    }
  }

  // If clinicId is already an Organization ID, allow direct matching as well.
  ids.add(clinicId);
  return ids;
}

async function assertClinicAssignment(
  medplum: MedplumClient,
  profile: ProfileResource,
  clinicId: string
): Promise<void> {
  if (await isPlatformAdmin(medplum)) {
    return;
  }

  if (profile.resourceType !== 'Practitioner' || !profile.id) {
    throw new AuthError('Clinic access is only available to assigned staff users.');
  }

  const allowedOrganizationIds = await resolveClinicOrganizationIds(medplum, clinicId);
  const roles = await medplum.searchResources('PractitionerRole', {
    practitioner: `Practitioner/${profile.id}`,
    _count: '100',
  });

  const hasMatchingRole = (roles ?? []).some((role) => {
    const orgRef = role.organization?.reference;
    if (!orgRef?.startsWith('Organization/')) {
      return false;
    }
    const organizationId = orgRef.replace('Organization/', '');
    return allowedOrganizationIds.has(organizationId);
  });

  if (!hasMatchingRole) {
    throw new AuthError(`You are not assigned to clinic '${clinicId}'.`);
  }
}


/**
 * Check if user has a specific role.
 */
export async function hasRole(req: NextRequest, allowedRoles: string[]): Promise<boolean> {
  try {
    const profile = await getCurrentProfile(req);
    if (profile.resourceType === 'Practitioner') return true;
    if (profile.resourceType === 'Patient') return allowedRoles.includes('patient');
    return false;
  } catch {
    return false;
  }
}

/**
 * Get user's role string from a Medplum profile resource.
 */
export function getProfileRole(profile: ProfileResource): string {
  if (profile.resourceType === 'Practitioner') return 'practitioner';
  if (profile.resourceType === 'Patient') return 'patient';
  return 'user';
}

/** Require authentication — throws AuthError if not authenticated. */
export async function requireAuth(req?: NextRequest): Promise<MedplumClient> {
  return getMedplumForRequest(req);
}

/**
 * Convenience helper used by clinical routes: authenticates the request AND
 * resolves the clinic ID from header/cookie in a single call.
 */
export async function requireClinicAuth(
  req: NextRequest
): Promise<{ medplum: MedplumClient; clinicId: string }> {
  const { getClinicIdFromRequest } = await import('@/lib/server/clinic');
  const [medplum, clinicId, profile] = await Promise.all([
    getMedplumForRequest(req),
    getClinicIdFromRequest(req),
    getCurrentProfile(req),
  ]);

  if (!clinicId) {
    throw new AuthError('No clinic context found. Access must come from a clinic subdomain.');
  }

  await assertClinicAssignment(medplum, profile, clinicId);
  return { medplum, clinicId };
}

/** Optional authentication — returns null if not authenticated. */
export async function optionalAuth(req?: NextRequest): Promise<MedplumClient | null> {
  try {
    return await getMedplumForRequest(req);
  } catch {
    return null;
  }
}
