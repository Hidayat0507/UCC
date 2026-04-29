import { NextRequest, NextResponse } from "next/server";
import { completeCheckoutInvoice } from "@/lib/fhir/billing-service";
import { requireClinicAuth } from "@/lib/server/medplum-auth";
import { handleRouteError } from "@/lib/server/route-helpers";

function validateRequestBody(body: any): string | null {
  if (!body || typeof body !== "object") {
    return "Invalid JSON body";
  }

  if (!body.consultationId || !body.patientId) {
    return "consultationId and patientId are required";
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return "At least one invoice item is required";
  }

  if (!["cash", "card", "qr", "panel"].includes(body.paymentMethod)) {
    return "Invalid payment method";
  }

  const paidAmount = Number(body.paidAmount);
  const totalAmount = Number(body.totalAmount);
  if (!Number.isFinite(paidAmount) || !Number.isFinite(totalAmount)) {
    return "paidAmount and totalAmount must be valid amounts";
  }

  if (paidAmount + 0.01 < totalAmount) {
    return "Full payment is required before checkout completion";
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const validationError = validateRequestBody(body);

    if (validationError) {
      return NextResponse.json({ success: false, error: validationError }, { status: 400 });
    }

    const { medplum, clinicId } = await requireClinicAuth(req);
    const invoice = await completeCheckoutInvoice(medplum, {
      consultationId: body.consultationId,
      patientId: body.patientId,
      clinicId,
      items: body.items,
      paymentMethod: body.paymentMethod,
      paidAmount: body.paidAmount,
      totalAmount: body.totalAmount,
    });

    return NextResponse.json({ success: true, invoiceId: invoice.id });
  } catch (error) {
    if (error instanceof Error && /required|Invalid|must|match|Full payment/.test(error.message)) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return handleRouteError(error, "POST /api/billing");
  }
}
