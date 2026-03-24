/**
 * FeaturedClubsCarousel.tsx
 *
 * Horizontal scroll carousel showing the top 6 most popular clubs
 * (sorted by memberCount DESC) at the top of the Discover page.
 *
 * Features:
 *  - Fetches top 6 clubs from GET /api/clubs?limit=6
 *  - Smooth horizontal scroll with prev/next arrow buttons
 *  - CSS scroll-snap for satisfying card-by-card navigation
 *  - Loading skeleton (3 ghost cards)
 *  - Premium card design: full-bleed gradient, glassmorphism footer,
 *    rank medal, avatar ring, member/tournament stats, category badge
 *  - "View Club" CTA navigates to the club profile page
 */

import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { ChevronLeft, ChevronRight, Users, Trophy, ArrowRight } from "lucide-react";
import { apiListPublicClubs } from "../lib/clubsApi";
import type { Club } from "../lib/clubRegistry";

// ── Category display helpers ───────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  competitive: "Competitive",
  casual: "Casual",
  scholastic: "Scholastic",
  online: "Online",
  otb: "OTB",
  blitz: "Blitz",
  correspondence: "Correspondence",
  other: "Other",
};

// Richer per-category accent palettes: [gradientFrom, gradientTo, glowColor, badgeBg, badgeText]
const CATEGORY_THEME: Record<string, { grad: string; glow: string; badge: string }> = {
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
  other: {
    grad: "from-slate-900 via-slate-800 to-slate-700",
    glow: "group-hover:shadow-slate-800/50",
    badge: "bg-slate-500/20 text-slate-300 border-slate-500/30",
  },
};

// Fallback gradient by club ID when category is missing
const FALLBACK_GRADS = [
  "from-emerald-950 via-green-900 to-emerald-800",
  "from-blue-950 via-blue-900 to-indigo-800",
  "from-purple-950 via-violet-900 to-purple-800",
  "from-amber-950 via-yellow-900 to-amber-800",
  "from-rose-950 via-pink-900 to-rose-800",
  "from-cyan-950 via-teal-900 to-cyan-800",
];

function clubTheme(club: Club) {
  const cat = club.category ?? "other";
  if (CATEGORY_THEME[cat]) return CATEGORY_THEME[cat];
  const idx = club.id.charCodeAt(club.id.length - 1) % FALLBACK_GRADS.length;
  return {
    grad: FALLBACK_GRADS[idx],
    glow: "group-hover:shadow-green-900/50",
    badge: CATEGORY_THEME.other.badge,
  };
}

// Rank medal labels
const RANK_MEDALS: Record<number, { label: string; cls: string }> = {
  1: { label: "🥇", cls: "bg-yellow-500/25 border-yellow-400/40 text-yellow-200" },
  2: { label: "🥈", cls: "bg-slate-400/20 border-slate-300/40 text-slate-200" },
  3: { label: "🥉", cls: "bg-amber-700/25 border-amber-600/40 text-amber-300" },
};

// ── Skeleton card ──────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="flex-shrink-0 w-64 sm:w-72 h-[200px] sm:h-[220px] rounded-2xl bg-white/5 border border-white/8 animate-pulse" />
  );
}

// ── Featured club card ─────────────────────────────────────────────────────────

interface FeaturedClubCardProps {
  club: Club;
  rank: number;
}

