/**
 * Procedures API - FHIR via Medplum (ChargeItemDefinition catalog)
 */

import { NextRequest, NextResponse } from "next/server";
import { getClinicIdFromRequest } from "@/lib/server/clinic";
import {
  createProcedureInMedplum,
  deleteProcedureInMedplum,
  getProcedureByIdFromMedplum,
  getProceduresFromMedplum,
  updateProcedureInMedplum,
} from "@/lib/fhir/procedure-service";

function resolveClinicId(clinicId: string | null): string | null {
  if (clinicId) return clinicId;
  if (process.env.NODE_ENV !== "production") {
    const fallback = process.env.NEXT_PUBLIC_DEFAULT_CLINIC_ID || "default";
    console.warn("⚠️  No clinicId found, using default for development:", fallback);
    return fallback;
  }
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const clinicId = resolveClinicId(await getClinicIdFromRequest(request));

    if (!clinicId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Missing clinicId. Please set NEXT_PUBLIC_DEFAULT_CLINIC_ID for development or access via clinic subdomain.",
        },
        { status: 400 }
      );
    }

    if (id) {
      const procedure = await getProcedureByIdFromMedplum(id);
      if (!procedure) {
        return NextResponse.json({ error: "Procedure not found" }, { status: 404 });
      }
      return NextResponse.json({ success: true, procedure });
    }

    const procedures = await getProceduresFromMedplum(clinicId);
    return NextResponse.json({ success: true, procedures, count: procedures.length });
  } catch (error: any) {
    console.error("❌ Failed to get procedures:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to get procedures" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const clinicId = resolveClinicId(await getClinicIdFromRequest(request));
    if (!clinicId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Missing clinicId. Please set NEXT_PUBLIC_DEFAULT_CLINIC_ID for development or access via clinic subdomain.",
        },
        { status: 400 }
      );
    }

    const data = await request.json();
    if (!data?.name) {
      return NextResponse.json({ error: "Missing required field: name" }, { status: 400 });
    }

    const procedureId = await createProcedureInMedplum(data, clinicId);
    return NextResponse.json({
      success: true,
      procedureId,
      message: "Procedure saved to FHIR successfully",
    });
  } catch (error: any) {
    console.error("❌ Failed to save procedure:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to save procedure" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const clinicId = resolveClinicId(await getClinicIdFromRequest(request));
    if (!clinicId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Missing clinicId. Please set NEXT_PUBLIC_DEFAULT_CLINIC_ID for development or access via clinic subdomain.",
        },
        { status: 400 }
      );
    }

    const { procedureId, ...updates } = await request.json();
    if (!procedureId) {
      return NextResponse.json({ error: "Missing procedureId" }, { status: 400 });
    }

    await updateProcedureInMedplum(procedureId, updates, clinicId);
    return NextResponse.json({
      success: true,
      message: "Procedure updated successfully",
    });
  } catch (error: any) {
    console.error("❌ Failed to update procedure:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update procedure" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Missing procedure id" }, { status: 400 });
    }

    await deleteProcedureInMedplum(id);
    return NextResponse.json({ success: true, message: "Procedure deleted successfully" });
  } catch (error: any) {
    console.error("❌ Failed to delete procedure:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete procedure" },
      { status: 500 }
    );
  }
}
