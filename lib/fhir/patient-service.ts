/**
 * Patient Service - Medplum FHIR as Source of Truth
 * 
 * Replaces Firebase patients with FHIR Patient resources
 */

import { MedplumClient } from '@medplum/core';
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
import { applyMyCoreProfile, MY_CORE_IDENTIFIERS, MY_CORE_EXTENSIONS } from './mycore';

// Local Patient interface that matches your app
export type IdentifierType = 'nric' | 'non_malaysian_ic' | 'passport';

export interface PatientData {
  id?: string;
  fullName: string;
  identifierType?: IdentifierType;
  identifierValue?: string;
  nric?: string;
  mrn?: string;
  ethnicity?: string;
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
}

let medplumClient: MedplumClient | undefined;
let medplumInitPromise: Promise<MedplumClient> | undefined;

const CLINIC_IDENTIFIER_SYSTEM = 'clinic';
const IDENTIFIER_SYSTEMS: Record<IdentifierType, string> = {
  nric: MY_CORE_IDENTIFIERS.MYKAD,
  non_malaysian_ic: 'http://fhir.hie.moh.gov.my/sid/non-my-ic',
  passport: 'http://hl7.org/fhir/sid/passport-MYS',
};
const IDENTIFIER_TYPE_CODING: Record<IdentifierType, { system: string; code: string; display: string }> = {
  nric: {
    system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
    code: 'NI',
    display: 'National unique individual identifier',
  },
  non_malaysian_ic: {
    system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
    code: 'NI',
    display: 'National unique individual identifier',
  },
  passport: {
    system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
    code: 'PPN',
    display: 'Passport number',
  },
};

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

function matchesClinic(resource: { identifier?: { system?: string; value?: string }[]; managingOrganization?: { reference?: string } }, clinicId?: string) {
  if (!clinicId) return true;
  const identifierMatch = resource.identifier?.some((id) => id.system === CLINIC_IDENTIFIER_SYSTEM && id.value === clinicId);
  const orgRef = resource.managingOrganization?.reference;
  const organizationMatch = orgRef ? orgRef === `Organization/${clinicId}` : false;
  return Boolean(identifierMatch || organizationMatch);
}

function addManagingOrganization<T extends { [key: string]: any }>(resource: T, clinicId?: string): T {
  if (!clinicId) return resource;
  return {
    ...resource,
    managingOrganization: { reference: `Organization/${clinicId}` },
  };
}

/**
 * Get authenticated Medplum client (singleton)
 */
export async function getMedplumClient(): Promise<MedplumClient> {
  if (medplumClient) return medplumClient;
  if (medplumInitPromise) return medplumInitPromise;

  const baseUrl = process.env.MEDPLUM_BASE_URL || process.env.NEXT_PUBLIC_MEDPLUM_BASE_URL || 'http://localhost:8103';
  const clientId = process.env.MEDPLUM_CLIENT_ID;
  const clientSecret = process.env.MEDPLUM_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Medplum credentials not configured');
  }

  medplumInitPromise = (async () => {
    const medplum = new MedplumClient({
      baseUrl,
      clientId,
      clientSecret,
    });
    await medplum.startClientLogin(clientId, clientSecret);
    medplumClient = medplum;
    return medplum;
  })();

  return medplumInitPromise;
}

/**
 * Convert FHIR Patient to app PatientData format
 */
