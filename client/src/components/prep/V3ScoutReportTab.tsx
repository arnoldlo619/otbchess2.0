/**
 * V3ScoutReportTab — renders ScoutReportV3 in a premium progressive-disclosure layout.
 *
 * Structure:
 * 1. Prep Snapshot — top 3 highest-value insights above the fold
 * 2. Opening Forecast — nested move trees with conditional denominators
 * 3. Game Plan — "If You Have White" / "If You Have Black" with resolved insights
 * 4. All Insights — filterable cards with full detail
 * 5. Prep Checklist — actionable items with progress tracking
 * 6. Evidence & Methodology — collapsed data quality + guard log
 */
import { useState, useMemo } from "react";
import { Chess } from "chess.js";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { Insight, ScoutReportV3 } from "../../../../shared/prepTypes";
import { InsightCard } from "./InsightCard";
import { DataQualityBanner } from "./DataQualityBanner";
import { ScoutAISummary } from "./ScoutAISummary";
import { ForecastWalkthrough } from "./ForecastWalkthrough";
import { PopulationContextCard } from "./PopulationContextCard";
import { buildPositionAnalysisUrl } from "../../lib/analyzeAction";

type Tokens = {
  card: string;
  cardSubtle: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  divider: string;
  monoBlock: string;
  [key: string]: string;
};

function canonicalUciPathFromSanLine(line: string): string[] | null {
  const chess = new Chess();
  const path: string[] = [];
  const tokens = line.trim().split(/\s+/).map(token => token.replace(/^\d+\.(?:\.\.)?/, "")).filter(Boolean);
  for (const token of tokens) {
    if (/^(1-0|0-1|1\/2-1\/2|\*)$/.test(token)) continue;
    try {
      const move = chess.move(token);
      path.push(move.from + move.to + (move.promotion ?? ""));
    } catch {
      return null;
    }
  }
  return path.length > 0 ? path : null;
}

