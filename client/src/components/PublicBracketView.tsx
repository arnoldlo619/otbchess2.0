/**
 * PublicBracketView — Read-only spectator-facing elimination bracket tree
 *
 * Design: Apple-minimalist, chess.com green/white, Clash Display + Inter
 * Features:
 *   - Full bracket tree with round columns (QF / SF / Final / R16 / R32 / R64)
 *   - Match cards with player names, seeds, and result display
 *   - Bye cards auto-advance top seeds
 *   - Current round indicator (pulsing "Live" badge)
 *   - Winner highlight with green glow
 *   - Pending matches with amber "Pending" badge
 *   - Responsive horizontal scroll for wide brackets
 *   - Dark/light mode support
 *   - "Awaiting Swiss Results" state for swiss_elim before cutoff
 */

import { useMemo } from "react";
import { Trophy, Crown, Clock, ChevronRight } from "lucide-react";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { elimRoundLabel } from "@/lib/swiss";
import type { Player, Round, Game } from "@/lib/tournamentData";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PublicBracketViewProps {
  /** All rounds in the tournament (we filter to elimination rounds) */
  rounds: Round[];
  /** All players in the tournament */
  players: Player[];
  /** Players who qualified for the elimination bracket (seeded order) */
  elimPlayers?: Player[];
  /** The current active round number */
  currentRound: number;
  /** Round number where the elimination phase starts (1 for pure elimination, N+1 for swiss_elim) */
  elimStartRound?: number;
  /** Whether the tournament is in the swiss_elim cutoff phase (Swiss done, bracket not yet generated) */
  isAwaitingCutoff?: boolean;
  /** Format string for display */
  format?: string;
  /** Dark mode flag */
  isDark: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getPlayer(id: string, elimPlayers: Player[], players: Player[]): Player | undefined {
  return elimPlayers.find((p) => p.id === id) ?? players.find((p) => p.id === id);
}

function getSeedIndex(id: string, elimPlayers: Player[]): number {
  return elimPlayers.findIndex((p) => p.id === id);
}

function resultWinner(game: Game): "white" | "black" | null {
  if (game.whiteId === "BYE") return "black";
  if (game.blackId === "BYE") return "white";
  if (game.result === "1-0") return "white";
  if (game.result === "0-1") return "black";
  return null;
}

function isPending(game: Game): boolean {
  return game.result === "*";
}

// ─── MatchCard ────────────────────────────────────────────────────────────────

interface MatchCardProps {
  game: Game;
  players: Player[];
  elimPlayers: Player[];
  isCurrentRound: boolean;
  isDark: boolean;
  roundNumber: number;
}

function MatchCard({ game, players, elimPlayers, isCurrentRound, isDark, roundNumber: _roundNumber }: MatchCardProps) {
  const white = getPlayer(game.whiteId, elimPlayers, players);
  const black = getPlayer(game.blackId, elimPlayers, players);
  const winner = resultWinner(game);
  const pending = isPending(game);
  const isBye = game.whiteId === "BYE" || game.blackId === "BYE";

  const whiteSeedIdx = getSeedIndex(game.whiteId, elimPlayers);
  const blackSeedIdx = getSeedIndex(game.blackId, elimPlayers);
  const whiteSeed = whiteSeedIdx >= 0 ? whiteSeedIdx + 1 : null;
  const blackSeed = blackSeedIdx >= 0 ? blackSeedIdx + 1 : null;

  // Score display
  const whiteScore = game.result === "1-0" ? "1" : game.result === "½-½" ? "½" : game.result === "0-1" ? "0" : null;
  const blackScore = game.result === "0-1" ? "1" : game.result === "½-½" ? "½" : game.result === "1-0" ? "0" : null;

  const cardBase = isDark
    ? "bg-[oklch(0.22_0.06_145)] border-white/08"
    : "bg-white border-gray-100";

  const cardActive = isDark
    ? "bg-[oklch(0.24_0.07_145)] border-[#4CAF50]/30 shadow-[0_0_12px_rgba(76,175,80,0.12)]"
    : "bg-white border-[#3D6B47]/25 shadow-[0_2px_12px_rgba(61,107,71,0.10)]";

  const cardComplete = isDark
    ? "bg-[oklch(0.22_0.06_145)] border-white/06"
    : "bg-white border-gray-100";

  const cardStyle = pending && isCurrentRound ? cardActive : !pending ? cardComplete : cardBase;

  return (
    <div className={`rounded-xl border overflow-hidden transition-all duration-300 w-52 flex-shrink-0 ${cardStyle}`}>
      {/* Board number */}
      <div className={`flex items-center justify-between px-3 py-1.5 border-b ${
        isDark ? "border-white/06" : "border-gray-100"
      }`}>
        <span className={`text-[10px] font-bold uppercase tracking-wider ${
          isDark ? "text-white/30" : "text-gray-400"
        }`}>
          Board {game.board}
        </span>
        {pending && isCurrentRound && (
          <span className={`flex items-center gap-1 text-[10px] font-bold ${
            isDark ? "text-amber-400" : "text-amber-600"
          }`}>
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            Live
          </span>
        )}
        {!pending && (
          <span className={`text-[10px] font-bold ${
            isDark ? "text-[#4CAF50]/70" : "text-[#3D6B47]/70"
          }`}>
            Done
          </span>
        )}
        {pending && !isCurrentRound && (
          <span className={`text-[10px] font-semibold ${
            isDark ? "text-white/25" : "text-gray-300"
          }`}>
            Upcoming
          </span>
        )}
      </div>

      {/* White player row */}
      <PlayerRow
        player={isBye && game.whiteId === "BYE" ? undefined : white}
        isBye={game.whiteId === "BYE"}
        seed={whiteSeed}
        score={whiteScore}
        isWinner={winner === "white"}
        isPending={pending}
        isDark={isDark}
        side="white"
      />

      {/* Divider */}
      <div className={`h-px mx-3 ${isDark ? "bg-white/05" : "bg-gray-100"}`} />

      {/* Black player row */}
      <PlayerRow
        player={isBye && game.blackId === "BYE" ? undefined : black}
        isBye={game.blackId === "BYE"}
        seed={blackSeed}
        score={blackScore}
        isWinner={winner === "black"}
        isPending={pending}
        isDark={isDark}
        side="black"
      />
    </div>
  );
}

// ─── PlayerRow ────────────────────────────────────────────────────────────────

interface PlayerRowProps {
  player: Player | undefined;
  isBye: boolean;
  seed: number | null;
  score: string | null;
  isWinner: boolean;
  isPending: boolean;
  isDark: boolean;
  side: "white" | "black";
}

function PlayerRow({ player, isBye, seed, score, isWinner, isPending: _isPending, isDark, side: _side }: PlayerRowProps) {
  if (isBye) {
    return (
      <div className={`flex items-center gap-2 px-3 py-2.5 ${
        isDark ? "opacity-30" : "opacity-25"
      }`}>
        <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
          isDark ? "bg-white/08 text-white/40" : "bg-gray-100 text-gray-400"
        }`}>
          —
        </div>
        <span className={`text-xs font-semibold italic ${
          isDark ? "text-white/30" : "text-gray-300"
        }`}>BYE</span>
      </div>
    );
  }

  if (!player) {
    return (
      <div className={`flex items-center gap-2 px-3 py-2.5`}>
        <div className={`w-6 h-6 rounded-lg flex-shrink-0 ${
          isDark ? "bg-white/06" : "bg-gray-100"
        } animate-pulse`} />
        <div className={`h-3 w-20 rounded ${
          isDark ? "bg-white/06" : "bg-gray-100"
        } animate-pulse`} />
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 px-3 py-2.5 transition-colors duration-200 ${
      isWinner
        ? isDark
          ? "bg-[#3D6B47]/20"
          : "bg-[#3D6B47]/06"
        : ""
    }`}>
      {/* Seed badge */}
      {seed !== null && (
        <span className={`text-[9px] font-black w-4 text-center flex-shrink-0 ${
          isDark ? "text-white/25" : "text-gray-300"
        }`}>
          {seed}
        </span>
      )}

      {/* Avatar */}
      <PlayerAvatar
        name={player.name}
        username={player.username}
        size={22}
        platform={player.platform === "lichess" ? "lichess" : "chesscom"}
        avatarUrl={player.avatarUrl}
      />

      {/* Name */}
      <div className="flex-1 min-w-0">
        <span className={`text-xs font-semibold truncate block ${
          isWinner
            ? isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"
            : isDark ? "text-white/80" : "text-gray-800"
        }`}>
          {player.name}
        </span>
        {player.elo && (
          <span className={`text-[9px] font-medium ${
            isDark ? "text-white/25" : "text-gray-400"
          }`}>
            {player.elo}
          </span>
        )}
      </div>

      {/* Score */}
      {score !== null && (
        <span className={`text-sm font-black flex-shrink-0 w-5 text-center ${
          isWinner
            ? isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"
            : isDark ? "text-white/40" : "text-gray-400"
        }`}>
          {score}
        </span>
      )}

      {/* Winner crown */}
      {isWinner && (
        <Crown className={`w-3 h-3 flex-shrink-0 ${
          isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"
        }`} />
      )}
    </div>
  );
}

