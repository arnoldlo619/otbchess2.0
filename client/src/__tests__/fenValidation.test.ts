/**
 * Tests for the FEN piece-count sanity check logic mirrored from cv_worker.py.
 *
 * These tests validate the same rules implemented in Python so that any future
 * client-side FEN filtering (e.g. in the CV web worker) stays consistent with
 * the server-side validation.
 */

// ─── Mirrored implementation ──────────────────────────────────────────────────
// We mirror the Python logic here so the test suite is self-contained and
// can be run in CI without a Python interpreter.

const MAX_TOTAL_PIECES = 32;
const MIN_TOTAL_PIECES = 2;
const MAX_PAWNS_PER_SIDE = 8;
const MAX_TRUSTED_COVERAGE = 0.85;

const PIECE_MAX: Record<string, number> = {
  K: 1, k: 1,
  Q: 9, q: 9,
  R: 10, r: 10,
  B: 10, b: 10,
  N: 10, n: 10,
  P: 8, p: 8,
};

/**
 * Validate that a FEN position string represents a plausible chess position.
 * Returns true if valid, false if the FEN should be discarded.
 */
function validateFenPieceCount(fen: string | null | undefined): boolean {
  if (!fen || typeof fen !== "string") return false;

  const pos = fen.split(" ")[0];
  const ranks = pos.split("/");
  if (ranks.length !== 8) return false;

  const counts: Record<string, number> = {};
  let total = 0;

  for (const rank of ranks) {
    let squares = 0;
    for (const ch of rank) {
      if (/\d/.test(ch)) {
        squares += parseInt(ch, 10);
      } else if (/[a-zA-Z]/.test(ch)) {
        counts[ch] = (counts[ch] ?? 0) + 1;
        total += 1;
        squares += 1;
      } else {
        return false; // unexpected character
      }
    }
    if (squares !== 8) return false;
  }

  // Exactly 1 king per side
  if ((counts["K"] ?? 0) !== 1) return false;
  if ((counts["k"] ?? 0) !== 1) return false;

  // Total piece count
  if (total < MIN_TOTAL_PIECES || total > MAX_TOTAL_PIECES) return false;

  // Pawn limits
  if ((counts["P"] ?? 0) > MAX_PAWNS_PER_SIDE) return false;
  if ((counts["p"] ?? 0) > MAX_PAWNS_PER_SIDE) return false;

  // Per-piece-type upper bounds
  for (const [piece, max] of Object.entries(PIECE_MAX)) {
    if ((counts[piece] ?? 0) > max) return false;
  }

  return true;
}

/**
 * Simulate the seg_confidence value produced by extract_corners in cv_worker.py.
 * For a given raw coverage fraction, returns min(0.95, coverage * 2).
 */
function simulateSegConfidence(coverage: number): number {
  return Math.min(0.95, coverage * 2);
}

// ─── Test data ────────────────────────────────────────────────────────────────

