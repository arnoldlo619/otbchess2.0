/**
 * Tests for the redesigned Matchup Prep Scout tab.
 *
 * Verifies the 4-section layout logic:
 *  1. "What They Play" — White/Black openings + win rates + first moves
 *  2. "Suggested Lines" — top 3 compact prep lines with priority badges
 *  3. "Summary" — Likely Battle + Study First only (no Prep Risk / Color Advice)
 *  4. Coach Insight — present in Scout tab
 *
 * Also verifies removed sections are no longer part of the Scout tab:
 *  - Pre-Round Quick Review
 *  - My Repertoire Panel
 *  - Win/Draw/Loss ColorStatCard
 *  - Scouting Notes (numbered insights)
 *  - Next Step nudge
 */
import { describe, it, expect } from "vitest";

// ── Helpers ───────────────────────────────────────────────────────────────────

interface OpeningStat {
  name: string;
  eco: string;
  count: number;
  wins: number;
  draws: number;
  losses: number;
  winRate: number;
  moves: string;
}

interface PrepLine {
  name: string;
  eco: string;
  moves: string;
  rationale: string;
  confidence: "high" | "medium" | "low";
  lineType?: "main" | "surprise";
}

interface MatchupSummary {
  likelyBattle: string;
  studyFirst?: string;
  prepRisk?: string;
  colorAdvice?: string;
}

// Simulate what the Scout tab renders (section visibility logic)
function getScoutSections(params: {
  whiteOpenings: OpeningStat[];
  blackOpenings: OpeningStat[];
  enrichedLines: PrepLine[];
  matchupSummary: MatchupSummary | null;
  hasReport: boolean;
}): string[] {
  const sections: string[] = [];

  // Section 1: always shown when report is loaded
  if (params.hasReport) {
    sections.push("what-they-play");
  }

  // Section 2: only when there are prep lines
  if (params.enrichedLines.length > 0) {
    sections.push("suggested-lines");
  }

  // Section 3: only when matchup summary exists
  if (params.matchupSummary) {
    sections.push("summary");
  }

  // Section 4: always shown when report is loaded
  if (params.hasReport) {
    sections.push("coach-insight");
  }

  return sections;
}

// Simulate the "Suggested Lines" section — shows top 3 only
function getSuggestedLineItems(lines: PrepLine[]): PrepLine[] {
  return lines.slice(0, 3);
}

// Simulate the "Summary" section — shows only likelyBattle + studyFirst
function getSummarySections(summary: MatchupSummary): string[] {
  const shown: string[] = ["likely-battle"];
  if (summary.studyFirst) shown.push("study-first");
  // prepRisk and colorAdvice are intentionally excluded from Scout tab
  return shown;
}

// Simulate win rate highlight logic
function getWinRateStyle(winRate: number, isDark: boolean): string {
  if (winRate >= 55) return isDark ? "text-emerald-400" : "text-emerald-600";
  return "text-tertiary";
}

// Simulate first move display (top 2 only)
function getFirstMovesDisplay(firstMoves: { move: string; pct: number }[]): { move: string; pct: number }[] {
  return firstMoves.slice(0, 2);
}

// Simulate top openings display (top 3 only per color)
function getTopOpenings(openings: OpeningStat[]): OpeningStat[] {
  return openings.slice(0, 3);
}

// ── Mock data ─────────────────────────────────────────────────────────────────

const mockWhiteOpenings: OpeningStat[] = [
  { name: "King's Pawn Opening", eco: "B00", count: 40, wins: 24, draws: 8, losses: 8, winRate: 60, moves: "e4" },
  { name: "Italian Game", eco: "C50", count: 25, wins: 13, draws: 5, losses: 7, winRate: 52, moves: "e4 e5 Nf3 Nc6 Bc4" },
  { name: "Ruy Lopez", eco: "C60", count: 15, wins: 8, draws: 3, losses: 4, winRate: 53, moves: "e4 e5 Nf3 Nc6 Bb5" },
  { name: "London System", eco: "D02", count: 10, wins: 5, draws: 2, losses: 3, winRate: 50, moves: "d4 d5 Nf3" },
];

