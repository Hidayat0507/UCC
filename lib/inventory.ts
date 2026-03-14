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

async function parseResponse<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Inventory request failed');
  }
  return data;
}

function hydrateMedication(medication: any): Medication {
  return {
    ...medication,
    createdAt: medication.createdAt ? new Date(medication.createdAt) : undefined,
    updatedAt: medication.updatedAt ? new Date(medication.updatedAt) : undefined,
  };
}

export async function getMedications(): Promise<Medication[]> {
  try {
    const response = await fetch('/api/inventory');
    const data = await parseResponse<{ medications: any[] }>(response);
    return data.medications.map(hydrateMedication);
  } catch {
    return [];
  }
}

export function getBuiltInMedicationList(): Medication[] {
  return [];
}

export async function getMedicationById(id: string): Promise<Medication | null> {
  try {
    const response = await fetch(`/api/inventory?id=${encodeURIComponent(id)}`);
    if (response.status === 404) {
      return null;
    }
    const data = await parseResponse<{ medication: any }>(response);
    return hydrateMedication(data.medication);
  } catch (error) {
    console.error('Error fetching medication:', error);
    return null;
  }
}

export async function createMedication(data: Omit<Medication, 'id' | 'createdAt' | 'updatedAt'>): Promise<string | null> {
  try {
    const response = await fetch('/api/inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await parseResponse<{ medicationId: string }>(response);
    return result.medicationId;
  } catch (error) {
    console.error('Error creating medication:', error);
    return null;
  }
}

export async function updateMedication(id: string, data: Partial<Medication>): Promise<boolean> {
  try {
    const response = await fetch('/api/inventory', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ medicationId: id, ...data }),
    });
    await parseResponse<{ message: string }>(response);
    return true;
  } catch (error) {
    console.error('Error updating medication:', error);
    return false;
  }
}

export async function deleteMedication(id: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/inventory?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    await parseResponse<{ message: string }>(response);
    return true;
  } catch (error) {
    console.error('Error deleting medication:', error);
    return false;
  }
}
