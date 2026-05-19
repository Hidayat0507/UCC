import type { MedplumClient } from "@medplum/core";
import type { Appointment, Communication, Extension, Patient } from "@medplum/fhirtypes";
import { env } from "@/lib/env";

const FOLLOW_UP_CATEGORY_SYSTEM = "https://ucc.emr/communication-category";
const FOLLOW_UP_SOURCE_IDENTIFIER_SYSTEM = "https://ucc.emr/follow-up/source";
const CLINIC_ID_EXTENSION_URL = "https://ucc.emr/communication/clinic-id";
const DUE_DATE_EXTENSION_URL = "https://ucc.emr/communication/due-date";
const PATIENT_NAME_EXTENSION_URL = "https://ucc.emr/communication/patient-name";
const PATIENT_PHONE_EXTENSION_URL = "https://ucc.emr/communication/patient-phone";
const CHANNEL_EXTENSION_URL = "https://ucc.emr/communication/channel";
const DELIVERY_MODE_EXTENSION_URL = "https://ucc.emr/communication/delivery-mode";
const DELIVERY_STATUS_EXTENSION_URL = "https://ucc.emr/communication/delivery-status";
const TEMPLATE_KEY_EXTENSION_URL = "https://ucc.emr/communication/template-key";
const SOURCE_TYPE_EXTENSION_URL = "https://ucc.emr/communication/source-type";
const SOURCE_ID_EXTENSION_URL = "https://ucc.emr/communication/source-id";
const OPENED_AT_EXTENSION_URL = "https://ucc.emr/communication/opened-at";
const SENT_CONFIRMED_AT_EXTENSION_URL = "https://ucc.emr/communication/sent-confirmed-at";
const TWILIO_MESSAGE_SID_EXTENSION_URL = "https://ucc.emr/communication/twilio-message-sid";
const TWILIO_ERROR_EXTENSION_URL = "https://ucc.emr/communication/twilio-error";
const WHATSAPP_DELIVERY_MODE_EXTENSION_URL = "https://ucc.emr/organization/whatsapp-delivery-mode";
const FOLLOW_UP_REVIEW_URL_EXTENSION_URL = "https://ucc.emr/organization/follow-up-review-url";
const FOLLOW_UP_REVIEW_TEMPLATE_EXTENSION_URL = "https://ucc.emr/organization/follow-up-review-template";
const FOLLOW_UP_APPOINTMENT_TEMPLATE_EXTENSION_URL = "https://ucc.emr/organization/follow-up-appointment-template";
const FOLLOW_UP_TWILIO_REVIEW_CONTENT_SID_EXTENSION_URL = "https://ucc.emr/organization/follow-up-twilio-review-content-sid";
const FOLLOW_UP_TWILIO_APPOINTMENT_CONTENT_SID_EXTENSION_URL = "https://ucc.emr/organization/follow-up-twilio-appointment-content-sid";

export type FollowUpType = "review-request" | "appointment-reminder";
export type FollowUpStatus = "preparation" | "in-progress" | "completed" | "stopped";
export type FollowUpDeliveryMode = "manual" | "twilio";
export type FollowUpDeliveryStatus =
  | "pending"
  | "opened"
  | "queued"
  | "sent"
  | "delivered"
  | "failed"
  | "completed";
export type FollowUpTemplateKey = "google-review-request" | "appointment-reminder";
export type FollowUpSourceType = "checkout" | "appointment" | "manual";

export interface CreateFollowUpInput {
  patientId?: string;
  patientName: string;
  patientPhone?: string;
  clinicId: string;
  type: FollowUpType;
  message: string;
  dueDate?: string;
  deliveryMode?: FollowUpDeliveryMode;
  templateKey?: FollowUpTemplateKey;
  sourceType?: FollowUpSourceType;
  sourceId?: string;
}

