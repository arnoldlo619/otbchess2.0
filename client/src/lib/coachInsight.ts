/**
 * coachInsight.ts
 *
 * Coach-like insight translation layer for Matchup Prep (Phase 7).
 *
 * Architecture:
 * - QUOTA_CONFIG: single source of truth for plan limits (easy to change)
 * - Usage tracking: localStorage-based monthly counter (no server required for free)
 * - Prompt builder: constructs a grounded, data-driven coaching prompt
 * - Save/load: localStorage-based saved insights per opponent
 * - Types: CoachInsight, InsightContext, QuotaState
 */

// ─── Quota Configuration ──────────────────────────────────────────────────────
// Single source of truth. Change these values to adjust plan limits.

export const QUOTA_CONFIG = {
  free: 1,         // Free users: 1 coach insight per month
  pro: 10,         // Pro users: 10 coach insights per month (configurable)
  // Future plans can be added here:
  // club: 25,
  // enterprise: 100,
} as const;

export type PlanTier = keyof typeof QUOTA_CONFIG;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CoachInsight {
  id: string;
  opponentUsername: string;
  insightType: InsightType;
  content: string;
  generatedAt: string;
  /** Whether the user has saved this insight for later review */
  saved: boolean;
}

export type InsightType =
  | "matchup_overview"    // Full matchup coaching summary
  | "opening_collision"   // What opening battle is most likely
  | "key_line"            // Coaching note on a specific prep line
  | "quick_review";       // Pre-round last-minute reminder

export interface QuotaState {
  plan: PlanTier;
  used: number;
  limit: number;
  remaining: number;
  resetDate: string;  // ISO string of next monthly reset
  exhausted: boolean;
}

export interface InsightContext {
  opponentUsername: string;
  insightType: InsightType;
  // Opponent data
  gamesAnalyzed: number;
  overallWinRate: number;
  asWhiteWinRate: number;
  asBlackWinRate: number;
  avgGameLength: number;
  topWhiteOpenings: Array<{ name: string; count: number; winRate: number; moves: string }>;
  topBlackOpenings: Array<{ name: string; count: number; winRate: number; moves: string }>;
  firstMoveAsWhite: Array<{ move: string; pct: number }>;
  endgameProfile: { checkmates: number; resignations: number; timeouts: number; total: number };
  // User repertoire context (optional — enriches the prompt)
  userRepertoire?: {
    whiteFirstMove: string | null;
    blackVsE4: string | null;
    blackVsD4: string | null;
    expectedColor: "white" | "black" | null;
  };
  // Top prep lines (for key_line and matchup_overview types)
  topPrepLines?: Array<{
    name: string;
    moves: string;
    rationale: string;
    confidence: string;
    collisionScore?: number;
    repertoireFit?: string;
  }>;
  // Matchup summary signals (from Phase 6 collision engine)
  matchupSummary?: {
    likelyBattle: string;
    studyFirst: string;
    prepRisk: string;
    colorAdvice: string;
  };
  // Specific line context (for key_line type)
  focusLine?: {
    name: string;
    moves: string;
    rationale: string;
  };
}

// ─── Usage Tracking (localStorage) ───────────────────────────────────────────

const USAGE_KEY = "coachInsight_usage";

interface UsageRecord {
  count: number;
  month: string; // "YYYY-MM"
}

function getCurrentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getNextMonthReset(): string {
  const d = new Date();
  const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return next.toISOString();
}

export function getUsageRecord(): UsageRecord {
  try {
    const raw = localStorage.getItem(USAGE_KEY);
    if (!raw) return { count: 0, month: getCurrentMonth() };
    const record: UsageRecord = JSON.parse(raw);
    // Reset if new month
    if (record.month !== getCurrentMonth()) {
      return { count: 0, month: getCurrentMonth() };
    }
    return record;
  } catch {
    return { count: 0, month: getCurrentMonth() };
  }
}

export function incrementUsage(): void {
  const record = getUsageRecord();
  const updated: UsageRecord = {
    count: record.count + 1,
    month: getCurrentMonth(),
  };
  try {
    localStorage.setItem(USAGE_KEY, JSON.stringify(updated));
  } catch {
    // Silently fail if localStorage is unavailable
  }
}

export function resetUsageForTesting(): void {
  try {
    localStorage.removeItem(USAGE_KEY);
  } catch {
    // Silently fail
  }
}

