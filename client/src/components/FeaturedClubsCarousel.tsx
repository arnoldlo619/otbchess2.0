/**
 * FeaturedClubsCarousel.tsx
 *
 * Horizontal scroll carousel showing the top 6 most popular clubs
 * (sorted by memberCount DESC) at the top of the Discover page.
 *
 * Design system:
 *  - Monochromatic deep-green / charcoal palette aligned with the platform's
 *    CSS tokens (oklch 145° hue family). No rainbow per-category hues.
 *  - Dark mode: deep forest green card surfaces with layered green-to-charcoal
 *    gradients and a single chess-green (#4CAF50-family) accent.
 *  - Light mode: sage-white surfaces with subtle green-tinted depth.
 *  - Category differentiation via opacity/saturation shifts, not hue changes.
 *  - Glassmorphism footer, rank medals, avatar ring, hover polish.
 */

import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { ChevronLeft, ChevronRight, Users, Trophy, ArrowRight, UserPlus, Check } from "lucide-react";
import { apiListPublicClubs } from "../lib/clubsApi";
import { joinClub, isMember, type Club } from "../lib/clubRegistry";
import { apiJoinClub } from "../lib/clubsApi";
import { useAuthContext } from "../context/AuthContext";
import { toast } from "sonner";

// ── Category display helpers ───────────────────────────────────────────────────

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

// Rank medal labels
const RANK_MEDALS: Record<number, { label: string }> = {
  1: { label: "🥇" },
  2: { label: "🥈" },
  3: { label: "🥉" },
};

/**
 * Per-category depth offset — subtle lightness/saturation shift within the
 * green family so cards feel distinct without leaving the brand palette.
 * Values are OKLCH lightness and chroma adjustments relative to the base card.
 */
