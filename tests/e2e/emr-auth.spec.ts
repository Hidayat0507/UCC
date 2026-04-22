/**
 * EMR App Authentication & Access Control Tests
 *
 * Covers the three most critical flows for a multi-tenant medical app:
 * 1. Unauthenticated users are redirected to login
 * 2. Login page renders and is functional
 * 3. Protected routes (dashboard, patients) require a valid session
 */

import { test, expect } from "@playwright/test";
import { expectAuthRedirectOrBlock } from "./support/auth";
import { EMR_URL, KLINIK_PUTERI_URL } from "./support/env";

// The login *form* only exists on clinic subdomains.
// The root domain (drhidayat.com) redirects to /landing.
const CLINIC_URL =
  process.env.EMR_CLINIC_URL || "https://apex-group.drhidayat.com";

test.describe("EMR authentication and access control", () => {
  const protectedPages = ["/dashboard", "/patients"];

  // These APIs must not return 200 to unauthenticated callers.
  // Acceptable responses:
  //   400 — request rejected before session check (e.g. missing clinicId guard fires first)
  //   401 — explicit auth rejection (ideal — produced by requireClinicAuth once deployed)
  //   403 — forbidden
  //   405 — method not allowed
  //
  // NOTE: /api/queue currently returns 200 on the live site (unauthenticated access bug).
  // The fix is in app/api/queue/route.ts (requireClinicAuth) and takes effect after deploy.
  // This test will pass once the updated code is deployed to Vercel.
  const protectedApis: { path: string; accept: number[] }[] = [
    { path: "/api/patients",      accept: [400, 401, 403, 405] },
    { path: "/api/queue",         accept: [400, 401, 403, 405] },
    { path: "/api/consultations", accept: [400, 401, 403, 405] },
  ];

  for (const path of protectedPages) {
    test(`unauthenticated ${path} redirects or blocks access`, async ({ page }) => {
      await expectAuthRedirectOrBlock(page, `${EMR_URL}${path}`);
    });
  }

  // Login form lives on clinic subdomains, not the root domain
  test("login page loads and has email + password fields", async ({ page }) => {
    await page.goto(`${CLINIC_URL}/login`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("#email")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("#password")).toBeVisible();
  });

  for (const { path, accept } of protectedApis) {
    test(`${path} requires authentication`, async ({ request }) => {
      const response = await request.get(`${EMR_URL}${path}`);
      expect(accept).toContain(response.status());
    });
  }

  test("/api/patients on clinic subdomain rejects anonymous API calls", async ({ request }) => {
    const clinicBase = process.env.EMR_CLINIC_URL || KLINIK_PUTERI_URL;
    const response = await request.get(`${clinicBase}/api/patients?limit=1`);
    // 401 = no Medplum session cookie; 400 = clinic context guard (should not appear without token first)
    expect([400, 401, 403, 405]).toContain(response.status());
    if (response.status() === 401) {
      const body = await response.json().catch(() => ({}));
      expect(typeof (body as { error?: string }).error).toBe("string");
    }
  });

  // Export endpoint must reject requests that lack the shared secret.
  // Returns 401 (missing secret) or 500/503 (env not configured).
  test("/api/export-to-medplum rejects request without secret", async ({ request }) => {
    const response = await request.post(`${EMR_URL}/api/export-to-medplum`, {
      data: { action: "export_all" },
      headers: { "Content-Type": "application/json" },
    });
    expect([401, 500, 503]).toContain(response.status());
  });
});