export interface FollowUp {
  id: string;
  patientId: string;
  patientName: string;
  patientPhone: string;
  type: FollowUpType;
  message: string;
  dueDate?: string;
  status: FollowUpStatus;
  deliveryMode: FollowUpDeliveryMode;
  deliveryStatus: FollowUpDeliveryStatus;
  templateKey?: FollowUpTemplateKey;
  sourceType?: FollowUpSourceType;
  sourceId?: string;
  channel: "whatsapp";
  whatsappUrl?: string;
  openedAt?: string;
  sentConfirmedAt?: string;
  twilioMessageSid?: string;
  twilioError?: string;
  createdAt: string;
  clinicId: string;
}

export interface FollowUpSettings {
  deliveryMode: FollowUpDeliveryMode;
  googleReviewUrl: string;
  reviewTemplate: string;
  appointmentTemplate: string;
  twilioReviewContentSid: string;
  twilioAppointmentContentSid: string;
}

export const DEFAULT_REVIEW_TEMPLATE =
  "Hi {{patientName}}, thank you for visiting us today. We would really appreciate it if you could leave us a Google review: {{reviewUrl}}";

export const DEFAULT_APPOINTMENT_TEMPLATE =
  "Hi {{patientName}}, this is a reminder for your appointment{{clinicSuffix}} on {{appointmentDate}}. Please reply or call us if you need to change your appointment.";

export function normalizeWhatsAppPhone(value: string | undefined): string {
  const raw = (value || "").trim();
  if (!raw) return "";
  const digits = raw.replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "");
  if (digits.startsWith("+")) return digits.slice(1);
  if (digits.startsWith("00")) return digits.slice(2);
  if (digits.startsWith("0")) return `60${digits.slice(1)}`;
  return digits;
}

export function buildWhatsAppUrl(phone: string | undefined, message: string): string | undefined {
  const normalizedPhone = normalizeWhatsAppPhone(phone);
  if (!normalizedPhone) return undefined;
  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
}

export function buildReviewRequestMessage(patientName: string, reviewUrl: string): string {
  return renderFollowUpTemplate(DEFAULT_REVIEW_TEMPLATE, {
    patientName: patientName.trim() || "there",
    reviewUrl,
  });
}

export function buildAppointmentReminderMessage(input: {
  patientName: string;
  appointmentDate: string | Date;
  clinicName?: string;
  template?: string;
}): string {
  const name = input.patientName.trim() || "there";
  const date = input.appointmentDate instanceof Date ? input.appointmentDate : new Date(input.appointmentDate);
  const formatted = Number.isNaN(date.getTime())
    ? String(input.appointmentDate)
    : date.toLocaleString("en-MY", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
  const clinicSuffix = input.clinicName?.trim() ? ` at ${input.clinicName.trim()}` : "";
  return renderFollowUpTemplate(input.template || DEFAULT_APPOINTMENT_TEMPLATE, {
    patientName: name,
    appointmentDate: formatted,
    clinicName: input.clinicName?.trim() || "",
    clinicSuffix,
  });
}

export function renderFollowUpTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => values[key] ?? "");
}

export function getFollowUpClinicId(comm: Communication): string {
  return comm.extension?.find((e) => e.url === CLINIC_ID_EXTENSION_URL)?.valueString ?? "";
}

function getExtensionString(comm: Communication, url: string): string {
  return comm.extension?.find((e) => e.url === url)?.valueString ?? "";
}

function getExtensionDateTime(comm: Communication, url: string): string | undefined {
  return comm.extension?.find((e) => e.url === url)?.valueDateTime ?? undefined;
}

function sourceIdentifierValue(sourceType: FollowUpSourceType, sourceId: string): string {
  return `${sourceType}:${sourceId}`;
}

