"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type AppointmentStatus = "scheduled" | "checked_in" | "completed" | "cancelled" | "no_show";
export type ViewMode = "Month" | "Week" | "Day";

export interface CalendarAppointment {
  id: string;
  patientId: string;
  patientName: string;
  clinician: string;
  reason: string;
  status: AppointmentStatus;
  scheduledAt: Date | string;
}

const SLOT_START = 8;
const SLOT_END = 20;

const PILL_CLASSES: Record<AppointmentStatus, string> = {
  scheduled: "bg-indigo-50 text-indigo-900 border border-indigo-200",
  checked_in: "bg-blue-100 text-blue-800 border border-blue-400",
  completed: "bg-green-100 text-green-800 border border-green-400",
  cancelled: "bg-red-50 text-red-700 border border-dashed border-red-400 line-through opacity-75",
  no_show: "bg-red-100 text-red-900 border border-dashed border-red-600",
};

const DOT_CLASSES: Record<AppointmentStatus, string> = {
  scheduled: "bg-indigo-400",
  checked_in: "bg-blue-500",
  completed: "bg-green-500",
  cancelled: "bg-red-400",
  no_show: "bg-red-600",
};

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  scheduled: "Scheduled",
  checked_in: "Checked in",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No show",
};

const TODAY_BADGE_CLASSES: Record<AppointmentStatus, string> = {
  scheduled: "bg-indigo-50 text-indigo-900 border border-indigo-200 hover:bg-indigo-50",
  checked_in: "bg-blue-100 text-blue-800 border border-blue-400 hover:bg-blue-100",
  completed: "bg-green-100 text-green-800 border border-green-400 hover:bg-green-100",
  cancelled: "bg-red-50 text-red-700 border border-dashed border-red-400 opacity-75 hover:bg-red-50",
  no_show: "bg-red-100 text-red-900 border border-dashed border-red-600 hover:bg-red-100",
};

const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const LEGEND = [
  { status: "scheduled" as const, label: "Scheduled" },
  { status: "checked_in" as const, label: "Checked in" },
  { status: "completed" as const, label: "Completed" },
  { status: "cancelled" as const, label: "Cancelled" },
  { status: "no_show" as const, label: "No show" },
];

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function buildMonthGrid(year: number, month: number): { date: Date; isCurrentMonth: boolean }[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const leadingDays = firstDay.getDay();
  const cells: { date: Date; isCurrentMonth: boolean }[] = [];
  for (let i = leadingDays; i > 0; i--) {
    cells.push({ date: new Date(year, month, 1 - i), isCurrentMonth: false });
  }
  for (let d = 1; d <= lastDay.getDate(); d++) {
    cells.push({ date: new Date(year, month, d), isCurrentMonth: true });
  }
  const trailing = 42 - cells.length;
  for (let d = 1; d <= trailing; d++) {
    cells.push({ date: new Date(year, month + 1, d), isCurrentMonth: false });
  }
  return cells;
}

function buildWeekDays(anchorDate: Date): Date[] {
  const sunday = new Date(anchorDate);
  sunday.setDate(anchorDate.getDate() - anchorDate.getDay());
  sunday.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    return d;
  });
}

function buildTimeSlots(start: number, end: number): number[] {
  const slots: number[] = [];
  for (let h = start; h <= end; h++) slots.push(h);
  return slots;
}

