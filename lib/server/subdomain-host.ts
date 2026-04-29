import type { NextRequest } from "next/server";

export type SubdomainContext =
  | { type: "admin" }
  | { type: "clinic"; clinicId: string }
  | { type: "none" };

/**
 * Derive admin / clinic / none from the HTTP Host (or forwarded host).
 * Safe to import from Edge middleware (no next/headers).
 */
export function deriveSubdomainContext(host: string | null): SubdomainContext {
  if (!host) return { type: "none" };
  if (host.startsWith("localhost") || /^\d{1,3}(\.\d{1,3}){3}/.test(host)) {
    const clinicId = process.env.CLINIC_ID;
    if (clinicId) return { type: "clinic", clinicId };
    return { type: "none" };
  }

  const bare = host.split(":")[0];
  const parts = bare.split(".");
  if (parts.length < 3) return { type: "none" };

  // Any 3+ part host is treated as a subdomain. BASE_DOMAIN is ignored so
  // secondary domains (e.g. drhidayat.com) work the same way as the primary
  // iatrum.com domain without extra configuration.
  const [sub] = parts;

  if (sub === "admin") return { type: "admin" };
  if (["www", "app", "auth"].includes(sub)) return { type: "none" };
  return { type: "clinic", clinicId: sub };
}

/** Prefer the original client host when behind a reverse proxy (e.g. Vercel). */
export function getHostFromHeaders(h: Headers): string | null {
  const xf = h.get("x-forwarded-host");
  if (xf) {
    const first = xf.split(",")[0]?.trim();
    if (first) return first;
  }
  return h.get("host");
}

export function getHostFromNextRequest(req: NextRequest): string | null {
  return getHostFromHeaders(req.headers);
}

/**
 * Admin vs clinic shell: host-derived first; on bare localhost/apex, /admin path means admin UI;
 * clinic id for validation uses host subdomain, else session cookie (localhost dev).
 */
export function resolvePortalPresentation(args: {
  host: string | null;
  pathname: string;
  clinicCookieValue: string | null | undefined;
}): { isAdminShell: boolean; clinicIdForValidation: string | null } {
  const ctx = deriveSubdomainContext(args.host);
  if (ctx.type === "admin") {
    return { isAdminShell: true, clinicIdForValidation: null };
  }
  if (ctx.type === "clinic") {
    return { isAdminShell: false, clinicIdForValidation: ctx.clinicId };
  }
  const pathname = args.pathname;
  if (pathname.startsWith("/admin")) {
    return { isAdminShell: true, clinicIdForValidation: null };
  }
  const fromCookie = args.clinicCookieValue?.trim() || null;
  return { isAdminShell: false, clinicIdForValidation: fromCookie };
}
