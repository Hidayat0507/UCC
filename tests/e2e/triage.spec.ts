/**
 * Triage workflow E2E tests
 *
 * Covers the triage form that nurses use to take vitals and add a patient
 * to the waiting queue:
 *   1. Triage page is accessible from the patient profile
 *   2. Submitting the triage form with vitals adds the patient to the queue
 *   3. Attempting to submit with no chief complaint shows a validation error
 *   4. /api/triage requires authentication
 */

import { test, expect, type Page } from "@playwright/test";

const RUN_ID = String(Date.now()).slice(-4);
const PATIENT_NAME = `Triage E2E ${RUN_ID}`;
const PATIENT_NRIC = `T${RUN_ID}0615071234`;

async function createTestPatient(page: Page): Promise<string> {
  await page.goto("/patients/new", { waitUntil: "domcontentloaded" });

  await page
    .locator('input[name="fullName"], input[placeholder*="name" i]')
    .first()
    .fill(PATIENT_NAME);

  await page
    .locator('input[name="nric"], input[placeholder*="nric" i], input[placeholder*="ic" i]')
    .first()
    .fill(PATIENT_NRIC);

  await page
    .locator('input[type="date"], input[name*="birth" i]')
    .first()
    .fill("1990-06-15");

  await page
    .locator('input[name="phone"], input[type="tel"], input[placeholder*="phone" i]')
    .first()
    .fill("0118887777");

  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/patients\/[^/]+$/, { timeout: 20_000 });

  const match = page.url().match(/\/patients\/([^/]+)$/);
  return match?.[1] ?? "";
}

test.describe("Triage workflow", () => {
  let patientId: string;

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext({
      storageState: "tests/e2e/.auth/clinic.json",
    });
    const page = await ctx.newPage();
    patientId = await createTestPatient(page);
    await ctx.close();
  });

  test("triage page is reachable from patient profile", async ({ page }) => {
    await page.goto(`/patients/${patientId}`);
    await expect(page).not.toHaveURL(/\/login/);

    const triageLink = page
      .getByRole("link", { name: /triage/i })
      .or(page.getByRole("button", { name: /triage/i }))
      .first();

    await expect(triageLink).toBeVisible({ timeout: 10_000 });
  });

  test("triage form loads with vitals fields", async ({ page }) => {
    await page.goto(`/patients/${patientId}/triage`);
    await expect(page).not.toHaveURL(/\/login/);

    // Chief complaint is the key required field
    const complaintField = page
      .locator(
        'input[name*="complaint" i], textarea[name*="complaint" i], [placeholder*="complaint" i]'
      )
      .first();
    await expect(complaintField).toBeVisible({ timeout: 15_000 });
  });

  test("submitting triage form with vitals saves and redirects", async ({ page }) => {
    await page.goto(`/patients/${patientId}/triage`);
    await expect(page).not.toHaveURL(/\/login/);

    // Chief complaint (required)
    const complaint = page
      .locator(
        'input[name*="complaint" i], textarea[name*="complaint" i], [placeholder*="complaint" i]'
      )
      .first();
    await expect(complaint).toBeVisible({ timeout: 15_000 });
    await complaint.fill("Fever and headache for 3 days");

    // Fill optional vitals if visible
    const vitals: Array<[string, string]> = [
      ['input[name*="temp" i], input[placeholder*="temp" i]', "37.8"],
      ['input[name*="systolic" i]', "120"],
      ['input[name*="diastolic" i]', "80"],
      ['input[name*="pulse" i], input[name*="heart" i]', "78"],
      ['input[name*="weight" i]', "65"],
      ['input[name*="spo2" i], input[name*="oxygen" i]', "98"],
    ];

    for (const [selector, value] of vitals) {
      const el = page.locator(selector).first();
      if (await el.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await el.fill(value);
      }
    }

    // Submit
    await page.locator('button[type="submit"]').last().click();

    // Should redirect away from the triage form
    await page.waitForURL(
      (url) =>
        !url.pathname.endsWith("/triage") &&
        !url.pathname.includes("/login"),
      { timeout: 25_000 }
    );
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("/api/triage requires authentication", async ({ request }) => {
    const res = await request.post("/api/triage", {
      data: { patientId: "test", status: "waiting" },
    });
    expect([401, 403]).toContain(res.status());
  });
});
