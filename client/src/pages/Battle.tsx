import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { QRCodeSVG } from "qrcode.react";
import {
  Swords,
  Shield,
  Users,
  Copy,
  Check,
  ArrowLeft,
  Trophy,
  Handshake,
  Crown,
  RefreshCw,
  Loader2,
  AlertCircle,
  ChevronRight,
  LogIn,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import AuthModal from "../components/AuthModal";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlayerProfile {
  id: string;
  displayName: string;
  chesscomUsername: string | null;
  avatarUrl: string | null;
  chesscomElo: number | null;
}

interface BattleRoom {
  id: string;
  code: string;
  hostId: string;
  guestId: string | null;
  status: "waiting" | "active" | "completed" | "cancelled";
  result: string | null;
  timeControl: string | null;
  host: PlayerProfile | null;
  guest: PlayerProfile | null;
}

type Screen =
  | "mode_select"
  | "host_waiting"
  | "join_enter_code"
  | "battle_room"
  | "result";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function avatarFallback(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function PlayerCard({
  player,
  side,
  isReady,
}: {
  player: PlayerProfile | null;
  side: "left" | "right";
  isReady: boolean;
}) {
  const isLeft = side === "left";
  return (
    <motion.div
      initial={{ opacity: 0, x: isLeft ? -60 : 60 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 22, delay: 0.1 }}
      className={`relative flex flex-col items-center gap-4 p-6 rounded-2xl border backdrop-blur-md w-full max-w-xs
        ${isLeft
          ? "bg-gradient-to-br from-green-900/40 to-green-950/60 border-green-500/30"
          : "bg-gradient-to-bl from-slate-800/60 to-slate-900/80 border-white/10"
        }`}
    >
      {/* Crown for host */}
      {isLeft && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Crown className="w-5 h-5 text-yellow-400 drop-shadow" />
        </div>
      )}

      {/* Avatar */}
      <div className="relative">
        {player?.avatarUrl ? (
          <img
            src={player.avatarUrl}
            alt={player.displayName}
            className="w-24 h-24 rounded-full object-cover border-2 border-white/20 shadow-lg"
          />
        ) : (
          <div
            className={`w-24 h-24 rounded-full flex items-center justify-center text-2xl font-bold border-2 shadow-lg
              ${isLeft ? "bg-green-700/60 border-green-500/40 text-white" : "bg-slate-700/60 border-white/20 text-white/80"}`}
          >
            {player ? avatarFallback(player.displayName) : "?"}
          </div>
        )}
        {isReady && (
          <span className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-green-500 border-2 border-black" />
        )}
      </div>

      {/* Name & ELO */}
      {player ? (
        <>
          <div className="text-center">
            <p className="text-white font-semibold text-lg leading-tight">
              {player.displayName}
            </p>
            {player.chesscomUsername && (
              <p className="text-white/50 text-xs mt-0.5">
                @{player.chesscomUsername}
              </p>
            )}
          </div>
          {player.chesscomElo && (
            <div className="px-3 py-1 rounded-full bg-white/10 border border-white/10 text-white/80 text-sm font-mono">
              {player.chesscomElo} ELO
            </div>
          )}
        </>
      ) : (
        <div className="text-center">
          <p className="text-white/30 text-sm">Waiting for opponent…</p>
          <div className="mt-2 flex gap-1 justify-center">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-white/30"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Role label */}
      <span
        className={`text-xs font-medium uppercase tracking-widest px-2 py-0.5 rounded
          ${isLeft ? "text-green-400" : "text-white/40"}`}
      >
        {isLeft ? "Host" : "Challenger"}
      </span>
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Battle() {
  const { user } = useAuth();
  const [screen, setScreen] = useState<Screen>("mode_select");
  const [room, setRoom] = useState<BattleRoom | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [polling, setPolling] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);

  // Auto-populate join code from QR scan URL param (?join=CODE)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("join");
    if (code) {
      setJoinCode(code.toUpperCase());
      setScreen("join_enter_code");
    }
  }, []);

  // ── Poll for room updates while waiting ────────────────────────────────────
  const fetchRoom = useCallback(async (code: string) => {
    try {
      const res = await fetch(`/api/battles/${code}`);
      if (!res.ok) return;
      const data: BattleRoom = await res.json();
      setRoom(data);
      if (data.status === "active" && screen === "host_waiting") {
        setScreen("battle_room");
      }
      if (data.status === "completed") {
        setScreen("result");
      }
    } catch {
      // silently ignore poll errors
    }
  }, [screen]);

  useEffect(() => {
    if (!room?.code) return;
    if (screen !== "host_waiting" && screen !== "battle_room") return;
    setPolling(true);
    const interval = setInterval(() => fetchRoom(room.code), 3000);
    return () => {
      clearInterval(interval);
      setPolling(false);
    };
  }, [room?.code, screen, fetchRoom]);

  // ── Host a battle ──────────────────────────────────────────────────────────
  async function handleHost() {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/battles", { method: "POST" });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Failed to create battle room");
      }
      const { code } = await res.json();
      // Fetch full room with profile
      const roomRes = await fetch(`/api/battles/${code}`);
      const roomData: BattleRoom = await roomRes.json();
      setRoom(roomData);
      setScreen("host_waiting");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  // ── Join a battle ──────────────────────────────────────────────────────────
  async function handleJoin() {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    if (!joinCode.trim()) {
      setError("Please enter a battle code.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/battles/${joinCode.trim()}/join`, {
        method: "PATCH",
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Failed to join battle room");
      }
      const roomData: BattleRoom = await res.json();
      setRoom(roomData);
      setScreen("battle_room");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  // ── Report result ──────────────────────────────────────────────────────────
  async function handleResult(result: "host_win" | "guest_win" | "draw") {
    if (!room) return;
    setLoading(true);
    try {
      await fetch(`/api/battles/${room.code}/result`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result }),
      });
      setRoom((r) => r ? { ...r, result, status: "completed" } : r);
      setScreen("result");
    } catch {
      setError("Failed to report result");
    } finally {
      setLoading(false);
    }
  }

  // ── Copy code ──────────────────────────────────────────────────────────────
  function copyCode() {
    if (!room?.code) return;
    navigator.clipboard.writeText(room.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const joinUrl = room
    ? `${window.location.origin}/battle?join=${room.code}`
    : "";

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0a1a0e] text-white flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/5">
        <Link href="/">
          <span className="text-xl font-black italic text-green-400 tracking-tight cursor-pointer hover:opacity-80 transition-opacity">
            OTB!!
          </span>
        </Link>
        <div className="flex items-center gap-2 text-white/50 text-sm">
          <Swords className="w-4 h-4" />
          <span>Battle</span>
        </div>
        {screen !== "mode_select" && (
          <button
            onClick={() => {
              setScreen("mode_select");
              setRoom(null);
              setError(null);
              setJoinCode("");
            }}
            className="flex items-center gap-1.5 text-white/40 hover:text-white text-sm transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        )}
        {screen === "mode_select" && <div className="w-16" />}
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <AnimatePresence mode="wait">
          {/* ── Mode Select ─────────────────────────────────────────────── */}
          {screen === "mode_select" && (
            <motion.div
              key="mode_select"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-lg text-center"
            >
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="mb-6 flex justify-center"
              >
                <div className="w-16 h-16 rounded-2xl bg-green-900/40 border border-green-500/30 flex items-center justify-center">
                  <Swords className="w-8 h-8 text-green-400" />
                </div>
              </motion.div>

              <h1 className="text-4xl font-black tracking-tight mb-2">
                1v1 Battle
              </h1>
              <p className="text-white/50 mb-10 text-sm">
                Challenge a fellow OTB Chess member to a documented in-person
                battle. Results are recorded on both profiles.
              </p>

              {error && (
                <div className="mb-6 flex items-center gap-2 text-red-400 text-sm bg-red-900/20 border border-red-500/20 rounded-xl px-4 py-3">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

              {!user && (
                <button
                  onClick={() => setAuthOpen(true)}
                  className="mb-6 w-full flex items-center justify-center gap-2 text-sm bg-white/5 rounded-xl px-4 py-3 border border-white/10 text-green-400 hover:text-green-300 hover:bg-white/10 hover:border-green-500/30 transition-all group"
                >
                  <LogIn className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  <span>Sign in to host or join a battle</span>
                  <ChevronRight className="w-3 h-3 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                </button>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Host */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleHost}
                  disabled={loading || !user}
                  className="group relative flex flex-col items-center gap-4 p-8 rounded-2xl border border-green-500/30 bg-gradient-to-br from-green-900/40 to-green-950/60 hover:border-green-400/50 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <div className="w-12 h-12 rounded-xl bg-green-700/40 flex items-center justify-center group-hover:bg-green-700/60 transition-colors">
                    {loading ? (
                      <Loader2 className="w-6 h-6 text-green-300 animate-spin" />
                    ) : (
                      <Shield className="w-6 h-6 text-green-300" />
                    )}
                  </div>
                  <div>
                    <p className="font-bold text-lg text-white">Host Battle</p>
                    <p className="text-white/40 text-xs mt-1">
                      Create a room &amp; share QR code
                    </p>
                  </div>
                  <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-hover:text-white/50 transition-colors" />
                </motion.button>

                {/* Join */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setError(null);
                    setScreen("join_enter_code");
                  }}
                  disabled={!user}
                  className="group relative flex flex-col items-center gap-4 p-8 rounded-2xl border border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                    <Users className="w-6 h-6 text-white/70" />
                  </div>
                  <div>
                    <p className="font-bold text-lg text-white">Join Battle</p>
                    <p className="text-white/40 text-xs mt-1">
                      Enter code or scan QR
                    </p>
                  </div>
                  <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-hover:text-white/50 transition-colors" />
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* ── Host Waiting ─────────────────────────────────────────────── */}
          {screen === "host_waiting" && room && (
            <motion.div
              key="host_waiting"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-md text-center"
            >
              <h2 className="text-2xl font-black mb-1">Battle Room Created</h2>
              <p className="text-white/40 text-sm mb-8">
                Share the QR code or code below with your opponent.
              </p>

              {/* QR Code */}
              <div className="flex justify-center mb-6">
                <div className="p-4 rounded-2xl bg-white shadow-lg shadow-green-900/30">
                  <QRCodeSVG
                    value={joinUrl}
                    size={200}
                    bgColor="#ffffff"
                    fgColor="#0a1a0e"
                    level="M"
                  />
                </div>
              </div>

              {/* Code display */}
              <div className="flex items-center justify-center gap-3 mb-8">
                <span className="text-3xl font-mono font-black tracking-[0.3em] text-green-400">
                  {room.code}
                </span>
                <button
                  onClick={copyCode}
                  className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                  title="Copy code"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-white/60" />
                  )}
                </button>
              </div>

              {/* Waiting indicator */}
              <div className="flex items-center justify-center gap-2 text-white/40 text-sm">
                {polling && (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                )}
                <span>Waiting for opponent to join…</span>
              </div>
            </motion.div>
          )}

          {/* ── Join: Enter Code ─────────────────────────────────────────── */}
          {screen === "join_enter_code" && (
            <motion.div
              key="join_enter_code"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-sm text-center"
            >
              <div className="mb-6 flex justify-center">
                <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center">
                  <Users className="w-7 h-7 text-white/70" />
                </div>
              </div>
              <h2 className="text-2xl font-black mb-1">Join a Battle</h2>
              <p className="text-white/40 text-sm mb-8">
                Enter the 6-character code from your opponent.
              </p>

              {error && (
                <div className="mb-4 flex items-center gap-2 text-red-400 text-sm bg-red-900/20 border border-red-500/20 rounded-xl px-4 py-3">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

              <input
                type="text"
                value={joinCode}
                onChange={(e) =>
                  setJoinCode(e.target.value.toUpperCase().slice(0, 8))
                }
                placeholder="ABC123"
                className="w-full text-center text-3xl font-mono font-black tracking-[0.3em] bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-green-400 placeholder:text-white/20 focus:outline-none focus:border-green-500/50 mb-6"
                onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              />

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleJoin}
                disabled={loading || !joinCode.trim()}
                className="w-full py-3.5 rounded-xl bg-green-600 hover:bg-green-500 font-bold text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Swords className="w-4 h-4" />
                )}
                Enter Battle
              </motion.button>
            </motion.div>
          )}

          {/* ── Battle Room ──────────────────────────────────────────────── */}
          {screen === "battle_room" && room && (
            <motion.div
              key="battle_room"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full max-w-2xl"
            >
              {/* VS Header */}
              <div className="text-center mb-8">
                <motion.h2
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className="text-5xl font-black tracking-tight text-white"
                >
                  <span className="text-green-400">VS</span>
                </motion.h2>
                <p className="text-white/30 text-sm mt-1">
                  Both players are ready — let the battle begin!
                </p>
              </div>

              {/* Player cards */}
              <div className="flex items-center justify-center gap-4 mb-10">
                <PlayerCard
                  player={room.host}
                  side="left"
                  isReady={!!room.host}
                />

                {/* VS divider */}
                <div className="flex flex-col items-center gap-2 shrink-0">
                  <motion.div
                    animate={{ rotate: [0, 10, -10, 0] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    className="w-12 h-12 rounded-full bg-green-900/60 border border-green-500/30 flex items-center justify-center"
                  >
                    <Swords className="w-6 h-6 text-green-400" />
                  </motion.div>
                  <span className="text-white/20 text-xs font-mono">
                    #{room.code}
                  </span>
                </div>

                <PlayerCard
                  player={room.guest}
                  side="right"
                  isReady={!!room.guest}
                />
              </div>

              {/* Result reporting (host only) */}
              {user?.id === room.hostId && room.guest && (
                <div className="text-center">
                  <p className="text-white/40 text-sm mb-4">
                    Report the result when the game is over:
                  </p>
                  <div className="flex items-center justify-center gap-3 flex-wrap">
                    <motion.button
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => handleResult("host_win")}
                      disabled={loading}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-green-700/60 hover:bg-green-600/80 border border-green-500/30 font-semibold text-sm transition-all disabled:opacity-40"
                    >
                      <Trophy className="w-4 h-4 text-yellow-400" />I Won
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => handleResult("guest_win")}
                      disabled={loading}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 font-semibold text-sm transition-all disabled:opacity-40"
                    >
                      <Trophy className="w-4 h-4 text-white/40" />
                      Opponent Won
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => handleResult("draw")}
                      disabled={loading}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 font-semibold text-sm transition-all disabled:opacity-40"
                    >
                      <Handshake className="w-4 h-4 text-white/60" />
                      Draw
                    </motion.button>
                  </div>
                </div>
              )}

              {/* Guest view — waiting for host to report */}
              {user?.id !== room.hostId && (
                <div className="text-center text-white/30 text-sm flex items-center justify-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Waiting for host to report the result…
                </div>
              )}
            </motion.div>
          )}

          {/* ── Result Screen ────────────────────────────────────────────── */}
          {screen === "result" && room && (
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="w-full max-w-md text-center"
            >
              {/* Trophy animation */}
              <motion.div
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
                className="flex justify-center mb-6"
              >
                <div className="w-20 h-20 rounded-full bg-yellow-900/30 border border-yellow-500/30 flex items-center justify-center">
                  <Trophy className="w-10 h-10 text-yellow-400" />
                </div>
              </motion.div>

              <h2 className="text-3xl font-black mb-2">
                {room.result === "draw"
                  ? "It's a Draw!"
                  : room.result === "host_win"
                  ? `${room.host?.displayName ?? "Host"} Wins!`
                  : `${room.guest?.displayName ?? "Challenger"} Wins!`}
              </h2>
              <p className="text-white/40 text-sm mb-8">
                This battle has been recorded on both player profiles.
              </p>

              {/* Mini player cards */}
              <div className="flex items-center justify-center gap-4 mb-8">
                <div className="flex flex-col items-center gap-2">
                  {room.host?.avatarUrl ? (
                    <img
                      src={room.host.avatarUrl}
                      className="w-14 h-14 rounded-full border-2 border-green-500/40"
                      alt=""
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-green-800/60 border-2 border-green-500/40 flex items-center justify-center font-bold text-lg">
                      {avatarFallback(room.host?.displayName ?? "H")}
                    </div>
                  )}
                  <span className="text-xs text-white/60">
                    {room.host?.displayName}
                  </span>
                  {room.result === "host_win" && (
                    <Crown className="w-4 h-4 text-yellow-400" />
                  )}
                </div>

                <span className="text-white/20 font-bold">vs</span>

                <div className="flex flex-col items-center gap-2">
                  {room.guest?.avatarUrl ? (
                    <img
                      src={room.guest.avatarUrl}
                      className="w-14 h-14 rounded-full border-2 border-white/20"
                      alt=""
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-slate-700/60 border-2 border-white/20 flex items-center justify-center font-bold text-lg">
                      {avatarFallback(room.guest?.displayName ?? "G")}
                    </div>
                  )}
                  <span className="text-xs text-white/60">
                    {room.guest?.displayName}
                  </span>
                  {room.result === "guest_win" && (
                    <Crown className="w-4 h-4 text-yellow-400" />
                  )}
                </div>
              </div>

              <div className="flex gap-3 justify-center">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setScreen("mode_select");
                    setRoom(null);
                    setError(null);
                  }}
                  className="px-6 py-2.5 rounded-xl bg-green-700/60 hover:bg-green-600/80 border border-green-500/30 font-semibold text-sm transition-all"
                >
                  New Battle
                </motion.button>
                <Link href="/">
                  <motion.span
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="inline-flex px-6 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 font-semibold text-sm transition-all cursor-pointer"
                  >
                    Back to Home
                  </motion.span>
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Auth modal — opened when unauthenticated user clicks sign-in prompt */}
      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} isDark />
    </div>
  );
}
