/**
 * GameResultModal — Post-game result confirmation overlay.
 *
 * Shown when:
 * - A player's clock flags (auto-triggered)
 * - A player manually ends the game (resign/draw)
 *
 * Flow:
 * 1. Both players see the result screen
 * 2. Each player submits their claimed result (win/loss/draw)
 * 3. If both agree → result confirmed → ratings processed
 * 4. If disagreement → dispute state → admin resolution
 */
import { useState, useCallback, useRef } from "react";
import { Trophy, X, CheckCircle2, AlertTriangle, Loader2, Handshake } from "lucide-react";
import { useAuthContext } from "@/context/AuthContext";
import { fetchWithRetry } from "@/lib/fetchWithRetry";
import { useAccessibleOverlay } from "@/hooks/useAccessibleOverlay";

interface GameResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  flaggedPlayer?: "p1" | "p2" | null; // which player flagged (if applicable)
}

type ResultChoice = "white_wins" | "black_wins" | "draw";
type SubmitState = "choosing" | "submitting" | "submitted" | "confirmed" | "disputed" | "error";

export function GameResultModal({
  isOpen,
  onClose,
  sessionId,
  flaggedPlayer,
}: GameResultModalProps) {
  const { user } = useAuthContext();
  const [submitState, setSubmitState] = useState<SubmitState>("choosing");
  const [selectedResult, setSelectedResult] = useState<ResultChoice | null>(null);
  const [error, setError] = useState<string>("");
  const [ratingChange, setRatingChange] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  useAccessibleOverlay({
    open: isOpen,
    onClose,
    containerRef: dialogRef,
    initialFocusRef: closeButtonRef,
  });

  const handleSubmitResult = useCallback(async (result: ResultChoice) => {
    if (!user || !sessionId) return;

    setSelectedResult(result);
    setSubmitState("submitting");
    setError("");

    try {
      const res = await fetchWithRetry(`/api/otb-games/${sessionId}/result`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result }),
      }, { maxRetries: 2, baseDelay: 800 });

      const data = await res.json();

      if (!res.ok) {
        setSubmitState("error");
        setError(data.error || "Failed to submit result");
        return;
      }

      if (data.status === "result_confirmed") {
        setSubmitState("confirmed");
        if (data.ratingChange !== undefined) {
          setRatingChange(data.ratingChange);
        }
      } else if (data.status === "result_disputed") {
        setSubmitState("disputed");
      } else {
        // Waiting for opponent to confirm
        setSubmitState("submitted");
      }
    } catch (err: unknown) {
      setSubmitState("error");
      setError(err instanceof Error && err.message ? err.message : "Network error");
    }
  }, [user, sessionId]);

  if (!isOpen) return null;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="game-result-title"
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
    >
      <div className="bg-[#1a1a1a] rounded-3xl px-6 py-6 mx-4 max-w-sm w-full shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-[#5a9e5f]" />
            <h2 id="game-result-title" className="text-white text-lg font-bold">Game Result</h2>
          </div>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            aria-label="Close game result dialog"
            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"
          >
            <X className="w-4 h-4 text-white/70" />
          </button>
        </div>

        {/* Choosing result */}
        {submitState === "choosing" && (
          <div>
            {flaggedPlayer && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-3 mb-4">
                <p className="text-red-400 text-sm">
                  {flaggedPlayer === "p1" ? "Player 1 (Bottom)" : "Player 2 (Top)"} ran out of time.
                </p>
              </div>
            )}

            <p className="text-white/60 text-sm mb-4">
              Select the game result. Both players must agree for the result to be confirmed.
            </p>

            <div className="space-y-3">
              <button
                onClick={() => handleSubmitResult("white_wins")}
                className="w-full py-4 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <div className="w-5 h-5 rounded-full bg-white border border-[#ADBC9F]" />
                White Wins
              </button>
              <button
                onClick={() => handleSubmitResult("black_wins")}
                className="w-full py-4 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <div className="w-5 h-5 rounded-full bg-[#12372A] border border-[#436850]/40" />
                Black Wins
              </button>
              <button
                onClick={() => handleSubmitResult("draw")}
                className="w-full py-4 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <Handshake className="w-5 h-5 text-white/70" />
                Draw
              </button>
            </div>
          </div>
        )}

        {/* Submitting */}
        {submitState === "submitting" && (
          <div className="flex flex-col items-center py-8">
            <Loader2 className="w-8 h-8 text-[#5a9e5f] animate-spin mb-4" />
            <p className="text-white/60 text-sm">Submitting result...</p>
          </div>
        )}

        {/* Submitted, waiting for opponent */}
        {submitState === "submitted" && (
          <div className="text-center py-4">
            <div className="w-16 h-16 rounded-full bg-[#5a9e5f]/20 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-[#5a9e5f]" />
            </div>
            <p className="text-white text-lg font-bold mb-2">Result Submitted</p>
            <p className="text-white/60 text-sm mb-4">
              Waiting for your opponent to confirm the result.
            </p>
            <p className="text-white/40 text-xs">
              You selected: <span className="text-white font-medium">
                {selectedResult === "white_wins" ? "White Wins" : selectedResult === "black_wins" ? "Black Wins" : "Draw"}
              </span>
            </p>
            <button
              onClick={onClose}
              className="mt-6 w-full py-3 rounded-2xl bg-white/10 text-white font-semibold"
            >
              Close
            </button>
          </div>
        )}

        {/* Confirmed */}
        {submitState === "confirmed" && (
          <div className="text-center py-4">
            <div className="w-16 h-16 rounded-full bg-[#5a9e5f]/20 flex items-center justify-center mx-auto mb-4">
              <Trophy className="w-8 h-8 text-[#5a9e5f]" />
            </div>
            <p className="text-white text-lg font-bold mb-2">Result Confirmed!</p>
            {ratingChange !== null && (
              <p className={`text-2xl font-bold mb-2 ${ratingChange >= 0 ? "text-[#5a9e5f]" : "text-red-400"}`}>
                {ratingChange >= 0 ? "+" : ""}{ratingChange} ELO
              </p>
            )}
            <p className="text-white/60 text-sm mb-4">
              Both players agreed. Your OTB rating has been updated.
            </p>
            <button
              onClick={onClose}
              className="w-full py-4 rounded-2xl bg-[#5a9e5f] text-white text-base font-bold"
            >
              Done
            </button>
          </div>
        )}

        {/* Disputed */}
        {submitState === "disputed" && (
          <div className="text-center py-4">
            <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-amber-400" />
            </div>
            <p className="text-white text-lg font-bold mb-2">Result Disputed</p>
            <p className="text-white/60 text-sm mb-4">
              The results don't match. A tournament director will review this game.
            </p>
            <button
              onClick={onClose}
              className="w-full py-3 rounded-2xl bg-white/10 text-white font-semibold"
            >
              Close
            </button>
          </div>
        )}

        {/* Error */}
        {submitState === "error" && (
          <div className="text-center py-4">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
            <p className="text-white text-lg font-bold mb-2">Error</p>
            <p className="text-red-400 text-sm mb-4">{error}</p>
            <button
              onClick={() => setSubmitState("choosing")}
              className="w-full py-3 rounded-2xl bg-white/10 text-white font-semibold"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
