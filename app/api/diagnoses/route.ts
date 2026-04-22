import { NextRequest, NextResponse } from 'next/server';
import { searchDiagnoses } from '@/lib/fhir/terminologies/diagnoses';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const limitParam = Number(searchParams.get('limit') || '12');
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 25) : 12;

    const diagnoses = searchDiagnoses(query, limit);
    return NextResponse.json({ success: true, diagnoses });
  } catch (error: any) {
    console.error('[diagnoses] Failed to search diagnoses:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to search diagnoses' },
      { status: 500 }
    );
  }
}
