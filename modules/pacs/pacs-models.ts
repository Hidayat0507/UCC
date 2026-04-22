/**
 * PACS Module - FHIR-backed implementations.
 *
 * Stores imaging orders and reports as FHIR ServiceRequest / DiagnosticReport resources in Medplum.
 */

import { Buffer } from 'buffer';
import { MedplumClient } from '@medplum/core';
import type { DiagnosticReport, ServiceRequest } from '@medplum/fhirtypes';
import type { ImagingReport, ImagingStudy } from './types';

let medplumClient: MedplumClient | undefined;
let medplumInitPromise: Promise<MedplumClient> | undefined;

async function getMedplumClient(): Promise<MedplumClient> {
  if (medplumClient) return medplumClient;
  if (medplumInitPromise) return medplumInitPromise;

  const baseUrl = process.env.MEDPLUM_BASE_URL || process.env.NEXT_PUBLIC_MEDPLUM_BASE_URL || 'http://localhost:8103';
  const clientId = process.env.MEDPLUM_CLIENT_ID;
  const clientSecret = process.env.MEDPLUM_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Medplum credentials not configured');
  }

  medplumInitPromise = (async () => {
    const medplum = new MedplumClient({ baseUrl, clientId, clientSecret });
    await medplum.startClientLogin(clientId, clientSecret);
    medplumClient = medplum;
    return medplum;
  })();

  return medplumInitPromise;
}

const STATUS_TO_SERVICEREQUEST: Record<ImagingStudy['status'], ServiceRequest['status']> = {
  ordered: 'active',
  scheduled: 'on-hold',
  in_progress: 'active',
  completed: 'completed',
  reported: 'completed',
  cancelled: 'revoked',
};

const SERVICEREQUEST_TO_STATUS: Record<ServiceRequest['status'], ImagingStudy['status']> = {
  draft: 'ordered',
  active: 'ordered',
  'on-hold': 'scheduled',
  revoked: 'cancelled',
  completed: 'completed',
  'entered-in-error': 'cancelled',
  unknown: 'ordered',
};

function mapServiceRequestToImaging(sr: ServiceRequest, report?: ImagingReport): ImagingStudy {
  const status = sr.status ? SERVICEREQUEST_TO_STATUS[sr.status] || 'ordered' : 'ordered';
  const patientId = sr.subject?.reference?.split('/')[1] || '';
  const consultationId = sr.encounter?.reference?.split('/')[1];
  const priority = (sr.priority as ImagingStudy['priority']) || 'routine';
  const orderedAt = sr.authoredOn || sr.meta?.lastUpdated || new Date().toISOString();

  return {
    id: sr.id || '',
    patientId,
    patientName: sr.subject?.display,
    consultationId,
    modality: 'other',
    studyType: sr.code?.text || sr.code?.coding?.[0]?.display || 'Imaging study',
    bodyPart: sr.note?.find((n) => n.text?.startsWith('BodyPart:'))?.text?.replace('BodyPart:', '').trim() || '',
    status,
    priority,
    orderedBy: sr.requester?.display || 'Unknown',
    orderedAt,
    scheduledFor: sr.occurrenceDateTime,
    performedAt: undefined,
    completedAt: status === 'completed' ? sr.meta?.lastUpdated : undefined,
    reportedAt: report?.reportedAt,
    indication: sr.reasonCode?.[0]?.text || '',
    clinicalNotes: sr.note?.find((n) => n.text && !n.text.startsWith('BodyPart:'))?.text,
    technician: undefined,
    radiologist: report?.reportedBy,
    report,
    images: undefined,
    createdAt: orderedAt,
    updatedAt: sr.meta?.lastUpdated,
  };
}

async function findReportForRequest(medplum: MedplumClient, serviceRequestId: string): Promise<ImagingReport | undefined> {
  const reports = await medplum.searchResources<DiagnosticReport>('DiagnosticReport', {
    basedOn: `ServiceRequest/${serviceRequestId}`,
    _sort: '-issued',
    _count: '1',
  });

  const report = reports[0];
  if (!report) return undefined;

  return {
    findings: report.presentedForm?.[0]?.title || report.text?.div || report.conclusion || '',
    impression: report.conclusion || '',
    recommendations: report.conclusionCode?.[0]?.text,
    reportedBy: report.resultsInterpreter?.[0]?.display || 'Radiologist',
    reportedAt: report.issued || report.effectiveDateTime || report.meta?.lastUpdated || new Date().toISOString(),
    criticalFindings: report.code?.text?.toLowerCase()?.includes('critical') || false,
  };
}

export async function createImagingStudy(
  studyData: Omit<ImagingStudy, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  const medplum = await getMedplumClient();
  const authoredOn = typeof studyData.orderedAt === 'string' ? studyData.orderedAt : studyData.orderedAt?.toISOString() || new Date().toISOString();
  const status = STATUS_TO_SERVICEREQUEST[studyData.status] || 'active';

  const serviceRequest = await medplum.createResource<ServiceRequest>({
    resourceType: 'ServiceRequest',
    status,
    intent: 'order',
    category: [
      {
        coding: [
          {
            system: 'http://snomed.info/sct',
            code: '363679005',
            display: 'Imaging',
          },
        ],
      },
    ],
    priority: (studyData.priority as ServiceRequest['priority']) || 'routine',
    code: {
      text: studyData.studyType,
    },
    subject: { reference: `Patient/${studyData.patientId}`, display: studyData.patientName },
    encounter: studyData.consultationId ? { reference: `Encounter/${studyData.consultationId}` } : undefined,
    authoredOn,
    requester: studyData.orderedBy ? { display: studyData.orderedBy } : undefined,
    occurrenceDateTime: typeof studyData.scheduledFor === 'string' ? studyData.scheduledFor : studyData.scheduledFor?.toISOString(),
    reasonCode: studyData.indication ? [{ text: studyData.indication }] : undefined,
    note: [
      ...(studyData.bodyPart ? [{ text: `BodyPart: ${studyData.bodyPart}` }] : []),
      ...(studyData.clinicalNotes ? [{ text: studyData.clinicalNotes }] : []),
    ],
  });

  if (!serviceRequest.id) {
    throw new Error('Failed to create imaging ServiceRequest');
  }

  return serviceRequest.id;
}

