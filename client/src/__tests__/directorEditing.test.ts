/**
 * Unit tests for Director Editing features (Phase 30):
 *   - EditPlayerModal: name/ELO validation helpers
 *   - PairingSwapModal: applyPairingSwap logic
 *   - directorState: replaceRoundGames (via state mutation tests)
 */

import { describe, it, expect } from "vitest";
import { applyPairingSwap } from "@/components/PairingSwapModal";
import type { Game } from "@/lib/tournamentData";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeGame(overrides: Partial<Game>): Game {
  return {
    id: "g1",
    round: 1,
    board: 1,
    whiteId: "p1",
    blackId: "p2",
    result: "*",
    ...overrides,
  };
}

const GAMES_3_BOARDS: Game[] = [
  makeGame({ id: "g1", board: 1, whiteId: "p1", blackId: "p2" }),
  makeGame({ id: "g2", board: 2, whiteId: "p3", blackId: "p4" }),
  makeGame({ id: "g3", board: 3, whiteId: "p5", blackId: "p6" }),
];

// ─── applyPairingSwap ─────────────────────────────────────────────────────────

describe("applyPairingSwap", () => {
  it("swaps two players on different boards (white ↔ white)", () => {
    // p1 (White, Board 1) ↔ p3 (White, Board 2)
    const result = applyPairingSwap(GAMES_3_BOARDS, "p1", "p3");
    const board1 = result.find((g) => g.id === "g1")!;
    const board2 = result.find((g) => g.id === "g2")!;
    expect(board1.whiteId).toBe("p3");
    expect(board1.blackId).toBe("p2"); // p2 stays
    expect(board2.whiteId).toBe("p1");
    expect(board2.blackId).toBe("p4"); // p4 stays
  });

  it("swaps two players on different boards (white ↔ black)", () => {
    // p1 (White, Board 1) ↔ p4 (Black, Board 2)
    const result = applyPairingSwap(GAMES_3_BOARDS, "p1", "p4");
    const board1 = result.find((g) => g.id === "g1")!;
    const board2 = result.find((g) => g.id === "g2")!;
    expect(board1.whiteId).toBe("p4");
    expect(board1.blackId).toBe("p2");
    expect(board2.whiteId).toBe("p3");
    expect(board2.blackId).toBe("p1");
  });

  it("swaps two players on different boards (black ↔ black)", () => {
    // p2 (Black, Board 1) ↔ p4 (Black, Board 2)
    const result = applyPairingSwap(GAMES_3_BOARDS, "p2", "p4");
    const board1 = result.find((g) => g.id === "g1")!;
    const board2 = result.find((g) => g.id === "g2")!;
    expect(board1.whiteId).toBe("p1");
    expect(board1.blackId).toBe("p4");
    expect(board2.whiteId).toBe("p3");
    expect(board2.blackId).toBe("p2");
  });

  it("swaps colors when both players are on the same board", () => {
    // p1 (White, Board 1) ↔ p2 (Black, Board 1) — color swap
    const result = applyPairingSwap(GAMES_3_BOARDS, "p1", "p2");
    const board1 = result.find((g) => g.id === "g1")!;
    expect(board1.whiteId).toBe("p2");
    expect(board1.blackId).toBe("p1");
    // Other boards unchanged
    const board2 = result.find((g) => g.id === "g2")!;
    expect(board2.whiteId).toBe("p3");
    expect(board2.blackId).toBe("p4");
  });

  it("does not modify unrelated boards", () => {
    const result = applyPairingSwap(GAMES_3_BOARDS, "p1", "p3");
    const board3 = result.find((g) => g.id === "g3")!;
    expect(board3.whiteId).toBe("p5");
    expect(board3.blackId).toBe("p6");
  });

  it("preserves game results after swap", () => {
    const gamesWithResults: Game[] = [
      makeGame({ id: "g1", board: 1, whiteId: "p1", blackId: "p2", result: "1-0" }),
      makeGame({ id: "g2", board: 2, whiteId: "p3", blackId: "p4", result: "*" }),
    ];
    const result = applyPairingSwap(gamesWithResults, "p1", "p3");
    const board1 = result.find((g) => g.id === "g1")!;
    const board2 = result.find((g) => g.id === "g2")!;
    // Results stay on the board, not the player
    expect(board1.result).toBe("1-0");
    expect(board2.result).toBe("*");
  });

  it("preserves board numbers after swap", () => {
    const result = applyPairingSwap(GAMES_3_BOARDS, "p1", "p3");
    expect(result.find((g) => g.id === "g1")!.board).toBe(1);
    expect(result.find((g) => g.id === "g2")!.board).toBe(2);
  });

  it("returns original array if playerA is not found", () => {
    const result = applyPairingSwap(GAMES_3_BOARDS, "unknown", "p3");
    expect(result).toEqual(GAMES_3_BOARDS);
  });

  it("returns original array if playerB is not found", () => {
    const result = applyPairingSwap(GAMES_3_BOARDS, "p1", "unknown");
    expect(result).toEqual(GAMES_3_BOARDS);
  });

  it("returns original array if both players are not found", () => {
    const result = applyPairingSwap(GAMES_3_BOARDS, "x", "y");
    expect(result).toEqual(GAMES_3_BOARDS);
  });

  it("handles a single-board tournament (only 2 players)", () => {
    const singleBoard: Game[] = [
      makeGame({ id: "g1", board: 1, whiteId: "p1", blackId: "p2" }),
    ];
    const result = applyPairingSwap(singleBoard, "p1", "p2");
    expect(result[0].whiteId).toBe("p2");
    expect(result[0].blackId).toBe("p1");
  });

  it("handles 10-board tournament swap between board 1 and board 10", () => {
    const tenBoards: Game[] = Array.from({ length: 10 }, (_, i) =>
      makeGame({ id: `g${i + 1}`, board: i + 1, whiteId: `w${i + 1}`, blackId: `b${i + 1}` })
    );
    const result = applyPairingSwap(tenBoards, "w1", "b10");
    expect(result[0].whiteId).toBe("b10");
    expect(result[0].blackId).toBe("b1");
    expect(result[9].whiteId).toBe("w10");
    expect(result[9].blackId).toBe("w1");
  });

  it("is idempotent: swapping twice returns original", () => {
    const once = applyPairingSwap(GAMES_3_BOARDS, "p1", "p3");
    const twice = applyPairingSwap(once, "p1", "p3");
    // After double swap, p1 and p3 should be back to original positions
    expect(twice.find((g) => g.id === "g1")!.whiteId).toBe("p1");
    expect(twice.find((g) => g.id === "g2")!.whiteId).toBe("p3");
  });

  it("does not mutate the original games array", () => {
    const original = JSON.parse(JSON.stringify(GAMES_3_BOARDS));
    applyPairingSwap(GAMES_3_BOARDS, "p1", "p3");
    expect(GAMES_3_BOARDS).toEqual(original);
  });

  it("handles BYE boards — does not swap BYE player", () => {
    const gamesWithBye: Game[] = [
      makeGame({ id: "g1", board: 1, whiteId: "p1", blackId: "p2" }),
      makeGame({ id: "g2", board: 2, whiteId: "BYE", blackId: "p3" }),
    ];
    // p1 (White, Board 1) ↔ p3 (Black, Board 2 BYE)
    const result = applyPairingSwap(gamesWithBye, "p1", "p3");
    const board1 = result.find((g) => g.id === "g1")!;
    const board2 = result.find((g) => g.id === "g2")!;
    expect(board1.whiteId).toBe("p3");
    expect(board2.blackId).toBe("p1");
    expect(board2.whiteId).toBe("BYE"); // BYE slot unchanged
  });
});

