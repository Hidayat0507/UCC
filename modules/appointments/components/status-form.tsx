"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { updateAppointment, type AppointmentStatus } from "@/lib/models";

const statusOptions: AppointmentStatus[] = [
  "scheduled",
  "in_progress",
  "checked_in",
  "completed",
  "cancelled",
  "no_show",
];

const statusLabels: Record<AppointmentStatus, string> = {
  scheduled: "Scheduled",
  in_progress: "In progress",
  checked_in: "Checked in",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No show",
};

interface AppointmentStatusFormProps {
  appointmentId: string;
  currentStatus: AppointmentStatus;
  hasCheckIn?: boolean;
  hasCompleted?: boolean;
}

export default function AppointmentStatusForm({
  appointmentId,
  currentStatus,
  hasCheckIn,
  hasCompleted,
}: AppointmentStatusFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [selectedStatus, setSelectedStatus] = useState<AppointmentStatus>(currentStatus);
  const [isPending, startTransition] = useTransition();

  const disabledOptions = useMemo(() => {
    const map: Partial<Record<AppointmentStatus, boolean>> = {};
    if (hasCompleted) {
      map.completed = true;
    }
    return map;
  }, [hasCompleted]);

  const handleSubmit = () => {
    startTransition(async () => {
      try {
        const updatePayload: Record<string, unknown> = {
          status: selectedStatus,
        };

        if (selectedStatus === "checked_in") {
          updatePayload.checkInTime = new Date();
        } else if (selectedStatus === "completed") {
          updatePayload.completedAt = new Date();
        } else if (selectedStatus === "cancelled" || selectedStatus === "no_show") {
          updatePayload.cancelledAt = new Date();
        } else if (selectedStatus === "scheduled") {
          updatePayload.checkInTime = null;
          updatePayload.completedAt = null;
          updatePayload.cancelledAt = null;
        }

        await updateAppointment(appointmentId, updatePayload as any);
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
            <SelectItem key={status} value={status} disabled={disabledOptions[status] ?? false}>
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