// ─── RoundColumn ─────────────────────────────────────────────────────────────

interface RoundColumnProps {
  roundNumber: number;
  games: Game[];
  players: Player[];
  elimPlayers: Player[];
  currentRound: number;
  isDark: boolean;
  label: string;
  isLast: boolean;
}

function RoundColumn({ roundNumber, games, players, elimPlayers, currentRound, isDark, label, isLast: _isLast }: RoundColumnProps) {
  const isCurrentRound = roundNumber === currentRound;
  const isCompleted = roundNumber < currentRound;

  return (
    <div className="flex flex-col gap-2 flex-shrink-0">
      {/* Round label */}
      <div className={`flex items-center gap-2 mb-1 px-1`}>
        <span
          className={`text-xs font-black uppercase tracking-wider ${
            isCurrentRound
              ? isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"
              : isCompleted
              ? isDark ? "text-white/35" : "text-gray-400"
              : isDark ? "text-white/20" : "text-gray-300"
          }`}
          style={{ fontFamily: "'Clash Display', sans-serif" }}
        >
          {label}
        </span>
        {isCurrentRound && (
          <span className={`flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
            isDark
              ? "bg-[#4CAF50]/15 text-[#4CAF50]"
              : "bg-[#3D6B47]/10 text-[#3D6B47]"
          }`}>
            <span className="w-1.5 h-1.5 rounded-full bg-[#4CAF50] animate-pulse" />
            Live
          </span>
        )}
        {isCompleted && (
          <span className={`text-[10px] font-semibold ${
            isDark ? "text-white/20" : "text-gray-300"
          }`}>
            ✓
          </span>
        )}
      </div>

      {/* Match cards stacked vertically */}
      <div className="flex flex-col gap-3">
        {games.map((game) => (
          <MatchCard
            key={game.id}
            game={game}
            players={players}
            elimPlayers={elimPlayers}
            isCurrentRound={isCurrentRound}
            isDark={isDark}
            roundNumber={roundNumber}
          />
        ))}
      </div>
    </div>
  );
}

