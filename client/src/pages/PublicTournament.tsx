/**
 * PublicTournament — /live/:slug
 *
 * A lightweight, read-only public tournament dashboard for attendees.
 * Accessed by scanning a QR code — no login required.
 *
 * Features:
 *   - Tournament hero header with status, round progress, venue/date
 *   - Spotlight search (player name or chess.com username)
 *   - Follow-player with localStorage persistence
 *   - Pairings view (current round, with round tabs)
 *   - Standings overview
 *   - Post-event conversion CTAs when tournament is completed
 */

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useParams, Link } from "wouter";
import {
  Search, X, Star, StarOff, Trophy, Users, MapPin, Calendar,
  ChevronRight, ChevronDown, Crown, Swords, Hash, UserPlus,
  Mail, ArrowRight, ExternalLink,
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NavLogo } from "@/components/NavLogo";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import type { Player, Game, Round, Result } from "@/lib/tournamentData";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Server-precomputed standing row — no client-side computeStandings needed. */
interface PublicStandingRow {
  playerId: string;
  name: string;
  username: string;
  elo: number;
  title?: string;
  avatarUrl?: string;
  rank: number;
  points: number;
  buchholz: number;
  wins: number;
  draws: number;
  losses: number;
}

interface PublicTournamentData {
  tournamentId: string;
  status: string;
  currentRound: number;
  totalRounds: number;
  tournamentName: string;
  format: string;
  venue: string;
  date: string;
  players: Player[];
  rounds: Round[];
  standings: PublicStandingRow[];
  updatedAt: string;
}

// ─── Follow State (localStorage) ──────────────────────────────────────────────

const FOLLOW_KEY_PREFIX = "otb-follow-";

function getFollowedPlayerId(tournamentId: string): string | null {
  try {
    return localStorage.getItem(`${FOLLOW_KEY_PREFIX}${tournamentId}`);
  } catch {
    return null;
  }
}

function persistFollowedPlayer(tournamentId: string, playerId: string | null) {
  try {
    if (playerId) {
      localStorage.setItem(`${FOLLOW_KEY_PREFIX}${tournamentId}`, playerId);
    } else {
      localStorage.removeItem(`${FOLLOW_KEY_PREFIX}${tournamentId}`);
    }
  } catch { /* silent */ }
}

// ─── Analytics Tracking ──────────────────────────────────────────────────────

function trackEvent(tournamentId: string, eventType: string, metadata?: Record<string, unknown>) {
  try {
    fetch("/api/analytics/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tournamentId, eventType, metadata }),
    }).catch(() => {});
  } catch { /* fire-and-forget */ }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getResultLabel(result: Result, perspective: "white" | "black") {
  if (result === "*") return { label: "Live", color: "text-amber-500" };
  if (result === "½-½") return { label: "Draw", color: "text-muted-foreground" };
  const isWin = (perspective === "white" && result === "1-0") || (perspective === "black" && result === "0-1");
  return isWin ? { label: "Win", color: "text-emerald-500" } : { label: "Loss", color: "text-red-400" };
}

function formatLabel(f: string): string {
  if (f === "doubleswiss") return "Double Swiss";
  if (f === "roundrobin") return "Round Robin";
  if (f === "elimination") return "Elimination";
  return f.charAt(0).toUpperCase() + f.slice(1);
}

function scoreFraction(pts: number): string {
  return pts % 1 !== 0 ? `${Math.floor(pts)}½` : `${pts}`;
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status, currentRound, totalRounds }: { status: string; currentRound: number; totalRounds: number }) {
  if (status === "completed") {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground bg-muted border border-border px-3 py-1.5 rounded-full">
        <Trophy className="w-3.5 h-3.5" />
        Completed
      </span>
    );
  }
  if (status === "in_progress" || status === "paused") {
    return (
      <span className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        Live · Round {currentRound} of {totalRounds}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-600 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-full">
      <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
      Registration Open
    </span>
  );
}

// ─── Round Progress Dots ──────────────────────────────────────────────────────

function RoundDots({ currentRound, totalRounds, isDark }: { currentRound: number; totalRounds: number; isDark: boolean }) {
  return (
    <div className="flex gap-1 flex-wrap">
      {Array.from({ length: totalRounds }).map((_, i) => (
        <div
          key={i}
          className={`h-2 w-5 rounded-full transition-all ${
            i < currentRound - 1
              ? "bg-[#3D6B47]"
              : i === currentRound - 1
              ? "bg-[#3D6B47] animate-pulse"
              : isDark ? "bg-white/15" : "bg-[#EEEED2]"
          }`}
        />
      ))}
    </div>
  );
}

// ─── ELO Badge ────────────────────────────────────────────────────────────────

function ELOBadge({ elo }: { elo: number }) {
  if (!elo || elo <= 0) return null;
  return (
    <span className="text-xs font-mono font-semibold text-muted-foreground bg-muted/50 border border-border/50 px-1.5 py-0.5 rounded">
      {elo}
    </span>
  );
}

// ─── Title Badge ──────────────────────────────────────────────────────────────

function TitleBadge({ title }: { title: string }) {
  return (
    <span className="text-xs font-bold text-[#3D6B47] bg-[#3D6B47]/10 border border-[#3D6B47]/20 px-1.5 py-0.5 rounded">
      {title}
    </span>
  );
}

// ─── Spotlight Search ─────────────────────────────────────────────────────────

