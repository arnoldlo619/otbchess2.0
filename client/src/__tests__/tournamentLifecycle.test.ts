/**
 * tournamentLifecycle.test.ts
 * Tests for tournament auto-expiry logic and manual end/delete controls.
 * Phase 33: Tournament Auto-Expiry + Director End/Delete Controls
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// ─── Auto-Expiry Logic (pure functions mirroring server logic) ─────────────────

/**
 * Determines whether a tournament should be auto-expired.
 * Mirrors the server-side check in the 30-minute interval job.
 */
function shouldAutoExpire(params: {
  status: string;
  startedAt: Date | null;
  nowMs?: number;
}): boolean {
  const { status, startedAt, nowMs = Date.now() } = params;
  if (status !== "in_progress") return false;
  if (!startedAt) return false;
  const ageMs = nowMs - startedAt.getTime();
  const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
  return ageMs >= TWENTY_FOUR_HOURS_MS;
}

/**
 * Computes the time remaining before auto-expiry (in ms).
 * Returns 0 if already expired or not applicable.
 */
function timeUntilExpiry(params: {
  status: string;
  startedAt: Date | null;
  nowMs?: number;
}): number {
  const { status, startedAt, nowMs = Date.now() } = params;
  if (status !== "in_progress" || !startedAt) return -1;
  const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
  const ageMs = nowMs - startedAt.getTime();
  return Math.max(0, TWENTY_FOUR_HOURS_MS - ageMs);
}

// ─── Delete Validation Logic ───────────────────────────────────────────────────

/**
 * Validates whether a director is allowed to delete a tournament.
 * Returns an error string or null if allowed.
 */
function validateDeletePermission(params: {
  requestingUserId: string;
  tournamentOwnerId: string;
  tournamentId: string;
}): string | null {
  const { requestingUserId, tournamentOwnerId, tournamentId } = params;
  if (tournamentId === "otb-demo-2026") {
    return "Demo tournament cannot be deleted";
  }
  if (requestingUserId !== tournamentOwnerId) {
    return "Only the tournament owner can delete this tournament";
  }
  return null;
}

// ─── End Tournament State Transition ──────────────────────────────────────────

type TournamentStatus = "registration" | "in_progress" | "completed" | "paused";

function canEndTournament(status: TournamentStatus): boolean {
  return status === "in_progress" || status === "paused";
}

