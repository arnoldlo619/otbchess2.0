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
 * Design system:
 *   - Monochromatic OKLCH green/charcoal palette aligned with platform tokens
 *   - Same depth-offset system as FeaturedClubsCarousel (no rainbow hues)
 *   - Single chess-green accent: oklch(0.55 0.13 145)
 *   - Dark: deep forest green surfaces; Light: sage-white surfaces
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
  UserPlus,
  Check,
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuthContext } from "@/context/AuthContext";
import { joinClub, isMember } from "@/lib/clubRegistry";
import { apiJoinClub } from "@/lib/clubsApi";
import { toast } from "sonner";

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

// ── Shared design helpers ─────────────────────────────────────────────────────

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

const RANK_MEDALS: Record<number, { emoji: string }> = {
  1: { emoji: "🥇" },
  2: { emoji: "🥈" },
  3: { emoji: "🥉" },
};

/**
 * Per-category lightness/chroma offset within the green 145° family.
 * Keeps all cards in the same hue family while giving subtle depth variation.
 */
const CATEGORY_DEPTH: Record<string, { l: number; c: number }> = {
  competitive:    { l: 0.00, c: 0.00 },
  casual:         { l: 0.02, c: 0.01 },
  scholastic:     { l: 0.03, c: 0.01 },
  online:         { l: -0.01, c: 0.01 },
  otb:            { l: 0.04, c: 0.02 },
  blitz:          { l: -0.01, c: 0.00 },
  correspondence: { l: 0.01, c: 0.01 },
  club:           { l: 0.03, c: 0.02 },
  school:         { l: 0.02, c: 0.01 },
  university:     { l: 0.01, c: 0.01 },
  community:      { l: 0.03, c: 0.01 },
  professional:   { l: -0.02, c: 0.01 },
  other:          { l: 0.00, c: 0.00 },
};

const NOISE_BG =
  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

/** Inline OKLCH gradient style for a card surface */
function cardGradientStyle(category: string | null | undefined, isDark: boolean): React.CSSProperties {
  const cat = category ?? "other";
  const d = CATEGORY_DEPTH[cat] ?? CATEGORY_DEPTH.other;

  if (isDark) {
    const l1 = +(0.22 + d.l).toFixed(3);
    const c1 = +(0.08 + d.c).toFixed(3);
    const l2 = +(0.18 + d.l).toFixed(3);
    const c2 = +(0.06 + d.c).toFixed(3);
    const l3 = +(0.14 + d.l * 0.5).toFixed(3);
    return {
      background: `linear-gradient(135deg,
        oklch(${l1} ${c1} 145) 0%,
        oklch(${l2} ${c2} 145) 55%,
        oklch(${l3} 0.04 145) 100%)`,
    };
  } else {
    const l1 = +(0.96 + d.l * 0.3).toFixed(3);
    const c1 = +(0.02 + d.c * 0.5).toFixed(3);
    const l2 = +(0.92 + d.l * 0.3).toFixed(3);
    const c2 = +(0.03 + d.c * 0.5).toFixed(3);
    return {
      background: `linear-gradient(135deg,
        oklch(${l1} ${c1} 145) 0%,
        oklch(${l2} ${c2} 145) 60%,
        oklch(0.88 0.04 145) 100%)`,
    };
  }
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

function PodiumSkeleton({ isDark }: { isDark: boolean }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-56 rounded-2xl animate-pulse"
          style={{
            background: isDark
              ? "oklch(0.22 0.07 145 / 0.7)"
              : "oklch(0.94 0.02 145 / 0.7)",
            border: isDark
              ? "1px solid oklch(1 0 0 / 0.08)"
              : "1px solid oklch(0 0 0 / 0.06)",
          }}
        />
      ))}
    </div>
  );
}

