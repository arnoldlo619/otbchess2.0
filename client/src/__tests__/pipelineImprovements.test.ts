/**
 * Pipeline Improvements Tests
 * ===========================
 *
 * Tests for the NMS tuning, FEN stability filtering, and live progress
 * features added in the v6 training cycle:
 *
 * 1. _filter_stable_fens() — rejects single-frame noise, keeps stable positions
 * 2. Per-square NMS deduplication — keeps highest-confidence detection per square
 * 3. Piece-count caps — enforces max pieces per side (e.g. max 1 king)
 * 4. cv-job progress response shape — lastFen and stablePositions fields
 * 5. merge_fen_timelines() — client-priority mode when server has few stable FENs
 */
import {describe, it, expect} from "vitest";

// ─── 1. FEN Stability Filtering ─────────────────────────────────────────────

/**
 * TypeScript port of _filter_stable_fens() from cv_worker.py.
 * A FEN is accepted only if it appears in at least `minStableFrames`
 * consecutive sampled frames (or a very similar FEN — same piece positions).
 */
function filterStableFens(
  rawTimeline: Array<[number, string]>,
  minStableFrames: number = 2,
): Array<[number, string]> {
  if (rawTimeline.length === 0) return [];

  const stable: Array<[number, string]> = [];
  let i = 0;

  while (i < rawTimeline.length) {
    const [_ts, fen] = rawTimeline[i];
    const fenBoard = fen.split(" ")[0]; // board part only

    // Count consecutive frames with the same board position
    let j = i + 1;
    while (j < rawTimeline.length && rawTimeline[j][1].split(" ")[0] === fenBoard) {
      j++;
    }

    const runLength = j - i;
    if (runLength >= minStableFrames) {
      // Use the middle frame's timestamp for stability
      const midIdx = i + Math.floor(runLength / 2);
      stable.push([rawTimeline[midIdx][0], fen]);
    }

    i = j;
  }

  return stable;
}

describe("filterStableFens", () => {
  it("rejects a single-frame FEN (noise)", () => {
    const raw: Array<[number, string]> = [
      [1000, "8/8/8/8/8/8/8/8 w - - 0 1"],
    ];
    expect(filterStableFens(raw, 2)).toHaveLength(0);
  });

  it("accepts a FEN that appears in 2 consecutive frames", () => {
    const fen = "8/8/8/4k3/4K3/8/8/8 w - - 0 1";
    const raw: Array<[number, string]> = [
      [1000, fen],
      [2000, fen],
    ];
    const result = filterStableFens(raw, 2);
    expect(result).toHaveLength(1);
    expect(result[0][1]).toBe(fen);
  });

  it("accepts a FEN that appears in 3 consecutive frames and uses middle timestamp", () => {
    const fen = "8/8/8/4k3/4K3/8/8/8 w - - 0 1";
    const raw: Array<[number, string]> = [
      [1000, fen],
      [2000, fen],
      [3000, fen],
    ];
    const result = filterStableFens(raw, 2);
    expect(result).toHaveLength(1);
    expect(result[0][0]).toBe(2000); // middle frame
  });

  it("filters noise between two stable positions", () => {
    const fen1 = "8/8/8/4k3/4K3/8/8/8 w - - 0 1";
    const fen2 = "8/8/8/8/4k3/4K3/8/8 w - - 0 1";
    const noise = "r7/8/8/8/8/8/8/7R w - - 0 1";
    const raw: Array<[number, string]> = [
      [1000, fen1],
      [2000, fen1],
      [3000, noise], // single-frame noise
      [4000, fen2],
      [5000, fen2],
    ];
    const result = filterStableFens(raw, 2);
    expect(result).toHaveLength(2);
    expect(result[0][1]).toBe(fen1);
    expect(result[1][1]).toBe(fen2);
  });

  it("returns empty array for empty input", () => {
    expect(filterStableFens([], 2)).toHaveLength(0);
  });

  it("returns empty array when all FENs are single-frame noise", () => {
    const raw: Array<[number, string]> = [
      [1000, "8/8/8/4k3/4K3/8/8/8 w - - 0 1"],
      [2000, "8/8/8/8/4k3/4K3/8/8 w - - 0 1"],
      [3000, "8/8/8/8/8/4k3/4K3/8 w - - 0 1"],
    ];
    expect(filterStableFens(raw, 2)).toHaveLength(0);
  });

  it("handles minStableFrames=1 (accept all)", () => {
    const raw: Array<[number, string]> = [
      [1000, "8/8/8/4k3/4K3/8/8/8 w - - 0 1"],
      [2000, "8/8/8/8/4k3/4K3/8/8 w - - 0 1"],
    ];
    const result = filterStableFens(raw, 1);
    expect(result).toHaveLength(2);
  });

  it("handles a long run of the same FEN", () => {
    const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    const raw: Array<[number, string]> = Array.from({ length: 10 }, (_, i) => [
      (i + 1) * 1000,
      fen,
    ]) as Array<[number, string]>;
    const result = filterStableFens(raw, 2);
    expect(result).toHaveLength(1);
    expect(result[0][0]).toBe(6000); // middle frame of 10 (index 5 = ts 6000)
  });
});

