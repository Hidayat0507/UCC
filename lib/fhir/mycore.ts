import type { Resource } from '@medplum/fhirtypes';

const PROFILE_URL_BY_RESOURCE: Partial<Record<string, string>> = {
  Patient: 'http://fhir.hie.moh.gov.my/StructureDefinition/Patient-my-core',
  Practitioner: 'http://fhir.hie.moh.gov.my/StructureDefinition/Practitioner-my-core',
  Organization: 'http://fhir.hie.moh.gov.my/StructureDefinition/Organization-my-core',
  Encounter: 'http://fhir.hie.moh.gov.my/StructureDefinition/Encounter-my-core',
  Composition: 'http://fhir.hie.moh.gov.my/StructureDefinition/Composition-my-core',
  ServiceRequest: 'http://fhir.hie.moh.gov.my/StructureDefinition/ServiceRequest-my-core',
  Condition: 'http://fhir.hie.moh.gov.my/StructureDefinition/Condition-my-core',
  AllergyIntolerance:
    'http://fhir.hie.moh.gov.my/StructureDefinition/AllergyIntolerance-my-core',
  Medication: 'http://fhir.hie.moh.gov.my/StructureDefinition/Medication-my-core',
  MedicationRequest:
    'http://fhir.hie.moh.gov.my/StructureDefinition/MedicationRequest-my-core',
  Observation: 'http://fhir.hie.moh.gov.my/StructureDefinition/Observation-my-core',
  Procedure: 'http://fhir.hie.moh.gov.my/StructureDefinition/Procedure-my-core',
  DiagnosticReport: 'http://fhir.hie.moh.gov.my/StructureDefinition/DiagnosticReport-my-core',
  ImagingStudy: 'http://fhir.hie.moh.gov.my/StructureDefinition/ImagingStudy-my-core',
};

/**
 * MY Core identifier systems (Malaysia HIE)
 */
export const MY_CORE_IDENTIFIERS = {
  MYKAD: 'http://fhir.hie.moh.gov.my/sid/my-kad-no',
  PATIENT_MRN: 'http://fhir.hie.moh.gov.my/sid/patient-mrn',
  ENCOUNTER_ID: 'http://fhir.hie.moh.gov.my/sid/encounter-id',
  MMC_NO: 'http://fhir.hie.moh.gov.my/sid/mmc-no',
  COMPOSITION_ID: 'http://fhir.hie.moh.gov.my/sid/composition-id',
} as const;

/**
 * MY Core extension URLs
 */
export const MY_CORE_EXTENSIONS = {
  ETHNICITY: 'http://fhir.hie.moh.gov.my/StructureDefinition/ethnic-my-core',
} as const;

/**
 * MY Core code systems
 */
export const MY_CORE_CODE_SYSTEMS = {
  SPECIALTY: 'http://fhir.hie.moh.gov.my/CodeSystem/specialty-my-core',
  ACTIVE_INGREDIENT: 'http://fhir.hie.moh.gov.my/CodeSystem/active-ingredient-my-core',
} as const;

export function applyMyCoreProfile<T extends Resource>(resource: T): T {
  const profileUrl = PROFILE_URL_BY_RESOURCE[resource.resourceType];

  if (!profileUrl) {
    return resource;
  }

  const existingProfiles = resource.meta?.profile ?? [];
  if (existingProfiles.includes(profileUrl)) {
    return resource;
  }

  return {
    ...resource,
    meta: {
      ...resource.meta,
      profile: [...existingProfiles, profileUrl],
    },
  };
}
