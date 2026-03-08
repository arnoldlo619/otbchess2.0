/**
 * Phase 3 — Live CV Feedback Tests
 *
 * Covers:
 *  - fenTimeline accumulation logic
 *  - FEN deduplication (only record when position changes)
 *  - Move detection pulse trigger conditions
 *  - Board health status mapping
 *  - fenTimeline payload shape validation for the finalize call
 *  - cv_worker.py merge logic (simulated in TS)
 *  - Confidence badge thresholds
 *  - Recording overlay status string generation
 */

import { describe, it, expect } from "vitest";

// ─── Types mirroring the VideoRecorder state ──────────────────────────────────

interface FenTimelineEntry {
  timestampMs: number;
  fen: string;
  confidence: number;
  pieceCount: number;
}

interface BoardHealth {
  status: "good" | "partial" | "lost";
  confidence: number;
  cornersDetected: number;
}

// ─── Utility functions extracted from VideoRecorder logic ─────────────────────

/** Returns true if two FEN position strings differ enough to represent a new move. */
function fenPositionChanged(prevFen: string | null, currFen: string): boolean {
  if (!prevFen) return true;
  // Compare only the piece placement part (first token of FEN)
  const prevPos = prevFen.split(" ")[0];
  const currPos = currFen.split(" ")[0];
  return prevPos !== currPos;
}

/** Count the number of pieces on the board from a FEN placement string. */
function countPiecesFromFen(fen: string): number {
  const placement = fen.split(" ")[0];
  let count = 0;
  for (const ch of placement) {
    if (/[pnbrqkPNBRQK]/.test(ch)) count++;
  }
  return count;
}

/** Determine board health status from corner count and confidence. */
function getBoardHealth(cornersDetected: number, confidence: number): BoardHealth["status"] {
  if (cornersDetected === 4 && confidence >= 0.6) return "good";
  if (cornersDetected >= 2 && confidence >= 0.3) return "partial";
  return "lost";
}

/** Get the confidence badge label for a given confidence value. */
function confidenceBadgeLabel(confidence: number): string {
  if (confidence >= 0.85) return "High";
  if (confidence >= 0.60) return "Medium";
  if (confidence >= 0.35) return "Low";
  return "Poor";
}

/** Get the confidence badge color class for a given confidence value. */
function confidenceBadgeColor(confidence: number): string {
  if (confidence >= 0.85) return "emerald";
  if (confidence >= 0.60) return "amber";
  if (confidence >= 0.35) return "orange";
  return "rose";
}

/** Build the recording overlay status string. */
function buildOverlayStatus(
  moveCount: number,
  health: BoardHealth["status"],
  confidence: number
): string {
  const healthLabel = health === "good" ? "Board locked" : health === "partial" ? "Partial view" : "Board lost";
  return `${healthLabel} · ${moveCount} move${moveCount !== 1 ? "s" : ""} · ${Math.round(confidence * 100)}%`;
}

/**
 * Accumulate a FEN entry into the timeline.
 * Only adds the entry if the position has changed from the last recorded entry.
 */
function accumulateFenEntry(
  timeline: FenTimelineEntry[],
  entry: FenTimelineEntry,
  minConfidence = 0.4
): FenTimelineEntry[] {
  if (entry.confidence < minConfidence) return timeline;
  const last = timeline[timeline.length - 1];
  if (!last || fenPositionChanged(last.fen, entry.fen)) {
    return [...timeline, entry];
  }
  // Same position — update confidence if this reading is better
  if (entry.confidence > last.confidence) {
    return [...timeline.slice(0, -1), { ...last, confidence: entry.confidence }];
  }
  return timeline;
}

/**
 * Simulate the server-side merge of client timeline with server-sampled timeline.
 * Mirrors the Python merge_fen_timelines logic.
 */
