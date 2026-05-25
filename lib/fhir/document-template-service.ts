import { adminDb } from '@/lib/firebase-admin';
import { DEFAULT_MC_TEMPLATE, DEFAULT_REFERRAL_TEMPLATE } from '@/lib/document-templates';

const COLLECTION = 'document_templates';

export function getDefaultTemplate(type: 'mc' | 'referral'): string {
  return type === 'mc' ? DEFAULT_MC_TEMPLATE : DEFAULT_REFERRAL_TEMPLATE;
}

export async function getTemplate(type: 'mc' | 'referral', clinicId: string): Promise<string> {
  const docId = `${clinicId}_${type}`;
  const snap = await adminDb.collection(COLLECTION).doc(docId).get();
  if (snap.exists) return (snap.data()?.html as string | undefined) ?? getDefaultTemplate(type);
  return getDefaultTemplate(type);
}

export async function saveTemplate(type: 'mc' | 'referral', html: string, clinicId: string): Promise<void> {
  const docId = `${clinicId}_${type}`;
  await adminDb.collection(COLLECTION).doc(docId).set({ html, updatedAt: new Date().toISOString() });
}