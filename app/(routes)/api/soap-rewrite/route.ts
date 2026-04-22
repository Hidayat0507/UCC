import { NextRequest } from "next/server";
import { getMedplumForRequest } from "@/lib/server/medplum-auth";
import { isRateLimited } from "@/lib/rate-limit";
import { soapRewriteBodySchema } from "@/lib/validation";
import { createChatCompletion, type ChatMessage } from "@/lib/server/openrouter";
import { SOAP_REWRITE_ENABLED } from "@/lib/features";

export async function POST(req: NextRequest) {
  try {
    if (!SOAP_REWRITE_ENABLED) {
      return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
    }

    try {
      await getMedplumForRequest(req);
    } catch {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (isRateLimited(`soap:${ip}`, 30, 60_000)) {
      return new Response(JSON.stringify({ error: "Too Many Requests" }), { status: 429 });
    }

    const body = await req.json();
    const parsed = soapRewriteBodySchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Invalid body" }), { status: 400 });
    }

    const { text, model } = normalizeInputs(parsed.data);

    const messages: ChatMessage[] = [
      {
        role: "system",
        content:
          "You are an EMR documentation assistant. Rewrite the input into a structured SOAP note with four labeled sections only: 'Subjective:', 'Objective:', 'Assessment:', and 'Plan:'. Keep it concise and clinically appropriate. No extra commentary.",
      },
      {
        role: "user",
        content: text,
      },
    ];

    const completion = await createChatCompletion(messages, { model, temperature: 0.3, maxTokens: 1200 });
    const content = completion.choices?.[0]?.message?.content?.trim() || "";

    console.log("[soap-rewrite] model:", completion.model, "chars:", content.length);

    const finalNote = content && content.trim().length > 0 ? content : buildFallbackSoap(text);

    return new Response(
      JSON.stringify({
        note: finalNote,
        modelUsed: completion.model,
      }),
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[soap-rewrite] Unexpected error", error);
    const message = error?.message || "Unexpected error";
    const status = error?.code === "MISSING_API_KEY" ? 500 : 500;
    return new Response(JSON.stringify({ error: message }), { status });
  }
}

function normalizeInputs(data: any) {
  if ("text" in data) {
    return {
      text: String(data.text ?? ""),
      model: data.model as string | undefined,
    };
  }
  // Back-compat: accept subjective/objective but combine into a single text blob
  const subjective = typeof data.subjective === "string" ? data.subjective : "";
  const objective = typeof data.objective === "string" ? data.objective : "";
  const text = [subjective, objective].filter(Boolean).join("\n\n");
  return {
    text,
    model: data.model as string | undefined,
  };
}

function buildFallbackSoap(text: string): string {
  const body = (text || "").trim() || "No clinical notes provided.";
  const parts = [
    `Subjective:\n${body}`,
    "Objective:\nN/A",
    "Assessment:\nPending clinician assessment.",
    "Plan:\nPending clinician plan.",
  ];
  return parts.join("\n\n");
}
