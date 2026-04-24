#!/usr/bin/env bun
/**
 * validate-env.ts
 *
 * Checks that every required environment variable is set before the app
 * starts or before a deployment is promoted.
 *
 * Run manually:
 *   bun run scripts/validate-env.ts
 *
 * Add to package.json "build" or Vercel "buildCommand" to fail fast:
 *   "build": "bun run scripts/validate-env.ts && next build"
 */

interface EnvVar {
  key: string;
  /** If true the build/startup fails; otherwise just a warning */
  required: boolean;
  /** Short description shown in the error output */
  description: string;
  /** Optional: validate the value format */
  validate?: (value: string) => boolean;
  validateHint?: string;
}

const VARS: EnvVar[] = [
  // ── Medplum (FHIR backend) ─────────────────────────────────────────────
  {
    key: "MEDPLUM_BASE_URL",
    required: true,
    description: "Base URL of the self-hosted Medplum API (e.g. https://fhir.iatrum.com)",
    validate: (v) => v.startsWith("http"),
    validateHint: "Must start with http:// or https://",
  },
  {
    key: "NEXT_PUBLIC_MEDPLUM_BASE_URL",
    required: true,
    description: "Public-facing Medplum base URL (same as MEDPLUM_BASE_URL in most deployments)",
    validate: (v) => v.startsWith("http"),
    validateHint: "Must start with http:// or https://",
  },
  {
    key: "NEXT_PUBLIC_MEDPLUM_PROJECT_ID",
    required: true,
    description: "Medplum project UUID (visible in the Medplum admin UI)",
    validate: (v) => /^[0-9a-f-]{36}$/.test(v),
    validateHint: "Must be a valid UUID (8-4-4-4-12 hex format)",
  },
  {
    key: "MEDPLUM_CLIENT_ID",
    required: true,
    description: "Medplum OAuth2 client ID for server-side requests",
  },
  {
    key: "NEXT_PUBLIC_MEDPLUM_CLIENT_ID",
    required: true,
    description: "Public Medplum client ID (used in the browser auth flow)",
  },
  {
    key: "MEDPLUM_CLIENT_SECRET",
    required: true,
    description: "Medplum OAuth2 client secret (keep this server-side only)",
    validate: (v) => v.length >= 20,
    validateHint: "Should be at least 20 characters",
  },

  // ── Domain / routing ───────────────────────────────────────────────────
  {
    key: "NEXT_PUBLIC_BASE_DOMAIN",
    required: true,
    description: "Root domain for subdomain routing (e.g. iatrum.com)",
    validate: (v) => v.includes(".") && !v.startsWith("http"),
    validateHint: "Must be a bare domain like iatrum.com — no protocol prefix",
  },
  {
    key: "COOKIE_DOMAIN",
    required: false,
    description: "Cookie domain for cross-subdomain sessions (e.g. .iatrum.com). Defaults to host if unset.",
  },

  // ── Optional AI / integrations ─────────────────────────────────────────
  {
    key: "OPENROUTER_API_KEY",
    required: false,
    description: "OpenRouter API key for AI-assisted features (SOAP rewrite, transcription)",
  },
];

// ── Runner ─────────────────────────────────────────────────────────────────

const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const GREEN = "\x1b[32m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

if (process.env.SKIP_ENV_VALIDATION === "1") {
  console.log(`${YELLOW}${BOLD}Skipping environment validation (SKIP_ENV_VALIDATION=1).${RESET}\n`);
  process.exit(0);
}

let hasErrors = false;
let hasWarnings = false;

console.log(`\n${BOLD}Validating environment variables…${RESET}\n`);

for (const { key, required, description, validate, validateHint } of VARS) {
  const value = process.env[key];

  if (!value) {
    if (required) {
      console.error(
        `${RED}${BOLD}✗ MISSING (required)${RESET}  ${BOLD}${key}${RESET}\n` +
        `   ${description}\n`
      );
      hasErrors = true;
    } else {
      console.warn(
        `${YELLOW}⚠ MISSING (optional)${RESET}  ${key}\n` +
        `   ${description}\n`
      );
      hasWarnings = true;
    }
    continue;
  }

  if (validate && !validate(value)) {
    const severity = required ? `${RED}${BOLD}✗ INVALID (required)` : `${YELLOW}⚠ INVALID (optional)`;
    console.error(
      `${severity}${RESET}  ${BOLD}${key}${RESET}\n` +
      `   ${validateHint}\n`
    );
    if (required) hasErrors = true;
    else hasWarnings = true;
    continue;
  }

  console.log(`${GREEN}✓${RESET}  ${key}`);
}

console.log("");

if (hasErrors) {
  console.error(
    `${RED}${BOLD}Environment validation FAILED.${RESET}\n` +
    `Fix the missing/invalid variables above, then retry.\n`
  );
  process.exit(1);
} else if (hasWarnings) {
  console.warn(
    `${YELLOW}Environment validation passed with warnings.${RESET}\n` +
    `Optional variables are unset — some features may be unavailable.\n`
  );
} else {
  console.log(
    `${GREEN}${BOLD}All environment variables are valid.${RESET}\n`
  );
}
