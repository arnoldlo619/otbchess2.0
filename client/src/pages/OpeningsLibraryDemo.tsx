/**
 * OpeningsLibraryDemo.tsx — Demo-mode version of the Openings Library.
 *
 * Shown to non-Pro users who click "View Demo" on the gate screen.
 * Renders the same UI as the real library but uses static demo data
 * and shows a DemoModeBanner at the top.
 *
 * Clicking an opening card navigates to /openings/demo — a demo detail page.
 */
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { Chessboard } from "react-chessboard";
import { useTheme } from "@/contexts/ThemeContext";
import { DemoModeBanner } from "@/components/DemoModeBanner";
import {
  Search, Filter, ChevronRight, Star, Zap, Shield, Swords,
  BookOpen, Crown, Target, X, Sparkles, Lock,
} from "lucide-react";
import {
  DEMO_OPENINGS,
  type DemoOpeningCard,
} from "@/data/openingsDemo";

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
  black: <div className="w-3 h-3 rounded-full bg-[#12372A] border border-white/20" />,
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
function OpeningCardComponent({
  opening,
  onClick,
  isDemo,
  isDark,
}: {
  opening: DemoOpeningCard;
  onClick: () => void;
  isDemo?: boolean;
  isDark: boolean;
}) {
  const cardBg = isDark
    ? "bg-[#0f1f13]/80 border-white/[0.06] hover:border-emerald-500/30 hover:bg-[#0f1f13]"
    : "bg-[#F0F5E8]/80 border-[#ADBC9F]/40 hover:border-emerald-600/40 hover:bg-[#F0F5E8]";
  const ecoText = isDark ? "text-white/40" : "text-[#436850]/70";
  const nameText = isDark
    ? "text-white/90 group-hover:text-emerald-400"
    : "text-[#12372A] group-hover:text-emerald-700";
  const descText = isDark ? "text-white/50" : "text-[#436850]";
  const lineCountText = isDark ? "text-white/30" : "text-[#436850]/60";
  const starterText = isDark ? "text-emerald-400/60" : "text-emerald-700/70";
  const tagText = isDark ? "text-white/30 bg-white/[0.03] border-white/[0.04]" : "text-[#436850]/60 bg-[#FBFADA]/60 border-[#ADBC9F]/30";
  const chevronText = isDark ? "text-emerald-400" : "text-emerald-600";

  return (
    <button
      onClick={onClick}
      className={`group relative flex flex-col ${cardBg} border rounded-xl overflow-hidden transition-all duration-300 text-left w-full`}
    >
      {/* Demo badge */}
      {isDemo && (
        <div className="absolute top-2 left-2 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-400 text-[10px] font-semibold">
          <Lock className="w-2.5 h-2.5" />
          Demo
        </div>
      )}

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
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              {SIDE_ICONS[opening.side]}
              <span className={`text-[10px] ${ecoText} font-mono uppercase tracking-wider`}>{opening.eco}</span>
            </div>
            <h3 className={`text-sm font-semibold ${nameText} leading-tight transition-colors truncate`}>
              {opening.name}
            </h3>
          </div>
        </div>

        <p className={`text-[11px] ${descText} leading-relaxed line-clamp-2`}>
          {opening.shortDescription}
        </p>

        <div className="flex items-center gap-2 mt-auto pt-1">
          <DifficultyBadge difficulty={opening.difficulty} />
          <span className={`text-[10px] ${lineCountText} font-mono`}>
            {opening.lineCount} lines
          </span>
          {opening.starterFriendly && (
            <span className={`text-[10px] ${starterText} flex items-center gap-0.5`}>
              <Sparkles className="w-3 h-3" />
              Starter
            </span>
          )}
        </div>

        {opening.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-0.5">
            {opening.tags
              .filter((t) => t.category === "theme" || t.category === "style")
              .slice(0, 3)
              .map((tag) => (
                <span
                  key={tag.slug}
                  className={`px-1.5 py-0.5 rounded text-[10px] ${tagText} border`}
                >
                  {tag.name}
                </span>
              ))}
          </div>
        )}
      </div>

      <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <ChevronRight className={`w-4 h-4 ${chevronText}`} />
      </div>
    </button>
  );
}

