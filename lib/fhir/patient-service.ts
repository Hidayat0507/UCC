/**
 * Patient Service - Medplum FHIR as Source of Truth
 * 
 * Replaces Firebase patients with FHIR Patient resources
 */

import { MedplumClient } from '@medplum/core';
import { getAdminMedplum } from '@/lib/server/medplum-admin';
import type {
  Patient as FHIRPatient,
  AllergyIntolerance,
  Condition,
  MedicationStatement,
} from '@medplum/fhirtypes';
import { QueueStatus, TriageData, VitalSigns } from '../types';
import { TRIAGE_EXTENSION_URL } from './structure-definitions';
import { createProvenanceForResource } from './provenance-service';
import { validateAndCreate } from './fhir-helpers';

// Local Patient interface that matches your app
export interface PatientData {
  id?: string;
  fullName: string;
  nric: string;
  dateOfBirth: Date | string;
  gender: 'male' | 'female' | 'other';
  email?: string;
  phone: string;
  address: string;
  postalCode?: string;
  emergencyContact?: {
    name: string;
    relationship: string;
    phone: string;
  };
  medicalHistory?: {
    allergies: string[];
    conditions: string[];
    medications: string[];
  };
}

export interface SavedPatient extends PatientData {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  lastVisit?: Date;
  triage?: TriageData;
  queueStatus?: QueueStatus | null;
  queueAddedAt?: Date | string | null;
  visitIntent?: string;
  payerType?: string;
  paymentMethod?: string;
  billingPerson?: string;
  dependentName?: string;
  dependentRelationship?: string;
  dependentPhone?: string;
  assignedClinician?: string;
  registrationSource?: string;
  registrationAt?: string;
  performedBy?: string;
}

const CLINIC_IDENTIFIER_SYSTEM = 'clinic';

type Extension = { url: string;[key: string]: any };

function addClinicIdentifier(identifiers: { system?: string; value?: string }[] | undefined, clinicId?: string) {
  if (!clinicId) return identifiers;
  const nextIdentifiers = [...(identifiers || [])];
  const hasClinicId = nextIdentifiers.some((id) => id.system === CLINIC_IDENTIFIER_SYSTEM && id.value === clinicId);
  if (!hasClinicId) {
    nextIdentifiers.push({ system: CLINIC_IDENTIFIER_SYSTEM, value: clinicId });
  }
  return nextIdentifiers;
}

function matchesClinic(
  resource: { identifier?: { system?: string; value?: string }[]; managingOrganization?: { reference?: string } },
  clinicId?: string
): boolean {
  // Explicitly no clinic scope: allow (used by admin-level callers only).
  // All user-facing code paths must supply a clinicId.
  if (!clinicId) return true;
  const identifierMatch = resource.identifier?.some(
    (id) => id.system === CLINIC_IDENTIFIER_SYSTEM && id.value === clinicId
  );
  const orgRef = resource.managingOrganization?.reference;
  const organizationMatch = orgRef ? orgRef === `Organization/${clinicId}` : false;
  return Boolean(identifierMatch || organizationMatch);
}

/**
 * Like matchesClinic, but throws instead of returning false.
 * Use this on write paths (update, delete) where a mismatch is a security violation.
 */
function assertMatchesClinic(
  resource: Parameters<typeof matchesClinic>[0],
  clinicId: string,
  resourceLabel = 'resource'
): void {
  if (!matchesClinic(resource, clinicId)) {
    throw new Error(`Access denied: ${resourceLabel} does not belong to clinic '${clinicId}'`);
  }
}

function addManagingOrganization<T extends { [key: string]: any }>(resource: T, clinicId?: string): T {
  if (!clinicId) return resource;
  return {
    ...resource,
    managingOrganization: { reference: `Organization/${clinicId}` },
  };
}



/**
 * Convert FHIR Patient to app PatientData format
 */
