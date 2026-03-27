/**
 * Consultation Service - Medplum as Source of Truth
 * 
 * This service treats Medplum FHIR server as the primary database.
 * All consultations are saved to and retrieved from Medplum.
 */

import { MedplumClient } from '@medplum/core';
import type { 
  Patient as FHIRPatient,
  Encounter,
  Condition,
  Observation,
  Procedure,
  MedicationRequest,
} from '@medplum/fhirtypes';
import { findDiagnosisByText } from './terminologies/diagnoses';
import { findMedicationByName } from './terminologies/medications';
import { validateFhirResource, logValidation } from './validation';
import { createProvenanceForResource } from './provenance-service';

// Local types that match your app's interface
export interface ConsultationData {
  patientId: string;
  chiefComplaint: string;
  diagnosis: string;
  procedures?: Array<{ name: string; price?: number }>;
  notes?: string;
  progressNote?: string;
  prescriptions?: Array<{
    medication: { id: string; name: string };
    frequency: string;
    duration: string;
    price?: number;
    strength?: string;
  }>;
  date?: Date;
  practitionerId?: string; // FHIR Practitioner ID
  organizationId?: string; // FHIR Organization ID
}

export interface SavedConsultation extends ConsultationData {
  id: string; // Encounter ID
  patientName?: string;
  createdAt: Date;
}

const CLINIC_IDENTIFIER_SYSTEM = 'clinic';
let medplumClient: MedplumClient | undefined;
let medplumInitPromise: Promise<MedplumClient> | undefined;

function addClinicIdentifier(identifiers: { system?: string; value?: string }[] | undefined, clinicId?: string) {
  if (!clinicId) return identifiers;
  const nextIdentifiers = [...(identifiers || [])];
  const hasClinicId = nextIdentifiers.some((id) => id.system === CLINIC_IDENTIFIER_SYSTEM && id.value === clinicId);
  if (!hasClinicId) {
    nextIdentifiers.push({ system: CLINIC_IDENTIFIER_SYSTEM, value: clinicId });
  }
  return nextIdentifiers;
}

function matchesClinic(resource: { identifier?: { system?: string; value?: string }[]; serviceProvider?: { reference?: string }; managingOrganization?: { reference?: string } }, clinicId?: string) {
  if (!clinicId) return true;
  const identifierMatch = resource.identifier?.some((id) => id.system === CLINIC_IDENTIFIER_SYSTEM && id.value === clinicId);
  const serviceProviderMatch = resource.serviceProvider?.reference === `Organization/${clinicId}`;
  const managingOrgMatch = resource.managingOrganization?.reference === `Organization/${clinicId}`;
  return Boolean(identifierMatch || serviceProviderMatch || managingOrgMatch);
}

function withClinicIdentifiers<T extends { identifier?: { system?: string; value?: string }[] }>(resource: T, clinicId?: string): T {
  if (!clinicId) return resource;
  return {
    ...resource,
    identifier: addClinicIdentifier(resource.identifier, clinicId),
  };
}

function withServiceProvider<T extends { [key: string]: any }>(resource: T, clinicId?: string): T {
  if (!clinicId) return resource;
  return {
    ...resource,
    serviceProvider: { reference: `Organization/${clinicId}` },
  };
}

async function validateAndCreate<T extends { resourceType: string }>(medplum: MedplumClient, resource: T) {
  const validation = validateFhirResource(resource);
  logValidation(resource.resourceType, validation);
  if (!validation.valid) {
    throw new Error(`Invalid ${resource.resourceType}: ${validation.errors.join(', ')}`);
  }
  return medplum.createResource(resource);
}

/**
 * Get authenticated Medplum client (singleton)
 */
async function getMedplumClient(): Promise<MedplumClient> {
  if (medplumClient) return medplumClient;
  if (medplumInitPromise) return medplumInitPromise;

  const baseUrl = process.env.MEDPLUM_BASE_URL || process.env.NEXT_PUBLIC_MEDPLUM_BASE_URL || 'http://localhost:8103';
  const clientId = process.env.MEDPLUM_CLIENT_ID;
  const clientSecret = process.env.MEDPLUM_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Medplum credentials not configured. Set MEDPLUM_CLIENT_ID and MEDPLUM_CLIENT_SECRET');
  }

  medplumInitPromise = (async () => {
    const medplum = new MedplumClient({
      baseUrl,
      clientId,
      clientSecret,
    });
    await medplum.startClientLogin(clientId, clientSecret);
    console.log('✅ Connected to Medplum');
    medplumClient = medplum;
    return medplum;
  })();

  return medplumInitPromise;
}

/**
 * Find or create a FHIR Patient by Firebase patient ID
 */
