/**
 * OTB Chess — Mobile Bracket Carousel
 *
 * A swipeable, round-by-round carousel for the elimination bracket on mobile.
 * Features:
 *   - Touch swipe left/right to navigate rounds
 *   - Pill tab strip at the top for direct round selection
 *   - Active round auto-selected on mount
 *   - Compact match cards with seed badges, player names, ELO, scores
 *   - Winner flash animation on result entry
 *   - Champion slide at the end
 *   - Result entry buttons for the director view
 */

import React, { useRef, useState, useEffect, useCallback } from "react";
import { Trophy, Crown, ChevronLeft, ChevronRight, CheckCircle2, Zap } from "lucide-react";
import { elimRoundLabel } from "@/lib/swiss";
import type { Round, Player, Game, Result } from "@/lib/tournamentData";

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

// ─── Mobile Match Card ─────────────────────────────────────────────────────────

interface MobileMatchCardProps {
  game: Game;
  players: Player[];
  elimPlayers: Player[];
  isDark: boolean;
  isCurrentRound: boolean;
  matchNumber: number;
  onEnterResult?: (gameId: string, result: Result) => void;
}

function MobileMatchCard({
  game,
  players,
  elimPlayers,
  isDark,
  isCurrentRound,
  matchNumber,
  onEnterResult,
}: MobileMatchCardProps) {
  const isBye = game.whiteId === "BYE" || game.blackId === "BYE";
  const isPending = game.result === "*";
  const winner = resultWinner(game);

  const prevResultRef = useRef<string>(game.result);
  const [flashSide, setFlashSide] = useState<"white" | "black" | null>(null);

  useEffect(() => {
    const prev = prevResultRef.current;
    if (prev === "*" && game.result !== "*") {
      const w = resultWinner(game);
      if (w === "white" || w === "black") {
        setFlashSide(w);
        const t = setTimeout(() => setFlashSide(null), 800);
        return () => clearTimeout(t);
      }
    }
    prevResultRef.current = game.result;
  }, [game.result]); // eslint-disable-line react-hooks/exhaustive-deps

  const white = game.whiteId === "BYE" ? null : (getPlayer(game.whiteId, players, elimPlayers) ?? null);
  const black = game.blackId === "BYE" ? null : (getPlayer(game.blackId, players, elimPlayers) ?? null);
  const whiteSeed = game.whiteId === "BYE" ? null : getSeed(game.whiteId, elimPlayers);
  const blackSeed = game.blackId === "BYE" ? null : getSeed(game.blackId, elimPlayers);

  const whiteScore = game.result === "1-0" ? "1" : game.result === "½-½" ? "½" : game.result === "0-1" ? "0" : null;
  const blackScore = game.result === "0-1" ? "1" : game.result === "½-½" ? "½" : game.result === "1-0" ? "0" : null;

  const cardBg = isDark ? "bg-[oklch(0.22_0.06_145)]" : "bg-white";
  const cardBorder = isCurrentRound && isPending
    ? isDark ? "border-[#4CAF50]/40 shadow-[0_0_0_1px_rgba(76,175,80,0.12)]" : "border-[#3D6B47]/35"
    : isDark ? "border-white/08" : "border-gray-200";
  const divider = isDark ? "border-white/06" : "border-gray-100";
  const loserText = isDark ? "text-white/28" : "text-gray-300";
  const winnerBg = isDark ? "bg-[#3D6B47]/25" : "bg-[#3D6B47]/07";

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
        <div className="flex items-center gap-3 px-4 py-3 opacity-30">
          <span className={`text-[10px] font-bold w-6 text-center ${isDark ? "text-white/30" : "text-gray-300"}`}>—</span>
          <span className={`text-sm italic ${isDark ? "text-white/30" : "text-gray-300"}`}>BYE</span>
        </div>
      );
    }
    const shouldFlash = flashSide === side;
    return (
      <div className={`relative flex items-center gap-3 px-4 py-3 transition-colors ${isWinner ? winnerBg : ""} ${shouldFlash ? "animate-bracket-winner-flash" : ""}`}>
        {/* Green left accent on winner */}
        {isWinner && (
          <div className="absolute left-0 top-0 bottom-0 w-1 rounded-r-full bg-[#4CAF50]" />
        )}
        {/* Seed badge */}
        <span
          title={`Swiss seed #${seed}`}
          className={`text-[10px] font-black flex-shrink-0 w-[26px] h-[20px] flex items-center justify-center rounded border ${seedBadgeClass(seed, isDark)}`}
        >
          {seed != null ? `#${seed}` : "?"}
        </span>
        {/* Avatar placeholder */}
        <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-black ${
          isLoser
            ? isDark ? "bg-white/06 text-white/20" : "bg-gray-100 text-gray-300"
            : isDark ? "bg-[#3D6B47]/40 text-[#4CAF50]" : "bg-[#3D6B47]/10 text-[#3D6B47]"
        }`}>
          {(player?.name ?? playerId).charAt(0).toUpperCase()}
        </div>
        {/* Name + ELO */}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold truncate leading-tight ${
            isLoser ? loserText : isDark ? "text-white/90" : "text-gray-900"
          }`}>
            {player?.name ?? playerId}
          </p>
          {player?.elo && (
            <p className={`text-[11px] tabular-nums ${isDark ? "text-white/30" : "text-gray-400"}`}>
              {player.elo}
            </p>
          )}
        </div>
        {/* Score */}
        {score !== null && (
          <span className={`text-lg font-black tabular-nums flex-shrink-0 w-5 text-right ${
            isWinner ? (isDark ? "text-[#4CAF50]" : "text-[#3D6B47]") : loserText
          }`}>
            {score}
          </span>
        )}
        {/* Crown */}
        {isWinner && <Crown className={`w-4 h-4 flex-shrink-0 ${isDark ? "text-amber-400" : "text-amber-500"}`} strokeWidth={2} />}
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border overflow-hidden ${cardBg} ${cardBorder} ${isBye ? "opacity-50" : ""}`}>
      {/* Match number header */}
      <div className={`flex items-center justify-between px-4 py-2 border-b ${divider}`}>
        <span className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? "text-white/30" : "text-gray-400"}`}>
          Match {matchNumber}
        </span>
        {!isPending && (
          <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
            isDark ? "bg-emerald-500/15 text-emerald-400" : "bg-emerald-50 text-emerald-600"
          }`}>
            <CheckCircle2 className="w-3 h-3" />
            Done
          </span>
        )}
        {isPending && isCurrentRound && (
          <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
            isDark ? "bg-[#4CAF50]/15 text-[#4CAF50]" : "bg-[#3D6B47]/10 text-[#3D6B47]"
          }`}>
            <span className="w-1.5 h-1.5 rounded-full bg-[#4CAF50] animate-pulse" />
            Live
          </span>
        )}
      </div>

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
      <div className={`border-t mx-4 ${divider}`} />
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
        <div className={`flex gap-2 px-3 pb-3 pt-2 border-t ${divider}`}>
          <button
            onClick={() => onEnterResult(game.id, "1-0")}
            className={`flex-1 text-xs font-bold py-2.5 rounded-xl border transition-all active:scale-95 truncate ${
              isDark
                ? "bg-white/08 hover:bg-white/14 text-white/70 border-white/08"
                : "bg-gray-50 hover:bg-gray-100 text-gray-600 border-gray-200"
            }`}
          >
            {white?.name?.split(" ")[0] ?? "White"} wins
          </button>
          <button
            onClick={() => onEnterResult(game.id, "½-½")}
            className={`flex-none text-xs font-bold px-3 py-2.5 rounded-xl border transition-all active:scale-95 ${
              isDark
                ? "bg-white/05 hover:bg-white/10 text-white/50 border-white/06"
                : "bg-gray-50 hover:bg-gray-100 text-gray-400 border-gray-200"
            }`}
          >
            Draw
          </button>
          <button
            onClick={() => onEnterResult(game.id, "0-1")}
            className={`flex-1 text-xs font-bold py-2.5 rounded-xl border transition-all active:scale-95 truncate ${
              isDark
                ? "bg-white/08 hover:bg-white/14 text-white/70 border-white/08"
                : "bg-gray-50 hover:bg-gray-100 text-gray-600 border-gray-200"
            }`}
          >
            {black?.name?.split(" ")[0] ?? "Black"} wins
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Champion Slide ────────────────────────────────────────────────────────────

