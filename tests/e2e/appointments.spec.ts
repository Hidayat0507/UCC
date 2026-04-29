/**
 * Appointment workflow E2E tests
 *
 * Covers:
 *   1. Appointments page renders for authenticated clinic staff
 *   2. New appointment form can schedule a patient appointment
 *   3. Appointment list links to check-in; reschedule works from appointment detail
 */

import { expect, test, type Page } from "@playwright/test";

const CLINICIAN = "Dr. Sarah Wong";

let patientCounter = 0;

type TestPatient = {
  id: string;
  name: string;
  nric: string;
  phone: string;
  reason: string;
};

function futureSlot(minutesFromNow = 90): Date {
  const date = new Date(Date.now() + minutesFromNow * 60 * 1000);
  date.setSeconds(0, 0);
  return date;
}

function formatDateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatTimeInput(date: Date): string {
  return date.toTimeString().slice(0, 5);
}

function buildPatientInput(): Omit<TestPatient, "id"> {
  patientCounter += 1;
  const runId = `${Date.now()}-${patientCounter}`;
  const serial = String((Number(String(Date.now()).slice(-4)) + patientCounter) % 10000).padStart(4, "0");

  return {
    name: `Appointment E2E ${runId}`,
    nric: `900101-10-${serial}`,
    phone: `01288${serial}`,
    reason: `E2E appointment follow-up ${runId}`,
  };
}

async function createTestPatient(page: Page): Promise<TestPatient> {
  const patient = buildPatientInput();
  const response = await page.request.post("/api/patients", {
    data: {
      fullName: patient.name,
      nric: patient.nric,
      dateOfBirth: "1990-01-01",
      gender: "female",
      phone: patient.phone,
      address: "Appointment E2E Address",
    },
  });
  const data = await response.json().catch(() => ({}));

  expect(response.ok(), JSON.stringify(data)).toBe(true);
  expect(typeof data?.patientId).toBe("string");

  return { ...patient, id: data.patientId };
}

async function createTestAppointment(
  page: Page,
  patient: TestPatient,
  scheduledAt = futureSlot(120)
): Promise<string> {
  const response = await page.request.post("/api/appointments", {
    data: {
      patientId: patient.id,
      patientName: patient.name,
      patientContact: patient.phone,
      clinician: CLINICIAN,
      reason: patient.reason,
      type: "Follow-up",
      notes: `Created by appointment E2E for ${patient.name}`,
      scheduledAt: scheduledAt.toISOString(),
      status: "booked",
      durationMinutes: 30,
    },
  });
  const data = await response.json().catch(() => ({}));

  expect(response.ok(), JSON.stringify(data)).toBe(true);
  expect(typeof data?.appointmentId).toBe("string");

  return data.appointmentId;
}

async function selectByVisibleOption(page: Page, triggerIndex: number, optionName: RegExp | string): Promise<void> {
  await page.locator('button[role="combobox"]').nth(triggerIndex).click();
  await page.getByRole("option", { name: optionName }).click();
}

async function appointmentRowFor(page: Page, patientName: string) {
  const patientTitle = page.getByText(patientName, { exact: true }).first();
  await expect(patientTitle).toBeVisible({ timeout: 20_000 });
  return patientTitle.locator(
    'xpath=ancestor::*[.//a[contains(normalize-space(.), "Check-in")] and .//a[contains(normalize-space(.), "View")]][1]'
  );
}

