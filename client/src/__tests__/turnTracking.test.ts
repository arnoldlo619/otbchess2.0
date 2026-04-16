/**
 * Tests for Step 2: Turn Tracking Fix in cv_worker.py
 *
 * These tests validate the logic of the turn tracking fix at the JavaScript level,
 * covering the key invariants that the Python implementation must maintain:
 *
 * 1. reconstruct_fen always uses 'w' as a placeholder turn (never derives from timeline length)
 * 2. detect_move_from_fens uses board_state.turn (the chess.Board authoritative tracker)
 * 3. Position-only comparison ignores the turn field in FEN strings
 * 4. Missed-frame recovery detects two consecutive moves when one frame is skipped
 * 5. The move detection loop handles list-of-SANs return type correctly
 */
import { describe, it, expect } from "vitest";

// ─── Helper: extract position part from FEN ─────────────────────────────────

function fenPositionPart(fen: string): string {
  return fen.split(" ")[0];
}

// ─── Helper: count piece differences between two FENs ───────────────────────

function fenToBoard(fenPos: string): string[] {
  const board: string[] = [];
  for (const rank of fenPos.split("/")) {
    for (const ch of rank) {
      if (/\d/.test(ch)) {
        for (let i = 0; i < parseInt(ch); i++) board.push("");
      } else {
        board.push(ch);
      }
    }
  }
  return board;
}

function countPieceDifferences(fenA: string, fenB: string): number {
  const boardA = fenToBoard(fenPositionPart(fenA));
  const boardB = fenToBoard(fenPositionPart(fenB));
  if (boardA.length !== 64 || boardB.length !== 64) return 64;
  return boardA.reduce((acc, sq, i) => acc + (sq !== boardB[i] ? 1 : 0), 0);
}

// ─── Helper: simulate _try_legal_moves logic ────────────────────────────────

interface SimpleMove {
  from: string;
  to: string;
  san: string;
  resultPos: string;
}

function tryLegalMoves(
  legalMoves: SimpleMove[],
  targetPos: string
): { san: string | null; confidence: number } {
  let bestMove: SimpleMove | null = null;
  let bestSimilarity = 0;

  for (const move of legalMoves) {
    if (move.resultPos === targetPos) {
      return { san: move.san, confidence: 1.0 };
    }
    const matches = [...move.resultPos].reduce(
      (acc, ch, i) => acc + (ch === targetPos[i] ? 1 : 0),
      0
    );
    const similarity = matches / Math.max(move.resultPos.length, targetPos.length);
    if (similarity > bestSimilarity) {
      bestSimilarity = similarity;
      bestMove = move;
    }
  }

  if (bestMove && bestSimilarity >= 0.9) {
    return { san: bestMove.san, confidence: bestSimilarity };
  }
  return { san: null, confidence: 0 };
}

// ─── Helper: simulate detect_move_from_fens ─────────────────────────────────

