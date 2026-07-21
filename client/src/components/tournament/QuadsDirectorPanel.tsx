/**
 * OTB Chess — Quads Director Panel (v3 Command Center)
 *
 * Section 7 spec implementation:
 *  A. Event header bar (tournament meta, rating source, completion)
 *  B. Active-round command center (metrics + advance/finalize CTA)
 *  C. 2×2 quad overview grid (compact cards, leader, completion, warnings)
 *  D. Selected quad workspace (boards left, standings right)
 *  E. Exception tray (missing results, blockers)
 *  G. Completion view (4 champion cards replacing operational dashboard)
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
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Flag,
  Activity,
  Grid3X3,
} from "lucide-react";
import type { Player, Game, Result, Round } from "../../lib/tournamentData";
import type { QuadSection } from "../../lib/quads";
import type { TournamentConfig } from "../../lib/tournamentRegistry";
import type { StandingRow } from "../../lib/swiss";
import {
  calculateQuadStandings,
  formatRatingRange,
  getSectionWinners,
} from "../../lib/quads";
import { computeStandings } from "../../lib/swiss";
import { InstagramCarouselModal } from "../InstagramCarouselModal";
import { PlayerAvatar } from "../PlayerAvatar";

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
  tournamentId?: string;
  tournamentConfig?: TournamentConfig | null;
  /** Tournament lifecycle status — disables Finalize button once already completed */
  tournamentStatus?: "registration" | "in_progress" | "completed" | "paused";
  /** Externally controlled selected section ID (for left-rail tab toggle) */
  externalSelectedSectionId?: string | null;
  /** Called whenever the internal selected section changes */
  onSectionChange?: (sectionId: string) => void;
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
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
      role="status"
      aria-label={`${completed} of ${total} games complete`}
    >
      <svg width={size} height={size} className="rotate-[-90deg]">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={3} stroke={isDark ? "oklch(0.22 0.02 145)" : "#e5e7eb"} />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={3} strokeLinecap="round"
          stroke={isComplete ? "oklch(0.75 0.15 85)" : "oklch(0.72 0.19 145)"}
          strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
          className="transition-all duration-500"
        />
      </svg>
      <span className="absolute text-xs font-bold" style={{ color: isComplete ? "oklch(0.75 0.15 85)" : (isDark ? "oklch(0.72 0.03 145)" : "#6b7280") }}>
        {completed}/{total}
      </span>
    </div>
  );
}

// ─── ResultEntryPanel ────────────────────────────────────────────────────────

