import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const COOKIE_NAME = "medplum-session";
const CLINIC_COOKIE_NAME = "medplum-clinic";
const PLATFORM_ADMIN_COOKIE_NAME = "medplum-platform-admin";
const MAX_AGE_SECONDS = 60 * 60 * 24; // 24 hours
const isProd = process.env.NODE_ENV === "production";
const BASE_DOMAIN = process.env.NEXT_PUBLIC_BASE_DOMAIN?.replace(/^\./, "");
// Share auth across root domain and admin/clinic subdomains in production.
const COOKIE_DOMAIN =
  process.env.COOKIE_DOMAIN || (isProd && BASE_DOMAIN ? `.${BASE_DOMAIN}` : undefined);

/**
 * POST /api/auth/medplum-session
 * Create session cookie from Medplum access token
 */
export async function POST(req: NextRequest) {
  try {
    const { accessToken, clinicId, isPlatformAdmin } = await req.json();

    if (!accessToken && clinicId === undefined) {
      return NextResponse.json(
        { error: "Missing access token or clinicId" },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();

    if (typeof accessToken === "string" && accessToken.length > 0) {
      cookieStore.set(COOKIE_NAME, accessToken, {
        httpOnly: true,
        secure: isProd,
        sameSite: "lax",
        maxAge: MAX_AGE_SECONDS,
        path: "/",
        domain: COOKIE_DOMAIN,
      });
    }

    if (typeof clinicId === "string" && clinicId.trim().length > 0) {
      cookieStore.set(CLINIC_COOKIE_NAME, clinicId, {
        httpOnly: false,
        secure: isProd,
        sameSite: "lax",
        maxAge: MAX_AGE_SECONDS,
        path: "/",
        domain: COOKIE_DOMAIN,
      });
    } else if (clinicId === null) {
      cookieStore.set(CLINIC_COOKIE_NAME, "", {
        httpOnly: false,
        secure: isProd,
        sameSite: "lax",
        maxAge: 0,
        path: "/",
        domain: COOKIE_DOMAIN,
      });
    }

    if (typeof isPlatformAdmin === "boolean") {
      cookieStore.set(PLATFORM_ADMIN_COOKIE_NAME, isPlatformAdmin ? "true" : "false", {
        httpOnly: false,
        secure: isProd,
        sameSite: "lax",
        maxAge: MAX_AGE_SECONDS,
        path: "/",
        domain: COOKIE_DOMAIN,
      });
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
 * Clear session cookies
 */
export async function DELETE() {
  try {
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, "", {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      maxAge: 0,
      path: "/",
      domain: COOKIE_DOMAIN,
    });
    cookieStore.set(CLINIC_COOKIE_NAME, "", {
      httpOnly: false,
      secure: isProd,
      sameSite: "lax",
      maxAge: 0,
      path: "/",
      domain: COOKIE_DOMAIN,
    });
    cookieStore.set(PLATFORM_ADMIN_COOKIE_NAME, "", {
      httpOnly: false,
      secure: isProd,
      sameSite: "lax",
      maxAge: 0,
      path: "/",
      domain: COOKIE_DOMAIN,
    });
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
    const sessionCookie = cookieStore.get(COOKIE_NAME);
    const clinicCookie = cookieStore.get(CLINIC_COOKIE_NAME);
    const platformAdminCookie = cookieStore.get(PLATFORM_ADMIN_COOKIE_NAME);

    if (!sessionCookie) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    return NextResponse.json({
      authenticated: true,
      clinicId: clinicCookie?.value ?? null,
      isPlatformAdmin: platformAdminCookie?.value === "true",
    });
  } catch (error: any) {
    console.error("Error checking Medplum session:", error);
    return NextResponse.json(
      { error: "Failed to check session" },
      { status: 500 }
    );
  }
}
