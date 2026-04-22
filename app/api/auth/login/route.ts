import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'node:crypto';
import { MedplumClient, type ProfileResource } from '@medplum/core';
import { CLINIC_COOKIE, REFRESH_COOKIE, SESSION_COOKIE } from '@/lib/server/cookie-constants';
import {
  deriveSubdomainContext,
  getHostFromHeaders,
} from '@/lib/server/subdomain-host';
import { env } from '@/lib/env';

const MAX_AGE_SECONDS = Number(process.env.AUTH_SESSION_MAX_AGE_SECONDS || 60 * 60 * 24 * 30);
const isProd = process.env.NODE_ENV === 'production';
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || undefined;
const MEDPLUM_BASE_URL = env.MEDPLUM_BASE_URL.replace(/\/$/, '');
const MEDPLUM_CLIENT_ID = env.MEDPLUM_CLIENT_ID || process.env.NEXT_PUBLIC_MEDPLUM_CLIENT_ID || '';
const MEDPLUM_PROJECT_ID = process.env.NEXT_PUBLIC_MEDPLUM_PROJECT_ID || '';

type ClinicAssignment = {
  id: string;
  subdomain: string;
};

class LoginRouteError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = 'LoginRouteError';
  }
}

function createPkcePair(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');
  return { codeVerifier, codeChallenge };
}

function setCookie(
  cookieStore: Awaited<ReturnType<typeof cookies>>,
  name: string,
  value: string,
  maxAge = MAX_AGE_SECONDS,
  httpOnly = true
): void {
  cookieStore.set(name, value, {
    httpOnly,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge,
    domain: COOKIE_DOMAIN,
  });
}

function deleteCookie(
  cookieStore: Awaited<ReturnType<typeof cookies>>,
  name: string,
  httpOnly = true
): void {
  cookieStore.set(name, '', {
    httpOnly,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    domain: COOKIE_DOMAIN,
  });
}

async function startEmailPasswordLogin(
  email: string,
  password: string,
  codeChallenge: string
): Promise<string> {
  const response = await fetch(`${MEDPLUM_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      clientId: MEDPLUM_CLIENT_ID,
      projectId: MEDPLUM_PROJECT_ID || undefined,
      scope: 'openid profile offline_access',
      codeChallenge,
      codeChallengeMethod: 'S256',
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new LoginRouteError(
      'AUTH_CREDENTIALS',
      payload?.error_description || payload?.error || 'Incorrect email or password.',
      401
    );
  }

  if (typeof payload?.code !== 'string') {
    if (Array.isArray(payload?.memberships) && payload.memberships.length > 1) {
      throw new LoginRouteError(
        'AUTH_CLINIC_REQUIRED',
        'This account belongs to multiple clinics. Sign in from the correct clinic subdomain.',
        409
      );
    }

    throw new LoginRouteError(
      'AUTH_CONFIG',
      'Login succeeded but no authorization code was returned.',
      500
    );
  }

  return payload.code;
}

async function exchangeAuthorizationCode(
  code: string,
  codeVerifier: string
): Promise<{ accessToken: string; refreshToken: string | undefined; expiresIn: number | undefined }> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: MEDPLUM_CLIENT_ID,
    code_verifier: codeVerifier,
  });

  const response = await fetch(`${MEDPLUM_BASE_URL}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || typeof payload?.access_token !== 'string') {
    throw new LoginRouteError(
      'AUTH_CONFIG',
      payload?.error_description || payload?.error || 'Token exchange failed.',
      500
    );
  }

  return {
    accessToken: payload.access_token,
    refreshToken: typeof payload.refresh_token === 'string' ? payload.refresh_token : undefined,
    expiresIn: typeof payload.expires_in === 'number' ? payload.expires_in : undefined,
  };
}

async function isPlatformAdmin(medplum: MedplumClient): Promise<boolean> {
  try {
    const me = await medplum.get('auth/me');
    return me?.membership?.admin === true;
  } catch {
    return false;
  }
}

async function getAssignedClinics(
  medplum: MedplumClient,
  profile: ProfileResource
): Promise<ClinicAssignment[]> {
  if (profile.resourceType !== 'Practitioner' || !profile.id) {
    return [];
  }

  const roles = await medplum.searchResources('PractitionerRole', {
    practitioner: `Practitioner/${profile.id}`,
    _count: '100',
  });

  const orgIds = Array.from(
    new Set(
      (roles ?? [])
        .map((role) => role.organization?.reference)
        .filter((ref): ref is string => Boolean(ref?.startsWith('Organization/')))
        .map((ref) => ref.replace('Organization/', ''))
    )
  );

  const organizations = await Promise.all(
    orgIds.map(async (id) => {
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
      subdomain:
        org.identifier?.find((identifier) => identifier.system === 'clinic')?.value ||
        org.id!,
    }));
}

