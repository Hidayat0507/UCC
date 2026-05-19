import { NextRequest, NextResponse } from "next/server";
import { requireClinicAuth } from "@/lib/server/medplum-auth";
import { handleRouteError } from "@/lib/server/route-helpers";
import {
  getAllFollowUps,
  createFollowUp,
  type FollowUpDeliveryMode,
  type FollowUpSourceType,
  type FollowUpTemplateKey,
  type FollowUpType,
} from "@/lib/fhir/communication-service";

export async function GET(req: NextRequest) {
  try {
    const { medplum, clinicId } = await requireClinicAuth(req);
    const followUps = await getAllFollowUps(medplum, clinicId);
    return NextResponse.json({ success: true, count: followUps.length, followUps });
  } catch (error) {
    return handleRouteError(error, "GET /api/follow-up");
  }
}

export async function POST(req: NextRequest) {
  try {
    const { medplum, clinicId } = await requireClinicAuth(req);
    const body = await req.json().catch(() => null);

    if (!body?.patientName || !body?.type || !body?.message) {
      return NextResponse.json(
        { success: false, error: "patientName, type, and message are required" },
        { status: 400 }
      );
    }
    if (!["review-request", "appointment-reminder"].includes(body.type)) {
      return NextResponse.json({ success: false, error: "Invalid type" }, { status: 400 });
    }

    const followUp = await createFollowUp(medplum, {
      patientName: String(body.patientName),
      patientId: body.patientId ? String(body.patientId) : undefined,
      patientPhone: body.patientPhone ? String(body.patientPhone) : undefined,
      clinicId,
      type: body.type as FollowUpType,
      message: String(body.message),
      dueDate: body.dueDate ? String(body.dueDate) : undefined,
      deliveryMode: body.deliveryMode as FollowUpDeliveryMode | undefined,
      templateKey: body.templateKey as FollowUpTemplateKey | undefined,
      sourceType: body.sourceType as FollowUpSourceType | undefined,
      sourceId: body.sourceId ? String(body.sourceId) : undefined,
    });

    return NextResponse.json({ success: true, followUp }, { status: 201 });
  } catch (error) {
    return handleRouteError(error, "POST /api/follow-up");
  }
}
