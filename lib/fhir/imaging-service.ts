/**
 * Imaging Service - PACS (Picture Archiving and Communication System) Integration
 * 
 * Handles imaging orders and results using FHIR resources:
 * - ServiceRequest: Imaging orders
 * - ImagingStudy: DICOM study information
 * - DiagnosticReport: Imaging report/interpretation
 */

import { MedplumClient } from '@medplum/core';
import type {
  ServiceRequest,
  ImagingStudy,
  DiagnosticReport,
  Patient as FHIRPatient,
} from '@medplum/fhirtypes';
import { createProvenanceForResource } from './provenance-service';
import { validateAndCreate } from './fhir-helpers';

/**
 * Imaging modality codes (DICOM)
 */
export const IMAGING_MODALITIES = {
  CR: { code: 'CR', display: 'Computed Radiography', system: 'http://dicom.nema.org/resources/ontology/DCM' },
  CT: { code: 'CT', display: 'Computed Tomography', system: 'http://dicom.nema.org/resources/ontology/DCM' },
  MR: { code: 'MR', display: 'Magnetic Resonance', system: 'http://dicom.nema.org/resources/ontology/DCM' },
  US: { code: 'US', display: 'Ultrasound', system: 'http://dicom.nema.org/resources/ontology/DCM' },
  DX: { code: 'DX', display: 'Digital Radiography', system: 'http://dicom.nema.org/resources/ontology/DCM' },
  MG: { code: 'MG', display: 'Mammography', system: 'http://dicom.nema.org/resources/ontology/DCM' },
  NM: { code: 'NM', display: 'Nuclear Medicine', system: 'http://dicom.nema.org/resources/ontology/DCM' },
  PT: { code: 'PT', display: 'Positron Emission Tomography', system: 'http://dicom.nema.org/resources/ontology/DCM' },
  XA: { code: 'XA', display: 'X-Ray Angiography', system: 'http://dicom.nema.org/resources/ontology/DCM' },
} as const;

/**
 * Common imaging procedures with LOINC codes
 */
export const IMAGING_PROCEDURES = {
  // X-Ray
  CHEST_XRAY: { code: '36643-5', display: 'Chest X-ray', modality: 'DX', system: 'http://loinc.org' },
  CHEST_XRAY_2V: { code: '30746-2', display: 'Chest X-ray 2 views', modality: 'DX', system: 'http://loinc.org' },
  ABDOMEN_XRAY: { code: '36558-5', display: 'Abdomen X-ray', modality: 'DX', system: 'http://loinc.org' },
  SPINE_LUMBAR_XRAY: { code: '36567-6', display: 'Lumbar Spine X-ray', modality: 'DX', system: 'http://loinc.org' },
  KNEE_XRAY: { code: '37362-1', display: 'Knee X-ray', modality: 'DX', system: 'http://loinc.org' },
  
  // CT Scan
  HEAD_CT: { code: '30799-1', display: 'Head CT without contrast', modality: 'CT', system: 'http://loinc.org' },
  HEAD_CT_CONTRAST: { code: '24727-0', display: 'Head CT with contrast', modality: 'CT', system: 'http://loinc.org' },
  CHEST_CT: { code: '30800-7', display: 'Chest CT without contrast', modality: 'CT', system: 'http://loinc.org' },
  ABDOMEN_CT: { code: '30807-2', display: 'Abdomen CT without contrast', modality: 'CT', system: 'http://loinc.org' },
  CTPA: { code: '42273-8', display: 'CT Pulmonary Angiography', modality: 'CT', system: 'http://loinc.org' },
  
  // MRI
  BRAIN_MRI: { code: '24556-3', display: 'Brain MRI', modality: 'MR', system: 'http://loinc.org' },
  SPINE_MRI: { code: '24604-1', display: 'Spine MRI', modality: 'MR', system: 'http://loinc.org' },
  KNEE_MRI: { code: '24610-8', display: 'Knee MRI', modality: 'MR', system: 'http://loinc.org' },
  
  // Ultrasound
  ABDOMEN_US: { code: '24626-4', display: 'Abdomen Ultrasound', modality: 'US', system: 'http://loinc.org' },
  PELVIS_US: { code: '24638-9', display: 'Pelvis Ultrasound', modality: 'US', system: 'http://loinc.org' },
  OBSTETRIC_US: { code: '11525-3', display: 'Obstetric Ultrasound', modality: 'US', system: 'http://loinc.org' },
  THYROID_US: { code: '24651-2', display: 'Thyroid Ultrasound', modality: 'US', system: 'http://loinc.org' },
  ECHO: { code: '18752-6', display: 'Echocardiography', modality: 'US', system: 'http://loinc.org' },
  
  // Mammography
  MAMMOGRAM: { code: '37027-2', display: 'Mammography', modality: 'MG', system: 'http://loinc.org' },
  MAMMOGRAM_BILATERAL: { code: '24604-1', display: 'Bilateral Mammography', modality: 'MG', system: 'http://loinc.org' },
} as const;

