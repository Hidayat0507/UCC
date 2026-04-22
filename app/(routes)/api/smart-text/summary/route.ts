import { NextRequest } from "next/server";
import { requireClinicAuth } from "@/lib/server/medplum-auth";
import { isRateLimited } from "@/lib/rate-limit";
import { getPatientFromMedplum } from "@/lib/fhir/patient-service";
import { getPatientConsultationsFromMedplum } from "@/lib/fhir/consultation-service";
import { createChatCompletion, type ChatMessage } from "@/lib/server/openrouter";

const DEFAULT_LIMIT = 5;

export async function POST(req: NextRequest) {
  try {
    let medplum: Awaited<ReturnType<typeof requireClinicAuth>>["medplum"];
    let clinicId: string;
    try {
      ({ medplum, clinicId } = await requireClinicAuth(req));
    } catch {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (isRateLimited(`smarttext:summary:${ip}`, 20, 60_000)) {
      return new Response(JSON.stringify({ error: "Too Many Requests" }), { status: 429 });
    }

    const body = await req.json().catch(() => ({}));
    const patientId = typeof body?.patientId === "string" ? body.patientId.trim() : "";
    const limit =
      typeof body?.limit === "number" && Number.isFinite(body.limit) && body.limit > 0
        ? Math.min(Math.floor(body.limit), 10)
        : DEFAULT_LIMIT;

    if (!patientId) {
      return new Response(JSON.stringify({ error: "Patient ID required" }), { status: 400 });
    }

    const [patient, consultations] = await Promise.all([
      getPatientFromMedplum(patientId, clinicId, medplum),
      getPatientConsultationsFromMedplum(patientId, clinicId, medplum),
    ]);

    if (!patient) {
      return new Response(JSON.stringify({ error: "Patient not found" }), { status: 404 });
    }

    const sorted = consultations
      .slice()
      .sort((a, b) => (toDate(b.date)?.getTime() ?? 0) - (toDate(a.date)?.getTime() ?? 0))
      .slice(0, Math.min(limit, 3)); // Limit to max 3 visits to reduce token count

    if (sorted.length === 0) {
      return new Response(
        JSON.stringify({
          summary: "- No previous consultations recorded.",
          meta: "No consultations available.",
        }),
        { status: 200 }
      );
    }

    const prompt = buildPrompt(patient, sorted);

    console.log(`[smart-text summary] Building summary for patient ${patientId.slice(0, 8)}... (${sorted.length} consultations)`);

    const messages: ChatMessage[] = [
      {
        role: "system",
        content:
          "You are a clinical assistant. Summarize the consultation notes into bullet points. Start each bullet with '- '. Keep it concise.",
      },
      {
        role: "user",
        content: prompt,
      },
    ];

    try {
      const completion = await createChatCompletion(messages, {
        model: "anthropic/claude-3-haiku", // Use Haiku for faster, more reliable summarization
        maxTokens: 800,
        temperature: 0.4,
      });

      const content = completion.choices?.[0]?.message?.content ?? "";
      const summary = sanitizeBulletList(content);

      if (summary.trim() === "- No summary available.") {
        console.warn(`[smart-text summary] AI returned empty summary for patient ${patientId.slice(0, 8)}..., using fallback.`);
        const fallback = buildFallbackSummary(patient, sorted);
        return new Response(
          JSON.stringify({
            summary: fallback,
            meta: "Fallback summary generated because AI response was empty.",
          }),
          { status: 200 }
        );
      }

      return new Response(
        JSON.stringify({
          summary,
          meta: `AI summary (${completion.model})`,
          modelUsed: completion.model,
        }),
        { status: 200 }
      );
    } catch (error) {
      console.error("[smart-text summary] AI generation failed", error);

      const summary = buildFallbackSummary(patient, sorted);

      console.log(`[smart-text summary] Fallback summary for patient ${patient.id}:`);
      console.log(summary || "<empty>");

      return new Response(
        JSON.stringify({
          summary,
          meta: "Fallback summary generated from past consultations.",
        }),
        { status: 200 }
      );
    }
  } catch (error) {
    console.error("[smart-text summary] error", error);
    const message = (error as any)?.message ?? "Unexpected error";
    return new Response(JSON.stringify({ error: message || "Unexpected error" }), { status: 500 });
  }
}

function toDate(value: any): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "object" && typeof value.toDate === "function") {
    const converted = value.toDate();
    return Number.isNaN(converted.getTime()) ? null : converted;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(value: any): string {
  const date = toDate(value);
  return date ? date.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }) : "Unknown date";
}

