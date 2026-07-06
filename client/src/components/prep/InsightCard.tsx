/**
 * InsightCard — renders one V3 Insight with all six fields:
 * claim, evidence, interpretation, recommendation, confidence, sampleSize
 */
import { useState } from "react";
import { ChevronDown, ChevronRight, GitBranch, TrendingDown, TrendingUp, Zap, AlertTriangle, Target } from "lucide-react";
import type { Insight } from "../../../../shared/prepTypes";

interface Props {
  insight: Insight;
  index: number;
  isDark: boolean;
}

const KIND_CONFIG: Record<string, { icon: React.ReactNode; label: string; accent: string; accentLight: string }> = {
  opening_tendency: { icon: <GitBranch   className="w-3.5 h-3.5" />, label: "Opening Tendency", accent: "text-blue-400",    accentLight: "text-blue-700" },
  response_pattern: { icon: <Zap         className="w-3.5 h-3.5" />, label: "Response Pattern", accent: "text-amber-400",   accentLight: "text-amber-700" },
  weakness:         { icon: <TrendingDown className="w-3.5 h-3.5" />, label: "Weakness",         accent: "text-red-400",     accentLight: "text-red-700" },
  strength:         { icon: <TrendingUp   className="w-3.5 h-3.5" />, label: "Strength",         accent: "text-emerald-400", accentLight: "text-emerald-700" },
  deviation_point:  { icon: <GitBranch   className="w-3.5 h-3.5" />, label: "Deviation Point",  accent: "text-purple-400",  accentLight: "text-purple-700" },
  behavior:         { icon: <AlertTriangle className="w-3.5 h-3.5" />, label: "Behavior",        accent: "text-orange-400",  accentLight: "text-orange-700" },
  game_plan:        { icon: <Target      className="w-3.5 h-3.5" />, label: "Game Plan",         accent: "text-purple-400",  accentLight: "text-purple-700" },
  weak_signal:      { icon: <AlertTriangle className="w-3.5 h-3.5" />, label: "Weak Signal",     accent: "text-white/40",    accentLight: "text-gray-500" },
};

const CONFIDENCE_BAR: Record<string, number> = {
  high: 3, medium: 2, low: 1,
};

function ConfidenceIndicator({ level, isDark }: { level: string; isDark: boolean }) {
  const filled = CONFIDENCE_BAR[level] ?? 1;
  return (
    <div className="flex items-center gap-0.5" title={`Confidence: ${level}`}>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className={`w-1.5 h-3 rounded-sm transition-colors ${
            i <= filled
              ? isDark ? "bg-[#5B9A6A]" : "bg-[#436850]"
              : isDark ? "bg-white/10" : "bg-[#ADBC9F]/50"
          }`}
        />
      ))}
    </div>
  );
}

