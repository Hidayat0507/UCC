/**
 * Clinic authentication setup
 *
 * Logs in to klinikputeri.iatrum.com once and persists the session cookie
 * to tests/e2e/.auth/klinikputeri.json so that all clinic tests can reuse it
 * without paying the login round-trip cost on every test.
 *
 * Run automatically as a dependency of the "clinic" project in playwright.config.ts.
 */

import { test as setup, expect } from "@playwright/test";
import path from "path";
import { KLINIK_PUTERI_URL, KLINIK_PUTERI_EMAIL, KLINIK_PUTERI_PASSWORD } from "../support/env";

const SESSION_FILE = path.join(__dirname, "../.auth/klinikputeri.json");

setup("authenticate as Klinik Puteri staff", async ({ page }) => {
  const response = await page.request.post(`${KLINIK_PUTERI_URL}/api/auth/login`, {
    data: {
      email: KLINIK_PUTERI_EMAIL,
      password: KLINIK_PUTERI_PASSWORD,
    },
    timeout: 30_000,
  });
  expect(response.ok()).toBeTruthy();

  await expect
    .poll(
      async () => {
        const res = await page.request.get(`${KLINIK_PUTERI_URL}/api/auth/me`, {
          headers: {
            Cookie: (await page.context().cookies())
              .map((cookie) => `${cookie.name}=${cookie.value}`)
              .join("; "),
          },
        });
        return res.status();
      },
      { timeout: 30_000, intervals: [1000, 2000, 3000] }
    )
    .toBe(200);

  await page.goto(`${KLINIK_PUTERI_URL}/dashboard`, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });

  // Confirm a dashboard element is visible (proves login was accepted)
  await expect(page).not.toHaveURL(/\/(login|landing)/);

  // Persist cookies + localStorage so tests can reuse the session
  await page.context().storageState({ path: SESSION_FILE });
});
