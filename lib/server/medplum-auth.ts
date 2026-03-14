/**
 * Server-side Medplum authentication helpers
 * For use in API routes, Server Components, and Server Actions
 */

import { MedplumClient, type ProfileResource } from '@medplum/core';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { AUTH_DISABLED } from '@/lib/auth-config';

const MEDPLUM_BASE_URL = process.env.MEDPLUM_BASE_URL || 'http://localhost:8103';
const MEDPLUM_CLIENT_ID = process.env.MEDPLUM_CLIENT_ID;
const MEDPLUM_CLIENT_SECRET = process.env.MEDPLUM_CLIENT_SECRET;

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

/**
 * Get authenticated Medplum client for the current user
 * Reads access token from cookie or Authorization header
 */
export async function getMedplumForRequest(req?: NextRequest): Promise<MedplumClient> {
  if (AUTH_DISABLED) {
    if (MEDPLUM_CLIENT_ID && MEDPLUM_CLIENT_SECRET) {
      return await getAdminMedplum();
    }
    const medplum = new MedplumClient({ baseUrl: MEDPLUM_BASE_URL });
    return medplum;
  }
  const medplum = new MedplumClient({ baseUrl: MEDPLUM_BASE_URL });

  // Try to get token from Authorization header first
  let accessToken: string | null = null;

  if (req) {
    const authHeader = req.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      accessToken = authHeader.substring(7);
    }
  }

  // Fallback to cookie
  if (!accessToken) {
    const cookieStore = await cookies();
    accessToken = cookieStore.get('medplum-session')?.value || null;
  }

  if (!accessToken) {
    throw new Error('No access token found. User not authenticated.');
  }

  medplum.setAccessToken(accessToken);

  // Verify token is valid by fetching profile
  try {
    await medplum.getProfile();
  } catch (error) {
    throw new Error('Invalid or expired access token');
  }

  return medplum;
}

/**
 * Get the current user's profile
 */
export async function getCurrentProfile(req?: NextRequest): Promise<ProfileResource> {
  const medplum = await getMedplumForRequest(req);
  const profile = (await medplum.getProfileAsync()) ?? medplum.getProfile();
  if (!profile) {
    throw new Error('No Medplum profile available');
  }
  return profile;
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
  const profile = (await medplum.getProfileAsync()) ?? medplum.getProfile();

  if (!profile) {
    throw new Error('No Medplum profile available');
  }

  let isPlatformAdmin = false;
  try {
    const me = await medplum.get('auth/me');
    isPlatformAdmin = me?.membership?.admin === true;
  } catch {
    isPlatformAdmin = false;
  }

  const clinics = await getAssignedClinics(medplum, profile);
  return { profile, isPlatformAdmin, clinics };
}

/**
 * Get admin Medplum client (uses client credentials)
 * For background tasks, migrations, etc.
 */
export async function getAdminMedplum(): Promise<MedplumClient> {
  if (!MEDPLUM_CLIENT_ID || !MEDPLUM_CLIENT_SECRET) {
    throw new Error('Medplum admin credentials not configured');
  }

  const medplum = new MedplumClient({
    baseUrl: MEDPLUM_BASE_URL,
    clientId: MEDPLUM_CLIENT_ID,
    clientSecret: MEDPLUM_CLIENT_SECRET,
  });

  await medplum.startClientLogin(MEDPLUM_CLIENT_ID, MEDPLUM_CLIENT_SECRET);

  return medplum;
}

/**
 * Check if user has a specific role
 */
export async function hasRole(req: NextRequest, allowedRoles: string[]): Promise<boolean> {
  try {
    const profile = await getCurrentProfile(req);
    
    // For Practitioners, check their role
    if (profile.resourceType === 'Practitioner') {
      // You can check PractitionerRole or custom extensions here
      // For now, allow all practitioners
      return true;
    }
    
    // Patients don't have staff access
    if (profile.resourceType === 'Patient') {
      return allowedRoles.includes('patient');
    }
    
    return false;
  } catch {
    return false;
  }
}

/**
 * Get user's role from profile
 */
export function getProfileRole(profile: ProfileResource): string {
  if (profile.resourceType === 'Practitioner') {
    return 'practitioner';
  }
  if (profile.resourceType === 'Patient') {
    return 'patient';
  }
  return 'user';
}

/**
 * Require authentication - throws if not authenticated
 */
export async function requireAuth(req?: NextRequest): Promise<MedplumClient> {
  try {
    return await getMedplumForRequest(req);
  } catch (error) {
    throw new Error('Authentication required');
  }
}

export async function requirePlatformAdmin(req?: NextRequest): Promise<UserAccessContext> {
  const access = await getUserAccessContext(req);
  if (!access.isPlatformAdmin) {
    throw new Error('Platform admin access required');
  }
  return access;
}

/**
 * Optional authentication - returns null if not authenticated
 */
export async function optionalAuth(req?: NextRequest): Promise<MedplumClient | null> {
  try {
    return await getMedplumForRequest(req);
  } catch {
    return null;
  }
}



