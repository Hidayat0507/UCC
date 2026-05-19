import type { Task } from "@medplum/fhirtypes";
import type { FollowUp } from "@/lib/fhir/communication-service";

export type UnifiedTaskKind =
  | "billing-exception"
  | "follow-up-due"
  | "follow-up-missing-phone"
  | "follow-up-failed";

export type UnifiedTaskSource = "billing" | "follow-up";
export type UnifiedTaskStatus = "requested" | "in-progress" | "completed" | "cancelled" | "blocked" | "failed" | "due";

export interface UnifiedTaskItem {
  id: string;
  source: UnifiedTaskSource;
  kind: UnifiedTaskKind;
  title: string;
  patient: string;
  patientId?: string;
  dueDate?: string;
  createdAt?: string;
  status: UnifiedTaskStatus;
  description?: string;
  actionHref?: string;
  reference?: string;
  providerError?: string;
}

function getExtensionString(task: Task, url: string): string {
  return task.extension?.find((item) => item.url === url)?.valueString || "";
}

function getBillingConsultationId(task: Task): string {
  return getExtensionString(task, "https://ucc.emr/task/consultation-id");
}

function getBillingErrorClass(task: Task): string {
  return getExtensionString(task, "https://ucc.emr/task/error-class");
}

export function mapBillingTaskToUnifiedTask(task: Task): UnifiedTaskItem {
  const status = (task.status || "requested") as UnifiedTaskStatus;
  const consultationId = getBillingConsultationId(task);
  return {
    id: task.id || "",
    source: "billing",
    kind: "billing-exception",
    title: "Billing exception",
    patient: task.for?.display || task.for?.reference || "-",
    patientId: task.for?.reference?.replace("Patient/", ""),
    dueDate: task.executionPeriod?.end,
    createdAt: task.authoredOn || task.meta?.lastUpdated,
    status,
    description: task.description || getBillingErrorClass(task),
    reference: consultationId || task.focus?.reference,
  };
}

function isCompletedFollowUp(followUp: FollowUp): boolean {
  return followUp.status === "completed" || followUp.deliveryStatus === "completed" || followUp.deliveryStatus === "delivered";
}

function getFollowUpDueTime(followUp: FollowUp): number {
  if (!followUp.dueDate) {
    return followUp.type === "review-request" ? 0 : Number.POSITIVE_INFINITY;
  }
  const due = new Date(followUp.dueDate).getTime();
  return Number.isFinite(due) ? due : Number.POSITIVE_INFINITY;
}

export function isFollowUpReminderTask(followUp: FollowUp, now = new Date()): boolean {
  if (isCompletedFollowUp(followUp)) return false;
  if (!followUp.patientPhone) return true;
  if (followUp.deliveryStatus === "failed") return true;
  return getFollowUpDueTime(followUp) <= now.getTime();
}

export function mapFollowUpToReminderTask(followUp: FollowUp, now = new Date()): UnifiedTaskItem | null {
  if (!isFollowUpReminderTask(followUp, now)) return null;

  const missingPhone = !followUp.patientPhone;
  const failed = followUp.deliveryStatus === "failed";
  const due = getFollowUpDueTime(followUp) <= now.getTime();
  const typeLabel = followUp.type === "appointment-reminder" ? "appointment reminder" : "review request";
  const kind: UnifiedTaskKind = failed
    ? "follow-up-failed"
    : missingPhone
      ? "follow-up-missing-phone"
      : "follow-up-due";
  const status: UnifiedTaskStatus = failed ? "failed" : missingPhone ? "blocked" : "due";
  const title = failed
    ? `Review failed ${typeLabel}`
    : missingPhone
      ? `Add phone for ${typeLabel}`
      : `Send ${typeLabel}`;

  return {
    id: followUp.id,
    source: "follow-up",
    kind,
    title,
    patient: followUp.patientName || followUp.patientId || "-",
    patientId: followUp.patientId || undefined,
    dueDate: followUp.dueDate,
    createdAt: followUp.createdAt,
    status,
    description: failed
      ? followUp.twilioError || "WhatsApp delivery failed."
      : missingPhone
        ? "Patient phone number is missing."
        : due
          ? followUp.message
          : undefined,
    actionHref: "/follow-up",
    reference: followUp.sourceId ? `${followUp.sourceType || "source"}:${followUp.sourceId}` : undefined,
    providerError: followUp.twilioError || undefined,
  };
}

export function mapFollowUpsToReminderTasks(followUps: FollowUp[], now = new Date()): UnifiedTaskItem[] {
  return followUps
    .map((followUp) => mapFollowUpToReminderTask(followUp, now))
    .filter((item): item is UnifiedTaskItem => Boolean(item));
}

export function sortUnifiedTasks(tasks: UnifiedTaskItem[]): UnifiedTaskItem[] {
  return [...tasks].sort((a, b) => {
    const aDue = a.dueDate ? new Date(a.dueDate).getTime() : 0;
    const bDue = b.dueDate ? new Date(b.dueDate).getTime() : 0;
    const aTime = Number.isFinite(aDue) ? aDue : 0;
    const bTime = Number.isFinite(bDue) ? bDue : 0;
    if (aTime !== bTime) return aTime - bTime;
    const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bCreated - aCreated;
  });
}