function SpotlightSearch({
  players,
  onSelect,
  isDark,
}: {
  players: Player[];
  onSelect: (player: Player) => void;
  isDark: boolean;
}) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase().trim();
    return players
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.username?.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [query, players]);

  const showResults = focused && query.trim().length > 0;

  return (
    <div className="relative w-full max-w-lg mx-auto">
      <div
        className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all duration-200 ${
          focused
            ? isDark
              ? "border-[#3D6B47]/60 bg-[oklch(0.25_0.07_145)] ring-2 ring-[#3D6B47]/20"
              : "border-[#3D6B47]/40 bg-white ring-2 ring-[#3D6B47]/10"
            : isDark
            ? "border-white/10 bg-[oklch(0.22_0.06_145)]"
            : "border-[#EEEED2] bg-white"
        }`}
      >
        <Search className={`w-5 h-5 flex-shrink-0 transition-colors ${focused ? "text-[#3D6B47]" : "text-muted-foreground"}`} />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 200)}
          placeholder="Search by name or chess.com username..."
          className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground text-sm outline-none"
          autoComplete="off"
        />
        {query && (
          <button
            onClick={() => { setQuery(""); inputRef.current?.focus(); }}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Results dropdown */}
      {showResults && (
        <div
          className={`absolute top-full left-0 right-0 mt-2 rounded-2xl border shadow-xl z-50 overflow-hidden ${
            isDark
              ? "border-white/10 bg-[oklch(0.22_0.06_145)]"
              : "border-[#EEEED2] bg-white"
          }`}
        >
          {results.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <p className="text-sm text-muted-foreground">No players found for "{query}"</p>
              <p className="text-xs text-muted-foreground mt-1">Try a different name or username</p>
            </div>
          ) : (
            results.map((player) => (
              <button
                key={player.id}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onSelect(player);
                  setQuery("");
                  setFocused(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                  isDark ? "hover:bg-white/05" : "hover:bg-[#F0F5EE]"
                }`}
              >
                <PlayerAvatar username={player.username} name={player.name} size={36} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground truncate">{player.name}</span>
                    {player.title && <TitleBadge title={player.title} />}
                  </div>
                  {player.username && (
                    <span className="text-xs text-muted-foreground">@{player.username}</span>
                  )}
                </div>
                <ELOBadge elo={player.elo} />
                <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Followed Player Card ─────────────────────────────────────────────────────