function fhirPatientToPatientData(fhirPatient: FHIRPatient): SavedPatient {
  const name = fhirPatient.name?.[0];
  const fullName = name?.text || [name?.given?.join(' '), name?.family].filter(Boolean).join(' ') || 'Unknown';

  const nricIdentifier = fhirPatient.identifier?.find(id => id.system === 'nric' || id.system === 'ic');
  const phoneContact = fhirPatient.telecom?.find(t => t.system === 'phone');
  const emailContact = fhirPatient.telecom?.find(t => t.system === 'email');
  const emergencyContact = fhirPatient.contact?.[0];
  const triageInfo = parseTriageExtension(fhirPatient.extension);

  return {
    id: fhirPatient.id!,
    fullName,
    nric: nricIdentifier?.value || '',
    dateOfBirth: fhirPatient.birthDate || '',
    gender: (fhirPatient.gender as 'male' | 'female' | 'other') || 'other',
    email: emailContact?.value,
    phone: phoneContact?.value || '',
    address: fhirPatient.address?.[0]?.text || '',
    postalCode: fhirPatient.address?.[0]?.postalCode,
    emergencyContact: emergencyContact ? {
      name: emergencyContact.name?.text || '',
      relationship: emergencyContact.relationship?.[0]?.text || '',
      phone: emergencyContact.telecom?.find(t => t.system === 'phone')?.value || '',
    } : undefined,
    medicalHistory: {
      allergies: [],
      conditions: [],
      medications: [],
    },
    createdAt: fhirPatient.meta?.lastUpdated ? new Date(fhirPatient.meta.lastUpdated) : new Date(),
    updatedAt: fhirPatient.meta?.lastUpdated ? new Date(fhirPatient.meta.lastUpdated) : new Date(),
    triage: triageInfo.triage,
    queueStatus: triageInfo.queueStatus ?? null,
    queueAddedAt: triageInfo.queueAddedAt ?? null,
  };
}

function parseTriageExtension(extensions?: Extension[]): {
  triage?: TriageData;
  queueStatus?: QueueStatus | null;
  queueAddedAt?: string | null;
} {
  if (!extensions?.length) return {};
  const triageExt = extensions.find((ext) => ext.url === TRIAGE_EXTENSION_URL);
  if (!triageExt?.extension) return {};

  const getSub = (key: string) => triageExt.extension?.find((e: any) => e.url === key);
  const vitalExt = getSub('vitalSigns');
  const vitals: VitalSigns = {
    bloodPressureSystolic: vitalExt?.extension?.find((e: any) => e.url === 'bloodPressureSystolic')?.valueInteger,
    bloodPressureDiastolic: vitalExt?.extension?.find((e: any) => e.url === 'bloodPressureDiastolic')?.valueInteger,
    heartRate: vitalExt?.extension?.find((e: any) => e.url === 'heartRate')?.valueInteger,
    respiratoryRate: vitalExt?.extension?.find((e: any) => e.url === 'respiratoryRate')?.valueInteger,
    temperature: vitalExt?.extension?.find((e: any) => e.url === 'temperature')?.valueDecimal,
    oxygenSaturation: vitalExt?.extension?.find((e: any) => e.url === 'oxygenSaturation')?.valueInteger,
    painScore: vitalExt?.extension?.find((e: any) => e.url === 'painScore')?.valueInteger,
    weight: vitalExt?.extension?.find((e: any) => e.url === 'weight')?.valueDecimal,
    height: vitalExt?.extension?.find((e: any) => e.url === 'height')?.valueDecimal,
  };

  const redFlagsExt = getSub('redFlags');
  const redFlags =
    redFlagsExt?.extension
      ?.map((e: any) => e.valueString)
      ?.filter((val: string | undefined): val is string => Boolean(val)) ?? [];

  const triageLevel = getSub('triageLevel')?.valueInteger;
  const chiefComplaint = getSub('chiefComplaint')?.valueString;

  const triage =
    typeof triageLevel === 'number' && chiefComplaint
      ? ({
        triageLevel,
        chiefComplaint,
        triageNotes: getSub('triageNotes')?.valueString,
        triageBy: getSub('triageBy')?.valueString,
        triageAt: getSub('triageAt')?.valueDateTime,
        isTriaged: Boolean(getSub('isTriaged')?.valueBoolean),
        vitalSigns: vitals,
        redFlags,
      } as TriageData)
      : undefined;

  return {
    triage,
    queueStatus: (getSub('queueStatus')?.valueString as QueueStatus) ?? null,
    queueAddedAt: getSub('queueAddedAt')?.valueDateTime ?? null,
  };
}

