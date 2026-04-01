/**
 * FinalStandings — /tournament/:id/results
 *
 * A clean, minimalist Swiss-format final standings page shown to both the
 * director and all participants when a tournament is completed.
 *
 * Columns (matching chess-manager reference):
 *   Rank · Player · Rating · Pts · Bch1 · Bch · SB · W · D · L
 *
 * Data source: fetched from /api/tournament/:id/live-state, which always
 * returns the latest persisted state (including status === "completed").
 * Falls back to location.state.standings if navigated from Director.
 */

import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useLocation } from "wouter";
import { Trophy, ArrowLeft, Download, Share2, Medal, Instagram, LayoutGrid } from "lucide-react";
import { InstagramCarouselModal } from "@/components/InstagramCarouselModal";
import type { TournamentConfig } from "@/lib/tournamentRegistry";
import { useTheme } from "@/contexts/ThemeContext";
import { computeStandings, type StandingRow } from "@/lib/swiss";
import type { Player, Round } from "@/lib/tournamentData";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { ThemeToggle } from "@/components/ThemeToggle";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TournamentMeta {
  name: string;
  location?: string;
  date?: string;
  rounds: number;
  players: Player[];
  completedRounds: Round[];
  status: string;
}

// ─── Medal helpers ────────────────────────────────────────────────────────────

const RANK_MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

function rankColor(rank: number, isDark: boolean): string {
  if (rank === 1) return "text-amber-400";
  if (rank === 2) return isDark ? "text-gray-300" : "text-gray-500";
  if (rank === 3) return "text-orange-400";
  return isDark ? "text-white/40" : "text-gray-400";
}

// ─── Tiebreak cell ────────────────────────────────────────────────────────────

