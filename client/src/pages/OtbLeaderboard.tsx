/**
 * OtbLeaderboard — /otb/leaderboard
 *
 * Displays the top OTB-rated players by category (Blitz / Rapid).
 * Clean, minimal design consistent with the rest of the platform.
 */
import { useState, useEffect } from "react";
import { Trophy, Medal, Loader2, ChevronLeft } from "lucide-react";
import { useLocation } from "wouter";
import { NavLogo } from "@/components/NavLogo";
import { useTheme } from "@/contexts/ThemeContext";

type Category = "blitz" | "rapid";

interface LeaderboardEntry {
  userId: string;
  displayName: string;
  chesscomUsername: string | null;
  rating: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  tier: string;
}

export default function OtbLeaderboard() {
  const [, navigate] = useLocation();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [category, setCategory] = useState<Category>("blitz");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/otb-games/leaderboard/${category}`, { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        setEntries(data.entries ?? []);
      })
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [category]);

  const bg = isDark ? "bg-[#0d1a0f]" : "bg-[#FBFADA]/70";
  const card = isDark ? "bg-white/[0.03] border-white/10" : "bg-white border-[#ADBC9F]";
  const text = isDark ? "text-white" : "text-[#12372A]";
  const muted = isDark ? "text-white/50" : "text-[#436850]";

  return (
    <div className={`min-h-screen ${bg}`}>
      {/* Header */}
      <div className={`sticky top-0 z-10 backdrop-blur-xl border-b ${isDark ? "bg-[#0d1a0f]/80 border-white/10" : "bg-white/80 border-[#ADBC9F]"}`}>
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate("/")}
            className={`w-9 h-9 rounded-full flex items-center justify-center ${isDark ? "bg-white/10" : "bg-[#ADBC9F]/40"}`}
          >
            <ChevronLeft className={`w-5 h-5 ${isDark ? "text-white" : "text-[#12372A]/85"}`} />
          </button>
          <NavLogo linked={true} className="h-6" />
          <div className="flex-1" />
          <Trophy className="w-5 h-5 text-[#436850]" />
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Title */}
        <h1 className={`text-2xl font-bold mb-1 ${text}`}>OTB Leaderboard</h1>
        <p className={`text-sm mb-5 ${muted}`}>Top rated players in over-the-board games</p>

        {/* Category tabs */}
        <div className={`flex rounded-2xl p-1 mb-6 ${isDark ? "bg-white/5" : "bg-[#ADBC9F]/40"}`}>
          {(["blitz", "rapid"] as Category[]).map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                category === cat
                  ? "bg-[#5a9e5f] text-white shadow-sm"
                  : `${isDark ? "text-white/60" : "text-[#436850]"}`
              }`}
            >
              OTB {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-[#436850]" />
          </div>
        )}

        {/* Empty state */}
        {!loading && entries.length === 0 && (
          <div className="text-center py-12">
            <Trophy className={`w-12 h-12 mx-auto mb-3 ${isDark ? "text-white/20" : "text-[#436850]/70"}`} />
            <p className={`text-sm ${muted}`}>No rated players yet. Be the first!</p>
          </div>
        )}

        {/* Leaderboard list */}
        {!loading && entries.length > 0 && (
          <div className="space-y-2">
            {entries.map((entry, idx) => (
              <div
                key={entry.userId}
                className={`rounded-2xl border p-4 flex items-center gap-3 ${card}`}
              >
                {/* Rank */}
                <div className="w-8 text-center flex-shrink-0">
                  {idx < 3 ? (
                    <Medal className={`w-5 h-5 mx-auto ${
                      idx === 0 ? "text-yellow-400" : idx === 1 ? "text-[#436850]/70" : "text-amber-600"
                    }`} />
                  ) : (
                    <span className={`text-sm font-bold ${muted}`}>{idx + 1}</span>
                  )}
                </div>

                {/* Player info */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-bold truncate ${text}`}>
                    {entry.displayName}
                  </p>
                  {entry.chesscomUsername && (
                    <p className={`text-xs truncate ${muted}`}>@{entry.chesscomUsername}</p>
                  )}
                </div>

                {/* Rating */}
                <div className="text-right flex-shrink-0">
                  <p className={`text-lg font-bold ${text}`}>{Math.round(entry.rating)}</p>
                  <p className={`text-[10px] ${muted}`}>
                    {entry.wins}W / {entry.losses}L / {entry.draws}D
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
