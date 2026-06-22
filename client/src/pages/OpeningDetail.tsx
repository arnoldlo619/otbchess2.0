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
  CheckCircle2, Circle, Loader2, Play, Heart,
} from "lucide-react";

import { NavLogo } from "@/components/NavLogo";
import { AvatarNavDropdown } from "@/components/AvatarNavDropdown";
import { authFetch } from "@/lib/apiFetch";
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
  new: { icon: <Circle className="w-3.5 h-3.5" />, label: "New", color: "text-[#436850] dark:text-white/30" },
};

// ── Stat Bar ──────────────────────────────────────────────────────────────────
function StatBar({ label, value, max = 100 }: { label: string; value: number; max?: number }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px]">
        <span className="text-white/40">{label}</span>
        <span className="text-white/60 font-mono">{value}/{max}</span>
      </div>
      <div className={`h-1 rounded-full overflow-hidden ${isDark ? "bg-white/[0.06]" : "bg-[#ADBC9F]"}`}>
        <div className="h-full rounded-full bg-emerald-500/60 transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ── Line Row ──────────────────────────────────────────────────────────────────
function LineRow({ line, openingSlug: _openingSlug, onClick, isFavorited, onToggleFavorite }: { line: LineCard; openingSlug: string; onClick: () => void; isFavorited?: boolean; onToggleFavorite?: (lineId: string) => void }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const colors = DIFFICULTY_COLORS[line.difficulty] ?? DIFFICULTY_COLORS.intermediate;
  const statusCfg = line.progress ? STATUS_CONFIG[line.progress.status] ?? STATUS_CONFIG.new : null;
  return (
    <div className="relative group">
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-left ${isDark ? "bg-white/[0.02] border border-white/[0.04] hover:border-emerald-500/20 hover:bg-white/[0.04]" : "bg-white border border-[#ADBC9F]/70 hover:border-[#436850]/30 hover:shadow-sm"}`}
    >
      {/* Progress indicator */}
      <div className={`shrink-0 ${statusCfg?.color ?? "text-white/20"}`}>
        {statusCfg?.icon ?? <Circle className="w-3.5 h-3.5" />}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className={`text-sm font-medium transition-colors truncate ${isDark ? "text-white/80 group-hover:text-emerald-400" : "text-[#12372A] group-hover:text-[#436850]"}`}>
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
          <p className={`text-[11px] mt-0.5 truncate ${isDark ? "text-white/35" : "text-[#436850]"}`}>{line.description}</p>
        )}
      </div>

      {/* Meta */}
      <div className="shrink-0 flex items-center gap-3">
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${colors.bg} ${colors.text} ${colors.border}`}>
          {line.difficulty}
        </span>
        <span className={`text-[10px] font-mono w-8 text-right ${isDark ? "text-white/25" : "text-[#436850]"}`}>
          {Math.ceil(line.moveCount / 2)}m
        </span>
        {line.progress && line.progress.accuracy > 0 && (
          <span className={`text-[10px] font-mono w-10 text-right ${isDark ? "text-white/30" : "text-[#436850]"}`}>
            {line.progress.accuracy}%
          </span>
        )}
        <ChevronRight className={`w-4 h-4 transition-colors ${isDark ? "text-white/15 group-hover:text-emerald-400" : "text-[#436850]/70 group-hover:text-[#436850]"}`} />
      </div>
    </button>
    {/* Favorite button — floats on the right edge */}
    {onToggleFavorite && (
      <button
        onClick={(e) => { e.stopPropagation(); onToggleFavorite(line.id); }}
        title={isFavorited ? "Remove from favorites" : "Add to favorites"}
        className={`absolute top-1/2 -translate-y-1/2 right-10 z-10 p-1.5 rounded-full transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 ${
          isFavorited
            ? "text-rose-400 bg-rose-500/10 hover:bg-rose-500/20"
            : isDark ? "text-white/25 hover:text-rose-400 hover:bg-rose-500/10" : "text-[#436850]/70 hover:text-rose-400 hover:bg-rose-50"
        }`}
      >
        <Heart className={`w-3.5 h-3.5 ${isFavorited ? "fill-current" : ""}`} />
      </button>
    )}
    </div>
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
  const [favoritedLines, setFavoritedLines] = useState<Set<string>>(new Set());
  const slug = params?.slug ?? "";

  useEffect(() => {
    if (!slug) return;
    async function fetchDetail() {
      try {
        setLoading(true);
        const res = await authFetch(`/api/openings/${slug}`);
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

  // Fetch favorite status for all lines in this opening
  useEffect(() => {
    if (!user) return;
    async function fetchFavorites() {
      try {
        const res = await authFetch("/api/favorites");
        if (!res.ok) return;
        const data = await res.json();
        const ids = new Set<string>((data.favorites ?? []).map((f: { lineId: string }) => f.lineId));
        setFavoritedLines(ids);
      } catch { /* ignore */ }
    }
    fetchFavorites();
  }, [user]);

  async function handleToggleFavorite(lineId: string) {
    if (!user) return;
    try {
      const res = await authFetch(`/api/favorites/${lineId}`, { method: "POST" });
      if (!res.ok) return;
      const data = await res.json();
      setFavoritedLines((prev) => {
        const next = new Set(prev);
        if (data.favorited) next.add(lineId);
        else next.delete(lineId);
        return next;
      });
    } catch { /* ignore */ }
  }

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? "bg-[#0a1a0e]" : "bg-[#FBFADA]/70"}`}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
          <span className={`text-sm ${isDark ? "text-white/40" : "text-[#436850]"}`}>Loading opening...</span>
        </div>
      </div>
    );
  }

  if (error || !opening) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? "bg-[#0a1a0e]" : "bg-[#FBFADA]/70"}`}>
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
    <div className={`min-h-screen ${isDark ? "bg-[#0a1a0e]" : "bg-[#FBFADA]/70"}`}>
      {/* Back nav */}
      <div className={`border-b backdrop-blur-xl sticky top-0 z-30 ${isDark ? "border-white/[0.06] bg-[#0a1a0e]/80" : "border-[#ADBC9F]/70 bg-white/90"}`}>
        <div className="max-w-5xl mx-auto px-4 py-3 space-y-2">
          <div className="flex items-center justify-between">
            <NavLogo />
            <AvatarNavDropdown />
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/openings")}
              className={`flex items-center gap-1.5 text-xs transition-colors ${isDark ? "text-white/40 hover:text-emerald-400" : "text-[#436850] hover:text-[#436850]"}`}
            >
              <ArrowLeft className="w-4 h-4" />
              Library
            </button>
            <span className={`${isDark ? "text-white/15" : "text-[#436850]/70"}`}>/</span>
            <span className={`text-xs font-medium truncate ${isDark ? "text-white/60" : "text-[#12372A]/85"}`}>{opening.name}</span>
          </div>
        </div>
      </div>

       {/* ── Board-First Hero ─────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-8">
        {/* Hero: large board left, info panel right */}
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Board — dominant element, fills ~55% on desktop */}
          <div className="w-full lg:w-[55%] shrink-0">
            <div className={`rounded-2xl overflow-hidden border-2 pointer-events-none shadow-2xl ${isDark ? "border-emerald-500/20 shadow-emerald-900/40" : "border-[#436850]/20 shadow-gray-300/60"}`}>
              <Chessboard
                options={{
                  position: opening.thumbnailFen,
                  boardOrientation: opening.side === "black" ? "black" : "white",
                  allowDragging: false,
                  boardStyle: { borderRadius: "0" },
                  darkSquareStyle: { backgroundColor: isDark ? "#2d5a3a" : "#769656" },
                  lightSquareStyle: { backgroundColor: isDark ? "#8fbc8f" : "#eeeed2" },
                }}
              />
            </div>
          </div>
          {/* Info panel — right side, scrollable */}
          <div className="flex-1 space-y-5 lg:sticky lg:top-24">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-3 h-3 rounded-full ${opening.side === "white" ? "bg-white border border-white/30" : "bg-gray-800 border border-white/20"}`} />
                <span className={`text-[11px] font-mono uppercase tracking-wider ${isDark ? "text-white/40" : "text-[#436850]"}`}>{opening.eco}</span>
                {opening.isFeatured && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 text-[10px] font-semibold border border-amber-500/20">
                    <Star className="w-3 h-3 fill-current" /> Featured
                  </span>
                )}
              </div>
              <h1 className={`text-3xl lg:text-4xl font-bold leading-tight ${isDark ? "text-white/95" : "text-[#12372A]"}`}>{opening.name}</h1>
              {opening.shortDescription && (
                <p className={`text-base mt-2 leading-relaxed ${isDark ? "text-white/55" : "text-[#436850]"}`}>{opening.shortDescription}</p>
              )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              <StatBar label="Popularity" value={opening.popularity} />
              <StatBar label="Trap Potential" value={opening.trapPotential} />
              <StatBar label="Strategic Complexity" value={opening.strategicComplexity} />
              <div className="space-y-1">
                <div className="flex justify-between text-[10px]">
                  <span className={`${isDark ? "text-white/40" : "text-[#436850]"}`}>Character</span>
                  <span className={`capitalize ${isDark ? "text-white/60" : "text-[#12372A]/85"}`}>{opening.playCharacter}</span>
                </div>
                <div className={`h-1 rounded-full ${isDark ? "bg-white/[0.06]" : "bg-[#ADBC9F]"}`} />
              </div>
            </div>

            {/* Tags */}
            {opening.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {opening.tags.map((tag) => (
                  <span
                    key={tag.slug}
                    className={`px-2 py-0.5 rounded-full text-[10px] ${isDark ? "text-white/40 bg-white/[0.03] border border-white/[0.05]" : "text-[#436850] bg-[#ADBC9F]/40 border border-[#ADBC9F]"}`}
                  >
                    {tag.name}
                  </span>
                ))}
              </div>
            )}

            {/* Progress summary */}
            {user && allLines.length > 0 && (
              <div className={`flex items-center gap-4 p-3 rounded-lg ${isDark ? "bg-white/[0.02] border border-white/[0.04]" : "bg-[#FBFADA]/70 border border-[#ADBC9F]/70"}`}>
                <div className="text-center">
                  <div className="text-lg font-bold text-emerald-400">{masteredCount}</div>
                  <div className={`text-[9px] uppercase ${isDark ? "text-white/30" : "text-[#436850]"}`}>Mastered</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-amber-400">{learningCount}</div>
                  <div className={`text-[9px] uppercase ${isDark ? "text-white/30" : "text-[#436850]"}`}>In Progress</div>
                </div>
                <div className="text-center">
                  <div className={`text-lg font-bold ${isDark ? "text-white/50" : "text-[#436850]"}`}>{lineCount}</div>
                  <div className={`text-[9px] uppercase ${isDark ? "text-white/30" : "text-[#436850]"}`}>Total Lines</div>
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
              className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-base transition-all shadow-lg shadow-emerald-900/30 disabled:opacity-40 disabled:cursor-not-allowed min-h-[56px]"
            >
              <Play className="w-4 h-4" />
              {masteredCount > 0 ? "Continue Studying" : "Start Studying"}
            </button>
          </div>
        </div>

        {/* Long description */}
        {opening.longDescription && (
          <div className={`prose prose-sm max-w-none p-4 rounded-xl ${isDark ? "prose-invert bg-white/[0.02] border border-white/[0.04]" : "bg-[#FBFADA]/70 border border-[#ADBC9F]/70"}`}>
            <p className={`text-sm leading-relaxed whitespace-pre-line ${isDark ? "text-white/60" : "text-[#436850]"}`}>{opening.longDescription}</p>
          </div>
        )}

        {/* Chapters / Lines */}
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-emerald-400" />
            <h2 className={`text-sm font-semibold uppercase tracking-wider ${isDark ? "text-white/70" : "text-[#436850]"}`}>
              Study Lines ({lineCount})
            </h2>
          </div>

          {chapters.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <Lock className={`w-8 h-8 mx-auto ${isDark ? "text-white/15" : "text-[#436850]/70"}`} />
              <p className={`text-sm ${isDark ? "text-white/35" : "text-[#436850]"}`}>No study lines available yet</p>
              <p className={`text-xs ${isDark ? "text-white/25" : "text-[#436850]"}`}>Lines are being prepared for this opening</p>
            </div>
          ) : (
            chapters.map((chapter) => (
              <div key={chapter.name} className="space-y-2">
                <h3 className={`text-xs font-semibold uppercase tracking-wider px-1 ${isDark ? "text-white/50" : "text-[#436850]"}`}>
                  {chapter.name}
                </h3>
                <div className="space-y-1">
                  {chapter.lines.map((line) => (
                    <LineRow
                      key={line.id}
                      line={line}
                      openingSlug={slug}
                      onClick={() => navigate(`/openings/${slug}/study/${line.slug}`)}
                      isFavorited={favoritedLines.has(line.id)}
                      onToggleFavorite={user ? handleToggleFavorite : undefined}
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
