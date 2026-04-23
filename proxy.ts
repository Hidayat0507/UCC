import { NextRequest, NextResponse } from "next/server";
import {
  deriveSubdomainContext,
  getHostFromNextRequest,
} from "@/lib/server/subdomain-host";

export function proxy(req: NextRequest) {
  const host = getHostFromNextRequest(req);
  const context = deriveSubdomainContext(host);
  const { pathname } = req.nextUrl;

  // ── Admin subdomain ─────────────────────────────────────────
  // Redirect admin.domain.com → domain.com/admin/* so the path-based URL
  // remains the single canonical entry point for the admin portal.
  if (context.type === "admin") {
    const BASE_DOMAIN = process.env.NEXT_PUBLIC_BASE_DOMAIN || "";
    if (BASE_DOMAIN) {
      const redirectUrl = req.nextUrl.clone();
      redirectUrl.hostname = BASE_DOMAIN;
      redirectUrl.pathname = pathname === "/" ? "/admin" : "/admin" + pathname;
      return NextResponse.redirect(redirectUrl, 308);
    }
  }

  // ── Clinic subdomain ─────────────────────────────────────────
  if (context.type === "clinic") {
    return NextResponse.next({
      request: { headers: withPathname(req, pathname) },
    });
  }

  return NextResponse.next({
    request: { headers: withPathname(req, pathname) },
  });
}

/** Forward the current pathname to Server Components via a request header. */
function withPathname(req: NextRequest, pathname: string): Headers {
  const headers = new Headers(req.headers);
  headers.set("x-pathname", pathname);
  return headers;
}

export const config = {
  matcher: ["/((?!_next|static|favicon.ico|manifest.json).*)"],
};
