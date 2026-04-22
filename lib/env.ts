/**
 * Centralised environment variable validation.
 *
 * Imported by any module that needs env vars. Throws at module
 * evaluation time with a clear message if a required variable is
 * missing, so misconfigurations surface at boot rather than on the
 * first request.
 *
 * Pattern: import { env } from '@/lib/env'
 */

import { z } from 'zod';

const envSchema = z.object({
  // ── Medplum ──────────────────────────────────────────────────────────
  MEDPLUM_BASE_URL: z
    .string()
    .url('MEDPLUM_BASE_URL must be a valid URL')
    .default('http://localhost:8103'),

  MEDPLUM_CLIENT_ID: z.string().min(1, 'MEDPLUM_CLIENT_ID is required').optional(),
  MEDPLUM_CLIENT_SECRET: z.string().min(1, 'MEDPLUM_CLIENT_SECRET is required').optional(),

  // ── Session / cookies ────────────────────────────────────────────────
  COOKIE_DOMAIN: z.string().optional(),

  // ── App domain ───────────────────────────────────────────────────────
  NEXT_PUBLIC_BASE_DOMAIN: z.string().optional(),
  NEXT_PUBLIC_MEDPLUM_BASE_URL: z
    .string()
    .url('NEXT_PUBLIC_MEDPLUM_BASE_URL must be a valid URL')
    .optional(),

  // ── Optional features ────────────────────────────────────────────────
  OPENAI_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  MEDPLUM_BULK_EXPORT_SECRET: z.string().optional(),

  // ── Runtime ──────────────────────────────────────────────────────────
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
});

function parseEnv() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  • ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    throw new Error(
      `\n\n❌ Invalid environment configuration:\n${formatted}\n\n` +
        'Check your .env.local file and ensure all required variables are set.\n'
    );
  }

  return result.data;
}

export const env = parseEnv();

/**
 * Validates that admin Medplum credentials are present.
 * Call this before using getAdminMedplum() in contexts where you want
 * an early, clear error rather than a vague runtime failure.
 */
export function requireAdminCredentials(): void {
  if (!env.MEDPLUM_CLIENT_ID || !env.MEDPLUM_CLIENT_SECRET) {
    throw new Error(
      'Admin Medplum credentials are not configured. ' +
        'Set MEDPLUM_CLIENT_ID and MEDPLUM_CLIENT_SECRET in your environment.'
    );
  }
}
