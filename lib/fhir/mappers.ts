import { Patient as AppPatient, Consultation, Prescription, ProcedureRecord } from "@/lib/models";
import { saveFhirResource } from "./firestore";
import { createFhirResource, isMedplumConfigured } from "./medplum-direct";
import { findDiagnosisByText } from "./terminologies/diagnoses";
import { findMedicationByName } from "./terminologies/medications";
import { validateFhirResource, logValidation } from "./validation";

type PatientInput = Omit<AppPatient, 'email' | 'postalCode' | 'address' | 'emergencyContact' | 'medicalHistory'> & {
  email?: string;
  postalCode?: string;
  address?: string;
  emergencyContact?: { name: string; relationship: string; phone: string };
  medicalHistory?: { allergies: string[]; conditions: string[]; medications: string[] };
};

type ConsultationInput = {
  date?: Date;
  updatedAt?: Date | string;
  type?: string;
  chiefComplaint?: string;
};

export async function toFhirPatient(app: PatientInput): Promise<{ reference: string; id: string }> {
  // MEDPLUM ONLY - No Firebase fallback
  const nameParts = app.fullName.trim().split(/\s+/);
  const family = nameParts.pop() || '';
  const given = nameParts.length > 0 ? nameParts : [app.fullName];

  const resource: any = {
    resourceType: "Patient",
    active: true,  // FHIR compliance: mark patient as active
    identifier: [
      {
        system: "http://www.nric.gov.my",
        value: app.nric,
        use: "official"
      }
    ],
    name: [
      {
        use: "official",
        text: app.fullName,
        family: family,
        given: given,
      }
    ],
    gender: app.gender,
    birthDate: typeof app.dateOfBirth === 'string'
      ? app.dateOfBirth.split('T')[0]
      : new Date(app.dateOfBirth).toISOString().split('T')[0],
    telecom: [
      ...(app.phone ? [{
        system: 'phone',
        value: app.phone,
        use: 'mobile'
      }] : []),
      ...(app.email ? [{
        system: 'email',
        value: app.email,
        use: 'home'
      }] : []),
    ],
    address: app.address ? [{
      use: 'home',
      text: app.address,
      postalCode: app.postalCode,
      country: 'MY',
    }] : undefined,
    contact: app.emergencyContact ? [{
      relationship: [{
        text: app.emergencyContact.relationship,
      }],
      name: { text: app.emergencyContact.name },
      telecom: [{
        system: 'phone',
        value: app.emergencyContact.phone,
        use: 'mobile',
      }],
    }] : undefined,
  };

  // Validate resource (always validate, but only throw in development)
  const validation = validateFhirResource(resource);
  if (!validation.valid) {
    console.error('❌ FHIR Patient validation failed:', validation.errors);
    if (process.env.NODE_ENV !== 'production') {
      throw new Error(`Invalid FHIR Patient: ${validation.errors.join(', ')}`);
    }
  }
  logValidation('Patient', validation);

  // Save to Medplum ONLY
  const created = await createFhirResource(resource);
  return { reference: `Patient/${created.id}`, id: created.id };
}

export async function toFhirEncounter(
  patientRef: string,
  consult: ConsultationInput,
  practitionerRef?: string  // Optional practitioner reference for FHIR compliance
): Promise<{ reference: string; id: string }> {
  // MEDPLUM ONLY - No Firebase fallback
  const startDate = new Date(consult.date ?? new Date()).toISOString();
  const endDate = consult.updatedAt
    ? new Date(consult.updatedAt).toISOString()
    : startDate;

  const resource: any = {
    resourceType: "Encounter",
    status: "finished",
    class: {
      system: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
      code: "AMB",
      display: "ambulatory"
    },
    type: [{
      text: consult.type || "General Consultation"
    }],
    subject: { reference: patientRef },
    participant: practitionerRef ? [{  // FHIR compliance: link practitioner
      type: [{
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType',
          code: 'PPRF',
          display: 'primary performer'
        }]
      }],
      individual: { reference: practitionerRef }
    }] : undefined,
    period: {
      start: startDate,
      end: endDate
    },
    reasonCode: consult.chiefComplaint ? [{
      text: consult.chiefComplaint
    }] : undefined,
  };

  // Save to Medplum ONLY
  const created = await createFhirResource(resource);
  return { reference: `Encounter/${created.id}`, id: created.id };
}

