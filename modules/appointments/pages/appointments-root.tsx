"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import UpcomingAppointmentsTable, { normalizeAppointmentStatus } from "@/modules/appointments/components/upcoming-appointments-table";

type AppointmentStatus = "scheduled" | "checked_in" | "completed" | "cancelled" | "no_show";

interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  patientContact?: string;
  clinician: string;
  reason: string;
  type?: string;
  location?: string;
  notes?: string;
  status: AppointmentStatus;
  scheduledAt: Date | string;
  durationMinutes?: number;
  createdAt: Date | string;
}

const activeStatuses: AppointmentStatus[] = ["scheduled", "checked_in"];

async function getAppointments(): Promise<Appointment[]> {
  const response = await fetch("/api/appointments", { credentials: "include" });
  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error || "Failed to load appointments");
  }

  return (data.appointments ?? []).map((appointment: any) => ({
    ...appointment,
    status: normalizeAppointmentStatus(appointment.status),
    scheduledAt: appointment.scheduledAt ? new Date(appointment.scheduledAt) : new Date(),
    createdAt: appointment.createdAt ? new Date(appointment.createdAt) : new Date(),
  }));
}

export default function AppointmentsRootPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadAppointments(cancelled);
    return () => {
      cancelled = true;
    };
  }, []);

  async function loadAppointments(cancelled = false) {
    setError(null);
    setLoading(true);
    try {
      const data = await getAppointments();
      if (!cancelled) {
        setAppointments(data);
      }
    } catch (err) {
      console.error("Failed to load appointments", err);
      if (!cancelled) {
        setError("Unable to load appointments right now. Please try again.");
      }
    } finally {
      if (!cancelled) {
        setLoading(false);
      }
    }
  }

  const now = useMemo(() => new Date(), []);

  const upcomingAppointments = useMemo(() => {
    return appointments
      .filter((appointment) => {
        if (!appointment.scheduledAt) return false;
        const scheduled = appointment.scheduledAt instanceof Date ? appointment.scheduledAt : new Date(appointment.scheduledAt);
        return scheduled.getTime() >= now.getTime() && activeStatuses.includes(appointment.status);
      })
      .sort((a, b) => {
        const aTime = new Date(a.scheduledAt as any).getTime();
        const bTime = new Date(b.scheduledAt as any).getTime();
        return aTime - bTime;
      });
  }, [appointments, now]);

  const todaysAppointments = useMemo(() => {
    return upcomingAppointments.filter((appointment) => {
      const scheduled = appointment.scheduledAt instanceof Date ? appointment.scheduledAt : new Date(appointment.scheduledAt);
      const today = new Date();
      return (
        scheduled.getFullYear() === today.getFullYear() &&
        scheduled.getMonth() === today.getMonth() &&
        scheduled.getDate() === today.getDate()
      );
    });
  }, [upcomingAppointments]);

  const statusCounts = useMemo(() => {
    return appointments.reduce(
      (acc, appointment) => {
        acc.total++;
        acc[appointment.status] = (acc[appointment.status] ?? 0) + 1;
        return acc;
      },
      {
        total: 0,
        scheduled: 0,
        checked_in: 0,
        completed: 0,
        cancelled: 0,
        no_show: 0,
      } as Record<AppointmentStatus | "total", number>
    );
  }, [appointments]);

  return (
    <div className="space-y-8">
      <header className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Appointments</h1>
          <p className="text-muted-foreground">Manage patient bookings and keep track of upcoming visits.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/appointments/new">New appointment</Link>
          </Button>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total appointments</CardTitle>
            <CardDescription>Across all statuses</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statusCounts.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Upcoming today</CardTitle>
            <CardDescription>Remaining for today</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todaysAppointments.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active bookings</CardTitle>
            <CardDescription>Scheduled and in-progress</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statusCounts.scheduled + statusCounts.checked_in}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Completed this week</CardTitle>
            <CardDescription>Marked as done</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statusCounts.completed}</div>
          </CardContent>
        </Card>
      </section>

      {error ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Upcoming appointments</h2>
          <span className="text-sm text-muted-foreground">
            Showing {upcomingAppointments.length} upcoming
          </span>
        </div>

        <UpcomingAppointmentsTable
          appointments={upcomingAppointments}
          loading={loading}
          onRefresh={loadAppointments}
        />
      </section>
    </div>
  );
}