function fhirPatientToPatientData(fhirPatient: FHIRPatient): SavedPatient {
  const name = fhirPatient.name?.[0];
  const fullName = name?.text || [name?.given?.join(' '), name?.family].filter(Boolean).join(' ') || 'Unknown';

  const identifiers = fhirPatient.identifier ?? [];
  const passportIdentifier = identifiers.find(
    (id) => id.type?.coding?.some((coding) => coding.code === 'PPN') || id.system?.includes('passport')
  );
  const nonMyIdentifier = identifiers.find((id) => id.system === IDENTIFIER_SYSTEMS.non_malaysian_ic);
  const nricIdentifier = identifiers.find(
    (id) =>
      id.system === IDENTIFIER_SYSTEMS.nric ||
      id.system === 'nric' ||
      id.system === 'ic'
  );
  const pickedIdentifier = passportIdentifier ?? nonMyIdentifier ?? nricIdentifier ?? identifiers[0];

  let identifierType: IdentifierType = 'nric';
  if (passportIdentifier || pickedIdentifier?.type?.coding?.some((coding) => coding.code === 'PPN')) {
    identifierType = 'passport';
  } else if (pickedIdentifier?.system === IDENTIFIER_SYSTEMS.non_malaysian_ic) {
    identifierType = 'non_malaysian_ic';
  }

  const identifierValue = pickedIdentifier?.value || '';
  const mrnIdentifier = identifiers.find((id) => id.system === MY_CORE_IDENTIFIERS.PATIENT_MRN);
  const ethnicityExt = fhirPatient.extension?.find((ext) => ext.url === MY_CORE_EXTENSIONS.ETHNICITY);

  const phoneContact = fhirPatient.telecom?.find(t => t.system === 'phone');
  const emailContact = fhirPatient.telecom?.find(t => t.system === 'email');
  const emergencyContact = fhirPatient.contact?.[0];
  const triageInfo = parseTriageExtension(fhirPatient.extension);

  return {
    id: fhirPatient.id!,
    fullName,
    identifierType,
    identifierValue,
    nric: identifierValue,
    mrn: mrnIdentifier?.value,
    ethnicity: (ethnicityExt as any)?.valueString ?? undefined,
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

function normalizeIdentifier(patientData: PatientData): { type: IdentifierType; value: string } {
  const value = patientData.identifierValue ?? patientData.nric ?? '';
  const type = patientData.identifierType ?? 'nric';
  return { type, value };
}

function buildIdentifier(type: IdentifierType, value: string) {
  return {
    system: IDENTIFIER_SYSTEMS[type],
    value,
    type: {
      coding: [IDENTIFIER_TYPE_CODING[type]],
      text:
        type === 'nric'
          ? 'NRIC'
          : type === 'non_malaysian_ic'
          ? 'Non-Malaysian IC'
          : 'Passport',
    },
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
export async function savePatientToMedplum(patientData: PatientData, clinicId?: string): Promise<string> {
  const medplum = await getMedplumClient();

  console.log(`💾 Saving patient to Medplum FHIR...`);

  const { type: identifierType, value: identifierValue } = normalizeIdentifier(patientData);

  // Check if patient already exists by identifier
  let existingPatient: FHIRPatient | undefined;
  if (identifierValue) {
    const searchValues = [
      `${IDENTIFIER_SYSTEMS[identifierType]}|${identifierValue}`,
      ...(identifierType === 'nric'
        ? [`nric|${identifierValue}`, `ic|${identifierValue}`]
        : []),
    ];
    for (const identifier of searchValues) {
      existingPatient = await medplum.searchOne('Patient', { identifier });
      if (existingPatient && matchesClinic(existingPatient, clinicId)) {
        break;
      }
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

  const identifiers = [buildIdentifier(identifierType, identifierValue)];
  if (patientData.mrn) {
    identifiers.push({
      system: MY_CORE_IDENTIFIERS.PATIENT_MRN,
      value: patientData.mrn,
      type: {
        coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0203', code: 'MR', display: 'Medical Record Number' }],
        text: 'MRN',
      },
    });
  }

  const extensions: FHIRPatient['extension'] = [];
  if (patientData.ethnicity) {
    extensions.push({
      url: MY_CORE_EXTENSIONS.ETHNICITY,
      valueString: patientData.ethnicity,
    });
  }

  const basePatient: FHIRPatient = {
    resourceType: 'Patient',
    active: true,
    identifier: addClinicIdentifier(identifiers, clinicId),
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
    ...(extensions.length > 0 ? { extension: extensions } : {}),
  };

  const fhirPatient = applyMyCoreProfile(addManagingOrganization(basePatient, clinicId));

  let savedPatient: FHIRPatient;
  if (existingPatient) {
    // Update existing patient
    savedPatient = await medplum.updateResource(
      applyMyCoreProfile({
        ...fhirPatient,
        id: existingPatient.id,
      })
    );
    console.log(`✅ Updated FHIR Patient: ${savedPatient.id}`);
    
    // Create Provenance for update (non-blocking)
    if (savedPatient.id) {
      try {
        await createProvenanceForResource(
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
    savedPatient = await validateAndCreate<FHIRPatient>(medplum, fhirPatient);
    console.log(`✅ Created FHIR Patient: ${savedPatient.id}`);
    
    // Create Provenance for audit trail (non-blocking)
    if (savedPatient.id) {
      try {
        await createProvenanceForResource(
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

      const allergyResource = await validateAndCreate<AllergyIntolerance>(medplum, {
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

      const conditionResource = await validateAndCreate<Condition>(medplum, {
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

      const medicationResource = await validateAndCreate<MedicationStatement>(medplum, {
        resourceType: 'MedicationStatement',
        status: 'active',
        subject: { reference: `Patient/${savedPatient.id}` },
        medicationCodeableConcept: { text: medication },
      });
      
      // Create Provenance for audit trail (non-blocking)
      if (medicationResource.id) {
        try {
          await createProvenanceForResource(
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
export async function getPatientFromMedplum(patientId: string, clinicId?: string): Promise<SavedPatient | null> {
  try {
    const medplum = await getMedplumClient();

    const fhirPatient = await medplum.readResource('Patient', patientId);
    if (!matchesClinic(fhirPatient, clinicId)) {
      return null;
    }
    const patientData = fhirPatientToPatientData(fhirPatient);

    // Get allergies
    const allergies = await medplum.searchResources('AllergyIntolerance', {
      patient: `Patient/${patientId}`,
    });
    patientData.medicalHistory!.allergies = allergies.map(a => (a as any).code?.text || 'Unknown allergy');

    // Get conditions
    const conditions = await medplum.searchResources('Condition', {
      subject: `Patient/${patientId}`,
    });
    patientData.medicalHistory!.conditions = conditions.map(c => (c as any).code?.text || 'Unknown condition');

    // Get medications
    const medications = await medplum.searchResources('MedicationStatement', {
      subject: `Patient/${patientId}`,
    });
    patientData.medicalHistory!.medications = medications.map(m => (m as any).medicationCodeableConcept?.text || 'Unknown medication');

    return patientData;
  } catch (error) {
    console.error('Failed to get patient from Medplum:', error);
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
  const medplum = await getMedplumClient();
  const existingPatient = await medplum.readResource<FHIRPatient>('Patient', patientId);
  if (!matchesClinic(existingPatient, clinicId)) {
    throw new Error('Patient does not belong to this clinic');
  }

  const newExtension = buildTriageExtension({
    ...triageData,
    queueStatus: 'waiting',
    queueAddedAt: new Date().toISOString(),
  });

  const existingExtensions = existingPatient.extension || [];
  const filteredExtensions = existingExtensions.filter((ext: any) => ext.url !== TRIAGE_EXTENSION_URL);

  await medplum.updateResource(
    applyMyCoreProfile({
      ...existingPatient,
      identifier: addClinicIdentifier(existingPatient.identifier, clinicId),
      extension: [...filteredExtensions, newExtension],
    })
  );
}

/**
 * Update only queue status on the triage extension
 */
export async function updateQueueStatusInMedplum(patientId: string, status: QueueStatus | null, clinicId?: string): Promise<void> {
  const medplum = await getMedplumClient();
  const existingPatient = await medplum.readResource<FHIRPatient>('Patient', patientId);
  if (!matchesClinic(existingPatient, clinicId)) {
    throw new Error('Patient does not belong to this clinic');
  }
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

  await medplum.updateResource(
    applyMyCoreProfile({
      ...existingPatient,
      identifier: addClinicIdentifier(existingPatient.identifier, clinicId),
      extension: newExtensions,
    })
  );
}

/**
 * Search patients by name or NRIC
 */
export async function searchPatientsInMedplum(query: string, clinicId?: string): Promise<SavedPatient[]> {
  try {
    const medplum = await getMedplumClient();

    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return [];
    }

    // Medplum search behavior for Patient + clinic-scoped custom identifiers is not
    // consistent enough here, so fetch a bounded recent slice and filter locally.
    const patients = await medplum.searchResources('Patient', {
      _count: '200',
      _sort: '-_lastUpdated',
    });

    return patients
      .filter((patient) => matchesClinic(patient as any, clinicId))
      .map(fhirPatientToPatientData)
      .filter((patient) => {
        return (
          patient.fullName?.toLowerCase().includes(normalizedQuery) ||
          patient.nric?.toLowerCase().includes(normalizedQuery) ||
          patient.phone?.toLowerCase().includes(normalizedQuery) ||
          patient.identifierValue?.toLowerCase().includes(normalizedQuery)
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
export async function getAllPatientsFromMedplum(limit = 100, clinicId?: string): Promise<SavedPatient[]> {
  try {
    const medplum = await getMedplumClient();

    const patients = await medplum.searchResources('Patient', {
      _count: String(limit),
      _sort: '-_lastUpdated',
    });

    return patients
      .filter((patient) => matchesClinic(patient as any, clinicId))
      .map(fhirPatientToPatientData);
  } catch (error: any) {
    console.error('Failed to get patients from Medplum:', error);
    
    // Provide more specific error information
    if (error?.message?.includes('credentials') || error?.message?.includes('not configured')) {
      throw new Error('Medplum credentials not configured. Please set MEDPLUM_CLIENT_ID and MEDPLUM_CLIENT_SECRET environment variables.');
    }
    if (error?.outcome?.issue?.[0]?.code === 'forbidden' || error?.message?.includes('Unauthorized')) {
      throw new Error('Unauthorized access to Medplum. Please check your credentials and permissions.');
    }
    if (error?.message?.includes('Token expired')) {
      throw new Error('Medplum authentication token expired. Please refresh your session.');
    }
    
    throw new Error(error?.message || 'Failed to get patients from Medplum');
  }
}

/**
 * Update a patient in Medplum
 */
export async function updatePatientInMedplum(patientId: string, updates: Partial<PatientData>, clinicId?: string): Promise<void> {
  const medplum = await getMedplumClient();

  const existingPatient = await medplum.readResource('Patient', patientId);
  if (!matchesClinic(existingPatient, clinicId)) {
    throw new Error('Patient does not belong to this clinic');
  }

  // Merge updates
  const updatedPatient: FHIRPatient = applyMyCoreProfile(
    addManagingOrganization(
      {
        ...existingPatient,
        identifier: addClinicIdentifier(existingPatient.identifier, clinicId),
      },
      clinicId
    )
  );

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

  await medplum.updateResource(updatedPatient);
  console.log(`✅ Updated FHIR Patient: ${patientId}`);
}
