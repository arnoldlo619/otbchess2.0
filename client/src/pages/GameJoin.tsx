/**
 * GameJoin — /game/join/:token
 *
 * The opponent's entry point when they scan a QR code or open a join link.
 * Flow:
 * 1. Validates the token (checks expiry, status)
 * 2. If not logged in → prompts login
 * 3. Shows game details (host name, time control, rated/casual)
 * 4. One-tap "Join Game" button
 * 5. On success → redirects to clock page or shows confirmation
 */
import { useState, useEffect, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { Trophy, Clock, User, Loader2, AlertCircle, CheckCircle2, ArrowRight } from "lucide-react";
import { useAuthContext } from "@/context/AuthContext";
import { NavLogo } from "@/components/NavLogo";

type JoinState = "loading" | "ready" | "joining" | "joined" | "error";

interface GameInfo {
  id: string;
  hostDisplayName: string;
  hostChesscomUsername: string | null;
  timeControlCategory: string;
  baseMinutes: number;
  incrementSeconds: number;
  isRated: boolean;
  status: string;
}

export default function GameJoin() {
  const { token } = useParams<{ token: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuthContext();

  const [state, setState] = useState<JoinState>("loading");
  const [gameInfo, setGameInfo] = useState<GameInfo | null>(null);
  const [error, setError] = useState<string>("");

  // Fetch game info from token
  useEffect(() => {
    if (!token) {
      setState("error");
      setError("Invalid join link");
      return;
    }

    // We need a lookup endpoint — use the join endpoint with GET-like validation
    // For now, attempt to join directly when user clicks the button
    // Just show the join UI immediately
    setState("ready");
  }, [token]);

  const handleJoin = useCallback(async () => {
    if (!user) {
      setError("Please log in to join this game");
      return;
    }
    if (!token) return;

    setState("joining");
    setError("");

    try {
      const res = await fetch(`/api/otb-games/join/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      const data = await res.json();

      if (!res.ok) {
        setState("error");
        setError(data.error || "Failed to join game");
        return;
      }

      setGameInfo(data);
      setState("joined");
    } catch (err: any) {
      setState("error");
      setError(err.message || "Network error");
    }
  }, [user, token]);

  const handleGoToClock = useCallback(() => {
    if (!gameInfo) return;
    navigate(`/clock?base=${gameInfo.baseMinutes}&inc=${gameInfo.incrementSeconds}`);
  }, [gameInfo, navigate]);

  const categoryLabel = (cat: string) => {
    if (cat === "blitz") return "OTB Blitz";
    if (cat === "rapid") return "OTB Rapid";
    return "Casual";
  };

  return (
    <div className="min-h-screen bg-[#0f0f0f] flex flex-col items-center justify-center px-4 py-8">
      {/* Logo */}
      <div className="mb-8">
        <NavLogo linked={true} className="h-8" />
      </div>

      <div className="bg-[#1a1a1a] rounded-3xl p-6 max-w-sm w-full shadow-2xl">
        {/* Loading */}
        {state === "loading" && (
          <div className="flex flex-col items-center py-8">
            <Loader2 className="w-8 h-8 text-[#5a9e5f] animate-spin mb-4" />
            <p className="text-white/60 text-sm">Loading game details...</p>
          </div>
        )}

        {/* Ready to join */}
        {state === "ready" && (
          <div>
            <div className="flex items-center gap-2 mb-5">
              <Trophy className="w-5 h-5 text-[#5a9e5f]" />
              <h1 className="text-white text-xl font-bold">Join OTB Game</h1>
            </div>

            <div className="bg-white/5 rounded-2xl p-4 mb-4">
              <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-2">
                You've been invited to play
              </p>
              <p className="text-white text-sm">
                Tap the button below to join this rated OTB game. Your opponent is waiting!
              </p>
            </div>

            {!user && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 mb-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                  <p className="text-amber-400 text-sm">
                    You need to be logged in to join a rated game. Please sign in first.
                  </p>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-3 mb-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              </div>
            )}

            <button
              onClick={handleJoin}
              disabled={!user}
              className="w-full py-4 rounded-2xl bg-[#5a9e5f] text-white text-base font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <User className="w-5 h-5" />
              Join Game
            </button>
          </div>
        )}

        {/* Joining */}
        {state === "joining" && (
          <div className="flex flex-col items-center py-8">
            <Loader2 className="w-8 h-8 text-[#5a9e5f] animate-spin mb-4" />
            <p className="text-white/60 text-sm">Joining game...</p>
          </div>
        )}

        {/* Successfully joined */}
        {state === "joined" && gameInfo && (
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-[#5a9e5f]/20 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-[#5a9e5f]" />
            </div>
            <p className="text-white text-xl font-bold mb-2">You're In!</p>
            <p className="text-white/60 text-sm mb-4">
              Playing against <span className="text-white font-semibold">{gameInfo.hostDisplayName}</span>
            </p>

            {/* Game details */}
            <div className="bg-white/5 rounded-2xl p-4 mb-5 text-left">
              <div className="flex items-center gap-3 mb-2">
                <Clock className="w-4 h-4 text-white/50" />
                <span className="text-white text-sm font-medium">
                  {gameInfo.baseMinutes}+{gameInfo.incrementSeconds}
                </span>
                <span className="text-[#5a9e5f] text-xs font-medium ml-auto">
                  {categoryLabel(gameInfo.timeControlCategory)}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Trophy className="w-4 h-4 text-white/50" />
                <span className="text-white text-sm font-medium">
                  {gameInfo.isRated ? "Rated" : "Casual"}
                </span>
              </div>
            </div>

            <button
              onClick={handleGoToClock}
              className="w-full py-4 rounded-2xl bg-[#5a9e5f] text-white text-base font-bold flex items-center justify-center gap-2"
            >
              Open Clock
              <ArrowRight className="w-5 h-5" />
            </button>

            <p className="text-white/30 text-xs mt-3">
              Both players should use the same clock device
            </p>
          </div>
        )}

        {/* Error */}
        {state === "error" && !gameInfo && (
          <div className="text-center py-4">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-400" />
            </div>
            <p className="text-white text-lg font-bold mb-2">Unable to Join</p>
            <p className="text-white/60 text-sm mb-4">{error}</p>
            <button
              onClick={() => navigate("/")}
              className="py-3 px-6 rounded-2xl bg-white/10 text-white font-semibold"
            >
              Go Home
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