function mapCommunicationToFollowUp(comm: Communication): FollowUp {
  const type = (comm.category?.[0]?.coding?.[0]?.code ?? "review-request") as FollowUpType;
  const status = (comm.status ?? "preparation") as FollowUpStatus;
  const patientName =
    getExtensionString(comm, PATIENT_NAME_EXTENSION_URL) || comm.subject?.display || "";
  const patientId = comm.subject?.reference?.replace("Patient/", "") ?? "";
  const patientPhone = getExtensionString(comm, PATIENT_PHONE_EXTENSION_URL);
  const message = comm.payload?.[0]?.contentString ?? "";
  const dueDate = getExtensionDateTime(comm, DUE_DATE_EXTENSION_URL);
  const clinicId = getExtensionString(comm, CLINIC_ID_EXTENSION_URL);
  const deliveryMode = (getExtensionString(comm, DELIVERY_MODE_EXTENSION_URL) || "manual") as FollowUpDeliveryMode;
  const deliveryStatus = (getExtensionString(comm, DELIVERY_STATUS_EXTENSION_URL) ||
    (status === "completed" ? "completed" : "pending")) as FollowUpDeliveryStatus;
  const templateKey = getExtensionString(comm, TEMPLATE_KEY_EXTENSION_URL) as FollowUpTemplateKey | "";
  const sourceType = getExtensionString(comm, SOURCE_TYPE_EXTENSION_URL) as FollowUpSourceType | "";
  const sourceId = getExtensionString(comm, SOURCE_ID_EXTENSION_URL);
  const createdAt = comm.meta?.lastUpdated ?? new Date().toISOString();

  return {
    id: comm.id!,
    patientId,
    patientName,
    patientPhone,
    type,
    message,
    dueDate,
    status,
    deliveryMode,
    deliveryStatus,
    templateKey: templateKey || undefined,
    sourceType: sourceType || undefined,
    sourceId: sourceId || undefined,
    channel: "whatsapp",
    whatsappUrl: buildWhatsAppUrl(patientPhone, message),
    openedAt: getExtensionDateTime(comm, OPENED_AT_EXTENSION_URL),
    sentConfirmedAt: getExtensionDateTime(comm, SENT_CONFIRMED_AT_EXTENSION_URL),
    twilioMessageSid: getExtensionString(comm, TWILIO_MESSAGE_SID_EXTENSION_URL),
    twilioError: getExtensionString(comm, TWILIO_ERROR_EXTENSION_URL),
    createdAt,
    clinicId,
  };
}

function stringExt(url: string, value: string | undefined): Extension[] {
  return value ? [{ url, valueString: value }] : [];
}

function dateTimeExt(url: string, value: string | undefined): Extension[] {
  return value ? [{ url, valueDateTime: value }] : [];
}

function replaceExtensions(existing: Extension[] | undefined, updates: Extension[]): Extension[] {
  const updateUrls = new Set(updates.map((ext) => ext.url));
  return [...(existing ?? []).filter((ext) => !updateUrls.has(ext.url)), ...updates];
}

async function findExistingFollowUpBySource(
  medplum: MedplumClient,
  sourceType: FollowUpSourceType | undefined,
  sourceId: string | undefined
): Promise<Communication | undefined> {
  if (!sourceType || !sourceId) return undefined;
  const results = await medplum.searchResources("Communication", {
    identifier: `${FOLLOW_UP_SOURCE_IDENTIFIER_SYSTEM}|${sourceIdentifierValue(sourceType, sourceId)}`,
    _count: "1",
  });
  return results?.[0] as Communication | undefined;
}

export async function resolveClinicWhatsAppDeliveryMode(
  medplum: MedplumClient,
  clinicId?: string
): Promise<FollowUpDeliveryMode> {
  const settings = await getFollowUpSettings(medplum, clinicId);
  return settings.deliveryMode;
}

function getOrgExtensionString(org: { extension?: Extension[] } | null | undefined, url: string): string {
  return org?.extension?.find((e) => e.url === url)?.valueString ?? "";
}

