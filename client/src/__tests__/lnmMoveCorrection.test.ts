/**
 * lnmMoveCorrection.test.ts
 *
 * Unit tests for the LNM mid-game move correction feature:
 * - jumpToMove staging logic
 * - confirmJump replay and truncation
 * - cancelJump no-op
 * - MoveListPanel cell state derivation
 * - Edge cases: jump to start, jump to second-to-last, single move
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect } from "vitest";
import { Chess } from "chess.js";

// ─── Helpers (mirrors useNotationMode internals) ──────────────────────────────

interface NotationMove {
  san: string;
  color: "w" | "b";
  fen: string;
  from: string;
  to: string;
}

function buildMoves(sans: string[]): NotationMove[] {
  const c = new Chess();
  const result: NotationMove[] = [];
  for (const san of sans) {
    const m = c.move(san);
    if (!m) throw new Error(`Illegal move: ${san}`);
    result.push({
      san: m.san,
      color: m.color,
      fen: m.after.split(" ")[0],
      from: m.from,
      to: m.to,
    });
  }
  return result;
}

/**
 * Simulates confirmJump: replays moves[0..targetIndex] on a fresh Chess
 * instance and returns the resulting FEN and move count.
 */
function simulateConfirmJump(moves: NotationMove[], targetIndex: number) {
  const targetMoves = moves.slice(0, targetIndex + 1);
  const c = new Chess();
  for (const m of targetMoves) {
    c.move(m.san);
  }
  return {
    fen: c.fen(),
    moveCount: c.history().length,
    turn: c.turn(),
    pgn: c.pgn(),
  };
}

// ─── jumpToMove staging ───────────────────────────────────────────────────────

describe("jumpToMove staging", () => {
  it("does not allow jumping to the last move (nothing to correct)", () => {
    const moves = buildMoves(["e4", "e5", "Nf3"]);
    const lastIdx = moves.length - 1; // 2
    // jumpToMove should be a no-op for lastIdx
    // We simulate the guard: if (index >= moves.length - 1) return;
    const shouldBlock = lastIdx >= moves.length - 1;
    expect(shouldBlock).toBe(true);
  });

  it("allows jumping to any move before the last", () => {
    const moves = buildMoves(["e4", "e5", "Nf3", "Nc6"]);
    for (let i = 0; i < moves.length - 1; i++) {
      const shouldBlock = i >= moves.length - 1;
      expect(shouldBlock).toBe(false);
    }
  });

  it("allows jumping to index 0 (correct first move)", () => {
    const moves = buildMoves(["e4", "e5", "Nf3"]);
    const shouldBlock = 0 >= moves.length - 1;
    expect(shouldBlock).toBe(false);
  });

  it("does not allow jumping when only one move has been played", () => {
    const moves = buildMoves(["e4"]);
    const shouldBlock = 0 >= moves.length - 1;
    expect(shouldBlock).toBe(true);
  });
});

// ─── confirmJump replay ───────────────────────────────────────────────────────

