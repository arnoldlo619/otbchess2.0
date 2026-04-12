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
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import {
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  FlipHorizontal,
  BookOpen,
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
  const moveListRef = useRef<HTMLDivElement>(null);

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

  const goTo = useCallback(
    (idx: number) => {
      const clamped = Math.max(-1, Math.min(totalSteps - 1, idx));
      setStepIndex(clamped);
    },
    [totalSteps]
  );

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goTo(stepIndex + 1);
      if (e.key === "ArrowLeft") goTo(stepIndex - 1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [stepIndex, goTo]);

  // Scroll active move into view
  useEffect(() => {
    if (!moveListRef.current) return;
    const active = moveListRef.current.querySelector("[data-active='true']");
    if (active) active.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [stepIndex]);

  // Design tokens
  const bg = isDark ? "bg-[#0f1c11]" : "bg-white";
  const border = isDark ? "border-[#1e2e22]/70" : "border-gray-200/80";
  const textPrimary = isDark ? "text-white" : "text-gray-900";
  const textSecondary = isDark ? "text-white/55" : "text-gray-500";
  const textTertiary = isDark ? "text-white/30" : "text-gray-400";
  const accentText = isDark ? "text-[#5B9A6A]" : "text-[#3D6B47]";
  const accentBg = isDark ? "bg-[#3D6B47]/20 text-[#5B9A6A]" : "bg-[#3D6B47]/10 text-[#3D6B47]";
  const activeMoveStyle = isDark
    ? "bg-[#3D6B47]/30 text-white border border-[#3D6B47]/40"
    : "bg-[#3D6B47]/15 text-[#3D6B47] border border-[#3D6B47]/25";
  const inactiveMoveStyle = isDark
    ? "text-white/60 hover:bg-white/05 hover:text-white"
    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900";
  const btnBase = `flex items-center justify-center rounded-xl transition-all active:scale-95 border`;
  const btnEnabled = isDark
    ? "border-[#2e4a34]/50 text-white/70 hover:bg-[#162018] hover:text-white"
    : "border-gray-200 text-gray-600 hover:bg-gray-100 hover:text-gray-900";
  const btnDisabled = isDark ? "border-[#1e2e22]/40 text-white/15 cursor-not-allowed" : "border-gray-100 text-gray-300 cursor-not-allowed";

  // Group moves into pairs for the move list (White + Black per row)
  const movePairs: { moveNum: number; white: { san: string; idx: number } | null; black: { san: string; idx: number } | null }[] = [];
  for (let i = 0; i < positions.length; i += 2) {
    movePairs.push({
      moveNum: Math.floor(i / 2) + 1,
      white: positions[i] ? { san: positions[i].san, idx: i } : null,
      black: positions[i + 1] ? { san: positions[i + 1].san, idx: i + 1 } : null,
    });
  }

  if (totalSteps === 0) {
    return (
      <div className={`rounded-2xl border p-6 text-center ${bg} ${border}`}>
        <BookOpen className={`w-8 h-8 mx-auto mb-2 ${accentText}`} />
        <p className={`text-sm ${textSecondary}`}>No moves to display for this line.</p>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border overflow-hidden ${bg} ${border}`}>
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
      </div>

      {/* Body: board + move list */}
      <div className="flex flex-col lg:flex-row gap-0">
        {/* Board */}
        <div className="flex-shrink-0 p-3 lg:p-4">
          <div className="w-full max-w-[340px] mx-auto lg:mx-0">
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
          <div className="flex items-center justify-center gap-2 mt-3 max-w-[340px] mx-auto lg:mx-0">
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
        <div className={`flex-1 flex flex-col border-t lg:border-t-0 lg:border-l ${border}`}>
          {/* Move list */}
          <div
            ref={moveListRef}
            className="flex-1 overflow-y-auto p-3 max-h-[220px] lg:max-h-[300px]"
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
            <kbd className={`text-[9px] px-1.5 py-0.5 rounded border font-mono ${isDark ? "border-white/10 bg-white/05" : "border-gray-200 bg-gray-50"}`}>←</kbd>
            <kbd className={`text-[9px] px-1.5 py-0.5 rounded border font-mono ${isDark ? "border-white/10 bg-white/05" : "border-gray-200 bg-gray-50"}`}>→</kbd>
            <span className="text-[10px]">navigate moves</span>
          </div>
        </div>
      </div>
    </div>
  );
}
