import { NextRequest, NextResponse } from "next/server";
import { deleteOrganizationFromMedplum } from "@/lib/fhir/admin-service";
import {
  getOrganizationDetailsFromMedplum,
  saveOrganizationDetailsToMedplum,
} from "@/lib/fhir/organization-service";
import { getMedplumClient } from "@/lib/fhir/patient-service";
import { requirePlatformAdmin } from "@/lib/server/medplum-auth";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requirePlatformAdmin(_req);
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json({ error: "Clinic id is required" }, { status: 400 });
    }

    const medplum = await getMedplumClient();
    const organization = await medplum.readResource("Organization", id);
    const details = await getOrganizationDetailsFromMedplum(id);
    const subdomain =
      organization.identifier?.find((identifier) => identifier.system === "clinic")?.value ??
      organization.id;

    return NextResponse.json({
      clinic: {
        id: organization.id,
        name: details?.name ?? organization.name ?? "Unnamed clinic",
        subdomain,
        phone: details?.phone ?? undefined,
        address: details?.address ?? undefined,
        logoUrl: details?.logoUrl ?? undefined,
        parentOrganizationId: details?.parentOrganizationId ?? undefined,
      },
    });
  } catch (error: any) {
    console.error("Failed to load clinic:", error);
    return NextResponse.json(
      { error: error.message || "Failed to load clinic" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requirePlatformAdmin(req);
    const { id } = await context.params;
    const { name, phone, address, logoUrl, parentOrganizationId } = await req.json();

    if (!id || !name) {
      return NextResponse.json(
        { error: "Clinic id and name are required" },
        { status: 400 }
      );
    }

    const saved = await saveOrganizationDetailsToMedplum(
      {
        name,
        phone: phone || undefined,
        address: address || undefined,
        logoUrl: logoUrl || undefined,
        parentOrganizationId: parentOrganizationId || null,
      },
      id
    );

    return NextResponse.json({ success: true, clinicId: saved.id });
  } catch (error: any) {
    console.error("Failed to update clinic:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update clinic" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requirePlatformAdmin(req);
    const { id } = await context.params;
    const medplum = await getMedplumClient();

    if (!id) {
      return NextResponse.json({ error: "Clinic id is required" }, { status: 400 });
    }

    await deleteOrganizationFromMedplum(id, medplum);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to delete clinic:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete clinic" },
      { status: /Platform admin access required/i.test(error.message || "") ? 403 : 500 }
    );
  }
}
