/**
 * NotationModeOverlay
 *
 * Full-screen overlay for Live Notation Mode. Composes:
 * - LiveNotationBoard (interactive chessboard)
 * - MoveListPanel (scrolling notation)
 * - Control bar (undo, reset, exit, game-over actions)
 *
 * Designed for shared-device pass-and-play: the board auto-flips per turn,
 * and the layout is optimised for portrait mobile (board on top, moves below).
 */

import { Undo2, RotateCcw, X, BookOpen, Copy, Check, Loader2, AlertCircle } from "lucide-react";
import { useState, useCallback } from "react";
import LiveNotationBoard from "./LiveNotationBoard";
import MoveListPanel from "./MoveListPanel";
import type { UseNotationModeReturn } from "../hooks/useNotationMode";
import type { LnmAnalysisStatus } from "../hooks/useLnmAnalysis";

interface NotationModeOverlayProps {
  notation: UseNotationModeReturn;
  hostName: string;
  guestName: string;
  onExit: (pgn: string | null) => void;
  onAnalyse?: (pgn: string) => void;
  /** Status of the analysis pipeline (from useLnmAnalysis) */
  analyseStatus?: LnmAnalysisStatus;
  /** Error message from the analysis pipeline */
  analyseError?: string | null;
  /** Called when user dismisses the error banner */
  onAnalyseErrorDismiss?: () => void;
}

export default function NotationModeOverlay({
  notation,
  hostName,
  guestName,
  onExit,
  onAnalyse,
  analyseStatus = "idle",
  analyseError = null,
  onAnalyseErrorDismiss,
}: NotationModeOverlayProps) {
  const [confirmReset, setConfirmReset] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleExit = useCallback(() => {
    const pgn = notation.deactivate();
    onExit(pgn);
  }, [notation, onExit]);

  const handleReset = useCallback(() => {
    if (!confirmReset) {
      setConfirmReset(true);
      setTimeout(() => setConfirmReset(false), 3000);
      return;
    }
    notation.reset();
    setConfirmReset(false);
  }, [confirmReset, notation]);

  const handleCopyPgn = useCallback(async () => {
    if (!notation.pgn) return;
    try {
      await navigator.clipboard.writeText(notation.pgn);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const ta = document.createElement("textarea");
      ta.value = notation.pgn;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [notation.pgn]);

  const handleAnalyse = useCallback(() => {
    if (notation.pgn && onAnalyse) {
      onAnalyse(notation.pgn);
    }
  }, [notation.pgn, onAnalyse]);

  return (
    <div className="fixed inset-0 z-[100] bg-[#0a0a1a] flex flex-col overflow-hidden">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#0a0a1a]/95 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-[#4ade80] animate-pulse" />
          <span className="text-white/80 text-sm font-semibold tracking-wide">
            Live Notation
          </span>
        </div>
        <div className="flex items-center gap-2 text-white/40 text-xs">
          <span className="font-medium">{hostName}</span>
          <span className="text-white/20">vs</span>
          <span className="font-medium">{guestName}</span>
        </div>
        <button
          onClick={handleExit}
          className="p-2 rounded-xl hover:bg-white/10 text-white/50 hover:text-white transition-colors"
          title="Exit notation mode"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* ── Main content: Board + Moves ───────────────────────────────────── */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Board section */}
        <div className="flex-1 flex items-center justify-center p-4 min-h-0">
          <LiveNotationBoard
            fen={notation.fen}
            orientation={notation.orientation}
            selectedSquare={notation.selectedSquare}
            legalDestinations={notation.legalDestinations}
            lastMove={notation.lastMove}
            isGameOver={notation.isGameOver}
            illegalAttempt={notation.illegalAttempt}
            onSquareTap={notation.selectSquare}
            onClearIllegal={notation.clearIllegalAttempt}
            pendingPromotion={notation.pendingPromotion}
            onConfirmPromotion={notation.confirmPromotion}
            onCancelPromotion={notation.cancelPromotion}
            turn={notation.turn}
          />
        </div>

        {/* Move list section */}
        <div className="h-[200px] md:h-auto md:w-[260px] border-t md:border-t-0 md:border-l border-white/10 bg-[#0d0d20]">
          <MoveListPanel
            moves={notation.moves}
            openingName={notation.openingName}
            moveCount={notation.moveCount}
          />
        </div>
      </div>

      {/* ── Game Over Banner ──────────────────────────────────────────────── */}
      {notation.isGameOver && notation.gameOverReason && (
        <div className="px-4 py-3 bg-[#4ade80]/10 border-t border-[#4ade80]/20 text-center shrink-0">
          <p className="text-[#4ade80] text-sm font-semibold">{notation.gameOverReason}</p>
          <div className="flex items-center justify-center gap-3 mt-2">
            <button
              onClick={handleCopyPgn}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 text-xs font-medium transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-[#4ade80]" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copied!" : "Copy PGN"}
            </button>
            {onAnalyse && notation.pgn && (
              <button
                onClick={handleAnalyse}
                disabled={analyseStatus === "submitting" || analyseStatus === "navigating"}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#4ade80]/20 hover:bg-[#4ade80]/30 disabled:opacity-60 disabled:cursor-not-allowed text-[#4ade80] text-xs font-medium transition-colors"
              >
                {analyseStatus === "submitting" || analyseStatus === "navigating" ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <BookOpen className="w-3.5 h-3.5" />
                )}
                {analyseStatus === "submitting"
                  ? "Submitting..."
                  : analyseStatus === "navigating"
                  ? "Opening..."
                  : "Analyse Game"}
              </button>
            )}
          </div>
          {/* Analysis error banner */}
          {analyseStatus === "error" && analyseError && (
            <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded-lg bg-red-500/15 border border-red-500/25">
              <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
              <p className="text-[11px] text-red-300 flex-1">{analyseError}</p>
              {onAnalyseErrorDismiss && (
                <button
                  onClick={onAnalyseErrorDismiss}
                  className="text-red-400/60 hover:text-red-400 transition-colors"
                  aria-label="Dismiss error"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Control Bar ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-3 px-4 py-3 border-t border-white/10 bg-[#0a0a1a]/95 backdrop-blur-sm shrink-0">
        {/* Undo */}
        <button
          onClick={() => notation.undoMove()}
          disabled={notation.moves.length === 0}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-white/70 text-xs font-medium transition-all active:scale-95"
          title="Undo last move"
        >
          <Undo2 className="w-4 h-4" />
          Undo
        </button>

        {/* Copy PGN */}
        {notation.moves.length > 0 && !notation.isGameOver && (
          <button
            onClick={handleCopyPgn}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 text-xs font-medium transition-all active:scale-95"
            title="Copy PGN to clipboard"
          >
            {copied ? <Check className="w-4 h-4 text-[#4ade80]" /> : <Copy className="w-4 h-4" />}
            {copied ? "Copied!" : "Copy PGN"}
          </button>
        )}

        {/* Reset */}
        <button
          onClick={handleReset}
          disabled={notation.moves.length === 0}
          className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-medium transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed ${
            confirmReset
              ? "bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30"
              : "bg-white/5 hover:bg-white/10 text-white/70"
          }`}
          title={confirmReset ? "Tap again to confirm reset" : "Reset board"}
        >
          <RotateCcw className="w-4 h-4" />
          {confirmReset ? "Confirm Reset" : "Reset"}
        </button>
      </div>
    </div>
  );
}