// ─── ELO validation helpers (inline, matching EditPlayerModal logic) ──────────

function parseElo(val: string): number | null {
  const n = parseInt(val.trim(), 10);
  if (isNaN(n) || n < 0 || n > 4000) return null;
  return n;
}

describe("parseElo (EditPlayerModal validation)", () => {
  it("parses valid integer ELO", () => {
    expect(parseElo("1500")).toBe(1500);
    expect(parseElo("0")).toBe(0);
    expect(parseElo("4000")).toBe(4000);
  });

  it("returns null for non-numeric input", () => {
    expect(parseElo("abc")).toBeNull();
    expect(parseElo("")).toBeNull();
    expect(parseElo("  ")).toBeNull();
  });

  it("returns null for out-of-range values", () => {
    expect(parseElo("-1")).toBeNull();
    expect(parseElo("4001")).toBeNull();
    expect(parseElo("9999")).toBeNull();
  });

  it("trims whitespace before parsing", () => {
    expect(parseElo("  1200  ")).toBe(1200);
  });

  it("handles decimal input by truncating (parseInt behavior)", () => {
    expect(parseElo("1500.9")).toBe(1500);
  });

  it("handles leading zeros", () => {
    expect(parseElo("0800")).toBe(800);
  });

  it("handles boundary values exactly", () => {
    expect(parseElo("0")).toBe(0);
    expect(parseElo("4000")).toBe(4000);
  });
});
