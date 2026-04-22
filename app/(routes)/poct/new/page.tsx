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
import { ArrowLeft, TestTube } from "lucide-react";
import Link from "next/link";
import { POCT_TEST_DEFINITIONS } from "@/modules/poct/types";

export default function NewPOCTOrderPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [patientSearch, setPatientSearch] = useState("");
  const [testType, setTestType] = useState("");
  const [urgency, setUrgency] = useState("routine");
  const [notes, setNotes] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!patientSearch || !testType) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch('/api/labs/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          patientId: patientSearch,
          tests: [testType],
          priority: urgency as 'routine' | 'urgent' | 'stat',
          clinicalNotes: notes || undefined,
        }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.error || `Request failed (${res.status})`);
      }

      toast({
        title: "Test Ordered",
        description: "Point of care test has been ordered successfully.",
      });

      router.push("/poct");
    } catch (error) {
      console.error("Error creating POCT order:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create test order. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const selectedTest = testType ? POCT_TEST_DEFINITIONS[testType as keyof typeof POCT_TEST_DEFINITIONS] : null;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/poct">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <TestTube className="h-8 w-8" />
            New POCT Order
          </h1>
          <p className="text-muted-foreground mt-2">
            Order a new point of care test
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Patient Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Patient Information</CardTitle>
            <CardDescription>Select the patient for this test</CardDescription>
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

        {/* Test Details */}
        <Card>
          <CardHeader>
            <CardTitle>Test Details</CardTitle>
            <CardDescription>Select the test to be performed</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="testType">Test Type *</Label>
                <Select value={testType} onValueChange={setTestType} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select test type" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(POCT_TEST_DEFINITIONS).map((test) => (
                      <SelectItem key={test.type} value={test.type}>
                        <div className="flex flex-col">
                          <span className="font-medium">{test.name}</span>
                          <span className="text-xs text-muted-foreground">{test.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedTest && (
                <div className="md:col-span-2 bg-muted p-4 rounded-md space-y-2">
                  <div className="grid md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Category:</span>{" "}
                      <span className="capitalize">{selectedTest.category}</span>
                    </div>
                    <div>
                      <span className="font-medium">Duration:</span>{" "}
                      ~{selectedTest.expectedDuration} minutes
                    </div>
                    <div>
                      <span className="font-medium">Specimen:</span>{" "}
                      {selectedTest.requiresSpecimen}
                    </div>
                  </div>
                  {selectedTest.normalRange && (
                    <div className="text-sm">
                      <span className="font-medium">Normal Range:</span> {selectedTest.normalRange}
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="urgency">Urgency *</Label>
                <Select value={urgency} onValueChange={setUrgency} required>
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
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader>
            <CardTitle>Additional Notes</CardTitle>
            <CardDescription>Any special instructions or relevant information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Any additional information, special requirements, or clinical notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
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
            {submitting ? "Creating Order..." : "Create Test Order"}
          </Button>
        </div>
      </form>
    </div>
  );
}






