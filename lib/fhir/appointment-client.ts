/**
 * Client-side wrapper for Appointment API (Medplum FHIR)
 */

export interface AppointmentInput {
  patientId: string;
  patientName: string;
  patientContact?: string;
  clinician: string;
  reason: string;
  type?: string;
  location?: string;
  notes?: string;
  status: 'proposed' | 'pending' | 'booked' | 'arrived' | 'fulfilled' | 'cancelled' | 'noshow';
  scheduledAt: Date | string;
  durationMinutes?: number;
}

export type FhirAppointmentStatus = 'proposed' | 'pending' | 'booked' | 'arrived' | 'fulfilled' | 'cancelled' | 'noshow';

export interface Appointment extends AppointmentInput {
  id: string;
  createdAt: Date;
}

/**
 * Save an appointment to Medplum
 */
export async function saveAppointment(appointment: AppointmentInput): Promise<string> {
  const response = await fetch('/api/appointments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(appointment),
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to save appointment');
  }

  return data.appointmentId;
}

/**
 * Get an appointment by ID
 */
export async function getAppointment(appointmentId: string): Promise<Appointment | null> {
  const response = await fetch(`/api/appointments?id=${appointmentId}`);
  const data = await response.json();

  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error(data.error || 'Failed to get appointment');
  }

  const appointment = data.appointment;
  return {
    ...appointment,
    scheduledAt: new Date(appointment.scheduledAt),
    createdAt: new Date(appointment.createdAt),
  };
}

/**
 * Get appointments for a patient
 */
export async function getPatientAppointments(patientId: string): Promise<Appointment[]> {
  const response = await fetch(`/api/appointments?patientId=${patientId}`);
  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to get appointments');
  }

  return data.appointments.map((a: any) => ({
    ...a,
    scheduledAt: new Date(a.scheduledAt),
    createdAt: new Date(a.createdAt),
  }));
}

/**
 * Update appointment status
 */
export async function updateAppointmentStatus(
  appointmentId: string,
  status: FhirAppointmentStatus
): Promise<void> {
  const response = await fetch('/api/appointments', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appointmentId, status }),
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to update appointment');
  }
}

/**
 * Reschedule an appointment to a new date-time.
 */
export async function rescheduleAppointment(
  appointmentId: string,
  scheduledAt: Date | string
): Promise<void> {
  const response = await fetch('/api/appointments', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      appointmentId,
      scheduledAt: scheduledAt instanceof Date ? scheduledAt.toISOString() : scheduledAt,
    }),
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to reschedule appointment');
  }
}







