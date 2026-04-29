// Base domain (used for smoke/auth tests)
export const EMR_URL = process.env.EMR_URL || "https://iatrum.com";

// Medplum admin UI
export const MEDPLUM_UI_URL = process.env.MEDPLUM_UI_URL || "";

// Medplum admin credentials
export const ADMIN_EMAIL = process.env.MEDPLUM_ADMIN_EMAIL || "";
export const ADMIN_PASSWORD = process.env.MEDPLUM_ADMIN_PASSWORD || "";

// ── Clinic-specific ─────────────────────────────────────────────────────────

export const KLINIK_PUTERI_URL =
  process.env.CLINIC_URL || "https://demo.drhidayat.com";

export const KLINIK_PUTERI_EMAIL =
  process.env.KLINIK_PUTERI_EMAIL || "";

export const KLINIK_PUTERI_PASSWORD =
  process.env.KLINIK_PUTERI_PASSWORD || "";

// All clinic users (for credential smoke tests)
export const CLINIC_USERS = [
  {
    email: KLINIK_PUTERI_EMAIL,
    password: KLINIK_PUTERI_PASSWORD,
    label: "Klinik Puteri Admin",
  },
  {
    email: "apex-group-admin@iatrum.com",
    password: process.env.CLINIC_USER_PASSWORD || "",
    label: "Apex Group Admin",
  },
  {
    email: "beacon-group-admin@iatrum.com",
    password: process.env.CLINIC_USER_PASSWORD || "",
    label: "Beacon Group Admin",
  },
];

export function missingEnvVars(vars: Record<string, string>): string[] {
  return Object.entries(vars)
    .filter(([, value]) => !value)
    .map(([key]) => key);
}
