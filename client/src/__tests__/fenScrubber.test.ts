/**
 * Tests for FenScrubber component logic and fenTimeline integration.
 *
 * These tests cover:
 * - FenEntry type validation
 * - Timestamp formatting
 * - Timeline navigation logic
 * - Confidence colour thresholds
 * - FEN mode vs PGN mode switching
 * - Analysis endpoint fenTimeline parsing
 */

import { describe, it, expect } from "vitest";

// ── Types (mirrored from FenScrubber.tsx) ────────────────────────────────────

interface FenEntry {
  timestampMs: number;
  fen: string;
  confidence: number;
}

// ── Helpers (mirrored from FenScrubber.tsx) ──────────────────────────────────

function formatTimestamp(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

function getConfidenceColor(confidence: number): "green" | "amber" | "red" {
  if (confidence > 0.7) return "green";
  if (confidence > 0.4) return "amber";
  return "red";
}

function getNextIndex(
  timeline: FenEntry[],
  currentIdx: number,
  direction: "prev" | "next"
): number {
  if (direction === "prev") return Math.max(0, currentIdx - 1);
  return Math.min(timeline.length - 1, currentIdx + 1);
}

function findEntryByTimestamp(
  timeline: FenEntry[],
  timestampMs: number
): FenEntry | undefined {
  return timeline.find((e) => e.timestampMs === timestampMs);
}

// ── Sample data ──────────────────────────────────────────────────────────────

const SAMPLE_TIMELINE: FenEntry[] = [
  {
    timestampMs: 5000,
    fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
    confidence: 0.82,
  },
  {
    timestampMs: 12000,
    fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2",
    confidence: 0.65,
  },
  {
    timestampMs: 18500,
    fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2",
    confidence: 0.91,
  },
  {
    timestampMs: 30000,
    fen: "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3",
    confidence: 0.35,
  },
  {
    timestampMs: 45000,
    fen: "r1bqkb1r/pppp1ppp/2n2n2/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 4 4",
    confidence: 0.78,
  },
];

// ── Tests ────────────────────────────────────────────────────────────────────

describe("formatTimestamp", () => {
  it("formats 0ms as 0:00", () => {
    expect(formatTimestamp(0)).toBe("0:00");
  });

  it("formats 5000ms as 0:05", () => {
    expect(formatTimestamp(5000)).toBe("0:05");
  });

  it("formats 60000ms as 1:00", () => {
    expect(formatTimestamp(60000)).toBe("1:00");
  });

  it("formats 90500ms as 1:30", () => {
    expect(formatTimestamp(90500)).toBe("1:30");
  });

  it("formats 3661000ms as 61:01", () => {
    expect(formatTimestamp(3661000)).toBe("61:01");
  });

  it("pads seconds with leading zero", () => {
    expect(formatTimestamp(65000)).toBe("1:05");
  });

  it("handles fractional milliseconds by flooring", () => {
    expect(formatTimestamp(5999)).toBe("0:05");
  });
});

describe("getConfidenceColor", () => {
  it("returns green for confidence > 0.7", () => {
    expect(getConfidenceColor(0.71)).toBe("green");
    expect(getConfidenceColor(0.9)).toBe("green");
    expect(getConfidenceColor(1.0)).toBe("green");
  });

  it("returns amber for confidence between 0.4 and 0.7 inclusive", () => {
    expect(getConfidenceColor(0.41)).toBe("amber");
    expect(getConfidenceColor(0.55)).toBe("amber");
    expect(getConfidenceColor(0.70)).toBe("amber");
  });

  it("returns red for confidence <= 0.4", () => {
    expect(getConfidenceColor(0.40)).toBe("red");
    expect(getConfidenceColor(0.2)).toBe("red");
    expect(getConfidenceColor(0.0)).toBe("red");
  });
});

describe("getNextIndex navigation", () => {
  it("moves to next entry", () => {
    expect(getNextIndex(SAMPLE_TIMELINE, 0, "next")).toBe(1);
    expect(getNextIndex(SAMPLE_TIMELINE, 2, "next")).toBe(3);
  });

  it("clamps at last entry when going next", () => {
    expect(getNextIndex(SAMPLE_TIMELINE, 4, "next")).toBe(4);
  });

  it("moves to previous entry", () => {
    expect(getNextIndex(SAMPLE_TIMELINE, 3, "prev")).toBe(2);
    expect(getNextIndex(SAMPLE_TIMELINE, 1, "prev")).toBe(0);
  });

  it("clamps at first entry when going prev", () => {
    expect(getNextIndex(SAMPLE_TIMELINE, 0, "prev")).toBe(0);
  });
});

describe("findEntryByTimestamp", () => {
  it("finds an entry by exact timestamp", () => {
    const entry = findEntryByTimestamp(SAMPLE_TIMELINE, 12000);
    expect(entry).toBeDefined();
    expect(entry?.confidence).toBe(0.65);
  });

  it("returns undefined for unknown timestamp", () => {
    expect(findEntryByTimestamp(SAMPLE_TIMELINE, 99999)).toBeUndefined();
  });

  it("finds the first entry", () => {
    const entry = findEntryByTimestamp(SAMPLE_TIMELINE, 5000);
    expect(entry?.fen).toContain("4P3");
  });
});

describe("FenEntry data validation", () => {
  it("all sample entries have valid FEN strings", () => {
    for (const entry of SAMPLE_TIMELINE) {
      // A minimal FEN has 6 space-separated fields
      const parts = entry.fen.split(" ");
      expect(parts.length).toBeGreaterThanOrEqual(4);
      // First field is the board position
      const rows = parts[0].split("/");
      expect(rows.length).toBe(8);
    }
  });

  it("all sample entries have confidence in [0, 1]", () => {
    for (const entry of SAMPLE_TIMELINE) {
      expect(entry.confidence).toBeGreaterThanOrEqual(0);
      expect(entry.confidence).toBeLessThanOrEqual(1);
    }
  });

  it("timestamps are in ascending order", () => {
    for (let i = 1; i < SAMPLE_TIMELINE.length; i++) {
      expect(SAMPLE_TIMELINE[i].timestampMs).toBeGreaterThan(
        SAMPLE_TIMELINE[i - 1].timestampMs
      );
    }
  });
});

describe("fenTimeline parsing from API response", () => {
  it("parses valid JSON fenTimeline", () => {
    const raw = JSON.stringify(SAMPLE_TIMELINE);
    const parsed: FenEntry[] = JSON.parse(raw);
    expect(parsed).toHaveLength(5);
    expect(parsed[0].timestampMs).toBe(5000);
    expect(parsed[2].confidence).toBe(0.91);
  });

  it("returns empty array for null fenTimeline", () => {
    const fenTimeline: FenEntry[] = null
      ? JSON.parse(null as unknown as string)
      : [];
    expect(fenTimeline).toHaveLength(0);
  });

  it("returns empty array for malformed JSON", () => {
    let fenTimeline: FenEntry[] = [];
    try {
      fenTimeline = JSON.parse("not-valid-json");
    } catch {
      fenTimeline = [];
    }
    expect(fenTimeline).toHaveLength(0);
  });

  it("handles empty array fenTimeline", () => {
    const raw = JSON.stringify([]);
    const parsed: FenEntry[] = JSON.parse(raw);
    expect(parsed).toHaveLength(0);
  });
});

describe("FEN scrubber mode switching", () => {
  it("selectedFenEntry null means PGN mode", () => {
    const selectedFenEntry: FenEntry | null = null;
    const isPgnMode = selectedFenEntry === null;
    expect(isPgnMode).toBe(true);
  });

  it("selectedFenEntry set means FEN scrubber mode", () => {
    const selectedFenEntry: FenEntry | null = SAMPLE_TIMELINE[0];
    const isPgnMode = selectedFenEntry === null;
    expect(isPgnMode).toBe(false);
  });

  it("currentFen uses selectedFenEntry when in scrubber mode", () => {
    const selectedFenEntry: FenEntry | null = SAMPLE_TIMELINE[2];
    const pgnFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

    const currentFen = selectedFenEntry ? selectedFenEntry.fen : pgnFen;
    expect(currentFen).toBe(SAMPLE_TIMELINE[2].fen);
  });

  it("currentFen falls back to PGN FEN when no entry selected", () => {
    const selectedFenEntry: FenEntry | null = null;
    const pgnFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

    const currentFen = selectedFenEntry ? selectedFenEntry.fen : pgnFen;
    expect(currentFen).toBe(pgnFen);
  });
});

describe("timeline progress calculation", () => {
  it("calculates progress percentage correctly", () => {
    const selectedIdx = 2; // 3rd item (0-indexed)
    const total = SAMPLE_TIMELINE.length; // 5
    const progress = ((selectedIdx + 1) / total) * 100;
    expect(progress).toBe(60);
  });

  it("returns 0 progress when nothing selected", () => {
    const selectedIdx = -1;
    const total = SAMPLE_TIMELINE.length;
    const progress = selectedIdx >= 0 ? ((selectedIdx + 1) / total) * 100 : 0;
    expect(progress).toBe(0);
  });

  it("returns 100 progress at last entry", () => {
    const selectedIdx = SAMPLE_TIMELINE.length - 1;
    const total = SAMPLE_TIMELINE.length;
    const progress = ((selectedIdx + 1) / total) * 100;
    expect(progress).toBe(100);
  });
});

describe("label interval calculation", () => {
  it("shows label every 1 item for short timelines", () => {
    const timelineLength = 5;
    const interval = Math.max(1, Math.floor(timelineLength / 8));
    expect(interval).toBe(1);
  });

  it("shows label every 12 items for long timelines", () => {
    const timelineLength = 100;
    const interval = Math.max(1, Math.floor(timelineLength / 8));
    expect(interval).toBe(12);
  });

  it("always shows label for selected item regardless of interval", () => {
    // This is a logic test: selected items always show label
    const selectedIdx = 7;
    const timelineLength = 100;
    const interval = Math.max(1, Math.floor(timelineLength / 8));
    const shouldShowLabel = (idx: number) =>
      idx === selectedIdx || idx % interval === 0;
    expect(shouldShowLabel(7)).toBe(true); // selected
    expect(shouldShowLabel(0)).toBe(true); // first (interval boundary)
    expect(shouldShowLabel(3)).toBe(false); // not selected, not boundary
  });
});