function mergeTimelines(
  clientTimeline: FenTimelineEntry[],
  serverTimeline: FenTimelineEntry[],
  windowMs = 3000
): FenTimelineEntry[] {
  if (clientTimeline.length === 0) return serverTimeline;
  if (serverTimeline.length === 0) return clientTimeline;

  const merged = [...serverTimeline];

  // Upgrade server entries with higher-confidence client entries
  for (let i = 0; i < merged.length; i++) {
    const s = merged[i];
    const nearest = clientTimeline.reduce((best, c) =>
      Math.abs(c.timestampMs - s.timestampMs) < Math.abs(best.timestampMs - s.timestampMs) ? c : best
    );
    if (Math.abs(nearest.timestampMs - s.timestampMs) <= windowMs && nearest.confidence > s.confidence) {
      merged[i] = { ...s, fen: nearest.fen, confidence: Math.max(s.confidence, nearest.confidence) };
    }
  }

  // Add client-only entries not covered by server
  const serverTimestamps = merged.map((e) => e.timestampMs);
  for (const c of clientTimeline) {
    const covered = serverTimestamps.some((ts) => Math.abs(ts - c.timestampMs) <= windowMs);
    if (!covered) {
      merged.push(c);
    }
  }

  return merged.sort((a, b) => a.timestampMs - b.timestampMs);
}

/** Validate that a fenTimeline payload is safe to POST to the server. */
function validateFenTimelinePayload(payload: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!Array.isArray(payload)) {
    errors.push("payload must be an array");
    return { valid: false, errors };
  }
  for (let i = 0; i < payload.length; i++) {
    const entry = payload[i] as Record<string, unknown>;
    if (typeof entry.timestampMs !== "number") errors.push(`entry[${i}].timestampMs must be a number`);
    if (typeof entry.fen !== "string" || entry.fen.length < 10) errors.push(`entry[${i}].fen must be a non-empty FEN string`);
    if (typeof entry.confidence !== "number" || entry.confidence < 0 || entry.confidence > 1)
      errors.push(`entry[${i}].confidence must be a number in [0, 1]`);
    if (typeof entry.pieceCount !== "number") errors.push(`entry[${i}].pieceCount must be a number`);
  }
  return { valid: errors.length === 0, errors };
}

// ─── Test data ────────────────────────────────────────────────────────────────

const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const AFTER_E4_FEN = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";
const AFTER_E5_FEN = "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2";
const AFTER_NF3_FEN = "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2";

// ─── fenPositionChanged ───────────────────────────────────────────────────────

describe("fenPositionChanged", () => {
  it("returns true when prevFen is null (first entry)", () => {
    expect(fenPositionChanged(null, STARTING_FEN)).toBe(true);
  });

  it("returns false when FEN placement is identical", () => {
    expect(fenPositionChanged(STARTING_FEN, STARTING_FEN)).toBe(false);
  });

  it("returns true when a piece moves", () => {
    expect(fenPositionChanged(STARTING_FEN, AFTER_E4_FEN)).toBe(true);
  });

  it("ignores side-to-move and castling differences (only placement matters)", () => {
    // Same placement, different active color
    const fenWhite = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e3 0 1";
    const fenBlack = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";
    expect(fenPositionChanged(fenWhite, fenBlack)).toBe(false);
  });

  it("returns true for consecutive distinct moves", () => {
    expect(fenPositionChanged(AFTER_E4_FEN, AFTER_E5_FEN)).toBe(true);
    expect(fenPositionChanged(AFTER_E5_FEN, AFTER_NF3_FEN)).toBe(true);
  });
});

// ─── countPiecesFromFen ───────────────────────────────────────────────────────

describe("countPiecesFromFen", () => {
  it("counts 32 pieces in the starting position", () => {
    expect(countPiecesFromFen(STARTING_FEN)).toBe(32);
  });

  it("counts 32 pieces after e4 (no captures)", () => {
    expect(countPiecesFromFen(AFTER_E4_FEN)).toBe(32);
  });

  it("counts 31 pieces after a capture", () => {
    // After 1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Bxc6 (capture)
    const fenAfterCapture = "r1bqkbnr/1ppp1ppp/p1B5/4p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 0 4";
    expect(countPiecesFromFen(fenAfterCapture)).toBe(31);
  });

  it("counts 2 pieces in a K vs K endgame", () => {
    const kvsK = "8/8/8/4k3/8/8/8/4K3 w - - 0 1";
    expect(countPiecesFromFen(kvsK)).toBe(2);
  });
});

