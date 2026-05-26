/**
 * Tests for chessnutBoardDecoder.ts and chessnutPieceMap.ts
 */
import { describe, it, expect } from "vitest";
import {
  extractPositionBytes,
  decodePositionBytesToNibbles,
  nibblesToSquareMap,
  squareMapToFenPlacement,
  compareSquareMaps,
  validateStartingPosition,
  decodeBoardState,
  autoDetectOrientation,
  fenPlacementToSquareMap,
  buildNibbleMapFromStartingPosition,
} from "../client/src/lib/chessnut/chessnutBoardDecoder";
import {
  DEFAULT_NIBBLE_MAP,
  buildDefaultProfile,
  checkProfileComplete,
  inferNibbleMapFromStartingPosition,
  STARTING_POSITION_MAP,
} from "../client/src/lib/chessnut/chessnutPieceMap";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildStartingPositionDataView(): DataView {
  // Build a synthetic 36-byte packet encoding the starting position
  // using the default nibble map
  const reverseMap: Record<string, number> = {};
  for (const [k, v] of Object.entries(DEFAULT_NIBBLE_MAP)) {
    if (v !== "unknown") reverseMap[v] = Number(k);
  }

  const bytes = new Uint8Array(36);
  bytes[0] = 0x21;
  bytes[1] = 0x01;

  // Square order: h8, g8, f8, e8, d8, c8, b8, a8, h7, g7, ...
  const files = ["h", "g", "f", "e", "d", "c", "b", "a"];
  let idx = 0;
  for (let rank = 8; rank >= 1; rank--) {
    for (const file of files) {
      const sq = `${file}${rank}`;
      const piece = STARTING_POSITION_MAP[sq] ?? "empty";
      const nibble = reverseMap[piece] ?? 0;
      const byteIdx = Math.floor(idx / 2) + 2;
      if (idx % 2 === 0) {
        bytes[byteIdx] = (bytes[byteIdx] & 0xf0) | (nibble & 0x0f);
      } else {
        bytes[byteIdx] = (bytes[byteIdx] & 0x0f) | ((nibble & 0x0f) << 4);
      }
      idx++;
    }
  }

  return new DataView(bytes.buffer);
}

// ─── extractPositionBytes ─────────────────────────────────────────────────────
describe("extractPositionBytes", () => {
  it("extracts bytes 2-33 from a 36-byte payload", () => {
    const bytes = new Uint8Array(36).fill(0);
    bytes[2] = 0xAB;
    bytes[33] = 0xCD;
    const result = extractPositionBytes(Array.from(bytes));
    expect(result).not.toBeNull();
    expect(result!.length).toBe(32);
    expect(result![0]).toBe(0xAB);
    expect(result![31]).toBe(0xCD);
  });

  it("returns null for payloads shorter than 32 bytes", () => {
    const result = extractPositionBytes(Array.from(new Uint8Array(10)));
    expect(result).toBeNull();
  });

  it("handles exactly 32-byte payload (no header)", () => {
    const bytes = new Uint8Array(32).fill(0);
    bytes[0] = 0x12;
    const result = extractPositionBytes(Array.from(bytes));
    expect(result).not.toBeNull();
    expect(result!.length).toBe(32);
    expect(result![0]).toBe(0x12);
  });

  it("extracts from 34-byte payload", () => {
    const bytes = new Uint8Array(34).fill(0);
    bytes[2] = 0x55;
    const result = extractPositionBytes(Array.from(bytes));
    expect(result).not.toBeNull();
    expect(result!.length).toBe(32);
    expect(result![0]).toBe(0x55);
  });
});

