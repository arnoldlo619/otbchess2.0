/**
 * LiveNotationBoard
 *
 * Interactive chessboard for Live Notation Mode. Players tap source then
 * destination squares to record moves. The board auto-flips based on whose
 * turn it is, using a smooth CSS 3D rotation so the handoff between players
 * is visually intuitive.
 *
 * Props are driven entirely by the useNotationMode hook.
 */

import { useRef, useEffect, useState } from "react";
import { Chessboard } from "react-chessboard";
import type { Square } from "chess.js";

// ─── Types ───────────────────────────────────────────────────────────────────

interface LiveNotationBoardProps {
  fen: string;
  orientation: "white" | "black";
  selectedSquare: Square | null;
  legalDestinations: Square[];
  lastMove: { from: string; to: string } | null;
  isGameOver: boolean;
  illegalAttempt: boolean;
  onSquareTap: (square: Square) => void;
  onClearIllegal: () => void;
  pendingPromotion: { from: Square; to: Square } | null;
  onConfirmPromotion: (piece: "q" | "r" | "b" | "n") => void;
  onCancelPromotion: () => void;
  turn: "w" | "b";
}

// ─── Square highlight styles ─────────────────────────────────────────────────

function buildCustomSquareStyles(
  selected: Square | null,
  legalDests: Square[],
  lastMove: { from: string; to: string } | null,
  illegalAttempt: boolean
): Record<string, React.CSSProperties> {
  const styles: Record<string, React.CSSProperties> = {};

  // Last move highlight
  if (lastMove) {
    styles[lastMove.from] = { backgroundColor: "rgba(74, 222, 128, 0.25)" };
    styles[lastMove.to] = { backgroundColor: "rgba(74, 222, 128, 0.35)" };
  }

  // Selected square
  if (selected) {
    styles[selected] = {
      backgroundColor: illegalAttempt
        ? "rgba(239, 68, 68, 0.5)"
        : "rgba(74, 222, 128, 0.55)",
      boxShadow: illegalAttempt
        ? "inset 0 0 0 3px rgba(239, 68, 68, 0.8)"
        : "inset 0 0 0 3px rgba(74, 222, 128, 0.8)",
    };
  }

  // Legal destination dots
  for (const sq of legalDests) {
    styles[sq] = {
      ...styles[sq],
      background: `${styles[sq]?.backgroundColor ?? "transparent"} radial-gradient(circle, rgba(74,222,128,0.6) 24%, transparent 25%)`,
      cursor: "pointer",
    };
  }

  return styles;
}

// ─── Promotion Picker ────────────────────────────────────────────────────────

