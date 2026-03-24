/**
 * NotationModeOverlay
 *
 * Full-screen overlay for Live Notation Mode. Composes:
 * - LiveNotationBoard (interactive chessboard)
 * - MoveListPanel (scrolling notation)
 * - Game-over banner with result selector (1-0 / ½-½ / 0-1)
 * - Control bar (undo, reset, exit, game-over actions)
 *
 * Designed for shared-device pass-and-play: the board auto-flips per turn,
 * and the layout is optimised for portrait mobile (board on top, moves below).
 */

import { Undo2, RotateCcw, X, BookOpen, Copy, Check, Loader2, AlertCircle, HelpCircle, Cloud, CloudOff, CloudUpload } from "lucide-react";
import { useState, useCallback, useEffect, useRef } from "react";
import LiveNotationBoard from "./LiveNotationBoard";
import MoveListPanel from "./MoveListPanel";
import type { UseNotationModeReturn } from "../hooks/useNotationMode";
import type { LnmAnalysisStatus } from "../hooks/useLnmAnalysis";
import type { LnmSaveStatus } from "../hooks/useLnmSave";

// ─── Types ────────────────────────────────────────────────────────────────────

/** PGN result token */
export type GameResult = "1-0" | "0-1" | "1/2-1/2";

interface ResultOption {
  value: GameResult;
  label: string;
  sublabel: string;
  activeClass: string;
  dotClass: string;
}

