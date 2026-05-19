import { NextRequest, NextResponse } from "next/server";
import { updateTwilioDeliveryStatus } from "@/lib/fhir/communication-service";
import { getAdminMedplum } from "@/lib/server/medplum-admin";
import { handleRouteError } from "@/lib/server/route-helpers";

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    const body = contentType.includes("application/json")
      ? await req.json().catch(() => ({}))
      : Object.fromEntries((await req.formData()).entries());

    const messageSid = String(body.MessageSid || body.SmsSid || body.messageSid || "");
    const status = String(body.MessageStatus || body.SmsStatus || body.status || "");
    const error = body.ErrorCode ? `Twilio error ${body.ErrorCode}` : body.error ? String(body.error) : undefined;

    if (!messageSid || !status) {
      return NextResponse.json({ success: false, error: "MessageSid and status are required" }, { status: 400 });
    }

    const medplum = await getAdminMedplum();
    const followUp = await updateTwilioDeliveryStatus(medplum, messageSid, status, error);
    return NextResponse.json({ success: true, found: Boolean(followUp) });
  } catch (error) {
    return handleRouteError(error, "POST /api/follow-up/twilio/status");
  }
}
