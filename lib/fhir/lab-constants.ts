/**
 * Static lab constants and shared types — no server dependencies.
 * Safe to import in both Server and Client Components.
 */

export const LAB_TESTS = {
  CBC: { code: '58410-2', display: 'Complete Blood Count (CBC) panel', system: 'http://loinc.org' },
  RENAL_PROFILE: { code: '24323-8', display: 'Basic metabolic/renal panel', system: 'http://loinc.org' },
  LFT: { code: '24325-3', display: 'Hepatic function (LFT) panel', system: 'http://loinc.org' },
} as const;

export type LabTestCode = keyof typeof LAB_TESTS;

export interface LabResult {
  testCode: string;
  testName: string;
  value: string | number;
  unit?: string;
  referenceRange?: string;
  interpretation?: 'normal' | 'high' | 'low' | 'critical';
  status: 'preliminary' | 'final' | 'corrected' | 'cancelled';
  performedAt?: Date;
}

export interface LabReportSummary {
  id: string;
  patientId: string;
  patientName?: string;
  encounterId?: string;
  status: 'registered' | 'partial' | 'preliminary' | 'final' | 'amended' | 'corrected' | 'cancelled';
  orderedAt: Date;
  issuedAt?: Date;
  results: LabResult[];
  conclusion?: string;
  orderingPhysician?: string;
}
