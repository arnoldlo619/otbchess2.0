/**
 * RegisterGameModal — Overlay for registering a rated OTB game.
 *
 * Flow:
 * 1. User taps "Register Game" on the clock page
 * 2. Modal shows time control (from clock settings), rated toggle
 * 3. User confirms → creates game session → shows QR code + share link
 * 4. Opponent scans QR or opens link → joins the session
 * 5. Once joined, modal shows "Ready to play!" and user starts the clock
 */
import { useState, useEffect, useCallback } from "react";
import { X, QrCode, Copy, Check, Users, Trophy, Loader2, Share2 } from "lucide-react";
import { useAuthContext } from "@/context/AuthContext";

interface RegisterGameModalProps {
  isOpen: boolean;
  onClose: () => void;
  baseMinutes: number;
  incrementSeconds: number;
  onGameReady?: (sessionId: string) => void;
}

type ModalStep = "configure" | "waiting" | "ready";

export function RegisterGameModal({
  isOpen,
  onClose,
  baseMinutes,
  incrementSeconds,
  onGameReady,
}: RegisterGameModalProps) {
  const { user } = useAuthContext();
  const [step, setStep] = useState<ModalStep>("configure");
  const [isRated, setIsRated] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [opponentName, setOpponentName] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [timeControlCategory, setTimeControlCategory] = useState<string>("");

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep("configure");
      setError(null);
      setSessionId(null);
      setQrToken(null);
      setOpponentName(null);
      setCopied(false);
    }
  }, [isOpen]);

  // Poll for opponent join when in waiting step
  useEffect(() => {
    if (step !== "waiting" || !sessionId) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/otb-games/${sessionId}`, { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        if (data.status === "opponent_joined" && data.opponentDisplayName) {
          setOpponentName(data.opponentDisplayName);
          setStep("ready");
          clearInterval(interval);
        }
      } catch {
        // Ignore polling errors
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [step, sessionId]);

  const handleCreateSession = useCallback(async () => {
    if (!user) {
      setError("You must be logged in to register a rated game");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/otb-games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ baseMinutes, incrementSeconds, isRated }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create game session");
      }

      const data = await res.json();
      setSessionId(data.id);
      setQrToken(data.qrToken);
      setTimeControlCategory(data.timeControlCategory);
      setStep("waiting");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user, baseMinutes, incrementSeconds, isRated]);

  const joinUrl = qrToken
    ? `${window.location.origin}/game/join/${qrToken}`
    : "";

  const handleCopy = useCallback(async () => {
    if (!joinUrl) return;
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const input = document.createElement("input");
      input.value = joinUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [joinUrl]);

  const handleShare = useCallback(async () => {
    if (!joinUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join my OTB Chess Game",
          text: `Join my rated ${baseMinutes}+${incrementSeconds} game on ChessOTB!`,
          url: joinUrl,
        });
      } catch {
        // User cancelled share
      }
    } else {
      handleCopy();
    }
  }, [joinUrl, baseMinutes, incrementSeconds, handleCopy]);

  const handleReady = useCallback(() => {
    if (sessionId && onGameReady) {
      onGameReady(sessionId);
    }
    onClose();
  }, [sessionId, onGameReady, onClose]);

  if (!isOpen) return null;

  const categoryLabel =
    baseMinutes < 10 ? "OTB Blitz" : baseMinutes < 30 ? "OTB Rapid" : "Casual (Unrated)";
  const isCasual = baseMinutes >= 30;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-[#1a1a1a] rounded-3xl px-6 py-6 mx-4 max-w-sm w-full shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-[#5a9e5f]" />
            <h2 className="text-white text-lg font-bold">Register Game</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"
          >
            <X className="w-4 h-4 text-white/70" />
          </button>
        </div>

        {/* Step: Configure */}
        {step === "configure" && (
          <div>
            {/* Time control display */}
            <div className="bg-white/5 rounded-2xl p-4 mb-4">
              <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-1">
                Time Control
              </p>
              <p className="text-white text-2xl font-bold">
                {baseMinutes}+{incrementSeconds}
              </p>
              <p className="text-[#5a9e5f] text-sm font-medium mt-1">{categoryLabel}</p>
            </div>

            {/* Rated toggle */}
            {!isCasual && (
              <div className="flex items-center justify-between bg-white/5 rounded-2xl p-4 mb-4">
                <div>
                  <p className="text-white font-semibold">Rated Game</p>
                  <p className="text-white/50 text-xs mt-0.5">
                    Affects your OTB ELO rating
                  </p>
                </div>
                <button
                  onClick={() => setIsRated(!isRated)}
                  className={`w-12 h-7 rounded-full transition-colors relative ${
                    isRated ? "bg-[#5a9e5f]" : "bg-white/20"
                  }`}
                >
                  <div
                    className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                      isRated ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            )}

            {isCasual && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 mb-4">
                <p className="text-amber-400 text-sm">
                  Games with 30+ minute time controls are casual and won't affect ratings.
                </p>
              </div>
            )}

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-3 mb-4">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {!user && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3 mb-4">
                <p className="text-amber-400 text-sm">
                  You must be logged in to register a rated game.
                </p>
              </div>
            )}

            <button
              onClick={handleCreateSession}
              disabled={loading || !user}
              className="w-full py-4 rounded-2xl bg-[#5a9e5f] text-white text-base font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <QrCode className="w-5 h-5" />
                  Generate Join Link
                </>
              )}
            </button>
          </div>
        )}

        {/* Step: Waiting for opponent */}
        {step === "waiting" && (
          <div className="text-center">
            {/* QR placeholder — shows the join URL prominently */}
            <div className="bg-white rounded-2xl p-4 mb-4 mx-auto max-w-[200px]">
              <div className="flex items-center justify-center h-[160px]">
                <div className="text-center">
                  <QrCode className="w-16 h-16 text-gray-800 mx-auto mb-2" />
                  <p className="text-gray-600 text-xs">
                    Share the link below
                  </p>
                </div>
              </div>
            </div>

            {/* Join URL */}
            <div className="bg-white/5 rounded-xl p-3 mb-4 flex items-center gap-2">
              <p className="text-white/70 text-xs truncate flex-1 font-mono">
                {joinUrl}
              </p>
              <button
                onClick={handleCopy}
                className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-[#5a9e5f]" />
                ) : (
                  <Copy className="w-4 h-4 text-white/70" />
                )}
              </button>
            </div>

            {/* Share button */}
            <button
              onClick={handleShare}
              className="w-full py-3 rounded-2xl bg-white/10 text-white font-semibold flex items-center justify-center gap-2 mb-4"
            >
              <Share2 className="w-4 h-4" />
              Share with Opponent
            </button>

            {/* Waiting indicator */}
            <div className="flex items-center justify-center gap-2 text-white/50">
              <Loader2 className="w-4 h-4 animate-spin" />
              <p className="text-sm">Waiting for opponent to join...</p>
            </div>

            <p className="text-white/30 text-xs mt-3">
              Link expires in 30 minutes
            </p>
          </div>
        )}

        {/* Step: Ready */}
        {step === "ready" && (
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-[#5a9e5f]/20 flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-[#5a9e5f]" />
            </div>
            <p className="text-white text-xl font-bold mb-2">Opponent Joined!</p>
            <p className="text-white/60 text-sm mb-1">
              <span className="text-white font-semibold">{opponentName}</span> has joined the game
            </p>
            <p className="text-white/40 text-xs mb-6">
              {baseMinutes}+{incrementSeconds} • {isRated ? "Rated" : "Casual"} •{" "}
              {categoryLabel}
            </p>

            <button
              onClick={handleReady}
              className="w-full py-4 rounded-2xl bg-[#5a9e5f] text-white text-base font-bold"
            >
              Start Clock & Play!
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
