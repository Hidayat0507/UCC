import { test as setup, expect } from "@playwright/test";
import path from "path";
import fs from "fs";

const ADMIN_EMAIL = process.env.MEDPLUM_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.MEDPLUM_ADMIN_PASSWORD;

const AUTH_DIR = path.join(__dirname, "../.auth");
fs.mkdirSync(AUTH_DIR, { recursive: true });

function getAppOrigin(baseURL?: string): string {
  const url = new URL(baseURL || process.env.EMR_ADMIN_URL || "http://localhost:3000");
  const parts = url.hostname.split(".");
  if (parts[0] === "admin" && parts.length >= 3) {
    url.hostname = parts.slice(1).join(".");
  }
  url.pathname = "";
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

setup("authenticate as admin user", async ({ page }) => {
  const emptyState = JSON.stringify({ cookies: [], origins: [] });
  const adminStatePath = path.join(AUTH_DIR, "admin.json");

  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    fs.writeFileSync(adminStatePath, emptyState);
    setup.skip(true, "MEDPLUM_ADMIN_EMAIL / MEDPLUM_ADMIN_PASSWORD not set");
    return;
  }

  const appOrigin = getAppOrigin(setup.info().project.use.baseURL as string | undefined);
  const loginResponse = await page.request.post(`${appOrigin}/api/auth/login`, {
    data: {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      next: "/admin",
    },
    timeout: 30_000,
  });

  if (!loginResponse.ok()) {
    const body = await loginResponse.text().catch(() => "");
    throw new Error(
      `Admin login failed with HTTP ${loginResponse.status()}: ${body}`
    );
  }

  await page.goto(`${appOrigin}/admin`, { waitUntil: "domcontentloaded" });

  await page.waitForFunction(async () => {
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
