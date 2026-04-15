import { NextRequest, NextResponse } from "next/server";
import { saveTriageEncounter } from "@/lib/fhir/triage-service";
import { TriageLevel, VitalSigns } from "@/lib/types";
import { getCurrentProfile, getMedplumForRequest } from "@/lib/server/medplum-auth";
import { getClinicIdFromRequest } from "@/lib/server/clinic";
import { handleRouteError } from "@/lib/server/route-helpers";

export async function POST(request: NextRequest) {
  try {
    const [medplum, clinicId] = await Promise.all([
      getMedplumForRequest(request),
      getClinicIdFromRequest(request),
    ]);

    if (!clinicId) {
      return NextResponse.json({ error: "Missing clinicId" }, { status: 400 });
    }

    const body = await request.json();
    
    const {
      patientId,
      triageLevel,
      chiefComplaint,
      vitalSigns,
      visitIntent,
      payerType,
      paymentMethod,
      assignedClinician,
      billingPerson,
      dependentName,
      dependentRelationship,
      dependentPhone,
      triageNotes,
      redFlags,
    } = body;

    // Validation
    if (!patientId || !triageLevel || !chiefComplaint) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (triageLevel < 1 || triageLevel > 5) {
      return NextResponse.json(
        { error: "Invalid triage level" },
        { status: 400 }
      );
    }

    // Determine triageBy from Medplum profile (if available)
    let triageBy = "Unknown";
    try {
      const profile = await getCurrentProfile(request);
      triageBy =
        (profile as any)?.name?.[0]?.text ||
        (profile as any)?.name?.[0]?.family ||
        (profile as any)?.id ||
        triageBy;
    } catch {
      // non-blocking
    }

    await saveTriageEncounter(patientId, {
      triageLevel: triageLevel as TriageLevel,
      chiefComplaint,
      vitalSigns: vitalSigns as VitalSigns,
      visitIntent,
      payerType,
      paymentMethod,
      assignedClinician,
      billingPerson,
      dependentName,
      dependentRelationship,
      dependentPhone,
      registrationSource: "triage",
      registrationAt: new Date().toISOString(),
      triageNotes,
      redFlags: redFlags || [],
      triageBy,
    }, medplum, clinicId);

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRouteError(error, 'POST /api/triage');
  }
}





