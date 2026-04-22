import { NextResponse } from 'next/server';
import { env } from '@/lib/env';

/**
 * GET /api/health/deep
 *
 * Readiness-style health check. Unlike /api/health, this verifies
 * connectivity to Medplum and reports key deployment assumptions.
 */
export async function GET() {
  const checks: Record<string, string> = {};
  let healthy = true;

  checks.medplum_base_url = env.MEDPLUM_BASE_URL ? 'ok' : 'missing';
  checks.public_medplum_base_url =
    env.NEXT_PUBLIC_MEDPLUM_BASE_URL ? 'ok' : 'missing';
  checks.base_domain = env.NEXT_PUBLIC_BASE_DOMAIN ? 'ok' : 'missing';
  checks.cookie_domain = env.COOKIE_DOMAIN ? 'configured' : 'default_host_only';

  try {
    const response = await fetch(`${env.MEDPLUM_BASE_URL.replace(/\/$/, '')}/healthcheck`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    checks.medplum_connectivity = response.ok ? 'ok' : `http_${response.status}`;
    if (!response.ok) healthy = false;
  } catch (error) {
    checks.medplum_connectivity = 'unreachable';
    healthy = false;
  }

  if (!env.MEDPLUM_BASE_URL || !env.NEXT_PUBLIC_BASE_DOMAIN) {
    healthy = false;
  }

  return NextResponse.json(
    {
      status: healthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: healthy ? 200 : 503 }
  );
}
