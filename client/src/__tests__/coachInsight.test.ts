/**
 * Tests for coachInsight.ts — Phase 7 Coach Insight Engine
 *
 * Covers:
 * - QUOTA_CONFIG completeness and values
 * - getUsageRecord / incrementUsage / resetUsageForTesting
 * - getQuotaState (remaining, exhausted, reset date)
 * - getSavedInsights / saveInsight / unsaveInsight / getInsightsForOpponent
 * - buildCoachPrompt (content completeness, sections, personalization)
 * - generateInsightId (uniqueness, format)
 * - INSIGHT_TYPE_LABELS / INSIGHT_TYPE_DESCRIPTIONS completeness
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// ── localStorage mock for Node.js test environment ───────────────────────────
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(globalThis, "localStorage", { value: localStorageMock, writable: true });
import {
  QUOTA_CONFIG,
  type PlanTier,
  type CoachInsight,
  type InsightType,
  type InsightContext,
  getUsageRecord,
  incrementUsage,
  resetUsageForTesting,
  getQuotaState,
  getSavedInsights,
  saveInsight,
  unsaveInsight,
  getInsightsForOpponent,
  buildCoachPrompt,
  generateInsightId,
  INSIGHT_TYPE_LABELS,
  INSIGHT_TYPE_DESCRIPTIONS,
} from "../lib/coachInsight";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeInsight(overrides: Partial<CoachInsight> = {}): CoachInsight {
  return {
    id: generateInsightId(),
    opponentUsername: "testuser",
    insightType: "matchup_overview",
    content: "Test coaching insight content.",
    generatedAt: new Date().toISOString(),
    saved: false,
    ...overrides,
  };
}

function makeContext(overrides: Partial<InsightContext> = {}): InsightContext {
  return {
    opponentUsername: "magnus",
    insightType: "matchup_overview",
    gamesAnalyzed: 100,
    overallWinRate: 0.65,
    asWhiteWinRate: 0.70,
    asBlackWinRate: 0.60,
    avgGameLength: 42,
    topWhiteOpenings: [
      { name: "Ruy Lopez", count: 30, winRate: 0.75, moves: "1.e4 e5 2.Nf3 Nc6 3.Bb5" },
      { name: "Italian Game", count: 15, winRate: 0.60, moves: "1.e4 e5 2.Nf3 Nc6 3.Bc4" },
    ],
    topBlackOpenings: [
      { name: "Sicilian Defense", count: 25, winRate: 0.68, moves: "1.e4 c5" },
    ],
    firstMoveAsWhite: [
      { move: "e4", pct: 0.70 },
      { move: "d4", pct: 0.20 },
    ],
    endgameProfile: { checkmates: 10, resignations: 45, timeouts: 5, total: 60 },
    ...overrides,
  };
}

// ── QUOTA_CONFIG ──────────────────────────────────────────────────────────────

describe("QUOTA_CONFIG", () => {
  it("has entries for free and pro tiers", () => {
    const tiers: PlanTier[] = ["free", "pro"];
    for (const tier of tiers) {
      expect(QUOTA_CONFIG[tier]).toBeDefined();
      expect(typeof QUOTA_CONFIG[tier]).toBe("number");
    }
  });

  it("free tier has lower limit than pro", () => {
    expect(QUOTA_CONFIG.free).toBeLessThan(QUOTA_CONFIG.pro);
  });

  it("free tier limit is a positive integer", () => {
    expect(QUOTA_CONFIG.free).toBeGreaterThan(0);
    expect(Number.isInteger(QUOTA_CONFIG.free)).toBe(true);
  });

  it("pro tier limit is a positive integer", () => {
    expect(QUOTA_CONFIG.pro).toBeGreaterThan(0);
    expect(Number.isInteger(QUOTA_CONFIG.pro)).toBe(true);
  });
});

// ── Usage Tracking ────────────────────────────────────────────────────────────

describe("Usage tracking", () => {
  beforeEach(() => {
    resetUsageForTesting();
  });

  it("starts at 0 after reset", () => {
    const record = getUsageRecord();
    expect(record.count).toBe(0);
  });

  it("increments usage by 1 each call", () => {
    incrementUsage();
    expect(getUsageRecord().count).toBe(1);
    incrementUsage();
    expect(getUsageRecord().count).toBe(2);
  });

  it("records the current month", () => {
    const record = getUsageRecord();
    const now = new Date();
    const expectedMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    expect(record.month).toBe(expectedMonth);
  });
});

// ── getQuotaState ─────────────────────────────────────────────────────────────

describe("getQuotaState", () => {
  beforeEach(() => {
    resetUsageForTesting();
  });

  it("returns full remaining on fresh state", () => {
    const state = getQuotaState("free");
    expect(state.used).toBe(0);
    expect(state.remaining).toBe(QUOTA_CONFIG.free);
    expect(state.limit).toBe(QUOTA_CONFIG.free);
  });

  it("decrements remaining after incrementUsage", () => {
    incrementUsage();
    incrementUsage();
    const state = getQuotaState("free");
    expect(state.used).toBe(2);
    expect(state.remaining).toBe(Math.max(0, QUOTA_CONFIG.free - 2));
  });

  it("remaining never goes below 0", () => {
    const limit = QUOTA_CONFIG.free;
    for (let i = 0; i < limit + 5; i++) incrementUsage();
    const state = getQuotaState("free");
    expect(state.remaining).toBe(0);
  });

  it("exhausted is true when remaining is 0", () => {
    const limit = QUOTA_CONFIG.free;
    for (let i = 0; i < limit; i++) incrementUsage();
    const state = getQuotaState("free");
    expect(state.exhausted).toBe(true);
    expect(state.remaining).toBe(0);
  });

  it("exhausted is false when quota not consumed", () => {
    const state = getQuotaState("free");
    expect(state.exhausted).toBe(false);
  });

  it("resetDate is a valid ISO string in the future", () => {
    const state = getQuotaState("free");
    const resetDate = new Date(state.resetDate);
    expect(resetDate.getTime()).toBeGreaterThan(Date.now());
  });

  it("pro plan has higher limit than free", () => {
    const freeState = getQuotaState("free");
    const proState = getQuotaState("pro");
    expect(proState.limit).toBeGreaterThan(freeState.limit);
  });
});

// ── Saved Insights ────────────────────────────────────────────────────────────

describe("Saved insights", () => {
  const SAVED_KEY = "coachInsight_saved";

  beforeEach(() => {
    localStorage.removeItem(SAVED_KEY);
  });

  afterEach(() => {
    localStorage.removeItem(SAVED_KEY);
  });

  it("starts empty", () => {
    expect(getSavedInsights()).toEqual([]);
  });

  it("saves an insight and retrieves it", () => {
    const insight = makeInsight({ saved: true });
    saveInsight(insight);
    const saved = getSavedInsights();
    expect(saved).toHaveLength(1);
    expect(saved[0].id).toBe(insight.id);
  });

  it("does not duplicate on re-save of same id", () => {
    const insight = makeInsight({ saved: true });
    saveInsight(insight);
    saveInsight(insight);
    expect(getSavedInsights()).toHaveLength(1);
  });

  it("unsaves an insight by id", () => {
    const insight = makeInsight({ saved: true });
    saveInsight(insight);
    unsaveInsight(insight.id);
    expect(getSavedInsights()).toHaveLength(0);
  });

  it("unsave of non-existent id is a no-op", () => {
    const insight = makeInsight({ saved: true });
    saveInsight(insight);
    unsaveInsight("nonexistent-id");
    expect(getSavedInsights()).toHaveLength(1);
  });

  it("getInsightsForOpponent filters by username", () => {
    const a = makeInsight({ opponentUsername: "alice", id: "a1" });
    const b = makeInsight({ opponentUsername: "bob", id: "b1" });
    saveInsight(a);
    saveInsight(b);
    const forAlice = getInsightsForOpponent("alice");
    expect(forAlice).toHaveLength(1);
    expect(forAlice[0].opponentUsername).toBe("alice");
  });

  it("getInsightsForOpponent returns empty array for unknown opponent", () => {
    expect(getInsightsForOpponent("nobody")).toEqual([]);
  });

  it("saves multiple insights for same opponent", () => {
    const a = makeInsight({ id: "x1", insightType: "matchup_overview" });
    const b = makeInsight({ id: "x2", insightType: "key_line" });
    saveInsight(a);
    saveInsight(b);
    expect(getInsightsForOpponent("testuser")).toHaveLength(2);
  });
});

// ── buildCoachPrompt ──────────────────────────────────────────────────────────

describe("buildCoachPrompt", () => {
  it("includes opponent username", () => {
    const prompt = buildCoachPrompt(makeContext({ opponentUsername: "hikaru" }));
    expect(prompt).toContain("hikaru");
  });

  it("includes games analyzed count", () => {
    const prompt = buildCoachPrompt(makeContext({ gamesAnalyzed: 150 }));
    expect(prompt).toContain("150");
  });

  it("includes white win rate", () => {
    const prompt = buildCoachPrompt(makeContext({ asWhiteWinRate: 0.72 }));
    expect(prompt).toMatch(/72|0\.72/);
  });

  it("includes top white opening names", () => {
    const prompt = buildCoachPrompt(makeContext());
    expect(prompt).toContain("Ruy Lopez");
  });

  it("includes top black opening names", () => {
    const prompt = buildCoachPrompt(makeContext());
    expect(prompt).toContain("Sicilian");
  });

  it("includes first move frequency", () => {
    const prompt = buildCoachPrompt(makeContext());
    expect(prompt).toContain("e4");
  });

  it("includes user repertoire when provided", () => {
    const ctx = makeContext({
      userRepertoire: {
        whiteFirstMove: "1.d4",
        blackVsE4: "French Defense",
        blackVsD4: "King's Indian",
        expectedColor: "white",
      },
    });
    const prompt = buildCoachPrompt(ctx);
    expect(prompt).toContain("1.d4");
    expect(prompt).toContain("French");
  });

  it("includes focus line for key_line type", () => {
    const ctx = makeContext({
      insightType: "key_line",
      focusLine: {
        name: "Sicilian Najdorf",
        moves: "1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 a6",
        rationale: "Opponent plays this 60% of the time as Black.",
      },
    });
    const prompt = buildCoachPrompt(ctx);
    expect(prompt).toContain("Najdorf");
    expect(prompt).toContain("a6");
  });

  it("includes matchup summary signals when provided", () => {
    const ctx = makeContext({
      matchupSummary: {
        likelyBattle: "Sicilian Najdorf vs 1.e4",
        studyFirst: "Anti-Sicilian systems",
        prepRisk: "Opponent knows the Najdorf deeply",
        colorAdvice: "You play 1.e4 — expect the Sicilian",
      },
    });
    const prompt = buildCoachPrompt(ctx);
    expect(prompt).toContain("Najdorf");
    expect(prompt).toContain("Anti-Sicilian");
  });

  it("generates a non-empty string", () => {
    const prompt = buildCoachPrompt(makeContext());
    expect(prompt.length).toBeGreaterThan(100);
  });

  it("different insight types produce different prompts", () => {
    const overviewPrompt = buildCoachPrompt(makeContext({ insightType: "matchup_overview" }));
    const linePrompt = buildCoachPrompt(makeContext({ insightType: "key_line" }));
    expect(overviewPrompt).not.toBe(linePrompt);
  });
});

// ── generateInsightId ─────────────────────────────────────────────────────────

describe("generateInsightId", () => {
  it("generates a non-empty string", () => {
    expect(generateInsightId().length).toBeGreaterThan(0);
  });

  it("generates unique IDs on each call", () => {
    const ids = new Set(Array.from({ length: 20 }, () => generateInsightId()));
    expect(ids.size).toBe(20);
  });
});

// ── INSIGHT_TYPE_LABELS / DESCRIPTIONS ───────────────────────────────────────

describe("INSIGHT_TYPE_LABELS", () => {
  const insightTypes: InsightType[] = ["matchup_overview", "opening_collision", "key_line", "quick_review"];

  it("has a label for every insight type", () => {
    for (const type of insightTypes) {
      expect(INSIGHT_TYPE_LABELS[type]).toBeDefined();
      expect(INSIGHT_TYPE_LABELS[type].length).toBeGreaterThan(0);
    }
  });

  it("has a description for every insight type", () => {
    for (const type of insightTypes) {
      expect(INSIGHT_TYPE_DESCRIPTIONS[type]).toBeDefined();
      expect(INSIGHT_TYPE_DESCRIPTIONS[type].length).toBeGreaterThan(10);
    }
  });

  it("labels are unique", () => {
    const labels = Object.values(INSIGHT_TYPE_LABELS);
    const unique = new Set(labels);
    expect(unique.size).toBe(labels.length);
  });
});
