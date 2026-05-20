export interface SchedulingSchedule {
  id: string;
  practitionerId: string;
  practitionerName: string;
}

export interface SchedulingSlot {
  id: string;
  scheduleId: string;
  practitionerId: string;
  practitionerName: string;
  status: "free" | "busy" | "busy-unavailable" | "busy-tentative" | "entered-in-error";
  start: string;
  end: string;
}

async function readJson(response: Response): Promise<Record<string, any>> {
  try {
    return (await response.json()) as Record<string, any>;
  } catch {
    return {};
  }
}

export async function ensureSchedule(practitionerId: string, practitionerName?: string): Promise<SchedulingSchedule> {
  const response = await fetch("/api/scheduling/schedules", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ practitionerId, practitionerName }),
  });

  const data = await readJson(response);
  if (!response.ok || !data.success) {
    throw new Error(data.error || "Failed to ensure schedule");
  }

  return data.schedule as SchedulingSchedule;
}

export async function generateSlots(payload: {
  practitionerId: string;
  practitionerName?: string;
  start: string;
  end: string;
  durationMinutes?: number;
}): Promise<{ scheduleId: string; created: number; existing: number }> {
  const response = await fetch("/api/scheduling/slots/generate", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await readJson(response);
  if (!response.ok || !data.success) {
    throw new Error(data.error || "Failed to generate slots");
  }

  return {
    scheduleId: data.scheduleId as string,
    created: Number(data.created || 0),
    existing: Number(data.existing || 0),
  };
}

export async function getFreeSlots(practitionerId: string, start: string, end: string): Promise<SchedulingSlot[]> {
  const query = new URLSearchParams({
    practitionerId,
    start,
    end,
    status: "free",
  }).toString();

  const response = await fetch(`/api/scheduling/slots?${query}`, {
    credentials: "include",
  });
  const data = await readJson(response);
  if (!response.ok || !data.success) {
    throw new Error(data.error || "Failed to fetch slots");
  }
  return (data.slots || []) as SchedulingSlot[];
}

export async function bookSlot(payload: {
  slotId: string;
  patientId: string;
  reason: string;
  clinicianDisplayOverride?: string;
  reminderDaysBefore?: number;
}): Promise<{ appointmentId: string; slotId: string }> {
  const response = await fetch("/api/scheduling/book", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await readJson(response);
  if (!response.ok || !data.success) {
    throw new Error(data.error || "Failed to book slot");
  }
  return {
    appointmentId: String(data.appointmentId || ""),
    slotId: String(data.slotId || ""),
  };
}

export async function manualBookAppointment(payload: {
  patientId: string;
  practitionerId: string;
  practitionerName?: string;
  scheduledAt: Date | string;
  durationMinutes: number;
  reason: string;
  type?: string;
  notes?: string;
  reminderDaysBefore?: number;
}): Promise<{ appointmentId: string; slotId: string }> {
  const response = await fetch("/api/scheduling/manual-book", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...payload,
      scheduledAt:
        payload.scheduledAt instanceof Date
          ? payload.scheduledAt.toISOString()
          : payload.scheduledAt,
    }),
  });
  const data = await readJson(response);
  if (!response.ok || !data.success) {
    throw new Error(data.error || "Failed to book appointment");
  }
  return {
    appointmentId: String(data.appointmentId || ""),
    slotId: String(data.slotId || ""),
  };
}
