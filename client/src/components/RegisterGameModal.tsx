/**
 * RegisterGameModal — Overlay for registering a rated OTB game.
 *
 * Two entry points:
 * A) Auto-triggered (both players checked in on clock page):
 *    - Shows a head-to-head "confirm" step with avatars, ratings, color picker,
 *      and time control. Tapping "Start Game & Clock" registers + starts immediately.
 * B) Manual (Trophy button, no usernames):
 *    - Original configure → waiting → ready flow.
 */
import { useState, useEffect, useCallback } from "react";
import { X, QrCode, Copy, Check, Users, Trophy, Loader2, Share2, RotateCcw } from "lucide-react";
import { useAuthContext } from "@/context/AuthContext";
import { toProxiedAvatarUrl } from "@/hooks/useChessAvatar";

interface PlayerInfo {
  username: string;
  /** Rapid rating (0 = unrated) */
  rapid?: number;
  /** Blitz rating (0 = unrated) */
  blitz?: number;
}

interface RegisterGameModalProps {
  isOpen: boolean;
  onClose: () => void;
  baseMinutes: number;
  incrementSeconds: number;
  onGameReady?: (sessionId: string) => void;
  /** When both players are pre-known (auto-trigger from check-in), show head-to-head confirm step */
  player1?: PlayerInfo | null;
  player2?: PlayerInfo | null;
  /** When true (tournament mode), hide the Rated Game toggle and sign-in banner — game is always rated */
  isTournamentMode?: boolean;
}

type ModalStep = "headtohead" | "configure" | "waiting" | "ready";

