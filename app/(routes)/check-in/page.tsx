"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Clock, CheckCircle2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

type PatientResult = {
  id: string;
  fullName: string;
  nric?: string;
  phone?: string;
  queueStatus?: string | null;
};

export default function CheckInPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <h1 className="text-3xl font-bold tracking-tight">Walk-in Check-in</h1>
          <p className="text-muted-foreground">Loading…</p>
        </div>
      }
    >
      <CheckInPageInner />
    </Suspense>
  );
}

function CheckInPageInner() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [visitIntent, setVisitIntent] = useState("consultation");
  const [payerType, setPayerType] = useState("self_pay");
  const [assignedClinician, setAssignedClinician] = useState("");
  const [results, setResults] = useState<PatientResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [checkingInId, setCheckingInId] = useState<string | null>(null);

  const debouncedQuery = useDebounce(query, 250);

  useEffect(() => {
    const q = searchParams.get("search") || searchParams.get("q");
    if (q) setQuery(q);
    const v = searchParams.get("visitIntent");
    if (v === "otc" || v === "consultation" || v === "follow_up") {
      setVisitIntent(v);
    }
  }, [searchParams]);

  useEffect(() => {
    let active = true;
    const fetchPatients = async () => {
      if (!debouncedQuery || debouncedQuery.length < 2) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(`/api/patients?search=${encodeURIComponent(debouncedQuery)}&limit=15`);
        if (!res.ok) {
          throw new Error("Failed to search patients");
        }
        const data = await res.json();
        if (active) {
          setResults(data.patients || []);
        }
      } catch (error) {
        console.error("Error searching patients:", error);
        if (active) {
          toast({
            title: "Search failed",
            description: "Could not load patients. Try again.",
            variant: "destructive",
          });
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    fetchPatients();
    return () => {
      active = false;
    };
  }, [debouncedQuery, toast]);

  const handleCheckIn = async (patientId: string) => {
    setCheckingInId(patientId);
    try {
      const res = await fetch("/api/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          chiefComplaint: chiefComplaint.trim() || undefined,
          visitIntent,
          payerType,
          assignedClinician: assignedClinician.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to check patient in");
      }
      toast({
        title: "Checked in",
        description: "Patient added to waiting room as 'Arrived'.",
      });
      setChiefComplaint("");
      setAssignedClinician("");
      // refresh search results to reflect status
      setResults((prev) =>
        prev.map((p) =>
          p.id === patientId ? { ...p, queueStatus: "arrived" } : p
        )
      );
    } catch (error) {
      console.error("Error checking in patient:", error);
      toast({
        title: "Check-in failed",
        description: error instanceof Error ? error.message : "Unable to check in patient.",
        variant: "destructive",
      });
    } finally {
      setCheckingInId(null);
    }
  };

  const queueStatusBadge = (status?: string | null) => {
    switch (status) {
      case "arrived":
        return (
          <Badge variant="outline" className="gap-1">
            <Clock className="h-3 w-3" />
            Arrived
          </Badge>
        );
      case "waiting":
        return (
          <Badge variant="secondary" className="gap-1">
            <Clock className="h-3 w-3" />
            Waiting
          </Badge>
        );
      case "in_consultation":
        return (
          <Badge variant="default" className="gap-1">
            <CheckCircle2 className="h-3 w-3" />
            In Consultation
          </Badge>
        );
      default:
        return <Badge variant="outline">Not in queue</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Walk-in Check-in</h1>
        <p className="text-muted-foreground">
          Quickly check patients into the waiting room queue before triage.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Find Patient</CardTitle>
          <CardDescription>Search by name, NRIC, or phone number.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative w-full">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Type at least 2 characters..."
              className="pl-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Presenting complaint (optional)
              </label>
              <Input
                placeholder="E.g., fever and cough"
                value={chiefComplaint}
                onChange={(e) => setChiefComplaint(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Visit intent</label>
              <Select value={visitIntent} onValueChange={setVisitIntent}>
                <SelectTrigger>
                  <SelectValue placeholder="Select visit intent" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="consultation">Consultation</SelectItem>
                  <SelectItem value="otc">OTC / Quick Purchase</SelectItem>
                  <SelectItem value="follow_up">Follow-up</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Payer type</label>
              <Select value={payerType} onValueChange={setPayerType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select payer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="self_pay">Self-pay</SelectItem>
                  <SelectItem value="panel">Panel / Corporate</SelectItem>
                  <SelectItem value="dependent">Dependent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Assigned clinician (optional)
              </label>
              <Input
                placeholder="E.g., Dr. Sarah Wong"
                value={assignedClinician}
                onChange={(e) => setAssignedClinician(e.target.value)}
              />
            </div>
          </div>

          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>NRIC</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-6">
                      Searching...
                    </TableCell>
                  </TableRow>
                )}
                {!loading && results.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-6">
                      No patients yet. Start typing to search.
                    </TableCell>
                  </TableRow>
                )}
                {!loading &&
                  results.map((patient) => (
                    <TableRow key={patient.id}>
                      <TableCell className="font-medium">{patient.fullName}</TableCell>
                      <TableCell>{patient.nric || "—"}</TableCell>
                      <TableCell>{patient.phone || "—"}</TableCell>
                      <TableCell>{queueStatusBadge(patient.queueStatus)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          onClick={() => handleCheckIn(patient.id)}
                          disabled={checkingInId === patient.id}
                        >
                          {checkingInId === patient.id ? "Checking in..." : "Check in"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function useDebounce<T>(value: T, delay = 250) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
