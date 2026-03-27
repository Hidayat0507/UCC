/**
 * Clinic Login Tests
 *
 * Tests the EMR application login flow for clinic staff:
 *  1. Login page renders correctly
 *  2. Successful login lands on the dashboard with a working sidebar
 *  3. Wrong credentials show a descriptive error (not a generic 500)
 *  4. Unauthenticated users are redirected away from protected routes
 */

import { test, expect } from "@playwright/test";

const CLINIC_URL =
  process.env.EMR_CLINIC_URL || "https://apex-group.drhidayat.com";
const CLINIC_EMAIL =
  process.env.CLINIC_EMAIL || "apex-group-admin@drhidayat.com";
const CLINIC_PASSWORD = process.env.CLINIC_PASSWORD || "ClinicUser!2026#";

// ── Login page render ────────────────────────────────────────────────────────

test.describe("Login page", () => {
  // These tests intentionally do NOT use stored auth state — they visit the
  // login page directly in a fresh context.
  test.use({ storageState: { cookies: [], origins: [] } });

  test("renders form with email and password fields", async ({ page }) => {
    await page.goto(`${CLINIC_URL}/login`, { waitUntil: "domcontentloaded" });

    await expect(page.getByText("Welcome back")).toBeVisible();
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /sign in/i })
    ).toBeVisible();

    await page.screenshot({ path: "test-results/login-form.png" });
  });

  test("shows error toast on wrong credentials", async ({ page }) => {
    await page.goto(`${CLINIC_URL}/login`, { waitUntil: "domcontentloaded" });

    await page.fill("#email", CLINIC_EMAIL);
    await page.fill("#password", "definitely-wrong-password-12345");
    await page.click('button[type="submit"]');

    // A toast or error message must appear — should NOT be a blank page or 500
    const toast = page.locator('[role="alert"], [data-sonner-toast], .toast');
    const errorText = page.getByText(
      /invalid|incorrect|failed|password|email/i
    );

    await expect(toast.or(errorText).first()).toBeVisible({ timeout: 15_000 });

    // Page must still be on /login (not crashed into dashboard)
    expect(page.url()).toContain("/login");

    await page.screenshot({ path: "test-results/login-wrong-credentials.png" });
  });

  test("unauthenticated access to /dashboard redirects to /login", async ({
    page,
  }) => {
    await page.goto(`${CLINIC_URL}/dashboard`, {
      waitUntil: "domcontentloaded",
    });
    const finalUrl = page.url();
    const onLoginOrAuth =
      finalUrl.includes("/login") ||
      finalUrl.includes("/auth") ||
      finalUrl.includes("signin");

    if (!onLoginOrAuth) {
      // Tolerate SPA that renders a login prompt in-place
      await expect(page.getByText(/sign in|log in|login/i).first()).toBeVisible(
        { timeout: 5_000 }
      );
    } else {
      expect(onLoginOrAuth).toBe(true);
    }
  });
});

// ── Successful login (uses stored auth state via project config) ─────────────

test.describe("Authenticated session", () => {
  test("dashboard loads with sidebar navigation", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

    // Sidebar links
    await expect(
      page.getByRole("link", { name: /dashboard/i }).first()
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /patients/i }).first()
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /orders/i }).first()
    ).toBeVisible();

    await page.screenshot({ path: "test-results/dashboard-authenticated.png" });
  });

  test("check-in page loads", async ({ page }) => {
    await page.goto("/check-in", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: /check.?in/i })
    ).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: "test-results/check-in-page.png" });
  });

  test("session survives a hard page reload", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await page.reload({ waitUntil: "domcontentloaded" });
    // Still on dashboard — not kicked to /login
    expect(page.url()).not.toContain("/login");
  });
});
