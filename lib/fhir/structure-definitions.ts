/**
 * Canonical URLs for custom extensions used in the app.
 * These can be published to a FHIR server as StructureDefinitions for interoperability.
 */

export const TRIAGE_EXTENSION_URL = 'https://ucc.emr/triage';
export const STORAGE_PATH_EXTENSION_URL = 'https://ucc.emr/storage-path';

export type ExtensionDefinition = {
  url: string;
  purpose: string;
  example?: Record<string, unknown>;
};

export const STRUCTURE_DEFINITIONS: Record<string, ExtensionDefinition> = {
  [TRIAGE_EXTENSION_URL]: {
    url: TRIAGE_EXTENSION_URL,
    purpose: 'Carries triage and queue metadata for a patient (vitals, triage level, queue status).',
    example: {
      url: TRIAGE_EXTENSION_URL,
      extension: [
        { url: 'triageLevel', valueInteger: 3 },
        { url: 'chiefComplaint', valueString: 'Chest pain' },
        { url: 'queueStatus', valueString: 'waiting' },
      ],
    },
  },
  [STORAGE_PATH_EXTENSION_URL]: {
    url: STORAGE_PATH_EXTENSION_URL,
    purpose: 'Stores bucket object path for a DocumentReference attachment to enable deletions/cleanup.',
    example: {
      url: STORAGE_PATH_EXTENSION_URL,
      valueString: 'patients/123/documents/abc.pdf',
    },
  },
};

export function getExtensionDefinition(url: string): ExtensionDefinition | undefined {
  return STRUCTURE_DEFINITIONS[url];
}

/**
 * Register StructureDefinitions in Medplum
 * 
 * This function registers custom extensions as StructureDefinition resources in Medplum.
 * It checks if they already exist before creating them.
 */
export async function registerStructureDefinitions(medplum: any): Promise<void> {
  try {
    // Register storage-path extension
    const existingStorage = await medplum.searchOne('StructureDefinition', {
      url: STORAGE_PATH_EXTENSION_URL,
    });
    if (!existingStorage) {
      const storagePathExtension = {
        resourceType: 'StructureDefinition',
        url: STORAGE_PATH_EXTENSION_URL,
        name: 'StoragePathExtension',
        status: 'active',
        fhirVersion: '4.0.1',
        kind: 'complex-type',
        abstract: false,
        context: [{ type: 'element', expression: 'DocumentReference' }],
        type: 'Extension',
        baseDefinition: 'http://hl7.org/fhir/StructureDefinition/Extension',
        derivation: 'constraint',
        snapshot: {
          element: [
            {
              id: 'Extension',
              path: 'Extension',
              short: 'Storage path for document attachment',
              definition: 'The internal storage path (e.g., GCS bucket path) for the document attachment, used for management and cleanup.',
              min: 0,
              max: '1',
              base: { path: 'Extension', min: 0, max: '*' },
            },
            {
              id: 'Extension.url',
              path: 'Extension.url',
              fixedUri: STORAGE_PATH_EXTENSION_URL,
            },
            {
              id: 'Extension.value[x]',
              path: 'Extension.value[x]',
              type: [{ code: 'string' }],
              min: 1,
              max: '1',
            },
          ],
        },
      };
      await medplum.createResource(storagePathExtension);
      console.log('✅ Registered storage-path extension');
    } else {
      console.log('✅ Storage-path extension already registered');
    }

    // Register triage extension
    const existingTriage = await medplum.searchOne('StructureDefinition', {
      url: TRIAGE_EXTENSION_URL,
    });
    if (!existingTriage) {
      const triageExtension = {
        resourceType: 'StructureDefinition',
        url: TRIAGE_EXTENSION_URL,
        name: 'TriageExtension',
        status: 'active',
        fhirVersion: '4.0.1',
        kind: 'complex-type',
        abstract: false,
        context: [{ type: 'element', expression: 'Patient' }],
        type: 'Extension',
        baseDefinition: 'http://hl7.org/fhir/StructureDefinition/Extension',
        derivation: 'constraint',
        snapshot: {
          element: [
            {
              id: 'Extension',
              path: 'Extension',
              short: 'Triage and queue metadata for a patient',
              definition: 'Contains information related to patient triage level, chief complaint, and queue status.',
              min: 0,
              max: '1',
              base: { path: 'Extension', min: 0, max: '*' },
            },
            {
              id: 'Extension.url',
              path: 'Extension.url',
              fixedUri: TRIAGE_EXTENSION_URL,
            },
            {
              id: 'Extension.extension',
              path: 'Extension.extension',
              min: 0,
              max: '*',
            },
            {
              id: 'Extension.extension:triageLevel',
              path: 'Extension.extension',
              sliceName: 'triageLevel',
              min: 0,
              max: '1',
              type: [{ code: 'Extension' }],
            },
            {
              id: 'Extension.extension:triageLevel.url',
              path: 'Extension.extension.url',
              fixedUri: 'triageLevel',
            },
            {
              id: 'Extension.extension:triageLevel.value[x]',
              path: 'Extension.extension.value[x]',
              type: [{ code: 'integer' }],
            },
            {
              id: 'Extension.extension:chiefComplaint',
              path: 'Extension.extension',
              sliceName: 'chiefComplaint',
              min: 0,
              max: '1',
              type: [{ code: 'Extension' }],
            },
            {
              id: 'Extension.extension:chiefComplaint.url',
              path: 'Extension.extension.url',
              fixedUri: 'chiefComplaint',
            },
            {
              id: 'Extension.extension:chiefComplaint.value[x]',
              path: 'Extension.extension.value[x]',
              type: [{ code: 'string' }],
            },
            {
              id: 'Extension.extension:queueStatus',
              path: 'Extension.extension',
              sliceName: 'queueStatus',
              min: 0,
              max: '1',
              type: [{ code: 'Extension' }],
            },
            {
              id: 'Extension.extension:queueStatus.url',
              path: 'Extension.extension.url',
              fixedUri: 'queueStatus',
            },
            {
              id: 'Extension.extension:queueStatus.value[x]',
              path: 'Extension.extension.value[x]',
              type: [{ code: 'string' }],
            },
          ],
        },
      };
      await medplum.createResource(triageExtension);
      console.log('✅ Registered triage extension');
    } else {
      console.log('✅ Triage extension already registered');
    }
  } catch (error) {
    console.error('❌ Failed to register StructureDefinitions:', error);
    throw error;
  }
}
