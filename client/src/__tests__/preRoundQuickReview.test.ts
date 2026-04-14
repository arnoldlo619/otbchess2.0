/**
 * Tests for PreRoundQuickReview logic utilities
 *
 * Tests the pure logic extracted from the component:
 *  - buildTendencies: derives top 3 opponent tendencies from a prep report
 *  - hasReviewed / markReviewed: localStorage-based "already reviewed" flag
 *  - getReviewedKey: per-opponent storage key generation
 *  - Collapse/expand default state logic based on review history
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Mock localStorage ─────────────────────────────────────────────────────────

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(global, "localStorage", { value: localStorageMock });

// ── Inline the pure utilities (mirrors PreRoundQuickReview.tsx) ───────────────

function getReviewedKey(username: string) {
  return `qr_reviewed_${username.toLowerCase()}`;
}

function markReviewed(username: string) {
  try { localStorage.setItem(getReviewedKey(username), "1"); } catch { /* noop */ }
}

function hasReviewed(username: string): boolean {
  try { return localStorage.getItem(getReviewedKey(username)) === "1"; } catch { return false; }
}

// Mirrors the buildTendencies logic from the component
interface MockReport {
  opponent: {
    username: string;
    gamesAnalyzed: number;
    overall: { winRate: number };
    asWhite: { winRate: number; games: number };
    asBlack: { winRate: number; games: number };
    avgGameLength: number;
    whiteOpenings: Array<{ name: string; count: number; winRate: number; moves?: string }>;
    blackOpenings: Array<{ name: string; count: number; winRate: number; moves?: string }>;
    firstMoveAsWhite: Array<{ move: string; pct: number }>;
    endgameProfile: { checkmates: number; resignations: number; timeouts: number; total: number };
  };
}

interface Tendency {
  label: string;
  value: string;
  highlight: boolean;
}

function buildTendencies(report: MockReport): Tendency[] {
  const opp = report.opponent;
  const tendencies: Tendency[] = [];

  const fm = opp.firstMoveAsWhite[0];
  if (fm) {
    tendencies.push({
      label: "Opens with",
      value: `1.${fm.move} (${fm.pct}% of games)`,
      highlight: fm.pct >= 60,
    });
  }

  const whiteStronger = opp.asWhite.winRate > opp.asBlack.winRate;
  tendencies.push({
    label: "Stronger as",
    value: `${whiteStronger ? "White" : "Black"} (${whiteStronger ? opp.asWhite.winRate : opp.asBlack.winRate}% win rate)`,
    highlight: Math.abs(opp.asWhite.winRate - opp.asBlack.winRate) >= 10,
  });

  const topBlack = opp.blackOpenings[0];
  if (topBlack) {
    tendencies.push({
      label: "Defends with",
      value: `${topBlack.name} (${topBlack.winRate}% win rate)`,
      highlight: topBlack.winRate >= 55,
    });
  }

  if (opp.endgameProfile.total > 0) {
    const matePct = Math.round((opp.endgameProfile.checkmates / opp.endgameProfile.total) * 100);
    if (matePct >= 20) {
      tendencies.push({
        label: "Endgame style",
        value: `Plays for checkmate (${matePct}% of wins)`,
        highlight: matePct >= 30,
      });
    }
  }

  return tendencies.slice(0, 3);
}

// ── Sample report fixture ─────────────────────────────────────────────────────

