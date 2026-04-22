import { loadEnvConfig } from "@next/env";
import { defineConfig, devices } from "@playwright/test";

loadEnvConfig(process.cwd());

// ---------------------------------------------------------------------------
// URL resolution
//
// Production:  set EMR_CLINIC_URL / EMR_ADMIN_URL in CI secrets
// Local dev:   PLAYWRIGHT_ENV=local  or just run without the env vars
//              → uses http://localhost:3000
// ---------------------------------------------------------------------------
const isLocal = process.env.PLAYWRIGHT_ENV === "local" || !process.env.EMR_CLINIC_URL;

const CLINIC_URL = isLocal
  ? "http://localhost:3000"
  : process.env.EMR_CLINIC_URL || "https://klinikputeri.drhidayat.com";

const ADMIN_URL = isLocal
  ? "http://localhost:3000"
  : process.env.EMR_ADMIN_URL || "https://admin.drhidayat.com";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
  ],
  outputDir: "test-results",
  use: {
    headless: true,
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    trace: "on-first-retry",
  },

  projects: [
    // ── Clinic auth setup ───────────────────────────────────────────────────
    {
      name: "clinic-auth-setup",
      testMatch: /setup\/clinic-auth\.setup\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: CLINIC_URL,
      },
    },

    // ── Admin auth setup ────────────────────────────────────────────────────
    {
      name: "admin-auth-setup",
      testMatch: /setup\/admin-auth\.setup\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: ADMIN_URL,
      },
    },

    // ── Clinic workflow tests ───────────────────────────────────────────────
    {
      name: "clinic",
      testMatch: [
        "**/clinic-login.spec.ts",
        "**/patients-list.spec.ts",
        "**/patients.spec.ts",
        "**/consultation.spec.ts",
        "**/orders.spec.ts",
        "**/queue.spec.ts",
        "**/triage.spec.ts",
        "**/check-in.spec.ts",
        "**/referrals.spec.ts",
      ],
      use: {
        ...devices["Desktop Chrome"],
        baseURL: CLINIC_URL,
        storageState: "tests/e2e/.auth/klinikputeri.json",
      },
      dependencies: ["clinic-auth-setup"],
    },

    // ── Admin portal tests ──────────────────────────────────────────────────
    {
      name: "admin",
      testMatch: /admin\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: ADMIN_URL,
        storageState: "tests/e2e/.auth/admin.json",
      },
      dependencies: ["admin-auth-setup"],
    },

    // ── Smoke tests (no auth required, run against any env) ─────────────────
    {
      name: "smoke",
      testMatch: /(credential-check|emr-auth)\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: CLINIC_URL,
      },
    },
  ],
});
