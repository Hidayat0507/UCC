/**
 * Provenance Service - FHIR Audit Trail
 *
 * Creates Provenance resources to track who created/updated clinical resources.
 * This provides an audit trail for compliance and accountability.
 */

import { MedplumClient } from '@medplum/core';
import type { Provenance } from '@medplum/fhirtypes';

export interface ProvenanceData {
  target: Array<{ reference: string }>;
  recorded: string;
  agent: Array<{
    who?: { reference: string; display?: string };
    onBehalfOf?: { reference: string };
  }>;
  activity: {
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
  };
}

/**
 * Create a Provenance resource to track resource creation/update
 */
export async function createProvenance(medplum: MedplumClient, data: ProvenanceData): Promise<string> {
  const provenance: Provenance = {
    resourceType: 'Provenance',
    target: data.target,
    recorded: data.recorded,
    agent: data.agent.filter(agent => agent.who || agent.onBehalfOf).map(agent => ({
      who: agent.who!,
      onBehalfOf: agent.onBehalfOf,
    })),
    activity: data.activity,
  };

  const created = await medplum.createResource<Provenance>(provenance);
  if (!created.id) {
    throw new Error('Failed to create Provenance (missing id)');
  }

  console.log(`✅ Created Provenance for ${data.target.length} resource(s)`);
  return created.id;
}

/**
 * Create Provenance for a single resource
 */
export async function createProvenanceForResource(
  medplum: MedplumClient,
  resourceType: string,
  resourceId: string,
  practitionerId?: string,
  organizationId?: string,
  activity: 'CREATE' | 'UPDATE' | 'DELETE' = 'CREATE'
): Promise<string> {
  return createProvenance(medplum, {
    target: [{ reference: `${resourceType}/${resourceId}` }],
    recorded: new Date().toISOString(),
    agent: [
      {
        who: practitionerId
          ? { reference: `Practitioner/${practitionerId}` }
          : undefined,
        onBehalfOf: organizationId
          ? { reference: `Organization/${organizationId}` }
          : undefined,
      },
    ].filter(agent => agent.who || agent.onBehalfOf),
    activity: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/v3-DataOperation',
          code: activity,
          display: activity.toLowerCase(),
        },
      ],
    },
  });
}

/**
 * Create Provenance for multiple resources (e.g., consultation bundle)
 */
export async function createProvenanceForResources(
  medplum: MedplumClient,
  resources: Array<{ resourceType: string; resourceId: string }>,
  practitionerId?: string,
  organizationId?: string,
  activity: 'CREATE' | 'UPDATE' | 'DELETE' = 'CREATE'
): Promise<string> {
  return createProvenance(medplum, {
    target: resources.map(r => ({ reference: `${r.resourceType}/${r.resourceId}` })),
    recorded: new Date().toISOString(),
    agent: [
      {
        who: practitionerId
          ? { reference: `Practitioner/${practitionerId}` }
          : undefined,
        onBehalfOf: organizationId
          ? { reference: `Organization/${organizationId}` }
          : undefined,
      },
    ].filter(agent => agent.who || agent.onBehalfOf),
    activity: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/v3-DataOperation',
          code: activity,
          display: activity.toLowerCase(),
        },
      ],
    },
  });
}
