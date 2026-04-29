import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/server/medplum-auth";
import { handleRouteError } from "@/lib/server/route-helpers";
import {
  deleteOrganizationFromMedplum,
  getOrganizationFromMedplum,
  updateOrganizationDetailsInMedplum,
} from "@/lib/fhir/admin-service";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    await requirePlatformAdmin(req);
    const { id } = await params;
    const clinic = await getOrganizationFromMedplum(id);
    if (!clinic) {
      return NextResponse.json({ error: "Clinic not found" }, { status: 404 });
    }
    return NextResponse.json(clinic);
  } catch (error) {
    return handleRouteError(error, "GET /api/admin/clinics/[id]");
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    await requirePlatformAdmin(req);
    const { id } = await params;
    const body = await req.json();
    const name = String(body.name ?? "").trim();
    if (!name) {
      return NextResponse.json(
        { error: "Clinic name is required" },
        { status: 400 }
      );
    }

    const updated = await updateOrganizationDetailsInMedplum(id, {
      name,
      phone: body.phone ? String(body.phone).trim() : undefined,
      address: body.address ? String(body.address).trim() : undefined,
      logoUrl: body.logoUrl ? String(body.logoUrl).trim() : undefined,
      parentId: body.parentId ? String(body.parentId).trim() : undefined,
    });

    return NextResponse.json({ success: true, clinic: updated });
  } catch (error) {
    return handleRouteError(error, "PATCH /api/admin/clinics/[id]");
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    await requirePlatformAdmin(req);
    const { id } = await params;
    await deleteOrganizationFromMedplum(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRouteError(error, "DELETE /api/admin/clinics/[id]");
  }
}