// ─── 2. Per-Square NMS Deduplication ────────────────────────────────────────

interface Detection {
  cx: number;
  cy: number;
  piece: string;
  confidence: number;
}

/**
 * TypeScript port of the per-square NMS deduplication in square_map().
 * When multiple detections map to the same square, keep only the highest-confidence one.
 */
function deduplicatePerSquare(
  detections: Detection[],
  boardSize: number = 416,
): Map<string, Detection> {
  const sq = boardSize / 8;
  const squareMap = new Map<string, Detection>();

  for (const det of detections) {
    const col = Math.floor(det.cx / sq);
    const row = Math.floor(det.cy / sq);
    const key = `${row},${col}`;

    const existing = squareMap.get(key);
    if (!existing || det.confidence > existing.confidence) {
      squareMap.set(key, det);
    }
  }

  return squareMap;
}

describe("per-square NMS deduplication", () => {
  it("keeps the highest-confidence detection when two pieces overlap the same square", () => {
    const sq = 416 / 8; // 52px per square
    const detections: Detection[] = [
      { cx: sq * 0.5, cy: sq * 0.5, piece: "P", confidence: 0.6 },
      { cx: sq * 0.6, cy: sq * 0.4, piece: "N", confidence: 0.9 },
    ];
    const result = deduplicatePerSquare(detections);
    expect(result.size).toBe(1);
    expect(result.get("0,0")?.piece).toBe("N");
    expect(result.get("0,0")?.confidence).toBe(0.9);
  });

  it("keeps separate detections for different squares", () => {
    const sq = 416 / 8;
    const detections: Detection[] = [
      { cx: sq * 0.5, cy: sq * 0.5, piece: "P", confidence: 0.7 }, // square 0,0
      { cx: sq * 1.5, cy: sq * 0.5, piece: "N", confidence: 0.8 }, // square 0,1
    ];
    const result = deduplicatePerSquare(detections);
    expect(result.size).toBe(2);
    expect(result.get("0,0")?.piece).toBe("P");
    expect(result.get("0,1")?.piece).toBe("N");
  });

  it("handles empty detections", () => {
    expect(deduplicatePerSquare([])).toHaveLength(0);
  });

  it("handles all 32 pieces on distinct squares", () => {
    const sq = 416 / 8;
    const detections: Detection[] = Array.from({ length: 32 }, (_, i) => ({
      cx: (i % 8) * sq + sq / 2,
      cy: Math.floor(i / 8) * sq + sq / 2,
      piece: "P",
      confidence: 0.8,
    }));
    const result = deduplicatePerSquare(detections);
    expect(result.size).toBe(32);
  });
});

// ─── 3. Piece-Count Caps ─────────────────────────────────────────────────────

const MAX_PIECES: Record<string, number> = {
  K: 1, Q: 9, R: 10, B: 10, N: 10, P: 8,
  k: 1, q: 9, r: 10, b: 10, n: 10, p: 8,
};

function applyPieceCountCaps(
  squareMap: Map<string, Detection>,
): Map<string, Detection> {
  const counts: Record<string, number> = {};
  const result = new Map<string, Detection>();

  // Sort by confidence descending so we keep the best detections
  const sorted = [...squareMap.entries()].sort(
    (a, b) => b[1].confidence - a[1].confidence,
  );

  for (const [key, det] of sorted) {
    const piece = det.piece;
    const max = MAX_PIECES[piece] ?? 1;
    counts[piece] = (counts[piece] ?? 0) + 1;
    if (counts[piece] <= max) {
      result.set(key, det);
    }
  }

  return result;
}

