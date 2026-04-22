/**
 * POCT Module - FHIR-backed implementations.
 *
 * Stores point-of-care test orders/results as FHIR ServiceRequest / DiagnosticReport resources in Medplum.
 */

import { Buffer } from 'buffer';
import type { MedplumClient } from '@medplum/core';
import type { DiagnosticReport, ServiceRequest } from '@medplum/fhirtypes';
import { getAdminMedplum } from '@/lib/server/medplum-auth';
import type { POCTTest, POCTTestResult } from './types';

const STATUS_TO_SERVICEREQUEST: Record<POCTTest['status'], ServiceRequest['status']> = {
  pending: 'active',
  in_progress: 'active',
  completed: 'completed',
  cancelled: 'revoked',
};

const SERVICEREQUEST_TO_STATUS: Record<ServiceRequest['status'], POCTTest['status']> = {
  draft: 'pending',
  active: 'pending',
  'on-hold': 'pending',
  revoked: 'cancelled',
  completed: 'completed',
  'entered-in-error': 'cancelled',
  unknown: 'pending',
};

function mapReportToResult(report?: DiagnosticReport): POCTTestResult | undefined {
  if (!report) return undefined;
  return {
    resultType: 'normal',
    findings: report.presentedForm?.[0]?.title || report.conclusion || undefined,
    interpretation: report.conclusion || undefined,
    numericValue: undefined,
    unit: undefined,
    referenceRange: undefined,
    attachments: report.presentedForm?.map((p) => p.url || '').filter(Boolean),
  };
}

function mapServiceRequestToPOCT(sr: ServiceRequest, report?: DiagnosticReport): POCTTest {
  const status = sr.status ? SERVICEREQUEST_TO_STATUS[sr.status] || 'pending' : 'pending';
  const patientId = sr.subject?.reference?.split('/')[1] || '';
  const consultationId = sr.encounter?.reference?.split('/')[1];
  const orderedAt = sr.authoredOn || sr.meta?.lastUpdated || new Date().toISOString();

  return {
    id: sr.id || '',
    patientId,
    patientName: sr.subject?.display,
    consultationId,
    testType: 'other',
    testName: sr.code?.text || sr.code?.coding?.[0]?.display || 'POCT Test',
    status,
    orderedBy: sr.requester?.display || 'Unknown',
    orderedAt,
    performedBy: report?.resultsInterpreter?.[0]?.display,
    performedAt: report?.effectiveDateTime,
    completedAt: status === 'completed' ? report?.issued || sr.meta?.lastUpdated : undefined,
    result: mapReportToResult(report),
    notes: sr.note?.map((n) => n.text).filter(Boolean).join(' | '),
    urgency: (sr.priority as POCTTest['urgency']) || 'routine',
    createdAt: orderedAt,
    updatedAt: sr.meta?.lastUpdated,
  };
}

async function findReportForRequest(medplum: MedplumClient, serviceRequestId: string): Promise<DiagnosticReport | undefined> {
  const reports = await medplum.searchResources('DiagnosticReport', {
    basedOn: `ServiceRequest/${serviceRequestId}`,
    _sort: '-issued',
    _count: '1',
  });
  return reports[0];
}

export async function createPOCTTest(
  testData: Omit<POCTTest, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  const medplum = await getAdminMedplum();
  const authoredOn = typeof testData.orderedAt === 'string' ? testData.orderedAt : testData.orderedAt?.toISOString() || new Date().toISOString();
  const status = STATUS_TO_SERVICEREQUEST[testData.status] || 'active';

  const sr = await medplum.createResource({
    resourceType: 'ServiceRequest',
    status,
    intent: 'order',
    category: [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/servicerequest-category',
            code: 'laboratory',
            display: 'Laboratory',
          },
        ],
      },
    ],
    priority: (testData.urgency as ServiceRequest['priority']) || 'routine',
    code: {
      text: testData.testName,
    },
    subject: { reference: `Patient/${testData.patientId}`, display: testData.patientName },
    encounter: testData.consultationId ? { reference: `Encounter/${testData.consultationId}` } : undefined,
    authoredOn,
    requester: testData.orderedBy ? { display: testData.orderedBy } : undefined,
    note: testData.notes ? [{ text: testData.notes }] : undefined,
  });

  const created = sr as any;
  if (!created.id) {
    throw new Error('Failed to create POCT ServiceRequest');
  }
  return created.id as string;
}

