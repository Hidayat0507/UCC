import { NextRequest } from "next/server";
import { getMedplumForRequest } from "@/lib/server/medplum-auth";
import { isRateLimited } from "@/lib/rate-limit";
import { ocrBodySchema } from "@/lib/validation";
import { recognizeIC } from "@/lib/ocr";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const allowDev = process.env.NODE_ENV !== 'production' && process.env.OCR_ALLOW_DEV === 'true';
    // Require a valid Medplum session unless explicitly allowed in development
    if (!allowDev) {
      try { await getMedplumForRequest(req); } catch { return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }); }
    }

    // Rate limit by IP
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (isRateLimited(`ocr:${ip}`, 12, 60_000)) {
      return new Response(JSON.stringify({ error: "Too Many Requests" }), { status: 429 });
    }
    const parsed = ocrBodySchema.safeParse(await req.json());
    if (!parsed.success) return new Response(JSON.stringify({ error: "Invalid body" }), { status: 400 });
    const { image } = parsed.data;
    const payload = await recognizeIC(image);

    return new Response(
      JSON.stringify(payload),
      { status: 200 }
    );
  } catch (e: any) {
    console.error("OCR error", e);
    const message = e?.message === "OCR timed out" ? e.message : "Unexpected error";
    const status = e?.message === "OCR timed out" ? 504 : 500;
    return new Response(JSON.stringify({ error: message }), { status });
  }
}
