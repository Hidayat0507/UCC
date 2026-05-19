import { NextRequest, NextResponse } from "next/server";
import { getAllFollowUps, sendFollowUpWithTwilio } from "@/lib/fhir/communication-service";
import { requireClinicAuth } from "@/lib/server/medplum-auth";
import { handleRouteError } from "@/lib/server/route-helpers";

export async function POST(req: NextRequest) {
  try {
    const { medplum, clinicId } = await requireClinicAuth(req);
    const followUps = await getAllFollowUps(medplum, clinicId);
    const now = Date.now();
    const dueTwilio = followUps.filter((followUp) => {
      if (followUp.deliveryMode !== "twilio") return false;
      if (followUp.status === "completed") return false;
      if (!followUp.patientPhone) return false;
      if (!followUp.dueDate) return true;
      const due = new Date(followUp.dueDate).getTime();
      return Number.isFinite(due) && due <= now;
    });

    const sent = [];
    for (const followUp of dueTwilio) {
      sent.push(await sendFollowUpWithTwilio(medplum, followUp.id));
    }

    return NextResponse.json({ success: true, count: sent.length, followUps: sent });
  } catch (error) {
    return handleRouteError(error, "POST /api/follow-up/process-due");
  }
}
