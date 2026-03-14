import { NextRequest, NextResponse } from "next/server";
import { getOrganizationsFromMedplum } from "@/lib/fhir/admin-service";
import { saveOrganizationDetailsToMedplum } from "@/lib/fhir/organization-service";
import { requirePlatformAdmin } from "@/lib/server/medplum-auth";

/**
 * GET /api/admin/clinics
 * List clinics (Organisations) for admin flows.
 */
export async function GET(req: NextRequest) {
  try {
    await requirePlatformAdmin(req);
    const clinics = await getOrganizationsFromMedplum();
    return NextResponse.json({ clinics });
  } catch (error: any) {
    console.error("Failed to list clinics:", error);
    return NextResponse.json(
      { error: error.message || "Failed to list clinics" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/clinics
 * Create a new clinic Organisation in Medplum.
 */
export async function POST(req: NextRequest) {
  try {
    await requirePlatformAdmin(req);
    const { name, subdomain, phone, address, logoUrl, parentOrganizationId } = await req.json();

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
      {
        name,
        phone: phone || undefined,
        address: address || undefined,
        logoUrl: logoUrl || undefined,
        parentOrganizationId: parentOrganizationId || undefined,
      },
      subdomain
    );

    return NextResponse.json({ success: true, subdomain });
  } catch (error: any) {
    console.error("Failed to create clinic:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create clinic" },
      { status: /Platform admin access required/i.test(error.message || "") ? 403 : 500 }
    );
  }
}