export async function getFollowUpSettings(
  medplum: MedplumClient,
  clinicId?: string
): Promise<FollowUpSettings> {
  let org: { extension?: Extension[] } | null = null;
  if (clinicId) {
    try {
      org = await medplum.readResource("Organization", clinicId);
    } catch {
      // Clinic settings are optional for v1; default below.
    }
  }
  const deliveryMode = getOrgExtensionString(org, WHATSAPP_DELIVERY_MODE_EXTENSION_URL);
  return {
    deliveryMode: deliveryMode === "twilio" ? "twilio" : env.FOLLOW_UP_DELIVERY_MODE === "twilio" ? "twilio" : "manual",
    googleReviewUrl: getOrgExtensionString(org, FOLLOW_UP_REVIEW_URL_EXTENSION_URL) || env.GOOGLE_REVIEW_URL || "",
    reviewTemplate: getOrgExtensionString(org, FOLLOW_UP_REVIEW_TEMPLATE_EXTENSION_URL) || DEFAULT_REVIEW_TEMPLATE,
    appointmentTemplate: getOrgExtensionString(org, FOLLOW_UP_APPOINTMENT_TEMPLATE_EXTENSION_URL) || DEFAULT_APPOINTMENT_TEMPLATE,
    twilioReviewContentSid:
      getOrgExtensionString(org, FOLLOW_UP_TWILIO_REVIEW_CONTENT_SID_EXTENSION_URL) ||
      env.TWILIO_REVIEW_TEMPLATE_CONTENT_SID ||
      "",
    twilioAppointmentContentSid:
      getOrgExtensionString(org, FOLLOW_UP_TWILIO_APPOINTMENT_CONTENT_SID_EXTENSION_URL) ||
      env.TWILIO_APPOINTMENT_TEMPLATE_CONTENT_SID ||
      "",
  };
}

export async function updateFollowUpSettings(
  medplum: MedplumClient,
  clinicId: string,
  input: FollowUpSettings
): Promise<FollowUpSettings> {
  const org = await medplum.readResource("Organization", clinicId);
  const updated = await medplum.updateResource({
    ...org,
    extension: replaceExtensions(org.extension, [
      { url: WHATSAPP_DELIVERY_MODE_EXTENSION_URL, valueString: input.deliveryMode },
      { url: FOLLOW_UP_REVIEW_URL_EXTENSION_URL, valueString: input.googleReviewUrl },
      { url: FOLLOW_UP_REVIEW_TEMPLATE_EXTENSION_URL, valueString: input.reviewTemplate || DEFAULT_REVIEW_TEMPLATE },
      { url: FOLLOW_UP_APPOINTMENT_TEMPLATE_EXTENSION_URL, valueString: input.appointmentTemplate || DEFAULT_APPOINTMENT_TEMPLATE },
      { url: FOLLOW_UP_TWILIO_REVIEW_CONTENT_SID_EXTENSION_URL, valueString: input.twilioReviewContentSid },
      { url: FOLLOW_UP_TWILIO_APPOINTMENT_CONTENT_SID_EXTENSION_URL, valueString: input.twilioAppointmentContentSid },
    ]),
  });
  return getFollowUpSettings(medplum, updated.id);
}

