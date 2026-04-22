import { test as setup, expect } from "@playwright/test";
import path from "path";
import fs from "fs";

const ADMIN_EMAIL = process.env.MEDPLUM_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.MEDPLUM_ADMIN_PASSWORD;

const AUTH_DIR = path.join(__dirname, "../.auth");
fs.mkdirSync(AUTH_DIR, { recursive: true });

setup("authenticate as admin user", async ({ page }) => {
  const emptyState = JSON.stringify({ cookies: [], origins: [] });
  const adminStatePath = path.join(AUTH_DIR, "admin.json");

  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    fs.writeFileSync(adminStatePath, emptyState);
    setup.skip(true, "MEDPLUM_ADMIN_EMAIL / MEDPLUM_ADMIN_PASSWORD not set");
    return;
  }

  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Welcome back")).toBeVisible({ timeout: 10_000 });

  await page.fill("#email", ADMIN_EMAIL);
  await page.fill("#password", ADMIN_PASSWORD);
  await page.click('button[type="submit"]');

  await page.waitForFunction(async () => {
    const onNonLoginPage = !window.location.pathname.includes("/login");
    if (onNonLoginPage) {
      return true;
    }

    const hasAdminHeading = Boolean(
      document
        .querySelector("h1, h2, [role='heading']")
        ?.textContent?.match(/admin portal|ucc admin|overview/i)
    );
    if (hasAdminHeading) {
      return true;
    }

    const hasSessionCookie = document.cookie.includes("medplum-session=");
    const hasAdminCookie = document.cookie.includes("medplum-platform-admin=true");
    return hasSessionCookie || hasAdminCookie;
  }, { timeout: 20_000 });

  await page.waitForTimeout(1000);

  const storageState = await page.context().storageState();
  if (!Array.isArray(storageState.cookies) || storageState.cookies.length === 0) {
    throw new Error("Admin login did not persist any browser cookies");
  }

  await page.context().storageState({ path: adminStatePath });
});