export type ImagingProcedureCode = keyof typeof IMAGING_PROCEDURES;
export type ModalityCode = keyof typeof IMAGING_MODALITIES;

export interface ImagingOrderRequest {
  patientId: string; // FHIR Patient ID
  encounterId?: string; // FHIR Encounter ID
  procedures: ImagingProcedureCode[];
  priority?: 'routine' | 'urgent' | 'asap' | 'stat';
  clinicalIndication?: string;
  clinicalQuestion?: string;
  orderedBy?: string;
}

export interface DICOMSeries {
  uid: string; // Series Instance UID
  number: number;
  modality: string;
  description?: string;
  numberOfInstances: number;
  bodySite?: string;
  started?: Date;
  endpoint?: string; // WADO-RS endpoint to view images
}

export interface ImagingStudyData {
  studyUid: string; // Study Instance UID
  accessionNumber?: string;
  modality: string;
  description?: string;
  numberOfSeries: number;
  numberOfInstances: number;
  started?: Date;
  series: DICOMSeries[];
  pacsUrl?: string; // URL to view in PACS viewer
}

export interface ImagingReportSummary {
  id: string;
  patientId: string;
  patientName?: string;
  encounterId?: string;
  procedure: string;
  modality: string;
  status: 'registered' | 'available' | 'cancelled';
  orderedAt: Date;
  performedAt?: Date;
  study?: ImagingStudyData;
  report?: {
    id: string;
    status: 'partial' | 'preliminary' | 'final' | 'amended' | 'corrected' | 'cancelled';
    findings?: string;
    impression?: string;
    radiologist?: string;
    issuedAt?: Date;
  };
}

let medplumClient: MedplumClient | undefined;
let medplumInitPromise: Promise<MedplumClient> | undefined;

/**
 * Get authenticated Medplum client (singleton)
 */
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
    const medplum = new MedplumClient({
      baseUrl,
      clientId,
      clientSecret,
    });
    await medplum.startClientLogin(clientId, clientSecret);
    medplumClient = medplum;
    return medplum;
  })();

  return medplumInitPromise;
}

/**
 * Create an imaging order (ServiceRequest)
 */