export async function createFollowUp(
  medplum: MedplumClient,
  input: CreateFollowUpInput
): Promise<FollowUp> {
  const existing = await findExistingFollowUpBySource(medplum, input.sourceType, input.sourceId);
  if (existing) return mapCommunicationToFollowUp(existing);

  const deliveryMode = input.deliveryMode ?? await resolveClinicWhatsAppDeliveryMode(medplum, input.clinicId);
  const deliveryStatus: FollowUpDeliveryStatus = "pending";
  const identifiers = input.sourceType && input.sourceId
    ? [{ system: FOLLOW_UP_SOURCE_IDENTIFIER_SYSTEM, value: sourceIdentifierValue(input.sourceType, input.sourceId) }]
    : undefined;

  const comm: Communication = {
    resourceType: "Communication",
    status: "preparation",
    identifier: identifiers,
    category: [
      {
        coding: [
          {
            system: FOLLOW_UP_CATEGORY_SYSTEM,
            code: input.type,
            display: input.type === "review-request" ? "Review Request" : "Appointment Reminder",
          },
        ],
      },
    ],
    subject: {
      reference: input.patientId ? `Patient/${input.patientId}` : undefined,
      display: input.patientName,
    },
    payload: [{ contentString: input.message }],
    extension: [
      { url: CLINIC_ID_EXTENSION_URL, valueString: input.clinicId },
      { url: PATIENT_NAME_EXTENSION_URL, valueString: input.patientName },
      { url: CHANNEL_EXTENSION_URL, valueString: "whatsapp" },
      { url: DELIVERY_MODE_EXTENSION_URL, valueString: deliveryMode },
      { url: DELIVERY_STATUS_EXTENSION_URL, valueString: deliveryStatus },
      ...stringExt(PATIENT_PHONE_EXTENSION_URL, input.patientPhone),
      ...stringExt(TEMPLATE_KEY_EXTENSION_URL, input.templateKey),
      ...stringExt(SOURCE_TYPE_EXTENSION_URL, input.sourceType),
      ...stringExt(SOURCE_ID_EXTENSION_URL, input.sourceId),
      ...dateTimeExt(DUE_DATE_EXTENSION_URL, input.dueDate),
    ],
  };

  const saved = await medplum.createResource(comm);
  const followUp = mapCommunicationToFollowUp(saved as Communication);
  const dueAt = followUp.dueDate ? new Date(followUp.dueDate).getTime() : 0;
  const dueNow = !followUp.dueDate || (Number.isFinite(dueAt) && dueAt <= Date.now());
  if (followUp.deliveryMode === "twilio" && dueNow && followUp.patientPhone) {
    return sendFollowUpWithTwilio(medplum, followUp.id);
  }
  return followUp;
}

export async function getPatientFollowUps(
  medplum: MedplumClient,
  patientId: string
): Promise<FollowUp[]> {
  const results = await medplum.searchResources("Communication", {
    subject: `Patient/${patientId}`,
    _sort: "-_lastUpdated",
    _count: "100",
  });
  return (results as Communication[])
    .filter((c) => c.category?.[0]?.coding?.[0]?.system === FOLLOW_UP_CATEGORY_SYSTEM)
    .map(mapCommunicationToFollowUp);
}

export async function getAllFollowUps(
  medplum: MedplumClient,
  clinicId?: string
): Promise<FollowUp[]> {
  const results = await medplum.searchResources("Communication", {
    _sort: "-_lastUpdated",
    _count: "200",
  });
  const followUps = (results as Communication[])
    .filter((c) => c.category?.[0]?.coding?.[0]?.system === FOLLOW_UP_CATEGORY_SYSTEM)
    .map(mapCommunicationToFollowUp);
  if (!clinicId) return followUps;
  return followUps.filter((f) => f.clinicId === clinicId);
}

export async function updateFollowUpStatus(
  medplum: MedplumClient,
  id: string,
  status: FollowUpStatus
): Promise<FollowUp> {
  const comm = (await medplum.readResource("Communication", id)) as Communication;
  const updates: Extension[] = [
    {
      url: DELIVERY_STATUS_EXTENSION_URL,
      valueString: status === "completed" ? "completed" : status === "stopped" ? "failed" : "pending",
    },
  ];
  if (status === "completed") {
    updates.push({ url: SENT_CONFIRMED_AT_EXTENSION_URL, valueDateTime: new Date().toISOString() });
  }
  const updated = await medplum.updateResource({
    ...comm,
    status,
    ...(status === "completed" ? { sent: new Date().toISOString() } : {}),
    extension: replaceExtensions(comm.extension, updates),
  });
  return mapCommunicationToFollowUp(updated as Communication);
}

