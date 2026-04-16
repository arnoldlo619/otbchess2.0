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
import {
  Search, Filter, ChevronRight, Star, Zap, Shield, Swords,
  BookOpen, Crown, Target, X, Sparkles,
} from "lucide-react";

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
  white: <div className="w-3 h-3 rounded-full bg-white border border-white/30" />,
  black: <div className="w-3 h-3 rounded-full bg-gray-800 border border-white/20" />,
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
function OpeningCardComponent({ opening, onClick }: { opening: OpeningCard; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group relative flex flex-col bg-[#0f1f13]/80 border border-white/[0.06] rounded-xl overflow-hidden hover:border-emerald-500/30 hover:bg-[#0f1f13] transition-all duration-300 text-left w-full"
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
              <span className="text-[10px] text-white/40 font-mono uppercase tracking-wider">{opening.eco}</span>
            </div>
            <h3 className="text-sm font-semibold text-white/90 leading-tight group-hover:text-emerald-400 transition-colors truncate">
              {opening.name}
            </h3>
          </div>
        </div>

        {/* Description */}
        {opening.shortDescription && (
          <p className="text-[11px] text-white/50 leading-relaxed line-clamp-2">
            {opening.shortDescription}
          </p>
        )}

        {/* Meta row */}
        <div className="flex items-center gap-2 mt-auto pt-1">
          <DifficultyBadge difficulty={opening.difficulty} />
          {opening.lineCount > 0 && (
            <span className="text-[10px] text-white/30 font-mono">
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

        {/* Tags */}
        {opening.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-0.5">
            {opening.tags
              .filter((t) => t.category === "theme" || t.category === "style")
              .slice(0, 3)
              .map((tag) => (
                <span
                  key={tag.slug}
                  className="px-1.5 py-0.5 rounded text-[9px] text-white/30 bg-white/[0.03] border border-white/[0.04]"
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
          <span className="text-[11px] text-white/40 font-mono">{opening.eco}</span>
        </div>
        <h3 className="text-lg font-bold text-white/95 group-hover:text-emerald-400 transition-colors">
          {opening.name}
        </h3>
        {opening.shortDescription && (
          <p className="text-xs text-white/50 leading-relaxed line-clamp-2">{opening.shortDescription}</p>
        )}
        <div className="flex items-center gap-3 mt-1">
          <DifficultyBadge difficulty={opening.difficulty} />
          {opening.lineCount > 0 && (
            <span className="text-[11px] text-white/30 font-mono">{opening.lineCount} lines</span>
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
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200 ${
        active
          ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
          : "bg-white/[0.03] text-white/50 border-white/[0.06] hover:border-white/10 hover:text-white/70"
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
}: {
  title: string;
  subtitle: string;
  openings: OpeningCard[];
  onOpeningClick: (slug: string) => void;
}) {
  if (sectionOpenings.length === 0) return null;
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-white/90">{title}</h2>
        <p className="text-xs text-white/40 mt-0.5">{subtitle}</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {sectionOpenings.map((o) => (
          <OpeningCardComponent key={o.id} opening={o} onClick={() => onOpeningClick(o.slug)} />
        ))}
      </div>
    </section>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function OpeningsLibrary() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [, navigate] = useLocation();

  const [allOpenings, setAllOpenings] = useState<OpeningCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        const res = await fetch("/api/openings");
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
      {/* Header */}
      <div className="border-b border-white/[0.06] bg-[#0a1a0e]/80 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <BookOpen className="w-5 h-5 text-emerald-400" />
              <div>
                <h1 className="text-lg font-bold text-white/90">Openings Library</h1>
                <p className="text-[11px] text-white/40">
                  {allOpenings.length} openings &middot; {allOpenings.reduce((s, o) => s + o.lineCount, 0)} study lines
                </p>
              </div>
            </div>

            {/* Search */}
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input
                  type="text"
                  placeholder="Search openings..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-sm text-white/80 placeholder:text-white/25 focus:outline-none focus:border-emerald-500/30 focus:bg-white/[0.06] transition-all"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-white/10"
                  >
                    <X className="w-3 h-3 text-white/40" />
                  </button>
                )}
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`p-2 rounded-lg border transition-all ${
                  showFilters || hasActiveFilters
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                    : "bg-white/[0.04] border-white/[0.06] text-white/40 hover:text-white/60"
                }`}
              >
                <Filter className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Filter bar */}
          {showFilters && (
            <div className="mt-3 pt-3 border-t border-white/[0.04] space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] text-white/30 uppercase tracking-wider font-medium w-12">Side</span>
                <FilterChip
                  label="White"
                  active={sideFilter === "white"}
                  onClick={() => setSideFilter(sideFilter === "white" ? null : "white")}
                  icon={<div className="w-2.5 h-2.5 rounded-full bg-white border border-white/30" />}
                />
                <FilterChip
                  label="Black"
                  active={sideFilter === "black"}
                  onClick={() => setSideFilter(sideFilter === "black" ? null : "black")}
                  icon={<div className="w-2.5 h-2.5 rounded-full bg-gray-800 border border-white/20" />}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] text-white/30 uppercase tracking-wider font-medium w-12">Level</span>
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
              <span className="text-sm text-white/40">Loading openings...</span>
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
              <Search className="w-8 h-8 text-white/20 mx-auto" />
              <p className="text-sm text-white/40">No openings match your filters</p>
              <button onClick={clearFilters} className="text-xs text-emerald-400 hover:underline">
                Clear filters
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Featured section */}
            {featured.length > 0 && !hasActiveFilters && (
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider">Featured</h2>
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
                />
                <CategorySection
                  title="Black vs 1.e4"
                  subtitle="Defenses against the King's Pawn"
                  openings={blackE4}
                  onOpeningClick={handleOpeningClick}
                />
                <CategorySection
                  title="Black vs 1.d4"
                  subtitle="Defenses against the Queen's Pawn"
                  openings={blackD4}
                  onOpeningClick={handleOpeningClick}
                />
              </>
            ) : (
              /* Flat grid when side filter is active */
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {filtered.map((o) => (
                  <OpeningCardComponent key={o.id} opening={o} onClick={() => handleOpeningClick(o.slug)} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