function buildTriageExtension(triageData: Omit<TriageData, 'triageAt' | 'isTriaged'> & { queueStatus?: QueueStatus; queueAddedAt?: string }) {
  const nowIso = new Date().toISOString();
  const redFlagExtensions =
    triageData.redFlags?.map((flag) => ({
      url: 'flag',
      valueString: flag,
    })) ?? [];

  const vitalExtensions: Extension[] = [];
  const pushVital = (url: string, value: number | undefined, key: 'valueInteger' | 'valueDecimal' = 'valueInteger') => {
    if (typeof value === 'number') {
      vitalExtensions.push({ url, [key]: value });
    }
  };

  pushVital('bloodPressureSystolic', triageData.vitalSigns?.bloodPressureSystolic);
  pushVital('bloodPressureDiastolic', triageData.vitalSigns?.bloodPressureDiastolic);
  pushVital('heartRate', triageData.vitalSigns?.heartRate);
  pushVital('respiratoryRate', triageData.vitalSigns?.respiratoryRate);
  pushVital('temperature', triageData.vitalSigns?.temperature, 'valueDecimal');
  pushVital('oxygenSaturation', triageData.vitalSigns?.oxygenSaturation);
  pushVital('painScore', triageData.vitalSigns?.painScore);
  pushVital('weight', triageData.vitalSigns?.weight, 'valueDecimal');
  pushVital('height', triageData.vitalSigns?.height, 'valueDecimal');

  return {
    url: TRIAGE_EXTENSION_URL,
    extension: [
      { url: 'triageLevel', valueInteger: triageData.triageLevel },
      { url: 'chiefComplaint', valueString: triageData.chiefComplaint },
      ...(triageData.triageNotes ? [{ url: 'triageNotes', valueString: triageData.triageNotes }] : []),
      ...(triageData.triageBy ? [{ url: 'triageBy', valueString: triageData.triageBy }] : []),
      { url: 'triageAt', valueDateTime: nowIso },
      { url: 'isTriaged', valueBoolean: true },
      { url: 'queueStatus', valueString: triageData.queueStatus ?? 'waiting' },
      { url: 'queueAddedAt', valueDateTime: triageData.queueAddedAt ?? nowIso },
      { url: 'vitalSigns', extension: vitalExtensions },
      ...(redFlagExtensions.length
        ? [
          {
            url: 'redFlags',
            extension: redFlagExtensions,
          },
        ]
        : []),
    ],
  };
}

/**
 * Save a patient to Medplum as FHIR Patient resource
 */