export async function markFollowUpOpened(
  medplum: MedplumClient,
  id: string
): Promise<FollowUp> {
  const comm = (await medplum.readResource("Communication", id)) as Communication;
  const updates: Extension[] = [
    { url: DELIVERY_STATUS_EXTENSION_URL, valueString: "opened" },
    { url: OPENED_AT_EXTENSION_URL, valueDateTime: new Date().toISOString() },
  ];
  const updated = await medplum.updateResource({
    ...comm,
    extension: replaceExtensions(comm.extension, updates),
  });
  return mapCommunicationToFollowUp(updated as Communication);
}

export async function updateTwilioDeliveryStatus(
  medplum: MedplumClient,
  messageSid: string,
  status: string,
  error?: string
): Promise<FollowUp | null> {
  const results = await medplum.searchResources("Communication", {
    _count: "20",
    _sort: "-_lastUpdated",
  });
  const comm = (results as Communication[]).find(
    (candidate) => getExtensionString(candidate, TWILIO_MESSAGE_SID_EXTENSION_URL) === messageSid
  );
  if (!comm) return null;

  const normalized: FollowUpDeliveryStatus =
    status === "delivered" ? "delivered" :
    status === "sent" ? "sent" :
    status === "failed" || status === "undelivered" ? "failed" :
    "queued";
  const communicationStatus: FollowUpStatus =
    normalized === "delivered" ? "completed" :
    normalized === "failed" ? "stopped" :
    "in-progress";

  const updates: Extension[] = [
    { url: DELIVERY_STATUS_EXTENSION_URL, valueString: normalized },
    ...(error ? [{ url: TWILIO_ERROR_EXTENSION_URL, valueString: error }] : []),
  ];
  const updated = await medplum.updateResource({
    ...comm,
    status: communicationStatus,
    ...(communicationStatus === "completed" ? { sent: new Date().toISOString() } : {}),
    extension: replaceExtensions(comm.extension, updates),
  });
  return mapCommunicationToFollowUp(updated as Communication);
}

export async function deleteFollowUp(medplum: MedplumClient, id: string): Promise<void> {
  await medplum.deleteResource("Communication", id);
}

function getPatientPhone(patient: Patient): string {
  return patient.telecom?.find((telecom) => telecom.system === "phone")?.value || "";
}

function getPatientName(patient: Patient): string {
  const name = patient.name?.[0];
  return name?.text || [name?.given?.join(" "), name?.family].filter(Boolean).join(" ") || "Patient";
}

function getPatientParticipant(appointment: Appointment) {
  return appointment.participant?.find((participant) =>
    participant.actor?.reference?.startsWith("Patient/")
  );
}

export async function createReviewFollowUpForCheckout(
  medplum: MedplumClient,
  input: { clinicId: string; consultationId: string; patientId: string }
): Promise<FollowUp | null> {
  const settings = await getFollowUpSettings(medplum, input.clinicId);
  const reviewUrl = settings.googleReviewUrl;
  if (!reviewUrl) {
    console.warn("[follow-up] Google review URL is not configured; skipping review follow-up");
    return null;
  }
  const patient = await medplum.readResource("Patient", input.patientId) as Patient;
  const patientName = getPatientName(patient);
  return createFollowUp(medplum, {
    clinicId: input.clinicId,
    patientId: input.patientId,
    patientName,
    patientPhone: getPatientPhone(patient),
    type: "review-request",
    templateKey: "google-review-request",
    sourceType: "checkout",
    sourceId: input.consultationId,
    message: renderFollowUpTemplate(settings.reviewTemplate || DEFAULT_REVIEW_TEMPLATE, {
      patientName: patientName || "there",
      reviewUrl,
    }),
  });
}

