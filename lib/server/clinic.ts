import { cookies, headers } from 'next/headers';
import { NextRequest } from 'next/server';
import { CLINIC_COOKIE } from '@/lib/server/cookie-constants';
import {
  deriveSubdomainContext,
  getHostFromHeaders,
  getHostFromNextRequest,
} from '@/lib/server/subdomain-host';

/**
 * Resolve clinic scope for server routes.
 *
 * Security model:
 *  - Prefer clinic id derived from the request Host (set by the client connection /
 *    edge proxy), not from arbitrary client headers like x-clinic-id.
 *  - On localhost / apex hosts with no clinic subdomain, fall back to the
 *    login/session clinic cookie (still server-set via login or medplum-session).
 *  - Medplum access control remains the enforcement layer for data access.
 */
export async function getClinicIdFromRequest(req: NextRequest): Promise<string | null> {
  const host = getHostFromNextRequest(req);
  const fromHost = deriveSubdomainContext(host);
  if (fromHost.type === 'clinic') {
    return fromHost.clinicId;
  }

  const cookieStore = await cookies();
  return (
    req.cookies.get(CLINIC_COOKIE)?.value ||
    cookieStore.get(CLINIC_COOKIE)?.value ||
    null
  );
}

/** Server components: clinic scope from host subdomain, else login/session cookie. */
export async function resolveClinicIdFromServerScope(): Promise<string | undefined> {
  const h = await headers();
  const host = getHostFromHeaders(h);
  const ctx = deriveSubdomainContext(host);
  if (ctx.type === 'clinic') return ctx.clinicId;
  const cookieStore = await cookies();
  return cookieStore.get(CLINIC_COOKIE)?.value ?? undefined;
}
