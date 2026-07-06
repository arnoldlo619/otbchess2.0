/**
 * MiniChessBoard — interactive SVG chessboard for InsightCard.
 *
 * Features:
 * - Renders a full 8×8 board from a FEN string (via chess.js)
 * - Unicode piece glyphs (no image dependencies)
 * - Step forward/back through a SAN move list
 * - Auto-play: plays through the line automatically at configurable speed
 * - Speed selector: Slow (1.5s), Normal (0.9s), Fast (0.4s)
 * - Loop toggle: restarts from the beginning when the line ends
 * - Flip board orientation
 * - Highlights the last-moved squares (from/to)
 * - Highlights the deviation square when ply is provided
 * - Keyboard accessible (←/→ arrows, Space to play/pause when focused)
 * - Works in both dark and light mode
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { Chess } from "chess.js";
import {
  ChevronLeft, ChevronRight, RotateCcw, FlipVertical2,
  Play, Pause, Repeat,
} from "lucide-react";

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

type Speed = "slow" | "normal" | "fast";

const SPEED_MS: Record<Speed, number> = {
  slow: 1500,
  normal: 900,
  fast: 400,
};

const SPEED_LABELS: Record<Speed, string> = {
  slow: "0.7×",
  normal: "1×",
  fast: "2×",
};

const SPEED_ORDER: Speed[] = ["slow", "normal", "fast"];

// ── Piece glyphs ──────────────────────────────────────────────────────────────

const PIECE_GLYPHS: Record<string, string> = {
  wK: "♔", wQ: "♕", wR: "♖", wB: "♗", wN: "♘", wP: "♙",
  bK: "♚", bQ: "♛", bR: "♜", bB: "♝", bN: "♞", bP: "♟",
};

// ── Parse SAN tokens from a line string ───────────────────────────────────────

function parseSanTokens(sanLine: string): string[] {
  return sanLine
    .trim()
    .split(/\s+/)
    .filter(t => t && !/^\d+\./.test(t) && t !== "*");
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
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>("normal");
  const [loop, setLoop] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // Reset to end of line when sanLine changes, stop playback
  useEffect(() => {
    setIsPlaying(false);
    setMoveIndex(parseSanTokens(sanLine).length);
  }, [sanLine]);

  // Auto-play interval
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!isPlaying) return;

    intervalRef.current = setInterval(() => {
      setMoveIndex(prev => {
        if (prev >= tokens.length) {
          if (loop) {
            // Restart from beginning
            return 0;
          } else {
            setIsPlaying(false);
            return prev;
          }
        }
        return prev + 1;
      });
    }, SPEED_MS[speed]);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying, speed, loop, tokens.length]);

  // Stop playback when we reach the end (non-loop mode)
  useEffect(() => {
    if (moveIndex >= tokens.length && isPlaying && !loop) {
      setIsPlaying(false);
    }
  }, [moveIndex, tokens.length, isPlaying, loop]);

  // Start auto-play from beginning if we're at the end and press play
  const handlePlayPause = useCallback(() => {
    setIsPlaying(prev => {
      if (!prev && moveIndex >= tokens.length) {
        // Reset to start before playing
        setMoveIndex(0);
      }
      return !prev;
    });
  }, [moveIndex, tokens.length]);

  // Cycle through speeds
  const handleSpeedCycle = useCallback(() => {
    setSpeed(s => {
      const idx = SPEED_ORDER.indexOf(s);
      return SPEED_ORDER[(idx + 1) % SPEED_ORDER.length];
    });
  }, []);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      setIsPlaying(false);
      setMoveIndex(i => Math.max(0, i - 1));
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      setIsPlaying(false);
      setMoveIndex(i => Math.min(tokens.length, i + 1));
    }
    if (e.key === " ") {
      e.preventDefault();
      handlePlayPause();
    }
  }, [tokens.length, handlePlayPause]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const board = chess.board();
  const CELL = 32;
  const SIZE = CELL * 8;

  // Deviation square highlight
  let deviationSquare: string | null = null;
  if (deviationPly !== undefined && lastMove && moveIndex === deviationPly + 1) {
    deviationSquare = lastMove.to;
  }

  // ── Color theme ───────────────────────────────────────────────────────────
  const bg = isDark ? "bg-[#0f1c11]" : "bg-white";
  const border = isDark ? "border-[#243028]/70" : "border-[#ADBC9F]/60";
  const textMuted = isDark ? "text-white/30" : "text-[#436850]/50";

  const btnBase = `rounded-lg p-1 transition-colors ${
    isDark
      ? "hover:bg-white/08 text-white/50 hover:text-white/80 disabled:opacity-25"
      : "hover:bg-[#ADBC9F]/30 text-[#436850]/60 hover:text-[#436850] disabled:opacity-25"
  }`;

  const accentBtn = isDark
    ? "bg-[#436850]/20 text-[#5B9A6A]"
    : "bg-[#436850]/10 text-[#436850]";

  const playBtnCls = isPlaying
    ? isDark
      ? "bg-[#436850]/30 text-[#5B9A6A] border border-[#436850]/50 rounded-lg p-1 transition-colors hover:bg-[#436850]/40"
      : "bg-[#436850]/15 text-[#436850] border border-[#436850]/30 rounded-lg p-1 transition-colors hover:bg-[#436850]/25"
    : isDark
      ? "bg-[#436850]/15 text-[#5B9A6A] border border-[#436850]/30 rounded-lg p-1 transition-colors hover:bg-[#436850]/25"
      : "bg-[#436850]/08 text-[#436850] border border-[#436850]/20 rounded-lg p-1 transition-colors hover:bg-[#436850]/15";

  const loopBtnCls = loop
    ? isDark
      ? "rounded-lg p-1 transition-colors bg-[#436850]/20 text-[#5B9A6A]"
      : "rounded-lg p-1 transition-colors bg-[#436850]/12 text-[#436850]"
    : btnBase;

  const speedBtnCls = `text-[9px] font-bold font-mono px-1.5 py-0.5 rounded-md border transition-colors ${
    isDark
      ? "border-[#243028] text-white/40 hover:text-white/70 hover:border-[#436850]/50"
      : "border-[#ADBC9F]/60 text-[#436850]/50 hover:text-[#436850] hover:border-[#436850]/40"
  }`;

  // Progress bar fill %
  const progress = tokens.length > 0 ? (moveIndex / tokens.length) * 100 : 0;

  return (
    <div
      className={`rounded-xl border overflow-hidden ${bg} ${border}`}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="application"
      aria-label={`Chessboard showing opening line: ${sanLine}`}
      ref={boardRef}
    >
      {/* ── Board ─────────────────────────────────────────────────────────── */}
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
              const boardRow = flipped ? 7 - row : row;
              const boardCol = flipped ? 7 - col : col;
              const sq = String.fromCharCode(97 + boardCol) + (8 - boardRow);

              const isLastFrom = lastMove?.from === sq;
              const isLastTo = lastMove?.to === sq;
              const isDeviation = deviationSquare === sq;

              let fill = cellColor(col, row, isDark);
              if (isDeviation)  fill = isDark ? "#7c3aed" : "#a78bfa";
              else if (isLastTo)   fill = isDark ? "#436850" : "#cdd26a";
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

          {/* Rank labels */}
          {Array.from({ length: 8 }, (_, i) => {
            const rank = flipped ? i + 1 : 8 - i;
            return (
              <text key={`rank-${i}`} x={2} y={i * CELL + 9} fontSize={8}
                fill={isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.25)"}
                style={{ userSelect: "none" }}>{rank}</text>
            );
          })}

          {/* File labels */}
          {Array.from({ length: 8 }, (_, i) => {
            const file = String.fromCharCode(flipped ? 104 - i : 97 + i);
            return (
              <text key={`file-${i}`} x={i * CELL + CELL - 7} y={SIZE - 2} fontSize={8}
                fill={isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.25)"}
                style={{ userSelect: "none" }}>{file}</text>
            );
          })}
        </svg>

        {/* Error overlay */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <span className="text-xs text-red-400 font-mono">Invalid line</span>
          </div>
        )}

        {/* Playing indicator pulse on board corner */}
        {isPlaying && (
          <div className="absolute top-1.5 right-1.5 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#5B9A6A] animate-pulse" />
          </div>
        )}
      </div>

      {/* ── Progress bar ──────────────────────────────────────────────────── */}
      <div
        className={`h-0.5 transition-all duration-300 ${isDark ? "bg-[#436850]/60" : "bg-[#436850]/50"}`}
        style={{ width: `${progress}%` }}
        role="progressbar"
        aria-valuenow={moveIndex}
        aria-valuemin={0}
        aria-valuemax={tokens.length}
        aria-label="Playback progress"
      />

      {/* ── Controls bar ──────────────────────────────────────────────────── */}
      <div className={`flex items-center gap-1 px-2 py-1.5 border-t ${border}`}>
        {/* Move label */}
        <span className={`text-[10px] font-mono flex-1 truncate ${textMuted}`}>
          {moveIndex === 0
            ? "Start"
            : moveIndex === tokens.length
              ? tokens.length > 0 ? tokens[tokens.length - 1] : "—"
              : tokens[moveIndex - 1]}{" "}
          <span className="opacity-50">({moveIndex}/{tokens.length})</span>
        </span>

        {/* Reset to start */}
        <button
          onClick={() => { setIsPlaying(false); setMoveIndex(0); }}
          className={btnBase}
          aria-label="Go to start"
          title="Reset"
          disabled={moveIndex === 0 && !isPlaying}
        >
          <RotateCcw className="w-3 h-3" />
        </button>

        {/* Step back */}
        <button
          onClick={() => { setIsPlaying(false); setMoveIndex(i => Math.max(0, i - 1)); }}
          className={btnBase}
          aria-label="Previous move"
          title="← Previous"
          disabled={moveIndex === 0}
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        {/* ── Play / Pause ── */}
        <button
          onClick={handlePlayPause}
          className={playBtnCls}
          aria-label={isPlaying ? "Pause auto-play" : "Start auto-play"}
          title={isPlaying ? "Pause (Space)" : "Play (Space)"}
        >
          {isPlaying
            ? <Pause className="w-3.5 h-3.5" />
            : <Play  className="w-3.5 h-3.5" />
          }
        </button>

        {/* Step forward */}
        <button
          onClick={() => { setIsPlaying(false); setMoveIndex(i => Math.min(tokens.length, i + 1)); }}
          className={`${btnBase} ${moveIndex < tokens.length && !isPlaying ? accentBtn : ""}`}
          aria-label="Next move"
          title="→ Next"
          disabled={moveIndex === tokens.length}
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>

        {/* Speed cycle */}
        <button
          onClick={handleSpeedCycle}
          className={speedBtnCls}
          aria-label={`Playback speed: ${SPEED_LABELS[speed]}, click to change`}
          title="Cycle speed"
        >
          {SPEED_LABELS[speed]}
        </button>

        {/* Loop toggle */}
        <button
          onClick={() => setLoop(l => !l)}
          className={loopBtnCls}
          aria-label={loop ? "Loop on — click to disable" : "Loop off — click to enable"}
          aria-pressed={loop}
          title="Loop"
        >
          <Repeat className="w-3 h-3" />
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
        Space to play/pause · ← → to step
      </p>
    </div>
  );
}
