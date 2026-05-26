/**
 * OTB Chess — Chessnut Board Decoder
 * =====================================
 * Decodes raw BLE payloads from the Chessnut Pro / Air into structured
 * 64-square board states, FEN strings, and move change sets.
 *
 * Protocol summary
 * ─────────────────
 * The Chessnut position notification is at least 34 bytes:
 *   Bytes [0–1]:  header / command bytes (e.g. 0x21 0x01)
 *   Bytes [2–33]: 32 bytes encoding 64 squares, 4 bits (nibble) per square
 *
 * Square order (index 0 = first nibble of byte 2):
 *   h8, g8, f8, e8, d8, c8, b8, a8,
 *   h7, g7, f7, e7, d7, c7, b7, a7,
 *   ...
 *   h1, g1, f1, e1, d1, c1, b1, a1
 *
 * Each nibble maps to a piece via a configurable NibbleMap.
 */

import type { NibbleMap, ChessnutPieceCode, CalibrationProfile } from "./chessnutPieceMap";
import {
  DEFAULT_NIBBLE_MAP,
  PIECE_TO_FEN,
  STARTING_POSITION_MAP,
  FEN_TO_PIECE,
  checkProfileComplete,
  inferNibbleMapFromStartingPosition,
} from "./chessnutPieceMap";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ChessnutSquareMap = Record<string, ChessnutPieceCode>;

export interface ChessnutBoardState {
  rawPayload: number[];
  positionBytes: number[];
  /** Square → nibble value (raw, before piece mapping) */
  squareNibbleMap: Record<string, number>;
  squareMap: ChessnutSquareMap;
  fenPlacement: string;
  detectedPieces: number;
  unknownSquares: string[];
  changedSquares: ChangedSquare[];
  timestamp: string;
  /** Whether this state matches the standard starting position */
  isStartingPosition: boolean;
  startingPositionValidation: StartingPositionValidationResult;
}

export interface ChangedSquare {
  square: string;
  before: ChessnutPieceCode;
  after: ChessnutPieceCode;
}

export interface StartingPositionValidationResult {
  valid: boolean;
  totalPieces: number;
  unknownCount: number;
  mismatches: Array<{ square: string; expected: ChessnutPieceCode; actual: ChessnutPieceCode }>;
  emptyRanksOk: boolean;
  whiteKingOnE1: boolean;
  blackKingOnE8: boolean;
  whiteQueenOnD1: boolean;
  blackQueenOnD8: boolean;
}

// ─── Square order ─────────────────────────────────────────────────────────────
// Index 0 = byte 2 lower nibble = h8
// Index 63 = byte 33 upper nibble = a1
const SQUARE_ORDER_NORMAL: string[] = (() => {
  const squares: string[] = [];
  const files = ["h", "g", "f", "e", "d", "c", "b", "a"];
  for (let rank = 8; rank >= 1; rank--) {
    for (const file of files) {
      squares.push(`${file}${rank}`);
    }
  }
  return squares;
})();

// Flipped: a1 first (for boards placed with black on the near side)
const SQUARE_ORDER_FLIPPED: string[] = (() => {
  const squares: string[] = [];
  const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
  for (let rank = 1; rank <= 8; rank++) {
    for (const file of files) {
      squares.push(`${file}${rank}`);
    }
  }
  return squares;
})();

// ─── Core decoder functions ───────────────────────────────────────────────────

/**
 * Extract the 32-byte position segment from a raw BLE payload.
 * Handles variable-length headers robustly.
 */
export function extractPositionBytes(rawPayload: number[]): number[] | null {
  // Standard: bytes 2–33 (after 2-byte header)
  if (rawPayload.length >= 34) {
    return rawPayload.slice(2, 34);
  }
  // Minimal: exactly 32 bytes (no header)
  if (rawPayload.length === 32) {
    return rawPayload.slice(0, 32);
  }
  // Try to find a 32-byte segment that could be valid board data
  // (heuristic: look for a segment where nibble values are all 0–12)
  for (let offset = 0; offset <= rawPayload.length - 32; offset++) {
    const candidate = rawPayload.slice(offset, offset + 32);
    const allValid = candidate.every(b => {
      const lo = b & 0x0f;
      const hi = (b >> 4) & 0x0f;
      return lo <= 12 && hi <= 12;
    });
    if (allValid) return candidate;
  }
  return null;
}

