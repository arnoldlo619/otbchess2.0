/**
 * OTB Chess — Quads Director Panel (v2 Redesign)
 *
 * Renders inside the Tournament Director page when format === "quads".
 * Redesigned for clarity:
 *  - All sections visible simultaneously (no accordion collapse)
 *  - Per-section round tabs (R1 / R2 / R3) instead of vertical stacking
 *  - Larger, more tappable result buttons
 *  - Progress ring per section for instant status
 *  - Inline standings toggle per section
 *  - Board-centric game rows with clear White/Black distinction
 */
import { useState, useMemo, useRef, useEffect } from "react";
import {
  Users,
  Trophy,
  ArrowLeftRight,
  Check,
  BarChart3,
  Swords,
  Pencil,
  X,
} from "lucide-react";
import type { Player, Game, Result } from "../../lib/tournamentData";
import type { QuadSection } from "../../lib/quads";
import {
  calculateQuadStandings,
  formatRatingRange,
  getSectionWinners,
} from "../../lib/quads";

// ─── Types ────────────────────────────────────────────────────────────────────

interface QuadsDirectorPanelProps {
  sections: QuadSection[];
  players: Player[];
  games: Game[];
  currentRound: number;
  totalRounds: number;
  onEnterResult: (gameId: string, result: Result) => void;
  onSwapPlayers?: (sectionId: string, playerIdA: string, playerIdB: string) => void;
  onRenameSection?: (sectionId: string, newName: string) => void;
  onAdvanceRound?: () => void;
  onCompleteTournament?: () => void;
  isDark: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getPlayerName(players: Player[], id: string): string {
  if (id === "BYE") return "BYE";
  return players.find((p) => p.id === id)?.name ?? id;
}

function getPlayerRating(players: Player[], id: string): number {
  return players.find((p) => p.id === id)?.elo ?? 0;
}

function resultLabel(result: Result): string {
  switch (result) {
    case "1-0": return "1–0";
    case "0-1": return "0–1";
    case "½-½": return "½–½";
    case "*": return "—";
    default: return result;
  }
}

// ─── Progress Ring ────────────────────────────────────────────────────────────

function ProgressRing({ completed, total, size = 36, isDark }: { completed: number; total: number; size?: number; isDark: boolean }) {
  const pct = total > 0 ? completed / total : 0;
  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - pct);
  const isComplete = pct === 1;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="rotate-[-90deg]">
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={3}
          stroke={isDark ? "oklch(0.22 0.02 145)" : "#e5e7eb"}
        />
        {/* Progress ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={3}
          strokeLinecap="round"
          stroke={isComplete ? "oklch(0.75 0.15 85)" : "oklch(0.72 0.19 145)"}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-500"
        />
      </svg>
      <span
        className="absolute text-[9px] font-bold"
        style={{ color: isComplete ? "oklch(0.75 0.15 85)" : (isDark ? "oklch(0.65 0.03 145)" : "#6b7280") }}
      >
        {completed}/{total}
      </span>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function QuadsDirectorPanel({
  sections,
  players,
  games,
  currentRound,
  totalRounds,
  onEnterResult,
  onSwapPlayers,
  onRenameSection,
  onAdvanceRound,
  onCompleteTournament,
  isDark,
}: QuadsDirectorPanelProps) {
  // Per-section state: which round tab is active, and pairings vs standings view
  const [sectionRoundTab, setSectionRoundTab] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    sections.forEach((s) => { init[s.id] = currentRound; });
    return init;
  });
  const [sectionView, setSectionView] = useState<Record<string, "pairings" | "standings">>(() => {
    const init: Record<string, "pairings" | "standings"> = {};
    sections.forEach((s) => { init[s.id] = "pairings"; });
    return init;
  });

  const [swapMode, setSwapMode] = useState(false);
  const [swapPlayerA, setSwapPlayerA] = useState<string | null>(null);

  // Inline rename state
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingSectionId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [editingSectionId]);

  const startRename = (section: { id: string; name: string }) => {
    setEditingSectionId(section.id);
    setEditingName(section.name);
  };

  const commitRename = (sectionId: string) => {
    if (onRenameSection && editingName.trim()) {
      onRenameSection(sectionId, editingName.trim());
    }
    setEditingSectionId(null);
    setEditingName("");
  };

  const cancelRename = () => {
    setEditingSectionId(null);
    setEditingName("");
  };

  // Group games by section
  const gamesBySection = useMemo(() => {
    const map = new Map<string, Game[]>();
    for (const section of sections) {
      map.set(section.id, games.filter((g) => g.sectionId === section.id));
    }
    return map;
  }, [sections, games]);

  // Calculate standings per section
  const standingsBySection = useMemo(() => {
    const map = new Map<string, ReturnType<typeof calculateQuadStandings>>();
    for (const section of sections) {
      const sectionGames = gamesBySection.get(section.id) ?? [];
      map.set(section.id, calculateQuadStandings(section, sectionGames, players));
    }
    return map;
  }, [sections, gamesBySection, players]);

  // Section completion status
  const sectionStatus = useMemo(() => {
    const map = new Map<string, { completed: number; total: number; pct: number }>();
    for (const section of sections) {
      const sectionGames = gamesBySection.get(section.id) ?? [];
      const completed = sectionGames.filter((g) => g.result !== "*").length;
      const total = sectionGames.length;
      map.set(section.id, { completed, total, pct: total > 0 ? Math.round((completed / total) * 100) : 0 });
    }
    return map;
  }, [sections, gamesBySection]);

  // Determine if swaps are allowed (no results entered yet)
  const hasAnyResults = games.some((g) => g.result !== "*" && g.blackId !== "BYE");
  const canSwap = !!onSwapPlayers && !hasAnyResults;

  const handlePlayerClick = (playerId: string) => {
    if (!swapMode || !canSwap) return;
    if (!swapPlayerA) {
      setSwapPlayerA(playerId);
    } else if (swapPlayerA === playerId) {
      setSwapPlayerA(null);
    } else {
      const sectionA = sections.find((s) => s.playerIds.includes(swapPlayerA));
      const sectionB = sections.find((s) => s.playerIds.includes(playerId));
      if (sectionA && sectionB && sectionA.id !== sectionB.id) {
        onSwapPlayers!(sectionA.id, swapPlayerA, playerId);
      }
      setSwapPlayerA(null);
      setSwapMode(false);
    }
  };

  const T = {
    card: isDark ? "oklch(0.16 0.03 145)" : "#ffffff",
    cardBorder: isDark ? "oklch(0.26 0.04 145)" : "#e2e8f0",
    cardHover: isDark ? "oklch(0.18 0.04 145)" : "#f8fafc",
    text: isDark ? "oklch(0.92 0.02 145)" : "#1a1a1a",
    textMuted: isDark ? "oklch(0.60 0.03 145)" : "#6b7280",
    textDim: isDark ? "oklch(0.45 0.02 145)" : "#9ca3af",
    green: "oklch(0.72 0.19 145)",
    greenBg: isDark ? "oklch(0.20 0.06 145)" : "oklch(0.96 0.04 145)",
    greenBorder: isDark ? "oklch(0.32 0.10 145)" : "oklch(0.80 0.12 145)",
    greenSoft: isDark ? "oklch(0.25 0.08 145)" : "oklch(0.92 0.06 145)",
    goldBg: isDark ? "oklch(0.22 0.06 85)" : "oklch(0.95 0.06 85)",
    goldBorder: isDark ? "oklch(0.38 0.10 85)" : "oklch(0.80 0.10 85)",
    gold: "oklch(0.75 0.15 85)",
    swapHighlight: isDark ? "oklch(0.28 0.12 200)" : "oklch(0.90 0.08 200)",
    swapBorder: isDark ? "oklch(0.45 0.15 200)" : "oklch(0.60 0.15 200)",
    swap: "oklch(0.65 0.18 200)",
    rowBg: isDark ? "oklch(0.13 0.02 145)" : "#f9fafb",
    rowBorder: isDark ? "oklch(0.22 0.03 145)" : "#f1f5f9",
  };

  return (
    <div className="space-y-4">
      {/* Top toolbar */}
      <div className="flex items-center justify-between">
        <h3
          className="text-sm font-bold uppercase tracking-wider flex items-center gap-2"
          style={{ color: T.textMuted }}
        >
          <Users size={14} style={{ color: T.green }} />
          Sections ({sections.length})
        </h3>
        {canSwap && (
          <button
            onClick={() => { setSwapMode(!swapMode); setSwapPlayerA(null); }}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5"
            style={{
              background: swapMode ? T.swapHighlight : "transparent",
              color: swapMode ? T.swap : T.textMuted,
              border: `1px solid ${swapMode ? T.swapBorder : T.cardBorder}`,
            }}
          >
            <ArrowLeftRight size={12} />
            {swapMode ? "Cancel Swap" : "Swap Players"}
          </button>
        )}
      </div>

