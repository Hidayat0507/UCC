"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft, Camera } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import Link from "next/link";
import { savePatient } from "@/lib/fhir/patient-client";
import { useRouter } from "next/navigation";
import React from "react";

const patientFormSchema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters"),
  nric: z.string().regex(/^\d{6}-\d{2}-\d{4}$/, "Invalid NRIC format (e.g., 880705-56-5975)"),
  dateOfBirth: z.string().optional(),
  gender: z.enum(["male", "female", "other"]),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  phone: z.string().regex(/^\+?[0-9]{8,15}$/, "Invalid phone number"),
  address: z.string().optional().or(z.literal("")),
  postalCode: z.string().regex(/^\d{5}$/, "Postal code must be 5 digits").optional().or(z.literal("")),
  emergencyContact: z.object({
    name: z.string().optional().or(z.literal("")),
    relationship: z.string().optional().or(z.literal("")),
    phone: z.string().regex(/^\+?[0-9]{8,15}$/, "Invalid phone number").optional().or(z.literal("")),
  }).optional(),
  medicalHistory: z.object({
    allergies: z.string().optional().or(z.literal("")),
  }).optional(),
});

type PatientFormValues = z.infer<typeof patientFormSchema>;

const RequiredLabel = ({ children }: { children: React.ReactNode }) => (
  <FormLabel className="after:content-[&quot;*&quot;] after:ml-0.5 after:text-red-500">
    {children}
  </FormLabel>
);

interface NewPatientFormProps {
  initialFullName?: string;
  initialNric?: string;
}

type PatientSearchResult = {
  id: string;
  fullName: string;
  nric?: string;
  dateOfBirth?: string;
  gender?: "male" | "female" | "other";
  email?: string;
  phone?: string;
  address?: string;
  postalCode?: string;
  emergencyContact?: {
    name?: string;
    relationship?: string;
    phone?: string;
  };
  medicalHistory?: {
    allergies?: string[];
  };
};

const clinicianOptions = [
  "Dr. Sarah Wong",
  "Dr. Amir Rahman",
  "Dr. Nurul Aisyah",
  "Dr. Benjamin Lee",
];

const registrationRequirements = {
  doctorRequired: true,
  payerRequired: true,
  visitNotesRequired: false,
};

