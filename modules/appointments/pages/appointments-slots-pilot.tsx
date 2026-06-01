"use client";

import { forwardRef, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { ArrowLeft, Calendar, Check, ChevronsUpDown, Clock, Loader2, Stethoscope } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { useMedplumAuth } from "@/lib/auth-medplum";
import { getAllPatients, type Patient } from "@/lib/fhir/patient-client";
import { getAllPractitioners, type PractitionerOption } from "@/lib/fhir/practitioner-client";
import {
  generateSlots,
  getFreeSlots,
  manualBookAppointment,
  type SchedulingSlot,
} from "@/lib/fhir/scheduling-client";
import { cn } from "@/lib/utils";

const visitTypes = [
  "Consultation",
  "Follow up",
  "Procedure",
];

const DEFAULT_SLOT_DURATION_MINUTES = 30;

function buildDefaultScheduledAt(): Date {
  return new Date(Date.now() + 30 * 60 * 1000);
}

const appointmentSchema = z.object({
  patientId: z
    .string({ error: (issue) => (issue.input === undefined ? "Patient is required" : undefined) })
    .min(1, "Patient is required"),
  scheduledDate: z
    .string({ error: (issue) => (issue.input === undefined ? "Date is required" : undefined) })
    .min(1, "Date is required"),
  scheduledTime: z
    .string({ error: (issue) => (issue.input === undefined ? "Time is required" : undefined) })
    .min(1, "Time is required"),
  durationMinutes: z.string().min(1, "Duration is required"),
  practitionerId: z
    .string({ error: (issue) => (issue.input === undefined ? "Clinician is required" : undefined) })
    .min(1, "Clinician is required"),
  selectedSlotId: z.string().optional(),
  visitType: z.string().optional(),
  notes: z.string().optional(),
  reminderDaysBefore: z.string().default("1"),
}).refine(
  (data) => {
    try {
      const scheduledAt = combineDateTime(data.scheduledDate, data.scheduledTime);
      return scheduledAt.getTime() > Date.now();
    } catch {
      return true;
    }
  },
  {
    message: "Appointment date and time must be in the future",
    path: ["scheduledTime"],
  }
).refine(
  (data) => Number.isFinite(Number(data.durationMinutes)) && Number(data.durationMinutes) > 0,
  {
    message: "Duration must be a positive number",
    path: ["durationMinutes"],
  }
).refine(
  (data) => {
    const days = Number(data.reminderDaysBefore);
    return Number.isFinite(days) && Number.isInteger(days) && days >= 0 && days <= 30;
  },
  {
    message: "Reminder days must be a whole number from 0 to 30",
    path: ["reminderDaysBefore"],
  }
);

type AppointmentFormValues = z.input<typeof appointmentSchema>;

function combineDateTime(date: string, time: string): Date {
  const combined = new Date(`${date}T${time}`);
  if (isNaN(combined.getTime())) {
    throw new Error("Invalid appointment date or time");
  }
  return combined;
}

function dayWindow(date: string): { start: string; end: string } {
  const start = new Date(`${date}T09:00`);
  const end = new Date(`${date}T17:00`);
  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

function slotDurationMinutes(slot: SchedulingSlot): number {
  const start = new Date(slot.start).getTime();
  const end = new Date(slot.end).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 30;
  return Math.max(1, Math.round((end - start) / 60000));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type PatientOption = {
  id: string;
  name: string;
  contact?: string | null;
  nric?: string | null;
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
  ref
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
                  value={`${option.name} ${option.nric ?? ""} ${option.contact ?? ""}`.trim()}
                  onSelect={() => {
                    onChange(option.id);
                    onBlur?.();
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", selected?.id === option.id ? "opacity-100" : "opacity-0")} />
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate">{option.name}</span>
                    {[option.nric, option.contact].filter(Boolean).length > 0 ? (
                      <span className="truncate text-xs text-muted-foreground">
                        {[option.nric, option.contact].filter(Boolean).join(" - ")}
                      </span>
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

export default function AppointmentsSlotsPilotPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { loading: authLoading } = useMedplumAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [practitioners, setPractitioners] = useState<PractitionerOption[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [loadingPractitioners, setLoadingPractitioners] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [slots, setSlots] = useState<SchedulingSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotMessage, setSlotMessage] = useState<string | null>(null);
  const [defaultScheduledAt] = useState(() => buildDefaultScheduledAt());

  const form = useForm<AppointmentFormValues>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: {
      patientId: "",
      scheduledDate: format(defaultScheduledAt, "yyyy-MM-dd"),
      scheduledTime: format(defaultScheduledAt, "HH:mm"),
      durationMinutes: String(DEFAULT_SLOT_DURATION_MINUTES),
      practitionerId: "",
      selectedSlotId: "",
      visitType: "",
      notes: "",
      reminderDaysBefore: "1",
    },
  });

  useEffect(() => {
    if (authLoading) return;

    let cancelled = false;

    async function loadLookupData() {
      setLoadingPatients(true);
      setLoadingPractitioners(true);
      setLoadError(null);
      try {
        const [nextPatients, nextPractitioners] = await Promise.all([
          getAllPatients(200),
          getAllPractitioners(),
        ]);
        if (cancelled) return;
        setPatients(nextPatients.slice().sort((a, b) => a.fullName.localeCompare(b.fullName)));
        setPractitioners(nextPractitioners.slice().sort((a, b) => a.name.localeCompare(b.name)));
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "Failed to load patient and clinician lists";
        setLoadError(message.includes("Authentication required") ? `${message} Try refreshing the page.` : message);
      } finally {
        if (!cancelled) {
          setLoadingPatients(false);
          setLoadingPractitioners(false);
        }
      }
    }

    void loadLookupData();

    return () => {
      cancelled = true;
    };
  }, [authLoading]);

  const patientOptions = useMemo(
    () =>
      patients.map((patient) => ({
        id: patient.id,
        name: patient.fullName,
        contact: patient.phone,
        nric: patient.nric,
      })),
    [patients]
  );

  const practitionerMap = useMemo(() => {
    const map = new Map<string, string>();
    practitioners.forEach((practitioner) => map.set(practitioner.id, practitioner.name));
    return map;
  }, [practitioners]);

  const patientId = useWatch({ control: form.control, name: "patientId" });
  const practitionerId = useWatch({ control: form.control, name: "practitionerId" });
  const scheduledDate = useWatch({ control: form.control, name: "scheduledDate" });
  const selectedSlotId = useWatch({ control: form.control, name: "selectedSlotId" });
  const selectedPatient = useMemo(
    () => patientOptions.find((patient) => patient.id === patientId),
    [patientId, patientOptions]
  );

  const patientPlaceholder = useMemo(() => {
    if (loadingPatients) return "Loading patients...";
    if (patientOptions.length === 0) return "No patients found";
    return "Search patient...";
  }, [loadingPatients, patientOptions.length]);

  const slotReferenceTime = defaultScheduledAt.getTime() - 30 * 60 * 1000;
  const visibleSlots = useMemo(
    () => slots.filter((slot) => new Date(slot.start).getTime() > slotReferenceTime).slice(0, 16),
    [slotReferenceTime, slots]
  );

  useEffect(() => {
    queueMicrotask(() => {
      setSlots([]);
      setSlotMessage(null);
      form.setValue("selectedSlotId", "");
    });
  }, [form, practitionerId, scheduledDate]);

  async function handleLoadSlots() {
    const practitionerName = practitionerMap.get(practitionerId);
    if (!practitionerId || !practitionerName) {
      setSlotMessage("Select a clinician first.");
      return;
    }
    if (!scheduledDate) {
      setSlotMessage("Select a date first.");
      return;
    }

    const window = dayWindow(scheduledDate);
    setLoadingSlots(true);
    setSlotMessage(null);
    try {
      const generated = await generateSlots({
        practitionerId,
        practitionerName,
        start: window.start,
        end: window.end,
        durationMinutes: DEFAULT_SLOT_DURATION_MINUTES,
      });
      let nextSlots = await getFreeSlots(practitionerId, window.start, window.end);
      for (let attempt = 0; attempt < 4 && nextSlots.length === 0 && (generated.created > 0 || generated.existing > 0); attempt += 1) {
        await sleep(500);
        nextSlots = await getFreeSlots(practitionerId, window.start, window.end);
      }
      setSlots(nextSlots);
      setSlotMessage(nextSlots.length === 0 ? "No free slots for this day." : null);
    } catch (error) {
      setSlotMessage(error instanceof Error ? error.message : "Unable to load slots.");
    } finally {
      setLoadingSlots(false);
    }
  }

  function handleSelectSlot(slot: SchedulingSlot) {
    const start = new Date(slot.start);
    form.setValue("scheduledDate", format(start, "yyyy-MM-dd"), { shouldValidate: true });
    form.setValue("scheduledTime", format(start, "HH:mm"), { shouldValidate: true });
    form.setValue("durationMinutes", String(slotDurationMinutes(slot)), { shouldValidate: true });
    form.setValue("selectedSlotId", slot.id, { shouldValidate: true });
  }

  async function onSubmit(values: AppointmentFormValues) {
    try {
      const patient = patientOptions.find((option) => option.id === values.patientId);
      const practitionerName = practitionerMap.get(values.practitionerId);

      if (!patient || !practitionerName) {
        toast({
          title: "Missing booking details",
          description: "Select a patient and clinician before booking.",
          variant: "destructive",
        });
        return;
      }
      if (!values.selectedSlotId) {
        toast({
          title: "Select a slot",
          description: "Choose an available slot before creating the appointment.",
          variant: "destructive",
        });
        return;
      }

      const scheduledAt = combineDateTime(values.scheduledDate, values.scheduledTime);
      const result = await manualBookAppointment({
        patientId: patient.id,
        practitionerId: values.practitionerId,
        practitionerName,
        scheduledAt,
        durationMinutes: Number(values.durationMinutes),
        reason: values.visitType || "Clinic visit",
        type: values.visitType || undefined,
        notes: values.notes || undefined,
        reminderDaysBefore: Number(values.reminderDaysBefore),
      });

      toast({
        title: "Appointment scheduled",
        description: `${patient.name} booked with ${practitionerName} on ${scheduledAt.toLocaleString()}.`,
      });

      router.push(`/appointments/${result.appointmentId}`);
      router.refresh();
    } catch (error) {
      toast({
        title: "Unable to schedule appointment",
        description: error instanceof Error ? error.message : "Please review the form and try again.",
        variant: "destructive",
      });
    }
  }

  return (
    <div className="container max-w-3xl py-6">
      <div className="mb-6">
        <Link href="/appointments" className="inline-flex min-h-11 items-center text-sm text-muted-foreground hover:text-primary">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to appointments
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Schedule New Appointment</CardTitle>
          <CardDescription>Book a patient appointment with clinician availability checks.</CardDescription>
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
                    {[selectedPatient.nric, selectedPatient.contact].filter(Boolean).length > 0 ? (
                      <p>{[selectedPatient.nric, selectedPatient.contact].filter(Boolean).join(" - ")}</p>
                    ) : null}
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
                          <Input type="date" min={format(new Date(), "yyyy-MM-dd")} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="practitionerId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Stethoscope className="h-4 w-4 text-muted-foreground" /> Clinician
                        </FormLabel>
                        <FormControl>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger>
                              <SelectValue placeholder={loadingPractitioners ? "Loading clinicians..." : "Select clinician"} />
                            </SelectTrigger>
                            <SelectContent>
                              {practitioners.map((practitioner) => (
                                <SelectItem key={practitioner.id} value={practitioner.id}>
                                  {practitioner.name}
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

                <div className="rounded-md border bg-muted/20 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium">Available slots</p>
                      <p className="text-xs text-muted-foreground">
                        {scheduledDate ? format(new Date(`${scheduledDate}T00:00`), "PPP") : "Select a date"}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleLoadSlots}
                      disabled={loadingSlots || !practitionerId || !scheduledDate}
                    >
                      {loadingSlots ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Clock className="mr-2 h-4 w-4" />}
                      Check slots
                    </Button>
                  </div>

                  {slotMessage ? (
                    <p className="mt-3 text-sm text-muted-foreground">{slotMessage}</p>
                  ) : null}

                  {visibleSlots.length > 0 ? (
                    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {visibleSlots.map((slot) => {
                        const start = new Date(slot.start);
                        const slotTime = format(start, "HH:mm");
                        const selected = selectedSlotId === slot.id;
                        return (
                          <Button
                            key={slot.id}
                            type="button"
                            variant={selected ? "default" : "outline"}
                            aria-pressed={selected}
                            className={cn(
                              "h-10 border transition-colors hover:border-primary hover:bg-primary/10 hover:text-primary",
                              selected && "hover:bg-primary hover:text-primary-foreground"
                            )}
                            onClick={() => handleSelectSlot(slot)}
                          >
                            {slotTime}
                          </Button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Remarks</FormLabel>
                      <FormControl>
                        <Textarea rows={4} placeholder="Add any remarks" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="reminderDaysBefore"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reminder days before appointment</FormLabel>
                      <FormControl>
                        <Input type="number" min={0} max={30} step={1} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex items-center justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => router.push("/appointments")}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={
                    form.formState.isSubmitting ||
                    loadingPatients ||
                    loadingPractitioners ||
                    patientOptions.length === 0 ||
                    practitioners.length === 0
                  }
                >
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