export function InsightCard({ insight, index, isDark }: Props) {
  const [expanded, setExpanded] = useState(index < 3); // first 3 open by default
  const cfg = KIND_CONFIG[insight.kind] ?? KIND_CONFIG.pattern;

  const cardBase = isDark
    ? "bg-[#0f1c11] border border-[#243028]/70 rounded-2xl"
    : "bg-white border border-[#ADBC9F]/80 rounded-2xl shadow-sm";

  const monoBlock = isDark
    ? "bg-[#060e07] text-[#5B9A6A] border border-[#1e2e22]/60 font-mono text-[11px] rounded-lg px-2.5 py-1.5"
    : "bg-[#436850]/04 text-[#436850] border border-[#436850]/10 font-mono text-[11px] rounded-lg px-2.5 py-1.5";

  const textPrimary = isDark ? "text-white" : "text-[#12372A]";
  const textSecondary = isDark ? "text-white/55" : "text-[#436850]";
  const textTertiary = isDark ? "text-white/30" : "text-[#436850]/60";
  const divider = isDark ? "border-[#1e2e22]/70" : "border-[#ADBC9F]/70";

  return (
    <div className={cardBase}>
      {/* Header row — always visible */}
      <button
        onClick={() => setExpanded(e => !e)}
        className={`w-full flex items-start gap-3 p-4 sm:p-5 text-left transition-colors rounded-2xl ${
          isDark ? "hover:bg-white/[0.02]" : "hover:bg-[#FBFADA]/50"
        }`}
        aria-expanded={expanded}
      >
        {/* Kind icon */}
        <span className={`mt-0.5 shrink-0 ${isDark ? cfg.accent : cfg.accentLight}`}>{cfg.icon}</span>

        <div className="flex-1 min-w-0 space-y-1">
          {/* Kind label + color badge */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? cfg.accent : cfg.accentLight}`}>
              {cfg.label}
            </span>
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${
              insight.color === "white"
                ? isDark ? "bg-white/10 text-white/70" : "bg-[#12372A]/08 text-[#12372A]"
                : isDark ? "bg-[#1e2e22]/80 text-white/50" : "bg-[#436850]/08 text-[#436850]"
            }`}>
              {insight.color === "white" ? "♔ White" : "♚ Black"}
            </span>

          </div>

          {/* Claim */}
          <p className={`text-sm font-semibold leading-snug ${textPrimary}`}>{insight.claim}</p>

          {/* Stat pill */}
          <p className={`text-xs ${textSecondary}`}>{insight.evidence.stat}</p>
        </div>

        {/* Right: confidence + expand chevron */}
        <div className="flex items-center gap-2 shrink-0">
          <ConfidenceIndicator level={insight.confidence} isDark={isDark} />
          <span className={`text-[10px] font-medium ${textTertiary}`}>
            n={insight.sampleSize}
          </span>
          {expanded
            ? <ChevronDown className={`w-3.5 h-3.5 ${textTertiary}`} />
            : <ChevronRight className={`w-3.5 h-3.5 ${textTertiary}`} />
          }
        </div>
      </button>

      {/* Expanded body */}
      {expanded && (
        <div className={`px-4 sm:px-5 pb-4 sm:pb-5 space-y-3 border-t ${divider}`}>
          {/* Interpretation */}
          <div className="pt-3">
            <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${textTertiary}`}>Interpretation</p>
            <p className={`text-xs leading-relaxed ${textSecondary}`}>{insight.interpretation}</p>
          </div>

          {/* Baseline if present */}
          {insight.baseline !== undefined && (
            <div className={`flex items-center gap-2 text-xs ${textTertiary}`}>
              <span>Baseline: {insight.baseline.metric}</span>
              <span className="font-semibold">{Math.round(insight.baseline.value * 100)}%</span>
              {insight.baseline.delta !== 0 && (
                <span className={insight.baseline.delta < 0 ? "text-red-400" : "text-emerald-400"}>
                  ({insight.baseline.delta > 0 ? "+" : ""}{Math.round(insight.baseline.delta * 100)}pp)
                </span>
              )}
            </div>
          )}

          {/* Recommendation */}
          <div className={`rounded-xl border p-3 space-y-2 ${isDark ? "bg-[#162018]/60 border-[#2e4a34]/40" : "bg-[#f0fdf4] border-[#436850]/15"}`}>
            <p className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-[#5B9A6A]" : "text-[#436850]"}`}>
              Recommendation
            </p>
            <p className={`text-xs leading-relaxed font-medium ${textPrimary}`}>
              {insight.recommendation.action}
            </p>
            {insight.recommendation.line && (
              <div className={monoBlock}>
                {insight.recommendation.line.san}
              </div>
            )}
          </div>

          {/* Sample games (up to 3) */}
          {insight.evidence.games && insight.evidence.games.length > 0 && (
            <div>
              <p className={`text-[10px] font-bold uppercase tracking-wider mb-1.5 ${textTertiary}`}>
                Sample games ({insight.evidence.games.length})
              </p>
              <div className="space-y-1">
                {insight.evidence.games.slice(0, 3).map((g, i) => (
                  <a
                    key={i}
                    href={g.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center justify-between text-[11px] px-2.5 py-1.5 rounded-lg transition-opacity hover:opacity-80 ${
                      isDark ? "bg-[#0a1409] border border-[#1e2e22]/40" : "bg-[#FBFADA]/70 border border-[#ADBC9F]/40"
                    }`}
                  >
                    <span className={`font-mono truncate max-w-[180px] ${textSecondary}`}>
                      {new Date(g.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                    <span className={`font-semibold shrink-0 ml-2 ${
                      g.result === "W" ? "text-emerald-400" :
                      g.result === "L" ? "text-red-400" :
                      textTertiary
                    }`}>
                      {g.result === "W" ? "Win" : g.result === "L" ? "Loss" : "Draw"}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
