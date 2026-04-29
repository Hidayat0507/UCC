"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { updateAppointmentStatus, type FhirAppointmentStatus } from "@/lib/fhir/appointment-client";

type AppointmentStatus = "scheduled" | "checked_in" | "completed" | "cancelled" | "no_show";

const statusOptions: AppointmentStatus[] = [
  "scheduled",
  "checked_in",
  "completed",
  "cancelled",
  "no_show",
];

const statusLabels: Record<AppointmentStatus, string> = {
  scheduled: "Scheduled",
  checked_in: "Checked in",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No show",
};

const fhirStatusMap: Record<AppointmentStatus, FhirAppointmentStatus> = {
  scheduled: "booked",
  checked_in: "arrived",
  completed: "fulfilled",
  cancelled: "cancelled",
  no_show: "noshow",
};

interface AppointmentStatusFormProps {
  appointmentId: string;
  currentStatus: AppointmentStatus;
}

export default function AppointmentStatusForm({
  appointmentId,
  currentStatus,
}: AppointmentStatusFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [selectedStatus, setSelectedStatus] = useState<AppointmentStatus>(currentStatus);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = () => {
    startTransition(async () => {
      try {
        await updateAppointmentStatus(appointmentId, fhirStatusMap[selectedStatus]);
        toast({ title: "Appointment updated", description: `Status set to ${statusLabels[selectedStatus]}.` });
        router.refresh();
      } catch (error) {
        console.error("Failed to update appointment", error);
        toast({
          title: "Unable to update",
          description: "Something went wrong while updating the appointment.",
          variant: "destructive",
        });
      }
    });
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <Select value={selectedStatus} onValueChange={(value) => setSelectedStatus(value as AppointmentStatus)}>
        <SelectTrigger className="w-full sm:w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {statusOptions.map((status) => (
            <SelectItem key={status} value={status}>
              {statusLabels[status]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button type="button" onClick={handleSubmit} disabled={isPending}>
        {isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Updating
          </>
        ) : (
          "Update status"
        )}
      </Button>
    </div>
  );
}
