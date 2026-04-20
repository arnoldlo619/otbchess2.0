/**
 * FinalStandings — /tournament/:id/results
 *
 * A clean, minimalist final standings page shown to both the
 * director and all participants when a tournament is completed.
 *
 * For swiss_elim format, rankings are derived from the elimination bracket:
 *   1st = champion (winner of the final)
 *   2nd = finalist (loser of the final)
 *   3rd/4th = semi-final losers (ranked by Swiss tiebreaks among themselves)
 *   5th–8th = quarter-final losers, etc.
 *   Remaining players (eliminated in Swiss) ranked by Swiss tiebreaks below.
 *
 * For other formats, rankings use standard Swiss tiebreaks.
 */

import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useLocation } from "wouter";
import {Trophy, ArrowLeft, Share2, Instagram, LayoutGrid} from "lucide-react";
import { InstagramCarouselModal } from "@/components/InstagramCarouselModal";
import { useTheme } from "@/contexts/ThemeContext";
import { computeStandings, type StandingRow } from "@/lib/swiss";
import type { Player, Round, Game } from "@/lib/tournamentData";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TiebreakTooltip } from "@/components/TiebreakTooltip";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TournamentMeta {
  name: string;
  location?: string;
  date?: string;
  rounds: number;
  players: Player[];
  completedRounds: Round[];
  status: string;
  format?: string;
  swissRounds?: number;
  elimCutoff?: number;
}

// ─── Medal helpers ────────────────────────────────────────────────────────────

const RANK_MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

function rankColor(rank: number, isDark: boolean): string {
  if (rank === 1) return "text-amber-400";
  if (rank === 2) return isDark ? "text-gray-300" : "text-gray-500";
  if (rank === 3) return "text-orange-400";
  return isDark ? "text-white/40" : "text-gray-400";
}

// ─── Elim bracket placement ──────────────────────────────────────────────────

/**
 * Derive final placement from elimination bracket rounds.
 * Returns a Map<playerId, rank> for all players who participated in the bracket.
 *
 * Logic:
 *   - Walk rounds from the last (final) backwards.
 *   - The final round has 1 game: winner = 1st, loser = 2nd.
 *   - The semi-final round losers = 3rd/4th (tie-broken by Swiss standings).
 *   - Quarter-final losers = 5th–8th, etc.
 *   - Within each "tier" of losers, sub-sort by their Swiss standings rank.
 */
function computeElimPlacements(
  elimRounds: Round[],
  swissStandings: StandingRow[],
): Map<string, number> {
  const placements = new Map<string, number>();
  if (elimRounds.length === 0) return placements;

  // Build a Swiss rank lookup: playerId → rank (1-indexed)
  const swissRankMap = new Map<string, number>();
  swissStandings.forEach((row) => {
    swissRankMap.set(row.player.id, row.rank);
  });

  // Sort elim rounds by round number descending (final first)
  const sorted = [...elimRounds].sort((a, b) => b.number - a.number);

  let currentRank = 1;

  for (let i = 0; i < sorted.length; i++) {
    const round = sorted[i];

    if (i === 0) {
      // Final round: may contain the championship game AND a 3rd-place consolation game
      const championshipGame = round.games.find(
        (g) => !g.isThirdPlace && g.result !== "*" && g.whiteId !== "BYE" && g.blackId !== "BYE"
      );
      const thirdPlaceGame = round.games.find(
        (g) => g.isThirdPlace && g.result !== "*" && g.whiteId !== "BYE" && g.blackId !== "BYE"
      );

      if (championshipGame) {
        const winnerId = championshipGame.result === "1-0" ? championshipGame.whiteId : championshipGame.blackId;
        const loserId = championshipGame.result === "1-0" ? championshipGame.blackId : championshipGame.whiteId;
        placements.set(winnerId, 1); // Champion
        placements.set(loserId, 2); // Finalist
        currentRank = 3;
      }

      if (thirdPlaceGame) {
        // 3rd-place match result definitively determines 3rd and 4th
        const thirdId = thirdPlaceGame.result === "1-0" ? thirdPlaceGame.whiteId : thirdPlaceGame.blackId;
        const fourthId = thirdPlaceGame.result === "1-0" ? thirdPlaceGame.blackId : thirdPlaceGame.whiteId;
        placements.set(thirdId, 3);
        placements.set(fourthId, 4);
        currentRank = 5;
      }
    } else {
      // Earlier rounds — losers share a tier (skip 3rd-place game if somehow present)
      const completedGames = round.games.filter(
        (g) => !g.isThirdPlace && g.result !== "*" && g.whiteId !== "BYE" && g.blackId !== "BYE"
      );
      const losers: string[] = [];
      for (const game of completedGames) {
        const loserId = game.result === "1-0" ? game.blackId : game.whiteId;
        // Only add if not already placed
        if (!placements.has(loserId)) {
          losers.push(loserId);
        }
      }

      // Sub-sort losers by their Swiss standings rank (lower rank = better)
      losers.sort((a, b) => (swissRankMap.get(a) ?? 999) - (swissRankMap.get(b) ?? 999));

      for (const loserId of losers) {
        placements.set(loserId, currentRank);
        currentRank++;
      }
    }
  }

  return placements;
}

