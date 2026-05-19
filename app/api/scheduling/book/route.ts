import { NextRequest, NextResponse } from "next/server";
import { requireClinicAuth } from "@/lib/server/medplum-auth";
import { handleRouteError } from "@/lib/server/route-helpers";
import { bookSlotToAppointment } from "@/lib/fhir/scheduling-service";
import { getPatientFromMedplum } from "@/lib/fhir/patient-service";
import { createAppointmentReminderFollowUp } from "@/lib/fhir/communication-service";

export async function POST(request: NextRequest) {
  try {
    const { medplum, clinicId } = await requireClinicAuth(request);
    if (!clinicId) {
      return NextResponse.json({ error: "Clinic context is required" }, { status: 400 });
    }

    const { slotId, patientId, reason, clinicianDisplayOverride, durationMinutes } = await request.json();
    if (!slotId || !patientId || !reason) {
      return NextResponse.json({ error: "Missing slotId, patientId, or reason" }, { status: 400 });
    }

    const patient = await getPatientFromMedplum(patientId, clinicId, medplum, { includeMedicalHistory: false });
    if (!patient) {
      return NextResponse.json({ error: "Patient not found in clinic scope" }, { status: 404 });
    }

    const result = await bookSlotToAppointment(medplum, clinicId, {
      slotId,
      patientId,
      reason,
      clinicianDisplayOverride,
      durationMinutes,
    });
    try {
      await createAppointmentReminderFollowUp(medplum, { clinicId, appointmentId: result.appointmentId });
    } catch (followUpError) {
      console.error("[scheduling] Appointment booked but reminder follow-up creation failed", result.appointmentId, followUpError);
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return handleRouteError(error, "POST /api/scheduling/book");
  }
}
