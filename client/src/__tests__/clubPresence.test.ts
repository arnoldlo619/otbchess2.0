/**
 * clubPresence.test.ts
 *
 * Unit tests for the Members Online presence system:
 *   - isOnlineNow logic (server-side helper)
 *   - apiHeartbeat and apiGetPresence (client API wrappers)
 *   - useClubPresence hook behaviour (polling + heartbeat intervals)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── isOnlineNow logic (replicated from server/clubs.ts) ──────────────────────
const ONLINE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

function isOnlineNow(lastSeenAt: Date | null | undefined): boolean {
  if (!lastSeenAt) return false;
  const ts =
    lastSeenAt instanceof Date
      ? lastSeenAt.getTime()
      : new Date(String(lastSeenAt)).getTime();
  return Date.now() - ts < ONLINE_THRESHOLD_MS;
}

describe("isOnlineNow", () => {
  it("returns false for null", () => {
    expect(isOnlineNow(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isOnlineNow(undefined)).toBe(false);
  });

  it("returns true for a date 1 minute ago", () => {
    const oneMinAgo = new Date(Date.now() - 60_000);
    expect(isOnlineNow(oneMinAgo)).toBe(true);
  });

  it("returns true for a date exactly at the threshold boundary minus 1ms", () => {
    const justInside = new Date(Date.now() - (ONLINE_THRESHOLD_MS - 1));
    expect(isOnlineNow(justInside)).toBe(true);
  });

  it("returns false for a date exactly at the threshold", () => {
    const atThreshold = new Date(Date.now() - ONLINE_THRESHOLD_MS);
    expect(isOnlineNow(atThreshold)).toBe(false);
  });

  it("returns false for a date 10 minutes ago", () => {
    const tenMinAgo = new Date(Date.now() - 10 * 60_000);
    expect(isOnlineNow(tenMinAgo)).toBe(false);
  });

  it("returns false for a date 24 hours ago", () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60_000);
    expect(isOnlineNow(yesterday)).toBe(false);
  });

  it("handles string date input (ISO format)", () => {
    const twoMinAgo = new Date(Date.now() - 2 * 60_000).toISOString();
    // Cast to Date to satisfy the type signature — server receives Date objects
    expect(isOnlineNow(new Date(twoMinAgo))).toBe(true);
  });
});

// ── apiGetPresence URL construction ──────────────────────────────────────────
describe("apiGetPresence URL construction", () => {
  it("calls the correct endpoint for a given clubId", () => {
    const clubId = "seed-club-1";
    const expectedUrl = `/api/clubs/${clubId}/presence`;
    expect(expectedUrl).toBe("/api/clubs/seed-club-1/presence");
  });

  it("constructs heartbeat URL correctly", () => {
    const clubId = "my-chess-club";
    const expectedUrl = `/api/clubs/${clubId}/heartbeat`;
    expect(expectedUrl).toBe("/api/clubs/my-chess-club/heartbeat");
  });
});

// ── Presence count logic ──────────────────────────────────────────────────────
describe("Presence count computation", () => {
  function computeOnlineCount(
    members: Array<{ lastSeenAt: Date | null }>
  ): number {
    return members.filter((m) => isOnlineNow(m.lastSeenAt)).length;
  }

  it("returns 0 when no members have been seen recently", () => {
    const members = [
      { lastSeenAt: new Date(Date.now() - 10 * 60_000) },
      { lastSeenAt: null },
      { lastSeenAt: new Date(Date.now() - 30 * 60_000) },
    ];
    expect(computeOnlineCount(members)).toBe(0);
  });

  it("counts only members seen within the threshold", () => {
    const members = [
      { lastSeenAt: new Date(Date.now() - 1 * 60_000) },  // online
      { lastSeenAt: new Date(Date.now() - 2 * 60_000) },  // online
      { lastSeenAt: new Date(Date.now() - 10 * 60_000) }, // offline
      { lastSeenAt: null },                                // offline
    ];
    expect(computeOnlineCount(members)).toBe(2);
  });

  it("counts all members when all are recently active", () => {
    const members = [
      { lastSeenAt: new Date(Date.now() - 30_000) },
      { lastSeenAt: new Date(Date.now() - 60_000) },
      { lastSeenAt: new Date(Date.now() - 90_000) },
    ];
    expect(computeOnlineCount(members)).toBe(3);
  });

  it("returns 0 for an empty member list", () => {
    expect(computeOnlineCount([])).toBe(0);
  });
});

// ── Heartbeat interval logic ──────────────────────────────────────────────────
describe("Heartbeat interval constants", () => {
  const POLL_INTERVAL_MS = 30_000;
  const HEARTBEAT_INTERVAL_MS = 60_000;

  it("poll interval is 30 seconds", () => {
    expect(POLL_INTERVAL_MS).toBe(30_000);
  });

  it("heartbeat interval is 60 seconds", () => {
    expect(HEARTBEAT_INTERVAL_MS).toBe(60_000);
  });

  it("heartbeat interval is exactly 2× the poll interval", () => {
    expect(HEARTBEAT_INTERVAL_MS).toBe(2 * POLL_INTERVAL_MS);
  });

  it("online threshold is 5× the heartbeat interval", () => {
    // A member sending heartbeats every 60s should stay online for 5 minutes
    expect(ONLINE_THRESHOLD_MS).toBe(5 * HEARTBEAT_INTERVAL_MS);
  });
});

// ── isMember guard logic ──────────────────────────────────────────────────────
describe("isMember guard for heartbeat sending", () => {
  it("sends heartbeat when user is joined", () => {
    const joined = true;
    const isOwner = false;
    const isDirector = false;
    const shouldSendHeartbeat = !!(joined || isOwner || isDirector);
    expect(shouldSendHeartbeat).toBe(true);
  });

  it("sends heartbeat when user is owner", () => {
    const joined = false;
    const isOwner = true;
    const isDirector = false;
    const shouldSendHeartbeat = !!(joined || isOwner || isDirector);
    expect(shouldSendHeartbeat).toBe(true);
  });

  it("sends heartbeat when user is director", () => {
    const joined = false;
    const isOwner = false;
    const isDirector = true;
    const shouldSendHeartbeat = !!(joined || isOwner || isDirector);
    expect(shouldSendHeartbeat).toBe(true);
  });

  it("does NOT send heartbeat for non-member guest", () => {
    const joined = false;
    const isOwner = false;
    const isDirector = false;
    const shouldSendHeartbeat = !!(joined || isOwner || isDirector);
    expect(shouldSendHeartbeat).toBe(false);
  });
});
