/**
 * Admin Portal Tests
 *
 * Verifies that the super-admin user can:
 *  1. Reach the admin portal after login
 *  2. See the platform overview with clinic + module counts
 *  3. Navigate to the clinic management pages
 *  4. Access the user management page
 */

import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

// baseURL is set to https://admin.drhidayat.com in playwright.config.ts for this project

// Detect whether the admin auth setup succeeded (non-empty cookies = real session)
const AUTH_STATE_PATH = path.join(__dirname, ".auth/admin.json");
function hasAdminSession(): boolean {
  try {
    const state = JSON.parse(fs.readFileSync(AUTH_STATE_PATH, "utf-8"));
    return Array.isArray(state.cookies) && state.cookies.length > 0;
  } catch {
    return false;
  }
}

test.describe("Admin portal", () => {
  test.beforeEach(async ({}, testInfo) => {
    if (!hasAdminSession()) {
      testInfo.annotations.push({
        type: "skip-reason",
        description:
          "Admin portal requires support@drhidayat.com to be added as a " +
          "UCC Production project member in Medplum. Once added, re-run auth setup.",
      });
      test.skip();
    }
  });
  test("overview page loads with expected headings and cards", async ({
    page,
  }) => {
    await page.goto("/admin", { waitUntil: "domcontentloaded" });

    // Core heading
    await expect(
      page.getByRole("heading", { name: /admin portal/i })
    ).toBeVisible();

    // Stats cards
    await expect(page.getByText("Total Clinics")).toBeVisible();
    await expect(page.getByText("Active Modules")).toBeVisible();
    await expect(page.getByText("Platform")).toBeVisible();

    // Clinics list section
    await expect(page.getByText("Clinics")).toBeVisible();

    await page.screenshot({ path: "test-results/admin-overview.png" });
  });

  test("clinic list is displayed and has at least one entry", async ({
    page,
  }) => {
    await page.goto("/admin", { waitUntil: "domcontentloaded" });

    // There should be at least one clinic on the seeded platform
    const clinicCount = await page
      .locator('[class*="divide-y"] > div')
      .count();
    expect(clinicCount).toBeGreaterThan(0);
  });

  test("can navigate to /admin/clinics", async ({ page }) => {
    await page.goto("/admin/clinics", { waitUntil: "domcontentloaded" });
    // Should not 404
    const status = await page
      .request
      .get("/admin/clinics")
      .then((r) => r.status());
    expect(status).toBeLessThan(400);
    await page.screenshot({ path: "test-results/admin-clinics.png" });
  });

  test("can navigate to /admin/users", async ({ page }) => {
    await page.goto("/admin/users", { waitUntil: "domcontentloaded" });
    const status = await page.request
      .get("/admin/users")
      .then((r) => r.status());
    expect(status).toBeLessThan(400);
    await page.screenshot({ path: "test-results/admin-users.png" });
  });

  test("Add Clinic button links to /admin/clinics/new", async ({ page }) => {
    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    const addBtn = page.getByRole("link", { name: /add clinic/i });
    await expect(addBtn).toBeVisible();
    await expect(addBtn).toHaveAttribute("href", "/admin/clinics/new");
  });
});
