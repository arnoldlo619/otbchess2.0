/**
 * P0 Release-Recovery Sprint — Unit Tests
 *
 * Covers:
 *   1. getTournamentFormatLabel / getTournamentFormatShortLabel (all 7 formats, including quads)
 *   2. getTournamentStatusDisplay (completed ≠ live, in_progress = live)
 *   3. Draw rate formula (draws / totalGames)
 *   4. Quads tiebreak: calculateQuadStandings uses SB (not Buchholz)
 */

import { describe, it, expect } from "vitest";
import {
  getTournamentFormatLabel,
  getTournamentFormatShortLabel,
  getTournamentStatusDisplay,
} from "../lib/tournamentUtils";
import { calculateQuadStandings } from "../lib/quads";
import type { Player, Game } from "../lib/types";

// ─── 1. Format Labels ─────────────────────────────────────────────────────────
describe("getTournamentFormatLabel", () => {
  it("returns Swiss with round count", () => {
    expect(getTournamentFormatLabel("swiss", 5)).toBe("Swiss · 5R");
  });
  it("returns Swiss without round count", () => {
    expect(getTournamentFormatLabel("swiss")).toBe("Swiss");
  });
  it("returns Double Swiss", () => {
    expect(getTournamentFormatLabel("doubleswiss", 6)).toBe("Double Swiss · 6R");
  });
  it("returns Round Robin", () => {
    expect(getTournamentFormatLabel("roundrobin")).toBe("Round Robin");
  });
  it("returns Elimination", () => {
    expect(getTournamentFormatLabel("elimination")).toBe("Elimination");
  });
  it("returns Swiss+Elim", () => {
    expect(getTournamentFormatLabel("swiss_elim", 4)).toBe("Swiss+Elim · 4R");
  });
  it("returns Quads with round count", () => {
    expect(getTournamentFormatLabel("quads", 3)).toBe("Quads · 3R");
  });
  it("returns Quads with full context", () => {
    expect(getTournamentFormatLabel("quads", 3, 2, 8)).toBe("Quads · 2 Sections · 8 Players · 3R");
  });
  it("returns Quads short label", () => {
    expect(getTournamentFormatShortLabel("quads")).toBe("Quads");
  });
  it("never returns Swiss for quads short label", () => {
    expect(getTournamentFormatShortLabel("quads")).not.toContain("Swiss");
  });
  it("handles unknown format gracefully", () => {
    expect(getTournamentFormatLabel("future_format")).toBe("future_format");
  });
});

// ─── 2. Status Display ────────────────────────────────────────────────────────
describe("getTournamentStatusDisplay", () => {
  it("completed → isLive=false, isComplete=true", () => {
    const s = getTournamentStatusDisplay("completed");
    expect(s.isLive).toBe(false);
    expect(s.isComplete).toBe(true);
    expect(s.label).toBe("Completed");
  });
  it("in_progress → isLive=true, isComplete=false", () => {
    const s = getTournamentStatusDisplay("in_progress");
    expect(s.isLive).toBe(true);
    expect(s.isComplete).toBe(false);
    expect(s.label).toBe("Live");
  });
  it("paused → isLive=false, isComplete=false", () => {
    const s = getTournamentStatusDisplay("paused");
    expect(s.isLive).toBe(false);
    expect(s.isComplete).toBe(false);
  });
  it("registration → isPending=true, isLive=false", () => {
    const s = getTournamentStatusDisplay("registration");
    expect(s.isPending).toBe(true);
    expect(s.isLive).toBe(false);
  });
  it("completed tournament NEVER shows as live", () => {
    const s = getTournamentStatusDisplay("completed");
    expect(s.isLive).toBe(false);
  });
});