/**
 * Build the final rows for a swiss_elim tournament.
 * Top section: players ranked by their elim bracket placement.
 * Bottom section: players eliminated in Swiss, ranked by Swiss tiebreaks.
 */
function buildSwissElimRows(
  allPlayers: Player[],
  allRounds: Round[],
  swissRounds: number,
): StandingRow[] {
  // Compute Swiss-only standings (for tiebreaking and for non-bracket players)
  const swissRoundsOnly = allRounds.filter((r) => r.number <= swissRounds);
  const swissStandings = computeStandings(allPlayers, swissRoundsOnly);

  // Get elim rounds
  const elimRounds = allRounds.filter(
    (r) => r.number > swissRounds && r.status === "completed"
  );

  // Compute elim placements
  const elimPlacements = computeElimPlacements(elimRounds, swissStandings);

  // Build a player lookup
  const playerMap = new Map<string, Player>();
  allPlayers.forEach((p) => playerMap.set(p.id, p));

  // Build a Swiss standings lookup for tiebreak data
  const swissRowMap = new Map<string, StandingRow>();
  swissStandings.forEach((row) => swissRowMap.set(row.player.id, row));

  // Compute full-tournament standings (all rounds) for W/D/L counts
  const fullStandings = computeStandings(allPlayers, allRounds.filter((r) => r.status === "completed"));
  const fullRowMap = new Map<string, StandingRow>();
  fullStandings.forEach((row) => fullRowMap.set(row.player.id, row));

  // Section 1: Bracket players, sorted by elim placement
  const bracketEntries = Array.from(elimPlacements.entries())
    .sort((a, b) => a[1] - b[1]);

  // Section 2: Non-bracket players, sorted by Swiss standings
  const bracketPlayerIds = new Set(elimPlacements.keys());
  // Also include players who were IN the bracket but didn't have a completed game
  // (e.g. first-round bye in bracket — unlikely but safe)
  const nonBracketRows = swissStandings.filter(
    (row) => !bracketPlayerIds.has(row.player.id)
  );

  // Build final rows
  const result: StandingRow[] = [];
  let rank = 1;

  for (const [playerId] of bracketEntries) {
    const swissRow = swissRowMap.get(playerId);
    const fullRow = fullRowMap.get(playerId);
    const player = playerMap.get(playerId);
    if (!player) continue;

    result.push({
      player,
      rank,
      // Use full tournament points for display
      points: fullRow?.points ?? swissRow?.points ?? 0,
      buchholz: swissRow?.buchholz ?? 0,
      buchholzCut1: swissRow?.buchholzCut1 ?? 0,
      sonnebornBerger: swissRow?.sonnebornBerger ?? 0,
      wins: fullRow?.wins ?? swissRow?.wins ?? 0,
      draws: fullRow?.draws ?? swissRow?.draws ?? 0,
      losses: fullRow?.losses ?? swissRow?.losses ?? 0,
      matchW: 0,
      matchD: 0,
      matchL: 0,
    });
    rank++;
  }

  // Non-bracket players continue the ranking
  for (const swissRow of nonBracketRows) {
    result.push({
      ...swissRow,
      rank,
    });
    rank++;
  }

  return result;
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

// ─── Elim round label helper ─────────────────────────────────────────────────

function elimRoundLabel(gamesInRound: number): string {
  if (gamesInRound === 1) return "Final";
  if (gamesInRound === 2) return "Semi-Finals";
  if (gamesInRound === 4) return "Quarter-Finals";
  if (gamesInRound === 8) return "Round of 16";
  if (gamesInRound === 16) return "Round of 32";
  return `Round of ${gamesInRound * 2}`;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function FinalStandings() {
  const { id } = useParams<{ id: string }>();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
        format?: string;
        swissRounds?: number;
        elimCutoff?: number;
      };

      const players: Player[] = Array.isArray(data.players) ? data.players : [];
      const rounds: Round[] = Array.isArray(data.rounds) ? data.rounds : [];
      const completedRounds = rounds.filter((r) => r.status === "completed");

      // For swiss_elim, use bracket-based placement ranking
      const isSwissElim = data.format === "swiss_elim" && (data.swissRounds ?? 0) > 0;
      let standings: StandingRow[];

      if (isSwissElim) {
        standings = buildSwissElimRows(players, rounds, data.swissRounds!);
      } else {
        standings = computeStandings(players, completedRounds);
      }

      setRows(standings);
      setMeta({
        name: data.tournamentName ?? "Tournament",
        location: data.location,
        date: data.date,
        rounds: data.totalRounds ?? rounds.length,
        players,
        completedRounds,
        status: data.status ?? "completed",
        format: data.format ?? undefined,
        swissRounds: data.swissRounds ?? undefined,
        elimCutoff: data.elimCutoff ?? undefined,
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

  const isSwissElim = meta?.format === "swiss_elim";

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

  // ── Determine bracket cutoff for visual divider in table ────────────────────
  const bracketSize = meta?.elimCutoff ?? 0;

  return (
    <div className={`min-h-screen ${bg} flex flex-col`}>

      {/* ── Nav bar ──────────────────────────────────────────────────────────── */}
      <header className={`sticky top-0 z-30 otb-header-safe ${headerBg} border-b ${border} backdrop-blur-sm`}>
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
                {isSwissElim && (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${
                    isDark
                      ? "border-amber-500/30 text-amber-400 bg-amber-500/10"
                      : "border-amber-600/20 text-amber-700 bg-amber-50"
                  }`}>
                    Swiss + Elimination
                  </span>
                )}
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

                {/* Podium layout: 2nd (left, medium height) | 1st (centre, tallest) | 3rd (right, shortest) */}
                <div className="flex items-end justify-center gap-3 sm:gap-6">

                  {/* ── 2nd Place (Silver) ── */}
                  {top3[1] && (
                    <div className="flex flex-col items-center gap-2 flex-1 max-w-[120px]">
                      <PlayerAvatar
                        username={top3[1].player.username}
                        name={top3[1].player.name || top3[1].player.username}
                        platform={top3[1].player.platform ?? "chesscom"}
                        avatarUrl={top3[1].player.avatarUrl}
                        size={40}
                      />
                      <p className={`text-xs font-bold text-center leading-tight truncate w-full px-1 ${textMain}`}>
                        {top3[1].player.name || top3[1].player.username}
                      </p>
                      <p className={`text-xs font-semibold ${isDark ? "text-gray-300" : "text-gray-500"}`}>
                        {isSwissElim ? "Finalist" : `${top3[1].points} pts`}
                      </p>
                      <div className={`w-full rounded-t-xl flex flex-col items-center justify-center h-20 ${
                        isDark ? "bg-gray-600/40" : "bg-gray-200"
                      }`}>
                        <span className="text-xl leading-none">🥈</span>
                        <span className={`text-xs font-black mt-1 ${textMain}`}>#2</span>
                      </div>
                    </div>
                  )}

                  {/* ── 1st Place (Gold / Champion) ── */}
                  {top3[0] && (
                    <div className="flex flex-col items-center gap-2 flex-1 max-w-[140px]">
                      {/* Crown accent above avatar */}
                      <div className="relative">
                        <PlayerAvatar
                          username={top3[0].player.username}
                          name={top3[0].player.name || top3[0].player.username}
                          platform={top3[0].player.platform ?? "chesscom"}
                          avatarUrl={top3[0].player.avatarUrl}
                          size={56}
                        />
                        <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-base leading-none">👑</span>
                      </div>
                      <p className={`text-sm font-black text-center leading-tight truncate w-full px-1 ${textMain}`}>
                        {top3[0].player.name || top3[0].player.username}
                      </p>
                      <p className="text-xs font-bold text-amber-400">
                        {isSwissElim ? "Champion" : `${top3[0].points} pts`}
                      </p>
                      <div className={`w-full rounded-t-xl flex flex-col items-center justify-center h-28 ${
                        isDark ? "bg-amber-500/30" : "bg-amber-100"
                      }`}>
                        <span className="text-2xl leading-none">🥇</span>
                        <span className={`text-xs font-black mt-1 ${textMain}`}>#1</span>
                      </div>
                    </div>
                  )}

                  {/* ── 3rd Place (Bronze) ── */}
                  {top3[2] ? (
                    <div className="flex flex-col items-center gap-2 flex-1 max-w-[120px]">
                      <PlayerAvatar
                        username={top3[2].player.username}
                        name={top3[2].player.name || top3[2].player.username}
                        platform={top3[2].player.platform ?? "chesscom"}
                        avatarUrl={top3[2].player.avatarUrl}
                        size={40}
                      />
                      <p className={`text-xs font-bold text-center leading-tight truncate w-full px-1 ${textMain}`}>
                        {top3[2].player.name || top3[2].player.username}
                      </p>
                      <p className={`text-xs font-semibold text-orange-400`}>
                        {isSwissElim ? "3rd Place" : `${top3[2].points} pts`}
                      </p>
                      <div className={`w-full rounded-t-xl flex flex-col items-center justify-center h-16 ${
                        isDark ? "bg-orange-700/35 border border-orange-600/20" : "bg-orange-100"
                      }`}>
                        <span className="text-xl leading-none">🥉</span>
                        <span className={`text-xs font-black mt-1 ${textMain}`}>#3</span>
                      </div>
                    </div>
                  ) : (
                    /* Placeholder when only 2 players are in the tournament */
                    <div className="flex flex-col items-center gap-2 flex-1 max-w-[120px] opacity-30">
                      <div className={`w-10 h-10 rounded-full border-2 border-dashed ${
                        isDark ? "border-white/20" : "border-gray-300"
                      } flex items-center justify-center`}>
                        <span className="text-lg">🥉</span>
                      </div>
                      <p className={`text-xs font-semibold text-center ${textMuted}`}>3rd Place</p>
                      <p className={`text-[10px] ${textMuted}`}>TBD</p>
                      <div className={`w-full rounded-t-xl flex flex-col items-center justify-center h-16 ${
                        isDark ? "bg-white/05" : "bg-gray-100"
                      }`}>
                        <span className={`text-xs font-black ${textMuted}`}>#3</span>
                      </div>
                    </div>
                  )}

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
                  {isSwissElim
                    ? "Ranked by elimination bracket placement, then Swiss tiebreaks"
                    : "Tiebreak order: Pts \u2192 Bch \u2192 Bch1 \u2192 SB \u2192 Rating"}
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
                      <th className={`text-right text-xs font-bold uppercase tracking-wider px-2 py-2.5 w-12 ${thText}`}>
                        <span className="inline-flex items-center justify-end gap-0.5">Bch1<TiebreakTooltip type="bc1" position="below" /></span>
                      </th>
                      <th className={`text-right text-xs font-bold uppercase tracking-wider px-2 py-2.5 w-12 ${thText}`}>
                        <span className="inline-flex items-center justify-end gap-0.5">Bch<TiebreakTooltip type="buchholz" position="below" /></span>
                      </th>
                      <th className={`text-right text-xs font-bold uppercase tracking-wider px-2 py-2.5 w-12 ${thText}`}>
                        <span className="inline-flex items-center justify-end gap-0.5">SB<TiebreakTooltip type="sb" position="below" /></span>
                      </th>
                      <th className={`text-right text-xs font-bold uppercase tracking-wider px-2 py-2.5 w-8 ${thText}`}>W</th>
                      <th className={`text-right text-xs font-bold uppercase tracking-wider px-2 py-2.5 w-8 ${thText}`}>D</th>
                      <th className={`text-right text-xs font-bold uppercase tracking-wider px-2 py-2.5 w-8 ${thText}`}>L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => {
                      const isTop3 = row.rank <= 3;

                      // Show a divider between bracket players and Swiss-only players
                      const showBracketDivider = isSwissElim && bracketSize > 0 && idx === bracketSize;

                      return (
                        <>
                          {showBracketDivider && (
                            <tr key="bracket-divider">
                              <td colSpan={10} className={`px-4 py-2 ${isDark ? "bg-white/04" : "bg-gray-50"}`}>
                                <div className="flex items-center gap-3">
                                  <div className={`flex-1 h-px ${isDark ? "bg-white/10" : "bg-gray-200"}`} />
                                  <span className={`text-xs font-semibold uppercase tracking-wider ${textMuted}`}>
                                    Eliminated in Swiss Phase
                                  </span>
                                  <div className={`flex-1 h-px ${isDark ? "bg-white/10" : "bg-gray-200"}`} />
                                </div>
                              </td>
                            </tr>
                          )}
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
                              {row.player.elo > 0 ? row.player.elo : "\u2014"}
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
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Column legend */}
              <div className={`px-4 sm:px-5 py-3 border-t ${border} flex flex-wrap gap-x-4 gap-y-1`}>
                {[
                  ["Pts", "Points"],
                  ["Bch1", "Buchholz Cut-1"],
                  ["Bch", "Buchholz"],
                  ["SB", "Sonneborn-Berger"],
                  ["W / D / L", "Wins / Draws / Losses"],
                ].map(([abbr, full]) => (
                  <p key={abbr} className={`text-xs ${textMuted}`}>
                    <span className="font-semibold">{abbr}</span> = {full}
                  </p>
                ))}
                <p className={`text-xs ${textMuted}`}>Hover <span className="font-mono font-bold">?</span> on column headers for full explanations</p>
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
