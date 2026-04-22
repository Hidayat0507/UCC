/**
 * Lab Service - POCT (Point-of-Care Testing) Integration
 * 
 * Handles lab orders and results using FHIR resources:
 * - ServiceRequest: Lab orders
 * - DiagnosticReport: Lab results
 * - Observation: Individual test results
 */

import { MedplumClient } from '@medplum/core';
import { getAdminMedplum } from '@/lib/server/medplum-admin';
import type {
  ServiceRequest,
  DiagnosticReport,
  Observation,
  Patient as FHIRPatient,
} from '@medplum/fhirtypes';
import { createProvenanceForResource } from './provenance-service';
import { validateAndCreate } from './fhir-helpers';
import { createResourcesInBundle } from './bundle-helpers';
import { LAB_TESTS, type LabTestCode, type LabReportSummary, type LabResult } from './lab-constants';

export { LAB_TESTS, type LabTestCode, type LabReportSummary, type LabResult };

export interface LabOrderRequest {
  patientId: string;
  encounterId?: string;
  tests: LabTestCode[];
  priority?: 'routine' | 'urgent' | 'asap' | 'stat';
  clinicalNotes?: string;
  orderedBy?: string;
}

/**
 * Create a lab order (ServiceRequest)
 */
export async function createLabOrder(order: LabOrderRequest, medplum: MedplumClient): Promise<string> {
  const client = medplum;
  
  console.log(`📋 Creating lab order for patient ${order.patientId}`);

  // Create a ServiceRequest for each test
  const serviceRequests: ServiceRequest[] = [];
  
  for (const testCode of order.tests) {
    const test = LAB_TESTS[testCode];
    
    const serviceRequest = await validateAndCreate<ServiceRequest>(client, {
      resourceType: 'ServiceRequest',
      status: 'active',
      intent: 'order',
      priority: order.priority || 'routine',
      code: {
        coding: [{
          system: test.system,
          code: test.code,
          display: test.display,
        }],
        text: test.display,
      },
      subject: {
        reference: `Patient/${order.patientId}`,
      },
      encounter: order.encounterId ? {
        reference: `Encounter/${order.encounterId}`,
      } : undefined,
      authoredOn: new Date().toISOString(),
      requester: order.orderedBy
        ? order.orderedBy.startsWith('Practitioner/')
          ? { reference: order.orderedBy }
          : { display: order.orderedBy }
        : undefined,
      note: order.clinicalNotes ? [{
        text: order.clinicalNotes,
      }] : undefined,
    });
    
    serviceRequests.push(serviceRequest);
    console.log(`✅ Created ServiceRequest: ${serviceRequest.id} for ${test.display}`);
    
    // Create Provenance for audit trail (non-blocking)
    if (serviceRequest.id) {
      try {
        await createProvenanceForResource(
          client,
          'ServiceRequest',
          serviceRequest.id,
          order.orderedBy?.startsWith('Practitioner/') ? order.orderedBy.split('/')[1] : undefined,
          undefined,
          'CREATE'
        );
        console.log(`✅ Created Provenance for ServiceRequest/${serviceRequest.id}`);
      } catch (error) {
        console.warn(`⚠️  Failed to create Provenance for ServiceRequest (non-blocking):`, error);
      }
    }
  }

  // Return the first service request ID (or you could return all IDs)
  return serviceRequests[0]?.id || '';
}

/**
 * Receive lab results from POCT system and create DiagnosticReport + Observations
 */
