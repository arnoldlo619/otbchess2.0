/**
 * OTB Chess — Elimination Bracket View
 *
 * Visual bracket tree for the Director Console.
 * Shows all rounds as columns (Round of 64 → QF → SF → Final),
 * renders match cards with player names/seeds/ELO, result entry
 * buttons on pending matches, and an "Advance Round" CTA.
 *
 * Props:
 *  - rounds: all Round objects from directorState (only elim rounds)
 *  - players: full player roster for name/ELO lookup
 *  - elimPlayers: seeded players who advanced to the bracket
 *  - currentRound: the active round number
 *  - allResultsIn: whether all games in the current round are done
 *  - elimRoundLabelText: label for the current round (e.g. "Quarterfinals")
 *  - isDark: theme flag
 *  - onEnterResult: (gameId, result) => void
 *  - onAdvanceRound: () => void — generates next elimination round
 *  - onCompleteTournament: () => void
 */

import React, { useMemo, useRef, useEffect } from "react";
import {Trophy, ChevronRight, Crown, Zap, CheckCircle2} from "lucide-react";
import { elimRoundLabel } from "@/lib/swiss";
import type { Round, Player, Game, Result } from "@/lib/tournamentData";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MatchCardProps {
  game: Game;
  roundNum: number;
  players: Player[];
  elimPlayers: Player[];
  isDark: boolean;
  isCurrentRound: boolean;
  onEnterResult?: (gameId: string, result: Result) => void;
}