interface Props {
  report: ScoutReportV3;
  isDark: boolean;
  t: Tokens;
  myColor?: "white" | "black" | "not_sure";
  reportCacheKey?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolveInsights(ids: string[], allInsights: Insight[]): Insight[] {
  const map = new Map(allInsights.map(i => [i.id, i]));
  return ids.map(id => map.get(id)).filter(Boolean) as Insight[];
}

// ── Prep Snapshot ─────────────────────────────────────────────────────────────

function PrepSnapshot({
  insights,
  isDark,
  t,
}: {
  insights: Insight[];
  isDark: boolean;
  t: Tokens;
}) {
  if (insights.length === 0) return null;

  // Resolve the two recurring preparation surfaces from the strongest evidence.
  const priority: Insight["kind"][] = ["weakness", "deviation_point", "opening_tendency", "response_pattern", "strength", "behavior"];
  const sorted = [...insights].sort((a, b) => {
    const ai = priority.indexOf(a.kind);
    const bi = priority.indexOf(b.kind);
    if (ai !== bi) return ai - bi;
    return b.sampleSize - a.sampleSize;
  });
  const findOpeningInsight = (pattern: RegExp) => sorted.find((insight) =>
    pattern.test(`${insight.claim} ${insight.recommendation.action} ${insight.recommendation.line?.san ?? ""}`),
  );
  const snapshotRows = [
    { id: "e4", label: "Against e4", insight: findOpeningInsight(/\b1\.?e4\b/i) },
    { id: "d5", label: "Against d5", insight: findOpeningInsight(/\b1\.\.\.d5\b|\bd5\b/i) },
  ];
  const rowDetail = (label: string, insight: Insight) => {
    if (label === "Against e4") {
      return insight.claim
        .replace(/^Against\s+1\.?e4\s+they\s*/i, "")
        .replace(/^choose\s+/i, "");
    }

    const combined = `${insight.claim} ${insight.recommendation.action}`;
    if (/1\.\.\.d5|\bScandinavian\b/i.test(combined)) {
      return "Prepare your Scandinavian Defense response.";
    }
    return "Prepare your reply before the game.";
  };

  return (
    <div className={`${t.card} p-4 sm:p-5`}>
      <div className="mb-4">
        <h3 className={`font-bold text-sm ${t.textPrimary}`}>Prep Snapshot</h3>
      </div>
      <div className={`divide-y ${t.divider}`}>
        {snapshotRows.map(({ id, label, insight }) => (
          <div key={id} className="py-3 first:pt-0 last:pb-0">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className={`text-sm font-semibold ${t.textPrimary}`}>{label}</p>
                {insight ? (
                  <p className={`mt-1 text-sm leading-snug ${t.textSecondary}`}>{rowDetail(label, insight)}</p>
                ) : (
                  <p className={`mt-1 text-sm ${t.textTertiary}`}>No repeatable pattern in the analyzed games.</p>
                )}
              </div>
              {insight && <span className={`shrink-0 text-[10px] font-medium ${t.textTertiary}`}>n={insight.sampleSize}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// OpeningForecastSection is replaced by ForecastWalkthrough (board-first interactive redesign)

// ── Game Plan Section ─────────────────────────────────────────────────────────

function GamePlanSection({
  title,
  insights,
  isDark,
  t,
  analysisHrefForInsight,
}: {
  title: string;
  insights: Insight[];
  isDark: boolean;
  t: Tokens;
  analysisHrefForInsight?: (insight: Insight) => string | null;
}) {
  const [expanded, setExpanded] = useState(true);
  if (insights.length === 0) return null;

  return (
    <div className={`${t.card} p-4 sm:p-5`}>
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-2 mb-3 text-left"
        aria-expanded={expanded}
      >
        <h3 className={`font-semibold text-sm flex-1 ${t.textPrimary}`}>{title}</h3>
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isDark ? "bg-white/06 text-white/30" : "bg-[#ADBC9F]/50 text-[#436850]"}`}>
          {insights.length}
        </span>
        {expanded
          ? <ChevronDown className={`w-3.5 h-3.5 ${t.textTertiary}`} />
          : <ChevronRight className={`w-3.5 h-3.5 ${t.textTertiary}`} />
        }
      </button>
      {expanded && (
        <div className="space-y-2">
          {insights.map((ins) => (
            <div
              key={ins.id}
              id={`game-plan-${ins.id}`}
              className={`flex items-start gap-2.5 p-2.5 rounded-xl ${isDark ? "bg-[#0d1a0f]/40 border border-[#1e2e22]/30" : "bg-[#f8faf5]/80 border border-[#ADBC9F]/25"}`}
            >
              <span className={`mt-0.5 shrink-0 w-1.5 h-1.5 rounded-full ${
                ins.kind === "weakness" ? "bg-red-400" :
                ins.kind === "strength" ? "bg-emerald-400" :
                isDark ? "bg-[#5B9A6A]" : "bg-[#436850]"
              }`} />
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-medium leading-relaxed ${t.textPrimary}`}>
                  {ins.recommendation.action}
                </p>
                <p className={`text-[11px] mt-0.5 ${t.textTertiary}`}>
                  {ins.kind === "weakness" ? "Exploit" : ins.kind === "strength" ? "Avoid" : "Prepare"} · n={ins.sampleSize} · {ins.confidence}
                </p>
                {analysisHrefForInsight?.(ins) && (
                  <a
                    href={analysisHrefForInsight(ins) ?? undefined}
                    className={`inline-flex mt-2 items-center rounded-md px-2 py-1 text-[10px] font-semibold transition-colors ${isDark ? "bg-[#436850]/20 text-[#8dcc9b] hover:bg-[#436850]/35" : "bg-[#436850]/10 text-[#315640] hover:bg-[#436850]/20"}`}
                  >
                    Analyze line
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Prep Checklist ────────────────────────────────────────────────────────────

function PrepChecklist({
  items,
  isDark,
  t,
}: {
  items: { text: string; insightId: string }[];
  isDark: boolean;
  t: Tokens;
}) {
  const [checked, setChecked] = useState<Set<string>>(() => new Set());
  if (items.length === 0) return null;

  const toggle = (id: string) => {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const doneCount = items.filter(i => checked.has(i.insightId)).length;

  return (
    <div className={`${t.card} p-4 sm:p-5`}>
      <div className="flex items-center gap-2 mb-3">
        <h3 className={`font-semibold text-sm flex-1 ${t.textPrimary}`}>Prep Checklist</h3>
        <span className={`text-[10px] font-bold ${isDark ? "text-white/40" : "text-[#436850]"}`}>
          {doneCount}/{items.length}
        </span>
      </div>
      {/* Progress bar */}
      <div className={`h-1 rounded-full mb-3 ${isDark ? "bg-[#1e2e22]" : "bg-[#ADBC9F]/40"}`}>
        <div
          className="h-full rounded-full bg-[#436850] transition-all duration-300"
          style={{ width: `${items.length ? (doneCount / items.length) * 100 : 0}%` }}
        />
      </div>
      <ul className="space-y-2">
        {items.map((item) => {
          const done = checked.has(item.insightId);
          return (
            <li key={item.insightId}>
              <button
                onClick={() => toggle(item.insightId)}
                className={`w-full flex items-start gap-2.5 text-left text-xs leading-relaxed transition-opacity ${done ? "opacity-50" : ""}`}
              >
                <span className={`mt-0.5 shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                  done
                    ? "bg-[#436850] border-[#436850]"
                    : isDark ? "border-[#2e4a34]" : "border-[#ADBC9F]"
                }`}>
                  {done && <span className="text-white text-[9px] font-bold">✓</span>}
                </span>
                <span className={`${done ? "line-through" : ""} ${t.textSecondary}`}>{item.text}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ── Evidence & Methodology (collapsed) ───────────────────────────────────────

function EvidenceSection({
  report,
  isDark,
  t,
}: {
  report: ScoutReportV3;
  isDark: boolean;
  t: Tokens;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`${t.card} overflow-hidden`}>
      <button
        onClick={() => setExpanded(e => !e)}
        className={`w-full flex items-center gap-2 p-4 sm:p-5 text-left ${isDark ? "hover:bg-white/[0.02]" : "hover:bg-[#FBFADA]/50"}`}
        aria-expanded={expanded}
      >
        <h3 className={`font-semibold text-sm flex-1 ${t.textTertiary}`}>Evidence & Methodology</h3>
        {expanded
          ? <ChevronDown className={`w-3.5 h-3.5 ${t.textTertiary}`} />
          : <ChevronRight className={`w-3.5 h-3.5 ${t.textTertiary}`} />
        }
      </button>
      {expanded && (
        <div className={`px-4 sm:px-5 pb-4 sm:pb-5 space-y-3 border-t ${t.divider}`}>
          <DataQualityBanner dataQuality={report.dataQuality} isDark={isDark} />
          {report.guardLog.droppedInsights > 0 && (
            <div className={`text-xs ${t.textTertiary}`}>
              <p className="font-semibold mb-1">Quality Gates</p>
              <p>{report.guardLog.droppedInsights} insight(s) dropped by guards:</p>
              <ul className="mt-1 space-y-0.5">
                {Object.entries(report.guardLog.reasons).map(([reason, count]) => (
                  <li key={reason}>· {reason.replace(/_/g, " ")}: {count}</li>
                ))}
              </ul>
            </div>
          )}
          <div className={`text-[11px] ${t.textTertiary}`}>
            <p>Engine v{report.engineVersion} · Generated {new Date(report.generatedAt).toLocaleString()}</p>
            <p className="mt-1">
              Confidence is computed via Wilson 95% interval. Insights require n≥6 and baseline delta ≥12pp to qualify.
              Headline sections require n≥8 and confidence ≥ medium. All move sequences are validated with chess.js.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function V3ScoutReportTab({ report, isDark, t, myColor = "not_sure", reportCacheKey }: Props) {
  const s = report.sections;

  // Resolve section IDs to actual insight objects
  const allInsights = report.insights;
  const weaknessInsights = useMemo(
    () => resolveInsights(s.weaknesses, allInsights),
    [s.weaknesses, allInsights],
  );

  // Apply color filter based on myColor (opponent's color is opposite of user's color)
  const filteredInsights = useMemo(() => {
    if (myColor === "not_sure") return allInsights;
    // When user plays White, opponent plays Black — show insights about opponent's Black games
    const opponentColor = myColor === "white" ? "black" : "white";
    return allInsights.filter(ins => ins.color === opponentColor);
  }, [allInsights, myColor]);

  // Resolve game plan sections
  const ifWhiteInsights = useMemo(() => resolveInsights(s.ifYouHaveWhite, allInsights), [s.ifYouHaveWhite, allInsights]);
  const ifBlackInsights = useMemo(() => resolveInsights(s.ifYouHaveBlack, allInsights), [s.ifYouHaveBlack, allInsights]);
  const analysisHrefForInsight = (insight: Insight): string | null => {
    if (!reportCacheKey || !insight.recommendation.line?.san) return null;
    const canonicalUciPath = canonicalUciPathFromSanLine(insight.recommendation.line.san);
    return canonicalUciPath ? buildPositionAnalysisUrl({
      reportCacheKey,
      canonicalUciPath,
      evidenceClaimId: insight.id,
      returnPath: `${window.location.pathname}${window.location.search}#game-plan-${insight.id}`,
    }) : null;
  };

  // Insight filter for the "All Insights" section
  const [insightFilter, setInsightFilter] = useState<"all" | "weakness" | "strength" | "deviation_point" | "behavior" | "opening_tendency" | "response_pattern">("all");

  const displayedInsights = useMemo(() => {
    const base = insightFilter === "all" ? filteredInsights : filteredInsights.filter(i => i.kind === insightFilter);
    return base;
  }, [filteredInsights, insightFilter]);

  const filterOptions: { id: typeof insightFilter; label: string }[] = [
    { id: "all",              label: "All" },
    { id: "weakness",         label: "Weaknesses" },
    { id: "strength",         label: "Strengths" },
    { id: "opening_tendency", label: "Openings" },
    { id: "deviation_point",  label: "Deviations" },
    { id: "response_pattern", label: "Responses" },
    { id: "behavior",         label: "Behavior" },
  ];

  return (
    <div className="space-y-4">

      {/* Prep Snapshot — top 3 above the fold */}
      <PrepSnapshot insights={filteredInsights} isDark={isDark} t={t} />

      <PopulationContextCard references={report.populationReferences} isDark={isDark} />

      {/* 3. Opening Forecast — board-first interactive walkthrough */}
      <ForecastWalkthrough
        openingForecast={report.openingForecast}
        myColor={myColor}
        isDark={isDark}
        t={t}
        opponentUsername={report.opponent.username}
        weaknessInsights={weaknessInsights}
        analysisHrefForUciPath={reportCacheKey ? (canonicalUciPath) => buildPositionAnalysisUrl({
          reportCacheKey,
          canonicalUciPath,
          returnPath: `${window.location.pathname}${window.location.search}#opening-forecast`,
        }) : undefined}
      />

      {/* 4. Game Plan — If You Have White / Black */}
      {myColor !== "black" && ifWhiteInsights.length > 0 && (
        <GamePlanSection
          title="If You Have White"
          insights={ifWhiteInsights}
          isDark={isDark}
          t={t}
          analysisHrefForInsight={analysisHrefForInsight}
        />
      )}
      {myColor !== "white" && ifBlackInsights.length > 0 && (
        <GamePlanSection
          title="If You Have Black"
          insights={ifBlackInsights}
          isDark={isDark}
          t={t}
          analysisHrefForInsight={analysisHrefForInsight}
        />
      )}

      {/* 5. All Insights — filterable */}
      {filteredInsights.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h3 className={`font-semibold text-sm ${t.textPrimary}`}>Detailed Insights</h3>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isDark ? "bg-white/06 text-white/30" : "bg-[#ADBC9F]/50 text-[#436850]"}`}>
              {filteredInsights.length}
            </span>
          </div>

          {/* Filter bar */}
          <div className="flex items-center gap-1 flex-wrap">
            {filterOptions.map(opt => {
              const count = opt.id === "all"
                ? filteredInsights.length
                : filteredInsights.filter(i => i.kind === opt.id).length;
              if (count === 0 && opt.id !== "all") return null;
              return (
                <button
                  key={opt.id}
                  onClick={() => setInsightFilter(opt.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                    insightFilter === opt.id
                      ? "bg-[#436850] text-white"
                      : isDark ? "bg-[#0f1c11] border border-[#1e2e22]/70 text-white/40 hover:text-white/70" : "bg-white border border-[#ADBC9F]/80 text-[#436850] hover:text-[#12372A]"
                  }`}
                >
                  {opt.label}
                  <span className="opacity-60">({count})</span>
                </button>
              );
            })}
          </div>

          {/* Insight cards */}
          <div className="space-y-3">
            {displayedInsights.map((insight, i) => (
              <InsightCard key={insight.id} insight={insight} index={i} isDark={isDark} reportCacheKey={reportCacheKey} />
            ))}
          </div>
        </div>
      )}

      {/* 6. Prep Checklist */}
      <PrepChecklist items={s.prepChecklist} isDark={isDark} t={t} />

      {/* 7. Evidence & Methodology (collapsed) */}
      <EvidenceSection report={report} isDark={isDark} t={t} />
    </div>
  );
}