// ─── decodePositionBytesToNibbles ─────────────────────────────────────────────
describe("decodePositionBytesToNibbles", () => {
  it("produces 64 nibbles from 32 bytes", () => {
    const bytes = new Array(32).fill(0);
    const nibbles = decodePositionBytesToNibbles(bytes);
    expect(nibbles.length).toBe(64);
  });

  it("correctly splits byte into lower and upper nibbles", () => {
    // byte 0xAB: lower nibble = 0xB = 11, upper nibble = 0xA = 10
    const nibbles = decodePositionBytesToNibbles([0xAB]);
    expect(nibbles[0]).toBe(0xB); // lower nibble first
    expect(nibbles[1]).toBe(0xA); // upper nibble second
  });

  it("nibble values are all in range 0-15", () => {
    const bytes = Array.from({ length: 32 }, (_, i) => i * 7 % 256);
    const nibbles = decodePositionBytesToNibbles(bytes);
    for (const n of nibbles) {
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(15);
    }
  });
});

// ─── nibblesToSquareMap ───────────────────────────────────────────────────────
describe("nibblesToSquareMap", () => {
  it("produces 64 squares", () => {
    const nibbles = new Array(64).fill(0);
    const { squareMap } = nibblesToSquareMap(nibbles, DEFAULT_NIBBLE_MAP, "normal");
    expect(Object.keys(squareMap).length).toBe(64);
  });

  it("all squares have valid square names", () => {
    const nibbles = new Array(64).fill(0);
    const { squareMap } = nibblesToSquareMap(nibbles, DEFAULT_NIBBLE_MAP, "normal");
    for (const sq of Object.keys(squareMap)) {
      expect(sq).toMatch(/^[a-h][1-8]$/);
    }
  });

  it("nibble 0 maps to empty", () => {
    const nibbles = new Array(64).fill(0);
    const { squareMap } = nibblesToSquareMap(nibbles, DEFAULT_NIBBLE_MAP, "normal");
    for (const piece of Object.values(squareMap)) {
      expect(piece).toBe("empty");
    }
  });

  it("normal order: first nibble is h8", () => {
    const nibbles = new Array(64).fill(0);
    nibbles[0] = 8; // br = black rook (nibble 8)
    const { squareMap } = nibblesToSquareMap(nibbles, DEFAULT_NIBBLE_MAP, "normal");
    expect(squareMap["h8"]).toBe("br");
  });

  it("flipped order: first nibble is a1", () => {
    const nibbles = new Array(64).fill(0);
    nibbles[0] = 6; // wr = white rook (nibble 6)
    const { squareMap } = nibblesToSquareMap(nibbles, DEFAULT_NIBBLE_MAP, "flipped");
    expect(squareMap["a1"]).toBe("wr");
  });
});

// ─── squareMapToFenPlacement ──────────────────────────────────────────────────
describe("squareMapToFenPlacement", () => {
  it("produces standard starting position FEN placement", () => {
    const dv = buildStartingPositionDataView();
    const rawPayload = Array.from(new Uint8Array(dv.buffer));
    const posBytes = extractPositionBytes(rawPayload)!;
    const nibbles = decodePositionBytesToNibbles(posBytes);
    const { squareMap } = nibblesToSquareMap(nibbles, DEFAULT_NIBBLE_MAP, "normal");
    const fen = squareMapToFenPlacement(squareMap);
    expect(fen).toBe("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR");
  });

  it("empty board produces 8/8/8/8/8/8/8/8", () => {
    const squareMap: Record<string, "empty"> = {};
    for (let r = 1; r <= 8; r++) {
      for (const f of ["a","b","c","d","e","f","g","h"]) {
        squareMap[`${f}${r}`] = "empty";
      }
    }
    expect(squareMapToFenPlacement(squareMap)).toBe("8/8/8/8/8/8/8/8");
  });
});

// ─── compareSquareMaps ────────────────────────────────────────────────────────
describe("compareSquareMaps", () => {
  it("returns empty array for identical maps", () => {
    const map = { e2: "wp" as const, e4: "empty" as const };
    expect(compareSquareMaps(map, map)).toHaveLength(0);
  });

  it("detects a single changed square", () => {
    const before = { e2: "wp" as const, e4: "empty" as const };
    const after  = { e2: "empty" as const, e4: "wp" as const };
    const changes = compareSquareMaps(before, after);
    expect(changes).toHaveLength(2);
    const e2Change = changes.find(c => c.square === "e2");
    expect(e2Change?.before).toBe("wp");
    expect(e2Change?.after).toBe("empty");
  });
});

