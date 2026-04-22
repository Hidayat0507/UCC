/**
 * Registration workflow E2E (YEZZA-style wizard)
 *
 * Covers:
 *  1. Registration page renders step wizard and patient type switch
 *  2. New patient -> Visit Information -> consultation handoff
 *  3. Existing patient search/select inside registration wizard
 */

import { test, expect } from "@playwright/test";

const RUN_ID = String(Date.now()).slice(-5).padStart(5, "0");
const TEST_NAME = `[E2E] Reg ${RUN_ID}`;
const TEST_NRIC = `900101-10-${RUN_ID.slice(-4)}`;
const TEST_PHONE = `01234${RUN_ID}`;

async function selectGender(page: any, gender: "male" | "female") {
  const trigger = page.getByRole("combobox").nth(1);
  await expect(trigger).toBeVisible({ timeout: 10_000 });
  await trigger.click();
  await page.keyboard.press("ArrowDown");
  if (gender === "female") {
    await page.keyboard.press("ArrowDown");
  }
  await page.keyboard.press("Enter");
}

test.describe("Registration wizard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/patients/new", { waitUntil: "domcontentloaded" });
  });

  test("renders patient and visit steps", async ({ page }) => {
    await expect(
      page.getByText(/new patient registration/i).first()
    ).toBeVisible({ timeout: 15_000 });

    await expect(page.getByRole("button", { name: /1\. patient information/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /2\. visit information/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /add new patient/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /search existing patient/i })).toBeVisible();

    await page.screenshot({ path: "test-results/registration-wizard-initial.png" });
  });

  test("creates new patient and reaches visit information step", async ({ page }) => {
    await page.goto("/patients/new", { waitUntil: "domcontentloaded" });

    await page.fill('input[name="fullName"]', TEST_NAME);
    const nricInput = page.locator('input[name="nric"]').first();
    await nricInput.fill(TEST_NRIC);
    await selectGender(page, "male");
    await page.fill('input[placeholder*="contact number" i], input[name="phone"]', TEST_PHONE);
    await page.getByRole("button", { name: /continue to visit information/i }).click();

    await expect(
      page.getByRole("heading", { name: /visit information/i })
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(new RegExp(TEST_NAME, "i")).first()).toBeVisible({ timeout: 10_000 });
  });

  test("existing patient mode can search and select inside step 1", async ({ page }) => {
    await page.goto("/patients/new", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /search existing patient/i }).click();
    const searchInput = page.getByPlaceholder(/search by name, nric, or phone/i);
    await expect(searchInput).toBeVisible({ timeout: 10_000 });
    await searchInput.fill(TEST_NRIC.slice(0, 6));
    await expect(
      page.locator("button").filter({ hasText: /NRIC:/i }).first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test("existing patient consultation handoff submits successfully", async ({ page }) => {
    await page.goto("/patients/new", { waitUntil: "domcontentloaded" });

    // create patient first
    await page.fill('input[name="fullName"]', `${TEST_NAME} Existing`);
    await page.fill('input[name="nric"]', `900101-10-${String(Number(RUN_ID.slice(-4)) + 1).padStart(4, "0")}`);
    await selectGender(page, "male");
    await page.fill('input[placeholder*="contact number" i], input[name="phone"]', `01235${RUN_ID}`);
    await page.getByRole("button", { name: /continue to visit information/i }).click();
    await page.getByRole("button", { name: /send to waiting area/i }).click();
    await page.waitForURL(/\/dashboard|\/patients\/[a-z0-9-]+$/, { timeout: 25_000 });

    // return and use existing mode
    await page.goto("/patients/new", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /search existing patient/i }).click();
    const existingSearch = page.getByPlaceholder(/search by name, nric, or phone/i);
    await existingSearch.fill(TEST_NAME);
    const pick = page.locator("button").filter({ hasText: new RegExp(`${TEST_NAME}`, "i") }).first();
    await expect(pick).toBeVisible({ timeout: 15_000 });
    await pick.click();
    await page.getByRole("button", { name: /continue to visit information/i }).click();
    await page.getByRole("button", { name: /send to waiting area/i }).click();
    await page.waitForURL(/\/dashboard|\/patients\/[a-z0-9-]+$/, { timeout: 25_000 });
  });
});
