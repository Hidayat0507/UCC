import { describe, expect, it } from "bun:test";
import type { FollowUp } from "../../lib/fhir/communication-service";
import {
  mapFollowUpToReminderTask,
  mapFollowUpsToReminderTasks,
} from "../../lib/fhir/task-reminder-service";

function followUp(overrides: Partial<FollowUp> = {}): FollowUp {
  return {
    id: "fu-1",
    patientId: "pat-1",
    patientName: "Aina",
    patientPhone: "0123456789",
    type: "appointment-reminder",
    message: "Reminder message",
    status: "preparation",
    deliveryMode: "manual",
    deliveryStatus: "pending",
    channel: "whatsapp",
    createdAt: "2026-05-18T00:00:00.000Z",
    clinicId: "clinic-1",
    ...overrides,
  };
}

describe("task-reminder-service", () => {
  const now = new Date("2026-05-19T00:00:00.000Z");

  it("maps due follow-ups into task reminders", () => {
    const task = mapFollowUpToReminderTask(
      followUp({ dueDate: "2026-05-18T23:00:00.000Z" }),
      now
    );
    expect(task?.source).toBe("follow-up");
    expect(task?.kind).toBe("follow-up-due");
    expect(task?.status).toBe("due");
    expect(task?.actionHref).toBe("/follow-up");
  });

  it("excludes future appointment reminders", () => {
    const task = mapFollowUpToReminderTask(
      followUp({ dueDate: "2026-05-20T00:00:00.000Z" }),
      now
    );
    expect(task).toBeNull();
  });

  it("shows missing phone follow-ups even before due", () => {
    const task = mapFollowUpToReminderTask(
      followUp({ patientPhone: "", dueDate: "2026-05-20T00:00:00.000Z" }),
      now
    );
    expect(task?.kind).toBe("follow-up-missing-phone");
    expect(task?.status).toBe("blocked");
  });

  it("shows failed Twilio follow-ups", () => {
    const task = mapFollowUpToReminderTask(
      followUp({ deliveryMode: "twilio", deliveryStatus: "failed", twilioError: "Template rejected" }),
      now
    );
    expect(task?.kind).toBe("follow-up-failed");
    expect(task?.description).toContain("Template rejected");
  });

  it("treats review requests without due date as due now", () => {
    const tasks = mapFollowUpsToReminderTasks([
      followUp({ id: "review-1", type: "review-request", dueDate: undefined }),
      followUp({ id: "appointment-1", type: "appointment-reminder", dueDate: undefined }),
    ], now);

    expect(tasks.map((task) => task.id)).toEqual(["review-1"]);
  });
});