// ─── PublicBracketView ────────────────────────────────────────────────────────

export function PublicBracketView({
  rounds,
  players,
  elimPlayers = [],
  currentRound,
  elimStartRound = 1,
  isAwaitingCutoff = false,
  format,
  isDark,
}: PublicBracketViewProps) {
  // Filter to elimination rounds only
  const elimRounds = useMemo(
    () => rounds.filter((r) => r.number >= elimStartRound),
    [rounds, elimStartRound]
  );

  // Compute round labels based on match count (players remaining)
  const roundLabels = useMemo(() => {
    const labels: Record<number, string> = {};
    for (const round of elimRounds) {
      const matchCount = round.games.filter((g) => g.whiteId !== "BYE").length;
      const byeCount = round.games.filter((g) => g.whiteId === "BYE").length;
      const totalPlayers = (matchCount + byeCount) * 2 - byeCount;
      labels[round.number] = elimRoundLabel(totalPlayers > 0 ? totalPlayers : round.games.length * 2);
    }
    return labels;
  }, [elimRounds]);

  // ── Awaiting cutoff state ──────────────────────────────────────────────────
  if (isAwaitingCutoff) {
    return (
      <div className={`flex flex-col items-center justify-center py-16 gap-4 rounded-2xl border ${
        isDark ? "bg-[oklch(0.22_0.06_145)] border-white/08" : "bg-white border-gray-100"
      }`}>
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
          isDark ? "bg-amber-500/10" : "bg-amber-50"
        }`}>
          <Clock className={`w-7 h-7 ${isDark ? "text-amber-400" : "text-amber-500"}`} />
        </div>
        <div className="text-center">
          <p className={`text-base font-black ${isDark ? "text-white/80" : "text-gray-800"}`}
            style={{ fontFamily: "'Clash Display', sans-serif" }}>
            Swiss Phase Complete
          </p>
          <p className={`text-sm mt-1 ${isDark ? "text-white/40" : "text-gray-500"}`}>
            The director is generating the elimination bracket.
          </p>
          <p className={`text-xs mt-1 ${isDark ? "text-white/25" : "text-gray-400"}`}>
            Check back shortly — this page updates live.
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span className={`text-xs font-semibold ${isDark ? "text-amber-400/70" : "text-amber-600"}`}>
            Awaiting bracket generation
          </span>
        </div>
      </div>
    );
  }

  //   // ── No bracket yet — Swiss still in progress ———————————————————————————————
  if (elimRounds.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center py-16 gap-4 rounded-2xl border ${
        isDark ? "bg-[oklch(0.22_0.06_145)] border-white/08" : "bg-white border-gray-100"
      }`}>
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
          isDark ? "bg-amber-500/10" : "bg-amber-50"
        }`}>
          <Trophy className={`w-7 h-7 ${isDark ? "text-amber-400" : "text-amber-500"}`} />
        </div>
        <div className="text-center">
          <p className={`text-base font-black ${isDark ? "text-white/80" : "text-gray-800"}`}
            style={{ fontFamily: "'Clash Display', sans-serif" }}>
            Swiss Phase in Progress
          </p>
          <p className={`text-sm mt-1 ${isDark ? "text-white/40" : "text-gray-500"}`}>
            The elimination bracket will appear here automatically after the final Swiss round.
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span className={`text-xs font-semibold ${isDark ? "text-amber-400/70" : "text-amber-600"}`}>
            Live · updates automatically
          </span>
        </div>
      </div>
    );
  }

  // ── Full bracket tree ─────────────────────────────────────────────────────
  const seededPlayers = elimPlayers.length > 0 ? elimPlayers : players;

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
          isDark ? "bg-[#3D6B47]/20" : "bg-[#3D6B47]/10"
        }`}>
          <Trophy className={`w-4 h-4 ${isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"}`} />
        </div>
        <div>
          <h3
            className={`text-sm font-black ${isDark ? "text-white/80" : "text-gray-800"}`}
            style={{ fontFamily: "'Clash Display', sans-serif" }}
          >
            Elimination Bracket
          </h3>
          <p className={`text-xs ${isDark ? "text-white/35" : "text-gray-400"}`}>
            {seededPlayers.length} players · {elimRounds.length} round{elimRounds.length !== 1 ? "s" : ""}
            {format === "swiss_elim" ? " · Swiss → Elimination" : ""}
          </p>
        </div>
      </div>

      {/* Bracket scroll container */}
      <div className="overflow-x-auto pb-4 -mx-1 px-1">
        <div className="flex gap-6 min-w-max">
          {elimRounds.map((round, idx) => (
            <div key={round.number} className="flex items-start gap-6">
              <RoundColumn
                roundNumber={round.number}
                games={round.games}
                players={players}
                elimPlayers={seededPlayers}
                currentRound={currentRound}
                isDark={isDark}
                label={roundLabels[round.number] ?? `Round ${round.number}`}
                isLast={idx === elimRounds.length - 1}
              />
              {/* Connector arrow between rounds */}
              {idx < elimRounds.length - 1 && (
                <div className="flex items-center self-stretch">
                  <ChevronRight className={`w-4 h-4 flex-shrink-0 ${
                    isDark ? "text-white/15" : "text-gray-200"
                  }`} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Champion banner — shown when the final is complete */}
      {(() => {
        const finalRound = elimRounds[elimRounds.length - 1];
        if (!finalRound || finalRound.games.length !== 1) return null;
        const finalGame = finalRound.games[0];
        const champion = resultWinner(finalGame);
        if (!champion) return null;
        const championId = champion === "white" ? finalGame.whiteId : finalGame.blackId;
        const championPlayer = getPlayer(championId, seededPlayers, players);
        if (!championPlayer) return null;
        return (
          <div className={`flex items-center gap-4 px-5 py-4 rounded-2xl border animate-in fade-in slide-in-from-bottom-2 ${
            isDark
              ? "bg-amber-400/08 border-amber-400/20"
              : "bg-amber-50 border-amber-200"
          }`} style={{ animationDuration: "400ms" }}>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 ${
              isDark ? "bg-amber-400/15" : "bg-amber-100"
            }`}>
              👑
            </div>
            <div>
              <p className={`text-[10px] font-bold uppercase tracking-widest ${
                isDark ? "text-amber-400/60" : "text-amber-600/70"
              }`}>
                Tournament Champion
              </p>
              <p
                className={`text-lg font-black ${isDark ? "text-amber-300" : "text-amber-800"}`}
                style={{ fontFamily: "'Clash Display', sans-serif" }}
              >
                {championPlayer.name}
              </p>
              {championPlayer.elo && (
                <p className={`text-xs ${isDark ? "text-amber-400/50" : "text-amber-600/60"}`}>
                  {championPlayer.elo} ELO
                </p>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export default PublicBracketView;
