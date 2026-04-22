import { NextRequest, NextResponse } from "next/server";
import {
  getOrganizationsFromMedplum,
  saveOrganizationDetailsToMedplum,
} from "@/lib/fhir/admin-service";
import { requirePlatformAdmin } from "@/lib/server/medplum-auth";
import { handleRouteError } from "@/lib/server/route-helpers";

/**
 * GET /api/admin/clinics
 * List all clinic Organisations in Medplum.
 */
export async function GET(req: NextRequest) {
  try {
    await requirePlatformAdmin(req);
    const clinics = await getOrganizationsFromMedplum();
    return NextResponse.json({ clinics });
  } catch (error) {
    return handleRouteError(error, "GET /api/admin/clinics");
  }
}

/**
 * POST /api/admin/clinics
 * Create a new clinic Organisation in Medplum.
 */
export async function POST(req: NextRequest) {
  try {
    await requirePlatformAdmin(req);
    const { name, subdomain, phone, address, logoUrl } = await req.json();

    if (!name || !subdomain) {
      return NextResponse.json(
        { error: "name and subdomain are required" },
        { status: 400 }
      );
    }

    // Validate subdomain format
    if (!/^[a-z0-9-]+$/.test(subdomain)) {
      return NextResponse.json(
        { error: "subdomain must be lowercase alphanumeric + hyphens only" },
        { status: 400 }
      );
    }

    await saveOrganizationDetailsToMedplum(
      { name, phone: phone || undefined, address: address || undefined, logoUrl: logoUrl || undefined },
      subdomain
    );

    return NextResponse.json({ success: true, subdomain });
  } catch (error) {
    return handleRouteError(error, 'POST /api/admin/clinics');
  }
}