export function getQuotaState(plan: PlanTier): QuotaState {
  const limit = QUOTA_CONFIG[plan];
  const record = getUsageRecord();
  const used = record.count;
  const remaining = Math.max(0, limit - used);
  return {
    plan,
    used,
    limit,
    remaining,
    resetDate: getNextMonthReset(),
    exhausted: remaining === 0,
  };
}

// ─── Saved Insights (localStorage) ───────────────────────────────────────────

const SAVED_KEY = "coachInsight_saved";

export function getSavedInsights(): CoachInsight[] {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as CoachInsight[];
  } catch {
    return [];
  }
}

export function saveInsight(insight: CoachInsight): void {
  const all = getSavedInsights();
  const updated = all.filter(i => i.id !== insight.id);
  updated.unshift({ ...insight, saved: true });
  // Keep last 20 saved insights
  const trimmed = updated.slice(0, 20);
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(trimmed));
  } catch {
    // Silently fail
  }
}

export function unsaveInsight(id: string): void {
  const all = getSavedInsights();
  const updated = all.filter(i => i.id !== id);
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(updated));
  } catch {
    // Silently fail
  }
}

export function getInsightsForOpponent(opponentUsername: string): CoachInsight[] {
  return getSavedInsights().filter(
    i => i.opponentUsername.toLowerCase() === opponentUsername.toLowerCase()
  );
}

// ─── Prompt Builder ───────────────────────────────────────────────────────────

/**
 * Builds a grounded, data-driven coaching prompt from available prep context.
 * The prompt instructs the LLM to sound like a concise, practical chess coach
 * — not a generic AI summarizer.
 */
