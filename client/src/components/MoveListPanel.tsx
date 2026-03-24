/**
 * MoveListPanel
 *
 * Compact scrolling move list for Live Notation Mode. Displays moves in
 * standard two-column notation format (move number, white SAN, black SAN).
 * Auto-scrolls to the latest move. Highlights the last move played.
 *
 * Tap-to-correct: tapping any move (except the last) stages a jump-back.
 * A confirmation banner appears showing how many moves will be discarded.
 * The user confirms or cancels before history is truncated.
 */

import { useRef, useEffect } from "react";
import { RotateCcw, AlertTriangle, Check, X } from "lucide-react";
import type { NotationMove } from "../hooks/useNotationMode";

interface MoveListPanelProps {
  moves: NotationMove[];
  openingName: string | null;
  moveCount: number;
  /** Index of the move currently staged for correction (-1 = none) */
  pendingJump: number;
  /** Called when the user taps a move to stage a correction */
  onJumpToMove: (index: number) => void;
  /** Confirm the staged jump (truncates history) */
  onConfirmJump: () => void;
  /** Cancel the staged jump */
  onCancelJump: () => void;
}

export default function MoveListPanel({
  moves,
  openingName,
  moveCount,
  pendingJump,
  onJumpToMove,
  onConfirmJump,
  onCancelJump,
}: MoveListPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new moves (only when no jump is pending)
  useEffect(() => {
    if (pendingJump !== -1) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [moves.length, pendingJump]);

  // Scroll the pending jump row into view
  useEffect(() => {
    if (pendingJump === -1) return;
    const el = scrollRef.current;
    if (!el) return;
    const pairIdx = Math.floor(pendingJump / 2);
    const row = el.querySelectorAll<HTMLElement>("[data-pair-idx]")[pairIdx];
    if (row) row.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [pendingJump]);

  // Group moves into pairs (white, black)
  const pairs: { num: number; white: string; black: string | null; whiteIdx: number; blackIdx: number }[] = [];
  for (let i = 0; i < moves.length; i += 2) {
    pairs.push({
      num: Math.floor(i / 2) + 1,
      white: moves[i].san,
      black: moves[i + 1]?.san ?? null,
      whiteIdx: i,
      blackIdx: i + 1,
    });
  }

  const lastMoveIdx = moves.length - 1;
  const movesAfterJump = pendingJump >= 0 ? moves.length - pendingJump - 1 : 0;

  // Helper: determine the visual state of a move cell
  function cellClass(idx: number): string {
    const isLast = idx === lastMoveIdx;
    const isPendingTarget = idx === pendingJump;
    const isWillBeDiscarded = pendingJump >= 0 && idx > pendingJump;
    const isTappable = idx < lastMoveIdx; // last move cannot be jumped to

    if (isPendingTarget) {
      return "bg-amber-500/20 text-amber-300 font-semibold ring-1 ring-amber-400/40 rounded cursor-pointer";
    }
    if (isWillBeDiscarded) {
      return "text-white/20 line-through cursor-pointer";
    }
    if (isLast && pendingJump === -1) {
      return "bg-[#4ade80]/15 text-[#4ade80] font-semibold rounded";
    }
    if (isTappable) {
      return "text-white/70 hover:bg-white/5 hover:text-white/90 rounded cursor-pointer transition-colors";
    }
    return "text-white/70";
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#4ade80] animate-pulse" />
          <span className="text-white/50 text-[10px] font-medium tracking-wider uppercase">
            Notation
          </span>
        </div>
        <span className="text-white/30 text-[10px] font-mono">
          {moveCount > 0 ? `${moveCount} move${moveCount !== 1 ? "s" : ""}` : ""}
        </span>
      </div>

      {/* Opening name */}
      {openingName && (
        <div className="px-3 py-1.5 border-b border-white/5">
          <p className="text-[#4ade80]/70 text-[10px] font-medium truncate">{openingName}</p>
        </div>
      )}

      {/* Correction confirmation banner */}
      {pendingJump >= 0 && (
        <div className="mx-2 mt-2 mb-1 rounded-lg bg-amber-500/10 border border-amber-400/25 px-3 py-2">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-amber-300 text-[11px] font-semibold leading-tight">
                Correct from move {Math.floor(pendingJump / 2) + 1}
                {pendingJump % 2 === 0 ? "w" : "b"}?
              </p>
              <p className="text-amber-200/50 text-[10px] mt-0.5 leading-tight">
                {movesAfterJump} move{movesAfterJump !== 1 ? "s" : ""} will be discarded.
              </p>
            </div>
          </div>
          <div className="flex gap-2 mt-2">
            <button
              onClick={onConfirmJump}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[11px] font-semibold transition-colors"
              aria-label="Confirm correction"
            >
              <Check className="w-3 h-3" />
              Correct
            </button>
            <button
              onClick={onCancelJump}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md bg-white/5 hover:bg-white/10 text-white/50 text-[11px] transition-colors"
              aria-label="Cancel correction"
            >
              <X className="w-3 h-3" />
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Tap-to-correct hint (shown only when no jump is pending and there are moves) */}
      {pendingJump === -1 && moves.length > 1 && (
        <div className="flex items-center gap-1.5 px-3 py-1 border-b border-white/5">
          <RotateCcw className="w-2.5 h-2.5 text-white/20 shrink-0" />
          <p className="text-white/20 text-[9px]">Tap a move to correct from that point</p>
        </div>
      )}

      {/* Move list */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-2 py-1.5 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
      >
        {pairs.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-white/20 text-xs">Waiting for first move...</p>
          </div>
        )}
        {pairs.map((pair, idx) => (
          <div
            key={pair.num}
            data-pair-idx={idx}
            className="flex items-center gap-1 py-[3px] text-xs font-mono"
          >
            {/* Move number */}
            <span className="w-6 text-right text-white/25 text-[10px] shrink-0">
              {pair.num}.
            </span>

            {/* White move */}
            <span
              className={`flex-1 px-1.5 py-0.5 ${cellClass(pair.whiteIdx)}`}
              onClick={() => {
                if (pair.whiteIdx < lastMoveIdx) onJumpToMove(pair.whiteIdx);
              }}
              role={pair.whiteIdx < lastMoveIdx ? "button" : undefined}
              aria-label={
                pair.whiteIdx < lastMoveIdx
                  ? `Correct from move ${pair.num} white (${pair.white})`
                  : undefined
              }
            >
              {pair.white}
            </span>

            {/* Black move */}
            {pair.black !== null ? (
              <span
                className={`flex-1 px-1.5 py-0.5 ${cellClass(pair.blackIdx)}`}
                onClick={() => {
                  if (pair.blackIdx < lastMoveIdx) onJumpToMove(pair.blackIdx);
                }}
                role={pair.blackIdx < lastMoveIdx ? "button" : undefined}
                aria-label={
                  pair.blackIdx < lastMoveIdx
                    ? `Correct from move ${pair.num} black (${pair.black})`
                    : undefined
                }
              >
                {pair.black}
              </span>
            ) : (
              <span className="flex-1 px-1.5 py-0.5 text-white/10">...</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
