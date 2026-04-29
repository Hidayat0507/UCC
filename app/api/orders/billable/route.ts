export const dynamic = 'force-dynamic';

import { getConsultationsWithDetails } from '@/lib/models';
import { QueueStatus } from '@/lib/types';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const statuses: QueueStatus[] = ['meds_and_bills', 'completed'];
    const consultations = await getConsultationsWithDetails(statuses);
    return NextResponse.json({ consultations });
  } catch (error) {
    console.error('GET /api/orders/billable error:', error);
    return NextResponse.json({ consultations: [] }, { status: 500 });
  }
}
