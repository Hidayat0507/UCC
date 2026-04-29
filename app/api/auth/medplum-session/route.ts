import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, CLINIC_COOKIE, REFRESH_COOKIE } from "@/lib/server/cookie-constants";
import { getHostFromNextRequest } from "@/lib/server/subdomain-host";

const MAX_AGE_SECONDS = 60 * 60 * 24; // 24 hours
const isProd = process.env.NODE_ENV === "production";
// Set cookie domain to share session across all subdomains (e.g. .iatrum.com)
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || undefined;

function cookieDomainForRequest(req: NextRequest): string | undefined {
  if (!COOKIE_DOMAIN) {
    return undefined;
  }

  const host = getHostFromNextRequest(req);
  const hostname = host?.split(":")[0] ?? "";
  if (hostname === "localhost" || /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
    return undefined;
  }

  return COOKIE_DOMAIN;
}

/**
 * POST /api/auth/medplum-session
 * Create session cookie from Medplum access token
 */
export async function POST(req: NextRequest) {
  try {
    const { accessToken, clinicId } = await req.json();

    if (!accessToken && clinicId === undefined) {
      return NextResponse.json(
        { error: "Missing access token or clinicId" },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const cookieDomain = cookieDomainForRequest(req);

    if (typeof accessToken === "string" && accessToken.length > 0) {
      cookieStore.set(SESSION_COOKIE, accessToken, {
        httpOnly: true,
        secure: isProd,
        sameSite: "lax",
        maxAge: MAX_AGE_SECONDS,
        path: "/",
        domain: cookieDomain,
      });
    }

    if (typeof clinicId === "string" && clinicId.trim().length > 0) {
      cookieStore.set(CLINIC_COOKIE, clinicId, {
        httpOnly: false,
        secure: isProd,
        sameSite: "lax",
        maxAge: MAX_AGE_SECONDS,
        path: "/",
        domain: cookieDomain,
      });
    } else if (clinicId === null) {
      cookieStore.delete(CLINIC_COOKIE);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error creating Medplum session:", error);
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/auth/medplum-session
 * Clear session cookies. Must mirror the domain/path used on set, otherwise
 * domain-scoped cookies (e.g. `.drhidayat.com`) are NOT removed by the browser
 * and the session effectively survives logout.
 */
export async function DELETE(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const cookieDomain = cookieDomainForRequest(req);
    const expire = (name: string, httpOnly: boolean) => {
      cookieStore.set(name, "", {
        httpOnly,
        secure: isProd,
        sameSite: "lax",
        path: "/",
        maxAge: 0,
        domain: cookieDomain,
      });
    };
    expire(SESSION_COOKIE, true);
    expire(REFRESH_COOKIE, true);
    expire(CLINIC_COOKIE, false);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting Medplum session:", error);
    return NextResponse.json(
      { error: "Failed to delete session" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/auth/medplum-session
 * Check if session exists
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE);
    const clinicCookie = cookieStore.get(CLINIC_COOKIE);

    if (!sessionCookie) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    return NextResponse.json({
      authenticated: true,
      accessToken: sessionCookie.value,
      clinicId: clinicCookie?.value ?? null,
    });
  } catch (error: any) {
    console.error("Error checking Medplum session:", error);
    return NextResponse.json(
      { error: "Failed to check session" },
      { status: 500 }
    );
  }
}
