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
import {
  BookOpen, TrendingDown, TrendingUp, Zap, Target,
  ChevronDown, ChevronRight, GitBranch, CheckSquare, AlertCircle,
  Shield, Crosshair, Activity, Eye,
} from "lucide-react";
import type { Insight, ScoutReportV3 } from "../../../../shared/prepTypes";
import { InsightCard } from "./InsightCard";
import { DataQualityBanner } from "./DataQualityBanner";
import { ScoutAISummary } from "./ScoutAISummary";

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

interface Props {
  report: ScoutReportV3;
  isDark: boolean;
  t: Tokens;
  colorFilter?: "both" | "white" | "black";
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

  // Pick top 3: prioritize weaknesses, then deviation points, then tendencies
  const priority: Insight["kind"][] = ["weakness", "deviation_point", "opening_tendency", "response_pattern", "strength", "behavior"];
  const sorted = [...insights].sort((a, b) => {
    const ai = priority.indexOf(a.kind);
    const bi = priority.indexOf(b.kind);
    if (ai !== bi) return ai - bi;
    return b.sampleSize - a.sampleSize;
  });
  const top3 = sorted.slice(0, 3);

  const kindIcon: Record<string, React.ReactNode> = {
    weakness: <TrendingDown className="w-3.5 h-3.5 text-red-400" />,
    strength: <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />,
    deviation_point: <GitBranch className="w-3.5 h-3.5 text-purple-400" />,
    opening_tendency: <Crosshair className="w-3.5 h-3.5 text-blue-400" />,
    response_pattern: <Zap className="w-3.5 h-3.5 text-amber-400" />,
    behavior: <Activity className="w-3.5 h-3.5 text-orange-400" />,
  };

  return (
    <div className={`${t.card} p-4 sm:p-5`}>
      <div className="flex items-center gap-2 mb-4">
        <Target className={`w-4 h-4 ${isDark ? "text-[#5B9A6A]" : "text-[#436850]"}`} />
        <h3 className={`font-bold text-sm ${t.textPrimary}`}>Prep Snapshot</h3>
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${isDark ? "bg-[#436850]/20 text-[#5B9A6A]" : "bg-[#436850]/08 text-[#436850]"}`}>
          Top findings
        </span>
      </div>
      <div className="space-y-3">
        {top3.map((ins) => (
          <div
            key={ins.id}
            className={`flex items-start gap-3 p-3 rounded-xl ${isDark ? "bg-[#0d1a0f]/60 border border-[#1e2e22]/50" : "bg-[#f8faf5] border border-[#ADBC9F]/40"}`}
          >
            <span className="mt-0.5 shrink-0">{kindIcon[ins.kind] ?? <AlertCircle className="w-3.5 h-3.5" />}</span>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold leading-snug mb-1 ${t.textPrimary}`}>{ins.claim}</p>
              <p className={`text-xs leading-relaxed ${t.textSecondary}`}>{ins.recommendation.action}</p>
            </div>
            <span className={`shrink-0 text-[10px] font-medium ${t.textTertiary}`}>n={ins.sampleSize}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Opening Forecast (nested tree) ────────────────────────────────────────────

function OpeningForecastSection({
  openingForecast,
  isDark,
  t,
}: {
  openingForecast: ScoutReportV3["openingForecast"];
  isDark: boolean;
  t: Tokens;
}) {
  const [color, setColor] = useState<"white" | "black">("white");
  const branches = openingForecast[color] ?? [];

  if (branches.length === 0 && (openingForecast.black ?? []).length === 0) return null;

  const renderBranch = (branch: ScoutReportV3["openingForecast"]["white"][0], depth: number, parentCount: number) => {
    const pctOfParent = parentCount > 0 ? Math.round((branch.count / parentCount) * 100) : Math.round(branch.pct * 100);
    const scoreColor = branch.score >= 0.55 ? "text-emerald-400" : branch.score <= 0.45 ? "text-red-400" : t.textTertiary;

    return (
      <div key={`${depth}-${branch.moveSan}`} style={{ marginLeft: depth * 16 }}>
        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl mb-1 ${isDark ? "bg-[#1e2e22]/40" : "bg-[#ADBC9F]/15"}`}>
          <span className={`font-mono text-xs font-bold ${isDark ? "text-[#5B9A6A]" : "text-[#436850]"}`}>
            {branch.moveSan}
          </span>
          <div className="flex-1 h-1 rounded-full overflow-hidden bg-white/10">
            <div
              className="h-full rounded-full bg-[#436850]"
              style={{ width: `${pctOfParent}%` }}
            />
          </div>
          <span className={`text-[11px] font-semibold shrink-0 ${t.textTertiary}`}>
            {pctOfParent}%
          </span>
          <span className={`text-[10px] shrink-0 ${t.textTertiary}`}>
            ({branch.count})
          </span>
          <span className={`text-[10px] font-semibold shrink-0 ${scoreColor}`}>
            {Math.round(branch.score * 100)}%
          </span>
          {branch.label && (
            <span className={`text-[10px] truncate max-w-[100px] ${t.textTertiary}`}>
              {branch.label}
            </span>
          )}
        </div>
        {/* Render children (nested branches) */}
        {branch.children && branch.children.length > 0 && (
          <div className="ml-2">
            {branch.children.slice(0, 3).map(child => renderBranch(child, depth + 1, branch.count))}
          </div>
        )}
      </div>
    );
  };

  const activeBranches = openingForecast[color] ?? [];
  const totalGames = activeBranches.reduce((s, b) => s + b.count, 0);

  return (
    <div className={`${t.card} p-4 sm:p-5`}>
      <div className="flex items-center gap-2 mb-3">
        <BookOpen className={`w-4 h-4 ${isDark ? "text-[#5B9A6A]" : "text-[#436850]"}`} />
        <h3 className={`font-semibold text-sm flex-1 ${t.textPrimary}`}>Opening Forecast</h3>
        {/* Color toggle */}
        <div className={`flex items-center gap-0.5 p-0.5 rounded-lg ${isDark ? "bg-[#0d1a0f]/80 border border-[#1e2e22]/60" : "bg-[#ADBC9F]/40 border border-[#ADBC9F]/60"}`}>
          {(["white", "black"] as const).map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                color === c
                  ? "bg-[#436850] text-white"
                  : isDark ? "text-white/40 hover:text-white/70" : "text-[#436850] hover:text-[#12372A]"
              }`}
            >
              {c === "white" ? "♔ As White" : "♚ As Black"}
            </button>
          ))}
        </div>
      </div>
      {totalGames > 0 && (
        <p className={`text-[11px] mb-3 ${t.textTertiary}`}>
          Based on {totalGames} games as {color}. Percentages show frequency within each branch.
        </p>
      )}
      <div className="space-y-0.5">
        {activeBranches.slice(0, 5).map(branch => renderBranch(branch, 0, totalGames))}
      </div>
    </div>
  );
}