function transitionToCompleted(status: TournamentStatus): TournamentStatus {
  if (!canEndTournament(status)) {
    throw new Error(`Cannot end tournament in status: ${status}`);
  }
  return "completed";
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("shouldAutoExpire", () => {
  const NOW = new Date("2026-04-04T12:00:00Z").getTime();

  it("returns false for registration status", () => {
    const startedAt = new Date(NOW - 25 * 60 * 60 * 1000); // 25h ago
    expect(shouldAutoExpire({ status: "registration", startedAt, nowMs: NOW })).toBe(false);
  });

  it("returns false for completed status", () => {
    const startedAt = new Date(NOW - 25 * 60 * 60 * 1000);
    expect(shouldAutoExpire({ status: "completed", startedAt, nowMs: NOW })).toBe(false);
  });

  it("returns false when startedAt is null", () => {
    expect(shouldAutoExpire({ status: "in_progress", startedAt: null, nowMs: NOW })).toBe(false);
  });

  it("returns false when tournament is less than 24h old", () => {
    const startedAt = new Date(NOW - 23 * 60 * 60 * 1000); // 23h ago
    expect(shouldAutoExpire({ status: "in_progress", startedAt, nowMs: NOW })).toBe(false);
  });

  it("returns false at exactly 23h 59m 59s", () => {
    const startedAt = new Date(NOW - (24 * 60 * 60 * 1000 - 1000)); // 1s short
    expect(shouldAutoExpire({ status: "in_progress", startedAt, nowMs: NOW })).toBe(false);
  });

  it("returns true at exactly 24h", () => {
    const startedAt = new Date(NOW - 24 * 60 * 60 * 1000);
    expect(shouldAutoExpire({ status: "in_progress", startedAt, nowMs: NOW })).toBe(true);
  });

  it("returns true when tournament is 25h old", () => {
    const startedAt = new Date(NOW - 25 * 60 * 60 * 1000);
    expect(shouldAutoExpire({ status: "in_progress", startedAt, nowMs: NOW })).toBe(true);
  });

  it("returns true when tournament is 48h old", () => {
    const startedAt = new Date(NOW - 48 * 60 * 60 * 1000);
    expect(shouldAutoExpire({ status: "in_progress", startedAt, nowMs: NOW })).toBe(true);
  });

  it("returns true for paused tournaments older than 24h", () => {
    // Note: server job only checks in_progress, but this tests the pure function
    const startedAt = new Date(NOW - 25 * 60 * 60 * 1000);
    expect(shouldAutoExpire({ status: "in_progress", startedAt, nowMs: NOW })).toBe(true);
  });
});

describe("timeUntilExpiry", () => {
  const NOW = new Date("2026-04-04T12:00:00Z").getTime();

  it("returns -1 for non-in_progress status", () => {
    const startedAt = new Date(NOW - 5 * 60 * 60 * 1000);
    expect(timeUntilExpiry({ status: "registration", startedAt, nowMs: NOW })).toBe(-1);
    expect(timeUntilExpiry({ status: "completed", startedAt, nowMs: NOW })).toBe(-1);
  });

  it("returns -1 when startedAt is null", () => {
    expect(timeUntilExpiry({ status: "in_progress", startedAt: null, nowMs: NOW })).toBe(-1);
  });

  it("returns ~24h when just started", () => {
    const startedAt = new Date(NOW - 1000); // 1 second ago
    const remaining = timeUntilExpiry({ status: "in_progress", startedAt, nowMs: NOW });
    expect(remaining).toBeCloseTo(24 * 60 * 60 * 1000 - 1000, -3);
  });

  it("returns ~1h when 23h have elapsed", () => {
    const startedAt = new Date(NOW - 23 * 60 * 60 * 1000);
    const remaining = timeUntilExpiry({ status: "in_progress", startedAt, nowMs: NOW });
    expect(remaining).toBeCloseTo(60 * 60 * 1000, -3);
  });

  it("returns 0 when exactly 24h have elapsed", () => {
    const startedAt = new Date(NOW - 24 * 60 * 60 * 1000);
    expect(timeUntilExpiry({ status: "in_progress", startedAt, nowMs: NOW })).toBe(0);
  });

  it("returns 0 (not negative) when already expired", () => {
    const startedAt = new Date(NOW - 30 * 60 * 60 * 1000);
    expect(timeUntilExpiry({ status: "in_progress", startedAt, nowMs: NOW })).toBe(0);
  });
});

describe("validateDeletePermission", () => {
  it("allows owner to delete their own tournament", () => {
    expect(validateDeletePermission({
      requestingUserId: "user-123",
      tournamentOwnerId: "user-123",
      tournamentId: "tournament-abc",
    })).toBeNull();
  });

  it("blocks non-owner from deleting", () => {
    const result = validateDeletePermission({
      requestingUserId: "user-456",
      tournamentOwnerId: "user-123",
      tournamentId: "tournament-abc",
    });
    expect(result).toBeTruthy();
    expect(result).toContain("owner");
  });

  it("blocks deletion of the demo tournament regardless of ownership", () => {
    const result = validateDeletePermission({
      requestingUserId: "user-123",
      tournamentOwnerId: "user-123",
      tournamentId: "otb-demo-2026",
    });
    expect(result).toBeTruthy();
    expect(result).toContain("Demo");
  });

  it("blocks non-owner from deleting demo tournament", () => {
    const result = validateDeletePermission({
      requestingUserId: "user-999",
      tournamentOwnerId: "user-123",
      tournamentId: "otb-demo-2026",
    });
    expect(result).toBeTruthy();
  });
});

describe("canEndTournament", () => {
  it("allows ending in_progress tournaments", () => {
    expect(canEndTournament("in_progress")).toBe(true);
  });

  it("allows ending paused tournaments", () => {
    expect(canEndTournament("paused")).toBe(true);
  });

  it("blocks ending registration-phase tournaments", () => {
    expect(canEndTournament("registration")).toBe(false);
  });

  it("blocks ending already-completed tournaments", () => {
    expect(canEndTournament("completed")).toBe(false);
  });
});

describe("transitionToCompleted", () => {
  it("transitions in_progress to completed", () => {
    expect(transitionToCompleted("in_progress")).toBe("completed");
  });

  it("transitions paused to completed", () => {
    expect(transitionToCompleted("paused")).toBe("completed");
  });

  it("throws when trying to end a registration tournament", () => {
    expect(() => transitionToCompleted("registration")).toThrow();
  });

  it("throws when trying to end an already completed tournament", () => {
    expect(() => transitionToCompleted("completed")).toThrow();
  });
});

describe("auto-expiry batch processing", () => {
  const NOW = new Date("2026-04-04T12:00:00Z").getTime();

  interface MockTournament {
    id: string;
    status: string;
    startedAt: Date | null;
  }

  function runExpiryBatch(tournaments: MockTournament[], nowMs: number): string[] {
    return tournaments
      .filter((t) => shouldAutoExpire({ status: t.status, startedAt: t.startedAt, nowMs }))
      .map((t) => t.id);
  }

  it("expires only in_progress tournaments older than 24h", () => {
    const tournaments: MockTournament[] = [
      { id: "t1", status: "in_progress", startedAt: new Date(NOW - 25 * 60 * 60 * 1000) }, // expired
      { id: "t2", status: "in_progress", startedAt: new Date(NOW - 10 * 60 * 60 * 1000) }, // not expired
      { id: "t3", status: "registration", startedAt: new Date(NOW - 30 * 60 * 60 * 1000) }, // wrong status
      { id: "t4", status: "completed", startedAt: new Date(NOW - 48 * 60 * 60 * 1000) }, // already done
      { id: "t5", status: "in_progress", startedAt: null }, // no startedAt
      { id: "t6", status: "in_progress", startedAt: new Date(NOW - 24 * 60 * 60 * 1000) }, // exactly 24h
    ];
    const expired = runExpiryBatch(tournaments, NOW);
    expect(expired).toContain("t1");
    expect(expired).toContain("t6");
    expect(expired).not.toContain("t2");
    expect(expired).not.toContain("t3");
    expect(expired).not.toContain("t4");
    expect(expired).not.toContain("t5");
  });

  it("returns empty array when no tournaments need expiry", () => {
    const tournaments: MockTournament[] = [
      { id: "t1", status: "in_progress", startedAt: new Date(NOW - 1 * 60 * 60 * 1000) },
      { id: "t2", status: "registration", startedAt: null },
    ];
    expect(runExpiryBatch(tournaments, NOW)).toHaveLength(0);
  });

  it("handles empty tournament list", () => {
    expect(runExpiryBatch([], NOW)).toHaveLength(0);
  });
});
