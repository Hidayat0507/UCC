/**
 * Auth Setup — runs once before all workflow spec files.
 *
 * Logs in as the clinic user (required) and attempts the admin user (optional).
 * Persists browser state so downstream tests start already authenticated.
 *
 * Credentials are read from environment variables so this file never contains
 * real passwords. For local dev, set them in .env.test.local or pass them on
 * the command line:
 *
 *   CLINIC_EMAIL=... CLINIC_PASSWORD=... bun run test:e2e
 *
 * Required:
 *   CLINIC_EMAIL       e.g. apex-group-admin@iatrum.com
 *   CLINIC_PASSWORD
 *
 * Optional (admin portal — skip gracefully if not set):
 *   MEDPLUM_ADMIN_EMAIL
 *   MEDPLUM_ADMIN_PASSWORD
 */

import { test as setup, expect } from "@playwright/test";
import path from "path";
import fs from "fs";

const CLINIC_EMAIL = process.env.CLINIC_EMAIL;
const CLINIC_PASSWORD = process.env.CLINIC_PASSWORD;

const ADMIN_EMAIL = process.env.MEDPLUM_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.MEDPLUM_ADMIN_PASSWORD;

const AUTH_DIR = path.join(__dirname, ".auth");
fs.mkdirSync(AUTH_DIR, { recursive: true });

// ── Clinic user (required) ─────────────────────────────────────────────────

setup("clinic user login", async ({ page, baseURL }) => {
  if (!CLINIC_EMAIL || !CLINIC_PASSWORD) {
    // Write empty state so dependent tests skip gracefully rather than crash.
    fs.writeFileSync(
      path.join(AUTH_DIR, "clinic.json"),
      JSON.stringify({ cookies: [], origins: [] })
    );
    setup.skip(true, "CLINIC_EMAIL / CLINIC_PASSWORD not set — skipping auth setup");
    return;
  }

  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Welcome back")).toBeVisible({ timeout: 15_000 });

  await page.fill("#email", CLINIC_EMAIL);
  await page.fill("#password", CLINIC_PASSWORD);
  await page.click('button[type="submit"]');

  // Clinic users land on /dashboard
  await page.waitForURL(/\/dashboard/, { timeout: 25_000 });
  await expect(page).not.toHaveURL(/\/login/);

  await page.context().storageState({ path: path.join(AUTH_DIR, "clinic.json") });
  console.log("✅ Clinic auth state saved");
});

// ── Admin user (optional) ──────────────────────────────────────────────────

setup("admin portal access", async ({ page }) => {
  const emptyState = JSON.stringify({ cookies: [], origins: [] });
  const adminStatePath = path.join(AUTH_DIR, "admin.json");

  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    fs.writeFileSync(adminStatePath, emptyState);
    console.log("ℹ️  MEDPLUM_ADMIN_EMAIL not set — admin tests will be skipped");
    return;
  }

  try {
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Welcome back")).toBeVisible({ timeout: 10_000 });

    await page.fill("#email", ADMIN_EMAIL);
    await page.fill("#password", ADMIN_PASSWORD);
    await page.click('button[type="submit"]');

    await page.waitForFunction(async () => {
      const onNonLoginPage = !window.location.pathname.includes("/login");
      if (onNonLoginPage) {
        return true;
      }

      const hasAdminHeading = Boolean(
        document.querySelector("h1, h2, [role='heading']")
          ?.textContent
          ?.match(/admin portal|ucc admin|overview/i)
      );
      if (hasAdminHeading) {
        return true;
      }

      const hasSessionCookie = document.cookie.includes("medplum-session=");
      const hasAdminCookie = document.cookie.includes("medplum-platform-admin=true");
      return hasSessionCookie || hasAdminCookie;
    }, { timeout: 20_000 });

    await page.waitForTimeout(1000);

    const storageState = await page.context().storageState();
    if (!Array.isArray(storageState.cookies) || storageState.cookies.length === 0) {
      throw new Error("Admin login did not persist any browser cookies");
    }

    await page.context().storageState({ path: adminStatePath });
    console.log("✅ Admin auth state saved");
  } catch (err) {
    console.warn(`⚠️  Admin login failed (${err}) — admin tests will be skipped`);
    fs.writeFileSync(adminStatePath, emptyState);
  }
});
