import { test, expect } from "@playwright/test";
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  CLINIC_USERS,
  EMR_URL,
  MEDPLUM_UI_URL,
  missingEnvVars,
} from "./support/env";
import { annotateMissingEnv, loginToMedplumUi } from "./support/auth";

test.describe("Production credential and site checks", () => {
  test("iatrum.com landing page loads", async ({ page }, testInfo) => {
    const missing = missingEnvVars({ EMR_URL });
    if (missing.length) {
      annotateMissingEnv(testInfo, missing);
      test.skip();
    }

    const response = await page.goto(EMR_URL, { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBeLessThan(400);
    await expect(page).toHaveTitle(/UCC EMR/i);
  });

  test("EMR staff login page is accessible", async ({ page }) => {
    // The login form lives on clinic subdomains — the root domain redirects to /landing.
    const clinicUrl =
      process.env.EMR_CLINIC_URL || "https://apex-group.iatrum.com";
    await page.goto(`${clinicUrl}/login`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("#email")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("#password")).toBeVisible();
  });

  test("Medplum self-hosted UI loads", async ({ page }, testInfo) => {
    const missing = missingEnvVars({ MEDPLUM_UI_URL });
    if (missing.length) {
      annotateMissingEnv(testInfo, missing);
      test.skip();
    }

    const response = await page.goto(`${MEDPLUM_UI_URL}/signin`, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    expect(response?.status()).toBeLessThan(400);
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test("Medplum admin login", async ({ page }, testInfo) => {
    const missing = missingEnvVars({ MEDPLUM_UI_URL, ADMIN_EMAIL, ADMIN_PASSWORD });
    if (missing.length) {
      annotateMissingEnv(testInfo, missing);
      test.skip();
    }

    await loginToMedplumUi(page, {
      medplumUiUrl: MEDPLUM_UI_URL,
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });
  });

  for (const user of CLINIC_USERS) {
    test(`Medplum clinic user login: ${user.label}`, async ({ page }, testInfo) => {
      const missing = missingEnvVars({
        MEDPLUM_UI_URL,
        clinic_user_password: user.password,
      });
      if (missing.length) {
        annotateMissingEnv(testInfo, missing);
        test.skip();
      }

      await loginToMedplumUi(page, {
        medplumUiUrl: MEDPLUM_UI_URL,
        email: user.email,
        password: user.password,
      });
    });
  }
});