interface EliminationBracketViewProps {
  rounds: Round[];
  players: Player[];
  elimPlayers: Player[];
  currentRound: number;
  allResultsIn: boolean;
  elimRoundLabelText?: string;
  isDark: boolean;
  onEnterResult: (gameId: string, result: Result) => void;
  onAdvanceRound: () => void;
  onCompleteTournament: () => void;
  /** First elimination round number (to offset display) */
  elimStartRound: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getPlayer(id: string, players: Player[], elimPlayers: Player[]): Player | undefined {
  return elimPlayers.find((p) => p.id === id) ?? players.find((p) => p.id === id);
}

function getSeed(playerId: string, elimPlayers: Player[]): number | null {
  const idx = elimPlayers.findIndex((p) => p.id === playerId);
  return idx >= 0 ? idx + 1 : null;
}

function resultWinner(game: Game): "white" | "black" | "bye" | null {
  if (game.result === "1-0") return "white";
  if (game.result === "0-1") return "black";
  if (game.result === "½-½" && game.whiteId === "BYE") return "black"; // bye auto-win
  return null;
}

// ─── Match Card ───────────────────────────────────────────────────────────────

function MatchCard({
  game,
  players,
  elimPlayers,
  isDark,
  isCurrentRound,
  onEnterResult,
}: MatchCardProps) {
  const isBye = game.whiteId === "BYE";
  const isPending = game.result === "*";
  const winner = resultWinner(game);

  const white = isBye ? null : getPlayer(game.whiteId, players, elimPlayers);
  const black = getPlayer(game.blackId, players, elimPlayers);
  const whiteSeed = isBye ? null : getSeed(game.whiteId, elimPlayers);
  const blackSeed = getSeed(game.blackId, elimPlayers);

  const T = {
    card: isDark
      ? "bg-[oklch(0.22_0.06_145)] border-white/08"
      : "bg-white border-gray-100",
    cardActive: isDark
      ? "bg-[oklch(0.26_0.08_145)] border-[oklch(0.45_0.12_145)]"
      : "bg-white border-[#3D6B47]/40",
    playerRow: isDark ? "hover:bg-white/04" : "hover:bg-gray-50",
    winnerRow: isDark
      ? "bg-[oklch(0.32_0.10_145)]/60"
      : "bg-[#3D6B47]/08",
    loserText: isDark ? "text-white/30" : "text-gray-300",
    seedBadge: isDark ? "bg-white/08 text-white/40" : "bg-gray-100 text-gray-400",
    seedBadge1: isDark ? "bg-amber-400/20 text-amber-300" : "bg-amber-50 text-amber-600",
    seedBadge2: isDark ? "bg-slate-400/15 text-slate-300" : "bg-slate-100 text-slate-500",
    seedBadge3: isDark ? "bg-orange-400/15 text-orange-300" : "bg-orange-50 text-orange-500",
    eloText: isDark ? "text-white/35" : "text-gray-400",
    divider: isDark ? "border-white/06" : "border-gray-100",
    btnWhite: isDark
      ? "bg-white/08 hover:bg-white/14 text-white/70 hover:text-white border-white/08"
      : "bg-gray-50 hover:bg-gray-100 text-gray-600 border-gray-200",
    btnDraw: isDark
      ? "bg-white/05 hover:bg-white/10 text-white/50 hover:text-white/80 border-white/06"
      : "bg-gray-50 hover:bg-gray-100 text-gray-400 border-gray-200",
    btnBlack: isDark
      ? "bg-white/08 hover:bg-white/14 text-white/70 hover:text-white border-white/08"
      : "bg-gray-50 hover:bg-gray-100 text-gray-600 border-gray-200",
  };

  const seedClass = (seed: number | null) =>
    seed === 1 ? T.seedBadge1
    : seed === 2 ? T.seedBadge2
    : seed === 3 ? T.seedBadge3
    : T.seedBadge;

  const cardBorder = isCurrentRound && isPending
    ? T.cardActive
    : T.card;

  return (
    <div
      className={`rounded-2xl border overflow-hidden transition-all duration-200 ${cardBorder} ${
        isBye ? "opacity-50" : ""
      }`}
      style={{ minWidth: 200, maxWidth: 240 }}
    >
      {/* Bye match */}
      {isBye && (
        <div className="px-3 py-2.5 flex items-center gap-2">
          <span title={`Swiss seed #${blackSeed}`} className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${seedClass(blackSeed)}`}>
            #{blackSeed}
          </span>
          <span className={`text-sm font-semibold truncate ${isDark ? "text-white/70" : "text-gray-700"}`}>
            {black?.name ?? "Unknown"}
          </span>
          <span className="ml-auto text-[10px] font-bold text-emerald-400 uppercase tracking-wider">BYE</span>
        </div>
      )}

      {/* Normal match */}
      {!isBye && (
        <>
          {/* White player row */}
          <div className={`flex items-center gap-2 px-3 py-2 transition-colors ${
            winner === "white" ? T.winnerRow : winner !== null ? "" : ""
          }`}>
            <span title={`Swiss seed #${whiteSeed}`} className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${seedClass(whiteSeed)}`}>
              #{whiteSeed ?? "?"}
            </span>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold truncate leading-tight ${
                winner === "black" ? T.loserText : isDark ? "text-white" : "text-gray-900"
              }`}>
                {white?.name ?? game.whiteId}
              </p>
              <p className={`text-[10px] tabular-nums ${T.eloText}`}>
                {white?.elo ? `${white.elo}` : ""}
              </p>
            </div>
            {winner === "white" && (
              <Crown className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" strokeWidth={2} />
            )}
            {game.result !== "*" && winner !== null && (
              <span className={`text-[11px] font-bold tabular-nums flex-shrink-0 ${
                winner === "white" ? (isDark ? "text-white" : "text-gray-900") : T.loserText
              }`}>
                {game.result === "1-0" ? "1" : game.result === "0-1" ? "0" : "½"}
              </span>
            )}
          </div>

          {/* Divider */}
          <div className={`border-t mx-3 ${T.divider}`} />

          {/* Black player row */}
          <div className={`flex items-center gap-2 px-3 py-2 transition-colors ${
            winner === "black" ? T.winnerRow : ""
          }`}>
            <span title={`Swiss seed #${blackSeed}`} className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${seedClass(blackSeed)}`}>
              #{blackSeed ?? "?"}
            </span>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold truncate leading-tight ${
                winner === "white" ? T.loserText : isDark ? "text-white" : "text-gray-900"
              }`}>
                {black?.name ?? game.blackId}
              </p>
              <p className={`text-[10px] tabular-nums ${T.eloText}`}>
                {black?.elo ? `${black.elo}` : ""}
              </p>
            </div>
            {winner === "black" && (
              <Crown className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" strokeWidth={2} />
            )}
            {game.result !== "*" && winner !== null && (
              <span className={`text-[11px] font-bold tabular-nums flex-shrink-0 ${
                winner === "black" ? (isDark ? "text-white" : "text-gray-900") : T.loserText
              }`}>
                {game.result === "0-1" ? "1" : game.result === "1-0" ? "0" : "½"}
              </span>
            )}
          </div>

          {/* Result entry buttons — only on pending games in the current round */}
          {isCurrentRound && isPending && onEnterResult && (
            <div className={`flex gap-1 px-2 pb-2 pt-1 border-t ${T.divider}`}>
              <button
                onClick={() => onEnterResult(game.id, "1-0")}
                className={`flex-1 text-[11px] font-bold py-1.5 rounded-lg border transition-all active:scale-95 truncate ${T.btnWhite}`}
                title={`${white?.name ?? "White"} wins`}
              >
                {white?.name?.split(" ")[0] ?? "White"}
              </button>
              <button
                onClick={() => onEnterResult(game.id, "½-½")}
                className={`flex-none text-[11px] font-bold px-2 py-1.5 rounded-lg border transition-all active:scale-95 ${T.btnDraw}`}
                title="Draw"
              >
                ½
              </button>
              <button
                onClick={() => onEnterResult(game.id, "0-1")}
                className={`flex-1 text-[11px] font-bold py-1.5 rounded-lg border transition-all active:scale-95 truncate ${T.btnBlack}`}
                title={`${black?.name ?? "Black"} wins`}
              >
                {black?.name?.split(" ")[0] ?? "Black"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Connector Lines (SVG) ────────────────────────────────────────────────────

function _ConnectorLines({
  matchCount,
  isDark,
}: {
  matchCount: number;
  isDark: boolean;
}) {
  // Draw bracket connector lines between rounds
  // Each pair of matches in the current column connects to one match in the next
  const lineColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(61,107,71,0.12)";
  const height = matchCount * 80 + (matchCount - 1) * 16; // approximate
  return (
    <div className="flex-shrink-0 flex items-center" style={{ width: 24 }}>
      <svg width="24" height={height} viewBox={`0 0 24 ${height}`} fill="none">
        {Array.from({ length: Math.floor(matchCount / 2) }, (_, i) => {
          const topY = i * 2 * (80 + 16) + 40;
          const botY = topY + 80 + 16;
          const midY = (topY + botY) / 2;
          return (
            <g key={i}>
              <path
                d={`M 0 ${topY} H 12 V ${midY}`}
                stroke={lineColor}
                strokeWidth="1.5"
                fill="none"
              />
              <path
                d={`M 0 ${botY} H 12 V ${midY}`}
                stroke={lineColor}
                strokeWidth="1.5"
                fill="none"
              />
              <path
                d={`M 12 ${midY} H 24`}
                stroke={lineColor}
                strokeWidth="1.5"
                fill="none"
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─── Round Column ─────────────────────────────────────────────────────────────

function RoundColumn({
  round,
  roundLabel,
  players,
  elimPlayers,
  currentRound,
  isDark,
  onEnterResult,
}: {
  round: Round;
  roundLabel: string;
  players: Player[];
  elimPlayers: Player[];
  currentRound: number;
  isDark: boolean;
  onEnterResult?: (gameId: string, result: Result) => void;
}) {
  const isActive = round.number === currentRound;
  const allDone = round.games.every((g) => g.result !== "*");

  const T = {
    label: isDark ? "text-white/40" : "text-gray-400",
    labelActive: isDark ? "text-white/80" : "text-gray-800",
    pill: isDark
      ? "bg-[oklch(0.32_0.10_145)] text-white/70"
      : "bg-[#3D6B47]/10 text-[#3D6B47]",
    pillDone: isDark
      ? "bg-emerald-500/20 text-emerald-400"
      : "bg-emerald-50 text-emerald-600",
  };

  return (
    <div className="flex flex-col gap-3" style={{ minWidth: 200, maxWidth: 240 }}>
      {/* Round header */}
      <div className="flex items-center gap-2">
        <span className={`text-xs font-bold uppercase tracking-wider ${isActive ? T.labelActive : T.label}`}>
          {roundLabel}
        </span>
        {isActive && !allDone && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${T.pill}`}>
            Live
          </span>
        )}
        {allDone && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${T.pillDone}`}>
            <CheckCircle2 className="w-2.5 h-2.5" />
            Done
          </span>
        )}
      </div>

      {/* Match cards */}
      <div className="flex flex-col gap-3">
        {round.games.map((game) => (
          <MatchCard
            key={game.id}
            game={game}
            roundNum={round.number}
            players={players}
            elimPlayers={elimPlayers}
            isDark={isDark}
            isCurrentRound={isActive}
            onEnterResult={onEnterResult}
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
  if (!game || game.result === "*") {
    return (
      <div
        className={`flex flex-col items-center justify-center rounded-2xl border p-4 gap-2 ${
          isDark ? "bg-[oklch(0.22_0.06_145)] border-white/08" : "bg-white border-gray-100"
        }`}
        style={{ minWidth: 160, maxWidth: 180 }}
      >
        <Trophy className={`w-8 h-8 ${isDark ? "text-white/15" : "text-gray-200"}`} />
        <p className={`text-xs font-semibold text-center ${isDark ? "text-white/30" : "text-gray-300"}`}>
          Champion TBD
        </p>
      </div>
    );
  }

  const winner = resultWinner(game);
  const champId = winner === "white" ? game.whiteId : game.blackId;
  const champ = getPlayer(champId, players, elimPlayers);
  const seed = getSeed(champId, elimPlayers);

  return (
    <div
      className={`flex flex-col items-center justify-center rounded-2xl border p-4 gap-3 ${
        isDark
          ? "bg-[oklch(0.28_0.10_145)] border-amber-400/30"
          : "bg-amber-50 border-amber-200"
      }`}
      style={{ minWidth: 160, maxWidth: 180 }}
    >
      <div className="relative">
        <Trophy className="w-8 h-8 text-amber-400" />
        <Crown
          className="w-4 h-4 text-amber-400 absolute -top-2 -right-2"
          strokeWidth={2}
        />
      </div>
      <div className="text-center">
        <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${isDark ? "text-amber-400/70" : "text-amber-600"}`}>
          Champion
        </p>
        <p className={`text-sm font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
          {champ?.name ?? champId}
        </p>
        {seed && (
          <p className={`text-[10px] ${isDark ? "text-white/40" : "text-gray-400"}`}>
            Seed #{seed} · {champ?.elo ?? ""}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function EliminationBracketView({
  rounds,
  players,
  elimPlayers,
  currentRound,
  allResultsIn,
  isDark,
  onEnterResult,
  onAdvanceRound,
  onCompleteTournament,
  elimStartRound,
}: EliminationBracketViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll to the active round column when it changes
  useEffect(() => {
    if (!scrollRef.current) return;
    const activeCol = scrollRef.current.querySelector("[data-active-round='true']");
    if (activeCol) {
      activeCol.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [currentRound]);

  // Build round labels for each column
  const roundLabels = useMemo(() => {
    const labels: Record<number, string> = {};
    for (const round of rounds) {
      const matchCount = round.games.filter((g) => g.whiteId !== "BYE" || g.blackId !== "BYE").length;
      const playerCount = matchCount * 2;
      labels[round.number] = elimRoundLabel(playerCount);
    }
    return labels;
  }, [rounds]);

  // Final round is the last one
  const finalRound = rounds[rounds.length - 1];
  const finalGame = finalRound?.games[0];
  const isTournamentOver = finalGame?.result !== "*" && finalGame !== undefined;

  // Is the current round the last round?
  const isLastRound = currentRound === (finalRound?.number ?? currentRound);

  const T = {
    bg: isDark ? "bg-[oklch(0.18_0.05_145)]" : "bg-gray-50",
    advanceBtn: isDark
      ? "bg-[oklch(0.42_0.14_145)] hover:bg-[oklch(0.48_0.16_145)] text-white"
      : "bg-[#3D6B47] hover:bg-[#2A5535] text-white",
    completeBtn: isDark
      ? "bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-400/30"
      : "bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200",
    sectionTitle: isDark ? "text-white/70" : "text-gray-700",
    emptyText: isDark ? "text-white/30" : "text-gray-400",
  };

  if (rounds.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center py-16 gap-3 rounded-2xl ${T.bg}`}>
        <Trophy className={`w-10 h-10 ${T.emptyText}`} />
        <p className={`text-sm font-semibold ${T.emptyText}`}>No bracket yet</p>
        <p className={`text-xs ${T.emptyText}`}>Advance to elimination to generate the bracket.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* ── Bracket tree (horizontal scroll) ── */}
      <div
        ref={scrollRef}
        className="overflow-x-auto pb-4"
        style={{ scrollbarWidth: "thin" }}
      >
        <div className="flex items-start gap-0 min-w-max px-1">
          {rounds.map((round, idx) => {
            const isActive = round.number === currentRound;
            const isLast = idx === rounds.length - 1;

            return (
              <React.Fragment key={round.number}>
                {/* Round column */}
                <div
                  data-active-round={isActive ? "true" : undefined}
                  className="flex-shrink-0"
                >
                  <RoundColumn
                    round={round}
                    roundLabel={roundLabels[round.number] ?? `Round ${round.number - elimStartRound + 1}`}
                    players={players}
                    elimPlayers={elimPlayers}
                    currentRound={currentRound}
                    isDark={isDark}
                    onEnterResult={onEnterResult}
                  />
                </div>

                {/* Connector arrow between columns */}
                {!isLast && (
                  <div className="flex-shrink-0 flex items-center self-stretch px-2">
                    <ChevronRight
                      className={`w-4 h-4 ${isDark ? "text-white/15" : "text-gray-200"}`}
                    />
                  </div>
                )}
              </React.Fragment>
            );
          })}

