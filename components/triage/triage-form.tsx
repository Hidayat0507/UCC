"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  Activity,
  Heart,
  Siren,
  Wind,
  Thermometer,
  Droplets,
  Scale,
  Ruler,
} from "lucide-react";
import { TriageLevel, VitalSigns } from "@/lib/types";
import { Patient } from "@/lib/models";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

interface TriageFormProps {
  patient: Patient;
  /** When true, save via API then refresh current route only (no redirect to dashboard / orders). */
  stayAfterSubmit?: boolean;
}

const PAYMENT_METHOD_OPTIONS = [
  { value: "self_pay", label: "Self-pay" },
  { value: "intracare_sdn_bhd", label: "Intracare Sdn Bhd" },
];

export default function TriageForm({ patient, stayAfterSubmit = false }: TriageFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const [triageLevel, setTriageLevel] = useState<TriageLevel>(patient.triage?.triageLevel ?? 3);
  const [isUrgent, setIsUrgent] = useState((patient.triage?.triageLevel ?? 3) <= 2);
  const [chiefComplaint, setChiefComplaint] = useState(patient.triage?.chiefComplaint ?? "");
  const [visitIntent, setVisitIntent] = useState(patient.visitIntent ?? "consultation");
  const [billingPerson, setBillingPerson] = useState<"self" | "dependent">(
    patient.billingPerson === "dependent" ? "dependent" : "self"
  );
  const [paymentMethod, setPaymentMethod] = useState(
    patient.paymentMethod ??
      (patient.payerType === "panel" ? "intracare_sdn_bhd" : "self_pay")
  );
  const [assignedClinician, setAssignedClinician] = useState(patient.assignedClinician ?? "");
  const [dependentName, setDependentName] = useState(patient.dependentName ?? "");
  const [dependentRelationship, setDependentRelationship] = useState(patient.dependentRelationship ?? "");
  const [dependentPhone, setDependentPhone] = useState(patient.dependentPhone ?? "");

  const [vitalSigns, setVitalSigns] = useState<VitalSigns>({
    bloodPressureSystolic: patient.triage?.vitalSigns?.bloodPressureSystolic,
    bloodPressureDiastolic: patient.triage?.vitalSigns?.bloodPressureDiastolic,
    heartRate: patient.triage?.vitalSigns?.heartRate,
    respiratoryRate: patient.triage?.vitalSigns?.respiratoryRate,
    temperature: patient.triage?.vitalSigns?.temperature,
    oxygenSaturation: patient.triage?.vitalSigns?.oxygenSaturation,
    painScore: patient.triage?.vitalSigns?.painScore,
    weight: patient.triage?.vitalSigns?.weight,
    height: patient.triage?.vitalSigns?.height,
  });

  const handleVitalSignChange = (key: keyof VitalSigns, value: string) => {
    const numValue = value === "" ? undefined : parseFloat(value);
    setVitalSigns((prev) => ({ ...prev, [key]: numValue }));
  };

  const handleUrgencyChange = (checked: boolean) => {
    setIsUrgent(checked);
    setTriageLevel(checked ? 2 : 4);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!chiefComplaint.trim()) {
      toast({
        title: "Error",
        description: "Chief complaint is required",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/triage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          patientId: patient.id,
          triageLevel,
          chiefComplaint,
          vitalSigns,
          visitIntent,
          payerType:
            billingPerson === "dependent"
              ? "dependent"
              : paymentMethod === "self_pay"
                ? "self_pay"
                : "panel",
          paymentMethod,
          billingPerson,
          assignedClinician: assignedClinician.trim() || undefined,
          dependentName: billingPerson === "dependent" ? dependentName.trim() || undefined : undefined,
          dependentRelationship:
            billingPerson === "dependent" ? dependentRelationship.trim() || undefined : undefined,
          dependentPhone: billingPerson === "dependent" ? dependentPhone.trim() || undefined : undefined,
          redFlags: [],
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to submit triage");
      }

      toast({
        title: stayAfterSubmit ? "Check-in details saved" : "Check-in complete",
        description: stayAfterSubmit
          ? `${patient.fullName}'s visit details were updated.`
          : `${patient.fullName} has been checked in and added to the queue.`,
      });

      if (!stayAfterSubmit) {
        if (visitIntent === "otc") {
          router.push(
            `/orders?source=registration-otc&patientId=${patient.id}&patientName=${encodeURIComponent(patient.fullName)}`
          );
        } else {
          router.push("/dashboard");
        }
      }
      router.refresh();
    } catch (error) {
      console.error("Error submitting triage:", error);
      toast({
        title: "Error",
        description: "Failed to complete check-in. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const vitalInputClass = "h-8 text-sm";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Card>
        <CardHeader className="space-y-1 px-4 pb-2 pt-4">
          <CardTitle className="text-base">Patient &amp; visit</CardTitle>
          <CardDescription className="text-xs">
            Demographics and reception details for this encounter.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-4 pb-4">
          <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
            <div>
              <Label className="text-xs text-muted-foreground">Name</Label>
              <p className="font-medium leading-tight">{patient.fullName}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">NRIC</Label>
              <p className="font-medium leading-tight">{patient.nric}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Phone</Label>
              <p className="font-medium leading-tight">{patient.phone}</p>
            </div>
          </div>

          <div className="border-t pt-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Visit information
            </p>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3">
                <div>
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">Purpose</p>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { value: "consultation", label: "Consultation" },
                      { value: "otc", label: "OTC" },
                      { value: "follow_up", label: "Follow-up" },
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setVisitIntent(option.value)}
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs transition",
                          visitIntent === option.value
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 bg-background text-slate-700"
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="assigned-clinician" className="text-xs">
                    Doctor (optional)
                  </Label>
                  <Input
                    id="assigned-clinician"
                    className="h-9 text-sm"
                    value={assignedClinician}
                    onChange={(e) => setAssignedClinician(e.target.value)}
                    placeholder="Name or assign later"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">Billing</p>
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {[
                      { value: "self", label: "Self" },
                      { value: "dependent", label: "Dependent" },
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setBillingPerson(option.value as "self" | "dependent")}
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs transition",
                          billingPerson === option.value
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 bg-background text-slate-700"
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Payment</Label>
                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="Payment method" />
                      </SelectTrigger>
                      <SelectContent>
                        {PAYMENT_METHOD_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {billingPerson === "dependent" ? (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="dependent-name" className="text-xs">
                        Dependent name
                      </Label>
                      <Input
                        id="dependent-name"
                        className="h-9 text-sm"
                        value={dependentName}
                        onChange={(e) => setDependentName(e.target.value)}
                        placeholder="Name"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="dependent-phone" className="text-xs">
                        Phone
                      </Label>
                      <Input
                        id="dependent-phone"
                        className="h-9 text-sm"
                        value={dependentPhone}
                        onChange={(e) => setDependentPhone(e.target.value)}
                        placeholder="Number"
                      />
                    </div>
                    <div className="col-span-2 space-y-1.5">
                      <Label htmlFor="dependent-relationship" className="text-xs">
                        Relationship
                      </Label>
                      <Input
                        id="dependent-relationship"
                        className="h-9 text-sm"
                        value={dependentRelationship}
                        onChange={(e) => setDependentRelationship(e.target.value)}
                        placeholder="E.g. spouse, child"
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
        <Card className="lg:min-w-0">
          <CardHeader className="space-y-0.5 px-4 pb-2 pt-4">
            <CardTitle className="text-base">Priority &amp; complaint</CardTitle>
            <CardDescription className="text-xs">
              Urgency and main reason for visit.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 px-4 pb-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
              <div className="flex items-start gap-2">
                <Checkbox
                  id="mark-urgent"
                  checked={isUrgent}
                  onCheckedChange={(checked) => handleUrgencyChange(Boolean(checked))}
                  className="mt-0.5"
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <Label
                    htmlFor="mark-urgent"
                    className="flex cursor-pointer items-center gap-1.5 text-sm font-medium"
                  >
                    <Siren className={cn("h-3.5 w-3.5", isUrgent ? "text-rose-600" : "text-slate-400")} />
                    Mark visit urgent
                  </Label>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={isUrgent ? "destructive" : "secondary"} className="text-xs">
                      {isUrgent ? "Urgent" : "Standard"}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">Level {triageLevel} for queue</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="chief-complaint" className="text-xs">
                Chief complaint <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="chief-complaint"
                value={chiefComplaint}
                onChange={(e) => setChiefComplaint(e.target.value)}
                placeholder="E.g., chest pain, shortness of breath…"
                className="min-h-[80px] resize-y text-sm"
                rows={3}
                required
              />
            </div>
          </CardContent>
        </Card>

        <Card className="lg:min-w-0">
          <CardHeader className="space-y-0.5 px-4 pb-2 pt-4">
            <CardTitle className="text-base">Vital signs</CardTitle>
            <CardDescription className="text-xs">Optional; compact entry grid.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-x-2 gap-y-2 px-4 pb-4 xl:grid-cols-3">
            <div className="col-span-2 space-y-1 xl:col-span-2">
              <Label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Activity className="h-3 w-3 shrink-0" />
                BP mmHg
              </Label>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  className={vitalInputClass}
                  placeholder="Systolic"
                  value={vitalSigns.bloodPressureSystolic ?? ""}
                  onChange={(e) => handleVitalSignChange("bloodPressureSystolic", e.target.value)}
                />
                <span className="text-muted-foreground text-xs">/</span>
                <Input
                  type="number"
                  className={vitalInputClass}
                  placeholder="Diastolic"
                  value={vitalSigns.bloodPressureDiastolic ?? ""}
                  onChange={(e) => handleVitalSignChange("bloodPressureDiastolic", e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Heart className="h-3 w-3 shrink-0" />
                HR bpm
              </Label>
              <Input
                type="number"
                className={vitalInputClass}
                placeholder="—"
                value={vitalSigns.heartRate ?? ""}
                onChange={(e) => handleVitalSignChange("heartRate", e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Wind className="h-3 w-3 shrink-0" />
                RR /min
              </Label>
              <Input
                type="number"
                className={vitalInputClass}
                placeholder="—"
                value={vitalSigns.respiratoryRate ?? ""}
                onChange={(e) => handleVitalSignChange("respiratoryRate", e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Thermometer className="h-3 w-3 shrink-0" />
                Temp °C
              </Label>
              <Input
                type="number"
                step="0.1"
                className={vitalInputClass}
                placeholder="e.g. 37.0"
                value={vitalSigns.temperature ?? ""}
                onChange={(e) => handleVitalSignChange("temperature", e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Droplets className="h-3 w-3 shrink-0" />
                SpO₂ %
              </Label>
              <Input
                type="number"
                className={vitalInputClass}
                placeholder="—"
                value={vitalSigns.oxygenSaturation ?? ""}
                onChange={(e) => handleVitalSignChange("oxygenSaturation", e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <AlertCircle className="h-3 w-3 shrink-0" />
                Pain 0–10
              </Label>
              <Input
                type="number"
                min="0"
                max="10"
                className={vitalInputClass}
                placeholder="—"
                value={vitalSigns.painScore ?? ""}
                onChange={(e) => handleVitalSignChange("painScore", e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Scale className="h-3 w-3 shrink-0" />
                Wt kg
              </Label>
              <Input
                type="number"
                step="0.1"
                className={vitalInputClass}
                placeholder="—"
                value={vitalSigns.weight ?? ""}
                onChange={(e) => handleVitalSignChange("weight", e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Ruler className="h-3 w-3 shrink-0" />
                Ht cm
              </Label>
              <Input
                type="number"
                step="0.1"
                className={vitalInputClass}
                placeholder="—"
                value={vitalSigns.height ?? ""}
                onChange={(e) => handleVitalSignChange("height", e.target.value)}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="sticky bottom-0 z-10 flex justify-end gap-2 border-t bg-background/95 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <Button type="button" variant="outline" size="sm" onClick={() => router.back()} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={submitting}>
          {submitting
            ? "Saving…"
            : stayAfterSubmit
              ? "Save check-in details"
              : visitIntent === "otc"
                ? "Complete & go to billing"
                : "Complete check-in & add to queue"}
        </Button>
      </div>
    </form>
  );
}
