/**
 * CoachInsightCard.tsx
 *
 * Premium coach-like insight card for Matchup Prep (Phase 7).
 *
 * States:
 * 1. idle        — "Get Coach Insight" button + quota indicator
 * 2. loading     — pulsing dots animation while LLM generates
 * 3. insight     — formatted coaching text with save/bookmark button
 * 4. saved       — bookmarked state with "Saved" indicator
 * 5. quota_exhausted — soft paywall with upgrade prompt
 * 6. error       — retry option
 *
 * Design: Apple-inspired minimalism. Distinct from the rest of the UI
 * through a subtle green-tinted card with a thin top accent line.
 */
import { useState, useCallback } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import {
  Sparkles, Bookmark, BookmarkCheck, RefreshCw,
  AlertCircle, ChevronDown, ChevronUp, Lock,
} from "lucide-react";
import {
  type InsightContext,
  type CoachInsight,
  type QuotaState,
  type InsightType,
  buildCoachPrompt,
  generateInsightId,
  incrementUsage,
  saveInsight,
  unsaveInsight,
  INSIGHT_TYPE_LABELS,
  INSIGHT_TYPE_DESCRIPTIONS,
} from "../lib/coachInsight";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CoachInsightCardProps {
  /** Full context for generating the insight */
  context: InsightContext;
  /** Current quota state for the user's plan */
  quota: QuotaState;
  /** Called when quota is consumed (parent should refresh quota state) */
  onQuotaConsumed?: () => void;
  /** Optional: pre-existing saved insight for this opponent+type */
  existingInsight?: CoachInsight | null;
  /** Optional: compact mode for embedding in Key Lines tab */
  compact?: boolean;
  /** Optional: custom label override */
  label?: string;
}

type CardState = "idle" | "loading" | "insight" | "error" | "quota_exhausted";

// ─── Loading Animation ────────────────────────────────────────────────────────

