import { NextRequest, NextResponse } from 'next/server';
import { getConsultationById, getPatientById } from '@/lib/models';
import { saveConsultationInvoice } from '@/lib/fhir/billing-service';
import { writeServerAuditLog } from '@/lib/server/logging';
import { getCurrentProfile } from '@/lib/server/medplum-auth';

export async function POST(request: NextRequest) {
  try {
    const { consultationId, patientId } = await request.json();

    if (!consultationId || !patientId) {
      return NextResponse.json(
        { error: 'consultationId and patientId are required' },
        { status: 400 }
      );
    }

    let userId = 'system';
    try {
      const profile = await getCurrentProfile(request);
      userId = profile.id ?? 'unknown';
    } catch {
      // Billing is driven from the EMR workflow even when the browser session
      // has not established a Medplum user cookie yet.
      userId = 'system';
    }

    const [patient, consultation] = await Promise.all([
      getPatientById(String(patientId)),
      getConsultationById(String(consultationId)),
    ]);

    if (!patient || !consultation) {
      return NextResponse.json({ error: 'Patient or consultation not found' }, { status: 404 });
    }

    const result = await saveConsultationInvoice(patient, consultation);

    await writeServerAuditLog({
      action: 'consultation_billed',
      subjectType: 'billing',
      subjectId: result.invoice.id,
      userId,
      metadata: {
        consultationId,
        patientId,
        chargeItemIds: result.chargeItems.map((chargeItem) => chargeItem.id),
      },
    });

    return NextResponse.json({
      success: true,
      invoiceId: result.invoice.id,
      chargeItemIds: result.chargeItems.map((chargeItem) => chargeItem.id),
    });
  } catch (error: any) {
    console.error('[billing] Failed to save invoice:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to save invoice' },
      { status: 500 }
    );
  }
}