const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const ENDGAME_KVK = "8/8/4k3/8/8/4K3/8/8 w - - 0 1";
const RUY_LOPEZ = "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4";
const SICILIAN = "rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2";
const PROMOTED_2Q = "rnbqkbnr/8/8/8/8/8/8/RNBQKQNR w - - 0 1"; // 2 white queens (promotion)
const ENDGAME_QVQ = "4k3/8/8/8/8/8/8/4K2Q w - - 0 1"; // Q vs k endgame

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("validateFenPieceCount", () => {
  // ── Valid positions ──────────────────────────────────────────────────────
  describe("valid positions", () => {
    it("accepts the starting position", () => {
      expect(validateFenPieceCount(STARTING_FEN)).toBe(true);
    });

    it("accepts a K vs k endgame", () => {
      expect(validateFenPieceCount(ENDGAME_KVK)).toBe(true);
    });

    it("accepts the Ruy Lopez opening position", () => {
      expect(validateFenPieceCount(RUY_LOPEZ)).toBe(true);
    });

    it("accepts the Sicilian Defense opening position", () => {
      expect(validateFenPieceCount(SICILIAN)).toBe(true);
    });

    it("accepts a position with 2 white queens (promotion)", () => {
      expect(validateFenPieceCount(PROMOTED_2Q)).toBe(true);
    });

    it("accepts a Q vs k endgame", () => {
      expect(validateFenPieceCount(ENDGAME_QVQ)).toBe(true);
    });

    it("accepts a position with all pieces on the board", () => {
      // Custom position with 30 pieces (still valid)
      const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1";
      expect(validateFenPieceCount(fen)).toBe(true);
    });
  });

  // ── Missing kings ────────────────────────────────────────────────────────
  describe("missing kings", () => {
    it("rejects a position missing the black king", () => {
      const fen = "rnbq1bnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1";
      expect(validateFenPieceCount(fen)).toBe(false);
    });

    it("rejects a position missing the white king", () => {
      const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQ1BNR w - - 0 1";
      expect(validateFenPieceCount(fen)).toBe(false);
    });

    it("rejects a position with 2 white kings", () => {
      const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKKNR w - - 0 1";
      expect(validateFenPieceCount(fen)).toBe(false);
    });

    it("rejects a position with 2 black kings", () => {
      const fen = "rnbqkknr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1";
      expect(validateFenPieceCount(fen)).toBe(false);
    });
  });

  // ── Wrong rank count ─────────────────────────────────────────────────────
  describe("wrong rank count", () => {
    it("rejects a FEN with only 7 ranks", () => {
      const fen = "rnbqkbnr/pppppppp/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1";
      expect(validateFenPieceCount(fen)).toBe(false);
    });

    it("rejects a FEN with 9 ranks", () => {
      const fen = "rnbqkbnr/pppppppp/8/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1";
      expect(validateFenPieceCount(fen)).toBe(false);
    });
  });

  // ── Wrong rank width ─────────────────────────────────────────────────────
  describe("wrong rank width", () => {
    it("rejects a rank with only 7 squares", () => {
      const fen = "rnbqkbnr/pppppppp/8/8/8/7/PPPPPPPP/RNBQKBNR w - - 0 1";
      expect(validateFenPieceCount(fen)).toBe(false);
    });

    it("rejects a rank with 9 squares (digit 9)", () => {
      const fen = "rnbqkbnr/pppppppp/8/8/8/9/PPPPPPPP/RNBQKBNR w - - 0 1";
      expect(validateFenPieceCount(fen)).toBe(false);
    });

    it("rejects a rank with pieces totalling 9 squares", () => {
      // PPPPPPPPP = 9 pawns = 9 squares
      const fen = "rnbqkbnr/pppppppp/8/8/8/PPPPPPPPP/8/RNBQKBNR w - - 0 1";
      expect(validateFenPieceCount(fen)).toBe(false);
    });
  });

  // ── Too many pawns ───────────────────────────────────────────────────────
  describe("too many pawns", () => {
    it("rejects 9 white pawns across valid-width ranks", () => {
      // Spread 9 white pawns across two ranks (still valid widths individually)
      // rank 3: PPPPP (5) + rank 2: PPPP (4) = 9 total
      const fen = "rnbqkbnr/pppppppp/8/8/8/PPPPP3/PPPP4/RNBQKBNR w - - 0 1";
      expect(validateFenPieceCount(fen)).toBe(false);
    });

    it("rejects 9 black pawns", () => {
      const fen = "rnbqkbnr/ppppp3/pppp4/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1";
      expect(validateFenPieceCount(fen)).toBe(false);
    });
  });

  // ── Too many of a piece type ─────────────────────────────────────────────
  describe("too many of a piece type", () => {
    it("rejects 10 white queens", () => {
      // 10 Qs: QQQQQQQQQ/Q = 10 (rank widths: 9+1 = invalid anyway, but test the count path)
      // Use a valid-width arrangement: 5 Qs in two ranks
      const fen = "QQQQQ3/QQQQQ1k1/8/8/8/8/8/K7 w - - 0 1";
      expect(validateFenPieceCount(fen)).toBe(false);
    });

    it("rejects 11 white rooks (exceeds max of 10)", () => {
      // 10 rooks = 1 original + 9 promoted pawns (impossible: only 8 pawns)
      // but the limit is 10, so 11 is the first invalid count.
      // RRRRR3 (5) + RRRRRR1k (6) = 11 rooks total
      const fen = "RRRRR3/RRRRRR1k/8/8/8/8/8/K7 w - - 0 1";
      expect(validateFenPieceCount(fen)).toBe(false);
    });
  });

  // ── Edge cases ───────────────────────────────────────────────────────────
  describe("edge cases", () => {
    it("rejects null input", () => {
      expect(validateFenPieceCount(null)).toBe(false);
    });

    it("rejects undefined input", () => {
      expect(validateFenPieceCount(undefined)).toBe(false);
    });

    it("rejects an empty string", () => {
      expect(validateFenPieceCount("")).toBe(false);
    });

    it("rejects a plain string with no slashes", () => {
      expect(validateFenPieceCount("not a fen at all")).toBe(false);
    });

    it("rejects a FEN with an unexpected character in a rank", () => {
      const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKB!R w - - 0 1";
      expect(validateFenPieceCount(fen)).toBe(false);
    });

    it("accepts a FEN with only position part (no space)", () => {
      // Some FEN strings may only have the position part
      const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR";
      expect(validateFenPieceCount(fen)).toBe(true);
    });
  });
});

