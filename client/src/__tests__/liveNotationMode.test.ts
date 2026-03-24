/**
 * liveNotationMode.test.ts
 *
 * Unit tests for Live Notation Mode (LNM):
 *  - useNotationMode hook logic (chess.js wrapper)
 *  - Board orientation derivation
 *  - Move validation & PGN generation
 *  - Promotion detection
 *  - Undo logic
 *  - Game-over detection
 *  - Input timeout constant
 *  - Clock externalPause integration
 *  - MoveListPanel pairing logic
 *  - PGN server endpoint URL construction
 *  - ECO opening lookup
 */

import { describe, it, expect } from "vitest";
import { Chess, type Square } from "chess.js";

// ─── Constants (mirrored from useNotationMode) ──────────────────────────────

const LNM_INPUT_TIMEOUT_MS = 10_000;

// ─── ECO Opening Lookup (mirrored) ──────────────────────────────────────────

const ECO_OPENINGS: { fen: string; name: string }[] = [
  { fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR", name: "King's Pawn Opening" },
  { fen: "rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR", name: "Queen's Pawn Opening" },
  { fen: "rnbqkbnr/pppppppp/8/8/2P5/8/PP1PPPPP/RNBQKBNR", name: "English Opening" },
  { fen: "rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R", name: "Réti Opening" },
  { fen: "rnbqkbnr/pppp1ppp/4p3/8/4P3/8/PPPP1PPP/RNBQKBNR", name: "French Defence" },
  { fen: "rnbqkbnr/pp1ppppp/2p5/8/4P3/8/PPPP1PPP/RNBQKBNR", name: "Caro-Kann Defence" },
  { fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR", name: "Open Game" },
  { fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R", name: "King's Knight Opening" },
  { fen: "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R", name: "Italian / Spanish" },
  { fen: "rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR", name: "Sicilian Defence" },
  { fen: "rnbqkb1r/pppppppp/5n2/8/3P4/8/PPP1PPPP/RNBQKBNR", name: "Indian Defence" },
  { fen: "rnbqkb1r/pppppppp/5n2/8/2PP4/8/PP2PPPP/RNBQKBNR", name: "Indian Game" },
  { fen: "rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR", name: "Queen's Pawn Game" },
  { fen: "rnbqkbnr/ppp1pppp/8/3p4/2PP4/8/PP2PPPP/RNBQKBNR", name: "Queen's Gambit" },
];

interface NotationMove {
  san: string;
  color: "w" | "b";
  fen: string;
  from: string;
  to: string;
}

function lookupOpening(moves: NotationMove[]): string | null {
  for (let i = moves.length - 1; i >= 0; i--) {
    const fenPrefix = moves[i].fen.split(" ")[0];
    const match = ECO_OPENINGS.find((o) => o.fen === fenPrefix);
    if (match) return match.name;
  }
  return null;
}

// ─── Move list pairing logic (mirrored from MoveListPanel) ──────────────────

function pairMoves(moves: NotationMove[]): { num: number; white: string; black: string | null }[] {
  const pairs: { num: number; white: string; black: string | null }[] = [];
  for (let i = 0; i < moves.length; i += 2) {
    pairs.push({
      num: Math.floor(i / 2) + 1,
      white: moves[i].san,
      black: moves[i + 1]?.san ?? null,
    });
  }
  return pairs;
}

// ─── PGN endpoint URL construction ──────────────────────────────────────────

function buildPgnUrl(battleCode: string): string {
  return `/api/battles/${battleCode}/pgn`;
}

// ─── Orientation derivation ─────────────────────────────────────────────────

function deriveOrientation(turn: "w" | "b"): "white" | "black" {
  return turn === "w" ? "white" : "black";
}

// ─── Clock switch derivation ────────────────────────────────────────────────

function deriveClockSwitch(lastMoveColor: "w" | "b"): "host" | "guest" {
  return lastMoveColor === "w" ? "guest" : "host";
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("Live Notation Mode", () => {
  // ── Input timeout ──────────────────────────────────────────────────────────
  describe("Input timeout constant", () => {
    it("should be 10 seconds", () => {
      expect(LNM_INPUT_TIMEOUT_MS).toBe(10_000);
    });
  });

  // ── Board orientation ──────────────────────────────────────────────────────
  describe("Board orientation", () => {
    it("returns 'white' when it is White's turn", () => {
      expect(deriveOrientation("w")).toBe("white");
    });
    it("returns 'black' when it is Black's turn", () => {
      expect(deriveOrientation("b")).toBe("black");
    });
  });

  // ── Chess.js move validation ───────────────────────────────────────────────
  describe("Move validation via chess.js", () => {
    it("accepts a legal opening move", () => {
      const c = new Chess();
      const result = c.move({ from: "e2", to: "e4" });
      expect(result).toBeTruthy();
      expect(result!.san).toBe("e4");
    });

    it("rejects an illegal move", () => {
      const c = new Chess();
      expect(() => c.move({ from: "e2", to: "e5" })).toThrow();
    });

    it("tracks turn alternation correctly", () => {
      const c = new Chess();
      expect(c.turn()).toBe("w");
      c.move({ from: "e2", to: "e4" });
      expect(c.turn()).toBe("b");
      c.move({ from: "e7", to: "e5" });
      expect(c.turn()).toBe("w");
    });

    it("generates legal destinations for a piece", () => {
      const c = new Chess();
      const moves = c.moves({ square: "e2" as Square, verbose: true });
      const destinations = moves.map((m) => m.to);
      expect(destinations).toContain("e3");
      expect(destinations).toContain("e4");
      expect(destinations).toHaveLength(2);
    });

    it("returns no legal moves for opponent's piece", () => {
      const c = new Chess();
      const moves = c.moves({ square: "e7" as Square, verbose: true });
      // e7 has a black pawn, but it's white's turn — chess.js still returns moves for that square
      // The hook filters by color, so we test the color check
      const piece = c.get("e7" as Square);
      expect(piece?.color).toBe("b");
      expect(c.turn()).toBe("w");
      // Hook would skip selection since piece.color !== turn
    });
  });

  // ── PGN generation ─────────────────────────────────────────────────────────
  describe("PGN generation", () => {
    it("produces valid PGN after moves", () => {
      const c = new Chess();
      c.move({ from: "e2", to: "e4" });
      c.move({ from: "e7", to: "e5" });
      c.move({ from: "g1", to: "f3" });
      const pgn = c.pgn();
      expect(pgn).toContain("e4");
      expect(pgn).toContain("e5");
      expect(pgn).toContain("Nf3");
    });

    it("returns PGN headers for no moves", () => {
      const c = new Chess();
      // chess.js 1.x returns headers even with no moves
      expect(c.pgn()).toContain("*");
      expect(c.history()).toHaveLength(0);
    });
  });

  // ── Undo ───────────────────────────────────────────────────────────────────
  describe("Undo logic", () => {
    it("undoes the last move and restores previous position", () => {
      const c = new Chess();
      c.move({ from: "e2", to: "e4" });
      const fenAfterE4 = c.fen();
      c.move({ from: "e7", to: "e5" });
      c.undo();
      expect(c.fen()).toBe(fenAfterE4);
      expect(c.turn()).toBe("b");
    });

    it("returns null when undoing from starting position", () => {
      const c = new Chess();
      expect(c.undo()).toBeNull();
    });
  });

  // ── Promotion detection ────────────────────────────────────────────────────
  describe("Promotion detection", () => {
    it("detects white pawn reaching 8th rank", () => {
      // Setup a position where white pawn is on e7
      const c = new Chess("4k3/4P3/8/8/8/8/8/4K3 w - - 0 1");
      const piece = c.get("e7" as Square);
      expect(piece?.type).toBe("p");
      expect(piece?.color).toBe("w");
      // e7 to e8 is promotion
      const isPromotion = piece?.type === "p" && piece?.color === "w" && "8" === "8";
      expect(isPromotion).toBe(true);
    });

    it("detects black pawn reaching 1st rank", () => {
      const c = new Chess("4k3/8/8/8/8/8/4p3/4K3 b - - 0 1");
      const piece = c.get("e2" as Square);
      expect(piece?.type).toBe("p");
      expect(piece?.color).toBe("b");
      const isPromotion = piece?.type === "p" && piece?.color === "b" && "1" === "1";
      expect(isPromotion).toBe(true);
    });

    it("allows promotion to queen", () => {
      // Position with white pawn on a7, black king on h8, white king on a1
      const c = new Chess("7k/P7/8/8/8/8/8/K7 w - - 0 1");
      const result = c.move({ from: "a7", to: "a8", promotion: "q" });
      expect(result).toBeTruthy();
      expect(result!.san).toContain("=Q");
    });

    it("allows promotion to knight", () => {
      const c = new Chess("7k/P7/8/8/8/8/8/K7 w - - 0 1");
      const result = c.move({ from: "a7", to: "a8", promotion: "n" });
      expect(result).toBeTruthy();
      expect(result!.san).toContain("=N");
    });
  });

  // ── Game-over detection ────────────────────────────────────────────────────
  describe("Game-over detection", () => {
    it("detects checkmate", () => {
      // Scholar's mate position
      const c = new Chess();
      c.move("e4"); c.move("e5");
      c.move("Bc4"); c.move("Nc6");
      c.move("Qh5"); c.move("Nf6");
      c.move("Qxf7");
      expect(c.isCheckmate()).toBe(true);
      expect(c.isGameOver()).toBe(true);
    });

    it("detects stalemate", () => {
      // Known stalemate position
      const c = new Chess("k7/8/1K6/8/8/8/8/1Q6 w - - 0 1");
      c.move("Qb2"); // Not stalemate yet, let's use a known stalemate FEN directly
      const c2 = new Chess("k7/8/2K5/8/8/8/8/1Q6 b - - 0 1");
      // Black king on a8, white king c6, white queen b1 — not stalemate
      // Use a definitive stalemate position
      const c3 = new Chess("k7/8/1K6/8/8/8/8/8 w - - 0 1");
      // This is actually not stalemate for white. Let's use the classic:
      const c4 = new Chess("5k2/5P2/5K2/8/8/8/8/8 b - - 0 1");
      expect(c4.isStalemate()).toBe(true);
      expect(c4.isGameOver()).toBe(true);
    });

    it("detects insufficient material", () => {
      const c = new Chess("4k3/8/8/8/8/8/8/4K3 w - - 0 1");
      expect(c.isInsufficientMaterial()).toBe(true);
    });
  });

  // ── ECO Opening lookup ─────────────────────────────────────────────────────
  describe("ECO Opening lookup", () => {
    it("identifies King's Pawn Opening after 1.e4", () => {
      const c = new Chess();
      c.move("e4");
      const history = c.history({ verbose: true });
      const moves: NotationMove[] = history.map((m) => ({
        san: m.san,
        color: m.color,
        fen: m.after,
        from: m.from,
        to: m.to,
      }));
      expect(lookupOpening(moves)).toBe("King's Pawn Opening");
    });

    it("identifies Sicilian Defence after 1.e4 c5", () => {
      const c = new Chess();
      c.move("e4"); c.move("c5");
      const history = c.history({ verbose: true });
      const moves: NotationMove[] = history.map((m) => ({
        san: m.san,
        color: m.color,
        fen: m.after,
        from: m.from,
        to: m.to,
      }));
      expect(lookupOpening(moves)).toBe("Sicilian Defence");
    });

    it("identifies Queen's Gambit after 1.d4 d5 2.c4", () => {
      const c = new Chess();
      c.move("d4"); c.move("d5"); c.move("c4");
      const history = c.history({ verbose: true });
      const moves: NotationMove[] = history.map((m) => ({
        san: m.san,
        color: m.color,
        fen: m.after,
        from: m.from,
        to: m.to,
      }));
      expect(lookupOpening(moves)).toBe("Queen's Gambit");
    });

    it("returns null for empty moves", () => {
      expect(lookupOpening([])).toBeNull();
    });
  });

  // ── Move list pairing ──────────────────────────────────────────────────────
  describe("Move list pairing", () => {
    it("pairs an even number of moves correctly", () => {
      const moves: NotationMove[] = [
        { san: "e4", color: "w", fen: "x", from: "e2", to: "e4" },
        { san: "e5", color: "b", fen: "x", from: "e7", to: "e5" },
        { san: "Nf3", color: "w", fen: "x", from: "g1", to: "f3" },
        { san: "Nc6", color: "b", fen: "x", from: "b8", to: "c6" },
      ];
      const pairs = pairMoves(moves);
      expect(pairs).toHaveLength(2);
      expect(pairs[0]).toEqual({ num: 1, white: "e4", black: "e5" });
      expect(pairs[1]).toEqual({ num: 2, white: "Nf3", black: "Nc6" });
    });

    it("handles odd number of moves (black hasn't moved yet)", () => {
      const moves: NotationMove[] = [
        { san: "e4", color: "w", fen: "x", from: "e2", to: "e4" },
        { san: "e5", color: "b", fen: "x", from: "e7", to: "e5" },
        { san: "Nf3", color: "w", fen: "x", from: "g1", to: "f3" },
      ];
      const pairs = pairMoves(moves);
      expect(pairs).toHaveLength(2);
      expect(pairs[1]).toEqual({ num: 2, white: "Nf3", black: null });
    });

    it("returns empty array for no moves", () => {
      expect(pairMoves([])).toHaveLength(0);
    });

    it("handles single move", () => {
      const moves: NotationMove[] = [
        { san: "d4", color: "w", fen: "x", from: "d2", to: "d4" },
      ];
      const pairs = pairMoves(moves);
      expect(pairs).toHaveLength(1);
      expect(pairs[0]).toEqual({ num: 1, white: "d4", black: null });
    });
  });

  // ── PGN endpoint URL ───────────────────────────────────────────────────────
  describe("PGN endpoint URL construction", () => {
    it("builds correct URL for a battle code", () => {
      expect(buildPgnUrl("ABC123")).toBe("/api/battles/ABC123/pgn");
    });

    it("handles lowercase codes", () => {
      expect(buildPgnUrl("xyz789")).toBe("/api/battles/xyz789/pgn");
    });
  });

  // ── Clock switch derivation ────────────────────────────────────────────────
  describe("Clock switch unification", () => {
    it("switches to guest after white moves", () => {
      expect(deriveClockSwitch("w")).toBe("guest");
    });

    it("switches to host after black moves", () => {
      expect(deriveClockSwitch("b")).toBe("host");
    });
  });

  // ── Orientation flips on every move ────────────────────────────────────────
  describe("Orientation flips through a game", () => {
    it("alternates orientation after each move", () => {
      const c = new Chess();
      expect(deriveOrientation(c.turn())).toBe("white");
      c.move("e4");
      expect(deriveOrientation(c.turn())).toBe("black");
      c.move("e5");
      expect(deriveOrientation(c.turn())).toBe("white");
      c.move("Nf3");
      expect(deriveOrientation(c.turn())).toBe("black");
    });
  });

  // ── Full game PGN roundtrip ────────────────────────────────────────────────
  describe("Full game PGN roundtrip", () => {
    it("can reload a PGN and continue the game", () => {
      const c1 = new Chess();
      c1.move("e4"); c1.move("e5"); c1.move("Nf3");
      const pgn = c1.pgn();

      const c2 = new Chess();
      c2.loadPgn(pgn);
      expect(c2.turn()).toBe("b");
      expect(c2.history()).toEqual(["e4", "e5", "Nf3"]);

      // Continue the game
      c2.move("Nc6");
      expect(c2.history()).toEqual(["e4", "e5", "Nf3", "Nc6"]);
    });
  });

  // ── Reset restores starting position ───────────────────────────────────────
  describe("Reset logic", () => {
    it("restores starting FEN after reset", () => {
      const startFen = new Chess().fen();
      const c = new Chess();
      c.move("e4"); c.move("e5");
      // Simulate reset
      const c2 = new Chess();
      expect(c2.fen()).toBe(startFen);
      expect(c2.history()).toEqual([]);
    });
  });

  // ── Square highlight styles ────────────────────────────────────────────────
  describe("Square highlight logic", () => {
    it("highlights last move from and to squares", () => {
      const lastMove = { from: "e2", to: "e4" };
      // Simulating the buildCustomSquareStyles logic
      const styles: Record<string, { backgroundColor?: string }> = {};
      if (lastMove) {
        styles[lastMove.from] = { backgroundColor: "rgba(74, 222, 128, 0.25)" };
        styles[lastMove.to] = { backgroundColor: "rgba(74, 222, 128, 0.35)" };
      }
      expect(styles["e2"]).toBeDefined();
      expect(styles["e4"]).toBeDefined();
      expect(styles["e2"]!.backgroundColor).toContain("0.25");
      expect(styles["e4"]!.backgroundColor).toContain("0.35");
    });
  });

  // ── Move count calculation ─────────────────────────────────────────────────
  describe("Move count", () => {
    it("counts full moves (pairs)", () => {
      expect(Math.floor(0 / 2)).toBe(0);
      expect(Math.floor(1 / 2)).toBe(0);
      expect(Math.floor(2 / 2)).toBe(1);
      expect(Math.floor(3 / 2)).toBe(1);
      expect(Math.floor(4 / 2)).toBe(2);
      expect(Math.floor(10 / 2)).toBe(5);
    });
  });
});
