/**
 * Bundle Transaction Helpers
 * 
 * Provides utilities for creating FHIR Bundle transactions for atomic resource creation.
 */

import { MedplumClient } from '@medplum/core';
import type { Bundle, BundleEntry } from '@medplum/fhirtypes';
import { validateFhirResource } from './validation';
import { applyMyCoreProfile } from './mycore';

/**
 * Create multiple resources in a single Bundle transaction
 * 
 * This ensures atomicity - either all resources are created or none are.
 * 
 * @param medplum Medplum client
 * @param resources Array of resources to create
 * @returns Array of created resources with IDs
 */
export async function createResourcesInBundle<T extends { resourceType: string }>(
  medplum: MedplumClient,
  resources: T[]
): Promise<(T & { id: string })[]> {
  const profiledResources = resources.map((resource) => applyMyCoreProfile(resource as any) as T);

  // Validate all resources first
  for (const resource of profiledResources) {
    const validation = validateFhirResource(resource);
    if (!validation.valid) {
      throw new Error(`Invalid ${resource.resourceType}: ${validation.errors.join(', ')}`);
    }
  }

  // Create Bundle entries
  const entries: BundleEntry[] = profiledResources.map(resource => ({
    request: {
      method: 'POST',
      url: resource.resourceType,
    },
    resource: resource as any,
  }));

  // Create Bundle transaction
  const bundle: Bundle = {
    resourceType: 'Bundle',
    type: 'transaction',
    entry: entries,
  };

  // Execute transaction
  const result = await medplum.executeBatch(bundle);

  if (!result.entry || result.entry.length !== resources.length) {
    throw new Error('Bundle transaction failed: not all resources were created');
  }

  // Extract created resources
  const created: (T & { id: string })[] = [];
  for (let i = 0; i < result.entry.length; i++) {
    const entry = result.entry[i];
    if (entry.response?.status?.startsWith('201') || entry.response?.status?.startsWith('200')) {
      const resource = entry.resource as T & { id: string };
      if (!resource.id) {
        throw new Error(`Bundle entry ${i} missing resource ID`);
      }
      created.push(resource);
    } else {
      throw new Error(`Bundle entry ${i} failed: ${entry.response?.status} ${entry.response?.outcome?.issue?.[0]?.diagnostics || ''}`);
    }
  }

  console.log(`✅ Created ${created.length} resources in Bundle transaction`);
  return created;
}

/**
 * Create a Bundle for consultation-related resources (after Encounter is created)
 * 
 * This groups all consultation resources except the Encounter into a single transaction.
 */
export async function createConsultationResourcesInBundle(
  medplum: MedplumClient,
  resources: Array<{ resourceType: string }>
): Promise<Array<{ resourceType: string; id: string }>> {
  return createResourcesInBundle(medplum, resources);
}

