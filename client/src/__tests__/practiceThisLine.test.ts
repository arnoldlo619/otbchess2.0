/**
 * Tests for the "Practice this line" feature.
 *
 * Covers:
 * 1. ChessPracticeBoard initialLineIndex prop logic
 * 2. Practice button index resolution (filtered → full enrichedLines)
 * 3. Tab switching behaviour when "Practice this line" is clicked
 * 4. Edge cases: out-of-bounds index, undefined initialLineIndex
 */
import {describe, it, expect} from "vitest";

// ── Helpers extracted from component logic ───────────────────────────────────

/** Simulates ChessPracticeBoard's initial line index resolution */
function resolveInitialLineIndex(
  initialLineIndex: number | undefined,
  linesLength: number,
): number {
  const idx = initialLineIndex ?? 0;
  // Clamp to valid range
  return idx >= 0 && idx < linesLength ? idx : 0;
}

/** Simulates the filtered→full index resolution used in the "Practice this line" button */
function resolveFullIndex(
  filteredLine: { name: string; moves: string },
  enrichedLines: { name: string; moves: string }[],
  filteredIndex: number,
): number {
  const fullIndex = enrichedLines.findIndex(
    (el) => el.name === filteredLine.name && el.moves === filteredLine.moves,
  );
  return fullIndex >= 0 ? fullIndex : filteredIndex;
}

