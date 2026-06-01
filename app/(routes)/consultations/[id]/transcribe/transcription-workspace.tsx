"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, ClipboardCheck, Mic, Save, Sparkles, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PatientCard, type SerializedPatient } from "@/components/patients/patient-card";
import SoapRewriteButton from "@/app/(routes)/patients/[id]/consultation/soap-rewrite-button";
import { updateConsultation } from "@/lib/models";
import { useToast } from "@/components/ui/use-toast";
import type { SerializedConsultation } from "@/lib/types";
import { SOAP_REWRITE_ENABLED } from "@/lib/features";

type TranscriptionWorkspaceProps = {
  consultation?: SerializedConsultation | null;
  patient?: SerializedPatient | null;
  fallbackPatientId?: string | null;
  backHref?: string | null;
};

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export default function TranscriptionWorkspace({
  consultation,
  patient,
  fallbackPatientId,
  backHref,
}: TranscriptionWorkspaceProps) {
  const consultationId = consultation?.id ?? null;
  const defaultSummary = useMemo(
    () => consultation?.notes ?? consultation?.chiefComplaint ?? "",
    [consultation?.chiefComplaint, consultation?.notes]
  );
  const storageKey = useMemo(() => {
    if (consultationId) {
      return `consultation_transcription_${consultationId}`;
    }
    if (fallbackPatientId) {
      return `consultation_transcription_patient_${fallbackPatientId}`;
    }
    return null;
  }, [consultationId, fallbackPatientId]);
  const [transcript, setTranscript] = useState("");
  const [summary, setSummary] = useState(defaultSummary);
  const [savedSummary, setSavedSummary] = useState(consultation?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      setSummary(defaultSummary);
      setSavedSummary(consultation?.notes ?? "");
    });
  }, [defaultSummary, consultation?.notes]);

  useEffect(() => {
    if (!storageKey || typeof window === "undefined") {
      return;
    }

    try {
      const stored = localStorage.getItem(storageKey);
      if (stored && stored.trim()) {
        queueMicrotask(() => {
          setSummary((current) => (current.trim() ? current : stored));
        });
      }
    } catch {
      // ignore storage read failures
    }
  }, [storageKey]);

  const handleRecordingToggle = async () => {
    if (isRecording) {
      // Stop recording
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      return;
    }

    // Start recording
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Reset chunks
      audioChunksRef.current = [];
      setRecordingTime(0);

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4",
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setIsRecording(false);
        
        // Stop all tracks
        stream.getTracks().forEach((track) => track.stop());

        // Process the recording
        if (audioChunksRef.current.length === 0) {
          toast({
            title: "No audio recorded",
            description: "Please try recording again.",
            variant: "destructive",
          });
          return;
        }

        await handleTranscribe();
      };

      mediaRecorder.onerror = (error) => {
        console.error("MediaRecorder error:", error);
        setIsRecording(false);
        stream.getTracks().forEach((track) => track.stop());
        toast({
          title: "Recording error",
          description: "Failed to record audio. Please try again.",
          variant: "destructive",
        });
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);

      toast({
        title: "Recording started",
        description: "Speak naturally. Click 'Stop' when done.",
      });
    } catch (error: any) {
      console.error("Failed to start recording:", error);
      
      let errorMessage = "Failed to access microphone.";
      if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
        errorMessage = "Microphone permission denied. Please allow access and try again.";
      } else if (error.name === "NotFoundError") {
        errorMessage = "No microphone found. Please connect a microphone and try again.";
      }

      toast({
        title: "Recording failed",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleTranscribe = async () => {
    setIsTranscribing(true);
    
    try {
      // Create audio blob
      const audioBlob = new Blob(audioChunksRef.current, {
        type: mediaRecorderRef.current?.mimeType || "audio/webm",
      });

      // Create form data
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");
      formData.append("language", "en");

      toast({
        title: "Transcribing...",
        description: "Please wait while we process your audio.",
      });

      // Send to API
      const response = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Transcription failed");
      }

      const data = await response.json();
      const newTranscript = data.transcript || "";

      if (!newTranscript.trim()) {
        toast({
          title: "No speech detected",
          description: "Please try recording again and speak clearly.",
          variant: "destructive",
        });
        return;
      }

      // Append to existing transcript
      setTranscript((prev) => {
        const combined = prev ? `${prev}\n\n${newTranscript}` : newTranscript;
        return combined;
      });

      toast({
        title: "Transcription complete",
        description: `Successfully transcribed ${newTranscript.split(" ").length} words.`,
      });
    } catch (error: any) {
      console.error("Transcription error:", error);
      toast({
        title: "Transcription failed",
        description: error.message || "Please try again or type manually.",
        variant: "destructive",
      });
    } finally {
      setIsTranscribing(false);
      audioChunksRef.current = [];
    }
  };

  const handleSave = async () => {
    if (!summary.trim()) {
      toast({
        title: "Nothing to save",
        description: "Capture a consultation summary before saving.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      if (!consultationId) {
        const clipboard = typeof navigator === "undefined" ? undefined : navigator.clipboard;
        if (!clipboard) {
          throw new Error("Clipboard access is not available in this browser.");
        }
        await clipboard.writeText(summary);
        toast({
          title: "Summary copied",
          description: "Summary copied to clipboard. Paste it into the clinical notes field.",
        });
      } else {
        await updateConsultation(consultationId, {
          notes: summary,
        });
        setSavedSummary(summary);

        toast({
          title: "Summary saved",
          description: "The consultation notes have been updated with your summary.",
        });
      }

      if (storageKey && typeof window !== "undefined") {
        try {
          localStorage.setItem(storageKey, summary);
        } catch {
          // ignore storage failures
        }
      }
    } catch (error: any) {
      toast({
        title: "Failed to save summary",
        description: error?.message ?? "Unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const helperMessage = !patient && fallbackPatientId
    ? `Patient information could not be loaded. Continue transcribing and paste the result back into the consultation for patient ${fallbackPatientId}.`
    : null;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 lg:flex-row">
      <div className="flex flex-1 flex-col gap-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {backHref ? (
            <Button variant="ghost" className="w-fit px-0" asChild>
              <Link href={backHref} className="inline-flex items-center text-sm text-muted-foreground hover:text-primary">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to consultation
              </Link>
            </Button>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={handleSave} disabled={saving}>
              {consultationId ? <Save className="mr-2 h-4 w-4" /> : <ClipboardCheck className="mr-2 h-4 w-4" />}
              {saving
                ? consultationId
                  ? "Saving…"
                  : "Copying…"
                : consultationId
                  ? "Save summary to record"
                  : "Copy summary to clipboard"}
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Transcription workspace
            </CardTitle>
            <CardDescription>
              {SOAP_REWRITE_ENABLED
                ? "Record audio, get AI transcription, generate SOAP notes, then save to consultation."
                : "Record audio, get AI transcription, review and save to consultation."}
            </CardDescription>
            {helperMessage ? <p className="text-sm text-muted-foreground">{helperMessage}</p> : null}
          </CardHeader>
          <CardContent className="grid gap-6">
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant={isRecording ? "destructive" : "default"}
                  size="sm"
                  onClick={handleRecordingToggle}
                  disabled={isTranscribing}
                >
                  {isRecording ? <Square className="mr-2 h-4 w-4" /> : <Mic className="mr-2 h-4 w-4" />}
                  {isRecording ? "Stop recording" : "Start recording"}
                </Button>
                {isRecording && (
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                    <span className="text-sm font-medium text-destructive">
                      Recording: {formatTime(recordingTime)}
                    </span>
                  </div>
                )}
                {isTranscribing && (
                  <span className="text-sm text-muted-foreground">
                    Transcribing audio...
                  </span>
                )}
              </div>
              <Label htmlFor="transcript">Conversation transcript</Label>
              <Textarea
                id="transcript"
                value={transcript}
                onChange={(event) => setTranscript(event.target.value)}
                placeholder="Click 'Start recording' to record audio, or type/paste transcript manually."
                className="min-h-[220px] font-mono text-sm"
                disabled={isTranscribing}
              />
              <p className="text-xs text-muted-foreground">
                💡 Tip: Record in short segments for better accuracy. Multiple recordings will be appended.
              </p>
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="summary">Consultation summary</Label>
                {SOAP_REWRITE_ENABLED && (
                  <SoapRewriteButton sourceText={transcript} onInsert={setSummary} />
                )}
              </div>
              <Textarea
                id="summary"
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
                placeholder="Generate SOAP from transcript, or type summary manually..."
                className="min-h-[260px]"
                disabled={isTranscribing}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {patient ? (
        <aside className="w-full max-w-sm shrink-0 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Patient overview</CardTitle>
              <CardDescription>Reference details while preparing the consultation summary.</CardDescription>
            </CardHeader>
            <CardContent>
              <PatientCard patient={patient} compact />
            </CardContent>
          </Card>
          {consultation ? (
            <Card>
              <CardHeader>
                <CardTitle>Existing consultation note</CardTitle>
                <CardDescription>Current additional notes stored with this consultation.</CardDescription>
              </CardHeader>
              <CardContent>
                {savedSummary ? (
                  <pre className="whitespace-pre-wrap text-sm text-muted-foreground">{savedSummary}</pre>
                ) : (
                  <p className="text-sm text-muted-foreground">No summary has been saved yet.</p>
                )}
              </CardContent>
            </Card>
          ) : null}
        </aside>
      ) : null}
    </div>
  );
}
