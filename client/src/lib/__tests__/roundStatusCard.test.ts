/**
 * Unit tests for the Round in Progress summary card helper logic.
 * Tests cover: board completion %, timer label derivation, top-3 standings slice.
 */
import { describe, it, expect } from "vitest";
import { getStandings, type Player } from "@/lib/tournamentData";

// ── Helpers (inline, mirroring Director.tsx inline logic) ──────────────────

function completionPct(completed: number, total: number): number {
  return total > 0 ? Math.round((completed / total) * 100) : 0;
}

type TimerStatus = "idle" | "running" | "paused" | "expired";

function timerLabel(status: TimerStatus, remainingSec: number): string {
  if (status === "idle") return "No timer";
  if (status === "expired") return "Time's up";
  const m = Math.floor(remainingSec / 60);
  const s = Math.floor(remainingSec % 60);
  return `${m}:${s.toString().padStart(2, "0")} left`;
}

function isNearEnd(status: TimerStatus, remainingSec: number): boolean {
  return status === "running" && remainingSec <= 300;
}

// ── Fixtures ───────────────────────────────────────────────────────────────

function makePlayer(id: string, points: number, buchholz = 0): Player {
  return {
    id,
    name: `Player ${id}`,
    username: id,
    elo: 1500,
    points,
    wins: 0,
    draws: 0,
    losses: 0,
    buchholz,
    colorHistory: [],
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("completionPct", () => {
  it("returns 0 when total is 0", () => {
    expect(completionPct(0, 0)).toBe(0);
  });

  it("returns 0 when no games completed", () => {
    expect(completionPct(0, 8)).toBe(0);
  });

  it("returns 50 when half complete", () => {
    expect(completionPct(4, 8)).toBe(50);
  });

  it("returns 100 when all complete", () => {
    expect(completionPct(8, 8)).toBe(100);
  });

  it("rounds fractional percentages", () => {
    expect(completionPct(1, 3)).toBe(33);
  });
});

describe("timerLabel", () => {
  it("returns 'No timer' when idle", () => {
    expect(timerLabel("idle", 0)).toBe("No timer");
  });

  it("returns \"Time's up\" when expired", () => {
    expect(timerLabel("expired", 0)).toBe("Time's up");
  });

  it("formats running timer correctly — 30 min", () => {
    expect(timerLabel("running", 1800)).toBe("30:00 left");
  });

  it("formats running timer correctly — 5 min 30 sec", () => {
    expect(timerLabel("running", 330)).toBe("5:30 left");
  });

  it("formats paused timer", () => {
    expect(timerLabel("paused", 600)).toBe("10:00 left");
  });

  it("pads seconds to two digits", () => {
    expect(timerLabel("running", 65)).toBe("1:05 left");
  });
});

describe("isNearEnd", () => {
  it("returns true when running and exactly 300s remain", () => {
    expect(isNearEnd("running", 300)).toBe(true);
  });

  it("returns true when running and less than 300s remain", () => {
    expect(isNearEnd("running", 120)).toBe(true);
  });

  it("returns false when running and more than 300s remain", () => {
    expect(isNearEnd("running", 301)).toBe(false);
  });

  it("returns false when paused even if under 300s", () => {
    expect(isNearEnd("paused", 100)).toBe(false);
  });

  it("returns false when idle", () => {
    expect(isNearEnd("idle", 0)).toBe(false);
  });
});

describe("top-3 standings slice", () => {
  it("returns top 3 players sorted by points", () => {
    const players = [
      makePlayer("a", 1),
      makePlayer("b", 3),
      makePlayer("c", 2),
      makePlayer("d", 2.5),
      makePlayer("e", 0.5),
    ];
    const top3 = getStandings(players).slice(0, 3);
    expect(top3.map((p) => p.id)).toEqual(["b", "d", "c"]);
  });

  it("returns fewer than 3 when fewer players exist", () => {
    const players = [makePlayer("x", 2), makePlayer("y", 1)];
    const top3 = getStandings(players).slice(0, 3);
    expect(top3).toHaveLength(2);
  });

  it("returns empty array when no players", () => {
    const top3 = getStandings([]).slice(0, 3);
    expect(top3).toHaveLength(0);
  });
});
