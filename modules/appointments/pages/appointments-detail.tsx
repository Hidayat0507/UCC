import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  Phone,
  UserRound,
  FileText,
  ClipboardList,
} from "lucide-react";

import { getAppointmentById } from "@/lib/models";
import { formatDisplayDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import AppointmentStatusForm from "../components/status-form";

const statusLabels = {
  scheduled: "Scheduled",
  checked_in: "Checked in",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No show",
} as const;

const statusDescriptions = {
  scheduled: "Awaiting patient arrival",
  checked_in: "Patient has arrived and is waiting",
  in_progress: "Clinical team is currently seeing the patient",
  completed: "Visit completed and documented",
  cancelled: "Cancelled by clinic or patient",
  no_show: "Patient did not attend",
} as const;

const badgeVariants = {
  scheduled: "secondary",
  checked_in: "default",
  in_progress: "default",
  completed: "outline",
  cancelled: "destructive",
  no_show: "destructive",
} as const satisfies Record<keyof typeof statusLabels, "default" | "secondary" | "outline" | "destructive">;

function formatTime(date: Date | string | null | undefined) {
  if (!date) return "-";
  const value = date instanceof Date ? date : new Date(date);
  return value.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function formatDateTime(date: Date | string | null | undefined) {
  if (!date) return "-";
  const value = date instanceof Date ? date : new Date(date);
  return value.toLocaleString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type PageProps = {
  params: { id: string };
};

export default async function AppointmentDetailsPage({ params }: PageProps) {
  const { id } = params;
  const appointment = await getAppointmentById(id);

  if (!appointment) {
    notFound();
  }

  const scheduledAt = appointment.scheduledAt instanceof Date
    ? appointment.scheduledAt
    : new Date(appointment.scheduledAt ?? "");

  const checkInTime = appointment.checkInTime ?? null;
  const completedAt = appointment.completedAt ?? null;
  const cancelledAt = appointment.cancelledAt ?? null;

  return (
    <div className="container max-w-4xl space-y-8 py-6">
      <div className="flex items-center justify-between">
        <Link href="/appointments" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to appointments
        </Link>
        <Badge variant={badgeVariants[appointment.status]}>{statusLabels[appointment.status]}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-col gap-1 text-2xl font-semibold">
            {appointment.patientName}
            <span className="text-base font-normal text-muted-foreground">{appointment.reason || "Clinic visit"}</span>
          </CardTitle>
          <CardDescription>
            Scheduled with {appointment.clinician} on {formatDateTime(scheduledAt)}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4 text-sm">
            <div className="flex items-start gap-3">
              <Calendar className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <div>
                <p className="font-medium">Visit date</p>
                <p className="text-muted-foreground">{formatDisplayDate(scheduledAt)}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Clock className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <div>
                <p className="font-medium">Time & duration</p>
                <p className="text-muted-foreground">
                  {formatTime(scheduledAt)} • {appointment.durationMinutes ? `${appointment.durationMinutes} minutes` : "Duration not set"}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <UserRound className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <div>
                <p className="font-medium">Clinician</p>
                <p className="text-muted-foreground">{appointment.clinician}</p>
              </div>
            </div>
            {appointment.location ? (
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="font-medium">Location</p>
                  <p className="text-muted-foreground">{appointment.location}</p>
                </div>
              </div>
            ) : null}
            {appointment.patientContact ? (
              <div className="flex items-start gap-3">
                <Phone className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="font-medium">Contact</p>
                  <p className="text-muted-foreground">{appointment.patientContact}</p>
                </div>
              </div>
            ) : null}
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Status summary</p>
              <p className="mt-1 text-sm">{statusDescriptions[appointment.status]}</p>
            </div>
            <div className="rounded-md border p-4 text-sm">
              <p className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-muted-foreground" />
                Visit checkpoints
              </p>
              <dl className="mt-3 space-y-2 text-muted-foreground">
                <div className="flex items-center justify-between">
                  <dt>Scheduled</dt>
                  <dd>{formatDateTime(scheduledAt)}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt>Checked in</dt>
                  <dd>{formatDateTime(checkInTime)}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt>Completed</dt>
                  <dd>{formatDateTime(completedAt)}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt>Cancelled</dt>
                  <dd>{formatDateTime(cancelledAt)}</dd>
                </div>
              </dl>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Update status</p>
              <div className="mt-2">
                <AppointmentStatusForm
                  appointmentId={appointment.id}
                  currentStatus={appointment.status}
                  hasCheckIn={!!checkInTime}
                  hasCompleted={!!completedAt}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-4 w-4 text-muted-foreground" />
            Additional notes
          </CardTitle>
          <CardDescription>Share handover or preparation notes with the care team.</CardDescription>
        </CardHeader>
        <CardContent>
          {appointment.notes ? (
            <p className="rounded-md bg-muted p-4 text-sm leading-relaxed text-muted-foreground">{appointment.notes}</p>
          ) : (
            <p className="text-sm text-muted-foreground">No notes recorded.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
