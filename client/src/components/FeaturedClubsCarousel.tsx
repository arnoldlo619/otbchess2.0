/**
 * FeaturedClubsCarousel.tsx
 *
 * Horizontal scroll carousel showing the top 6 most popular clubs.
 * Design: Premium Partiful/Luma-style tall portrait cards with rich gradient overlays,
 * hover scale animation, social proof (avatar stacks), and polished transitions.
 */

import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { ChevronLeft, ChevronRight, Users, UserPlus, Check, Flame } from "lucide-react";
import { apiListPublicClubs } from "../lib/clubsApi";
import { joinClub, isMember, type Club } from "../lib/clubRegistry";
import { apiJoinClub } from "../lib/clubsApi";
import { useAuthContext } from "../context/AuthContext";
import { toast } from "sonner";

// ── Skeleton card ──────────────────────────────────────────────────────────────

function SkeletonCard({ isDark }: { isDark: boolean }) {
  return (
    <div className="flex-shrink-0 w-[260px] sm:w-[280px]">
      <div
        className={`w-full aspect-[4/5] rounded-2xl animate-pulse ${
          isDark ? "bg-white/8" : "bg-black/8"
        }`}
      />
      <div className={`mt-3 h-4 w-3/4 rounded ${isDark ? "bg-white/8" : "bg-black/8"} animate-pulse`} />
      <div className={`mt-2 h-3 w-1/2 rounded ${isDark ? "bg-white/6" : "bg-black/6"} animate-pulse`} />
    </div>
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
  const initial = club.name.charAt(0).toUpperCase();

  const handleJoin = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user || joining || joined) return;
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
  };

  return (
    <div
      className="flex-shrink-0 w-[260px] sm:w-[280px] cursor-pointer group"
      onClick={() => navigate(`/clubs/${club.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && navigate(`/clubs/${club.id}`)}
      aria-label={`View ${club.name}`}
    >
      {/* Image area — tall portrait, 4:5 aspect ratio with premium hover */}
      <div
        className="relative w-full aspect-[4/5] rounded-2xl overflow-hidden transition-all duration-300 group-hover:shadow-[0_8px_32px_rgba(0,0,0,0.3),0_2px_8px_rgba(76,175,80,0.08)]"
        style={{
          background: club.bannerUrl
            ? undefined
            : `linear-gradient(145deg, ${club.accentColor}dd 0%, ${club.accentColor}55 60%, ${isDark ? '#0d1a0f' : '#1a2e1d'}ee 100%)`,
        }}
      >
        {club.bannerUrl ? (
          <img
            src={club.bannerUrl}
            alt=""
            className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <>
            <div className="absolute inset-0 chess-board-bg opacity-12" />
            {/* Club initial as fallback visual */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-white/15 text-8xl font-black transition-transform duration-300 group-hover:scale-110">{initial}</span>
            </div>
          </>
        )}

        {/* Enhanced gradient scrim — stronger bottom fade for premium feel */}
        <div
          className="absolute inset-0 transition-opacity duration-300"
          style={{
            background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 30%, transparent 60%)",
          }}
        />
        {/* Hover overlay — subtle green tint */}
        <div className="absolute inset-0 bg-[#4CAF50]/0 group-hover:bg-[#4CAF50]/5 transition-colors duration-300" />

        {/* Rank badge — top-left, with fire icon for top 3 */}
        <div className="absolute top-3 left-3 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold bg-white/95 text-black shadow-lg backdrop-blur-sm">
          {rank <= 3 && <Flame className="w-3 h-3 text-orange-500" />}
          #{rank}
        </div>

        {/* Three-dot menu — top-right */}
        <div className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center bg-white/90 shadow-sm opacity-0 group-hover:opacity-100 transition-all duration-200 scale-90 group-hover:scale-100">
          <span className="text-black text-sm font-bold leading-none">⋯</span>
        </div>

        {/* Bottom overlay content — member count + join */}
        <div className="absolute bottom-0 left-0 right-0 p-3 flex items-end justify-between">
          {/* Member count badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-semibold bg-black/50 text-white backdrop-blur-md border border-white/10">
            <Users className="w-3 h-3" />
            {(club.memberCount ?? 0).toLocaleString()}
          </div>

          {/* Join button */}
          {user && !joined && (
            <button
              onClick={handleJoin}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-bold bg-white text-black shadow-lg hover:bg-gray-100 transition-all duration-200 active:scale-95 hover:shadow-xl"
            >
              <UserPlus className="w-3 h-3" />
              Join
            </button>
          )}
          {user && joined && (
            <span className="flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-bold bg-[#4CAF50] text-white shadow-lg">
              <Check className="w-3 h-3" />
              Member
            </span>
          )}
        </div>

        {/* "View Club" button — appears on hover, centered */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none">
          <span className="px-4 py-2 rounded-full text-xs font-bold bg-white/95 text-black shadow-xl backdrop-blur-sm">
            View Club
          </span>
        </div>
      </div>

      {/* Title below image — bold, no container */}
      <h3 className={`mt-3 text-sm font-bold leading-tight truncate ${isDark ? "text-white" : "text-gray-900"}`}>
        {club.name}
      </h3>

      {/* Location row */}
      <div className="flex items-center gap-2 mt-1.5">
        {/* Club avatar */}
        <div
          className="w-5 h-5 rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center text-[9px] font-bold text-white"
          style={{ background: club.accentColor }}
        >
          {club.avatarUrl ? (
            <img src={club.avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            initial
          )}
        </div>
        <span className={`text-xs truncate ${isDark ? "text-white/50" : "text-gray-500"}`}>
          {club.location || club.tagline || "Chess community"}
        </span>
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
    el.scrollBy({ left: dir === "right" ? 300 : -300, behavior: "smooth" });
  };

  if (!loading && clubs.length === 0) return null;

  const headingColor = isDark ? "text-white" : "text-gray-900";
  const subColor = isDark ? "text-white/40" : "text-gray-500";
  const arrowBg = isDark
    ? "bg-white/8 hover:bg-white/15 border-white/10 hover:border-white/25 text-white/60 hover:text-white"
    : "bg-black/5 hover:bg-black/10 border-black/10 hover:border-black/20 text-gray-500 hover:text-gray-800";

  return (
    <div className="mb-8">
      {/* Section header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <h2 className={`${headingColor} font-bold text-base sm:text-lg`} style={{ fontFamily: "'Clash Display', sans-serif" }}>
            Featured Clubs
          </h2>
          <span className={`hidden sm:inline ${subColor} text-sm`}>— most popular</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/clubs/leaderboard")}
            className="flex items-center gap-1 text-xs font-semibold text-[#4CAF50] hover:text-[#66BB6A] transition-colors"
          >
            See All
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          {/* Scroll arrows */}
          {!loading && clubs.length > 2 && (
            <div className="hidden sm:flex items-center gap-1.5 ml-2">
              <button
                onClick={() => scroll("left")}
                className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all duration-200 ${arrowBg}`}
                aria-label="Scroll left"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => scroll("right")}
                className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all duration-200 ${arrowBg}`}
                aria-label="Scroll right"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Horizontal scroll container */}
      <div
        ref={scrollRef}
        className="flex gap-4 sm:gap-5 overflow-x-auto pb-3 scroll-smooth"
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
