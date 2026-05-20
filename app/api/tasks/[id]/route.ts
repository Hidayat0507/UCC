import { NextRequest, NextResponse } from "next/server";
import { getBillingTaskClinicId, updateBillingExceptionTaskStatus } from "@/lib/fhir/billing-task-service";
import { isModuleEnabledForClinic } from "@/lib/module-registry";
import { requireClinicAuth } from "@/lib/server/medplum-auth";
import { ForbiddenError, handleRouteError } from "@/lib/server/route-helpers";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { medplum, clinicId } = await requireClinicAuth(req);
    if (!(await isModuleEnabledForClinic("tasks", clinicId))) {
      return NextResponse.json({ success: false, error: "Tasks module is disabled" }, { status: 404 });
    }

    const { id } = await params;
    const body = await req.json().catch(() => null);
    const status = body?.status;
    const note = body?.note;

    if (!id) {
      return NextResponse.json({ success: false, error: "Task ID is required" }, { status: 400 });
    }
    if (!["requested", "in-progress", "completed", "cancelled"].includes(status)) {
      return NextResponse.json({ success: false, error: "Invalid status" }, { status: 400 });
    }

    const existing = await medplum.readResource("Task", id);
    if (getBillingTaskClinicId(existing) !== clinicId) {
      throw new ForbiddenError("Task does not belong to the current clinic.");
    }

    const task = await updateBillingExceptionTaskStatus(medplum, id, status, note);
    return NextResponse.json({ success: true, task });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Invalid status transition")) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    return handleRouteError(error, "PATCH /api/tasks/[id]");
  }
}