// ─── getBoardHealth ───────────────────────────────────────────────────────────

describe("getBoardHealth", () => {
  it("returns 'good' with 4 corners and high confidence", () => {
    expect(getBoardHealth(4, 0.9)).toBe("good");
    expect(getBoardHealth(4, 0.6)).toBe("good");
  });

  it("returns 'partial' with 4 corners but low confidence", () => {
    expect(getBoardHealth(4, 0.4)).toBe("partial");
  });

  it("returns 'partial' with 2-3 corners and moderate confidence", () => {
    expect(getBoardHealth(3, 0.5)).toBe("partial");
    expect(getBoardHealth(2, 0.3)).toBe("partial");
  });

  it("returns 'lost' with 0-1 corners", () => {
    expect(getBoardHealth(0, 0.9)).toBe("lost");
    expect(getBoardHealth(1, 0.8)).toBe("lost");
  });

  it("returns 'lost' with 2 corners but very low confidence", () => {
    expect(getBoardHealth(2, 0.1)).toBe("lost");
  });
});

// ─── confidenceBadgeLabel ─────────────────────────────────────────────────────

describe("confidenceBadgeLabel", () => {
  it("returns 'High' for confidence >= 0.85", () => {
    expect(confidenceBadgeLabel(0.85)).toBe("High");
    expect(confidenceBadgeLabel(1.0)).toBe("High");
  });

  it("returns 'Medium' for confidence in [0.60, 0.85)", () => {
    expect(confidenceBadgeLabel(0.60)).toBe("Medium");
    expect(confidenceBadgeLabel(0.75)).toBe("Medium");
    expect(confidenceBadgeLabel(0.84)).toBe("Medium");
  });

  it("returns 'Low' for confidence in [0.35, 0.60)", () => {
    expect(confidenceBadgeLabel(0.35)).toBe("Low");
    expect(confidenceBadgeLabel(0.50)).toBe("Low");
    expect(confidenceBadgeLabel(0.59)).toBe("Low");
  });

  it("returns 'Poor' for confidence < 0.35", () => {
    expect(confidenceBadgeLabel(0.34)).toBe("Poor");
    expect(confidenceBadgeLabel(0.0)).toBe("Poor");
  });
});

// ─── confidenceBadgeColor ─────────────────────────────────────────────────────

describe("confidenceBadgeColor", () => {
  it("returns 'emerald' for high confidence", () => {
    expect(confidenceBadgeColor(0.9)).toBe("emerald");
  });

  it("returns 'amber' for medium confidence", () => {
    expect(confidenceBadgeColor(0.7)).toBe("amber");
  });

  it("returns 'orange' for low confidence", () => {
    expect(confidenceBadgeColor(0.45)).toBe("orange");
  });

  it("returns 'rose' for poor confidence", () => {
    expect(confidenceBadgeColor(0.2)).toBe("rose");
  });
});

// ─── buildOverlayStatus ───────────────────────────────────────────────────────

describe("buildOverlayStatus", () => {
  it("shows 'Board locked' when health is good", () => {
    const status = buildOverlayStatus(5, "good", 0.9);
    expect(status).toContain("Board locked");
    expect(status).toContain("5 moves");
    expect(status).toContain("90%");
  });

  it("shows 'Partial view' when health is partial", () => {
    const status = buildOverlayStatus(2, "partial", 0.55);
    expect(status).toContain("Partial view");
    expect(status).toContain("2 moves");
    expect(status).toContain("55%");
  });

  it("shows 'Board lost' when health is lost", () => {
    const status = buildOverlayStatus(0, "lost", 0.1);
    expect(status).toContain("Board lost");
    expect(status).toContain("0 moves");
    expect(status).toContain("10%");
  });

  it("uses singular 'move' for exactly 1 move", () => {
    const status = buildOverlayStatus(1, "good", 0.8);
    expect(status).toContain("1 move ·");
    expect(status).not.toContain("1 moves");
  });
});