async function getOrCreatePatient(
  medplum: MedplumClient,
  patientData: {
    id: string; // Firebase patient ID
    name: string;
    ic?: string;
    dob?: Date;
    gender?: string;
    phone?: string;
    address?: string;
  },
  clinicId?: string
): Promise<FHIRPatient> {
  // Try to find existing patient by Firebase ID
  let patient = await medplum.searchOne('Patient', {
    identifier: `firebase|${patientData.id}`,
  });

  // If not found and we have IC, try searching by IC
  if (!patient && patientData.ic) {
    patient = await medplum.searchOne('Patient', {
      identifier: `ic|${patientData.ic}`,
    });
  }

  // Create new patient if not found
  if (!patient) {
    patient = await medplum.createResource({
      resourceType: 'Patient',
      identifier: addClinicIdentifier([
        { system: 'firebase', value: patientData.id },
        ...(patientData.ic ? [{ system: 'ic', value: patientData.ic }] : []),
      ], clinicId),
      name: [
        {
          text: (patientData as any).name || (patientData as any).fullName,
          family: ((patientData as any).name || (patientData as any).fullName)?.split(' ').pop(),
          given: ((patientData as any).name || (patientData as any).fullName)?.split(' ').slice(0, -1),
        },
      ],
      birthDate: (patientData as any).dob?.toISOString?.().split('T')[0] || (patientData as any).dateOfBirth,
      gender: (patientData.gender?.toLowerCase() as 'male' | 'female' | 'other') || 'unknown',
      telecom: patientData.phone ? [{ system: 'phone', value: patientData.phone }] : undefined,
      address: patientData.address ? [{ text: patientData.address }] : undefined,
      managingOrganization: clinicId ? { reference: `Organization/${clinicId}` } : undefined,
      identifier: addClinicIdentifier(undefined, clinicId),
    });
    console.log(`✅ Created FHIR Patient: ${patient.id}`);
  } else if (clinicId && !matchesClinic(patient as any, clinicId)) {
    // Patient exists but not linked to this clinic -> deny
    throw new Error('Patient does not belong to this clinic');
  } else if (clinicId) {
    // Ensure existing patient carries clinic identifier/organization
    const needsClinicTag = !matchesClinic(patient as any, clinicId);
    if (needsClinicTag) {
      patient = await medplum.updateResource({
        ...patient,
        identifier: addClinicIdentifier((patient as any).identifier, clinicId),
        managingOrganization: { reference: `Organization/${clinicId}` },
      } as any);
    }
  }

  return patient;
}

/**
 * Save a consultation directly to Medplum (source of truth)
 * Returns the Encounter ID which acts as the consultation ID
 */