export function RegisterGameModal({
  isOpen,
  onClose,
  baseMinutes,
  incrementSeconds,
  onGameReady,
  player1,
  player2,
  isTournamentMode = false,
}: RegisterGameModalProps) {
  const { user } = useAuthContext();
  const bothKnown = !!(player1?.username && player2?.username);
  const p1 = player1 ?? undefined;
  const p2 = player2 ?? undefined;

  const [step, setStep] = useState<ModalStep>(() => bothKnown ? "headtohead" : "configure");
  const [isRated, setIsRated] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [opponentName, setOpponentName] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [timeControlCategory, setTimeControlCategory] = useState<string>("");

  // Color assignment: "p1white" = player1 is White, "p2white" = player2 is White
  const [colorAssignment, setColorAssignment] = useState<"p1white" | "p2white">("p1white");

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep(bothKnown ? "headtohead" : "configure");
      setError(null);
      setSessionId(null);
      setQrToken(null);
      setOpponentName(null);
      setCopied(false);
      setColorAssignment("p1white");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  /** Head-to-head confirm: register session directly with both players known */
  const handleHeadToHeadConfirm = useCallback(async () => {
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
        body: JSON.stringify({
          baseMinutes,
          incrementSeconds,
          isRated,
          whiteUsername: colorAssignment === "p1white" ? player1?.username : player2?.username,
          blackUsername: colorAssignment === "p1white" ? player2?.username : player1?.username,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create game session");
      }
      const data = await res.json();
      if (onGameReady) onGameReady(data.id);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user, baseMinutes, incrementSeconds, isRated, colorAssignment, player1, player2, onGameReady, onClose]);

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

  // ── Avatar helper ──────────────────────────────────────────────────────────
  function PlayerCard({
    info,
    side,
    isWhite,
  }: {
    info: PlayerInfo;
    side: "left" | "right";
    isWhite: boolean;
  }) {
    const proxied = toProxiedAvatarUrl(`https://www.chess.com/member/${info.username}`) ?? "";
    return (
      <div
        className={`flex-1 flex flex-col items-center gap-2 p-3 rounded-2xl transition-all ${
          isWhite
            ? "bg-white/15 ring-2 ring-white/40"
            : "bg-black/30 ring-2 ring-white/10"
        }`}
      >
        {/* Avatar */}
        <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-white/20 flex items-center justify-center bg-white/10">
          <img
            src={proxied}
            alt={info.username}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
              (e.target as HTMLImageElement).parentElement!.innerHTML =
                `<span class="text-white font-bold text-xl uppercase">${info.username.charAt(0)}</span>`;
            }}
          />
        </div>
        {/* Username */}
        <p className="text-white font-bold text-sm text-center truncate w-full leading-tight">
          {info.username}
        </p>
        {/* Ratings */}
        <div className="flex gap-1.5 flex-wrap justify-center">
          {(info.rapid ?? 0) > 0 && (
            <span className="text-[10px] font-bold text-[#22c55e]">⚡{info.rapid}</span>
          )}
          {(info.blitz ?? 0) > 0 && (
            <span className="text-[10px] font-bold text-[#60a5fa]">🔥{info.blitz}</span>
          )}
        </div>
        {/* Color badge */}
        <div
          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide ${
            isWhite
              ? "bg-white text-[#1A1A1A]"
              : "bg-[#1A1A1A] text-white border border-white/20"
          }`}
        >
          {isWhite ? "⬜ White" : "⬛ Black"}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-[#1a1a1a] rounded-3xl px-6 py-6 mx-4 max-w-sm w-full shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-[#5a9e5f]" />
            <h2 className="text-white text-lg font-bold">
              {step === "headtohead" ? "Confirm Game" : "Register Game"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"
          >
            <X className="w-4 h-4 text-white/70" />
          </button>
        </div>

        {/* ── Step: Head-to-Head Confirm (auto-triggered) ── */}
        {step === "headtohead" && player1 && player2 && (
          <div>
            {/* Time control */}
            <div className="bg-white/5 rounded-2xl p-3 mb-5 flex items-center justify-between">
              <div>
                <p className="text-white/50 text-[10px] font-semibold uppercase tracking-wider">Time Control</p>
                <p className="text-white text-xl font-bold leading-tight">{baseMinutes}+{incrementSeconds}</p>
              </div>
              <span className="text-[#5a9e5f] text-sm font-semibold">{categoryLabel}</span>
            </div>

            {/* Head-to-head player cards */}
            <div className="flex gap-3 mb-2">
              <PlayerCard
                info={player1}
                side="left"
                isWhite={colorAssignment === "p1white"}
              />
              <div className="flex flex-col items-center justify-center gap-2 flex-shrink-0">
                <span className="text-white/30 text-xs font-bold">VS</span>
                <button
                  onClick={() => setColorAssignment(a => a === "p1white" ? "p2white" : "p1white")}
                  className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
                  title="Swap colors"
                  aria-label="Swap colors"
                >
                  <RotateCcw className="w-4 h-4 text-white/60" />
                </button>
              </div>
              <PlayerCard
                info={player2}
                side="right"
                isWhite={colorAssignment === "p2white"}
              />
            </div>

            <p className="text-white/35 text-[10px] text-center mb-6">
              Tap ↺ to swap colors
            </p>

            {/* Rated toggle — hidden in tournament mode (always rated) */}
            {!isTournamentMode && !isCasual && (
              <div className="flex items-center justify-between bg-white/5 rounded-2xl p-3 mb-4">
                <div>
                  <p className="text-white text-sm font-semibold">Rated Game</p>
                  <p className="text-white/50 text-xs mt-0.5">Affects your OTB ELO</p>
                </div>
                <button
                  onClick={() => setIsRated(!isRated)}
                  className={`w-12 h-7 rounded-full transition-colors relative ${isRated ? "bg-[#5a9e5f]" : "bg-white/20"}`}
                >
                  <div className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${isRated ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </div>
            )}

            {/* Sign-in banner — hidden in tournament mode */}
            {!isTournamentMode && !user && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3 mb-4">
                <p className="text-amber-400 text-sm">Sign in to register a rated game.</p>
              </div>
            )}

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-3 mb-4">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <button
              onClick={user ? handleHeadToHeadConfirm : onClose}
              disabled={loading}
              className="w-full py-4 rounded-2xl bg-[#5a9e5f] text-white text-base font-bold disabled:opacity-50 flex items-center justify-center gap-2 mt-1"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Trophy className="w-5 h-5" />
                  {user ? "Start Game & Clock" : "Start Clock (Unregistered)"}
                </>
              )}
            </button>
          </div>
        )}

        {/* ── Step: Configure (manual / no usernames) ── */}
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

            {/* Rated toggle — hidden in tournament mode (always rated) */}
            {!isTournamentMode && !isCasual && (
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

        {/* ── Step: Waiting for opponent ── */}
        {step === "waiting" && (
          <div className="text-center">
            <div className="bg-white rounded-2xl p-4 mb-4 mx-auto max-w-[200px]">
              <div className="flex items-center justify-center h-[160px]">
                <div className="text-center">
                  <QrCode className="w-16 h-16 text-[#1A1A1A] mx-auto mb-2" />
                  <p className="text-[#6B6B50] text-xs">
                    Share the link below
                  </p>
                </div>
              </div>
            </div>

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

            <button
              onClick={handleShare}
              className="w-full py-3 rounded-2xl bg-white/10 text-white font-semibold flex items-center justify-center gap-2 mb-4"
            >
              <Share2 className="w-4 h-4" />
              Share with Opponent
            </button>

            <div className="flex items-center justify-center gap-2 text-white/50">
              <Loader2 className="w-4 h-4 animate-spin" />
              <p className="text-sm">Waiting for opponent to join...</p>
            </div>

            <p className="text-white/30 text-xs mt-3">
              Link expires in 30 minutes
            </p>
          </div>
        )}

        {/* ── Step: Ready ── */}
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
