import { describe, expect, it } from "bun:test";
import {
  buildAppointmentReminderMessage,
  buildReviewRequestMessage,
  buildWhatsAppUrl,
  normalizeWhatsAppPhone,
  renderFollowUpTemplate,
} from "../../lib/fhir/communication-service";

describe("follow-up communication helpers", () => {
  it("normalizes Malaysian WhatsApp phone numbers", () => {
    expect(normalizeWhatsAppPhone("012-345 6789")).toBe("60123456789");
    expect(normalizeWhatsAppPhone("+6012 345 6789")).toBe("60123456789");
    expect(normalizeWhatsAppPhone("0060123456789")).toBe("60123456789");
  });

  it("builds encoded wa.me URLs", () => {
    expect(buildWhatsAppUrl("0123456789", "Hi A & B")).toBe(
      "https://wa.me/60123456789?text=Hi%20A%20%26%20B"
    );
  });

  it("renders configured templates", () => {
    expect(
      renderFollowUpTemplate("Hi {{ patientName }}, review: {{reviewUrl}} {{missing}}", {
        patientName: "Aina",
        reviewUrl: "https://example.com/review",
      })
    ).toBe("Hi Aina, review: https://example.com/review ");
  });

  it("builds default review and appointment messages", () => {
    expect(buildReviewRequestMessage("Aina", "https://example.com/review")).toContain("Aina");
    expect(
      buildAppointmentReminderMessage({
        patientName: "Aina",
        appointmentDate: "2026-05-20T02:30:00.000Z",
        clinicName: "Klinik Puteri",
      })
    ).toContain("Klinik Puteri");
  });

  it("builds a review request message even when no review URL is configured", () => {
    const message = buildReviewRequestMessage("Aina", "", "Hi {{ patientName }}, review: {{ reviewUrl }}");

    expect(message).toContain("Aina");
    expect(message).toContain("Google review");
    expect(message).not.toContain("{{reviewUrl}}");
  });
});
