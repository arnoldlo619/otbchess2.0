/**
 * OpeningDetail.tsx — Opening detail page with overview, chapters, and study CTA.
 *
 * Features:
 *   - Hero section with board, name, ECO, description, tags
 *   - Chapter/line list grouped by type
 *   - Per-line progress badges (if authenticated)
 *   - "Start Studying" CTA
 *   - Navigation back to library
 */
import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { Chessboard } from "react-chessboard";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuthContext } from "@/context/AuthContext";
import { OpeningsProGate } from "@/components/OpeningsProGate";
import {
  ArrowLeft, BookOpen, ChevronRight, Lock,
  Star, AlertTriangle,
  CheckCircle2, Circle, Loader2, Play,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Tag { name: string; category: string; slug: string; }

interface LineCard {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  difficulty: string;
  moveCount: number;
  commonness: number;
  priority: number;
  mustKnow: boolean;
  starterFriendly: boolean;
  trapLine: boolean;
  lineType: string;
  branchLabel: string;
  progress: { status: string; streak: number; accuracy: number } | null;
}

interface Chapter { name: string; lines: LineCard[]; }

interface OpeningData {
  id: string;
  slug: string;
  name: string;
  side: string;
  eco: string;
  shortDescription: string | null;
  longDescription: string | null;
  difficulty: string;
  popularity: number;
  thumbnailFen: string;
  playCharacter: string;
  isFeatured: boolean;
  starterFriendly: boolean;
  trapPotential: number;
  strategicComplexity: number;
  tags: Tag[];
}

// ── Constants ─────────────────────────────────────────────────────────────────
const DIFFICULTY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  beginner: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" },
  intermediate: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20" },
  advanced: { bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/20" },
  expert: { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/20" },
};

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  mastered: { icon: <CheckCircle2 className="w-3.5 h-3.5" />, label: "Mastered", color: "text-emerald-400" },
  reviewing: { icon: <Loader2 className="w-3.5 h-3.5" />, label: "Reviewing", color: "text-amber-400" },
  learning: { icon: <Play className="w-3.5 h-3.5" />, label: "Learning", color: "text-blue-400" },
  new: { icon: <Circle className="w-3.5 h-3.5" />, label: "New", color: "text-white/30" },
};

// ── Stat Bar ──────────────────────────────────────────────────────────────────
function StatBar({ label, value, max = 100 }: { label: string; value: number; max?: number }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px]">
        <span className="text-white/40">{label}</span>
        <span className="text-white/60 font-mono">{value}/{max}</span>
      </div>
      <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
        <div className="h-full rounded-full bg-emerald-500/60 transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ── Line Row ──────────────────────────────────────────────────────────────────
function LineRow({ line, openingSlug: _openingSlug, onClick }: { line: LineCard; openingSlug: string; onClick: () => void }) {
  const colors = DIFFICULTY_COLORS[line.difficulty] ?? DIFFICULTY_COLORS.intermediate;
  const statusCfg = line.progress ? STATUS_CONFIG[line.progress.status] ?? STATUS_CONFIG.new : null;

  return (
    <button
      onClick={onClick}
      className="group w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-white/[0.02] border border-white/[0.04] hover:border-emerald-500/20 hover:bg-white/[0.04] transition-all text-left"
    >
      {/* Progress indicator */}
      <div className={`shrink-0 ${statusCfg?.color ?? "text-white/20"}`}>
        {statusCfg?.icon ?? <Circle className="w-3.5 h-3.5" />}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-medium text-white/80 group-hover:text-emerald-400 transition-colors truncate">
            {line.title}
          </h4>
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
          <p className="text-[11px] text-white/35 mt-0.5 truncate">{line.description}</p>
        )}
      </div>

      {/* Meta */}
      <div className="shrink-0 flex items-center gap-3">
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${colors.bg} ${colors.text} ${colors.border}`}>
          {line.difficulty}
        </span>
        <span className="text-[10px] text-white/25 font-mono w-8 text-right">
          {Math.ceil(line.moveCount / 2)}m
        </span>
        {line.progress && line.progress.accuracy > 0 && (
          <span className="text-[10px] text-white/30 font-mono w-10 text-right">
            {line.progress.accuracy}%
          </span>
        )}
        <ChevronRight className="w-4 h-4 text-white/15 group-hover:text-emerald-400 transition-colors" />
      </div>
    </button>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
function OpeningDetailContent() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [, navigate] = useLocation();
  const [_match, params] = useRoute("/openings/:slug");
  const { user } = useAuthContext();

  const [opening, setOpening] = useState<OpeningData | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [lineCount, setLineCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const slug = params?.slug ?? "";

  useEffect(() => {
    if (!slug) return;
    async function fetchDetail() {
      try {
        setLoading(true);
        const res = await fetch(`/api/openings/${slug}`);
        if (!res.ok) throw new Error("Opening not found");
        const data = await res.json();
        setOpening(data.opening);
        setChapters(data.chapters ?? []);
        setLineCount(data.lineCount ?? 0);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load opening");
      } finally {
        setLoading(false);
      }
    }
    fetchDetail();
  }, [slug]);

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? "bg-[#0a1a0e]" : "bg-gray-50"}`}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
          <span className="text-sm text-white/40">Loading opening...</span>
        </div>
      </div>
    );
  }

  if (error || !opening) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? "bg-[#0a1a0e]" : "bg-gray-50"}`}>
        <div className="text-center space-y-3">
          <p className="text-sm text-red-400">{error ?? "Opening not found"}</p>
          <button onClick={() => navigate("/openings")} className="text-xs text-emerald-400 hover:underline">
            Back to Library
          </button>
        </div>
      </div>
    );
  }

  const allLines = chapters.flatMap((c) => c.lines);
  const masteredCount = allLines.filter((l) => l.progress?.status === "mastered").length;
  const learningCount = allLines.filter((l) => l.progress?.status === "learning" || l.progress?.status === "reviewing").length;
  const firstUnstudied = allLines.find((l) => !l.progress || l.progress.status === "new");

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a1a0e]" : "bg-gray-50"}`}>
      {/* Back nav */}
      <div className="border-b border-white/[0.06] bg-[#0a1a0e]/80 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate("/openings")}
            className="flex items-center gap-1.5 text-xs text-white/40 hover:text-emerald-400 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Library
          </button>
          <span className="text-white/15">/</span>
          <span className="text-xs text-white/60 font-medium truncate">{opening.name}</span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-8">
        {/* Hero section */}
        <div className="flex flex-col md:flex-row gap-6">
          {/* Board */}
          <div className="w-full md:w-64 shrink-0">
            <div className="rounded-xl overflow-hidden border border-white/[0.06] pointer-events-none">
              <Chessboard
                options={{
                  position: opening.thumbnailFen,
                  boardOrientation: opening.side === "black" ? "black" : "white",
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
                <div className={`w-3 h-3 rounded-full ${opening.side === "white" ? "bg-white border border-white/30" : "bg-gray-800 border border-white/20"}`} />
                <span className="text-[11px] text-white/40 font-mono uppercase tracking-wider">{opening.eco}</span>
                {opening.isFeatured && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 text-[10px] font-semibold border border-amber-500/20">
                    <Star className="w-3 h-3 fill-current" /> Featured
                  </span>
                )}
              </div>
              <h1 className="text-2xl font-bold text-white/95">{opening.name}</h1>
              {opening.shortDescription && (
                <p className="text-sm text-white/50 mt-1 leading-relaxed">{opening.shortDescription}</p>
              )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              <StatBar label="Popularity" value={opening.popularity} />
              <StatBar label="Trap Potential" value={opening.trapPotential} />
              <StatBar label="Strategic Complexity" value={opening.strategicComplexity} />
              <div className="space-y-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-white/40">Character</span>
                  <span className="text-white/60 capitalize">{opening.playCharacter}</span>
                </div>
                <div className="h-1 rounded-full bg-white/[0.06]" />
              </div>
            </div>

            {/* Tags */}
            {opening.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {opening.tags.map((tag) => (
                  <span
                    key={tag.slug}
                    className="px-2 py-0.5 rounded-full text-[10px] text-white/40 bg-white/[0.03] border border-white/[0.05]"
                  >
                    {tag.name}
                  </span>
                ))}
              </div>
            )}

            {/* Progress summary */}
            {user && allLines.length > 0 && (
              <div className="flex items-center gap-4 p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                <div className="text-center">
                  <div className="text-lg font-bold text-emerald-400">{masteredCount}</div>
                  <div className="text-[9px] text-white/30 uppercase">Mastered</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-amber-400">{learningCount}</div>
                  <div className="text-[9px] text-white/30 uppercase">In Progress</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-white/50">{lineCount}</div>
                  <div className="text-[9px] text-white/30 uppercase">Total Lines</div>
                </div>
                <div className="flex-1" />
                <div className="h-8 w-8 rounded-full border-2 border-emerald-500/30 flex items-center justify-center">
                  <span className="text-[10px] font-bold text-emerald-400">
                    {lineCount > 0 ? Math.round((masteredCount / lineCount) * 100) : 0}%
                  </span>
                </div>
              </div>
            )}

            {/* CTA */}
            <button
              onClick={() => {
                if (firstUnstudied) {
                  navigate(`/openings/${slug}/study/${firstUnstudied.slug}`);
                } else if (allLines.length > 0) {
                  navigate(`/openings/${slug}/study/${allLines[0].slug}`);
                }
              }}
              disabled={allLines.length === 0}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Play className="w-4 h-4" />
              {masteredCount > 0 ? "Continue Studying" : "Start Studying"}
            </button>
          </div>
        </div>

        {/* Long description */}
        {opening.longDescription && (
          <div className="prose prose-invert prose-sm max-w-none p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
            <p className="text-sm text-white/60 leading-relaxed whitespace-pre-line">{opening.longDescription}</p>
          </div>
        )}

        {/* Chapters / Lines */}
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider">
              Study Lines ({lineCount})
            </h2>
          </div>

          {chapters.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <Lock className="w-8 h-8 text-white/15 mx-auto" />
              <p className="text-sm text-white/35">No study lines available yet</p>
              <p className="text-xs text-white/25">Lines are being prepared for this opening</p>
            </div>
          ) : (
            chapters.map((chapter) => (
              <div key={chapter.name} className="space-y-2">
                <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider px-1">
                  {chapter.name}
                </h3>
                <div className="space-y-1">
                  {chapter.lines.map((line) => (
                    <LineRow
                      key={line.id}
                      line={line}
                      openingSlug={slug}
                      onClick={() => navigate(`/openings/${slug}/study/${line.slug}`)}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default function OpeningDetail() {
  return (
    <OpeningsProGate>
      <OpeningDetailContent />
    </OpeningsProGate>
  );
}
