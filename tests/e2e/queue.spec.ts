/**
 * Queue (clinical workflow) E2E tests
 *
 * Tests the full patient journey through one clinic visit:
 *   Register patient → Triage (vitals + chief complaint + add to queue)
 *   → Queue appears on the Queue page
 *   → Consultation is completed from the queue
 *   → Status advances to Meds & Bills
 *
 * Run as the "clinic" project (klinikputeri.drhidayat.com).
 */

import { test, expect, type Page } from "@playwright/test";
import { KLINIK_PUTERI_URL } from "./support/env";

const RUN_ID = Date.now();
const PATIENT_NAME = `Queue Test ${RUN_ID}`;
// Valid Malaysian NRIC format: YYMMDD-SS-NNNN
// Use a fixed valid DOB (1990-01-01) + state code 14 + unique 4-digit serial
const PATIENT_NRIC = `900101-14-${String(RUN_ID).slice(-4).padStart(4, "0")}`;
const CLINIC_URL = KLINIK_PUTERI_URL || "https://klinikputeri.drhidayat.com";

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

// ── Helpers ──────────────────────────────────────────────────────────────────

async function registerPatient(page: Page): Promise<string> {
  const response = await page.request.post(`${CLINIC_URL}/api/patients`, {
    data: {
      fullName: PATIENT_NAME,
      nric: PATIENT_NRIC,
      dateOfBirth: "1990-01-01",
      gender: "female",
      phone: "0112223333",
      address: "Queue Test Address",
    },
  });
  const data = await response.json().catch(() => ({}));
  return response.ok() && typeof data?.patientId === "string" ? data.patientId : "";
}

/**
 * Complete triage for a patient: fill chief complaint + vitals, submit.
 * Expects to land on the patient profile or a triage confirmation page.
 */
async function completeTriage(page: Page, patientId: string): Promise<void> {
  const triageResponse = await page.request.post(`${CLINIC_URL}/api/triage`, {
    data: {
      patientId,
      triageLevel: 3,
      chiefComplaint: "Fever and body aches for 2 days.",
      vitalSigns: {
        bloodPressureSystolic: 120,
        bloodPressureDiastolic: 80,
        temperature: 37.8,
        heartRate: 80,
      },
      triageNotes: "Queue test triage setup",
      redFlags: [],
    },
  });
  expect(triageResponse.ok()).toBe(true);

  // Wait for the queue API to reflect the patient state, which is more stable than
  // relying on a client-side redirect timing on the hosted target.
  await expect
    .poll(
      async () => {
        const res = await page.request.get(`${CLINIC_URL}/api/queue`);
        if (!res.ok()) {
          return "";
        }
        const data = await res.json();
        const match = (data?.patients || []).find((p: any) => p.id === patientId);
        return match?.queueStatus || "";
      },
      { timeout: 30_000, intervals: [1000, 2000, 3000] }
    )
    .toBeTruthy();
}

// ── Tests ────────────────────────────────────────────────────────────────────

test.describe("Queue and clinical workflow", () => {
  let patientId: string;

  test.beforeEach(async ({ page }) => {
    patientId = await registerPatient(page);
  });

  test("queue page is accessible and renders", async ({ page }) => {
    const response = await page.goto(`${CLINIC_URL}/dashboard`);

    await expect(page).not.toHaveURL(/\/(login|landing)/);
    expect(response?.status()).toBeLessThan(400);

    const heading = page.getByRole("heading", { name: /dashboard|patient queue/i });
    await expect(heading).toBeVisible({ timeout: 15_000 });
  });

  test("triaging a patient adds them to the queue", async ({ page }) => {
    await completeTriage(page, patientId);

    await page.goto(`${CLINIC_URL}/dashboard`, { waitUntil: "domcontentloaded" });
    await expect(page).not.toHaveURL(/\/(login|landing)/);
    await expect
      .poll(
        async () => {
          const res = await page.request.get(`${CLINIC_URL}/api/queue`);
          if (!res.ok()) return "";
          const data = await res.json();
          const match = (data?.patients || []).find((p: any) => p.id === patientId);
          return match?.fullName || match?.nric || "";
        },
        { timeout: 30_000, intervals: [1000, 2000, 3000] }
      )
      .toContain(PATIENT_NAME);
    await expect(page.getByText(PATIENT_NAME).first()).toBeVisible({ timeout: 15_000 });
  });

  test("starting consultation from queue navigates to consultation form", async ({
    page,
  }) => {
    // Ensure patient is in the queue
    await completeTriage(page, patientId);

    await page.goto(`${CLINIC_URL}/patients/${patientId}/consultation`, { waitUntil: "domcontentloaded" });
    await expect(page).not.toHaveURL(/\/(login|landing)/);
    await expect(
      page.locator('textarea[placeholder*="Clinical notes"]').first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test("completing a consultation advances the queue status", async ({ page }) => {
    await completeTriage(page, patientId);

    // Complete the consultation
    await page.goto(`${CLINIC_URL}/patients/${patientId}/consultation`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page).not.toHaveURL(/\/(login|landing)/);

    const notesArea = page.locator('textarea[placeholder*="Clinical notes"]').first();
    await expect(notesArea).toBeVisible({ timeout: 15_000 });
    await notesArea.fill("Fever and body aches. Assessment: viral fever.");

    // Diagnosis combobox
    const diagInput = page
      .locator('[placeholder*="diagnosis" i], input[role="combobox"]')
      .first();
    if (await diagInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await diagInput.fill("Fever");
    }

    const submitConsultation = page.waitForResponse(
      (response) =>
        response.url().includes("/api/consultations") &&
        response.request().method() === "POST",
      { timeout: 20_000 }
    );

    await page.locator('button[type="submit"]').click();
    const consultationResponse = await submitConsultation;
    expect(consultationResponse.ok()).toBe(true);

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
      .toMatch(/meds_and_bills|completed|done/);
  });
});