function FeaturedClubCard({ club, rank }: FeaturedClubCardProps) {
  const [, navigate] = useLocation();
  const { grad, glow, badge } = clubTheme(club);
  const catLabel = CATEGORY_LABELS[club.category ?? "other"] ?? "Other";
  const medal = RANK_MEDALS[rank];
  const initial = club.name.charAt(0).toUpperCase();

  return (
    <div
      className={`
        group flex-shrink-0 w-64 sm:w-72 h-[200px] sm:h-[220px]
        rounded-2xl overflow-hidden cursor-pointer relative
        bg-gradient-to-br ${grad}
        border border-white/10
        shadow-lg ${glow}
        transition-all duration-300
        hover:scale-[1.03] hover:border-white/20 hover:shadow-xl
        active:scale-[0.98]
      `}
      onClick={() => navigate(`/clubs/${club.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && navigate(`/clubs/${club.id}`)}
      aria-label={`View ${club.name}`}
    >
      {/* Subtle noise texture overlay */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          backgroundSize: "150px",
        }}
      />

      {/* Diagonal shine on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none bg-gradient-to-br from-white/8 via-transparent to-transparent" />

      {/* Rank medal — top-left */}
      {medal && (
        <div className={`absolute top-3 left-3 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold backdrop-blur-sm ${medal.cls}`}>
          <span>{medal.label}</span>
          <span>#{rank}</span>
        </div>
      )}

      {/* Card body */}
      <div className="relative z-10 p-4 sm:p-5 flex flex-col h-full">

        {/* Avatar + name row */}
        <div className="flex items-center gap-3 mt-6 sm:mt-7 mb-2.5">
          {/* Avatar */}
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex-shrink-0 ring-2 ring-white/20 overflow-hidden bg-white/10 flex items-center justify-center">
            {club.avatarUrl ? (
              <img
                src={club.avatarUrl}
                alt={club.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-white font-bold text-lg leading-none">{initial}</span>
            )}
          </div>

          {/* Name + location */}
          <div className="min-w-0 flex-1">
            <h3 className="text-white font-bold text-sm sm:text-base leading-tight truncate drop-shadow-sm">
              {club.name}
            </h3>
            {club.location && (
              <p className="text-white/50 text-[11px] mt-0.5 truncate">{club.location}</p>
            )}
          </div>
        </div>

        {/* Tagline */}
        <p className="text-white/55 text-xs leading-relaxed line-clamp-2 flex-1 mb-3">
          {club.tagline || "A chess club community."}
        </p>

        {/* Glassmorphism footer strip */}
        <div className="flex items-center justify-between rounded-xl bg-black/25 backdrop-blur-sm border border-white/10 px-3 py-2">
          {/* Stats */}
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-white/70 text-xs font-medium">
              <Users className="w-3 h-3 text-white/50" />
              {(club.memberCount ?? 0).toLocaleString()}
            </span>
            {(club.tournamentCount ?? 0) > 0 && (
              <span className="flex items-center gap-1 text-white/70 text-xs font-medium">
                <Trophy className="w-3 h-3 text-white/50" />
                {club.tournamentCount}
              </span>
            )}
          </div>

          {/* Category badge + arrow */}
          <div className="flex items-center gap-1.5">
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badge}`}>
              {catLabel}
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-white/30 group-hover:text-white/70 group-hover:translate-x-0.5 transition-all duration-200" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main carousel component ────────────────────────────────────────────────────

export function FeaturedClubsCarousel() {
  const [, navigate] = useLocation();
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

  return (
    <div className="mb-8">
      {/* Section header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-base leading-none">🏆</span>
          <h2 className="text-white font-bold text-sm tracking-wide uppercase">
            Featured Clubs
          </h2>
          <span className="hidden sm:inline text-white/35 text-xs">— most popular communities</span>
        </div>

        <div className="flex items-center gap-2">
          {/* See All */}
          <button
            onClick={() => navigate("/clubs/leaderboard")}
            className="flex items-center gap-1 text-green-400 hover:text-green-300 text-xs font-semibold transition-colors duration-200"
          >
            See All
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          {/* Scroll arrows — hidden on mobile (swipe instead) */}
          {!loading && clubs.length > 2 && (
            <div className="hidden sm:flex items-center gap-1 ml-1">
              <button
                onClick={() => scroll("left")}
                className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/12 border border-white/10 hover:border-white/25 flex items-center justify-center transition-all duration-200"
                aria-label="Scroll left"
              >
                <ChevronLeft className="w-4 h-4 text-white/60" />
              </button>
              <button
                onClick={() => scroll("right")}
                className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/12 border border-white/10 hover:border-white/25 flex items-center justify-center transition-all duration-200"
                aria-label="Scroll right"
              >
                <ChevronRight className="w-4 h-4 text-white/60" />
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
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          clubs.map((club, idx) => (
            <div key={club.id} style={{ scrollSnapAlign: "start" }}>
              <FeaturedClubCard club={club} rank={idx + 1} />
            </div>
          ))
        )}
      </div>

      {/* Divider */}
      <div className="mt-6 border-t border-white/5" />
    </div>
  );
}
