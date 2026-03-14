import { Consultation } from '@/lib/models'; // Import canonical types
import { getMedplumClient } from '../fhir/patient-service';
import { getConsultationFromMedplum, getPatientConsultationsFromMedplum } from '../fhir/consultation-service';

function textToNarrative(text?: string): { status: 'generated'; div: string } | undefined {
  const trimmed = text?.trim();
  if (!trimmed) {
    return undefined;
  }

  const html = trimmed
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, '<br/>')}</p>`)
    .join('');

  return {
    status: 'generated',
    div: `<div xmlns="http://www.w3.org/1999/xhtml">${html}</div>`,
  };
}

function buildNarrativeConsultationNote(consultation: Partial<Consultation>): string {
  const parts = [
    consultation.notes?.trim(),
    consultation.progressNote?.trim() && consultation.progressNote.trim() !== consultation.notes?.trim()
      ? consultation.progressNote.trim()
      : undefined,
  ].filter((value): value is string => Boolean(value));

  if (parts.length > 0) {
    return parts.join('\n\n');
  }

  return consultation.chiefComplaint?.trim()
    || consultation.diagnosis?.trim()
    || 'Consultation note';
}

// Removed local Prescription interface definition
/*
export interface Prescription {
  medication: {
    id: string;
    name: string;
    strength?: string;
  };
  frequency: string;
  duration: string;
}
*/

// Removed local Consultation interface definition
/*
export interface Consultation {
  id?: string;
  patientId: string;
  chiefComplaint: string;
  diagnosis: string;
  procedures: string[];
  additionalNotes?: string;
  prescriptions: Prescription[];
  createdAt?: Date;
  updatedAt?: Date;
}
*/

const CONSULTATIONS = 'consultations';

// createConsultation function might be moved entirely to models.ts
// If kept here, ensure it uses the imported types correctly
/*
export async function createConsultation(consultation: Omit<Consultation, 'id' | 'createdAt' | 'updatedAt'>): Promise<string | null> {
  try {
    const docRef = await addDoc(collection(db, CONSULTATIONS), {
      ...consultation,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
    return docRef.id;
  } catch (error) {
    console.error('Error creating consultation:', error);
    return null;
  }
}
*/

// Ensure other functions use the imported Consultation type
export async function getConsultationsByPatient(patientId: string): Promise<Consultation[]> {
  try {
    const consultations = await getPatientConsultationsFromMedplum(patientId);
    return consultations as unknown as Consultation[];
  } catch (error) {
    console.error('Error fetching patient consultations:', error);
    return [];
  }
}

export async function getConsultationById(id: string): Promise<Consultation | null> {
  try {
    const consultation = await getConsultationFromMedplum(id);
    return (consultation as unknown as Consultation) ?? null;
  } catch (error) {
    console.error('Error fetching consultation:', error);
    return null;
  }
}

export async function updateConsultation(id: string, consultation: Partial<Consultation>): Promise<boolean> {
  try {
    if (consultation.notes || consultation.progressNote) {
      const medplum = await getMedplumClient();
      const encounter = await medplum.readResource('Encounter', id);
      const compositions = await medplum.searchResources('Composition', {
        encounter: `Encounter/${id}`,
      });
      const latestComposition = compositions
        .slice()
        .sort((a, b) => {
          const aTime = a.meta?.lastUpdated ? new Date(a.meta.lastUpdated).getTime() : 0;
          const bTime = b.meta?.lastUpdated ? new Date(b.meta.lastUpdated).getTime() : 0;
          return bTime - aTime;
        })[0];

      if (latestComposition?.id) {
        const nextText = buildNarrativeConsultationNote({
          notes: consultation.notes?.trim() || latestComposition.text?.div?.replace(/<[^>]+>/g, ' ').trim(),
          progressNote: consultation.progressNote,
          chiefComplaint: consultation.chiefComplaint,
          diagnosis: consultation.diagnosis,
        });
        await medplum.updateResource({
          ...latestComposition,
          status: 'final',
          date: new Date().toISOString(),
          title: latestComposition.title || 'Consultation Note',
          text: textToNarrative(nextText),
          section: undefined,
        });
      } else {
        await medplum.createResource({
          resourceType: 'Composition',
          status: 'final',
          type: {
            coding: [
              {
                system: 'http://loinc.org',
                code: '34109-9',
                display: 'Note',
              },
            ],
            text: 'Consultation note',
          },
          subject: encounter.subject,
          encounter: { reference: `Encounter/${id}` },
          date: new Date().toISOString(),
          title: 'Consultation Note',
          author: [{ display: 'System' }],
          text: textToNarrative(buildNarrativeConsultationNote(consultation)),
        });
      }
    }
    return true;
  } catch (error) {
    console.error('Error updating consultation:', error);
    return false;
  }
}

export async function deleteConsultation(id: string): Promise<boolean> {
  try {
    const medplum = await getMedplumClient();
    await medplum.deleteResource('Encounter', id);
    return true;
  } catch (error) {
    console.error('Error deleting consultation:', error);
    return false;
  }
}