export async function toFhirCondition(patientRef: string, encounterRef: string, diagnosis: string): Promise<{ reference: string; id: string }> {
  // MEDPLUM ONLY - No Firebase fallback

  // Try to find coded diagnosis (ICD-10/SNOMED)
  const diagnosisCode = findDiagnosisByText(diagnosis);

  // Build code with both coding systems if available
  const code: any = {
    text: diagnosis
  };

  if (diagnosisCode) {
    code.coding = [];

    // Add ICD-10 code if available
    if (diagnosisCode.icd10) {
      code.coding.push({
        system: 'http://hl7.org/fhir/sid/icd-10',
        code: diagnosisCode.icd10.code,
        display: diagnosisCode.icd10.display
      });
    }

    // Add SNOMED CT code if available
    if (diagnosisCode.snomed) {
      code.coding.push({
        system: 'http://snomed.info/sct',
        code: diagnosisCode.snomed.code,
        display: diagnosisCode.snomed.display
      });
    }
  }

  const resource: any = {
    resourceType: "Condition",
    subject: { reference: patientRef },
    encounter: { reference: encounterRef },
    code,
    clinicalStatus: {
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
        code: 'active',
        display: 'Active'
      }]
    },
    verificationStatus: {
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
        code: 'confirmed',
        display: 'Confirmed'
      }]
    },
    recordedDate: new Date().toISOString(),
  };

  // Validate resource (always validate, but only throw in development)
  const validation = validateFhirResource(resource);
  if (!validation.valid) {
    console.error('❌ FHIR Condition validation failed:', validation.errors);
    if (process.env.NODE_ENV !== 'production') {
      throw new Error(`Invalid FHIR Condition: ${validation.errors.join(', ')}`);
    }
  }
  logValidation('Condition', validation);

  // Save to Medplum ONLY
  const created = await createFhirResource(resource);
  return { reference: `Condition/${created.id}`, id: created.id };
}

export async function toFhirMedicationRequest(patientRef: string, encounterRef: string, p: Prescription): Promise<{ reference: string; id: string }> {
  // MEDPLUM ONLY - No Firebase fallback
  const freqMap: Record<string, number> = { od: 1, bd: 2, tds: 3, qid: 4 };
  const frequency = p.frequency ? freqMap[(p.frequency as string).toLowerCase()] : undefined;

  // Try to find coded medication (RxNorm)
  const medicationCode = findMedicationByName(p.medication.name);

  // Build medication code with RxNorm if available
  const medicationCodeableConcept: any = {
    text: `${p.medication.name}${p.medication.strength ? ' ' + p.medication.strength : ''}`
  };

  if (medicationCode?.rxnorm) {
    medicationCodeableConcept.coding = [{
      system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
      code: medicationCode.rxnorm.code,
      display: medicationCode.rxnorm.display
    }];
  }

  const resource: any = {
    resourceType: "MedicationRequest",
    status: "active",
    intent: "order",
    subject: { reference: patientRef },
    encounter: { reference: encounterRef },
    medicationCodeableConcept,
    authoredOn: new Date().toISOString(),
    dosageInstruction: frequency ? [{
      timing: {
        repeat: {
          frequency,
          period: 1,
          periodUnit: 'd'
        }
      },
      text: `${p.frequency} for ${p.duration}`
    }] : undefined,
  };

  // Validate resource (always validate, but only throw in development)
  const validation = validateFhirResource(resource);
  if (!validation.valid) {
    console.error('❌ FHIR MedicationRequest validation failed:', validation.errors);
    if (process.env.NODE_ENV !== 'production') {
      throw new Error(`Invalid FHIR MedicationRequest: ${validation.errors.join(', ')}`);
    }
  }
  logValidation('MedicationRequest', validation);

  // Save to Medplum ONLY
  const created = await createFhirResource(resource);
  return { reference: `MedicationRequest/${created.id}`, id: created.id };
}

export async function toFhirServiceRequest(patientRef: string, encounterRef: string, pr: ProcedureRecord): Promise<{ reference: string; id: string }> {
  // MEDPLUM ONLY - No Firebase fallback
  const codeable = pr.codingCode || pr.codingDisplay || pr.codingSystem
    ? {
      coding: pr.codingCode
        ? [{
          system: pr.codingSystem || undefined,
          code: pr.codingCode,
          display: pr.codingDisplay || pr.name
        }]
        : undefined,
      text: pr.codingDisplay || pr.name,
    }
    : { text: pr.name };

  const resource: any = {
    resourceType: "ServiceRequest",
    status: "completed",
    intent: "order",
    subject: { reference: patientRef },
    encounter: { reference: encounterRef },
    code: codeable,
    note: pr.notes ? [{ text: pr.notes }] : undefined,
    authoredOn: new Date().toISOString(),
  };

  // Save to Medplum ONLY
  const created = await createFhirResource(resource);
  return { reference: `ServiceRequest/${created.id}`, id: created.id };
}


