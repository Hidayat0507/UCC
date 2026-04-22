/**
 * Referral API - FHIR via Medplum (ServiceRequest)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  saveReferralToMedplum,
  getReferralFromMedplum,
  getPatientReferralsFromMedplum,
} from '@/lib/fhir/referral-service';
import { getMedplumForRequest } from '@/lib/server/medplum-auth';
import { handleRouteError } from '@/lib/server/route-helpers';

/**
 * POST - Create a new referral
 */
export async function POST(request: NextRequest) {
  try {
    const medplum = await getMedplumForRequest(request);
    const referralData = await request.json();

    if (!referralData.patientId || !referralData.specialty || !referralData.facility || !referralData.reason) {
      return NextResponse.json(
        { error: 'Missing required fields: patientId, specialty, facility, reason' },
        { status: 400 }
      );
    }

    const referralId = await saveReferralToMedplum(medplum, referralData);

    return NextResponse.json({
      success: true,
      referralId,
      message: 'Referral saved to FHIR successfully',
    });
  } catch (error) {
    return handleRouteError(error, 'POST /api/referrals');
  }
}

/**
 * GET - Get referrals
 */
export async function GET(request: NextRequest) {
  try {
    const medplum = await getMedplumForRequest(request);
    const { searchParams } = new URL(request.url);
    const referralId = searchParams.get('id');
    const patientId = searchParams.get('patientId');

    if (referralId) {
      const referral = await getReferralFromMedplum(medplum, referralId);
      if (!referral) {
        return NextResponse.json({ error: 'Referral not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, referral });
    }

    if (patientId) {
      const referrals = await getPatientReferralsFromMedplum(medplum, patientId);
      return NextResponse.json({ success: true, count: referrals.length, referrals });
    }

    return NextResponse.json({ error: 'Missing query parameter: id or patientId' }, { status: 400 });
  } catch (error) {
    return handleRouteError(error, 'GET /api/referrals');
  }
}