export default function NewPatientForm({ initialFullName = "", initialNric = "" }: NewPatientFormProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [currentStep, setCurrentStep] = React.useState<1 | 2>(1);
  const [patientEntryMode, setPatientEntryMode] = React.useState<"new" | "existing">("new");
  const [existingSearchQuery, setExistingSearchQuery] = React.useState("");
  const [existingSearchLoading, setExistingSearchLoading] = React.useState(false);
  const [existingSearchResults, setExistingSearchResults] = React.useState<PatientSearchResult[]>([]);
  const [selectedExistingPatient, setSelectedExistingPatient] = React.useState<PatientSearchResult | null>(null);
  const [duplicateCandidates, setDuplicateCandidates] = React.useState<PatientSearchResult[]>([]);
  const [duplicateLoading, setDuplicateLoading] = React.useState(false);
  const [allowPotentialDuplicate, setAllowPotentialDuplicate] = React.useState(false);
  const [checkInAfterRegistration, setCheckInAfterRegistration] = React.useState(true);
  const [chiefComplaint, setChiefComplaint] = React.useState("");
  const [payerType, setPayerType] = React.useState("self_pay");
  const [assignedClinician, setAssignedClinician] = React.useState("");
  const [visitPurpose, setVisitPurpose] = React.useState("consultation");
  const [billingPerson, setBillingPerson] = React.useState("self");
  const [registrationBy, setRegistrationBy] = React.useState("");
  const [isDependentDialogOpen, setIsDependentDialogOpen] = React.useState(false);
  const [dependentName, setDependentName] = React.useState("");
  const [dependentRelationship, setDependentRelationship] = React.useState("");
  const [dependentPhone, setDependentPhone] = React.useState("");

  const form = useForm<PatientFormValues>({
    resolver: zodResolver(patientFormSchema),
    defaultValues: {
      fullName: initialFullName,
      nric: initialNric,
      dateOfBirth: "",
      gender: undefined,
      email: "",
      phone: "",
      address: "",
      postalCode: "",
      medicalHistory: {
        allergies: "",
      },
      emergencyContact: {
        name: "",
        relationship: "",
        phone: "",
      },
    },
  });

  const formatNRIC = (value: string) => {
    const numbers = value.replace(/[^0-9]/g, '');
    if (numbers.length <= 6) {
      return numbers;
    } else if (numbers.length <= 8) {
      return `${numbers.slice(0, 6)}-${numbers.slice(6)}`;
    } else {
      return `${numbers.slice(0, 6)}-${numbers.slice(6, 8)}-${numbers.slice(8, 12)}`;
    }
  };

  const getNRICDate = (nric: string): string => {
    const birthDate = nric.slice(0, 6);
    const year = parseInt(birthDate.slice(0, 2));
    const month = parseInt(birthDate.slice(2, 4));
    const day = parseInt(birthDate.slice(4, 6));
    const fullYear = year + (year >= 30 ? 1900 : 2000);
    const formattedMonth = month.toString().padStart(2, '0');
    const formattedDay = day.toString().padStart(2, '0');
    return `${fullYear}-${formattedMonth}-${formattedDay}`;
  };

  const nric = form.watch('nric');
  const phone = form.watch('phone');

  React.useEffect(() => {
    if (nric && nric.length >= 6) {
      const birthDate = getNRICDate(nric.replace(/[^0-9]/g, ''));
      form.setValue('dateOfBirth', birthDate);
    }
  }, [nric, form]);

  React.useEffect(() => {
    if (patientEntryMode !== "existing") {
      setExistingSearchResults([]);
      return;
    }
    const query = existingSearchQuery.trim();
    if (query.length < 2) {
      setExistingSearchResults([]);
      return;
    }

    let cancelled = false;
    setExistingSearchLoading(true);
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/patients?search=${encodeURIComponent(query)}&limit=20`);
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.success) {
          throw new Error(payload.error || "Failed to search patients");
        }
        if (!cancelled) {
          setExistingSearchResults(payload.patients || []);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Existing patient search failed:", error);
          setExistingSearchResults([]);
        }
      } finally {
        if (!cancelled) {
          setExistingSearchLoading(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [existingSearchQuery, patientEntryMode]);

  React.useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        const response = await fetch("/api/auth/me");
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload?.authenticated) return;
        setRegistrationBy(payload?.summary?.name || "");
      } catch (error) {
        console.error("Failed to load current user for audit trail:", error);
      }
    };
    loadCurrentUser();
  }, []);

  React.useEffect(() => {
    if (patientEntryMode !== "new") {
      setDuplicateCandidates([]);
      return;
    }
    const searchValue = (form.getValues("nric") || form.getValues("phone") || "").trim();
    if (searchValue.length < 6) {
      setDuplicateCandidates([]);
      return;
    }
    let cancelled = false;
    setDuplicateLoading(true);
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/patients?search=${encodeURIComponent(searchValue)}&limit=10`);
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.success) {
          throw new Error(payload.error || "Failed duplicate check");
        }
        if (!cancelled) {
          const candidates = (payload.patients || []).filter((candidate: PatientSearchResult) => {
            const sameNric = candidate.nric && form.getValues("nric") && candidate.nric === form.getValues("nric");
            const samePhone = candidate.phone && form.getValues("phone") && candidate.phone === form.getValues("phone");
            return Boolean(sameNric || samePhone);
          });
          setDuplicateCandidates(candidates);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Duplicate check failed:", error);
          setDuplicateCandidates([]);
        }
      } finally {
        if (!cancelled) setDuplicateLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [form, patientEntryMode, nric, phone]);

  const selectExistingPatient = (patient: PatientSearchResult) => {
    setSelectedExistingPatient(patient);
    setExistingSearchQuery(patient.fullName || "");
    setExistingSearchResults([]);
    form.reset({
      fullName: patient.fullName || "",
      nric: patient.nric || "",
      dateOfBirth: patient.dateOfBirth ? String(patient.dateOfBirth).slice(0, 10) : "",
      gender: patient.gender || "other",
      email: patient.email || "",
      phone: patient.phone || "",
      address: patient.address || "",
      postalCode: patient.postalCode || "",
      medicalHistory: {
        allergies: (patient.medicalHistory?.allergies || []).join(", "),
      },
      emergencyContact: {
        name: patient.emergencyContact?.name || "",
        relationship: patient.emergencyContact?.relationship || "",
        phone: patient.emergencyContact?.phone || "",
      },
    });
  };

  const handleGoToVisitStep = async () => {
    if (patientEntryMode === "existing") {
      if (!selectedExistingPatient?.id) {
        toast({
          title: "Select existing patient",
          description: "Search and select a patient before continuing to visit information.",
          variant: "destructive",
        });
        return;
      }
      setCurrentStep(2);
      return;
    }

    if (patientEntryMode === "new" && duplicateCandidates.length > 0 && !allowPotentialDuplicate) {
      toast({
        title: "Potential duplicate found",
        description: "Select an existing patient or confirm duplicate creation to continue.",
        variant: "destructive",
      });
      return;
    }

    const valid = await form.trigger([
      "fullName",
      "nric",
      "dateOfBirth",
      "gender",
      "phone",
    ]);

    if (!valid) {
      toast({
        title: "Missing required details",
        description: "Please complete required patient information before continuing.",
        variant: "destructive",
      });
      return;
    }

    if (registrationRequirements.doctorRequired && !assignedClinician.trim()) {
      toast({
        title: "Doctor is required",
        description: "Please assign a doctor before continuing.",
        variant: "destructive",
      });
      return;
    }

    if (registrationRequirements.payerRequired && !payerType) {
      toast({
        title: "Payment method is required",
        description: "Please select payment method before continuing.",
        variant: "destructive",
      });
      return;
    }

    setCurrentStep(2);
  };

  async function onSubmit(data: PatientFormValues) {
    try {
      if (billingPerson === "dependent" && !dependentName.trim()) {
        setIsDependentDialogOpen(true);
        return;
      }

      if (registrationRequirements.visitNotesRequired && !chiefComplaint.trim()) {
        toast({
          title: "Visit notes required",
          description: "Please provide visit notes before submitting.",
          variant: "destructive",
        });
        return;
      }

      let patientId = selectedExistingPatient?.id;

      if (patientEntryMode !== "existing") {
        let dateOfBirthObj: Date | undefined;
        if (data.dateOfBirth) {
          try {
            dateOfBirthObj = new Date(data.dateOfBirth);
            if (isNaN(dateOfBirthObj.getTime())) {
              dateOfBirthObj = undefined;
            }
          } catch {
            dateOfBirthObj = undefined;
          }
        }

        if (!dateOfBirthObj) {
          toast({ title: "Error", description: "Invalid or missing Date of Birth.", variant: "destructive" });
          return;
        }

        const dateOfBirthIso = dateOfBirthObj.toISOString().split('T')[0]; // YYYY-MM-DD

        const patientData = {
          fullName: data.fullName,
          dateOfBirth: dateOfBirthIso,
          gender: data.gender,
          phone: data.phone,
          email: data.email || undefined,
          address: data.address || "",
          postalCode: data.postalCode || undefined,
          nric: data.nric,
          emergencyContact: (data.emergencyContact?.name || data.emergencyContact?.phone) ? {
            name: data.emergencyContact.name || "",
            relationship: data.emergencyContact.relationship || "",
            phone: data.emergencyContact.phone || "",
          } : undefined,
          medicalHistory: {
            allergies: data.medicalHistory?.allergies?.split(',').map(s => s.trim()).filter(Boolean) || [],
            conditions: [],
            medications: [],
          }
        };

        // 🎯 SAVE TO MEDPLUM (FHIR) - Source of Truth
        patientId = await savePatient(patientData);
      }
      if (!patientId) {
        throw new Error("Unable to determine patient for visit handoff.");
      }
      const isOtcVisit = visitPurpose === "otc";

      if (!isOtcVisit && checkInAfterRegistration) {
        const checkInResponse = await fetch("/api/check-in", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            patientId,
            chiefComplaint: chiefComplaint.trim() || undefined,
            payerType,
            assignedClinician: assignedClinician.trim() || undefined,
            billingPerson,
            dependentName: billingPerson === "dependent" ? dependentName.trim() || undefined : undefined,
            dependentRelationship: billingPerson === "dependent" ? dependentRelationship.trim() || undefined : undefined,
            dependentPhone: billingPerson === "dependent" ? dependentPhone.trim() || undefined : undefined,
            visitIntent: visitPurpose,
            registrationSource: "registration-wizard",
            registrationAt: new Date().toISOString(),
            performedBy: registrationBy || undefined,
          }),
        });

        if (!checkInResponse.ok) {
          const checkInError = await checkInResponse.json().catch(() => ({}));
          throw new Error(checkInError.error || "Patient registered but check-in failed.");
        }
      }
      
      toast({ 
        title: "Success", 
        description: isOtcVisit
          ? "Patient registered successfully. Continue with OTC billing."
          : checkInAfterRegistration
            ? "Patient registered and checked in successfully."
            : "Patient registered successfully in FHIR",
      });
      
      console.log(`✅ Patient saved to Medplum FHIR: ${patientId}`);

      if (isOtcVisit) {
        const query = new URLSearchParams({
          patientId,
          patientName: data.fullName,
          source: "registration-otc",
        }).toString();
        router.push(`/orders?${query}`);
        return;
      }

      router.push(checkInAfterRegistration ? "/dashboard" : `/patients/${patientId}`);
    } catch (error: any) {
      console.error('Failed to register patient:', error);
      toast({ 
        title: "Error", 
        description: error.message || "Failed to register patient. Please try again.", 
        variant: "destructive" 
      });
    }
  }

  return (
    <div className="container max-w-3xl py-6">
      <div className="mb-6">
        <Link href="/patients" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Patients
        </Link>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>New Patient Registration</CardTitle>
          <CardDescription>
            Register patient details first, then confirm visit information for handoff.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 rounded-lg border p-4">
            <p className="text-sm font-medium">Already registered patient?</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Use quick search and check-in for existing records to avoid duplicates.
            </p>
            <Button variant="outline" size="sm" className="mt-3" asChild>
              <Link href="/check-in">Search existing patient</Link>
            </Button>
          </div>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <div className="grid grid-cols-2 gap-2 rounded-md border p-1">
                <button
                  type="button"
                  className={`rounded px-3 py-2 text-sm font-medium ${
                    currentStep === 1 ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                  }`}
                  onClick={() => setCurrentStep(1)}
                >
                  1. Patient Information
                </button>
                <button
                  type="button"
                  className={`rounded px-3 py-2 text-sm font-medium ${
                    currentStep === 2 ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                  }`}
                  onClick={() => setCurrentStep(2)}
                >
                  2. Visit Information
                </button>
              </div>

              {currentStep === 1 ? (
                <>
                  <div className="space-y-4 rounded-lg border p-4">
                    <FormLabel>Patient Type</FormLabel>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant={patientEntryMode === "new" ? "default" : "outline"}
                        onClick={() => {
                          setPatientEntryMode("new");
                          setSelectedExistingPatient(null);
                        }}
                      >
                        Add New Patient
                      </Button>
                      <Button
                        type="button"
                        variant={patientEntryMode === "existing" ? "default" : "outline"}
                        onClick={() => setPatientEntryMode("existing")}
                      >
                        Search Existing Patient
                      </Button>
                    </div>

                    {patientEntryMode === "existing" ? (
                      <div className="space-y-3">
                        <Input
                          placeholder="Search by name, NRIC, or phone"
                          value={existingSearchQuery}
                          onChange={(e) => setExistingSearchQuery(e.target.value)}
                        />
                        {existingSearchLoading ? (
                          <p className="text-sm text-muted-foreground">Searching patients...</p>
                        ) : null}
                        {!existingSearchLoading && existingSearchQuery.trim().length >= 2 && existingSearchResults.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No matching patients found.</p>
                        ) : null}
                        {existingSearchResults.length > 0 ? (
                          <div className="max-h-56 space-y-2 overflow-y-auto rounded-md border p-2">
                            {existingSearchResults.map((patient) => (
                              <button
                                key={patient.id}
                                type="button"
                                className="w-full rounded-md border p-2 text-left hover:bg-muted"
                                onClick={() => selectExistingPatient(patient)}
                              >
                                <p className="font-medium">{patient.fullName}</p>
                                <p className="text-xs text-muted-foreground">
                                  NRIC: {patient.nric || "-"} • Phone: {patient.phone || "-"}
                                </p>
                              </button>
                            ))}
                          </div>
                        ) : null}
                        {selectedExistingPatient ? (
                          <p className="text-sm text-emerald-600">
                            Selected patient: {selectedExistingPatient.fullName}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  {patientEntryMode === "new" ? (
                    <div className="space-y-3 rounded-lg border p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">Duplicate Safety Check</p>
                        {duplicateLoading ? (
                          <span className="text-xs text-muted-foreground">Checking...</span>
                        ) : null}
                      </div>
                      {duplicateCandidates.length > 0 ? (
                        <div className="space-y-2">
                          <p className="text-sm text-amber-700">
                            Potential duplicate records found with same NRIC/phone.
                          </p>
                          <div className="space-y-2">
                            {duplicateCandidates.map((candidate) => (
                              <div key={candidate.id} className="rounded-md border p-2">
                                <p className="font-medium">{candidate.fullName}</p>
                                <p className="text-xs text-muted-foreground">
                                  NRIC: {candidate.nric || "-"} • Phone: {candidate.phone || "-"}
                                </p>
                                <div className="mt-2">
                                  <Button size="sm" variant="outline" type="button" onClick={() => {
                                    setPatientEntryMode("existing");
                                    selectExistingPatient(candidate);
                                  }}>
                                    Use this existing patient
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="flex items-start space-x-2">
                            <Checkbox
                              id="allow-duplicate"
                              checked={allowPotentialDuplicate}
                              onCheckedChange={(checked) => setAllowPotentialDuplicate(checked === true)}
                            />
                            <label htmlFor="allow-duplicate" className="text-sm text-muted-foreground">
                              I confirm this is a new patient and want to continue.
                            </label>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No duplicate matches detected.</p>
                      )}
                    </div>
                  ) : null}

                  <div className="space-y-6">
                    <h3 className="text-lg font-medium">Personal Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField control={form.control} name="fullName" render={({ field }) => (
                        <FormItem>
                          <RequiredLabel>Full Name</RequiredLabel>
                          <FormControl>
                            <Input placeholder="Enter patient&apos;s full name" {...field} disabled={patientEntryMode === "existing"} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="nric" render={({ field }) => (
                        <FormItem>
                          <RequiredLabel>NRIC</RequiredLabel>
                          <FormControl>
                            <div className="flex gap-2">
                              <Input placeholder="YYMMDD-SS-NNNN" {...field} onChange={(e) => {
                                const formatted = formatNRIC(e.target.value);
                                field.onChange(formatted);
                              }} disabled={patientEntryMode === "existing"} />
                              <Button
                                type="button"
                                variant="secondary"
                                className="whitespace-nowrap"
                                onClick={() => {
                                  const current = form.getValues();
                                  const q = new URLSearchParams({
                                    fullName: current.fullName || "",
                                    nric: current.nric || "",
                                  }).toString();
                                  router.push(`/patients/new/scan?${q}`);
                                }}
                                disabled={patientEntryMode === "existing"}
                              >
                                <Camera className="mr-1.5 h-4 w-4" /> Scan NRIC
                              </Button>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="dateOfBirth" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date of Birth</FormLabel>
                          <FormControl>
                            <Input type="date" placeholder="Auto-filled from NRIC" {...field} disabled className="bg-muted" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="gender" render={({ field }) => (
                        <FormItem>
                          <RequiredLabel>Gender</RequiredLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger disabled={patientEntryMode === "existing"}>
                                <SelectValue placeholder="Select gender" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="male">Male</SelectItem>
                              <SelectItem value="female">Female</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h3 className="text-lg font-medium">Contact Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField control={form.control} name="email" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="john@example.com" {...field} disabled={patientEntryMode === "existing"} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="phone" render={({ field }) => (
                        <FormItem>
                          <RequiredLabel>Contact Number</RequiredLabel>
                          <FormControl>
                            <Input placeholder="Enter contact number" {...field} disabled={patientEntryMode === "existing"} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="address" render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>Address</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Enter full address" {...field} disabled={patientEntryMode === "existing"} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="postalCode" render={({ field }) => (
                        <FormItem className="md:col-start-2">
                          <FormLabel>Postal Code</FormLabel>
                          <FormControl>
                            <Input placeholder="12345" {...field} disabled={patientEntryMode === "existing"} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h3 className="text-lg font-medium">Emergency Contact</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField control={form.control} name="emergencyContact.name" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contact Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Jane Doe" {...field} disabled={patientEntryMode === "existing"} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="emergencyContact.relationship" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Relationship</FormLabel>
                          <FormControl>
                            <Input placeholder="Spouse" {...field} disabled={patientEntryMode === "existing"} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="emergencyContact.phone" render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>Contact Number</FormLabel>
                          <FormControl>
                            <Input placeholder="+65 1234 5678" {...field} disabled={patientEntryMode === "existing"} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h3 className="text-lg font-medium">Medical History</h3>
                    <div className="space-y-4">
                      <FormField control={form.control} name="medicalHistory.allergies" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Allergies</FormLabel>
                          <FormControl>
                            <Textarea placeholder="List any known allergies" {...field} disabled={patientEntryMode === "existing"} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button type="button" onClick={handleGoToVisitStep}>
                      Continue to Visit Information
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="rounded-lg border p-4">
                    <p className="text-sm text-muted-foreground">Patient summary</p>
                    <p className="mt-1 font-medium">{form.getValues("fullName") || "Unnamed patient"}</p>
                    <p className="text-sm text-muted-foreground">
                      NRIC: {form.getValues("nric") || "-"} • Phone: {form.getValues("phone") || "-"}
                    </p>
                  </div>

                  <div className="space-y-4 rounded-lg border p-4">
                    <h3 className="text-lg font-medium">Visit Information</h3>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <FormLabel>Visit Purpose</FormLabel>
                        <Select value={visitPurpose} onValueChange={setVisitPurpose}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select visit purpose" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="consultation">Consultation</SelectItem>
                            <SelectItem value="otc">OTC</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <FormLabel>Doctor</FormLabel>
                        <Select value={assignedClinician} onValueChange={setAssignedClinician}>
                          <SelectTrigger>
                            <SelectValue placeholder="Assign doctor" />
                          </SelectTrigger>
                          <SelectContent>
                            {clinicianOptions.map((clinician) => (
                              <SelectItem key={clinician} value={clinician}>
                                {clinician}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <FormLabel>Visit Notes</FormLabel>
                        <Textarea
                          placeholder="Reason for visit or front desk notes"
                          value={chiefComplaint}
                          onChange={(e) => setChiefComplaint(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <FormLabel>Billing Person</FormLabel>
                        <Select value={billingPerson} onValueChange={setBillingPerson}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select billing person" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="self">Self</SelectItem>
                            <SelectItem value="dependent">Dependent</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <FormLabel>Payment Method</FormLabel>
                        <Select value={payerType} onValueChange={setPayerType}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select payment method" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="self_pay">Self-pay</SelectItem>
                            <SelectItem value="panel">Panel / Corporate</SelectItem>
                            <SelectItem value="dependent">Dependent</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border p-4">
                    <p className="text-sm font-medium">Visit summary</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Patient: {form.getValues("fullName") || "-"} • Purpose: {visitPurpose.toUpperCase()} •
                      Payer: {payerType.replace("_", " ")} • Doctor: {assignedClinician || "Unassigned"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Destination: {visitPurpose === "otc" ? "Orders / Billing" : "Waiting Queue"}
                    </p>
                    {registrationBy ? (
                      <p className="text-xs text-muted-foreground">Registered by: {registrationBy}</p>
                    ) : null}
                  </div>

                  <div className="flex items-start space-x-3 rounded-md border p-3">
                    <Checkbox
                      id="check-in-after-registration"
                      checked={checkInAfterRegistration}
                      onCheckedChange={(checked) => setCheckInAfterRegistration(checked === true)}
                    />
                    <div className="space-y-1">
                      <label
                        htmlFor="check-in-after-registration"
                        className="text-sm font-medium leading-none"
                      >
                        Check in immediately after registration
                      </label>
                      <p className="text-xs text-muted-foreground">
                        Sends the patient straight to today&apos;s queue as arrived.
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-between space-x-4">
                    <Button variant="outline" type="button" onClick={() => setCurrentStep(1)}>
                      Back to Patient Information
                    </Button>
                    <Button type="submit">
                      {visitPurpose === "otc" ? "Go to Invoice" : "Send to Waiting Area"}
                    </Button>
                  </div>
                </>
              )}
            </form>
          </Form>
        </CardContent>
      </Card>
      <Dialog open={isDependentDialogOpen} onOpenChange={setIsDependentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dependent billing information</DialogTitle>
            <DialogDescription>
              Required for dependent billing handoff.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <FormLabel>Dependent Name</FormLabel>
              <Input value={dependentName} onChange={(e) => setDependentName(e.target.value)} placeholder="Enter dependent name" />
            </div>
            <div className="space-y-1">
              <FormLabel>Relationship</FormLabel>
              <Input value={dependentRelationship} onChange={(e) => setDependentRelationship(e.target.value)} placeholder="E.g. Child, Spouse" />
            </div>
            <div className="space-y-1">
              <FormLabel>Phone (optional)</FormLabel>
              <Input value={dependentPhone} onChange={(e) => setDependentPhone(e.target.value)} placeholder="Enter phone" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setIsDependentDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (!dependentName.trim()) {
                  toast({
                    title: "Dependent name required",
                    description: "Please enter dependent name to continue.",
                    variant: "destructive",
                  });
                  return;
                }
                setIsDependentDialogOpen(false);
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

