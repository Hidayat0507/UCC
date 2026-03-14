import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import * as crypto from 'node:crypto';
import { MedplumClient, type ProfileResource } from '@medplum/core';
import { deriveHostContext } from '@/lib/server/host-context';
import { getAssignedClinics } from '@/lib/server/medplum-auth';

const COOKIE_NAME = 'medplum-session';
const CLINIC_COOKIE_NAME = 'medplum-clinic';
const PLATFORM_ADMIN_COOKIE_NAME = 'medplum-platform-admin';
const MAX_AGE_SECONDS = 60 * 60 * 24;
const isProd = process.env.NODE_ENV === 'production';
const BASE_DOMAIN = process.env.NEXT_PUBLIC_BASE_DOMAIN?.replace(/^\./, '');
const COOKIE_DOMAIN =
  process.env.COOKIE_DOMAIN || (isProd && BASE_DOMAIN ? `.${BASE_DOMAIN}` : undefined);
const MEDPLUM_BASE_URL = process.env.MEDPLUM_BASE_URL || process.env.NEXT_PUBLIC_MEDPLUM_BASE_URL || 'http://localhost:8103';

function setCookie(cookieStore: Awaited<ReturnType<typeof cookies>>, name: string, value: string, maxAge = MAX_AGE_SECONDS, httpOnly = true) {
  cookieStore.set(name, value, {
    httpOnly,
    secure: isProd,
    sameSite: 'lax',
    maxAge,
    path: '/',
    domain: COOKIE_DOMAIN,
  });
}

function createPkcePair(): { codeVerifier: string; codeChallenge: string; codeChallengeMethod: 'S256' } {
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
  return {
    codeVerifier,
    codeChallenge,
    codeChallengeMethod: 'S256',
  };
}

async function startEmailPasswordLogin(email: string, password: string, codeChallenge: string, codeChallengeMethod: 'S256') {
  const response = await fetch(`${MEDPLUM_BASE_URL.replace(/\/$/, '')}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password,
      clientId: process.env.MEDPLUM_CLIENT_ID,
      scope: 'openid profile',
      codeChallenge,
      codeChallengeMethod,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || typeof payload?.code !== 'string') {
    throw new Error(payload?.error_description || payload?.error || 'Login failed');
  }

  return payload as { code: string };
}

async function exchangeAuthorizationCode(code: string, codeVerifier: string) {
  const body = new URLSearchParams();
  body.set('grant_type', 'authorization_code');
  body.set('code', code);
  body.set('client_id', process.env.MEDPLUM_CLIENT_ID || '');
  body.set('code_verifier', codeVerifier);

  const response = await fetch(`${MEDPLUM_BASE_URL.replace(/\/$/, '')}/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || typeof payload?.access_token !== 'string') {
    throw new Error(payload?.error_description || payload?.error || 'Token exchange failed');
  }

  return payload as { access_token: string; expires_in?: number };
}

export async function POST(req: NextRequest) {
  try {
    const { email, password, next } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const hostContext = deriveHostContext(req.headers.get('host'), BASE_DOMAIN);
    if (hostContext.type === 'none') {
      return NextResponse.json({ error: 'Direct login is not available on this host' }, { status: 403 });
    }

    if (!process.env.MEDPLUM_CLIENT_ID) {
      throw new Error('Medplum client ID is not configured');
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const { codeVerifier, codeChallenge, codeChallengeMethod } = createPkcePair();
    const loginResult = await startEmailPasswordLogin(
      normalizedEmail,
      String(password),
      codeChallenge,
      codeChallengeMethod
    );
    const tokenResult = await exchangeAuthorizationCode(loginResult.code, codeVerifier);
    const accessToken = tokenResult.access_token;

    const medplum = new MedplumClient({ baseUrl: MEDPLUM_BASE_URL });
    medplum.setAccessToken(accessToken);
    const profile = ((await medplum.getProfileAsync()) ?? medplum.getProfile()) as ProfileResource | undefined;
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
    let activeClinic: string | null = null;
    let redirectUrl: string;

    if (hostContext.type === 'admin') {
      if (!isPlatformAdmin) {
        return NextResponse.json({ error: 'Platform admin access required' }, { status: 403 });
      }
      redirectUrl =
        typeof next === 'string' && next.startsWith('/admin')
          ? next
          : '/admin';
    } else {
      const allowedClinic = clinics.find(
        (clinic) => clinic.subdomain === hostContext.clinicId || clinic.id === hostContext.clinicId
      );
      if (!allowedClinic) {
        return NextResponse.json({ error: 'You are not assigned to this clinic' }, { status: 403 });
      }

      activeClinic = allowedClinic.subdomain;
      redirectUrl =
        typeof next === 'string' && next.startsWith('/')
          ? next
          : '/dashboard';
    }

    const cookieStore = await cookies();
    const maxAge =
      typeof tokenResult.expires_in === 'number' && tokenResult.expires_in > 0
        ? tokenResult.expires_in
        : MAX_AGE_SECONDS;

    setCookie(cookieStore, COOKIE_NAME, accessToken, maxAge, true);
    if (activeClinic) {
      setCookie(cookieStore, CLINIC_COOKIE_NAME, activeClinic, maxAge, false);
    } else {
      setCookie(cookieStore, CLINIC_COOKIE_NAME, '', 0, false);
    }
    setCookie(cookieStore, PLATFORM_ADMIN_COOKIE_NAME, isPlatformAdmin ? 'true' : 'false', maxAge, false);

    return NextResponse.json({
      success: true,
      isAdmin: isPlatformAdmin,
      clinicId: activeClinic,
      redirectUrl,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Login failed' },
      { status: 401 }
    );
  }
}