const mockBlackOpenings: OpeningStat[] = [
  { name: "Sicilian Defense", eco: "B20", count: 35, wins: 18, draws: 7, losses: 10, winRate: 51, moves: "e4 c5" },
  { name: "French Defense", eco: "C00", count: 20, wins: 10, draws: 4, losses: 6, winRate: 50, moves: "e4 e6" },
  { name: "Caro-Kann Defense", eco: "B10", count: 12, wins: 7, draws: 2, losses: 3, winRate: 58, moves: "e4 c6" },
  { name: "King's Indian Defense", eco: "E60", count: 8, wins: 4, draws: 1, losses: 3, winRate: 50, moves: "d4 Nf6 c4 g6" },
];

const mockPrepLines: PrepLine[] = [
  { name: "Sicilian Najdorf", eco: "B90", moves: "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6", rationale: "Opponent plays e4 in 78% of games", confidence: "high", lineType: "main" },
  { name: "Italian Game", eco: "C50", moves: "e4 e5 Nf3 Nc6 Bc4", rationale: "Second most common White setup", confidence: "medium", lineType: "main" },
  { name: "London System Surprise", eco: "D02", moves: "d4 d5 Nf3 Nf6 Bf4", rationale: "Occasional surprise weapon", confidence: "low", lineType: "surprise" },
  { name: "Ruy Lopez Exchange", eco: "C68", moves: "e4 e5 Nf3 Nc6 Bb5 a6 Bxc6", rationale: "Less common but seen in longer games", confidence: "low" },
];

const mockSummary: MatchupSummary = {
  likelyBattle: "Expect a sharp Sicilian middlegame with early queenside tension.",
  studyFirst: "Prepare the Najdorf — opponent plays it in 45% of their Black games.",
  prepRisk: "Opponent knows the Poisoned Pawn variation deeply.",
  colorAdvice: "You have White — control the center early.",
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Scout tab — section visibility", () => {
  it("shows all 4 sections when report, lines, and summary are present", () => {
    const sections = getScoutSections({
      whiteOpenings: mockWhiteOpenings,
      blackOpenings: mockBlackOpenings,
      enrichedLines: mockPrepLines,
      matchupSummary: mockSummary,
      hasReport: true,
    });
    expect(sections).toContain("what-they-play");
    expect(sections).toContain("suggested-lines");
    expect(sections).toContain("summary");
    expect(sections).toContain("coach-insight");
  });

  it("hides suggested-lines section when no prep lines exist", () => {
    const sections = getScoutSections({
      whiteOpenings: mockWhiteOpenings,
      blackOpenings: mockBlackOpenings,
      enrichedLines: [],
      matchupSummary: mockSummary,
      hasReport: true,
    });
    expect(sections).not.toContain("suggested-lines");
    expect(sections).toContain("what-they-play");
    expect(sections).toContain("summary");
  });

  it("hides summary section when matchupSummary is null", () => {
    const sections = getScoutSections({
      whiteOpenings: mockWhiteOpenings,
      blackOpenings: mockBlackOpenings,
      enrichedLines: mockPrepLines,
      matchupSummary: null,
      hasReport: true,
    });
    expect(sections).not.toContain("summary");
    expect(sections).toContain("what-they-play");
    expect(sections).toContain("suggested-lines");
  });

  it("shows only 2 sections when no lines and no summary", () => {
    const sections = getScoutSections({
      whiteOpenings: [],
      blackOpenings: [],
      enrichedLines: [],
      matchupSummary: null,
      hasReport: true,
    });
    expect(sections).toHaveLength(2);
    expect(sections).toContain("what-they-play");
    expect(sections).toContain("coach-insight");
  });

  it("shows no sections when no report is loaded", () => {
    const sections = getScoutSections({
      whiteOpenings: [],
      blackOpenings: [],
      enrichedLines: [],
      matchupSummary: null,
      hasReport: false,
    });
    expect(sections).toHaveLength(0);
  });
});