// ─── 3. Draw Rate Formula ─────────────────────────────────────────────────────
describe("Draw rate formula", () => {
  /**
   * Simulates the SummaryBanner draw rate calculation.
   * draw rate = draws / (wins + draws + losses)
   */
  function calcDrawRate(wins: number, draws: number, losses: number): number {
    const totalGames = wins + draws + losses;
    return totalGames > 0 ? Math.round((draws / totalGames) * 100) : 0;
  }

  it("1 draw in 6 games = 16.7% ≈ 17%", () => {
    // 4-player quad: 6 games total, 1 draw
    // wins=5, draws=1, losses=0 per player → /2 = wins=2.5, draws=0.5, losses=0
    // But with symmetric results: wins=5, draws=2 (each draw counted twice), losses=5
    // Simplified: totalGames=6, draws=1 → 1/6 = 16.7%
    expect(calcDrawRate(5, 1, 0)).toBe(17); // 1/(5+1+0) = 16.7%
  });
  it("0 draws = 0%", () => {
    expect(calcDrawRate(10, 0, 10)).toBe(0);
  });
  it("all draws = 100%", () => {
    expect(calcDrawRate(0, 6, 0)).toBe(100);
  });
  it("uses total games (wins+draws+losses) not just wins+draws", () => {
    // 2 draws, 3 wins, 5 losses → 2/10 = 20% (not 2/(3+2) = 40%)
    expect(calcDrawRate(3, 2, 5)).toBe(20);
  });
  it("handles zero games gracefully", () => {
    expect(calcDrawRate(0, 0, 0)).toBe(0);
  });
});

// ─── 4. Quads Tiebreak: SB not Buchholz ──────────────────────────────────────
describe("calculateQuadStandings tiebreaks", () => {
  const makePlayer = (id: string, name: string): Player => ({
    id,
    name,
    username: name.toLowerCase(),
    elo: 1500,
    platform: "chesscom",
  });

  const p1 = makePlayer("p1", "Alice");
  const p2 = makePlayer("p2", "Bob");
  const p3 = makePlayer("p3", "Carol");
  const p4 = makePlayer("p4", "Dave");

  const section = {
    id: "s1",
    name: "Section 1",
    type: "quad" as const,
    orderIndex: 0,
    ratingMin: 0,
    ratingMax: 9999,
    playerIds: ["p1", "p2", "p3", "p4"],
    localSeeds: { p1: 1, p2: 2, p3: 3, p4: 4 },
    status: "in_progress" as const,
  };

  // Alice beats Bob, Carol, Dave (3 wins)
  // Bob beats Carol, Dave (2 wins, 1 loss)
  // Carol beats Dave (1 win, 2 losses)
  // Dave loses all (0 wins, 3 losses)
  const games: Game[] = [
    { id: "g1", whiteId: "p1", blackId: "p2", result: "1-0", round: 1, boardNumber: 1, sectionId: "s1" },
    { id: "g2", whiteId: "p3", blackId: "p4", result: "1-0", round: 1, boardNumber: 2, sectionId: "s1" },
    { id: "g3", whiteId: "p2", blackId: "p3", result: "1-0", round: 2, boardNumber: 1, sectionId: "s1" },
    { id: "g4", whiteId: "p1", blackId: "p4", result: "1-0", round: 2, boardNumber: 2, sectionId: "s1" },
    { id: "g5", whiteId: "p1", blackId: "p3", result: "1-0", round: 3, boardNumber: 1, sectionId: "s1" },
    { id: "g6", whiteId: "p2", blackId: "p4", result: "1-0", round: 3, boardNumber: 2, sectionId: "s1" },
  ];

  it("returns standings with sonnebornBerger field (not buchholz)", () => {
    const standings = calculateQuadStandings(
      section,
      games,
      [p1, p2, p3, p4],
      ["sonnebornBerger", "directEncounterScore"]
    );
    expect(standings.length).toBe(4);
    // All standings should have sonnebornBerger
    standings.forEach((s) => {
      expect(s).toHaveProperty("sonnebornBerger");
      expect(s).not.toHaveProperty("buchholz");
    });
  });

  it("ranks Alice first with 3 points", () => {
    const standings = calculateQuadStandings(
      section,
      games,
      [p1, p2, p3, p4],
      ["sonnebornBerger"]
    );
    expect(standings[0].playerId).toBe("p1");
    expect(standings[0].score).toBe(3);
  });

  it("SB tiebreak: Alice has highest SB (beat all opponents)", () => {
    const standings = calculateQuadStandings(
      section,
      games,
      [p1, p2, p3, p4],
      ["sonnebornBerger"]
    );
    const alice = standings.find((s) => s.playerId === "p1")!;
    const bob = standings.find((s) => s.playerId === "p2")!;
    // Alice beat Bob (2pts), Carol (1pt), Dave (0pts) → SB = 2+1+0 = 3
    // Bob beat Carol (1pt), Dave (0pts) → SB = 1+0 = 1
    expect(alice.sonnebornBerger).toBeGreaterThan(bob.sonnebornBerger);
  });
});