function TableRowSkeleton({ isDark }: { isDark: boolean }) {
  const shimmer = isDark ? "oklch(1 0 0 / 0.08)" : "oklch(0 0 0 / 0.06)";
  const shimmerFaint = isDark ? "oklch(1 0 0 / 0.05)" : "oklch(0 0 0 / 0.04)";
  return (
    <div
      className="flex items-center gap-4 px-4 py-3.5 border-b animate-pulse"
      style={{ borderColor: isDark ? "oklch(1 0 0 / 0.05)" : "oklch(0 0 0 / 0.05)" }}
    >
      <div className="w-8 h-4 rounded" style={{ background: shimmer }} />
      <div className="w-10 h-10 rounded-xl flex-shrink-0" style={{ background: shimmer }} />
      <div className="flex-1 space-y-2">
        <div className="h-3 rounded w-1/3" style={{ background: shimmer }} />
        <div className="h-2 rounded w-1/4" style={{ background: shimmerFaint }} />
      </div>
      <div className="w-16 h-4 rounded" style={{ background: shimmer }} />
    </div>
  );
}

// ── Podium card (top 3) ───────────────────────────────────────────────────────

interface PodiumCardProps {
  club: LeaderboardClub;
  metric: SortMetric;
  isDark: boolean;
  user: ReturnType<typeof useAuthContext>["user"];
}