test.describe("Appointment workflow", () => {
  test("appointments page is accessible and links to new appointment form", async ({ page }) => {
    const response = await page.goto("/appointments", { waitUntil: "domcontentloaded" });

    expect(response?.status() ?? 0).toBeLessThan(400);
    await expect(page).not.toHaveURL(/\/(login|landing)/);
    await expect(page.getByRole("heading", { name: /^appointments$/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("link", { name: /new appointment/i })).toBeVisible();

    await page.getByRole("link", { name: /new appointment/i }).click();
    await expect(page).toHaveURL(/\/appointments\/new/);
    await expect(page.getByText(/schedule new appointment/i)).toBeVisible({ timeout: 15_000 });
  });

  test("schedules a new appointment from the form", async ({ page }) => {
    const patient = await createTestPatient(page);
    const slot = futureSlot();

    await page.goto("/appointments/new", { waitUntil: "domcontentloaded" });
    await expect(page.getByText(/schedule new appointment/i)).toBeVisible({ timeout: 15_000 });

    const patientCombobox = page.locator('button[role="combobox"]').first();
    await expect(patientCombobox).toBeEnabled({ timeout: 20_000 });
    await patientCombobox.click();
    await page.getByPlaceholder(/search patient/i).fill(patient.name);
    await page.getByText(patient.name, { exact: true }).click();

    await page.locator('input[type="date"]').fill(formatDateInput(slot));
    await page.locator('input[type="time"]').fill(formatTimeInput(slot));
    await selectByVisibleOption(page, 1, CLINICIAN);
    await selectByVisibleOption(page, 2, /follow-up/i);
    await page.getByPlaceholder(/follow-up consultation/i).fill(patient.reason);
    await page.getByPlaceholder(/preparation instructions|notes/i).fill("Bring prior lab results.");

    const createAppointment = page.waitForResponse(
      (response) =>
        response.url().includes("/api/appointments") &&
        response.request().method() === "POST",
      { timeout: 30_000 }
    );
    await page.getByRole("button", { name: /create appointment/i }).click();
    const appointmentResponse = await createAppointment;
    const data = await appointmentResponse.json().catch(() => ({}));

    expect(appointmentResponse.ok(), JSON.stringify(data)).toBe(true);
    await expect(page).toHaveURL(/\/appointments$/, { timeout: 20_000 });
    await expect(page.getByText(patient.name).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(patient.reason).first()).toBeVisible();
  });

  test("check-in link from the list opens patient check-in; detail page can reschedule", async ({ page }) => {
    test.setTimeout(60_000);
    const patient = await createTestPatient(page);
    const appointmentId = await createTestAppointment(page, patient);

    await page.goto("/appointments", { waitUntil: "domcontentloaded" });
    const appointmentRow = await appointmentRowFor(page, patient.name);

    await appointmentRow.getByRole("link", { name: /check-in/i }).click();
    await expect(page).toHaveURL(new RegExp(`/patients/${patient.id}/check-in`), { timeout: 20_000 });

    const beforeReschedule = await page.request
      .get(`/api/appointments?id=${appointmentId}`)
      .then((response) => response.json());

    await page.goto(`/appointments/${appointmentId}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText(patient.name, { exact: true }).first()).toBeVisible({ timeout: 20_000 });

    await page.getByRole("button", { name: /reschedule/i }).click();
    const dialog = page.getByRole("dialog", { name: /reschedule appointment/i });
    await expect(dialog).toBeVisible();

    const nextStart = new Date(beforeReschedule?.appointment?.scheduledAt);
    nextStart.setHours(nextStart.getHours() + 2);
    const pad = (n: number) => n.toString().padStart(2, "0");
    const localValue = `${nextStart.getFullYear()}-${pad(nextStart.getMonth() + 1)}-${pad(nextStart.getDate())}T${pad(nextStart.getHours())}:${pad(nextStart.getMinutes())}`;
    await dialog.getByLabel(/date and time/i).fill(localValue);

    const reschedule = page.waitForResponse(
      (response) =>
        response.url().includes("/api/appointments") &&
        response.request().method() === "PATCH",
      { timeout: 30_000 }
    );
    await dialog.getByRole("button", { name: /save changes/i }).click();
    const rescheduleResponse = await reschedule;
    expect(rescheduleResponse.ok()).toBe(true);

    await expect
      .poll(
        async () => {
          const response = await page.request.get(`/api/appointments?id=${appointmentId}`);
          const data = await response.json().catch(() => ({}));
          return data?.appointment?.scheduledAt || "";
        },
        { timeout: 20_000, intervals: [1000, 2000, 3000] }
      )
      .not.toBe(beforeReschedule?.appointment?.scheduledAt);
  });
});