// ─── validateStartingPosition ─────────────────────────────────────────────────
describe("validateStartingPosition", () => {
  it("validates the starting position correctly", () => {
    const dv = buildStartingPositionDataView();
    const rawPayload = Array.from(new Uint8Array(dv.buffer));
    const posBytes = extractPositionBytes(rawPayload)!;
    const nibbles = decodePositionBytesToNibbles(posBytes);
    const { squareMap } = nibblesToSquareMap(nibbles, DEFAULT_NIBBLE_MAP, "normal");
    const result = validateStartingPosition(squareMap);
    expect(result.valid).toBe(true);
    expect(result.totalPieces).toBe(32);
    expect(result.mismatches).toHaveLength(0);
    expect(result.whiteKingOnE1).toBe(true);
    expect(result.blackKingOnE8).toBe(true);
  });

  it("detects mismatches in non-starting position", () => {
    const squareMap: Record<string, "empty"> = {};
    for (let r = 1; r <= 8; r++) {
      for (const f of ["a","b","c","d","e","f","g","h"]) {
        squareMap[`${f}${r}`] = "empty";
      }
    }
    const result = validateStartingPosition(squareMap);
    expect(result.valid).toBe(false);
    expect(result.mismatches.length).toBeGreaterThan(0);
  });
});

// ─── decodeBoardState ─────────────────────────────────────────────────────────
describe("decodeBoardState", () => {
  it("returns null for too-short payload", () => {
    const dv = new DataView(new Uint8Array(10).buffer);
    expect(decodeBoardState(dv)).toBeNull();
  });

  it("decodes starting position correctly", () => {
    const dv = buildStartingPositionDataView();
    const state = decodeBoardState(dv);
    expect(state).not.toBeNull();
    expect(state!.detectedPieces).toBe(32);
    expect(state!.unknownSquares).toHaveLength(0);
    expect(state!.isStartingPosition).toBe(true);
    expect(state!.fenPlacement).toBe("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR");
  });

  it("includes timestamp", () => {
    const dv = buildStartingPositionDataView();
    const state = decodeBoardState(dv);
    expect(state!.timestamp).toBeTruthy();
    expect(new Date(state!.timestamp).getTime()).toBeGreaterThan(0);
  });

  it("detects changed squares vs previous state", () => {
    const dv = buildStartingPositionDataView();
    const state1 = decodeBoardState(dv);
    // Modify the square map to simulate a move
    const prevMap = { ...state1!.squareMap, e2: "empty" as const, e4: "wp" as const };
    const state2 = decodeBoardState(dv, prevMap);
    // The starting position has e2=wp, so compared to prevMap (e2=empty, e4=wp)
    // e2 changed from empty→wp and e4 changed from wp→empty
    expect(state2!.changedSquares.length).toBeGreaterThan(0);
  });
});

// ─── autoDetectOrientation ────────────────────────────────────────────────────
describe("autoDetectOrientation", () => {
  it("detects normal orientation for starting position", () => {
    const dv = buildStartingPositionDataView();
    const result = autoDetectOrientation(dv);
    expect(result).not.toBeNull();
    expect(result!.orientation).toBe("normal");
    expect(result!.boardState.isStartingPosition).toBe(true);
  });

  it("returns a result even for non-starting position", () => {
    const dv = new DataView(new Uint8Array(36).buffer);
    const result = autoDetectOrientation(dv);
    expect(result).not.toBeNull();
    // Empty board won't match starting position
    expect(result!.boardState.isStartingPosition).toBe(false);
  });
});

// ─── fenPlacementToSquareMap ──────────────────────────────────────────────────
describe("fenPlacementToSquareMap", () => {
  it("correctly decodes starting position FEN", () => {
    const map = fenPlacementToSquareMap("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR");
    expect(map["e1"]).toBe("wk");
    expect(map["e8"]).toBe("bk");
    expect(map["d1"]).toBe("wq");
    expect(map["d8"]).toBe("bq");
    expect(map["a1"]).toBe("wr");
    expect(map["h8"]).toBe("br");
    expect(map["e4"]).toBe("empty");
  });

  it("correctly decodes after 1.e4", () => {
    const map = fenPlacementToSquareMap("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR");
    expect(map["e2"]).toBe("empty");
    expect(map["e4"]).toBe("wp");
  });
});

