/**
 * OTB Chess — Chessnut Piece Map
 * ================================
 * Configurable nibble-value → chess piece mapping for the Chessnut Pro / Air.
 *
 * The official Chessnut API maps 4-bit nibble values (0–15) to pieces.
 * This module provides:
 *  1. The known default mapping from the official Chessnut API
 *  2. A calibration-assisted mapping system for unknown firmware variants
 *  3. Profile persistence (localStorage + optional DB)
 *  4. Confidence tracking per nibble value
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type ChessnutPieceCode =
  | "empty"
  | "wp" | "wn" | "wb" | "wr" | "wq" | "wk"
  | "bp" | "bn" | "bb" | "br" | "bq" | "bk"
  | "unknown";

/** Maps nibble value (0–15) to a piece code */
export type NibbleMap = Record<number, ChessnutPieceCode>;

export interface NibbleEntry {
  nibble: number;
  piece: ChessnutPieceCode;
  /** Squares where this nibble value was observed */
  sampleSquares: string[];
  /** "confirmed" = seen in calibration, "inferred" = inferred from position, "default" = from spec */
  confidence: "confirmed" | "inferred" | "default";
}

export interface CalibrationProfile {
  deviceName: string;
  deviceId: string | null;
  /** Square order used: "normal" (h8→a1) or "flipped" (a1→h8) */
  squareOrder: "normal" | "flipped";
  orientation: "normal" | "flipped";
  nibbleMap: NibbleMap;
  nibbleEntries: NibbleEntry[];
  createdAt: string;
  lastUsedAt: string;
  /** Whether all 12 piece types + empty have been mapped */
  isComplete: boolean;
}

// ─── Official Chessnut API mapping ────────────────────────────────────────────
// Source: Chessnut official SDK / reverse-engineered from firmware
// Index = nibble value (0–15), value = piece code
//
// Known mapping (from ChessnutWebBluetoothAdapter PIECE_MAP):
//   0 → empty
//   1 → bq  (black queen)
//   2 → bk  (black king)
//   3 → bb  (black bishop)
//   4 → bp  (black pawn)
//   5 → bn  (black knight)
//   6 → wr  (white rook)
//   7 → wp  (white pawn)
//   8 → br  (black rook)
//   9 → wb  (white bishop)
//  10 → wn  (white knight)
//  11 → wq  (white queen)
//  12 → wk  (white king)
//  13–15 → unknown
export const DEFAULT_NIBBLE_MAP: NibbleMap = {
  0:  "empty",
  1:  "bq",
  2:  "bk",
  3:  "bb",
  4:  "bp",
  5:  "bn",
  6:  "wr",
  7:  "wp",
  8:  "br",
  9:  "wb",
  10: "wn",
  11: "wq",
  12: "wk",
  13: "unknown",
  14: "unknown",
  15: "unknown",
};

/** Human-readable piece labels */
export const PIECE_LABELS: Record<ChessnutPieceCode, string> = {
  empty:   "Empty",
  wp: "White Pawn",   wn: "White Knight", wb: "White Bishop",
  wr: "White Rook",   wq: "White Queen",  wk: "White King",
  bp: "Black Pawn",   bn: "Black Knight", bb: "Black Bishop",
  br: "Black Rook",   bq: "Black Queen",  bk: "Black King",
  unknown: "Unknown",
};

/** Piece code → FEN character (for building FEN strings) */
export const PIECE_TO_FEN: Record<ChessnutPieceCode, string> = {
  empty: "",
  wp: "P", wn: "N", wb: "B", wr: "R", wq: "Q", wk: "K",
  bp: "p", bn: "n", bb: "b", br: "r", bq: "q", bk: "k",
  unknown: "?",
};

/** FEN character → piece code */
export const FEN_TO_PIECE: Record<string, ChessnutPieceCode> = {
  "P": "wp", "N": "wn", "B": "wb", "R": "wr", "Q": "wq", "K": "wk",
  "p": "bp", "n": "bn", "b": "bb", "r": "br", "q": "bq", "k": "bk",
};