/**
 * Decode 32 position bytes into a raw nibble array (64 values).
 * Lower nibble = first square, upper nibble = second square.
 */
export function decodePositionBytesToNibbles(positionBytes: number[]): number[] {
  const nibbles: number[] = [];
  for (const byte of positionBytes) {
    nibbles.push(byte & 0x0f);        // lower nibble = first square
    nibbles.push((byte >> 4) & 0x0f); // upper nibble = second square
  }
  return nibbles;
}

/**
 * Map a nibble value to a piece code using the provided NibbleMap.
 */
export function decodeNibbleToPiece(nibble: number, nibbleMap: NibbleMap): ChessnutPieceCode {
  return nibbleMap[nibble] ?? "unknown";
}

/**
 * Convert 64 nibbles to a square → piece map using the given square order.
 */
export function nibblesToSquareMap(
  nibbles: number[],
  nibbleMap: NibbleMap,
  squareOrder: "normal" | "flipped" = "normal"
): { squareMap: ChessnutSquareMap; squareNibbleMap: Record<string, number> } {
  const order = squareOrder === "flipped" ? SQUARE_ORDER_FLIPPED : SQUARE_ORDER_NORMAL;
  const squareMap: ChessnutSquareMap = {};
  const squareNibbleMap: Record<string, number> = {};

  for (let i = 0; i < 64 && i < nibbles.length; i++) {
    const square = order[i];
    const nibble = nibbles[i];
    squareMap[square] = decodeNibbleToPiece(nibble, nibbleMap);
    squareNibbleMap[square] = nibble;
  }

  return { squareMap, squareNibbleMap };
}

/**
 * Convert a square map to a FEN piece placement string.
 */
export function squareMapToFenPlacement(squareMap: ChessnutSquareMap): string {
  const ranks: string[] = [];
  for (let rank = 8; rank >= 1; rank--) {
    let rankStr = "";
    let emptyCount = 0;
    for (const file of ["a", "b", "c", "d", "e", "f", "g", "h"]) {
      const piece = squareMap[`${file}${rank}`] ?? "empty";
      if (piece === "empty" || piece === "unknown") {
        emptyCount++;
      } else {
        if (emptyCount > 0) { rankStr += emptyCount; emptyCount = 0; }
        rankStr += PIECE_TO_FEN[piece] ?? "?";
      }
    }
    if (emptyCount > 0) rankStr += emptyCount;
    ranks.push(rankStr);
  }
  return ranks.join("/");
}

/**
 * Build a full FEN string from a square map.
 */
export function squareMapToFen(
  squareMap: ChessnutSquareMap,
  sideToMove: "w" | "b" = "w",
  castling = "KQkq",
  enPassant = "-",
  halfmove = 0,
  fullmove = 1
): string {
  const placement = squareMapToFenPlacement(squareMap);
  return `${placement} ${sideToMove} ${castling} ${enPassant} ${halfmove} ${fullmove}`;
}

/**
 * Compare two square maps and return changed squares.
 */
export function compareSquareMaps(
  previousMap: ChessnutSquareMap,
  currentMap: ChessnutSquareMap
): ChangedSquare[] {
  const changes: ChangedSquare[] = [];
  const allSquares = Array.from(new Set([...Object.keys(previousMap), ...Object.keys(currentMap)]));
  for (const square of allSquares) {
    const before = previousMap[square] ?? "empty";
    const after = currentMap[square] ?? "empty";
    if (before !== after) {
      changes.push({ square, before, after });
    }
  }
  return changes;
}

/**
 * Validate whether a square map matches the standard chess starting position.
 */
