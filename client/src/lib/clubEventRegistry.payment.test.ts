import { beforeEach, describe, expect, it, vi } from "vitest";

const { authFetch } = vi.hoisted(() => ({ authFetch: vi.fn() }));

vi.mock("@/lib/apiFetch", () => ({ authFetch }));

import {
  fetchRsvpPaymentStatuses,
  updateRsvpPaymentStatus,
} from "./clubEventRegistry";

describe("manual RSVP payment status transport", () => {
  beforeEach(() => authFetch.mockReset());

  it("fetches private status records from the manager-only endpoint", async () => {
    authFetch.mockResolvedValue(new Response(JSON.stringify([
      { userId: "player-1", paymentStatus: "confirmed", paymentUpdatedAt: "2026-08-25T12:00:00.000Z", paymentUpdatedBy: "owner-1" },
    ]), { status: 200 }));

    await expect(fetchRsvpPaymentStatuses("club-1", "event-1")).resolves.toEqual([
      { userId: "player-1", paymentStatus: "confirmed", paymentUpdatedAt: "2026-08-25T12:00:00.000Z", paymentUpdatedBy: "owner-1" },
    ]);
    expect(authFetch).toHaveBeenCalledWith("/api/clubs/club-1/events/event-1/rsvps/payment-statuses");
  });

  it("sends only the selected manual state to the confirmation endpoint", async () => {
    authFetch.mockResolvedValue(new Response(JSON.stringify({
      userId: "player-1", paymentStatus: "waived", paymentUpdatedAt: null, paymentUpdatedBy: "owner-1",
    }), { status: 200 }));

    await updateRsvpPaymentStatus("club-1", "event-1", "player-1", "waived");
    expect(authFetch).toHaveBeenCalledWith(
      "/api/clubs/club-1/events/event-1/rsvps/player-1/payment-status",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ paymentStatus: "waived" }),
      }),
    );
    expect(authFetch.mock.calls[0][1].body).not.toMatch(/receipt|transaction|amount|provider/i);
  });

  it("surfaces server failures rather than treating an unsaved payment status as confirmed", async () => {
    authFetch.mockResolvedValue(new Response("forbidden", { status: 403 }));
    await expect(updateRsvpPaymentStatus("club-1", "event-1", "player-1", "confirmed"))
      .rejects.toThrow("Unable to update private payment status");
  });
});
