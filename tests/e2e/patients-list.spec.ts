/**
 * Verifies the /patients list loads from /api/patients after auth bootstrap
 * (regression: race between Medplum localStorage token and httpOnly cookie).
 */

import { test, expect } from "@playwright/test";

test.describe("Patients list (authenticated)", () => {
  test("patients page does not show FHIR auth failure", async ({ page }) => {
    await page.goto("/patients", { waitUntil: "domcontentloaded" });

    const failureBanner = page.getByText(
      /Failed to load patient data from FHIR|Authentication required\. Please log in/i
    );
    await expect(failureBanner).toHaveCount(0, { timeout: 30_000 });

    await expect(page.getByRole("heading", { name: /^Patients$/i })).toBeVisible({
      timeout: 30_000,
    });
  });
});