export async function receiveLabResults(
  serviceRequestId: string,
  results: LabResult[],
  conclusion?: string,
  medplum?: MedplumClient
): Promise<string> {
  const client = medplum ?? (await getAdminMedplum());
  
  console.log(`📊 Receiving lab results for ServiceRequest ${serviceRequestId}`);

  // Get the original service request
  const serviceRequest = await client.readResource('ServiceRequest', serviceRequestId);
  
  if (!serviceRequest.subject?.reference) {
    throw new Error('ServiceRequest has no patient reference');
  }

  // Create Observation resources (prepare for Bundle)
  const observationResources: Observation[] = [];
  
  for (const result of results) {
    observationResources.push({
      resourceType: 'Observation',
      status: result.status as any,
      code: {
        coding: [{
          system: 'http://loinc.org',
          code: result.testCode,
          display: result.testName,
        }],
        text: result.testName,
      },
      subject: {
        reference: serviceRequest.subject.reference,
      },
      encounter: serviceRequest.encounter,
      effectiveDateTime: result.performedAt?.toISOString() || new Date().toISOString(),
      issued: new Date().toISOString(),
      valueQuantity: typeof result.value === 'number' ? {
        value: result.value,
        unit: result.unit,
      } : undefined,
      valueString: typeof result.value === 'string' ? result.value : undefined,
      referenceRange: result.referenceRange ? [{
        text: result.referenceRange,
      }] : undefined,
      interpretation: result.interpretation ? [{
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
          code: result.interpretation === 'normal' ? 'N' : 
                result.interpretation === 'high' ? 'H' : 
                result.interpretation === 'low' ? 'L' : 'A',
          display: result.interpretation,
        }],
      }] : undefined,
    } as Observation);
  }

  // Create DiagnosticReport resource (prepare for Bundle)
  // Note: We'll need to update result references after Observations are created
  const diagnosticReportResource: DiagnosticReport = {
    resourceType: 'DiagnosticReport',
    status: results.every(r => r.status === 'final') ? 'final' : 'partial',
    code: serviceRequest.code || { text: 'Laboratory Report' },
    subject: {
      reference: serviceRequest.subject.reference,
    },
    encounter: serviceRequest.encounter,
    effectiveDateTime: new Date().toISOString(),
    issued: new Date().toISOString(),
    result: [], // Will be populated after Observations are created
    conclusion: conclusion,
    basedOn: [{
      reference: `ServiceRequest/${serviceRequestId}`,
    }],
  };

  // Create all Observations in a Bundle transaction
  const observations = await createResourcesInBundle<Observation>(client, observationResources);
  console.log(`✅ Created ${observations.length} Observations in Bundle transaction`);

  // Create Provenance for Observations (non-blocking)
  for (const obs of observations) {
    if (obs.id) {
      try {
        await createProvenanceForResource(client, 'Observation', obs.id, undefined, undefined, 'CREATE');
      } catch (error) {
        console.warn(`⚠️  Failed to create Provenance for Observation/${obs.id} (non-blocking):`, error);
      }
    }
  }

  // Update DiagnosticReport with Observation references
  diagnosticReportResource.result = observations.map(obs => ({
    reference: `Observation/${obs.id}`,
  }));

  // Create DiagnosticReport
  const diagnosticReport = await validateAndCreate<DiagnosticReport>(client, diagnosticReportResource);

  console.log(`✅ Created DiagnosticReport: ${diagnosticReport.id}`);

  // Create Provenance for audit trail (non-blocking)
  if (diagnosticReport.id) {
    try {
      await createProvenanceForResource(
        client,
        'DiagnosticReport',
        diagnosticReport.id,
        undefined,
        undefined,
        'CREATE'
      );
      console.log(`✅ Created Provenance for DiagnosticReport/${diagnosticReport.id}`);
    } catch (error) {
      console.warn(`⚠️  Failed to create Provenance for DiagnosticReport (non-blocking):`, error);
    }
  }

  // Update ServiceRequest status to completed
  await client.updateResource({
    ...serviceRequest,
    status: 'completed',
  });

  return diagnosticReport.id!;
}

/**
 * Get all lab orders for a patient
 */
export async function getPatientLabOrders(patientId: string, medplum: MedplumClient): Promise<ServiceRequest[]> {
  const client = medplum;
  
  const orders = await client.searchResources('ServiceRequest', {
    subject: `Patient/${patientId}`,
    category: 'laboratory',
    _sort: '-authored',
  });

  return orders;
}

/**
 * Get all lab results for a patient
 */