export async function saveConsultationToMedplum(
  consultation: ConsultationData,
  patientData: {
    id: string;
    name: string;
    ic?: string;
    dob?: Date;
    gender?: string;
    phone?: string;
    address?: string;
  },
  clinicId?: string,
  medplum?: MedplumClient
): Promise<string> {
  const client = medplum ?? (await getMedplumClient());
  
  console.log(`💾 Saving consultation to Medplum (source of truth)...`);

  // 1. Verify patient exists in Medplum
  const patient = await getOrCreatePatient(client, patientData, clinicId);
  const patientReference = `Patient/${patient.id}`;

  // 2. Create Encounter (this is the consultation)
  const encounterDate = consultation.date?.toISOString() || new Date().toISOString();
  const encounter = await validateAndCreate<Encounter>(client, withServiceProvider(withClinicIdentifiers({
      resourceType: 'Encounter',
      status: 'finished',
      class: {
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
        code: 'AMB',
        display: 'ambulatory',
      },
      subject: {
        reference: patientReference,
        display: patientData.name,
      },
      period: {
        start: encounterDate,
        end: encounterDate,
      },
      identifier: [
        {
          system: 'firebase-patient',
          value: consultation.patientId,
        },
      ],
    }, clinicId), clinicId));
  console.log(`✅ Created Encounter (Consultation): ${encounter.id}`);

  // 3. Create Chief Complaint (Observation)
  if (consultation.chiefComplaint) {
    await validateAndCreate<Observation>(client, withClinicIdentifiers({
      resourceType: 'Observation',
      status: 'final',
      subject: { reference: patientReference },
      encounter: { reference: `Encounter/${encounter.id}` },
      code: {
        coding: [{ system: 'http://loinc.org', code: '8661-1', display: 'Chief Complaint' }],
        text: 'Chief Complaint',
      },
      valueString: consultation.chiefComplaint,
      effectiveDateTime: encounterDate,
    }, clinicId));
  }

  // 4. Create Diagnosis (Condition) with ICD-10/SNOMED if available
  if (consultation.diagnosis) {
    const diagnosisCode = findDiagnosisByText(consultation.diagnosis);
    const code: any = { text: consultation.diagnosis };
    if (diagnosisCode) {
      code.coding = [];
      if (diagnosisCode.icd10) {
        code.coding.push({
          system: 'http://hl7.org/fhir/sid/icd-10',
          code: diagnosisCode.icd10.code,
          display: diagnosisCode.icd10.display,
        });
      }
      if (diagnosisCode.snomed) {
        code.coding.push({
          system: 'http://snomed.info/sct',
          code: diagnosisCode.snomed.code,
          display: diagnosisCode.snomed.display,
        });
      }
    }

    await validateAndCreate<Condition>(client, withClinicIdentifiers({
      resourceType: 'Condition',
      subject: { reference: patientReference },
      encounter: { reference: `Encounter/${encounter.id}` },
      code,
      recordedDate: encounterDate,
      clinicalStatus: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
            code: 'active',
            display: 'Active',
          },
        ],
      },
      verificationStatus: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
            code: 'confirmed',
            display: 'Confirmed',
          },
        ],
      },
    }, clinicId));
  }

  // 5. Create Clinical Notes (Observation)
  if (consultation.notes) {
    await validateAndCreate<Observation>(client, withClinicIdentifiers({
      resourceType: 'Observation',
      status: 'final',
      subject: { reference: patientReference },
      encounter: { reference: `Encounter/${encounter.id}` },
      code: { text: 'Clinical Notes' },
      valueString: consultation.notes,
      effectiveDateTime: encounterDate,
    }, clinicId));
  }

  // 5b. Progress Note
  if (consultation.progressNote) {
    await validateAndCreate<Observation>(client, withClinicIdentifiers({
      resourceType: 'Observation',
      status: 'final',
      subject: { reference: patientReference },
      encounter: { reference: `Encounter/${encounter.id}` },
      code: { text: 'Progress Note' },
      valueString: consultation.progressNote,
      effectiveDateTime: encounterDate,
    }, clinicId));
  }

  // 6. Create Procedures
  if (consultation.procedures) {
    for (const proc of consultation.procedures) {
      const codeable = proc.codingCode || proc.codingDisplay || proc.codingSystem
        ? {
            coding: proc.codingCode
              ? [
                  {
                    system: proc.codingSystem || 'http://snomed.info/sct',
                    code: proc.codingCode,
                    display: proc.codingDisplay || proc.name,
                  },
                ]
              : undefined,
            text: proc.codingDisplay || proc.name,
          }
        : { text: proc.name };

      await validateAndCreate<Procedure>(client, withClinicIdentifiers({
        resourceType: 'Procedure',
        status: 'completed',
        subject: { reference: patientReference },
        encounter: { reference: `Encounter/${encounter.id}` },
        code: codeable,
        performedDateTime: encounterDate,
      }, clinicId));
    }
  }

  // 7. Create Prescriptions (MedicationRequests)
  if (consultation.prescriptions) {
    for (const rx of consultation.prescriptions) {
      const medicationCode = findMedicationByName(rx.medication.name);
      const medicationCodeableConcept: any = {
        text: `${rx.medication.name}${rx.medication.strength ? ` ${rx.medication.strength}` : ''}`,
      };
      if (medicationCode?.rxnorm) {
        medicationCodeableConcept.coding = [
          {
            system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
            code: medicationCode.rxnorm.code,
            display: medicationCode.rxnorm.display,
          },
        ];
      }

      await validateAndCreate<MedicationRequest>(client, withClinicIdentifiers({
        resourceType: 'MedicationRequest',
        status: 'active',
        intent: 'order',
        subject: { reference: patientReference },
        encounter: { reference: `Encounter/${encounter.id}` },
        medicationCodeableConcept,
        requester: consultation.practitionerId
          ? { reference: `Practitioner/${consultation.practitionerId}` }
          : undefined,
        dosageInstruction: [
          {
            text: `${(rx as any).dosage || ''} ${rx.frequency || ''} for ${rx.duration || ''}`.trim(),
          },
        ],
        authoredOn: encounterDate,
      }, clinicId));
    }
  }

  // Create Provenance for audit trail
  try {
    await createProvenanceForResource(
      client,
      'Encounter',
      encounter.id!,
      consultation.practitionerId,
      consultation.organizationId || clinicId,
      'CREATE'
    );
    console.log(`✅ Created Provenance for consultation audit trail`);
  } catch (error) {
    console.warn(`⚠️  Failed to create Provenance (non-blocking):`, error);
  }

  console.log(`✅ Consultation saved to Medplum: ${encounter.id}`);
  return encounter.id!;
}

/**
 * Get a consultation from Medplum by Encounter ID
 */