const CATEGORY_DEPTH: Record<string, { l: number; c: number }> = {
  competitive:    { l: 0.00, c: 0.00 }, // base — deep forest
  casual:         { l: 0.02, c: 0.01 }, // slightly lighter
  scholastic:     { l: 0.03, c: 0.01 },
  online:         { l: -0.01, c: 0.01 },
  otb:            { l: 0.04, c: 0.02 }, // brightest — most "on the board"
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

/** Build the card gradient inline style from the platform's green token family */
function cardGradient(category: string | null | undefined, isDark: boolean): React.CSSProperties {
  const cat = category ?? "other";
  const d = CATEGORY_DEPTH[cat] ?? CATEGORY_DEPTH.other;

  if (isDark) {
    // Base: oklch(0.20 0.06 145) → oklch(0.16 0.05 145) deep forest
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
    // Light mode: sage-white to soft green tint
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

// ── Skeleton card ──────────────────────────────────────────────────────────────

function SkeletonCard({ isDark }: { isDark: boolean }) {
  return (
    <div
      className={`flex-shrink-0 w-64 sm:w-72 h-[200px] sm:h-[220px] rounded-2xl animate-pulse ${
        isDark
          ? "border border-white/8"
          : "border border-black/8"
      }`}
      style={isDark
        ? { background: "oklch(0.22 0.07 145 / 0.7)" }
        : { background: "oklch(0.94 0.02 145 / 0.7)" }
      }
    />
  );
}

// ── Featured club card ─────────────────────────────────────────────────────────

interface FeaturedClubCardProps {
  club: Club;
  rank: number;
  isDark: boolean;
  user: ReturnType<typeof useAuthContext>["user"];
}

function FeaturedClubCard({ club, rank, isDark, user }: FeaturedClubCardProps) {
  const [, navigate] = useLocation();
  const [joined, setJoined] = useState(() => !!(user && isMember(club.id, user.id)));
  const [joining, setJoining] = useState(false);
  const catLabel = CATEGORY_LABELS[club.category ?? "other"] ?? "Other";
  const medal = RANK_MEDALS[rank];
  const initial = club.name.charAt(0).toUpperCase();

  // Text colours — always white-on-green in dark, dark-on-sage in light
  const nameColor   = isDark ? "text-white"         : "text-[oklch(0.15_0.06_145)]";
  const mutedColor  = isDark ? "text-white/50"       : "text-[oklch(0.40_0.05_145)]";
  const footerBg    = isDark ? "bg-black/20"         : "bg-white/40";
  const footerBorder= isDark ? "border-white/10"     : "border-black/8";
  const statColor   = isDark ? "text-white/65"       : "text-[oklch(0.35_0.06_145)]";
  const iconColor   = isDark ? "text-white/40"       : "text-[oklch(0.50_0.05_145)]";
  // Category badge — monochromatic green pill
  const badgeCls    = isDark
    ? "bg-[oklch(0.55_0.13_145)]/20 text-[oklch(0.75_0.12_145)] border-[oklch(0.55_0.13_145)]/30"
    : "bg-[oklch(0.44_0.12_145)]/12 text-[oklch(0.30_0.10_145)] border-[oklch(0.44_0.12_145)]/30";
  // Rank medal badge
  const medalCls    = isDark
    ? "bg-white/10 border-white/20 text-white/80"
    : "bg-black/8 border-black/15 text-[oklch(0.25_0.06_145)]";
  // Hover glow — single green accent
  const hoverGlow   = isDark
    ? "hover:shadow-[0_8px_32px_oklch(0.44_0.12_145_/_0.35)]"
    : "hover:shadow-[0_8px_24px_oklch(0.44_0.12_145_/_0.18)]";

  return (
    <div
      className={`
        group flex-shrink-0 w-64 sm:w-72 h-[200px] sm:h-[220px]
        rounded-2xl overflow-hidden cursor-pointer relative
        ${isDark ? "border border-white/10 hover:border-white/20" : "border border-black/8 hover:border-[oklch(0.44_0.12_145)]/30"}
        shadow-md ${hoverGlow}
        transition-all duration-300
        hover:scale-[1.03] hover:shadow-xl
        active:scale-[0.98]
      `}
      style={cardGradient(club.category, isDark)}
      onClick={() => navigate(`/clubs/${club.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && navigate(`/clubs/${club.id}`)}
      aria-label={`View ${club.name}`}
    >
      {/* Subtle noise texture overlay */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{ backgroundImage: NOISE_BG, backgroundSize: "150px" }}
      />

      {/* Radial highlight — top-left glow */}
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
        <div className={`absolute top-3 left-3 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold backdrop-blur-sm ${medalCls}`}>
          <span>{medal.label}</span>
          <span>#{rank}</span>
        </div>
      )}

      {/* Card body */}
      <div className="relative z-10 p-4 sm:p-5 flex flex-col h-full">

        {/* Avatar + name row */}
        <div className="flex items-center gap-3 mt-6 sm:mt-7 mb-2.5">
          {/* Avatar */}
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
              <span className={`${nameColor} font-bold text-lg leading-none`}>{initial}</span>
            )}
          </div>

          {/* Name + location */}
          <div className="min-w-0 flex-1">
            <h3 className={`${nameColor} font-bold text-sm sm:text-base leading-tight truncate drop-shadow-sm`}>
              {club.name}
            </h3>
            {club.location && (
              <p className={`${mutedColor} text-[11px] mt-0.5 truncate`}>{club.location}</p>
            )}
          </div>
        </div>

        {/* Tagline */}
        <p className={`${mutedColor} text-xs leading-relaxed line-clamp-2 flex-1 mb-3`}>
          {club.tagline || "A chess club community."}
        </p>

        {/* Glassmorphism footer strip */}
        <div className={`flex items-center justify-between rounded-xl ${footerBg} backdrop-blur-sm border ${footerBorder} px-3 py-2`}>
          {/* Stats */}
          <div className="flex items-center gap-3">
            <span className={`flex items-center gap-1 ${statColor} text-xs font-medium`}>
              <Users className={`w-3 h-3 ${iconColor}`} />
              {(club.memberCount ?? 0).toLocaleString()}
            </span>
            {(club.tournamentCount ?? 0) > 0 && (
              <span className={`flex items-center gap-1 ${statColor} text-xs font-medium`}>
                <Trophy className={`w-3 h-3 ${iconColor}`} />
                {club.tournamentCount}
              </span>
            )}
          </div>

          {/* Right side: Join button (signed-in non-member) OR category badge + arrow */}
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
            <ArrowRight className={`w-3.5 h-3.5 ${iconColor} group-hover:text-[oklch(0.65_0.14_145)] group-hover:translate-x-0.5 transition-all duration-200`} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main carousel component ────────────────────────────────────────────────────

interface FeaturedClubsCarouselProps {
  isDark?: boolean;
}

export function FeaturedClubsCarousel({ isDark = true }: FeaturedClubsCarouselProps) {
  const [, navigate] = useLocation();
  const { user } = useAuthContext();
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { clubs: featured } = await apiListPublicClubs({ limit: 6 });
        if (!cancelled) setClubs(featured);
      } catch {
        if (!cancelled) setClubs([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const scroll = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "right" ? 296 : -296, behavior: "smooth" });
  };

  if (!loading && clubs.length === 0) return null;

  const headingColor = isDark ? "text-white"    : "text-[oklch(0.15_0.06_145)]";
  const subColor     = isDark ? "text-white/35"  : "text-[oklch(0.50_0.05_145)]";
  const arrowBg      = isDark
    ? "bg-white/5 hover:bg-white/10 border-white/10 hover:border-white/20 text-white/50 hover:text-white/80"
    : "bg-black/4 hover:bg-black/8 border-black/8 hover:border-black/15 text-[oklch(0.45_0.05_145)] hover:text-[oklch(0.25_0.08_145)]";

  return (
    <div className="mb-8">
      {/* Section header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-base leading-none">🏆</span>
          <h2 className={`${headingColor} font-bold text-sm tracking-wide uppercase`}>
            Featured Clubs
          </h2>
          <span className={`hidden sm:inline ${subColor} text-xs`}>— most popular communities</span>
        </div>

        <div className="flex items-center gap-2">
          {/* See All */}
          <button
            onClick={() => navigate("/clubs/leaderboard")}
            className="flex items-center gap-1 text-xs font-semibold transition-colors duration-200"
            style={{ color: "oklch(0.65 0.14 145)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "oklch(0.75 0.14 145)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "oklch(0.65 0.14 145)")}
          >
            See All
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          {/* Scroll arrows — hidden on mobile (swipe instead) */}
          {!loading && clubs.length > 2 && (
            <div className="hidden sm:flex items-center gap-1 ml-1">
              <button
                onClick={() => scroll("left")}
                className={`w-7 h-7 rounded-full border flex items-center justify-center transition-all duration-200 ${arrowBg}`}
                aria-label="Scroll left"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => scroll("right")}
                className={`w-7 h-7 rounded-full border flex items-center justify-center transition-all duration-200 ${arrowBg}`}
                aria-label="Scroll right"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Scroll container */}
      <div
        ref={scrollRef}
        className="flex gap-3 sm:gap-4 overflow-x-auto pb-2 scroll-smooth"
        style={{
          scrollSnapType: "x mandatory",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        {loading ? (
          <>
            <SkeletonCard isDark={isDark} />
            <SkeletonCard isDark={isDark} />
            <SkeletonCard isDark={isDark} />
          </>
        ) : (
          clubs.map((club, idx) => (
            <div key={club.id} style={{ scrollSnapAlign: "start" }}>
              <FeaturedClubCard club={club} rank={idx + 1} isDark={isDark} user={user} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
