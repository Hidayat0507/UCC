import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { requireClinicAuth } from "@/lib/server/medplum-auth";
import { handleRouteError } from "@/lib/server/route-helpers";
import {
  computeTreatmentPlanSummary,
  normalizeTreatmentPlanEntry,
  type TreatmentPlanEntry,
  type TreatmentPlanEntryInput,
  type TreatmentPlanSnapshot,
} from "@/lib/treatment-plan";

const COLLECTION = "consultation_treatment_plans";

type StoredPlan = {
  draftId: string;
  patientId: string;
  consultationId?: string;
  entries: TreatmentPlanEntry[];
  summary: ReturnType<typeof computeTreatmentPlanSummary>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

function buildEmptySnapshot(
  draftId: string,
  patientId: string,
  consultationId?: string
): TreatmentPlanSnapshot {
  return {
    draftId,
    patientId,
    consultationId,
    entries: [],
    summary: computeTreatmentPlanSummary([]),
    updatedAt: new Date().toISOString(),
  };
}

function isPlanStoreUnavailable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("UNAUTHENTICATED") ||
    message.includes("invalid authentication credentials") ||
    message.includes("Could not load the default credentials") ||
    message.includes("service account") ||
    message.includes("Firestore")
  );
}

function tsToIso(value?: Timestamp): string {
  return value?.toDate().toISOString() || new Date().toISOString();
}

function toSnapshot(stored: StoredPlan): TreatmentPlanSnapshot {
  return {
    draftId: stored.draftId,
    patientId: stored.patientId,
    consultationId: stored.consultationId,
    entries: stored.entries,
    summary: stored.summary,
    updatedAt: tsToIso(stored.updatedAt),
  };
}

function deriveDraftId(params: URLSearchParams): string | null {
  const direct = params.get("draftId");
  if (direct) return direct;

  const consultationId = params.get("consultationId");
  if (consultationId) return `consultation-${consultationId}`;

  const patientId = params.get("patientId");
  if (patientId) return `patient-${patientId}`;

  return null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const draftId = deriveDraftId(searchParams);
  const patientId = searchParams.get("patientId") || "";
  const consultationId = searchParams.get("consultationId") || undefined;

  try {
    await requireClinicAuth(request);

    if (!draftId) {
      return NextResponse.json({ success: false, error: "draftId or patientId is required" }, { status: 400 });
    }

    const docRef = adminDb.collection(COLLECTION).doc(draftId);
    const snap = await docRef.get();

    if (!snap.exists) {
      return NextResponse.json({ success: true, plan: buildEmptySnapshot(draftId, patientId, consultationId) });
    }

    const data = snap.data() as StoredPlan;
    return NextResponse.json({ success: true, plan: toSnapshot(data) });
  } catch (error) {
    if (draftId && isPlanStoreUnavailable(error)) {
      console.warn("[consultations/plan] Falling back to empty draft:", error);
      return NextResponse.json({ success: true, plan: buildEmptySnapshot(draftId, patientId, consultationId) });
    }
    return handleRouteError(error, "GET /api/consultations/plan");
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireClinicAuth(request);
    const body = await request.json();
    const draftId: string = body.draftId;
    const patientId: string = body.patientId;
    const consultationId: string | undefined = body.consultationId;
    const entryInput: TreatmentPlanEntryInput | undefined = body.entry;

    if (!draftId || !patientId || !entryInput) {
      return NextResponse.json(
        { success: false, error: "draftId, patientId and entry are required" },
        { status: 400 }
      );
    }

    if (!["items", "services", "packages", "documents"].includes(entryInput.tab)) {
      return NextResponse.json({ success: false, error: "Invalid treatment plan tab" }, { status: 400 });
    }

    const docRef = adminDb.collection(COLLECTION).doc(draftId);
    const now = Timestamp.now();
    const nowIso = now.toDate().toISOString();
    const existingSnap = await docRef.get();
    const existingData = existingSnap.exists ? (existingSnap.data() as StoredPlan) : null;
    const existingEntries = existingData?.entries || [];
    const match = entryInput.id ? existingEntries.find((item) => item.id === entryInput.id) : undefined;
    const normalized = normalizeTreatmentPlanEntry(entryInput, nowIso, match);
    const entries = (() => {
      if (match) {
        return existingEntries.map((item) => (item.id === normalized.id ? normalized : item));
      }
      return [...existingEntries, normalized];
    })();
    const summary = computeTreatmentPlanSummary(entries);

    await docRef.set(
      {
        draftId,
        patientId,
        consultationId,
        entries,
        summary,
        createdAt: existingData?.createdAt || now,
        updatedAt: now,
      } satisfies StoredPlan,
      { merge: true }
    );

    return NextResponse.json({
      success: true,
      plan: {
        draftId,
        patientId,
        consultationId,
        entries,
        summary,
        updatedAt: nowIso,
      } satisfies TreatmentPlanSnapshot,
    });
  } catch (error) {
    return handleRouteError(error, "POST /api/consultations/plan");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireClinicAuth(request);
    const body = await request.json();
    const draftId: string = body.draftId;
    const entryId: string = body.entryId;

    if (!draftId || !entryId) {
      return NextResponse.json({ success: false, error: "draftId and entryId are required" }, { status: 400 });
    }

    const docRef = adminDb.collection(COLLECTION).doc(draftId);
    const existingSnap = await docRef.get();
    if (!existingSnap.exists) {
      return NextResponse.json({ success: false, error: "Draft not found" }, { status: 404 });
    }

    const existing = existingSnap.data() as StoredPlan;
    const entries = existing.entries.filter((entry) => entry.id !== entryId);
    const summary = computeTreatmentPlanSummary(entries);
    const now = Timestamp.now();

    await docRef.set(
      {
        ...existing,
        entries,
        summary,
        updatedAt: now,
      } satisfies StoredPlan,
      { merge: true }
    );

    return NextResponse.json({
      success: true,
      plan: {
        draftId: existing.draftId,
        patientId: existing.patientId,
        consultationId: existing.consultationId,
        entries,
        summary,
        updatedAt: now.toDate().toISOString(),
      } satisfies TreatmentPlanSnapshot,
    });
  } catch (error) {
    return handleRouteError(error, "DELETE /api/consultations/plan");
  }
}
