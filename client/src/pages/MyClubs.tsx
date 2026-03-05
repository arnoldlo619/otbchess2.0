/**
 * MyClubs page — /clubs
 *
 * For signed-in users:
 *   - "My Clubs" section: clubs the user has joined
 *   - "Discover" section: all public clubs the user hasn't joined yet
 *   - "Create a Club" CTA
 *
 * For guests:
 *   - Full discovery grid with a sign-in prompt
 */
import { useState, useEffect, useMemo } from "react";
import { useLocation, Link } from "wouter";
import { NavLogo } from "@/components/NavLogo";
import { useAuthContext } from "@/context/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import {
  listAllClubs,
  listMyClubs,
  seedClubsIfEmpty,
  type Club,
  type ClubCategory,
} from "@/lib/clubRegistry";
import {
  Users,
  Trophy,
  MapPin,
  Search,
  Plus,
  ChevronLeft,
  Crown,
  Zap,
  Globe,
  BookOpen,
  GraduationCap,
  Building2,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import { CreateClubWizard } from "@/components/CreateClubWizard";

// ── Helpers ───────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<ClubCategory, string> = {
  club: "Chess Club",
  school: "School",
  university: "University",
  online: "Online",
  community: "Community",
  professional: "Academy",
};

const CATEGORY_ICONS: Record<ClubCategory, React.ReactNode> = {
  club: <Crown className="w-3.5 h-3.5" />,
  school: <BookOpen className="w-3.5 h-3.5" />,
  university: <GraduationCap className="w-3.5 h-3.5" />,
  online: <Globe className="w-3.5 h-3.5" />,
  community: <Users className="w-3.5 h-3.5" />,
  professional: <Building2 className="w-3.5 h-3.5" />,
};

const COUNTRY_FLAGS: Record<string, string> = {
  GB: "🇬🇧", US: "🇺🇸", DE: "🇩🇪", JP: "🇯🇵", IN: "🇮🇳", FR: "🇫🇷",
  ES: "🇪🇸", IT: "🇮🇹", CA: "🇨🇦", AU: "🇦🇺", BR: "🇧🇷", RU: "🇷🇺",
};

const ALL_CATEGORIES: Array<ClubCategory | "all"> = [
  "all", "club", "community", "university", "school", "professional", "online",
];

// ── Club card ─────────────────────────────────────────────────────────────────