export async function createImagingOrder(order: ImagingOrderRequest, medplum?: MedplumClient): Promise<string> {
  const client = medplum ?? (await getMedplumClient());
  
  console.log(`🏥 Creating imaging order for patient ${order.patientId}`);

  const serviceRequests: ServiceRequest[] = [];
  
  for (const procedureCode of order.procedures) {
    const procedure = IMAGING_PROCEDURES[procedureCode];
    const modality = IMAGING_MODALITIES[procedure.modality as ModalityCode];
    
    const serviceRequest = await validateAndCreate<ServiceRequest>(client, {
      resourceType: 'ServiceRequest',
      status: 'active',
      intent: 'order',
      priority: order.priority || 'routine',
      category: [{
        coding: [{
          system: 'http://snomed.info/sct',
          code: '363679005',
          display: 'Imaging',
        }],
      }],
      code: {
        coding: [{
          system: procedure.system,
          code: procedure.code,
          display: procedure.display,
        }],
        text: procedure.display,
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
      reasonCode: order.clinicalIndication ? [{
        text: order.clinicalIndication,
      }] : undefined,
      note: [
        ...(order.clinicalIndication ? [{ text: `Clinical Indication: ${order.clinicalIndication}` }] : []),
        ...(order.clinicalQuestion ? [{ text: `Clinical Question: ${order.clinicalQuestion}` }] : []),
      ],
    });
    
    serviceRequests.push(serviceRequest);
    console.log(`✅ Created imaging ServiceRequest: ${serviceRequest.id} for ${procedure.display}`);
    
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

  return serviceRequests[0]?.id || '';
}

/**
 * Receive imaging study from PACS and create ImagingStudy resource
 */
export async function receiveImagingStudy(
  serviceRequestId: string,
  studyData: ImagingStudyData,
  medplum?: MedplumClient
): Promise<string> {
  const client = medplum ?? (await getMedplumClient());
  
  console.log(`📸 Receiving imaging study ${studyData.studyUid} for ServiceRequest ${serviceRequestId}`);

  // Get the original service request
  const serviceRequest = await client.readResource('ServiceRequest', serviceRequestId);
  
  if (!serviceRequest.subject?.reference) {
    throw new Error('ServiceRequest has no patient reference');
  }

  // Create ImagingStudy resource
  const imagingStudy = await validateAndCreate<ImagingStudy>(client, {
    resourceType: 'ImagingStudy',
    status: 'available',
    subject: {
      reference: serviceRequest.subject.reference,
    },
    encounter: serviceRequest.encounter,
    started: studyData.started?.toISOString(),
    basedOn: [{
      reference: `ServiceRequest/${serviceRequestId}`,
    }],
    numberOfSeries: studyData.numberOfSeries,
    numberOfInstances: studyData.numberOfInstances,
    procedureCode: serviceRequest.code ? [{
      coding: serviceRequest.code.coding,
      text: serviceRequest.code.text,
    }] : undefined,
    modality: studyData.modality ? [{
      system: 'http://dicom.nema.org/resources/ontology/DCM',
      code: studyData.modality,
    }] : undefined,
    description: studyData.description,
    series: studyData.series.map(s => ({
      uid: s.uid,
      number: s.number,
      modality: {
        system: 'http://dicom.nema.org/resources/ontology/DCM',
        code: s.modality,
      },
      description: s.description,
      numberOfInstances: s.numberOfInstances,
      bodySite: s.bodySite ? {
        display: s.bodySite,
      } : undefined,
      started: s.started?.toISOString(),
      endpoint: s.endpoint ? [{
        reference: s.endpoint,
      }] : undefined,
    })),
    identifier: studyData.accessionNumber ? [{
      system: 'accession',
      value: studyData.accessionNumber,
    }] : undefined,
  });

  console.log(`✅ Created ImagingStudy: ${imagingStudy.id}`);

  // Create Provenance for audit trail (non-blocking)
  if (imagingStudy.id) {
    try {
      await createProvenanceForResource(
        client,
        'ImagingStudy',
        imagingStudy.id,
        undefined, // Could extract from serviceRequest.requester if needed
        undefined,
        'CREATE'
      );
      console.log(`✅ Created Provenance for ImagingStudy/${imagingStudy.id}`);
    } catch (error) {
      console.warn(`⚠️  Failed to create Provenance for ImagingStudy (non-blocking):`, error);
    }
  }

  // Update ServiceRequest status
  await client.updateResource({
    ...serviceRequest,
    status: 'completed',
  });

  return imagingStudy.id!;
}

/**
 * Create imaging report (radiologist interpretation)
 */
export async function createImagingReport(
  imagingStudyId: string,
  findings: string,
  impression: string,
  status: 'preliminary' | 'final' = 'final',
  radiologist?: string,
  medplum?: MedplumClient
): Promise<string> {
  const client = medplum ?? (await getMedplumClient());
  
  console.log(`📝 Creating imaging report for study ${imagingStudyId}`);

  // Get the imaging study
  const imagingStudy = await client.readResource('ImagingStudy', imagingStudyId);

  // Create DiagnosticReport
  const report = await validateAndCreate<DiagnosticReport>(client, {
    resourceType: 'DiagnosticReport',
    status,
    category: [{
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/v2-0074',
        code: 'RAD',
        display: 'Radiology',
      }],
    }],
    code: imagingStudy.procedureCode?.[0] || { text: 'Imaging Report' },
    subject: imagingStudy.subject,
    encounter: imagingStudy.encounter,
    effectiveDateTime: imagingStudy.started,
    issued: new Date().toISOString(),
    imagingStudy: [{
      reference: `ImagingStudy/${imagingStudyId}`,
    }],
    conclusion: impression,
    conclusionCode: findings ? [{
      text: findings,
    }] : undefined,
    presentedForm: [{
      contentType: 'text/plain',
      data: Buffer.from(`FINDINGS:\n${findings}\n\nIMPRESSION:\n${impression}`).toString('base64'),
      title: 'Radiology Report',
    }],
    resultsInterpreter: radiologist ? [{
      display: radiologist,
    }] : undefined,
  });

  console.log(`✅ Created imaging DiagnosticReport: ${report.id}`);

  // Create Provenance for audit trail (non-blocking)
  if (report.id) {
    try {
      await createProvenanceForResource(
        client,
        'DiagnosticReport',
        report.id,
        radiologist ? undefined : undefined, // Could parse radiologist ID if provided
        undefined,
        'CREATE'
      );
      console.log(`✅ Created Provenance for DiagnosticReport/${report.id}`);
    } catch (error) {
      console.warn(`⚠️  Failed to create Provenance for DiagnosticReport (non-blocking):`, error);
    }
  }

  return report.id!;
}