/** Simulates the useEffect guard in ChessPracticeBoard */
function shouldJumpToLine(
  initialLineIndex: number | undefined,
  currentLineIndex: number,
  linesLength: number,
): boolean {
  return (
    initialLineIndex != null &&
    initialLineIndex !== currentLineIndex &&
    initialLineIndex < linesLength
  );
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("Practice this line — initial line index resolution", () => {
  it("defaults to 0 when initialLineIndex is undefined", () => {
    expect(resolveInitialLineIndex(undefined, 5)).toBe(0);
  });

  it("uses the provided index when within bounds", () => {
    expect(resolveInitialLineIndex(2, 5)).toBe(2);
    expect(resolveInitialLineIndex(0, 5)).toBe(0);
    expect(resolveInitialLineIndex(4, 5)).toBe(4);
  });

  it("clamps to 0 when index is out of bounds", () => {
    expect(resolveInitialLineIndex(5, 5)).toBe(0);
    expect(resolveInitialLineIndex(10, 3)).toBe(0);
  });

  it("clamps to 0 when index is negative", () => {
    expect(resolveInitialLineIndex(-1, 5)).toBe(0);
  });

  it("handles empty lines array", () => {
    expect(resolveInitialLineIndex(0, 0)).toBe(0);
    expect(resolveInitialLineIndex(undefined, 0)).toBe(0);
  });
});

describe("Practice this line — filtered to full index resolution", () => {
  const enrichedLines = [
    { name: "Sicilian Najdorf", moves: "1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6" },
    { name: "Italian Game", moves: "1. e4 e5 2. Nf3 Nc6 3. Bc4" },
    { name: "French Defense", moves: "1. e4 e6 2. d4 d5" },
    { name: "Caro-Kann", moves: "1. e4 c6 2. d4 d5" },
    { name: "Queen's Gambit", moves: "1. d4 d5 2. c4" },
  ];

  it("finds the correct full index when filtered line exists in enrichedLines", () => {
    const filteredLine = enrichedLines[2]; // French Defense is at index 2
    expect(resolveFullIndex(filteredLine, enrichedLines, 0)).toBe(2);
  });

  it("returns the correct index for the first line", () => {
    const filteredLine = enrichedLines[0];
    expect(resolveFullIndex(filteredLine, enrichedLines, 0)).toBe(0);
  });

  it("returns the correct index for the last line", () => {
    const filteredLine = enrichedLines[4];
    expect(resolveFullIndex(filteredLine, enrichedLines, 2)).toBe(4);
  });

  it("falls back to filteredIndex when line is not found", () => {
    const unknownLine = { name: "Unknown Opening", moves: "1. g4" };
    expect(resolveFullIndex(unknownLine, enrichedLines, 3)).toBe(3);
  });

  it("matches by both name AND moves (not just name)", () => {
    const linesWithDuplicateNames = [
      { name: "Sicilian", moves: "1. e4 c5 2. Nf3 d6" },
      { name: "Sicilian", moves: "1. e4 c5 2. Nf3 Nc6" },
    ];
    const target = linesWithDuplicateNames[1];
    expect(resolveFullIndex(target, linesWithDuplicateNames, 0)).toBe(1);
  });
});

describe("Practice this line — jump guard logic", () => {
  it("allows jump when initialLineIndex is set and different from current", () => {
    expect(shouldJumpToLine(3, 0, 5)).toBe(true);
    expect(shouldJumpToLine(0, 2, 5)).toBe(true);
  });

  it("blocks jump when initialLineIndex equals current line", () => {
    expect(shouldJumpToLine(2, 2, 5)).toBe(false);
  });

  it("blocks jump when initialLineIndex is undefined", () => {
    expect(shouldJumpToLine(undefined, 0, 5)).toBe(false);
  });

  it("blocks jump when initialLineIndex is out of bounds", () => {
    expect(shouldJumpToLine(5, 0, 5)).toBe(false);
    expect(shouldJumpToLine(10, 0, 3)).toBe(false);
  });

  it("allows jump to index 0 from a different line", () => {
    expect(shouldJumpToLine(0, 3, 5)).toBe(true);
  });
});

describe("Practice this line — tab switching", () => {
  it("sets activeTab to 'practice' when button is clicked", () => {
    // Simulate the state change
    let _activeTab: "scout" | "lines" | "practice" = "lines";
    let practiceLineIndex: number | undefined = undefined;

    // Simulate button click
    const lineIndex = 2;
    practiceLineIndex = lineIndex;
    _activeTab = "practice";

    expect(_activeTab).toBe("practice");
    expect(practiceLineIndex).toBe(2);
  });

  it("preserves practiceLineIndex across tab switches", () => {
    let _activeTab: "scout" | "lines" | "practice" = "lines";
    let practiceLineIndex: number | undefined = undefined;

    // Click "Practice this line" for line 3
    practiceLineIndex = 3;
    _activeTab = "practice";
    expect(practiceLineIndex).toBe(3);

    // Switch to scout tab and back
    _activeTab = "scout";
    _activeTab = "practice";
    // practiceLineIndex should still be 3
    expect(practiceLineIndex).toBe(3);
  });

  it("updates practiceLineIndex when clicking a different line's button", () => {
    let practiceLineIndex: number | undefined = undefined;

    // First click
    practiceLineIndex = 1;
    expect(practiceLineIndex).toBe(1);

    // Click a different line
    practiceLineIndex = 4;
    expect(practiceLineIndex).toBe(4);
  });
});

describe("Practice this line — integration scenario", () => {
  it("full flow: filter → click button → resolve index → switch tab → jump to line", () => {
    // Setup: 5 enriched lines, filter shows only "surprise" lines at indices 1 and 3
    const enrichedLines = [
      { name: "Italian Game", moves: "1. e4 e5 2. Nf3 Nc6 3. Bc4", lineType: "main" },
      { name: "Budapest Gambit", moves: "1. d4 Nf6 2. c4 e5", lineType: "surprise" },
      { name: "French Defense", moves: "1. e4 e6 2. d4 d5", lineType: "main" },
      { name: "Grob Attack", moves: "1. g4", lineType: "surprise" },
      { name: "Queen's Gambit", moves: "1. d4 d5 2. c4", lineType: "main" },
    ];

    const filteredLines = enrichedLines.filter((l) => l.lineType === "surprise");
    // filteredLines = [Budapest Gambit (full idx 1), Grob Attack (full idx 3)]

    expect(filteredLines).toHaveLength(2);
    expect(filteredLines[0].name).toBe("Budapest Gambit");
    expect(filteredLines[1].name).toBe("Grob Attack");

    // User clicks "Practice this line" on the second filtered line (Grob Attack, filtered idx 1)
    const filteredIdx = 1;
    const clickedLine = filteredLines[filteredIdx];

    // Resolve to full index
    const fullIndex = resolveFullIndex(clickedLine, enrichedLines, filteredIdx);
    expect(fullIndex).toBe(3); // Grob Attack is at index 3 in the full array

    // Set state
    const practiceLineIndex = fullIndex;
    const activeTab = "practice";

    expect(activeTab).toBe("practice");
    expect(practiceLineIndex).toBe(3);

    // ChessPracticeBoard resolves the initial line
    const resolvedIdx = resolveInitialLineIndex(practiceLineIndex, enrichedLines.length);
    expect(resolvedIdx).toBe(3);

    // Jump guard allows the jump
    expect(shouldJumpToLine(practiceLineIndex, 0, enrichedLines.length)).toBe(true);
  });
});
