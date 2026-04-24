/**
 * OpeningsLibrary.tsx — Premium openings catalog browse page.
 *
 * Features:
 *   - Search by name/ECO
 *   - Filter by side (White/Black), difficulty, style tags
 *   - Featured openings hero section
 *   - Card layout with mini chessboard FEN thumbnails
 *   - Category groupings (White Repertoire, Black vs 1.e4, Black vs 1.d4)
 *   - Responsive grid, dark-first design
 */
import { useState, useEffect, useMemo, useCallback } from "react";
import { useLocation } from "wouter";
import { Chessboard } from "react-chessboard";
import { useTheme } from "@/contexts/ThemeContext";
import { OpeningsProGate } from "@/components/OpeningsProGate";
import {
  Search, Filter, ChevronRight, Star, Zap, Shield, Swords,
  BookOpen, Crown, Target, X, Sparkles, RotateCcw, Clock, Heart,
} from "lucide-react";
import { useAuthContext } from "@/context/AuthContext";

import { NavLogo } from "@/components/NavLogo";
import { AvatarNavDropdown } from "@/components/AvatarNavDropdown";
import { authFetch } from "@/lib/apiFetch";
// ── Types ─────────────────────────────────────────────────────────────────────
interface OpeningTag {
  name: string;
  category: string;
  slug: string;
}

interface OpeningCard {
  id: string;
  slug: string;
  name: string;
  side: string;
  eco: string;
  shortDescription: string | null;
  difficulty: string;
  popularity: number;
  thumbnailFen: string;
  isFeatured: boolean;
  starterFriendly: boolean;
  trapPotential: number;
  strategicComplexity: number;
  estimatedLineCount: number;
  lineCount: number;
  tags: OpeningTag[];
}

