import { NextRequest, NextResponse } from "next/server";
import { requireClinicAuth } from "@/lib/server/medplum-auth";
import { handleRouteError } from "@/lib/server/route-helpers";
import {
  DEFAULT_APPOINTMENT_TEMPLATE,
  DEFAULT_REVIEW_TEMPLATE,
  getFollowUpSettings,
  updateFollowUpSettings,
  type FollowUpDeliveryMode,
} from "@/lib/fhir/communication-service";

function validDeliveryMode(value: unknown): value is FollowUpDeliveryMode {
  return value === "manual" || value === "twilio";
}

export async function GET(req: NextRequest) {
  try {
    const { medplum, clinicId } = await requireClinicAuth(req);
    const settings = await getFollowUpSettings(medplum, clinicId);
    return NextResponse.json({ success: true, settings });
  } catch (error) {
    return handleRouteError(error, "GET /api/settings/follow-up");
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { medplum, clinicId } = await requireClinicAuth(req);
    if (!clinicId) {
      return NextResponse.json({ success: false, error: "Clinic context is required" }, { status: 400 });
    }
    const body = await req.json().catch(() => null);
    if (!body || !validDeliveryMode(body.deliveryMode)) {
      return NextResponse.json({ success: false, error: "deliveryMode must be manual or twilio" }, { status: 400 });
    }

    const settings = await updateFollowUpSettings(medplum, clinicId, {
      deliveryMode: body.deliveryMode,
      googleReviewUrl: String(body.googleReviewUrl || "").trim(),
      reviewTemplate: String(body.reviewTemplate || DEFAULT_REVIEW_TEMPLATE).trim() || DEFAULT_REVIEW_TEMPLATE,
      appointmentTemplate:
        String(body.appointmentTemplate || DEFAULT_APPOINTMENT_TEMPLATE).trim() || DEFAULT_APPOINTMENT_TEMPLATE,
      twilioReviewContentSid: String(body.twilioReviewContentSid || "").trim(),
      twilioAppointmentContentSid: String(body.twilioAppointmentContentSid || "").trim(),
    });

    return NextResponse.json({ success: true, settings });
  } catch (error) {
    return handleRouteError(error, "PUT /api/settings/follow-up");
  }
}
