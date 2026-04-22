import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/server/medplum-auth";
import { handleRouteError } from "@/lib/server/route-helpers";
import {
  deletePractitionerFromMedplum,
  getPractitionerFromMedplum,
  updatePractitionerInMedplum,
} from "@/lib/fhir/admin-service";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    await requirePlatformAdmin(req);
    const { id } = await params;
    const user = await getPractitionerFromMedplum(id);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    return NextResponse.json(user);
  } catch (error) {
    return handleRouteError(error, "GET /api/admin/users/[id]");
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    await requirePlatformAdmin(req);
    const { id } = await params;
    const body = await req.json();

    const firstName = String(body.firstName ?? "").trim();
    const lastName = String(body.lastName ?? "").trim();
    if (!firstName || !lastName) {
      return NextResponse.json(
        { error: "firstName and lastName are required" },
        { status: 400 }
      );
    }

    const organizationIds = Array.isArray(body.organizationIds)
      ? (body.organizationIds as unknown[])
          .filter((v): v is string => typeof v === "string" && v.length > 0)
      : [];

    const updated = await updatePractitionerInMedplum(id, {
      firstName,
      lastName,
      organizationIds,
    });

    return NextResponse.json({ success: true, user: updated });
  } catch (error) {
    return handleRouteError(error, "PATCH /api/admin/users/[id]");
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    await requirePlatformAdmin(req);
    const { id } = await params;
    await deletePractitionerFromMedplum(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRouteError(error, "DELETE /api/admin/users/[id]");
  }
}
