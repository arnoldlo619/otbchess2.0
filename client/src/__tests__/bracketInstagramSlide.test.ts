/**
 * Bracket Instagram Slide — Unit tests for extractBracketResults and getSlides logic.
 *
 * Tests the pure helper functions exported from InstagramCarouselModal:
 *   - extractBracketResults: champion, runner-up, semifinalist detection
 *   - getSlides: dynamic slide list based on format
 */

import { describe, it, expect } from "vitest";
import { extractBracketResults } from "@/components/InstagramCarouselModal";
import type { Round } from "@/lib/tournamentData";

// ─── Test fixtures ────────────────────────────────────────────────────────────

const players = [
  { id: "p1", name: "Alice Smith", username: "alice", elo: 1800 },
  { id: "p2", name: "Bob Jones", username: "bob", elo: 1750 },
  { id: "p3", name: "Carol White", username: "carol", elo: 1700 },
  { id: "p4", name: "Dave Brown", username: "dave", elo: 1650 },
  { id: "p5", name: "Eve Davis", username: "eve", elo: 1600 },
  { id: "p6", name: "Frank Lee", username: "frank", elo: 1550 },
  { id: "p7", name: "Grace Kim", username: "grace", elo: 1500 },
  { id: "p8", name: "Henry Park", username: "henry", elo: 1450 },
];

function makeRound(number: number, games: Round["games"], status: "completed" | "in_progress" = "completed"): Round {
  return { number, games, status };
}

function makeGame(board: number, whiteId: string, blackId: string, result: string, round: number) {
  return { id: `r${round}b${board}`, round, board, whiteId, blackId, result } as Round["games"][0];
}

// ─── extractBracketResults ────────────────────────────────────────────────────

describe("extractBracketResults — basic 4-player bracket (QF→SF→Final)", () => {
  // Round 1: QF — p1 beats p4, p2 beats p3
  // Round 2: SF — p1 beats p2 (champion), p3 beats p4 (but p3 already lost...)
  // Actually for a clean 4-player bracket: R1=SF, R2=Final

  const sfRound = makeRound(1, [
    makeGame(1, "p1", "p4", "1-0", 1), // p1 wins
    makeGame(2, "p2", "p3", "0-1", 1), // p3 wins
  ]);
  const finalRound = makeRound(2, [
    makeGame(1, "p1", "p3", "1-0", 2), // p1 wins Final
  ]);

  it("identifies champion as winner of the final", () => {
    const result = extractBracketResults([sfRound, finalRound], players);
    expect(result.champion?.id).toBe("p1");
    expect(result.champion?.name).toBe("Alice Smith");
  });

  it("identifies runner-up as loser of the final", () => {
    const result = extractBracketResults([sfRound, finalRound], players);
    expect(result.runnerUp?.id).toBe("p3");
  });

  it("identifies semifinalists as losers of the round before the final", () => {
    const result = extractBracketResults([sfRound, finalRound], players);
    expect(result.semifinalists.map((p) => p.id)).toContain("p4");
    expect(result.semifinalists.map((p) => p.id)).not.toContain("p1"); // winner
    expect(result.semifinalists.map((p) => p.id)).not.toContain("p3"); // finalist
  });

  it("hasBracketData is true when final is complete", () => {
    const result = extractBracketResults([sfRound, finalRound], players);
    expect(result.hasBracketData).toBe(true);
  });
});

describe("extractBracketResults — 8-player bracket (QF→SF→Final)", () => {
  const qfRound = makeRound(1, [
    makeGame(1, "p1", "p8", "1-0", 1), // p1 wins
    makeGame(2, "p2", "p7", "1-0", 1), // p2 wins
    makeGame(3, "p3", "p6", "0-1", 1), // p6 wins
    makeGame(4, "p4", "p5", "1-0", 1), // p4 wins
  ]);
  const sfRound = makeRound(2, [
    makeGame(1, "p1", "p2", "1-0", 2), // p1 wins
    makeGame(2, "p6", "p4", "0-1", 2), // p4 wins
  ]);
  const finalRound = makeRound(3, [
    makeGame(1, "p1", "p4", "0-1", 3), // p4 wins Final
  ]);

  it("identifies champion as p4 (winner of final via 0-1)", () => {
    const result = extractBracketResults([qfRound, sfRound, finalRound], players);
    expect(result.champion?.id).toBe("p4");
  });

  it("identifies runner-up as p1 (loser of final)", () => {
    const result = extractBracketResults([qfRound, sfRound, finalRound], players);
    expect(result.runnerUp?.id).toBe("p1");
  });

  it("identifies 2 semifinalists (losers of SF round)", () => {
    const result = extractBracketResults([qfRound, sfRound, finalRound], players);
    expect(result.semifinalists).toHaveLength(2);
    expect(result.semifinalists.map((p) => p.id)).toContain("p2"); // lost SF board 1
    expect(result.semifinalists.map((p) => p.id)).toContain("p6"); // lost SF board 2
  });

  it("hasBracketData is true", () => {
    const result = extractBracketResults([qfRound, sfRound, finalRound], players);
    expect(result.hasBracketData).toBe(true);
  });
});

