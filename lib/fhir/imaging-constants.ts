/**
 * Static imaging constants and shared types — no server dependencies.
 * Safe to import in both Server and Client Components.
 */

export const IMAGING_PROCEDURES = {
  CHEST_XRAY: { code: '36643-5', display: 'Chest X-ray', modality: 'DX', system: 'http://loinc.org' },
  CHEST_XRAY_2V: { code: '30746-2', display: 'Chest X-ray 2 views', modality: 'DX', system: 'http://loinc.org' },
  ABDOMEN_XRAY: { code: '36558-5', display: 'Abdomen X-ray', modality: 'DX', system: 'http://loinc.org' },
  SPINE_LUMBAR_XRAY: { code: '36567-6', display: 'Lumbar Spine X-ray', modality: 'DX', system: 'http://loinc.org' },
  KNEE_XRAY: { code: '37362-1', display: 'Knee X-ray', modality: 'DX', system: 'http://loinc.org' },
  HEAD_CT: { code: '30799-1', display: 'Head CT without contrast', modality: 'CT', system: 'http://loinc.org' },
  HEAD_CT_CONTRAST: { code: '24727-0', display: 'Head CT with contrast', modality: 'CT', system: 'http://loinc.org' },
  CHEST_CT: { code: '30800-7', display: 'Chest CT without contrast', modality: 'CT', system: 'http://loinc.org' },
  ABDOMEN_CT: { code: '30807-2', display: 'Abdomen CT without contrast', modality: 'CT', system: 'http://loinc.org' },
  CTPA: { code: '42273-8', display: 'CT Pulmonary Angiography', modality: 'CT', system: 'http://loinc.org' },
  BRAIN_MRI: { code: '24556-3', display: 'Brain MRI', modality: 'MR', system: 'http://loinc.org' },
  SPINE_MRI: { code: '24604-1', display: 'Spine MRI', modality: 'MR', system: 'http://loinc.org' },
  KNEE_MRI: { code: '24610-8', display: 'Knee MRI', modality: 'MR', system: 'http://loinc.org' },
  ABDOMEN_US: { code: '24626-4', display: 'Abdomen Ultrasound', modality: 'US', system: 'http://loinc.org' },
  PELVIS_US: { code: '24638-9', display: 'Pelvis Ultrasound', modality: 'US', system: 'http://loinc.org' },
  OBSTETRIC_US: { code: '11525-3', display: 'Obstetric Ultrasound', modality: 'US', system: 'http://loinc.org' },
  THYROID_US: { code: '24651-2', display: 'Thyroid Ultrasound', modality: 'US', system: 'http://loinc.org' },
  ECHO: { code: '18752-6', display: 'Echocardiography', modality: 'US', system: 'http://loinc.org' },
  MAMMOGRAM: { code: '37027-2', display: 'Mammography', modality: 'MG', system: 'http://loinc.org' },
  MAMMOGRAM_BILATERAL: { code: '24604-1', display: 'Bilateral Mammography', modality: 'MG', system: 'http://loinc.org' },
} as const;

export type ImagingProcedureCode = keyof typeof IMAGING_PROCEDURES;

export interface DICOMSeries {
  uid: string;
  number: number;
  modality: string;
  description?: string;
  numberOfInstances: number;
  bodySite?: string;
  started?: Date;
  endpoint?: string;
}

export interface ImagingStudyData {
  studyUid: string;
  accessionNumber?: string;
  modality: string;
  description?: string;
  numberOfSeries: number;
  numberOfInstances: number;
  started?: Date;
  series: DICOMSeries[];
  pacsUrl?: string;
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
    status: string;
    findings?: string;
    impression?: string;
    radiologist?: string;
    issuedAt?: Date;
  };
}
