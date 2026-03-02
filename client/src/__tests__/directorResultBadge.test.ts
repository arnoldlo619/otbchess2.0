/**
 * Unit tests for the director result confirmation badge feature.
 *
 * Tests cover:
 *  - PendingReport state helpers (add, clear, catch-up merge)
 *  - Badge display logic (shown when report exists, hidden when cleared)
 *  - Result label formatting for the badge
 */

import { describe, it, expect } from "vitest";

// ── PendingReport state helpers ───────────────────────────────────────────────

type PendingReport = {
  gameId: string;
  result: string;
  submittedBy: string;
  timestamp: number;
};

/** Simulates adding a report to the pending map (mirrors Director.tsx setState logic). */
function addReport(
  map: Map<string, PendingReport>,
  report: PendingReport
): Map<string, PendingReport> {
  const next = new Map(map);
  next.set(report.gameId, report);
  return next;
}

/** Simulates clearing a report from the pending map. */
function clearReport(
  map: Map<string, PendingReport>,
  gameId: string
): Map<string, PendingReport> {
  const next = new Map(map);
  next.delete(gameId);
  return next;
}

/** Simulates catch-up merge from the GET /pending-results response. */
function mergeReports(
  existing: Map<string, PendingReport>,
  incoming: PendingReport[]
): Map<string, PendingReport> {
  const next = new Map(existing);
  incoming.forEach((r) => next.set(r.gameId, r));
  return next;
}

// ── Badge display logic ───────────────────────────────────────────────────────

/** Returns true when a badge should be shown for a given game. */
function hasBadge(
  pendingReports: Map<string, PendingReport>,
  gameId: string
): boolean {
  return pendingReports.has(gameId);
}

/** Formats the badge label shown to the director. */
function badgeLabel(report: PendingReport): string {
  return `${report.submittedBy} reported: ${report.result}`;
}

/** Returns the CSS colour class for the result chip in the badge. */
function resultChipClass(result: string): string {
  if (result === "1-0") return "bg-emerald-100 text-emerald-700";
  if (result === "0-1") return "bg-red-100 text-red-600";
  return "bg-blue-100 text-blue-600";
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("PendingReport state helpers", () => {
  it("adds a report to an empty map", () => {
    const map = new Map<string, PendingReport>();
    const report: PendingReport = {
      gameId: "g1",
      result: "1-0",
      submittedBy: "Alice",
      timestamp: 1000,
    };
    const next = addReport(map, report);
    expect(next.size).toBe(1);
    expect(next.get("g1")).toEqual(report);
  });

  it("overwrites an existing report for the same game", () => {
    let map = new Map<string, PendingReport>();
    map = addReport(map, { gameId: "g1", result: "0-1", submittedBy: "Bob", timestamp: 1000 });
    map = addReport(map, { gameId: "g1", result: "1-0", submittedBy: "Alice", timestamp: 2000 });
    expect(map.size).toBe(1);
    expect(map.get("g1")?.result).toBe("1-0");
  });

  it("clears a report by gameId", () => {
    let map = new Map<string, PendingReport>();
    map = addReport(map, { gameId: "g1", result: "½-½", submittedBy: "Carol", timestamp: 1000 });
    map = clearReport(map, "g1");
    expect(map.size).toBe(0);
    expect(map.has("g1")).toBe(false);
  });

  it("clearing a non-existent gameId is a no-op", () => {
    const map = new Map<string, PendingReport>();
    const next = clearReport(map, "nonexistent");
    expect(next.size).toBe(0);
  });

  it("merges incoming catch-up reports without losing existing ones", () => {
    let map = new Map<string, PendingReport>();
    map = addReport(map, { gameId: "g1", result: "1-0", submittedBy: "Alice", timestamp: 1000 });
    const incoming: PendingReport[] = [
      { gameId: "g2", result: "0-1", submittedBy: "Bob", timestamp: 2000 },
      { gameId: "g3", result: "½-½", submittedBy: "Carol", timestamp: 3000 },
    ];
    map = mergeReports(map, incoming);
    expect(map.size).toBe(3);
    expect(map.has("g1")).toBe(true);
    expect(map.has("g2")).toBe(true);
    expect(map.has("g3")).toBe(true);
  });

  it("catch-up merge overwrites stale local report with server version", () => {
    let map = new Map<string, PendingReport>();
    map = addReport(map, { gameId: "g1", result: "0-1", submittedBy: "Old", timestamp: 500 });
    map = mergeReports(map, [
      { gameId: "g1", result: "1-0", submittedBy: "New", timestamp: 1000 },
    ]);
    expect(map.get("g1")?.submittedBy).toBe("New");
    expect(map.get("g1")?.result).toBe("1-0");
  });
});

describe("Badge display logic", () => {
  it("returns true when a pending report exists for the game", () => {
    let map = new Map<string, PendingReport>();
    map = addReport(map, { gameId: "g5", result: "1-0", submittedBy: "Dave", timestamp: 1000 });
    expect(hasBadge(map, "g5")).toBe(true);
  });

  it("returns false when no pending report exists for the game", () => {
    const map = new Map<string, PendingReport>();
    expect(hasBadge(map, "g5")).toBe(false);
  });

  it("returns false after the report is cleared", () => {
    let map = new Map<string, PendingReport>();
    map = addReport(map, { gameId: "g5", result: "1-0", submittedBy: "Dave", timestamp: 1000 });
    map = clearReport(map, "g5");
    expect(hasBadge(map, "g5")).toBe(false);
  });
});

describe("Badge label formatting", () => {
  it("formats the label correctly for a white win", () => {
    const report: PendingReport = { gameId: "g1", result: "1-0", submittedBy: "Alice", timestamp: 1000 };
    expect(badgeLabel(report)).toBe("Alice reported: 1-0");
  });

  it("formats the label correctly for a black win", () => {
    const report: PendingReport = { gameId: "g2", result: "0-1", submittedBy: "Bob", timestamp: 1000 };
    expect(badgeLabel(report)).toBe("Bob reported: 0-1");
  });

  it("formats the label correctly for a draw", () => {
    const report: PendingReport = { gameId: "g3", result: "½-½", submittedBy: "Carol", timestamp: 1000 };
    expect(badgeLabel(report)).toBe("Carol reported: ½-½");
  });
});

describe("Result chip colour classes", () => {
  it("uses emerald for white win", () => {
    expect(resultChipClass("1-0")).toContain("emerald");
  });

  it("uses red for black win", () => {
    expect(resultChipClass("0-1")).toContain("red");
  });

  it("uses blue for draw", () => {
    expect(resultChipClass("½-½")).toContain("blue");
  });
});
