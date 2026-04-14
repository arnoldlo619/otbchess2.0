/**
 * PreRoundQuickReview.tsx
 *
 * A condensed, single-screen card designed for the 5 minutes before a game.
 *
 * Layout (top-to-bottom):
 *  1. Header — "Pre-Round Review" label + clock icon + collapse toggle
 *  2. Top 3 Tendencies — opponent's most important patterns in 3 compact rows
 *  3. #1 Prep Line — the highest-priority line with ECO, moves, rationale
 *  4. Quick Review Coach Insight — CoachInsightCard wired to "quick_review" type
 *
 * Design principles:
 *  - Collapsed by default if the user has already reviewed it (localStorage flag)
 *  - Expanded by default on first load for a new opponent
 *  - Amber accent (urgency) rather than the standard green
 *  - Compact, scannable — no scrolling needed on a phone screen
 */

import { useState, useEffect } from "react";
import { Timer, ChevronDown, ChevronUp, Flame, BookOpen, Shield } from "lucide-react";
import { CoachInsightCard } from "./CoachInsightCard";
import {
  type InsightContext,
  type QuotaState,
  getInsightsForOpponent,
} from "../lib/coachInsight";
import type { EnrichedPrepLine } from "../lib/userRepertoire";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PrepReport {
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

interface UserRepertoireSnap {
  whiteFirstMove: string | null;
  blackVsE4: string | null;
  blackVsD4: string | null;
  expectedColor: "white" | "black" | null;
}

interface PreRoundQuickReviewProps {
  report: PrepReport;
  enrichedLines: EnrichedPrepLine[];
  repertoire: UserRepertoireSnap;
  quota: QuotaState;
  onQuotaConsumed: () => void;
  isDark: boolean;
}

// ── Persistence key ───────────────────────────────────────────────────────────

function getReviewedKey(username: string) {
  return `qr_reviewed_${username.toLowerCase()}`;
}

function markReviewed(username: string) {
  try { localStorage.setItem(getReviewedKey(username), "1"); } catch { /* noop */ }
}

function hasReviewed(username: string): boolean {
  try { return localStorage.getItem(getReviewedKey(username)) === "1"; } catch { return false; }
}

// ── Tendency builder ──────────────────────────────────────────────────────────

interface Tendency {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight: boolean;
}

function buildTendencies(report: PrepReport): Tendency[] {
  const opp = report.opponent;
  const tendencies: Tendency[] = [];

  // 1. First move as White
  const fm = opp.firstMoveAsWhite[0];
  if (fm) {
    tendencies.push({
      icon: <Shield className="w-3.5 h-3.5" />,
      label: "Opens with",
      value: `1.${fm.move} (${fm.pct}% of games)`,
      highlight: fm.pct >= 60,
    });
  }

  // 2. Strongest color
  const whiteStronger = opp.asWhite.winRate > opp.asBlack.winRate;
  tendencies.push({
    icon: <Flame className="w-3.5 h-3.5" />,
    label: "Stronger as",
    value: `${whiteStronger ? "White" : "Black"} (${whiteStronger ? opp.asWhite.winRate : opp.asBlack.winRate}% win rate)`,
    highlight: Math.abs(opp.asWhite.winRate - opp.asBlack.winRate) >= 10,
  });

  // 3. Top Black defense
  const topBlack = opp.blackOpenings[0];
  if (topBlack) {
    tendencies.push({
      icon: <BookOpen className="w-3.5 h-3.5" />,
      label: "Defends with",
      value: `${topBlack.name} (${topBlack.winRate}% win rate)`,
      highlight: topBlack.winRate >= 55,
    });
  }

  // 4. Endgame style — if checkmate-heavy
  if (opp.endgameProfile.total > 0) {
    const matePct = Math.round((opp.endgameProfile.checkmates / opp.endgameProfile.total) * 100);
    if (matePct >= 20) {
      tendencies.push({
        icon: <Timer className="w-3.5 h-3.5" />,
        label: "Endgame style",
        value: `Plays for checkmate (${matePct}% of wins)`,
        highlight: matePct >= 30,
      });
    }
  }

  return tendencies.slice(0, 3);
}

// ── Main Component ────────────────────────────────────────────────────────────

export function PreRoundQuickReview({
  report,
  enrichedLines,
  repertoire,
  quota,
  onQuotaConsumed,
  isDark,
}: PreRoundQuickReviewProps) {
  const [expanded, setExpanded] = useState(() => !hasReviewed(report.opponent.username));

  // Mark reviewed when user first expands
  useEffect(() => {
    if (expanded) markReviewed(report.opponent.username);
  }, [expanded, report.opponent.username]);

  // Reset expanded state when opponent changes
  useEffect(() => {
    setExpanded(!hasReviewed(report.opponent.username));
  }, [report.opponent.username]);

  const tendencies = buildTendencies(report);
  const topLine = enrichedLines[0] ?? null;

  // Build InsightContext for quick_review
  const insightContext: InsightContext = {
    opponentUsername: report.opponent.username,
    insightType: "quick_review",
    gamesAnalyzed: report.opponent.gamesAnalyzed,
    overallWinRate: report.opponent.overall.winRate,
    asWhiteWinRate: report.opponent.asWhite.winRate,
    asBlackWinRate: report.opponent.asBlack.winRate,
    avgGameLength: report.opponent.avgGameLength,
    topWhiteOpenings: report.opponent.whiteOpenings.slice(0, 3).map(o => ({
      name: o.name, count: o.count, winRate: o.winRate, moves: o.moves ?? "",
    })),
    topBlackOpenings: report.opponent.blackOpenings.slice(0, 3).map(o => ({
      name: o.name, count: o.count, winRate: o.winRate, moves: o.moves ?? "",
    })),
    firstMoveAsWhite: report.opponent.firstMoveAsWhite.map(m => ({ move: m.move, pct: m.pct })),
    endgameProfile: {
      checkmates: report.opponent.endgameProfile.checkmates,
      resignations: report.opponent.endgameProfile.resignations,
      timeouts: report.opponent.endgameProfile.timeouts,
      total: report.opponent.endgameProfile.total,
    },
    userRepertoire: repertoire.whiteFirstMove !== null ? {
      whiteFirstMove: repertoire.whiteFirstMove,
      blackVsE4: repertoire.blackVsE4,
      blackVsD4: repertoire.blackVsD4,
      expectedColor: repertoire.expectedColor,
    } : undefined,
    topPrepLines: enrichedLines.slice(0, 2).map(l => ({
      name: l.name, moves: l.moves, rationale: l.rationale,
      confidence: l.confidence, collisionScore: l.collisionScore,
    })),
  };

  // Design tokens
  const cardBorder = isDark
    ? "bg-[#100d04] border border-amber-500/20"
    : "bg-amber-50/60 border border-amber-200/70";
  const headerText = isDark ? "text-amber-400" : "text-amber-700";
  const subText = isDark ? "text-white/55" : "text-gray-500";
  const bodyText = isDark ? "text-white/80" : "text-gray-700";
  const labelText = isDark ? "text-amber-400/60" : "text-amber-600/60";
  const rowBg = isDark ? "bg-white/03 border border-white/06" : "bg-white/70 border border-amber-200/40";
  const rowHighlight = isDark
    ? "bg-amber-500/08 border border-amber-500/20"
    : "bg-amber-50 border border-amber-200/60";
  const lineBg = isDark
    ? "bg-[#0a1409] border border-[#1e2e22]/60"
    : "bg-white border border-gray-200/70";
  const monoText = isDark ? "text-[#5B9A6A]" : "text-[#3D6B47]";
  const divider = isDark ? "border-amber-500/10" : "border-amber-200/50";

  return (
    <div className={`rounded-2xl overflow-hidden ${cardBorder}`}>
      {/* Amber top accent line */}
      <div className="h-0.5 bg-gradient-to-r from-amber-500 to-amber-400/50" />

      {/* Header row */}
      <button
        onClick={() => setExpanded(v => !v)}
        className={`w-full flex items-center justify-between px-4 py-3.5 transition-colors ${
          isDark ? "hover:bg-white/02" : "hover:bg-amber-50/80"
        }`}
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2.5">
          <Timer className={`w-4 h-4 shrink-0 ${headerText}`} />
          <div className="text-left">
            <p className={`text-xs font-bold uppercase tracking-widest ${headerText}`}>
              Pre-Round Review
            </p>
            <p className={`text-[11px] mt-0.5 ${subText}`}>
              5-minute game-day summary
            </p>
          </div>
        </div>
        {expanded
          ? <ChevronUp className={`w-4 h-4 shrink-0 ${subText}`} />
          : <ChevronDown className={`w-4 h-4 shrink-0 ${subText}`} />
        }
      </button>

      {/* Collapsible body */}
      {expanded && (
        <div className={`px-4 pb-4 space-y-4 border-t ${divider}`}>

          {/* ── Section 1: Top Tendencies ── */}
          <div className="pt-3.5">
            <p className={`text-[10px] font-semibold uppercase tracking-widest mb-2.5 ${labelText}`}>
              Key Tendencies
            </p>
            <div className="space-y-1.5">
              {tendencies.map((t, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl ${t.highlight ? rowHighlight : rowBg}`}
                >
                  <span className={t.highlight ? (isDark ? "text-amber-400" : "text-amber-600") : subText}>
                    {t.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className={`text-[10px] font-semibold uppercase tracking-wide mr-2 ${
                      t.highlight ? (isDark ? "text-amber-400/70" : "text-amber-600/70") : subText
                    }`}>
                      {t.label}
                    </span>
                    <span className={`text-sm ${bodyText}`}>{t.value}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Section 2: #1 Prep Line ── */}
          {topLine && (
            <div>
              <p className={`text-[10px] font-semibold uppercase tracking-widest mb-2.5 ${labelText}`}>
                #1 Prep Line
              </p>
              <div className={`rounded-xl p-3.5 ${lineBg}`}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className={`text-sm font-semibold ${bodyText}`}>{topLine.name}</p>
                  {topLine.eco && (
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md shrink-0 ${
                      isDark ? "bg-[#3D6B47]/15 text-[#5B9A6A]" : "bg-[#3D6B47]/08 text-[#3D6B47]"
                    }`}>
                      {topLine.eco}
                    </span>
                  )}
                </div>
                <p className={`text-xs font-mono leading-relaxed mb-2 ${monoText}`}>
                  {topLine.moves}
                </p>
                <p className={`text-xs leading-relaxed ${subText}`}>
                  {topLine.rationale}
                </p>
              </div>
            </div>
          )}

          {/* ── Section 3: Quick Review Coach Insight ── */}
          <div>
            <p className={`text-[10px] font-semibold uppercase tracking-widest mb-2.5 ${labelText}`}>
              Coach Reminder
            </p>
            <CoachInsightCard
              context={insightContext}
              quota={quota}
              onQuotaConsumed={onQuotaConsumed}
              existingInsight={
                getInsightsForOpponent(report.opponent.username)
                  .find(i => i.insightType === "quick_review") ?? null
              }
              compact
              label="Pre-Round Reminder"
            />
          </div>

        </div>
      )}
    </div>
  );
}
