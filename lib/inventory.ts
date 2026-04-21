import { db } from './firebase';
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc,
  deleteDoc,
  query,
  where,
  Timestamp,
  DocumentData 
} from 'firebase/firestore';

export interface Medication {
  id: string;
  name: string;
  category: string;
  dosageForm: string;
  strengths: string[];
  stock: number;
  minimumStock: number;
  unit: string;
  unitPrice: number;
  expiryDate: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const MEDICATIONS = 'medications';

// Helper function to convert Firestore data to our types
const convertTimestamps = (data: DocumentData) => {
  const result = { ...data };
  if (result.createdAt) {
    result.createdAt = result.createdAt.toDate();
  }
  if (result.updatedAt) {
    result.updatedAt = result.updatedAt.toDate();
  }
  return result;
};

export async function getMedications(): Promise<Medication[]> {
  try {
    const snapshot = await getDocs(collection(db, MEDICATIONS));
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...convertTimestamps(doc.data())
    } as Medication));
  } catch (error) {
    console.error('Error fetching medications:', error);
    return [];
  }
}

export async function getMedicationById(id: string): Promise<Medication | null> {
  try {
    const docRef = doc(db, MEDICATIONS, id);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      return null;
    }
    
    return {
      id: docSnap.id,
      ...convertTimestamps(docSnap.data())
    } as Medication;
  } catch (error) {
    console.error('Error fetching medication:', error);
    return null;
  }
}

export async function createMedication(data: Omit<Medication, 'id' | 'createdAt' | 'updatedAt'>): Promise<string | null> {
  try {
    const docRef = await addDoc(collection(db, MEDICATIONS), {
      ...data,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
    return docRef.id;
  } catch (error) {
    console.error('Error creating medication:', error);
    return null;
  }
}

export async function updateMedication(id: string, data: Partial<Medication>): Promise<boolean> {
  try {
    const docRef = doc(db, MEDICATIONS, id);
    await updateDoc(docRef, {
      ...data,
      updatedAt: Timestamp.now()
    });
    return true;
  } catch (error) {
    console.error('Error updating medication:', error);
    return false;
  }
}

export async function deleteMedication(id: string): Promise<boolean> {
  try {
    await deleteDoc(doc(db, MEDICATIONS, id));
    return true;
  } catch (error) {
    console.error('Error deleting medication:', error);
    return false;
  }
}
