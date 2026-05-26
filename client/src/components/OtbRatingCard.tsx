/**
 * OtbRatingCard — Displays the user's OTB ELO ratings on their profile.
 *
 * Shows:
 * - Blitz and Rapid OTB ratings with provisional/rated/established badges
 * - Game count and win/loss/draw record
 */
import { useState, useEffect } from "react";
import { Trophy, TrendingUp, TrendingDown, Minus, Loader2 } from "lucide-react";
import { useAuthContext } from "@/context/AuthContext";

interface OtbRatings {
  blitz: { rating: number; gamesPlayed: number; wins: number; losses: number; draws: number; tier: string } | null;
  rapid: { rating: number; gamesPlayed: number; wins: number; losses: number; draws: number; tier: string } | null;
}

export function OtbRatingCard({ isDark }: { isDark: boolean }) {
  const { user } = useAuthContext();
  const [ratings, setRatings] = useState<OtbRatings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;

    const fetchRatings = async () => {
      try {
        const res = await fetch(`/api/otb-games/ratings/${user.id}`, { credentials: "include" });
        if (!res.ok) {
          setRatings(null);
          return;
        }
        const data = await res.json();
        setRatings(data);
      } catch {
        setRatings(null);
      } finally {
        setLoading(false);
      }
    };

    fetchRatings();
  }, [user?.id]);

  if (loading) {
    return (
      <div className={`rounded-3xl border p-6 ${isDark ? "bg-white/[0.03] border-white/10" : "bg-white border-gray-200"}`}>
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-[#2d6a4f]" />
        </div>
      </div>
    );
  }

  if (!ratings || (!ratings.blitz && !ratings.rapid)) {
    return (
      <div className={`rounded-3xl border p-6 ${isDark ? "bg-white/[0.03] border-white/10" : "bg-white border-gray-200"}`}>
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="w-5 h-5 text-[#2d6a4f]" />
          <h2 className={`text-base font-bold ${isDark ? "text-white" : "text-gray-900"}`}>OTB Rating</h2>
        </div>
        <p className={`text-sm ${isDark ? "text-white/50" : "text-gray-500"}`}>
          No OTB games played yet. Use the chess clock to register and play rated games!
        </p>
      </div>
    );
  }

  const card = isDark ? "bg-white/[0.03] border-white/10" : "bg-white border-gray-200";
  const text = isDark ? "text-white" : "text-gray-900";

  return (
    <div className={`rounded-3xl border p-6 ${card}`}>
      <div className="flex items-center gap-2 mb-4">
        <Trophy className="w-5 h-5 text-[#2d6a4f]" />
        <h2 className={`text-base font-bold ${text}`}>OTB Rating</h2>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {ratings.blitz && (
          <RatingBlock
            label="OTB Blitz"
            rating={ratings.blitz.rating}
            gamesPlayed={ratings.blitz.gamesPlayed}
            wins={ratings.blitz.wins}
            losses={ratings.blitz.losses}
            draws={ratings.blitz.draws}
            tier={ratings.blitz.tier}
            isDark={isDark}
          />
        )}
        {ratings.rapid && (
          <RatingBlock
            label="OTB Rapid"
            rating={ratings.rapid.rating}
            gamesPlayed={ratings.rapid.gamesPlayed}
            wins={ratings.rapid.wins}
            losses={ratings.rapid.losses}
            draws={ratings.rapid.draws}
            tier={ratings.rapid.tier}
            isDark={isDark}
          />
        )}
      </div>
    </div>
  );
}

function RatingBlock({
  label,
  rating,
  gamesPlayed,
  wins,
  losses,
  draws,
  tier,
  isDark,
}: {
  label: string;
  rating: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  tier: string;
  isDark: boolean;
}) {
  const bg = isDark ? "bg-white/5" : "bg-gray-50";
  const text = isDark ? "text-white" : "text-gray-900";
  const muted = isDark ? "text-white/50" : "text-gray-500";

  const tierBadge = (() => {
    switch (tier) {
      case "provisional":
        return { label: "Provisional", color: "bg-amber-500/20 text-amber-400" };
      case "rated":
        return { label: "Rated", color: "bg-blue-500/20 text-blue-400" };
      case "established":
        return { label: "Established", color: "bg-[#5a9e5f]/20 text-[#5a9e5f]" };
      default:
        return { label: "New", color: "bg-white/10 text-white/50" };
    }
  })();

  return (
    <div className={`rounded-2xl p-4 ${bg}`}>
      <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${muted}`}>{label}</p>
      <p className={`text-3xl font-bold ${text}`}>{Math.round(rating)}</p>
      <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${tierBadge.color}`}>
        {tierBadge.label}
      </span>
      <div className={`mt-3 flex items-center gap-2 text-xs ${muted}`}>
        <span>{gamesPlayed} games</span>
      </div>
      <div className="flex items-center gap-2 mt-1">
        <span className="flex items-center gap-0.5 text-xs text-[#5a9e5f]">
          <TrendingUp className="w-3 h-3" /> {wins}W
        </span>
        <span className="flex items-center gap-0.5 text-xs text-red-400">
          <TrendingDown className="w-3 h-3" /> {losses}L
        </span>
        <span className={`flex items-center gap-0.5 text-xs ${muted}`}>
          <Minus className="w-3 h-3" /> {draws}D
        </span>
      </div>
    </div>
  );
}