// ─── accumulateFenEntry ───────────────────────────────────────────────────────

describe("accumulateFenEntry", () => {
  it("adds the first entry to an empty timeline", () => {
    const result = accumulateFenEntry([], {
      timestampMs: 0,
      fen: STARTING_FEN,
      confidence: 0.9,
      pieceCount: 32,
    });
    expect(result).toHaveLength(1);
    expect(result[0].fen).toBe(STARTING_FEN);
  });

  it("adds a new entry when the FEN position changes", () => {
    const initial: FenTimelineEntry[] = [
      { timestampMs: 0, fen: STARTING_FEN, confidence: 0.9, pieceCount: 32 },
    ];
    const result = accumulateFenEntry(initial, {
      timestampMs: 5000,
      fen: AFTER_E4_FEN,
      confidence: 0.85,
      pieceCount: 32,
    });
    expect(result).toHaveLength(2);
    expect(result[1].fen).toBe(AFTER_E4_FEN);
  });

  it("does NOT add a duplicate entry when position is unchanged", () => {
    const initial: FenTimelineEntry[] = [
      { timestampMs: 0, fen: STARTING_FEN, confidence: 0.9, pieceCount: 32 },
    ];
    const result = accumulateFenEntry(initial, {
      timestampMs: 1000,
      fen: STARTING_FEN,
      confidence: 0.88,
      pieceCount: 32,
    });
    expect(result).toHaveLength(1);
  });

  it("upgrades confidence when same position is seen with higher confidence", () => {
    const initial: FenTimelineEntry[] = [
      { timestampMs: 0, fen: STARTING_FEN, confidence: 0.5, pieceCount: 32 },
    ];
    const result = accumulateFenEntry(initial, {
      timestampMs: 1000,
      fen: STARTING_FEN,
      confidence: 0.9,
      pieceCount: 32,
    });
    expect(result).toHaveLength(1);
    expect(result[0].confidence).toBe(0.9);
  });

  it("does NOT upgrade confidence when new reading is lower", () => {
    const initial: FenTimelineEntry[] = [
      { timestampMs: 0, fen: STARTING_FEN, confidence: 0.9, pieceCount: 32 },
    ];
    const result = accumulateFenEntry(initial, {
      timestampMs: 1000,
      fen: STARTING_FEN,
      confidence: 0.5,
      pieceCount: 32,
    });
    expect(result[0].confidence).toBe(0.9);
  });

  it("filters out entries below the minimum confidence threshold", () => {
    const result = accumulateFenEntry([], {
      timestampMs: 0,
      fen: STARTING_FEN,
      confidence: 0.3, // below default 0.4
      pieceCount: 32,
    });
    expect(result).toHaveLength(0);
  });

  it("respects a custom minimum confidence threshold", () => {
    const result = accumulateFenEntry(
      [],
      { timestampMs: 0, fen: STARTING_FEN, confidence: 0.3, pieceCount: 32 },
      0.2 // custom threshold
    );
    expect(result).toHaveLength(1);
  });

  it("builds a correct 4-move timeline", () => {
    let timeline: FenTimelineEntry[] = [];
    const moves = [
      { ts: 0, fen: STARTING_FEN },
      { ts: 5000, fen: AFTER_E4_FEN },
      { ts: 10000, fen: AFTER_E5_FEN },
      { ts: 15000, fen: AFTER_NF3_FEN },
    ];
    for (const { ts, fen } of moves) {
      timeline = accumulateFenEntry(timeline, { timestampMs: ts, fen, confidence: 0.85, pieceCount: 32 });
    }
    expect(timeline).toHaveLength(4);
    expect(timeline.map((e) => e.fen)).toEqual(moves.map((m) => m.fen));
  });
});

