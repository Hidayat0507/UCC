import { NextRequest, NextResponse } from "next/server";
import { invitePractitionerToMedplum } from "@/lib/fhir/admin-service";
import { getMedplumForRequest } from "@/lib/server/medplum-auth";
import { requirePlatformAdmin } from "@/lib/server/medplum-auth";

export async function POST(req: NextRequest) {
  try {
    await requirePlatformAdmin(req);
    const { firstName, lastName, email, clinicId, sendEmail, password } = await req.json();
    const medplum = await getMedplumForRequest(req);

    if (!firstName || !lastName || !email || !clinicId) {
      return NextResponse.json(
        { error: "firstName, lastName, email, and clinicId are required" },
        { status: 400 }
      );
    }

    if (sendEmail === false && !password) {
      return NextResponse.json(
        { error: "password is required when sendEmail is false" },
        { status: 400 }
      );
    }

    if (sendEmail === false && password && String(password).trim().length < 8) {
      return NextResponse.json(
        { error: "password must be at least 8 characters" },
        { status: 400 }
      );
    }

    await invitePractitionerToMedplum({
      firstName: String(firstName).trim(),
      lastName: String(lastName).trim(),
      email: String(email).trim().toLowerCase(),
      clinicId: String(clinicId).trim(),
      sendEmail: sendEmail !== false,
      password: password ? String(password) : undefined,
      medplum,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to invite practitioner:", error);
    return NextResponse.json(
      { error: error.message || "Failed to invite practitioner" },
      {
        status:
          /Platform admin access required/i.test(error.message || "")
            ? 403
            :
          /already exists|already registered|Reuse is blocked/i.test(error.message || "")
            ? 409
            : 500,
      }
    );
  }
}
