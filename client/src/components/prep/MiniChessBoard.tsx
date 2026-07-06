/**
 * MiniChessBoard — interactive SVG chessboard for InsightCard.
 *
 * Features:
 * - Renders a full 8×8 board from a FEN string (via chess.js)
 * - Unicode piece glyphs (no image dependencies)
 * - Step forward/back through a SAN move list
 * - Flip board orientation
 * - Highlights the last-moved squares (from/to)
 * - Highlights the deviation square when ply is provided
 * - Keyboard accessible (←/→ arrows when focused)
 * - Works in both dark and light mode
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { Chess } from "chess.js";
import { ChevronLeft, ChevronRight, RotateCcw, FlipVertical2 } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface MiniChessBoardProps {
  /** Space-separated SAN string, e.g. "e4 e5 Nf3 Nc6 Bb5" */
  sanLine: string;
  /** Optional deviation ply (0-indexed) to highlight */
  deviationPly?: number;
  /** Scouted player's color — determines default orientation */
  playerColor?: "white" | "black";
  isDark: boolean;
}

// ── Piece glyphs ──────────────────────────────────────────────────────────────

const PIECE_GLYPHS: Record<string, string> = {
  wK: "♔", wQ: "♕", wR: "♖", wB: "♗", wN: "♘", wP: "♙",
  bK: "♚", bQ: "♛", bR: "♜", bB: "♝", bN: "♞", bP: "♟",
};

// ── Square helpers ─────────────────────────────────────────────────────────────

function squareToCoords(sq: string, flipped: boolean): { col: number; row: number } {
  const col = sq.charCodeAt(0) - 97; // a=0 … h=7
  const row = 8 - parseInt(sq[1], 10); // rank 8=0 … rank 1=7
  return flipped
    ? { col: 7 - col, row: 7 - row }
    : { col, row };
}

// ── Parse SAN tokens from a line string ───────────────────────────────────────

function parseSanTokens(sanLine: string): string[] {
  return sanLine
    .trim()
    .split(/\s+/)
    .filter(t => t && !/^\d+\./.test(t) && t !== "*"); // strip move numbers
}

// ── Board cell colors ─────────────────────────────────────────────────────────

function cellColor(col: number, row: number, isDark: boolean): string {
  const isLight = (col + row) % 2 === 0;
  if (isDark) return isLight ? "#2a3d2e" : "#1a2a1e";
  return isLight ? "#f0d9b5" : "#b58863";
}

// ── Main component ─────────────────────────────────────────────────────────────

