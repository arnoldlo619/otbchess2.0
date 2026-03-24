/**
 * ClubLeaderboard.tsx
 *
 * Dedicated page at /clubs/leaderboard that ranks all public clubs
 * across two metrics:
 *   - Members     (memberCount DESC)
 *   - Tournaments (tournamentCount DESC)
 *
 * Layout:
 *   1. Sticky header with back-link to /clubs
 *   2. Metric tab switcher (Members | Tournaments)
 *   3. Podium section — top 3 clubs with large visual cards
 *   4. Ranked table — clubs 4-50 with position, name, score, category badge
 *   5. Loading skeleton & empty state
 *
 * Visual style matches FeaturedClubsCarousel:
 *   - Per-category full-bleed gradient backgrounds
 *   - Glassmorphism footer strip
 *   - Rank medal badges (🥇🥈🥉)
 *   - Avatar ring
 *   - Noise texture + diagonal shine on hover
 */

import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  Users,
  Trophy,
  TrendingUp,
  ChevronRight,
  ArrowRight,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type SortMetric = "members" | "tournaments";

interface LeaderboardClub {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  location: string;
  country: string;
  category: string;
  avatarUrl: string | null;
  accentColor: string;
  memberCount: number;
  tournamentCount: number;
  followerCount?: number;
  foundedAt: string;
  rank: number;
  score: number;
}

// ── Shared design tokens (mirrors FeaturedClubsCarousel) ──────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  competitive: "Competitive",
  casual: "Casual",
  scholastic: "Scholastic",
  online: "Online",
  otb: "OTB",
  blitz: "Blitz",
  correspondence: "Correspondence",
  club: "Club",
  school: "School",
  university: "University",
  community: "Community",
  professional: "Professional",
  other: "Other",
};

const CATEGORY_THEME: Record<
  string,
  { grad: string; glow: string; badge: string }
> = {
  competitive: {
    grad: "from-red-950 via-rose-900 to-red-800",
    glow: "group-hover:shadow-red-900/50",
    badge: "bg-red-500/20 text-red-300 border-red-500/30",
  },
  casual: {
    grad: "from-blue-950 via-blue-900 to-indigo-800",
    glow: "group-hover:shadow-blue-900/50",
    badge: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  },
  scholastic: {
    grad: "from-yellow-950 via-amber-900 to-yellow-800",
    glow: "group-hover:shadow-amber-900/50",
    badge: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  },
  online: {
    grad: "from-purple-950 via-violet-900 to-purple-800",
    glow: "group-hover:shadow-purple-900/50",
    badge: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  },
  otb: {
    grad: "from-emerald-950 via-green-900 to-emerald-800",
    glow: "group-hover:shadow-emerald-900/50",
    badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  },
  blitz: {
    grad: "from-orange-950 via-orange-900 to-amber-800",
    glow: "group-hover:shadow-orange-900/50",
    badge: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  },
  correspondence: {
    grad: "from-cyan-950 via-teal-900 to-cyan-800",
    glow: "group-hover:shadow-cyan-900/50",
    badge: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  },
  club: {
    grad: "from-green-950 via-green-900 to-green-800",
    glow: "group-hover:shadow-green-900/50",
    badge: "bg-green-500/20 text-green-300 border-green-500/30",
  },
  school: {
    grad: "from-yellow-950 via-amber-900 to-yellow-800",
    glow: "group-hover:shadow-amber-900/50",
    badge: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  },
  university: {
    grad: "from-indigo-950 via-indigo-900 to-blue-800",
    glow: "group-hover:shadow-indigo-900/50",
    badge: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
  },
  community: {
    grad: "from-teal-950 via-teal-900 to-cyan-800",
    glow: "group-hover:shadow-teal-900/50",
    badge: "bg-teal-500/20 text-teal-300 border-teal-500/30",
  },
  professional: {
    grad: "from-rose-950 via-rose-900 to-pink-800",
    glow: "group-hover:shadow-rose-900/50",
    badge: "bg-rose-500/20 text-rose-300 border-rose-500/30",
  },
  other: {
    grad: "from-slate-900 via-slate-800 to-slate-700",
    glow: "group-hover:shadow-slate-800/50",
    badge: "bg-slate-500/20 text-slate-300 border-slate-500/30",
  },
};

