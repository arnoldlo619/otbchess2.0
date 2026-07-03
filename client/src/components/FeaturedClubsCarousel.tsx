/**
 * FeaturedClubsCarousel.tsx
 *
 * Horizontal scroll carousel showing the top 6 most popular clubs.
 * Design: Partiful-style tall portrait image-only cards with date badge overlay,
 * title + hosted-by row below the image. No card border/background — just the image.
 */

import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { ChevronLeft, ChevronRight, Users, UserPlus, Check } from "lucide-react";
import { apiListPublicClubs } from "../lib/clubsApi";
import { joinClub, isMember, type Club } from "../lib/clubRegistry";
import { apiJoinClub } from "../lib/clubsApi";
import { useAuthContext } from "../context/AuthContext";
import { toast } from "sonner";

// ── Skeleton card ──────────────────────────────────────────────────────────────

function SkeletonCard({ isDark }: { isDark: boolean }) {
  return (
    <div className="flex-shrink-0 w-[280px] sm:w-[300px]">
      <div
        className={`w-full aspect-[4/5] rounded-xl animate-pulse ${
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
      className="flex-shrink-0 w-[280px] sm:w-[300px] cursor-pointer group"
      onClick={() => navigate(`/clubs/${club.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && navigate(`/clubs/${club.id}`)}
      aria-label={`View ${club.name}`}
    >
      {/* Image area — tall portrait, 4:5 aspect ratio */}
      <div
        className="relative w-full aspect-[4/5] rounded-xl overflow-hidden"
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
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <>
            <div className="absolute inset-0 chess-board-bg opacity-12" />
            {/* Club initial as fallback visual */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-white/20 text-8xl font-black">{initial}</span>
            </div>
          </>
        )}

        {/* Gradient scrim — bottom fade for legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

        {/* Date/rank badge — top-left, white pill */}
        <div className="absolute top-3 left-3 px-3 py-1.5 rounded-full text-xs font-bold bg-white text-black shadow-sm">
          #{rank} Popular
        </div>

        {/* Three-dot menu — top-right */}
        <div className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center bg-white/90 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="text-black text-sm font-bold leading-none">⋯</span>
        </div>

        {/* Member count badge — bottom-left overlay */}
        <div className="absolute bottom-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-black/60 text-white backdrop-blur-sm">
          <Users className="w-3 h-3" />
          {(club.memberCount ?? 0).toLocaleString()} members
        </div>

        {/* Join button — bottom-right overlay */}
        {user && !joined && (
          <button
            onClick={handleJoin}
            className="absolute bottom-3 right-3 flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-bold bg-white text-black shadow-md hover:bg-gray-100 transition-colors active:scale-95"
          >
            <UserPlus className="w-3 h-3" />
            Join
          </button>
        )}
        {user && joined && (
          <span className="absolute bottom-3 right-3 flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-bold bg-[#4CAF50] text-white shadow-md">
            <Check className="w-3 h-3" />
            Member
          </span>
        )}
      </div>

      {/* Title below image — bold, no container */}
      <h3 className={`mt-3 text-base font-bold leading-tight truncate ${isDark ? "text-white" : "text-gray-900"}`}>
        {club.name}
      </h3>

      {/* Hosted by / location row */}
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
    el.scrollBy({ left: dir === "right" ? 320 : -320, behavior: "smooth" });
  };

  if (!loading && clubs.length === 0) return null;

  const headingColor = isDark ? "text-white" : "text-gray-900";
  const subColor = isDark ? "text-white/40" : "text-gray-500";
  const arrowBg = isDark
    ? "bg-white/8 hover:bg-white/15 border-white/10 hover:border-white/25 text-white/60 hover:text-white"
    : "bg-black/5 hover:bg-black/10 border-black/10 hover:border-black/20 text-gray-500 hover:text-gray-800";

  return (
    <div className="mb-10">
      {/* Section header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <h2 className={`${headingColor} font-bold text-base sm:text-lg`}>
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
