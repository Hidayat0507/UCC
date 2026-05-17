import { NextRequest, NextResponse } from "next/server";
import { requireClinicAuth } from "@/lib/server/medplum-auth";
import { ForbiddenError, handleRouteError } from "@/lib/server/route-helpers";
import {
  getFollowUpClinicId,
  updateFollowUpStatus,
  deleteFollowUp,
  type FollowUpStatus,
} from "@/lib/fhir/communication-service";

const VALID_STATUSES: FollowUpStatus[] = ["preparation", "in-progress", "completed", "stopped"];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { medplum, clinicId } = await requireClinicAuth(req);
    const { id } = await params;
    const body = await req.json().catch(() => null);
    const status = body?.status as FollowUpStatus | undefined;

    if (!id) {
      return NextResponse.json({ success: false, error: "ID required" }, { status: 400 });
    }
    if (!status || !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ success: false, error: "Invalid status" }, { status: 400 });
    }

    const comm = await medplum.readResource("Communication", id);
    if (getFollowUpClinicId(comm) !== clinicId) {
      throw new ForbiddenError("Follow up does not belong to this clinic.");
    }

    const followUp = await updateFollowUpStatus(medplum, id, status);
    return NextResponse.json({ success: true, followUp });
  } catch (error) {
    return handleRouteError(error, "PATCH /api/follow-up/[id]");
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { medplum, clinicId } = await requireClinicAuth(req);
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ success: false, error: "ID required" }, { status: 400 });
    }

    const comm = await medplum.readResource("Communication", id);
    if (getFollowUpClinicId(comm) !== clinicId) {
      throw new ForbiddenError("Follow up does not belong to this clinic.");
    }

    try {
      await deleteFollowUp(medplum, id);
    } catch (deleteError) {
      const msg = deleteError instanceof Error ? deleteError.message : String(deleteError);
      const isGone = msg.includes("Gone") || msg.includes("410");
      if (!isGone) throw deleteError;
      // Resource already deleted — treat as success
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRouteError(error, "DELETE /api/follow-up/[id]");
  }
}