// ── Constants ─────────────────────────────────────────────────────────────────
const DIFFICULTY_ORDER = ["beginner", "intermediate", "advanced", "expert"];
const DIFFICULTY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  beginner: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" },
  intermediate: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20" },
  advanced: { bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/20" },
  expert: { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/20" },
};

const SIDE_ICONS: Record<string, React.ReactNode> = {
  white: <div className="w-3 h-3 rounded-full bg-white border border-gray-300 dark:border-white/30" />,
  black: <div className="w-3 h-3 rounded-full bg-gray-800 border border-gray-400 dark:border-white/20" />,
};

// ── Mini Board Thumbnail ──────────────────────────────────────────────────────
function BoardThumbnail({ fen, side }: { fen: string; side: string }) {
  return (
    <div className="w-full aspect-square rounded-lg overflow-hidden pointer-events-none">
      <Chessboard
        options={{
          position: fen,
          boardOrientation: side === "black" ? "black" : "white",
          allowDragging: false,
          boardStyle: { borderRadius: "0" },
          darkSquareStyle: { backgroundColor: "#2d5a3a" },
          lightSquareStyle: { backgroundColor: "#8fbc8f" },
        }}
      />
    </div>
  );
}

// ── Difficulty Badge ──────────────────────────────────────────────────────────
function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const colors = DIFFICULTY_COLORS[difficulty] ?? DIFFICULTY_COLORS.intermediate;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${colors.bg} ${colors.text} ${colors.border}`}>
      {difficulty === "beginner" && <Shield className="w-3 h-3" />}
      {difficulty === "intermediate" && <Target className="w-3 h-3" />}
      {difficulty === "advanced" && <Swords className="w-3 h-3" />}
      {difficulty === "expert" && <Crown className="w-3 h-3" />}
      {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
    </span>
  );
}

// ── Opening Card ──────────────────────────────────────────────────────────────
function OpeningCardComponent({ opening, onClick, progress }: { opening: OpeningCard; onClick: () => void; progress?: { mastered: number; total: number } }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const pct = progress && progress.total > 0 ? Math.round((progress.mastered / progress.total) * 100) : 0;
  const hasProgress = progress && progress.total > 0;
  return (
    <button
      onClick={onClick}
      className={`group relative flex flex-col rounded-xl overflow-hidden transition-all duration-300 text-left w-full ${isDark ? "bg-[#0f1f13]/80 border border-white/[0.06] hover:border-emerald-500/30 hover:bg-[#0f1f13]" : "bg-white border border-gray-200/80 hover:border-[#3D6B47]/40 hover:shadow-md shadow-sm"}`}
    >
      {/* Featured badge */}
      {opening.isFeatured && (
        <div className="absolute top-2 right-2 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-400 text-[10px] font-semibold">
          <Star className="w-3 h-3 fill-current" />
          Featured
        </div>
      )}

      {/* Board thumbnail */}
      <div className="p-3 pb-0">
        <BoardThumbnail fen={opening.thumbnailFen} side={opening.side} />
      </div>

      {/* Content */}
      <div className="flex flex-col gap-2 p-3 pt-2.5 flex-1">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              {SIDE_ICONS[opening.side]}
              <span className={`text-[10px] font-mono uppercase tracking-wider ${isDark ? "text-white/40" : "text-gray-400"}`}>{opening.eco}</span>
            </div>
            <h3 className={`text-sm font-semibold leading-tight transition-colors truncate ${isDark ? "text-white/90 group-hover:text-emerald-400" : "text-gray-900 group-hover:text-[#3D6B47]"}`}>
              {opening.name}
            </h3>
          </div>
        </div>

        {/* Description */}
        {opening.shortDescription && (
          <p className={`text-[11px] leading-relaxed line-clamp-2 ${isDark ? "text-white/50" : "text-gray-500"}`}>
            {opening.shortDescription}
          </p>
        )}

        {/* Meta row */}
        <div className="flex items-center gap-2 mt-auto pt-1">
          <DifficultyBadge difficulty={opening.difficulty} />
          {opening.lineCount > 0 && (
            <span className={`text-[10px] font-mono ${isDark ? "text-white/30" : "text-gray-400"}`}>
              {opening.lineCount} {opening.lineCount === 1 ? "line" : "lines"}
            </span>
          )}
          {opening.starterFriendly && (
            <span className="text-[10px] text-emerald-400/60 flex items-center gap-0.5">
              <Sparkles className="w-3 h-3" />
              Starter
            </span>
          )}
        </div>
        {/* Progress bar */}
        {hasProgress && (
          <div className="flex items-center gap-2 pt-1">
            <div className={`flex-1 h-1.5 rounded-full overflow-hidden ${isDark ? "bg-white/[0.06]" : "bg-gray-100"}`}>
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className={`text-[9px] font-medium tabular-nums ${pct === 100 ? "text-emerald-400" : isDark ? "text-white/30" : "text-gray-400"}`}>
              {progress!.mastered}/{progress!.total}
            </span>
          </div>
        )}

        {/* Tags */}
        {opening.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-0.5">
            {opening.tags
              .filter((t) => t.category === "theme" || t.category === "style")
              .slice(0, 3)
              .map((tag) => (
                <span
                  key={tag.slug}
                  className={`px-1.5 py-0.5 rounded text-[9px] ${isDark ? "text-white/30 bg-white/[0.03] border border-white/[0.04]" : "text-gray-400 bg-gray-100 border border-gray-200/60"}`}
                >
                  {tag.name}
                </span>
              ))}
          </div>
        )}
      </div>

      {/* Hover arrow */}
      <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <ChevronRight className="w-4 h-4 text-emerald-400" />
      </div>
    </button>
  );
}

// ── Featured Hero Card ────────────────────────────────────────────────────────
function FeaturedCard({ opening, onClick }: { opening: OpeningCard; onClick: () => void }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  return (
    <button
      onClick={onClick}
      className="group relative flex flex-row bg-gradient-to-r from-[#0f1f13] to-[#142a18] border border-emerald-500/10 rounded-xl overflow-hidden hover:border-emerald-500/30 transition-all duration-300 text-left w-full"
    >
      <div className="w-32 sm:w-40 shrink-0 p-3">
        <BoardThumbnail fen={opening.thumbnailFen} side={opening.side} />
      </div>
      <div className="flex flex-col justify-center gap-2 p-4 flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
          <span className="text-[10px] text-amber-400/80 font-semibold uppercase tracking-wider">Featured Opening</span>
        </div>
        <div className="flex items-center gap-2">
          {SIDE_ICONS[opening.side]}
          <span className={`text-[11px] font-mono ${isDark ? "text-white/40" : "text-gray-400"}`}>{opening.eco}</span>
        </div>
        <h3 className={`text-lg font-bold transition-colors ${isDark ? "text-white/95 group-hover:text-emerald-400" : "text-gray-900 group-hover:text-[#3D6B47]"}`}>
          {opening.name}
        </h3>
        {opening.shortDescription && (
          <p className={`text-xs leading-relaxed line-clamp-2 ${isDark ? "text-white/50" : "text-gray-500"}`}>{opening.shortDescription}</p>
        )}
        <div className="flex items-center gap-3 mt-1">
          <DifficultyBadge difficulty={opening.difficulty} />
          {opening.lineCount > 0 && (
            <span className={`text-[11px] font-mono ${isDark ? "text-white/30" : "text-gray-400"}`}>{opening.lineCount} lines</span>
          )}
        </div>
      </div>
      <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
        <ChevronRight className="w-5 h-5 text-emerald-400" />
      </div>
    </button>
  );
}

// ── Filter Chip ───────────────────────────────────────────────────────────────
function FilterChip({
  label,
  active,
  onClick,
  icon,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
}) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200 ${
        active
          ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
          : isDark ? "bg-white/[0.03] text-white/50 border-white/[0.06] hover:border-white/10 hover:text-white/70" : "bg-gray-100/70 text-gray-500 border-gray-200/60 hover:border-gray-300 hover:text-gray-700"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

// ── Category Section ──────────────────────────────────────────────────────────
function CategorySection({
  title,
  subtitle,
  openings: sectionOpenings,
  onOpeningClick,
  progressMap,
}: {
  title: string;
  subtitle: string;
  openings: OpeningCard[];
  onOpeningClick: (slug: string) => void;
  progressMap?: Record<string, { mastered: number; total: number }>;
}) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  if (sectionOpenings.length === 0) return null;
  return (
    <section className="space-y-4">
      <div>
        <h2 className={`text-lg font-bold ${isDark ? "text-white/90" : "text-gray-900"}`}>{title}</h2>
        <p className={`text-xs mt-0.5 ${isDark ? "text-white/40" : "text-gray-500"}`}>{subtitle}</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {sectionOpenings.map((o) => (
          <OpeningCardComponent key={o.id} opening={o} onClick={() => onOpeningClick(o.slug)} progress={progressMap?.[o.id]} />
        ))}
      </div>
    </section>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
function OpeningsLibraryContent() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [, navigate] = useLocation();

  const [allOpenings, setAllOpenings] = useState<OpeningCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Favorites state
  const { user } = useAuthContext();
  interface FavoriteLine {
    id: string;
    lineId: string;
    openingId: string;
    note: string | null;
    createdAt: string;
    line: { id: string; title: string; slug: string; eco: string | null; difficulty: string; plyCount: number; description: string | null; mustKnow: boolean; isTrap: boolean };
    opening: { id: string; name: string; slug: string; thumbnailFen: string | null };
  }
  const [favorites, setFavorites] = useState<FavoriteLine[]>([]);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  // Review queue state
  const [reviewCount, setReviewCount] = useState(0);
  const [reviewQueue, setReviewQueue] = useState<Array<{
    reviewId: string;
    lineId: string;
    line: { title: string; slug: string; openingId: string } | null;
    opening: { name: string; slug: string } | null;
    status: string;
    streak: number;
  }>>([])
  // Progress per opening: openingId -> { mastered, total }
  const [progressMap, setProgressMap] = useState<Record<string, { mastered: number; total: number }>>({});

  // Filters
  const [search, setSearch] = useState("");
  const [sideFilter, setSideFilter] = useState<string | null>(null);
  const [difficultyFilter, setDifficultyFilter] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Fetch openings
  useEffect(() => {
    async function fetchOpenings() {
      try {
        setLoading(true);
        const res = await authFetch("/api/openings");
        if (!res.ok) throw new Error("Failed to fetch openings");
        const data = await res.json();
        setAllOpenings(data.openings ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load openings");
      } finally {
        setLoading(false);
      }
    }
    fetchOpenings();
  }, []);

  // Fetch favorites for logged-in users
  useEffect(() => {
    if (!user) return;
    async function fetchFavorites() {
      try {
        setFavoritesLoading(true);
        const res = await authFetch("/api/favorites");
        if (!res.ok) return;
        const data = await res.json();
        setFavorites(data.favorites ?? []);
      } catch { /* silent */ } finally {
        setFavoritesLoading(false);
      }
    }
    fetchFavorites();
  }, [user]);

  async function handleRemoveFavorite(lineId: string) {
    if (!user) return;
    try {
      const res = await authFetch(`/api/favorites/${lineId}`, { method: "POST" });
      if (!res.ok) return;
      const data = await res.json();
      if (!data.favorited) {
        setFavorites((prev) => prev.filter((f) => f.lineId !== lineId));
      }
    } catch { /* silent */ }
  }

  // Fetch review queue for logged-in users
  useEffect(() => {
    if (!user) return;
    async function fetchQueue() {
      try {
        const res = await authFetch("/api/study/queue");
        if (!res.ok) return;
        const data = await res.json();
        setReviewCount(data.count ?? 0);
        setReviewQueue((data.queue ?? []).slice(0, 5));
      } catch { /* silent */ }
    }
    fetchQueue();
  }, [user]);

  // Fetch study progress per opening for logged-in users
  useEffect(() => {
    if (!user) return;
    async function fetchProgress() {
      try {
        const res = await authFetch("/api/study/progress");
        if (!res.ok) return;
        const data = await res.json();
        const map: Record<string, { mastered: number; total: number }> = {};
        for (const p of (data.progress ?? [])) {
          const oid = p.line?.openingId;
          if (!oid) continue;
          if (!map[oid]) map[oid] = { mastered: 0, total: 0 };
          map[oid].total++;
          if (p.status === "mastered") map[oid].mastered++;
        }
        setProgressMap(map);
      } catch { /* silent */ }
    }
    fetchProgress();
  }, [user]);

  // Filter logic
  const filtered = useMemo(() => {
    let result = allOpenings;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (o) =>
          o.name.toLowerCase().includes(q) ||
          o.eco.toLowerCase().includes(q) ||
          (o.shortDescription ?? "").toLowerCase().includes(q)
      );
    }
    if (sideFilter) {
      result = result.filter((o) => o.side === sideFilter);
    }
    if (difficultyFilter) {
      result = result.filter((o) => o.difficulty === difficultyFilter);
    }
    return result;
  }, [allOpenings, search, sideFilter, difficultyFilter]);

  // Category groupings
  const featured = useMemo(() => filtered.filter((o) => o.isFeatured), [filtered]);
  const whiteOpenings = useMemo(() => filtered.filter((o) => o.side === "white"), [filtered]);
  const blackE4 = useMemo(
    () =>
      filtered.filter(
        (o) =>
          o.side === "black" &&
          (o.eco.startsWith("B") || o.eco.startsWith("C0") || o.name.toLowerCase().includes("french") || o.name.toLowerCase().includes("sicilian") || o.name.toLowerCase().includes("caro") || o.name.toLowerCase().includes("scandinavian"))
      ),
    [filtered]
  );
  const blackD4 = useMemo(
    () =>
      filtered.filter(
        (o) =>
          o.side === "black" &&
          !blackE4.some((e) => e.id === o.id)
      ),
    [filtered, blackE4]
  );

  const hasActiveFilters = sideFilter || difficultyFilter || search;

  const handleOpeningClick = useCallback(
    (slug: string) => navigate(`/openings/${slug}`),
    [navigate]
  );

  const clearFilters = useCallback(() => {
    setSearch("");
    setSideFilter(null);
    setDifficultyFilter(null);
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a1a0e]" : "bg-gray-50"}`}>
      <div className={`border-b backdrop-blur-xl sticky top-0 z-30 ${isDark ? "border-white/[0.06] bg-[#0a1a0e]/80" : "border-gray-200/70 bg-white/90"}`}>
        <div className="max-w-7xl mx-auto px-4 py-3">
          {/* Nav bar */}
          <div className="flex items-center justify-between gap-3 mb-2">
            <NavLogo />
            <AvatarNavDropdown />
          </div>
          {/* Title row + filter toggle */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <BookOpen className="w-5 h-5 text-emerald-400 shrink-0" />
              <div className="min-w-0">
                <h1 className={`text-base font-bold truncate ${isDark ? "text-white/90" : "text-gray-900"}`}>Openings Library</h1>
                <p className={`text-[11px] hidden sm:block ${isDark ? "text-white/40" : "text-gray-500"}`}>
                  {allOpenings.length} openings &middot; {allOpenings.reduce((s, o) => s + o.lineCount, 0)} study lines
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`shrink-0 p-2.5 rounded-lg border transition-all ${
                showFilters || hasActiveFilters
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                  : isDark ? "bg-white/[0.04] border-white/[0.06] text-white/40 hover:text-white/60" : "bg-gray-100 border-gray-200 text-gray-400 hover:text-gray-600"
              }`}
            >
              <Filter className="w-4 h-4" />
            </button>
          </div>
          {/* Search bar — full width below title on all screen sizes */}
          <div className="mt-2.5 relative">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${isDark ? "text-white/30" : "text-gray-400"}`} />
            <input
              type="text"
              placeholder="Search openings..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`w-full pl-9 pr-8 py-2.5 rounded-lg focus:outline-none transition-all ${isDark ? "bg-white/[0.04] border border-white/[0.06] text-white/80 placeholder:text-white/25 focus:border-emerald-500/30 focus:bg-white/[0.06]" : "bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-[#3D6B47]/50 focus:bg-white"}`}
              style={{ fontSize: "16px" }}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className={`absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full ${isDark ? "hover:bg-white/10" : "hover:bg-gray-200"}`}
              >
                <X className={`w-3.5 h-3.5 ${isDark ? "text-white/40" : "text-gray-400"}`} />
              </button>
            )}
          </div>

          {/* Filter bar */}
          {showFilters && (
            <div className={`mt-3 pt-3 border-t space-y-2 ${isDark ? "border-white/[0.04]" : "border-gray-200/60"}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-[10px] uppercase tracking-wider font-medium w-12 ${isDark ? "text-white/30" : "text-gray-400"}`}>Side</span>
                <FilterChip
                  label="White"
                  active={sideFilter === "white"}
                  onClick={() => setSideFilter(sideFilter === "white" ? null : "white")}
                  icon={<div className="w-2.5 h-2.5 rounded-full bg-white border border-gray-300 dark:border-white/30" />}
                />
                <FilterChip
                  label="Black"
                  active={sideFilter === "black"}
                  onClick={() => setSideFilter(sideFilter === "black" ? null : "black")}
                  icon={<div className="w-2.5 h-2.5 rounded-full bg-gray-800 border border-gray-400 dark:border-white/20" />}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-[10px] uppercase tracking-wider font-medium w-12 ${isDark ? "text-white/30" : "text-gray-400"}`}>Level</span>
                {DIFFICULTY_ORDER.map((d) => (
                  <FilterChip
                    key={d}
                    label={d.charAt(0).toUpperCase() + d.slice(1)}
                    active={difficultyFilter === d}
                    onClick={() => setDifficultyFilter(difficultyFilter === d ? null : d)}
                  />
                ))}
              </div>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="text-[11px] text-emerald-400/70 hover:text-emerald-400 transition-colors flex items-center gap-1"
                >
                  <X className="w-3 h-3" />
                  Clear all filters
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-10">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
              <span className={`text-sm ${isDark ? "text-white/40" : "text-gray-500"}`}>Loading openings...</span>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center space-y-2">
              <p className="text-sm text-red-400">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="text-xs text-emerald-400 hover:underline"
              >
                Try again
              </button>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center space-y-2">
              <Search className={`w-8 h-8 mx-auto ${isDark ? "text-white/20" : "text-gray-300"}`} />
              <p className={`text-sm ${isDark ? "text-white/40" : "text-gray-500"}`}>No openings match your filters</p>
              <button onClick={clearFilters} className="text-xs text-emerald-400 hover:underline">
                Clear filters
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Review Queue Card — shown when user has due reviews */}
            {user && reviewCount > 0 && !hasActiveFilters && (
              <section className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                isDark
                  ? "bg-gradient-to-br from-emerald-900/20 to-[#0f1f13]/80 border-emerald-500/15"
                  : "bg-gradient-to-br from-emerald-50 to-white border-emerald-200/60"
              }`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-2 rounded-xl ${isDark ? "bg-emerald-500/15" : "bg-emerald-100"}`}>
                      <RotateCcw className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div>
                      <h3 className={`text-sm font-bold ${isDark ? "text-white/90" : "text-gray-900"}`}>Daily Review</h3>
                      <p className={`text-[11px] ${isDark ? "text-white/40" : "text-gray-500"}`}>
                        {reviewCount} {reviewCount === 1 ? "line" : "lines"} due for review
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (reviewQueue[0]?.opening?.slug && reviewQueue[0]?.line?.slug) {
                        navigate(`/study/${reviewQueue[0].opening.slug}/${reviewQueue[0].line.slug}`);
                      }
                    }}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-all active:scale-95"
                  >
                    Start Review
                  </button>
                </div>
                {reviewQueue.length > 0 && (
                  <div className="space-y-1.5">
                    {reviewQueue.map((item) => (
                      <button
                        key={item.reviewId}
                        onClick={() => {
                          if (item.opening?.slug && item.line?.slug) {
                            navigate(`/study/${item.opening.slug}/${item.line.slug}`);
                          }
                        }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors ${
                          isDark
                            ? "hover:bg-white/[0.04] text-white/70"
                            : "hover:bg-emerald-50 text-gray-700"
                        }`}
                      >
                        <Clock className={`w-3 h-3 shrink-0 ${isDark ? "text-emerald-400/60" : "text-emerald-500/60"}`} />
                        <span className="text-xs truncate flex-1">
                          {item.opening?.name ? `${item.opening.name} — ` : ""}{item.line?.title ?? "Unknown line"}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${
                          item.status === "mastered" ? (isDark ? "bg-emerald-500/15 text-emerald-400" : "bg-emerald-100 text-emerald-600")
                          : item.status === "reviewing" ? (isDark ? "bg-amber-500/15 text-amber-400" : "bg-amber-100 text-amber-600")
                          : isDark ? "bg-white/[0.05] text-white/40" : "bg-gray-100 text-gray-500"
                        }`}>
                          {item.status}
                        </span>
                        <ChevronRight className={`w-3 h-3 shrink-0 ${isDark ? "text-white/20" : "text-gray-300"}`} />
                      </button>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* My Favorites section */}
            {user && favorites.length > 0 && !hasActiveFilters && (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Heart className="w-4 h-4 text-rose-400 fill-current" />
                    <h2 className={`text-sm font-semibold uppercase tracking-wider ${isDark ? "text-white/70" : "text-gray-600"}`}>My Favorites</h2>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${isDark ? "bg-rose-500/15 text-rose-400" : "bg-rose-50 text-rose-500"}`}>
                      {favorites.length}
                    </span>
                  </div>
                </div>
                <div className={`rounded-xl border overflow-hidden ${isDark ? "border-white/[0.06] bg-white/[0.02]" : "border-gray-200/70 bg-white"}`}>
                  {favoritesLoading ? (
                    <div className="flex items-center justify-center py-6">
                      <div className="w-5 h-5 rounded-full border-2 border-rose-400 border-t-transparent animate-spin" />
                    </div>
                  ) : (
                    <div className="divide-y divide-white/[0.04]">
                      {favorites.map((fav) => (
                        <div key={fav.id} className={`group flex items-center gap-3 px-4 py-3 transition-colors ${isDark ? "hover:bg-white/[0.03]" : "hover:bg-gray-50"}`}>
                          <Heart className="w-3.5 h-3.5 shrink-0 text-rose-400 fill-current" />
                          <button
                            onClick={() => navigate(`/openings/${fav.opening.slug}/study/${fav.line.slug}`)}
                            className="flex-1 min-w-0 text-left"
                          >
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-medium truncate ${isDark ? "text-white/80 group-hover:text-emerald-400" : "text-gray-800 group-hover:text-[#3D6B47]"}`}>
                                {fav.line.title}
                              </span>
                              {fav.line.mustKnow && (
                                <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/20">Must Know</span>
                              )}
                            </div>
                            <p className={`text-[11px] mt-0.5 ${isDark ? "text-white/35" : "text-gray-400"}`}>
                              {fav.opening.name}
                              {fav.line.eco && <span className="ml-1.5 font-mono">{fav.line.eco}</span>}
                            </p>
                          </button>
                          <div className="shrink-0 flex items-center gap-2">
                            <span className={`text-[10px] font-mono ${isDark ? "text-white/25" : "text-gray-400"}`}>
                              {Math.ceil(fav.line.plyCount / 2)}m
                            </span>
                            <button
                              onClick={() => handleRemoveFavorite(fav.lineId)}
                              title="Remove from favorites"
                              className={`p-1 rounded-full opacity-0 group-hover:opacity-100 transition-all ${isDark ? "hover:bg-rose-500/15 text-rose-400/50 hover:text-rose-400" : "hover:bg-rose-50 text-rose-300 hover:text-rose-400"}`}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            )}
                        {/* Featured section */}
            {featured.length > 0 && !hasActiveFilters && (
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <h2 className={`text-sm font-semibold uppercase tracking-wider ${isDark ? "text-white/70" : "text-gray-600"}`}>Featured</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {featured.slice(0, 4).map((o) => (
                    <FeaturedCard key={o.id} opening={o} onClick={() => handleOpeningClick(o.slug)} />
                  ))}
                </div>
              </section>
            )}

            {/* Category sections (only when no side filter active) */}
            {!sideFilter ? (
              <>
                <CategorySection
                  title="White Repertoire"
                  subtitle="Systems and openings for the first move"
                  openings={whiteOpenings}
                  onOpeningClick={handleOpeningClick}
                  progressMap={progressMap}
                />
                <CategorySection
                  title="Black vs 1.e4"
                  subtitle="Defenses against the King's Pawn"
                  openings={blackE4}
                  onOpeningClick={handleOpeningClick}
                  progressMap={progressMap}
                />
                <CategorySection
                  title="Black vs 1.d4"
                  subtitle="Defenses against the Queen's Pawn"
                  openings={blackD4}
                  onOpeningClick={handleOpeningClick}
                  progressMap={progressMap}
                />
              </>
            ) : (
              /* Flat grid when side filter is active */
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {filtered.map((o) => (
                  <OpeningCardComponent key={o.id} opening={o} onClick={() => handleOpeningClick(o.slug)} progress={progressMap[o.id]} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function OpeningsLibrary() {
  return (
    <OpeningsProGate>
      <OpeningsLibraryContent />
    </OpeningsProGate>
  );
}
