/**
 * OpeningDetailDemo.tsx — Demo-mode opening detail page.
 *
 * Shows the London System (the featured demo opening) with:
 *   - Full hero section (board, stats, description, tags)
 *   - First 2 lines fully visible and interactive-looking
 *   - Remaining lines blurred with a "Pro only" lock overlay
 *   - DemoModeBanner at the top
 *   - Upgrade CTA at the bottom of the locked section
 */
import { useState } from "react";
import { useLocation } from "wouter";
import { Chessboard } from "react-chessboard";
import { useTheme } from "@/contexts/ThemeContext";
import { DemoModeBanner } from "@/components/DemoModeBanner";
import { ProUpgradeModal } from "@/components/ProUpgradeModal";
import { useAuth } from "@/hooks/useAuth";
import {
  ArrowLeft, BookOpen, ChevronRight, Lock,
  Star, AlertTriangle, Circle, Play,
  Sparkles, Crown, Shield, Target, Swords,
} from "lucide-react";
import { DEMO_OPENING_DETAIL, type DemoLineCard } from "@/data/openingsDemo";

// ── Constants ─────────────────────────────────────────────────────────────────
const DIFFICULTY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  beginner: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" },
  intermediate: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20" },
  advanced: { bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/20" },
  expert: { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/20" },
};

// ── Stat Bar ──────────────────────────────────────────────────────────────────
function StatBar({ label, value, max = 100, isDark }: { label: string; value: number; max?: number; isDark: boolean }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px]">
        <span className={isDark ? "text-white/40" : "text-[#436850]/70"}>{label}</span>
        <span className={`font-mono ${isDark ? "text-white/60" : "text-[#12372A]"}`}>{value}/{max}</span>
      </div>
      <div className={`h-1 rounded-full overflow-hidden ${isDark ? "bg-white/[0.06]" : "bg-[#ADBC9F]/30"}`}>
        <div className="h-full rounded-full bg-emerald-500/60 transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ── Difficulty Badge ──────────────────────────────────────────────────────────
function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const colors = DIFFICULTY_COLORS[difficulty] ?? DIFFICULTY_COLORS.intermediate;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${colors.bg} ${colors.text} ${colors.border}`}>
      {difficulty === "beginner" && <Shield className="w-3 h-3" />}
      {difficulty === "intermediate" && <Target className="w-3 h-3" />}
      {difficulty === "advanced" && <Swords className="w-3 h-3" />}
      {difficulty === "expert" && <Crown className="w-3 h-3" />}
      {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
    </span>
  );
}

// ── Line Row ──────────────────────────────────────────────────────────────────
function LineRow({ line, locked, isDark }: { line: DemoLineCard; locked: boolean; isDark: boolean }) {
  const colors = DIFFICULTY_COLORS[line.difficulty] ?? DIFFICULTY_COLORS.intermediate;

  const rowBase = isDark
    ? "bg-white/[0.02] border-white/[0.04]"
    : "bg-[#F0F5E8]/60 border-[#ADBC9F]/30";

  const titleText = isDark ? "text-white/80" : "text-[#12372A]";
  const descText = isDark ? "text-white/35" : "text-[#436850]/70";
  const moveText = isDark ? "text-white/25" : "text-[#436850]/50";
  const circleText = isDark ? "text-white/20" : "text-[#436850]/30";
  const chevronText = isDark ? "text-white/15" : "text-[#436850]/25";

  if (locked) {
    const lockBg = isDark ? "bg-[#0a1a0e]/40" : "bg-[#12372A]/20";
    const lockPillBg = isDark ? "bg-[#0a1a0e]/80" : "bg-[#12372A]/80";
    const lockPillBorder = isDark ? "border-white/10" : "border-white/20";
    const lockText = isDark ? "text-white/50" : "text-white/90";
    return (
      <div className={`relative group w-full flex items-center gap-3 px-4 py-3 rounded-lg ${rowBase} border text-left select-none overflow-hidden`}>
        {/* Blurred content */}
        <div className="flex-1 flex items-center gap-3 blur-[3px] pointer-events-none">
          <div className={`shrink-0 ${circleText}`}>
            <Circle className="w-3.5 h-3.5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className={`text-sm font-medium ${titleText} truncate`}>{line.title}</h4>
              {line.mustKnow && (
                <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/20">
                  Must Know
                </span>
              )}
              {line.trapLine && (
                <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-red-500/15 text-red-400 border border-red-500/20">
                  <AlertTriangle className="w-2.5 h-2.5 inline mr-0.5" />
                  Trap
                </span>
              )}
            </div>
            {line.description && (
              <p className={`text-[11px] ${descText} mt-0.5 truncate`}>{line.description}</p>
            )}
          </div>
          <div className="shrink-0 flex items-center gap-3">
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${colors.bg} ${colors.text} ${colors.border}`}>
              {line.difficulty}
            </span>
            <span className={`text-[10px] ${moveText} font-mono w-8 text-right`}>
              {Math.ceil(line.moveCount / 2)}m
            </span>
          </div>
        </div>

        {/* Lock overlay */}
        <div className={`absolute inset-0 flex items-center justify-center ${lockBg} backdrop-blur-[1px]`}>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${lockPillBg} border ${lockPillBorder}`}>
            <Lock className="w-3 h-3 text-emerald-400" />
            <span className={`text-[11px] ${lockText} font-medium`}>Pro only</span>
          </div>
        </div>
      </div>
    );
  }

  const freeRowBorder = isDark ? "border-emerald-500/15" : "border-emerald-600/20";
  return (
    <div className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg ${isDark ? "bg-white/[0.02]" : "bg-[#F0F5E8]/60"} border ${freeRowBorder} text-left`}>
      <div className={`shrink-0 ${circleText}`}>
        <Circle className="w-3.5 h-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className={`text-sm font-medium ${titleText} truncate`}>{line.title}</h4>
          {line.mustKnow && (
            <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/20">
              Must Know
            </span>
          )}
          {line.trapLine && (
            <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-red-500/15 text-red-400 border border-red-500/20">
              <AlertTriangle className="w-2.5 h-2.5 inline mr-0.5" />
              Trap
            </span>
          )}
        </div>
        {line.description && (
          <p className={`text-[11px] ${descText} mt-0.5 truncate`}>{line.description}</p>
        )}
      </div>
      <div className="shrink-0 flex items-center gap-3">
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${colors.bg} ${colors.text} ${colors.border}`}>
          {line.difficulty}
        </span>
        <span className={`text-[10px] ${moveText} font-mono w-8 text-right`}>
          {Math.ceil(line.moveCount / 2)}m
        </span>
        <ChevronRight className={`w-4 h-4 ${chevronText}`} />
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function OpeningDetailDemo() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const onExitDemo = () => navigate("/openings");
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const opening = DEMO_OPENING_DETAIL;
  const allLines = opening.chapters.flatMap((c) => c.lines);

  // First 2 lines are visible in demo; the rest are locked
  const FREE_LINES = 2;

  // Theme-aware class helpers
  const navBg = isDark
    ? "border-white/[0.06] bg-[#0a1a0e]/80"
    : "border-[#ADBC9F]/40 bg-[#FBFADA]/95";
  const navBackText = isDark
    ? "text-white/40 hover:text-emerald-400"
    : "text-[#436850]/60 hover:text-[#12372A]";
  const navSepText = isDark ? "text-white/15" : "text-[#ADBC9F]";
  const navBreadText = isDark ? "text-white/60" : "text-[#12372A]";

  const ecoText = isDark ? "text-white/40" : "text-[#436850]/70";
  const titleText = isDark ? "text-white/95" : "text-[#12372A]";
  const subtitleText = isDark ? "text-white/50" : "text-[#436850]";
  const charLabelText = isDark ? "text-white/40" : "text-[#436850]/70";
  const charValueText = isDark ? "text-white/60" : "text-[#12372A]";
  const charBarBg = isDark ? "bg-white/[0.06]" : "bg-[#ADBC9F]/30";
  const tagText = isDark ? "text-white/40" : "text-[#436850]/70";
  const tagBg = isDark ? "bg-white/[0.03] border-white/[0.05]" : "bg-[#F0F5E8] border-[#ADBC9F]/40";
  const ctaDisabledBg = isDark
    ? "bg-emerald-600/40 border-emerald-500/30 text-white/50 hover:bg-emerald-600/60 hover:text-white"
    : "bg-emerald-700/20 border-emerald-600/30 text-[#12372A]/60 hover:bg-emerald-700/30 hover:text-[#12372A]";
  const descBg = isDark
    ? "bg-white/[0.02] border-white/[0.04]"
    : "bg-[#F0F5E8]/60 border-[#ADBC9F]/30";
  const descText = isDark ? "text-white/60" : "text-[#436850]";
  const sectionHeadText = isDark ? "text-white/70" : "text-[#12372A]";
  const sectionCountText = isDark ? "text-white/30" : "text-[#436850]/60";
  const chapterHeadText = isDark ? "text-white/50" : "text-[#436850]/80";
  const upgradeBg = isDark
    ? "border-emerald-500/20 bg-gradient-to-b from-emerald-500/[0.04] to-transparent"
    : "border-emerald-600/20 bg-gradient-to-b from-emerald-600/[0.04] to-transparent";
  const upgradeIconBg = isDark
    ? "bg-emerald-500/10 border-emerald-500/20"
    : "bg-emerald-600/10 border-emerald-600/20";
  const upgradeHeadText = isDark ? "text-white/85" : "text-[#12372A]";
  const upgradeBodyText = isDark ? "text-white/40" : "text-[#436850]";
  const pricingLinkText = isDark
    ? "border-white/10 hover:border-white/20 text-white/50 hover:text-white/80"
    : "border-[#ADBC9F]/50 hover:border-[#436850]/50 text-[#436850]/60 hover:text-[#12372A]";
  const finePrintText = isDark ? "text-white/20" : "text-[#436850]/40";
  const boardBorder = isDark ? "border-white/[0.06]" : "border-[#ADBC9F]/40";

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a1a0e]" : "bg-[#FBFADA]/70"}`}>
      {/* Demo banner */}
      <DemoModeBanner onExitDemo={onExitDemo} />

      {/* Back nav */}
      <div className={`border-b ${navBg} backdrop-blur-xl sticky top-[42px] z-30`}>
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate("/openings/demo")}
            className={`flex items-center gap-1.5 text-xs ${navBackText} transition-colors`}
          >
            <ArrowLeft className="w-4 h-4" />
            Demo Library
          </button>
          <span className={navSepText}>/</span>
          <span className={`text-xs ${navBreadText} font-medium truncate`}>{opening.name}</span>
          <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/25 text-amber-400 text-[10px] font-bold uppercase tracking-wider ml-1">
            Demo
          </span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-8">
        {/* Hero section */}
        <div className="flex flex-col md:flex-row gap-6">
          {/* Board */}
          <div className="w-full md:w-64 shrink-0">
            <div className={`rounded-xl overflow-hidden border ${boardBorder} pointer-events-none`}>
              <Chessboard
                options={{
                  position: opening.thumbnailFen,
                  boardOrientation: "white",
                  allowDragging: false,
                  boardStyle: { borderRadius: "0" },
                  darkSquareStyle: { backgroundColor: "#2d5a3a" },
                  lightSquareStyle: { backgroundColor: "#8fbc8f" },
                }}
              />
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-3 h-3 rounded-full bg-white border border-white/30" />
                <span className={`text-[11px] ${ecoText} font-mono uppercase tracking-wider`}>{opening.eco}</span>
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 text-[10px] font-semibold border border-amber-500/20">
                  <Star className="w-3 h-3 fill-current" /> Featured
                </span>
              </div>
              <h1 className={`text-2xl font-bold ${titleText}`}>{opening.name}</h1>
              <p className={`text-sm ${subtitleText} mt-1 leading-relaxed`}>{opening.shortDescription}</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              <StatBar label="Trap Potential" value={opening.trapPotential} isDark={isDark} />
              <StatBar label="Strategic Complexity" value={opening.strategicComplexity} isDark={isDark} />
              <div className="space-y-1">
                <div className="flex justify-between text-[10px]">
                  <span className={charLabelText}>Character</span>
                  <span className={`${charValueText} capitalize`}>{opening.playCharacter}</span>
                </div>
                <div className={`h-1 rounded-full ${charBarBg}`} />
              </div>
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-1.5">
              {opening.tags.map((tag) => (
                <span
                  key={tag.slug}
                  className={`px-2 py-0.5 rounded-full text-[10px] ${tagText} ${tagBg}`}
                >
                  {tag.name}
                </span>
              ))}
            </div>

            {/* CTA — disabled in demo */}
            <button
              onClick={() => setUpgradeOpen(true)}
              className={`w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl border ${ctaDisabledBg} font-semibold text-sm cursor-pointer transition-all`}
            >
              <Lock className="w-4 h-4" />
              Upgrade to Start Studying
            </button>
          </div>
        </div>

        {/* Long description */}
        <div className={`prose ${isDark ? "prose-invert" : ""} prose-sm max-w-none p-4 rounded-xl ${descBg} border`}>
          <p className={`text-sm ${descText} leading-relaxed whitespace-pre-line`}>{opening.longDescription}</p>
        </div>

        {/* Chapters / Lines */}
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-emerald-400" />
            <h2 className={`text-sm font-semibold ${sectionHeadText} uppercase tracking-wider`}>
              Study Lines ({opening.lineCount})
            </h2>
            <span className={`text-[10px] ${sectionCountText} ml-1`}>
              — {FREE_LINES} visible in demo, {opening.lineCount - FREE_LINES} locked
            </span>
          </div>

          {opening.chapters.map((chapter) => {
            let freeRemaining = FREE_LINES;
            return (
              <div key={chapter.name} className="space-y-2">
                <h3 className={`text-xs font-semibold ${chapterHeadText} uppercase tracking-wider px-1`}>
                  {chapter.name}
                </h3>
                <div className="space-y-1">
                  {chapter.lines.map((line) => {
                    const isLocked = line.locked || freeRemaining <= 0;
                    if (!isLocked) freeRemaining--;
                    return (
                      <LineRow key={line.id} line={line} locked={isLocked} isDark={isDark} />
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Upgrade CTA at bottom */}
          <div className={`rounded-2xl border ${upgradeBg} p-8 text-center space-y-4`}>
            <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl ${upgradeIconBg} border mx-auto`}>
              <Sparkles className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h3 className={`text-lg font-bold ${upgradeHeadText}`}>
                Unlock all {opening.lineCount} lines
              </h3>
              <p className={`text-sm ${upgradeBodyText} mt-1 max-w-sm mx-auto`}>
                Upgrade to Pro to access every line, trap, and endgame plan — plus study mode with spaced repetition and coach insights.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setUpgradeOpen(true)}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-all shadow-lg shadow-emerald-900/30"
              >
                <Sparkles className="w-4 h-4" />
                Upgrade to Pro
              </button>
              <a
                href="/pricing"
                className={`inline-flex items-center gap-2 px-5 py-3 rounded-xl border ${pricingLinkText} text-sm font-medium transition-all`}
              >
                See pricing
              </a>
            </div>
            <p className={`text-[11px] ${finePrintText}`}>Starting at $6.67 / month · Cancel anytime</p>
          </div>
        </div>
      </div>

      <ProUpgradeModal
        isOpen={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        highlightFeature="Openings Library"
        onNeedsAuth={() => {}}
      />
    </div>
  );
}