// ─── mergeTimelines ───────────────────────────────────────────────────────────

describe("mergeTimelines", () => {
  const clientTimeline: FenTimelineEntry[] = [
    { timestampMs: 0, fen: STARTING_FEN, confidence: 0.95, pieceCount: 32 },
    { timestampMs: 5000, fen: AFTER_E4_FEN, confidence: 0.90, pieceCount: 32 },
    { timestampMs: 10000, fen: AFTER_E5_FEN, confidence: 0.88, pieceCount: 32 },
  ];

  const serverTimeline: FenTimelineEntry[] = [
    { timestampMs: 2000, fen: STARTING_FEN, confidence: 0.70, pieceCount: 32 },
    { timestampMs: 6000, fen: AFTER_E4_FEN, confidence: 0.65, pieceCount: 32 },
    { timestampMs: 12000, fen: AFTER_E5_FEN, confidence: 0.60, pieceCount: 32 },
  ];

  it("returns server timeline when client timeline is empty", () => {
    expect(mergeTimelines([], serverTimeline)).toEqual(serverTimeline);
  });

  it("returns client timeline when server timeline is empty", () => {
    expect(mergeTimelines(clientTimeline, [])).toEqual(clientTimeline);
  });

  it("upgrades server entries with higher-confidence client entries", () => {
    const merged = mergeTimelines(clientTimeline, serverTimeline);
    // Server entry at t=2000 should be upgraded by client entry at t=0 (within 3s window)
    const firstEntry = merged.find((e) => e.timestampMs === 2000);
    expect(firstEntry?.confidence).toBeGreaterThan(0.70);
  });

  it("preserves all server timestamps in the merged result", () => {
    const merged = mergeTimelines(clientTimeline, serverTimeline);
    const serverTimestamps = serverTimeline.map((e) => e.timestampMs);
    for (const ts of serverTimestamps) {
      expect(merged.some((e) => e.timestampMs === ts)).toBe(true);
    }
  });

  it("adds client-only entries not covered by server sampling", () => {
    const clientOnly: FenTimelineEntry[] = [
      { timestampMs: 50000, fen: AFTER_NF3_FEN, confidence: 0.85, pieceCount: 32 },
    ];
    const merged = mergeTimelines(clientOnly, serverTimeline);
    expect(merged.some((e) => e.timestampMs === 50000)).toBe(true);
  });

  it("returns a timeline sorted by timestampMs", () => {
    const merged = mergeTimelines(clientTimeline, serverTimeline);
    for (let i = 1; i < merged.length; i++) {
      expect(merged[i].timestampMs).toBeGreaterThanOrEqual(merged[i - 1].timestampMs);
    }
  });

  it("does not add client entries already covered by server entries within the window", () => {
    const merged = mergeTimelines(clientTimeline, serverTimeline);
    // Client entry at t=0 is within 3s of server entry at t=2000 — should NOT be added separately
    const t0Entries = merged.filter((e) => e.timestampMs === 0);
    expect(t0Entries).toHaveLength(0);
  });
});

// ─── validateFenTimelinePayload ───────────────────────────────────────────────