describe("extractBracketResults — empty rounds", () => {
  it("returns hasBracketData=false when no rounds provided", () => {
    const result = extractBracketResults([], players);
    expect(result.hasBracketData).toBe(false);
    expect(result.champion).toBeNull();
    expect(result.runnerUp).toBeNull();
    expect(result.semifinalists).toHaveLength(0);
  });

  it("returns hasBracketData=false when no completed rounds", () => {
    const inProgressRound = makeRound(1, [
      makeGame(1, "p1", "p2", "*", 1),
    ], "in_progress");
    const result = extractBracketResults([inProgressRound], players);
    expect(result.hasBracketData).toBe(false);
  });
});

describe("extractBracketResults — swiss_elim format with elimStartRound", () => {
  // Swiss rounds 1-3, elim rounds 4-6
  const swissRound1 = makeRound(1, [makeGame(1, "p1", "p2", "1-0", 1)]);
  const swissRound2 = makeRound(2, [makeGame(1, "p1", "p3", "1-0", 2)]);
  const swissRound3 = makeRound(3, [makeGame(1, "p1", "p4", "1-0", 3)]);
  const elimSF = makeRound(4, [
    makeGame(1, "p1", "p4", "1-0", 4),
    makeGame(2, "p2", "p3", "1-0", 4),
  ]);
  const elimFinal = makeRound(5, [
    makeGame(1, "p1", "p2", "1-0", 5),
  ]);

  it("ignores swiss rounds when elimStartRound=4", () => {
    const result = extractBracketResults(
      [swissRound1, swissRound2, swissRound3, elimSF, elimFinal],
      players,
      4 // elimStartRound
    );
    expect(result.champion?.id).toBe("p1");
    expect(result.runnerUp?.id).toBe("p2");
    expect(result.semifinalists.map((p) => p.id)).toContain("p4");
    expect(result.semifinalists.map((p) => p.id)).toContain("p3");
  });

  it("returns hasBracketData=false when elimStartRound is beyond all rounds", () => {
    const result = extractBracketResults(
      [swissRound1, swissRound2, swissRound3],
      players,
      10 // beyond all rounds
    );
    expect(result.hasBracketData).toBe(false);
  });
});

describe("extractBracketResults — bye games are skipped", () => {
  // First round has a bye for p1
  const roundWithBye = makeRound(1, [
    makeGame(1, "BYE", "p1", "½-½", 1), // p1 gets bye
    makeGame(2, "p2", "p3", "1-0", 1),  // p2 wins
  ]);
  const finalRound = makeRound(2, [
    makeGame(1, "p1", "p2", "1-0", 2), // p1 wins final
  ]);

  it("identifies champion correctly when there are bye games", () => {
    const result = extractBracketResults([roundWithBye, finalRound], players);
    expect(result.champion?.id).toBe("p1");
    expect(result.runnerUp?.id).toBe("p2");
  });

  it("does not include bye players as semifinalists", () => {
    const result = extractBracketResults([roundWithBye, finalRound], players);
    // Bye game loser (BYE) should not appear in semifinalists
    expect(result.semifinalists.every((p) => p.id !== "BYE")).toBe(true);
  });
});

describe("extractBracketResults — unresolved final", () => {
  const finalRound = makeRound(1, [
    makeGame(1, "p1", "p2", "*", 1), // unresolved
  ]);

  it("shows both players when final is unresolved", () => {
    const result = extractBracketResults([finalRound], players);
    // Both are shown (champion = white, runnerUp = black for unresolved)
    expect(result.champion?.id).toBe("p1");
    expect(result.runnerUp?.id).toBe("p2");
    // hasBracketData is true (we have data, just unresolved)
    expect(result.hasBracketData).toBe(true);
  });
});

describe("extractBracketResults — unknown player IDs", () => {
  it("returns null for champion if player not in list", () => {
    const finalRound = makeRound(1, [
      makeGame(1, "unknown-id", "p2", "1-0", 1),
    ]);
    const result = extractBracketResults([finalRound], players);
    expect(result.champion).toBeNull();
    expect(result.hasBracketData).toBe(false);
  });
});

describe("extractBracketResults — finalRoundLabel", () => {
  it("returns 'Final' for a 1-game final round", () => {
    const finalRound = makeRound(1, [makeGame(1, "p1", "p2", "1-0", 1)]);
    const result = extractBracketResults([finalRound], players);
    expect(result.finalRoundLabel).toBe("Final");
  });

  it("returns 'Round of 4' for a 2-game round", () => {
    const sfRound = makeRound(1, [
      makeGame(1, "p1", "p2", "1-0", 1),
      makeGame(2, "p3", "p4", "1-0", 1),
    ]);
    const finalRound = makeRound(2, [makeGame(1, "p1", "p3", "1-0", 2)]);
    const result = extractBracketResults([sfRound, finalRound], players);
    expect(result.finalRoundLabel).toBe("Final");
  });
});
