/**
 * V3ScoutReportTab — renders ScoutReportV3 in the Scout Report tab.
 * Replaces the V2 ScoutReportTab when ?schema=3 is active.
 */
import { useState } from "react";
import {
  BookOpen, TrendingDown, TrendingUp, Zap, Target,
  ChevronDown, ChevronRight, GitBranch, CheckSquare, AlertCircle,
} from "lucide-react";
import type { ScoutReportV3 } from "../../../../shared/prepTypes";
import { InsightCard } from "./InsightCard";
import { DataQualityBanner } from "./DataQualityBanner";

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
}

// ── Section helpers ────────────────────────────────────────────────────────────

function SectionList({
  title,
  icon,
  items,
  isDark,
  t,
  accentClass,
}: {
  title: string;
  icon: React.ReactNode;
  items: string[];
  isDark: boolean;
  t: Tokens;
  accentClass?: string;
}) {
  const [expanded, setExpanded] = useState(true);
  if (items.length === 0) return null;
  return (
    <div className={`${t.card} p-4 sm:p-5`}>
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-2 mb-3 text-left"
        aria-expanded={expanded}
      >
        <span className={accentClass ?? (isDark ? "text-[#5B9A6A]" : "text-[#436850]")}>{icon}</span>
        <h3 className={`font-semibold text-sm flex-1 ${t.textPrimary}`}>{title}</h3>
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isDark ? "bg-white/06 text-white/30" : "bg-[#ADBC9F]/50 text-[#436850]"}`}>
          {items.length}
        </span>
        {expanded
          ? <ChevronDown className={`w-3.5 h-3.5 ${t.textTertiary}`} />
          : <ChevronRight className={`w-3.5 h-3.5 ${t.textTertiary}`} />
        }
      </button>
      {expanded && (
        <ul className="space-y-2">
          {items.map((item, i) => (
            <li key={i} className={`flex items-start gap-2 text-xs leading-relaxed ${t.textSecondary}`}>
              <span className={`mt-0.5 shrink-0 w-1.5 h-1.5 rounded-full ${accentClass ? "bg-current" : isDark ? "bg-[#5B9A6A]" : "bg-[#436850]"}`} />
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

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
                    ? isDark ? "bg-[#436850] border-[#436850]" : "bg-[#436850] border-[#436850]"
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

  if (branches.length === 0) return null;

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
              className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition-all ${
                color === c
                  ? "bg-[#436850] text-white"
                  : isDark ? "text-white/40 hover:text-white/70" : "text-[#436850] hover:text-[#12372A]"
              }`}
            >
              {c === "white" ? "♔" : "♚"}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        {branches.slice(0, 6).map((branch, i) => (
          <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-xl ${isDark ? "bg-[#1e2e22]/40" : "bg-[#ADBC9F]/20"}`}>
            <span className={`font-mono text-xs font-semibold ${isDark ? "text-[#5B9A6A]" : "text-[#436850]"}`}>
              {branch.moveSan}
            </span>
            <div className="flex-1 h-1 rounded-full overflow-hidden bg-white/10">
              <div
                className="h-full rounded-full bg-[#436850]"
                style={{ width: `${Math.round(branch.pct * 100)}%` }}
              />
            </div>
            <span className={`text-[11px] font-medium shrink-0 ${t.textTertiary}`}>
              {Math.round(branch.pct * 100)}%
            </span>
            <span className={`text-[10px] shrink-0 ${t.textTertiary}`}>
              ({branch.count})
            </span>
            {branch.label && (
              <span className={`text-[10px] truncate max-w-[100px] ${t.textTertiary}`}>
                {branch.label}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function V3ScoutReportTab({ report, isDark, t }: Props) {
  const s = report.sections;
  const [insightFilter, setInsightFilter] = useState<"all" | "weakness" | "strength" | "deviation_point" | "behavior">("all");

  const filteredInsights = report.insights.filter(ins =>
    insightFilter === "all" || ins.kind === insightFilter
  );

  const filterOptions: { id: typeof insightFilter; label: string; icon: React.ReactNode }[] = [
    { id: "all",            label: "All",        icon: <Zap className="w-3 h-3" /> },
    { id: "weakness",       label: "Weaknesses", icon: <TrendingDown className="w-3 h-3" /> },
    { id: "strength",       label: "Strengths",  icon: <TrendingUp className="w-3 h-3" /> },
    { id: "deviation_point",label: "Deviations", icon: <GitBranch className="w-3 h-3" /> },
    { id: "behavior",       label: "Behavior",   icon: <AlertCircle className="w-3 h-3" /> },
  ];

  return (
    <div className="space-y-4">

      {/* Data Quality Banner */}
      <DataQualityBanner dataQuality={report.dataQuality} isDark={isDark} />

      {/* Matchup Summary */}
      <SectionList
        title="Matchup Summary"
        icon={<Target className="w-4 h-4" />}
        items={s.matchupSummary}
        isDark={isDark}
        t={t}
      />

      {/* Opening Forecast */}
      <OpeningForecastSection openingForecast={report.openingForecast} isDark={isDark} t={t} />

      {/* If You Have White / Black */}
      <div className="grid grid-cols-2 gap-3">
        <SectionList
          title="♔ As White"
          icon={<BookOpen className="w-4 h-4" />}
          items={s.ifYouHaveWhite}
          isDark={isDark}
          t={t}
        />
        <SectionList
          title="♚ As Black"
          icon={<BookOpen className="w-4 h-4" />}
          items={s.ifYouHaveBlack}
          isDark={isDark}
          t={t}
        />
      </div>

      {/* Insights — filterable */}
      {report.insights.length > 0 && (
        <div className="space-y-3">
          {/* Filter bar */}
          <div className="flex items-center gap-1 flex-wrap">
            {filterOptions.map(opt => {
              const count = opt.id === "all"
                ? report.insights.length
                : report.insights.filter(i => i.kind === opt.id).length;
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
            {filteredInsights.map((insight, i) => (
              <InsightCard key={insight.id} insight={insight} index={i} isDark={isDark} />
            ))}
          </div>
        </div>
      )}

      {/* Deviation Points */}
      <SectionList
        title="Deviation Points"
        icon={<GitBranch className="w-4 h-4" />}
        items={s.deviationPoints}
        isDark={isDark}
        t={t}
        accentClass={isDark ? "text-purple-400" : "text-purple-700"}
      />

      {/* Weak Signals */}
      {s.weakSignals.length > 0 && (
        <SectionList
          title="Weak Signals"
          icon={<AlertCircle className="w-4 h-4" />}
          items={s.weakSignals}
          isDark={isDark}
          t={t}
          accentClass={isDark ? "text-white/30" : "text-gray-500"}
        />
      )}

      {/* Prep Checklist */}
      <PrepChecklist items={s.prepChecklist} isDark={isDark} t={t} />

    </div>
  );
}