/**
 * Get all imaging orders for a patient
 */
export async function getPatientImagingOrders(patientId: string, medplum?: MedplumClient): Promise<ServiceRequest[]> {
  const client = medplum ?? (await getMedplumClient());
  
  const orders = await client.searchResources('ServiceRequest', {
    subject: `Patient/${patientId}`,
    category: '363679005', // SNOMED CT code for Imaging
    _sort: '-authored',
  });

  return orders;
}

/**
 * Get all imaging studies for a patient
 */
export async function getPatientImagingStudies(patientId: string, medplum?: MedplumClient): Promise<ImagingReportSummary[]> {
  const client = medplum ?? (await getMedplumClient());
  
  const studies = await client.searchResources('ImagingStudy', {
    subject: `Patient/${patientId}`,
    _sort: '-started',
  });

  const summaries: ImagingReportSummary[] = [];

  for (const study of studies) {
    // Get associated diagnostic report if exists
    const reports = await client.searchResources('DiagnosticReport', {
      'imaging-study': `ImagingStudy/${study.id}`,
    });

    const report = reports[0];

    summaries.push({
      id: study.id!,
      patientId,
      patientName: study.subject?.display,
      encounterId: study.encounter?.reference?.split('/')[1],
      procedure: study.procedureCode?.[0]?.text || 'Unknown Procedure',
      modality: study.modality?.[0]?.code || 'Unknown',
      status: study.status as any,
      orderedAt: study.started ? new Date(study.started) : new Date(),
      performedAt: study.started ? new Date(study.started) : undefined,
      study: {
        studyUid: study.identifier?.[0]?.value || '',
        accessionNumber: study.identifier?.find(i => i.system === 'accession')?.value,
        modality: study.modality?.[0]?.code || '',
        description: study.description,
        numberOfSeries: study.numberOfSeries || 0,
        numberOfInstances: study.numberOfInstances || 0,
        started: study.started ? new Date(study.started) : undefined,
        series: (study.series || []).map(s => ({
          uid: s.uid,
          number: s.number || 0,
          modality: s.modality?.code || '',
          description: s.description,
          numberOfInstances: s.numberOfInstances || 0,
          bodySite: s.bodySite?.display,
          started: s.started ? new Date(s.started) : undefined,
          endpoint: s.endpoint?.[0]?.reference,
        })),
      },
      report: report ? {
        id: report.id!,
        status: report.status as any,
        findings: report.conclusionCode?.[0]?.text,
        impression: report.conclusion,
        radiologist: report.resultsInterpreter?.[0]?.display,
        issuedAt: report.issued ? new Date(report.issued) : undefined,
      } : undefined,
    });
  }

  return summaries;
}

/**
 * Get imaging studies for an encounter
 */
