import { NextResponse } from 'next/server';
import { env } from '@/lib/env';

/**
 * GET /api/health
 *
 * Lightweight health check used by load balancers, uptime monitors,
 * and deployment readiness probes. Returns 200 when the app is
 * running and its configuration is valid; 503 otherwise.
 *
 * Does NOT call Medplum so it responds in < 5 ms even when Medplum
 * is down — that is intentional. Use /api/health/deep for a full
 * connectivity check (not yet implemented).
 */
export async function GET() {
  const checks: Record<string, string> = {};
  let healthy = true;

  // ── Config checks ────────────────────────────────────────────
  checks.medplum_base_url = env.MEDPLUM_BASE_URL ? 'ok' : 'missing';
  if (!env.MEDPLUM_BASE_URL) healthy = false;

  checks.admin_credentials = env.MEDPLUM_CLIENT_ID && env.MEDPLUM_CLIENT_SECRET
    ? 'ok'
    : 'not_configured';

  checks.node_env = env.NODE_ENV;

  const status = healthy ? 200 : 503;

  return NextResponse.json(
    {
      status: healthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      checks,
    },
    { status }
  );
}
