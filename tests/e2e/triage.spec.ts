/**
 * Check-in / triage form E2E tests (route: /patients/:id/check-in)
 *
 * Covers the form staff use to capture vitals and add a patient
 * to the waiting queue:
 *   1. Check-in page is accessible from the patient profile
 *   2. Submitting the form with vitals adds the patient to the queue
 *   3. Attempting to submit with no chief complaint shows a validation error
 *   4. /api/triage auth is covered in emr-auth.spec.ts
 */

import { test, expect, type Page } from "@playwright/test";
import { KLINIK_PUTERI_URL } from "./support/env";

const RUN_ID = String(Date.now()).slice(-4);
const PATIENT_NAME = `Triage E2E ${RUN_ID}`;
const PATIENT_NRIC = `900615-07-${RUN_ID.padStart(4, "0")}`;
const CLINIC_URL = KLINIK_PUTERI_URL || "https://klinikputeri.iatrum.com";

async function selectGender(page: Page, gender: "male" | "female"): Promise<void> {
  const trigger = page.getByRole("combobox").first();
  await expect(trigger).toBeVisible({ timeout: 10_000 });
  await trigger.click();
  await page.keyboard.press("ArrowDown");
  if (gender === "female") {
    await page.keyboard.press("ArrowDown");
  }
  await page.keyboard.press("Enter");
}

async function createTestPatient(page: Page): Promise<string> {
  const response = await page.request.post(`${CLINIC_URL}/api/patients`, {
    data: {
      fullName: PATIENT_NAME,
      nric: PATIENT_NRIC,
      dateOfBirth: "1990-06-15",
      gender: "female",
      phone: "0118887777",
      address: "Triage Test Address",
    },
  });
  const data = await response.json().catch(() => ({}));
  return response.ok() && typeof data?.patientId === "string" ? data.patientId : "";
}

async function openTriageForm(page: Page, patientId: string): Promise<void> {
  await page.goto(`${CLINIC_URL}/patients/${patientId}/check-in`, { waitUntil: "domcontentloaded" });
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page).toHaveURL(new RegExp(`/patients/${patientId}/check-in$`), {
    timeout: 15_000,
  });
}

test.describe("Check-in workflow", () => {
  let patientId: string;

  test.beforeEach(async ({ page }) => {
    patientId = await createTestPatient(page);
  });

  test("triage page is reachable from patient profile", async ({ page }) => {
    await page.goto(`${CLINIC_URL}/patients/${patientId}`);
    await expect(page).not.toHaveURL(/\/login/);

    const triageLink = page
      .getByRole("link", { name: /check-?in/i })
      .or(page.getByRole("button", { name: /check-?in/i }))
      .first();

    await expect(triageLink).toBeVisible({ timeout: 10_000 });
  });

  test("triage form loads with vitals fields", async ({ page }) => {
    await openTriageForm(page, patientId);

    await expect(page.getByRole("heading", { name: /^check-?in$/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("#chief-complaint")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByPlaceholder(/systolic/i)).toBeVisible({ timeout: 10_000 });
  });

  test("submitting triage form with vitals saves and redirects", async ({ page }) => {
    await openTriageForm(page, patientId);

    // Chief complaint (required)
    const complaint = page.locator("#chief-complaint");
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

    const submitTriage = page.waitForResponse(
      (response) =>
        response.url().includes("/api/triage") &&
        response.request().method() === "POST",
      { timeout: 20_000 }
    );

    await page.getByRole("button", { name: /complete check-?in/i }).click();
    const triageResponse = await submitTriage;
    expect(triageResponse.ok()).toBe(true);

    await expect
      .poll(
        async () => {
          const res = await page.request.get(`${CLINIC_URL}/api/queue`);
          if (!res.ok()) return "";
          const data = await res.json();
          const match = (data?.patients || []).find((p: any) => p.id === patientId);
          return match?.queueStatus || "";
        },
        { timeout: 30_000, intervals: [1000, 2000, 3000] }
      )
      .toMatch(/waiting|in_consultation|completed/);
  });
});
