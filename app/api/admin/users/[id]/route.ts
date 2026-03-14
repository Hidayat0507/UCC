import { NextRequest, NextResponse } from "next/server";
import { deletePractitionerFromMedplum } from "@/lib/fhir/admin-service";
import { getMedplumForRequest } from "@/lib/server/medplum-auth";
import { requirePlatformAdmin } from "@/lib/server/medplum-auth";

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requirePlatformAdmin(req);
    const { id } = await context.params;
    const medplum = await getMedplumForRequest(req);

    if (!id) {
      return NextResponse.json({ error: "User id is required" }, { status: 400 });
    }

    await deletePractitionerFromMedplum(id, medplum);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to delete user:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete user" },
      { status: /Platform admin access required/i.test(error.message || "") ? 403 : 500 }
    );
  }
}