const RESULT_OPTIONS: ResultOption[] = [
  {
    value: "1-0",
    label: "1 – 0",
    sublabel: "White wins",
    activeClass: "bg-white/20 border-white/50 text-white",
    dotClass: "bg-white",
  },
  {
    value: "1/2-1/2",
    label: "½ – ½",
    sublabel: "Draw",
    activeClass: "bg-yellow-400/20 border-yellow-400/50 text-yellow-300",
    dotClass: "bg-yellow-400",
  },
  {
    value: "0-1",
    label: "0 – 1",
    sublabel: "Black wins",
    activeClass: "bg-[#4ade80]/20 border-[#4ade80]/50 text-[#4ade80]",
    dotClass: "bg-[#4ade80]",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Derive the natural result from a chess.js gameOverReason string.
 * Returns null when the game was stopped manually (no natural conclusion).
 */
export function deriveResultFromReason(reason: string | null): GameResult | null {
  if (!reason) return null;
  const r = reason.toLowerCase();
  if (r.includes("white wins")) return "1-0";
  if (r.includes("black wins")) return "0-1";
  if (
    r.includes("draw") ||
    r.includes("stalemate") ||
    r.includes("repetition") ||
    r.includes("insufficient")
  )
    return "1/2-1/2";
  return null;
}

/**
 * Inject or replace the [Result "..."] PGN header.
 * If the PGN already has a Result tag, replace it; otherwise prepend it.
 */
export function injectResultIntoPgn(pgn: string, result: GameResult): string {
  const resultTag = `[Result "${result}"]`;
  if (/\[Result\s+"[^"]*"\]/.test(pgn)) {
    return pgn.replace(/\[Result\s+"[^"]*"\]/, resultTag);
  }
  // Prepend before move text
  return `${resultTag}\n${pgn}`;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface NotationModeOverlayProps {
  notation: UseNotationModeReturn;
  hostName: string;
  guestName: string;
  onExit: (pgn: string | null) => void;
  onAnalyse?: (pgn: string, result: GameResult | null) => void;
  /** Status of the analysis pipeline (from useLnmAnalysis) */
  analyseStatus?: LnmAnalysisStatus;
  /** Error message from the analysis pipeline */
  analyseError?: string | null;
  /** Called when user dismisses the error banner */
  onAnalyseErrorDismiss?: () => void;
  /** Status of the background save (from useLnmSave) */
  saveStatus?: LnmSaveStatus;
  /** Timestamp of the last successful save */
  lastSavedAt?: Date | null;
  /** Error message from the last failed save */
  saveError?: string | null;
  /** Trigger an immediate save + exit */
  onSaveAndExit?: () => Promise<void>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function NotationModeOverlay({
  notation,
  hostName,
  guestName,
  onExit,
  onAnalyse,
  analyseStatus = "idle",
  analyseError = null,
  onAnalyseErrorDismiss,
  saveStatus = "idle",
  lastSavedAt = null,
  saveError = null,
  onSaveAndExit,
}: NotationModeOverlayProps) {
  const [isSavingAndExiting, setIsSavingAndExiting] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [copied, setCopied] = useState(false);
  // Confirmation prompt shown when user taps Analyse without selecting a result
  const [confirmAnalyse, setConfirmAnalyse] = useState(false);
  const confirmAnalyseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Result selector state ──────────────────────────────────────────────────
  // Auto-populated from chess.js when the game ends naturally; otherwise null
  // until the user explicitly picks one.
  const [selectedResult, setSelectedResult] = useState<GameResult | null>(null);

  // Auto-derive result when game ends naturally
  useEffect(() => {
    if (notation.isGameOver && notation.gameOverReason) {
      const derived = deriveResultFromReason(notation.gameOverReason);
      if (derived) setSelectedResult(derived);
    }
  }, [notation.isGameOver, notation.gameOverReason]);

  // Reset result when notation resets
  useEffect(() => {
    if (!notation.isGameOver) {
      setSelectedResult(null);
      setConfirmAnalyse(false);
    }
  }, [notation.isGameOver]);

  // Clear confirmation prompt timer on unmount
  useEffect(() => {
    return () => {
      if (confirmAnalyseTimerRef.current) clearTimeout(confirmAnalyseTimerRef.current);
    };
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────

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
    setSelectedResult(null);
  }, [confirmReset, notation]);

  const handleCopyPgn = useCallback(async () => {
    const pgnToCopy = selectedResult
      ? injectResultIntoPgn(notation.pgn, selectedResult)
      : notation.pgn;
    if (!pgnToCopy) return;
    try {
      await navigator.clipboard.writeText(pgnToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = pgnToCopy;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [notation.pgn, selectedResult]);

  const handleAnalyse = useCallback(() => {
    if (!notation.pgn || !onAnalyse) return;
    // If no result selected, show confirmation prompt first
    if (!selectedResult) {
      setConfirmAnalyse(true);
      // Auto-dismiss after 8 seconds
      if (confirmAnalyseTimerRef.current) clearTimeout(confirmAnalyseTimerRef.current);
      confirmAnalyseTimerRef.current = setTimeout(() => setConfirmAnalyse(false), 8000);
      return;
    }
    const pgnWithResult = injectResultIntoPgn(notation.pgn, selectedResult);
    onAnalyse(pgnWithResult, selectedResult);
  }, [notation.pgn, onAnalyse, selectedResult]);

  const handleAnalyseAnyway = useCallback(() => {
    if (!notation.pgn || !onAnalyse) return;
    setConfirmAnalyse(false);
    if (confirmAnalyseTimerRef.current) clearTimeout(confirmAnalyseTimerRef.current);
    onAnalyse(notation.pgn, null);
  }, [notation.pgn, onAnalyse]);

  const handleDismissConfirmAnalyse = useCallback(() => {
    setConfirmAnalyse(false);
    if (confirmAnalyseTimerRef.current) clearTimeout(confirmAnalyseTimerRef.current);
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────

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
        <div className="px-4 py-4 bg-[#4ade80]/10 border-t border-[#4ade80]/20 shrink-0 space-y-3">
          {/* Game-over reason */}
          <p className="text-[#4ade80] text-sm font-semibold text-center">
            {notation.gameOverReason}
          </p>

          {/* ── Result selector ─────────────────────────────────────────── */}
          <div className="space-y-1.5">
            <p className="text-white/40 text-[10px] font-medium uppercase tracking-widest text-center">
              Record Result
            </p>
            <div className="flex items-stretch gap-2">
              {RESULT_OPTIONS.map((opt) => {
                const isActive = selectedResult === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() =>
                      setSelectedResult(isActive ? null : opt.value)
                    }
                    className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 px-2 rounded-xl border text-xs font-semibold transition-all active:scale-95 ${
                      isActive
                        ? opt.activeClass
                        : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:text-white/60"
                    }`}
                    aria-pressed={isActive}
                    title={`${opt.label} — ${opt.sublabel}`}
                  >
                    {isActive && (
                      <span
                        className={`w-1.5 h-1.5 rounded-full mb-0.5 ${opt.dotClass}`}
                      />
                    )}
                    <span className="text-sm leading-none">{opt.label}</span>
                    <span className="text-[10px] font-normal opacity-70">
                      {opt.sublabel}
                    </span>
                  </button>
                );
              })}
            </div>
            {!selectedResult && (
              <p className="text-white/25 text-[10px] text-center">
                Select a result to embed it in the PGN
              </p>
            )}
          </div>

          {/* ── Confirm analyse without result ──────────────────────── */}
          {confirmAnalyse && (
            <div className="flex flex-col gap-2 px-3 py-3 rounded-xl bg-amber-500/10 border border-amber-500/25 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="flex items-start gap-2">
                <HelpCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-amber-300 text-xs font-semibold leading-snug">
                    No result selected
                  </p>
                  <p className="text-amber-300/60 text-[11px] mt-0.5 leading-snug">
                    The game result won't be recorded in the PGN. Continue anyway?
                  </p>
                </div>
                <button
                  onClick={handleDismissConfirmAnalyse}
                  className="text-amber-400/40 hover:text-amber-400 transition-colors shrink-0"
                  aria-label="Dismiss"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDismissConfirmAnalyse}
                  className="flex-1 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 text-xs font-medium transition-colors"
                >
                  Select result
                </button>
                <button
                  onClick={handleAnalyseAnyway}
                  disabled={analyseStatus === "submitting" || analyseStatus === "navigating"}
                  className="flex-1 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 disabled:opacity-60 disabled:cursor-not-allowed text-amber-300 text-xs font-semibold transition-colors"
                >
                  Continue anyway
                </button>
              </div>
            </div>
          )}

          {/* ── Action buttons ───────────────────────────────────────────── */}
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={handleCopyPgn}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 text-xs font-medium transition-colors"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-[#4ade80]" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              {copied ? "Copied!" : "Copy PGN"}
            </button>

            {onAnalyse && notation.pgn && (
              <button
                onClick={handleAnalyse}
                disabled={
                  analyseStatus === "submitting" ||
                  analyseStatus === "navigating"
                }
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#4ade80]/20 hover:bg-[#4ade80]/30 disabled:opacity-60 disabled:cursor-not-allowed text-[#4ade80] text-xs font-medium transition-colors"
              >
                {analyseStatus === "submitting" ||
                analyseStatus === "navigating" ? (
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
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/15 border border-red-500/25">
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

        {/* Copy PGN (mid-game) */}
        {notation.moves.length > 0 && !notation.isGameOver && (
          <button
            onClick={handleCopyPgn}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 text-xs font-medium transition-all active:scale-95"
            title="Copy PGN to clipboard"
          >
            {copied ? (
              <Check className="w-4 h-4 text-[#4ade80]" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
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

        {/* Save & Exit */}
        {onSaveAndExit && notation.moves.length > 0 && !notation.isGameOver && (
          <button
            onClick={async () => {
              setIsSavingAndExiting(true);
              await onSaveAndExit();
              setIsSavingAndExiting(false);
            }}
            disabled={isSavingAndExiting || saveStatus === "saving"}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#4ade80]/10 hover:bg-[#4ade80]/20 disabled:opacity-50 disabled:cursor-not-allowed text-[#4ade80] text-xs font-medium transition-all active:scale-95 border border-[#4ade80]/20"
            title={lastSavedAt ? `Last saved ${lastSavedAt.toLocaleTimeString()}` : "Save progress and exit"}
          >
            {isSavingAndExiting || saveStatus === "saving" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : saveStatus === "error" ? (
              <CloudOff className="w-4 h-4 text-red-400" />
            ) : saveStatus === "saved" ? (
              <CloudUpload className="w-4 h-4" />
            ) : (
              <Cloud className="w-4 h-4" />
            )}
            {isSavingAndExiting ? "Saving..." : "Save & Exit"}
          </button>
        )}
      </div>

      {/* ── Save error toast ──────────────────────────────────────────────── */}
      {saveStatus === "error" && saveError && (
        <div className="absolute bottom-20 left-4 right-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/15 border border-red-500/25 z-10">
          <CloudOff className="w-3.5 h-3.5 text-red-400 shrink-0" />
          <p className="text-[11px] text-red-300 flex-1">Save failed: {saveError}</p>
        </div>
      )}
    </div>
  );
}