export async function savePatientToMedplum(
  patientData: PatientData,
  clinicId: string | undefined,
  medplum: MedplumClient
): Promise<string> {
  const client = medplum;

  console.log(`💾 Saving patient to Medplum FHIR...`);

  // Check if patient already exists by NRIC
  let existingPatient: FHIRPatient | undefined;
  if (patientData.nric) {
    existingPatient = await client.searchOne('Patient', {
      identifier: `nric|${patientData.nric}`,
    });
    if (existingPatient && !matchesClinic(existingPatient, clinicId)) {
      existingPatient = undefined;
    }
  }

  const nameParts = patientData.fullName.split(' ');
  const family = nameParts.pop() || '';
  const given = nameParts;

  // Normalize birthDate to FHIR-compliant YYYY-MM-DD
  let birthDate: string | undefined;
  if (patientData.dateOfBirth) {
    try {
      const dob =
        patientData.dateOfBirth instanceof Date
          ? patientData.dateOfBirth
          : new Date(patientData.dateOfBirth);
      if (!isNaN(dob.getTime())) {
        birthDate = dob.toISOString().split('T')[0]; // FHIR date (no time)
      }
    } catch {
      // leave birthDate undefined; Medplum will reject if required
    }
  }

  const basePatient: FHIRPatient = {
    resourceType: 'Patient',
    active: true,  // FHIR compliance: mark patient as active
    identifier: addClinicIdentifier([
      { system: 'nric', value: patientData.nric },
    ], clinicId),
    name: [
      {
        text: patientData.fullName,
        family,
        given,
      },
    ],
    birthDate,
    gender: patientData.gender,
    telecom: [
      ...(patientData.phone ? [{ system: 'phone' as const, value: patientData.phone }] : []),
      ...(patientData.email ? [{ system: 'email' as const, value: patientData.email }] : []),
    ],
    address: patientData.address ? [
      {
        text: patientData.address,
        postalCode: patientData.postalCode,
      },
    ] : undefined,
    contact: patientData.emergencyContact ? [
      {
        name: { text: patientData.emergencyContact.name },
        relationship: [{ text: patientData.emergencyContact.relationship }],
        telecom: [{ system: 'phone', value: patientData.emergencyContact.phone }],
      },
    ] : undefined,
  };

  const fhirPatient = addManagingOrganization(basePatient, clinicId);

  let savedPatient: FHIRPatient;
  if (existingPatient) {
    // Update existing patient
    savedPatient = await client.updateResource({
      ...fhirPatient,
      id: existingPatient.id,
    });
    console.log(`✅ Updated FHIR Patient: ${savedPatient.id}`);
    
    // Create Provenance for update (non-blocking)
    if (savedPatient.id) {
      try {
        await createProvenanceForResource(
          client,
          'Patient',
          savedPatient.id,
          undefined,
          clinicId,
          'UPDATE'
        );
        console.log(`✅ Created Provenance for Patient/${savedPatient.id} (UPDATE)`);
      } catch (error) {
        console.warn(`⚠️  Failed to create Provenance for Patient (non-blocking):`, error);
      }
    }
  } else {
    // Create new patient
    savedPatient = await validateAndCreate<FHIRPatient>(client, fhirPatient);
    console.log(`✅ Created FHIR Patient: ${savedPatient.id}`);
    
    // Create Provenance for audit trail (non-blocking)
    if (savedPatient.id) {
      try {
        await createProvenanceForResource(
          client,
          'Patient',
          savedPatient.id,
          undefined,
          clinicId,
          'CREATE'
        );
        console.log(`✅ Created Provenance for Patient/${savedPatient.id}`);
      } catch (error) {
        console.warn(`⚠️  Failed to create Provenance for Patient (non-blocking):`, error);
      }
    }
  }

  // Save allergies as AllergyIntolerance resources
  if (patientData.medicalHistory?.allergies?.length) {
    for (const allergy of patientData.medicalHistory.allergies) {
      if (!allergy.trim()) continue;

      const allergyResource = await validateAndCreate<AllergyIntolerance>(client, {
        resourceType: 'AllergyIntolerance',
        patient: { reference: `Patient/${savedPatient.id}` },
        code: { text: allergy },
        clinicalStatus: {
          coding: [{ system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical', code: 'active' }],
        },
        verificationStatus: {
          coding: [{ system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-verification', code: 'confirmed' }],
        },
      });
      
      // Create Provenance for audit trail (non-blocking)
      if (allergyResource.id) {
        try {
          await createProvenanceForResource(
            client,
            'AllergyIntolerance',
            allergyResource.id,
            undefined,
            clinicId,
            'CREATE'
          );
        } catch (error) {
          console.warn(`⚠️  Failed to create Provenance for AllergyIntolerance (non-blocking):`, error);
        }
      }
    }
    console.log(`✅ Saved ${patientData.medicalHistory.allergies.length} allergies`);
  }

  // Save conditions as Condition resources
  if (patientData.medicalHistory?.conditions?.length) {
    for (const condition of patientData.medicalHistory.conditions) {
      if (!condition.trim()) continue;

      const conditionResource = await validateAndCreate<Condition>(client, {
        resourceType: 'Condition',
        subject: { reference: `Patient/${savedPatient.id}` },
        code: { text: condition },
        clinicalStatus: {
          coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active' }],
        },
      });
      
      // Create Provenance for audit trail (non-blocking)
      if (conditionResource.id) {
        try {
          await createProvenanceForResource(
            client,
            'Condition',
            conditionResource.id,
            undefined,
            clinicId,
            'CREATE'
          );
        } catch (error) {
          console.warn(`⚠️  Failed to create Provenance for Condition (non-blocking):`, error);
        }
      }
    }
    console.log(`✅ Saved ${patientData.medicalHistory.conditions.length} conditions`);
  }

  // Save medications as MedicationStatement resources
  if (patientData.medicalHistory?.medications?.length) {
    for (const medication of patientData.medicalHistory.medications) {
      if (!medication.trim()) continue;

      const medicationResource = await validateAndCreate<MedicationStatement>(client, {
        resourceType: 'MedicationStatement',
        status: 'active',
        subject: { reference: `Patient/${savedPatient.id}` },
        medicationCodeableConcept: { text: medication },
      });
      
      // Create Provenance for audit trail (non-blocking)
      if (medicationResource.id) {
        try {
          await createProvenanceForResource(
            client,
            'MedicationStatement',
            medicationResource.id,
            undefined,
            clinicId,
            'CREATE'
          );
        } catch (error) {
          console.warn(`⚠️  Failed to create Provenance for MedicationStatement (non-blocking):`, error);
        }
      }
    }
    console.log(`✅ Saved ${patientData.medicalHistory.medications.length} medications`);
  }

  return savedPatient.id!;
}

/**
 * Get a patient from Medplum by ID
 */
export async function getPatientFromMedplum(
  patientId: string,
  clinicId?: string,
  medplum?: MedplumClient
): Promise<SavedPatient | null> {
  try {
    const client = medplum ?? (await getAdminMedplum());

    const fhirPatient = await client.readResource('Patient', patientId);
    if (!matchesClinic(fhirPatient, clinicId)) {
      return null;
    }
    const patientData = fhirPatientToPatientData(fhirPatient);

    // Get allergies
    const allergies = await client.searchResources('AllergyIntolerance', {
      patient: `Patient/${patientId}`,
    });
    patientData.medicalHistory!.allergies = allergies.map((a: AllergyIntolerance) => (a as any).code?.text || 'Unknown allergy');

    // Get conditions
    const conditions = await client.searchResources('Condition', {
      subject: `Patient/${patientId}`,
    });
    patientData.medicalHistory!.conditions = conditions.map((c: Condition) => (c as any).code?.text || 'Unknown condition');

    // Get medications
    const medications = await client.searchResources('MedicationStatement', {
      subject: `Patient/${patientId}`,
    });
    patientData.medicalHistory!.medications = medications.map((m: MedicationStatement) => (m as any).medicationCodeableConcept?.text || 'Unknown medication');

    return patientData;
  } catch (error: any) {
    const status = error?.status ?? error?.statusCode;
    console.error(
      `Failed to get patient from Medplum (patientId=${patientId}, status=${status}):`,
      error?.message ?? error
    );
    return null;
  }
}

/**
 * Save triage + queue data to Medplum (Patient extension)
 */
export async function saveTriageToMedplum(
  patientId: string,
  triageData: Omit<TriageData, 'triageAt' | 'isTriaged'> & { triageBy?: string },
  clinicId?: string
): Promise<void> {
  const { getAdminMedplum } = await import('@/lib/server/medplum-admin');
  const medplum = await getAdminMedplum();
  const existingPatient = await medplum.readResource('Patient', patientId);
  if (clinicId) assertMatchesClinic(existingPatient, clinicId, `Patient/${patientId}`);

  const newExtension = buildTriageExtension({
    ...triageData,
    queueStatus: 'waiting',
    queueAddedAt: new Date().toISOString(),
  });

  const existingExtensions = existingPatient.extension || [];
  const filteredExtensions = existingExtensions.filter((ext: any) => ext.url !== TRIAGE_EXTENSION_URL);

  await medplum.updateResource({
    ...existingPatient,
    identifier: addClinicIdentifier(existingPatient.identifier, clinicId),
    extension: [...filteredExtensions, newExtension],
  });
}

/**
 * Update only queue status on the triage extension
 */
export async function updateQueueStatusInMedplum(patientId: string, status: QueueStatus | null, clinicId?: string): Promise<void> {
  const { getAdminMedplum } = await import('@/lib/server/medplum-admin');
  const medplum = await getAdminMedplum();
  const existingPatient = await medplum.readResource('Patient', patientId);
  if (clinicId) assertMatchesClinic(existingPatient, clinicId, `Patient/${patientId}`);
  const extensions = existingPatient.extension || [];
  const nowIso = new Date().toISOString();

  const triageExtIndex = extensions.findIndex((ext: any) => ext.url === TRIAGE_EXTENSION_URL);
  const triageExt: any =
    triageExtIndex >= 0
      ? { ...extensions[triageExtIndex], extension: [...(extensions[triageExtIndex].extension || [])] }
      : { url: TRIAGE_EXTENSION_URL, extension: [] };
  const currentQueueAddedAt =
    triageExt.extension.find((e: any) => e.url === 'queueAddedAt')?.valueDateTime || null;

  const setSub = (url: string, entry: any | null) => {
    const idx = triageExt.extension.findIndex((e: any) => e.url === url);
    if (entry === null) {
      if (idx >= 0) triageExt.extension.splice(idx, 1);
      return;
    }
    if (idx >= 0) {
      triageExt.extension[idx] = entry;
    } else {
      triageExt.extension.push(entry);
    }
  };

  if (status) {
    setSub('queueStatus', { url: 'queueStatus', valueString: status });
    setSub('queueAddedAt', { url: 'queueAddedAt', valueDateTime: currentQueueAddedAt || nowIso });
  } else {
    setSub('queueStatus', null);
    setSub('queueAddedAt', null);
  }

  const newExtensions = [...extensions];
  if (triageExtIndex >= 0) {
    newExtensions[triageExtIndex] = triageExt;
  } else {
    newExtensions.push(triageExt);
  }

  await medplum.updateResource({
    ...existingPatient,
    identifier: addClinicIdentifier(existingPatient.identifier, clinicId),
    extension: newExtensions,
  });
}

/**
 * Search patients by name or NRIC
 */
export async function searchPatientsInMedplum(
  query: string,
  clinicId: string | undefined,
  medplum: MedplumClient
): Promise<SavedPatient[]> {
  try {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) {
      return [];
    }

    // Medplum free-text `_query` matching has been unreliable for freshly-created
    // patients in this app's clinic-scoped flows. Pull the clinic-scoped patient set
    // and apply local matching so NRIC / name / phone searches behave deterministically.
    const patients = await getAllPatientsFromMedplum(300, clinicId, medplum);

    return patients
      .filter((patient) => {
        const fullName = patient.fullName?.toLowerCase() ?? '';
        const nric = patient.nric?.toLowerCase() ?? '';
        const phone = patient.phone?.toLowerCase() ?? '';
        return (
          fullName.includes(trimmed) ||
          nric.includes(trimmed) ||
          phone.includes(trimmed)
        );
      })
      .slice(0, 50);
  } catch (error) {
    console.error('Failed to search patients in Medplum:', error);
    return [];
  }
}

/**
 * Get all patients from Medplum
 */
export async function getAllPatientsFromMedplum(
  limit = 100,
  clinicId: string | undefined,
  medplum: MedplumClient
): Promise<SavedPatient[]> {
  try {
    const client = medplum;

    // Scope by clinic identifier only; `matchesClinic` still enforces org + identifier.
    // A combined `organization` search param was overly strict for some records and is unnecessary here.
    const patients = await client.searchResources('Patient', {
      _count: String(limit),
      _sort: '-_lastUpdated',
      ...(clinicId ? { identifier: `${CLINIC_IDENTIFIER_SYSTEM}|${clinicId}` } : {}),
    });

    return patients
      .filter((patient) => matchesClinic(patient as any, clinicId))
      .map(fhirPatientToPatientData);
  } catch (error) {
    console.error('Failed to get patients from Medplum:', error);
    return [];
  }
}

/**
 * Update a patient in Medplum
 */
export async function updatePatientInMedplum(
  patientId: string,
  updates: Partial<PatientData>,
  clinicId: string | undefined,
  medplum: MedplumClient
): Promise<void> {
  const client = medplum;

  const existingPatient = await client.readResource('Patient', patientId);
  if (clinicId) assertMatchesClinic(existingPatient, clinicId, `Patient/${patientId}`);

  // Merge updates
  const updatedPatient: FHIRPatient = addManagingOrganization({
    ...existingPatient,
    identifier: addClinicIdentifier(existingPatient.identifier, clinicId),
  }, clinicId);

  if (updates.fullName) {
    const nameParts = updates.fullName.split(' ');
    const family = nameParts.pop() || '';
    const given = nameParts;
    updatedPatient.name = [{ text: updates.fullName, family, given }];
  }

  if (updates.phone || updates.email) {
    updatedPatient.telecom = [
      ...(updates.phone ? [{ system: 'phone' as const, value: updates.phone }] : []),
      ...(updates.email ? [{ system: 'email' as const, value: updates.email }] : []),
    ];
  }

  if (updates.address) {
    updatedPatient.address = [{ text: updates.address, postalCode: updates.postalCode }];
  }

  await client.updateResource(updatedPatient);
  console.log(`✅ Updated FHIR Patient: ${patientId}`);
}