// ── Game Plan Section ─────────────────────────────────────────────────────────

function GamePlanSection({
  title,
  icon,
  insights,
  isDark,
  t,
}: {
  title: string;
  icon: React.ReactNode;
  insights: Insight[];
  isDark: boolean;
  t: Tokens;
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
        <span className={isDark ? "text-[#5B9A6A]" : "text-[#436850]"}>{icon}</span>
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
        <CheckSquare className={`w-4 h-4 ${isDark ? "text-[#5B9A6A]" : "text-[#436850]"}`} />
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
        <Eye className={`w-4 h-4 ${t.textTertiary}`} />
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

export function V3ScoutReportTab({ report, isDark, t, colorFilter = "both" }: Props) {
  const s = report.sections;

  // Resolve section IDs to actual insight objects
  const allInsights = report.insights;

  // Apply color filter
  const filteredInsights = useMemo(() => {
    if (colorFilter === "both") return allInsights;
    return allInsights.filter(ins => ins.color === colorFilter);
  }, [allInsights, colorFilter]);

  // Resolve game plan sections
  const ifWhiteInsights = useMemo(() => resolveInsights(s.ifYouHaveWhite, allInsights), [s.ifYouHaveWhite, allInsights]);
  const ifBlackInsights = useMemo(() => resolveInsights(s.ifYouHaveBlack, allInsights), [s.ifYouHaveBlack, allInsights]);

  // Insight filter for the "All Insights" section
  const [insightFilter, setInsightFilter] = useState<"all" | "weakness" | "strength" | "deviation_point" | "behavior" | "opening_tendency" | "response_pattern">("all");

  const displayedInsights = useMemo(() => {
    const base = insightFilter === "all" ? filteredInsights : filteredInsights.filter(i => i.kind === insightFilter);
    return base;
  }, [filteredInsights, insightFilter]);

  const filterOptions: { id: typeof insightFilter; label: string; icon: React.ReactNode }[] = [
    { id: "all",              label: "All",          icon: <Zap className="w-3 h-3" /> },
    { id: "weakness",         label: "Weaknesses",   icon: <TrendingDown className="w-3 h-3" /> },
    { id: "strength",         label: "Strengths",    icon: <TrendingUp className="w-3 h-3" /> },
    { id: "opening_tendency", label: "Openings",     icon: <Crosshair className="w-3 h-3" /> },
    { id: "deviation_point",  label: "Deviations",   icon: <GitBranch className="w-3 h-3" /> },
    { id: "response_pattern", label: "Responses",    icon: <Shield className="w-3 h-3" /> },
    { id: "behavior",         label: "Behavior",     icon: <AlertCircle className="w-3 h-3" /> },
  ];

  return (
    <div className="space-y-4">

      {/* 1. AI Scouting Summary */}
      <ScoutAISummary report={report} isDark={isDark} t={t} />

      {/* 2. Prep Snapshot — top 3 above the fold */}
      <PrepSnapshot insights={filteredInsights} isDark={isDark} t={t} />

      {/* 3. Opening Forecast — nested move trees */}
      <OpeningForecastSection openingForecast={report.openingForecast} isDark={isDark} t={t} />

      {/* 4. Game Plan — If You Have White / Black */}
      {colorFilter !== "black" && ifWhiteInsights.length > 0 && (
        <GamePlanSection
          title="If You Have White"
          icon={<Crosshair className="w-4 h-4" />}
          insights={ifWhiteInsights}
          isDark={isDark}
          t={t}
        />
      )}
      {colorFilter !== "white" && ifBlackInsights.length > 0 && (
        <GamePlanSection
          title="If You Have Black"
          icon={<Shield className="w-4 h-4" />}
          insights={ifBlackInsights}
          isDark={isDark}
          t={t}
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
                  {opt.icon}
                  {opt.label}
                  <span className="opacity-60">({count})</span>
                </button>
              );
            })}
          </div>

          {/* Insight cards */}
          <div className="space-y-3">
            {displayedInsights.map((insight, i) => (
              <InsightCard key={insight.id} insight={insight} index={i} isDark={isDark} />
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
