import { NextRequest } from "next/server";
import { z } from "zod";
import { writeServerAuditLog } from "@/lib/server/logging";
import { AUTH_DISABLED } from "@/lib/auth-config";

const exportBodySchema = z.object({
  consultationId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    let userId = 'system';

    if (!AUTH_DISABLED) {
      try {
        const { getCurrentProfile } = await import("@/lib/server/medplum-auth");
        const profile = await getCurrentProfile(req);
        userId = profile.id ?? 'unknown';
      } catch {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
      }
    }

    const body = await req.json();
    const parsed = exportBodySchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: 'Invalid body' }), { status: 400 });
    }
    const { consultationId } = parsed.data;

    const { getConsultationById, getPatientById } = await import("@/lib/models");
    const {
      toFhirPatient,
      toFhirEncounter,
      toFhirCondition,
      toFhirMedicationRequest,
      toFhirServiceRequest,
    } = await import("@/lib/fhir/mappers");

    const consultation = await getConsultationById(consultationId);
    if (!consultation) return new Response(JSON.stringify({ error: 'Consultation not found' }), { status: 404 });

    const patient = await getPatientById(consultation.patientId);
    if (!patient) return new Response(JSON.stringify({ error: 'Patient not found' }), { status: 404 });

    const { reference: patientRef } = await toFhirPatient(patient);
    const { reference: encounterRef } = await toFhirEncounter(patientRef, consultation);

    const created: Record<string, any> = { patient: patientRef, encounter: encounterRef };

    if (consultation.diagnosis) {
      created.conditionId = await toFhirCondition(patientRef, encounterRef, consultation.diagnosis);
    }

    if (Array.isArray(consultation.prescriptions)) {
      created.medicationRequestIds = await Promise.all(
        consultation.prescriptions.map(p => toFhirMedicationRequest(patientRef, encounterRef, p))
      );
    }

    if (Array.isArray(consultation.procedures)) {
      created.serviceRequestIds = await Promise.all(
        consultation.procedures.map(pr => toFhirServiceRequest(patientRef, encounterRef, pr))
      );
    }

    await writeServerAuditLog({
      action: 'fhir_export',
      subjectType: 'consultation',
      subjectId: consultation.id!,
      userId,
      metadata: { createdRefs: created },
    });

    return new Response(JSON.stringify({ ok: true, created }), { status: 200 });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: 'Unexpected error' }), { status: 500 });
  }
}