function ThinkingDots({ isDark }: { isDark: boolean }) {
  return (
    <div className="flex items-center gap-1.5 py-1">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className={`w-1.5 h-1.5 rounded-full ${isDark ? "bg-[#5B9A6A]/60" : "bg-[#3D6B47]/50"}`}
          style={{
            animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
      <span className={`text-xs ml-1 ${isDark ? "text-white/35" : "text-gray-400"}`}>
        Thinking…
      </span>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.1); }
        }
      `}</style>
    </div>
  );
}

// ─── Insight Text Renderer ────────────────────────────────────────────────────

function InsightText({ text, isDark }: { text: string; isDark: boolean }) {
  const [expanded, setExpanded] = useState(true);
  const lines = text.split("\n").filter(l => l.trim());

  // Detect "Key takeaway:" line for special treatment
  const keyTakeawayIdx = lines.findIndex(l =>
    l.toLowerCase().startsWith("key takeaway")
  );

  const mainLines = keyTakeawayIdx >= 0 ? lines.slice(0, keyTakeawayIdx) : lines;
  const takeaway = keyTakeawayIdx >= 0 ? lines[keyTakeawayIdx] : null;

  const textColor = isDark ? "text-white/80" : "text-gray-700";
  const takeawayBg = isDark
    ? "bg-[#5B9A6A]/08 border border-[#5B9A6A]/20 text-[#5B9A6A]"
    : "bg-[#3D6B47]/06 border border-[#3D6B47]/15 text-[#3D6B47]";

  return (
    <div className="space-y-2">
      {/* Main insight text */}
      <div className={`text-sm leading-relaxed space-y-2 ${textColor}`}>
        {mainLines.map((line, i) => {
          // Bullet point
          if (line.startsWith("- ") || line.startsWith("• ")) {
            return (
              <div key={i} className="flex gap-2">
                <span className={`mt-1.5 w-1 h-1 rounded-full flex-shrink-0 ${isDark ? "bg-[#5B9A6A]/50" : "bg-[#3D6B47]/40"}`} />
                <span>{line.replace(/^[-•]\s*/, "")}</span>
              </div>
            );
          }
          // Numbered list
          if (/^\d+\.\s/.test(line)) {
            const [num, ...rest] = line.split(/\.\s(.+)/);
            return (
              <div key={i} className="flex gap-2">
                <span className={`text-xs font-mono mt-0.5 flex-shrink-0 ${isDark ? "text-[#5B9A6A]/60" : "text-[#3D6B47]/50"}`}>{num}.</span>
                <span>{rest.join("")}</span>
              </div>
            );
          }
          // Bold headers (e.g., **Opening:**)
          if (line.startsWith("**") && line.includes("**")) {
            return (
              <p key={i} className={`font-medium ${isDark ? "text-white/90" : "text-gray-800"}`}>
                {line.replace(/\*\*/g, "")}
              </p>
            );
          }
          return <p key={i}>{line}</p>;
        })}
      </div>

      {/* Key takeaway highlight */}
      {takeaway && (
        <div className={`rounded-xl px-3.5 py-2.5 text-sm font-medium mt-3 ${takeawayBg}`}>
          {takeaway.replace(/^key takeaway:?\s*/i, "⚑ ")}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function CoachInsightCard({
  context,
  quota,
  onQuotaConsumed,
  existingInsight,
  compact = false,
  label,
}: CoachInsightCardProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [cardState, setCardState] = useState<CardState>(
    existingInsight ? "insight" : quota.exhausted ? "quota_exhausted" : "idle"
  );
  const [insight, setInsight] = useState<CoachInsight | null>(existingInsight ?? null);
  const [isSaved, setIsSaved] = useState(existingInsight?.saved ?? false);
  const [error, setError] = useState<string | null>(null);
  const [showQuotaDetails, setShowQuotaDetails] = useState(false);

  // ── Generate insight ──────────────────────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    if (quota.exhausted) {
      setCardState("quota_exhausted");
      return;
    }

    setCardState("loading");
    setError(null);

    try {
      const promptJson = buildCoachPrompt(context);

      const res = await fetch("/api/prep/coach-insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promptJson }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to generate insight");
      }

      const data = await res.json() as { insight: string; model: string };

      const newInsight: CoachInsight = {
        id: generateInsightId(),
        opponentUsername: context.opponentUsername,
        insightType: context.insightType,
        content: data.insight,
        generatedAt: new Date().toISOString(),
        saved: false,
      };

      setInsight(newInsight);
      setCardState("insight");

      // Consume quota
      incrementUsage();
      onQuotaConsumed?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setError(msg);
      setCardState("error");
    }
  }, [context, quota.exhausted, onQuotaConsumed]);

  // ── Save / unsave ─────────────────────────────────────────────────────────
  const handleToggleSave = useCallback(() => {
    if (!insight) return;
    if (isSaved) {
      unsaveInsight(insight.id);
      setIsSaved(false);
      setInsight(prev => prev ? { ...prev, saved: false } : prev);
    } else {
      saveInsight({ ...insight, saved: true });
      setIsSaved(true);
      setInsight(prev => prev ? { ...prev, saved: true } : prev);
    }
  }, [insight, isSaved]);

  // ── Design tokens ─────────────────────────────────────────────────────────
  const cardBg = isDark
    ? "bg-[#0c1a0e] border border-[#1e3022]/80"
    : "bg-white border border-[#3D6B47]/12";
  const accentLine = "bg-gradient-to-r from-[#5B9A6A] to-[#3D6B47]";
  const labelColor = isDark ? "text-[#5B9A6A]" : "text-[#3D6B47]";
  const textSecondary = isDark ? "text-white/45" : "text-gray-400";
  const textPrimary = isDark ? "text-white" : "text-gray-900";

  const insightTypeLabel = label ?? INSIGHT_TYPE_LABELS[context.insightType];
  const insightTypeDesc = INSIGHT_TYPE_DESCRIPTIONS[context.insightType];

  // ── Quota indicator ───────────────────────────────────────────────────────
  const QuotaIndicator = () => (
    <button
      onClick={() => setShowQuotaDetails(v => !v)}
      className={`flex items-center gap-1 text-xs ${textSecondary} hover:opacity-80 transition-opacity`}
    >
      <span>
        {quota.remaining}/{quota.limit} this month
      </span>
      {showQuotaDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
    </button>
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={`rounded-2xl overflow-hidden ${cardBg} ${compact ? "" : "shadow-sm"}`}>
      {/* Top accent line */}
      <div className={`h-px ${accentLine}`} />

      <div className={`${compact ? "p-4" : "p-5"}`}>
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className={`w-4 h-4 flex-shrink-0 ${labelColor}`} />
            <div>
              <span className={`text-xs font-semibold tracking-wide uppercase ${labelColor}`}>
                {insightTypeLabel}
              </span>
              {!compact && (
                <p className={`text-xs mt-0.5 ${textSecondary}`}>{insightTypeDesc}</p>
              )}
            </div>
          </div>

          {/* Quota indicator (idle state only) */}
          {cardState === "idle" && <QuotaIndicator />}

          {/* Save button (insight state) */}
          {cardState === "insight" && insight && (
            <button
              onClick={handleToggleSave}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg transition-all ${
                isSaved
                  ? isDark
                    ? "bg-[#5B9A6A]/15 text-[#5B9A6A]"
                    : "bg-[#3D6B47]/10 text-[#3D6B47]"
                  : isDark
                    ? "text-white/35 hover:text-white/60 hover:bg-white/05"
                    : "text-gray-400 hover:text-gray-600 hover:bg-gray-100/60"
              }`}
              title={isSaved ? "Remove from saved" : "Save for later"}
            >
              {isSaved
                ? <><BookmarkCheck className="w-3.5 h-3.5" /><span>Saved</span></>
                : <><Bookmark className="w-3.5 h-3.5" /><span>Save</span></>
              }
            </button>
          )}
        </div>

        {/* Quota details dropdown */}
        {showQuotaDetails && cardState === "idle" && (
          <div className={`mb-3 p-3 rounded-xl text-xs ${isDark ? "bg-white/03 border border-white/06" : "bg-gray-50 border border-gray-200/60"}`}>
            <div className={`space-y-1 ${textSecondary}`}>
              <div className="flex justify-between">
                <span>Plan</span>
                <span className={`font-medium capitalize ${textPrimary}`}>{quota.plan}</span>
              </div>
              <div className="flex justify-between">
                <span>Used this month</span>
                <span className={`font-medium ${textPrimary}`}>{quota.used} / {quota.limit}</span>
              </div>
              <div className="flex justify-between">
                <span>Resets</span>
                <span className={`font-medium ${textPrimary}`}>
                  {new Date(quota.resetDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ── State: idle ─────────────────────────────────────────────────── */}
        {cardState === "idle" && (
          <button
            onClick={handleGenerate}
            className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium transition-all active:scale-[0.98] ${
              isDark
                ? "bg-[#5B9A6A]/12 text-[#5B9A6A] hover:bg-[#5B9A6A]/20 border border-[#5B9A6A]/20"
                : "bg-[#3D6B47]/08 text-[#3D6B47] hover:bg-[#3D6B47]/14 border border-[#3D6B47]/15"
            }`}
          >
            <Sparkles className="w-4 h-4" />
            Get Coach Insight
          </button>
        )}

        {/* ── State: loading ───────────────────────────────────────────────── */}
        {cardState === "loading" && (
          <div className="py-1">
            <ThinkingDots isDark={isDark} />
            <p className={`text-xs mt-2 ${textSecondary}`}>
              Analyzing {context.opponentUsername}'s tendencies…
            </p>
          </div>
        )}

        {/* ── State: insight ───────────────────────────────────────────────── */}
        {cardState === "insight" && insight && (
          <div className="space-y-3">
            <InsightText text={insight.content} isDark={isDark} />

            {/* Regenerate option */}
            {!quota.exhausted && (
              <button
                onClick={handleGenerate}
                className={`flex items-center gap-1.5 text-xs ${textSecondary} hover:opacity-80 transition-opacity mt-1`}
              >
                <RefreshCw className="w-3 h-3" />
                Regenerate ({quota.remaining} left)
              </button>
            )}
          </div>
        )}

        {/* ── State: error ─────────────────────────────────────────────────── */}
        {cardState === "error" && (
          <div className="space-y-2">
            <div className={`flex items-start gap-2 text-sm ${isDark ? "text-red-400/80" : "text-red-500"}`}>
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error ?? "Something went wrong. Please try again."}</span>
            </div>
            <button
              onClick={handleGenerate}
              className={`flex items-center gap-1.5 text-xs ${textSecondary} hover:opacity-80 transition-opacity`}
            >
              <RefreshCw className="w-3 h-3" />
              Try again
            </button>
          </div>
        )}

        {/* ── State: quota_exhausted ───────────────────────────────────────── */}
        {cardState === "quota_exhausted" && (
          <div className={`space-y-3 py-1`}>
            <div className="flex items-start gap-2.5">
              <Lock className={`w-4 h-4 flex-shrink-0 mt-0.5 ${isDark ? "text-white/30" : "text-gray-400"}`} />
              <div>
                <p className={`text-sm font-medium ${textPrimary}`}>
                  Monthly limit reached
                </p>
                <p className={`text-xs mt-0.5 ${textSecondary}`}>
                  You've used all {quota.limit} coach insight{quota.limit !== 1 ? "s" : ""} for this month.
                  Resets on {new Date(quota.resetDate).toLocaleDateString("en-US", { month: "long", day: "numeric" })}.
                </p>
              </div>
            </div>
            <div className={`text-xs px-3 py-2 rounded-xl ${isDark ? "bg-[#5B9A6A]/08 border border-[#5B9A6A]/15 text-[#5B9A6A]" : "bg-[#3D6B47]/06 border border-[#3D6B47]/12 text-[#3D6B47]"}`}>
              Upgrade to Pro for 10 insights/month
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