      {/* All Section Cards — always visible */}
      {sections.map((section) => {
        const status = sectionStatus.get(section.id)!;
        const standings = standingsBySection.get(section.id) ?? [];
        const sectionGames = gamesBySection.get(section.id) ?? [];
        const winner = status.pct === 100 ? getSectionWinners(standings)[0] : null;
        const activeRound = sectionRoundTab[section.id] ?? currentRound;
        const view = sectionView[section.id] ?? "pairings";

        return (
          <div
            key={section.id}
            className="group rounded-2xl border overflow-hidden transition-all"
            style={{
              background: T.card,
              borderColor: winner ? T.goldBorder : T.cardBorder,
              boxShadow: winner
                ? `0 0 0 1px ${T.goldBorder}, 0 2px 12px ${isDark ? "oklch(0.75 0.15 85 / 0.08)" : "oklch(0.75 0.15 85 / 0.12)"}`
                : "none",
            }}
          >
            {/* Section Header */}
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-4">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 relative overflow-hidden"
                  style={{
                    background: section.type === "quad"
                      ? `linear-gradient(135deg, oklch(0.22 0.08 145), oklch(0.18 0.05 145))`
                      : `linear-gradient(135deg, oklch(0.24 0.08 85), oklch(0.20 0.05 85))`,
                    border: `1.5px solid ${section.type === "quad" ? T.greenBorder : T.goldBorder}`,
                    boxShadow: section.type === "quad"
                      ? `0 4px 14px oklch(0.72 0.19 145 / 0.25), inset 0 1px 0 oklch(0.72 0.19 145 / 0.15)`
                      : `0 4px 14px oklch(0.75 0.15 85 / 0.25), inset 0 1px 0 oklch(0.75 0.15 85 / 0.15)`,
                  }}
                >
                  {/* Subtle radial shine */}
                  <div className="absolute inset-0 rounded-2xl" style={{ background: "radial-gradient(circle at 35% 30%, rgba(255,255,255,0.12) 0%, transparent 65%)" }} />
                  {section.type === "quad" ? (
                    /* Chess grid / quad icon */
                    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect x="1" y="1" width="9" height="9" rx="2" fill={T.green} opacity="0.9" />
                      <rect x="12" y="1" width="9" height="9" rx="2" fill={T.green} opacity="0.5" />
                      <rect x="1" y="12" width="9" height="9" rx="2" fill={T.green} opacity="0.5" />
                      <rect x="12" y="12" width="9" height="9" rx="2" fill={T.green} opacity="0.9" />
                    </svg>
                  ) : (
                    /* Crown / trophy icon for non-quad sections */
                    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M3 16h16v2H3zM3 14l3-7 5 4 5-4 3 7H3z" fill={T.gold} opacity="0.9" />
                      <circle cx="3" cy="7" r="2" fill={T.gold} />
                      <circle cx="11" cy="5" r="2" fill={T.gold} />
                      <circle cx="19" cy="7" r="2" fill={T.gold} />
                    </svg>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    {editingSectionId === section.id ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          ref={renameInputRef}
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitRename(section.id);
                            if (e.key === "Escape") cancelRename();
                          }}
                          onBlur={() => commitRename(section.id)}
                          className="text-base font-extrabold tracking-tight rounded-lg px-2 py-0.5 outline-none w-40"
                          style={{
                            color: T.text,
                            fontFamily: "'Clash Display', sans-serif",
                            background: T.greenBg,
                            border: `1.5px solid ${T.greenBorder}`,
                          }}
                        />
                        <button
                          onClick={cancelRename}
                          className="w-5 h-5 flex items-center justify-center rounded-full transition-colors"
                          style={{ color: T.textMuted }}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="text-base font-extrabold tracking-tight" style={{ color: T.text, fontFamily: "'Clash Display', sans-serif" }}>
                          {section.name}
                        </span>
                        {onRenameSection && (
                          <button
                            onClick={() => startRename(section)}
                            className="w-6 h-6 flex items-center justify-center rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                            style={{ color: T.textMuted }}
                            title="Rename section"
                          >
                            <Pencil size={11} />
                          </button>
                        )}
                      </>
                    )}
                    {winner && (
                      <span
                        className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold"
                        style={{ background: T.goldBg, border: `1px solid ${T.goldBorder}`, color: T.gold }}
                      >
                        <Trophy size={10} />
                        {getPlayerName(players, winner.playerId).split(" ")[0]}
                      </span>
                    )}
                  </div>
                  <div className="text-xs mt-1 font-medium" style={{ color: T.textMuted }}>
                    {formatRatingRange(section)} · {section.playerIds.length} players
                  </div>
                </div>
              </div>
              <ProgressRing completed={status.completed} total={status.total} size={44} isDark={isDark} />
            </div>

            {/* Swap Mode: Player chips */}
            {swapMode && (
              <div className="px-4 py-2.5 border-t" style={{ borderColor: T.cardBorder, background: isDark ? "oklch(0.14 0.02 145)" : "#f8fafc" }}>
                <div className="flex flex-wrap gap-1.5">
                  {section.playerIds.map((pid) => {
                    const isSelected = swapPlayerA === pid;
                    const isTarget = swapPlayerA ? !section.playerIds.includes(swapPlayerA) : false;
                    return (
                      <button
                        key={pid}
                        onClick={() => handlePlayerClick(pid)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:scale-[1.03] active:scale-95"
                        style={{
                          background: isSelected ? T.swapHighlight : (isDark ? "oklch(0.18 0.02 145)" : "#fff"),
                          border: `1.5px solid ${isSelected ? T.swapBorder : (isTarget ? T.greenBorder : T.cardBorder)}`,
                          color: isSelected ? T.swap : T.text,
                          boxShadow: isSelected ? `0 0 8px ${T.swapBorder}` : "0 1px 2px rgba(0,0,0,0.05)",
                        }}
                      >
                        {getPlayerName(players, pid)}
                        <span className="ml-1.5 opacity-50 font-mono">{getPlayerRating(players, pid)}</span>
                      </button>
                    );
                  })}
                </div>
                {swapPlayerA && !section.playerIds.includes(swapPlayerA) && (
                  <p className="text-[11px] mt-2 font-medium" style={{ color: T.swap }}>
                    Select a player above to swap with {getPlayerName(players, swapPlayerA)}
                  </p>
                )}
              </div>
            )}

            {/* View Toggle + Round Tabs */}
            {!swapMode && (
              <div
                className="flex items-center justify-between px-4 py-2 border-t"
                style={{ borderColor: T.cardBorder, background: isDark ? "oklch(0.14 0.02 145)" : "#fafbfc" }}
              >
                {/* Round tabs */}
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalRounds }, (_, i) => i + 1).map((roundNum) => {
                    const isActive = activeRound === roundNum;
                    const roundGames = sectionGames.filter((g) => g.round === roundNum);
                    const roundComplete = roundGames.every((g) => g.result !== "*");
                    const isCurrent = roundNum === currentRound;

                    return (
                      <button
                        key={roundNum}
                        onClick={() => setSectionRoundTab((prev) => ({ ...prev, [section.id]: roundNum }))}
                        className="relative px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                        style={{
                          background: isActive ? T.greenBg : "transparent",
                          color: isActive ? T.green : T.textMuted,
                          border: `1px solid ${isActive ? T.greenBorder : "transparent"}`,
                        }}
                      >
                        R{roundNum}
                        {roundComplete && (
                          <span
                            className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full flex items-center justify-center"
                            style={{ background: T.green }}
                          >
                            <Check size={7} color={isDark ? "#0a1a0f" : "#fff"} strokeWidth={3} />
                          </span>
                        )}
                        {isCurrent && !roundComplete && (
                          <span
                            className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full animate-pulse"
                            style={{ background: T.green, opacity: 0.7 }}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Pairings / Standings toggle */}
                <div className="flex items-center gap-0.5 p-0.5 rounded-lg" style={{ background: isDark ? "oklch(0.12 0.02 145)" : "#f1f5f9" }}>
                  <button
                    onClick={() => setSectionView((prev) => ({ ...prev, [section.id]: "pairings" }))}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all"
                    style={{
                      background: view === "pairings" ? (isDark ? T.card : "#fff") : "transparent",
                      color: view === "pairings" ? T.green : T.textDim,
                      boxShadow: view === "pairings" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                    }}
                  >
                    <Swords size={10} />
                    Boards
                  </button>
                  <button
                    onClick={() => setSectionView((prev) => ({ ...prev, [section.id]: "standings" }))}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all"
                    style={{
                      background: view === "standings" ? (isDark ? T.card : "#fff") : "transparent",
                      color: view === "standings" ? T.green : T.textDim,
                      boxShadow: view === "standings" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                    }}
                  >
                    <BarChart3 size={10} />
                    Table
                  </button>
                </div>
              </div>
            )}

            {/* Content Area */}
            {!swapMode && (
              <div className="px-4 pb-4 pt-2">
                {view === "pairings" ? (
                  <RoundPairings
                    section={section}
                    games={sectionGames}
                    players={players}
                    roundNum={activeRound}
                    currentRound={currentRound}
                    onEnterResult={onEnterResult}
                    isDark={isDark}
                    T={T}
                  />
                ) : (
                  <StandingsView
                    section={section}
                    standings={standings}
                    players={players}
                    isDark={isDark}
                    T={T}
                  />
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Round Advancement CTA */}
      {onAdvanceRound && (() => {
        const currentRoundGames = games.filter((g) => g.round === currentRound);
        const allCurrentDone = currentRoundGames.every((g) => g.result !== "*");
        const isLastRound = currentRound >= totalRounds;
        const allDone = games.every((g) => g.result !== "*");

        if (allDone && isLastRound && onCompleteTournament) {
          return (
            <button
              onClick={onCompleteTournament}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-[0.98]"
              style={{ background: T.gold, boxShadow: "0 4px 16px rgba(180,140,40,0.3)" }}
            >
              <Trophy size={16} />
              Finalize Tournament
            </button>
          );
        }

        if (allCurrentDone && !isLastRound) {
          return (
            <button
              onClick={onAdvanceRound}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold transition-all hover:opacity-90 active:scale-[0.98]"
              style={{
                background: T.greenBg,
                color: T.green,
                border: `1.5px solid ${T.greenBorder}`,
              }}
            >
              Advance to Round {currentRound + 1}
            </button>
          );
        }

        return null;
      })()}
    </div>
  );
}

// ─── Round Pairings (single round) ──────────────────────────────────────────

function RoundPairings({
  section,
  games,
  players,
  roundNum,
  currentRound,
  onEnterResult,
  isDark,
  T,
}: {
  section: QuadSection;
  games: Game[];
  players: Player[];
  roundNum: number;
  currentRound: number;
  onEnterResult: (gameId: string, result: Result) => void;
  isDark: boolean;
  T: Record<string, string>;
}) {
  const roundGames = games.filter((g) => g.round === roundNum);
  const isActiveRound = roundNum === currentRound;
  const isCompleted = roundGames.every((g) => g.result !== "*");

  if (roundGames.length === 0) {
    return (
      <div className="py-6 text-center">
        <p className="text-xs" style={{ color: T.textDim }}>
          No games scheduled for this round.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Round status badge */}
      {isCompleted && (
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg w-fit text-[10px] font-bold uppercase tracking-wide"
          style={{ background: T.greenBg, color: T.green, border: `1px solid ${T.greenBorder}` }}
        >
          <Check size={10} />
          Round {roundNum} Complete
        </div>
      )}

      {/* Game rows */}
      {roundGames.map((game, idx) => (
        <GameRow
          key={game.id}
          game={game}
          players={players}
          boardIndex={idx + 1}
          onEnterResult={onEnterResult}
          isActive={isActiveRound}
          isDark={isDark}
          T={T}
        />
      ))}
    </div>
  );
}

// ─── Game Row ─────────────────────────────────────────────────────────────────

function GameRow({
  game,
  players,
  boardIndex,
  onEnterResult,
  isActive,
  isDark,
  T,
}: {
  game: Game;
  players: Player[];
  boardIndex: number;
  onEnterResult: (gameId: string, result: Result) => void;
  isActive: boolean;
  isDark: boolean;
  T: Record<string, string>;
}) {
  const isBye = game.blackId === "BYE";
  const isPending = game.result === "*";
  const whiteWon = game.result === "1-0";
  const blackWon = game.result === "0-1";

  // Pending selection state — tracks which result the director has tapped but not yet confirmed
  const [pendingResult, setPendingResult] = useState<"1-0" | "½-½" | "0-1" | null>(null);

  const handleResultClick = (result: "1-0" | "½-½" | "0-1") => {
    if (pendingResult === result) {
      // Second tap on same button = confirm
      onEnterResult(game.id, result);
      setPendingResult(null);
    } else {
      // First tap = select (highlight)
      setPendingResult(result);
    }
  };
  const isDraw = game.result === "½-½";

  return (
    <div
      className="rounded-xl px-3 py-2.5 transition-all"
      style={{
        background: T.rowBg,
        border: `1px solid ${isActive && isPending ? T.greenBorder : T.rowBorder}`,
        opacity: !isActive && isPending ? 0.55 : 1,
      }}
    >
      {/* Board number label */}
      <div className="flex items-center gap-1.5 mb-2">
        <span
          className="text-[9px] font-bold uppercase tracking-widest"
          style={{ color: T.textDim }}
        >
          Board {boardIndex}
        </span>
        {!isPending && !isBye && (
          <span
            className="text-[9px] font-bold px-1.5 py-0.5 rounded"
            style={{
              background: isDraw ? (isDark ? "oklch(0.20 0.02 145)" : "#f3f4f6") : T.greenBg,
              color: isDraw ? T.textMuted : T.green,
            }}
          >
            {resultLabel(game.result)}
          </span>
        )}
      </div>

      {/* Players row */}
      <div className="flex items-center gap-2">
        {/* White player */}
        <div className={`flex items-center gap-2 flex-1 min-w-0 rounded-lg px-2.5 py-2 ${whiteWon ? "" : ""}`}
          style={{
            background: whiteWon ? T.greenSoft : "transparent",
            border: `1px solid ${whiteWon ? T.greenBorder : "transparent"}`,
          }}
        >
          <span
            className="w-4 h-4 rounded-[4px] flex-shrink-0 border"
            style={{ background: "#f8f8f8", borderColor: isDark ? "oklch(0.40 0.02 145)" : "#d1d5db" }}
          />
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold truncate" style={{ color: T.text }}>
              {getPlayerName(players, game.whiteId)}
            </span>
            <span className="text-[10px] font-mono" style={{ color: T.textDim }}>
              {getPlayerRating(players, game.whiteId)}
            </span>
          </div>
        </div>

        {/* VS / Result center */}
        <div className="flex-shrink-0 flex items-center justify-center w-8">
          {isPending ? (
            <span className="text-[10px] font-bold" style={{ color: T.textDim }}>vs</span>
          ) : (
            <span className="text-xs font-bold" style={{ color: T.green }}>
              {resultLabel(game.result)}
            </span>
          )}
        </div>

        {/* Black player */}
        <div className={`flex items-center gap-2 flex-1 min-w-0 rounded-lg px-2.5 py-2 justify-end`}
          style={{
            background: blackWon ? T.greenSoft : "transparent",
            border: `1px solid ${blackWon ? T.greenBorder : "transparent"}`,
          }}
        >
          <div className="flex flex-col min-w-0 items-end">
            <span className="text-sm font-semibold truncate text-right" style={{ color: isBye ? T.textDim : T.text }}>
              {getPlayerName(players, game.blackId)}
            </span>
            <span className="text-[10px] font-mono" style={{ color: T.textDim }}>
              {isBye ? "" : getPlayerRating(players, game.blackId)}
            </span>
          </div>
          <span
            className="w-4 h-4 rounded-[4px] flex-shrink-0"
            style={{ background: isDark ? "oklch(0.20 0.02 145)" : "#1f2937" }}
          />
        </div>
      </div>

      {/* Result entry buttons — only for active round pending games */}
      {isPending && isActive && !isBye && (() => {
        const whiteName = getPlayerName(players, game.whiteId).split(" ")[0];
        const blackName = getPlayerName(players, game.blackId).split(" ")[0];
        // When a selection is pending, non-selected buttons are dimmed; selected button is fully highlighted
        const hasPending = pendingResult !== null;
        const whiteSelected = pendingResult === "1-0";
        const drawSelected = pendingResult === "½-½";
        const blackSelected = pendingResult === "0-1";
        return (
          <div className="flex items-stretch gap-2 mt-2.5 pt-2.5" style={{ borderTop: `1px solid ${T.rowBorder}` }}>
            {/* White wins */}
            <button
              onClick={() => handleResultClick("1-0")}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all hover:scale-[1.02] active:scale-95 flex flex-col items-center gap-0.5"
              style={{
                background: whiteSelected
                  ? T.green
                  : hasPending
                  ? (isDark ? "oklch(0.14 0.01 145)" : "#f1f5f9")
                  : T.greenBg,
                color: whiteSelected
                  ? (isDark ? "#0a1a0f" : "#fff")
                  : hasPending
                  ? T.textDim
                  : T.green,
                border: `1.5px solid ${whiteSelected ? T.green : hasPending ? T.rowBorder : T.greenBorder}`,
                opacity: hasPending && !whiteSelected ? 0.45 : 1,
                transform: whiteSelected ? "scale(1.03)" : undefined,
                boxShadow: whiteSelected ? `0 4px 14px oklch(0.72 0.19 145 / 0.35)` : "none",
              }}
            >
              <span className="text-[11px] font-extrabold truncate max-w-full px-1">{whiteName}</span>
              <span className="text-[9px] opacity-70 font-semibold">{whiteSelected ? "tap to confirm" : "wins"}</span>
            </button>
            {/* Draw */}
            <button
              onClick={() => handleResultClick("½-½")}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all hover:scale-[1.02] active:scale-95 flex flex-col items-center gap-0.5"
              style={{
                background: drawSelected
                  ? (isDark ? "oklch(0.30 0.03 145)" : "#e5e7eb")
                  : hasPending
                  ? (isDark ? "oklch(0.14 0.01 145)" : "#f1f5f9")
                  : (isDark ? "oklch(0.18 0.02 145)" : "#f3f4f6"),
                color: drawSelected ? T.text : hasPending ? T.textDim : T.textMuted,
                border: `1.5px solid ${drawSelected ? T.cardBorder : hasPending ? T.rowBorder : T.cardBorder}`,
                opacity: hasPending && !drawSelected ? 0.45 : 1,
                transform: drawSelected ? "scale(1.03)" : undefined,
                boxShadow: drawSelected ? `0 4px 10px rgba(0,0,0,0.15)` : "none",
              }}
            >
              <span className="text-[11px] font-extrabold">Draw</span>
              <span className="text-[9px] opacity-70 font-semibold">{drawSelected ? "tap to confirm" : "½–½"}</span>
            </button>
            {/* Black wins */}
            <button
              onClick={() => handleResultClick("0-1")}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all hover:scale-[1.02] active:scale-95 flex flex-col items-center gap-0.5"
              style={{
                background: blackSelected
                  ? T.green
                  : hasPending
                  ? (isDark ? "oklch(0.14 0.01 145)" : "#f1f5f9")
                  : T.greenBg,
                color: blackSelected
                  ? (isDark ? "#0a1a0f" : "#fff")
                  : hasPending
                  ? T.textDim
                  : T.green,
                border: `1.5px solid ${blackSelected ? T.green : hasPending ? T.rowBorder : T.greenBorder}`,
                opacity: hasPending && !blackSelected ? 0.45 : 1,
                transform: blackSelected ? "scale(1.03)" : undefined,
                boxShadow: blackSelected ? `0 4px 14px oklch(0.72 0.19 145 / 0.35)` : "none",
              }}
            >
              <span className="text-[11px] font-extrabold truncate max-w-full px-1">{blackName}</span>
              <span className="text-[9px] opacity-70 font-semibold">{blackSelected ? "tap to confirm" : "wins"}</span>
            </button>
          </div>
        );
      })()}
    </div>
  );
}

// ─── Standings Sub-View ───────────────────────────────────────────────────────

function StandingsView({
  section,
  standings,
  players,
  isDark,
  T,
}: {
  section: QuadSection;
  standings: ReturnType<typeof calculateQuadStandings>;
  players: Player[];
  isDark: boolean;
  T: Record<string, string>;
}) {
  if (standings.length === 0) {
    return (
      <div className="py-6 text-center">
        <p className="text-xs" style={{ color: T.textDim }}>No standings data yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {/* Header row */}
      <div
        className="grid grid-cols-[24px_1fr_44px_32px_32px_32px_44px] gap-1 px-2 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider"
        style={{ color: T.textDim, background: isDark ? "oklch(0.13 0.02 145)" : "#f8fafc" }}
      >
        <span>#</span>
        <span>Player</span>
        <span className="text-center">Pts</span>
        <span className="text-center">W</span>
        <span className="text-center">D</span>
        <span className="text-center">L</span>
        <span className="text-center">SB</span>
      </div>

      {/* Player rows */}
      {standings.map((s, idx) => {
        const isWinner = s.finalRank === 1;
        return (
          <div
            key={s.playerId}
            className="grid grid-cols-[24px_1fr_44px_32px_32px_32px_44px] gap-1 items-center px-2 py-2 rounded-lg transition-all"
            style={{
              background: isWinner ? T.goldBg : (idx % 2 === 0 ? "transparent" : T.rowBg),
              border: isWinner ? `1px solid ${T.goldBorder}` : "1px solid transparent",
            }}
          >
            <span className="text-xs font-bold" style={{ color: isWinner ? T.gold : T.textDim }}>
              {s.finalRank}
            </span>
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-sm font-semibold truncate" style={{ color: T.text }}>
                {getPlayerName(players, s.playerId)}
              </span>
              <span className="text-[10px] font-mono flex-shrink-0" style={{ color: T.textDim }}>
                {getPlayerRating(players, s.playerId)}
              </span>
              {isWinner && <Trophy size={10} style={{ color: T.gold }} className="flex-shrink-0" />}
            </div>
            <span className="text-center text-sm font-bold" style={{ color: T.green }}>
              {s.score % 1 === 0 ? s.score : s.score.toFixed(1)}
            </span>
            <span className="text-center text-xs" style={{ color: T.text }}>{s.wins}</span>
            <span className="text-center text-xs" style={{ color: T.textMuted }}>{s.draws}</span>
            <span className="text-center text-xs" style={{ color: T.textMuted }}>{s.losses}</span>
            <span className="text-center text-[10px] font-mono" style={{ color: T.textMuted }}>
              {s.sonnebornBerger.toFixed(2)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
