/**
 * ChessLineViewer — Chessable-style interactive board for the Key Lines tab.
 *
 * Features:
 * - Parses a PGN/SAN move string (e.g. "1. e4 e5 2. Nf3 Nc6") into individual moves
 * - Renders a live chessboard via react-chessboard
 * - Step-through navigation: ← / → arrows, keyboard support
 * - Move list panel: numbered moves, active move highlighted
 * - Last-move highlight (from/to squares in accent green)
 * - Board auto-orientation: flips to Black's perspective when the line starts with Black
 * - Compact Chessable-inspired layout: board left, move list + controls right
 * - Fully themed to the OTB Chess dark/light design system
 * - Fullscreen overlay: immersive full-screen board view with Escape to close
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import { useAccessibleOverlay } from "@/hooks/useAccessibleOverlay";
import {
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  FlipHorizontal,
  BookOpen,
  Maximize2,
  Minimize2,
  X,
} from "lucide-react";

interface ChessLineViewerProps {
  /** PGN/SAN move string, e.g. "1. e4 e5 2. Nf3 Nc6 3. Bb5" */
  moves: string;
  /** Opening name for the header */
  lineName: string;
  /** Strategic rationale shown below the board */
  rationale?: string;
  /** ECO code shown in the header */
  eco?: string;
  isDark: boolean;
}

// ── Parse PGN move string into SAN array ──────────────────────────────────────
function parseMoves(pgn: string): string[] {
  // Remove move numbers (e.g. "1." "12.") and trim
  return pgn
    .replace(/\d+\./g, "")
    .split(/\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !/^\d+$/.test(s));
}

// ── Build position history from SAN array ─────────────────────────────────────
function buildPositions(sanMoves: string[]): { fen: string; san: string; from: string; to: string }[] {
  const chess = new Chess();
  const positions: { fen: string; san: string; from: string; to: string }[] = [];

  for (const san of sanMoves) {
    try {
      const move = chess.move(san);
      if (!move) break;
      positions.push({
        fen: chess.fen(),
        san: move.san,
        from: move.from,
        to: move.to,
      });
    } catch {
      break; // stop on invalid move
    }
  }
  return positions;
}

