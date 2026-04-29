import { NextRequest, NextResponse } from "next/server";
import {
  getParentOrganizationsFromMedplum,
  saveParentOrganizationToMedplum,
  updateParentOrganizationInMedplum,
} from "@/lib/fhir/admin-service";
import { requirePlatformAdmin } from "@/lib/server/medplum-auth";
import { handleRouteError } from "@/lib/server/route-helpers";

export async function GET(req: NextRequest) {
  try {
    await requirePlatformAdmin(req);
    const organisations = await getParentOrganizationsFromMedplum();
    return NextResponse.json({
      organisations,
      organisation: organisations[0] ?? null,
    });
  } catch (error) {
    return handleRouteError(error, "GET /api/admin/organisation");
  }
}

export async function POST(req: NextRequest) {
  try {
    await requirePlatformAdmin(req);
    const { name, phone, address, logoUrl } = await req.json();
    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    const organisation = await saveParentOrganizationToMedplum({
      name,
      phone: phone || undefined,
      address: address || undefined,
      logoUrl: logoUrl || undefined,
    });
    return NextResponse.json({ success: true, organisation });
  } catch (error) {
    return handleRouteError(error, "POST /api/admin/organisation");
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await requirePlatformAdmin(req);
    const { id, name, phone, address, logoUrl } = await req.json();
    if (!id || !name) {
      return NextResponse.json(
        { error: "id and name are required" },
        { status: 400 }
      );
    }
    const organisation = await updateParentOrganizationInMedplum(id, {
      name,
      phone: phone || undefined,
      address: address || undefined,
      logoUrl: logoUrl || undefined,
    });
    return NextResponse.json({ success: true, organisation });
  } catch (error) {
    return handleRouteError(error, "PATCH /api/admin/organisation");
  }
}
