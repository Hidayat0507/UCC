"use client";

import { useState, useEffect, useDeferredValue } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PDFViewer, pdf } from "@react-pdf/renderer";
import ReferralDocument from "@/components/referrals/referral-document";
import { fetchOrganizationDetails, type OrganizationDetails } from "@/lib/org";
import { format } from "date-fns";
import type { SerializedPatient } from "@/components/patients/patient-card";

interface ReferralLetterButtonProps {
  sourceText: string;
  patient?: SerializedPatient | null;
}

function formatDateLabel(value?: string | Date | null): string | null {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return format(date, "dd MMM yyyy");
}

export default function ReferralLetterButton({ sourceText, patient }: ReferralLetterButtonProps) {
  const [result, setResult] = useState<string | null>(null);
  const [toField, setToField] = useState<string>("");
  const [fromField, setFromField] = useState<string>("");
  const [organization, setOrganization] = useState<OrganizationDetails | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const org = await fetchOrganizationDetails();
      if (!active) return;
      setOrganization(org);
      setFromField((current) => current || org?.name || "");
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleGenerate = async () => {
    setResult(sourceText);
    setFromField((current) => current || organization?.name || "");
    setOpen(true);
  };

  const formattedDate = format(new Date(), "dd MMM yyyy");
  const patientName = patient?.fullName ?? null;
  const patientId = patient?.nric ?? null;
  const patientDob = formatDateLabel(patient?.dateOfBirth ?? null);
  const patientPhone = patient?.phone ?? null;
  const patientEmail = patient?.email ?? null;
  const previewLetter = useDeferredValue(result);
  const previewTo = useDeferredValue(toField);
  const previewFrom = useDeferredValue(fromField);
  const showPreview = Boolean(previewLetter && previewLetter.trim().length > 0);

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={handleGenerate} disabled={!sourceText.trim()}>
        Generate referral letter
      </Button>

      <Dialog
        open={open}
        onOpenChange={(value) => {
          setOpen(value);
          if (!value) {
            setResult(null);
            setToField("");
            setFromField(organization?.name || "");
          }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Referral Letter Draft</DialogTitle>
            <DialogDescription>
              Capture the recipient and patient details, polish the draft, and download a branded PDF.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="referral-to">To</Label>
                <Input
                  id="referral-to"
                  placeholder="e.g. Cardiology Department, General Hospital"
                  value={toField}
                  onChange={(event) => setToField(event.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="referral-from">From</Label>
                <Input
                  id="referral-from"
                  placeholder="e.g. Evergreen Family Clinic"
                  value={fromField}
                  onChange={(event) => setFromField(event.target.value)}
                />
              </div>
            </div>
            {patient ? (
              <div className="rounded-md border bg-muted/50 px-4 py-3 text-sm leading-6">
                <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                  <div>
                    <span className="text-muted-foreground">Patient:</span>{" "}
                    <span className="font-medium text-foreground">{patientName}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">NRIC / ID:</span>{" "}
                    <span className="font-medium text-foreground">{patientId || "—"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Date of Birth:</span>{" "}
                    <span className="font-medium text-foreground">{patientDob || "—"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Phone:</span>{" "}
                    <span className="font-medium text-foreground">{patientPhone || "—"}</span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-muted-foreground">Email:</span>{" "}
                    <span className="font-medium text-foreground">{patientEmail || "—"}</span>
                  </div>
                </div>
              </div>
            ) : null}
            <Textarea
              value={result ?? ""}
              onChange={(event) => setResult(event.target.value)}
              className="min-h-[320px]"
              placeholder="Referral letter content"
            />
            <div className="h-[380px] border rounded-md overflow-hidden">
              {showPreview ? (
                <PDFViewer className="h-full w-full">
                  <ReferralDocument
                    letterText={previewLetter ?? ""}
                    organization={organization}
                    metadata={{
                      dateLabel: formattedDate,
                      toLine: previewTo || null,
                      fromLine: previewFrom || null,
                      patientName,
                      patientId,
                      patientDateOfBirth: patientDob,
                      patientPhone,
                      patientEmail,
                    }}
                  />
                </PDFViewer>
              ) : (
                <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
                  Draft content will appear here as a PDF preview once available.
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setResult(null);
                setOpen(false);
              }}
            >
              Close
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!result}
              onClick={async () => {
                if (!result) return;
                const blob = await pdf(
                  <ReferralDocument
                    letterText={result}
                    organization={organization}
                    metadata={{
                      dateLabel: formattedDate,
                      toLine: toField || null,
                      fromLine: fromField || null,
                      patientName,
                      patientId,
                      patientDateOfBirth: patientDob,
                      patientPhone,
                      patientEmail,
                    }}
                  />
                ).toBlob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "referral-letter.pdf";
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              Download PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