export async function createAppointmentReminderFollowUp(
  medplum: MedplumClient,
  input: { clinicId: string; appointmentId: string }
): Promise<FollowUp | null> {
  const appointment = await medplum.readResource("Appointment", input.appointmentId) as Appointment;
  if (!appointment.start) return null;
  const patientParticipant = getPatientParticipant(appointment);
  const patientId = patientParticipant?.actor?.reference?.replace("Patient/", "");
  if (!patientId) return null;

  const [patient, organization] = await Promise.all([
    medplum.readResource("Patient", patientId) as Promise<Patient>,
    medplum.readResource("Organization", input.clinicId).catch(() => null),
  ]);
  const settings = await getFollowUpSettings(medplum, input.clinicId);
  const patientName = getPatientName(patient) || patientParticipant?.actor?.display || "Patient";
  const due = new Date(appointment.start);
  due.setDate(due.getDate() - 1);

  return createFollowUp(medplum, {
    clinicId: input.clinicId,
    patientId,
    patientName,
    patientPhone: getPatientPhone(patient),
    type: "appointment-reminder",
    templateKey: "appointment-reminder",
    sourceType: "appointment",
    sourceId: input.appointmentId,
    dueDate: due.toISOString(),
    message: buildAppointmentReminderMessage({
      patientName,
      appointmentDate: appointment.start,
      clinicName: organization?.name,
      template: settings.appointmentTemplate,
    }),
  });
}

async function postTwilioMessage(params: {
  to: string;
  message: string;
  templateKey?: FollowUpTemplateKey;
  contentSid?: string;
}): Promise<{ sid: string; status: string }> {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_WHATSAPP_FROM) {
    throw new Error("Twilio WhatsApp is not configured");
  }

  const body = new URLSearchParams({
    From: env.TWILIO_WHATSAPP_FROM.startsWith("whatsapp:")
      ? env.TWILIO_WHATSAPP_FROM
      : `whatsapp:${env.TWILIO_WHATSAPP_FROM}`,
    To: `whatsapp:+${normalizeWhatsAppPhone(params.to)}`,
    Body: params.message,
  });
  if (env.TWILIO_STATUS_CALLBACK_URL) {
    body.set("StatusCallback", env.TWILIO_STATUS_CALLBACK_URL);
  }
  const contentSid = params.contentSid ||
    (params.templateKey === "google-review-request"
      ? env.TWILIO_REVIEW_TEMPLATE_CONTENT_SID
      : params.templateKey === "appointment-reminder"
        ? env.TWILIO_APPOINTMENT_TEMPLATE_CONTENT_SID
        : undefined);
  if (contentSid) {
    body.delete("Body");
    body.set("ContentSid", contentSid);
    body.set("ContentVariables", "{}");
  }

  const auth = Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString("base64");
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    }
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || "Twilio send failed");
  }
  return { sid: String(payload.sid || ""), status: String(payload.status || "queued") };
}

export async function sendFollowUpWithTwilio(medplum: MedplumClient, id: string): Promise<FollowUp> {
  const comm = await medplum.readResource("Communication", id) as Communication;
  const followUp = mapCommunicationToFollowUp(comm);
  if (!followUp.patientPhone) throw new Error("Patient phone is required");
  const settings = await getFollowUpSettings(medplum, followUp.clinicId);

  try {
    const result = await postTwilioMessage({
      to: followUp.patientPhone,
      message: followUp.message,
      templateKey: followUp.templateKey,
      contentSid:
        followUp.templateKey === "google-review-request"
          ? settings.twilioReviewContentSid
          : followUp.templateKey === "appointment-reminder"
            ? settings.twilioAppointmentContentSid
            : undefined,
    });
    const updated = await medplum.updateResource({
      ...comm,
      status: "in-progress",
      extension: replaceExtensions(comm.extension, [
        { url: DELIVERY_STATUS_EXTENSION_URL, valueString: "queued" },
        { url: TWILIO_MESSAGE_SID_EXTENSION_URL, valueString: result.sid },
      ]),
    });
    return mapCommunicationToFollowUp(updated as Communication);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Twilio send failed";
    const updated = await medplum.updateResource({
      ...comm,
      status: "stopped",
      extension: replaceExtensions(comm.extension, [
        { url: DELIVERY_STATUS_EXTENSION_URL, valueString: "failed" },
        { url: TWILIO_ERROR_EXTENSION_URL, valueString: message },
      ]),
    });
    return mapCommunicationToFollowUp(updated as Communication);
  }
}
