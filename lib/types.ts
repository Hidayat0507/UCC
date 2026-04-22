// lib/types.ts
import type { Consultation } from "./models"; // type-only import to avoid runtime cycles

// Shared type for queue status across different modules
// arrived = checked in, pending triage
export type QueueStatus = 'arrived' | 'waiting' | 'in_consultation' | 'completed' | 'meds_and_bills' | null;

// Type for combining consultation data with patient details for billing/orders page
export type BillableConsultation = Omit<Consultation, 'date' | 'createdAt' | 'updatedAt'> & {
  patientFullName?: string;
  queueStatus?: QueueStatus;
  date: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type SerializedConsultation = Omit<Consultation, "date" | "createdAt" | "updatedAt"> & {
  date?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  progressNote?: string | null;
};

// Triage System Types
export type TriageLevel = 1 | 2 | 3 | 4 | 5;

export const TRIAGE_LEVELS = {
  1: { label: "Resuscitation", color: "red", description: "Immediate life-threatening" },
  2: { label: "Emergency", color: "orange", description: "Imminently life-threatening" },
  3: { label: "Urgent", color: "yellow", description: "Potentially life-threatening" },
  4: { label: "Semi-Urgent", color: "green", description: "Potentially serious" },
  5: { label: "Non-Urgent", color: "blue", description: "Less urgent" },
} as const;

export interface VitalSigns {
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  heartRate?: number;
  respiratoryRate?: number;
  temperature?: number;
  oxygenSaturation?: number;
  painScore?: number; // 0-10 scale
  weight?: number;
  height?: number;
}

export interface TriageData {
  triageLevel: TriageLevel;
  chiefComplaint: string;
  vitalSigns: VitalSigns;
  visitIntent?: string;
  payerType?: string;
  paymentMethod?: string;
  billingPerson?: string;
  dependentName?: string;
  dependentRelationship?: string;
  dependentPhone?: string;
  assignedClinician?: string;
  registrationSource?: string;
  registrationAt?: string;
  performedBy?: string;
  triageNotes?: string;
  redFlags?: string[]; // e.g., ["Chest pain", "Difficulty breathing"]
  triageBy?: string; // Staff member who performed triage
  triageAt?: Date | string;
  isTriaged: boolean;
}

// Add other shared types here as needed

// SOAP workflow types removed as flow now returns plain-text SOAP only
