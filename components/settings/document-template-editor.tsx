"use client";

import * as React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DEFAULT_MC_TEMPLATE,
  DEFAULT_REFERRAL_TEMPLATE,
  fillPreviewData,
} from "@/lib/document-templates";

const MC_VARS = [
  "{{clinicName}}", "{{clinicAddress}}", "{{clinicPhone}}",
  "{{patientName}}", "{{patientNric}}", "{{patientDob}}",
  "{{mcDays}}", "{{mcStartDate}}", "{{mcEndDate}}",
  "{{diagnosis}}", "{{doctorName}}", "{{date}}",
];

const REFERRAL_VARS = [
  "{{clinicName}}", "{{clinicAddress}}", "{{clinicPhone}}",
  "{{patientName}}", "{{patientNric}}", "{{patientAge}}",
  "{{referralTo}}", "{{referralFrom}}", "{{referralBody}}",
  "{{diagnosis}}", "{{doctorName}}", "{{date}}",
];

interface TemplatePanelProps {
  type: "mc" | "referral";
  html: string;
  onChange: (html: string) => void;
  onSave: () => void;
  onReset: () => void;
  isSaving: boolean;
}

function TemplatePanel({ type, html, onChange, onSave, onReset, isSaving }: TemplatePanelProps) {
  const vars = type === "mc" ? MC_VARS : REFERRAL_VARS;
  const [showVars, setShowVars] = React.useState(false);
  const [previewHtml, setPreviewHtml] = React.useState<string | null>(null);

  const handlePreview = () => {
    setPreviewHtml(fillPreviewData(html));
  };

  return (
    <div className="space-y-3">
      <div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-muted-foreground"
          onClick={() => setShowVars((v) => !v)}
        >
          Available placeholders
          {showVars ? (
            <ChevronUp className="ml-1 h-3 w-3" />
          ) : (
            <ChevronDown className="ml-1 h-3 w-3" />
          )}
        </Button>
        {showVars && (
          <div className="mt-1.5 flex flex-wrap gap-1.5 rounded-md border bg-muted/40 px-3 py-2">
            {vars.map((v) => (
              <code
                key={v}
                className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-mono text-foreground cursor-pointer hover:bg-accent"
                title="Click to copy"
                onClick={() => navigator.clipboard.writeText(v).catch(() => null)}
              >
                {v}
              </code>
            ))}
          </div>
        )}
      </div>

      <Textarea
        value={html}
        onChange={(e) => {
          onChange(e.target.value);
          setPreviewHtml(null);
        }}
        className="min-h-[400px] font-mono text-xs"
        spellCheck={false}
      />

      <div className="flex items-center gap-2 flex-wrap">
        <Button type="button" variant="outline" size="sm" onClick={onReset}>
          Reset to default
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={handlePreview}>
          Preview
        </Button>
        <Button type="button" size="sm" onClick={onSave} disabled={isSaving}>
          {isSaving ? "Saving…" : "Save template"}
        </Button>
      </div>

      {previewHtml && (
        <iframe
          srcDoc={previewHtml}
          className="w-full rounded-md border"
          style={{ height: 600 }}
          title="Template preview"
        />
      )}
    </div>
  );
}

export function DocumentTemplateEditor() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [mcHtml, setMcHtml] = React.useState(DEFAULT_MC_TEMPLATE);
  const [referralHtml, setReferralHtml] = React.useState(DEFAULT_REFERRAL_TEMPLATE);
  const [resetTarget, setResetTarget] = React.useState<"mc" | "referral" | null>(null);

  React.useEffect(() => {
    (async () => {
      try {
        const [mcRes, refRes] = await Promise.all([
          fetch("/api/document-templates?type=mc"),
          fetch("/api/document-templates?type=referral"),
        ]);
        if (mcRes.ok) {
          const data = await mcRes.json();
          if (data.html) setMcHtml(data.html);
        }
        if (refRes.ok) {
          const data = await refRes.json();
          if (data.html) setReferralHtml(data.html);
        }
      } catch {
        // Fallback to defaults — already set as initial state.
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const handleSave = async (type: "mc" | "referral") => {
    setIsSaving(true);
    try {
      const html = type === "mc" ? mcHtml : referralHtml;
      const res = await fetch("/api/document-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, html }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error ?? "Save failed");
      }
      toast({ title: "Template saved", description: "The template has been updated." });
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const confirmReset = () => {
    if (!resetTarget) return;
    if (resetTarget === "mc") setMcHtml(DEFAULT_MC_TEMPLATE);
    else setReferralHtml(DEFAULT_REFERRAL_TEMPLATE);
    setResetTarget(null);
    toast({ title: "Template reset", description: "Default template restored. Save to persist." });
  };

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading templates…</p>;
  }

  return (
    <>
      <Tabs defaultValue="mc">
        <TabsList className="mb-4">
          <TabsTrigger value="mc">MC Template</TabsTrigger>
          <TabsTrigger value="referral">Referral Letter</TabsTrigger>
        </TabsList>

        <TabsContent value="mc">
          <TemplatePanel
            type="mc"
            html={mcHtml}
            onChange={setMcHtml}
            onSave={() => handleSave("mc")}
            onReset={() => setResetTarget("mc")}
            isSaving={isSaving}
          />
        </TabsContent>

        <TabsContent value="referral">
          <TemplatePanel
            type="referral"
            html={referralHtml}
            onChange={setReferralHtml}
            onSave={() => handleSave("referral")}
            onReset={() => setResetTarget("referral")}
            isSaving={isSaving}
          />
        </TabsContent>
      </Tabs>

      <AlertDialog open={resetTarget !== null} onOpenChange={(open) => { if (!open) setResetTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset to default?</AlertDialogTitle>
            <AlertDialogDescription>
              This will replace your current template with the built-in default. You can still
              save or discard after reviewing. This cannot be undone once saved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmReset}
            >
              Reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}