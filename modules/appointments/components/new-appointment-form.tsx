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

const CLINICIANS = [
  "Dr. Sarah Wong",
  "Dr. Lucas Patel",
  "Dr. Amir Rahman",
  "Nurse Practitioner Lim",
];

const VISIT_TYPES = [
  "Consultation",
  "Follow-up",
  "Procedure",
  "Routine Check",
  "Telehealth",
];

const formSchema = z.object({
  patientId: z.string({ required_error: "Patient is required" }).min(1, "Patient is required"),
  scheduledDate: z.string({ required_error: "Date is required" }).min(1, "Date is required"),
  scheduledTime: z.string({ required_error: "Time is required" }).min(1, "Time is required"),
  clinician: z.string({ required_error: "Clinician is required" }).min(1, "Clinician is required"),
  reason: z.string({ required_error: "Reason is required" }).min(3, "Please describe the visit reason"),
  visitType: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.input<typeof formSchema>;

type PatientOption = { id: string; name: string; contact?: string | null };

const PatientCombobox = forwardRef<
  HTMLButtonElement,
  {
    value: string;
    onChange: (value: string) => void;
    onBlur?: () => void;
    options: PatientOption[];
    placeholder?: string;
    disabled?: boolean;
  }
>(function PatientCombobox({ value, onChange, onBlur, options, placeholder = "Search patient...", disabled }, ref) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => options.find((o) => o.id === value), [options, value]);
  const isOpen = !disabled && open;

  return (
    <Popover open={isOpen} onOpenChange={(next) => setOpen(disabled ? false : next)}>
      <PopoverTrigger asChild>
        <Button ref={ref} variant="outline" role="combobox" aria-expanded={isOpen} disabled={disabled} className="w-full justify-between">
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
              {options.map((opt) => (
                <CommandItem
                  key={opt.id}
                  value={`${opt.name} ${opt.contact ?? ""}`.trim()}
                  onSelect={() => { onChange(opt.id); onBlur?.(); setOpen(false); }}
                >
                  <Check className={cn("mr-2 h-4 w-4", selected?.id === opt.id ? "opacity-100" : "opacity-0")} />
                  <div className="flex flex-col">
                    <span>{opt.name}</span>
                    {opt.contact ? <span className="text-xs text-muted-foreground">{opt.contact}</span> : null}
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
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      patientId: "",
      scheduledDate: format(new Date(), "yyyy-MM-dd"),
      scheduledTime: format(new Date(), "HH:mm"),
      clinician: "",
      reason: "",
      visitType: "",
      notes: "",
    },
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadingPatients(true);
      setLoadError(null);
      try {
        const data = await getAllPatients(200);
        if (!cancelled) setPatients(data.slice().sort((a, b) => a.fullName.localeCompare(b.fullName)) as Patient[]);
      } catch {
        if (!cancelled) setLoadError("Unable to load patients. Please refresh the page.");
      } finally {
        if (!cancelled) setLoadingPatients(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const patientOptions = useMemo<PatientOption[]>(
    () => patients.map((p) => ({ id: p.id, name: p.fullName, contact: p.phone })),
    [patients],
  );

  const patientId = form.watch("patientId");
  const selectedPatient = useMemo(() => patientOptions.find((p) => p.id === patientId), [patientId, patientOptions]);

  const patientPlaceholder = loadingPatients
    ? "Loading patients..."
    : patientOptions.length === 0
      ? "No patients found"
      : "Search patient...";

  async function onSubmit(values: FormValues) {
    try {
      const patient = patientOptions.find((o) => o.id === values.patientId);
      if (!patient) {
        toast({ title: "Select a patient", description: "Please choose a patient.", variant: "destructive" });
        return;
      }

      const scheduledAt = new Date(`${values.scheduledDate}T${values.scheduledTime}`);
      if (isNaN(scheduledAt.getTime())) throw new Error("Invalid date or time");

      await saveAppointment({
        patientId: patient.id,
        patientName: patient.name,
        patientContact: patient.contact || undefined,
        clinician: values.clinician,
        reason: values.reason,
        type: values.visitType,
        notes: values.notes,
        scheduledAt,
        status: "scheduled",
        durationMinutes: 30,
      });

      toast({
        title: "Appointment scheduled",
        description: `${patient.name} booked with ${values.clinician} on ${scheduledAt.toLocaleString()}`,
      });

      router.push("/appointments");
      router.refresh();
    } catch (error: any) {
      console.error("Failed to create appointment", error);
      toast({ title: "Unable to save", description: error.message || "Please try again.", variant: "destructive" });
    }
  }

  return (
    <div className="container max-w-3xl py-6">
      <div className="mb-6">
        <Link href="/appointments" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to appointments
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Schedule New Appointment</CardTitle>
          <CardDescription>Capture appointment details and confirm the booking.</CardDescription>
        </CardHeader>
        <CardContent>
          {loadError ? (
            <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive">{loadError}</div>
          ) : null}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                <div className="rounded-md border bg-muted/40 p-3 text-sm">
                  <p className="font-medium">{selectedPatient.name}</p>
                  {selectedPatient.contact ? <p className="text-muted-foreground">Contact: {selectedPatient.contact}</p> : null}
                </div>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="scheduledDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground" /> Date</FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="scheduledTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground" /> Time</FormLabel>
                      <FormControl><Input type="time" step={300} {...field} /></FormControl>
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
                      <FormLabel className="flex items-center gap-2"><Stethoscope className="h-4 w-4 text-muted-foreground" /> Clinician</FormLabel>
                      <FormControl>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger><SelectValue placeholder="Select clinician" /></SelectTrigger>
                          <SelectContent>
                            {CLINICIANS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
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
                          <SelectTrigger><SelectValue placeholder="Select visit type" /></SelectTrigger>
                          <SelectContent>
                            {VISIT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
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
                    <FormControl><Input placeholder="e.g. follow-up consultation" {...field} /></FormControl>
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
                    <FormControl><Textarea rows={3} placeholder="Preparation instructions or notes" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => router.push("/appointments")}>Cancel</Button>
                <Button type="submit" disabled={form.formState.isSubmitting || loadingPatients || patientOptions.length === 0}>
                  {form.formState.isSubmitting ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Scheduling...</>
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