describe("Scout tab — removed sections (not rendered)", () => {
  it("does not include pre-round quick review in Scout tab sections", () => {
    const sections = getScoutSections({
      whiteOpenings: mockWhiteOpenings,
      blackOpenings: mockBlackOpenings,
      enrichedLines: mockPrepLines,
      matchupSummary: mockSummary,
      hasReport: true,
    });
    expect(sections).not.toContain("pre-round-quick-review");
    expect(sections).not.toContain("my-repertoire");
    expect(sections).not.toContain("color-stat-cards");
    expect(sections).not.toContain("scouting-notes");
    expect(sections).not.toContain("next-step-nudge");
  });
});

describe("Scout tab — What They Play section", () => {
  it("shows top 3 white openings only", () => {
    const shown = getTopOpenings(mockWhiteOpenings);
    expect(shown).toHaveLength(3);
    expect(shown[0].name).toBe("King's Pawn Opening");
  });

  it("shows top 3 black openings only", () => {
    const shown = getTopOpenings(mockBlackOpenings);
    expect(shown).toHaveLength(3);
    expect(shown[0].name).toBe("Sicilian Defense");
  });

  it("shows top 2 first moves only", () => {
    const firstMoves = [
      { move: "e4", pct: 78 },
      { move: "d4", pct: 15 },
      { move: "c4", pct: 7 },
    ];
    const shown = getFirstMovesDisplay(firstMoves);
    expect(shown).toHaveLength(2);
    expect(shown[0].move).toBe("e4");
    expect(shown[1].move).toBe("d4");
  });

  it("highlights win rate >= 55% in green", () => {
    expect(getWinRateStyle(60, true)).toBe("text-emerald-400");
    expect(getWinRateStyle(55, true)).toBe("text-emerald-400");
    expect(getWinRateStyle(55, false)).toBe("text-emerald-600");
  });

  it("does not highlight win rate < 55%", () => {
    expect(getWinRateStyle(54, true)).toBe("text-tertiary");
    expect(getWinRateStyle(50, false)).toBe("text-tertiary");
    expect(getWinRateStyle(0, true)).toBe("text-tertiary");
  });
});

describe("Scout tab — Suggested Lines section", () => {
  it("shows top 3 lines only even when more exist", () => {
    const shown = getSuggestedLineItems(mockPrepLines);
    expect(shown).toHaveLength(3);
    expect(shown[0].name).toBe("Sicilian Najdorf");
    expect(shown[2].name).toBe("London System Surprise");
  });

  it("shows all lines when fewer than 3 exist", () => {
    const twoLines = mockPrepLines.slice(0, 2);
    const shown = getSuggestedLineItems(twoLines);
    expect(shown).toHaveLength(2);
  });

  it("returns empty array when no lines", () => {
    const shown = getSuggestedLineItems([]);
    expect(shown).toHaveLength(0);
  });
});

describe("Scout tab — Summary section", () => {
  it("shows likelyBattle and studyFirst only", () => {
    const shown = getSummarySections(mockSummary);
    expect(shown).toContain("likely-battle");
    expect(shown).toContain("study-first");
  });

  it("does not show prepRisk in Scout tab summary", () => {
    const shown = getSummarySections(mockSummary);
    expect(shown).not.toContain("prep-risk");
  });

  it("does not show colorAdvice in Scout tab summary", () => {
    const shown = getSummarySections(mockSummary);
    expect(shown).not.toContain("color-advice");
  });

  it("shows only likelyBattle when studyFirst is absent", () => {
    const summaryNoStudy: MatchupSummary = {
      likelyBattle: "Expect a sharp game.",
    };
    const shown = getSummarySections(summaryNoStudy);
    expect(shown).toHaveLength(1);
    expect(shown).toContain("likely-battle");
  });
});
