import { NextRequest, NextResponse } from "next/server";
import { listBillingExceptionTasks } from "@/lib/fhir/billing-task-service";
import { getAllFollowUps } from "@/lib/fhir/communication-service";
import {
  mapBillingTaskToUnifiedTask,
  mapFollowUpsToReminderTasks,
  sortUnifiedTasks,
} from "@/lib/fhir/task-reminder-service";
import { requireClinicAuth } from "@/lib/server/medplum-auth";
import { handleRouteError } from "@/lib/server/route-helpers";

export async function GET(req: NextRequest) {
  try {
    const { medplum, clinicId } = await requireClinicAuth(req);
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "all";
    const status = searchParams.get("status") || "open";

    if (!["all", "follow-up", "billing-exception"].includes(type)) {
      return NextResponse.json({ success: false, error: "Unsupported task type" }, { status: 400 });
    }
    if (status !== "open" && status !== "all") {
      return NextResponse.json({ success: false, error: "status must be 'open' or 'all'" }, { status: 400 });
    }

    const includeBilling = type === "all" || type === "billing-exception";
    const includeFollowUps = type === "all" || type === "follow-up";
    const [billingTasks, followUps] = await Promise.all([
      includeBilling ? listBillingExceptionTasks(medplum, status, clinicId) : Promise.resolve([]),
      includeFollowUps ? getAllFollowUps(medplum, clinicId) : Promise.resolve([]),
    ]);

    const billingItems = billingTasks.map(mapBillingTaskToUnifiedTask);
    const followUpItems = mapFollowUpsToReminderTasks(followUps);
    const tasks = sortUnifiedTasks([...followUpItems, ...billingItems]);
    const summary = {
      dueFollowUps: followUpItems.filter((item) => item.kind === "follow-up-due").length,
      attentionNeeded: followUpItems.filter((item) => item.kind === "follow-up-missing-phone" || item.kind === "follow-up-failed").length,
      billingExceptions: billingItems.filter((item) => status === "all" || item.status === "requested" || item.status === "in-progress").length,
    };

    return NextResponse.json({ success: true, count: tasks.length, tasks, summary });
  } catch (error) {
    return handleRouteError(error, "GET /api/tasks");
  }
}
