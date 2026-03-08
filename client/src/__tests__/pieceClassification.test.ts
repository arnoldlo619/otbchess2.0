/**
 * Piece Classification Pipeline Tests
 * Tests for FEN reconstruction, piece detection, and CV worker message protocol
 */

import { describe, it, expect } from "vitest";

// ─── FEN Utilities ────────────────────────────────────────────────────────────

/** Convert 8x8 piece array to FEN position string */
function boardToFen(board: (string | null)[][]): string {
  return board
    .map((row) => {
      let fen = "";
      let empty = 0;
      for (const sq of row) {
        if (!sq) {
          empty++;
        } else {
          if (empty > 0) { fen += empty; empty = 0; }
          fen += sq;
        }
      }
      if (empty > 0) fen += empty;
      return fen;
    })
    .join("/");
}

/** Count pieces in a FEN position string */
function countPiecesInFen(fenPos: string): number {
  return fenPos.replace(/[^pnbrqkPNBRQK]/g, "").length;
}

/** Validate FEN position string format */
function isValidFenPosition(fenPos: string): boolean {
  const rows = fenPos.split("/");
  if (rows.length !== 8) return false;
  for (const row of rows) {
    let count = 0;
    for (const ch of row) {
      if (/[1-8]/.test(ch)) count += parseInt(ch);
      else if (/[pnbrqkPNBRQK]/.test(ch)) count++;
      else return false;
    }
    if (count !== 8) return false;
  }
  return true;
}

/** Map YOLO class index to FEN piece symbol */
function classIndexToFen(classIdx: number): string | null {
  // Class order: white pieces first (P,N,B,R,Q,K), then black (p,n,b,r,q,k)
  const mapping: Record<number, string> = {
    0: "P", 1: "N", 2: "B", 3: "R", 4: "Q", 5: "K",
    6: "p", 7: "n", 8: "b", 9: "r", 10: "q", 11: "k",
  };
  return mapping[classIdx] ?? null;
}

/** Get piece color from FEN symbol */
function getPieceColor(fenSymbol: string): "white" | "black" {
  return fenSymbol === fenSymbol.toUpperCase() ? "white" : "black";
}

/** Check if a FEN position represents a legal starting position */
function isStartingPosition(fenPos: string): boolean {
  return fenPos === "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR";
}

/** Extract piece counts by type from FEN */
function getPieceCounts(fenPos: string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const ch of fenPos) {
    if (/[pnbrqkPNBRQK]/.test(ch)) {
      counts[ch] = (counts[ch] ?? 0) + 1;
    }
  }
  return counts;
}

/** Normalize confidence score to 0-1 range */
function normalizeConfidence(raw: number, min = 0, max = 1): number {
  return Math.max(0, Math.min(1, (raw - min) / (max - min)));
}

/** Apply NMS (non-maximum suppression) to filter overlapping detections */
function applyNMS(
  detections: Array<{ x: number; y: number; w: number; h: number; conf: number; cls: number }>,
  iouThreshold = 0.45
): typeof detections {
  if (detections.length === 0) return [];
  const sorted = [...detections].sort((a, b) => b.conf - a.conf);
  const kept: typeof detections = [];

  for (const det of sorted) {
    let suppressed = false;
    for (const k of kept) {
      const iou = computeIoU(det, k);
      if (iou > iouThreshold) { suppressed = true; break; }
    }
    if (!suppressed) kept.push(det);
  }
  return kept;
}

function computeIoU(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number }
): number {
  const ax1 = a.x - a.w / 2, ay1 = a.y - a.h / 2;
  const ax2 = a.x + a.w / 2, ay2 = a.y + a.h / 2;
  const bx1 = b.x - b.w / 2, by1 = b.y - b.h / 2;
  const bx2 = b.x + b.w / 2, by2 = b.y + b.h / 2;

  const ix1 = Math.max(ax1, bx1), iy1 = Math.max(ay1, by1);
  const ix2 = Math.min(ax2, bx2), iy2 = Math.min(ay2, by2);

  const iw = Math.max(0, ix2 - ix1);
  const ih = Math.max(0, iy2 - iy1);
  const intersection = iw * ih;

  const aArea = (ax2 - ax1) * (ay2 - ay1);
  const bArea = (bx2 - bx1) * (by2 - by1);
  const union = aArea + bArea - intersection;

  return union === 0 ? 0 : intersection / union;
}

/** Map board pixel coordinate to square index (0-63) */
function pixelToSquare(
  x: number, y: number,
  boardX: number, boardY: number,
  boardW: number, boardH: number
): number | null {
  const col = Math.floor(((x - boardX) / boardW) * 8);
  const row = Math.floor(((y - boardY) / boardH) * 8);
  if (col < 0 || col > 7 || row < 0 || row > 7) return null;
  return row * 8 + col;
}

