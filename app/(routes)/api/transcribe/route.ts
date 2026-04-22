import { NextRequest } from "next/server";
import { getMedplumForRequest } from "@/lib/server/medplum-auth";
import { isRateLimited } from "@/lib/rate-limit";

// Using Groq for Whisper (fast and free tier available)
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_WHISPER_MODEL || "whisper-large-v3";

// Fallback to OpenAI Whisper if Groq not configured
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const WHISPER_MODEL = process.env.WHISPER_MODEL || "whisper-1";

if (!GROQ_API_KEY && !OPENAI_API_KEY) {
  console.warn("[transcribe] Neither GROQ_API_KEY nor OPENAI_API_KEY configured");
}

export async function POST(req: NextRequest) {
  try {
    // Authentication
    try {
      await getMedplumForRequest(req);
    } catch {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    // Rate limiting - 20 requests per minute (transcription can take time)
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (isRateLimited(`transcribe:${ip}`, 20, 60_000)) {
      return new Response(
        JSON.stringify({ error: "Too many transcription requests. Please wait a minute." }),
        { status: 429 }
      );
    }

    if (!GROQ_API_KEY && !OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Transcription service not configured. Contact administrator." }),
        { status: 503 }
      );
    }

    // Parse form data
    const formData = await req.formData();
    const audioFile = formData.get("audio") as File | null;
    const language = (formData.get("language") as string) || "en";

    if (!audioFile) {
      return new Response(JSON.stringify({ error: "No audio file provided" }), { status: 400 });
    }

    // Validate file size (25MB limit)
    const MAX_SIZE = 25 * 1024 * 1024;
    if (audioFile.size > MAX_SIZE) {
      return new Response(
        JSON.stringify({ error: "Audio file too large. Maximum 25MB." }),
        { status: 400 }
      );
    }

    console.log("[transcribe] Processing:", {
      name: audioFile.name,
      type: audioFile.type,
      size: `${(audioFile.size / 1024 / 1024).toFixed(2)}MB`,
      provider: GROQ_API_KEY ? "Groq" : "OpenAI",
    });

    let transcript = "";
    let provider = "";

    // Try Groq first (faster and free tier)
    if (GROQ_API_KEY) {
      try {
        transcript = await transcribeWithGroq(audioFile, language);
        provider = "groq";
      } catch (error: any) {
        console.error("[transcribe] Groq failed:", error.message);
        
        // Fallback to OpenAI if Groq fails and OpenAI is available
        if (OPENAI_API_KEY) {
          console.log("[transcribe] Falling back to OpenAI");
          transcript = await transcribeWithOpenAI(audioFile, language);
          provider = "openai";
        } else {
          throw error;
        }
      }
    } else if (OPENAI_API_KEY) {
      transcript = await transcribeWithOpenAI(audioFile, language);
      provider = "openai";
    }

    console.log("[transcribe] Success:", {
      provider,
      length: transcript.length,
      preview: transcript.substring(0, 100) + (transcript.length > 100 ? "..." : ""),
    });

    return new Response(
      JSON.stringify({
        transcript,
        provider,
        model: provider === "groq" ? GROQ_MODEL : WHISPER_MODEL,
      }),
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[transcribe] Error:", error);
    return new Response(
      JSON.stringify({ error: error?.message || "Transcription failed" }),
      { status: 500 }
    );
  }
}

async function transcribeWithGroq(audioFile: File, language: string): Promise<string> {
  const formData = new FormData();
  formData.append("file", audioFile);
  formData.append("model", GROQ_MODEL);
  formData.append("language", language);
  formData.append("response_format", "json");

  const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMsg = errorData?.error?.message || response.statusText || "Groq transcription failed";
    throw new Error(errorMsg);
  }

  const result = await response.json();
  return result.text || "";
}

async function transcribeWithOpenAI(audioFile: File, language: string): Promise<string> {
  const formData = new FormData();
  formData.append("file", audioFile);
  formData.append("model", WHISPER_MODEL);
  formData.append("language", language);
  formData.append("response_format", "json");

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMsg = errorData?.error?.message || response.statusText || "OpenAI transcription failed";
    throw new Error(errorMsg);
  }

  const result = await response.json();
  return result.text || "";
}