export async function getImagingStudyById(id: string): Promise<ImagingStudy | null> {
  const medplum = await getMedplumClient();
  try {
    const sr = await medplum.readResource<ServiceRequest>('ServiceRequest', id);
    const report = await findReportForRequest(medplum, id);
    return mapServiceRequestToImaging(sr, report);
  } catch (err) {
    console.error('Failed to read imaging study from Medplum', err);
    return null;
  }
}

export async function getImagingStudiesByPatient(patientId: string): Promise<ImagingStudy[]> {
  const medplum = await getMedplumClient();
  try {
    const requests = await medplum.searchResources<ServiceRequest>('ServiceRequest', {
      subject: `Patient/${patientId}`,
      category: 'imaging',
      _sort: '-authored',
    });

    const studies: ImagingStudy[] = [];
    for (const sr of requests) {
      const report = await findReportForRequest(medplum, sr.id || '');
      studies.push(mapServiceRequestToImaging(sr, report));
    }
    return studies;
  } catch (err) {
    console.error('Failed to list imaging studies from Medplum', err);
    return [];
  }
}

export async function getImagingStudiesByStatus(status: ImagingStudy['status']): Promise<ImagingStudy[]> {
  const medplum = await getMedplumClient();
  const srStatus = STATUS_TO_SERVICEREQUEST[status] || 'active';
  try {
    const requests = await medplum.searchResources<ServiceRequest>('ServiceRequest', {
      category: 'imaging',
      status: srStatus,
      _sort: '-authored',
    });

    const studies: ImagingStudy[] = [];
    for (const sr of requests) {
      const report = await findReportForRequest(medplum, sr.id || '');
      studies.push(mapServiceRequestToImaging(sr, report));
    }
    return studies;
  } catch (err) {
    console.error('Failed to list imaging studies by status from Medplum', err);
    return [];
  }
}

export async function getTodaysImagingStudies(): Promise<ImagingStudy[]> {
  const medplum = await getMedplumClient();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = today.toISOString().split('T')[0];

  try {
    const requests = await medplum.searchResources<ServiceRequest>('ServiceRequest', {
      category: 'imaging',
      authored: `ge${start}`,
      _sort: '-authored',
    });

    const studies: ImagingStudy[] = [];
    for (const sr of requests) {
      const report = await findReportForRequest(medplum, sr.id || '');
      studies.push(mapServiceRequestToImaging(sr, report));
    }
    return studies;
  } catch (err) {
    console.error('Failed to list today imaging studies from Medplum', err);
    return [];
  }
}

export async function updateImagingStudy(
  id: string,
  updates: Partial<ImagingStudy>
): Promise<void> {
  const medplum = await getMedplumClient();
  const sr = await medplum.readResource<ServiceRequest>('ServiceRequest', id);

  const status = updates.status ? STATUS_TO_SERVICEREQUEST[updates.status] : sr.status;

  await medplum.updateResource<ServiceRequest>({
    ...sr,
    status,
    priority: updates.priority || sr.priority,
    occurrenceDateTime: updates.scheduledFor
      ? typeof updates.scheduledFor === 'string'
        ? updates.scheduledFor
        : updates.scheduledFor.toISOString()
      : sr.occurrenceDateTime,
    note: [
      ...(updates.bodyPart ? [{ text: `BodyPart: ${updates.bodyPart}` }] : []),
      ...(updates.clinicalNotes ? [{ text: updates.clinicalNotes }] : sr.note || []),
    ],
  });
}

export async function addImagingReport(
  id: string,
  report: ImagingStudy['report'],
  reportedBy: string
): Promise<void> {
  const medplum = await getMedplumClient();
  const sr = await medplum.readResource<ServiceRequest>('ServiceRequest', id);

  await medplum.createResource<DiagnosticReport>({
    resourceType: 'DiagnosticReport',
    status: 'final',
    code: sr.code,
    subject: sr.subject,
    encounter: sr.encounter,
    basedOn: [{ reference: `ServiceRequest/${id}` }],
    issued: report?.reportedAt
      ? typeof report.reportedAt === 'string'
        ? report.reportedAt
        : report.reportedAt.toISOString()
      : new Date().toISOString(),
    performer: reportedBy ? [{ display: reportedBy }] : undefined,
    resultsInterpreter: reportedBy ? [{ display: reportedBy }] : undefined,
    conclusion: report?.impression || report?.findings,
    presentedForm: report?.findings
      ? [{ contentType: 'text/plain', data: Buffer.from(report.findings, 'utf-8').toString('base64'), title: 'Findings' }]
      : undefined,
  });

  // Mark order as completed once report exists
  await medplum.updateResource<ServiceRequest>({
    ...sr,
    status: 'completed',
  });
}
