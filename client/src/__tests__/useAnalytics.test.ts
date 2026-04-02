/**
 * Tests for the analytics tracking utilities.
 *
 * Tests the core postEvent logic via trackAnalyticsEvent (the standalone helper),
 * which is the same underlying function used by the useAnalytics hook.
 *
 * Verifies:
 *  - fire-and-forget fetch is called with correct payload
 *  - keepalive flag is set on fetch calls
 *  - POST method and Content-Type header are correct
 *  - metadata is serialized correctly
 *  - graceful handling of fetch network failure
 *  - all supported event types can be dispatched
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { trackAnalyticsEvent } from "../hooks/useAnalytics";

// ─── Mock fetch ───────────────────────────────────────────────────────────────

const mockFetch = vi.fn().mockResolvedValue({ ok: true });

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
  mockFetch.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getLastFetchBody(): Record<string, unknown> {
  const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
  return JSON.parse(lastCall[1].body as string);
}

function getLastFetchOptions(): RequestInit {
  const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
  return lastCall[1] as RequestInit;
}

// ─── Core tracking tests ──────────────────────────────────────────────────────

describe("trackAnalyticsEvent", () => {
  it("posts to /api/analytics/event with correct payload", () => {
    trackAnalyticsEvent("t-123", "follow", { playerName: "Alice" });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toBe("/api/analytics/event");

    const body = getLastFetchBody();
    expect(body.tournamentId).toBe("t-123");
    expect(body.eventType).toBe("follow");
    expect((body.metadata as Record<string, unknown>).playerName).toBe("Alice");
  });

  it("sets keepalive: true on all fetch calls", () => {
    trackAnalyticsEvent("t-123", "cta_click", { cta: "join_club" });

    const opts = getLastFetchOptions();
    expect(opts.keepalive).toBe(true);
  });

  it("uses POST method", () => {
    trackAnalyticsEvent("t-456", "unfollow");

    const opts = getLastFetchOptions();
    expect(opts.method).toBe("POST");
  });

  it("sets Content-Type: application/json", () => {
    trackAnalyticsEvent("t-456", "search", { query: "Magnus" });

    const opts = getLastFetchOptions();
    expect((opts.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
  });

  it("sends metadata correctly when provided", () => {
    trackAnalyticsEvent("t-789", "search", { query: "Hikaru", resultCount: 3 });

    const body = getLastFetchBody();
    expect((body.metadata as Record<string, unknown>).query).toBe("Hikaru");
    expect((body.metadata as Record<string, unknown>).resultCount).toBe(3);
  });

  it("sends undefined metadata when not provided", () => {
    trackAnalyticsEvent("t-789", "email_capture");

    const body = getLastFetchBody();
    expect(body.metadata).toBeUndefined();
  });

  it("fires multiple events independently", () => {
    trackAnalyticsEvent("t-multi", "follow", { playerName: "Alice" });
    trackAnalyticsEvent("t-multi", "unfollow", { playerName: "Alice" });
    trackAnalyticsEvent("t-multi", "cta_click", { cta: "join_club" });

    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("handles fetch network failure silently", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    // Should not throw
    expect(() => {
      trackAnalyticsEvent("t-fail", "page_view");
    }).not.toThrow();

    // Allow microtask queue to flush
    await Promise.resolve();
    // No unhandled rejection should propagate
  });

  it("handles fetch returning an error response silently", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    expect(() => {
      trackAnalyticsEvent("t-error", "search");
    }).not.toThrow();

    await Promise.resolve();
  });

  it("serializes complex metadata correctly", () => {
    const metadata = {
      playerId: "p-123",
      playerName: "Magnus Carlsen",
      elo: 2882,
      title: "GM",
      nested: { round: 3, board: 1 },
    };

    trackAnalyticsEvent("t-complex", "follow", metadata);

    const body = getLastFetchBody();
    const meta = body.metadata as typeof metadata;
    expect(meta.playerId).toBe("p-123");
    expect(meta.elo).toBe(2882);
    expect(meta.nested.round).toBe(3);
  });
});

// ─── Event type coverage ──────────────────────────────────────────────────────

describe("all supported event types", () => {
  const eventTypes = [
    "page_view",
    "search",
    "follow",
    "unfollow",
    "cta_click",
    "email_capture",
    "card_claim",
  ] as const;

  eventTypes.forEach((eventType) => {
    it(`dispatches ${eventType} correctly`, () => {
      trackAnalyticsEvent(`t-${eventType}`, eventType);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const body = getLastFetchBody();
      expect(body.eventType).toBe(eventType);
      expect(body.tournamentId).toBe(`t-${eventType}`);

      mockFetch.mockClear();
    });
  });
});

// ─── Payload structure validation ─────────────────────────────────────────────

describe("payload structure", () => {
  it("always includes tournamentId and eventType at top level", () => {
    trackAnalyticsEvent("t-structure", "page_view");

    const body = getLastFetchBody();
    expect(Object.keys(body)).toContain("tournamentId");
    expect(Object.keys(body)).toContain("eventType");
  });

  it("body is valid JSON", () => {
    trackAnalyticsEvent("t-json", "search", { query: "test" });

    const lastCall = mockFetch.mock.calls[0];
    const rawBody = lastCall[1].body as string;
    expect(() => JSON.parse(rawBody)).not.toThrow();
  });

  it("tournamentId is passed through exactly", () => {
    const id = "tournament-abc-123-xyz";
    trackAnalyticsEvent(id, "follow");

    const body = getLastFetchBody();
    expect(body.tournamentId).toBe(id);
  });

  it("eventType is passed through exactly", () => {
    trackAnalyticsEvent("t-exact", "email_capture");

    const body = getLastFetchBody();
    expect(body.eventType).toBe("email_capture");
  });
});
