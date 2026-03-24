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
 *  - Rich card design: accent gradient, emoji avatar, member count, category badge
 *  - "View Club" CTA navigates to the club profile page
 */

import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { ChevronLeft, ChevronRight, Users, Trophy, Star } from "lucide-react";
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

const CATEGORY_COLORS: Record<string, string> = {
  competitive: "bg-red-500/20 text-red-300 border-red-500/30",
  casual: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  scholastic: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  online: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  otb: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  blitz: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  correspondence: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  other: "bg-slate-500/20 text-slate-300 border-slate-500/30",
};

// Deterministic accent gradient from club ID
function clubGradient(club: Club): string {
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

// ── Skeleton card ──────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="flex-shrink-0 w-72 h-52 rounded-2xl bg-white/5 border border-white/10 animate-pulse" />
  );
}

// ── Featured club card ─────────────────────────────────────────────────────────

interface FeaturedClubCardProps {
  club: Club;
  rank: number;
}

function FeaturedClubCard({ club, rank }: FeaturedClubCardProps) {
  const [, navigate] = useLocation();
  const gradient = clubGradient(club);
  const catLabel = CATEGORY_LABELS[club.category ?? "other"] ?? "Other";
  const catColor = CATEGORY_COLORS[club.category ?? "other"] ?? CATEGORY_COLORS.other;

  return (
    <div
      className={`flex-shrink-0 w-72 h-52 rounded-2xl border border-white/10 bg-gradient-to-br ${gradient} backdrop-blur-sm overflow-hidden cursor-pointer group relative transition-all duration-300 hover:scale-[1.03] hover:border-green-500/40 hover:shadow-lg hover:shadow-green-900/30`}
      onClick={() => navigate(`/clubs/${club.id}`)}
    >
      {/* Rank badge */}
      {rank <= 3 && (
        <div className="absolute top-3 right-3 z-10">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border ${
            rank === 1 ? "bg-yellow-500/30 text-yellow-300 border-yellow-500/50" :
            rank === 2 ? "bg-slate-400/30 text-slate-300 border-slate-400/50" :
            "bg-amber-700/30 text-amber-400 border-amber-700/50"
          }`}>
            {rank === 1 ? "★" : rank === 2 ? "✦" : "◆"}
          </div>
        </div>
      )}

      {/* Card content */}
      <div className="p-5 flex flex-col h-full">
        {/* Top row: avatar + category */}
        <div className="flex items-start gap-3 mb-3">
          <div className="w-12 h-12 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-2xl flex-shrink-0">
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
            <h3 className="text-white font-semibold text-sm leading-tight truncate">
              {club.name}
            </h3>
            {club.location && (
              <p className="text-white/50 text-xs mt-0.5 truncate">{club.location}</p>
            )}
          </div>
        </div>

        {/* Tagline */}
        <p className="text-white/60 text-xs leading-relaxed line-clamp-2 flex-1 mb-3">
          {club.tagline || "A chess club community."}
        </p>

        {/* Bottom row: stats + CTA */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-white/60 text-xs">
              <Users className="w-3 h-3" />
              {club.memberCount?.toLocaleString() ?? 0}
            </span>
            {(club.tournamentCount ?? 0) > 0 && (
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

      {/* Hover overlay CTA */}
      <div className="absolute inset-0 bg-green-500/0 group-hover:bg-green-500/5 transition-colors duration-300 rounded-2xl pointer-events-none" />
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
    el.scrollBy({ left: dir === "right" ? 300 : -300, behavior: "smooth" });
  };

  // Don't render if no clubs
  if (!loading && clubs.length === 0) return null;

  return (
    <div className="mb-8">
      {/* Section header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
          <h2 className="text-white font-semibold text-sm tracking-wide uppercase">
            Featured Clubs
          </h2>
          <span className="text-white/40 text-xs">— most popular communities</span>
        </div>

        {/* See All link */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/clubs/leaderboard")}
            className="flex items-center gap-1 text-green-400 hover:text-green-300 text-xs font-medium transition-colors duration-200"
          >
            See All
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Scroll arrows */}
        {!loading && clubs.length > 2 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => scroll("left")}
              className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 flex items-center justify-center transition-all duration-200"
              aria-label="Scroll left"
            >
              <ChevronLeft className="w-4 h-4 text-white/60" />
            </button>
            <button
              onClick={() => scroll("right")}
              className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 flex items-center justify-center transition-all duration-200"
              aria-label="Scroll right"
            >
              <ChevronRight className="w-4 h-4 text-white/60" />
            </button>
          </div>
        )}
      </div>

      {/* Scroll container */}
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto pb-2 scroll-smooth"
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