function ClubCard({
  club,
  isDark,
  compact = false,
}: {
  club: Club;
  isDark: boolean;
  compact?: boolean;
}) {
  const flag = COUNTRY_FLAGS[club.country] ?? "🌍";
  const card = isDark ? "bg-[#1a2e1d]" : "bg-white";
  const cardBorder = isDark ? "border-white/8" : "border-gray-100";
  const textMain = isDark ? "text-white" : "text-gray-900";
  const textMuted = isDark ? "text-white/50" : "text-gray-400";

  return (
    <Link href={`/clubs/${club.id}`}>
      <div
        className={`group rounded-3xl border ${cardBorder} ${card} overflow-hidden transition-all duration-200 hover:shadow-xl hover:-translate-y-1 cursor-pointer`}
      >
        {/* Banner — full-width, tall enough to show custom images properly */}
        <div
          className="h-36 relative overflow-hidden"
          style={{
            background: club.bannerUrl
              ? undefined
              : `linear-gradient(135deg, ${club.accentColor}dd 0%, ${club.accentColor}55 100%)`,
          }}
        >
          {club.bannerUrl ? (
            <img
              src={club.bannerUrl}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 chess-board-bg opacity-15" />
          )}
          {/* Dark scrim for text legibility */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
        </div>

        {/* Avatar — overlaps banner bottom edge */}
        <div className="px-5">
          <div
            className="-mt-8 w-16 h-16 rounded-2xl flex items-center justify-center text-2xl shadow-lg border-2 border-white/20 overflow-hidden"
            style={{ background: `linear-gradient(135deg, ${club.accentColor} 0%, ${club.accentColor}88 100%)` }}
          >
            {club.avatarUrl ? (
              <img src={club.avatarUrl} alt={club.name} className="w-full h-full object-cover" />
            ) : (
              <span>{flag}</span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="px-5 pt-3 pb-5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3
                className={`text-lg font-bold leading-tight truncate ${textMain}`}
                style={{ fontFamily: "'Clash Display', sans-serif" }}
              >
                {club.name}
              </h3>
              <div className={`flex items-center gap-1.5 mt-0.5 text-xs ${textMuted}`}>
                <MapPin className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{club.location}</span>
              </div>
            </div>
            <span
              className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold mt-0.5 ${
                isDark ? "bg-white/8 text-white/50" : "bg-gray-100 text-gray-500"
              }`}
            >
              {CATEGORY_ICONS[club.category]}
              {CATEGORY_LABELS[club.category]}
            </span>
          </div>

          <p className={`text-sm mt-2.5 leading-relaxed line-clamp-2 ${textMuted}`}>
            {club.tagline}
          </p>

          {/* Stats */}
          <div className={`flex items-center gap-5 mt-4 pt-3.5 border-t ${isDark ? "border-white/6" : "border-gray-100"}`}>
            <span className={`flex items-center gap-1.5 text-xs font-semibold ${textMuted}`}>
              <Users className="w-3.5 h-3.5" />
              {club.memberCount.toLocaleString()}
            </span>
            <span className={`flex items-center gap-1.5 text-xs font-semibold ${textMuted}`}>
              <Trophy className="w-3.5 h-3.5" />
              {club.tournamentCount}
            </span>
            {club.announcement && (
              <span className={`flex items-center gap-1 text-[10px] font-bold ml-auto ${
                isDark ? "text-amber-400" : "text-amber-600"
              }`}>
                <Zap className="w-3 h-3" />
                Active
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MyClubs() {
  const [, navigate] = useLocation();
  const { user } = useAuthContext();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [allClubs, setAllClubs] = useState<Club[]>([]);
  const [myClubs, setMyClubs] = useState<Club[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<ClubCategory | "all">("all");
  const [showFilters, setShowFilters] = useState(false);
  const [showWizard, setShowWizard] = useState(false);

  useEffect(() => {
    seedClubsIfEmpty();
    const all = listAllClubs();
    setAllClubs(all);
    if (user) setMyClubs(listMyClubs(user.id));
  }, [user, showWizard]); // re-fetch after wizard closes

  const myClubIds = useMemo(() => new Set(myClubs.map((c) => c.id)), [myClubs]);

  const discoverClubs = useMemo(() => {
    return allClubs.filter((c) => {
      if (myClubIds.has(c.id)) return false;
      if (categoryFilter !== "all" && c.category !== categoryFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          c.location.toLowerCase().includes(q) ||
          c.tagline.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [allClubs, myClubIds, search, categoryFilter]);

  // ── Colour palette ──────────────────────────────────────────────────────────
  const bg = isDark ? "bg-[#0d1a0f]" : "bg-[#F0F5EE]";
  const card = isDark ? "bg-[#1a2e1d]" : "bg-white";
  const cardBorder = isDark ? "border-white/8" : "border-gray-100";
  const textMain = isDark ? "text-white" : "text-gray-900";
  const textMuted = isDark ? "text-white/50" : "text-gray-400";
  const inputBg = isDark ? "bg-white/6 border-white/10 text-white placeholder:text-white/30" : "bg-white border-gray-200 text-gray-900 placeholder:text-gray-400";
  const divider = isDark ? "border-white/8" : "border-gray-100";

  return (
    <div className={`min-h-screen ${bg}`}>

      {/* ── Sticky header ──────────────────────────────────────────────────── */}
      <header className={`sticky top-0 z-30 border-b ${divider} ${isDark ? "bg-[#0d1a0f]/90" : "bg-white/90"} backdrop-blur-md`}>
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
          <button
            onClick={() => navigate("/profile")}
            className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${isDark ? "text-white/60 hover:text-white" : "text-gray-400 hover:text-gray-900"}`}
          >
            <ChevronLeft className="w-4 h-4" />
            Profile
          </button>
          <div className={`w-px h-4 ${isDark ? "bg-white/15" : "bg-gray-200"}`} />
          <NavLogo className="h-7" />
          <div className="ml-auto">
            <button
              onClick={() => user ? setShowWizard(true) : navigate("/")}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold bg-[#3D6B47] text-white hover:bg-[#2d5236] transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Create Club</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-8">

        {/* ── Page title ───────────────────────────────────────────────────── */}
        <div>
          <h1
            className={`text-2xl sm:text-3xl font-bold ${textMain}`}
            style={{ fontFamily: "'Clash Display', sans-serif" }}
          >
            {user ? "My Clubs" : "Discover Clubs"}
          </h1>
          <p className={`text-sm mt-1 ${textMuted}`}>
            {user
              ? "Your chess communities and clubs you follow"
              : "Find and join chess clubs from around the world"}
          </p>
        </div>

        {/* ── Guest sign-in prompt ─────────────────────────────────────────── */}
        {!user && (
          <div className={`rounded-3xl border ${cardBorder} ${card} p-5 flex items-center gap-4`}>
            <div className="w-12 h-12 rounded-2xl bg-[#3D6B47]/15 flex items-center justify-center flex-shrink-0">
              <Crown className="w-6 h-6 text-[#4CAF50]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${textMain}`}>Sign in to join clubs</p>
              <p className={`text-xs mt-0.5 ${textMuted}`}>Track your clubs, get tournament updates, and connect with your community.</p>
            </div>
            <button
              onClick={() => navigate("/")}
              className="flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold bg-[#3D6B47] text-white hover:bg-[#2d5236] transition-colors"
            >
              Sign In
            </button>
          </div>
        )}

        {/* ── My Clubs section (signed-in only) ───────────────────────────── */}
        {user && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className={`text-sm font-semibold uppercase tracking-wider ${textMuted}`}>
                Joined Clubs
              </h2>
              <span className={`text-xs font-medium ${textMuted}`}>{myClubs.length}</span>
            </div>

            {myClubs.length === 0 ? (
              <div className={`rounded-3xl border ${cardBorder} ${card} py-12 text-center`}>
                <Users className={`w-10 h-10 mx-auto mb-3 ${textMuted}`} />
                <p className={`text-sm font-semibold ${textMain}`}>No clubs yet</p>
                <p className={`text-xs mt-1 ${textMuted}`}>Browse the clubs below and join your community</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {myClubs.map((club) => (
                  <ClubCard key={club.id} club={club} isDark={isDark} />
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── Discover section ─────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className={`text-sm font-semibold uppercase tracking-wider ${textMuted}`}>
              {user ? "Discover" : "All Clubs"}
            </h2>
            <button
              onClick={() => setShowFilters((v) => !v)}
              className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl transition-colors ${
                showFilters
                  ? isDark ? "bg-[#4CAF50]/15 text-[#4CAF50]" : "bg-[#3D6B47]/10 text-[#3D6B47]"
                  : isDark ? "text-white/50 hover:text-white bg-white/5" : "text-gray-400 hover:text-gray-700 bg-gray-100"
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              Filter
            </button>
          </div>

          {/* Search bar */}
          <div className="relative mb-3">
            <Search className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${textMuted}`} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search clubs by name or location…"
              className={`w-full pl-10 pr-4 py-3 rounded-2xl border text-sm outline-none transition-colors focus:border-[#4CAF50] ${inputBg}`}
            />
          </div>

          {/* Category filter pills */}
          {showFilters && (
            <div className="flex gap-2 flex-wrap mb-4">
              {ALL_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    categoryFilter === cat
                      ? isDark ? "bg-[#4CAF50]/15 text-[#4CAF50]" : "bg-[#3D6B47]/10 text-[#3D6B47]"
                      : isDark ? "bg-white/6 text-white/50 hover:text-white" : "bg-gray-100 text-gray-500 hover:text-gray-800"
                  }`}
                >
                  {cat !== "all" && CATEGORY_ICONS[cat]}
                  {cat === "all" ? "All" : CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>
          )}

          {/* Results grid */}
          {discoverClubs.length === 0 ? (
            <div className={`rounded-3xl border ${cardBorder} ${card} py-12 text-center`}>
              <Search className={`w-10 h-10 mx-auto mb-3 ${textMuted}`} />
              <p className={`text-sm font-semibold ${textMain}`}>No clubs found</p>
              <p className={`text-xs mt-1 ${textMuted}`}>Try a different search or filter</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {discoverClubs.map((club) => (
                <ClubCard key={club.id} club={club} isDark={isDark} />
              ))}
            </div>
          )}
        </section>

        {/* ── Create club CTA ──────────────────────────────────────────────── */}
        <section>
          <div
            className="rounded-3xl border border-dashed p-8 text-center cursor-pointer transition-all hover:border-[#4CAF50]/50 group"
            style={{ borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)" }}
            onClick={() => user ? setShowWizard(true) : navigate("/")}
          >
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 transition-colors ${
              isDark ? "bg-white/5 group-hover:bg-[#4CAF50]/10" : "bg-gray-50 group-hover:bg-[#3D6B47]/8"
            }`}>
              <Plus className={`w-7 h-7 transition-colors ${isDark ? "text-white/30 group-hover:text-[#4CAF50]" : "text-gray-300 group-hover:text-[#3D6B47]"}`} />
            </div>
            <h3
              className={`text-base font-bold mb-1 transition-colors ${isDark ? "text-white/60 group-hover:text-white" : "text-gray-400 group-hover:text-gray-900"}`}
              style={{ fontFamily: "'Clash Display', sans-serif" }}
            >
              Start a New Club
            </h3>
            <p className={`text-xs ${textMuted}`}>
              Create a club for your chess community, school team, or local group
            </p>
          </div>
        </section>

      </div>

      {/* Create Club Wizard */}
      {showWizard && (
        <CreateClubWizard onClose={() => setShowWizard(false)} />
      )}
    </div>
  );
}
