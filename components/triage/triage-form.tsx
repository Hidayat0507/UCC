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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  AlertCircle, 
  Activity, 
  Heart, 
  Siren,
  Wind, 
  Thermometer, 
  Droplets,
  Scale,
  Ruler
} from "lucide-react";
import { TriageLevel, VitalSigns } from "@/lib/types";
import { Patient } from "@/lib/models";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

interface TriageFormProps {
  patient: Patient;
}

const RED_FLAG_OPTIONS = [
  "Chest pain",
  "Difficulty breathing",
  "Severe bleeding",
  "Altered consciousness",
  "Severe pain",
  "Suspected stroke",
  "Severe allergic reaction",
  "Head injury",
  "Abdominal pain",
  "Fever with confusion",
];

const PAYMENT_METHOD_OPTIONS = [
  { value: "self_pay", label: "Self-pay" },
  { value: "intracare_sdn_bhd", label: "Intracare Sdn Bhd" },
];

export default function TriageForm({ patient }: TriageFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [triageLevel, setTriageLevel] = useState<TriageLevel>(patient.triage?.triageLevel ?? 3);
  const [isUrgent, setIsUrgent] = useState((patient.triage?.triageLevel ?? 3) <= 2);
  const [chiefComplaint, setChiefComplaint] = useState(patient.triage?.chiefComplaint ?? "");
  const [triageNotes, setTriageNotes] = useState(patient.triage?.triageNotes ?? "");
  const [selectedRedFlags, setSelectedRedFlags] = useState<string[]>(patient.triage?.redFlags ?? []);
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
  
  // Vital signs state
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
    setVitalSigns(prev => ({ ...prev, [key]: numValue }));
  };

  const toggleRedFlag = (flag: string) => {
    setSelectedRedFlags(prev => 
      prev.includes(flag) 
        ? prev.filter(f => f !== flag)
        : [...prev, flag]
    );
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
          triageNotes,
          redFlags: selectedRedFlags,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to submit triage");
      }

      toast({
        title: "Triage Complete",
        description: `${patient.fullName} has been triaged and added to the queue.`,
      });

      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      console.error("Error submitting triage:", error);
      toast({
        title: "Error",
        description: "Failed to complete triage. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Patient Info Header */}
      <Card>
        <CardHeader>
          <CardTitle>Patient Information</CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-4">
          <div>
            <Label className="text-muted-foreground">Name</Label>
            <p className="font-medium">{patient.fullName}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">NRIC</Label>
            <p className="font-medium">{patient.nric}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">Phone</Label>
            <p className="font-medium">{patient.phone}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Visit Priority</CardTitle>
          <CardDescription>Use a simple urgent marker, similar to Yezza&apos;s visit information step.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex items-start gap-3">
              <Checkbox
                id="mark-urgent"
                checked={isUrgent}
                onCheckedChange={(checked) => handleUrgencyChange(Boolean(checked))}
                className="mt-1"
              />
              <div className="space-y-2">
                <Label htmlFor="mark-urgent" className="flex cursor-pointer items-center gap-2 text-base font-medium text-slate-950">
                  <Siren className={cn("h-4 w-4", isUrgent ? "text-rose-600" : "text-slate-400")} />
                  Mark this visit as urgent
                </Label>
                <p className="text-sm text-muted-foreground">
                  Indicates this visit needs immediate attention in the queue.
                </p>
                <div className="flex items-center gap-2">
                  <Badge variant={isUrgent ? "destructive" : "secondary"}>
                    {isUrgent ? "Urgent" : "Standard"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Stored internally as triage level {triageLevel} for queue ordering.
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          {selectedRedFlags.length > 0 && triageLevel >= 3 && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Red flags detected. Consider reassessing triage level.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Chief Complaint */}
      <Card>
        <CardHeader>
          <CardTitle>Chief Complaint</CardTitle>
          <CardDescription>Primary reason for visit</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={chiefComplaint}
            onChange={(e) => setChiefComplaint(e.target.value)}
            placeholder="E.g., Chest pain for 2 hours, shortness of breath..."
            rows={3}
            required
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Visit Information</CardTitle>
          <CardDescription>Capture the visit context on the same FHIR encounter before consultation.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4 rounded-xl border border-slate-200 p-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">Visit details</Label>
              <div className="space-y-3">
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Visit purpose</p>
                  <div className="flex gap-2">
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
                          "rounded-full border px-4 py-2 text-sm transition",
                          visitIntent === option.value
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 bg-white text-slate-700"
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="assigned-clinician">Doctor (Optional)</Label>
                  <Input
                    id="assigned-clinician"
                    value={assignedClinician}
                    onChange={(e) => setAssignedClinician(e.target.value)}
                    placeholder="Select doctor or enter doctor name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="visit-notes">Visit notes</Label>
                  <Textarea
                    id="visit-notes"
                    value={triageNotes}
                    onChange={(e) => setTriageNotes(e.target.value)}
                    placeholder="E.g. Shortness of breath"
                    rows={4}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4 rounded-xl border border-slate-200 p-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">Billing details</Label>
              <div className="space-y-3">
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Who is this person?</p>
                  <div className="flex gap-2">
                    {[
                      { value: "self", label: "Self" },
                      { value: "dependent", label: "Dependent" },
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setBillingPerson(option.value as "self" | "dependent")}
                        className={cn(
                          "rounded-full border px-4 py-2 text-sm transition",
                          billingPerson === option.value
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 bg-white text-slate-700"
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Payment method</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select payment method" />
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

                {billingPerson === "dependent" ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="dependent-name">Dependent name</Label>
                      <Input
                        id="dependent-name"
                        value={dependentName}
                        onChange={(e) => setDependentName(e.target.value)}
                        placeholder="Dependent name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dependent-phone">Phone</Label>
                      <Input
                        id="dependent-phone"
                        value={dependentPhone}
                        onChange={(e) => setDependentPhone(e.target.value)}
                        placeholder="Phone number"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="dependent-relationship">Relationship</Label>
                      <Input
                        id="dependent-relationship"
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

      {/* Vital Signs */}
      <Card>
        <CardHeader>
          <CardTitle>Vital Signs</CardTitle>
          <CardDescription>Record patient vital signs</CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-4">
          {/* Blood Pressure */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              Blood Pressure (mmHg)
            </Label>
            <div className="flex gap-2 items-center">
              <Input
                type="number"
                placeholder="Systolic"
                value={vitalSigns.bloodPressureSystolic ?? ""}
                onChange={(e) => handleVitalSignChange("bloodPressureSystolic", e.target.value)}
              />
              <span className="text-muted-foreground">/</span>
              <Input
                type="number"
                placeholder="Diastolic"
                value={vitalSigns.bloodPressureDiastolic ?? ""}
                onChange={(e) => handleVitalSignChange("bloodPressureDiastolic", e.target.value)}
              />
            </div>
          </div>

          {/* Heart Rate */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Heart className="h-4 w-4 text-muted-foreground" />
              Heart Rate (bpm)
            </Label>
            <Input
              type="number"
              placeholder="e.g., 75"
              value={vitalSigns.heartRate ?? ""}
              onChange={(e) => handleVitalSignChange("heartRate", e.target.value)}
            />
          </div>

          {/* Respiratory Rate */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Wind className="h-4 w-4 text-muted-foreground" />
              Respiratory Rate (breaths/min)
            </Label>
            <Input
              type="number"
              placeholder="e.g., 16"
              value={vitalSigns.respiratoryRate ?? ""}
              onChange={(e) => handleVitalSignChange("respiratoryRate", e.target.value)}
            />
          </div>

          {/* Temperature */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Thermometer className="h-4 w-4 text-muted-foreground" />
              Temperature (°C)
            </Label>
            <Input
              type="number"
              step="0.1"
              placeholder="e.g., 37.0"
              value={vitalSigns.temperature ?? ""}
              onChange={(e) => handleVitalSignChange("temperature", e.target.value)}
            />
          </div>

          {/* Oxygen Saturation */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Droplets className="h-4 w-4 text-muted-foreground" />
              SpO2 (%)
            </Label>
            <Input
              type="number"
              placeholder="e.g., 98"
              value={vitalSigns.oxygenSaturation ?? ""}
              onChange={(e) => handleVitalSignChange("oxygenSaturation", e.target.value)}
            />
          </div>

          {/* Pain Score */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
              Pain Score (0-10)
            </Label>
            <Input
              type="number"
              min="0"
              max="10"
              placeholder="0 = No pain, 10 = Worst pain"
              value={vitalSigns.painScore ?? ""}
              onChange={(e) => handleVitalSignChange("painScore", e.target.value)}
            />
          </div>

          {/* Weight */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Scale className="h-4 w-4 text-muted-foreground" />
              Weight (kg)
            </Label>
            <Input
              type="number"
              step="0.1"
              placeholder="e.g., 70.5"
              value={vitalSigns.weight ?? ""}
              onChange={(e) => handleVitalSignChange("weight", e.target.value)}
            />
          </div>

          {/* Height */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Ruler className="h-4 w-4 text-muted-foreground" />
              Height (cm)
            </Label>
            <Input
              type="number"
              step="0.1"
              placeholder="e.g., 170"
              value={vitalSigns.height ?? ""}
              onChange={(e) => handleVitalSignChange("height", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Red Flags */}
      <Card>
        <CardHeader>
          <CardTitle>Red Flags / Warning Signs</CardTitle>
          <CardDescription>Select any concerning symptoms or signs</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {RED_FLAG_OPTIONS.map((flag) => (
              <Badge
                key={flag}
                variant={selectedRedFlags.includes(flag) ? "destructive" : "outline"}
                className="cursor-pointer text-sm py-2 px-3"
                onClick={() => toggleRedFlag(flag)}
              >
                {flag}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Triage Notes */}
      <Card>
        <CardHeader>
          <CardTitle>Triage Notes</CardTitle>
          <CardDescription>Additional observations or concerns</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={triageNotes}
            onChange={(e) => setTriageNotes(e.target.value)}
            placeholder="Any additional observations, patient concerns, or relevant history..."
            rows={4}
          />
        </CardContent>
      </Card>

      {/* Submit — sticky footer so it's always reachable without scrolling */}
      <div className="sticky bottom-0 z-10 bg-background border-t py-4 -mx-8 px-8 flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Completing Triage..." : "Complete Triage & Add to Queue"}
        </Button>
      </div>
    </form>
  );
}