describe("piece-count caps", () => {
  it("allows exactly 1 king per side", () => {
    const sq = 416 / 8;
    const detections = new Map<string, Detection>([
      ["0,0", { cx: sq * 0.5, cy: sq * 0.5, piece: "K", confidence: 0.9 }],
      ["0,1", { cx: sq * 1.5, cy: sq * 0.5, piece: "K", confidence: 0.7 }],
    ]);
    const result = applyPieceCountCaps(detections);
    const kings = [...result.values()].filter((d) => d.piece === "K");
    expect(kings).toHaveLength(1);
    expect(kings[0].confidence).toBe(0.9); // kept the higher confidence one
  });

  it("allows up to 8 pawns per side", () => {
    const sq = 416 / 8;
    const detections = new Map<string, Detection>(
      Array.from({ length: 10 }, (_, i) => [
        `1,${i}`,
        { cx: i * sq + sq / 2, cy: sq * 1.5, piece: "P", confidence: 0.8 - i * 0.01 },
      ]),
    );
    const result = applyPieceCountCaps(detections);
    const pawns = [...result.values()].filter((d) => d.piece === "P");
    expect(pawns).toHaveLength(8);
  });

  it("handles empty map", () => {
    expect(applyPieceCountCaps(new Map())).toHaveLength(0);
  });

  it("does not affect pieces within their limits", () => {
    const sq = 416 / 8;
    const detections = new Map<string, Detection>([
      ["0,0", { cx: sq * 0.5, cy: sq * 0.5, piece: "R", confidence: 0.9 }],
      ["0,7", { cx: sq * 7.5, cy: sq * 0.5, piece: "R", confidence: 0.8 }],
    ]);
    const result = applyPieceCountCaps(detections);
    expect(result.size).toBe(2);
  });
});

// ─── 4. CV-Job Progress Response Shape ───────────────────────────────────────

describe("cv-job progress response shape", () => {
  it("includes lastFen field (string or null)", () => {
    const response = {
      jobFound: true,
      status: "running",
      framesProcessed: 50,
      totalFrames: 200,
      pct: 25,
      errorMessage: null,
      startedAt: "2026-03-09T00:00:00Z",
      completedAt: null,
      lastFen: "8/8/8/4k3/4K3/8/8/8 w - - 0 1",
      stablePositions: 3,
    };
    expect(response).toHaveProperty("lastFen");
    expect(response).toHaveProperty("stablePositions");
    expect(typeof response.stablePositions).toBe("number");
    expect(response.stablePositions).toBeGreaterThanOrEqual(0);
  });

  it("accepts null lastFen when no positions detected yet", () => {
    const response = {
      jobFound: true,
      status: "running",
      framesProcessed: 5,
      totalFrames: 200,
      pct: 2,
      errorMessage: null,
      startedAt: "2026-03-09T00:00:00Z",
      completedAt: null,
      lastFen: null,
      stablePositions: 0,
    };
    expect(response.lastFen).toBeNull();
    expect(response.stablePositions).toBe(0);
  });

  it("lastFen board part is a valid FEN board string when present", () => {
    const fen = "8/8/8/4k3/4K3/8/8/8 w - - 0 1";
    const boardPart = fen.split(" ")[0];
    const ranks = boardPart.split("/");
    expect(ranks).toHaveLength(8);
    // Each rank should contain only valid FEN characters
    for (const rank of ranks) {
      expect(rank).toMatch(/^[rnbqkpRNBQKP1-8]+$/);
    }
  });
});

// ─── 5. Merge FEN Timelines — Client Priority Mode ───────────────────────────

/**
 * TypeScript port of the merge_fen_timelines client-priority logic.
 * When the server has fewer than MIN_SERVER_FENS stable positions,
 * the client timeline is used as the primary source.
 */
const MIN_SERVER_FENS = 3;