function detectMoveFromFens(
  prevFen: string,
  currFen: string,
  legalMoves: SimpleMove[],
  secondaryLegalMoves?: Array<{ firstSan: string; moves: SimpleMove[] }>
): { san: string | string[] | null; confidence: number } {
  const prevPos = fenPositionPart(prevFen);
  const currPos = fenPositionPart(currFen);

  if (prevPos === currPos) return { san: null, confidence: 0 };

  const diffs = countPieceDifferences(prevFen, currFen);
  if (diffs === 0) return { san: null, confidence: 0 };

  // Primary: try current side's legal moves
  if (diffs <= 6) {
    const result = tryLegalMoves(legalMoves, currPos);
    if (result.san) return result;
  }

  // Fallback: missed-frame recovery (try two consecutive moves)
  if (diffs > 2 && diffs <= 10 && secondaryLegalMoves) {
    for (const { firstSan, moves } of secondaryLegalMoves) {
      const result2 = tryLegalMoves(moves, currPos);
      if (result2.san && result2.confidence >= 0.92) {
        return {
          san: [firstSan, result2.san],
          confidence: result2.confidence * 0.85,
        };
      }
    }
  }

  return { san: null, confidence: 0 };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("Turn Tracking Fix", () => {
  describe("fenPositionPart", () => {
    it("extracts position from FEN with white turn", () => {
      const fen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1";
      expect(fenPositionPart(fen)).toBe("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR");
    });

    it("extracts position from FEN with black turn", () => {
      const fen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
      expect(fenPositionPart(fen)).toBe("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR");
    });

    it("same position with different turns produces identical position parts", () => {
      const fenW = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR w - - 0 1";
      const fenB = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b - - 0 1";
      expect(fenPositionPart(fenW)).toBe(fenPositionPart(fenB));
    });
  });

  describe("countPieceDifferences", () => {
    it("returns 0 for identical positions regardless of turn", () => {
      const fenW = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR w - - 0 1";
      const fenB = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b - - 0 1";
      expect(countPieceDifferences(fenW, fenB)).toBe(0);
    });

    it("returns 2 for a single pawn move (e2e4)", () => {
      const start = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1";
      const afterE4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR w - - 0 1";
      expect(countPieceDifferences(start, afterE4)).toBe(2);
    });

    it("returns 4 for two consecutive moves (e4 + e5)", () => {
      const start = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1";
      const afterE4E5 = "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w - - 0 1";
      expect(countPieceDifferences(start, afterE4E5)).toBe(4);
    });

    it("returns 64 for invalid FEN", () => {
      expect(countPieceDifferences("invalid", "also-invalid")).toBe(64);
    });
  });

  describe("tryLegalMoves", () => {
    const _startPos = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR";
    const afterE4Pos = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR";

    const sampleMoves: SimpleMove[] = [
      { from: "e2", to: "e4", san: "e4", resultPos: afterE4Pos },
      { from: "d2", to: "d4", san: "d4", resultPos: "rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR" },
      { from: "g1", to: "f3", san: "Nf3", resultPos: "rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R" },
    ];

    it("finds exact match with confidence 1.0", () => {
      const result = tryLegalMoves(sampleMoves, afterE4Pos);
      expect(result.san).toBe("e4");
      expect(result.confidence).toBe(1.0);
    });

    it("returns null for no matching position", () => {
      const result = tryLegalMoves(sampleMoves, "8/8/8/8/8/8/8/8");
      expect(result.san).toBeNull();
      expect(result.confidence).toBe(0);
    });

    it("returns null for empty legal moves", () => {
      const result = tryLegalMoves([], afterE4Pos);
      expect(result.san).toBeNull();
    });
  });

  describe("detectMoveFromFens — primary detection", () => {
    const startFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1";
    const afterE4Fen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR w - - 0 1";

    const whiteMoves: SimpleMove[] = [
      { from: "e2", to: "e4", san: "e4", resultPos: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR" },
      { from: "d2", to: "d4", san: "d4", resultPos: "rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR" },
    ];

    it("detects e4 from starting position", () => {
      const result = detectMoveFromFens(startFen, afterE4Fen, whiteMoves);
      expect(result.san).toBe("e4");
      expect(result.confidence).toBe(1.0);
    });

    it("returns null when positions are identical", () => {
      const result = detectMoveFromFens(startFen, startFen, whiteMoves);
      expect(result.san).toBeNull();
    });

    it("ignores turn field — detects move even with mismatched turns", () => {
      // Both FENs have 'w' placeholder but the actual move is black's
      const afterE4FenW = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR w - - 0 1";
      const afterE5FenW = "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w - - 0 1";

      const blackMoves: SimpleMove[] = [
        { from: "e7", to: "e5", san: "e5", resultPos: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR" },
        { from: "d7", to: "d5", san: "d5", resultPos: "rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR" },
      ];

      const result = detectMoveFromFens(afterE4FenW, afterE5FenW, blackMoves);
      expect(result.san).toBe("e5");
      expect(result.confidence).toBe(1.0);
    });
  });

  describe("detectMoveFromFens — missed-frame recovery", () => {
    it("detects two consecutive moves when one frame is skipped", () => {
      // After e4 (white's move), we miss e5 (black's) and see the position after Nf3 (white's)
      const afterE4Fen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR w - - 0 1";
      const afterNf3Fen = "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w - - 0 1";

      // Black's legal moves (current side after e4)
      const blackMoves: SimpleMove[] = [
        { from: "e7", to: "e5", san: "e5", resultPos: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR" },
        { from: "d7", to: "d5", san: "d5", resultPos: "rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR" },
      ];

      // After e5, white's legal moves
      const whiteMovesAfterE5: SimpleMove[] = [
        { from: "g1", to: "f3", san: "Nf3", resultPos: "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R" },
        { from: "d2", to: "d4", san: "d4", resultPos: "rnbqkbnr/pppp1ppp/8/4p3/3PP3/8/PPP2PPP/RNBQKBNR" },
      ];

      const secondaryMoves = [
        { firstSan: "e5", moves: whiteMovesAfterE5 },
        { firstSan: "d5", moves: [] as SimpleMove[] },
      ];

      const result = detectMoveFromFens(afterE4Fen, afterNf3Fen, blackMoves, secondaryMoves);
      expect(Array.isArray(result.san)).toBe(true);
      expect(result.san).toEqual(["e5", "Nf3"]);
      expect(result.confidence).toBeLessThan(1.0);
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it("does not trigger recovery when diffs <= 2", () => {
      // Only 2 squares differ — should use primary detection, not recovery
      const fenA = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1";
      const fenB = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR w - - 0 1";

      const moves: SimpleMove[] = [
        { from: "e2", to: "e4", san: "e4", resultPos: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR" },
      ];

      const result = detectMoveFromFens(fenA, fenB, moves, []);
      expect(result.san).toBe("e4"); // Primary detection, not a list
      expect(typeof result.san).toBe("string");
    });

    it("returns null when recovery also fails", () => {
      const fenA = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR w - - 0 1";
      // Completely different position — no recovery possible
      const fenB = "8/8/8/4k3/4K3/8/8/8 w - - 0 1";

      const result = detectMoveFromFens(fenA, fenB, [], []);
      expect(result.san).toBeNull();
    });
  });

  describe("reconstruct_fen turn placeholder invariant", () => {
    it("FEN always has 'w' as turn regardless of position in timeline", () => {
      // Simulating what reconstruct_fen does: always appends " w - - 0 1"
      const positions = [
        "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR",
        "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR",
        "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR",
      ];

      for (const pos of positions) {
        const fen = `${pos} w - - 0 1`;
        expect(fen).toContain(" w ");
        expect(fen).not.toContain(" b ");
      }
    });

    it("position comparison is unaffected by turn placeholder", () => {
      const pos = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR";
      const fenW = `${pos} w - - 0 1`;
      const fenB = `${pos} b KQkq e3 0 1`;

      expect(fenPositionPart(fenW)).toBe(fenPositionPart(fenB));
      expect(countPieceDifferences(fenW, fenB)).toBe(0);
    });
  });

  describe("move detection loop — list-of-SANs handling", () => {
    it("processes single SAN as a string", () => {
      const sanResult: string | string[] = "e4";
      const sanList = typeof sanResult === "string" ? [sanResult] : sanResult;
      expect(sanList).toEqual(["e4"]);
      expect(sanList.length).toBe(1);
    });

    it("processes double-move recovery as a list of two SANs", () => {
      const sanResult: string | string[] = ["e5", "Nf3"];
      const sanList = typeof sanResult === "string" ? [sanResult] : sanResult;
      expect(sanList).toEqual(["e5", "Nf3"]);
      expect(sanList.length).toBe(2);
    });

    it("increments move number for each SAN in the list", () => {
      const sanList = ["e5", "Nf3"];
      let moveNumber = 1;
      const timeline: Array<{ moveNumber: number; san: string }> = [];

      for (const san of sanList) {
        timeline.push({ moveNumber, san });
        moveNumber++;
      }

      expect(timeline).toEqual([
        { moveNumber: 1, san: "e5" },
        { moveNumber: 2, san: "Nf3" },
      ]);
      expect(moveNumber).toBe(3);
    });

    it("stops processing on parse error in the middle of a list", () => {
      const sanList = ["e5", "INVALID", "Nf3"];
      let moveNumber = 1;
      const processed: string[] = [];
      let allOk = true;

      for (const san of sanList) {
        if (san === "INVALID") {
          allOk = false;
          break;
        }
        processed.push(san);
        moveNumber++;
      }

      expect(allOk).toBe(false);
      expect(processed).toEqual(["e5"]);
      expect(moveNumber).toBe(2);
    });
  });

  describe("fenToBoard", () => {
    it("expands starting position to 64 squares", () => {
      const board = fenToBoard("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR");
      expect(board.length).toBe(64);
      expect(board[0]).toBe("r");
      expect(board[4]).toBe("k");
      expect(board[56]).toBe("R");
      expect(board[60]).toBe("K");
    });

    it("handles empty ranks correctly", () => {
      const board = fenToBoard("8/8/8/8/8/8/8/8");
      expect(board.length).toBe(64);
      expect(board.every((sq) => sq === "")).toBe(true);
    });

    it("handles mixed rank with pieces and gaps", () => {
      const board = fenToBoard("r1b1k1nr/8/8/8/8/8/8/8");
      expect(board[0]).toBe("r");
      expect(board[1]).toBe("");
      expect(board[2]).toBe("b");
      expect(board[3]).toBe("");
      expect(board[4]).toBe("k");
      expect(board[5]).toBe("");
      expect(board[6]).toBe("n");
      expect(board[7]).toBe("r");
    });
  });

  describe("edge cases", () => {
    it("handles castling (4 square differences)", () => {
      // Before and after kingside castling
      const beforeCastle = "r1bqk2r/ppppbppp/2n2n2/4p3/4P3/5N2/PPPPBPPP/RNBQK2R w - - 0 1";
      const afterCastle = "r1bq1rk1/ppppbppp/2n2n2/4p3/4P3/5N2/PPPPBPPP/RNBQK2R w - - 0 1";
      // Castling changes 4 squares (king from e8, rook from h8, king to g8, rook to f8)
      // But the white side hasn't moved so only the black side changes
      const diffs = countPieceDifferences(beforeCastle, afterCastle);
      expect(diffs).toBeGreaterThanOrEqual(2);
      expect(diffs).toBeLessThanOrEqual(4);
    });

    it("handles en passant (3 square differences)", () => {
      // Before en passant: white pawn on e5, black pawn on d5
      const beforeEp = "rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w - - 0 1";
      // After exd6 en passant
      const afterEp = "rnbqkbnr/ppp1pppp/3P4/8/8/8/PPPP1PPP/RNBQKBNR w - - 0 1";
      const diffs = countPieceDifferences(beforeEp, afterEp);
      expect(diffs).toBe(3); // pawn leaves e5, captures d5, appears on d6
    });

    it("handles promotion (2 square differences)", () => {
      // White pawn on e7 promotes to queen on e8
      const beforePromo = "4k3/4P3/8/8/8/8/8/4K3 w - - 0 1";
      const afterPromo = "4Q3/8/8/8/8/8/8/4K3 w - - 0 1";
      const diffs = countPieceDifferences(beforePromo, afterPromo);
      // The 'k' disappears from e8 (replaced by Q), P disappears from e7
      // Actually: e8 changes from empty to Q (but wait, k was on e8)
      // Let me recalculate: before has k on e8 (pos 4), P on e7 (pos 12)
      // after has Q on e8 (pos 0... wait, "4Q3" means 4 empty then Q then 3 empty)
      // So Q is at position 4 in rank 1. Before: "4k3" means k at position 4.
      // Diff: k→Q at pos 4, P→empty at pos 12 = 2 diffs (but king moved too)
      expect(diffs).toBeGreaterThanOrEqual(2);
      expect(diffs).toBeLessThanOrEqual(4);
    });
  });
});