function TbCell({ value, decimals = 1, muted = false, isDark }: { value: number; decimals?: number; muted?: boolean; isDark: boolean }) {
  const base = muted
    ? isDark ? "text-white/35" : "text-gray-400"
    : isDark ? "text-white/70" : "text-gray-600";
  return (
    <td className={`text-right tabular-nums text-xs font-medium px-2 py-3 ${base}`}>
      {value.toFixed(decimals)}
    </td>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function Skeleton({ isDark }: { isDark: boolean }) {
  const bg = isDark ? "bg-white/08 animate-pulse rounded" : "bg-gray-200 animate-pulse rounded";
  return (
    <div className="space-y-2 px-4 mt-6">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className={`h-10 w-full ${bg}`} />
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function FinalStandings() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [meta, setMeta] = useState<TournamentMeta | null>(null);
  const [rows, setRows] = useState<StandingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCarousel, setShowCarousel] = useState(false);

  // ── Fetch tournament state ──────────────────────────────────────────────────
  const fetchState = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`/api/tournament/${encodeURIComponent(id)}/live-state`);
      if (!res.ok) {
        if (res.status === 404) {
          setError("Tournament not found.");
        } else {
          setError("Could not load tournament data.");
        }
        setLoading(false);
        return;
      }
      const data = await res.json() as {
        status?: string;
        tournamentName?: string;
        location?: string;
        date?: string;
        totalRounds?: number;
        players?: Player[];
        rounds?: Round[];
      };

      const players: Player[] = Array.isArray(data.players) ? data.players : [];
      const rounds: Round[] = Array.isArray(data.rounds) ? data.rounds : [];
      const completedRounds = rounds.filter((r) => r.status === "completed");

      const standings = computeStandings(players, completedRounds);
      setRows(standings);
      setMeta({
        name: data.tournamentName ?? "Tournament",
        location: data.location,
        date: data.date,
        rounds: data.totalRounds ?? rounds.length,
        players,
        completedRounds,
        status: data.status ?? "completed",
      });
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  // ── Theme tokens ────────────────────────────────────────────────────────────
  const bg = isDark ? "bg-[#0d1a0f]" : "bg-[#F7FAF7]";
  const cardBg = isDark ? "bg-[#111f14]" : "bg-white";
  const border = isDark ? "border-white/08" : "border-[#E8F0E8]";
  const textMain = isDark ? "text-white" : "text-[#1a1a1a]";
  const textMuted = isDark ? "text-white/40" : "text-gray-400";
  const accent = "#3D6B47";
  const headerBg = isDark ? "bg-[#0a1a0d]" : "bg-white";
  const thBg = isDark ? "bg-[#0f1f12]" : "bg-[#F0F5EE]";
  const thText = isDark ? "text-white/50" : "text-[#3D6B47]";
  const rowHover = isDark ? "hover:bg-white/04" : "hover:bg-[#F7FAF7]";
  const rowHighlight = isDark ? "bg-[#3D6B47]/12" : "bg-[#3D6B47]/06";

  // ── Error state ─────────────────────────────────────────────────────────────
  if (!loading && error) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center gap-4 ${bg}`}>
        <p className={`text-sm ${textMuted}`}>{error}</p>
        <Link href="/" className="text-sm font-semibold text-[#3D6B47] underline">Go home</Link>
      </div>
    );
  }

  // ── Podium top-3 ────────────────────────────────────────────────────────────
  const top3 = rows.slice(0, 3);

  return (
    <div className={`min-h-screen ${bg} flex flex-col`}>

      {/* ── Nav bar ──────────────────────────────────────────────────────────── */}
      <header className={`sticky top-0 z-30 ${headerBg} border-b ${border} backdrop-blur-sm`}>
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          {/* Back */}
          <Link
            href={`/tournament/${id}`}
            className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${isDark ? "text-white/60 hover:text-white" : "text-gray-500 hover:text-[#3D6B47]"}`}
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Tournament</span>
          </Link>

          {/* Title */}
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 flex-shrink-0" style={{ color: accent }} />
            <span className={`text-sm font-bold truncate max-w-[180px] sm:max-w-xs ${textMain}`}>
              {meta?.name ?? "Final Standings"}
            </span>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <div className={`${isDark ? "bg-[#0a1a0d]" : "bg-white"} border-b ${border}`}>
        <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div>
              <p className={`text-xs font-bold uppercase tracking-widest mb-1`} style={{ color: accent }}>
                Final Standings
              </p>
              <h1 className={`text-2xl sm:text-3xl font-black tracking-tight ${textMain}`}>
                {meta?.name ?? "Tournament"}
              </h1>
              {(meta?.location || meta?.date) && (
                <p className={`text-sm mt-1 ${textMuted}`}>
                  {[meta.location, meta.date].filter(Boolean).join(" · ")}
                </p>
              )}
            </div>
            {meta && (
              <div className={`flex items-center gap-4 text-xs ${textMuted}`}>
                <span>{meta.players.length} players</span>
                <span>{meta.rounds} rounds</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${
                    isDark
                      ? "border-[#4CAF50]/30 text-[#4CAF50] bg-[#4CAF50]/10"
                      : "border-[#3D6B47]/20 text-[#3D6B47] bg-[#3D6B47]/08"
                  }`}
                >
                  Complete
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Content ──────────────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-2 sm:px-4 py-6 space-y-6">

        {loading ? (
          <Skeleton isDark={isDark} />
        ) : (
          <>
            {/* ── Podium (top 3) ─────────────────────────────────────────────── */}
            {top3.length >= 2 && (
              <div className={`${cardBg} rounded-2xl border ${border} p-5 sm:p-6`}>
                <p className={`text-xs font-bold uppercase tracking-widest mb-5 ${thText}`}>
                  Podium
                </p>
                <div className="flex items-end justify-center gap-3 sm:gap-6">
                  {/* Reorder: 2nd, 1st, 3rd */}
                  {[top3[1], top3[0], top3[2]].filter(Boolean).map((row, displayIdx) => {
                    const podiumRank = displayIdx === 0 ? 2 : displayIdx === 1 ? 1 : 3;
                    const heights = ["h-20", "h-28", "h-16"];
                    const podiumColors = [
                      isDark ? "bg-gray-600/40" : "bg-gray-200",
                      isDark ? "bg-amber-500/30" : "bg-amber-100",
                      isDark ? "bg-orange-600/30" : "bg-orange-100",
                    ];
                    const heightClass = heights[displayIdx];
                    const podiumColor = podiumColors[displayIdx];
                    return (
                      <div key={row.player.id} className="flex flex-col items-center gap-2 flex-1 max-w-[120px]">
                        <PlayerAvatar
                          username={row.player.username}
                          name={row.player.name || row.player.username}
                          platform={row.player.platform ?? "chesscom"}
                          avatarUrl={row.player.avatarUrl}
                          size={podiumRank === 1 ? 52 : 40}
                        />
                        <p className={`text-xs font-bold text-center leading-tight truncate w-full px-1 ${textMain}`}>
                          {row.player.name || row.player.username}
                        </p>
                        <p className={`text-xs font-semibold`} style={{ color: accent }}>
                          {row.points} pts
                        </p>
                        <div className={`w-full rounded-t-xl flex flex-col items-center justify-center ${heightClass} ${podiumColor}`}>
                          <span className="text-xl leading-none">{RANK_MEDAL[podiumRank]}</span>
                          <span className={`text-xs font-black mt-1 ${textMain}`}>#{podiumRank}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Full standings table ────────────────────────────────────────── */}
            <div className={`${cardBg} rounded-2xl border ${border} overflow-hidden`}>
              <div className="px-4 sm:px-5 pt-5 pb-3 flex items-center justify-between">
                <p className={`text-xs font-bold uppercase tracking-widest ${thText}`}>
                  Full Standings
                </p>
                <p className={`text-xs ${textMuted}`}>
                  Tiebreak order: Pts → Bch → Bch1 → SB → Rating
                </p>
              </div>

              {/* Scrollable table wrapper */}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] border-collapse">
                  {/* Header */}
                  <thead>
                    <tr className={`${thBg} border-b ${border}`}>
                      <th className={`text-left text-xs font-bold uppercase tracking-wider px-4 py-2.5 w-10 ${thText}`}>#</th>
                      <th className={`text-left text-xs font-bold uppercase tracking-wider px-2 py-2.5 ${thText}`}>Player</th>
                      <th className={`text-right text-xs font-bold uppercase tracking-wider px-2 py-2.5 w-16 ${thText}`}>Rating</th>
                      {/* Highlighted tiebreak columns — matching the red-boxed area in the reference */}
                      <th className={`text-right text-xs font-bold uppercase tracking-wider px-2 py-2.5 w-12 rounded-t-sm`} style={{ color: accent, backgroundColor: isDark ? "rgba(61,107,71,0.15)" : "rgba(61,107,71,0.08)" }}>Pts</th>
                      <th className={`text-right text-xs font-bold uppercase tracking-wider px-2 py-2.5 w-12 ${thText}`}>Bch1</th>
                      <th className={`text-right text-xs font-bold uppercase tracking-wider px-2 py-2.5 w-12 ${thText}`}>Bch</th>
                      <th className={`text-right text-xs font-bold uppercase tracking-wider px-2 py-2.5 w-12 ${thText}`}>SB</th>
                      <th className={`text-right text-xs font-bold uppercase tracking-wider px-2 py-2.5 w-8 ${thText}`}>W</th>
                      <th className={`text-right text-xs font-bold uppercase tracking-wider px-2 py-2.5 w-8 ${thText}`}>D</th>
                      <th className={`text-right text-xs font-bold uppercase tracking-wider px-2 py-2.5 w-8 ${thText}`}>L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => {
                      const isTop3 = row.rank <= 3;
                      return (
                        <tr
                          key={row.player.id}
                          className={`border-b ${border} transition-colors ${rowHover} ${isTop3 ? rowHighlight : ""}`}
                        >
                          {/* Rank */}
                          <td className={`px-4 py-3 text-sm font-black w-10 ${rankColor(row.rank, isDark)}`}>
                            {row.rank}
                          </td>

                          {/* Player */}
                          <td className="px-2 py-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <PlayerAvatar
                                username={row.player.username}
                                name={row.player.name || row.player.username}
                                platform={row.player.platform ?? "chesscom"}
                                avatarUrl={row.player.avatarUrl}
                                size={28}
                                className="flex-shrink-0"
                              />
                              <div className="min-w-0">
                                <p className={`text-sm font-semibold truncate ${textMain}`}>
                                  {row.player.title && (
                                    <span className="text-xs font-bold mr-1" style={{ color: accent }}>
                                      {row.player.title}
                                    </span>
                                  )}
                                  {row.player.name || row.player.username}
                                </p>
                                <p className={`text-xs truncate ${textMuted}`}>
                                  @{row.player.username}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Rating */}
                          <td className={`text-right tabular-nums text-xs font-medium px-2 py-3 ${textMuted}`}>
                            {row.player.elo > 0 ? row.player.elo : "—"}
                          </td>

                          {/* Pts — highlighted */}
                          <td
                            className="text-right tabular-nums px-2 py-3"
                            style={{ backgroundColor: isDark ? "rgba(61,107,71,0.10)" : "rgba(61,107,71,0.05)" }}
                          >
                            <span className={`text-sm font-black ${textMain}`}>
                              {row.points % 1 === 0 ? row.points.toFixed(0) : row.points.toFixed(1)}
                            </span>
                          </td>

                          {/* Bch1 */}
                          <TbCell value={row.buchholzCut1} isDark={isDark} />
                          {/* Bch */}
                          <TbCell value={row.buchholz} isDark={isDark} />
                          {/* SB */}
                          <TbCell value={row.sonnebornBerger} isDark={isDark} />

                          {/* W */}
                          <td className={`text-right tabular-nums text-xs font-bold px-2 py-3 ${isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"}`}>
                            {row.wins}
                          </td>
                          {/* D */}
                          <td className={`text-right tabular-nums text-xs font-medium px-2 py-3 ${textMuted}`}>
                            {row.draws}
                          </td>
                          {/* L */}
                          <td className={`text-right tabular-nums text-xs font-medium px-2 py-3 ${isDark ? "text-red-400/70" : "text-red-400"}`}>
                            {row.losses}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Column legend */}
              <div className={`px-4 sm:px-5 py-3 border-t ${border} flex flex-wrap gap-x-4 gap-y-1`}>
                {[
                  ["Pts", "Points"],
                  ["Bch1", "Buchholz Cut-1 (lowest opponent score removed)"],
                  ["Bch", "Buchholz (sum of all opponent scores)"],
                  ["SB", "Sonneborn-Berger"],
                  ["W / D / L", "Wins / Draws / Losses"],
                ].map(([abbr, full]) => (
                  <p key={abbr} className={`text-xs ${textMuted}`}>
                    <span className="font-semibold">{abbr}</span> = {full}
                  </p>
                ))}
              </div>
            </div>

            {/* ── Footer CTAs ───────────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row gap-3 pb-8">
              <Link
                href={`/tournament/${id}`}
                className={`flex items-center justify-center gap-2 flex-1 py-3.5 rounded-xl text-sm font-semibold border transition-colors ${
                  isDark
                    ? "border-white/12 text-white/70 hover:bg-white/06"
                    : "border-[#E8F0E8] text-gray-600 hover:bg-[#F0F5EE]"
                }`}
              >
                <ArrowLeft className="w-4 h-4" />
                Tournament Page
              </Link>
              {/* Player Cards */}
              <Link
                href={`/tournament/${id}/report`}
                className={`flex items-center justify-center gap-2 flex-1 py-3.5 rounded-xl text-sm font-semibold border transition-colors ${
                  isDark
                    ? "border-white/12 text-white/70 hover:bg-white/06"
                    : "border-[#E8F0E8] text-gray-600 hover:bg-[#F0F5EE]"
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
                Player Cards
              </Link>
              {/* Instagram Carousel export */}
              <button
                onClick={() => setShowCarousel(true)}
                className={`flex items-center justify-center gap-2 flex-1 py-3.5 rounded-xl text-sm font-semibold border transition-all ${
                  isDark
                    ? "border-white/12 text-white/70 hover:bg-white/06 hover:border-white/20"
                    : "border-[#E8F0E8] text-gray-600 hover:bg-[#F0F5EE]"
                }`}
              >
                <div className="w-4 h-4 rounded bg-gradient-to-br from-[#833AB4] via-[#FD1D1D] to-[#FCB045] flex items-center justify-center">
                  <Instagram className="w-2.5 h-2.5 text-white" />
                </div>
                Create Recap
              </button>
              <button
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({
                      title: `${meta?.name ?? "Tournament"} — Final Standings`,
                      url: window.location.href,
                    }).catch(() => {/* dismissed */});
                  } else {
                    navigator.clipboard.writeText(window.location.href).then(() => {
                      // Simple visual feedback — could use toast
                    }).catch(() => {/* ignore */});
                  }
                }}
                className="flex items-center justify-center gap-2 flex-1 py-3.5 rounded-xl text-sm font-semibold text-white transition-colors"
                style={{ backgroundColor: accent }}
              >
                <Share2 className="w-4 h-4" />
                Share Results
              </button>
            </div>
          </>
        )}
      </main>

      {/* ── Instagram Carousel Modal ──────────────────────────────────────── */}
      {showCarousel && meta && (
        <InstagramCarouselModal
          open={showCarousel}
          onClose={() => setShowCarousel(false)}
          rows={rows}
          config={null}
          tournamentName={meta.name}
          totalRounds={meta.rounds}
        />
      )}
    </div>
  );
}