export function MiniChessBoard({
  sanLine,
  deviationPly,
  playerColor = "white",
  isDark,
}: MiniChessBoardProps) {
  const tokens = parseSanTokens(sanLine);
  const [moveIndex, setMoveIndex] = useState(tokens.length); // start at end of line
  const [flipped, setFlipped] = useState(playerColor === "black");
  const boardRef = useRef<HTMLDivElement>(null);

  // Build Chess instance up to moveIndex
  const { chess, lastMove, error } = useCallback(() => {
    const c = new Chess();
    let lastMove: { from: string; to: string } | null = null;
    let error = false;
    for (let i = 0; i < moveIndex; i++) {
      try {
        const result = c.move(tokens[i]);
        if (result) lastMove = { from: result.from, to: result.to };
      } catch {
        error = true;
        break;
      }
    }
    return { chess: c, lastMove, error };
  }, [moveIndex, tokens.join(" ")])(); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset to end of line when sanLine changes
  useEffect(() => {
    setMoveIndex(parseSanTokens(sanLine).length);
  }, [sanLine]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") { e.preventDefault(); setMoveIndex(i => Math.max(0, i - 1)); }
    if (e.key === "ArrowRight") { e.preventDefault(); setMoveIndex(i => Math.min(tokens.length, i + 1)); }
  }, [tokens.length]);

  const board = chess.board(); // 8×8 array [row][col], row 0 = rank 8
  const CELL = 32; // px per cell
  const SIZE = CELL * 8;

  // Determine deviation square (if ply provided)
  let deviationSquare: string | null = null;
  if (deviationPly !== undefined && lastMove && moveIndex === deviationPly + 1) {
    deviationSquare = lastMove.to;
  }

  // Color theme
  const bg = isDark ? "bg-[#0f1c11]" : "bg-white";
  const border = isDark ? "border-[#243028]/70" : "border-[#ADBC9F]/60";
  const textMuted = isDark ? "text-white/30" : "text-[#436850]/50";
  const btnBase = `rounded-lg p-1 transition-colors ${isDark ? "hover:bg-white/08 text-white/50 hover:text-white/80" : "hover:bg-[#ADBC9F]/30 text-[#436850]/60 hover:text-[#436850]"}`;
  const accentBtn = isDark ? "bg-[#436850]/20 text-[#5B9A6A]" : "bg-[#436850]/10 text-[#436850]";

  return (
    <div
      className={`rounded-xl border overflow-hidden ${bg} ${border}`}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="application"
      aria-label={`Chessboard showing opening line: ${sanLine}`}
      ref={boardRef}
    >
      {/* Board */}
      <div className="relative select-none" style={{ width: SIZE, height: SIZE }}>
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          aria-hidden="true"
        >
          {/* Squares */}
          {Array.from({ length: 8 }, (_, row) =>
            Array.from({ length: 8 }, (_, col) => {
              // Map display (row,col) → board array index
              const boardRow = flipped ? 7 - row : row;
              const boardCol = flipped ? 7 - col : col;
              const sq = String.fromCharCode(97 + boardCol) + (8 - boardRow);

              const isLastFrom = lastMove?.from === sq;
              const isLastTo = lastMove?.to === sq;
              const isDeviation = deviationSquare === sq;

              let fill = cellColor(col, row, isDark);
              if (isDeviation) fill = isDark ? "#7c3aed" : "#a78bfa"; // purple for deviation
              else if (isLastTo) fill = isDark ? "#436850" : "#cdd26a";
              else if (isLastFrom) fill = isDark ? "#2e5038" : "#aaa23a";

              return (
                <rect
                  key={`${row}-${col}`}
                  x={col * CELL}
                  y={row * CELL}
                  width={CELL}
                  height={CELL}
                  fill={fill}
                />
              );
            })
          )}

          {/* Pieces */}
          {board.map((rowArr, boardRow) =>
            rowArr.map((piece, boardCol) => {
              if (!piece) return null;
              const glyph = PIECE_GLYPHS[`${piece.color}${piece.type.toUpperCase()}`];
              if (!glyph) return null;

              // Convert board array position → display position
              const displayRow = flipped ? 7 - boardRow : boardRow;
              const displayCol = flipped ? 7 - boardCol : boardCol;

              const x = displayCol * CELL + CELL / 2;
              const y = displayRow * CELL + CELL / 2 + 1;

              return (
                <text
                  key={`${boardRow}-${boardCol}`}
                  x={x}
                  y={y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={CELL * 0.72}
                  style={{
                    filter: piece.color === "w"
                      ? "drop-shadow(0 1px 1px rgba(0,0,0,0.6))"
                      : "drop-shadow(0 1px 1px rgba(0,0,0,0.4))",
                    userSelect: "none",
                  }}
                >
                  {glyph}
                </text>
              );
            })
          )}

          {/* Rank labels (left edge) */}
          {Array.from({ length: 8 }, (_, i) => {
            const rank = flipped ? i + 1 : 8 - i;
            return (
              <text
                key={`rank-${i}`}
                x={2}
                y={i * CELL + 9}
                fontSize={8}
                fill={isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.25)"}
                style={{ userSelect: "none" }}
              >
                {rank}
              </text>
            );
          })}

          {/* File labels (bottom edge) */}
          {Array.from({ length: 8 }, (_, i) => {
            const file = String.fromCharCode(flipped ? 104 - i : 97 + i);
            return (
              <text
                key={`file-${i}`}
                x={i * CELL + CELL - 7}
                y={SIZE - 2}
                fontSize={8}
                fill={isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.25)"}
                style={{ userSelect: "none" }}
              >
                {file}
              </text>
            );
          })}
        </svg>

        {/* Error overlay */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <span className="text-xs text-red-400 font-mono">Invalid line</span>
          </div>
        )}
      </div>

      {/* Controls bar */}
      <div className={`flex items-center gap-1 px-2 py-1.5 border-t ${border}`}>
        {/* Move counter */}
        <span className={`text-[10px] font-mono flex-1 ${textMuted}`}>
          {moveIndex === 0
            ? "Start"
            : moveIndex === tokens.length
            ? tokens.length > 0 ? tokens[tokens.length - 1] : "—"
            : tokens[moveIndex - 1]}{" "}
          <span className="opacity-50">({moveIndex}/{tokens.length})</span>
        </span>

        {/* Reset to start */}
        <button
          onClick={() => setMoveIndex(0)}
          className={btnBase}
          aria-label="Go to start"
          title="Start"
          disabled={moveIndex === 0}
        >
          <RotateCcw className="w-3 h-3" />
        </button>

        {/* Step back */}
        <button
          onClick={() => setMoveIndex(i => Math.max(0, i - 1))}
          className={btnBase}
          aria-label="Previous move"
          title="← Previous"
          disabled={moveIndex === 0}
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        {/* Step forward */}
        <button
          onClick={() => setMoveIndex(i => Math.min(tokens.length, i + 1))}
          className={`${btnBase} ${moveIndex < tokens.length ? accentBtn : ""}`}
          aria-label="Next move"
          title="→ Next"
          disabled={moveIndex === tokens.length}
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>

        {/* Flip board */}
        <button
          onClick={() => setFlipped(f => !f)}
          className={btnBase}
          aria-label="Flip board"
          title="Flip"
        >
          <FlipVertical2 className="w-3 h-3" />
        </button>
      </div>

      {/* Keyboard hint */}
      <p className={`text-center text-[9px] pb-1 ${textMuted}`} aria-hidden="true">
        ← → to step through moves
      </p>
    </div>
  );
}