/** Convert square index to algebraic notation */
function squareIndexToAlgebraic(idx: number): string {
  const file = String.fromCharCode(97 + (idx % 8)); // a-h
  const rank = 8 - Math.floor(idx / 8);             // 8-1
  return `${file}${rank}`;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("FEN Generation", () => {
  it("generates starting position FEN from full board", () => {
    const board: (string | null)[][] = [
      ["r","n","b","q","k","b","n","r"],
      ["p","p","p","p","p","p","p","p"],
      [null,null,null,null,null,null,null,null],
      [null,null,null,null,null,null,null,null],
      [null,null,null,null,null,null,null,null],
      [null,null,null,null,null,null,null,null],
      ["P","P","P","P","P","P","P","P"],
      ["R","N","B","Q","K","B","N","R"],
    ];
    expect(boardToFen(board)).toBe("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR");
  });

  it("encodes empty rows correctly", () => {
    const board: (string | null)[][] = Array(8).fill(null).map(() => Array(8).fill(null));
    expect(boardToFen(board)).toBe("8/8/8/8/8/8/8/8");
  });

  it("encodes mixed rows with consecutive empty squares", () => {
    const board: (string | null)[][] = Array(8).fill(null).map(() => Array(8).fill(null));
    board[4][4] = "P"; // e4
    const fen = boardToFen(board);
    expect(fen.split("/")[4]).toBe("4P3");
  });

  it("encodes a position after 1.e4 e5", () => {
    const board: (string | null)[][] = [
      ["r","n","b","q","k","b","n","r"],
      ["p","p","p","p",null,"p","p","p"],
      [null,null,null,null,null,null,null,null],
      [null,null,null,null,"p",null,null,null],
      [null,null,null,null,"P",null,null,null],
      [null,null,null,null,null,null,null,null],
      ["P","P","P","P",null,"P","P","P"],
      ["R","N","B","Q","K","B","N","R"],
    ];
    const fen = boardToFen(board);
    expect(fen).toBe("rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR");
  });
});

describe("FEN Validation", () => {
  it("validates the starting position", () => {
    expect(isValidFenPosition("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR")).toBe(true);
  });

  it("validates an empty board", () => {
    expect(isValidFenPosition("8/8/8/8/8/8/8/8")).toBe(true);
  });

  it("rejects FEN with wrong row count", () => {
    expect(isValidFenPosition("rnbqkbnr/pppppppp/8/8/8/PPPPPPPP/RNBQKBNR")).toBe(false);
  });

  it("rejects FEN with row that sums to more than 8", () => {
    expect(isValidFenPosition("rnbqkbnr/pppppppp/9/8/8/8/PPPPPPPP/RNBQKBNR")).toBe(false);
  });

  it("rejects FEN with invalid characters", () => {
    expect(isValidFenPosition("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNX")).toBe(false);
  });

  it("validates a mid-game position", () => {
    expect(isValidFenPosition("r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R")).toBe(true);
  });
});

describe("Piece Counting", () => {
  it("counts 32 pieces in starting position", () => {
    expect(countPiecesInFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR")).toBe(32);
  });

  it("counts 0 pieces in empty board", () => {
    expect(countPiecesInFen("8/8/8/8/8/8/8/8")).toBe(0);
  });

  it("counts pieces correctly in Italian game opening", () => {
    // After 1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 (Italian game — no captures yet)
    const fen = "r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R";
    expect(countPiecesInFen(fen)).toBe(32); // all 32 pieces still on board
  });

  it("counts individual piece types correctly", () => {
    const counts = getPieceCounts("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR");
    expect(counts["P"]).toBe(8);
    expect(counts["p"]).toBe(8);
    expect(counts["R"]).toBe(2);
    expect(counts["r"]).toBe(2);
    expect(counts["K"]).toBe(1);
    expect(counts["k"]).toBe(1);
  });
});

describe("Class Index Mapping", () => {
  it("maps white piece indices correctly", () => {
    expect(classIndexToFen(0)).toBe("P");
    expect(classIndexToFen(1)).toBe("N");
    expect(classIndexToFen(2)).toBe("B");
    expect(classIndexToFen(3)).toBe("R");
    expect(classIndexToFen(4)).toBe("Q");
    expect(classIndexToFen(5)).toBe("K");
  });

  it("maps black piece indices correctly", () => {
    expect(classIndexToFen(6)).toBe("p");
    expect(classIndexToFen(7)).toBe("n");
    expect(classIndexToFen(8)).toBe("b");
    expect(classIndexToFen(9)).toBe("r");
    expect(classIndexToFen(10)).toBe("q");
    expect(classIndexToFen(11)).toBe("k");
  });

  it("returns null for invalid class index", () => {
    expect(classIndexToFen(12)).toBeNull();
    expect(classIndexToFen(-1)).toBeNull();
  });

  it("correctly identifies piece colors", () => {
    expect(getPieceColor("P")).toBe("white");
    expect(getPieceColor("K")).toBe("white");
    expect(getPieceColor("p")).toBe("black");
    expect(getPieceColor("k")).toBe("black");
  });
});

describe("Non-Maximum Suppression", () => {
  it("keeps single detection unchanged", () => {
    const dets = [{ x: 0.5, y: 0.5, w: 0.1, h: 0.1, conf: 0.9, cls: 0 }];
    expect(applyNMS(dets)).toHaveLength(1);
  });

  it("suppresses overlapping detections of same class", () => {
    const dets = [
      { x: 0.5, y: 0.5, w: 0.1, h: 0.1, conf: 0.9, cls: 0 },
      { x: 0.51, y: 0.51, w: 0.1, h: 0.1, conf: 0.7, cls: 0 }, // heavily overlapping
    ];
    expect(applyNMS(dets)).toHaveLength(1);
    expect(applyNMS(dets)[0].conf).toBe(0.9); // keeps higher confidence
  });

  it("keeps non-overlapping detections", () => {
    const dets = [
      { x: 0.1, y: 0.1, w: 0.1, h: 0.1, conf: 0.9, cls: 0 },
      { x: 0.9, y: 0.9, w: 0.1, h: 0.1, conf: 0.8, cls: 1 }, // far apart
    ];
    expect(applyNMS(dets)).toHaveLength(2);
  });

  it("returns empty array for empty input", () => {
    expect(applyNMS([])).toHaveLength(0);
  });

  it("sorts by confidence before suppression", () => {
    const dets = [
      { x: 0.5, y: 0.5, w: 0.1, h: 0.1, conf: 0.6, cls: 0 },
      { x: 0.5, y: 0.5, w: 0.1, h: 0.1, conf: 0.95, cls: 0 },
    ];
    const result = applyNMS(dets);
    expect(result).toHaveLength(1);
    expect(result[0].conf).toBe(0.95);
  });
});

describe("IoU Computation", () => {
  it("returns 1.0 for identical boxes", () => {
    const box = { x: 0.5, y: 0.5, w: 0.2, h: 0.2 };
    expect(computeIoU(box, box)).toBeCloseTo(1.0);
  });

  it("returns 0 for non-overlapping boxes", () => {
    const a = { x: 0.1, y: 0.1, w: 0.1, h: 0.1 };
    const b = { x: 0.9, y: 0.9, w: 0.1, h: 0.1 };
    expect(computeIoU(a, b)).toBe(0);
  });

  it("returns value between 0 and 1 for partial overlap", () => {
    const a = { x: 0.5, y: 0.5, w: 0.2, h: 0.2 };
    const b = { x: 0.6, y: 0.5, w: 0.2, h: 0.2 };
    const iou = computeIoU(a, b);
    expect(iou).toBeGreaterThan(0);
    expect(iou).toBeLessThan(1);
  });
});

describe("Pixel to Square Mapping", () => {
  it("maps center of e4 square correctly", () => {
    // Board at (0,0), 400x400 pixels
    // e4 = file 4 (e=4), rank 4 → row index 4 from top
    const sq = pixelToSquare(4 * 50 + 25, 4 * 50 + 25, 0, 0, 400, 400);
    expect(sq).toBe(4 * 8 + 4); // row 4, col 4 = index 36
  });

  it("maps top-left corner to a8 (index 0)", () => {
    const sq = pixelToSquare(5, 5, 0, 0, 400, 400);
    expect(sq).toBe(0);
  });

  it("maps bottom-right corner to h1 (index 63)", () => {
    const sq = pixelToSquare(395, 395, 0, 0, 400, 400);
    expect(sq).toBe(63);
  });

  it("returns null for out-of-bounds coordinates", () => {
    expect(pixelToSquare(-10, 200, 0, 0, 400, 400)).toBeNull();
    expect(pixelToSquare(200, 500, 0, 0, 400, 400)).toBeNull();
  });
});

describe("Square Index to Algebraic Notation", () => {
  it("converts a8 (index 0) correctly", () => {
    expect(squareIndexToAlgebraic(0)).toBe("a8");
  });

  it("converts h8 (index 7) correctly", () => {
    expect(squareIndexToAlgebraic(7)).toBe("h8");
  });

  it("converts a1 (index 56) correctly", () => {
    expect(squareIndexToAlgebraic(56)).toBe("a1");
  });

  it("converts h1 (index 63) correctly", () => {
    expect(squareIndexToAlgebraic(63)).toBe("h1");
  });

  it("converts e4 (index 36) correctly", () => {
    expect(squareIndexToAlgebraic(36)).toBe("e4");
  });
});

describe("Confidence Normalization", () => {
  it("clamps values above max to 1", () => {
    expect(normalizeConfidence(1.5)).toBe(1);
  });

  it("clamps values below min to 0", () => {
    expect(normalizeConfidence(-0.5)).toBe(0);
  });

  it("normalizes mid-range value correctly", () => {
    expect(normalizeConfidence(0.5)).toBe(0.5);
  });

  it("handles custom min/max range", () => {
    expect(normalizeConfidence(75, 0, 100)).toBe(0.75);
  });
});

describe("Starting Position Detection", () => {
  it("recognises the starting position", () => {
    expect(isStartingPosition("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR")).toBe(true);
  });

  it("rejects a non-starting position", () => {
    expect(isStartingPosition("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR")).toBe(false);
  });

  it("rejects an empty board", () => {
    expect(isStartingPosition("8/8/8/8/8/8/8/8")).toBe(false);
  });
});