function PodiumCard({ club, metric, isDark, user }: PodiumCardProps) {
  const [, navigate] = useLocation();
  const [joined, setJoined] = useState(() => !!(user && isMember(club.id, user.id)));
  const [joining, setJoining] = useState(false);
  const catLabel = CATEGORY_LABELS[club.category ?? "other"] ?? "Other";
  const medal = RANK_MEDALS[club.rank];
  const initial = club.name.charAt(0).toUpperCase();

  // Stagger podium heights: #1 tallest, #2 medium, #3 shortest
  const podiumOffset =
    club.rank === 1 ? "sm:mt-0" : club.rank === 2 ? "sm:mt-6" : "sm:mt-10";

  // Text colours
  const nameColor  = isDark ? "text-white"      : "text-[oklch(0.15_0.06_145)]";
  const mutedColor = isDark ? "text-white/50"    : "text-[oklch(0.40_0.05_145)]";
  const statColor  = isDark ? "text-white/65"    : "text-[oklch(0.35_0.06_145)]";
  const iconColor  = isDark ? "text-white/40"    : "text-[oklch(0.50_0.05_145)]";

  // Score label colour below card — single green accent, no rank-specific hues
  const scoreColor = isDark ? "text-[oklch(0.65_0.14_145)]" : "text-[oklch(0.44_0.12_145)]";

  // Category badge
  const badgeCls = isDark
    ? "bg-[oklch(0.55_0.13_145)]/20 text-[oklch(0.75_0.12_145)] border-[oklch(0.55_0.13_145)]/30"
    : "bg-[oklch(0.44_0.12_145)]/12 text-[oklch(0.30_0.10_145)] border-[oklch(0.44_0.12_145)]/30";

  // Rank medal badge — neutral glass, no hue-specific colours
  const medalCls = isDark
    ? "bg-white/10 border-white/20 text-white/80"
    : "bg-black/8 border-black/15 text-[oklch(0.25_0.06_145)]";

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
        className="flex-1 rounded-2xl overflow-hidden relative transition-all duration-300 group-hover:scale-[1.02] group-hover:shadow-xl active:scale-[0.98]"
        style={{
          ...cardGradientStyle(club.category, isDark),
          border: isDark
            ? "1px solid oklch(1 0 0 / 0.10)"
            : "1px solid oklch(0 0 0 / 0.08)",
          boxShadow: isDark
            ? "0 4px 24px oklch(0.44 0.12 145 / 0.20)"
            : "0 4px 16px oklch(0.44 0.12 145 / 0.10)",
        }}
      >
        {/* Noise texture */}
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{ backgroundImage: NOISE_BG, backgroundSize: "150px" }}
        />

        {/* Radial highlight */}
        <div
          className="absolute top-0 left-0 w-40 h-40 pointer-events-none opacity-30"
          style={{
            background: isDark
              ? "radial-gradient(circle at 0% 0%, oklch(0.65 0.14 145 / 0.4) 0%, transparent 70%)"
              : "radial-gradient(circle at 0% 0%, oklch(0.80 0.10 145 / 0.35) 0%, transparent 70%)",
          }}
        />

        {/* Diagonal shine on hover */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none bg-gradient-to-br from-white/6 via-transparent to-transparent" />

        {/* Rank medal — top-left */}
        {medal && (
          <div
            className={`absolute top-3 left-3 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold backdrop-blur-sm ${medalCls}`}
          >
            <span>{medal.emoji}</span>
            <span>#{club.rank}</span>
          </div>
        )}

        {/* Card body */}
        <div className="relative z-10 p-4 sm:p-5 flex flex-col min-h-[200px] sm:min-h-[220px]">
          {/* Avatar + name */}
          <div className="flex items-center gap-3 mt-7 mb-2.5">
            <div
              className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex-shrink-0 overflow-hidden flex items-center justify-center"
              style={{
                boxShadow: isDark
                  ? "0 0 0 2px oklch(0.55 0.13 145 / 0.35)"
                  : "0 0 0 2px oklch(0.44 0.12 145 / 0.25)",
                background: isDark
                  ? "oklch(0.28 0.08 145 / 0.8)"
                  : "oklch(0.90 0.03 145 / 0.8)",
              }}
            >
              {club.avatarUrl ? (
                <img
                  src={club.avatarUrl}
                  alt={club.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className={`${nameColor} font-bold text-lg leading-none`}>
                  {initial}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className={`${nameColor} font-bold text-sm sm:text-base leading-tight truncate drop-shadow-sm`}>
                {club.name}
              </h3>
              {club.location && (
                <p className={`${mutedColor} text-[11px] mt-0.5 truncate`}>
                  {club.location}
                </p>
              )}
            </div>
          </div>

          {/* Tagline */}
          <p className={`${mutedColor} text-xs leading-relaxed line-clamp-2 flex-1 mb-3`}>
            {club.tagline || "A chess club community."}
          </p>

          {/* Glassmorphism footer strip */}
          <div
            className="flex items-center justify-between rounded-xl backdrop-blur-sm px-3 py-2"
            style={{
              background: isDark ? "oklch(0 0 0 / 0.20)" : "oklch(1 1 0 / 0.40)",
              border: isDark
                ? "1px solid oklch(1 0 0 / 0.10)"
                : "1px solid oklch(0 0 0 / 0.08)",
            }}
          >
            <div className="flex items-center gap-3">
              <span className={`flex items-center gap-1 ${statColor} text-xs font-medium`}>
                <Users className={`w-3 h-3 ${iconColor}`} />
                {club.memberCount.toLocaleString()}
              </span>
              {club.tournamentCount > 0 && (
                <span className={`flex items-center gap-1 ${statColor} text-xs font-medium`}>
                  <Trophy className={`w-3 h-3 ${iconColor}`} />
                  {club.tournamentCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {user && !joined ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (joining) return;
                    setJoining(true);
                    apiJoinClub(club.id, {
                      displayName: user.displayName,
                      chesscomUsername: user.chesscomUsername,
                      lichessUsername: user.lichessUsername,
                      avatarUrl: user.avatarUrl,
                    }).catch(() => {});
                    joinClub(club.id, {
                      userId: user.id,
                      displayName: user.displayName,
                      chesscomUsername: user.chesscomUsername,
                      lichessUsername: user.lichessUsername,
                      avatarUrl: user.avatarUrl,
                    });
                    setJoined(true);
                    setJoining(false);
                    toast.success(`Joined ${club.name}!`);
                  }}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all active:scale-95 touch-manipulation"
                  style={{
                    background: isDark
                      ? "oklch(0.55 0.13 145 / 0.25)"
                      : "oklch(0.44 0.12 145 / 0.15)",
                    border: isDark
                      ? "1px solid oklch(0.55 0.13 145 / 0.40)"
                      : "1px solid oklch(0.44 0.12 145 / 0.35)",
                    color: isDark ? "oklch(0.85 0.12 145)" : "oklch(0.30 0.10 145)",
                  }}
                  aria-label={`Join ${club.name}`}
                >
                  {joining ? (
                    <span className="w-2.5 h-2.5 rounded-full border border-current border-t-transparent animate-spin" />
                  ) : (
                    <UserPlus className="w-2.5 h-2.5" />
                  )}
                  Join
                </button>
              ) : user && joined ? (
                <span
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold"
                  style={{
                    background: "oklch(0.55 0.13 145 / 0.20)",
                    border: "1px solid oklch(0.55 0.13 145 / 0.35)",
                    color: "oklch(0.75 0.14 145)",
                  }}
                >
                  <Check className="w-2.5 h-2.5" /> Member
                </span>
              ) : (
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badgeCls}`}>
                  {catLabel}
                </span>
              )}
              <ArrowRight
                className={`w-3.5 h-3.5 ${iconColor} group-hover:translate-x-0.5 transition-all duration-200`}
                style={{ color: isDark ? undefined : undefined }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Score label below card — single green accent */}
      <div className="flex items-center justify-center mt-2">
        <span className={`text-xs font-semibold ${scoreColor}`}>
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
  isDark: boolean;
}

function TableRow({ club, metric, isDark }: TableRowProps) {
  const [, navigate] = useLocation();
  const catLabel = CATEGORY_LABELS[club.category ?? "other"] ?? "Other";
  const value = metricValue(metric, club);
  const initial = club.name.charAt(0).toUpperCase();

  const rowBorderColor = isDark ? "oklch(1 0 0 / 0.05)" : "oklch(0 0 0 / 0.05)";
  const rankColor  = isDark ? "text-white/35"  : "text-[oklch(0.55_0.04_145)]";
  const nameColor  = isDark ? "text-white"     : "text-[oklch(0.15_0.06_145)]";
  const locColor   = isDark ? "text-white/40"  : "text-[oklch(0.50_0.05_145)]";
  const scoreColor = isDark ? "text-white/70"  : "text-[oklch(0.30_0.08_145)]";

  // Category badge — same monochromatic pill as carousel
  const badgeCls = isDark
    ? "bg-[oklch(0.55_0.13_145)]/20 text-[oklch(0.75_0.12_145)] border-[oklch(0.55_0.13_145)]/30"
    : "bg-[oklch(0.44_0.12_145)]/12 text-[oklch(0.30_0.10_145)] border-[oklch(0.44_0.12_145)]/30";

  return (
    <div
      className="flex items-center gap-3 sm:gap-4 px-4 py-3 border-b cursor-pointer transition-colors duration-150 group"
      style={{ borderColor: rowBorderColor }}
      onClick={() => navigate(`/clubs/${club.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && navigate(`/clubs/${club.id}`)}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = isDark
          ? "oklch(1 0 0 / 0.03)"
          : "oklch(0 0 0 / 0.02)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = "transparent";
      }}
    >
      {/* Rank number */}
      <span className={`w-7 text-center ${rankColor} text-sm font-mono flex-shrink-0`}>
        {club.rank}
      </span>

      {/* Avatar — monochromatic gradient swatch */}
      <div
        className="w-10 h-10 rounded-xl flex-shrink-0 overflow-hidden flex items-center justify-center"
        style={{
          ...cardGradientStyle(club.category, isDark),
          boxShadow: isDark
            ? "0 0 0 1px oklch(1 0 0 / 0.12)"
            : "0 0 0 1px oklch(0.44 0.12 145 / 0.20)",
        }}
      >
        {club.avatarUrl ? (
          <img
            src={club.avatarUrl}
            alt={club.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <span
            className="font-bold text-sm leading-none"
            style={{ color: isDark ? "oklch(0.90 0.05 145)" : "oklch(0.25 0.08 145)" }}
          >
            {initial}
          </span>
        )}
      </div>

      {/* Name + location */}
      <div className="flex-1 min-w-0">
        <p
          className={`${nameColor} text-sm font-semibold truncate transition-colors duration-150 group-hover:text-[oklch(0.65_0.14_145)]`}
        >
          {club.name}
        </p>
        {club.location && (
          <p className={`${locColor} text-xs truncate`}>{club.location}</p>
        )}
      </div>

      {/* Category badge */}
      <span
        className={`hidden sm:inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0 ${badgeCls}`}
      >
        {catLabel}
      </span>

      {/* Score */}
      <span className={`${scoreColor} text-sm font-bold flex-shrink-0 min-w-[3.5rem] text-right tabular-nums`}>
        {value.toLocaleString()}
      </span>

      {/* Arrow */}
      <ChevronRight
        className="w-4 h-4 flex-shrink-0 group-hover:translate-x-0.5 transition-all duration-150"
        style={{ color: isDark ? "oklch(1 0 0 / 0.20)" : "oklch(0.44 0.12 145 / 0.35)" }}
      />
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
  const { theme } = useTheme();
  const { user } = useAuthContext();
  const isDark = theme === "dark";

  // ── Platform-aligned surface tokens (OKLCH 145° family) ──────────────────
  const pageBg    = isDark ? "oklch(0.20 0.06 145)"       : "oklch(0.97 0.01 145)";
  const headerBg  = isDark ? "oklch(0.20 0.06 145 / 0.95)" : "oklch(0.97 0.01 145 / 0.95)";
  const headerBdr = isDark ? "oklch(1 0 0 / 0.10)"         : "oklch(0 0 0 / 0.08)";
  const textMain  = isDark ? "oklch(0.97 0.01 95)"         : "oklch(0.15 0.06 145)";
  const textMuted = isDark ? "oklch(1 0 0 / 0.40)"         : "oklch(0.50 0.05 145)";
  const tabBg     = isDark ? "oklch(1 0 0 / 0.05)"         : "oklch(0 0 0 / 0.05)";
  const tabInactiveColor = isDark ? "oklch(1 0 0 / 0.55)"  : "oklch(0.45 0.05 145)";
  const backBtnBg = isDark ? "oklch(1 0 0 / 0.05)"         : "oklch(0 0 0 / 0.05)";
  const backBtnBdr= isDark ? "oklch(1 0 0 / 0.10)"         : "oklch(0 0 0 / 0.08)";
  const tableBg   = isDark ? "oklch(1 0 0 / 0.03)"         : "oklch(0 0 0 / 0.02)";
  const tableBdr  = isDark ? "oklch(1 0 0 / 0.10)"         : "oklch(0 0 0 / 0.08)";
  const tblHdrBg  = isDark ? "oklch(1 0 0 / 0.05)"         : "oklch(0 0 0 / 0.03)";
  const tblHdrTxt = isDark ? "oklch(1 0 0 / 0.30)"         : "oklch(0.50 0.05 145)";
  const footerTxt = isDark ? "oklch(1 0 0 / 0.20)"         : "oklch(0.65 0.04 145)";
  const emptyIcon = isDark ? "oklch(1 0 0 / 0.20)"         : "oklch(0.70 0.04 145)";
  const accentGreen = "oklch(0.55 0.13 145)";

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
    return () => { cancelled = true; };
  }, [metric]);

  const podium = clubs.slice(0, 3);
  const rest = clubs.slice(3);

  const METRIC_TABS: { id: SortMetric; label: string; icon: React.ReactNode }[] = [
    { id: "members",     label: "Members",     icon: <Users className="w-3.5 h-3.5" /> },
    { id: "tournaments", label: "Tournaments", icon: <Trophy className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="min-h-screen" style={{ background: pageBg, color: textMain }}>
      {/* ── Sticky header ─────────────────────────────────────────────────── */}
      <div
        className="sticky top-0 z-20 backdrop-blur-sm border-b otb-header-safe"
        style={{ background: headerBg, borderColor: headerBdr }}
      >
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate("/clubs")}
            className="w-8 h-8 rounded-full border flex items-center justify-center transition-all duration-200"
            style={{ background: backBtnBg, borderColor: backBtnBdr, color: textMuted }}
            aria-label="Back to clubs"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <TrendingUp className="w-5 h-5 flex-shrink-0" style={{ color: accentGreen }} />
            <h1 className="font-['Anton'] text-xl tracking-wide truncate">
              CLUB LEADERBOARD
            </h1>
          </div>
          {!loading && (
            <span className="text-xs flex-shrink-0" style={{ color: textMuted }}>
              {total} clubs
            </span>
          )}
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────────────────────── */}
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Metric tab switcher */}
        <div
          className="flex items-center gap-2 mb-6 rounded-xl p-1 w-fit"
          style={{ background: tabBg }}
        >
          {METRIC_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setMetric(tab.id)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
              style={
                metric === tab.id
                  ? {
                      background: accentGreen,
                      color: "oklch(1 0 0)",
                      boxShadow: "0 4px 12px oklch(0.44 0.12 145 / 0.35)",
                    }
                  : { color: tabInactiveColor }
              }
              onMouseEnter={(e) => {
                if (metric !== tab.id) {
                  (e.currentTarget as HTMLButtonElement).style.background = isDark
                    ? "oklch(1 0 0 / 0.05)"
                    : "oklch(0 0 0 / 0.04)";
                  (e.currentTarget as HTMLButtonElement).style.color = isDark
                    ? "oklch(1 0 0 / 0.85)"
                    : "oklch(0.20 0.07 145)";
                }
              }}
              onMouseLeave={(e) => {
                if (metric !== tab.id) {
                  (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                  (e.currentTarget as HTMLButtonElement).style.color = tabInactiveColor;
                }
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Error state */}
        {error && (
          <div
            className="rounded-xl border px-4 py-3 text-sm mb-6"
            style={{
              background: isDark ? "oklch(0.577 0.245 27 / 0.10)" : "oklch(0.95 0.02 27)",
              borderColor: isDark ? "oklch(0.577 0.245 27 / 0.20)" : "oklch(0.80 0.08 27)",
              color: isDark ? "oklch(0.80 0.15 27)" : "oklch(0.45 0.18 27)",
            }}
          >
            {error}
          </div>
        )}

        {/* Podium — top 3 */}
        <div className="mb-2">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-base leading-none">🏆</span>
            <h2
              className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: textMuted }}
            >
              Top 3
            </h2>
          </div>

          {loading ? (
            <PodiumSkeleton isDark={isDark} />
          ) : podium.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              {podium.map((club) => (
                <PodiumCard key={club.id} club={club} metric={metric} isDark={isDark} user={user} />
              ))}
            </div>
          ) : null}
        </div>

        {/* Ranked table — clubs 4+ */}
        {(loading || rest.length > 0) && (
          <div
            className="rounded-2xl border overflow-hidden"
            style={{ background: tableBg, borderColor: tableBdr }}
          >
            {/* Table header */}
            <div
              className="flex items-center gap-3 sm:gap-4 px-4 py-2.5 border-b"
              style={{ background: tblHdrBg, borderColor: tableBdr }}
            >
              <span
                className="w-7 text-center text-xs font-semibold uppercase tracking-wider"
                style={{ color: tblHdrTxt }}
              >
                #
              </span>
              <span className="w-10 flex-shrink-0" />
              <span
                className="flex-1 text-xs font-semibold uppercase tracking-wider"
                style={{ color: tblHdrTxt }}
              >
                Club
              </span>
              <span
                className="hidden sm:block text-xs font-semibold uppercase tracking-wider"
                style={{ color: tblHdrTxt }}
              >
                Category
              </span>
              <span
                className="text-xs font-semibold uppercase tracking-wider min-w-[3.5rem] text-right"
                style={{ color: tblHdrTxt }}
              >
                {metric === "members" ? "Members" : "Tournaments"}
              </span>
              <span className="w-4" />
            </div>

            {/* Rows */}
            {loading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <TableRowSkeleton key={i} isDark={isDark} />
                ))
              : rest.map((club) => (
                  <TableRow key={club.id} club={club} metric={metric} isDark={isDark} />
                ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && clubs.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Trophy className="w-12 h-12 mb-4" style={{ color: emptyIcon }} />
            <p className="text-sm" style={{ color: textMuted }}>No clubs found.</p>
            <button
              onClick={() => navigate("/clubs")}
              className="mt-4 px-4 py-2 rounded-lg text-sm transition-colors"
              style={{
                background: "oklch(0.55 0.13 145 / 0.15)",
                color: accentGreen,
                border: "1px solid oklch(0.55 0.13 145 / 0.25)",
              }}
            >
              Discover Clubs
            </button>
          </div>
        )}

        {/* Footer note */}
        {!loading && clubs.length > 0 && (
          <p className="text-center text-xs mt-6" style={{ color: footerTxt }}>
            Rankings update in real time as clubs grow.
          </p>
        )}
      </div>
    </div>
  );
}
