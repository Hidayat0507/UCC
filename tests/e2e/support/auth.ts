import { expect, type Page, type TestInfo } from "@playwright/test";

// ── Medplum admin UI login ───────────────────────────────────────────────────

export async function loginToMedplumUi(
  page: Page,
  opts: { medplumUiUrl: string; email: string; password: string }
): Promise<void> {
  await page.goto(`${opts.medplumUiUrl}/signin`, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });

  const emailInput = page
    .locator('input[name="email"], input[type="email"]')
    .first();
  await emailInput.waitFor({ state: "visible" });
  await emailInput.fill(opts.email);

  await page
    .locator('input[name="password"], input[type="password"]')
    .first()
    .fill(opts.password);

  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.href.includes("/signin"), {
    timeout: 20_000,
  });

  await expect(page).not.toHaveURL(/\/signin/);
}

// ── Clinic EMR login (subdomain) ─────────────────────────────────────────────

/**
 * Log in to the clinic EMR app (e.g. klinikputeri.iatrum.com).
 * After success the page lands on /dashboard.
 */
export async function loginToClinicEMR(
  page: Page,
  opts: { baseUrl: string; email: string; password: string }
): Promise<void> {
  await page.goto(`${opts.baseUrl}/login`, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });

  await page.locator('input[type="email"]').fill(opts.email);
  await page.locator('input[type="password"]').fill(opts.password);
  await page.locator('button[type="submit"]').click();

  // Wait for redirect away from /login
  await page.waitForURL((url) => !url.pathname.includes("/login"), {
    timeout: 30_000,
  });

  // Confirm we landed on a real page (not an error)
  await expect(page).not.toHaveURL(/\/(login|landing)/);
}

// ── Access-control helper ────────────────────────────────────────────────────

export async function expectAuthRedirectOrBlock(
  page: Page,
  url: string
): Promise<void> {
  const response = await page.goto(url, { waitUntil: "domcontentloaded" });

  const finalUrl = page.url();
  const redirectedToAuth =
    finalUrl.includes("/login") ||
    finalUrl.includes("/auth") ||
    finalUrl.includes("signin");

  expect(response?.status() ?? 0).toBeLessThan(500);

  if (redirectedToAuth) {
    expect(redirectedToAuth).toBe(true);
    return;
  }

  const pageText = await page.textContent("body");
  expect(pageText || "").toMatch(/login|sign in|unauthorized/i);
}

// ── CI helpers ───────────────────────────────────────────────────────────────

export function annotateMissingEnv(
  testInfo: TestInfo,
  missing: string[]
): void {
  testInfo.annotations.push({
    type: "test-env",
    description: `Missing env vars: ${missing.join(", ")}`,
  });
}