function formatTime(date: Date | string): string {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function formatHour(hour: number): string {
  if (hour === 0) return "12 AM";
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return "12 PM";
  return `${hour - 12} PM`;
}

function getApptHour(appt: CalendarAppointment): number {
  const d = appt.scheduledAt instanceof Date ? appt.scheduledAt : new Date(appt.scheduledAt);
  return d.getHours();
}

function formatPanelTime(scheduledAt: Date | string, mode: ViewMode): string {
  const d = scheduledAt instanceof Date ? scheduledAt : new Date(scheduledAt);
  const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  if (mode === "Week") return `${WEEKDAYS_SHORT[d.getDay()]} ${time}`;
  return time;
}

interface Props {
  appointments: CalendarAppointment[];
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

export default function AppointmentsCalendarView({ appointments, viewMode, onViewModeChange }: Props) {
  const today = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => toDateKey(today), [today]);

  const [currentDate, setCurrentDate] = useState<Date>(
    () => new Date(today.getFullYear(), today.getMonth(), 1)
  );

  const prevViewModeRef = useRef<ViewMode>(viewMode);
  useEffect(() => {
    const prev = prevViewModeRef.current;
    if (prev === viewMode) return;
    prevViewModeRef.current = viewMode;
    queueMicrotask(() => {
      if (viewMode === "Month") {
        setCurrentDate((cd) => new Date(cd.getFullYear(), cd.getMonth(), 1));
      } else if (prev === "Month") {
        setCurrentDate(new Date(today));
      }
    });
  }, [viewMode, today]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthGrid = useMemo(() => buildMonthGrid(year, month), [year, month]);
  const weekDays = useMemo(() => buildWeekDays(currentDate), [currentDate]);
  const timeSlots = useMemo(() => buildTimeSlots(SLOT_START, SLOT_END), []);

  const appointmentsByDate = useMemo(() => {
    const map = new Map<string, CalendarAppointment[]>();
    for (const appt of appointments) {
      const d = appt.scheduledAt instanceof Date ? appt.scheduledAt : new Date(appt.scheduledAt);
      const key = toDateKey(d);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(appt);
    }
    return map;
  }, [appointments]);

  // Pre-computed values for Day view
  const currentDateKey = toDateKey(currentDate);
  const isCurrentDayToday = currentDateKey === todayKey;

  const currentDayAppts = useMemo(
    () =>
      (appointmentsByDate.get(currentDateKey) ?? []).slice().sort(
        (a, b) =>
          new Date(a.scheduledAt as string).getTime() -
          new Date(b.scheduledAt as string).getTime()
      ),
    [appointmentsByDate, currentDateKey]
  );

  const currentDayOutsideAppts = useMemo(
    () => currentDayAppts.filter((a) => getApptHour(a) < SLOT_START || getApptHour(a) > SLOT_END),
    [currentDayAppts]
  );

  // ── Navigation ──────────────────────────────────────────────────────────────

  function handlePrev() {
    if (viewMode === "Month") {
      setCurrentDate(new Date(year, month - 1, 1));
    } else if (viewMode === "Week") {
      const d = new Date(currentDate);
      d.setDate(d.getDate() - 7);
      setCurrentDate(d);
    } else {
      const d = new Date(currentDate);
      d.setDate(d.getDate() - 1);
      setCurrentDate(d);
    }
  }

  function handleNext() {
    if (viewMode === "Month") {
      setCurrentDate(new Date(year, month + 1, 1));
    } else if (viewMode === "Week") {
      const d = new Date(currentDate);
      d.setDate(d.getDate() + 7);
      setCurrentDate(d);
    } else {
      const d = new Date(currentDate);
      d.setDate(d.getDate() + 1);
      setCurrentDate(d);
    }
  }

  function handleToday() {
    if (viewMode === "Month") {
      setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1));
    } else {
      setCurrentDate(new Date(today));
    }
  }

  // ── Derived display values ──────────────────────────────────────────────────

  const headerLabel = useMemo(() => {
    if (viewMode === "Month") return `${MONTH_NAMES[month]} ${year}`;
    if (viewMode === "Week") {
      const first = weekDays[0];
      const last = weekDays[6];
      const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
      return `${fmt(first)} – ${fmt(last)}, ${last.getFullYear()}`;
    }
    return currentDate.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }, [viewMode, month, year, weekDays, currentDate]);

  const prevAriaLabel =
    viewMode === "Month" ? "Previous month" :
    viewMode === "Week"  ? "Previous week"  : "Previous day";

  const nextAriaLabel =
    viewMode === "Month" ? "Next month" :
    viewMode === "Week"  ? "Next week"  : "Next day";

  // ── Panel ───────────────────────────────────────────────────────────────────

  const panelTitle =
    viewMode === "Month" ? "Today's appointments" :
    viewMode === "Week"  ? "This week's appointments" :
    `Appointments for ${currentDate.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}`;

  const panelAppointments = useMemo(() => {
    let appts: CalendarAppointment[];
    if (viewMode === "Month") {
      appts = appointmentsByDate.get(todayKey) ?? [];
    } else if (viewMode === "Week") {
      appts = [];
      for (const day of weekDays) {
        appts.push(...(appointmentsByDate.get(toDateKey(day)) ?? []));
      }
    } else {
      appts = appointmentsByDate.get(currentDateKey) ?? [];
    }
    return appts.slice().sort(
      (a, b) =>
        new Date(a.scheduledAt as string).getTime() -
        new Date(b.scheduledAt as string).getTime()
    );
  }, [viewMode, appointmentsByDate, todayKey, weekDays, currentDateKey]);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* ── Header ── */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={handlePrev} aria-label={prevAriaLabel}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={handleToday}>
          Today
        </Button>
        <Button variant="outline" size="sm" onClick={handleNext} aria-label={nextAriaLabel}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <h2 className="ml-1 text-lg font-semibold">{headerLabel}</h2>
      </div>

      {/* ── Month View ── */}
      {viewMode === "Month" && (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="grid grid-cols-7 border-b border-border bg-muted/30">
            {WEEKDAYS_SHORT.map((day) => (
              <div key={day} className="py-2 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 bg-border/40" style={{ gridAutoRows: "minmax(8.5rem, auto)" }}>
            {monthGrid.map(({ date, isCurrentMonth }, idx) => {
              const key = toDateKey(date);
              const dayAppts = appointmentsByDate.get(key) ?? [];
              const isToday = key === todayKey;
              const visible = dayAppts.slice(0, 2);
              const overflow = dayAppts.length - visible.length;
              const isLastCol = idx % 7 === 6;
              const isLastRow = idx >= 35;
              return (
                <div
                  key={idx}
                  className={[
                    "flex min-h-[8.5rem] flex-col gap-2 bg-background p-2 align-top",
                    !isLastCol && "border-r border-border",
                    !isLastRow && "border-b border-border",
                    !isCurrentMonth && "bg-muted/15",
                  ].filter(Boolean).join(" ")}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      {WEEKDAYS_SHORT[date.getDay()]}
                    </div>
                    <span
                      className={[
                        "flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 text-xs font-semibold",
                        isToday
                          ? "bg-primary text-primary-foreground"
                          : isCurrentMonth
                            ? "text-foreground"
                            : "text-muted-foreground/55",
                      ].join(" ")}
                    >
                      {date.getDate()}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {visible.map((appt) => (
                      <Link
                        key={appt.id}
                        href={`/appointments/${appt.id}`}
                        title={`${appt.patientName} · ${formatTime(appt.scheduledAt)}`}
                        className={[
                          "flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[11px] font-medium leading-tight transition-opacity hover:opacity-80",
                          PILL_CLASSES[appt.status] ?? "bg-muted text-muted-foreground",
                        ].join(" ")}
                      >
                        <span className={["h-1.5 w-1.5 shrink-0 rounded-full", DOT_CLASSES[appt.status] ?? "bg-muted-foreground"].join(" ")} />
                        <span className="truncate">{formatTime(appt.scheduledAt)} {appt.patientName}</span>
                      </Link>
                    ))}
                    {overflow > 0 && (
                      <div className="px-1.5 text-[11px] font-medium text-muted-foreground">+{overflow} more</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Week View ── */}
      {viewMode === "Week" && (
        <div className="overflow-x-auto">
          <div className="min-w-[500px] overflow-hidden rounded-lg border border-border">
            <div className="grid grid-cols-7 divide-x divide-border">
              {weekDays.map((day, i) => {
                const key = toDateKey(day);
                const isToday = key === todayKey;
                const dayAppts = (appointmentsByDate.get(key) ?? []).slice().sort(
                  (a, b) =>
                    new Date(a.scheduledAt as string).getTime() -
                    new Date(b.scheduledAt as string).getTime()
                );
                return (
                  <div key={i} className="flex min-w-0 flex-col overflow-hidden">
                    {/* Day header */}
                    <div
                      className={[
                        "border-b border-border px-1 py-2 text-center",
                        isToday ? "bg-primary" : "bg-muted/40",
                      ].join(" ")}
                    >
                      <p
                        className={[
                          "text-[11px] font-medium uppercase tracking-wide",
                          isToday ? "text-primary-foreground/80" : "text-muted-foreground",
                        ].join(" ")}
                      >
                        {WEEKDAYS_SHORT[day.getDay()]}
                      </p>
                      <p
                        className={[
                          "mt-0.5 text-sm font-bold leading-none",
                          isToday ? "text-primary-foreground" : "text-foreground",
                        ].join(" ")}
                      >
                        {day.getDate()}
                      </p>
                    </div>
                    {/* Appointment list */}
                    <div className="flex flex-1 flex-col items-start gap-2 p-2" style={{ minHeight: "calc(100dvh - 370px)" }}>
                      {dayAppts.map((appt) => (
                        <Link
                          key={appt.id}
                          href={`/appointments/${appt.id}`}
                          title={`${appt.patientName} · ${formatTime(appt.scheduledAt)}`}
                          className={[
                            "flex w-full max-w-full items-center gap-1 overflow-hidden rounded px-1 py-0.5 text-[11px] font-medium leading-tight cursor-pointer hover:opacity-80",
                            PILL_CLASSES[appt.status] ?? "bg-muted text-muted-foreground",
                          ].join(" ")}
                        >
                          <span className={["h-1.5 w-1.5 shrink-0 rounded-full", DOT_CLASSES[appt.status] ?? "bg-muted-foreground"].join(" ")} />
                          <span className="truncate">{formatTime(appt.scheduledAt)} {appt.patientName}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Day View ── */}
      {viewMode === "Day" && (
        <div className="overflow-hidden rounded-lg border border-border">

          {/* Day header */}
          <div className="flex border-b border-border bg-muted/40">
            <div className="w-14 shrink-0 border-r border-border" />
            <div className={["flex-1 px-4 py-3", isCurrentDayToday && "bg-primary/5"].filter(Boolean).join(" ")}>
              <p className="text-sm font-semibold">
                {currentDate.toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </p>
              <p className="text-xs text-muted-foreground">
                {currentDayAppts.length === 0
                  ? "No appointments"
                  : `${currentDayAppts.length} appointment${currentDayAppts.length !== 1 ? "s" : ""}`}
              </p>
            </div>
          </div>

          {/* Time slot rows */}
          {timeSlots.map((slot, slotIdx) => {
            const slotAppts = currentDayAppts.filter((a) => getApptHour(a) === slot);
            const isLastSlot = slotIdx === timeSlots.length - 1 && currentDayOutsideAppts.length === 0;
            return (
              <div
                key={slot}
                className={["flex", !isLastSlot && "border-b border-border"].filter(Boolean).join(" ")}
                style={{ minHeight: "calc((100dvh - 460px) / 13)" }}
              >
                <div className="flex w-14 shrink-0 items-start justify-end border-r border-border px-2 pt-2">
                  <span className="text-[11px] text-muted-foreground">{formatHour(slot)}</span>
                </div>
                <div
                  className={[
                    "flex-1 space-y-1.5 px-3 py-1.5",
                    isCurrentDayToday && "bg-primary/5",
                  ].filter(Boolean).join(" ")}
                >
                  {slotAppts.map((appt) => (
                    <Link
                      key={appt.id}
                      href={`/appointments/${appt.id}`}
                      className={[
                        "block rounded-md px-2.5 py-2 cursor-pointer hover:opacity-80",
                        PILL_CLASSES[appt.status] ?? "bg-muted text-muted-foreground",
                      ].join(" ")}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className={["h-2 w-2 shrink-0 rounded-full", DOT_CLASSES[appt.status] ?? "bg-muted-foreground"].join(" ")} />
                          <span className="truncate text-sm font-medium">{appt.patientName}</span>
                        </div>
                        <Badge className={TODAY_BADGE_CLASSES[appt.status]}>
                          {STATUS_LABELS[appt.status]}
                        </Badge>
                      </div>
                      <div className="ml-4 mt-1 space-y-0.5 text-xs opacity-80">
                        <p>{formatTime(appt.scheduledAt)}{appt.reason ? ` · ${appt.reason}` : ""}</p>
                        {appt.clinician && <p className="opacity-75">{appt.clinician}</p>}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Outside-hours overflow */}
          {currentDayOutsideAppts.length > 0 && (
            <div className="flex border-t border-border bg-muted/20">
              <div className="flex w-14 shrink-0 items-center justify-end border-r border-border px-2 py-2">
                <span className="text-[11px] italic text-muted-foreground">Other</span>
              </div>
              <div className="flex-1 space-y-1.5 px-3 py-1.5">
                {currentDayOutsideAppts.map((appt) => (
                  <Link
                    key={appt.id}
                    href={`/appointments/${appt.id}`}
                    className={[
                      "block rounded-md px-2.5 py-2 cursor-pointer hover:opacity-80",
                      PILL_CLASSES[appt.status] ?? "bg-muted text-muted-foreground",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className={["h-2 w-2 shrink-0 rounded-full", DOT_CLASSES[appt.status] ?? "bg-muted-foreground"].join(" ")} />
                        <span className="truncate text-sm font-medium">{appt.patientName}</span>
                      </div>
                      <Badge className={TODAY_BADGE_CLASSES[appt.status]}>
                        {STATUS_LABELS[appt.status]}
                      </Badge>
                    </div>
                    <div className="ml-4 mt-1 space-y-0.5 text-xs opacity-80">
                      <p>{formatTime(appt.scheduledAt)}{appt.reason ? ` · ${appt.reason}` : ""}</p>
                      {appt.clinician && <p className="opacity-75">{appt.clinician}</p>}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Appointments panel ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{panelTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          {panelAppointments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No appointments.</p>
          ) : (
            <div className="divide-y divide-border">
              {panelAppointments.map((appt) => (
                <Link key={appt.id} href={`/appointments/${appt.id}`} className="flex items-center justify-between gap-4 py-2.5 cursor-pointer hover:opacity-80">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="w-20 shrink-0 text-sm font-medium tabular-nums text-muted-foreground">
                      {formatPanelTime(appt.scheduledAt, viewMode)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{appt.patientName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {appt.reason || "Clinic visit"} · {appt.clinician || "N/A"}
                      </p>
                    </div>
                  </div>
                  <Badge className={TODAY_BADGE_CLASSES[appt.status]}>
                    {STATUS_LABELS[appt.status] ?? appt.status}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Color legend ── */}
      <div className="flex flex-wrap gap-4">
        {LEGEND.map(({ status, label }) => (
          <div key={status} className="flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-sm ${PILL_CLASSES[status]}`} />
            <span className="text-xs text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>

    </div>
  );
}
