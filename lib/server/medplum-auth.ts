/**
 * Server-side Medplum authentication helpers
 * For use in API routes, Server Components, and Server Actions
 */

import { MedplumClient, type ProfileResource } from '@medplum/core';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { REFRESH_COOKIE, SESSION_COOKIE } from '@/lib/server/cookie-constants';
import { AuthError, ClinicContextError, ForbiddenError } from '@/lib/server/route-helpers';
import { env } from '@/lib/env';
// Re-export so callers can import getAdminMedplum from either file.
export { getAdminMedplum } from './medplum-admin';

export interface AssignedClinic {
  id: string;
  name: string;
  subdomain: string;
}

export interface UserAccessContext {
  profile: ProfileResource;
  isPlatformAdmin: boolean;
  clinics: AssignedClinic[];
}

const MAX_AGE_SECONDS = Number(process.env.AUTH_SESSION_MAX_AGE_SECONDS || 60 * 60 * 24 * 30);
const isProd = process.env.NODE_ENV === 'production';
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || undefined;
const MEDPLUM_BASE_URL = env.MEDPLUM_BASE_URL.replace(/\/$/, '');
const MEDPLUM_CLIENT_ID = env.MEDPLUM_CLIENT_ID || process.env.NEXT_PUBLIC_MEDPLUM_CLIENT_ID || '';

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

type RefreshResult = {
  accessToken: string;
  refreshToken?: string;
};

function setSessionCookie(
  cookieStore: Awaited<ReturnType<typeof cookies>>,
  name: string,
  value: string
): void {
  try {
    cookieStore.set(name, value, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: MAX_AGE_SECONDS,
      domain: COOKIE_DOMAIN,
    });
  } catch {
    // Read-only cookie store contexts cannot persist rotations.
  }
}

async function refreshAccessToken(refreshToken: string): Promise<RefreshResult | null> {
  if (!MEDPLUM_CLIENT_ID) {
    return null;
  }

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: MEDPLUM_CLIENT_ID,
  });

  const response = await fetch(`${MEDPLUM_BASE_URL}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    return null;
  }

  const payload = await response.json().catch(() => null);
  if (!payload || typeof payload.access_token !== 'string') {
    return null;
  }

  return {
    accessToken: payload.access_token,
    refreshToken: typeof payload.refresh_token === 'string' ? payload.refresh_token : undefined,
  };
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
  const cookieStore = await cookies();

  let accessToken: string | null = null;
  let fromAuthHeader = false;

  if (req) {
    const authHeader = req.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      accessToken = authHeader.substring(7);
      fromAuthHeader = true;
    }

    if (!accessToken) {
      accessToken = req.cookies.get(SESSION_COOKIE)?.value || null;
    }
  }

  if (!accessToken) {
    accessToken = cookieStore.get(SESSION_COOKIE)?.value || null;
  }

  if (!accessToken) {
    throw new AuthError('No access token found. User not authenticated.');
  }

  // Reject expired tokens locally — no network round-trip required.
  const exp = getJwtExpiry(accessToken);
  if (exp !== null && exp < Math.floor(Date.now() / 1000)) {
    if (fromAuthHeader) {
      throw new AuthError('Session expired. Please sign in again.');
    }

    const refreshToken =
      req?.cookies.get(REFRESH_COOKIE)?.value || cookieStore.get(REFRESH_COOKIE)?.value || null;
    if (!refreshToken) {
      throw new AuthError('Session expired. Please sign in again.');
    }

    const refreshed = await refreshAccessToken(refreshToken);
    if (!refreshed) {
      throw new AuthError('Session expired. Please sign in again.');
    }

    accessToken = refreshed.accessToken;
    setSessionCookie(cookieStore, SESSION_COOKIE, refreshed.accessToken);
    if (refreshed.refreshToken) {
      setSessionCookie(cookieStore, REFRESH_COOKIE, refreshed.refreshToken);
    }
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

export async function getAssignedClinics(
  medplum: MedplumClient,
  profile: ProfileResource
): Promise<AssignedClinic[]> {
  if (profile.resourceType !== 'Practitioner' || !profile.id) {
    return [];
  }

  const roles = await medplum.searchResources('PractitionerRole', {
    practitioner: `Practitioner/${profile.id}`,
    _count: '100',
  });

  const organizationIds = Array.from(
    new Set(
      (roles ?? [])
        .map((role) => role.organization?.reference?.replace('Organization/', ''))
        .filter((value): value is string => Boolean(value))
    )
  );

  const organizations = await Promise.all(
    organizationIds.map(async (id) => {
      try {
        return await medplum.readResource('Organization', id);
      } catch {
        return null;
      }
    })
  );

  return organizations
    .filter((org): org is NonNullable<typeof org> => Boolean(org?.id))
    .map((org) => ({
      id: org.id as string,
      name: org.name ?? 'Unnamed clinic',
      subdomain:
        org.identifier?.find((identifier) => identifier.system === 'clinic')?.value ?? (org.id as string),
    }));
}

export async function getUserAccessContext(req?: NextRequest): Promise<UserAccessContext> {
  const medplum = await getMedplumForRequest(req);
  const profile = await getCurrentProfile(req);
  const platformAdmin = await isPlatformAdmin(medplum);
  const clinics = await getAssignedClinics(medplum, profile);
  return { profile, isPlatformAdmin: platformAdmin, clinics };
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
 * Require platform admin — throws AuthError if not authenticated,
 * ForbiddenError if authenticated but not a platform admin.
 */
export async function requirePlatformAdmin(req?: NextRequest): Promise<MedplumClient> {
  const medplum = await getMedplumForRequest(req);
  if (!(await isPlatformAdmin(medplum))) {
    throw new ForbiddenError('Platform admin access required.');
  }
  return medplum;
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
    throw new ClinicContextError(
      'No clinic context. Open the app from your clinic subdomain (for example clinic.example.com), or sign in again from localhost so a clinic can be selected.'
    );
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
