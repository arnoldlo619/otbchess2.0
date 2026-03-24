/**
 * MoveListPanel
 *
 * Compact scrolling move list for Live Notation Mode. Displays moves in
 * standard two-column notation format (move number, white SAN, black SAN).
 * Auto-scrolls to the latest move. Highlights the last move played.
 */

import { useRef, useEffect } from "react";
import type { NotationMove } from "../hooks/useNotationMode";

interface MoveListPanelProps {
  moves: NotationMove[];
  openingName: string | null;
  moveCount: number;
}

export default function MoveListPanel({ moves, openingName, moveCount }: MoveListPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new moves
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [moves.length]);

  // Group moves into pairs (white, black)
  const pairs: { num: number; white: string; black: string | null }[] = [];
  for (let i = 0; i < moves.length; i += 2) {
    pairs.push({
      num: Math.floor(i / 2) + 1,
      white: moves[i].san,
      black: moves[i + 1]?.san ?? null,
    });
  }

  const lastMoveIdx = moves.length - 1;

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
        {pairs.map((pair, idx) => {
          const whiteIdx = idx * 2;
          const blackIdx = idx * 2 + 1;
          return (
            <div
              key={pair.num}
              className="flex items-center gap-1 py-[3px] text-xs font-mono"
            >
              {/* Move number */}
              <span className="w-6 text-right text-white/25 text-[10px] shrink-0">
                {pair.num}.
              </span>
              {/* White move */}
              <span
                className={`flex-1 px-1.5 py-0.5 rounded ${
                  whiteIdx === lastMoveIdx
                    ? "bg-[#4ade80]/15 text-[#4ade80] font-semibold"
                    : "text-white/70"
                }`}
              >
                {pair.white}
              </span>
              {/* Black move */}
              {pair.black !== null ? (
                <span
                  className={`flex-1 px-1.5 py-0.5 rounded ${
                    blackIdx === lastMoveIdx
                      ? "bg-[#4ade80]/15 text-[#4ade80] font-semibold"
                      : "text-white/70"
                  }`}
                >
                  {pair.black}
                </span>
              ) : (
                <span className="flex-1 px-1.5 py-0.5 text-white/10">...</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
