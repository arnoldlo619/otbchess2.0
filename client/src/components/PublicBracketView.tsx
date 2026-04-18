/**
 * PublicBracketView — Read-only spectator-facing elimination bracket tree
 *
 * Matches the new EliminationBracketView design:
 *   - Left-to-right horizontal bracket tree
 *   - SVG connector lines between rounds
 *   - Compact player cards with seed badge, name, ELO, score
 *   - Green left-accent on winning player row
 *   - Live / Done / Upcoming round labels
 *   - Champion banner when final is decided
 *   - Awaiting-cutoff and Swiss-in-progress empty states
 */

import { useMemo } from "react";
import { Trophy, Crown, Clock } from "lucide-react";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { elimRoundLabel } from "@/lib/swiss";
import type { Player, Round, Game } from "@/lib/tournamentData";
import { MobileBracketCarousel } from "./MobileBracketCarousel";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PublicBracketViewProps {
  rounds: Round[];
  players: Player[];
  elimPlayers?: Player[];
  currentRound: number;
  elimStartRound?: number;
  isAwaitingCutoff?: boolean;
  format?: string;
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

function seedBadgeClass(seed: number | null, isDark: boolean): string {
  if (seed === 1) return isDark ? "bg-amber-400/25 text-amber-300 border-amber-400/30" : "bg-amber-50 text-amber-600 border-amber-200";
  if (seed === 2) return isDark ? "bg-slate-400/20 text-slate-300 border-slate-400/25" : "bg-slate-50 text-slate-500 border-slate-200";
  if (seed === 3) return isDark ? "bg-orange-400/20 text-orange-300 border-orange-400/25" : "bg-orange-50 text-orange-500 border-orange-200";
  return isDark ? "bg-white/08 text-white/40 border-white/10" : "bg-gray-50 text-gray-400 border-gray-200";
}

// Card dimensions — must match EliminationBracketView
const CARD_H = 72;
const CARD_GAP = 12;
const COL_GAP = 48;
const COL_W = 208;

// ─── Player Row ───────────────────────────────────────────────────────────────

function PlayerRow({
  player,
  seed,
  score,
  isWinner,
  isLoser,
  isByeRow,
  isDark,
}: {
  player: Player | undefined;
  seed: number | null;
  score: string | null;
  isWinner: boolean;
  isLoser: boolean;
  isByeRow: boolean;
  isDark: boolean;
}) {
  const loserText = isDark ? "text-white/28" : "text-gray-300";
  const winnerBg = isDark ? "bg-[#3D6B47]/25" : "bg-[#3D6B47]/07";

  if (isByeRow) {
    return (
      <div className={`flex items-center gap-2 px-3 py-2.5 opacity-30`}>
        <span className={`text-[10px] font-bold w-6 text-center ${isDark ? "text-white/30" : "text-gray-300"}`}>—</span>
        <span className={`text-xs italic ${isDark ? "text-white/30" : "text-gray-300"}`}>BYE</span>
      </div>
    );
  }

  if (!player) {
    return (
      <div className="flex items-center gap-2 px-3 py-2.5">
        <div className={`w-[22px] h-[18px] rounded flex-shrink-0 ${isDark ? "bg-white/06" : "bg-gray-100"} animate-pulse`} />
        <div className={`h-3 w-20 rounded ${isDark ? "bg-white/06" : "bg-gray-100"} animate-pulse`} />
      </div>
    );
  }

  return (
    <div className={`relative flex items-center gap-2 px-3 py-2.5 transition-colors ${isWinner ? winnerBg : ""}`}>
      {/* Green left accent on winner */}
      {isWinner && (
        <div className="absolute left-0 top-0 bottom-0 w-0.5 rounded-r-full bg-[#4CAF50]" />
      )}
      {/* Seed badge */}
      <span
        title={`Swiss seed #${seed}`}
        className={`text-[9px] font-black flex-shrink-0 w-[22px] h-[18px] flex items-center justify-center rounded border ${seedBadgeClass(seed, isDark)}`}
      >
        {seed != null ? `#${seed}` : "?"}
      </span>
      {/* Avatar */}
      <PlayerAvatar
        name={player.name}
        username={player.username}
        size={20}
        platform={player.platform === "lichess" ? "lichess" : "chesscom"}
        avatarUrl={player.avatarUrl}
      />
      {/* Name + ELO */}
      <div className="flex-1 min-w-0">
        <span className={`text-xs font-semibold truncate block leading-tight ${
          isLoser ? loserText : isWinner
            ? isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"
            : isDark ? "text-white/88" : "text-gray-900"
        }`}>
          {player.name}
        </span>
        {player.elo && (
          <span className={`text-[9px] ${isDark ? "text-white/28" : "text-gray-400"}`}>
            {player.elo}
          </span>
        )}
      </div>
      {/* Score */}
      {score !== null && (
        <span className={`text-sm font-black tabular-nums flex-shrink-0 w-4 text-right ${
          isWinner ? (isDark ? "text-[#4CAF50]" : "text-[#3D6B47]") : loserText
        }`}>
          {score}
        </span>
      )}
      {/* Crown */}
      {isWinner && <Crown className={`w-3 h-3 flex-shrink-0 ${isDark ? "text-amber-400" : "text-amber-500"}`} strokeWidth={2} />}
    </div>
  );
}

// ─── Match Card ───────────────────────────────────────────────────────────────

function MatchCard({
  game,
  players,
  elimPlayers,
  isCurrentRound,
  isDark,
}: {
  game: Game;
  players: Player[];
  elimPlayers: Player[];
  isCurrentRound: boolean;
  isDark: boolean;
}) {
  const white = getPlayer(game.whiteId, elimPlayers, players);
  const black = getPlayer(game.blackId, elimPlayers, players);
  const winner = resultWinner(game);
  const pending = game.result === "*";
  const isBye = game.whiteId === "BYE" || game.blackId === "BYE";

  const whiteSeedIdx = getSeedIndex(game.whiteId, elimPlayers);
  const blackSeedIdx = getSeedIndex(game.blackId, elimPlayers);
  const whiteSeed = whiteSeedIdx >= 0 ? whiteSeedIdx + 1 : null;
  const blackSeed = blackSeedIdx >= 0 ? blackSeedIdx + 1 : null;

  const whiteScore = game.result === "1-0" ? "1" : game.result === "½-½" ? "½" : game.result === "0-1" ? "0" : null;
  const blackScore = game.result === "0-1" ? "1" : game.result === "½-½" ? "½" : game.result === "1-0" ? "0" : null;

  const cardBorder = isCurrentRound && pending
    ? isDark ? "border-[#4CAF50]/35 shadow-[0_0_0_1px_rgba(76,175,80,0.12)]" : "border-[#3D6B47]/35"
    : isDark ? "border-white/08" : "border-gray-150";

  return (
    <div
      className={`rounded-xl border overflow-hidden transition-all duration-200 ${
        isDark ? "bg-[oklch(0.22_0.06_145)]" : "bg-white"
      } ${cardBorder} ${isBye ? "opacity-50" : ""}`}
      style={{ width: COL_W }}
    >
      <PlayerRow
        player={game.whiteId === "BYE" ? undefined : white}
        seed={whiteSeed}
        score={whiteScore}
        isWinner={winner === "white"}
        isLoser={winner === "black"}
        isByeRow={game.whiteId === "BYE"}
        isDark={isDark}
      />
      <div className={`h-px mx-2.5 ${isDark ? "bg-white/06" : "bg-gray-100"}`} />
      <PlayerRow
        player={game.blackId === "BYE" ? undefined : black}
        seed={blackSeed}
        score={blackScore}
        isWinner={winner === "black"}
        isLoser={winner === "white"}
        isByeRow={game.blackId === "BYE"}
        isDark={isDark}
      />
    </div>
  );
}

// ─── SVG Bracket Connector ────────────────────────────────────────────────────

function BracketConnector({
  matchCount,
  nextCount,
  isDark,
}: {
  matchCount: number;
  nextCount: number;
  isDark: boolean;
}) {
  const lineColor = isDark ? "rgba(76,175,80,0.18)" : "rgba(61,107,71,0.15)";
  const dotColor = isDark ? "rgba(76,175,80,0.35)" : "rgba(61,107,71,0.30)";

  const leftColH = matchCount * CARD_H + Math.max(0, matchCount - 1) * CARD_GAP;
  const rightColH = nextCount * CARD_H + Math.max(0, nextCount - 1) * CARD_GAP;
  const svgH = Math.max(leftColH, rightColH);
  const svgW = COL_GAP;

  const pairs = Math.floor(matchCount / 2);
  const paths: React.ReactNode[] = [];

  for (let i = 0; i < pairs; i++) {
    const topMatchCenter = i * 2 * (CARD_H + CARD_GAP) + CARD_H / 2;
    const botMatchCenter = (i * 2 + 1) * (CARD_H + CARD_GAP) + CARD_H / 2;
    const midY = (topMatchCenter + botMatchCenter) / 2;
    const rightOffset = (svgH - rightColH) / 2;
    const rightMatchCenter = rightOffset + i * (CARD_H + CARD_GAP) + CARD_H / 2;

    paths.push(
      <g key={i}>
        <path d={`M 0 ${topMatchCenter} H ${svgW * 0.45} V ${midY}`}
          stroke={lineColor} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d={`M 0 ${botMatchCenter} H ${svgW * 0.45} V ${midY}`}
          stroke={lineColor} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d={`M ${svgW * 0.45} ${midY} H ${svgW * 0.55} V ${rightMatchCenter} H ${svgW}`}
          stroke={lineColor} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={svgW * 0.45} cy={midY} r="2.5" fill={dotColor} />
      </g>
    );
  }

  if (matchCount % 2 !== 0) {
    const lastMatchCenter = (matchCount - 1) * (CARD_H + CARD_GAP) + CARD_H / 2;
    const rightOffset = (svgH - rightColH) / 2;
    const rightMatchCenter = rightOffset + Math.floor(matchCount / 2) * (CARD_H + CARD_GAP) + CARD_H / 2;
    paths.push(
      <path key="odd"
        d={`M 0 ${lastMatchCenter} H ${svgW * 0.5} V ${rightMatchCenter} H ${svgW}`}
        stroke={lineColor} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    );
  }

  return (
    <div className="flex-shrink-0 self-start" style={{ width: svgW, height: svgH }}>
      <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} fill="none" overflow="visible">
        {paths}
      </svg>
    </div>
  );
}