// ── Featured Hero Card ────────────────────────────────────────────────────────
function FeaturedCard({
  opening,
  onClick,
  isDark,
}: {
  opening: DemoOpeningCard;
  onClick: () => void;
  isDark: boolean;
}) {
  const cardBg = isDark
    ? "bg-gradient-to-r from-[#0f1f13] to-[#142a18] border-emerald-500/10 hover:border-emerald-500/30"
    : "bg-gradient-to-r from-[#F0F5E8] to-[#E8F0E0] border-emerald-600/15 hover:border-emerald-600/30";
  const ecoText = isDark ? "text-white/40" : "text-[#436850]/70";
  const nameText = isDark
    ? "text-white/95 group-hover:text-emerald-400"
    : "text-[#12372A] group-hover:text-emerald-700";
  const descText = isDark ? "text-white/50" : "text-[#436850]";
  const lineCountText = isDark ? "text-white/30" : "text-[#436850]/60";
  const chevronText = isDark ? "text-emerald-400" : "text-emerald-600";

  return (
    <button
      onClick={onClick}
      className={`group relative flex flex-row ${cardBg} border rounded-xl overflow-hidden transition-all duration-300 text-left w-full`}
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
          <span className={`text-[11px] ${ecoText} font-mono`}>{opening.eco}</span>
        </div>
        <h3 className={`text-lg font-bold ${nameText} transition-colors`}>
          {opening.name}
        </h3>
        <p className={`text-xs ${descText} leading-relaxed line-clamp-2`}>{opening.shortDescription}</p>
        <div className="flex items-center gap-3 mt-1">
          <DifficultyBadge difficulty={opening.difficulty} />
          <span className={`text-[11px] ${lineCountText} font-mono`}>{opening.lineCount} lines</span>
        </div>
      </div>
      <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
        <ChevronRight className={`w-5 h-5 ${chevronText}`} />
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
  isDark,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  isDark: boolean;
}) {
  const inactiveStyle = isDark
    ? "bg-white/[0.03] text-white/50 border-white/[0.06] hover:border-white/10 hover:text-white/70"
    : "bg-[#F0F5E8]/60 text-[#436850]/70 border-[#ADBC9F]/40 hover:border-[#436850]/40 hover:text-[#12372A]";
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200 ${
        active
          ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
          : inactiveStyle
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function OpeningsLibraryDemo() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [, navigate] = useLocation();
  const onExitDemo = () => navigate("/openings");

  const [search, setSearch] = useState("");
  const [sideFilter, setSideFilter] = useState<string | null>(null);
  const [difficultyFilter, setDifficultyFilter] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const filtered = useMemo(() => {
    let result = DEMO_OPENINGS;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (o) =>
          o.name.toLowerCase().includes(q) ||
          o.eco.toLowerCase().includes(q) ||
          o.shortDescription.toLowerCase().includes(q)
      );
    }
    if (sideFilter) result = result.filter((o) => o.side === sideFilter);
    if (difficultyFilter) result = result.filter((o) => o.difficulty === difficultyFilter);
    return result;
  }, [search, sideFilter, difficultyFilter]);

  const featured = useMemo(() => filtered.filter((o) => o.isFeatured), [filtered]);
  const whiteOpenings = useMemo(() => filtered.filter((o) => o.side === "white"), [filtered]);
  const blackOpenings = useMemo(() => filtered.filter((o) => o.side === "black"), [filtered]);

  const hasActiveFilters = sideFilter || difficultyFilter || search;

  const handleOpeningClick = (slug: string) => {
    navigate(`/openings/demo/${slug}`);
  };

  const clearFilters = () => {
    setSearch("");
    setSideFilter(null);
    setDifficultyFilter(null);
  };

  // Theme-aware header classes
  const navBg = isDark
    ? "border-white/[0.06] bg-[#0a1a0e]/80"
    : "border-[#ADBC9F]/40 bg-[#FBFADA]/95";
  const navTitleText = isDark ? "text-white/90" : "text-[#12372A]";
  const navSubText = isDark ? "text-white/40" : "text-[#436850]/70";
  const searchBg = isDark
    ? "bg-white/[0.04] border-white/[0.06] text-white/80 placeholder:text-white/25 focus:border-emerald-500/30 focus:bg-white/[0.06]"
    : "bg-[#F0F5E8]/60 border-[#ADBC9F]/40 text-[#12372A] placeholder:text-[#436850]/40 focus:border-emerald-600/40 focus:bg-[#F0F5E8]";
  const searchIconText = isDark ? "text-white/30" : "text-[#436850]/50";
  const searchClearHover = isDark ? "hover:bg-white/10" : "hover:bg-[#ADBC9F]/20";
  const searchClearText = isDark ? "text-white/40" : "text-[#436850]/50";
  const filterBtnActive = "bg-emerald-500/10 border-emerald-500/30 text-emerald-400";
  const filterBtnInactive = isDark
    ? "bg-white/[0.04] border-white/[0.06] text-white/40 hover:text-white/60"
    : "bg-[#F0F5E8]/60 border-[#ADBC9F]/40 text-[#436850]/60 hover:text-[#12372A]";
  const filterBarBorder = isDark ? "border-white/[0.04]" : "border-[#ADBC9F]/30";
  const filterLabelText = isDark ? "text-white/30" : "text-[#436850]/60";
  const emptyIconText = isDark ? "text-white/20" : "text-[#436850]/30";
  const emptyText = isDark ? "text-white/40" : "text-[#436850]/70";
  const sectionHeadText = isDark ? "text-white/70" : "text-[#12372A]";
  const sectionSubText = isDark ? "text-white/40" : "text-[#436850]/70";
  const repertoireHeadText = isDark ? "text-white/90" : "text-[#12372A]";
  const teaserBg = isDark
    ? "border-emerald-500/20 bg-emerald-500/[0.03]"
    : "border-emerald-600/20 bg-emerald-600/[0.03]";
  const teaserIconBg = isDark
    ? "bg-emerald-500/10 border-emerald-500/20"
    : "bg-emerald-600/10 border-emerald-600/20";
  const teaserHeadText = isDark ? "text-white/80" : "text-[#12372A]";
  const teaserBodyText = isDark ? "text-white/40" : "text-[#436850]";

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a1a0e]" : "bg-[#FBFADA]/70"}`}>
      {/* Demo banner */}
      <DemoModeBanner onExitDemo={onExitDemo} />

      {/* Header */}
      <div className={`border-b ${navBg} backdrop-blur-xl sticky top-[42px] z-30`}>
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <BookOpen className="w-5 h-5 text-emerald-400" />
              <div>
                <div className="flex items-center gap-2">
                  <h1 className={`text-lg font-bold ${navTitleText}`}>Openings Library</h1>
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/25 text-amber-400 text-[10px] font-bold uppercase tracking-wider">
                    Demo
                  </span>
                </div>
                <p className={`text-[11px] ${navSubText}`}>
                  {DEMO_OPENINGS.length} sample openings &middot; Showing a preview of the full library
                </p>
              </div>
            </div>

            {/* Search */}
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative flex-1">
                <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${searchIconText}`} />
                <input
                  type="text"
                  placeholder="Search demo openings..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className={`w-full pl-9 pr-3 py-2 rounded-lg ${searchBg} border text-sm focus:outline-none transition-all`}
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className={`absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full ${searchClearHover}`}
                  >
                    <X className={`w-3 h-3 ${searchClearText}`} />
                  </button>
                )}
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`p-2 rounded-lg border transition-all ${
                  showFilters || hasActiveFilters ? filterBtnActive : filterBtnInactive
                }`}
              >
                <Filter className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Filter bar */}
          {showFilters && (
            <div className={`mt-3 pt-3 border-t ${filterBarBorder} space-y-2`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-[10px] ${filterLabelText} uppercase tracking-wider font-medium w-12`}>Side</span>
                <FilterChip
                  label="White"
                  active={sideFilter === "white"}
                  onClick={() => setSideFilter(sideFilter === "white" ? null : "white")}
                  icon={<div className="w-2.5 h-2.5 rounded-full bg-white border border-white/30" />}
                  isDark={isDark}
                />
                <FilterChip
                  label="Black"
                  active={sideFilter === "black"}
                  onClick={() => setSideFilter(sideFilter === "black" ? null : "black")}
                  icon={<div className="w-2.5 h-2.5 rounded-full bg-[#12372A] border border-white/20" />}
                  isDark={isDark}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-[10px] ${filterLabelText} uppercase tracking-wider font-medium w-12`}>Level</span>
                {DIFFICULTY_ORDER.map((d) => (
                  <FilterChip
                    key={d}
                    label={d.charAt(0).toUpperCase() + d.slice(1)}
                    active={difficultyFilter === d}
                    onClick={() => setDifficultyFilter(difficultyFilter === d ? null : d)}
                    isDark={isDark}
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
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center space-y-2">
              <Search className={`w-8 h-8 ${emptyIconText} mx-auto`} />
              <p className={`text-sm ${emptyText}`}>No demo openings match your filters</p>
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
                  <h2 className={`text-sm font-semibold ${sectionHeadText} uppercase tracking-wider`}>Featured</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {featured.map((o) => (
                    <FeaturedCard key={o.id} opening={o} onClick={() => handleOpeningClick(o.slug)} isDark={isDark} />
                  ))}
                </div>
              </section>
            )}

            {/* White Repertoire */}
            {!sideFilter || sideFilter === "white" ? (
              whiteOpenings.length > 0 && (
                <section className="space-y-4">
                  <div>
                    <h2 className={`text-lg font-bold ${repertoireHeadText}`}>White Repertoire</h2>
                    <p className={`text-xs ${sectionSubText} mt-0.5`}>Systems and openings for the first move</p>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                    {whiteOpenings.map((o) => (
                      <OpeningCardComponent
                        key={o.id}
                        opening={o}
                        onClick={() => handleOpeningClick(o.slug)}
                        isDemo
                        isDark={isDark}
                      />
                    ))}
                  </div>
                </section>
              )
            ) : null}

            {/* Black Openings */}
            {!sideFilter || sideFilter === "black" ? (
              blackOpenings.length > 0 && (
                <section className="space-y-4">
                  <div>
                    <h2 className={`text-lg font-bold ${repertoireHeadText}`}>Black Repertoire</h2>
                    <p className={`text-xs ${sectionSubText} mt-0.5`}>Defenses and counterplay systems</p>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                    {blackOpenings.map((o) => (
                      <OpeningCardComponent
                        key={o.id}
                        opening={o}
                        onClick={() => handleOpeningClick(o.slug)}
                        isDemo
                        isDark={isDark}
                      />
                    ))}
                  </div>
                </section>
              )
            ) : null}

            {/* "More in Pro" teaser */}
            <section className={`rounded-2xl border border-dashed ${teaserBg} p-8 text-center space-y-3`}>
              <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl ${teaserIconBg} border mx-auto`}>
                <Lock className="w-6 h-6 text-emerald-400" />
              </div>
              <h3 className={`text-lg font-bold ${teaserHeadText}`}>
                16+ more openings in the full library
              </h3>
              <p className={`text-sm ${teaserBodyText} max-w-md mx-auto`}>
                The full Pro library includes complete repertoires for both sides, trap lines, study mode with spaced repetition, and coach insights.
              </p>
              <div className="flex items-center justify-center gap-3 pt-2">
                <a
                  href="/pricing"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-all"
                >
                  <Sparkles className="w-4 h-4" />
                  See Pricing
                </a>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