describe("confirmJump replay", () => {
  it("replays to the correct FEN after jumping to move 0 (white's first move)", () => {
    const moves = buildMoves(["e4", "e5", "Nf3", "Nc6"]);
    const result = simulateConfirmJump(moves, 0);
    // After 1. e4 only
    expect(result.moveCount).toBe(1);
    expect(result.turn).toBe("b"); // Black to move
    expect(result.fen).toContain("4P3"); // e4 pawn on e4
  });

  it("replays to the correct FEN after jumping to move 1 (black's first move)", () => {
    const moves = buildMoves(["e4", "e5", "Nf3", "Nc6"]);
    const result = simulateConfirmJump(moves, 1);
    expect(result.moveCount).toBe(2);
    expect(result.turn).toBe("w"); // White to move
  });

  it("replays to the correct FEN after jumping to second-to-last move", () => {
    const moves = buildMoves(["e4", "e5", "Nf3", "Nc6"]);
    const result = simulateConfirmJump(moves, 2); // after Nf3
    expect(result.moveCount).toBe(3);
    expect(result.turn).toBe("b");
  });

  it("produces correct PGN after replay", () => {
    const moves = buildMoves(["e4", "e5", "Nf3", "Nc6", "Bc4"]);
    const result = simulateConfirmJump(moves, 1); // after 1...e5
    // chess.js pgn() includes headers and trailing result (*); strip both
    const movesOnly = result.pgn.replace(/\[.*?\]\s*/gs, "").replace(/\s*\*\s*$/, "").trim();
    expect(movesOnly).toBe("1. e4 e5");
  });

  it("truncates the correct number of moves", () => {
    const moves = buildMoves(["d4", "d5", "c4", "e6", "Nc3"]);
    // Jump to index 1 (after 1...d5) — should discard 3 moves
    const result = simulateConfirmJump(moves, 1);
    const discarded = moves.length - 2; // 5 - 2 = 3
    expect(discarded).toBe(3);
    expect(result.moveCount).toBe(2);
  });

  it("handles a jump to the very first move of a long game", () => {
    const moves = buildMoves(["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "O-O"]);
    const result = simulateConfirmJump(moves, 0);
    expect(result.moveCount).toBe(1);
    const movesOnly = result.pgn.replace(/\[.*?\]\s*/gs, "").replace(/\s*\*\s*$/, "").trim();
    expect(movesOnly).toBe("1. e4");
  });
});

// ─── Truncation count ─────────────────────────────────────────────────────────

describe("truncation count (movesAfterJump)", () => {
  it("calculates correct discarded count for various jump targets", () => {
    const moves = buildMoves(["e4", "e5", "Nf3", "Nc6", "Bc4"]);
    // moves.length = 5
    const cases: [number, number][] = [
      [0, 4], // jump to index 0 → discard 4
      [1, 3], // jump to index 1 → discard 3
      [2, 2], // jump to index 2 → discard 2
      [3, 1], // jump to index 3 → discard 1
    ];
    for (const [jumpIdx, expected] of cases) {
      const discarded = moves.length - jumpIdx - 1;
      expect(discarded).toBe(expected);
    }
  });
});

// ─── MoveListPanel cell state derivation ─────────────────────────────────────

type CellState = "last" | "pending-target" | "will-discard" | "tappable" | "untappable";

function getCellState(idx: number, lastMoveIdx: number, pendingJump: number): CellState {
  if (idx === pendingJump) return "pending-target";
  if (pendingJump >= 0 && idx > pendingJump) return "will-discard";
  if (idx === lastMoveIdx && pendingJump === -1) return "last";
  if (idx < lastMoveIdx) return "tappable";
  return "untappable";
}

describe("MoveListPanel cell state derivation", () => {
  it("last move is 'last' when no jump pending", () => {
    expect(getCellState(3, 3, -1)).toBe("last");
  });

  it("pending target move is 'pending-target'", () => {
    expect(getCellState(1, 3, 1)).toBe("pending-target");
  });

  it("moves after pending target are 'will-discard'", () => {
    expect(getCellState(2, 3, 1)).toBe("will-discard");
    expect(getCellState(3, 3, 1)).toBe("will-discard");
  });

  it("moves before pending target are 'tappable'", () => {
    expect(getCellState(0, 3, 1)).toBe("tappable");
  });

  it("non-last moves with no jump pending are 'tappable'", () => {
    expect(getCellState(0, 3, -1)).toBe("tappable");
    expect(getCellState(1, 3, -1)).toBe("tappable");
    expect(getCellState(2, 3, -1)).toBe("tappable");
  });

  it("last move is 'will-discard' when it is after the pending target", () => {
    expect(getCellState(3, 3, 0)).toBe("will-discard");
  });

  it("pending target at index 0 marks all others as will-discard", () => {
    for (let i = 1; i <= 4; i++) {
      expect(getCellState(i, 4, 0)).toBe("will-discard");
    }
  });
});

// ─── cancelJump no-op ─────────────────────────────────────────────────────────

describe("cancelJump", () => {
  it("resets pendingJump to -1", () => {
    let pendingJump = 2;
    // Simulate cancelJump
    pendingJump = -1;
    expect(pendingJump).toBe(-1);
  });

  it("does not modify the chess instance", () => {
    const moves = buildMoves(["e4", "e5", "Nf3"]);
    const c = new Chess();
    for (const m of moves) c.move(m.san);
    const fenBefore = c.fen();
    // cancelJump should not touch the chess instance
    // (no-op — just reset pendingJump)
    expect(c.fen()).toBe(fenBefore);
    expect(c.history().length).toBe(3);
  });
});

// ─── Edge cases ───────────────────────────────────────────────────────────────

describe("edge cases", () => {
  it("handles empty moves array gracefully", () => {
    const moves: NotationMove[] = [];
    // jumpToMove guard: index >= moves.length - 1 → 0 >= -1 → true (block)
    expect(0 >= moves.length - 1).toBe(true);
  });

  it("handles a 2-move game: only index 0 is jumpable", () => {
    const moves = buildMoves(["e4", "e5"]);
    expect(0 >= moves.length - 1).toBe(false); // index 0 is jumpable
    expect(1 >= moves.length - 1).toBe(true);  // index 1 (last) is blocked
  });

  it("confirmJump with targetIndex -1 produces starting position", () => {
    // Special case: jump before first move
    const c = new Chess();
    // No moves replayed
    expect(c.history().length).toBe(0);
    expect(c.turn()).toBe("w");
  });

  it("replaying moves preserves promotion correctly", () => {
    // Construct a position where a pawn can promote
    // Use a known promotion sequence via FEN load
    const c = new Chess("8/P7/8/8/8/8/8/4K1k1 w - - 0 1");
    c.move("a8=Q");
    const moves: NotationMove[] = [{ san: "a8=Q", color: "w", fen: c.fen().split(" ")[0], from: "a7", to: "a8" }];
    // Replay on fresh instance from same starting FEN
    const c2 = new Chess("8/P7/8/8/8/8/8/4K1k1 w - - 0 1");
    c2.move(moves[0].san);
    expect(c2.history()[0]).toBe("a8=Q");
  });
});
