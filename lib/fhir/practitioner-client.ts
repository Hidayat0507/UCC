export interface PractitionerOption {
  id: string;
  name: string;
}

export async function getAllPractitioners(): Promise<PractitionerOption[]> {
  const response = await fetch('/api/practitioners', { credentials: 'include' });
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Failed to load practitioners');
  }
  return (data.practitioners ?? []).map((p: any) => ({ id: p.id as string, name: p.name as string }));
}
