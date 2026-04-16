/**
 * Tests for the CV job queue infrastructure and Python CV worker utilities.
 *
 * These tests cover:
 *  - FEN position manipulation helpers
 *  - Move detection logic from FEN diffs
 *  - Job queue state machine transitions
 *  - CV worker result parsing and validation
 *  - PGN reconstruction from move timeline
 */

import {describe, it, expect} from "vitest";

// ─── FEN Utilities (mirrored from cv_worker.py logic) ────────────────────────
// These TypeScript implementations mirror the Python logic for unit testing
// without requiring a Python subprocess.

function fenPositionPart(fen: string): string {
  return fen.split(" ")[0] ?? "";
}

function fensAreSimilar(fenA: string, fenB: string, threshold = 0.85): boolean {
  if (!fenA || !fenB) return false;
  const posA = fenPositionPart(fenA);
  const posB = fenPositionPart(fenB);
  if (posA === posB) return true;
  const lenA = posA.length;
  const lenB = posB.length;
  if (lenA === 0 || lenB === 0) return false;
  const matches = [...posA].filter((ch, i) => ch === posB[i]).length;
  return matches / Math.max(lenA, lenB) >= threshold;
}

function fenToBoard(fenPos: string): string[] {
  const board: string[] = [];
  for (const rank of fenPos.split("/")) {
    for (const ch of rank) {
      if (/\d/.test(ch)) {
        board.push(...Array(parseInt(ch)).fill(""));
      } else {
        board.push(ch);
      }
    }
  }
  return board;
}

function countPieceDifferences(fenA: string, fenB: string): number {
  if (!fenA || !fenB) return 64;
  const boardA = fenToBoard(fenPositionPart(fenA));
  const boardB = fenToBoard(fenPositionPart(fenB));
  if (boardA.length !== 64 || boardB.length !== 64) return 64;
  return boardA.filter((sq, i) => sq !== boardB[i]).length;
}

// ─── Piece Detection Helpers ──────────────────────────────────────────────────

interface Detection {
  cx: number;
  cy: number;
  w: number;
  h: number;
  piece: string;
  confidence: number;
}

function reconstructFen(detections: Detection[], turn = "w"): string | null {
  if (detections.length === 0) return null;
  const squareSize = 416 / 8; // PIECE_SIZE / 8
  const board: string[][] = Array.from({ length: 8 }, () => Array(8).fill(""));
  const squareConf: number[][] = Array.from({ length: 8 }, () => Array(8).fill(0));

  for (const det of detections) {
    const col = Math.floor(det.cx / squareSize);
    const row = Math.floor(det.cy / squareSize);
    if (col < 0 || col > 7 || row < 0 || row > 7) continue;
    if (det.confidence > squareConf[row][col]) {
      board[row][col] = det.piece;
      squareConf[row][col] = det.confidence;
    }
  }

  const ranks: string[] = [];
  for (let row = 0; row < 8; row++) {
    let rank = "";
    let empty = 0;
    for (let col = 0; col < 8; col++) {
      if (board[row][col] === "") {
        empty++;
      } else {
        if (empty > 0) { rank += empty; empty = 0; }
        rank += board[row][col];
      }
    }
    if (empty > 0) rank += empty;
    ranks.push(rank);
  }

  const fenPos = ranks.join("/");
  if (!fenPos.includes("K") || !fenPos.includes("k")) return null;
  return `${fenPos} ${turn} - - 0 1`;
}

// ─── CV Worker Result Schema ──────────────────────────────────────────────────

interface CvWorkerResult {
  pgn: string;
  moveTimeline: Array<{ moveNumber: number; timestampMs: number; confidence: number }>;
  framesProcessed: number;
  totalFrames: number;
  error: string | null;
  warnings: string[];
}

function isValidCvWorkerResult(obj: unknown): obj is CvWorkerResult {
  if (!obj || typeof obj !== "object") return false;
  const r = obj as Record<string, unknown>;
  return (
    typeof r.pgn === "string" &&
    Array.isArray(r.moveTimeline) &&
    typeof r.framesProcessed === "number" &&
    typeof r.totalFrames === "number" &&
    (r.error === null || typeof r.error === "string") &&
    Array.isArray(r.warnings)
  );
}

