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

export function getBuiltInMedicationList(): Medication[] {
  return [];
}

export async function getMedications(): Promise<Medication[]> {
  try {
    const res = await fetch('/api/inventory');
    if (!res.ok) return [];
    const data = await res.json();
    return data.medications ?? [];
  } catch {
    return [];
  }
}

export async function getMedicationById(id: string): Promise<Medication | null> {
  try {
    const res = await fetch(`/api/inventory?id=${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.medication ?? null;
  } catch {
    return null;
  }
}

export async function createMedication(
  data: Omit<Medication, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const res = await fetch('/api/inventory', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error ?? 'Failed to create medication');
  }
  const result = await res.json();
  return result.medicationId;
}

export async function updateMedication(id: string, data: Partial<Medication>): Promise<void> {
  const res = await fetch('/api/inventory', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ medicationId: id, ...data }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error ?? 'Failed to update medication');
  }
}

export async function deleteMedication(id: string): Promise<boolean> {
  const res = await fetch(`/api/inventory?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error ?? 'Failed to delete medication');
  }
  return true;
}
