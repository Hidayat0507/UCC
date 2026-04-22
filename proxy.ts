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
  if (context.type === "admin") {
    const url = req.nextUrl.clone();
    const alreadyOnAdminRoute =
      pathname === "/admin" || pathname.startsWith("/admin/");
    const shouldRewrite =
      !alreadyOnAdminRoute &&
      !pathname.startsWith("/login") &&
      !pathname.startsWith("/logout") &&
      !pathname.startsWith("/api/") &&
      !pathname.startsWith("/_next");

    if (shouldRewrite) {
      url.pathname = pathname === "/" ? "/admin" : "/admin" + pathname;
    }

    const servingPath = shouldRewrite ? url.pathname : pathname;
    const requestHeaders = withPathname(req, servingPath);
    return shouldRewrite
      ? NextResponse.rewrite(url, { request: { headers: requestHeaders } })
      : NextResponse.next({ request: { headers: requestHeaders } });
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
