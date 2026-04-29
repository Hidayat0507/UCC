import type { Patient } from "@/lib/models";
import type { TriageData } from "@/lib/types";
import type { QueueStatus } from "@/lib/types";

/** Fields from `getTriageForPatient` / active triage encounter used to hydrate check-in. */
export type TriageEncounterFields = {
  triage?: TriageData;
  queueStatus?: QueueStatus | null;
  queueAddedAt?: string | null;
  visitIntent?: string;
  payerType?: string;
  paymentMethod?: string;
  billingPerson?: string;
  dependentName?: string;
  dependentRelationship?: string;
  dependentPhone?: string;
  assignedClinician?: string;
};

/** Same merge as the dedicated check-in route — suitable for `TriageForm`. */
export function mergePatientWithTriageForCheckIn(
  patient: Record<string, unknown>,
  triage: TriageEncounterFields,
  visitType?: string
): Patient {
  const p = patient as Record<string, any>;
  // Encounter summary may be {} or omit nested triage; keep patient-level triage/queue when not present.
  return {
    ...p,
    triage: triage.triage ?? p.triage,
    queueStatus: triage.queueStatus ?? p.queueStatus ?? null,
    queueAddedAt: triage.queueAddedAt ?? p.queueAddedAt ?? null,
    visitIntent: visitType ?? triage.visitIntent ?? p.visitIntent,
    payerType: triage.payerType ?? p.payerType,
    paymentMethod: triage.paymentMethod ?? p.paymentMethod,
    billingPerson: triage.billingPerson ?? p.billingPerson,
    dependentName: triage.dependentName ?? p.dependentName,
    dependentRelationship: triage.dependentRelationship ?? p.dependentRelationship,
    dependentPhone: triage.dependentPhone ?? p.dependentPhone,
    assignedClinician: triage.assignedClinician ?? p.assignedClinician,
  } as Patient;
}
