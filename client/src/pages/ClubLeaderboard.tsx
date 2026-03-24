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
 */

import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  Users,
  Trophy,
  Medal,
  Crown,
  TrendingUp,
  ChevronRight,
  Star,
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

// ── Helpers ───────────────────────────────────────────────────────────────────

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

const CATEGORY_COLORS: Record<string, string> = {
  competitive: "bg-red-500/20 text-red-300 border-red-500/30",
  casual: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  scholastic: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  online: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  otb: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  blitz: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  correspondence: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  club: "bg-green-500/20 text-green-300 border-green-500/30",
  school: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  university: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
  community: "bg-teal-500/20 text-teal-300 border-teal-500/30",
  professional: "bg-rose-500/20 text-rose-300 border-rose-500/30",
  other: "bg-slate-500/20 text-slate-300 border-slate-500/30",
};

// Deterministic gradient from club id (same algorithm as FeaturedClubsCarousel)
function clubGradient(club: LeaderboardClub): string {
  const accents = [
    "from-emerald-900/80 to-green-800/60",
    "from-blue-900/80 to-indigo-800/60",
    "from-purple-900/80 to-violet-800/60",
    "from-amber-900/80 to-yellow-800/60",
    "from-rose-900/80 to-pink-800/60",
    "from-cyan-900/80 to-teal-800/60",
  ];
  const idx = club.id.charCodeAt(club.id.length - 1) % accents.length;
  return accents[idx];
}

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
          className="h-52 rounded-2xl bg-white/5 border border-white/10 animate-pulse"
        />
      ))}
    </div>
  );
}

function TableRowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b border-white/5 animate-pulse">
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
  const gradient = clubGradient(club);
  const catLabel = CATEGORY_LABELS[club.category ?? "other"] ?? "Other";
  const catColor =
    CATEGORY_COLORS[club.category ?? "other"] ?? CATEGORY_COLORS.other;

  const podiumOffset =
    club.rank === 1 ? "sm:mt-0" : club.rank === 2 ? "sm:mt-6" : "sm:mt-10";

  const medalIcon =
    club.rank === 1 ? (
      <Crown className="w-5 h-5 text-yellow-400" />
    ) : club.rank === 2 ? (
      <Medal className="w-5 h-5 text-slate-300" />
    ) : (
      <Medal className="w-5 h-5 text-amber-600" />
    );

  const rankColor =
    club.rank === 1
      ? "text-yellow-400"
      : club.rank === 2
      ? "text-slate-300"
      : "text-amber-600";

  const borderColor =
    club.rank === 1
      ? "border-yellow-500/40 shadow-lg shadow-yellow-900/20"
      : club.rank === 2
      ? "border-slate-400/30"
      : "border-amber-700/30";

  return (
    <div
      className={`${podiumOffset} flex flex-col cursor-pointer group`}
      onClick={() => navigate(`/clubs/${club.id}`)}
    >
      {/* Rank indicator above card */}
      <div className="flex items-center justify-center gap-1.5 mb-2">
        <span className={`${rankColor} flex items-center gap-1`}>
          {medalIcon}
          <span className="font-bold text-sm">#{club.rank}</span>
        </span>
      </div>

      {/* Card */}
      <div
        className={`flex-1 rounded-2xl border bg-gradient-to-br ${gradient} overflow-hidden transition-all duration-300 group-hover:scale-[1.02] group-hover:shadow-xl group-hover:shadow-green-900/30 ${borderColor}`}
      >
        <div className="p-5 flex flex-col h-full min-h-[180px]">
          {/* Avatar + name */}
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-xl flex-shrink-0">
              {club.avatarUrl ? (
                <img
                  src={club.avatarUrl}
                  alt={club.name}
                  className="w-full h-full rounded-xl object-cover"
                />
              ) : (
                <span>{club.name.charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-white font-bold text-sm leading-tight truncate">
                {club.name}
              </h3>
              {club.location && (
                <p className="text-white/50 text-xs mt-0.5 truncate">
                  {club.location}
                </p>
              )}
            </div>
          </div>

          {/* Tagline */}
          <p className="text-white/60 text-xs leading-relaxed line-clamp-2 flex-1 mb-3">
            {club.tagline || "A chess club community."}
          </p>

          {/* Stats */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-white/70 text-xs font-medium">
                <Users className="w-3 h-3" />
                {club.memberCount.toLocaleString()}
              </span>
              {club.tournamentCount > 0 && (
                <span className="flex items-center gap-1 text-white/60 text-xs">
                  <Trophy className="w-3 h-3" />
                  {club.tournamentCount}
                </span>
              )}
            </div>
            <span
              className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${catColor}`}
            >
              {catLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Score badge below card */}
      <div className="flex items-center justify-center mt-2">
        <span className={`text-xs font-semibold ${rankColor}`}>
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
  const catLabel = CATEGORY_LABELS[club.category ?? "other"] ?? "Other";
  const catColor =
    CATEGORY_COLORS[club.category ?? "other"] ?? CATEGORY_COLORS.other;
  const value = metricValue(metric, club);

  return (
    <div
      className="flex items-center gap-4 px-4 py-3 border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors duration-150 group"
      onClick={() => navigate(`/clubs/${club.id}`)}
    >
      {/* Rank */}
      <span className="w-8 text-center text-white/40 text-sm font-mono flex-shrink-0">
        {club.rank}
      </span>

      {/* Avatar */}
      <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center text-base flex-shrink-0">
        {club.avatarUrl ? (
          <img
            src={club.avatarUrl}
            alt={club.name}
            className="w-full h-full rounded-xl object-cover"
          />
        ) : (
          <span>{club.name.charAt(0).toUpperCase()}</span>
        )}
      </div>

      {/* Name + location */}
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-medium truncate group-hover:text-green-400 transition-colors">
          {club.name}
        </p>
        {club.location && (
          <p className="text-white/40 text-xs truncate">{club.location}</p>
        )}
      </div>

      {/* Category badge */}
      <span
        className={`hidden sm:inline-flex text-[10px] font-medium px-2 py-0.5 rounded-full border flex-shrink-0 ${catColor}`}
      >
        {catLabel}
      </span>

      {/* Score */}
      <span className="text-white/70 text-sm font-semibold flex-shrink-0 min-w-[4rem] text-right">
        {value.toLocaleString()}
      </span>

      {/* Arrow */}
      <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/50 transition-colors flex-shrink-0" />
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
            <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
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
            <div className="flex items-center gap-4 px-4 py-2.5 border-b border-white/10 bg-white/5">
              <span className="w-8 text-center text-white/30 text-xs font-semibold uppercase tracking-wider">
                #
              </span>
              <span className="flex-1 text-white/30 text-xs font-semibold uppercase tracking-wider">
                Club
              </span>
              <span className="hidden sm:block text-white/30 text-xs font-semibold uppercase tracking-wider">
                Category
              </span>
              <span className="text-white/30 text-xs font-semibold uppercase tracking-wider min-w-[4rem] text-right">
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
