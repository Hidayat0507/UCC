"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const schema = z.object({
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

type FormValues = z.infer<typeof schema>;

interface Props {
  patient: any;
}

export default function EditPatientForm({ patient }: Props) {
  const { toast } = useToast();
  const router = useRouter();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: patient.fullName ?? "",
      nric: patient.nric ?? "",
      dateOfBirth: patient.dateOfBirth ?? "",
      gender: patient.gender ?? undefined,
      email: patient.email ?? "",
      phone: patient.phone ?? "",
      address: patient.address ?? "",
      postalCode: patient.postalCode ?? "",
      emergencyContact: {
        name: patient.emergencyContact?.name ?? "",
        relationship: patient.emergencyContact?.relationship ?? "",
        phone: patient.emergencyContact?.phone ?? "",
      },
      medicalHistory: {
        allergies: Array.isArray(patient.medicalHistory?.allergies)
          ? patient.medicalHistory.allergies.join(", ")
          : (patient.medicalHistory?.allergies ?? ""),
      },
    },
  });

  async function onSubmit(data: FormValues) {
    try {
      const res = await fetch('/api/patients', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: patient.id,
          fullName: data.fullName,
          nric: data.nric,
          dateOfBirth: data.dateOfBirth,
          gender: data.gender,
          email: data.email || undefined,
          phone: data.phone,
          address: data.address || "",
          postalCode: data.postalCode || undefined,
          emergencyContact: (data.emergencyContact?.name || data.emergencyContact?.phone)
            ? {
                name: data.emergencyContact.name || "",
                relationship: data.emergencyContact.relationship || "",
                phone: data.emergencyContact.phone || "",
              }
            : undefined,
          medicalHistory: {
            allergies: data.medicalHistory?.allergies?.split(',').map((s) => s.trim()).filter(Boolean) ?? [],
            conditions: patient.medicalHistory?.conditions ?? [],
            medications: patient.medicalHistory?.medications ?? [],
          },
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update patient');
      }

      toast({ title: "Saved", description: "Patient record updated." });
      router.push(`/patients/${patient.id}`);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  }

  async function onArchive() {
    try {
      const res = await fetch(`/api/patients?patientId=${patient.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to archive patient');
      }
      toast({ title: "Archived", description: "Patient has been archived." });
      router.push('/patients');
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  }

  return (
    <div className="container max-w-3xl py-6">
      <div className="mb-6">
        <Link
          href={`/patients/${patient.id}`}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Patient
        </Link>
      </div>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Edit Patient</h1>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm">Archive Patient</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Archive {patient.fullName}?</AlertDialogTitle>
              <AlertDialogDescription>
                This will deactivate the patient record. Their consultation history,
                labs, and documents are preserved and this action can be reversed.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={onArchive}>Archive</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="fullName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name *</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="nric" render={({ field }) => (
                  <FormItem>
                    <FormLabel>NRIC *</FormLabel>
                    <FormControl><Input placeholder="YYMMDD-SS-NNNN" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="dateOfBirth" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date of Birth</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="gender" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gender *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
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

              <div className="space-y-2">
                <h3 className="text-base font-medium">Contact Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="phone" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone *</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl><Input type="email" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="address" render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Address</FormLabel>
                      <FormControl><Textarea {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="postalCode" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Postal Code</FormLabel>
                      <FormControl><Input placeholder="12345" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-base font-medium">Emergency Contact</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="emergencyContact.name" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Name</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="emergencyContact.relationship" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Relationship</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="emergencyContact.phone" render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Contact Number</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-base font-medium">Medical History</h3>
                <FormField control={form.control} name="medicalHistory.allergies" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Allergies</FormLabel>
                    <FormControl><Textarea placeholder="Comma-separated list of allergies" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="outline" type="button" asChild>
                  <Link href={`/patients/${patient.id}`}>Cancel</Link>
                </Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? "Saving…" : "Save Changes"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