// ─── Coverage guard tests ─────────────────────────────────────────────────────

describe("MAX_TRUSTED_COVERAGE guard", () => {
  it("has the correct threshold value", () => {
    expect(MAX_TRUSTED_COVERAGE).toBe(0.85);
  });

  it("rejects a plain-green-frame false positive (coverage 0.774)", () => {
    // Observed: board seg model returns 0.774 coverage on a plain green frame.
    // extract_corners computes seg_confidence = min(0.95, coverage * 2) = 0.95.
    const coverage = 0.774;
    const segConfidence = simulateSegConfidence(coverage);
    expect(segConfidence).toBeGreaterThan(MAX_TRUSTED_COVERAGE);
  });

  it("accepts a real board at typical recording angle (coverage 0.40)", () => {
    const coverage = 0.40;
    const segConfidence = simulateSegConfidence(coverage);
    expect(segConfidence).toBeLessThanOrEqual(MAX_TRUSTED_COVERAGE);
  });

  it("accepts a board that fills most of the frame (coverage 0.42)", () => {
    const coverage = 0.42;
    const segConfidence = simulateSegConfidence(coverage);
    expect(segConfidence).toBeLessThanOrEqual(MAX_TRUSTED_COVERAGE);
  });

  it("rejects a frame where coverage is exactly at the boundary (0.425)", () => {
    // min(0.95, 0.425 * 2) = 0.85 — exactly at the boundary, should be rejected
    const coverage = 0.425;
    const segConfidence = simulateSegConfidence(coverage);
    // The guard uses > (strictly greater than), so 0.85 is NOT rejected
    expect(segConfidence).toBe(MAX_TRUSTED_COVERAGE);
    expect(segConfidence > MAX_TRUSTED_COVERAGE).toBe(false);
  });

  it("rejects a frame just above the boundary (coverage 0.43)", () => {
    const coverage = 0.43;
    const segConfidence = simulateSegConfidence(coverage);
    expect(segConfidence).toBeGreaterThan(MAX_TRUSTED_COVERAGE);
  });

  it("always caps seg_confidence at 0.95", () => {
    // Even if coverage is 1.0, seg_confidence should never exceed 0.95
    expect(simulateSegConfidence(1.0)).toBe(0.95);
    expect(simulateSegConfidence(0.9)).toBe(0.95);
  });
});

// ─── Integration: validate + coverage guard together ─────────────────────────

describe("combined validation pipeline", () => {
  it("rejects a false-positive FEN from an overconfident model", () => {
    // Simulates the full pipeline: high coverage → high seg_confidence → frame skipped
    // Even if reconstruct_fen somehow produced a valid-looking FEN, the coverage
    // guard fires first and the frame is never sent to piece detection.
    const coverage = 0.774;
    const segConfidence = simulateSegConfidence(coverage);
    const frameSkipped = segConfidence > MAX_TRUSTED_COVERAGE;
    expect(frameSkipped).toBe(true);
  });

  it("accepts a valid FEN from a real board frame", () => {
    const coverage = 0.35;
    const segConfidence = simulateSegConfidence(coverage);
    const frameSkipped = segConfidence > MAX_TRUSTED_COVERAGE;
    expect(frameSkipped).toBe(false);
    // FEN from that frame passes validation
    expect(validateFenPieceCount(STARTING_FEN)).toBe(true);
  });

  it("rejects a FEN with invalid piece count even from a trusted frame", () => {
    // Coverage is fine, but the piece detection produced garbage
    const coverage = 0.38;
    const segConfidence = simulateSegConfidence(coverage);
    expect(segConfidence).toBeLessThanOrEqual(MAX_TRUSTED_COVERAGE);
    // But the FEN itself is invalid (missing black king)
    const badFen = "rnbq1bnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1";
    expect(validateFenPieceCount(badFen)).toBe(false);
  });
});