export function validateStartingPosition(squareMap: ChessnutSquareMap): StartingPositionValidationResult {
  const mismatches: StartingPositionValidationResult["mismatches"] = [];
  let totalPieces = 0;
  let unknownCount = 0;

  // Check all 64 squares
  for (const [square, piece] of Object.entries(squareMap)) {
    if (piece !== "empty" && piece !== "unknown") totalPieces++;
    if (piece === "unknown") unknownCount++;

    const expected = STARTING_POSITION_MAP[square] ?? "empty";
    if (piece !== expected) {
      mismatches.push({ square, expected, actual: piece });
    }
  }

  // Check empty ranks 3-6
  let emptyRanksOk = true;
  for (let rank = 3; rank <= 6; rank++) {
    for (const file of ["a", "b", "c", "d", "e", "f", "g", "h"]) {
      const piece = squareMap[`${file}${rank}`];
      if (piece && piece !== "empty") {
        emptyRanksOk = false;
        break;
      }
    }
  }

  return {
    valid: mismatches.length === 0 && unknownCount === 0,
    totalPieces,
    unknownCount,
    mismatches,
    emptyRanksOk,
    whiteKingOnE1: squareMap["e1"] === "wk",
    blackKingOnE8: squareMap["e8"] === "bk",
    whiteQueenOnD1: squareMap["d1"] === "wq",
    blackQueenOnD8: squareMap["d8"] === "bq",
  };
}

// ─── Main decode function ─────────────────────────────────────────────────────

/**
 * Full decode pipeline: raw DataView → ChessnutBoardState.
 * Uses the provided calibration profile (or default mapping).
 */
export function decodeBoardState(
  rawData: DataView,
  previousMap: ChessnutSquareMap | null = null,
  profile: CalibrationProfile | null = null
): ChessnutBoardState | null {
  const nibbleMap: NibbleMap = profile?.nibbleMap ?? DEFAULT_NIBBLE_MAP;
  const squareOrder: "normal" | "flipped" = profile?.squareOrder ?? "normal";

  // Convert DataView to number array
  const rawPayload: number[] = Array.from({ length: rawData.byteLength }, (_, i) => rawData.getUint8(i));

  // Extract position bytes
  const positionBytes = extractPositionBytes(rawPayload);
  if (!positionBytes) return null;

  // Decode nibbles
  const nibbles = decodePositionBytesToNibbles(positionBytes);

  // Build square maps
  const { squareMap, squareNibbleMap } = nibblesToSquareMap(nibbles, nibbleMap, squareOrder);

  // Build FEN placement
  const fenPlacement = squareMapToFenPlacement(squareMap);

  // Count pieces
  const detectedPieces = Object.values(squareMap).filter(p => p !== "empty" && p !== "unknown").length;
  const unknownSquares = Object.entries(squareMap)
    .filter(([, p]) => p === "unknown")
    .map(([sq]) => sq);

  // Changed squares vs previous state
  const changedSquares = previousMap ? compareSquareMaps(previousMap, squareMap) : [];

  // Validate starting position
  const startingPositionValidation = validateStartingPosition(squareMap);

  return {
    rawPayload,
    positionBytes,
    squareNibbleMap,
    squareMap,
    fenPlacement,
    detectedPieces,
    unknownSquares,
    changedSquares,
    timestamp: new Date().toISOString(),
    isStartingPosition: startingPositionValidation.valid,
    startingPositionValidation,
  };
}

/**
 * Try both normal and flipped orientations and return the one that matches
 * the starting position (or the one with fewer mismatches).
 */
