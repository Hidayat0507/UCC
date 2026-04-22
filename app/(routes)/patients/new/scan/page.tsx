"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import Link from "next/link";
import { ArrowLeft, Camera } from "lucide-react";
import { useSearchParams } from "next/navigation";
import NextImage from "next/image";

export default function ScanICPage() {
  return (
    <Suspense fallback={<div className="container max-w-3xl py-6">Loading…</div>}>
      <ScanICPageInner />
    </Suspense>
  );
}

function ScanICPageInner() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [captured, setCaptured] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [nric, setNric] = useState("");
  const [isCapturing, setIsCapturing] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const { toast } = useToast();
  const searchParams = useSearchParams();

  // Prefill from query params when coming from registration
  useEffect(() => {
    const qFullName = searchParams.get("fullName") || "";
    const qNric = searchParams.get("nric") || "";
    if (qFullName) setFullName(qFullName);
    if (qNric) setNric(qNric);
  }, [searchParams]);

  // Camera stream lifecycle
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (cancelled) return;
        setStream(media);
        streamRef.current = media;
        if (videoRef.current) {
          videoRef.current.srcObject = media;
          await videoRef.current.play();
        }
      } catch (e) {
        console.error(e);
        toast({ title: "Camera error", description: "Could not access camera.", variant: "destructive" });
      }
    })();
    return () => {
      cancelled = true;
      const s = streamRef.current;
      if (s) s.getTracks().forEach(t => t.stop());
      setStream(null);
    };
  }, [toast]);

  const capture = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    try {
      setIsCapturing(true);
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const maxWidth = 1280;
      const scale = video.videoWidth > maxWidth ? maxWidth / video.videoWidth : 1;
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.filter = 'none';
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      setCaptured(dataUrl);
      toast({ title: 'Photo captured', description: 'Review the still before reading the IC.' });
    } finally {
      setIsCapturing(false);
    }
  };

  const preprocessForOCR = async (dataUrl: string) => {
    const img = new Image();
    img.src = dataUrl;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = (err) => reject(err);
    });
    const maxWidth = 900;
    const scale = img.width > maxWidth ? maxWidth / img.width : 1;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return dataUrl;
    ctx.filter = 'grayscale(100%) contrast(140%) brightness(110%)';
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const marginX = Math.round(canvas.width * 0.08);
    const marginY = Math.round(canvas.height * 0.18);
    const cropWidth = Math.max(1, canvas.width - marginX * 2);
    const cropHeight = Math.max(1, canvas.height - marginY * 2);
    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = cropWidth;
    cropCanvas.height = cropHeight;
    const cropCtx = cropCanvas.getContext('2d');
    if (!cropCtx) return canvas.toDataURL('image/jpeg', 0.65);
    cropCtx.drawImage(canvas, marginX, marginY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
    return cropCanvas.toDataURL('image/jpeg', 0.65);
  };

  const runOCR = async () => {
    if (!captured) {
      toast({ title: 'Capture required', description: 'Take a photo of the IC before reading.', variant: 'destructive' });
      return;
    }
    try {
      setIsReading(true);
      const processed = await preprocessForOCR(captured);
      const base64 = processed.split(',')[1];
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);
      const res = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64 }),
        signal: controller.signal
      });
      clearTimeout(timeout);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'OCR failed');
      setFullName(data.fullName || "");
      setNric(data.nric || "");
      toast({ title: 'IC scanned', description: 'Review and continue to registration.' });
    } catch (e: any) {
      toast({ title: 'OCR error', description: e.message || 'Failed to read IC', variant: 'destructive' });
    } finally {
      setIsReading(false);
    }
  };

  return (
    <div className="container max-w-3xl py-6 space-y-4">
      <div className="mb-2">
        <Link href="/patients/new" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Registration
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Scan IC</CardTitle>
          <CardDescription>Use your phone camera to scan the ID card. We’ll extract name and NRIC for quick registration.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative w-full aspect-video rounded-md overflow-hidden bg-black/20">
            <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
            {captured && (
              <div className="absolute inset-0 bg-black/70">
                <NextImage src={captured} alt="Captured IC" fill className="object-contain rounded" sizes="100vw" />
              </div>
            )}
            <canvas ref={canvasRef} className="hidden" />
            {captured && (
              <div className="absolute bottom-2 right-2 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setCaptured(null)} disabled={isReading}>
                  Retake
                </Button>
              </div>
            )}
            {isReading && (
              <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white gap-2">
                <span className="text-sm font-medium">Reading IC…</span>
                <span className="text-xs text-white/80">This may take a few seconds on first use.</span>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" onClick={capture} className="flex items-center gap-2" disabled={isCapturing || isReading}>
              <Camera className="h-4 w-4" /> {captured ? 'Retake Photo' : 'Capture'}
            </Button>
            <Button type="button" variant="secondary" onClick={runOCR} disabled={!captured || isReading}>
              {isReading ? 'Reading…' : 'Read IC'}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-muted-foreground">Full name</label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Extracted full name" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">NRIC</label>
              <Input value={nric} onChange={(e) => setNric(e.target.value)} placeholder="YYMMDD-SS-NNNN" />
            </div>
          </div>

          <div className="flex justify-end">
            <Link
              href={{
                pathname: "/patients/new",
                query: {
                  fullName,
                  nric,
                  ...(searchParams.get("visitIntent") === "otc" ||
                  searchParams.get("visitIntent") === "consultation"
                    ? { visitIntent: searchParams.get("visitIntent")! }
                    : {}),
                },
              }}
            >
              <Button>Continue to registration</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