export async function getPOCTTestById(id: string): Promise<POCTTest | null> {
  const medplum = await getAdminMedplum();
  try {
    const sr = await medplum.readResource('ServiceRequest', id);
    const report = await findReportForRequest(medplum, id);
    return mapServiceRequestToPOCT(sr, report);
  } catch (err) {
    console.error('Failed to read POCT test from Medplum', err);
    return null;
  }
}

export async function getPOCTTestsByPatient(patientId: string): Promise<POCTTest[]> {
  const medplum = await getAdminMedplum();
  try {
    const requests = await medplum.searchResources('ServiceRequest', {
      subject: `Patient/${patientId}`,
      category: 'laboratory',
      _sort: '-authored',
    });

    const items: POCTTest[] = [];
    for (const sr of requests) {
      const report = await findReportForRequest(medplum, sr.id || '');
      items.push(mapServiceRequestToPOCT(sr, report));
    }
    return items;
  } catch (err) {
    console.error('Failed to list POCT tests from Medplum', err);
    return [];
  }
}

export async function getPOCTTestsByStatus(status: POCTTest['status']): Promise<POCTTest[]> {
  const medplum = await getAdminMedplum();
  const srStatus = STATUS_TO_SERVICEREQUEST[status] || 'active';
  try {
    const requests = await medplum.searchResources('ServiceRequest', {
      category: 'laboratory',
      status: srStatus,
      _sort: '-authored',
    });

    const items: POCTTest[] = [];
    for (const sr of requests) {
      const report = await findReportForRequest(medplum, sr.id || '');
      items.push(mapServiceRequestToPOCT(sr, report));
    }
    return items;
  } catch (err) {
    console.error('Failed to list POCT tests by status from Medplum', err);
    return [];
  }
}

export async function getTodaysPOCTTests(): Promise<POCTTest[]> {
  const medplum = await getAdminMedplum();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = today.toISOString().split('T')[0];

  try {
    const requests = await medplum.searchResources('ServiceRequest', {
      category: 'laboratory',
      authored: `ge${start}`,
      _sort: '-authored',
    });

    const items: POCTTest[] = [];
    for (const sr of requests) {
      const report = await findReportForRequest(medplum, sr.id || '');
      items.push(mapServiceRequestToPOCT(sr, report));
    }
    return items;
  } catch (err) {
    console.error('Failed to list today POCT tests from Medplum', err);
    return [];
  }
}

export async function updatePOCTTest(
  id: string,
  updates: Partial<POCTTest>
): Promise<void> {
  const medplum = await getAdminMedplum();
  const sr = await medplum.readResource('ServiceRequest', id);
  const status = updates.status ? STATUS_TO_SERVICEREQUEST[updates.status] : sr.status;

  await medplum.updateResource<ServiceRequest>({
    ...sr,
    status,
    priority: updates.urgency || sr.priority,
    note: updates.notes ? [{ text: updates.notes }] : sr.note,
  });
}

export async function completePOCTTest(
  id: string,
  result: POCTTest['result'],
  performedBy: string
): Promise<void> {
  const medplum = await getAdminMedplum();
  const sr = await medplum.readResource('ServiceRequest', id);

  await medplum.createResource({
    resourceType: 'DiagnosticReport',
    status: 'final',
    code: sr.code ?? { text: 'POCT Report' },
    subject: sr.subject,
    encounter: sr.encounter,
    basedOn: [{ reference: `ServiceRequest/${id}` }],
    effectiveDateTime: new Date().toISOString(),
    issued: new Date().toISOString(),
    resultsInterpreter: performedBy ? [{ display: performedBy }] : undefined,
    conclusion: result?.interpretation || result?.findings,
    presentedForm: result?.findings
      ? [{ contentType: 'text/plain', data: Buffer.from(result.findings, 'utf-8').toString('base64'), title: 'POCT Findings' }]
      : undefined,
  });

  await medplum.updateResource<ServiceRequest>({
    ...sr,
    status: 'completed',
  });
}