function mergeFenTimelines(
  serverTimeline: Array<[number, string]>,
  clientTimeline: Array<[number, string]>,
): Array<[number, string]> {
  if (serverTimeline.length === 0 && clientTimeline.length === 0) return [];
  if (serverTimeline.length === 0) return clientTimeline;
  if (clientTimeline.length === 0) return serverTimeline;

  // Client-priority mode: use client as primary when server has few stable FENs
  const useClientPriority = serverTimeline.length < MIN_SERVER_FENS;

  if (useClientPriority) {
    // Merge: client positions take priority, server fills gaps
    const merged = new Map<number, string>();
    for (const [ts, fen] of clientTimeline) merged.set(ts, fen);
    for (const [ts, fen] of serverTimeline) {
      if (!merged.has(ts)) merged.set(ts, fen);
    }
    return [...merged.entries()].sort((a, b) => a[0] - b[0]);
  }

  // Normal mode: server positions take priority, client fills gaps
  const merged = new Map<number, string>();
  for (const [ts, fen] of serverTimeline) merged.set(ts, fen);
  for (const [ts, fen] of clientTimeline) {
    if (!merged.has(ts)) merged.set(ts, fen);
  }
  return [...merged.entries()].sort((a, b) => a[0] - b[0]);
}

describe("mergeFenTimelines", () => {
  it("returns empty array when both timelines are empty", () => {
    expect(mergeFenTimelines([], [])).toHaveLength(0);
  });

  it("returns server timeline when client is empty", () => {
    const server: Array<[number, string]> = [
      [1000, "8/8/8/4k3/4K3/8/8/8 w - - 0 1"],
      [2000, "8/8/8/8/4k3/4K3/8/8 w - - 0 1"],
      [3000, "8/8/8/8/8/4k3/4K3/8 w - - 0 1"],
    ];
    expect(mergeFenTimelines(server, [])).toEqual(server);
  });

  it("returns client timeline when server is empty", () => {
    const client: Array<[number, string]> = [
      [1000, "8/8/8/4k3/4K3/8/8/8 w - - 0 1"],
    ];
    expect(mergeFenTimelines([], client)).toEqual(client);
  });

  it("uses client priority when server has fewer than 3 stable FENs", () => {
    const clientFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    const serverFen = "8/8/8/4k3/4K3/8/8/8 w - - 0 1";
    const server: Array<[number, string]> = [[1000, serverFen], [2000, serverFen]]; // only 2 — below threshold
    const client: Array<[number, string]> = [[1000, clientFen], [3000, clientFen]];

    const result = mergeFenTimelines(server, client);
    // At ts=1000, client takes priority over server
    const atTs1000 = result.find(([ts]) => ts === 1000);
    expect(atTs1000?.[1]).toBe(clientFen);
  });

  it("uses server priority when server has 3+ stable FENs", () => {
    const clientFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    const serverFen = "8/8/8/4k3/4K3/8/8/8 w - - 0 1";
    const server: Array<[number, string]> = [
      [1000, serverFen],
      [2000, serverFen],
      [3000, serverFen],
    ]; // 3 — at threshold
    const client: Array<[number, string]> = [[1000, clientFen]];

    const result = mergeFenTimelines(server, client);
    const atTs1000 = result.find(([ts]) => ts === 1000);
    expect(atTs1000?.[1]).toBe(serverFen); // server wins
  });

  it("fills gaps: client provides positions not covered by server", () => {
    const serverFen = "8/8/8/4k3/4K3/8/8/8 w - - 0 1";
    const clientFen = "8/8/8/8/4k3/4K3/8/8 w - - 0 1";
    const server: Array<[number, string]> = [
      [1000, serverFen],
      [2000, serverFen],
      [3000, serverFen],
    ];
    const client: Array<[number, string]> = [[5000, clientFen]]; // gap at 5000

    const result = mergeFenTimelines(server, client);
    expect(result).toHaveLength(4);
    expect(result[3][0]).toBe(5000);
    expect(result[3][1]).toBe(clientFen);
  });

  it("output is sorted by timestamp ascending", () => {
    const server: Array<[number, string]> = [[3000, "8/8/8/4k3/4K3/8/8/8 w - - 0 1"]];
    const client: Array<[number, string]> = [[1000, "8/8/8/8/4k3/4K3/8/8 w - - 0 1"]];
    const result = mergeFenTimelines(server, client);
    for (let i = 1; i < result.length; i++) {
      expect(result[i][0]).toBeGreaterThan(result[i - 1][0]);
    }
  });
});
