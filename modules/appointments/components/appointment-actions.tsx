"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { rescheduleAppointment, updateAppointmentStatus } from "@/lib/fhir/appointment-client";

type Props = {
  appointmentId: string;
  patientName: string;
  scheduledAt: Date | string;
};

function toDateTimeLocalValue(date: Date | string): string {
  const instance = date instanceof Date ? date : new Date(date);
  const pad = (value: number) => value.toString().padStart(2, "0");
  return [
    instance.getFullYear(),
    pad(instance.getMonth() + 1),
    pad(instance.getDate()),
  ].join("-") + `T${pad(instance.getHours())}:${pad(instance.getMinutes())}`;
}

export default function AppointmentActions({ appointmentId, patientName, scheduledAt }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleValue, setRescheduleValue] = useState(() => toDateTimeLocalValue(scheduledAt));

  const handleReschedule = () => {
    startTransition(async () => {
      try {
        const nextSlot = new Date(rescheduleValue);
        await rescheduleAppointment(appointmentId, nextSlot);
        toast({
          title: "Appointment rescheduled",
          description: `${patientName} moved to ${nextSlot.toLocaleString()}.`,
        });
        setRescheduleOpen(false);
        router.refresh();
      } catch (error: any) {
        console.error("Failed to reschedule appointment", error);
        toast({
          title: "Unable to reschedule",
          description: error?.message || "Please try again.",
          variant: "destructive",
        });
      }
    });
  };

  const handleCancel = () => {
    startTransition(async () => {
      try {
        await updateAppointmentStatus(appointmentId, "cancelled");
        toast({
          title: "Appointment cancelled",
          description: `${patientName}'s appointment has been cancelled.`,
        });
        router.refresh();
      } catch (error: any) {
        console.error("Failed to cancel appointment", error);
        toast({
          title: "Unable to cancel appointment",
          description: error?.message || "Please try again.",
          variant: "destructive",
        });
      }
    });
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Dialog open={rescheduleOpen} onOpenChange={setRescheduleOpen}>
        <DialogTrigger asChild>
          <Button type="button" variant="outline" disabled={isPending}>
            Reschedule
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reschedule appointment</DialogTitle>
            <DialogDescription>Choose the new appointment date and time.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="appointment-time">Date and time</Label>
            <Input
              id="appointment-time"
              type="datetime-local"
              value={rescheduleValue}
              onChange={(event) => setRescheduleValue(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRescheduleOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleReschedule} disabled={!rescheduleValue || isPending}>
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button type="button" variant="outline" disabled={isPending}>
            Cancel appointment
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel appointment?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark {patientName}&apos;s appointment as cancelled. It will remain in the record for audit history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep appointment</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel}>
              Cancel appointment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