// ─── DEFAULT_NIBBLE_MAP ───────────────────────────────────────────────────────
describe("DEFAULT_NIBBLE_MAP", () => {
  it("has 16 entries (0-15)", () => {
    expect(Object.keys(DEFAULT_NIBBLE_MAP).length).toBe(16);
  });

  it("nibble 0 is empty", () => {
    expect(DEFAULT_NIBBLE_MAP[0]).toBe("empty");
  });

  it("nibble 12 is white king", () => {
    expect(DEFAULT_NIBBLE_MAP[12]).toBe("wk");
  });

  it("nibble 2 is black king", () => {
    expect(DEFAULT_NIBBLE_MAP[2]).toBe("bk");
  });
});

// ─── buildDefaultProfile ─────────────────────────────────────────────────────
describe("buildDefaultProfile", () => {
  it("builds a complete default profile", () => {
    const profile = buildDefaultProfile("Test Board", "test-id");
    expect(profile.deviceName).toBe("Test Board");
    expect(profile.deviceId).toBe("test-id");
    expect(profile.isComplete).toBe(true);
    expect(profile.nibbleEntries.length).toBe(16);
  });

  it("all nibble entries have default confidence", () => {
    const profile = buildDefaultProfile();
    for (const entry of profile.nibbleEntries) {
      expect(entry.confidence).toBe("default");
    }
  });
});

// ─── checkProfileComplete ─────────────────────────────────────────────────────
describe("checkProfileComplete", () => {
  it("returns true for default map", () => {
    expect(checkProfileComplete(DEFAULT_NIBBLE_MAP)).toBe(true);
  });

  it("returns false when a piece type is missing", () => {
    const incomplete = { ...DEFAULT_NIBBLE_MAP };
    delete incomplete[12]; // remove wk
    expect(checkProfileComplete(incomplete)).toBe(false);
  });
});

// ─── inferNibbleMapFromStartingPosition ──────────────────────────────────────
describe("inferNibbleMapFromStartingPosition", () => {
  it("infers correct nibble map from starting position square nibble map", () => {
    // Build the expected squareNibbleMap from the starting position
    const reverseMap: Record<string, number> = {};
    for (const [k, v] of Object.entries(DEFAULT_NIBBLE_MAP)) {
      if (v !== "unknown") reverseMap[v] = Number(k);
    }

    const squareNibbleMap: Record<string, number> = {};
    for (let r = 1; r <= 8; r++) {
      for (const f of ["a","b","c","d","e","f","g","h"]) {
        const sq = `${f}${r}`;
        const piece = STARTING_POSITION_MAP[sq] ?? "empty";
        squareNibbleMap[sq] = reverseMap[piece] ?? 0;
      }
    }

    const { nibbleMap, unknownNibbles } = inferNibbleMapFromStartingPosition(squareNibbleMap);
    expect(nibbleMap[12]).toBe("wk");
    expect(nibbleMap[2]).toBe("bk");
    expect(nibbleMap[0]).toBe("empty");
    expect(unknownNibbles.length).toBeLessThanOrEqual(3); // nibbles 13-15 may be unknown
  });
});

// ─── buildNibbleMapFromStartingPosition ──────────────────────────────────────
describe("buildNibbleMapFromStartingPosition", () => {
  it("builds nibble map from a decoded starting position board state", () => {
    const dv = buildStartingPositionDataView();
    const state = decodeBoardState(dv);
    expect(state).not.toBeNull();
    const { nibbleMap } = buildNibbleMapFromStartingPosition(state!);
    expect(nibbleMap[12]).toBe("wk");
    expect(nibbleMap[2]).toBe("bk");
  });
});
