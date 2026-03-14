import { NextRequest, NextResponse } from 'next/server';
import { deriveHostContext, isBaseDomainHost } from '@/lib/server/host-context';

const CLINIC_COOKIE_NAME = 'medplum-clinic';
const IS_ADMIN_COOKIE_NAME = 'medplum-is-admin';
const SESSION_COOKIE_NAME = 'medplum-session';
const PLATFORM_ADMIN_COOKIE_NAME = 'medplum-platform-admin';
const BASE_DOMAIN = process.env.NEXT_PUBLIC_BASE_DOMAIN || ''; // e.g. example.com
const COOKIE_DOMAIN = BASE_DOMAIN ? `.${BASE_DOMAIN.replace(/^\./, '')}` : undefined;
const LANDING_PATH = process.env.NEXT_PUBLIC_LANDING_PATH || '/landing';
const AUTH_DISABLED =
  process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true' || process.env.DISABLE_AUTH === 'true';
const PUBLIC_PATH_PREFIXES = ['/login', '/landing', '/api/'];

function setClinicCookie(res: NextResponse, clinicId: string) {
  res.cookies.set(CLINIC_COOKIE_NAME, clinicId, {
    httpOnly: false,
    sameSite: 'lax',
    secure: true,
    path: '/',
    domain: COOKIE_DOMAIN,
  });
}

// Auth is intentionally open, but we still derive clinic from subdomain to scope requests.
export function proxy(req: NextRequest) {
  const host = req.headers.get('host');
  const context = deriveHostContext(host, BASE_DOMAIN);
  const { pathname } = req.nextUrl;
  const hasSession = Boolean(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  const isPlatformAdmin = req.cookies.get(PLATFORM_ADMIN_COOKIE_NAME)?.value === 'true';
  const isPublicPath = PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (context.type === 'admin') {
    if (pathname === '/') {
      const url = req.nextUrl.clone();
      url.pathname = '/admin';
      return NextResponse.redirect(url);
    }

    if (!pathname.startsWith('/admin') && !pathname.startsWith('/login') && !pathname.startsWith('/api/')) {
      const url = req.nextUrl.clone();
      url.pathname = `/admin`;
      return NextResponse.redirect(url);
    }

    if (!AUTH_DISABLED && !hasSession && !isPublicPath) {
      const loginUrl = new URL('/login', req.url);
      loginUrl.searchParams.set('next', `${pathname}${req.nextUrl.search}`);
      return NextResponse.redirect(loginUrl);
    }
  }

  if (context.type === 'clinic') {
    if (pathname === '/') {
      const url = req.nextUrl.clone();
      url.pathname = hasSession ? '/dashboard' : '/login';
      return NextResponse.redirect(url);
    }

    if (!AUTH_DISABLED && !hasSession && !isPublicPath) {
      const loginUrl = new URL('/login', req.url);
      loginUrl.searchParams.set('next', `${pathname}${req.nextUrl.search}`);
      return NextResponse.redirect(loginUrl);
    }
  }

  if (isBaseDomainHost(host, BASE_DOMAIN) && pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL(LANDING_PATH, req.url));
  }

  if (isBaseDomainHost(host, BASE_DOMAIN) && pathname.startsWith('/admin') && BASE_DOMAIN) {
    const url = req.nextUrl.clone();
    url.host = `admin.${BASE_DOMAIN}`;
    return NextResponse.redirect(url);
  }

  if (context.type !== 'clinic' && pathname === '/' && isBaseDomainHost(host, BASE_DOMAIN)) {
    return NextResponse.redirect(new URL(LANDING_PATH, req.url));
  }

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-current-path', pathname);

  const res = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  res.cookies.set(IS_ADMIN_COOKIE_NAME, pathname.startsWith('/admin') ? 'true' : 'false', {
    httpOnly: false,
    sameSite: 'lax',
    path: '/',
    domain: COOKIE_DOMAIN,
  });
  if (context.type === 'clinic' && hasSession) {
    const existing = req.cookies.get(CLINIC_COOKIE_NAME)?.value;
    if (existing !== context.clinicId) {
      setClinicCookie(res, context.clinicId);
    }
  }

  return res;
}

export const config = {
  matcher: ['/((?!_next|static|favicon.ico|manifest.json).*)'],
};
