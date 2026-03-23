/**
 * Unit tests for Player of the Month feed helpers:
 *   - getPreviousMonthKey
 *   - getPreviousMonthLabel
 *   - shouldPostPotmThisMonth
 *   - postPlayerOfMonth (deduplication, field mapping, runner-ups)
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  getPreviousMonthKey,
  getPreviousMonthLabel,
  shouldPostPotmThisMonth,
  postPlayerOfMonth,
  clearFeed,
  listFeedEvents,
} from "../lib/clubFeedRegistry";

// ── In-memory localStorage mock (Node has no real localStorage) ───────────────
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(globalThis, "localStorage", { value: localStorageMock, writable: true });

// ── Helpers ───────────────────────────────────────────────────────────────────

const CLUB = "test-potm-club";

const WINNER = {
  memberId: "player-1",
  memberName: "Magnus Carlsen",
  avatarUrl: null,
  battleWins: 8,
  winRate: 80,
  eventsAttended: 3,
  totalBattles: 10,
};

const RUNNER_UPS = [
  { playerId: "player-2", playerName: "Fabiano Caruana", wins: 6, winRate: 60, total: 10 },
  { playerId: "player-3", playerName: "Hikaru Nakamura", wins: 5, winRate: 50, total: 10 },
];

beforeEach(() => {
  clearFeed(CLUB);
});

// ── getPreviousMonthKey ───────────────────────────────────────────────────────

describe("getPreviousMonthKey", () => {
  it("returns YYYY-MM for the previous month", () => {
    const now = new Date("2026-03-15T10:00:00Z");
    expect(getPreviousMonthKey(now)).toBe("2026-02");
  });

  it("wraps correctly from January to December of the prior year", () => {
    const now = new Date("2026-01-10T10:00:00Z");
    expect(getPreviousMonthKey(now)).toBe("2025-12");
  });

  it("handles end-of-month dates without overflow (e.g. March 31 → February)", () => {
    const now = new Date("2026-03-31T10:00:00Z");
    expect(getPreviousMonthKey(now)).toBe("2026-02");
  });

  it("pads single-digit months with a leading zero", () => {
    const now = new Date("2026-10-01T10:00:00Z");
    expect(getPreviousMonthKey(now)).toBe("2026-09");
  });
});

// ── getPreviousMonthLabel ─────────────────────────────────────────────────────

describe("getPreviousMonthLabel", () => {
  it("returns a human-readable month label for the previous month", () => {
    const now = new Date("2026-03-15T10:00:00Z");
    const label = getPreviousMonthLabel(now);
    // Should be "February 2026"
    expect(label).toMatch(/February/i);
    expect(label).toMatch(/2026/);
  });

  it("handles year boundary correctly", () => {
    const now = new Date("2026-01-15T10:00:00Z");
    const label = getPreviousMonthLabel(now);
    expect(label).toMatch(/December/i);
    expect(label).toMatch(/2025/);
  });
});

// ── shouldPostPotmThisMonth ───────────────────────────────────────────────────

describe("shouldPostPotmThisMonth", () => {
  it("returns true when no POTM post exists for the given month", () => {
    expect(shouldPostPotmThisMonth(CLUB, "2026-02")).toBe(true);
  });

  it("returns false after a POTM post has been made for that month", () => {
    postPlayerOfMonth({
      clubId: CLUB,
      winner: WINNER,
      monthKey: "2026-02",
      monthLabel: "February 2026",
    });
    expect(shouldPostPotmThisMonth(CLUB, "2026-02")).toBe(false);
  });

  it("returns true for a different month even if another month was posted", () => {
    postPlayerOfMonth({
      clubId: CLUB,
      winner: WINNER,
      monthKey: "2026-02",
      monthLabel: "February 2026",
    });
    expect(shouldPostPotmThisMonth(CLUB, "2026-01")).toBe(true);
  });
});

// ── postPlayerOfMonth ─────────────────────────────────────────────────────────

describe("postPlayerOfMonth", () => {
  it("creates a potm_announcement feed event with correct fields", () => {
    const event = postPlayerOfMonth({
      clubId: CLUB,
      winner: WINNER,
      runnerUps: RUNNER_UPS,
      postedByName: "Club Director",
      monthKey: "2026-02",
      monthLabel: "February 2026",
    });

    expect(event).not.toBeNull();
    expect(event!.type).toBe("potm_announcement");
    expect(event!.potmMonth).toBe("2026-02");
    expect(event!.potmMonthLabel).toBe("February 2026");
    expect(event!.potmWinnerName).toBe("Magnus Carlsen");
    expect(event!.potmWinnerId).toBe("player-1");
    expect(event!.potmWins).toBe(8);
    expect(event!.potmWinRate).toBe(80);
    expect(event!.potmEventsAttended).toBe(3);
    expect(event!.potmTotalBattles).toBe(10);
    expect(event!.actorName).toBe("Club Director");
  });

  it("includes up to 2 runner-ups", () => {
    const event = postPlayerOfMonth({
      clubId: CLUB,
      winner: WINNER,
      runnerUps: RUNNER_UPS,
      monthKey: "2026-02",
      monthLabel: "February 2026",
    });

    expect(event!.potmRunnerUps).toHaveLength(2);
    expect(event!.potmRunnerUps![0].playerName).toBe("Fabiano Caruana");
    expect(event!.potmRunnerUps![1].playerName).toBe("Hikaru Nakamura");
  });

  it("truncates runner-ups to 2 even if more are provided", () => {
    const threeRunnerUps = [
      ...RUNNER_UPS,
      { playerId: "player-4", playerName: "Ding Liren", wins: 4, winRate: 40, total: 10 },
    ];
    const event = postPlayerOfMonth({
      clubId: CLUB,
      winner: WINNER,
      runnerUps: threeRunnerUps,
      monthKey: "2026-02",
      monthLabel: "February 2026",
    });
    expect(event!.potmRunnerUps).toHaveLength(2);
  });

  it("deduplicates — returns null if POTM already posted for that month", () => {
    postPlayerOfMonth({
      clubId: CLUB,
      winner: WINNER,
      monthKey: "2026-02",
      monthLabel: "February 2026",
    });
    const second = postPlayerOfMonth({
      clubId: CLUB,
      winner: WINNER,
      monthKey: "2026-02",
      monthLabel: "February 2026",
    });
    expect(second).toBeNull();
  });

  it("allows posting for a different month after one has been posted", () => {
    postPlayerOfMonth({
      clubId: CLUB,
      winner: WINNER,
      monthKey: "2026-02",
      monthLabel: "February 2026",
    });
    const second = postPlayerOfMonth({
      clubId: CLUB,
      winner: WINNER,
      monthKey: "2026-01",
      monthLabel: "January 2026",
    });
    expect(second).not.toBeNull();
    expect(second!.potmMonth).toBe("2026-01");
  });

  it("defaults actorName to 'Club' when postedByName is omitted", () => {
    const event = postPlayerOfMonth({
      clubId: CLUB,
      winner: WINNER,
      monthKey: "2026-02",
      monthLabel: "February 2026",
    });
    expect(event!.actorName).toBe("Club");
  });

  it("persists the event to the feed so listFeedEvents returns it", () => {
    postPlayerOfMonth({
      clubId: CLUB,
      winner: WINNER,
      monthKey: "2026-02",
      monthLabel: "February 2026",
    });
    const events = listFeedEvents(CLUB);
    const potmEvents = events.filter((e) => e.type === "potm_announcement");
    expect(potmEvents).toHaveLength(1);
    expect(potmEvents[0].potmWinnerName).toBe("Magnus Carlsen");
  });

  it("uses getPreviousMonthKey when monthKey is not provided", () => {
    const now = new Date("2026-03-15T10:00:00Z");
    const event = postPlayerOfMonth({
      clubId: CLUB,
      winner: WINNER,
      now,
    });
    expect(event).not.toBeNull();
    expect(event!.potmMonth).toBe("2026-02");
  });

  it("description includes winner name and month label", () => {
    const event = postPlayerOfMonth({
      clubId: CLUB,
      winner: WINNER,
      monthKey: "2026-02",
      monthLabel: "February 2026",
    });
    expect(event!.description).toContain("Magnus Carlsen");
    expect(event!.description).toContain("February 2026");
  });
});