// ─── Round Column ─────────────────────────────────────────────────────────────

function RoundColumn({
  roundNumber,
  games,
  players,
  elimPlayers,
  currentRound,
  isDark,
  label,
  verticalOffset,
}: {
  roundNumber: number;
  games: Game[];
  players: Player[];
  elimPlayers: Player[];
  currentRound: number;
  isDark: boolean;
  label: string;
  verticalOffset: number;
}) {
  const isCurrentRound = roundNumber === currentRound;
  const isCompleted = roundNumber < currentRound;

  return (
    <div className="flex flex-col flex-shrink-0" style={{ width: COL_W }}>
      {/* Round label */}
      <div className="flex items-center gap-2 mb-3 h-7">
        <span
          className={`text-[11px] font-black uppercase tracking-wider ${
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
          <span className={`flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
            isDark ? "bg-[#4CAF50]/15 text-[#4CAF50]" : "bg-[#3D6B47]/10 text-[#3D6B47]"
          }`}>
            <span className="w-1 h-1 rounded-full bg-[#4CAF50] animate-pulse" />
            Live
          </span>
        )}
        {isCompleted && (
          <span className={`text-[9px] font-semibold ${isDark ? "text-white/20" : "text-gray-300"}`}>✓</span>
        )}
      </div>

      {/* Cards */}
      <div className="flex flex-col" style={{ gap: CARD_GAP, marginTop: verticalOffset }}>
        {games.map((game) => (
          <MatchCard
            key={game.id}
            game={game}
            players={players}
            elimPlayers={elimPlayers}
            isCurrentRound={isCurrentRound}
            isDark={isDark}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Champion Card ────────────────────────────────────────────────────────────

function ChampionCard({
  game,
  players,
  elimPlayers,
  isDark,
}: {
  game: Game | undefined;
  players: Player[];
  elimPlayers: Player[];
  isDark: boolean;
}) {
  const winner = game ? resultWinner(game) : null;
  const champId = winner === "white" ? game!.whiteId : winner === "black" ? game!.blackId : null;
  const champ = champId ? getPlayer(champId, elimPlayers, players) : null;
  const seed = champId ? (getSeedIndex(champId, elimPlayers) + 1 || null) : null;

  return (
    <div
      className={`flex flex-col items-center justify-center rounded-xl border p-4 gap-3 flex-shrink-0 ${
        champ
          ? isDark ? "bg-[oklch(0.28_0.10_145)] border-amber-400/30" : "bg-amber-50 border-amber-200"
          : isDark ? "bg-[oklch(0.20_0.05_145)] border-white/06" : "bg-gray-50 border-gray-150"
      }`}
      style={{ width: 140 }}
    >
      <div className="relative">
        <Trophy className={`w-7 h-7 ${champ ? "text-amber-400" : isDark ? "text-white/15" : "text-gray-200"}`} />
        {champ && <Crown className="w-3.5 h-3.5 text-amber-400 absolute -top-1.5 -right-1.5" strokeWidth={2} />}
      </div>
      {champ ? (
        <div className="text-center">
          <p className={`text-[9px] font-bold uppercase tracking-widest mb-1 ${isDark ? "text-amber-400/70" : "text-amber-600"}`}>
            Champion
          </p>
          <p className={`text-sm font-black leading-tight ${isDark ? "text-white" : "text-gray-900"}`}
            style={{ fontFamily: "'Clash Display', sans-serif" }}>
            {champ.name}
          </p>
          {seed && (
            <p className={`text-[9px] mt-0.5 ${isDark ? "text-white/35" : "text-gray-400"}`}>
              Seed #{seed}{champ.elo ? ` · ${champ.elo}` : ""}
            </p>
          )}
        </div>
      ) : (
        <p className={`text-[10px] font-semibold text-center ${isDark ? "text-white/25" : "text-gray-300"}`}>
          Champion TBD
        </p>
      )}
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
  const elimRounds = useMemo(
    () => rounds.filter((r) => r.number >= elimStartRound),
    [rounds, elimStartRound]
  );

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

  // ── Awaiting cutoff ────────────────────────────────────────────────────────
  if (isAwaitingCutoff) {
    return (
      <div className={`flex flex-col items-center justify-center py-16 gap-4 rounded-2xl border ${
        isDark ? "bg-[oklch(0.22_0.06_145)] border-white/08" : "bg-white border-gray-100"
      }`}>
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isDark ? "bg-amber-500/10" : "bg-amber-50"}`}>
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

  // ── No bracket yet ─────────────────────────────────────────────────────────
  if (elimRounds.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center py-16 gap-4 rounded-2xl border ${
        isDark ? "bg-[oklch(0.22_0.06_145)] border-white/08" : "bg-white border-gray-100"
      }`}>
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isDark ? "bg-amber-500/10" : "bg-amber-50"}`}>
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

  // ── Full bracket tree ──────────────────────────────────────────────────────
  const seededPlayers = elimPlayers.length > 0 ? elimPlayers : players;
  const maxMatches = Math.max(...elimRounds.map((r) => r.games.length));

  function colOffset(matchCount: number): number {
    const colH = matchCount * CARD_H + Math.max(0, matchCount - 1) * CARD_GAP;
    const maxH = maxMatches * CARD_H + Math.max(0, maxMatches - 1) * CARD_GAP;
    return (maxH - colH) / 2;
  }

  const finalRound = elimRounds[elimRounds.length - 1];
  const finalGame = finalRound?.games[0];

  return (
    <div className="flex flex-col gap-4">
      {/* ── Mobile carousel (hidden on md+) ── */}
      <div className="md:hidden">
        <MobileBracketCarousel
          rounds={elimRounds}
          players={players}
          elimPlayers={seededPlayers}
          currentRound={currentRound}
          allResultsIn={false}
          isDark={isDark}
          elimStartRound={elimStartRound}
        />
      </div>

      {/* ── Desktop bracket tree (hidden on mobile) ── */}
      <div className="hidden md:flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
          isDark ? "bg-[#3D6B47]/20" : "bg-[#3D6B47]/10"
        }`}>
          <Trophy className={`w-4 h-4 ${isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"}`} />
        </div>
        <div>
          <h3 className={`text-sm font-black ${isDark ? "text-white/80" : "text-gray-800"}`}
            style={{ fontFamily: "'Clash Display', sans-serif" }}>
            Elimination Bracket
          </h3>
          <p className={`text-xs ${isDark ? "text-white/35" : "text-gray-400"}`}>
            {seededPlayers.length} players · {elimRounds.length} round{elimRounds.length !== 1 ? "s" : ""}
            {format === "swiss_elim" ? " · Swiss → Elimination" : ""}
          </p>
        </div>
      </div>

      {/* Bracket scroll container */}
      <div className="overflow-x-auto pb-3 -mx-1 px-1" style={{ scrollbarWidth: "thin" }}>
        <div className="flex items-start min-w-max">
          {elimRounds.map((round, idx) => {
            const isLast = idx === elimRounds.length - 1;
            const nextRound = elimRounds[idx + 1];

            return (
              <div key={round.number} className="flex items-start">
                <RoundColumn
                  roundNumber={round.number}
                  games={round.games}
                  players={players}
                  elimPlayers={seededPlayers}
                  currentRound={currentRound}
                  isDark={isDark}
                  label={roundLabels[round.number] ?? `Round ${round.number}`}
                  verticalOffset={colOffset(round.games.length)}
                />
                {!isLast && nextRound && (
                  <div style={{ marginTop: 28 }}>
                    <BracketConnector
                      matchCount={round.games.length}
                      nextCount={nextRound.games.length}
                      isDark={isDark}
                    />
                  </div>
                )}
              </div>
            );
          })}

          {/* Connector to champion slot */}
          {finalRound && (
            <div style={{ marginTop: 28 }}>
              <BracketConnector
                matchCount={finalRound.games.length}
                nextCount={1}
                isDark={isDark}
              />
            </div>
          )}

          {/* Champion card */}
          <div style={{ marginTop: 28 + colOffset(1) }}>
            <ChampionCard
              game={finalGame}
              players={players}
              elimPlayers={seededPlayers}
              isDark={isDark}
            />
          </div>
        </div>
      </div>

      {/* Champion banner — shown when the final is complete */}
      {(() => {
        if (!finalGame) return null;
        const champion = resultWinner(finalGame);
        if (!champion) return null;
        const championId = champion === "white" ? finalGame.whiteId : finalGame.blackId;
        const championPlayer = getPlayer(championId, seededPlayers, players);
        if (!championPlayer) return null;
        return (
          <div
            className={`flex items-center gap-4 px-5 py-4 rounded-2xl border animate-in fade-in slide-in-from-bottom-2 ${
              isDark ? "bg-amber-400/08 border-amber-400/20" : "bg-amber-50 border-amber-200"
            }`}
            style={{ animationDuration: "400ms" }}
          >
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
              <p className={`text-lg font-black ${isDark ? "text-amber-300" : "text-amber-800"}`}
                style={{ fontFamily: "'Clash Display', sans-serif" }}>
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
      </div>{/* end desktop wrapper */}
    </div>
  );
}

export default PublicBracketView;