export async function getEncounterImagingStudies(encounterId: string, medplum?: MedplumClient): Promise<ImagingReportSummary[]> {
  const client = medplum ?? (await getMedplumClient());
  
  const studies = await client.searchResources('ImagingStudy', {
    encounter: `Encounter/${encounterId}`,
    _sort: '-started',
  });

  const summaries: ImagingReportSummary[] = [];

  for (const study of studies) {
    const reports = await client.searchResources('DiagnosticReport', {
      'imaging-study': `ImagingStudy/${study.id}`,
    });

    const report = reports[0];

    summaries.push({
      id: study.id!,
      patientId: study.subject?.reference?.split('/')[1] || '',
      patientName: study.subject?.display,
      encounterId,
      procedure: study.procedureCode?.[0]?.text || 'Unknown Procedure',
      modality: study.modality?.[0]?.code || 'Unknown',
      status: study.status as any,
      orderedAt: study.started ? new Date(study.started) : new Date(),
      performedAt: study.started ? new Date(study.started) : undefined,
      study: {
        studyUid: study.identifier?.[0]?.value || '',
        accessionNumber: study.identifier?.find(i => i.system === 'accession')?.value,
        modality: study.modality?.[0]?.code || '',
        description: study.description,
        numberOfSeries: study.numberOfSeries || 0,
        numberOfInstances: study.numberOfInstances || 0,
        started: study.started ? new Date(study.started) : undefined,
        series: (study.series || []).map(s => ({
          uid: s.uid,
          number: s.number || 0,
          modality: s.modality?.code || '',
          description: s.description,
          numberOfInstances: s.numberOfInstances || 0,
          bodySite: s.bodySite?.display,
          started: s.started ? new Date(s.started) : undefined,
          endpoint: s.endpoint?.[0]?.reference,
        })),
      },
      report: report ? {
        id: report.id!,
        status: report.status as any,
        findings: report.conclusionCode?.[0]?.text,
        impression: report.conclusion,
        radiologist: report.resultsInterpreter?.[0]?.display,
        issuedAt: report.issued ? new Date(report.issued) : undefined,
      } : undefined,
    });
  }

  return summaries;
}

/**
 * Get a specific imaging study
 */
export async function getImagingStudy(studyId: string, medplum?: MedplumClient): Promise<ImagingReportSummary | null> {
  try {
    const client = medplum ?? (await getMedplumClient());
    
    const study = await client.readResource('ImagingStudy', studyId);
    
    const reports = await client.searchResources('DiagnosticReport', {
      'imaging-study': `ImagingStudy/${studyId}`,
    });

    const report = reports[0];

    return {
      id: study.id!,
      patientId: study.subject?.reference?.split('/')[1] || '',
      patientName: study.subject?.display,
      encounterId: study.encounter?.reference?.split('/')[1],
      procedure: study.procedureCode?.[0]?.text || 'Unknown Procedure',
      modality: study.modality?.[0]?.code || 'Unknown',
      status: study.status as any,
      orderedAt: study.started ? new Date(study.started) : new Date(),
      performedAt: study.started ? new Date(study.started) : undefined,
      study: {
        studyUid: study.identifier?.[0]?.value || '',
        accessionNumber: study.identifier?.find(i => i.system === 'accession')?.value,
        modality: study.modality?.[0]?.code || '',
        description: study.description,
        numberOfSeries: study.numberOfSeries || 0,
        numberOfInstances: study.numberOfInstances || 0,
        started: study.started ? new Date(study.started) : undefined,
        series: (study.series || []).map(s => ({
          uid: s.uid,
          number: s.number || 0,
          modality: s.modality?.code || '',
          description: s.description,
          numberOfInstances: s.numberOfInstances || 0,
          bodySite: s.bodySite?.display,
          started: s.started ? new Date(s.started) : undefined,
          endpoint: s.endpoint?.[0]?.reference,
        })),
      },
      report: report ? {
        id: report.id!,
        status: report.status as any,
        findings: report.conclusionCode?.[0]?.text,
        impression: report.conclusion,
        radiologist: report.resultsInterpreter?.[0]?.display,
        issuedAt: report.issued ? new Date(report.issued) : undefined,
      } : undefined,
    };
  } catch (error) {
    console.error('Failed to get imaging study:', error);
    return null;
  }
}