function PromotionPicker({
  color,
  onSelect,
  onCancel,
}: {
  color: "w" | "b";
  onSelect: (piece: "q" | "r" | "b" | "n") => void;
  onCancel: () => void;
}) {
  const pieces: { piece: "q" | "r" | "b" | "n"; label: string; symbol: string }[] = [
    { piece: "q", label: "Queen", symbol: color === "w" ? "♕" : "♛" },
    { piece: "r", label: "Rook", symbol: color === "w" ? "♖" : "♜" },
    { piece: "b", label: "Bishop", symbol: color === "w" ? "♗" : "♝" },
    { piece: "n", label: "Knight", symbol: color === "w" ? "♘" : "♞" },
  ];

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 rounded-xl backdrop-blur-sm">
      <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl p-4 flex flex-col gap-3 items-center">
        <p className="text-white/70 text-xs font-medium tracking-wide uppercase">Promote to</p>
        <div className="flex gap-2">
          {pieces.map(({ piece, label, symbol }) => (
            <button
              key={piece}
              onClick={() => onSelect(piece)}
              className="w-14 h-14 rounded-xl bg-white/10 hover:bg-[#4ade80]/20 border border-white/10 hover:border-[#4ade80]/40 flex items-center justify-center text-3xl transition-all duration-150 active:scale-95"
              title={label}
            >
              {symbol}
            </button>
          ))}
        </div>
        <button
          onClick={onCancel}
          className="text-white/40 hover:text-white/70 text-xs transition-colors mt-1"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function LiveNotationBoard({
  fen,
  orientation,
  selectedSquare,
  legalDestinations,
  lastMove,
  isGameOver,
  illegalAttempt,
  onSquareTap,
  onClearIllegal,
  pendingPromotion,
  onConfirmPromotion,
  onCancelPromotion,
  turn,
}: LiveNotationBoardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [prevOrientation, setPrevOrientation] = useState(orientation);
  const [flipping, setFlipping] = useState(false);

  // Clear illegal shake after 400ms
  useEffect(() => {
    if (illegalAttempt) {
      const t = setTimeout(onClearIllegal, 400);
      return () => clearTimeout(t);
    }
  }, [illegalAttempt, onClearIllegal]);

  // Flip animation when orientation changes
  useEffect(() => {
    if (orientation !== prevOrientation) {
      setFlipping(true);
      const t = setTimeout(() => {
        setPrevOrientation(orientation);
        setFlipping(false);
      }, 300);
      return () => clearTimeout(t);
    }
  }, [orientation, prevOrientation]);

  const customSquareStyles = buildCustomSquareStyles(
    selectedSquare,
    legalDestinations,
    lastMove,
    illegalAttempt
  );

  // Handle square click — react-chessboard passes { piece, square }
  const handleSquareClick = ({ square }: { piece: unknown; square: string }) => {
    if (isGameOver) return;
    onSquareTap(square as Square);
  };

  return (
    <div className="relative w-full max-w-[480px] mx-auto" ref={containerRef}>
      {/* Turn indicator */}
      <div className="flex items-center justify-center gap-2 mb-3">
        <div
          className={`w-2.5 h-2.5 rounded-full transition-colors duration-300 ${
            turn === "w" ? "bg-white shadow-[0_0_8px_rgba(255,255,255,0.5)]" : "bg-white/20"
          }`}
        />
        <span className="text-white/60 text-xs font-medium tracking-wider uppercase">
          {isGameOver ? "Game Over" : turn === "w" ? "White to move" : "Black to move"}
        </span>
        <div
          className={`w-2.5 h-2.5 rounded-full transition-colors duration-300 ${
            turn === "b" ? "bg-gray-800 shadow-[0_0_8px_rgba(0,0,0,0.5)] border border-white/30" : "bg-white/10"
          }`}
        />
      </div>

      {/* Board with flip animation */}
      <div
        className={`transition-transform duration-300 ease-in-out ${
          flipping ? "scale-[0.97] opacity-90" : "scale-100 opacity-100"
        } ${illegalAttempt ? "animate-[shake_0.3s_ease-in-out]" : ""}`}
        style={{ perspective: "1000px" }}
      >
        <div
          className="rounded-xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
          style={{
            transition: "transform 0.3s ease-in-out",
            transformStyle: "preserve-3d",
          }}
        >
          <Chessboard
            options={{
              position: fen,
              boardOrientation: prevOrientation,
              allowDragging: false,
              onSquareClick: handleSquareClick,
              squareStyles: customSquareStyles,
              boardStyle: {
                borderRadius: "12px",
              },
              darkSquareStyle: { backgroundColor: "#3D6B47" },
              lightSquareStyle: { backgroundColor: "#E8E0D5" },
            }}
          />
        </div>
      </div>

      {/* Promotion picker overlay */}
      {pendingPromotion && (
        <PromotionPicker
          color={turn}
          onSelect={onConfirmPromotion}
          onCancel={onCancelPromotion}
        />
      )}

      {/* Game over overlay */}
      {isGameOver && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/50 rounded-xl backdrop-blur-sm pointer-events-none">
          <div className="bg-[#1a1a2e]/90 border border-white/10 rounded-2xl px-6 py-4 text-center">
            <p className="text-white font-bold text-lg">Game Over</p>
          </div>
        </div>
      )}
    </div>
  );
}
