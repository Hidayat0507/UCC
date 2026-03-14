import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { getUserAccessContext } from './medplum-auth';

const CLINIC_COOKIE_NAME = 'medplum-clinic';

export function getClinicIdFromHost(host: string | null): string | null {
  if (!host) {
    return null;
  }

  const hostname = host.split(':')[0];
  if (
    hostname === 'localhost' ||
    /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) ||
    hostname.endsWith('.vercel.app')
  ) {
    return null;
  }

  const parts = hostname.split('.');
  if (parts.length < 3) {
    return null;
  }

  const subdomain = parts[0];
  if (['www', 'app', 'auth', 'admin'].includes(subdomain)) {
    return null;
  }

  return subdomain;
}

function matchesAssignedClinic(
  clinicId: string,
  assignedClinics: Array<{ id: string; subdomain: string }>
): boolean {
  return assignedClinics.some(
    (clinic) => clinic.id === clinicId || clinic.subdomain === clinicId
  );
}

/**
 * Resolve clinicId from header or cookie. Returns null if not provided.
 */
export async function getClinicIdFromRequest(req: NextRequest): Promise<string | null> {
  const cookieStore = await cookies();
  const hostClinicId = getClinicIdFromHost(req.headers.get('host'));
  const rawClinicId =
    req.headers.get('x-clinic-id') ||
    hostClinicId ||
    cookieStore.get(CLINIC_COOKIE_NAME)?.value ||
    null;
  if (!rawClinicId) {
    return null;
  }

  try {
    const access = await getUserAccessContext(req);
    if (!access.isPlatformAdmin && !matchesAssignedClinic(rawClinicId, access.clinics)) {
      throw new Error('Unauthorized clinic access');
    }
  } catch (error: any) {
    // If a user session exists but the clinic is not assigned, fail closed.
    if (/Unauthorized clinic access|No access token found|Invalid or expired access token/i.test(error?.message || '')) {
      if (/Unauthorized clinic access/i.test(error?.message || '')) {
        throw error;
      }
    }
  }

  return rawClinicId;
}
