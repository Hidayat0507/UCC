/**
 * Document Service - FHIR-backed patient documents.
 *
 * Registers bucket-hosted documents in Medplum as DocumentReference resources.
 */

import { MedplumClient } from '@medplum/core';
import type { DocumentReference } from '@medplum/fhirtypes';
import { STORAGE_PATH_EXTENSION_URL } from './structure-definitions';
import { validateFhirResource, logValidation } from './validation';
import { createProvenanceForResource } from './provenance-service';

export interface DocumentRegistration {
  patientId: string; // FHIR Patient ID
  title: string;
  url: string; // bucket URL or signed URL
  contentType: string;
  size?: number;
  uploadedBy?: string;
  storagePath?: string; // bucket object path (for cleanup)
}

export interface PatientDocumentSummary {
  id: string;
  title: string;
  url: string;
  contentType?: string;
  size?: number;
  uploadedAt?: string;
  uploadedBy?: string;
  storagePath?: string;
}

/**
 * Register a bucket-hosted document as a DocumentReference in Medplum.
 */
export async function createPatientDocument(medplum: MedplumClient, doc: DocumentRegistration): Promise<string> {
  const nowIso = new Date().toISOString();

  const resource: DocumentReference = {
    resourceType: 'DocumentReference',
    status: 'current',
    type: {
      coding: [
        {
          system: 'http://loinc.org',
          code: '34133-9',
          display: 'Summary of episode note',
        },
      ],
      text: 'Clinical document',
    },
    subject: { reference: `Patient/${doc.patientId}` },
    date: nowIso,
    author: doc.uploadedBy ? [{ display: doc.uploadedBy }] : undefined,
    content: [
      {
        attachment: {
          contentType: doc.contentType,
          url: doc.url,
          size: doc.size,
          title: doc.title,
          creation: nowIso,
        },
      },
    ],
    extension: doc.storagePath
      ? [
          {
            url: STORAGE_PATH_EXTENSION_URL,
            valueString: doc.storagePath,
          },
        ]
      : undefined,
  };

  const validation = validateFhirResource(resource);
  logValidation('DocumentReference', validation);
  if (!validation.valid) {
    throw new Error(`Invalid DocumentReference: ${validation.errors.join(', ')}`);
  }

  const created = await medplum.createResource<DocumentReference>(resource);
  if (!created.id) {
    throw new Error('Failed to create DocumentReference (missing id)');
  }

  // Create Provenance for audit trail (non-blocking)
  try {
    await createProvenanceForResource(medplum, 'DocumentReference', created.id, undefined, undefined, 'CREATE');
    console.log(`✅ Created Provenance for DocumentReference/${created.id}`);
  } catch (error) {
    console.warn(`⚠️  Failed to create Provenance for DocumentReference (non-blocking):`, error);
  }

  return created.id;
}

/**
 * List patient documents stored as DocumentReference resources.
 */
export async function listPatientDocuments(medplum: MedplumClient, patientId: string): Promise<PatientDocumentSummary[]> {
  const docs = (await medplum.searchResources('DocumentReference', {
    subject: `Patient/${patientId}`,
    _sort: '-date',
  })) as DocumentReference[];

  return docs
    .map((doc) => {
      const attachment = doc.content?.[0]?.attachment;
      const storagePath = doc.extension?.find((ext) => ext.url === STORAGE_PATH_EXTENSION_URL) as
        | { valueString?: string }
        | undefined;
      return {
        id: doc.id || '',
        title: attachment?.title || 'Document',
        url: attachment?.url || '',
        contentType: attachment?.contentType,
        size: attachment?.size,
        uploadedAt: attachment?.creation || doc.date,
        uploadedBy: doc.author?.[0]?.display,
        storagePath: storagePath?.valueString,
      };
    })
    .filter((d) => Boolean(d.url));
}

/**
 * Delete a DocumentReference in Medplum by id.
 */
export async function deletePatientDocument(medplum: MedplumClient, documentId: string): Promise<void> {
  await medplum.deleteResource('DocumentReference', documentId);
}
