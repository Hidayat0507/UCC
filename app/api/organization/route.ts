/**
 * Organization API - FHIR via Medplum
 */

import { NextRequest, NextResponse } from "next/server";
import { getClinicIdFromRequest } from "@/lib/server/clinic";
import {
  getOrganizationDetailsFromMedplum,
  saveOrganizationDetailsToMedplum,
} from "@/lib/fhir/organization-service";

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

    const organization = await getOrganizationDetailsFromMedplum(clinicId);
    return NextResponse.json({ success: true, organization });
  } catch (error: any) {
    console.error("❌ Failed to get organization:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to get organization" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
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

    const details = await request.json();
    await saveOrganizationDetailsToMedplum(details, clinicId);

    return NextResponse.json({
      success: true,
      message: "Organization saved successfully",
    });
  } catch (error: any) {
    console.error("❌ Failed to save organization:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to save organization" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  return PUT(request);
}