// ── Shared board renderer (used in both normal and fullscreen mode) ────────────
function BoardView({
  positions,
  totalSteps,
  stepIndex,
  boardFlipped,
  isDark,
  isFullscreen,
  goTo,
  setBoardFlipped,
  moveListRef,
  movePairs,
  rationale,
  lineName,
  eco,
  onToggleFullscreen,
}: {
  positions: { fen: string; san: string; from: string; to: string }[];
  totalSteps: number;
  stepIndex: number;
  boardFlipped: boolean;
  isDark: boolean;
  isFullscreen: boolean;
  goTo: (idx: number) => void;
  setBoardFlipped: React.Dispatch<React.SetStateAction<boolean>>;
  moveListRef: React.RefObject<HTMLDivElement | null>;
  movePairs: { moveNum: number; white: { san: string; idx: number } | null; black: { san: string; idx: number } | null }[];
  rationale?: string;
  lineName: string;
  eco?: string;
  onToggleFullscreen: () => void;
}) {
  const currentFen =
    stepIndex === -1
      ? "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
      : positions[stepIndex]?.fen ?? "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

  const lastMoveSquares =
    stepIndex >= 0 && positions[stepIndex]
      ? {
          [positions[stepIndex].from]: { background: isDark ? "rgba(93,180,107,0.35)" : "rgba(61,107,71,0.25)" },
          [positions[stepIndex].to]: { background: isDark ? "rgba(93,180,107,0.55)" : "rgba(61,107,71,0.45)" },
        }
      : {};

  // Design tokens
  const bg = isDark ? "bg-[#0f1c11]" : "bg-white";
  const border = isDark ? "border-[#1e2e22]/70" : "border-[#ADBC9F]/80";
  const textPrimary = isDark ? "text-white" : "text-[#12372A]";
  const textSecondary = isDark ? "text-white/55" : "text-[#436850]";
  const textTertiary = isDark ? "text-white/30" : "text-[#436850]";
  const accentText = isDark ? "text-[#5B9A6A]" : "text-[#436850]";
  const accentBg = isDark ? "bg-[#436850]/20 text-[#5B9A6A]" : "bg-[#436850]/10 text-[#436850]";
  const activeMoveStyle = isDark
    ? "bg-[#436850]/30 text-white border border-[#436850]/40"
    : "bg-[#436850]/15 text-[#436850] border border-[#436850]/25";
  const inactiveMoveStyle = isDark
    ? "text-white/60 hover:bg-white/05 hover:text-white"
    : "text-[#436850] hover:bg-[#ADBC9F]/50 hover:text-[#12372A]";
  const btnBase = `flex items-center justify-center rounded-xl transition-all active:scale-95 border`;
  const btnEnabled = isDark
    ? "border-[#2e4a34]/50 text-white/70 hover:bg-[#162018] hover:text-white"
    : "border-[#ADBC9F] text-[#436850] hover:bg-[#ADBC9F]/50 hover:text-[#12372A]";
  const btnDisabled = isDark ? "border-[#1e2e22]/40 text-white/15 cursor-not-allowed" : "border-[#ADBC9F]/70 text-[#436850]/70 cursor-not-allowed";

  const boardMaxWidth = isFullscreen ? "min(60vh, 560px)" : "280px";

  return (
    <div className={isFullscreen ? "flex flex-col h-full" : ""}>
      {/* Header */}
      <div className={`px-4 py-3 border-b ${border} flex items-center gap-3`}>
        <BookOpen className={`w-4 h-4 shrink-0 ${accentText}`} />
        <div className="flex-1 min-w-0">
          <h4 className={`text-sm font-bold truncate ${textPrimary}`} style={{ fontFamily: "'Clash Display', sans-serif" }}>
            {lineName}
          </h4>
          {eco && eco !== "---" && (
            <span className={`text-[10px] font-mono ${textTertiary}`}>{eco}</span>
          )}
        </div>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${accentBg}`}>
          {totalSteps} moves
        </span>
        {/* Fullscreen toggle button */}
        <button
          onClick={onToggleFullscreen}
          className={`${btnBase} w-7 h-7 ml-1 ${btnEnabled}`}
          title={isFullscreen ? "Exit fullscreen (Esc)" : "Fullscreen view"}
        >
          {isFullscreen
            ? <Minimize2 className="w-3.5 h-3.5" />
            : <Maximize2 className="w-3.5 h-3.5" />
          }
        </button>
      </div>

      {/* Body: board + move list */}
      <div className={isFullscreen
        ? "flex flex-1 min-h-0 gap-0"
        : "flex flex-col gap-0"
      }>
        {/* Board */}
        <div className={isFullscreen
          ? "flex flex-col items-center justify-center p-6 shrink-0"
          : "flex-shrink-0 p-3"
        }>
          <div style={{ width: "100%", maxWidth: boardMaxWidth }} className="mx-auto">
            <Chessboard
              options={{
                position: currentFen,
                boardOrientation: boardFlipped ? "black" : "white",
                allowDragging: false,
                squareStyles: lastMoveSquares,
                boardStyle: {
                  borderRadius: "12px",
                  boxShadow: isDark
                    ? "0 4px 24px rgba(0,0,0,0.5)"
                    : "0 4px 16px rgba(0,0,0,0.12)",
                },
                darkSquareStyle: {
                  backgroundColor: isDark ? "#2d4a32" : "#769656",
                },
                lightSquareStyle: {
                  backgroundColor: isDark ? "#1a2e1e" : "#eeeed2",
                },
                animationDurationInMs: 200,
              }}
            />
          </div>

          {/* Board controls */}
          <div style={{ maxWidth: boardMaxWidth }} className="flex items-center justify-center gap-2 mt-3 mx-auto w-full">
            <button
              onClick={() => goTo(-1)}
              disabled={stepIndex === -1}
              className={`${btnBase} w-8 h-8 text-xs ${stepIndex === -1 ? btnDisabled : btnEnabled}`}
              title="Start"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => goTo(stepIndex - 1)}
              disabled={stepIndex === -1}
              className={`${btnBase} w-9 h-9 ${stepIndex === -1 ? btnDisabled : btnEnabled}`}
              title="Previous move (←)"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className={`text-xs font-mono min-w-[52px] text-center ${textTertiary}`}>
              {stepIndex === -1 ? "Start" : `${stepIndex + 1} / ${totalSteps}`}
            </span>
            <button
              onClick={() => goTo(stepIndex + 1)}
              disabled={stepIndex >= totalSteps - 1}
              className={`${btnBase} w-9 h-9 ${stepIndex >= totalSteps - 1 ? btnDisabled : btnEnabled}`}
              title="Next move (→)"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => goTo(totalSteps - 1)}
              disabled={stepIndex === totalSteps - 1}
              className={`${btnBase} w-8 h-8 text-xs ${stepIndex === totalSteps - 1 ? btnDisabled : btnEnabled}`}
              title="End"
            >
              <ChevronRight className="w-3.5 h-3.5" />
              <ChevronRight className="w-3.5 h-3.5 -ml-2.5" />
            </button>
            <button
              onClick={() => setBoardFlipped((f) => !f)}
              className={`${btnBase} w-8 h-8 ml-1 ${btnEnabled}`}
              title="Flip board"
            >
              <FlipHorizontal className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Move list + rationale */}
        <div className={`flex flex-col border-t ${border} ${isFullscreen ? "flex-1 min-h-0 border-t-0 border-l" : ""}`}>
          {/* Move list */}
          <div
            ref={moveListRef}
            className={`flex-1 overflow-y-auto p-3 ${isFullscreen ? "" : "max-h-[180px]"}`}
          >
            <p className={`text-[10px] font-semibold uppercase tracking-widest mb-2 px-1 ${textTertiary}`}>
              Moves
            </p>
            <div className="space-y-0.5">
              {movePairs.map((pair) => (
                <div key={pair.moveNum} className="flex items-center gap-1">
                  {/* Move number */}
                  <span className={`text-[11px] font-mono w-6 shrink-0 ${textTertiary}`}>
                    {pair.moveNum}.
                  </span>
                  {/* White move */}
                  {pair.white && (
                    <button
                      data-active={stepIndex === pair.white.idx ? "true" : "false"}
                      onClick={() => goTo(pair.white!.idx)}
                      className={`text-[12px] font-mono px-2 py-0.5 rounded-lg transition-all ${
                        stepIndex === pair.white.idx ? activeMoveStyle : inactiveMoveStyle
                      }`}
                    >
                      {pair.white.san}
                    </button>
                  )}
                  {/* Black move */}
                  {pair.black && (
                    <button
                      data-active={stepIndex === pair.black.idx ? "true" : "false"}
                      onClick={() => goTo(pair.black!.idx)}
                      className={`text-[12px] font-mono px-2 py-0.5 rounded-lg transition-all ${
                        stepIndex === pair.black.idx ? activeMoveStyle : inactiveMoveStyle
                      }`}
                    >
                      {pair.black.san}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Rationale */}
          {rationale && (
            <div className={`p-3 border-t ${border}`}>
              <p className={`text-[10px] font-semibold uppercase tracking-widest mb-1.5 ${textTertiary}`}>
                Why this line?
              </p>
              <p className={`text-xs leading-relaxed ${textSecondary}`}>{rationale}</p>
            </div>
          )}

          {/* Keyboard hint */}
          <div className={`px-3 pb-2 flex items-center gap-2 ${textTertiary}`}>
            <kbd className={`text-[9px] px-1.5 py-0.5 rounded border font-mono ${isDark ? "border-white/10 bg-white/05" : "border-[#ADBC9F] bg-[#FBFADA]/70"}`}>←</kbd>
            <kbd className={`text-[9px] px-1.5 py-0.5 rounded border font-mono ${isDark ? "border-white/10 bg-white/05" : "border-[#ADBC9F] bg-[#FBFADA]/70"}`}>→</kbd>
            <span className="text-[10px]">navigate moves</span>
            {isFullscreen && (
              <>
                <span className="text-[10px] ml-2">·</span>
                <kbd className={`text-[9px] px-1.5 py-0.5 rounded border font-mono ml-1 ${isDark ? "border-white/10 bg-white/05" : "border-[#ADBC9F] bg-[#FBFADA]/70"}`}>Esc</kbd>
                <span className="text-[10px]">exit fullscreen</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ChessLineViewer({
  moves,
  lineName,
  rationale,
  eco,
  isDark,
}: ChessLineViewerProps) {
  const sanMoves = parseMoves(moves);
  const positions = buildPositions(sanMoves);
  const totalSteps = positions.length;

  const [stepIndex, setStepIndex] = useState(-1); // -1 = starting position
  const [boardFlipped, setBoardFlipped] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const moveListRef = useRef<HTMLDivElement>(null);
  const fullscreenRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  useAccessibleOverlay({
    open: isFullscreen,
    onClose: () => setIsFullscreen(false),
    containerRef: fullscreenRef,
    initialFocusRef: closeButtonRef,
  });

  const goTo = useCallback(
    (idx: number) => {
      const clamped = Math.max(-1, Math.min(totalSteps - 1, idx));
      setStepIndex(clamped);
    },
    [totalSteps]
  );

  // Preserve left/right move navigation. Escape is handled by the shared overlay.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goTo(stepIndex + 1);
      if (e.key === "ArrowLeft") goTo(stepIndex - 1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [stepIndex, goTo]);

  // Prevent body scroll when fullscreen is open
  useEffect(() => {
    if (isFullscreen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isFullscreen]);

  // Scroll active move into view
  useEffect(() => {
    if (!moveListRef.current) return;
    const active = moveListRef.current.querySelector("[data-active='true']");
    if (active) active.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [stepIndex]);

  // Design tokens (needed for outer wrappers)
  const bg = isDark ? "bg-[#0f1c11]" : "bg-white";
  const border = isDark ? "border-[#1e2e22]/70" : "border-[#ADBC9F]/80";

  // Group moves into pairs for the move list (White + Black per row)
  const movePairs: { moveNum: number; white: { san: string; idx: number } | null; black: { san: string; idx: number } | null }[] = [];
  for (let i = 0; i < positions.length; i += 2) {
    movePairs.push({
      moveNum: Math.floor(i / 2) + 1,
      white: positions[i] ? { san: positions[i].san, idx: i } : null,
      black: positions[i + 1] ? { san: positions[i + 1].san, idx: i + 1 } : null,
    });
  }

  const sharedProps = {
    positions,
    totalSteps,
    stepIndex,
    boardFlipped,
    isDark,
    goTo,
    setBoardFlipped,
    moveListRef,
    movePairs,
    rationale,
    lineName,
    eco,
  };

  if (totalSteps === 0) {
    const accentText = isDark ? "text-[#5B9A6A]" : "text-[#436850]";
    const textSecondary = isDark ? "text-white/55" : "text-[#436850]";
    return (
      <div className={`rounded-2xl border p-6 text-center ${bg} ${border}`}>
        <BookOpen className={`w-8 h-8 mx-auto mb-2 ${accentText}`} />
        <p className={`text-sm ${textSecondary}`}>No moves to display for this line.</p>
      </div>
    );
  }

  return (
    <>
      {/* Normal (compact) view */}
      <div className={`rounded-2xl border overflow-hidden ${bg} ${border}`}>
        <BoardView
          {...sharedProps}
          isFullscreen={false}
          onToggleFullscreen={() => setIsFullscreen(true)}
        />
      </div>

      {/* Fullscreen overlay */}
      {isFullscreen && (
        <div
          ref={fullscreenRef}
          role="dialog"
          aria-modal="true"
          aria-label={`${lineName} fullscreen chess line`}
          tabIndex={-1}
          className="fixed inset-0 z-50 flex items-stretch"
          style={{ background: isDark ? "rgba(5,12,7,0.97)" : "rgba(240,245,241,0.97)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setIsFullscreen(false); }}
        >
          {/* Close button (top-right corner) */}
          <button
            ref={closeButtonRef}
            onClick={() => setIsFullscreen(false)}
            aria-label="Exit fullscreen chess line"
            className={`absolute top-4 right-4 z-10 flex items-center justify-center w-9 h-9 rounded-xl border transition-all ${
              isDark
                ? "border-[#2e4a34]/60 text-white/60 hover:bg-[#162018] hover:text-white"
                : "border-[#ADBC9F] text-[#436850] hover:bg-[#ADBC9F]/50 hover:text-[#12372A]"
            }`}
            title="Exit fullscreen (Esc)"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Fullscreen board container */}
          <div className={`flex-1 flex flex-col rounded-none border-0 overflow-hidden ${bg}`}>
            <BoardView
              {...sharedProps}
              isFullscreen={true}
              onToggleFullscreen={() => setIsFullscreen(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}
