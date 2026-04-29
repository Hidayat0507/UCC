/**
 * Admin Portal Tests
 *
 * Verifies that the super-admin user can:
 *  1. Reach the admin portal after login
 *  2. See the platform overview with clinic + module counts
 *  3. Navigate to the clinic management pages
 *  4. Access the user management page
 */

import { test, expect, type Page } from "@playwright/test";
import fs from "fs";
import path from "path";

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

function adminPath(pathname: string): string {
  const clean = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const base = process.env.EMR_ADMIN_URL || "";
  const host = base ? new URL(base).hostname : "";
  const isAdminSubdomain = host.split(".")[0] === "admin";
  const isLocalhost = !host || host === "localhost" || host === "127.0.0.1";

  if (isAdminSubdomain) {
    return clean;
  }

  return isLocalhost || !clean.startsWith("/admin")
    ? clean === "/"
      ? "/admin"
      : `/admin${clean}`
    : clean;
}

function appOrigin(): string {
  const base = process.env.EMR_ADMIN_URL || "http://localhost:3000";
  const url = new URL(base);
  const parts = url.hostname.split(".");
  if (parts[0] === "admin" && parts.length >= 3) {
    url.hostname = parts.slice(1).join(".");
  }
  url.pathname = "";
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

function apiPath(pathname: string): string {
  const clean = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${appOrigin()}${clean}`;
}

async function fetchClinics(page: Page) {
  const response = await page.request.get(apiPath("/api/admin/clinics"));
  expect(response.ok()).toBeTruthy();
  return (await response.json()).clinics ?? [];
}

async function expectOk(response: Awaited<ReturnType<Page["request"]["get"]>>) {
  if (response.ok()) {
    return;
  }
  const body = await response.text().catch(() => "");
  throw new Error(`Expected ${response.url()} to be OK, got ${response.status()}: ${body}`);
}

test.describe("Admin portal", () => {
  test.beforeEach(async ({}, testInfo) => {
    if (!hasAdminSession()) {
      testInfo.annotations.push({
        type: "skip-reason",
        description:
          "Admin portal requires support@iatrum.com to be added as a " +
          "UCC Production project member in Medplum. Once added, re-run auth setup.",
      });
      test.skip();
    }
  });
  test("overview page loads with expected headings and cards", async ({
    page,
  }) => {
    await page.goto(adminPath("/"), { waitUntil: "domcontentloaded" });

    // Core heading
    await expect(
      page.getByRole("heading", { name: /admin portal/i })
    ).toBeVisible();

    // Stats cards
    await expect(
      page.locator('[data-slot="card-title"]').filter({ hasText: /^Total Clinics$/ }).first()
    ).toBeVisible();
    await expect(
      page.locator('[data-slot="card-title"]').filter({ hasText: /^Active Modules$/ }).first()
    ).toBeVisible();
    await expect(
      page.locator('[data-slot="card-title"]').filter({ hasText: /^Platform$/ }).first()
    ).toBeVisible();

    // Clinics list section
    await expect(
      page.locator('[data-slot="card-title"]').filter({ hasText: /^Clinics$/ }).first()
    ).toBeVisible();

    await page.screenshot({ path: "test-results/admin-overview.png" });
  });

  test("clinic list is displayed and has at least one entry", async ({
    page,
  }) => {
    await page.goto(adminPath("/"), { waitUntil: "domcontentloaded" });

    const clinics = await fetchClinics(page);
    if (clinics.length === 0) {
      await expect(page.getByText(/no branches yet|no clinics/i)).toBeVisible();
      return;
    }

    await expect(page.getByText(clinics[0].name).first()).toBeVisible();
  });

  test("can navigate to /clinics", async ({ page }) => {
    await page.goto(adminPath("/clinics"), { waitUntil: "domcontentloaded" });
    // Should not 404
    const status = await page
      .request
      .get(adminPath("/clinics"))
      .then((r) => r.status());
    expect(status).toBeLessThan(400);
    await page.screenshot({ path: "test-results/admin-clinics.png" });
  });

  test("can navigate to /users", async ({ page }) => {
    await page.goto(adminPath("/users"), { waitUntil: "domcontentloaded" });
    const status = await page.request
      .get(adminPath("/users"))
      .then((r) => r.status());
    expect(status).toBeLessThan(400);
    await page.screenshot({ path: "test-results/admin-users.png" });
  });

  test("Add Clinic button links to /clinics/new", async ({ page }) => {
    await page.goto(adminPath("/"), { waitUntil: "domcontentloaded" });
    const addBtn = page.getByRole("link", { name: /add clinic/i });
    await expect(addBtn).toBeVisible();
    await expect(addBtn).toHaveAttribute("href", /\/clinics\/new$/);
  });
});

test.describe.serial("Admin clinic and user CRUD", () => {
  test.beforeEach(async ({}, testInfo) => {
    if (!hasAdminSession()) {
      testInfo.annotations.push({
        type: "skip-reason",
        description:
          "Admin portal requires a saved admin session. Re-run admin auth setup with MEDPLUM_ADMIN_EMAIL / MEDPLUM_ADMIN_PASSWORD.",
      });
      test.skip();
    }
  });

  test("can create, update, and delete a clinic and assigned user", async ({
    page,
  }, testInfo) => {
    const suffix = `${Date.now()}-${testInfo.retry}`;
    const clinicName = `E2E CRUD Clinic ${suffix}`;
    const updatedClinicName = `E2E CRUD Clinic Updated ${suffix}`;
    const subdomain = `e2e-crud-${suffix}`.slice(0, 63);
    const phone = "+60 3-1111 2222";
    const updatedPhone = "+60 3-3333 4444";
    const address = `E2E Test Address ${suffix}`;
    const updatedAddress = `E2E Updated Address ${suffix}`;
    const firstName = "E2E";
    const lastName = `User ${suffix}`;
    const updatedFirstName = "E2EUpdated";
    const email = `e2e-crud-${suffix}@example.invalid`;
    const password = `E2e-${suffix}!`;

    let clinicId: string | undefined;
    let userId: string | undefined;

    async function deleteUserIfPresent() {
      if (!userId) return;
      await page.request.delete(apiPath(`/api/admin/users/${userId}`)).catch(() => null);
      userId = undefined;
    }

    async function deleteClinicIfPresent() {
      if (!clinicId) return;
      await page.request.delete(apiPath(`/api/admin/clinics/${clinicId}`)).catch(() => null);
      clinicId = undefined;
    }

    try {
      const orgResponse = await page.request.get(apiPath("/api/admin/organisation"));
      await expectOk(orgResponse);
      const orgData = await orgResponse.json();
      if (!Array.isArray(orgData.organisations) || orgData.organisations.length === 0) {
        test.skip(true, "Create a parent organisation before running branch CRUD tests.");
      }

      await page.goto(adminPath("/clinics/new"), { waitUntil: "domcontentloaded" });
      await page.getByLabel(/branch name/i).fill(clinicName);
      await page.getByLabel(/subdomain/i).fill(subdomain);
      await page.getByLabel(/phone/i).fill(phone);
      await page.getByLabel(/address/i).fill(address);
      await page.getByRole("button", { name: /create branch/i }).click();

      await expect(page).toHaveURL(/\/clinics$/);
      await expect(page.getByText(clinicName)).toBeVisible();

      const clinicsAfterCreate = await fetchClinics(page);
      const createdClinic = clinicsAfterCreate.find(
        (clinic: any) => clinic.name === clinicName && clinic.subdomain === subdomain
      );
      expect(createdClinic).toBeTruthy();
      clinicId = createdClinic.id;

      await page
        .locator('[data-slot="card"]')
        .filter({ hasText: clinicName })
        .getByRole("link", { name: /^edit$/i })
        .click();
      await expect(page.getByRole("heading", { name: clinicName })).toBeVisible();
      await page.getByLabel(/branch name/i).fill(updatedClinicName);
      await page.getByLabel(/phone/i).fill(updatedPhone);
      await page.getByLabel(/address/i).fill(updatedAddress);
      await page.getByRole("button", { name: /save changes/i }).click();

      await expect(page.getByRole("heading", { name: updatedClinicName })).toBeVisible();
      const clinicRead = await page.request.get(apiPath(`/api/admin/clinics/${clinicId}`));
      expect(clinicRead.ok()).toBeTruthy();
      await expect
        .poll(async () => (await (await page.request.get(apiPath(`/api/admin/clinics/${clinicId}`))).json()).name)
        .toBe(updatedClinicName);

      await page.goto(adminPath("/users/invite"), { waitUntil: "domcontentloaded" });
      await page.getByLabel(/clinic/i).click();
      await page.getByRole("option", { name: new RegExp(updatedClinicName) }).click();
      await page.getByLabel(/first name/i).fill(firstName);
      await page.getByLabel(/last name/i).fill(lastName);
      await page.getByLabel(/email/i).fill(email);
      await page.getByLabel(/temporary password/i).fill(password);
      await page.getByRole("button", { name: /create user/i }).click();

      await expect(page).toHaveURL(/\/users$/);
      await expect(page.getByText(email)).toBeVisible({ timeout: 20_000 });
      const userLink = page.getByRole("link").filter({ hasText: email }).first();
      const href = await userLink.getAttribute("href");
      userId = href?.match(/\/users\/([^/?#]+)/)?.[1];
      expect(userId).toBeTruthy();

      await userLink.click();
      await expect(page.getByRole("heading", { name: new RegExp(`${firstName}.*${lastName}`) })).toBeVisible();
      await page.getByLabel(/first name/i).fill(updatedFirstName);
      await page.getByRole("button", { name: /save changes/i }).click();

      await expect(
        page.getByRole("heading", { name: new RegExp(`${updatedFirstName}.*${lastName}`) })
      ).toBeVisible();
      const userRead = await page.request.get(apiPath(`/api/admin/users/${userId}`));
      expect(userRead.ok()).toBeTruthy();
      const userData = await userRead.json();
      expect(userData.firstName).toBe(updatedFirstName);
      expect(userData.organizationIds).toContain(clinicId);

      await page.getByRole("button", { name: /delete user/i }).click();
      await page.getByRole("button", { name: /delete permanently/i }).click();
      await expect(page).toHaveURL(/\/users$/);
      await expect(page.getByText(email)).toHaveCount(0);
      userId = undefined;

      await page.goto(adminPath(`/clinics/${clinicId}`), { waitUntil: "domcontentloaded" });
      await page.getByRole("button", { name: /delete branch/i }).click();
      await page.getByRole("button", { name: /delete permanently/i }).click();
      await expect(page).toHaveURL(/\/clinics$/);
      await expect(page.getByText(updatedClinicName)).toHaveCount(0);
      const deletedClinic = await page.request.get(apiPath(`/api/admin/clinics/${clinicId}`));
      expect(deletedClinic.status()).toBe(404);
      clinicId = undefined;
    } finally {
      await deleteUserIfPresent();
      await deleteClinicIfPresent();
    }
  });
});
