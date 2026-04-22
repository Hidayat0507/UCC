import { defineConfig, devices } from "@playwright/test";

const CLINIC_URL =
  process.env.CLINIC_URL || "https://klinikputeri.drhidayat.com";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ["list"],
    ["html", { outputFolder: "../playwright-report", open: "never" }],
  ],
  outputDir: "../test-results",

  projects: [
    // ── Setup: log in once and save the session cookie ──────────────────────
    {
      name: "clinic-setup",
      testMatch: /setup\/clinic-auth\.setup\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: CLINIC_URL,
        headless: true,
      },
    },

    // ── Authenticated clinic tests (patient, consultation, queue) ────────────
    {
      name: "clinic",
      testMatch: /\/(patient|consultation|queue)\.spec\.ts/,
      dependencies: ["clinic-setup"],
      use: {
        ...devices["Desktop Chrome"],
        baseURL: CLINIC_URL,
        headless: true,
        storageState: "e2e/.auth/klinikputeri.json",
        screenshot: "only-on-failure",
        video: "retain-on-failure",
        trace: "retain-on-failure",
      },
    },

    // ── Auth & credential smoke tests (no saved session needed) ──────────────
    {
      name: "chromium",
      testMatch: /(emr-auth|credential-check)\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: process.env.EMR_URL || "https://drhidayat.com",
        headless: true,
        screenshot: "only-on-failure",
        video: "retain-on-failure",
        trace: "retain-on-failure",
      },
    },
  ],
});