const FALLBACK_GRADS = [
  "from-emerald-950 via-green-900 to-emerald-800",
  "from-blue-950 via-blue-900 to-indigo-800",
  "from-purple-950 via-violet-900 to-purple-800",
  "from-amber-950 via-yellow-900 to-amber-800",
  "from-rose-950 via-pink-900 to-rose-800",
  "from-cyan-950 via-teal-900 to-cyan-800",
];

function clubTheme(club: LeaderboardClub) {
  const cat = club.category ?? "other";
  if (CATEGORY_THEME[cat]) return CATEGORY_THEME[cat];
  const idx = club.id.charCodeAt(club.id.length - 1) % FALLBACK_GRADS.length;
  return {
    grad: FALLBACK_GRADS[idx],
    glow: "group-hover:shadow-green-900/50",
    badge: CATEGORY_THEME.other.badge,
  };
}

const RANK_MEDALS: Record<number, { emoji: string; cls: string; border: string }> = {
  1: {
    emoji: "🥇",
    cls: "bg-yellow-500/25 border-yellow-400/40 text-yellow-200",
    border: "border-yellow-500/40 shadow-yellow-900/30",
  },
  2: {
    emoji: "🥈",
    cls: "bg-slate-400/20 border-slate-300/40 text-slate-200",
    border: "border-slate-400/30 shadow-slate-900/20",
  },
  3: {
    emoji: "🥉",
    cls: "bg-amber-700/25 border-amber-600/40 text-amber-300",
    border: "border-amber-700/30 shadow-amber-900/20",
  },
};

// Noise texture data URI (same as carousel)
const NOISE_BG =
  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

function metricLabel(metric: SortMetric, club: LeaderboardClub): string {
  if (metric === "tournaments") return `${club.tournamentCount} tournaments`;
  return `${club.memberCount.toLocaleString()} members`;
}

function metricValue(metric: SortMetric, club: LeaderboardClub): number {
  if (metric === "tournaments") return club.tournamentCount;
  return club.memberCount;
}

// ── API call ──────────────────────────────────────────────────────────────────

async function fetchLeaderboard(
  sortBy: SortMetric
): Promise<{ clubs: LeaderboardClub[]; total: number }> {
  const res = await fetch(`/api/clubs/leaderboard?sortBy=${sortBy}`);
  if (!res.ok) throw new Error("Failed to load leaderboard");
  return res.json();
}

// ── Skeleton components ───────────────────────────────────────────────────────

function PodiumSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-56 rounded-2xl bg-white/5 border border-white/10 animate-pulse"
        />
      ))}
    </div>
  );
}

function TableRowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-4 py-3.5 border-b border-white/5 animate-pulse">
      <div className="w-8 h-4 bg-white/10 rounded" />
      <div className="w-10 h-10 bg-white/10 rounded-xl flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3 bg-white/10 rounded w-1/3" />
        <div className="h-2 bg-white/5 rounded w-1/4" />
      </div>
      <div className="w-16 h-4 bg-white/10 rounded" />
    </div>
  );
}

// ── Podium card (top 3) ───────────────────────────────────────────────────────

interface PodiumCardProps {
  club: LeaderboardClub;
  metric: SortMetric;
}

