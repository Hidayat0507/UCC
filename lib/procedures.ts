import { db } from './firebase';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  Timestamp,
  type DocumentData,
} from 'firebase/firestore';

export interface ProcedureItem {
  id: string;
  name: string;
  // FHIR coding for CodeableConcept: a single preferred coding entry
  codingSystem?: string; // e.g., http://www.ama-assn.org/go/cpt or http://snomed.info/sct
  codingCode?: string;   // e.g., CPT code or SNOMED code
  codingDisplay?: string; // human-readable
  category?: string;
  defaultPrice: number;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const PROCEDURES = 'procedures';

function convertTimestamps(data: DocumentData) {
  const result = { ...data } as any;
  if (result.createdAt?.toDate) result.createdAt = result.createdAt.toDate();
  if (result.updatedAt?.toDate) result.updatedAt = result.updatedAt.toDate();
  return result;
}

export async function getProcedures(): Promise<ProcedureItem[]> {
  const snap = await getDocs(collection(db, PROCEDURES));
  return snap.docs.map(d => ({ id: d.id, ...convertTimestamps(d.data()) } as ProcedureItem));
}

export async function createProcedure(data: Omit<ProcedureItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const now = Timestamp.now();
  const docRef = await addDoc(collection(db, PROCEDURES), { ...data, createdAt: now, updatedAt: now });
  return docRef.id;
}

export async function updateProcedure(id: string, data: Partial<ProcedureItem>): Promise<void> {
  const ref = doc(db, PROCEDURES, id);
  await updateDoc(ref, { ...data, updatedAt: Timestamp.now() });
}

export async function deleteProcedure(id: string): Promise<void> {
  await deleteDoc(doc(db, PROCEDURES, id));
}

export async function getProcedureById(id: string): Promise<ProcedureItem | null> {
  const ref = doc(db, PROCEDURES, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...convertTimestamps(snap.data()) } as ProcedureItem;
}