export function buildCoachPrompt(ctx: InsightContext): string {
  const {
    opponentUsername,
    insightType,
    gamesAnalyzed,
    overallWinRate,
    asWhiteWinRate,
    asBlackWinRate,
    avgGameLength,
    topWhiteOpenings,
    topBlackOpenings,
    firstMoveAsWhite,
    endgameProfile,
    userRepertoire,
    topPrepLines,
    matchupSummary,
    focusLine,
  } = ctx;

  // ── System persona ──────────────────────────────────────────────────────────
  const systemPrompt = `You are a concise, practical chess coach helping a player prepare for an over-the-board game.

Your job is to translate raw matchup data into clear, actionable coaching insight.

Rules:
- Be concise. No fluff, no filler, no motivational clichés.
- Sound like a sharp, experienced coach — not a robot or a cheerleader.
- Ground every claim in the data provided. Do not invent analysis.
- Use plain chess language. Avoid jargon overload unless appropriate.
- Output should be 2–5 short paragraphs or a tight bullet list. Never a wall of text.
- End with one clear "key takeaway" the player should remember walking into the game.
- Do not start with "Great!" or "Sure!" or any filler opener.`;

  // ── Opponent data block ─────────────────────────────────────────────────────
  const whiteOpeningStr = topWhiteOpenings.slice(0, 3)
    .map(o => `${o.name} (${o.count} games, ${o.winRate}% win rate)`)
    .join("; ");
  const blackOpeningStr = topBlackOpenings.slice(0, 3)
    .map(o => `${o.name} (${o.count} games, ${o.winRate}% win rate)`)
    .join("; ");
  const firstMoveStr = firstMoveAsWhite.slice(0, 2)
    .map(m => `1.${m.move} (${m.pct}%)`)
    .join(", ");
  const endgameStr = endgameProfile.total > 0
    ? `${Math.round((endgameProfile.checkmates / endgameProfile.total) * 100)}% end in checkmate, ${Math.round((endgameProfile.resignations / endgameProfile.total) * 100)}% by resignation, ${Math.round((endgameProfile.timeouts / endgameProfile.total) * 100)}% on time`
    : "insufficient endgame data";

  const opponentBlock = `
OPPONENT: ${opponentUsername}
Games analyzed: ${gamesAnalyzed}
Overall win rate: ${overallWinRate}%
As White: ${asWhiteWinRate}% win rate
As Black: ${asBlackWinRate}% win rate
Average game length: ${avgGameLength} moves
First move as White: ${firstMoveStr || "unknown"}
Top White openings: ${whiteOpeningStr || "insufficient data"}
Top Black defenses: ${blackOpeningStr || "insufficient data"}
Game endings: ${endgameStr}`;

  // ── User repertoire block (if available) ───────────────────────────────────
  const repertoireBlock = userRepertoire
    ? `
MY REPERTOIRE:
Expected color: ${userRepertoire.expectedColor ?? "unknown"}
My first move as White: ${userRepertoire.whiteFirstMove ? `1.${userRepertoire.whiteFirstMove}` : "not set"}
My response to 1.e4: ${userRepertoire.blackVsE4 ?? "not set"}
My response to 1.d4: ${userRepertoire.blackVsD4 ?? "not set"}`
    : "";

  // ── Prep lines block ────────────────────────────────────────────────────────
  const prepLinesBlock = topPrepLines && topPrepLines.length > 0
    ? `
TOP PREP LINES (ranked by relevance):
${topPrepLines.slice(0, 4).map((l, i) =>
  `${i + 1}. ${l.name} — ${l.moves}
   Rationale: ${l.rationale}
   Confidence: ${l.confidence}${l.collisionScore !== undefined ? ` | Collision: ${l.collisionScore}%` : ""}${l.repertoireFit ? ` | Fit: ${l.repertoireFit}` : ""}`
).join("\n")}`
    : "";

  // ── Matchup summary signals ─────────────────────────────────────────────────
  const summaryBlock = matchupSummary
    ? `
PREP SIGNALS:
Likely battle: ${matchupSummary.likelyBattle}
Study first: ${matchupSummary.studyFirst}
Prep risk: ${matchupSummary.prepRisk}
Color advice: ${matchupSummary.colorAdvice}`
    : "";

  // ── Focus line (for key_line type) ─────────────────────────────────────────
  const focusBlock = focusLine
    ? `
FOCUS LINE:
${focusLine.name}: ${focusLine.moves}
Rationale: ${focusLine.rationale}`
    : "";

  // ── Task instruction by insight type ───────────────────────────────────────
  const taskInstructions: Record<InsightType, string> = {
    matchup_overview: `
TASK: Write a concise matchup coaching brief for this opponent.
Answer these questions in a tight, practical way:
1. What is the main thing to expect from this opponent?
2. What opening battle is most likely, and what does it mean practically?
3. What should I remember if I only study one thing?
4. Is there a practical danger, weakness, or tendency that stands out?
End with a single "Key takeaway:" line that is easy to remember.`,

    opening_collision: `
TASK: Explain the likely opening battle in this matchup.
Focus on:
1. What opening is most likely to arise based on both players' tendencies?
2. What does that opening battle mean practically — what are the key ideas?
3. What should I be specifically ready for in the first 10–15 moves?
Keep it sharp and practical. End with one key preparation point.`,

    key_line: `
TASK: Write a coaching note on the specific prep line provided.
Explain:
1. Why this line is important for this matchup specifically.
2. What the opponent is trying to achieve with it.
3. What the correct response or key idea is.
4. What to remember if this position arises over the board.
Be concise. This should feel like a coach explaining a line at the board.`,

    quick_review: `
TASK: Write a last-minute pre-round coaching reminder for this matchup.
This player is about to sit down and play. Give them:
1. The one opening line or idea they must remember.
2. One key tendency of this opponent to watch for.
3. One practical reminder for the game.
Keep it short, calm, and confidence-building. No essays.`,
  };

  const taskBlock = taskInstructions[insightType];

  // ── Assemble full prompt ────────────────────────────────────────────────────
  const userPrompt = [
    opponentBlock,
    repertoireBlock,
    summaryBlock,
    prepLinesBlock,
    focusBlock,
    taskBlock,
  ].filter(Boolean).join("\n");

  return JSON.stringify({ system: systemPrompt, user: userPrompt });
}

// ─── Insight ID Generator ─────────────────────────────────────────────────────

export function generateInsightId(): string {
  return `ci_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Insight Type Labels ──────────────────────────────────────────────────────

export const INSIGHT_TYPE_LABELS: Record<InsightType, string> = {
  matchup_overview: "Matchup Brief",
  opening_collision: "Opening Battle",
  key_line: "Line Coaching",
  quick_review: "Pre-Round Review",
};

export const INSIGHT_TYPE_DESCRIPTIONS: Record<InsightType, string> = {
  matchup_overview: "Full coaching summary of this matchup",
  opening_collision: "What opening battle is most likely",
  key_line: "Coaching note on a specific prep line",
  quick_review: "Last-minute reminder before the round",
};
