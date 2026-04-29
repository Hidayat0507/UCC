"use client";

import { forwardRef, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import Link from "next/link";
import { format } from "date-fns";
import { Loader2, ArrowLeft, Calendar, Clock, Stethoscope, Check, ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { getAllPatients, type Patient } from "@/lib/fhir/patient-client";
import { saveAppointment } from "@/lib/fhir/appointment-client";
import { useMedplumAuth } from "@/lib/auth-medplum";
import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type AppointmentStatus = "scheduled" | "checked_in" | "completed" | "cancelled" | "no_show";

const appointmentStatuses = [
  "scheduled",
  "checked_in",
  "completed",
  "cancelled",
  "no_show",
] as const satisfies readonly AppointmentStatus[];

const appointmentSchema = z.object({
  patientId: z.string({ required_error: "Patient is required" }).min(1, "Patient is required"),
  scheduledDate: z.string({ required_error: "Date is required" }).min(1, "Date is required"),
  scheduledTime: z.string({ required_error: "Time is required" }).min(1, "Time is required"),
  clinician: z.string({ required_error: "Clinician is required" }).min(1, "Clinician is required"),
  reason: z.string({ required_error: "Reason is required" }).min(3, "Please describe the visit reason"),
  visitType: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(appointmentStatuses).default("scheduled"),
});

type AppointmentFormValues = z.input<typeof appointmentSchema>;

const clinicianOptions = [
  "Dr. Sarah Wong",
  "Dr. Lucas Patel",
  "Dr. Amir Rahman",
  "Nurse Practitioner Lim",
];

const visitTypes = [
  "Consultation",
  "Follow-up",
  "Procedure",
  "Routine Check",
  "Telehealth",
];

function combineDateTime(date: string, time: string): Date {
  const isoString = `${date}T${time}`;
  const combined = new Date(isoString);
  if (isNaN(combined.getTime())) {
    throw new Error("Invalid appointment date or time");
  }
  return combined;
}

type PatientOption = {
  id: string;
  name: string;
  contact?: string | null;
};

interface PatientComboboxProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  options: PatientOption[];
  placeholder?: string;
  disabled?: boolean;
}

const PatientCombobox = forwardRef<HTMLButtonElement, PatientComboboxProps>(function PatientCombobox(
  { value, onChange, onBlur, options, placeholder = "Search patient...", disabled },
  ref,
) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => options.find((option) => option.id === value), [options, value]);
  const isOpen = !disabled && open;

  return (
    <Popover open={isOpen} onOpenChange={(nextOpen) => setOpen(disabled ? false : nextOpen)}>
      <PopoverTrigger asChild>
        <Button
          ref={ref}
          variant="outline"
          role="combobox"
          aria-expanded={isOpen}
          disabled={disabled}
          className="w-full justify-between"
        >
          <span className="truncate">{selected ? selected.name : placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] max-h-[--radix-popover-content-available-height] p-0">
        <Command>
          <CommandInput placeholder="Search patient..." />
          <CommandList>
            <CommandEmpty>No patient found.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.id}
                  value={`${option.name} ${option.contact ?? ""}`.trim()}
                  onSelect={() => {
                    onChange(option.id);
                    onBlur?.();
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", selected?.id === option.id ? "opacity-100" : "opacity-0")} />
                  <div className="flex flex-col">
                    <span>{option.name}</span>
                    {option.contact ? (
                      <span className="text-xs text-muted-foreground">{option.contact}</span>
                    ) : null}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
});

export default function NewAppointmentForm() {
  const router = useRouter();
  const { toast } = useToast();
  const { loading: authLoading } = useMedplumAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const defaultScheduledAt = useMemo(() => new Date(Date.now() + 30 * 60 * 1000), []);

  const form = useForm<AppointmentFormValues>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: {
      patientId: "",
      scheduledDate: format(defaultScheduledAt, "yyyy-MM-dd"),
      scheduledTime: format(defaultScheduledAt, "HH:mm"),
      clinician: "",
      reason: "",
      visitType: "",
      notes: "",
      status: "scheduled",
    },
  });

  useEffect(() => {
    if (authLoading) {
      return;
    }

    async function loadPatients() {
      setLoadingPatients(true);
      setLoadError(null);
      try {
        // 🎯 LOAD FROM MEDPLUM (FHIR) - Source of Truth
        const data = await getAllPatients(200);
        console.log(`✅ Loaded ${data.length} patients from Medplum FHIR for appointment form`);
        
        const sorted = data
          .slice()
          .sort((a, b) => a.fullName.localeCompare(b.fullName));
        setPatients(sorted as any);
      } catch (error) {
        console.error("Failed to load patients from Medplum", error);
        const message =
          error instanceof Error ? error.message : "Unable to load patients from FHIR.";
        setLoadError(
          message.includes("Authentication required")
            ? `${message} Try refreshing the page.`
            : message
        );
      } finally {
        setLoadingPatients(false);
      }
    }

    loadPatients();
  }, [authLoading]);

  const patientOptions = useMemo(() => {
    return patients.map((patient) => ({
      id: patient.id,
      name: patient.fullName,
      contact: patient.phone,
    }));
  }, [patients]);

  const patientId = form.watch("patientId");
  const selectedPatient = useMemo(() => {
    return patientOptions.find((patient) => patient.id === patientId);
  }, [patientId, patientOptions]);

  const patientPlaceholder = useMemo(() => {
    if (loadingPatients) return "Loading patients...";
    if (patientOptions.length === 0) return "No patients found";
    return "Search patient...";
  }, [loadingPatients, patientOptions.length]);

  async function onSubmit(values: AppointmentFormValues) {
    try {
      const patient = patientOptions.find((option) => option.id === values.patientId);
      if (!patient) {
        toast({
          title: "Select a patient",
          description: "Please choose a patient for the appointment.",
          variant: "destructive",
        });
        return;
      }

      const scheduledAt = combineDateTime(values.scheduledDate, values.scheduledTime);

      // Map appointment status to FHIR status
      const fhirStatus = values.status === "scheduled" ? "booked" : 
                        values.status === "checked_in" ? "arrived" :
                        values.status === "completed" ? "fulfilled" :
                        values.status === "cancelled" ? "cancelled" :
                        values.status === "no_show" ? "noshow" : "booked";

      // 🎯 SAVE TO MEDPLUM (FHIR) - Source of Truth
      const appointmentId = await saveAppointment({
        patientId: patient.id,
        patientName: patient.name,
        patientContact: patient.contact || undefined,
        clinician: values.clinician,
        reason: values.reason,
        type: values.visitType,
        notes: values.notes,
        scheduledAt,
        status: fhirStatus as any,
        durationMinutes: 30,
      });

      console.log(`✅ Appointment saved to Medplum FHIR: ${appointmentId}`);

      toast({
        title: "Appointment scheduled",
        description: `${patient.name} booked with ${values.clinician} on ${scheduledAt.toLocaleString()} (FHIR)`,
      });

      router.push("/appointments");
      router.refresh();
    } catch (error: any) {
      console.error("Failed to create appointment", error);
      toast({
        title: "Unable to save appointment",
        description: error.message || "Please review the form and try again.",
        variant: "destructive",
      });
    }
  }

  return (
    <div className="container max-w-3xl py-6">
      <div className="mb-6">
        <Link href="/appointments" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to appointments
        </Link>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Schedule New Appointment</CardTitle>
          <CardDescription>Capture appointment details and confirm the booking.</CardDescription>
        </CardHeader>
        <CardContent>
          {loadError ? (
            <div className="rounded-md border border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive">
              {loadError}
            </div>
          ) : null}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-8">
              <div className="grid gap-6">
                <FormField
                  control={form.control}
                  name="patientId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Patient</FormLabel>
                      <FormControl>
                        <PatientCombobox
                          ref={field.ref}
                          value={field.value}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          options={patientOptions}
                          placeholder={patientPlaceholder}
                          disabled={loadingPatients || patientOptions.length === 0}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {selectedPatient ? (
                  <div className="rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">Selected patient</p>
                    <p>{selectedPatient.name}</p>
                    {selectedPatient.contact ? <p>Contact: {selectedPatient.contact}</p> : null}
                  </div>
                ) : null}

                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="scheduledDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" /> Date
                        </FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="scheduledTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" /> Time
                        </FormLabel>
                        <FormControl>
                          <Input type="time" step={300} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="clinician"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Stethoscope className="h-4 w-4 text-muted-foreground" /> Clinician
                        </FormLabel>
                        <FormControl>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select clinician" />
                            </SelectTrigger>
                            <SelectContent>
                              {clinicianOptions.map((clinician) => (
                                <SelectItem key={clinician} value={clinician}>
                                  {clinician}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="visitType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Visit type</FormLabel>
                        <FormControl>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select visit type" />
                            </SelectTrigger>
                            <SelectContent>
                              {visitTypes.map((type) => (
                                <SelectItem key={type} value={type}>
                                  {type}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="reason"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reason for visit</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. follow-up consultation" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <FormControl>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {appointmentStatuses.map((status) => (
                              <SelectItem key={status} value={status}>
                                {status.replace(/_/g, " ")}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes for clinical team</FormLabel>
                      <FormControl>
                        <Textarea rows={4} placeholder="Add any preparation instructions or notes" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex items-center justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => router.push("/appointments")}>Cancel</Button>
                <Button type="submit" disabled={form.formState.isSubmitting || loadingPatients || patientOptions.length === 0}>
                  {form.formState.isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Scheduling...
                    </>
                  ) : (
                    "Create appointment"
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
