import { NextRequest, NextResponse } from 'next/server';
import { checkInPatientInTriage } from '@/lib/fhir/triage-service';
import { getMedplumForRequest } from '@/lib/server/medplum-auth';
import { getClinicIdFromRequest } from '@/lib/server/clinic';
import { handleRouteError } from '@/lib/server/route-helpers';

export async function POST(request: NextRequest) {
  try {
    const [medplum, clinicId, body] = await Promise.all([
      getMedplumForRequest(request),
      getClinicIdFromRequest(request),
      request.json(),
    ]);

    const {
      patientId,
      chiefComplaint,
      visitIntent,
      payerType,
      paymentMethod,
      assignedClinician,
      billingPerson,
      dependentName,
      dependentRelationship,
      dependentPhone,
      registrationSource,
      registrationAt,
      performedBy,
    } = body;

    if (!patientId) {
      return NextResponse.json({ error: 'patientId is required' }, { status: 400 });
    }
    if (!clinicId) {
      return NextResponse.json({ error: 'Missing clinicId' }, { status: 400 });
    }

    await checkInPatientInTriage(
      patientId,
      chiefComplaint,
      {
        visitIntent,
        payerType,
        paymentMethod,
        assignedClinician,
        billingPerson,
        dependentName,
        dependentRelationship,
        dependentPhone,
        registrationSource,
        registrationAt,
        performedBy,
      },
      medplum,
      clinicId
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRouteError(error, 'POST /api/check-in');
  }
}
