/**
 * OTB Chess — Elimination Bracket View (Director)
 *
 * A proper left-to-right tournament bracket tree:
 *   - Round columns with vertically-centered match cards
 *   - SVG connector lines linking pairs of matches to the next round
 *   - Compact player cards with seed badge, name, ELO, score
 *   - Green left-accent bar on winning player row
 *   - Result entry buttons on active-round pending matches
 *   - Champion card at the far right
 *   - Advance / Complete CTAs below the tree
 */

import React, { useMemo, useRef, useEffect, useState } from "react";
import { Trophy, Crown, Zap, CheckCircle2 } from "lucide-react";
import { elimRoundLabel } from "@/lib/swiss";
import type { Round, Player, Game, Result } from "@/lib/tournamentData";
import { MobileBracketCarousel } from "./MobileBracketCarousel";

// ─── Types ────────────────────────────────────────────────────────────────────

interface EliminationBracketViewProps {
  rounds: Round[];
  players: Player[];
  elimPlayers: Player[];
  currentRound: number;
  allResultsIn: boolean;
  elimRoundLabelText?: string;
  isDark: boolean;
  myPlayerId?: string;
  onEnterResult: (gameId: string, result: Result) => void;
  onAdvanceRound: () => void;
  onCompleteTournament: () => void;
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

// Card dimensions — used for SVG connector math
const CARD_H = 72; // px: height of a match card (2 player rows)
const CARD_GAP = 12; // px: gap between cards in a column
const COL_GAP = 48; // px: horizontal gap between columns (connector region)
const COL_W = 200; // px: card width

// ─── Match Card ───────────────────────────────────────────────────────────────

interface MatchCardProps {
  game: Game;
  players: Player[];
  elimPlayers: Player[];
  isDark: boolean;
  isCurrentRound: boolean;
  myPlayerId?: string;
  onEnterResult?: (gameId: string, result: Result) => void;
}

function MatchCard({ game, players, elimPlayers, isDark, isCurrentRound, myPlayerId, onEnterResult }: MatchCardProps) {
  const isBye = game.whiteId === "BYE" || game.blackId === "BYE";
  const isPending = game.result === "*";
  const winner = resultWinner(game);

  // Track previous result to detect when a result is newly entered
  const prevResultRef = useRef<string>(game.result);
  const [flashWinner, setFlashWinner] = useState<"white" | "black" | null>(null);

  // Track whether the card players were just populated (winner advanced into this slot)
  const prevWhiteIdRef = useRef<string>(game.whiteId);
  const prevBlackIdRef = useRef<string>(game.blackId);
  const [justEntered, setJustEntered] = useState(() => {
    // Only animate on mount if both slots are already filled (pre-existing bracket)
    return false;
  });

  useEffect(() => {
    const prevW = prevWhiteIdRef.current;
    const prevB = prevBlackIdRef.current;
    // A player "arrived" into this slot if it was previously a placeholder/empty
    const whiteArrived = prevW !== game.whiteId && (prevW === "" || prevW === "TBD");
    const blackArrived = prevB !== game.blackId && (prevB === "" || prevB === "TBD");
    if (whiteArrived || blackArrived) {
      setJustEntered(true);
      const t = setTimeout(() => setJustEntered(false), 600);
      prevWhiteIdRef.current = game.whiteId;
      prevBlackIdRef.current = game.blackId;
      return () => clearTimeout(t);
    }
    prevWhiteIdRef.current = game.whiteId;
    prevBlackIdRef.current = game.blackId;
  }, [game.whiteId, game.blackId]);

  useEffect(() => {
    const prev = prevResultRef.current;
    const curr = game.result;
    // Transition from pending → result
    if (prev === "*" && curr !== "*") {
      const w = resultWinner(game);
      if (w === "white" || w === "black") {
        setFlashWinner(w);
        // Clear flash after animation completes
        const t = setTimeout(() => setFlashWinner(null), 800);
        return () => clearTimeout(t);
      }
    }
    prevResultRef.current = curr;
  }, [game.result]); // eslint-disable-line react-hooks/exhaustive-deps

  const white = game.whiteId === "BYE" ? null : (getPlayer(game.whiteId, players, elimPlayers) ?? null);
  const black = game.blackId === "BYE" ? null : (getPlayer(game.blackId, players, elimPlayers) ?? null);
  const whiteSeed = game.whiteId === "BYE" ? null : getSeed(game.whiteId, elimPlayers);
  const blackSeed = game.blackId === "BYE" ? null : getSeed(game.blackId, elimPlayers);

  const whiteScore = game.result === "1-0" ? "1" : game.result === "½-½" ? "½" : game.result === "0-1" ? "0" : null;
  const blackScore = game.result === "0-1" ? "1" : game.result === "½-½" ? "½" : game.result === "1-0" ? "0" : null;

  const isMyGame = !!myPlayerId && (game.whiteId === myPlayerId || game.blackId === myPlayerId);

  const cardBg = isDark ? "bg-[oklch(0.22_0.06_145)]" : "bg-white";
  const cardBorder = isMyGame
    ? isDark
      ? "border-[#4CAF50]/70 shadow-[0_0_0_2px_rgba(76,175,80,0.18),0_0_16px_rgba(76,175,80,0.08)]"
      : "border-[#3D6B47]/60 shadow-[0_0_0_2px_rgba(61,107,71,0.15)]"
    : isCurrentRound && isPending
      ? isDark ? "border-[#4CAF50]/35 shadow-[0_0_0_1px_rgba(76,175,80,0.15)]" : "border-[#3D6B47]/35"
      : isDark ? "border-white/08" : "border-gray-150";

  const winnerBg = isDark ? "bg-[#3D6B47]/25" : "bg-[#3D6B47]/07";
  const loserText = isDark ? "text-white/28" : "text-gray-300";
  const divider = isDark ? "border-white/06" : "border-gray-100";

  function PlayerRow({
    playerId,
    player,
    seed,
    score,
    isWinner,
    isLoser,
    isByeRow,
    side,
  }: {
    playerId: string;
    player: Player | null;
    seed: number | null;
    score: string | null;
    isWinner: boolean;
    isLoser: boolean;
    isByeRow: boolean;
    side: "white" | "black";
  }) {
    if (isByeRow) {
      return (
        <div className={`flex items-center gap-2 px-3 py-2.5 opacity-30`}>
          <span className={`text-[10px] font-bold w-6 text-center ${isDark ? "text-white/30" : "text-gray-300"}`}>—</span>
          <span className={`text-xs italic ${isDark ? "text-white/30" : "text-gray-300"}`}>BYE</span>
        </div>
      );
    }
    const isMe = !isByeRow && myPlayerId === playerId;
    const shouldFlash = !isByeRow && flashWinner === side;
    return (
      <div className={`relative flex items-center gap-2 px-3 py-2.5 transition-colors ${isWinner ? winnerBg : ""} ${shouldFlash ? "animate-bracket-winner-flash" : ""}`}>
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
        {/* Name + ELO */}
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-semibold truncate leading-tight ${
            isLoser ? loserText : isDark ? "text-white/88" : "text-gray-900"
          }`}>
            {player?.name ?? playerId}
          </p>
          {player?.elo && (
            <p className={`text-[9px] tabular-nums ${isDark ? "text-white/28" : "text-gray-400"}`}>
              {player.elo}
            </p>
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
        {/* You badge */}
        {isMe && (
          <span className={`text-[8px] font-black px-1 py-0.5 rounded-full flex-shrink-0 ${
            isDark ? "bg-[#4CAF50]/20 text-[#4CAF50] border border-[#4CAF50]/30" : "bg-[#3D6B47]/10 text-[#3D6B47] border border-[#3D6B47]/25"
          }`}>
            You
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border overflow-hidden transition-all duration-200 ${cardBg} ${cardBorder} ${isBye ? "opacity-50" : ""} ${justEntered ? "animate-bracket-card-enter" : ""}`}
      style={{ width: COL_W }}
    >
      {/* White row */}
      <PlayerRow
        playerId={game.whiteId}
        player={white}
        seed={whiteSeed}
        score={whiteScore}
        isWinner={winner === "white"}
        isLoser={winner === "black"}
        isByeRow={game.whiteId === "BYE"}
        side="white"
      />
      {/* Divider */}
      <div className={`border-t mx-2.5 ${divider}`} />
      {/* Black row */}
      <PlayerRow
        playerId={game.blackId}
        player={black}
        seed={blackSeed}
        score={blackScore}
        isWinner={winner === "black"}
        isLoser={winner === "white"}
        isByeRow={game.blackId === "BYE"}
        side="black"
      />
      {/* Result entry buttons */}
      {isCurrentRound && isPending && onEnterResult && !isBye && (
        <div className={`flex gap-1 px-2 pb-2 pt-1 border-t ${divider}`}>
          <button
            onClick={() => onEnterResult(game.id, "1-0")}
            className={`flex-1 text-[10px] font-bold py-1.5 rounded-lg border transition-all active:scale-95 truncate ${
              isDark
                ? "bg-white/08 hover:bg-white/14 text-white/70 border-white/08"
                : "bg-gray-50 hover:bg-gray-100 text-gray-600 border-gray-200"
            }`}
            title={`${white?.name ?? "White"} wins`}
          >
            {white?.name?.split(" ")[0] ?? "White"}
          </button>
          <button
            onClick={() => onEnterResult(game.id, "½-½")}
            className={`flex-none text-[10px] font-bold px-2 py-1.5 rounded-lg border transition-all active:scale-95 ${
              isDark
                ? "bg-white/05 hover:bg-white/10 text-white/50 border-white/06"
                : "bg-gray-50 hover:bg-gray-100 text-gray-400 border-gray-200"
            }`}
            title="Draw"
          >
            ½
          </button>
          <button
            onClick={() => onEnterResult(game.id, "0-1")}
            className={`flex-1 text-[10px] font-bold py-1.5 rounded-lg border transition-all active:scale-95 truncate ${
              isDark
                ? "bg-white/08 hover:bg-white/14 text-white/70 border-white/08"
                : "bg-gray-50 hover:bg-gray-100 text-gray-600 border-gray-200"
            }`}
            title={`${black?.name ?? "Black"} wins`}
          >
            {black?.name?.split(" ")[0] ?? "Black"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── SVG Connector Lines ──────────────────────────────────────────────────────

/**
 * Draws the bracket connector lines between two adjacent round columns.
 * Each pair of cards in the left column connects to one card in the right column.
 *
 * @param matchCount  Number of matches in the LEFT column
 * @param nextCount   Number of matches in the RIGHT column
 * @param isDark      Theme flag
 */
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

  // Total height of the left column
  const leftColH = matchCount * CARD_H + Math.max(0, matchCount - 1) * CARD_GAP;
  // Total height of the right column
  const rightColH = nextCount * CARD_H + Math.max(0, nextCount - 1) * CARD_GAP;

  const svgH = Math.max(leftColH, rightColH);
  const svgW = COL_GAP;

  // For each pair of left matches, draw lines to the midpoint, then to the right match center
  const pairs = Math.floor(matchCount / 2);

  const paths: React.ReactNode[] = [];

  for (let i = 0; i < pairs; i++) {
    // Centers of the two left matches
    const topMatchCenter = i * 2 * (CARD_H + CARD_GAP) + CARD_H / 2;
    const botMatchCenter = (i * 2 + 1) * (CARD_H + CARD_GAP) + CARD_H / 2;
    const midY = (topMatchCenter + botMatchCenter) / 2;

    // Center of the corresponding right match
    // Right column is vertically centered within svgH
    const rightOffset = (svgH - rightColH) / 2;
    const rightMatchCenter = rightOffset + i * (CARD_H + CARD_GAP) + CARD_H / 2;

    paths.push(
      <g key={i}>
        {/* Top left match → midpoint */}
        <path
          d={`M 0 ${topMatchCenter} H ${svgW * 0.45} V ${midY}`}
          stroke={lineColor}
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Bottom left match → midpoint */}
        <path
          d={`M 0 ${botMatchCenter} H ${svgW * 0.45} V ${midY}`}
          stroke={lineColor}
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Midpoint → right match */}
        <path
          d={`M ${svgW * 0.45} ${midY} H ${svgW * 0.55} V ${rightMatchCenter} H ${svgW}`}
          stroke={lineColor}
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Junction dot */}
        <circle cx={svgW * 0.45} cy={midY} r="2.5" fill={dotColor} />
      </g>
    );
  }

  // If matchCount is odd (bye case), draw a straight line for the last match
  if (matchCount % 2 !== 0) {
    const lastMatchCenter = (matchCount - 1) * (CARD_H + CARD_GAP) + CARD_H / 2;
    const rightOffset = (svgH - rightColH) / 2;
    const rightMatchCenter = rightOffset + Math.floor(matchCount / 2) * (CARD_H + CARD_GAP) + CARD_H / 2;
    paths.push(
      <path
        key="odd"
        d={`M 0 ${lastMatchCenter} H ${svgW * 0.5} V ${rightMatchCenter} H ${svgW}`}
        stroke={lineColor}
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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
  round,
  roundLabel,
  players,
  elimPlayers,
  currentRound,
  isDark,
  myPlayerId,
  onEnterResult,
  verticalOffset,
}: {
  round: Round;
  roundLabel: string;
  players: Player[];
  elimPlayers: Player[];
  currentRound: number;
  isDark: boolean;
  myPlayerId?: string;
  onEnterResult?: (gameId: string, result: Result) => void;
  verticalOffset: number;
}) {
  const isActive = round.number === currentRound;
  const allDone = round.games.every((g) => g.result !== "*");

  return (
    <div className="flex flex-col flex-shrink-0" style={{ width: COL_W }}>
      {/* Round header */}
      <div className="flex items-center gap-2 mb-3 h-7">
        <span className={`text-[11px] font-black uppercase tracking-wider ${
          isActive
            ? isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"
            : isDark ? "text-white/35" : "text-gray-400"
        }`} style={{ fontFamily: "'Clash Display', sans-serif" }}>
          {roundLabel}
        </span>
        {isActive && !allDone && (
          <span className={`flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
            isDark ? "bg-[#4CAF50]/15 text-[#4CAF50]" : "bg-[#3D6B47]/10 text-[#3D6B47]"
          }`}>
            <span className="w-1 h-1 rounded-full bg-[#4CAF50] animate-pulse" />
            Live
          </span>
        )}
        {allDone && (
          <span className={`flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
            isDark ? "bg-emerald-500/15 text-emerald-400" : "bg-emerald-50 text-emerald-600"
          }`}>
            <CheckCircle2 className="w-2.5 h-2.5" />
            Done
          </span>
        )}
      </div>

      {/* Cards — offset vertically to center within the bracket tree */}
      <div
        className="flex flex-col"
        style={{ gap: CARD_GAP, marginTop: verticalOffset }}
      >
        {round.games.map((game) => (
          <MatchCard
            key={game.id}
            game={game}
            players={players}
            elimPlayers={elimPlayers}
            isDark={isDark}
            isCurrentRound={isActive}
            myPlayerId={myPlayerId}
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
  const winner = game ? resultWinner(game) : null;
  const champId = winner === "white" ? game!.whiteId : winner === "black" ? game!.blackId : null;
  const champ = champId ? getPlayer(champId, players, elimPlayers) : null;
  const seed = champId ? getSeed(champId, elimPlayers) : null;

  return (
    <div
      className={`flex flex-col items-center justify-center rounded-xl border p-4 gap-3 flex-shrink-0 ${
        champ
          ? isDark
            ? "bg-[oklch(0.28_0.10_145)] border-amber-400/30"
            : "bg-amber-50 border-amber-200"
          : isDark
          ? "bg-[oklch(0.20_0.05_145)] border-white/06"
          : "bg-gray-50 border-gray-150"
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

// ─── Main Component ───────────────────────────────────────────────────────────

export function EliminationBracketView({
  rounds,
  players,
  elimPlayers,
  currentRound,
  allResultsIn,
  isDark,
  myPlayerId,
  onEnterResult,
  onAdvanceRound,
  onCompleteTournament,
  elimStartRound,
}: EliminationBracketViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!scrollRef.current) return;
    const activeCol = scrollRef.current.querySelector("[data-active-round='true']");
    if (activeCol) {
      activeCol.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [currentRound]);

  const roundLabels = useMemo(() => {
    const labels: Record<number, string> = {};
    for (const round of rounds) {
      const matchCount = round.games.filter((g) => g.whiteId !== "BYE").length;
      const playerCount = matchCount * 2;
      labels[round.number] = elimRoundLabel(playerCount);
    }
    return labels;
  }, [rounds]);

  const finalRound = rounds[rounds.length - 1];
  const finalGame = finalRound?.games[0];
  const isTournamentOver = finalGame?.result !== "*" && finalGame !== undefined;
  const isLastRound = currentRound === (finalRound?.number ?? currentRound);

  const T = {
    advanceBtn: isDark
      ? "bg-[oklch(0.42_0.14_145)] hover:bg-[oklch(0.48_0.16_145)] text-white"
      : "bg-[#3D6B47] hover:bg-[#2A5535] text-white",
    completeBtn: isDark
      ? "bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-400/30"
      : "bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200",
    emptyText: isDark ? "text-white/30" : "text-gray-400",
  };

  if (rounds.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center py-16 gap-3 rounded-2xl ${
        isDark ? "bg-[oklch(0.18_0.05_145)]" : "bg-gray-50"
      }`}>
        <Trophy className={`w-10 h-10 ${T.emptyText}`} />
        <p className={`text-sm font-semibold ${T.emptyText}`}>No bracket yet</p>
      </div>
    );
  }

  // ── Mobile carousel (< md breakpoint) ──
  const mobileCarousel = (
    <div className="md:hidden">
      <MobileBracketCarousel
        rounds={rounds}
        players={players}
        elimPlayers={elimPlayers}
        currentRound={currentRound}
        allResultsIn={allResultsIn}
        isDark={isDark}
        elimStartRound={elimStartRound}
        myPlayerId={myPlayerId}
        onEnterResult={onEnterResult}
        onAdvanceRound={onAdvanceRound}
        onCompleteTournament={onCompleteTournament}
      />
    </div>
  );

  // Compute the maximum number of matches in any round (first round = most matches)
  const maxMatches = Math.max(...rounds.map((r) => r.games.length));

  // Compute vertical offset for each round column so cards are centered
  function colOffset(matchCount: number): number {
    const colH = matchCount * CARD_H + Math.max(0, matchCount - 1) * CARD_GAP;
    const maxH = maxMatches * CARD_H + Math.max(0, maxMatches - 1) * CARD_GAP;
    return (maxH - colH) / 2;
  }

  return (
    <div className="flex flex-col gap-5">
      {/* ── Mobile carousel (hidden on md+) ── */}
      {mobileCarousel}

      {/* ── Desktop bracket tree (hidden on mobile) ── */}
      <div className="hidden md:flex flex-col gap-5">
      <div
        ref={scrollRef}
        className="overflow-x-auto pb-3"
        style={{ scrollbarWidth: "thin" }}
      >
        <div className="flex items-start min-w-max px-1 pt-1">
          {rounds.map((round, idx) => {
            const isActive = round.number === currentRound;
            const isLast = idx === rounds.length - 1;
            const nextRound = rounds[idx + 1];

            return (
              <React.Fragment key={round.number}>
                <div data-active-round={isActive ? "true" : undefined}>
                  <RoundColumn
                    round={round}
                    roundLabel={roundLabels[round.number] ?? `Round ${round.number - elimStartRound + 1}`}
                    players={players}
                    elimPlayers={elimPlayers}
                    currentRound={currentRound}
                    isDark={isDark}
                    myPlayerId={myPlayerId}
                    onEnterResult={onEnterResult}
                    verticalOffset={colOffset(round.games.length)}
                  />
                </div>

                {/* SVG connector to next round */}
                {!isLast && nextRound && (
                  <div style={{ marginTop: 28 /* header height */ }}>
                    <BracketConnector
                      matchCount={round.games.length}
                      nextCount={nextRound.games.length}
                      isDark={isDark}
                    />
                  </div>
                )}
              </React.Fragment>
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
              elimPlayers={elimPlayers}
              isDark={isDark}
            />
          </div>
        </div>
      </div>

      {/* ── Advance CTA ── */}
      {allResultsIn && !isTournamentOver && !isLastRound && (
        <div className={`flex items-center gap-3 p-4 rounded-2xl border ${
          isDark ? "bg-[oklch(0.22_0.06_145)] border-white/08" : "bg-white border-gray-100"
        }`}>
          <div className="flex-1">
            <p className={`text-sm font-bold ${isDark ? "text-white" : "text-gray-900"}`}>All matches complete</p>
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
            <p className={`text-sm font-bold ${isDark ? "text-white" : "text-gray-900"}`}>Final match complete</p>
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
          isDark ? "bg-amber-500/08 border-amber-400/20" : "bg-amber-50 border-amber-200"
        }`}>
          <Trophy className="w-5 h-5 text-amber-400 flex-shrink-0" />
          <div className="flex-1">
            <p className={`text-sm font-bold ${isDark ? "text-amber-300" : "text-amber-800"}`}>Tournament complete!</p>
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
      </div>{/* end desktop wrapper */}
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
    card: isDark ? "bg-[oklch(0.22_0.06_145)] border-white/08" : "bg-white border-gray-100",
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

  const cutoffOptions: number[] = [];
  for (let n = 2; n <= standings.length; n *= 2) cutoffOptions.push(n);
  if (!cutoffOptions.includes(cutoff)) cutoffOptions.push(cutoff);
  cutoffOptions.sort((a, b) => a - b);

  return (
    <div className={`rounded-2xl border overflow-hidden ${T.card}`}>
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
      <div className="divide-y" style={{ maxHeight: 420, overflowY: "auto" }}>
        {standings.map((row, idx) => {
          const rank = idx + 1;
          const advances = rank <= cutoff;
          const isCutoffLine = rank === cutoff;
          return (
            <React.Fragment key={row.player.id}>
              <div className={`flex items-center gap-3 px-5 py-2.5 transition-colors ${advances ? T.rowIn : T.row}`}>
                <span className={`text-[11px] font-bold w-6 text-center flex-shrink-0 ${T.rankBadge} rounded-md px-1 py-0.5`}>
                  {rank}
                </span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold truncate ${T.title}`}>{row.player.name}</p>
                </div>
                <span className={`text-xs tabular-nums font-bold ${isDark ? "text-white/60" : "text-gray-600"}`}>
                  {row.points}
                </span>
                <span className={`text-[10px] tabular-nums ${isDark ? "text-white/30" : "text-gray-400"}`}>
                  BH {row.buchholz.toFixed(1)}
                </span>
                {advances && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${T.advanceBadge}`}>✓</span>
                )}
              </div>
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
