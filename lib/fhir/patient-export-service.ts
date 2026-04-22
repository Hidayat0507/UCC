import type { Bundle, Resource } from '@medplum/fhirtypes';
import { getMedplumClient } from './patient-service';

type ExportableResourceType =
  | 'Patient'
  | 'Organization'
  | 'Practitioner'
  | 'AllergyIntolerance'
  | 'Condition'
  | 'MedicationStatement'
  | 'Encounter'
  | 'Observation'
  | 'Procedure'
  | 'MedicationRequest'
  | 'Composition'
  | 'ClinicalImpression'
  | 'ServiceRequest'
  | 'DiagnosticReport'
  | 'ImagingStudy'
  | 'DocumentReference'
  | 'Appointment';

const EXPORT_RESOURCE_TYPES: ExportableResourceType[] = [
  'AllergyIntolerance',
  'Condition',
  'MedicationStatement',
  'Encounter',
  'Observation',
  'Procedure',
  'MedicationRequest',
  'Composition',
  'ClinicalImpression',
  'ServiceRequest',
  'DiagnosticReport',
  'ImagingStudy',
  'DocumentReference',
  'Appointment',
];

async function searchPatientScopedResources(
  resourceType: ExportableResourceType,
  patientId: string
): Promise<Resource[]> {
  const medplum = await getMedplumClient();

  const searchParamsByType: Partial<Record<ExportableResourceType, Record<string, string>>> = {
    AllergyIntolerance: { patient: `Patient/${patientId}`, _count: '500' },
    Condition: { patient: `Patient/${patientId}`, _count: '500' },
    MedicationStatement: { patient: `Patient/${patientId}`, _count: '500' },
    Encounter: { subject: `Patient/${patientId}`, _count: '500' },
    Observation: { patient: `Patient/${patientId}`, _count: '500' },
    Procedure: { patient: `Patient/${patientId}`, _count: '500' },
    MedicationRequest: { patient: `Patient/${patientId}`, _count: '500' },
    Composition: { subject: `Patient/${patientId}`, _count: '500' },
    ClinicalImpression: { patient: `Patient/${patientId}`, _count: '500' },
    ServiceRequest: { subject: `Patient/${patientId}`, _count: '500' },
    DiagnosticReport: { subject: `Patient/${patientId}`, _count: '500' },
    ImagingStudy: { patient: `Patient/${patientId}`, _count: '500' },
    DocumentReference: { subject: `Patient/${patientId}`, _count: '500' },
    Appointment: { actor: `Patient/${patientId}`, _count: '500' },
  };

  const searchParams = searchParamsByType[resourceType];
  if (!searchParams) {
    return [];
  }

  return (await medplum.searchResources(resourceType, searchParams)) as Resource[];
}

function getReferenceId(reference?: string, expectedType?: string): string | null {
  if (!reference) return null;
  const [resourceType, id] = reference.split('/');
  if (!resourceType || !id) return null;
  if (expectedType && resourceType !== expectedType) return null;
  return id;
}

function collectReferencedResources(resources: Resource[]): {
  organizationIds: Set<string>;
  practitionerIds: Set<string>;
} {
  const organizationIds = new Set<string>();
  const practitionerIds = new Set<string>();

  const pushReference = (reference?: string) => {
    const organizationId = getReferenceId(reference, 'Organization');
    if (organizationId) {
      organizationIds.add(organizationId);
      return;
    }

    const practitionerId = getReferenceId(reference, 'Practitioner');
    if (practitionerId) {
      practitionerIds.add(practitionerId);
    }
  };

  for (const resource of resources) {
    const anyResource = resource as any;
    pushReference(anyResource.managingOrganization?.reference);
    pushReference(anyResource.serviceProvider?.reference);
    pushReference(anyResource.organization?.reference);
    pushReference(anyResource.subject?.reference);
    pushReference(anyResource.patient?.reference);
    pushReference(anyResource.requester?.reference);
    pushReference(anyResource.assessor?.reference);
    pushReference(anyResource.performer?.[0]?.reference);
    pushReference(anyResource.author?.[0]?.reference);

    if (Array.isArray(anyResource.participant)) {
      for (const participant of anyResource.participant) {
        pushReference(participant?.actor?.reference);
      }
    }
  }

  return { organizationIds, practitionerIds };
}

async function readReferencedResources(
  type: 'Organization' | 'Practitioner',
  ids: Set<string>
): Promise<Resource[]> {
  const medplum = await getMedplumClient();
  const resources: Resource[] = [];

  for (const id of ids) {
    try {
      const resource = await medplum.readResource(type, id);
      resources.push(resource as Resource);
    } catch {
      // Best-effort; skip dangling references.
    }
  }

  return resources;
}

export async function exportPatientBundle(patientId: string): Promise<Bundle> {
  const medplum = await getMedplumClient();
  const patient = (await medplum.readResource('Patient', patientId)) as Resource;

  const relatedGroups = await Promise.all(
    EXPORT_RESOURCE_TYPES.map((resourceType) => searchPatientScopedResources(resourceType, patientId))
  );
  const relatedResources = relatedGroups.flat();
  const { organizationIds, practitionerIds } = collectReferencedResources([patient, ...relatedResources]);

  const [organizations, practitioners] = await Promise.all([
    readReferencedResources('Organization', organizationIds),
    readReferencedResources('Practitioner', practitionerIds),
  ]);

  const resources = [patient, ...organizations, ...practitioners, ...relatedResources];
  const seen = new Set<string>();

  return {
    resourceType: 'Bundle',
    type: 'collection',
    timestamp: new Date().toISOString(),
    entry: resources
      .filter((resource): resource is Resource & { resourceType: string; id?: string } => Boolean(resource?.resourceType))
      .filter((resource) => {
        const key = `${resource.resourceType}/${resource.id || ''}`;
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      })
      .map((resource) => ({
        fullUrl: resource.id ? `${medplum.getBaseUrl()}/fhir/R4/${resource.resourceType}/${resource.id}` : undefined,
        resource,
      })),
  };
}