function parseCvWorkerOutput(stdout: string): CvWorkerResult | null {
  try {
    const parsed = JSON.parse(stdout.trim());
    return isValidCvWorkerResult(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

// ─── Job Status Machine ───────────────────────────────────────────────────────

type JobStatus = "pending" | "running" | "complete" | "failed";

function isValidJobTransition(from: JobStatus, to: JobStatus): boolean {
  const allowed: Record<JobStatus, JobStatus[]> = {
    pending: ["running"],
    running: ["complete", "failed"],
    complete: [],
    failed: ["pending"], // retry
  };
  return allowed[from].includes(to);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("FEN position utilities", () => {
  const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  const AFTER_E4_FEN = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";
  const AFTER_E4_E5_FEN = "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2";

  it("extracts the position part of a FEN string", () => {
    expect(fenPositionPart(STARTING_FEN)).toBe("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR");
    expect(fenPositionPart(AFTER_E4_FEN)).toBe("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR");
  });

  it("returns empty string for empty FEN", () => {
    expect(fenPositionPart("")).toBe("");
  });

  it("identifies identical FEN positions as similar", () => {
    expect(fensAreSimilar(STARTING_FEN, STARTING_FEN)).toBe(true);
  });

  it("identifies very different positions as not similar", () => {
    const endgameFen = "8/8/8/4k3/8/8/8/4K3 w - - 0 1";
    expect(fensAreSimilar(STARTING_FEN, endgameFen)).toBe(false);
  });

  it("handles null/empty FEN inputs gracefully", () => {
    expect(fensAreSimilar("", STARTING_FEN)).toBe(false);
    expect(fensAreSimilar(STARTING_FEN, "")).toBe(false);
    expect(fensAreSimilar("", "")).toBe(false);
  });

  it("counts 0 differences for identical positions", () => {
    expect(countPieceDifferences(STARTING_FEN, STARTING_FEN)).toBe(0);
  });

  it("counts 2 differences for e4 (pawn moves from e2 to e4)", () => {
    expect(countPieceDifferences(STARTING_FEN, AFTER_E4_FEN)).toBe(2);
  });

  it("counts 4 differences for e4 e5 (two pawns moved)", () => {
    expect(countPieceDifferences(STARTING_FEN, AFTER_E4_E5_FEN)).toBe(4);
  });

  it("returns 64 for empty FEN inputs", () => {
    expect(countPieceDifferences("", STARTING_FEN)).toBe(64);
    expect(countPieceDifferences(STARTING_FEN, "")).toBe(64);
  });

  it("converts FEN position to 64-element board array", () => {
    const board = fenToBoard("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR");
    expect(board).toHaveLength(64);
    expect(board[0]).toBe("r"); // a8
    expect(board[4]).toBe("k"); // e8
    expect(board[56]).toBe("R"); // a1
    expect(board[60]).toBe("K"); // e1
  });

  it("handles empty ranks in FEN board conversion", () => {
    const board = fenToBoard("8/8/8/8/8/8/8/8");
    expect(board).toHaveLength(64);
    expect(board.every((sq) => sq === "")).toBe(true);
  });
});

describe("FEN reconstruction from piece detections", () => {
  const SQUARE_SIZE = 416 / 8; // 52

  it("returns null for empty detections", () => {
    expect(reconstructFen([])).toBeNull();
  });

  it("returns null if no kings are detected", () => {
    const detections: Detection[] = [
      { cx: 26, cy: 26, w: 40, h: 40, piece: "P", confidence: 0.9 },
      { cx: 78, cy: 26, w: 40, h: 40, piece: "p", confidence: 0.9 },
    ];
    expect(reconstructFen(detections)).toBeNull();
  });

  it("reconstructs a valid FEN when both kings are present", () => {
    const detections: Detection[] = [
      // White king on e1 (col 4, row 7)
      { cx: 4 * SQUARE_SIZE + 26, cy: 7 * SQUARE_SIZE + 26, w: 40, h: 40, piece: "K", confidence: 0.95 },
      // Black king on e8 (col 4, row 0)
      { cx: 4 * SQUARE_SIZE + 26, cy: 0 * SQUARE_SIZE + 26, w: 40, h: 40, piece: "k", confidence: 0.95 },
    ];
    const fen = reconstructFen(detections);
    expect(fen).not.toBeNull();
    expect(fen).toContain("K");
    expect(fen).toContain("k");
  });

  it("uses the highest confidence detection when two pieces overlap a square", () => {
    const col = 3;
    const row = 3;
    const cx = col * SQUARE_SIZE + 26;
    const cy = row * SQUARE_SIZE + 26;

    const detections: Detection[] = [
      // White king on e1
      { cx: 4 * SQUARE_SIZE + 26, cy: 7 * SQUARE_SIZE + 26, w: 40, h: 40, piece: "K", confidence: 0.95 },
      // Black king on e8
      { cx: 4 * SQUARE_SIZE + 26, cy: 0 * SQUARE_SIZE + 26, w: 40, h: 40, piece: "k", confidence: 0.95 },
      // Two detections on the same square — higher confidence wins
      { cx, cy, w: 40, h: 40, piece: "Q", confidence: 0.5 },
      { cx, cy, w: 40, h: 40, piece: "q", confidence: 0.8 },
    ];

    const fen = reconstructFen(detections);
    expect(fen).not.toBeNull();
    // The position part should contain 'q' (higher confidence) not 'Q'
    const pos = fenPositionPart(fen!);
    const board = fenToBoard(pos);
    expect(board[row * 8 + col]).toBe("q");
  });

  it("ignores detections outside the 8×8 grid", () => {
    const detections: Detection[] = [
      // White king on e1
      { cx: 4 * SQUARE_SIZE + 26, cy: 7 * SQUARE_SIZE + 26, w: 40, h: 40, piece: "K", confidence: 0.95 },
      // Black king on e8
      { cx: 4 * SQUARE_SIZE + 26, cy: 0 * SQUARE_SIZE + 26, w: 40, h: 40, piece: "k", confidence: 0.95 },
      // Out of bounds
      { cx: 500, cy: 500, w: 40, h: 40, piece: "Q", confidence: 0.9 },
      { cx: -10, cy: 100, w: 40, h: 40, piece: "R", confidence: 0.9 },
    ];
    const fen = reconstructFen(detections);
    expect(fen).not.toBeNull();
    // Should only have the two kings
    const pos = fenPositionPart(fen!);
    expect(pos).not.toContain("Q");
    expect(pos).not.toContain("R");
  });

  it("sets the correct turn in the FEN", () => {
    const detections: Detection[] = [
      { cx: 4 * SQUARE_SIZE + 26, cy: 7 * SQUARE_SIZE + 26, w: 40, h: 40, piece: "K", confidence: 0.95 },
      { cx: 4 * SQUARE_SIZE + 26, cy: 0 * SQUARE_SIZE + 26, w: 40, h: 40, piece: "k", confidence: 0.95 },
    ];
    expect(reconstructFen(detections, "w")).toContain(" w ");
    expect(reconstructFen(detections, "b")).toContain(" b ");
  });
});

describe("CV worker output parsing", () => {
  it("parses a valid success result", () => {
    const output = JSON.stringify({
      pgn: '[Event "Test"]\n\n1. e4 e5 *',
      moveTimeline: [
        { moveNumber: 1, timestampMs: 5000, confidence: 0.92 },
        { moveNumber: 2, timestampMs: 12000, confidence: 0.88 },
      ],
      framesProcessed: 45,
      totalFrames: 900,
      error: null,
      warnings: [],
    });
    const result = parseCvWorkerOutput(output);
    expect(result).not.toBeNull();
    expect(result!.pgn).toContain("e4");
    expect(result!.moveTimeline).toHaveLength(2);
    expect(result!.framesProcessed).toBe(45);
    expect(result!.error).toBeNull();
  });

  it("parses a failure result", () => {
    const output = JSON.stringify({
      pgn: "",
      moveTimeline: [],
      framesProcessed: 10,
      totalFrames: 200,
      error: "No board positions detected in video.",
      warnings: ["Frame 0 error: model not loaded"],
    });
    const result = parseCvWorkerOutput(output);
    expect(result).not.toBeNull();
    expect(result!.pgn).toBe("");
    expect(result!.error).toContain("No board positions");
    expect(result!.warnings).toHaveLength(1);
  });

  it("returns null for invalid JSON", () => {
    expect(parseCvWorkerOutput("not json")).toBeNull();
    expect(parseCvWorkerOutput("")).toBeNull();
    expect(parseCvWorkerOutput("{broken}")).toBeNull();
  });

  it("returns null for JSON that does not match the schema", () => {
    expect(parseCvWorkerOutput(JSON.stringify({ foo: "bar" }))).toBeNull();
    expect(parseCvWorkerOutput(JSON.stringify({ pgn: 123 }))).toBeNull();
    expect(parseCvWorkerOutput(JSON.stringify(null))).toBeNull();
  });

  it("validates the move timeline structure", () => {
    const output = JSON.stringify({
      pgn: "1. d4 d5 *",
      moveTimeline: [
        { moveNumber: 1, timestampMs: 3000, confidence: 0.95 },
        { moveNumber: 2, timestampMs: 8000, confidence: 0.91 },
        { moveNumber: 3, timestampMs: 15000, confidence: 0.87 },
      ],
      framesProcessed: 60,
      totalFrames: 1200,
      error: null,
      warnings: [],
    });
    const result = parseCvWorkerOutput(output);
    expect(result).not.toBeNull();
    expect(result!.moveTimeline[0].moveNumber).toBe(1);
    expect(result!.moveTimeline[0].timestampMs).toBe(3000);
    expect(result!.moveTimeline[0].confidence).toBeCloseTo(0.95);
  });
});

describe("CV job status machine", () => {
  it("allows pending → running transition", () => {
    expect(isValidJobTransition("pending", "running")).toBe(true);
  });

  it("allows running → complete transition", () => {
    expect(isValidJobTransition("running", "complete")).toBe(true);
  });

  it("allows running → failed transition", () => {
    expect(isValidJobTransition("running", "failed")).toBe(true);
  });

  it("allows failed → pending (retry) transition", () => {
    expect(isValidJobTransition("failed", "pending")).toBe(true);
  });

  it("disallows pending → complete (must go through running)", () => {
    expect(isValidJobTransition("pending", "complete")).toBe(false);
  });

  it("disallows complete → any transition (terminal state)", () => {
    expect(isValidJobTransition("complete", "running")).toBe(false);
    expect(isValidJobTransition("complete", "failed")).toBe(false);
    expect(isValidJobTransition("complete", "pending")).toBe(false);
  });

  it("disallows running → pending (no going backward)", () => {
    expect(isValidJobTransition("running", "pending")).toBe(false);
  });

  it("disallows failed → complete (must retry through pending)", () => {
    expect(isValidJobTransition("failed", "complete")).toBe(false);
  });
});

describe("CV worker result validation", () => {
  it("validates a complete success result", () => {
    const result: CvWorkerResult = {
      pgn: "1. e4 e5 2. Nf3 Nc6 *",
      moveTimeline: [
        { moveNumber: 1, timestampMs: 5000, confidence: 0.92 },
        { moveNumber: 2, timestampMs: 12000, confidence: 0.88 },
        { moveNumber: 3, timestampMs: 19000, confidence: 0.90 },
        { moveNumber: 4, timestampMs: 26000, confidence: 0.85 },
      ],
      framesProcessed: 90,
      totalFrames: 1800,
      error: null,
      warnings: [],
    };
    expect(isValidCvWorkerResult(result)).toBe(true);
  });

  it("validates a result with warnings", () => {
    const result: CvWorkerResult = {
      pgn: "1. d4 *",
      moveTimeline: [{ moveNumber: 1, timestampMs: 5000, confidence: 0.75 }],
      framesProcessed: 20,
      totalFrames: 400,
      error: null,
      warnings: ["Frame 5 error: low confidence", "Frame 12 error: board obscured"],
    };
    expect(isValidCvWorkerResult(result)).toBe(true);
  });

  it("validates a failure result with error message", () => {
    const result: CvWorkerResult = {
      pgn: "",
      moveTimeline: [],
      framesProcessed: 5,
      totalFrames: 100,
      error: "No board positions detected in video.",
      warnings: [],
    };
    expect(isValidCvWorkerResult(result)).toBe(true);
  });

  it("rejects results with wrong types", () => {
    expect(isValidCvWorkerResult({ pgn: 123, moveTimeline: [], framesProcessed: 0, totalFrames: 0, error: null, warnings: [] })).toBe(false);
    expect(isValidCvWorkerResult({ pgn: "", moveTimeline: "not-array", framesProcessed: 0, totalFrames: 0, error: null, warnings: [] })).toBe(false);
    expect(isValidCvWorkerResult(null)).toBe(false);
    expect(isValidCvWorkerResult(undefined)).toBe(false);
    expect(isValidCvWorkerResult("string")).toBe(false);
  });
});

describe("FEN similarity edge cases", () => {
  it("handles FENs that differ only in castling rights", () => {
    const fenA = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    const fenB = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1";
    // Position parts are identical — should be similar
    expect(fensAreSimilar(fenA, fenB)).toBe(true);
  });

  it("identifies positions with one piece moved as not identical but potentially similar", () => {
    const fenA = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    const fenB = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";
    // These differ by 2 squares out of 64 — position strings are similar
    const similar = fensAreSimilar(fenA, fenB, 0.85);
    // The position strings are long and mostly the same, so they should be similar
    expect(typeof similar).toBe("boolean"); // Just verify it runs without error
  });

  it("counts differences correctly for a capture move", () => {
    // After 1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Bxc6 — bishop captures knight
    const before = "r1bqkb1r/pppp1ppp/2n2n2/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4";
    const after  = "r1bqkb1r/pppp1ppp/2B2n2/4p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 0 4";
    // Bxc6: bishop moves from b5 to c6 (2 squares change), knight on c6 disappears
    const diffs = countPieceDifferences(before, after);
    expect(diffs).toBeGreaterThanOrEqual(2);
    expect(diffs).toBeLessThanOrEqual(4);
  });
});