function truncateSingleLine(text: string, max = 160): string {
  const cleaned = String(text ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) {
    return "";
  }
  if (cleaned.length <= max) {
    return cleaned;
  }
  return `${cleaned.slice(0, max - 1)}…`;
}

function buildHistorySection(medicalHistory: any): string | null {
  if (!medicalHistory || typeof medicalHistory !== "object") {
    return null;
  }

  const sections: string[] = [];

  if (Array.isArray(medicalHistory.conditions) && medicalHistory.conditions.length > 0) {
    sections.push(`Chronic conditions: ${medicalHistory.conditions.join(", ")}`);
  }

  if (Array.isArray(medicalHistory.medications) && medicalHistory.medications.length > 0) {
    sections.push(`Long-term medications: ${medicalHistory.medications.join(", ")}`);
  }

  if (Array.isArray(medicalHistory.allergies) && medicalHistory.allergies.length > 0) {
    sections.push(`Allergies: ${medicalHistory.allergies.join(", ")}`);
  }

  if (sections.length === 0) {
    return null;
  }

  return sections.join("\n");
}

function buildFallbackSummary(patient: any, visits: any[]): string {
  const lines = visits.map((visit) => {
    const parts: string[] = [];

    if (visit.diagnosis) {
      parts.push(`Dx: ${truncateSingleLine(visit.diagnosis, 80)}`);
    }
    if (visit.chiefComplaint) {
      parts.push(`CC: ${truncateSingleLine(visit.chiefComplaint, 80)}`);
    }
    if (Array.isArray(visit.prescriptions) && visit.prescriptions.length > 0) {
      const meds = visit.prescriptions
        .map((item: any) => item?.medication?.name)
        .filter((name: any): name is string => Boolean(name));
      if (meds.length > 0) {
        parts.push(`Rx: ${meds.slice(0, 3).join(", ")}`);
      }
    }
    if (visit.notes) {
      const noteSnippet = truncateSingleLine(visit.notes, 120);
      if (noteSnippet) {
        parts.push(noteSnippet);
      }
    }

    if (parts.length === 0) {
      parts.push("No key details recorded.");
    }

    return `- ${formatDate(visit.date)} — ${parts.join(" | ")}`;
  });

  const history = buildHistorySection(patient?.medicalHistory);
  const header = `Previous consultations (${lines.length}):`;

  return history ? [header, ...lines, "", history].join("\n") : [header, ...lines].join("\n");
}

function buildPrompt(patient: any, visits: any[]): string {
  const allNotes = visits
    .map((visit, index) => {
      const date = formatDate(visit.date);
      const parts: string[] = [];
      if (visit.chiefComplaint) parts.push(visit.chiefComplaint);
      if (visit.diagnosis) parts.push(`Diagnosis: ${visit.diagnosis}`);
      if (visit.notes) parts.push(visit.notes);
      const combined = parts.filter(Boolean).join("\n");
      return combined ? `${date}: ${combined}` : null;
    })
    .filter(Boolean)
    .join("\n\n");

  return `Summarize ALL of the following visits together in 3-5 bullet points. Include trends, recurring issues, and key diagnoses across all visits:\n\n${allNotes}`;
}

function sanitizeField(value: any, max = 160): string {
  if (typeof value !== "string") {
    return "Not documented";
  }
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) {
    return "Not documented";
  }
  if (trimmed.length <= max) {
    return trimmed;
  }
  return `${trimmed.slice(0, max - 1)}…`;
}

function sanitizeBulletList(content: string): string {
  if (!content) {
    return "- No summary available.";
  }

  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return "- No summary available.";
  }

  const formatted = lines.map((line) => {
    if (line.startsWith("-")) {
      return `- ${line.replace(/^-+\s*/, "").trim()}`;
    }
    if (/^\d+\./.test(line)) {
      return `- ${line.replace(/^\d+\.\s*/, "").trim()}`;
    }
    return `- ${line}`;
  });

  return formatted.join("\n");
}