          {/* Champion slot */}
          <div className="flex-shrink-0 flex items-center self-stretch px-2">
            <ChevronRight
              className={`w-4 h-4 ${isDark ? "text-white/15" : "text-gray-200"}`}
            />
          </div>
          <div className="flex-shrink-0 self-center">
            <ChampionCard
              game={finalGame}
              players={players}
              elimPlayers={elimPlayers}
              isDark={isDark}
            />
          </div>
        </div>
      </div>

      {/* ── Advance / Complete CTA ── */}
      {allResultsIn && !isTournamentOver && !isLastRound && (
        <div className={`flex items-center gap-3 p-4 rounded-2xl border ${
          isDark ? "bg-[oklch(0.22_0.06_145)] border-white/08" : "bg-white border-gray-100"
        }`}>
          <div className="flex-1">
            <p className={`text-sm font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
              All matches complete
            </p>
            <p className={`text-xs mt-0.5 ${isDark ? "text-white/45" : "text-gray-500"}`}>
              Ready to generate the next elimination round.
            </p>
          </div>
          <button
            onClick={onAdvanceRound}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95 ${T.advanceBtn}`}
          >
            <Zap className="w-4 h-4" />
            Next Round
          </button>
        </div>
      )}

      {allResultsIn && isLastRound && !isTournamentOver && (
        <div className={`flex items-center gap-3 p-4 rounded-2xl border ${
          isDark ? "bg-[oklch(0.22_0.06_145)] border-white/08" : "bg-white border-gray-100"
        }`}>
          <div className="flex-1">
            <p className={`text-sm font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
              Final match complete
            </p>
            <p className={`text-xs mt-0.5 ${isDark ? "text-white/45" : "text-gray-500"}`}>
              Enter the final result above, then complete the tournament.
            </p>
          </div>
          <button
            onClick={onAdvanceRound}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95 ${T.advanceBtn}`}
          >
            <Zap className="w-4 h-4" />
            Next Round
          </button>
        </div>
      )}