export function autoDetectOrientation(
  rawData: DataView,
  nibbleMap: NibbleMap = DEFAULT_NIBBLE_MAP
): { orientation: "normal" | "flipped"; boardState: ChessnutBoardState } | null {
  const rawPayload: number[] = Array.from({ length: rawData.byteLength }, (_, i) => rawData.getUint8(i));
  const positionBytes = extractPositionBytes(rawPayload);
  if (!positionBytes) return null;

  const nibbles = decodePositionBytesToNibbles(positionBytes);

  for (const orientation of ["normal", "flipped"] as const) {
    const { squareMap, squareNibbleMap } = nibblesToSquareMap(nibbles, nibbleMap, orientation);
    const validation = validateStartingPosition(squareMap);
    if (validation.valid) {
      const fenPlacement = squareMapToFenPlacement(squareMap);
      const detectedPieces = Object.values(squareMap).filter(p => p !== "empty" && p !== "unknown").length;
      const unknownSquares = Object.entries(squareMap).filter(([, p]) => p === "unknown").map(([sq]) => sq);
      return {
        orientation,
        boardState: {
          rawPayload,
          positionBytes,
          squareNibbleMap,
          squareMap,
          fenPlacement,
          detectedPieces,
          unknownSquares,
          changedSquares: [],
          timestamp: new Date().toISOString(),
          isStartingPosition: true,
          startingPositionValidation: validation,
        },
      };
    }
  }

  // Neither matched — return normal orientation with mismatch info
  const { squareMap, squareNibbleMap } = nibblesToSquareMap(nibbles, nibbleMap, "normal");
  const validation = validateStartingPosition(squareMap);
  const fenPlacement = squareMapToFenPlacement(squareMap);
  const detectedPieces = Object.values(squareMap).filter(p => p !== "empty" && p !== "unknown").length;
  const unknownSquares = Object.entries(squareMap).filter(([, p]) => p === "unknown").map(([sq]) => sq);

  return {
    orientation: "normal",
    boardState: {
      rawPayload,
      positionBytes,
      squareNibbleMap,
      squareMap,
      fenPlacement,
      detectedPieces,
      unknownSquares,
      changedSquares: [],
      timestamp: new Date().toISOString(),
      isStartingPosition: false,
      startingPositionValidation: validation,
    },
  };
}

/**
 * Build a calibration nibble map from a starting position board state.
 * Infers nibble → piece mapping from the known starting squares.
 */
export function buildNibbleMapFromStartingPosition(
  boardState: ChessnutBoardState
): ReturnType<typeof inferNibbleMapFromStartingPosition> {
  return inferNibbleMapFromStartingPosition(boardState.squareNibbleMap);
}

/**
 * Convert a ChessnutSquareMap to the chess.js-compatible piece map format.
 * Returns a Map<square, fenChar> with only occupied squares.
 */
export function squareMapToChessJsMap(squareMap: ChessnutSquareMap): Map<string, string> {
  const map = new Map<string, string>();
  for (const [square, piece] of Object.entries(squareMap)) {
    if (piece !== "empty" && piece !== "unknown") {
      map.set(square, PIECE_TO_FEN[piece] ?? "?");
    }
  }
  return map;
}

/**
 * Convert a FEN piece placement string to a ChessnutSquareMap.
 * Useful for comparing digital game state with physical board state.
 */
export function fenPlacementToSquareMap(fenPlacement: string): ChessnutSquareMap {
  const squareMap: ChessnutSquareMap = {};
  const ranks = fenPlacement.split("/");

  // Initialize all squares as empty
  for (let rank = 1; rank <= 8; rank++) {
    for (const file of ["a", "b", "c", "d", "e", "f", "g", "h"]) {
      squareMap[`${file}${rank}`] = "empty";
    }
  }

  for (let rankIdx = 0; rankIdx < 8; rankIdx++) {
    const rank = 8 - rankIdx;
    let fileIdx = 0;
    for (const ch of (ranks[rankIdx] ?? "")) {
      if (ch >= "1" && ch <= "8") {
        fileIdx += parseInt(ch, 10);
      } else {
        const file = ["a", "b", "c", "d", "e", "f", "g", "h"][fileIdx];
        if (file) {
          squareMap[`${file}${rank}`] = FEN_TO_PIECE[ch] ?? "unknown";
        }
        fileIdx++;
      }
    }
  }

  return squareMap;
}

export { inferNibbleMapFromStartingPosition, checkProfileComplete };
