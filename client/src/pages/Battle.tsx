import { useState, useEffect, useCallback, useRef } from "react";
import { NavLogo } from "../components/NavLogo";
import ChessNotationRace from "../components/ChessNotationRace";
import ChessClock from "../components/ChessClock";
import confetti from "canvas-confetti";
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
  Clock,
  Ghost,
  Flag,
  Share2,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useChesscomAvatar } from "../hooks/useChesscomAvatar";
import AuthModal from "../components/AuthModal";
import { MobileNavDrawer } from "../components/MobileNavDrawer";
import { SpinBorderButton } from "@/components/ui/spin-border-button";

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
  | "host_time_control"
  | "host_waiting"
  | "join_enter_code"
  | "battle_room"
  | "result";

interface TimeControlOption {
  label: string;
  value: string;
  minutes: number;
  increment: number;
  description: string;
  category: "bullet" | "blitz" | "rapid" | "custom";
}

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
  const accentColor = isLeft ? "#4ade80" : "#94a3b8";
  const glowColor = isLeft ? "oklch(0.55 0.18 142 / 0.35)" : "oklch(0.50 0.04 240 / 0.25)";
  // Resolve avatar: stored URL → chess.com fetch → null (initials)
  const resolvedAvatar = useChesscomAvatar(player);

  return (
    <motion.div
      initial={{ opacity: 0, x: isLeft ? -80 : 80, scale: 0.92 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 180, damping: 24, delay: isLeft ? 0.15 : 0.3 }}
      whileHover={{ scale: 1.025, transition: { duration: 0.2 } }}
      className="relative flex flex-col items-center gap-5 p-7 rounded-3xl border backdrop-blur-xl w-full max-w-[260px] cursor-default group"
      style={{
        background: isLeft
          ? "oklch(0.18 0.06 142 / 0.7)"
          : "oklch(0.16 0.02 240 / 0.7)",
        borderColor: isLeft ? "oklch(0.45 0.15 142 / 0.45)" : "oklch(0.40 0.03 240 / 0.35)",
        boxShadow: `0 0 40px ${glowColor}, inset 0 1px 0 oklch(1 0 0 / 0.06)`,
      }}
    >
      {/* Ambient glow behind card */}
      <div
        className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at 50% 0%, ${glowColor}, transparent 70%)` }}
      />

      {/* Crown / role badge at top */}
      <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1 rounded-full border backdrop-blur-sm"
        style={{
          background: isLeft ? "oklch(0.22 0.08 142 / 0.9)" : "oklch(0.20 0.03 240 / 0.9)",
          borderColor: isLeft ? "oklch(0.45 0.15 142 / 0.5)" : "oklch(0.35 0.03 240 / 0.4)",
        }}
      >
        {isLeft && <Crown className="w-3 h-3 text-yellow-400" />}
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: accentColor }}>
          {isLeft ? "Host" : "Challenger"}
        </span>
      </div>

      {/* Avatar with glow ring */}
      <div className="relative mt-2">
        {/* Animated glow ring */}
        <motion.div
          className="absolute inset-0 rounded-full"
          animate={{ opacity: isReady ? [0.5, 1, 0.5] : 0.3 }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          style={{
            boxShadow: `0 0 0 3px ${accentColor}55, 0 0 20px ${accentColor}33`,
            borderRadius: "50%",
          }}
        />
        {resolvedAvatar ? (
          <img
            src={resolvedAvatar}
            alt={player?.displayName ?? ""}
            className="w-28 h-28 rounded-full object-cover relative z-10"
            style={{ border: `2.5px solid ${accentColor}66` }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <div
            className="w-28 h-28 rounded-full flex items-center justify-center text-3xl font-black relative z-10"
            style={{
              background: isLeft ? "oklch(0.25 0.10 142 / 0.8)" : "oklch(0.22 0.04 240 / 0.8)",
              border: `2.5px solid ${accentColor}55`,
              color: accentColor,
            }}
          >
            {player ? avatarFallback(player.displayName) : (
              <motion.span
                animate={{ opacity: [0.3, 0.7, 0.3] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                ?
              </motion.span>
            )}
          </div>
        )}
        {/* Online dot */}
        {isReady && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", delay: 0.5 }}
            className="absolute bottom-1.5 right-1.5 w-4 h-4 rounded-full bg-green-400 border-2 z-20"
            style={{ borderColor: isLeft ? "oklch(0.18 0.06 142)" : "oklch(0.16 0.02 240)" }}
          />
        )}
      </div>

      {/* Name & username */}
      {player ? (
        <div className="text-center space-y-1">
          <p className="text-white font-bold text-xl leading-tight tracking-tight">
            {player.displayName}
          </p>
          {player.chesscomUsername && (
            <p className="text-white/40 text-xs font-mono">
              @{player.chesscomUsername}
            </p>
          )}
        </div>
      ) : (
        <div className="text-center">
          <p className="text-white/25 text-sm">Waiting…</p>
          <div className="mt-2 flex gap-1.5 justify-center">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: accentColor + "66" }}
                animate={{ opacity: [0.2, 0.8, 0.2] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.25 }}
              />
            ))}
          </div>
        </div>
      )}

      {/* ELO badge */}
      {player?.chesscomElo && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: isLeft ? 0.5 : 0.65 }}
          className="px-4 py-1.5 rounded-full text-sm font-mono font-bold"
          style={{
            background: isLeft ? "oklch(0.25 0.10 142 / 0.5)" : "oklch(0.22 0.04 240 / 0.5)",
            border: `1px solid ${accentColor}33`,
            color: accentColor,
          }}
        >
          {player.chesscomElo} ELO
        </motion.div>
      )}
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Battle() {
  const { user } = useAuth();
  const [screen, setScreen] = useState<Screen>("mode_select");
  const [room, setRoom] = useState<BattleRoom | null>(null);
  // Resolve chess.com avatars for both players
  const hostAvatar = useChesscomAvatar(room?.host ?? null);
  const guestAvatar = useChesscomAvatar(room?.guest ?? null);
  const [joinCode, setJoinCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [polling, setPolling] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);

  // ── Join-code preservation across guest → account upgrade ──────────────────
  // When a guest opens the AuthModal while a join code is entered, we stash the
  // code in sessionStorage so AuthModal can restore it after registration.
  const PENDING_JOIN_KEY = "otb_pending_join_code";

  function openAuthForUpgrade() {
    if (joinCode.trim()) {
      sessionStorage.setItem(PENDING_JOIN_KEY, joinCode.trim());
    }
    setAuthOpen(true);
  }

  // After AuthModal closes (successful registration), restore the stashed code.
  function handleAuthClose() {
    setAuthOpen(false);
    const pending = sessionStorage.getItem(PENDING_JOIN_KEY);
    if (pending) {
      sessionStorage.removeItem(PENDING_JOIN_KEY);
      setJoinCode(pending.toUpperCase());
      setScreen("join_enter_code");
    }
  }
  const [selectedTimeControl, setSelectedTimeControl] = useState<TimeControlOption | null>(null);
  const [victoryFlash, setVictoryFlash] = useState(false);
  const confettiFired = useRef(false);

  // ── Clock flag-fall suggestion ─────────────────────────────────────────────
  // Stores which side ran out of time so we can surface a result suggestion.
  const [clockFlagFallen, setClockFlagFallen] = useState<"host" | "guest" | null>(null);
  const [flagSuggestionDismissed, setFlagSuggestionDismissed] = useState(false);

  function handleClockFlagFall(side: "host" | "guest") {
    setClockFlagFallen(side);
    setFlagSuggestionDismissed(false);
  }

  // ── Victory confetti & flash ───────────────────────────────────────────────
  useEffect(() => {
    if (screen !== "result" || !room?.result || confettiFired.current) return;
    confettiFired.current = true;

    if (room.result === "draw") {
      // Soft single-centre burst for draw
      confetti({
        particleCount: 60,
        spread: 70,
        origin: { x: 0.5, y: 0.6 },
        colors: ["#e2e8f0", "#94a3b8", "#cbd5e1", "#f8fafc"],
        scalar: 0.9,
        gravity: 0.8,
      });
    } else {
      // Win: two-cannon burst from bottom corners
      setVictoryFlash(true);
      setTimeout(() => setVictoryFlash(false), 600);

      const fire = (originX: number, angle: number) =>
        confetti({
          particleCount: 80,
          angle,
          spread: 55,
          origin: { x: originX, y: 0.95 },
          colors: ["#4ade80", "#22c55e", "#facc15", "#fbbf24", "#ffffff", "#86efac"],
          scalar: 1.1,
          gravity: 0.9,
          drift: 0.1,
        });

      fire(0.15, 65);
      setTimeout(() => fire(0.85, 115), 150);
      setTimeout(() => fire(0.5, 90), 400);
    }
  }, [screen, room?.result]);

  // ── Time control presets ───────────────────────────────────────────────────
  const TIME_CONTROLS: TimeControlOption[] = [
    { label: "1+0", value: "1+0", minutes: 1, increment: 0, description: "Bullet", category: "bullet" },
    { label: "2+1", value: "2+1", minutes: 2, increment: 1, description: "Bullet", category: "bullet" },
    { label: "3+0", value: "3+0", minutes: 3, increment: 0, description: "Blitz", category: "blitz" },
    { label: "3+2", value: "3+2", minutes: 3, increment: 2, description: "Blitz", category: "blitz" },
    { label: "5+0", value: "5+0", minutes: 5, increment: 0, description: "Blitz", category: "blitz" },
    { label: "5+3", value: "5+3", minutes: 5, increment: 3, description: "Blitz", category: "blitz" },
    { label: "10+0", value: "10+0", minutes: 10, increment: 0, description: "Rapid", category: "rapid" },
    { label: "15+10", value: "15+10", minutes: 15, increment: 10, description: "Rapid", category: "rapid" },
    { label: "30+0", value: "30+0", minutes: 30, increment: 0, description: "Rapid", category: "rapid" },
  ];

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

    // ── Host a battle ──────────────────────────────────────────────────────
  function handleHost() {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    if (user.isGuest) {
      setError("Guest accounts cannot host battles. Create a free account to host.");
      return;
    }
    setError(null);
    setScreen("host_time_control");
  }

  // ── Create room after time control is selected ─────────────────────────────
  async function handleCreateRoom(tc: TimeControlOption) {
    setSelectedTimeControl(tc);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/battles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timeControl: tc.value }),
      });
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

  // ── Report result ─────────────────────────────────────────────────────────────
  const [rematchLoading, setRematchLoading] = useState(false);

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

   // ── Rematch ───────────────────────────────────────────────────────────────────
  // Creates a new battle room with the same time control and navigates to host_waiting.
  async function handleRematch() {
    if (!room?.timeControl) return;
    setRematchLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/battles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timeControl: room.timeControl }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Failed to create rematch room");
      }
      const { code } = await res.json();
      const roomRes = await fetch(`/api/battles/${code}`);
      const roomData: BattleRoom = await roomRes.json();
      // Reset transient state
      confettiFired.current = false;
      setClockFlagFallen(null);
      setFlagSuggestionDismissed(false);
      setError(null);
      setRoom(roomData);
      setScreen("host_waiting");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setRematchLoading(false);
    }
  }

  // ── Copy code ─────────────────────────────────────────────────────────────
  function copyCode() {
    if (!room?.code) return;
    navigator.clipboard.writeText(room.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ── Native share / clipboard fallback ───────────────────────────────────────────
  const [shared, setShared] = useState(false);

  async function handleShare() {
    if (!joinUrl) return;
    const shareData = {
      title: "Chess Battle Challenge",
      text: `Join my OTB chess battle! Code: ${room?.code}`,
      url: joinUrl,
    };
    try {
      if (navigator.share && navigator.canShare?.(shareData)) {
        await navigator.share(shareData);
      } else {
        // Fallback: copy the link to clipboard
        await navigator.clipboard.writeText(joinUrl);
        setShared(true);
        setTimeout(() => setShared(false), 2500);
      }
    } catch {
      // User cancelled share or clipboard failed — silently ignore
    }
  }

  const joinUrl = room
    ? `${window.location.origin}/battle?join=${room.code}`
    : "";

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0a1a0e] text-white flex flex-col relative overflow-hidden">
      {/* Victory flash overlay */}
      <AnimatePresence>
        {victoryFlash && (
          <motion.div
            key="flash"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.18 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 pointer-events-none z-50"
            style={{ background: "oklch(0.55 0.18 142)" }}
          />
        )}
      </AnimatePresence>
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/5">
        <NavLogo />
        <div className="flex items-center gap-2 text-white/50 text-sm">
          <Swords className="w-4 h-4" />
          <span>Battle</span>
        </div>
        <div className="flex items-center gap-2">
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
          <MobileNavDrawer currentPage="Battle" />
        </div>
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
                  <span>Sign in or continue as guest to join a battle</span>
                  <ChevronRight className="w-3 h-3 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                </button>
              )}

              {user?.isGuest && (
                <div className="mb-6 flex items-center justify-between gap-3 text-sm bg-amber-900/20 border border-amber-500/20 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-2 text-amber-300">
                    <Ghost className="w-4 h-4 shrink-0" />
                    <span>Playing as guest &mdash; join battles below. <span className="text-amber-200/60">History won&apos;t be saved.</span></span>
                  </div>
                  <button
                    onClick={openAuthForUpgrade}
                    className="shrink-0 text-xs font-semibold text-amber-300 hover:text-amber-200 underline underline-offset-2 transition"
                  >
                    Upgrade
                  </button>
                </div>
              )}

              {/* History link — only shown to signed-in non-guest users */}
              {user && !user.isGuest && (
                <Link href="/battle/history">
                  <button className="w-full flex items-center justify-center gap-2 text-xs text-white/30 hover:text-green-400 transition-colors mb-6">
                    <Trophy className="w-3.5 h-3.5" />
                    View Battle History
                  </button>
                </Link>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Host */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleHost}
                  disabled={loading || !user || user.isGuest}
                  title={user?.isGuest ? "Create a free account to host battles" : undefined}
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
                    if (!user) { openAuthForUpgrade(); return; }
                    setError(null);
                    setScreen("join_enter_code");
                  }}
                  disabled={false}
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

          {/* ── Host: Time Control Selector ──────────────────────────────── */}
          {screen === "host_time_control" && (
            <motion.div
              key="host_time_control"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-lg"
            >
              <div className="text-center mb-8">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="mb-4 flex justify-center"
                >
                  <div className="w-14 h-14 rounded-2xl bg-green-900/40 border border-green-500/30 flex items-center justify-center">
                    <Clock className="w-7 h-7 text-green-400" />
                  </div>
                </motion.div>
                <h2 className="text-3xl font-black tracking-tight mb-2">Choose Time Control</h2>
                <p className="text-white/40 text-sm">Select the time format for this battle.</p>
              </div>

              {error && (
                <div className="mb-6 flex items-center gap-2 text-red-400 text-sm bg-red-900/20 border border-red-500/20 rounded-xl px-4 py-3">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

              {/* Category groups */}
              {(["bullet", "blitz", "rapid"] as const).map((cat) => (
                <div key={cat} className="mb-6">
                  <p className="text-xs font-bold uppercase tracking-widest text-white/30 mb-3 px-1">
                    {cat === "bullet" ? "⚡ Bullet" : cat === "blitz" ? "🔥 Blitz" : "⏱ Rapid"}
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {TIME_CONTROLS.filter((tc) => tc.category === cat).map((tc) => (
                      <motion.button
                        key={tc.value}
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={() => handleCreateRoom(tc)}
                        disabled={loading}
                        className="flex flex-col items-center gap-1 py-4 px-3 rounded-xl border border-white/10 bg-white/5 hover:border-green-500/40 hover:bg-green-900/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed group"
                      >
                        <span className="text-xl font-black text-white group-hover:text-green-300 transition-colors">
                          {tc.label}
                        </span>
                        <span className="text-xs text-white/30">
                          {tc.increment > 0 ? `+${tc.increment}s` : "no inc."}
                        </span>
                        {loading && selectedTimeControl?.value === tc.value && (
                          <Loader2 className="w-3 h-3 text-green-400 animate-spin mt-0.5" />
                        )}
                      </motion.button>
                    ))}
                  </div>
                </div>
              ))}
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

              {/* Time control badge */}
              {room.timeControl && (
                <div className="flex items-center justify-center gap-2 mb-6">
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-900/40 border border-green-500/20 text-green-400 text-xs font-bold">
                    <Clock className="w-3 h-3" />
                    {room.timeControl}
                  </span>
                </div>
              )}

              {/* Waiting indicator */}
              <div className="flex items-center justify-center gap-2 text-white/40 text-sm mb-6">
                {polling && (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                )}
                <span>Waiting for opponent to join…</span>
              </div>

              {/* Share / copy link button */}
              <motion.button
                whileHover={{ scale: 1.03, boxShadow: "0 0 20px oklch(0.55 0.18 142 / 0.3)" }}
                whileTap={{ scale: 0.97 }}
                onClick={handleShare}
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all mx-auto"
                style={{
                  background: shared
                    ? "oklch(0.22 0.12 142 / 0.9)"
                    : "oklch(0.18 0.08 142 / 0.7)",
                  border: "1.5px solid oklch(0.45 0.15 142 / 0.5)",
                  color: shared ? "#4ade80" : "oklch(0.70 0.12 142)",
                }}
              >
                {shared ? (
                  <>
                    <Check className="w-4 h-4" />
                    Link Copied!
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4" />
                    Share Invite Link
                  </>
                )}
              </motion.button>
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

              {/* Guest upgrade nudge — code is stashed so it survives registration */}
              {user?.isGuest && (
                <p className="mt-5 text-xs text-white/30">
                  Want your result saved?{" "}
                  <button
                    onClick={openAuthForUpgrade}
                    className="text-amber-400 hover:text-amber-300 underline underline-offset-2 transition"
                  >
                    Create a free account
                  </button>
                  {" "}&mdash; your join code will be kept.
                </p>
              )}
            </motion.div>
          )}

          {/* ── Battle Room ──────────────────────────────────────────────── */}
          {screen === "battle_room" && room && (
            <motion.div
              key="battle_room"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full max-w-3xl flex flex-col items-center"
            >
              {/* Ambient background glows */}
              <div className="pointer-events-none fixed inset-0 overflow-hidden">
                <div className="absolute left-[15%] top-1/2 -translate-y-1/2 w-72 h-72 rounded-full opacity-20 blur-3xl"
                  style={{ background: "oklch(0.55 0.18 142)" }} />
                <div className="absolute right-[15%] top-1/2 -translate-y-1/2 w-72 h-72 rounded-full opacity-12 blur-3xl"
                  style={{ background: "oklch(0.50 0.04 240)" }} />
              </div>

              {/* VS Header */}
              <div className="text-center mb-10 relative z-10">
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5, duration: 0.6, ease: "easeOut" }}
                >
                  <motion.h2
                    className="text-7xl font-black tracking-tight leading-none"
                    style={{
                      color: "#4ade80",
                      textShadow: "0 0 40px oklch(0.55 0.18 142 / 0.6), 0 0 80px oklch(0.55 0.18 142 / 0.3)",
                    }}
                    animate={{ textShadow: [
                      "0 0 40px oklch(0.55 0.18 142 / 0.6), 0 0 80px oklch(0.55 0.18 142 / 0.3)",
                      "0 0 60px oklch(0.55 0.18 142 / 0.9), 0 0 120px oklch(0.55 0.18 142 / 0.5)",
                      "0 0 40px oklch(0.55 0.18 142 / 0.6), 0 0 80px oklch(0.55 0.18 142 / 0.3)",
                    ]}}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  >
                    VS
                  </motion.h2>
                  <p className="text-white/30 text-sm mt-2 tracking-wide">
                    Both players are ready — let the battle begin
                  </p>
                  {room.timeControl && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.7 }}
                      className="flex items-center justify-center gap-1.5 mt-3"
                    >
                      <span className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border text-xs font-bold font-mono"
                        style={{
                          background: "oklch(0.22 0.08 142 / 0.5)",
                          borderColor: "oklch(0.45 0.15 142 / 0.4)",
                          color: "#4ade80",
                        }}
                      >
                        <Clock className="w-3 h-3" />
                        {room.timeControl}
                      </span>
                    </motion.div>
                  )}
                </motion.div>
              </div>

              {/* Player cards + VS divider */}
              <div className="flex items-center justify-center gap-6 mb-8 w-full relative z-10">
                <PlayerCard player={room.host} side="left" isReady={!!room.host} />

                {/* Central VS divider */}
                <div className="flex flex-col items-center gap-3 shrink-0">
                  <motion.div
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: "spring", stiffness: 200, delay: 0.45 }}
                    className="relative"
                  >
                    {/* Pulse ring */}
                    <motion.div
                      className="absolute inset-0 rounded-full"
                      animate={{ scale: [1, 1.5, 1], opacity: [0.4, 0, 0.4] }}
                      transition={{ duration: 2.5, repeat: Infinity, ease: "easeOut" }}
                      style={{ background: "oklch(0.55 0.18 142 / 0.3)" }}
                    />
                    <div
                      className="w-14 h-14 rounded-full flex items-center justify-center relative z-10"
                      style={{
                        background: "oklch(0.20 0.08 142 / 0.8)",
                        border: "1.5px solid oklch(0.45 0.15 142 / 0.5)",
                        boxShadow: "0 0 20px oklch(0.55 0.18 142 / 0.3)",
                      }}
                    >
                      <Swords className="w-6 h-6 text-green-400" />
                    </div>
                  </motion.div>
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    className="text-white/20 text-[10px] font-mono tracking-widest"
                  >
                    #{room.code}
                  </motion.span>
                </div>

                <PlayerCard player={room.guest} side="right" isReady={!!room.guest} />
              </div>

              {/* Chess Clock */}
              {room.guest && room.timeControl && (
                <div className="w-full relative z-10 mb-8">
                  <ChessClock
                    timeControl={room.timeControl}
                    hostName={room.host?.displayName ?? "Host"}
                    guestName={room.guest?.displayName ?? "Guest"}
                    hostAvatarUrl={hostAvatar ?? room.host?.avatarUrl ?? undefined}
                    guestAvatarUrl={guestAvatar ?? room.guest?.avatarUrl ?? undefined}
                    onFlagFall={handleClockFlagFall}
                  />
                </div>
              )}

              {/* ── Flag-fall result suggestion banner ──────────────────────── */}
              <AnimatePresence>
                {clockFlagFallen && !flagSuggestionDismissed && room.guest && (
                  <motion.div
                    key="flag-suggestion"
                    initial={{ opacity: 0, y: -16, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -12, scale: 0.97 }}
                    transition={{ type: "spring", stiffness: 320, damping: 28 }}
                    className="w-full max-w-md relative z-20 mb-4"
                  >
                    <div
                      className="rounded-2xl p-5"
                      style={{
                        background: "oklch(0.14 0.06 25 / 0.95)",
                        border: "1.5px solid oklch(0.50 0.18 25 / 0.55)",
                        boxShadow: "0 0 32px oklch(0.45 0.18 25 / 0.25)",
                      }}
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <Flag className="w-4 h-4 text-red-400 shrink-0" />
                        <p className="text-sm font-bold text-red-300">
                          {clockFlagFallen === "host"
                            ? `${room.host?.displayName ?? "Host"}'s flag fell — ${room.guest?.displayName ?? "Guest"} wins on time`
                            : `${room.guest?.displayName ?? "Guest"}'s flag fell — ${room.host?.displayName ?? "Host"} wins on time`
                          }
                        </p>
                      </div>
                      <p className="text-xs text-white/40 mb-4">
                        Confirm the result or dismiss to record it manually.
                      </p>
                      <div className="flex gap-2">
                        {user?.id === room.hostId ? (
                          <motion.button
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.96 }}
                            disabled={loading}
                            onClick={() => {
                              handleResult(clockFlagFallen === "host" ? "guest_win" : "host_win");
                              setFlagSuggestionDismissed(true);
                            }}
                            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-40"
                            style={{
                              background: "oklch(0.28 0.14 25 / 0.8)",
                              border: "1.5px solid oklch(0.50 0.18 25 / 0.6)",
                              color: "#fca5a5",
                            }}
                          >
                            <Trophy className="w-4 h-4 text-yellow-400" />
                            Confirm Result
                          </motion.button>
                        ) : (
                          <div className="flex-1 flex items-center justify-center py-3 rounded-xl text-xs text-white/30"
                            style={{ background: "oklch(0.12 0.02 240 / 0.5)", border: "1px solid oklch(0.25 0.03 240 / 0.3)" }}>
                            Waiting for host to confirm…
                          </div>
                        )}
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setFlagSuggestionDismissed(true)}
                          className="px-4 py-3 rounded-xl text-xs font-medium"
                          style={{
                            background: "oklch(0.16 0.02 240 / 0.6)",
                            border: "1px solid oklch(0.30 0.03 240 / 0.4)",
                            color: "oklch(0.55 0.04 240)",
                          }}
                        >
                          Dismiss
                        </motion.button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Result reporting (host only) */}
              {user?.id === room.hostId && room.guest && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7, duration: 0.5 }}
                  className="w-full max-w-md relative z-10"
                >
                  <p className="text-white/30 text-xs text-center uppercase tracking-widest mb-5 font-medium">
                    Report result when the game is over
                  </p>
                  <div className="flex flex-col gap-3">
                    <motion.button
                      whileHover={{ scale: 1.02, boxShadow: "0 0 24px oklch(0.55 0.18 142 / 0.4)" }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => handleResult("host_win")}
                      disabled={loading}
                      className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-bold text-base transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{
                        background: "oklch(0.30 0.12 142 / 0.7)",
                        border: "1.5px solid oklch(0.45 0.15 142 / 0.5)",
                        color: "#4ade80",
                      }}
                    >
                      <Trophy className="w-5 h-5 text-yellow-400" />
                      I Won
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02, boxShadow: "0 0 24px oklch(0.50 0.04 240 / 0.3)" }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => handleResult("guest_win")}
                      disabled={loading}
                      className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-bold text-base transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{
                        background: "oklch(0.18 0.03 240 / 0.6)",
                        border: "1.5px solid oklch(0.40 0.03 240 / 0.4)",
                        color: "#94a3b8",
                      }}
                    >
                      <Trophy className="w-5 h-5 text-white/40" />
                      Opponent Won
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02, boxShadow: "0 0 20px oklch(0.75 0.12 80 / 0.25)" }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => handleResult("draw")}
                      disabled={loading}
                      className="w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl font-semibold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{
                        background: "oklch(0.18 0.04 80 / 0.5)",
                        border: "1.5px solid oklch(0.40 0.06 80 / 0.35)",
                        color: "oklch(0.75 0.12 80)",
                      }}
                    >
                      <Handshake className="w-4 h-4" />
                      Draw
                    </motion.button>
                  </div>
                </motion.div>
              )}

              {/* Chess Notation Race */}
              {room.guest && (
                <ChessNotationRace
                  battleCode={room.code}
                  hostPlayer={room.host}
                  guestPlayer={room.guest}
                  isHost={user?.id === room.hostId}
                  opponentElo={user?.id === room.hostId ? room.guest?.chesscomElo : room.host?.chesscomElo}
                />
              )}

              {/* Guest view — waiting for host to report */}
              {user?.id !== room.hostId && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8 }}
                  className="flex items-center gap-2 text-white/25 text-sm relative z-10"
                >
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Waiting for host to report the result…
                </motion.div>
              )}
            </motion.div>
          )}

          {/* ── Result Screen ────────────────────────────────────────────── */}
          {screen === "result" && room && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="w-full max-w-md text-center relative z-10"
            >
              {/* Trophy icon — spring bounce entrance */}
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 16, delay: 0.15 }}
                className="flex justify-center mb-6"
              >
                <div
                  className="w-24 h-24 rounded-full flex items-center justify-center relative"
                  style={{
                    background: room.result === "draw"
                      ? "oklch(0.22 0.04 240 / 0.6)"
                      : "oklch(0.28 0.10 80 / 0.5)",
                    border: room.result === "draw"
                      ? "1.5px solid oklch(0.45 0.04 240 / 0.4)"
                      : "1.5px solid oklch(0.65 0.15 80 / 0.5)",
                    boxShadow: room.result === "draw"
                      ? "0 0 30px oklch(0.50 0.04 240 / 0.2)"
                      : "0 0 40px oklch(0.75 0.15 80 / 0.4)",
                  }}
                >
                  {/* Pulse ring on win */}
                  {room.result !== "draw" && (
                    <motion.div
                      className="absolute inset-0 rounded-full"
                      animate={{ scale: [1, 1.6, 1], opacity: [0.5, 0, 0.5] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
                      style={{ background: "oklch(0.75 0.15 80 / 0.25)" }}
                    />
                  )}
                  <Trophy
                    className="w-11 h-11 relative z-10"
                    style={{ color: room.result === "draw" ? "#94a3b8" : "#facc15" }}
                  />
                </div>
              </motion.div>

              {/* Winner name */}
              <motion.h2
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.5 }}
                className="text-4xl font-black mb-2 tracking-tight"
                style={{
                  color: room.result === "draw" ? "#e2e8f0" : "#4ade80",
                  textShadow: room.result !== "draw"
                    ? "0 0 30px oklch(0.55 0.18 142 / 0.5)"
                    : "none",
                }}
              >
                {room.result === "draw"
                  ? "It's a Draw!"
                  : room.result === "host_win"
                  ? `${room.host?.displayName ?? "Host"} Wins!`
                  : `${room.guest?.displayName ?? "Challenger"} Wins!`}
              </motion.h2>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.45 }}
                className="text-white/30 text-sm mb-10"
              >
                Battle recorded on both player profiles.
              </motion.p>

              {/* Mini player cards */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.4 }}
                className="flex items-center justify-center gap-6 mb-10"
              >
                {/* Host */}
                <div className="flex flex-col items-center gap-2">
                  {room.result === "host_win" && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", delay: 0.6 }}
                    >
                      <Crown className="w-5 h-5 text-yellow-400 mb-0.5" />
                    </motion.div>
                  )}
                  {hostAvatar ? (
                    <img
                      src={hostAvatar}
                      className="w-16 h-16 rounded-full object-cover"
                      style={{
                        border: room.result === "host_win"
                          ? "2.5px solid #4ade80"
                          : "2px solid oklch(0.40 0.05 142 / 0.3)",
                        boxShadow: room.result === "host_win"
                          ? "0 0 16px oklch(0.55 0.18 142 / 0.5)"
                          : "none",
                        opacity: room.result === "guest_win" ? 0.4 : 1,
                      }}
                      alt=""
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                    />
                  ) : (
                    <div
                      className="w-16 h-16 rounded-full flex items-center justify-center font-bold text-lg"
                      style={{
                        background: "oklch(0.22 0.08 142 / 0.7)",
                        border: room.result === "host_win" ? "2.5px solid #4ade80" : "2px solid oklch(0.40 0.05 142 / 0.3)",
                        color: "#4ade80",
                        opacity: room.result === "guest_win" ? 0.4 : 1,
                      }}
                    >
                      {avatarFallback(room.host?.displayName ?? "H")}
                    </div>
                  )}
                  <span className="text-xs text-white/50">{room.host?.displayName}</span>
                </div>

                <span className="text-white/15 font-bold text-sm">vs</span>

                {/* Guest */}
                <div className="flex flex-col items-center gap-2">
                  {room.result === "guest_win" && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", delay: 0.6 }}
                    >
                      <Crown className="w-5 h-5 text-yellow-400 mb-0.5" />
                    </motion.div>
                  )}
                  {guestAvatar ? (
                    <img
                      src={guestAvatar}
                      className="w-16 h-16 rounded-full object-cover"
                      style={{
                        border: room.result === "guest_win"
                          ? "2.5px solid #4ade80"
                          : "2px solid oklch(0.35 0.03 240 / 0.3)",
                        boxShadow: room.result === "guest_win"
                          ? "0 0 16px oklch(0.55 0.18 142 / 0.5)"
                          : "none",
                        opacity: room.result === "host_win" ? 0.4 : 1,
                      }}
                      alt=""
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                    />
                  ) : (
                    <div
                      className="w-16 h-16 rounded-full flex items-center justify-center font-bold text-lg"
                      style={{
                        background: "oklch(0.20 0.03 240 / 0.7)",
                        border: room.result === "guest_win" ? "2.5px solid #4ade80" : "2px solid oklch(0.35 0.03 240 / 0.3)",
                        color: "#94a3b8",
                        opacity: room.result === "host_win" ? 0.4 : 1,
                      }}
                    >
                      {avatarFallback(room.guest?.displayName ?? "G")}
                    </div>
                  )}
                  <span className="text-xs text-white/50">{room.guest?.displayName}</span>
                </div>
              </motion.div>

              {/* Rematch hint for guest */}
              {user?.id !== room.hostId && room.guest && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                  className="text-xs text-white/30 mb-4 text-center"
                >
                  Ask the host to start a rematch.
                </motion.p>
              )}

              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.65 }}
                className="flex flex-wrap gap-3 justify-center"
              >
                {/* Rematch — host only */}
                {user?.id === room.hostId && room.timeControl && (
                  <motion.button
                    whileHover={{ scale: 1.03, boxShadow: "0 0 24px oklch(0.55 0.18 142 / 0.45)" }}
                    whileTap={{ scale: 0.97 }}
                    disabled={rematchLoading}
                    onClick={handleRematch}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      background: "oklch(0.22 0.12 142 / 0.85)",
                      border: "1.5px solid oklch(0.50 0.18 142 / 0.6)",
                      color: "#4ade80",
                      boxShadow: "0 0 16px oklch(0.45 0.15 142 / 0.25)",
                    }}
                  >
                    {rematchLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                    Rematch
                  </motion.button>
                )}

                <motion.button
                  whileHover={{ scale: 1.03, boxShadow: "0 0 20px oklch(0.55 0.18 142 / 0.3)" }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    confettiFired.current = false;
                    setScreen("mode_select");
                    setRoom(null);
                    setError(null);
                  }}
                  className="px-6 py-2.5 rounded-xl font-semibold text-sm transition-all"
                  style={{
                    background: "oklch(0.28 0.10 142 / 0.7)",
                    border: "1.5px solid oklch(0.45 0.15 142 / 0.4)",
                    color: "#4ade80",
                  }}
                >
                  New Battle
                </motion.button>
                <SpinBorderButton
                  variant="glass"
                  onClick={() => window.location.href = "/"}
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Home
                </SpinBorderButton>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Auth modal — opened when unauthenticated user clicks sign-in prompt */}
      <AuthModal isOpen={authOpen} onClose={handleAuthClose} isDark />
    </div>
  );
}