function ChampionSlide({
  finalGame,
  players,
  elimPlayers,
  isDark,
}: {
  finalGame: Game | undefined;
  players: Player[];
  elimPlayers: Player[];
  isDark: boolean;
}) {
  const winner = finalGame ? resultWinner(finalGame) : null;
  const champId = winner === "white" ? finalGame!.whiteId : winner === "black" ? finalGame!.blackId : null;
  const champ = champId ? getPlayer(champId, players, elimPlayers) : null;
  const seed = champId ? getSeed(champId, elimPlayers) : null;

  return (
    <div className={`flex flex-col items-center justify-center gap-5 py-10 px-6 rounded-2xl border min-h-[260px] ${
      champ
        ? isDark ? "bg-[oklch(0.28_0.10_145)] border-amber-400/30" : "bg-amber-50 border-amber-200"
        : isDark ? "bg-[oklch(0.20_0.05_145)] border-white/06" : "bg-gray-50 border-gray-200"
    }`}>
      <div className="relative">
        <div className={`w-20 h-20 rounded-full flex items-center justify-center ${
          champ ? "bg-amber-400/20" : isDark ? "bg-white/06" : "bg-gray-100"
        }`}>
          <Trophy className={`w-10 h-10 ${champ ? "text-amber-400" : isDark ? "text-white/20" : "text-gray-300"}`} />
        </div>
        {champ && (
          <Crown className="w-5 h-5 text-amber-400 absolute -top-1 -right-1" strokeWidth={2} />
        )}
      </div>

      {champ ? (
        <div className="text-center">
          <p className={`text-xs font-bold uppercase tracking-widest mb-2 ${isDark ? "text-amber-400/70" : "text-amber-600"}`}>
            Tournament Champion
          </p>
          <p className={`text-2xl font-black leading-tight mb-1 ${isDark ? "text-white" : "text-gray-900"}`}
            style={{ fontFamily: "'Clash Display', sans-serif" }}>
            {champ.name}
          </p>
          <p className={`text-sm ${isDark ? "text-white/40" : "text-gray-400"}`}>
            {seed ? `Seed #${seed}` : ""}{champ.elo ? ` · ${champ.elo} ELO` : ""}
          </p>
        </div>
      ) : (
        <div className="text-center">
          <p className={`text-lg font-bold mb-1 ${isDark ? "text-white/40" : "text-gray-400"}`}>
            Champion TBD
          </p>
          <p className={`text-sm ${isDark ? "text-white/25" : "text-gray-300"}`}>
            Complete the final match to crown the winner.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Main Carousel ─────────────────────────────────────────────────────────────

export interface MobileBracketCarouselProps {
  rounds: Round[];
  players: Player[];
  elimPlayers: Player[];
  currentRound: number;
  allResultsIn: boolean;
  isDark: boolean;
  elimStartRound: number;
  onEnterResult?: (gameId: string, result: Result) => void;
  onAdvanceRound?: () => void;
  onCompleteTournament?: () => void;
}

export function MobileBracketCarousel({
  rounds,
  players,
  elimPlayers,
  currentRound,
  allResultsIn,
  isDark,
  elimStartRound,
  onEnterResult,
  onAdvanceRound,
  onCompleteTournament,
}: MobileBracketCarouselProps) {
  // Slides: one per round + champion slide at the end
  const totalSlides = rounds.length + 1; // +1 for champion
  const championIdx = rounds.length;

  // Default to the active round
  const activeRoundIdx = rounds.findIndex((r) => r.number === currentRound);
  const [slideIdx, setSlideIdx] = useState(Math.max(0, activeRoundIdx));

  // Sync to active round when currentRound changes
  useEffect(() => {
    const idx = rounds.findIndex((r) => r.number === currentRound);
    if (idx >= 0) setSlideIdx(idx);
  }, [currentRound, rounds]);

  // Touch swipe state
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const goTo = useCallback((idx: number) => {
    setSlideIdx(Math.max(0, Math.min(totalSlides - 1, idx)));
    setDragOffset(0);
    setIsDragging(false);
  }, [totalSlides]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;
    // Only track horizontal swipes
    if (Math.abs(dy) > Math.abs(dx)) {
      setIsDragging(false);
      return;
    }
    setDragOffset(dx);
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    const threshold = 50;
    if (dragOffset < -threshold && slideIdx < totalSlides - 1) {
      goTo(slideIdx + 1);
    } else if (dragOffset > threshold && slideIdx > 0) {
      goTo(slideIdx - 1);
    } else {
      setDragOffset(0);
      setIsDragging(false);
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  const roundLabels = rounds.map((r) => {
    const matchCount = r.games.filter((g) => g.whiteId !== "BYE").length;
    return elimRoundLabel(matchCount * 2);
  });

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
    tabBg: isDark ? "bg-[oklch(0.18_0.05_145)]" : "bg-gray-100",
    tabActive: isDark ? "bg-[oklch(0.32_0.10_145)] text-white shadow-sm" : "bg-white text-gray-900 shadow-sm",
    tabInactive: isDark ? "text-white/40" : "text-gray-400",
    navBtn: isDark ? "bg-white/08 hover:bg-white/14 text-white/60 border-white/08" : "bg-white hover:bg-gray-50 text-gray-500 border-gray-200",
  };

  if (rounds.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center py-16 gap-3 rounded-2xl ${
        isDark ? "bg-[oklch(0.18_0.05_145)]" : "bg-gray-50"
      }`}>
        <Trophy className={`w-10 h-10 ${isDark ? "text-white/20" : "text-gray-300"}`} />
        <p className={`text-sm font-semibold ${isDark ? "text-white/30" : "text-gray-400"}`}>No bracket yet</p>
      </div>
    );
  }

  const currentSlideRound = slideIdx < rounds.length ? rounds[slideIdx] : null;
  const isCurrentSlideActive = currentSlideRound?.number === currentRound;

  return (
    <div className="flex flex-col gap-4">

      {/* ── Tab strip ── */}
      <div className={`flex items-center gap-1 p-1 rounded-2xl overflow-x-auto ${T.tabBg}`}
        style={{ scrollbarWidth: "none" }}>
        {rounds.map((round, idx) => {
          const isActive = idx === slideIdx;
          const isDone = round.games.every((g) => g.result !== "*");
          const isLive = round.number === currentRound && !isDone;
          return (
            <button
              key={round.number}
              onClick={() => goTo(idx)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                isActive ? T.tabActive : T.tabInactive
              }`}
            >
              {isLive && <span className="w-1.5 h-1.5 rounded-full bg-[#4CAF50] animate-pulse flex-shrink-0" />}
              {isDone && !isLive && <CheckCircle2 className="w-3 h-3 flex-shrink-0 text-emerald-400" />}
              <span>{roundLabels[idx]}</span>
            </button>
          );
        })}
        {/* Champion tab */}
        <button
          onClick={() => goTo(championIdx)}
          className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
            slideIdx === championIdx ? T.tabActive : T.tabInactive
          }`}
        >
          <Trophy className="w-3 h-3 flex-shrink-0 text-amber-400" />
          <span>Final</span>
        </button>
      </div>

      {/* ── Slide viewport ── */}
      <div
        className="relative overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Slide track */}
        <div
          className="flex transition-transform"
          style={{
            transform: `translateX(calc(${-slideIdx * 100}% + ${dragOffset}px))`,
            transition: isDragging ? "none" : "transform 0.32s cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          {/* Round slides */}
          {rounds.map((round, idx) => {
            const isActive = round.number === currentRound;
            return (
              <div key={round.number} className="w-full flex-shrink-0 flex flex-col gap-3 px-0.5">
                {/* Round header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className={`text-base font-black ${isDark ? "text-white" : "text-gray-900"}`}
                      style={{ fontFamily: "'Clash Display', sans-serif" }}>
                      {roundLabels[idx]}
                    </h3>
                    {isActive && round.games.some((g) => g.result === "*") && (
                      <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isDark ? "bg-[#4CAF50]/15 text-[#4CAF50]" : "bg-[#3D6B47]/10 text-[#3D6B47]"
                      }`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-[#4CAF50] animate-pulse" />
                        Live
                      </span>
                    )}
                  </div>
                  <span className={`text-xs ${isDark ? "text-white/30" : "text-gray-400"}`}>
                    {round.games.filter((g) => g.result !== "*").length}/{round.games.length} done
                  </span>
                </div>

                {/* Match cards */}
                {round.games.map((game, gIdx) => (
                  <MobileMatchCard
                    key={game.id}
                    game={game}
                    players={players}
                    elimPlayers={elimPlayers}
                    isDark={isDark}
                    isCurrentRound={isActive}
                    matchNumber={gIdx + 1}
                    onEnterResult={onEnterResult}
                  />
                ))}
              </div>
            );
          })}

          {/* Champion slide */}
          <div className="w-full flex-shrink-0 flex flex-col gap-3 px-0.5">
            <h3 className={`text-base font-black ${isDark ? "text-white" : "text-gray-900"}`}
              style={{ fontFamily: "'Clash Display', sans-serif" }}>
              Champion
            </h3>
            <ChampionSlide
              finalGame={finalGame}
              players={players}
              elimPlayers={elimPlayers}
              isDark={isDark}
            />
          </div>
        </div>
      </div>

      {/* ── Prev / Next nav + dot indicators ── */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => goTo(slideIdx - 1)}
          disabled={slideIdx === 0}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all active:scale-95 disabled:opacity-30 ${T.navBtn}`}
        >
          <ChevronLeft className="w-4 h-4" />
          Prev
        </button>

        {/* Dot indicators */}
        <div className="flex items-center gap-1.5">
          {Array.from({ length: totalSlides }).map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={`rounded-full transition-all ${
                i === slideIdx
                  ? isDark ? "w-4 h-2 bg-[#4CAF50]" : "w-4 h-2 bg-[#3D6B47]"
                  : isDark ? "w-2 h-2 bg-white/20" : "w-2 h-2 bg-gray-300"
              }`}
            />
          ))}
        </div>

        <button
          onClick={() => goTo(slideIdx + 1)}
          disabled={slideIdx === totalSlides - 1}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all active:scale-95 disabled:opacity-30 ${T.navBtn}`}
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* ── Director CTAs (shown when on active round slide) ── */}
      {onAdvanceRound && isCurrentSlideActive && allResultsIn && !isTournamentOver && (
        <div className={`flex items-center gap-3 p-4 rounded-2xl border ${
          isDark ? "bg-[oklch(0.22_0.06_145)] border-white/08" : "bg-white border-gray-100"
        }`}>
          <div className="flex-1">
            <p className={`text-sm font-bold ${isDark ? "text-white" : "text-gray-900"}`}>All matches complete</p>
            <p className={`text-xs mt-0.5 ${isDark ? "text-white/45" : "text-gray-500"}`}>
              {isLastRound ? "Enter the final result, then complete." : "Ready for the next round."}
            </p>
          </div>
          <button
            onClick={onAdvanceRound}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95 ${T.advanceBtn}`}
          >
            <Zap className="w-4 h-4" />
            Next
          </button>
        </div>
      )}

      {onCompleteTournament && isTournamentOver && (
        <div className={`flex items-center gap-3 p-4 rounded-2xl border ${
          isDark ? "bg-amber-500/08 border-amber-400/20" : "bg-amber-50 border-amber-200"
        }`}>
          <Trophy className="w-5 h-5 text-amber-400 flex-shrink-0" />
          <div className="flex-1">
            <p className={`text-sm font-bold ${isDark ? "text-amber-300" : "text-amber-800"}`}>Tournament complete!</p>
            <p className={`text-xs mt-0.5 ${isDark ? "text-amber-400/60" : "text-amber-600"}`}>
              The champion has been crowned.
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