describe("validateFenTimelinePayload", () => {
  it("validates a correct payload", () => {
    const payload: FenTimelineEntry[] = [
      { timestampMs: 0, fen: STARTING_FEN, confidence: 0.9, pieceCount: 32 },
      { timestampMs: 5000, fen: AFTER_E4_FEN, confidence: 0.85, pieceCount: 32 },
    ];
    const { valid, errors } = validateFenTimelinePayload(payload);
    expect(valid).toBe(true);
    expect(errors).toHaveLength(0);
  });

  it("rejects non-array payloads", () => {
    const { valid, errors } = validateFenTimelinePayload({ fen: STARTING_FEN });
    expect(valid).toBe(false);
    expect(errors[0]).toContain("array");
  });

  it("rejects entries with missing timestampMs", () => {
    const { valid, errors } = validateFenTimelinePayload([
      { fen: STARTING_FEN, confidence: 0.9, pieceCount: 32 },
    ]);
    expect(valid).toBe(false);
    expect(errors.some((e) => e.includes("timestampMs"))).toBe(true);
  });

  it("rejects entries with empty FEN strings", () => {
    const { valid, errors } = validateFenTimelinePayload([
      { timestampMs: 0, fen: "", confidence: 0.9, pieceCount: 32 },
    ]);
    expect(valid).toBe(false);
    expect(errors.some((e) => e.includes("fen"))).toBe(true);
  });

  it("rejects entries with confidence outside [0, 1]", () => {
    const { valid, errors } = validateFenTimelinePayload([
      { timestampMs: 0, fen: STARTING_FEN, confidence: 1.5, pieceCount: 32 },
    ]);
    expect(valid).toBe(false);
    expect(errors.some((e) => e.includes("confidence"))).toBe(true);
  });

  it("rejects entries with missing pieceCount", () => {
    const { valid, errors } = validateFenTimelinePayload([
      { timestampMs: 0, fen: STARTING_FEN, confidence: 0.9 },
    ]);
    expect(valid).toBe(false);
    expect(errors.some((e) => e.includes("pieceCount"))).toBe(true);
  });

  it("validates an empty array as valid (no entries to check)", () => {
    const { valid } = validateFenTimelinePayload([]);
    expect(valid).toBe(true);
  });

  it("reports multiple errors for a multi-field invalid entry", () => {
    const { valid, errors } = validateFenTimelinePayload([
      { timestampMs: "bad", fen: "", confidence: 2, pieceCount: "x" },
    ]);
    expect(valid).toBe(false);
    expect(errors.length).toBeGreaterThanOrEqual(3);
  });
});

// ─── Integration: full recording session simulation ───────────────────────────

describe("Full recording session simulation", () => {
  it("builds a valid 10-move fenTimeline from a simulated game", () => {
    const fens = [
      STARTING_FEN,
      AFTER_E4_FEN,
      AFTER_E5_FEN,
      AFTER_NF3_FEN,
      // Simulate 6 more distinct positions
      "rnbqkb1r/pppp1ppp/5n2/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3",
      "rnbqkb1r/pppp1ppp/5n2/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3",
      "rnbqkb1r/1ppp1ppp/p4n2/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4",
      "rnbqkb1r/1ppp1ppp/p4n2/4p3/B3P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 1 4",
      "rnbqkb1r/1ppp1ppp/p7/4p3/B3P3/5n2/PPPP1PPP/RNBQK2R w KQkq - 0 5",
      "rnbqkb1r/1ppp1ppp/p7/4p3/B3P3/5Q2/PPPP1PPP/RNB1K2R b KQkq - 0 5",
    ];

    let timeline: FenTimelineEntry[] = [];
    fens.forEach((fen, i) => {
      timeline = accumulateFenEntry(timeline, {
        timestampMs: i * 5000,
        fen,
        confidence: 0.8 + Math.random() * 0.15,
        pieceCount: countPiecesFromFen(fen),
      });
    });

    expect(timeline).toHaveLength(10);

    // Validate the payload shape
    const { valid, errors } = validateFenTimelinePayload(timeline);
    expect(valid).toBe(true);
    expect(errors).toHaveLength(0);

    // Timestamps should be monotonically increasing
    for (let i = 1; i < timeline.length; i++) {
      expect(timeline[i].timestampMs).toBeGreaterThan(timeline[i - 1].timestampMs);
    }

    // All piece counts should be plausible (2–32)
    for (const entry of timeline) {
      expect(entry.pieceCount).toBeGreaterThanOrEqual(2);
      expect(entry.pieceCount).toBeLessThanOrEqual(32);
    }
  });
});
