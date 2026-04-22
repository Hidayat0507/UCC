"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft, Image as ImageIcon } from "lucide-react";
import Link from "next/link";
import { IMAGING_MODALITIES } from "@/modules/pacs/types";

export default function NewImagingOrderPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [patientSearch, setPatientSearch] = useState("");
  const [modality, setModality] = useState("");
  const [studyType, setStudyType] = useState("");
  const [bodyPart, setBodyPart] = useState("");
  const [priority, setPriority] = useState("routine");
  const [indication, setIndication] = useState("");
  const [clinicalNotes, setClinicalNotes] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!patientSearch || !modality || !studyType || !bodyPart || !indication) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch('/api/imaging/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          patientId: patientSearch,
          procedures: [studyType],
          priority: priority as 'routine' | 'urgent' | 'asap' | 'stat',
          clinicalIndication: indication || undefined,
          clinicalQuestion: clinicalNotes || undefined,
        }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.error || `Request failed (${res.status})`);
      }

      toast({
        title: "Order Created",
        description: "Imaging study has been ordered successfully.",
      });

      router.push("/pacs");
    } catch (error) {
      console.error("Error creating imaging order:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create imaging order. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const selectedModalityInfo = modality ? IMAGING_MODALITIES[modality as keyof typeof IMAGING_MODALITIES] : null;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/pacs">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <ImageIcon aria-hidden className="h-8 w-8" />
            New Imaging Order
          </h1>
          <p className="text-muted-foreground mt-2">
            Order a new medical imaging study
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Patient Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Patient Information</CardTitle>
            <CardDescription>Select the patient for this imaging study</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="patient">Patient Search *</Label>
              <Input
                id="patient"
                placeholder="Search by name, NRIC, or patient ID..."
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
                required
              />
              <p className="text-sm text-muted-foreground">
                Start typing to search for a patient
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Study Details */}
        <Card>
          <CardHeader>
            <CardTitle>Study Details</CardTitle>
            <CardDescription>Specify the imaging study to be performed</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="modality">Imaging Modality *</Label>
                <Select value={modality} onValueChange={setModality} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select modality" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Only X-Ray is available in UCC */}
                    <SelectItem value="xray">
                      {IMAGING_MODALITIES.xray.name} - {IMAGING_MODALITIES.xray.description}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  X-Ray is the primary imaging modality available at our Urgent Care Center
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="studyType">Study Type *</Label>
                {selectedModalityInfo ? (
                  <Select value={studyType} onValueChange={setStudyType} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select study type" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedModalityInfo.commonStudies.map((study) => (
                        <SelectItem key={study} value={study}>
                          {study}
                        </SelectItem>
                      ))}
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id="studyType"
                    placeholder="Select modality first"
                    disabled
                  />
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="bodyPart">Body Part / Region *</Label>
                <Input
                  id="bodyPart"
                  placeholder="e.g., Chest, Abdomen, Left Knee"
                  value={bodyPart}
                  onChange={(e) => setBodyPart(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">Priority *</Label>
                <Select value={priority} onValueChange={setPriority} required>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="routine">Routine</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="stat">STAT (Immediate)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {selectedModalityInfo && (
              <div className="bg-muted p-3 rounded-md">
                <p className="text-sm">
                  <span className="font-medium">Typical Duration:</span> ~{selectedModalityInfo.typicalDuration} minutes
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Clinical Information */}
        <Card>
          <CardHeader>
            <CardTitle>Clinical Information</CardTitle>
            <CardDescription>Provide clinical indication and relevant notes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="indication">Clinical Indication *</Label>
              <Textarea
                id="indication"
                placeholder="Reason for imaging study (e.g., 'Rule out pneumonia', 'Follow-up on previous fracture')"
                value={indication}
                onChange={(e) => setIndication(e.target.value)}
                rows={3}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="clinicalNotes">Additional Clinical Notes</Label>
              <Textarea
                id="clinicalNotes"
                placeholder="Any additional relevant clinical information, patient history, or special instructions..."
                value={clinicalNotes}
                onChange={(e) => setClinicalNotes(e.target.value)}
                rows={4}
              />
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Creating Order..." : "Create Imaging Order"}
          </Button>
        </div>
      </form>
    </div>
  );
}