      {isTournamentOver && (
        <div className={`flex items-center gap-3 p-4 rounded-2xl border ${
          isDark
            ? "bg-amber-500/08 border-amber-400/20"
            : "bg-amber-50 border-amber-200"
        }`}>
          <Trophy className="w-5 h-5 text-amber-400 flex-shrink-0" />
          <div className="flex-1">
            <p className={`text-sm font-bold ${isDark ? "text-amber-300" : "text-amber-800"}`}>
              Tournament complete!
            </p>
            <p className={`text-xs mt-0.5 ${isDark ? "text-amber-400/60" : "text-amber-600"}`}>
              The champion has been crowned. Finalize the results.
            </p>
          </div>
          <button
            onClick={onCompleteTournament}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95 ${T.completeBtn}`}
          >
            <Crown className="w-4 h-4" />
            Complete
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Swiss-to-Elimination Cutoff Screen ───────────────────────────────────────

interface SwissElimCutoffScreenProps {
  standings: Array<{ player: Player; points: number; buchholz: number }>;
  defaultCutoff: number;
  isDark: boolean;
  onAdvance: (cutoff: number) => void;
}

export function SwissElimCutoffScreen({
  standings,
  defaultCutoff,
  isDark,
  onAdvance,
}: SwissElimCutoffScreenProps) {
  const [cutoff, setCutoff] = React.useState(defaultCutoff);

  const T = {
    card: isDark
      ? "bg-[oklch(0.22_0.06_145)] border-white/08"
      : "bg-white border-gray-100",
    title: isDark ? "text-white" : "text-gray-900",
    sub: isDark ? "text-white/45" : "text-gray-500",
    row: isDark ? "border-white/06 hover:bg-white/03" : "border-gray-100 hover:bg-gray-50",
    rowIn: isDark ? "bg-[oklch(0.28_0.09_145)]/50" : "bg-[#3D6B47]/05",
    rankBadge: isDark ? "bg-white/08 text-white/50" : "bg-gray-100 text-gray-500",
    advanceBadge: isDark ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-50 text-emerald-600",
    cutoffLine: isDark ? "border-amber-400/40" : "border-amber-400",
    btn: isDark
      ? "bg-[oklch(0.42_0.14_145)] hover:bg-[oklch(0.48_0.16_145)] text-white"
      : "bg-[#3D6B47] hover:bg-[#2A5535] text-white",
    select: isDark
      ? "bg-[oklch(0.28_0.08_145)] border-white/10 text-white"
      : "bg-white border-gray-200 text-gray-900",
  };

  // Cutoff options: powers of 2 up to standings.length
  const cutoffOptions: number[] = [];
  for (let n = 2; n <= standings.length; n *= 2) {
    cutoffOptions.push(n);
  }
  if (!cutoffOptions.includes(cutoff)) cutoffOptions.push(cutoff);
  cutoffOptions.sort((a, b) => a - b);

  return (
    <div className={`rounded-2xl border overflow-hidden ${T.card}`}>
      {/* Header */}
      <div className={`px-5 py-4 border-b ${isDark ? "border-white/06" : "border-gray-100"}`}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className={`text-base font-bold ${T.title}`}>Advance to Elimination</h3>
            <p className={`text-xs mt-0.5 ${T.sub}`}>
              Swiss phase complete. Select how many players advance to the bracket.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className={`text-xs font-semibold ${T.sub}`}>Top</label>
            <select
              value={cutoff}
              onChange={(e) => setCutoff(Number(e.target.value))}
              className={`text-sm font-bold px-3 py-1.5 rounded-xl border appearance-none cursor-pointer ${T.select}`}
            >
              {cutoffOptions.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <button
              onClick={() => onAdvance(cutoff)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95 ${T.btn}`}
            >
              <Trophy className="w-4 h-4" />
              Generate Bracket
            </button>
          </div>
        </div>
      </div>

      {/* Standings list */}
      <div className="divide-y" style={{ maxHeight: 420, overflowY: "auto" }}>
        {standings.map((row, idx) => {
          const rank = idx + 1;
          const advances = rank <= cutoff;
          const isCutoffLine = rank === cutoff;

          return (
            <React.Fragment key={row.player.id}>
              <div
                className={`flex items-center gap-3 px-5 py-2.5 transition-colors ${
                  advances ? T.rowIn : T.row
                }`}
              >
                <span className={`text-[11px] font-bold w-6 text-center flex-shrink-0 ${T.rankBadge} rounded-md px-1 py-0.5`}>
                  {rank}
                </span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold truncate ${T.title}`}>
                    {row.player.name}
                  </p>
                </div>
                <span className={`text-xs tabular-nums font-bold ${isDark ? "text-white/60" : "text-gray-600"}`}>
                  {row.points}
                </span>
                <span className={`text-[10px] tabular-nums ${isDark ? "text-white/30" : "text-gray-400"}`}>
                  BH {row.buchholz.toFixed(1)}
                </span>
                {advances && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${T.advanceBadge}`}>
                    ✓
                  </span>
                )}
              </div>
              {/* Cutoff divider */}
              {isCutoffLine && rank < standings.length && (
                <div className={`flex items-center gap-2 px-5 py-1 border-t-2 ${T.cutoffLine}`}>
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-amber-400/70" : "text-amber-600"}`}>
                    Cutoff — players below do not advance
                  </span>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