export async function POST(req: NextRequest) {
  try {
    if (!MEDPLUM_CLIENT_ID) {
      throw new LoginRouteError(
        'AUTH_CONFIG',
        'Medplum client ID is not configured.',
        500
      );
    }

    const { email, password, next } = await req.json();
    if (!email || !password) {
      return NextResponse.json(
        { code: 'AUTH_CREDENTIALS', error: 'Email and password are required.' },
        { status: 400 }
      );
    }

    const hostContext = deriveSubdomainContext(getHostFromHeaders(req.headers));
    const { codeVerifier, codeChallenge } = createPkcePair();
    const code = await startEmailPasswordLogin(
      String(email).trim().toLowerCase(),
      String(password),
      codeChallenge
    );
    const tokenResult = await exchangeAuthorizationCode(code, codeVerifier);

    const medplum = new MedplumClient({ baseUrl: MEDPLUM_BASE_URL });
    medplum.setAccessToken(tokenResult.accessToken);

    const profile = await medplum.getProfileAsync();
    if (!profile) {
      throw new LoginRouteError(
        'AUTH_CONFIG',
        'No Medplum profile is available for this account.',
        500
      );
    }

    const [admin, assignedClinics] = await Promise.all([
      isPlatformAdmin(medplum),
      getAssignedClinics(medplum, profile as ProfileResource),
    ]);

    let activeClinicId: string | null = null;
    let redirectUrl = '/dashboard';

    if (hostContext.type === 'admin') {
      if (!admin) {
        throw new LoginRouteError(
          'AUTH_FORBIDDEN',
          'Platform admin access is required on this host.',
          403
        );
      }
      redirectUrl =
        typeof next === 'string' && next.startsWith('/admin') ? next : '/admin';
    } else if (hostContext.type === 'clinic') {
      const matchedClinic = assignedClinics.find(
        (clinic) =>
          clinic.subdomain === hostContext.clinicId || clinic.id === hostContext.clinicId
      );

      if (!matchedClinic) {
        throw new LoginRouteError(
          'AUTH_CLINIC_FORBIDDEN',
          `You are not assigned to clinic '${hostContext.clinicId}'.`,
          403
        );
      }

      activeClinicId = matchedClinic.subdomain;
      redirectUrl = typeof next === 'string' && next.startsWith('/') ? next : '/dashboard';
    } else if (!admin) {
      if (assignedClinics.length === 1) {
        activeClinicId = assignedClinics[0].subdomain;
      } else if (assignedClinics.length === 0) {
        throw new LoginRouteError(
          'AUTH_CLINIC_REQUIRED',
          'This account is not assigned to any clinic.',
          403
        );
      } else {
        throw new LoginRouteError(
          'AUTH_CLINIC_REQUIRED',
          'This account belongs to multiple clinics. Sign in from the correct clinic subdomain.',
          409
        );
      }
    } else {
      redirectUrl =
        typeof next === 'string' && next.startsWith('/admin') ? next : '/admin';
    }

    const cookieStore = await cookies();
    setCookie(cookieStore, SESSION_COOKIE, tokenResult.accessToken, MAX_AGE_SECONDS, true);
    if (tokenResult.refreshToken) {
      setCookie(cookieStore, REFRESH_COOKIE, tokenResult.refreshToken, MAX_AGE_SECONDS, true);
    } else {
      deleteCookie(cookieStore, REFRESH_COOKIE, true);
    }

    if (activeClinicId) {
      setCookie(cookieStore, CLINIC_COOKIE, activeClinicId, MAX_AGE_SECONDS, false);
    } else {
      deleteCookie(cookieStore, CLINIC_COOKIE, false);
    }

    return NextResponse.json({
      success: true,
      isAdmin: admin,
      clinicId: activeClinicId,
      redirectUrl,
    });
  } catch (error) {
    if (error instanceof LoginRouteError) {
      return NextResponse.json(
        { code: error.code, error: error.message },
        { status: error.status }
      );
    }

    const message = error instanceof Error ? error.message : 'Login failed';
    return NextResponse.json(
      { code: 'AUTH_UNKNOWN', error: message },
      { status: 500 }
    );
  }
}