function FollowedPlayerCard({
  player,
  standings,
  rounds,
  currentRound,
  players,
  onUnfollow,
  isDark,
}: {
  player: Player;
  standings: PublicStandingRow[];
  rounds: Round[];
  currentRound: number;
  players: Player[];
  onUnfollow: () => void;
  isDark: boolean;
}) {
  const standingRow = standings.find((r) => r.playerId === player.id);
  const rank = standingRow?.rank ?? 0;
  const playerMap = useMemo(() => {
    const m = new Map<string, Player>();
    players.forEach((p) => m.set(p.id, p));
    return m;
  }, [players]);

  // Current round game
  const currentRoundData = rounds.find((r) => r.number === currentRound);
  const currentGame = currentRoundData?.games.find(
    (g) => g.whiteId === player.id || g.blackId === player.id
  );

  const opponentId = currentGame
    ? currentGame.whiteId === player.id
      ? currentGame.blackId
      : currentGame.whiteId
    : null;
  const opponent = opponentId ? playerMap.get(opponentId) : null;
  const perspective = currentGame?.whiteId === player.id ? "white" : "black";

  // Round history
  const roundHistory = rounds
    .filter((r) => r.number <= currentRound)
    .map((r) => {
      const game = r.games.find((g) => g.whiteId === player.id || g.blackId === player.id);
      if (!game) return null;
      const persp = game.whiteId === player.id ? "white" : "black";
      const oppId = persp === "white" ? game.blackId : game.whiteId;
      return {
        round: r.number,
        opponent: playerMap.get(oppId),
        result: game.result,
        perspective: persp as "white" | "black",
        board: game.board,
      };
    })
    .filter(Boolean);

  return (
    <div
      className={`rounded-2xl border overflow-hidden transition-all duration-300 ${
        isDark
          ? "border-[#3D6B47]/40 bg-[oklch(0.22_0.06_145)]"
          : "border-[#3D6B47]/30 bg-white"
      }`}
    >
      {/* Header */}
      <div
        className={`px-5 py-4 flex items-center gap-3 border-b ${
          isDark ? "border-white/08 bg-[#3D6B47]/10" : "border-[#EEEED2] bg-[#F0F8F2]"
        }`}
      >
        <Star className="w-4 h-4 text-[#3D6B47] flex-shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider text-[#3D6B47]">Following</span>
        <div className="flex-1" />
        <button
          onClick={onUnfollow}
          className={`text-xs font-medium px-2.5 py-1 rounded-lg transition-colors ${
            isDark
              ? "text-white/50 hover:text-white/80 hover:bg-white/08"
              : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          }`}
        >
          Unfollow
        </button>
      </div>

      {/* Player info */}
      <div className="px-5 py-4">
        <div className="flex items-center gap-3 mb-4">
          <PlayerAvatar username={player.username} name={player.name} size={48} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-lg font-bold text-foreground" style={{ fontFamily: "'Clash Display', sans-serif" }}>
                {player.name}
              </span>
              {player.title && <TitleBadge title={player.title} />}
            </div>
            {player.username && (
              <span className="text-sm text-muted-foreground">@{player.username}</span>
            )}
          </div>
          <ELOBadge elo={player.elo} />
        </div>

        {/* Stats row */}
        <div className={`grid grid-cols-3 gap-3 mb-4`}>
          <div className={`text-center px-3 py-2.5 rounded-xl ${isDark ? "bg-white/05" : "bg-[#F0F5EE]"}`}>
            <p className="text-lg font-bold text-foreground" style={{ fontFamily: "'Clash Display', sans-serif" }}>
              #{rank || "—"}
            </p>
            <p className="text-xs text-muted-foreground">Rank</p>
          </div>
          <div className={`text-center px-3 py-2.5 rounded-xl ${isDark ? "bg-white/05" : "bg-[#F0F5EE]"}`}>
            <p className="text-lg font-bold text-foreground" style={{ fontFamily: "'Clash Display', sans-serif" }}>
              {standingRow ? scoreFraction(standingRow.points) : "0"}
            </p>
            <p className="text-xs text-muted-foreground">Points</p>
          </div>
          <div className={`text-center px-3 py-2.5 rounded-xl ${isDark ? "bg-white/05" : "bg-[#F0F5EE]"}`}>
            <p className="text-lg font-bold text-foreground" style={{ fontFamily: "'Clash Display', sans-serif" }}>
              {standingRow ? `${standingRow.wins}/${standingRow.draws}/${standingRow.losses}` : "—"}
            </p>
            <p className="text-xs text-muted-foreground">W/D/L</p>
          </div>
        </div>

        {/* Current opponent */}
        {currentGame && (
          <div className={`rounded-xl border p-4 mb-4 ${isDark ? "border-white/10 bg-white/03" : "border-[#EEEED2] bg-[#F9FAF8]"}`}>
            <div className="flex items-center gap-2 mb-2">
              <Swords className="w-4 h-4 text-[#3D6B47]" />
              <span className="text-xs font-bold uppercase tracking-wider text-[#3D6B47]">
                Current Game · Board {currentGame.board}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className={`w-4 h-4 rounded-full border-2 ${perspective === "white" ? "bg-white border-gray-300" : "bg-gray-800 border-gray-600"}`} />
              <span className="text-sm font-medium text-foreground">Playing as {perspective === "white" ? "White" : "Black"}</span>
              <span className="text-muted-foreground">vs</span>
              {opponent ? (
                <span className="text-sm font-semibold text-foreground">{opponent.name}</span>
              ) : (
                <span className="text-sm text-muted-foreground italic">BYE</span>
              )}
              {currentGame.result === "*" ? (
                <span className="ml-auto flex items-center gap-1 text-xs font-semibold text-amber-500">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  In Progress
                </span>
              ) : (
                <span className={`ml-auto text-sm font-bold ${getResultLabel(currentGame.result, perspective).color}`}>
                  {getResultLabel(currentGame.result, perspective).label}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Round history */}
        {roundHistory.length > 0 && (
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Round History</p>
            <div className="space-y-1.5">
              {roundHistory.map((rh) => {
                if (!rh) return null;
                const { label, color } = rh.result === "*"
                  ? { label: "Live", color: "text-amber-500" }
                  : getResultLabel(rh.result, rh.perspective);
                return (
                  <div
                    key={rh.round}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${
                      isDark ? "bg-white/03" : "bg-[#F9FAF8]"
                    }`}
                  >
                    <span className="text-xs font-mono text-muted-foreground w-6">R{rh.round}</span>
                    <div className={`w-3 h-3 rounded-full border ${rh.perspective === "white" ? "bg-white border-gray-300" : "bg-gray-800 border-gray-600"}`} />
                    <span className="flex-1 truncate text-foreground">
                      {rh.opponent?.name ?? "BYE"}
                    </span>
                    {rh.board > 0 && (
                      <span className="text-xs text-muted-foreground">Bd {rh.board}</span>
                    )}
                    <span className={`font-semibold ${color}`}>{label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Pairings Section ─────────────────────────────────────────────────────────

function PairingsSection({
  rounds,
  currentRound,
  totalRounds,
  players,
  followedPlayerId,
  isDark,
}: {
  rounds: Round[];
  currentRound: number;
  totalRounds: number;
  players: Player[];
  followedPlayerId: string | null;
  isDark: boolean;
}) {
  const [activeRound, setActiveRound] = useState(currentRound);
  useEffect(() => setActiveRound(currentRound), [currentRound]);

  const round = rounds.find((r) => r.number === activeRound);
  const playerMap = useMemo(() => {
    const m = new Map<string, Player>();
    players.forEach((p) => m.set(p.id, p));
    return m;
  }, [players]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Clash Display', sans-serif" }}>
          Pairings
        </h3>
        <span className="text-sm text-muted-foreground">{round?.games.length ?? 0} boards</span>
      </div>

      {/* Round tabs */}
      {rounds.length > 1 && (
        <div className={`flex gap-1.5 p-1.5 rounded-2xl overflow-x-auto scrollbar-none mb-4 ${isDark ? "bg-[oklch(0.25_0.07_145)]" : "bg-[#F0F5EE]"}`}>
          {rounds.map((r) => (
            <button
              key={r.number}
              onClick={() => setActiveRound(r.number)}
              className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                r.number === activeRound
                  ? isDark
                    ? "bg-[#3D6B47] text-white shadow-md"
                    : "bg-[#3D6B47] text-white shadow-md"
                  : isDark
                  ? "text-white/50 hover:text-white/80 hover:bg-white/08"
                  : "text-[#6B7280] hover:text-[#374151] hover:bg-white"
              }`}
            >
              R{r.number}
            </button>
          ))}
        </div>
      )}

      {/* Games */}
      {!round || round.games.length === 0 ? (
        <div className={`text-center py-10 rounded-2xl border ${isDark ? "border-white/08 bg-white/03" : "border-[#EEEED2] bg-[#F9FAF8]"}`}>
          <Swords className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Pairings not yet published</p>
        </div>
      ) : (
        <div className="space-y-2">
          {round.games.map((game) => {
            const white = playerMap.get(game.whiteId);
            const black = playerMap.get(game.blackId);
            const isFollowed = followedPlayerId === game.whiteId || followedPlayerId === game.blackId;
            const isLive = game.result === "*";

            return (
              <div
                key={game.id}
                className={`rounded-xl border px-4 py-3 transition-all relative overflow-hidden ${
                  isFollowed
                    ? isDark
                      ? "border-[#3D6B47]/50 bg-[#3D6B47]/08 ring-1 ring-[#3D6B47]/20"
                      : "border-[#3D6B47]/30 bg-[#F0F8F2] ring-1 ring-[#3D6B47]/15"
                    : isDark
                    ? "border-white/08 bg-[oklch(0.25_0.07_145)] hover:border-white/15"
                    : "border-[#EEEED2] bg-white hover:border-[#3D6B47]/20"
                }`}
              >
                {isFollowed && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#3D6B47] rounded-r-sm" />
                )}
                <div className="flex items-center gap-3">
                  {/* Board number */}
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    isDark ? "bg-white/08 text-white/50" : "bg-[#F0F5EE] text-[#6B7280]"
                  }`}>
                    {game.board}
                  </div>

                  {/* Players */}
                  <div className="flex-1 min-w-0">
                    {/* White */}
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-3 h-3 rounded-full bg-white border border-gray-300 flex-shrink-0" />
                      <span className={`text-sm font-semibold truncate ${
                        followedPlayerId === game.whiteId ? "text-[#3D6B47]" : "text-foreground"
                      }`}>
                        {white?.name ?? "BYE"}
                      </span>
                      {white?.title && <TitleBadge title={white.title} />}
                      <ELOBadge elo={white?.elo ?? 0} />
                    </div>
                    {/* Black */}
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-gray-800 border border-gray-600 flex-shrink-0" />
                      <span className={`text-sm font-semibold truncate ${
                        followedPlayerId === game.blackId ? "text-[#3D6B47]" : "text-foreground"
                      }`}>
                        {black?.name ?? "BYE"}
                      </span>
                      {black?.title && <TitleBadge title={black.title} />}
                      <ELOBadge elo={black?.elo ?? 0} />
                    </div>
                  </div>

                  {/* Result */}
                  <div className="flex-shrink-0 text-right">
                    {isLive ? (
                      <span className="flex items-center gap-1 text-xs font-semibold text-amber-500">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                        Live
                      </span>
                    ) : (
                      <span className="text-sm font-bold text-foreground font-mono">
                        {game.result}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Standings Section ────────────────────────────────────────────────────────

function StandingsSection({
  standings,
  followedPlayerId,
  onFollowPlayer,
  isDark,
}: {
  standings: PublicStandingRow[];
  followedPlayerId: string | null;
  onFollowPlayer: (playerId: string) => void;
  isDark: boolean;
}) {
  const standingRows = standings;
  const [expanded, setExpanded] = useState(true);

  const medalColor = (rank: number) => {
    if (rank === 1) return "text-amber-400";
    if (rank === 2) return "text-slate-400";
    if (rank === 3) return "text-amber-600";
    return "text-muted-foreground";
  };

  return (
    <div>
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between mb-4"
      >
        <h3 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Clash Display', sans-serif" }}>
          Standings
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{standingRows.length} players</span>
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${expanded ? "" : "-rotate-90"}`} />
        </div>
      </button>

      {expanded && (
        <div className="space-y-2">
          {/* Header */}
          <div className={`grid grid-cols-[2rem_1fr_auto_auto] gap-3 items-center px-4 py-2.5 rounded-xl text-xs font-bold text-muted-foreground uppercase tracking-wider ${
            isDark ? "bg-white/05" : "bg-[#F0F5EE]"
          }`}>
            <span>#</span>
            <span>Player</span>
            <span className="text-center w-12">Pts</span>
            <span className="text-right w-14">Buch.</span>
          </div>

          {standingRows.map((row) => {
            const rank = row.rank;
            const isFollowed = row.playerId === followedPlayerId;
            const isLeader = rank === 1;

            return (
              <button
                key={row.playerId}
                onClick={() => onFollowPlayer(row.playerId)}
                className={`w-full grid grid-cols-[2rem_1fr_auto_auto] gap-3 items-center px-4 py-3.5 rounded-2xl border transition-all duration-200 hover:scale-[1.005] relative overflow-hidden text-left ${
                  isFollowed
                    ? isDark
                      ? "border-[#3D6B47]/50 bg-[#3D6B47]/10 ring-1 ring-[#3D6B47]/30"
                      : "border-[#3D6B47]/30 bg-[#F0F8F2] ring-1 ring-[#3D6B47]/20"
                    : isLeader
                    ? isDark
                      ? "border-amber-500/30 bg-amber-500/05"
                      : "border-amber-400/40 bg-amber-50/60"
                    : isDark
                    ? "border-white/08 bg-[oklch(0.25_0.07_145)] hover:border-white/15"
                    : "border-[#EEEED2] bg-white hover:border-[#3D6B47]/20"
                }`}
              >
                {isFollowed && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#3D6B47] rounded-r-sm" />
                )}
                <span className={`text-base font-bold ${medalColor(rank)}`}>
                  {rank <= 3 ? ["🥇", "🥈", "🥉"][rank - 1] : rank}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-bold text-foreground truncate">{row.name}</span>
                    {row.title && <TitleBadge title={row.title} />}
                  </div>
                  <div className="flex items-center gap-2">
                    <ELOBadge elo={row.elo} />
                    <span className="text-xs text-muted-foreground">
                      {row.wins}W {row.draws}D {row.losses}L
                    </span>
                  </div>
                </div>
                <div className="w-12 flex justify-center">
                  <span className="font-mono font-bold text-lg text-foreground">
                    {scoreFraction(row.points)}
                  </span>
                </div>
                <div className="w-14 text-right">
                  <span className="text-sm font-mono text-muted-foreground">{row.buchholz.toFixed(1)}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Completed Hero ─────────────────────────────────────────────────────────

function CompletedHero({
  data,
  standings,
  isDark,
}: {
  data: PublicTournamentData;
  standings: PublicStandingRow[];
  isDark: boolean;
}) {
  const podium = standings.slice(0, 3);
  const medalEmoji = ["\uD83E\uDD47", "\uD83E\uDD48", "\uD83E\uDD49"];

  return (
    <section>
      {/* Celebration header */}
      <div className={`rounded-2xl border overflow-hidden mb-6 ${
        isDark ? "border-[#3D6B47]/40 bg-[oklch(0.22_0.06_145)]" : "border-[#3D6B47]/20 bg-white"
      }`}>
        <div className={`px-5 py-6 text-center border-b ${
          isDark ? "border-white/08 bg-[#3D6B47]/15" : "border-[#EEEED2] bg-[#F0F8F2]"
        }`}>
          <div className="flex justify-center mb-3">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
              isDark ? "bg-[#3D6B47]/30" : "bg-[#3D6B47]/10"
            }`}>
              <Trophy className="w-7 h-7 text-[#3D6B47]" />
            </div>
          </div>
          <h1
            className="text-2xl sm:text-3xl font-bold text-foreground mb-1"
            style={{ fontFamily: "'Clash Display', sans-serif" }}
          >
            {data.tournamentName}
          </h1>
          <p className="text-sm text-muted-foreground mb-3">Tournament Complete</p>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {data.venue && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                {data.venue}
              </span>
            )}
            {data.date && (
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                {data.date}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              {data.players.length} players
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5" />
              {data.totalRounds} rounds · {formatLabel(data.format)}
            </span>
          </div>
        </div>

        {/* Podium */}
        {podium.length > 0 && (
          <div className="px-5 py-4">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 text-center">Final Podium</p>
            <div className="space-y-2">
              {podium.map((row, i) => (
                <div
                  key={row.playerId}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                    i === 0
                      ? isDark
                        ? "bg-amber-500/08 border border-amber-500/20"
                        : "bg-amber-50/80 border border-amber-200/60"
                      : isDark
                      ? "bg-white/03 border border-white/06"
                      : "bg-[#F9FAF8] border border-[#EEEED2]"
                  }`}
                >
                  <span className="text-xl w-8 text-center">{medalEmoji[i]}</span>
                  <PlayerAvatar username={row.username} name={row.name} size={36} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-foreground truncate">{row.name}</span>
                      {row.title && <TitleBadge title={row.title} />}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {row.wins}W {row.draws}D {row.losses}L
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-foreground font-mono" style={{ fontFamily: "'Clash Display', sans-serif" }}>
                      {scoreFraction(row.points)}
                    </span>
                    <p className="text-xs text-muted-foreground">pts</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

// ─── Player Performance Card ─────────────────────────────────────────────────

function PlayerPerformanceCard({
  player,
  standings,
  rounds,
  players,
  tournamentName,
  venue,
  date,
  totalRounds,
  totalPlayers,
  isDark,
}: {
  player: Player;
  standings: PublicStandingRow[];
  rounds: Round[];
  players: Player[];
  tournamentName: string;
  venue: string;
  date: string;
  totalRounds: number;
  totalPlayers: number;
  isDark: boolean;
}) {
  const standingRow = standings.find((r) => r.playerId === player.id);
  const rank = standingRow?.rank ?? 0;
  const playerMap = useMemo(() => {
    const m = new Map<string, Player>();
    players.forEach((p) => m.set(p.id, p));
    return m;
  }, [players]);

  // Round-by-round timeline
  const roundTimeline = rounds.map((r) => {
    const game = r.games.find((g) => g.whiteId === player.id || g.blackId === player.id);
    if (!game) return null;
    const persp = game.whiteId === player.id ? "white" : "black";
    const oppId = persp === "white" ? game.blackId : game.whiteId;
    return {
      round: r.number,
      opponent: playerMap.get(oppId),
      result: game.result,
      perspective: persp as "white" | "black",
      board: game.board,
    };
  }).filter(Boolean);

  // Performance label
  const getPerformanceLabel = () => {
    if (!standingRow) return null;
    const pct = standingRow.points / totalRounds;
    if (rank === 1) return { text: "Champion", color: "text-amber-500 bg-amber-500/10 border-amber-500/20" };
    if (rank <= 3) return { text: "Podium Finish", color: "text-amber-600 bg-amber-500/08 border-amber-500/15" };
    if (pct >= 0.75) return { text: "Strong Performance", color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" };
    if (pct >= 0.5) return { text: "Solid Result", color: "text-blue-500 bg-blue-500/10 border-blue-500/20" };
    return { text: "Well Played", color: "text-[#3D6B47] bg-[#3D6B47]/10 border-[#3D6B47]/20" };
  };
  const perfLabel = getPerformanceLabel();

  return (
    <div className={`rounded-2xl border overflow-hidden ${
      isDark ? "border-[#3D6B47]/40 bg-[oklch(0.22_0.06_145)]" : "border-[#3D6B47]/20 bg-white"
    }`}>
      {/* Card header — green accent */}
      <div className={`px-5 py-5 ${
        isDark ? "bg-[#3D6B47]/15" : "bg-[#F0F8F2]"
      }`}>
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="w-4 h-4 text-[#3D6B47]" />
          <span className="text-xs font-bold uppercase tracking-wider text-[#3D6B47]">Player Performance Card</span>
        </div>
        <div className="flex items-center gap-4">
          <PlayerAvatar username={player.username} name={player.name} size={56} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-xl font-bold text-foreground" style={{ fontFamily: "'Clash Display', sans-serif" }}>
                {player.name}
              </span>
              {player.title && <TitleBadge title={player.title} />}
            </div>
            {player.username && (
              <span className="text-sm text-muted-foreground">@{player.username}</span>
            )}
            <ELOBadge elo={player.elo} />
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="px-5 py-4">
        {perfLabel && (
          <div className="flex justify-center mb-4">
            <span className={`inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-1.5 rounded-full border ${perfLabel.color}`}>
              {perfLabel.text}
            </span>
          </div>
        )}

        <div className="grid grid-cols-4 gap-2 mb-5">
          <div className={`text-center px-2 py-3 rounded-xl ${isDark ? "bg-white/05" : "bg-[#F0F5EE]"}`}>
            <p className="text-xl font-bold text-foreground" style={{ fontFamily: "'Clash Display', sans-serif" }}>#{rank}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Place</p>
          </div>
          <div className={`text-center px-2 py-3 rounded-xl ${isDark ? "bg-white/05" : "bg-[#F0F5EE]"}`}>
            <p className="text-xl font-bold text-foreground" style={{ fontFamily: "'Clash Display', sans-serif" }}>
              {standingRow ? scoreFraction(standingRow.points) : "0"}
            </p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Score</p>
          </div>
          <div className={`text-center px-2 py-3 rounded-xl ${isDark ? "bg-white/05" : "bg-[#F0F5EE]"}`}>
            <p className="text-xl font-bold text-foreground" style={{ fontFamily: "'Clash Display', sans-serif" }}>
              {standingRow ? `${standingRow.wins}/${standingRow.draws}/${standingRow.losses}` : "—"}
            </p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">W/D/L</p>
          </div>
          <div className={`text-center px-2 py-3 rounded-xl ${isDark ? "bg-white/05" : "bg-[#F0F5EE]"}`}>
            <p className="text-xl font-bold text-foreground" style={{ fontFamily: "'Clash Display', sans-serif" }}>
              {totalPlayers}
            </p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Field</p>
          </div>
        </div>

        {/* Round-by-round timeline */}
        {roundTimeline.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Round by Round</p>
            <div className="space-y-1.5">
              {roundTimeline.map((rh) => {
                if (!rh) return null;
                const { label, color } = getResultLabel(rh.result, rh.perspective);
                return (
                  <div
                    key={rh.round}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm ${
                      isDark ? "bg-white/03" : "bg-[#F9FAF8]"
                    }`}
                  >
                    <span className="text-xs font-mono text-muted-foreground w-7">R{rh.round}</span>
                    <div className={`w-3 h-3 rounded-full border flex-shrink-0 ${rh.perspective === "white" ? "bg-white border-gray-300" : "bg-gray-800 border-gray-600"}`} />
                    <span className="flex-1 truncate text-foreground">
                      {rh.opponent?.name ?? "BYE"}
                    </span>
                    {rh.board > 0 && (
                      <span className="text-xs text-muted-foreground">Bd {rh.board}</span>
                    )}
                    <span className={`font-semibold ${color}`}>{label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Event info footer */}
        <div className={`border-t pt-4 mt-2 ${isDark ? "border-white/08" : "border-[#EEEED2]"}`}>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>{tournamentName}</span>
            {venue && <><span className="opacity-30">·</span><span>{venue}</span></>}
            {date && <><span className="opacity-30">·</span><span>{date}</span></>}
          </div>
          <p className="text-[10px] text-muted-foreground/60 mt-2">chessotb.club</p>
        </div>
      </div>
    </div>
  );
}

// ─── Personal Recap (Followed Player Post-Event) ─────────────────────────────

function PersonalRecap({
  player,
  standings,
  rounds,
  players,
  data,
  onUnfollow,
  isDark,
}: {
  player: Player;
  standings: PublicStandingRow[];
  rounds: Round[];
  players: Player[];
  data: PublicTournamentData;
  onUnfollow: () => void;
  isDark: boolean;
}) {
  return (
    <div className="space-y-4">
      {/* Recap header */}
      <div className={`rounded-2xl border overflow-hidden ${
        isDark ? "border-[#3D6B47]/40 bg-[oklch(0.22_0.06_145)]" : "border-[#3D6B47]/20 bg-white"
      }`}>
        <div className={`px-5 py-4 flex items-center gap-3 border-b ${
          isDark ? "border-white/08 bg-[#3D6B47]/15" : "border-[#EEEED2] bg-[#F0F8F2]"
        }`}>
          <Star className="w-4 h-4 text-[#3D6B47] flex-shrink-0" />
          <span className="text-sm font-bold text-[#3D6B47]" style={{ fontFamily: "'Clash Display', sans-serif" }}>
            Your Tournament Recap
          </span>
          <div className="flex-1" />
          <button
            onClick={onUnfollow}
            className={`text-xs font-medium px-2.5 py-1 rounded-lg transition-colors ${
              isDark
                ? "text-white/50 hover:text-white/80 hover:bg-white/08"
                : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            }`}
          >
            Clear
          </button>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm text-muted-foreground">
            Great effort, <span className="font-semibold text-foreground">{player.name}</span>. Here's how your tournament went.
          </p>
        </div>
      </div>

      {/* Performance Card */}
      <PlayerPerformanceCard
        player={player}
        standings={standings}
        rounds={rounds}
        players={players}
        tournamentName={data.tournamentName}
        venue={data.venue}
        date={data.date}
        totalRounds={data.totalRounds}
        totalPlayers={data.players.length}
        isDark={isDark}
      />
    </div>
  );
}

// ─── Post-Event CTAs ─────────────────────────────────────────────────────────

function PostEventCTAs({
  isDark,
  tournamentName,
  tournamentId,
  hasFollowedPlayer,
}: {
  isDark: boolean;
  tournamentName: string;
  tournamentId: string;
  hasFollowedPlayer: boolean;
}) {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    try {
      const existing = JSON.parse(localStorage.getItem("otb-email-captures") ?? "[]");
      existing.push({ email, tournament: tournamentName, capturedAt: new Date().toISOString() });
      localStorage.setItem("otb-email-captures", JSON.stringify(existing));
    } catch { /* silent */ }
    setSubmitted(true);
    trackEvent(tournamentId, "email_capture", { email: email.trim() });
  };

  return (
    <div className="space-y-4">
      {/* Email Capture */}
      <div className={`rounded-2xl border overflow-hidden ${
        isDark ? "border-white/10 bg-[oklch(0.22_0.06_145)]" : "border-[#EEEED2] bg-white"
      }`}>
        <div className={`px-5 py-4 border-b ${
          isDark ? "border-white/08 bg-[#3D6B47]/10" : "border-[#EEEED2] bg-[#F0F8F2]"
        }`}>
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-[#3D6B47]" />
            <h3 className="text-sm font-bold text-foreground">
              {hasFollowedPlayer ? "Get Your Performance Card by Email" : "Get Tournament Results by Email"}
            </h3>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {hasFollowedPlayer
              ? "We'll send your full performance card and tournament results."
              : "Receive the final standings and results in your inbox."
            }
          </p>
        </div>
        <div className="p-5">
          {!submitted ? (
            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className={`flex-1 px-4 py-2.5 rounded-xl border text-sm bg-transparent outline-none transition-colors ${
                  isDark
                    ? "border-white/15 text-white placeholder:text-white/30 focus:border-[#3D6B47]/50"
                    : "border-[#EEEED2] text-foreground placeholder:text-gray-400 focus:border-[#3D6B47]/40"
                }`}
              />
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-[#3D6B47] text-white text-sm font-semibold hover:bg-[#2A4A32] transition-colors active:scale-95"
              >
                Send
              </button>
            </form>
          ) : (
            <div className={`flex items-center gap-3 px-4 py-3 rounded-xl ${
              isDark ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-emerald-50 border border-emerald-200"
            }`}>
              <span className="text-emerald-500 text-lg">\u2713</span>
              <span className="text-sm font-medium text-emerald-600">We'll send your results shortly</span>
            </div>
          )}
        </div>
      </div>

      {/* Action Cards */}
      <div className={`rounded-2xl border overflow-hidden ${
        isDark ? "border-white/10 bg-[oklch(0.22_0.06_145)]" : "border-[#EEEED2] bg-white"
      }`}>
        <div className={`px-5 py-4 border-b ${
          isDark ? "border-white/08" : "border-[#EEEED2]"
        }`}>
          <h3 className="text-sm font-bold text-foreground">Continue Your Chess Journey</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Take the next step</p>
        </div>
        <div className="p-3 space-y-1">
            <Link
            href="/profile"
            onClick={() => trackEvent(tournamentId, "cta_click", { cta: "save_results" })}
            className={`flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all hover:scale-[1.005] active:scale-[0.995] ${
              isDark
                ? "hover:bg-white/05"
                : "hover:bg-[#F0F5EE]"
            }`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
              isDark ? "bg-[#3D6B47]/20" : "bg-[#3D6B47]/10"
            }`}>
              <UserPlus className="w-4.5 h-4.5 text-[#3D6B47]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">Save Your Results</p>
              <p className="text-xs text-muted-foreground">Create an account to track your tournament history and progress</p>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          </Link>

          <Link
            href="/clubs"
            onClick={() => trackEvent(tournamentId, "cta_click", { cta: "join_club" })}
            className={`flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all hover:scale-[1.005] active:scale-[0.995] ${
              isDark
                ? "hover:bg-white/05"
                : "hover:bg-[#F0F5EE]"
            }`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
              isDark ? "bg-[#3D6B47]/20" : "bg-[#3D6B47]/10"
            }`}>
              <Crown className="w-4.5 h-4.5 text-[#3D6B47]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">Join the Club</p>
              <p className="text-xs text-muted-foreground">Stay connected for future events and community updates</p>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          </Link>

          <a
            href="https://chessotb.club"
            onClick={() => trackEvent(tournamentId, "cta_click", { cta: "explore_chessotb" })}
            className={`flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all hover:scale-[1.005] active:scale-[0.995] ${
              isDark
                ? "hover:bg-white/05"
                : "hover:bg-[#F0F5EE]"
            }`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
              isDark ? "bg-[#3D6B47]/20" : "bg-[#3D6B47]/10"
            }`}>
              <ExternalLink className="w-4.5 h-4.5 text-[#3D6B47]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">Explore ChessOTB</p>
              <p className="text-xs text-muted-foreground">Discover more tournaments, battles, and your chess community</p>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          </a>
        </div>
      </div>
    </div>
  );
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton({ isDark }: { isDark: boolean }) {
  const shimmer = isDark ? "bg-white/08" : "bg-gray-200";
  return (
    <div className={`min-h-screen ${isDark ? "bg-[oklch(0.20_0.06_145)]" : "bg-white"}`}>
      <div className="container max-w-2xl mx-auto px-4 py-20 space-y-6">
        <div className={`h-8 w-64 rounded-lg ${shimmer} animate-pulse`} />
        <div className={`h-4 w-40 rounded ${shimmer} animate-pulse`} />
        <div className={`h-12 w-full rounded-2xl ${shimmer} animate-pulse`} />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={`h-16 w-full rounded-xl ${shimmer} animate-pulse`} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Error State ──────────────────────────────────────────────────────────────

function ErrorState({ isDark, message }: { isDark: boolean; message: string }) {
  return (
    <div className={`min-h-screen flex items-center justify-center ${isDark ? "bg-[oklch(0.20_0.06_145)]" : "bg-white"}`}>
      <div className="text-center max-w-md px-6">
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 ${isDark ? "bg-red-500/10" : "bg-red-50"}`}>
          <X className="w-8 h-8 text-red-400" />
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2" style={{ fontFamily: "'Clash Display', sans-serif" }}>
          Tournament Not Found
        </h2>
        <p className="text-sm text-muted-foreground mb-6">{message}</p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-[#3D6B47] text-white text-sm font-semibold hover:bg-[#2A4A32] transition-colors active:scale-95"
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PublicTournament() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { slug } = useParams<{ slug: string }>();

  const [data, setData] = useState<PublicTournamentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [followedPlayerId, setFollowedPlayerId] = useState<string | null>(null);
  const etagRef = useRef<string | null>(null);

  // Mobile tab state
  type Tab = "pairings" | "standings";
  const [activeTab, setActiveTab] = useState<Tab>("pairings");

  // Load followed player from localStorage
  useEffect(() => {
    if (data?.tournamentId) {
      setFollowedPlayerId(getFollowedPlayerId(data.tournamentId));
    }
  }, [data?.tournamentId]);

  // Fetch tournament data with ETag conditional request
  const fetchData = useCallback(async () => {
    if (!slug) return;
    try {
      const headers: Record<string, string> = {};
      if (etagRef.current) {
        headers["If-None-Match"] = etagRef.current;
      }
      const res = await fetch(`/api/public/tournament/${encodeURIComponent(slug)}`, { headers });
      // 304 Not Modified — data hasn't changed, skip state update
      if (res.status === 304) {
        setLoading(false);
        return;
      }
      if (!res.ok) {
        if (res.status === 404) {
          setError("This tournament is not publicly available or doesn't exist.");
        } else {
          setError("Failed to load tournament data.");
        }
        setLoading(false);
        return;
      }
      // Store ETag for next conditional request
      const newEtag = res.headers.get("etag");
      if (newEtag) etagRef.current = newEtag;
      const json = await res.json();
      setData(json);
      setError(null);
    } catch {
      setError("Network error. Please check your connection.");
    }
    setLoading(false);
  }, [slug]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Poll every 15 seconds for updates (lightweight, no SSE needed for public)
  useEffect(() => {
    if (error || !slug) return;
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData, error, slug]);

  // Refresh on visibility change (phone unlock)
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === "visible") fetchData();
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [fetchData]);


  // Follow/unfollow handler
  const handleFollow = useCallback(
    (playerId: string) => {
      if (!data) return;
      const newId = followedPlayerId === playerId ? null : playerId;
      setFollowedPlayerId(newId);
      persistFollowedPlayer(data.tournamentId, newId);
      const player = data.players.find((p) => p.id === playerId);
      trackEvent(data.tournamentId, newId ? "follow" : "unfollow", {
        playerName: player?.name ?? playerId,
      });
    },
    [data, followedPlayerId]
  );

  // Standings are precomputed server-side — no client computation needed
  const standings = data?.standings ?? [];

  const followedPlayer = useMemo(
    () => (followedPlayerId && data ? data.players.find((p) => p.id === followedPlayerId) ?? null : null),
    [followedPlayerId, data]
  );

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) return <LoadingSkeleton isDark={isDark} />;
  if (error || !data) return <ErrorState isDark={isDark} message={error ?? "Unknown error"} />;

  const isCompleted = data.status === "completed";

  return (
    <div className={`min-h-screen ${isDark ? "bg-[oklch(0.20_0.06_145)]" : "bg-white"}`}>
      {/* ── Sticky Nav ─────────────────────────────────────────────────────────── */}
      <nav
        className={`sticky top-0 z-40 backdrop-blur-xl border-b transition-colors ${
          isDark
            ? "bg-[oklch(0.20_0.06_145)]/90 border-white/08"
            : "bg-white/90 border-[#EEEED2]"
        }`}
      >
        <div className="container max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <NavLogo />
          <div className="flex items-center gap-2">
            <StatusBadge status={data.status} currentRound={data.currentRound} totalRounds={data.totalRounds} />
            <ThemeToggle />
          </div>
        </div>
      </nav>

      {/* ── Content ────────────────────────────────────────────────────────────── */}
      <main className="container max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Hero — switches to CompletedHero when tournament is finalized */}
        {isCompleted ? (
          <CompletedHero data={data} standings={standings} isDark={isDark} />
        ) : (
          <section>
            <h1
              className="text-2xl sm:text-3xl font-bold text-foreground mb-2"
              style={{ fontFamily: "'Clash Display', sans-serif" }}
            >
              {data.tournamentName}
            </h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground mb-3">
              {data.venue && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" />
                  {data.venue}
                </span>
              )}
              {data.date && (
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  {data.date}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                {data.players.length} players
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5" />
                {formatLabel(data.format)}
              </span>
            </div>
            <RoundDots currentRound={data.currentRound} totalRounds={data.totalRounds} isDark={isDark} />
          </section>
        )}
        {/* Spotlight Search */}        <section>
          <SpotlightSearch
            players={data.players}
            onSelect={(player) => {
              handleFollow(player.id);
              trackEvent(data.tournamentId, "search", { playerName: player.name });
            }}
            isDark={isDark}
          />
        </section>

        {/* Followed Player — switches to PersonalRecap when completed */}
        {followedPlayer && (
          <section>
            {isCompleted ? (
              <PersonalRecap
                player={followedPlayer}
                standings={standings}
                rounds={data.rounds}
                players={data.players}
                data={data}
                onUnfollow={() => handleFollow(followedPlayer.id)}
                isDark={isDark}
              />
            ) : (
              <FollowedPlayerCard
                player={followedPlayer}
                standings={standings}
                rounds={data.rounds}
                currentRound={data.currentRound}
                players={data.players}
                onUnfollow={() => handleFollow(followedPlayer.id)}
                isDark={isDark}
              />
            )}
          </section>
        )}

        {/* Mobile Tabs */}
        <div className={`flex gap-1.5 p-1.5 rounded-2xl sm:hidden ${isDark ? "bg-[oklch(0.25_0.07_145)]" : "bg-[#F0F5EE]"}`}>
          {(["pairings", "standings"] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all capitalize ${
                tab === activeTab
                  ? "bg-[#3D6B47] text-white shadow-md"
                  : isDark
                  ? "text-white/50 hover:text-white/80"
                  : "text-[#6B7280] hover:text-[#374151]"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Pairings — visible on mobile only when tab active, always on desktop */}
        <section className={`${activeTab !== "pairings" ? "hidden sm:block" : ""}`}>
          <PairingsSection
            rounds={data.rounds}
            currentRound={data.currentRound}
            totalRounds={data.totalRounds}
            players={data.players}
            followedPlayerId={followedPlayerId}
            isDark={isDark}
          />
        </section>

        {/* Standings — visible on mobile only when tab active, always on desktop */}
        <section className={`${activeTab !== "standings" ? "hidden sm:block" : ""}`}>
          <StandingsSection
            standings={standings}
            followedPlayerId={followedPlayerId}
            onFollowPlayer={handleFollow}
            isDark={isDark}
          />
        </section>

        {/* Post-Event CTAs */}
        {isCompleted && (
          <section>
            <PostEventCTAs isDark={isDark} tournamentName={data.tournamentName} tournamentId={data.tournamentId} hasFollowedPlayer={!!followedPlayer} />
          </section>
        )}

        {/* Footer */}
        <footer className="text-center py-8 border-t border-border/30">
          <p className="text-xs text-muted-foreground">
            Powered by{" "}
            <a href="https://chessotb.club" className="text-[#3D6B47] hover:underline font-medium">
              ChessOTB
            </a>
          </p>
        </footer>
      </main>
    </div>
  );
}
