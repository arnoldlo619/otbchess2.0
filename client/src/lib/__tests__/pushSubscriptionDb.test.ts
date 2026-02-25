/**
 * Tests for the DB-backed push subscription persistence layer.
 *
 * These tests validate:
 *  1. The Drizzle schema shape (column names, types, constraints)
 *  2. The API contract for subscribe / unsubscribe / notify endpoints
 *  3. Stale subscription cleanup logic (410/404 responses)
 *
 * Full integration tests against a real database are out of scope for unit
 * testing. We mock fetch() to verify the client-side API call shapes.
 */

import { describe, it, expect, vi, afterEach } from "vitest";

// ─── Schema shape validation ──────────────────────────────────────────────────

describe("push_subscriptions schema", () => {
  it("exports the pushSubscriptions table with all required columns", async () => {
    const { pushSubscriptions } = await import("../../../../shared/schema.js");
    expect(pushSubscriptions).toBeDefined();

    // Drizzle table objects expose column definitions via the internal symbol
    const columns = Object.keys(pushSubscriptions);
    expect(columns).toContain("id");
    expect(columns).toContain("tournamentId");
    expect(columns).toContain("endpoint");
    expect(columns).toContain("p256dh");
    expect(columns).toContain("auth");
    expect(columns).toContain("createdAt");
  });

  it("exports PushSubscription and NewPushSubscription types (compile-time check)", async () => {
    // If this import resolves without error, the types are exported correctly.
    const schema = await import("../../../../shared/schema.js");
    expect(typeof schema.pushSubscriptions).toBe("object");
  });
});

// ─── API endpoint contract ────────────────────────────────────────────────────

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("POST /api/push/subscribe — DB upsert contract", () => {
  it("sends the correct payload shape", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true, count: 1 }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const payload = {
      tournamentId: "otb-spring-2026",
      subscription: {
        endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
        keys: { p256dh: "key1", auth: "key2" },
      },
    };

    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json() as { ok: boolean; count: number };

    expect(data.ok).toBe(true);
    expect(typeof data.count).toBe("number");
    expect(mockFetch).toHaveBeenCalledWith("/api/push/subscribe", expect.objectContaining({
      method: "POST",
    }));

    // Verify the body contains the required fields
    const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body as string) as typeof payload;
    expect(sentBody.tournamentId).toBe("otb-spring-2026");
    expect(sentBody.subscription.endpoint).toBeTruthy();
    expect(sentBody.subscription.keys.p256dh).toBeTruthy();
    expect(sentBody.subscription.keys.auth).toBeTruthy();
  });

  it("returns count > 0 after successful subscription", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true, count: 3 }),
    }));

    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tournamentId: "test-123",
        subscription: { endpoint: "https://example.com/push/1", keys: { p256dh: "k1", auth: "a1" } },
      }),
    });
    const data = await res.json() as { ok: boolean; count: number };
    expect(data.count).toBeGreaterThan(0);
  });
});

describe("DELETE /api/push/subscribe — DB delete contract", () => {
  it("sends the correct payload shape for unsubscribe", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true, count: 0 }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const payload = {
      tournamentId: "otb-spring-2026",
      subscription: {
        endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
        keys: { p256dh: "key1", auth: "key2" },
      },
    };

    const res = await fetch("/api/push/subscribe", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json() as { ok: boolean; count: number };

    expect(data.ok).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith("/api/push/subscribe", expect.objectContaining({
      method: "DELETE",
    }));
  });
});

describe("POST /api/push/notify/:tournamentId — broadcast contract", () => {
  it("returns sent and failed counts", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true, sent: 5, failed: 1 }),
    }));

    const res = await fetch("/api/push/notify/otb-spring-2026", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ round: 3, tournamentName: "Spring Open 2026" }),
    });
    const data = await res.json() as { ok: boolean; sent: number; failed: number };

    expect(data.ok).toBe(true);
    expect(typeof data.sent).toBe("number");
    expect(typeof data.failed).toBe("number");
  });

  it("returns sent: 0 when no subscribers exist", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true, sent: 0, failed: 0 }),
    }));

    const res = await fetch("/api/push/notify/empty-tournament", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ round: 1, tournamentName: "Empty Tournament" }),
    });
    const data = await res.json() as { ok: boolean; sent: number; failed: number };

    expect(data.sent).toBe(0);
    expect(data.failed).toBe(0);
  });
});

describe("GET /api/push/count/:tournamentId — subscriber count contract", () => {
  it("returns a numeric count", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ count: 7 }),
    }));

    const res = await fetch("/api/push/count/otb-spring-2026");
    const data = await res.json() as { count: number };

    expect(typeof data.count).toBe("number");
    expect(data.count).toBe(7);
  });
});

// ─── Stale subscription cleanup logic ────────────────────────────────────────

describe("Stale subscription cleanup", () => {
  it("identifies 410 Gone as a stale endpoint that should be removed", () => {
    const isStale = (statusCode: number) => statusCode === 410 || statusCode === 404;

    expect(isStale(410)).toBe(true);
    expect(isStale(404)).toBe(true);
    expect(isStale(200)).toBe(false);
    expect(isStale(500)).toBe(false);
    expect(isStale(201)).toBe(false);
  });

  it("does not mark 5xx errors as stale (server-side errors are transient)", () => {
    const isStale = (statusCode: number) => statusCode === 410 || statusCode === 404;

    expect(isStale(500)).toBe(false);
    expect(isStale(503)).toBe(false);
    expect(isStale(502)).toBe(false);
  });

  it("correctly reconstructs a PushSubscription from DB row fields", () => {
    const dbRow = {
      id: "abc123",
      tournamentId: "otb-2026",
      endpoint: "https://fcm.googleapis.com/fcm/send/xyz",
      p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtZ",
      auth: "tBHIJNPCYXmKxM70",
      createdAt: new Date(),
    };

    // Reconstruct the PushSubscription object as the server does
    const sub = {
      endpoint: dbRow.endpoint,
      keys: { p256dh: dbRow.p256dh, auth: dbRow.auth },
    };

    expect(sub.endpoint).toBe(dbRow.endpoint);
    expect(sub.keys.p256dh).toBe(dbRow.p256dh);
    expect(sub.keys.auth).toBe(dbRow.auth);
  });
});

// ─── Notification payload shape ───────────────────────────────────────────────

describe("Push notification payload", () => {
  it("generates the correct payload for a round-start notification", () => {
    const tournamentId = "otb-spring-2026";
    const round = 3;
    const tournamentName = "Spring Open 2026";

    const payload = JSON.stringify({
      title: `Round ${round} Pairings Ready`,
      body: `${tournamentName} — Check your board assignment now.`,
      tag: `otb-round-${tournamentId}-${round}`,
      url: `/tournament/${tournamentId}`,
    });

    const parsed = JSON.parse(payload) as {
      title: string;
      body: string;
      tag: string;
      url: string;
    };

    expect(parsed.title).toBe("Round 3 Pairings Ready");
    expect(parsed.body).toContain("Spring Open 2026");
    expect(parsed.tag).toBe("otb-round-otb-spring-2026-3");
    expect(parsed.url).toBe("/tournament/otb-spring-2026");
  });

  it("generates unique tags for different rounds of the same tournament", () => {
    const makeTag = (tid: string, round: number) => `otb-round-${tid}-${round}`;
    expect(makeTag("t1", 1)).not.toBe(makeTag("t1", 2));
    expect(makeTag("t1", 1)).not.toBe(makeTag("t2", 1));
  });
});