export async function getConsultationFromMedplum(
  encounterId: string,
  clinicId?: string,
  medplum?: MedplumClient
): Promise<SavedConsultation | null> {
  try {
    const client = medplum ?? (await getMedplumClient());
    
    // Get the encounter
    const encounter = await client.readResource('Encounter', encounterId);
    if (!matchesClinic(encounter as any, clinicId)) {
      return null;
    }
    
    // Get related resources
    const [conditions, observations, procedures, medications] = await Promise.all([
      client.searchResources('Condition', { encounter: `Encounter/${encounterId}` }),
      client.searchResources('Observation', { encounter: `Encounter/${encounterId}` }),
      client.searchResources('Procedure', { encounter: `Encounter/${encounterId}` }),
      client.searchResources('MedicationRequest', { encounter: `Encounter/${encounterId}` }),
    ]);

    // Extract Firebase patient ID from encounter identifier
    const firebasePatientId = encounter.identifier?.find(
      (id) => id.system === 'firebase-patient'
    )?.value || '';

    // Extract data
    const chiefComplaint = observations.find(
      (obs) => (obs as any).code?.text === 'Chief Complaint'
    );
    const clinicalNotes = observations.find(
      (obs) => (obs as any).code?.text === 'Clinical Notes'
    );

    const progressNote = observations.find(
      (obs) => (obs as any).code?.text === 'Progress Note'
    );

    return {
      id: encounter.id!,
      patientId: firebasePatientId,
      patientName: encounter.subject?.display,
      chiefComplaint: (chiefComplaint as any)?.valueString || '',
      diagnosis: conditions[0] ? ((conditions[0] as any).code?.text || '') : '',
      notes: (clinicalNotes as any)?.valueString,
      progressNote: (progressNote as any)?.valueString,
      procedures: procedures.map((proc) => ({
        name: (proc as any).code?.text || 'Procedure',
        price: 0,
      })),
      prescriptions: medications.map((med) => ({
        medication: {
          id: med.id || '',
          name: (med as any).medicationCodeableConcept?.text || 'Medication',
        },
        frequency: (med as any).dosageInstruction?.[0]?.text || '',
        duration: '',
        price: 0,
      })),
      date: encounter.period?.start ? new Date(encounter.period.start) : new Date(),
      createdAt: encounter.meta?.lastUpdated ? new Date(encounter.meta.lastUpdated) : new Date(),
    };
  } catch (error) {
    console.error('Failed to get consultation from Medplum:', error);
    return null;
  }
}

/**
 * Get all consultations for a patient (by Firebase patient ID)
 */
export async function getPatientConsultationsFromMedplum(
  firebasePatientId: string,
  clinicId?: string,
  medplum?: MedplumClient
): Promise<SavedConsultation[]> {
  try {
    const client = medplum ?? (await getMedplumClient());

    // Find encounters scoped to clinic (if provided), then filter by patient identifier
    const searchParams: Record<string, string> = clinicId
      ? {
          identifier: `${CLINIC_IDENTIFIER_SYSTEM}|${clinicId}`,
          'service-provider': `Organization/${clinicId}`,
          _sort: '-date',
        }
      : {
          identifier: `firebase-patient|${firebasePatientId}`,
          _sort: '-date',
        };

    const encounters = await client.searchResources('Encounter', searchParams);

    // Convert each encounter to SavedConsultation
    const consultations = await Promise.all(
      encounters
        .filter(
          (enc) =>
            matchesClinic(enc as any, clinicId) &&
            (enc as any).identifier?.some((id: any) => id.system === 'firebase-patient' && id.value === firebasePatientId)
        )
        .map((encounter) => getConsultationFromMedplum(encounter.id!, clinicId, client))
    );

    return consultations.filter((c): c is SavedConsultation => c !== null);
  } catch (error) {
    console.error('Failed to get patient consultations from Medplum:', error);
    return [];
  }
}

/**
 * Get all recent consultations (for dashboard, etc.)
 */
export async function getRecentConsultationsFromMedplum(
  limit = 10,
  clinicId?: string,
  medplum?: MedplumClient
): Promise<SavedConsultation[]> {
  try {
    const client = medplum ?? (await getMedplumClient());
    
    const encounters = await client.searchResources('Encounter', {
      _count: String(limit),
      _sort: '-date',
      ...(clinicId ? { 'service-provider': `Organization/${clinicId}`, identifier: `${CLINIC_IDENTIFIER_SYSTEM}|${clinicId}` } : {}),
    });

    const consultations = await Promise.all(
      encounters
        .filter((enc) => matchesClinic(enc as any, clinicId))
        .map((encounter) => getConsultationFromMedplum(encounter.id!, clinicId, client))
    );

    return consultations.filter((c): c is SavedConsultation => c !== null);
  } catch (error) {
    console.error('Failed to get recent consultations from Medplum:', error);
    return [];
  }
}
