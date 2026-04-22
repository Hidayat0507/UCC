/**
 * Referral workflow E2E tests
 *
 * Covers the patient profile referral tab:
 *  1. Referral section renders and shows the empty state
 *  2. Submitting an empty referral shows validation feedback
 *  3. Happy-path: generate and save a referral for a fresh patient
 *
 * The letter-generation API is stubbed in-browser for the happy-path test so
 * the workflow remains stable even if external LLM credentials are missing.
 * The actual referral save still hits the deployed backend.
 */

import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  KLINIK_PUTERI_URL,
  KLINIK_PUTERI_EMAIL,
  KLINIK_PUTERI_PASSWORD,
} from "./support/env";

const CLINIC_URL = KLINIK_PUTERI_URL || "https://klinikputeri.iatrum.com";
const RUN_ID = String(Date.now()).slice(-4).padStart(4, "0");
const PATIENT_NAME = `Referral E2E ${RUN_ID}`;
const PATIENT_NRIC = `910101-10-${RUN_ID}`;
const PATIENT_PHONE = `0139001${RUN_ID}`;

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

async function registerTestPatient(page: Page): Promise<string> {
  await page.goto(`${CLINIC_URL}/patients/new`, { waitUntil: "domcontentloaded" });
  if (page.url().includes("/login")) {
    await ensureClinicSession(page);
    await page.goto(`${CLINIC_URL}/patients/new`, { waitUntil: "domcontentloaded" });
  }

  await page.getByLabel(/full name/i).first().fill(PATIENT_NAME);
  await page.locator('input[name="nric"]').first().fill(PATIENT_NRIC);
  await selectGender(page, "female");
  await page
    .locator('input[placeholder*="contact number" i], input[placeholder*="phone" i]')
    .first()
    .fill(PATIENT_PHONE);

  const createPatient = page.waitForResponse(
    (response) =>
      response.url().includes("/api/patients") &&
      response.request().method() === "POST",
    { timeout: 20_000 }
  );

  await page.locator('button[type="submit"]').click();

  const response = await createPatient;
  if (response.status() !== 200) {
    throw new Error(`Patient create failed with status ${response.status()}`);
  }

  const data = await response.json();
  const patientId = data?.patientId;
  if (!patientId || typeof patientId !== "string") {
    throw new Error(`Patient create did not return patientId: ${JSON.stringify(data)}`);
  }

  await page.goto(`${CLINIC_URL}/patients/${patientId}`, {
    waitUntil: "domcontentloaded",
  });
  return patientId;
}

async function ensureClinicSession(page: Page): Promise<void> {
  if (!page.url().includes("/login")) {
    return;
  }

  await page.locator('input[type="email"]').fill(KLINIK_PUTERI_EMAIL);
  await page.locator('input[type="password"]').fill(KLINIK_PUTERI_PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), {
    timeout: 30_000,
  });
}

async function openReferralTab(page: Page, patientId: string): Promise<Locator> {
  await page.goto(`${CLINIC_URL}/patients/${patientId}`, {
    waitUntil: "domcontentloaded",
  });
  await expect(
    page.getByRole("heading", { name: new RegExp(PATIENT_NAME, "i") }).first()
  ).toBeVisible({ timeout: 20_000 });

  const referralTab = page.getByRole("tab", { name: /referral \/ mc/i });
  await expect(referralTab).toBeVisible({ timeout: 10_000 });
  await referralTab.click();

  const sectionTitle = page.getByText(/referral letters/i).first();
  await expect(sectionTitle).toBeVisible({ timeout: 10_000 });
  return sectionTitle;
}

async function selectOption(trigger: Locator, page: Page, optionName: string): Promise<void> {
  await expect(trigger).toBeVisible({ timeout: 10_000 });
  await trigger.click();
  await page.getByRole("option", { name: new RegExp(`^${optionName}$`, "i") }).click();
}

test.describe("Referral workflow", () => {
  test("referral section renders with empty state", async ({ page }) => {
    const patientId = await registerTestPatient(page);
    await openReferralTab(page, patientId);
    await expect(page.getByText(/manage patient referrals/i)).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText(/no referrals yet\./i)).toBeVisible({
      timeout: 20_000,
    });
  });

  test("empty referral submission shows validation feedback", async ({ page }) => {
    const patientId = await registerTestPatient(page);
    await openReferralTab(page, patientId);

    await page.getByRole("button", { name: /new referral/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: /generate referral letter/i })
    ).toBeVisible({ timeout: 10_000 });

    await dialog.getByRole("button", { name: /generate referral/i }).click();

    await expect(page.getByText(/missing information/i).first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(
      page
        .getByText(/please select specialty, facility and provide a reason\./i)
        .first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test("happy-path: generate and save referral", async ({ page }) => {
    const patientId = await registerTestPatient(page);
    await page.route("**/api/referral-letter", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          letter:
            "Dear Colleague,\n\nPlease review this patient for persistent exertional chest discomfort.\n\nRegards,\nE2E Clinic",
          modelUsed: "e2e-stub",
        }),
      });
    });

    await openReferralTab(page, patientId);
    await page.getByRole("button", { name: /new referral/i }).click();

    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: /generate referral letter/i })
    ).toBeVisible({ timeout: 10_000 });

    const dialogComboboxes = dialog.getByRole("combobox");
    await selectOption(dialogComboboxes.nth(0), page, "Cardiology");
    await selectOption(dialogComboboxes.nth(1), page, "General Hospital");
    await dialog.getByPlaceholder(/enter department or unit/i).fill("Outpatient Cardiology");
    await dialog.getByPlaceholder(/doctor's name/i).fill("Dr E2E Referral");
    await selectOption(dialogComboboxes.nth(2), page, "Urgent");
    await dialog
      .getByPlaceholder(/describe the reason for referral/i)
      .fill("Persistent exertional chest discomfort requiring specialist assessment.");
    await dialog
      .getByPlaceholder(/relevant clinical information/i)
      .fill("Intermittent chest pain for one week. No syncope. ECG pending.");

    const referralSave = page.waitForResponse(
      (response) =>
        response.url().includes("/api/referrals") &&
        response.request().method() === "POST" &&
        response.status() === 200,
      { timeout: 20_000 }
    );

    await dialog.getByRole("button", { name: /generate referral/i }).click();
    await referralSave;

    await expect(page.getByText(/referral saved/i).first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(/cardiology referral/i).first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole("button", { name: /view/i }).first()).toBeVisible({
      timeout: 10_000,
    });
  });
});
