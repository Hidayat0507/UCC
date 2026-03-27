/**
 * FHIR Helper Functions
 * 
 * Common utilities for creating FHIR resources with validation and Provenance.
 * Use these helpers to ensure all resources are validated and audited.
 */

import { MedplumClient } from '@medplum/core';
import { validateFhirResource, logValidation } from './validation';
import { createProvenanceForResource } from './provenance-service';

/**
 * Validate and create a FHIR resource with automatic Provenance tracking
 * 
 * This is the recommended way to create any FHIR resource to ensure:
 * - Validation before creation
 * - Automatic audit trail (Provenance)
 * - Consistent error handling
 */
export async function validateAndCreateWithProvenance<T extends { resourceType: string }>(
  medplum: MedplumClient,
  resource: T,
  practitionerId?: string,
  organizationId?: string
): Promise<T & { id: string }> {
  // Validate first
  const validation = validateFhirResource(resource);
  logValidation(resource.resourceType, validation);
  
  if (!validation.valid) {
    throw new Error(`Invalid ${resource.resourceType}: ${validation.errors.join(', ')}`);
  }

  // Create resource
  const created = await medplum.createResource(resource as any) as T & { id: string };
  
  if (!created.id) {
    throw new Error(`Failed to create ${resource.resourceType} (missing id)`);
  }

  // Create Provenance for audit trail (non-blocking)
  try {
    await createProvenanceForResource(
      medplum,
      resource.resourceType,
      created.id,
      practitionerId,
      organizationId,
      'CREATE'
    );
    console.log(`✅ Created Provenance for ${resource.resourceType}/${created.id}`);
  } catch (error) {
    console.warn(`⚠️  Failed to create Provenance for ${resource.resourceType} (non-blocking):`, error);
  }

  return created;
}

/**
 * Validate a FHIR resource before creating
 * 
 * Use this if you want to validate but handle Provenance separately
 */
export async function validateAndCreate<T extends { resourceType: string }>(
  medplum: MedplumClient,
  resource: T
): Promise<T & { id: string }> {
  const validation = validateFhirResource(resource);
  logValidation(resource.resourceType, validation);
  
  if (!validation.valid) {
    throw new Error(`Invalid ${resource.resourceType}: ${validation.errors.join(', ')}`);
  }

  const created = await medplum.createResource(resource as any) as T & { id: string };
  
  if (!created.id) {
    throw new Error(`Failed to create ${resource.resourceType} (missing id)`);
  }

  return created;
}

/**
 * Create Provenance for a resource after creation
 * 
 * Use this if you created a resource without Provenance and want to add it
 */
export async function addProvenanceToResource(
  medplum: MedplumClient,
  resourceType: string,
  resourceId: string,
  practitionerId?: string,
  organizationId?: string,
  activity: 'CREATE' | 'UPDATE' | 'DELETE' = 'CREATE'
): Promise<void> {
  try {
    await createProvenanceForResource(
      medplum,
      resourceType,
      resourceId,
      practitionerId,
      organizationId,
      activity
    );
    console.log(`✅ Created Provenance for ${resourceType}/${resourceId}`);
  } catch (error) {
    console.warn(`⚠️  Failed to create Provenance (non-blocking):`, error);
    // Don't throw - Provenance is important but shouldn't block operations
  }
}