export async function getPatientLabResults(patientId: string, medplum: MedplumClient): Promise<LabReportSummary[]> {
  const client = medplum;
  
  const reports = await client.searchResources('DiagnosticReport', {
    subject: `Patient/${patientId}`,
    _sort: '-issued',
  });

  const summaries: LabReportSummary[] = [];

  for (const report of reports) {
    const results: LabResult[] = [];
    
    // Get all observations in the report
    if (report.result) {
      for (const resultRef of report.result) {
        const obsId = resultRef.reference?.split('/')[1];
        if (obsId) {
          const obs = await client.readResource('Observation', obsId);
          
          results.push({
            testCode: obs.code?.coding?.[0]?.code || '',
            testName: obs.code?.text || obs.code?.coding?.[0]?.display || 'Unknown',
            value: (obs as any).valueQuantity?.value || (obs as any).valueString || 'N/A',
            unit: (obs as any).valueQuantity?.unit,
            referenceRange: obs.referenceRange?.[0]?.text,
            interpretation: obs.interpretation?.[0]?.coding?.[0]?.display as any,
            status: obs.status as any,
            performedAt: obs.effectiveDateTime ? new Date(obs.effectiveDateTime) : undefined,
          });
        }
      }
    }

    summaries.push({
      id: report.id!,
      patientId,
      patientName: report.subject?.display,
      encounterId: report.encounter?.reference?.split('/')[1],
      status: report.status as any,
      orderedAt: report.effectiveDateTime ? new Date(report.effectiveDateTime) : new Date(),
      issuedAt: report.issued ? new Date(report.issued) : undefined,
      results,
      conclusion: report.conclusion,
    });
  }

  return summaries;
}

/**
 * Get a specific lab report by ID
 */
export async function getLabReport(reportId: string, medplum: MedplumClient): Promise<LabReportSummary | null> {
  try {
    const client = medplum;
    
    const report = await client.readResource('DiagnosticReport', reportId);
    const results: LabResult[] = [];
    
    // Get all observations
    if (report.result) {
      for (const resultRef of report.result) {
        const obsId = resultRef.reference?.split('/')[1];
        if (obsId) {
          const obs = await client.readResource('Observation', obsId);
          
          results.push({
            testCode: obs.code?.coding?.[0]?.code || '',
            testName: obs.code?.text || obs.code?.coding?.[0]?.display || 'Unknown',
            value: (obs as any).valueQuantity?.value || (obs as any).valueString || 'N/A',
            unit: (obs as any).valueQuantity?.unit,
            referenceRange: obs.referenceRange?.[0]?.text,
            interpretation: obs.interpretation?.[0]?.coding?.[0]?.display as any,
            status: obs.status as any,
            performedAt: obs.effectiveDateTime ? new Date(obs.effectiveDateTime) : undefined,
          });
        }
      }
    }

    return {
      id: report.id!,
      patientId: report.subject?.reference?.split('/')[1] || '',
      patientName: report.subject?.display,
      encounterId: report.encounter?.reference?.split('/')[1],
      status: report.status as any,
      orderedAt: report.effectiveDateTime ? new Date(report.effectiveDateTime) : new Date(),
      issuedAt: report.issued ? new Date(report.issued) : undefined,
      results,
      conclusion: report.conclusion,
    };
  } catch (error) {
    console.error('Failed to get lab report:', error);
    return null;
  }
}

/**
 * Get lab results for an encounter
 */
export async function getEncounterLabResults(encounterId: string, medplum: MedplumClient): Promise<LabReportSummary[]> {
  const client = medplum;
  
  const reports = await client.searchResources('DiagnosticReport', {
    encounter: `Encounter/${encounterId}`,
    _sort: '-issued',
  });

  const summaries: LabReportSummary[] = [];

  for (const report of reports) {
    const results: LabResult[] = [];
    
    if (report.result) {
      for (const resultRef of report.result) {
        const obsId = resultRef.reference?.split('/')[1];
        if (obsId) {
          const obs = await client.readResource('Observation', obsId);
          
          results.push({
            testCode: obs.code?.coding?.[0]?.code || '',
            testName: obs.code?.text || obs.code?.coding?.[0]?.display || 'Unknown',
            value: (obs as any).valueQuantity?.value || (obs as any).valueString || 'N/A',
            unit: (obs as any).valueQuantity?.unit,
            referenceRange: obs.referenceRange?.[0]?.text,
            interpretation: obs.interpretation?.[0]?.coding?.[0]?.display as any,
            status: obs.status as any,
            performedAt: obs.effectiveDateTime ? new Date(obs.effectiveDateTime) : undefined,
          });
        }
      }
    }

    summaries.push({
      id: report.id!,
      patientId: report.subject?.reference?.split('/')[1] || '',
      patientName: report.subject?.display,
      encounterId,
      status: report.status as any,
      orderedAt: report.effectiveDateTime ? new Date(report.effectiveDateTime) : new Date(),
      issuedAt: report.issued ? new Date(report.issued) : undefined,
      results,
      conclusion: report.conclusion,
    });
  }

  return summaries;
}




