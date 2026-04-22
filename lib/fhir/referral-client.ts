/**
 * Client-side wrapper for Referral API (Medplum FHIR ServiceRequest)
 */

export interface ReferralInput {
  patientId: string;
  specialty: string;
  facility: string;
  department?: string;
  doctorName?: string;
  urgency?: 'routine' | 'urgent' | 'stat' | 'asap';
  reason: string;
  clinicalInfo?: string;
  date?: Date | string;
}

export interface Referral extends ReferralInput {
  id: string;
  status: 'draft' | 'active' | 'on-hold' | 'revoked' | 'completed' | 'entered-in-error' | 'unknown';
  createdAt: Date;
}

/**
 * Save a referral to Medplum
 */
export async function saveReferral(referral: ReferralInput): Promise<string> {
  const response = await fetch('/api/referrals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(referral),
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to save referral');
  }

  return data.referralId;
}

/**
 * Get a referral by ID
 */
export async function getReferral(referralId: string): Promise<Referral | null> {
  const response = await fetch(`/api/referrals?id=${referralId}`);
  const data = await response.json();

  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error(data.error || 'Failed to get referral');
  }

  const referral = data.referral;
  return {
    ...referral,
    date: referral.date ? new Date(referral.date) : undefined,
    createdAt: new Date(referral.createdAt),
  };
}

/**
 * Get referrals for a patient
 */
export async function getPatientReferrals(patientId: string): Promise<Referral[]> {
  const response = await fetch(`/api/referrals?patientId=${patientId}`);
  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to get referrals');
  }

  return data.referrals.map((r: any) => ({
    ...r,
    date: r.date ? new Date(r.date) : undefined,
    createdAt: new Date(r.createdAt),
  }));
}