function PodiumCard({ club, metric }: PodiumCardProps) {
  const [, navigate] = useLocation();
  const { grad, glow, badge } = clubTheme(club);
  const catLabel = CATEGORY_LABELS[club.category ?? "other"] ?? "Other";
  const medal = RANK_MEDALS[club.rank];
  const initial = club.name.charAt(0).toUpperCase();

  // Stagger podium heights: #1 tallest, #2 medium, #3 shortest
  const podiumOffset =
    club.rank === 1 ? "sm:mt-0" : club.rank === 2 ? "sm:mt-6" : "sm:mt-10";

  return (
    <div
      className={`${podiumOffset} flex flex-col cursor-pointer group`}
      onClick={() => navigate(`/clubs/${club.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && navigate(`/clubs/${club.id}`)}
      aria-label={`View ${club.name}`}
    >
      {/* Card */}
      <div
        className={`
          flex-1 rounded-2xl overflow-hidden relative
          bg-gradient-to-br ${grad}
          border ${medal ? medal.border : "border-white/10"}
          shadow-lg ${glow}
          transition-all duration-300
          group-hover:scale-[1.02] group-hover:shadow-xl group-hover:border-white/20
          active:scale-[0.98]
        `}
      >
        {/* Noise texture */}
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{ backgroundImage: NOISE_BG, backgroundSize: "150px" }}
        />

        {/* Diagonal shine on hover */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none bg-gradient-to-br from-white/8 via-transparent to-transparent" />

        {/* Rank medal — top-left */}
        {medal && (
          <div
            className={`absolute top-3 left-3 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold backdrop-blur-sm ${medal.cls}`}
          >
            <span>{medal.emoji}</span>
            <span>#{club.rank}</span>
          </div>
        )}

        {/* Card body */}
        <div className="relative z-10 p-4 sm:p-5 flex flex-col min-h-[200px] sm:min-h-[220px]">
          {/* Avatar + name */}
          <div className="flex items-center gap-3 mt-7 mb-2.5">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex-shrink-0 ring-2 ring-white/20 overflow-hidden bg-white/10 flex items-center justify-center">
              {club.avatarUrl ? (
                <img
                  src={club.avatarUrl}
                  alt={club.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-white font-bold text-lg leading-none">
                  {initial}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-white font-bold text-sm sm:text-base leading-tight truncate drop-shadow-sm">
                {club.name}
              </h3>
              {club.location && (
                <p className="text-white/50 text-[11px] mt-0.5 truncate">
                  {club.location}
                </p>
              )}
            </div>
          </div>

          {/* Tagline */}
          <p className="text-white/55 text-xs leading-relaxed line-clamp-2 flex-1 mb-3">
            {club.tagline || "A chess club community."}
          </p>

          {/* Glassmorphism footer strip */}
          <div className="flex items-center justify-between rounded-xl bg-black/25 backdrop-blur-sm border border-white/10 px-3 py-2">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-white/70 text-xs font-medium">
                <Users className="w-3 h-3 text-white/50" />
                {club.memberCount.toLocaleString()}
              </span>
              {club.tournamentCount > 0 && (
                <span className="flex items-center gap-1 text-white/70 text-xs font-medium">
                  <Trophy className="w-3 h-3 text-white/50" />
                  {club.tournamentCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badge}`}
              >
                {catLabel}
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-white/30 group-hover:text-white/70 group-hover:translate-x-0.5 transition-all duration-200" />
            </div>
          </div>
        </div>
      </div>

      {/* Score label below card */}
      <div className="flex items-center justify-center mt-2">
        <span
          className={`text-xs font-semibold ${
            club.rank === 1
              ? "text-yellow-400"
              : club.rank === 2
              ? "text-slate-300"
              : "text-amber-500"
          }`}
        >
          {metricLabel(metric, club)}
        </span>
      </div>
    </div>
  );
}

// ── Table row (rank 4+) ───────────────────────────────────────────────────────

interface TableRowProps {
  club: LeaderboardClub;
  metric: SortMetric;
}

function TableRow({ club, metric }: TableRowProps) {
  const [, navigate] = useLocation();
  const { grad, badge } = clubTheme(club);
  const catLabel = CATEGORY_LABELS[club.category ?? "other"] ?? "Other";
  const value = metricValue(metric, club);
  const initial = club.name.charAt(0).toUpperCase();

  return (
    <div
      className="flex items-center gap-3 sm:gap-4 px-4 py-3 border-b border-white/5 hover:bg-white/[0.04] cursor-pointer transition-colors duration-150 group"
      onClick={() => navigate(`/clubs/${club.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && navigate(`/clubs/${club.id}`)}
    >
      {/* Rank number */}
      <span className="w-7 text-center text-white/35 text-sm font-mono flex-shrink-0">
        {club.rank}
      </span>

      {/* Avatar — mini gradient swatch */}
      <div
        className={`w-10 h-10 rounded-xl flex-shrink-0 bg-gradient-to-br ${grad} ring-1 ring-white/15 overflow-hidden flex items-center justify-center`}
      >
        {club.avatarUrl ? (
          <img
            src={club.avatarUrl}
            alt={club.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-white font-bold text-sm leading-none">
            {initial}
          </span>
        )}
      </div>

      {/* Name + location */}
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-semibold truncate group-hover:text-green-300 transition-colors duration-150">
          {club.name}
        </p>
        {club.location && (
          <p className="text-white/40 text-xs truncate">{club.location}</p>
        )}
      </div>

      {/* Category badge */}
      <span
        className={`hidden sm:inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0 ${badge}`}
      >
        {catLabel}
      </span>

      {/* Score */}
      <span className="text-white/70 text-sm font-bold flex-shrink-0 min-w-[3.5rem] text-right tabular-nums">
        {value.toLocaleString()}
      </span>

      {/* Arrow */}
      <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/60 group-hover:translate-x-0.5 transition-all duration-150 flex-shrink-0" />
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ClubLeaderboard() {
  const [, navigate] = useLocation();
  const [metric, setMetric] = useState<SortMetric>("members");
  const [clubs, setClubs] = useState<LeaderboardClub[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchLeaderboard(metric)
      .then(({ clubs: data, total: t }) => {
        if (!cancelled) {
          setClubs(data);
          setTotal(t);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message ?? "Failed to load leaderboard");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [metric]);

  const podium = clubs.slice(0, 3);
  const rest = clubs.slice(3);

  const METRIC_TABS: { id: SortMetric; label: string; icon: React.ReactNode }[] =
    [
      {
        id: "members",
        label: "Members",
        icon: <Users className="w-3.5 h-3.5" />,
      },
      {
        id: "tournaments",
        label: "Tournaments",
        icon: <Trophy className="w-3.5 h-3.5" />,
      },
    ];

  return (
    <div className="min-h-screen bg-[#0d1a0f] text-white">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-[#0d1a0f]/95 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate("/clubs")}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-colors"
            aria-label="Back to clubs"
          >
            <ArrowLeft className="w-4 h-4 text-white/60" />
          </button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <TrendingUp className="w-5 h-5 text-green-400 flex-shrink-0" />
            <h1 className="font-['Anton'] text-xl tracking-wide text-white truncate">
              CLUB LEADERBOARD
            </h1>
          </div>
          {!loading && (
            <span className="text-white/40 text-xs flex-shrink-0">
              {total} clubs
            </span>
          )}
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Metric tab switcher */}
        <div className="flex items-center gap-2 mb-6 bg-white/5 rounded-xl p-1 w-fit">
          {METRIC_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setMetric(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                metric === tab.id
                  ? "bg-green-500 text-black shadow-lg shadow-green-900/30"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Error state */}
        {error && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-red-300 text-sm mb-6">
            {error}
          </div>
        )}

        {/* Podium — top 3 */}
        <div className="mb-2">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-base leading-none">🏆</span>
            <h2 className="text-white/70 text-xs font-semibold uppercase tracking-widest">
              Top 3
            </h2>
          </div>

          {loading ? (
            <PodiumSkeleton />
          ) : podium.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              {podium.map((club) => (
                <PodiumCard key={club.id} club={club} metric={metric} />
              ))}
            </div>
          ) : null}
        </div>

        {/* Ranked table — clubs 4+ */}
        {(loading || rest.length > 0) && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
            {/* Table header */}
            <div className="flex items-center gap-3 sm:gap-4 px-4 py-2.5 border-b border-white/10 bg-white/5">
              <span className="w-7 text-center text-white/30 text-xs font-semibold uppercase tracking-wider">
                #
              </span>
              <span className="w-10 flex-shrink-0" />
              <span className="flex-1 text-white/30 text-xs font-semibold uppercase tracking-wider">
                Club
              </span>
              <span className="hidden sm:block text-white/30 text-xs font-semibold uppercase tracking-wider">
                Category
              </span>
              <span className="text-white/30 text-xs font-semibold uppercase tracking-wider min-w-[3.5rem] text-right">
                {metric === "members" ? "Members" : "Tournaments"}
              </span>
              <span className="w-4" />
            </div>

            {/* Rows */}
            {loading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <TableRowSkeleton key={i} />
                ))
              : rest.map((club) => (
                  <TableRow key={club.id} club={club} metric={metric} />
                ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && clubs.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Trophy className="w-12 h-12 text-white/20 mb-4" />
            <p className="text-white/50 text-sm">No clubs found.</p>
            <button
              onClick={() => navigate("/clubs")}
              className="mt-4 px-4 py-2 rounded-lg bg-green-500/20 text-green-400 text-sm hover:bg-green-500/30 transition-colors"
            >
              Discover Clubs
            </button>
          </div>
        )}

        {/* Footer note */}
        {!loading && clubs.length > 0 && (
          <p className="text-center text-white/20 text-xs mt-6">
            Rankings update in real time as clubs grow.
          </p>
        )}
      </div>
    </div>
  );
}