// ─── Standard starting position — expected pieces per square ─────────────────
export const STARTING_POSITION_MAP: Record<string, ChessnutPieceCode> = {
  a1: "wr", b1: "wn", c1: "wb", d1: "wq", e1: "wk", f1: "wb", g1: "wn", h1: "wr",
  a2: "wp", b2: "wp", c2: "wp", d2: "wp", e2: "wp", f2: "wp", g2: "wp", h2: "wp",
  a7: "bp", b7: "bp", c7: "bp", d7: "bp", e7: "bp", f7: "bp", g7: "bp", h7: "bp",
  a8: "br", b8: "bn", c8: "bb", d8: "bq", e8: "bk", f8: "bb", g8: "bn", h8: "br",
};

// ─── CalibrationProfile helpers ───────────────────────────────────────────────

const STORAGE_KEY = "chessnut_calibration_profile";

export function buildDefaultProfile(deviceName = "Chessnut Pro", deviceId: string | null = null): CalibrationProfile {
  const now = new Date().toISOString();
  const entries: NibbleEntry[] = Object.entries(DEFAULT_NIBBLE_MAP).map(([k, v]) => ({
    nibble: Number(k),
    piece: v,
    sampleSquares: [],
    confidence: "default",
  }));
  return {
    deviceName,
    deviceId,
    squareOrder: "normal",
    orientation: "normal",
    nibbleMap: { ...DEFAULT_NIBBLE_MAP },
    nibbleEntries: entries,
    createdAt: now,
    lastUsedAt: now,
    isComplete: checkProfileComplete({ ...DEFAULT_NIBBLE_MAP }),
  };
}

export function checkProfileComplete(map: NibbleMap): boolean {
  const required: ChessnutPieceCode[] = [
    "empty", "wp", "wn", "wb", "wr", "wq", "wk",
    "bp", "bn", "bb", "br", "bq", "bk",
  ];
  const mapped = new Set(Object.values(map));
  return required.every(p => mapped.has(p));
}

export function saveCalibrationProfile(profile: CalibrationProfile): void {
  try {
    profile.lastUsedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch { /* storage unavailable */ }
}

export function loadCalibrationProfile(): CalibrationProfile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CalibrationProfile;
  } catch {
    return null;
  }
}

export function clearCalibrationProfile(): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

/**
 * Infer nibble → piece mapping from a known starting position.
 * Given a squareMap (square → nibble value) and the known starting position,
 * build a NibbleMap by matching nibble values to expected pieces.
 */
export function inferNibbleMapFromStartingPosition(
  squareNibbleMap: Record<string, number>
): { nibbleMap: NibbleMap; entries: NibbleEntry[]; unknownNibbles: number[] } {
  const nibbleMap: NibbleMap = { ...DEFAULT_NIBBLE_MAP };
  const entries: NibbleEntry[] = [];
  const nibbleToSquares = new Map<number, string[]>();
  const nibbleToPiece = new Map<number, ChessnutPieceCode>();

  // Map nibble values to squares
  for (const [square, nibble] of Object.entries(squareNibbleMap)) {
    if (!nibbleToSquares.has(nibble)) nibbleToSquares.set(nibble, []);
    nibbleToSquares.get(nibble)!.push(square);
  }

  // For each square in starting position, infer piece from nibble
  for (const [square, expectedPiece] of Object.entries(STARTING_POSITION_MAP)) {
    const nibble = squareNibbleMap[square];
    if (nibble === undefined) continue;
    nibbleToPiece.set(nibble, expectedPiece);
    nibbleMap[nibble] = expectedPiece;
  }

  // Empty squares (ranks 3-6) → nibble 0 should be "empty"
  const emptySquares = Object.keys(squareNibbleMap).filter(sq => {
    const rank = parseInt(sq[1]);
    return rank >= 3 && rank <= 6;
  });
  for (const sq of emptySquares) {
    const nibble = squareNibbleMap[sq];
    if (nibble !== undefined && !nibbleToPiece.has(nibble)) {
      nibbleToPiece.set(nibble, "empty");
      nibbleMap[nibble] = "empty";
    }
  }

  // Build entries
  for (let n = 0; n <= 15; n++) {
    const piece = nibbleToPiece.get(n) ?? nibbleMap[n] ?? "unknown";
    entries.push({
      nibble: n,
      piece,
      sampleSquares: nibbleToSquares.get(n) ?? [],
      confidence: nibbleToPiece.has(n) ? "confirmed" : "default",
    });
    nibbleMap[n] = piece;
  }

  const unknownNibbles = entries
    .filter(e => e.piece === "unknown")
    .map(e => e.nibble);

  return { nibbleMap, entries, unknownNibbles };
}