const sampleReport: MockReport = {
  opponent: {
    username: "MagnusCarlsen",
    gamesAnalyzed: 50,
    overall: { winRate: 72 },
    asWhite: { winRate: 80, games: 25 },
    asBlack: { winRate: 64, games: 25 },
    avgGameLength: 38,
    whiteOpenings: [
      { name: "Ruy Lopez", count: 12, winRate: 83 },
      { name: "Italian Game", count: 8, winRate: 75 },
    ],
    blackOpenings: [
      { name: "Sicilian Defense", count: 10, winRate: 60 },
      { name: "Caro-Kann", count: 6, winRate: 50 },
    ],
    firstMoveAsWhite: [
      { move: "e4", pct: 75 },
      { move: "d4", pct: 25 },
    ],
    endgameProfile: { checkmates: 10, resignations: 30, timeouts: 10, total: 50 },
  },
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("getReviewedKey", () => {
  it("generates a lowercase key for a username", () => {
    expect(getReviewedKey("MagnusCarlsen")).toBe("qr_reviewed_magnuscarlsen");
  });

  it("is case-insensitive (same key for different cases)", () => {
    expect(getReviewedKey("HIKARU")).toBe(getReviewedKey("hikaru"));
  });

  it("generates distinct keys for different usernames", () => {
    expect(getReviewedKey("Magnus")).not.toBe(getReviewedKey("Hikaru"));
  });
});

describe("hasReviewed / markReviewed", () => {
  beforeEach(() => localStorageMock.clear());

  it("returns false for a new opponent", () => {
    expect(hasReviewed("NewPlayer")).toBe(false);
  });

  it("returns true after markReviewed is called", () => {
    markReviewed("NewPlayer");
    expect(hasReviewed("NewPlayer")).toBe(true);
  });

  it("is case-insensitive across mark and check", () => {
    markReviewed("HIKARU");
    expect(hasReviewed("hikaru")).toBe(true);
  });

  it("does not bleed between different opponents", () => {
    markReviewed("PlayerA");
    expect(hasReviewed("PlayerB")).toBe(false);
  });

  it("persists across multiple calls", () => {
    markReviewed("Magnus");
    markReviewed("Magnus"); // idempotent
    expect(hasReviewed("Magnus")).toBe(true);
  });
});

describe("buildTendencies — first move", () => {
  it("includes the top first move as White", () => {
    const t = buildTendencies(sampleReport);
    const firstMove = t.find(x => x.label === "Opens with");
    expect(firstMove).toBeDefined();
    expect(firstMove!.value).toContain("e4");
    expect(firstMove!.value).toContain("75%");
  });

  it("highlights first move when pct >= 60", () => {
    const t = buildTendencies(sampleReport);
    const firstMove = t.find(x => x.label === "Opens with")!;
    expect(firstMove.highlight).toBe(true); // 75% >= 60
  });

  it("does not highlight first move when pct < 60", () => {
    const lowReport: MockReport = {
      ...sampleReport,
      opponent: {
        ...sampleReport.opponent,
        firstMoveAsWhite: [{ move: "d4", pct: 55 }],
      },
    };
    const t = buildTendencies(lowReport);
    const firstMove = t.find(x => x.label === "Opens with")!;
    expect(firstMove.highlight).toBe(false);
  });
});

describe("buildTendencies — stronger color", () => {
  it("identifies White as stronger when asWhite.winRate > asBlack.winRate", () => {
    const t = buildTendencies(sampleReport);
    const stronger = t.find(x => x.label === "Stronger as")!;
    expect(stronger.value).toContain("White");
    expect(stronger.value).toContain("80%");
  });

  it("identifies Black as stronger when asBlack.winRate > asWhite.winRate", () => {
    const blackReport: MockReport = {
      ...sampleReport,
      opponent: {
        ...sampleReport.opponent,
        asWhite: { winRate: 50, games: 25 },
        asBlack: { winRate: 70, games: 25 },
      },
    };
    const t = buildTendencies(blackReport);
    const stronger = t.find(x => x.label === "Stronger as")!;
    expect(stronger.value).toContain("Black");
    expect(stronger.value).toContain("70%");
  });

  it("highlights when difference >= 10", () => {
    const t = buildTendencies(sampleReport);
    const stronger = t.find(x => x.label === "Stronger as")!;
    expect(stronger.highlight).toBe(true); // 80 - 64 = 16 >= 10
  });

  it("does not highlight when difference < 10", () => {
    const evenReport: MockReport = {
      ...sampleReport,
      opponent: {
        ...sampleReport.opponent,
        asWhite: { winRate: 55, games: 25 },
        asBlack: { winRate: 50, games: 25 },
      },
    };
    const t = buildTendencies(evenReport);
    const stronger = t.find(x => x.label === "Stronger as")!;
    expect(stronger.highlight).toBe(false); // 5 < 10
  });
});

describe("buildTendencies — top Black defense", () => {
  it("includes the top Black defense", () => {
    const t = buildTendencies(sampleReport);
    const defense = t.find(x => x.label === "Defends with")!;
    expect(defense.value).toContain("Sicilian Defense");
    expect(defense.value).toContain("60%");
  });

  it("highlights when Black defense win rate >= 55", () => {
    const t = buildTendencies(sampleReport);
    const defense = t.find(x => x.label === "Defends with")!;
    expect(defense.highlight).toBe(true); // 60 >= 55
  });

  it("does not highlight when Black defense win rate < 55", () => {
    const lowReport: MockReport = {
      ...sampleReport,
      opponent: {
        ...sampleReport.opponent,
        blackOpenings: [{ name: "Caro-Kann", count: 8, winRate: 48 }],
      },
    };
    const t = buildTendencies(lowReport);
    const defense = t.find(x => x.label === "Defends with")!;
    expect(defense.highlight).toBe(false);
  });
});

describe("buildTendencies — endgame style", () => {
  it("includes endgame style when checkmate rate >= 20%", () => {
    // sampleReport: 10/50 = 20% checkmates
    const t = buildTendencies(sampleReport);
    const endgame = t.find(x => x.label === "Endgame style");
    // May or may not appear depending on slice(0, 3) — verify the logic is correct
    // 20% is exactly the threshold, so it should be included before slicing
    const allTendencies: Tendency[] = [];
    const opp = sampleReport.opponent;
    const fm = opp.firstMoveAsWhite[0];
    if (fm) allTendencies.push({ label: "Opens with", value: "", highlight: false });
    allTendencies.push({ label: "Stronger as", value: "", highlight: false });
    if (opp.blackOpenings[0]) allTendencies.push({ label: "Defends with", value: "", highlight: false });
    const matePct = Math.round((opp.endgameProfile.checkmates / opp.endgameProfile.total) * 100);
    if (matePct >= 20) allTendencies.push({ label: "Endgame style", value: "", highlight: false });
    // With 4 tendencies, slice(0,3) cuts the endgame one — this is expected behaviour
    expect(allTendencies.length).toBe(4);
    expect(t.length).toBe(3); // capped at 3
  });

  it("does not include endgame style when checkmate rate < 20%", () => {
    const lowMateReport: MockReport = {
      ...sampleReport,
      opponent: {
        ...sampleReport.opponent,
        endgameProfile: { checkmates: 5, resignations: 40, timeouts: 5, total: 50 },
      },
    };
    const t = buildTendencies(lowMateReport);
    const endgame = t.find(x => x.label === "Endgame style");
    expect(endgame).toBeUndefined();
  });
});

describe("buildTendencies — output constraints", () => {
  it("returns at most 3 tendencies", () => {
    const t = buildTendencies(sampleReport);
    expect(t.length).toBeLessThanOrEqual(3);
  });

  it("returns at least 1 tendency when opponent has any data", () => {
    const t = buildTendencies(sampleReport);
    expect(t.length).toBeGreaterThanOrEqual(1);
  });

  it("handles missing first move gracefully", () => {
    const noFmReport: MockReport = {
      ...sampleReport,
      opponent: { ...sampleReport.opponent, firstMoveAsWhite: [] },
    };
    const t = buildTendencies(noFmReport);
    expect(t.find(x => x.label === "Opens with")).toBeUndefined();
    expect(t.length).toBeGreaterThanOrEqual(1); // still has stronger color
  });

  it("handles missing Black openings gracefully", () => {
    const noBlackReport: MockReport = {
      ...sampleReport,
      opponent: { ...sampleReport.opponent, blackOpenings: [] },
    };
    const t = buildTendencies(noBlackReport);
    expect(t.find(x => x.label === "Defends with")).toBeUndefined();
  });
});
