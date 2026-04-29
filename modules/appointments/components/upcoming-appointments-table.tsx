"use client";

import { useState } from "react";
import Link from "next/link";
import { Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { updateAppointmentStatus } from "@/lib/fhir/appointment-client";

type AppointmentStatus = "scheduled" | "checked_in" | "completed" | "cancelled" | "no_show";

export interface UpcomingAppointment {
  id: string;
  patientId?: string;
  patientName: string;
  clinician: string;
  reason?: string;
  status: AppointmentStatus;
  scheduledAt: Date | string;
}

export function normalizeAppointmentStatus(status: string | undefined): AppointmentStatus {
  switch (status) {
    case "booked":
      return "scheduled";
    case "arrived":
      return "checked_in";
    case "fulfilled":
      return "completed";
    case "cancelled":
      return "cancelled";
    case "noshow":
      return "no_show";
    case "checked_in":
    case "scheduled":
    case "completed":
    case "no_show":
      return status;
    default:
      return "scheduled";
  }
}

export function formatDateTime(date: Date | string): { day: string; time: string } {
  const instance = date instanceof Date ? date : new Date(date);
  return {
    day: instance.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    }),
    time: instance.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}

const statusLabels: Record<AppointmentStatus, string> = {
  scheduled: "Scheduled",
  checked_in: "Checked in",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No show",
};

const statusVariants: Record<AppointmentStatus, "default" | "secondary" | "destructive" | "outline"> = {
  scheduled: "secondary",
  checked_in: "default",
  completed: "outline",
  cancelled: "destructive",
  no_show: "destructive",
};

interface Props {
  appointments: UpcomingAppointment[];
  loading?: boolean;
  onRefresh?: () => void | Promise<void>;
}

export default function UpcomingAppointmentsTable({ appointments, loading, onRefresh }: Props) {
  const { toast } = useToast();
  const [actionId, setActionId] = useState<string | null>(null);

  async function handleMarkArrived(appointment: UpcomingAppointment) {
    try {
      setActionId(appointment.id);
      await updateAppointmentStatus(appointment.id, "arrived");
      toast({
        title: "Patient marked as arrived",
        description: `${appointment.patientName} is now checked in.`,
      });
      await onRefresh?.();
    } catch (err: any) {
      console.error("Failed to mark as arrived", err);
      toast({
        title: "Unable to update appointment",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setActionId(null);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4 animate-pulse" /> Loading appointments...
        </CardContent>
      </Card>
    );
  }

  if (appointments.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          No upcoming appointments yet. Schedule one to see it listed here.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Patient</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Time</TableHead>
            <TableHead>Clinician</TableHead>
            <TableHead>Reason</TableHead>
            <TableHead className="w-px whitespace-nowrap">Status</TableHead>
            <TableHead className="w-px whitespace-nowrap text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {appointments.map((appointment) => {
            const { day, time } = formatDateTime(appointment.scheduledAt);
            return (
              <TableRow key={appointment.id}>
                <TableCell className="font-medium">
                  <Link href={`/appointments/${appointment.id}`} className="hover:underline">
                    {appointment.patientName}
                  </Link>
                </TableCell>
                <TableCell>{day}</TableCell>
                <TableCell>{time}</TableCell>
                <TableCell>{appointment.clinician || "N/A"}</TableCell>
                <TableCell className="max-w-[260px] truncate text-muted-foreground">
                  {appointment.reason || "Clinic visit"}
                </TableCell>
                <TableCell className="w-px whitespace-nowrap">
                  <Badge variant={statusVariants[appointment.status]}>
                    {statusLabels[appointment.status]}
                  </Badge>
                </TableCell>
                <TableCell className="w-px whitespace-nowrap">
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleMarkArrived(appointment)}
                      disabled={actionId === appointment.id || appointment.status !== "scheduled"}
                    >
                      Mark arrived
                    </Button>
                    <Button size="sm" variant="secondary" asChild>
                      <Link href={`/appointments/${appointment.id}`}>View</Link>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