function ResultEntryPanel({
  game, players, boardIndex, onEnterResult, onClose, onAdvanceToNext, isDark, T,
}: {
  game: Game; players: Player[]; boardIndex: number;
  onEnterResult: (gameId: string, result: Result) => void;
  onClose: () => void;
  onAdvanceToNext: (currentGameId: string) => void;
  isDark: boolean; T: Record<string, string>;
}) {
  const white = players.find((p) => p.id === game.whiteId);
  const black = players.find((p) => p.id === game.blackId);
  const whiteName = white?.name ?? game.whiteId;
  const blackName = black?.name ?? game.blackId;
  const whiteRating = white?.elo ?? 0;
  const blackRating = black?.elo ?? 0;
  const current = game.result;

  // Keyboard shortcuts: W = white wins, D = draw, B = black wins, Esc = close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "w" || e.key === "W") { onEnterResult(game.id, "1-0"); onAdvanceToNext(game.id); }
      if (e.key === "d" || e.key === "D") { onEnterResult(game.id, "½-½"); onAdvanceToNext(game.id); }
      if (e.key === "b" || e.key === "B") { onEnterResult(game.id, "0-1"); onAdvanceToNext(game.id); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [game.id, onEnterResult, onClose, onAdvanceToNext]);

  const handleResult = (result: "1-0" | "½-½" | "0-1") => {
    if (current === result) {
      // Undo: clear result and stay on this game
      onEnterResult(game.id, "*" as Result);
    } else {
      onEnterResult(game.id, result);
      onAdvanceToNext(game.id);
      return;
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" style={{ background: "oklch(0 0 0 / 0.5)" }} onClick={onClose} aria-hidden="true" />
      {/* Slide-out panel */}
      <div
        role="dialog" aria-modal="true" aria-label={`Enter result for Board ${boardIndex}`}
        className="fixed right-0 top-0 h-full z-50 flex flex-col overflow-y-auto"
        style={{ width: "min(380px, 92vw)", background: isDark ? "oklch(0.10 0.025 145)" : "#ffffff", borderLeft: `1px solid ${T.border ?? T.cardBorder}`, boxShadow: "-8px 0 32px oklch(0 0 0 / 0.35)", animation: "slideInPanel 0.28s cubic-bezier(0.16, 1, 0.3, 1) both" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0" style={{ borderBottom: `1px solid ${T.cardBorder}` }}>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-widest px-2.5 py-1 rounded" style={{ background: T.greenBg, color: T.green }}>Board {boardIndex}</span>
            <span className="text-sm font-semibold" style={{ color: T.textMuted }}>Enter Result</span>
          </div>
          <button type="button" onClick={onClose} aria-label="Close result panel" className="w-11 h-11 flex items-center justify-center rounded-lg transition-colors hover:opacity-80" style={{ background: T.rowBg, color: T.textMuted, touchAction: "manipulation" }}>
            <X size={14} />
          </button>
        </div>

        {/* Players */}
        <div className="px-5 py-5 flex flex-col gap-3 flex-shrink-0">
          <div className="flex items-center gap-3 p-3 rounded-xl transition-all" style={{ background: current === "1-0" ? T.greenSoft : T.rowBg, border: `1px solid ${current === "1-0" ? T.greenBorder : T.rowBorder}` }}>
            <div className="w-8 h-8 rounded-lg flex-shrink-0 border-2" style={{ background: "#f8f8f8", borderColor: isDark ? "oklch(0.40 0.02 145)" : "#d1d5db" }} />
            <PlayerAvatar username={white?.username ?? ""} name={whiteName} platform={(white?.platform as "chesscom" | "lichess") ?? "chesscom"} avatarUrl={white?.avatarUrl} size={36} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate" style={{ color: T.text }}>{whiteName}</p>
              <p className="text-xs" style={{ color: T.textDim }}>{whiteRating} · White</p>
            </div>
            {current === "1-0" && <Check size={16} style={{ color: T.green, flexShrink: 0 }} />}
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl transition-all" style={{ background: current === "0-1" ? T.greenSoft : T.rowBg, border: `1px solid ${current === "0-1" ? T.greenBorder : T.rowBorder}` }}>
            <div className="w-8 h-8 rounded-lg flex-shrink-0 border-2" style={{ background: "#1a1a1a", borderColor: isDark ? "oklch(0.30 0.02 145)" : "#374151" }} />
            <PlayerAvatar username={black?.username ?? ""} name={blackName} platform={(black?.platform as "chesscom" | "lichess") ?? "chesscom"} avatarUrl={black?.avatarUrl} size={36} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate" style={{ color: T.text }}>{blackName}</p>
              <p className="text-xs" style={{ color: T.textDim }}>{blackRating} · Black</p>
            </div>
            {current === "0-1" && <Check size={16} style={{ color: T.green, flexShrink: 0 }} />}
          </div>
        </div>

        {/* Result buttons */}
        <div className="px-5 flex flex-col gap-2 flex-shrink-0">
          <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: T.textDim }}>Select Result</p>
          {([
            { result: "1-0" as const, label: `${whiteName.split(" ")[0]} wins`, key: "W" },
            { result: "½-½" as const, label: "Draw ½–½", key: "D" },
            { result: "0-1" as const, label: `${blackName.split(" ")[0]} wins`, key: "B" },
          ]).map(({ result, label, key }) => {
            const isSelected = current === result;
            const isDrawBtn = result === "½-½";
            return (
              <button
                key={result}
                type="button"
                onClick={() => handleResult(result)}
                aria-pressed={isSelected}
                aria-label={label}
                className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl font-semibold transition-all hover:scale-[1.01] active:scale-95"
                style={{
                  minHeight: "52px",
                  background: isSelected ? (isDrawBtn ? (isDark ? "oklch(0.30 0.03 145)" : "#e5e7eb") : T.greenSoft) : T.rowBg,
                  border: `2px solid ${isSelected ? (isDrawBtn ? T.textMuted : T.green) : T.rowBorder}`,
                  color: isSelected ? (isDrawBtn ? T.text : T.green) : T.text,
                  boxShadow: isSelected ? (isDrawBtn ? "none" : `0 4px 14px oklch(0.72 0.19 145 / 0.25)`) : "none",
                }}
              >
                <span className="text-sm">{label}</span>
                <div className="flex items-center gap-2">
                  {isSelected && <Check size={14} style={{ color: isDrawBtn ? T.textMuted : T.green }} />}
                  <span className="text-xs font-mono px-1.5 py-0.5 rounded" style={{ background: T.rowBorder, color: T.textDim }}>{key}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Keyboard hint */}
        <div className="px-5 mt-4 flex-shrink-0">
          <p className="text-xs text-center" style={{ color: T.textDim }}>
            Press <kbd className="font-mono px-1 rounded" style={{ background: T.rowBorder }}>W</kbd> / <kbd className="font-mono px-1 rounded" style={{ background: T.rowBorder }}>D</kbd> / <kbd className="font-mono px-1 rounded" style={{ background: T.rowBorder }}>B</kbd> · <kbd className="font-mono px-1 rounded" style={{ background: T.rowBorder }}>Esc</kbd> to close
          </p>
        </div>

        {/* Clear result */}
        {current !== "*" && (
          <div className="px-5 mt-3 mb-6 flex-shrink-0">
            <button
              type="button"
              onClick={() => { onEnterResult(game.id, "*" as Result); }}
              className="w-full text-xs py-2 rounded-lg transition-colors"
              style={{ background: T.amberBg, color: T.amber, border: `1px solid ${T.amberBorder}` }}
            >
              Clear result (undo)
            </button>
          </div>
        )}
      </div>
    </>
  );
}

// ─── GameRow ──────────────────────────────────────────────────────────────────

function GameRow({
  game, players, boardIndex, onEnterResult, onGameClick, isActive, isDark, T,
}: {
  game: Game; players: Player[]; boardIndex: number;
  onEnterResult: (gameId: string, result: Result) => void;
  onGameClick?: (gameId: string) => void;
  isActive: boolean; isDark: boolean; T: Record<string, string>;
}) {
  const isBye = game.blackId === "BYE";
  const isPending = game.result === "*";
  const whiteWon = game.result === "1-0";
  const blackWon = game.result === "0-1";
  const isDraw = game.result === "½-½";
  const [collapsed, setCollapsed] = useState(false);

  const handleResultClick = (result: "1-0" | "½-½" | "0-1") => {
    if (game.result === result) {
      onEnterResult(game.id, "*" as Result);
      setCollapsed(false);
    } else {
      onEnterResult(game.id, result);
      setTimeout(() => setCollapsed(true), 200);
    }
  };

  if (collapsed && !isPending) {
    return (
      <button
        type="button" aria-expanded={false} aria-label="Expand game details"
        className="w-full rounded-xl px-3 py-2 flex items-center justify-between gap-3 cursor-pointer transition-all hover:opacity-80 text-left"
        style={{ background: T.rowBg, border: `1px solid ${T.rowBorder}`, animation: "tcSlideDown 0.22s cubic-bezier(0.16, 1, 0.3, 1) both", minHeight: "44px" }}
        onClick={() => setCollapsed(false)}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-bold uppercase tracking-widest flex-shrink-0 w-6" style={{ color: T.textDim }}>B{boardIndex}</span>
          {(() => {
            const winnerId = whiteWon ? game.whiteId : blackWon ? game.blackId : null;
            const loserId = whiteWon ? game.blackId : blackWon ? game.whiteId : null;
            const winnerPlayer = players.find(p => p.id === winnerId);
            const loserPlayer = players.find(p => p.id === loserId);
            const winnerName = winnerPlayer?.name ?? winnerId ?? "";
            const loserName = loserPlayer?.name ?? loserId ?? "";
            if (isDraw) {
              return (
                <>
                  <span className="text-sm font-semibold truncate max-w-[80px]" style={{ color: T.textMuted }}>{getPlayerName(players, game.whiteId).split(" ")[0]}</span>
                  <span className="text-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: isDark ? "oklch(0.20 0.02 145)" : "#f3f4f6", color: T.textMuted }}>Draw</span>
                  <span className="text-sm font-semibold truncate max-w-[80px]" style={{ color: T.textMuted }}>{getPlayerName(players, game.blackId).split(" ")[0]}</span>
                </>
              );
            }
            return (
              <>
                <div className="flex-shrink-0">
                  <PlayerAvatar username={winnerPlayer?.username ?? ""} name={winnerName} platform={(winnerPlayer?.platform as "chesscom" | "lichess") ?? "chesscom"} avatarUrl={winnerPlayer?.avatarUrl} size={22} />
                </div>
                <span className="text-sm font-semibold truncate max-w-[88px]" style={{ color: T.green }}>{winnerName.split(" ")[0]}</span>
                <span className="text-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: T.greenBg, color: T.green }}>{resultLabel(game.result)}</span>
                <span className="text-sm truncate max-w-[80px]" style={{ color: T.textDim }}>{loserName.split(" ")[0]}</span>
              </>
            );
          })()}
        </div>
        <span className="text-xs flex-shrink-0" aria-hidden="true" style={{ color: T.textDim }}>▼</span>
      </button>
    );
  }

  // When onGameClick is provided and game is pending and active, clicking the row header opens the slide-out panel
  const canOpenPanel = !!onGameClick && isPending && isActive && !isBye;

  return (
    <div
      className="rounded-xl px-3 py-2.5 transition-all"
      style={{ background: !isPending ? (isDark ? "oklch(0.12 0.015 145 / 0.6)" : "rgba(240,244,240,0.55)") : T.rowBg, border: `1px solid ${!isPending ? T.rowBorder : isActive ? T.greenBorder : T.rowBorder}`, opacity: !isActive && isPending ? 0.55 : 1, animation: "tcSlideDown 0.22s cubic-bezier(0.16, 1, 0.3, 1) both" }}
    >
      <div
        className={`flex items-center gap-1.5 mb-2${canOpenPanel ? " cursor-pointer hover:opacity-80" : ""}`}
        onClick={canOpenPanel ? () => onGameClick!(game.id) : undefined}
        role={canOpenPanel ? "button" : undefined}
        tabIndex={canOpenPanel ? 0 : undefined}
        aria-label={canOpenPanel ? `Open result entry for Board ${boardIndex}` : undefined}
        onKeyDown={canOpenPanel ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onGameClick!(game.id); } } : undefined}
      >
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: T.textDim }}>Board {boardIndex}</span>

        {!isPending && !isBye && (
          <>
            <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: isDraw ? (isDark ? "oklch(0.20 0.02 145)" : "#f3f4f6") : T.greenBg, color: isDraw ? T.textMuted : T.green }}>{resultLabel(game.result)}</span>
            <button type="button" aria-expanded={true} aria-label="Collapse game row" onClick={() => setCollapsed(true)} className="ml-auto text-xs px-2 py-1 rounded transition-colors" style={{ color: T.textDim, background: "transparent", touchAction: "manipulation" }}>▲ collapse</button>
          </>
        )}
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0 rounded-lg px-2.5 py-2" style={{ background: whiteWon ? T.greenSoft : "transparent", border: `1px solid ${whiteWon ? T.greenBorder : "transparent"}` }}>
          <span className="w-4 h-4 rounded-[4px] flex-shrink-0 border" style={{ background: "#f8f8f8", borderColor: isDark ? "oklch(0.40 0.02 145)" : "#d1d5db" }} />
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold truncate" style={{ color: T.text }}>{getPlayerName(players, game.whiteId)}</span>
            <span className="text-xs font-mono" style={{ color: T.textDim }}>{getPlayerRating(players, game.whiteId)}</span>
          </div>
        </div>
        <div className="flex-shrink-0 flex items-center justify-center w-8">
          {isPending ? <span className="text-xs font-bold" style={{ color: T.textDim }}>vs</span> : <span className="text-sm font-bold" style={{ color: T.green }}>{resultLabel(game.result)}</span>}
        </div>
        <div className="flex items-center gap-2 flex-1 min-w-0 rounded-lg px-2.5 py-2 justify-end" style={{ background: blackWon ? T.greenSoft : "transparent", border: `1px solid ${blackWon ? T.greenBorder : "transparent"}` }}>
          <div className="flex flex-col min-w-0 items-end">
            <span className="text-sm font-semibold truncate text-right" style={{ color: isBye ? T.textDim : T.text }}>{getPlayerName(players, game.blackId)}</span>
            <span className="text-xs font-mono" style={{ color: T.textDim }}>{isBye ? "" : getPlayerRating(players, game.blackId)}</span>
          </div>
          <span className="w-4 h-4 rounded-[4px] flex-shrink-0" style={{ background: isDark ? "oklch(0.20 0.02 145)" : "#1f2937" }} />
        </div>
      </div>
      {isActive && !isBye && (() => {
        const whiteName = getPlayerName(players, game.whiteId).split(" ")[0];
        const blackName = getPlayerName(players, game.blackId).split(" ")[0];
        const whiteSelected = game.result === "1-0";
        const drawSelected = game.result === "½-½";
        const blackSelected = game.result === "0-1";
        const hasResult = !isPending;
        // Neutral base style (same as Draw button)
        const neutralBg = isDark ? "oklch(0.18 0.02 145)" : "#f3f4f6";
        const neutralColor = T.textMuted;
        const neutralBorder = isDark ? "oklch(0.25 0.02 145)" : "#e5e7eb";
        // Winner highlight style
        const winnerBg = isDark ? "oklch(0.25 0.12 145)" : "#dcfce7";
        const winnerColor = T.green;
        const winnerBorder = T.greenBorder;
        return (
          <div className="mt-2.5 pt-2.5 space-y-2" style={{ borderTop: `1px solid ${T.rowBorder}` }}>
            {/* 3 result buttons — always shown for active games */}
            <div className="flex items-stretch gap-2">
              <button type="button" aria-pressed={whiteSelected} aria-label={`${whiteName} wins`} onClick={() => handleResultClick("1-0")}
                className="flex-1 rounded-xl text-xs font-bold transition-all hover:opacity-90 active:scale-95 flex items-center justify-center"
                style={{ minHeight: "44px", background: whiteSelected ? winnerBg : neutralBg, color: whiteSelected ? winnerColor : neutralColor, border: `1.5px solid ${whiteSelected ? winnerBorder : neutralBorder}`, boxShadow: whiteSelected ? `0 0 0 1px ${T.greenBorder}` : "none", touchAction: "manipulation" }}>
                <span className="font-extrabold truncate max-w-full px-1">{whiteName}</span>
              </button>
              <button type="button" aria-pressed={drawSelected} aria-label="Draw" onClick={() => handleResultClick("½-½")}
                className="flex-1 rounded-xl text-xs font-bold transition-all hover:opacity-90 active:scale-95 flex items-center justify-center"
                style={{ minHeight: "44px", background: drawSelected ? (isDark ? "oklch(0.28 0.04 60)" : "#fef9c3") : neutralBg, color: drawSelected ? (isDark ? "oklch(0.85 0.14 80)" : "oklch(0.55 0.14 80)") : neutralColor, border: `1.5px solid ${drawSelected ? (isDark ? "oklch(0.45 0.10 80)" : "oklch(0.75 0.12 80)") : neutralBorder}`, boxShadow: drawSelected ? `0 0 0 1px ${isDark ? "oklch(0.45 0.10 80)" : "oklch(0.75 0.12 80)"}` : "none", touchAction: "manipulation" }}>
                <span className="font-extrabold">Draw</span>
              </button>
              <button type="button" aria-pressed={blackSelected} aria-label={`${blackName} wins`} onClick={() => handleResultClick("0-1")}
                className="flex-1 rounded-xl text-xs font-bold transition-all hover:opacity-90 active:scale-95 flex items-center justify-center"
                style={{ minHeight: "44px", background: blackSelected ? winnerBg : neutralBg, color: blackSelected ? winnerColor : neutralColor, border: `1.5px solid ${blackSelected ? winnerBorder : neutralBorder}`, boxShadow: blackSelected ? `0 0 0 1px ${T.greenBorder}` : "none", touchAction: "manipulation" }}>
                <span className="font-extrabold truncate max-w-full px-1">{blackName}</span>
              </button>
            </div>
            {/* Undo / edit row — appears immediately after a result is submitted */}
            {hasResult && (
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-semibold" style={{ color: T.green }}>
                  {whiteSelected ? `${whiteName} wins` : blackSelected ? `${blackName} wins` : "Draw (½–½)"} recorded
                </span>
                <button
                  type="button"
                  onClick={() => onEnterResult(game.id, "*" as Result)}
                  className="text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-colors hover:opacity-80"
                  style={{ background: isDark ? "oklch(0.20 0.02 145)" : "#f3f4f6", color: T.textDim, border: `1px solid ${neutralBorder}`, touchAction: "manipulation" }}
                >
                  Undo
                </button>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

// ─── StandingsView ────────────────────────────────────────────────────────────

function StandingsView({ section, standings, players, isDark, T }: {
  section: QuadSection; standings: ReturnType<typeof calculateQuadStandings>; players: Player[]; isDark: boolean; T: Record<string, string>;
}) {
  if (standings.length === 0) return <div className="py-6 text-center"><p className="text-xs" style={{ color: T.textDim }}>No standings data yet.</p></div>;
  return (
    <div className="space-y-1">
      <div className="grid grid-cols-[24px_1fr_44px_32px_32px_32px_44px] gap-1 px-2 py-2 rounded-lg text-xs font-bold uppercase tracking-wider" style={{ color: T.textDim, background: isDark ? "oklch(0.13 0.02 145)" : "#f8fafc" }}>
        <span>#</span><span>Player</span><span className="text-center">Pts</span><span className="text-center">W</span><span className="text-center">D</span><span className="text-center">L</span><span className="text-center">SB</span>
      </div>
      {standings.map((s, idx) => {
        const isWinner = s.finalRank === 1;
        return (
          <div key={s.playerId} className="grid grid-cols-[24px_1fr_44px_32px_32px_32px_44px] gap-1 items-center px-2 py-2 rounded-lg transition-all" style={{ background: isWinner ? T.goldBg : (idx % 2 === 0 ? "transparent" : T.rowBg), border: isWinner ? `1px solid ${T.goldBorder}` : "1px solid transparent" }}>
            <span className="text-xs font-bold" style={{ color: isWinner ? T.gold : T.textDim }}>{s.finalRank}</span>
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-sm font-semibold truncate" style={{ color: T.text }}>{getPlayerName(players, s.playerId)}</span>
              <span className="text-xs font-mono flex-shrink-0" style={{ color: T.textDim }}>{getPlayerRating(players, s.playerId)}</span>
              {isWinner && <Trophy size={10} style={{ color: T.gold }} className="flex-shrink-0" />}
            </div>
            <span className="text-center text-sm font-bold" style={{ color: T.green }}>{s.score % 1 === 0 ? s.score : s.score.toFixed(1)}</span>
            <span className="text-center text-xs" style={{ color: T.text }}>{s.wins}</span>
            <span className="text-center text-xs" style={{ color: T.textMuted }}>{s.draws}</span>
            <span className="text-center text-xs" style={{ color: T.textMuted }}>{s.losses}</span>
            <span className="text-center text-xs font-mono" style={{ color: T.textMuted }}>{s.sonnebornBerger.toFixed(2)}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── CrossTableView ──────────────────────────────────────────────────────────

function CrossTableView({ section, games, players, standings, isDark, T }: {
  section: QuadSection; games: Game[]; players: Player[]; standings: ReturnType<typeof calculateQuadStandings>; isDark: boolean; T: Record<string, string>;
}) {
  // Order players by standings rank
  const orderedPlayers = standings.length > 0
    ? standings.map((s) => players.find((p) => p.id === s.playerId)!).filter(Boolean)
    : section.playerIds.map((id) => players.find((p) => p.id === id)!).filter(Boolean);

  // Build result lookup: resultMap[rowId][colId] = result from row player's perspective
  const resultMap = new Map<string, Map<string, string>>();
  for (const game of games) {
    if (game.result === "*") continue;
    if (!resultMap.has(game.whiteId)) resultMap.set(game.whiteId, new Map());
    if (!resultMap.has(game.blackId)) resultMap.set(game.blackId, new Map());
    if (game.result === "1-0") {
      resultMap.get(game.whiteId)!.set(game.blackId, "1");
      resultMap.get(game.blackId)!.set(game.whiteId, "0");
    } else if (game.result === "0-1") {
      resultMap.get(game.whiteId)!.set(game.blackId, "0");
      resultMap.get(game.blackId)!.set(game.whiteId, "1");
    } else {
      resultMap.get(game.whiteId)!.set(game.blackId, "½");
      resultMap.get(game.blackId)!.set(game.whiteId, "½");
    }
  }

  const getResult = (rowId: string, colId: string): string => {
    if (rowId === colId) return "×";
    return resultMap.get(rowId)?.get(colId) ?? "•";
  };

  const getCellColor = (val: string): string => {
    if (val === "1") return T.green;
    if (val === "0") return isDark ? "oklch(0.70 0.18 25)" : "oklch(0.50 0.18 25)";
    if (val === "½") return T.textMuted;
    return T.textDim;
  };

  const getCellBg = (val: string): string => {
    if (val === "1") return isDark ? "oklch(0.20 0.06 145 / 0.4)" : "oklch(0.95 0.04 145)";
    if (val === "0") return isDark ? "oklch(0.18 0.05 25 / 0.3)" : "oklch(0.97 0.03 25)";
    if (val === "×") return isDark ? "oklch(0.12 0.01 145)" : "oklch(0.92 0.01 145)";
    return "transparent";
  };

  const getScore = (playerId: string): string => {
    const s = standings.find((st) => st.playerId === playerId);
    if (!s) return "-";
    return s.score % 1 === 0 ? String(s.score) : s.score.toFixed(1);
  };

  // Hover state: track hovered row/col player indices for cross-highlight
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [hoveredCol, setHoveredCol] = useState<number | null>(null);

  const getHighlightBg = (rowIdx: number, colIdx: number, val: string, isWinner: boolean): string => {
    const isHoveredRow = hoveredRow === rowIdx;
    const isHoveredCol = hoveredCol === colIdx;
    const isIntersection = hoveredRow === rowIdx && hoveredCol === colIdx;
    // Result-specific bg takes precedence at the intersection cell
    if (isIntersection && val !== "×" && val !== "•") return getCellBg(val);
    if (isIntersection) return isDark ? "oklch(0.30 0.06 145 / 0.5)" : "oklch(0.88 0.05 145 / 0.7)";
    if (isHoveredRow || isHoveredCol) return isDark ? "oklch(0.22 0.04 145 / 0.35)" : "oklch(0.93 0.03 145 / 0.5)";
    // Default cell bg
    if (val !== "×" && val !== "•") return getCellBg(val);
    if (val === "×") return getCellBg(val);
    if (isWinner) return T.goldBg;
    return "transparent";
  };

  if (orderedPlayers.length === 0) return (
    <div className="py-8 text-center">
      <div className="w-10 h-10 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ background: T.rowBg }}>
        <Grid3X3 size={18} style={{ color: T.textDim }} />
      </div>
      <p className="text-xs font-medium" style={{ color: T.textDim }}>Results will appear here as games are played.</p>
    </div>
  );

  // ── Mobile card layout (< 640px) ──────────────────────────────────────────
  const MobileLayout = () => (
    <div className="space-y-2">
      {/* Player legend */}
      <div className="flex flex-wrap gap-1.5 px-1 pb-1">
        {orderedPlayers.map((p, i) => (
          <span key={p.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
            style={{ background: T.rowBg, color: T.textMuted, border: `1px solid ${T.border ?? T.rowBg}` }}>
            <span className="font-black" style={{ color: T.textDim }}>{i + 1}</span>
            <span>{p.name.length > 10 ? p.name.slice(0, 10) + "…" : p.name}</span>
          </span>
        ))}
      </div>
      {/* Player rows */}
      {orderedPlayers.map((rowPlayer, rowIdx) => {
        const isWinner = standings.length > 0 && standings[0]?.playerId === rowPlayer.id;
        const score = getScore(rowPlayer.id);
        return (
          <div key={rowPlayer.id} className="rounded-xl px-3 py-3 transition-colors"
            style={{ background: isWinner ? T.goldBg : T.rowBg, border: `1px solid ${isWinner ? T.gold + "40" : (T.border ?? "transparent")}` }}>
            {/* Player header */}
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0"
                  style={{ background: isWinner ? T.gold + "30" : T.card, color: isWinner ? T.gold : T.textDim }}>
                  {rowIdx + 1}
                </span>
                <div>
                  <div className="flex items-center gap-1.5">
                    {isWinner && <Trophy size={11} style={{ color: T.gold }} />}
                    <span className="text-sm font-bold leading-tight" style={{ color: isWinner ? T.gold : T.text }}>
                      {rowPlayer.name.length > 18 ? rowPlayer.name.slice(0, 18) + "…" : rowPlayer.name}
                    </span>
                  </div>
                  <span className="text-xs font-mono" style={{ color: T.textDim }}>{rowPlayer.elo}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-black leading-none" style={{ color: isWinner ? T.gold : T.green }}>{score}</div>
                <div className="text-[10px] font-medium mt-0.5" style={{ color: T.textDim }}>pts</div>
              </div>
            </div>
            {/* Result cells vs each opponent */}
            <div className="flex gap-1.5 flex-wrap">
              {orderedPlayers.map((colPlayer, colIdx) => {
                if (colPlayer.id === rowPlayer.id) return null;
                const val = getResult(rowPlayer.id, colPlayer.id);
                const label = val === "•" ? "–" : val;
                return (
                  <div key={colPlayer.id} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold"
                    style={{ background: getCellBg(val) || T.card, color: getCellColor(val), minWidth: 0 }}>
                    <span className="font-normal" style={{ color: T.textDim }}>vs {colIdx + 1}</span>
                    <span className="font-black">{label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );

  // ── Desktop matrix table (≥ 640px) ────────────────────────────────────────
  const DesktopLayout = () => (
    <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: "touch" } as React.CSSProperties}
      onMouseLeave={() => { setHoveredRow(null); setHoveredCol(null); }}>
      <table className="w-full border-collapse text-xs" style={{ minWidth: "320px" }}>
        <thead>
          <tr>
            <th className="text-left px-2 py-2.5 font-bold" style={{ color: T.textDim }}>#</th>
            <th className="text-left px-2 py-2.5 font-bold" style={{ color: T.textDim }}>Player</th>
            {orderedPlayers.map((p, i) => (
              <th key={p.id}
                className="text-center px-1 py-2.5 font-bold w-9 cursor-default transition-colors"
                style={{
                  color: hoveredCol === i ? T.text : T.textDim,
                  background: hoveredCol === i ? (isDark ? "oklch(0.22 0.04 145 / 0.35)" : "oklch(0.93 0.03 145 / 0.5)") : "transparent",
                }}
                onMouseEnter={() => setHoveredCol(i)}>
                {i + 1}
              </th>
            ))}
            <th className="text-center px-2 py-2.5 font-bold" style={{ color: T.green }}>Pts</th>
          </tr>
        </thead>
        <tbody>
          {orderedPlayers.map((rowPlayer, rowIdx) => {
            const isWinner = standings.length > 0 && standings[0]?.playerId === rowPlayer.id;
            const isHoveredRow = hoveredRow === rowIdx;
            return (
              <tr key={rowPlayer.id}
                className="transition-colors cursor-default"
                onMouseEnter={() => setHoveredRow(rowIdx)}
                style={{ background: isHoveredRow && !isWinner ? (isDark ? "oklch(0.22 0.04 145 / 0.35)" : "oklch(0.93 0.03 145 / 0.5)") : isWinner ? T.goldBg : (rowIdx % 2 === 0 ? "transparent" : T.rowBg) }}>
                {/* Rank cell */}
                <td className="px-2 py-2.5 font-bold transition-colors"
                  style={{ color: isWinner ? T.gold : isHoveredRow ? T.text : T.textDim }}>
                  {rowIdx + 1}
                </td>
                {/* Player name cell */}
                <td className="px-2 py-2.5 font-semibold transition-colors" style={{ color: T.text, maxWidth: "140px" }}>
                  <div className="flex items-center gap-1.5">
                    {isWinner && <Trophy size={11} style={{ color: T.gold }} />}
                    <span className="text-sm truncate" style={{ color: isWinner ? T.gold : isHoveredRow ? T.text : T.text }}>{rowPlayer.name}</span>
                  </div>
                  <span className="text-xs font-mono" style={{ color: T.textDim, opacity: 0.65 }}>{rowPlayer.elo}</span>
                </td>
                {/* Result cells */}
                {orderedPlayers.map((colPlayer, colIdx) => {
                  const val = getResult(rowPlayer.id, colPlayer.id);
                  const isIntersection = hoveredRow === rowIdx && hoveredCol === colIdx;
                  return (
                    <td key={colPlayer.id}
                      className="text-center px-1 py-2.5 font-bold text-sm transition-colors"
                      onMouseEnter={() => setHoveredCol(colIdx)}
                      style={{
                        color: isIntersection ? (val === "1" ? T.green : val === "0" ? (isDark ? "oklch(0.70 0.18 25)" : "oklch(0.50 0.18 25)") : val === "½" ? T.textMuted : T.textDim) : getCellColor(val),
                        background: getHighlightBg(rowIdx, colIdx, val, isWinner),
                        outline: isIntersection ? `2px solid ${isDark ? "oklch(0.55 0.14 145 / 0.6)" : "oklch(0.45 0.14 145 / 0.5)"}` : "none",
                        outlineOffset: "-2px",
                        borderRadius: isIntersection ? "4px" : "0",
                        transform: isIntersection ? "scale(1.08)" : "scale(1)",
                        zIndex: isIntersection ? 1 : 0,
                        position: "relative",
                      }}>
                      {val}
                    </td>
                  );
                })}
                {/* Score cell */}
                <td className="text-center px-2 py-2.5 font-black text-sm transition-colors"
                  style={{ color: isWinner ? T.gold : isHoveredRow ? T.green : T.green }}>
                  {getScore(rowPlayer.id)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <div style={{ touchAction: "manipulation" } as React.CSSProperties}>
      {/* Mobile: card layout */}
      <div className="sm:hidden">
        <MobileLayout />
      </div>
      {/* Desktop: matrix table */}
      <div className="hidden sm:block">
        <DesktopLayout />
      </div>
    </div>
  );
}

// ─── RoundPairings ────────────────────────────────────────────────────────────

function RoundPairings({ section, games, players, roundNum, currentRound, onEnterResult, onGameClick, isDark, T }: {
  section: QuadSection; games: Game[]; players: Player[]; roundNum: number; currentRound: number;
  onEnterResult: (gameId: string, result: Result) => void;
  onGameClick?: (gameId: string) => void;
  isDark: boolean; T: Record<string, string>;
}) {
  const roundGames = games.filter((g) => g.round === roundNum);
  const isActive = roundNum === currentRound;
  const roundComplete = roundGames.length > 0 && roundGames.every((g) => g.result !== "*");

  if (roundGames.length === 0) return <div className="py-6 text-center"><p className="text-xs" style={{ color: T.textDim }}>No games scheduled for this round.</p></div>;

  return (
    <div className="space-y-2">
      {roundComplete && (
        <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg" style={{ background: T.greenBg, border: `1px solid ${T.greenBorder}` }}>
          <Check size={12} style={{ color: T.green }} />
          <span className="text-xs font-semibold" style={{ color: T.green }}>Round {roundNum} complete — {roundGames.length} of {roundGames.length} results entered</span>
        </div>
      )}
      {roundGames.map((game, idx) => (
        <GameRow key={game.id} game={game} players={players} boardIndex={idx + 1} onEnterResult={onEnterResult} onGameClick={onGameClick} isActive={isActive} isDark={isDark} T={T} />
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function QuadsDirectorPanel({
  externalSelectedSectionId,
  onSectionChange,
  sections, players, games, currentRound, totalRounds,
  onEnterResult, onSwapPlayers, onRenameSection, onAdvanceRound, onCompleteTournament,
  isDark, tournamentId, tournamentConfig, tournamentStatus,
}: QuadsDirectorPanelProps) {
  const isAlreadyCompleted = tournamentStatus === "completed";

  // ── State ──────────────────────────────────────────────────────────────────
  const [sectionRoundTab, setSectionRoundTab] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    sections.forEach((s) => { init[s.id] = currentRound; });
    return init;
  });
  const [sectionView, setSectionView] = useState<Record<string, "pairings" | "standings" | "crosstable">>(() => {
    const init: Record<string, "pairings" | "standings" | "crosstable"> = {};
    sections.forEach((s) => { init[s.id] = "pairings"; });
    return init;
  });

  // Command-center specific state
  const [_internalSelectedSectionId, _setInternalSelectedSectionId] = useState<string | null>(() => sections[0]?.id ?? null);
  const selectedSectionId = externalSelectedSectionId !== undefined ? (externalSelectedSectionId ?? sections[0]?.id ?? null) : _internalSelectedSectionId;
  const setSelectedSectionId = (id: string | null) => {
    _setInternalSelectedSectionId(id);
    if (id && onSectionChange) onSectionChange(id);
  };
  const [exceptionTrayOpen, setExceptionTrayOpen] = useState(false);
  const [carouselSection, setCarouselSection] = useState<string | null>(null);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);

  // Swap mode
  const [swapMode, setSwapMode] = useState(false);
  const [swapPlayerA, setSwapPlayerA] = useState<string | null>(null);

  // Inline rename
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Ref for workspace scroll-into-view on round advance
  const workspaceRef = useRef<HTMLDivElement>(null);
  const prevRoundRef = useRef(currentRound);

  // Auto-switch all section round tabs when round advances + scroll workspace into view
  useEffect(() => {
    setSectionRoundTab((prev) => {
      const updated: Record<string, number> = { ...prev };
      sections.forEach((s) => { updated[s.id] = currentRound; });
      return updated;
    });
    // Also switch view back to pairings so director sees the new round's boards
    if (prevRoundRef.current !== currentRound) {
      setSectionView((prev) => {
        const updated: Record<string, "pairings" | "standings" | "crosstable"> = { ...prev };
        sections.forEach((s) => { updated[s.id] = "pairings"; });
        return updated;
      });
      // Scroll workspace into view after a brief delay for DOM update
      setTimeout(() => {
        workspaceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
      prevRoundRef.current = currentRound;
    }
  }, [currentRound, sections]);

  useEffect(() => {
    if (editingSectionId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [editingSectionId]);

  // ── Computed data ──────────────────────────────────────────────────────────
  const gamesBySection = useMemo(() => {
    const map = new Map<string, Game[]>();
    for (const section of sections) {
      map.set(section.id, games.filter((g) => g.sectionId === section.id));
    }
    return map;
  }, [sections, games]);

  const standingsBySection = useMemo(() => {
    const map = new Map<string, ReturnType<typeof calculateQuadStandings>>();
    for (const section of sections) {
      const sectionGames = gamesBySection.get(section.id) ?? [];
      map.set(section.id, calculateQuadStandings(section, sectionGames, players));
    }
    return map;
  }, [sections, gamesBySection, players]);

  const sectionStatus = useMemo(() => {
    const map = new Map<string, { completed: number; total: number; pct: number; currentCompleted: number; currentTotal: number }>();
    for (const section of sections) {
      const sectionGames = gamesBySection.get(section.id) ?? [];
      const completed = sectionGames.filter((g) => g.result !== "*").length;
      const total = sectionGames.length;
      const currentRoundGames = sectionGames.filter((g) => g.round === currentRound);
      const currentCompleted = currentRoundGames.filter((g) => g.result !== "*").length;
      const currentTotal = currentRoundGames.length;
      map.set(section.id, { completed, total, pct: total > 0 ? Math.round((completed / total) * 100) : 0, currentCompleted, currentTotal });
    }
    return map;
  }, [sections, gamesBySection, currentRound]);

  // Global metrics
  const totalGames = games.length;
  const completedGames = games.filter((g) => g.result !== "*").length;
  const allComplete = sections.length > 0 && sections.every((s) => (sectionStatus.get(s.id)?.pct ?? 0) === 100);
  const currentRoundGames = games.filter((g) => g.round === currentRound);
  const currentRoundCompleted = currentRoundGames.filter((g) => g.result !== "*").length;
  const currentRoundTotal = currentRoundGames.length;
  const currentRoundComplete = currentRoundTotal > 0 && currentRoundCompleted === currentRoundTotal;

  // Sections needing attention (have pending games in current round)
  const sectionsNeedingAttention = sections.filter((s) => {
    const st = sectionStatus.get(s.id)!;
    return st.currentCompleted < st.currentTotal;
  });

  // Exception tray: missing results in current round
  const missingResults = currentRoundGames.filter((g) => g.result === "*" && g.blackId !== "BYE");
  const exceptionCount = missingResults.length;

  // Swap
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

  const startRename = (section: { id: string; name: string }) => {
    setEditingSectionId(section.id);
    setEditingName(section.name);
  };

  const commitRename = (sectionId: string) => {
    if (onRenameSection && editingName.trim()) onRenameSection(sectionId, editingName.trim());
    setEditingSectionId(null);
    setEditingName("");
  };

  const cancelRename = () => { setEditingSectionId(null); setEditingName(""); };

  // ── Color tokens ───────────────────────────────────────────────────────────
  const T = {
    card: isDark ? "oklch(0.16 0.03 145)" : "#ffffff",
    cardBorder: isDark ? "oklch(0.26 0.04 145)" : "#e2e8f0",
    cardHover: isDark ? "oklch(0.18 0.04 145)" : "#f8fafc",
    text: isDark ? "oklch(0.92 0.02 145)" : "#1a1a1a",
    textMuted: isDark ? "oklch(0.72 0.03 145)" : "#6b7280",
    textDim: isDark ? "oklch(0.58 0.02 145)" : "#9ca3af",
    green: "oklch(0.72 0.19 145)",
    greenBg: isDark ? "oklch(0.20 0.06 145)" : "oklch(0.96 0.04 145)",
    greenBorder: isDark ? "oklch(0.32 0.10 145)" : "oklch(0.80 0.12 145)",
    greenSoft: isDark ? "oklch(0.25 0.08 145)" : "oklch(0.92 0.06 145)",
    goldBg: isDark ? "oklch(0.22 0.06 85)" : "oklch(0.95 0.06 85)",
    goldBorder: isDark ? "oklch(0.38 0.10 85)" : "oklch(0.80 0.10 85)",
    gold: "oklch(0.75 0.15 85)",
    amber: "oklch(0.78 0.18 65)",
    amberBg: isDark ? "oklch(0.20 0.06 65)" : "oklch(0.97 0.04 65)",
    amberBorder: isDark ? "oklch(0.36 0.10 65)" : "oklch(0.82 0.10 65)",
    swapHighlight: isDark ? "oklch(0.28 0.12 200)" : "oklch(0.90 0.08 200)",
    swapBorder: isDark ? "oklch(0.45 0.15 200)" : "oklch(0.60 0.15 200)",
    swap: "oklch(0.65 0.18 200)",
    rowBg: isDark ? "oklch(0.13 0.02 145)" : "#f9fafb",
    rowBorder: isDark ? "oklch(0.22 0.03 145)" : "#f1f5f9",
    bg: isDark ? "oklch(0.12 0.02 145)" : "#f8fafc",
    headerBg: isDark ? "oklch(0.14 0.03 145)" : "#ffffff",
  };

  const selectedSection = sections.find((s) => s.id === selectedSectionId) ?? sections[0];

  // ── Completion View (Section G) ────────────────────────────────────────────
  if (allComplete) {
    return (
      <div className="space-y-4">
        {/* All-complete header */}
        <div
          className="rounded-2xl border px-5 py-4 flex items-center justify-between"
          style={{ background: T.goldBg, borderColor: T.goldBorder, boxShadow: `0 0 0 1px ${T.goldBorder}` }}
        >
          <div className="flex items-center gap-3">
            <Trophy size={20} style={{ color: T.gold }} />
            <div>
              <p className="text-sm font-black tracking-tight" style={{ color: T.gold, fontFamily: "'Clash Display', sans-serif" }}>All Quads Complete</p>
              <p className="text-xs mt-0.5" style={{ color: T.textMuted }}>{totalRounds} rounds · {players.length} players · {sections.length} sections</p>
            </div>
          </div>
          {onCompleteTournament && (
            <button
              type="button"
              onClick={isAlreadyCompleted ? undefined : onCompleteTournament}
              disabled={isAlreadyCompleted}
              aria-label={isAlreadyCompleted ? "Tournament already finalized" : "Finalize Tournament"}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              style={{ background: T.gold, color: isDark ? "#0a1a0f" : "#fff", boxShadow: isAlreadyCompleted ? "none" : `0 4px 14px oklch(0.75 0.15 85 / 0.35)` }}
            >
              {isAlreadyCompleted ? <Check size={14} /> : <Flag size={14} />}
              {isAlreadyCompleted ? "Finalized" : "Finalize Tournament"}
            </button>
          )}
        </div>

        {/* Per-section champion cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {sections.map((section) => {
            const sectionGames = gamesBySection.get(section.id) ?? [];
            const sectionPlayers = players.filter((p) => section.playerIds.includes(p.id));
            const roundNums = Array.from(new Set(sectionGames.map((g) => g.round))).sort((a, b) => a - b);
            const sectionRounds: Round[] = roundNums.map((rn) => ({
              number: rn, status: "completed" as const, games: sectionGames.filter((g) => g.round === rn),
            }));
            // Use calculateQuadStandings (SB + H2H tiebreaks) — NOT the Swiss engine
            const standings = standingsBySection.get(section.id) ?? [];
            const winners = getSectionWinners(standings);
            const isCo = winners.length > 1;
            const top3 = standings.slice(0, 3).map((s) => ({
              player: sectionPlayers.find((p) => p.id === s.playerId) ?? { id: s.playerId, name: "Unknown", username: "", elo: 0, wins: s.wins, draws: s.draws, losses: s.losses, points: s.score, platform: "chesscom" as const },
              points: s.score,
              wins: s.wins,
              draws: s.draws,
              losses: s.losses,
              sonnebornBerger: s.sonnebornBerger,
            }));

            const medalConfig = [
              { bg: isDark ? "oklch(0.24 0.08 85 / 0.3)" : "oklch(0.95 0.06 85)", border: T.goldBorder, color: T.gold },
              { bg: isDark ? "oklch(0.18 0.02 145)" : "#f8fafc", border: T.cardBorder, color: T.textMuted },
              { bg: isDark ? "oklch(0.20 0.05 55 / 0.2)" : "oklch(0.97 0.04 55)", border: isDark ? "oklch(0.35 0.08 55)" : "oklch(0.82 0.08 55)", color: isDark ? "oklch(0.68 0.12 55)" : "oklch(0.55 0.12 55)" },
            ];

            return (
              <div
                key={section.id}
                className="rounded-2xl border overflow-hidden animate-in fade-in slide-in-from-bottom-2"
                style={{ animationDuration: "400ms", animationFillMode: "both", background: T.card, borderColor: T.goldBorder, boxShadow: `0 0 0 1px ${T.goldBorder}, 0 4px 20px ${isDark ? "oklch(0.75 0.15 85 / 0.08)" : "oklch(0.75 0.15 85 / 0.12)"}` }}
              >
                {/* Card header */}
                <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: T.goldBorder, background: isDark ? "oklch(0.18 0.05 85 / 0.3)" : "oklch(0.97 0.04 85 / 0.5)" }}>
                  <div className="flex items-center gap-2">
                    <Trophy size={13} style={{ color: T.gold }} />
                    <span className="text-sm font-black" style={{ color: T.gold, fontFamily: "'Clash Display', sans-serif" }}>{section.name}</span>
                    {isCo && <span className="text-xs px-1.5 py-0.5 rounded-full font-bold" style={{ background: T.goldBg, color: T.gold, border: `1px solid ${T.goldBorder}` }}>Co-Champs</span>}
                  </div>
                  <span className="text-xs" style={{ color: T.textDim }}>{formatRatingRange(section)}</span>
                </div>

                {/* Podium */}
                <div className="divide-y" style={{ borderColor: isDark ? "oklch(0.22 0.04 85 / 0.3)" : "oklch(0.85 0.06 85 / 0.4)" }}>
                  {top3.map((row, idx) => {
                    const medal = medalConfig[idx];
                    const pts = row.points % 1 !== 0 ? `${Math.floor(row.points)}½` : String(row.points);
                    return (
                      <div key={row.player.id} className={`flex items-center gap-3 px-4 ${idx === 0 ? "py-3.5" : "py-2.5"}`}>
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-black" style={{ background: medal.bg, border: `1px solid ${medal.border}`, color: medal.color, fontFamily: "'Clash Display', sans-serif" }}>{idx + 1}</div>
                        <div className="flex-1 min-w-0">
                          <span className={`${idx === 0 ? "text-sm" : "text-xs"} font-black truncate block`} style={{ color: T.text, fontFamily: "'Clash Display', sans-serif" }}>{row.player.name}</span>
                          <span className="text-xs" style={{ color: T.textDim }}>{row.wins}W {row.draws}D {row.losses}L · SB {(row.sonnebornBerger ?? 0).toFixed(2)}</span>
                        </div>
                        <span className={`${idx === 0 ? "text-2xl" : "text-lg"} font-black tabular-nums flex-shrink-0`} style={{ color: medal.color, fontFamily: "'Clash Display', sans-serif" }}>{pts}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap gap-2 px-4 py-3 border-t" style={{ borderColor: isDark ? "oklch(0.22 0.04 85 / 0.3)" : "oklch(0.85 0.06 85 / 0.4)" }}>
                  {tournamentId && (
                    <a href={`/tournament/${tournamentId}/report?section=${section.id}`} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95" style={{ background: T.goldBg, color: T.gold, border: `1px solid ${T.goldBorder}` }}>
                      <Trophy size={12} /> Reports
                    </a>
                  )}
                  <button onClick={() => setCarouselSection(section.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95" style={{ background: isDark ? "oklch(0.16 0.02 145)" : "#fff", color: T.textMuted, border: `1px solid ${T.cardBorder}` }}>
                    <div className="w-3 h-3 rounded bg-gradient-to-br from-[#833AB4] via-[#FD1D1D] to-[#FCB045] flex-shrink-0" />
                    Recap
                  </button>
                  {tournamentId && (
                    <a href={`/tournament/${tournamentId}?section=${section.id}`} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95" style={{ background: T.greenBg, color: T.green, border: `1px solid ${T.greenBorder}` }}>
                      <BarChart3 size={12} /> Results
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Instagram Carousel Modal */}
        {carouselSection && (() => {
          const sec = sections.find((s) => s.id === carouselSection);
          if (!sec) return null;
          const sectionGames = gamesBySection.get(sec.id) ?? [];
          const sectionPlayers = players.filter((p) => sec.playerIds.includes(p.id));
          const roundNums = Array.from(new Set(sectionGames.map((g) => g.round))).sort((a, b) => a - b);
          const sectionRounds: Round[] = roundNums.map((rn) => ({ number: rn, status: "completed" as const, games: sectionGames.filter((g) => g.round === rn) }));
          const rows: StandingRow[] = computeStandings(sectionPlayers, sectionRounds);
          return (
            <InstagramCarouselModal
              open={true} onClose={() => setCarouselSection(null)}
              rows={rows} config={tournamentConfig ?? null}
              tournamentName={`${tournamentConfig?.name ?? "Tournament"} — ${sec.name}`}
              totalRounds={totalRounds} rounds={sectionRounds}
            />
          );
        })()}
      </div>
    );
  }

  // ── Operational Command Center View ───────────────────────────────────────

  return (
    <div className="space-y-4">

            {/* ── B. Exception Tray (Pending Results) + Swap Players ─────────── */}
      <div className="rounded-2xl border overflow-hidden" style={{ background: T.card, borderColor: exceptionCount > 0 ? T.amberBorder : T.cardBorder }}>
        <div
          className="w-full flex items-center justify-between px-4 py-3"
          style={{ background: exceptionCount > 0 ? T.amberBg : "transparent", minHeight: "44px" }}
        >
          {/* Left: exception status — clickable to toggle tray */}
          <button
            type="button"
            aria-expanded={exceptionTrayOpen}
            aria-label={`Exception tray — ${exceptionCount} item${exceptionCount !== 1 ? "s" : ""}`}
            onClick={() => setExceptionTrayOpen(!exceptionTrayOpen)}
            className="flex items-center gap-2 flex-1 text-left transition-opacity hover:opacity-80"
            style={{ touchAction: "manipulation" }}
          >
            {exceptionCount > 0 ? <AlertTriangle size={14} style={{ color: T.amber }} /> : <Check size={14} style={{ color: T.green }} />}
            <span className="text-xs font-semibold" style={{ color: exceptionCount > 0 ? T.amber : T.green }}>
              {exceptionCount > 0 ? `${exceptionCount} pending result${exceptionCount !== 1 ? "s" : ""} in Round ${currentRound}` : "No exceptions — tournament running smoothly"}
            </span>
            {exceptionCount > 0 && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: T.amber, color: isDark ? "#0a1a0f" : "#fff" }}>{exceptionCount}</span>
            )}
          </button>
          {/* Right: Swap Players + chevron */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {canSwap && (
              <button
                type="button"
                onClick={() => { setSwapMode(!swapMode); setSwapPlayerA(null); }}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1"
                style={{ background: swapMode ? T.swapHighlight : "transparent", color: swapMode ? T.swap : T.textMuted, border: `1px solid ${swapMode ? T.swapBorder : T.cardBorder}` }}
              >
                <ArrowLeftRight size={11} />
                {swapMode ? "Cancel" : "Swap"}
              </button>
            )}
            <button
              type="button"
              onClick={() => setExceptionTrayOpen(!exceptionTrayOpen)}
              className="p-1 rounded transition-opacity hover:opacity-70"
              aria-label="Toggle exception tray"
            >
              {exceptionTrayOpen ? <ChevronUp size={14} style={{ color: T.textDim }} /> : <ChevronDown size={14} style={{ color: T.textDim }} />}
            </button>
          </div>
        </div>
        {exceptionTrayOpen && exceptionCount > 0 && (
          <div className="px-4 pb-4 pt-1 space-y-2 border-t" style={{ borderColor: T.amberBorder }}>
            {missingResults.map((game) => {
              const sectionName = sections.find((s) => s.playerIds.includes(game.whiteId))?.name ?? "Unknown";
              return (
                <div key={game.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl" style={{ background: T.amberBg, border: `1px solid ${T.amberBorder}` }}>
                  <div className="flex items-center gap-2 min-w-0">
                    <AlertTriangle size={11} style={{ color: T.amber, flexShrink: 0 }} />
                    <span className="text-xs font-semibold truncate" style={{ color: T.text }}>
                      {getPlayerName(players, game.whiteId)} vs {getPlayerName(players, game.blackId)}
                    </span>
                    <span className="text-xs flex-shrink-0" style={{ color: T.textDim }}>· {sectionName}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setSelectedSectionId(sections.find((s) => s.playerIds.includes(game.whiteId))?.id ?? null); setExceptionTrayOpen(false); setSelectedGameId(game.id); }}
                    className="text-xs font-semibold px-3 py-2 rounded-lg flex-shrink-0 transition-colors"
                    style={{ background: T.greenBg, color: T.green, border: `1px solid ${T.greenBorder}`, touchAction: "manipulation", minHeight: "36px" }}
                  >
                    Go to section
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── C. Active-Round Command Center ────────────────────────────────── */}
      <div
        className="rounded-2xl border px-5 py-4"
        style={{ background: T.card, borderColor: currentRoundComplete ? T.greenBorder : T.cardBorder }}
      >
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {/* Metrics */}
          <div className="flex items-center gap-5 flex-wrap">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: T.textDim }}>Active Round</p>
              <p className="text-2xl font-black tabular-nums" style={{ color: T.text, fontFamily: "'Clash Display', sans-serif" }}>{currentRound}<span className="text-sm font-semibold ml-1" style={{ color: T.textDim }}>/ {totalRounds}</span></p>
            </div>
            <div className="w-px h-10 self-center" style={{ background: T.cardBorder }} />
            <div>
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: T.textDim }}>Results Entered</p>
              <p className="text-xl font-black tabular-nums" style={{ color: currentRoundComplete ? T.green : T.text, fontFamily: "'Clash Display', sans-serif" }}>
                {currentRoundCompleted}<span className="text-sm font-semibold ml-0.5" style={{ color: T.textDim }}>/ {currentRoundTotal}</span>
              </p>
            </div>
            {sectionsNeedingAttention.length > 0 && (
              <>
                <div className="w-px h-10 self-center" style={{ background: T.cardBorder }} />
                <div className="flex items-center gap-1.5">
                  <AlertTriangle size={14} style={{ color: T.amber }} />
                  <span className="text-xs font-semibold" style={{ color: T.amber }}>
                    {sectionsNeedingAttention.length} section{sectionsNeedingAttention.length !== 1 ? "s" : ""} pending
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Primary CTA */}
          <div className="flex flex-col items-end gap-1">
            {currentRound < totalRounds ? (
              <>
                <button
                  type="button"
                  onClick={onAdvanceRound}
                  disabled={!currentRoundComplete}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
                  style={{ background: currentRoundComplete ? T.green : T.greenBg, color: currentRoundComplete ? (isDark ? "#0a1a0f" : "#fff") : T.green, border: `1.5px solid ${T.greenBorder}`, boxShadow: currentRoundComplete ? `0 4px 14px oklch(0.72 0.19 145 / 0.35)` : "none", touchAction: "manipulation", minHeight: "44px" }}
                >
                  <ArrowRight size={16} />
                  Advance to Round {currentRound + 1}
                </button>
                {!currentRoundComplete && (
                  <p className="text-xs text-right" style={{ color: T.textDim }}>
                    {currentRoundTotal - currentRoundCompleted} game{currentRoundTotal - currentRoundCompleted !== 1 ? "s" : ""} remaining
                  </p>
                )}
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={isAlreadyCompleted ? undefined : onCompleteTournament}
                  disabled={!currentRoundComplete || isAlreadyCompleted}
                  aria-label={isAlreadyCompleted ? "Tournament already finalized" : "Finalize Tournament"}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
                  style={{ background: (currentRoundComplete && !isAlreadyCompleted) ? T.gold : T.goldBg, color: (currentRoundComplete && !isAlreadyCompleted) ? (isDark ? "#0a1a0f" : "#fff") : T.gold, border: `1.5px solid ${T.goldBorder}`, boxShadow: (currentRoundComplete && !isAlreadyCompleted) ? `0 4px 14px oklch(0.75 0.15 85 / 0.35)` : "none", touchAction: "manipulation", minHeight: "44px" }}
                >
                  {isAlreadyCompleted ? <Check size={16} /> : <Flag size={16} />}
                  {isAlreadyCompleted ? "Finalized" : "Finalize Tournament"}
                </button>
                {!currentRoundComplete && (
                  <p className="text-xs text-right" style={{ color: T.textDim }}>
                    {currentRoundTotal - currentRoundCompleted} game{currentRoundTotal - currentRoundCompleted !== 1 ? "s" : ""} remaining in Round {currentRound}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── E. Selected Quad Workspace ────────────────────────────────────── */}
      {selectedSection && (
        <div
          ref={workspaceRef}
          className="rounded-2xl border overflow-hidden"
          style={{ background: T.card, borderColor: T.greenBorder, boxShadow: `0 0 0 1px ${T.greenBorder}` }}
        >
          {/* Workspace header */}
          <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: T.cardBorder, background: isDark ? "oklch(0.14 0.03 145)" : "#fafbfc" }}>
            <div className="flex items-center gap-3">
              {/* Section icon */}
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 relative overflow-hidden"
                style={{ background: `linear-gradient(135deg, oklch(0.22 0.08 145), oklch(0.18 0.05 145))`, border: `1.5px solid ${T.greenBorder}`, boxShadow: `0 4px 14px oklch(0.72 0.19 145 / 0.25)` }}>
                <div className="absolute inset-0 rounded-xl" style={{ background: "radial-gradient(circle at 35% 30%, rgba(255,255,255,0.12) 0%, transparent 65%)" }} />
                <svg width="18" height="18" viewBox="0 0 22 22" fill="none">
                  <rect x="1" y="1" width="9" height="9" rx="2" fill={T.green} opacity="0.9" />
                  <rect x="12" y="1" width="9" height="9" rx="2" fill={T.green} opacity="0.5" />
                  <rect x="1" y="12" width="9" height="9" rx="2" fill={T.green} opacity="0.5" />
                  <rect x="12" y="12" width="9" height="9" rx="2" fill={T.green} opacity="0.9" />
                </svg>
              </div>
              <div>
                {/* Inline rename */}
                {editingSectionId === selectedSection.id ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      ref={renameInputRef} value={editingName} onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") commitRename(selectedSection.id); if (e.key === "Escape") cancelRename(); }}
                      onBlur={() => commitRename(selectedSection.id)}
                      className="text-sm font-extrabold tracking-tight rounded-lg px-2 py-0.5 outline-none w-36"
                      style={{ color: T.text, fontFamily: "'Clash Display', sans-serif", background: T.greenBg, border: `1.5px solid ${T.greenBorder}` }}
                    />
                      <button onClick={cancelRename} className="w-9 h-9 flex items-center justify-center rounded-full" style={{ color: T.textMuted, touchAction: "manipulation" }}><X size={14} /></button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-extrabold tracking-tight" style={{ color: T.text, fontFamily: "'Clash Display', sans-serif" }}>{selectedSection.name}</span>
                    {onRenameSection && (
                      <button onClick={() => startRename(selectedSection)} className="w-9 h-9 flex items-center justify-center rounded-md transition-opacity opacity-50 hover:opacity-100" style={{ color: T.textMuted, touchAction: "manipulation" }} title="Rename section"><Pencil size={12} /></button>
                    )}
                  </div>
                )}
                <p className="text-xs mt-0.5" style={{ color: T.textDim }}>{formatRatingRange(selectedSection)} · {selectedSection.playerIds.length} players</p>
              </div>
            </div>

            {/* Round tabs + view toggle */}
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <div className="flex items-center gap-1 overflow-x-auto scrollbar-none" role="tablist" aria-label="Round tabs">
                {Array.from({ length: totalRounds }, (_, i) => i + 1).map((roundNum) => {
                  const isActive = (sectionRoundTab[selectedSection.id] ?? currentRound) === roundNum;
                  const sectionGames = gamesBySection.get(selectedSection.id) ?? [];
                  const roundGames = sectionGames.filter((g) => g.round === roundNum);
                  const roundComplete = roundGames.every((g) => g.result !== "*") && roundGames.length > 0;
                  const isCurrent = roundNum === currentRound;
                  return (
                    <button key={roundNum} type="button" role="tab" aria-selected={isActive}
                      aria-label={`Round ${roundNum}${roundComplete ? " — complete" : isCurrent ? " — in progress" : ""}`}
                      onClick={() => setSectionRoundTab((prev) => ({ ...prev, [selectedSection.id]: roundNum }))}
                      className="relative px-3 py-2.5 rounded-lg text-xs font-bold transition-all flex-shrink-0"
                      style={{ background: isActive ? T.greenBg : "transparent", color: isActive ? T.green : T.textMuted, border: `1px solid ${isActive ? T.greenBorder : "transparent"}` }}
                    >
                      R{roundNum}
                      {roundComplete && <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full flex items-center justify-center" style={{ background: T.green }}><Check size={7} color={isDark ? "#0a1a0f" : "#fff"} strokeWidth={3} /></span>}
                      {isCurrent && !roundComplete && <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: T.green, opacity: 0.7 }} />}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-0.5 p-0.5 rounded-lg" style={{ background: isDark ? "oklch(0.12 0.02 145)" : "#f1f5f9" }}>
                  <button type="button" aria-pressed={(sectionView[selectedSection.id] ?? "pairings") === "pairings"} aria-label="Show boards view"
                  onClick={() => setSectionView((prev) => ({ ...prev, [selectedSection.id]: "pairings" }))}
                  className="flex items-center gap-1 px-3 py-2 rounded-md text-xs font-semibold transition-all"
                  style={{ background: (sectionView[selectedSection.id] ?? "pairings") === "pairings" ? (isDark ? T.card : "#fff") : "transparent", color: (sectionView[selectedSection.id] ?? "pairings") === "pairings" ? T.green : T.textDim, boxShadow: (sectionView[selectedSection.id] ?? "pairings") === "pairings" ? "0 1px 3px rgba(0,0,0,0.1)" : "none" }}>
                  <Swords size={10} />Boards
                </button>
                  <button type="button" aria-pressed={(sectionView[selectedSection.id] ?? "pairings") === "standings"} aria-label="Show standings table"
                  onClick={() => setSectionView((prev) => ({ ...prev, [selectedSection.id]: "standings" }))}
                  className="flex items-center gap-1 px-3 py-2 rounded-md text-xs font-semibold transition-all"
                  style={{ background: (sectionView[selectedSection.id] ?? "pairings") === "standings" ? (isDark ? T.card : "#fff") : "transparent", color: (sectionView[selectedSection.id] ?? "pairings") === "standings" ? T.green : T.textDim, boxShadow: (sectionView[selectedSection.id] ?? "pairings") === "standings" ? "0 1px 3px rgba(0,0,0,0.1)" : "none" }}>
                  <BarChart3 size={10} />Table
                </button>
                  <button type="button" aria-pressed={(sectionView[selectedSection.id] ?? "pairings") === "crosstable"} aria-label="Show cross-table matrix"
                  onClick={() => setSectionView((prev) => ({ ...prev, [selectedSection.id]: "crosstable" }))}
                  className="flex items-center gap-1 px-3 py-2 rounded-md text-xs font-semibold transition-all"
                  style={{ background: (sectionView[selectedSection.id] ?? "pairings") === "crosstable" ? (isDark ? T.card : "#fff") : "transparent", color: (sectionView[selectedSection.id] ?? "pairings") === "crosstable" ? T.green : T.textDim, boxShadow: (sectionView[selectedSection.id] ?? "pairings") === "crosstable" ? "0 1px 3px rgba(0,0,0,0.1)" : "none" }}>
                  <Grid3X3 size={10} />Matrix
                </button>
              </div>
            </div>
          </div>

          {/* Swap mode player chips */}
          {swapMode && (
            <div className="px-4 py-2.5 border-b" style={{ borderColor: T.cardBorder, background: isDark ? "oklch(0.14 0.02 145)" : "#f8fafc" }}>
              <div className="flex flex-wrap gap-1.5">
                {selectedSection.playerIds.map((pid) => {
                  const isSelected = swapPlayerA === pid;
                  const isTarget = swapPlayerA ? !selectedSection.playerIds.includes(swapPlayerA) : false;
                  return (
                    <button key={pid} onClick={() => handlePlayerClick(pid)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:scale-[1.03] active:scale-95"
                      style={{ background: isSelected ? T.swapHighlight : (isDark ? "oklch(0.18 0.02 145)" : "#fff"), border: `1.5px solid ${isSelected ? T.swapBorder : (isTarget ? T.greenBorder : T.cardBorder)}`, color: isSelected ? T.swap : T.text, boxShadow: isSelected ? `0 0 8px ${T.swapBorder}` : "0 1px 2px rgba(0,0,0,0.05)" }}>
                      {getPlayerName(players, pid)}
                      <span className="ml-1.5 opacity-50 font-mono">{getPlayerRating(players, pid)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Workspace content */}
          <div className="p-4">
            {(sectionView[selectedSection.id] ?? "pairings") === "pairings" ? (
              <RoundPairings
                section={selectedSection}
                games={gamesBySection.get(selectedSection.id) ?? []}
                players={players}
                roundNum={sectionRoundTab[selectedSection.id] ?? currentRound}
                currentRound={currentRound}
                onEnterResult={onEnterResult}
                onGameClick={(gameId) => setSelectedGameId(gameId)}
                isDark={isDark}
                T={T}
              />
            ) : (sectionView[selectedSection.id] ?? "pairings") === "crosstable" ? (
              <CrossTableView
                section={selectedSection}
                games={gamesBySection.get(selectedSection.id) ?? []}
                players={players}
                standings={standingsBySection.get(selectedSection.id) ?? []}
                isDark={isDark}
                T={T}
              />
            ) : (
              <StandingsView
                section={selectedSection}
                standings={standingsBySection.get(selectedSection.id) ?? []}
                players={players}
                isDark={isDark}
                T={T}
              />
            )}
          </div>
        </div>
      )}



      {/* Result Entry Panel */}
      {selectedGameId && (() => {
        const game = games.find((g) => g.id === selectedGameId);
        if (!game) return null;
        const sectionGames = games.filter((g) => g.sectionId === game.sectionId);
        const boardIndex = sectionGames.filter((g) => g.round === game.round).findIndex((g) => g.id === game.id) + 1;

        // Auto-advance: find next pending game in same section/round after current
        const handleAdvanceToNext = (currentGameId: string) => {
          const currentGame = games.find((g) => g.id === currentGameId);
          if (!currentGame) { setSelectedGameId(null); return; }
          const roundGames = sectionGames
            .filter((g) => g.round === currentGame.round && g.blackId !== "BYE")
            .sort((a, b) => a.id.localeCompare(b.id));
          const currentIdx = roundGames.findIndex((g) => g.id === currentGameId);
          // Look for next pending game after current index
          const nextPending = roundGames.slice(currentIdx + 1).find((g) => g.result === "*");
          // If none after, wrap around from beginning
          const firstPending = !nextPending
            ? roundGames.slice(0, currentIdx).find((g) => g.result === "*")
            : undefined;
          const next = nextPending ?? firstPending ?? null;
          setSelectedGameId(next ? next.id : null);
        };

        return (
          <ResultEntryPanel
            game={game}
            players={players}
            boardIndex={boardIndex}
            onEnterResult={onEnterResult}
            onClose={() => setSelectedGameId(null)}
            onAdvanceToNext={handleAdvanceToNext}
            isDark={isDark}
            T={T}
          />
        );
      })()}

      {/* Instagram Carousel Modal */}
      {carouselSection && (() => {
        const sec = sections.find((s) => s.id === carouselSection);
        if (!sec) return null;
        const sectionGames = gamesBySection.get(sec.id) ?? [];
        const sectionPlayers = players.filter((p) => sec.playerIds.includes(p.id));
        const roundNums = Array.from(new Set(sectionGames.map((g) => g.round))).sort((a, b) => a - b);
        const sectionRounds: Round[] = roundNums.map((rn) => ({ number: rn, status: "completed" as const, games: sectionGames.filter((g) => g.round === rn) }));
        const rows: StandingRow[] = computeStandings(sectionPlayers, sectionRounds);
        return (
          <InstagramCarouselModal
            open={true} onClose={() => setCarouselSection(null)}
            rows={rows} config={tournamentConfig ?? null}
            tournamentName={`${tournamentConfig?.name ?? "Tournament"} — ${sec.name}`}
            totalRounds={totalRounds} rounds={sectionRounds}
          />
        );
      })()}
    </div>
  );
}
