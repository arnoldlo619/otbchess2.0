/**
 * ChessClock
 *
 * Inline dual-timer chess clock for the battle room.
 * Includes a "Full Screen" button that opens FullScreenClock — a landscape
 * overlay designed to sit flat on the table between both players.
 *
 * State (hostMs, guestMs, active, paused, flagFallen) is owned here and
 * passed into FullScreenClock as initial values; FullScreenClock reports
 * every change back via onStateChange so the inline view stays in sync.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Pause, Play, RotateCcw, Flag, Volume2, VolumeX, Maximize2 } from "lucide-react";
import { useClockSounds } from "../hooks/useClockSounds";
import FullScreenClock from "./FullScreenClock";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChessClockProps {
  timeControl: string;
  hostName: string;
  guestName: string;
  hostAvatarUrl?: string | null;
  guestAvatarUrl?: string | null;
}

type ActiveSide = "host" | "guest" | null;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseTimeControl(tc: string): { minutes: number; increment: number } {
  const parts = tc.split("+");
  return {
    minutes: parseInt(parts[0], 10) || 5,
    increment: parseInt(parts[1] ?? "0", 10) || 0,
  };
}

function formatTime(ms: number): string {
  if (ms <= 0) return "0:00";
  if (ms < 10_000) {
    const s = Math.floor(ms / 1000);
    const d = Math.floor((ms % 1000) / 100);
    return `0:${String(s).padStart(2, "0")}.${d}`;
  }
  const m = Math.floor(ms / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function avatarFallback(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ChessClock({
  timeControl,
  hostName,
  guestName,
  hostAvatarUrl,
  guestAvatarUrl,
}: ChessClockProps) {
  const { minutes, increment } = parseTimeControl(timeControl);
  const initialMs = minutes * 60_000;

  // ── Clock state (single source of truth) ─────────────────────────────────────
  const [hostMs, setHostMs] = useState(initialMs);
  const [guestMs, setGuestMs] = useState(initialMs);
  const [active, setActive] = useState<ActiveSide>(null);
  const [paused, setPaused] = useState(false);
  const [flagFallen, setFlagFallen] = useState<"host" | "guest" | null>(null);

  // ── Move counters ─────────────────────────────────────────────────────────────
  const [hostMoves, setHostMoves] = useState(0);
  const [guestMoves, setGuestMoves] = useState(0);

  // ── Full-screen overlay visibility ────────────────────────────────────────────
  const [fullScreen, setFullScreen] = useState(false);

  // ── Sounds ────────────────────────────────────────────────────────────────────
  const { tap, warningTick, flagAlarm, muted, toggleMute } = useClockSounds();

  const lastTickRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastWarnSecRef = useRef(-1);
  const flagAlarmFiredRef = useRef(false);

  // ── Tick loop (only runs when inline clock is visible) ────────────────────────
  const tick = useCallback(() => {
    if (!lastTickRef.current) lastTickRef.current = performance.now();
    const now = performance.now();
    const delta = now - lastTickRef.current;
    lastTickRef.current = now;

    if (active === "host") {
      setHostMs((prev) => {
        const next = Math.max(0, prev - delta);
        if (next === 0 && prev > 0) setFlagFallen("host");
        return next;
      });
    } else if (active === "guest") {
      setGuestMs((prev) => {
        const next = Math.max(0, prev - delta);
        if (next === 0 && prev > 0) setFlagFallen("guest");
        return next;
      });
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [active]);

  useEffect(() => {
    // Pause inline tick while full-screen overlay is open (it handles its own loop)
    if (fullScreen) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastTickRef.current = null;
      return;
    }
    if (active && !paused && !flagFallen) {
      lastTickRef.current = performance.now();
      rafRef.current = requestAnimationFrame(tick);
    } else {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastTickRef.current = null;
    }
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [active, paused, flagFallen, tick, fullScreen]);

  // ── Warning tick ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (fullScreen || !active || paused || flagFallen) return;
    const ms = active === "host" ? hostMs : guestMs;
    if (ms <= 0 || ms >= 10_000) { lastWarnSecRef.current = -1; return; }
    const sec = Math.ceil(ms / 1000);
    if (sec !== lastWarnSecRef.current) {
      lastWarnSecRef.current = sec;
      warningTick();
    }
  }, [fullScreen, active, paused, flagFallen, hostMs, guestMs, warningTick]);

  // ── Flag alarm ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (flagFallen && !flagAlarmFiredRef.current) {
      flagAlarmFiredRef.current = true;
      flagAlarm();
    }
    if (!flagFallen) flagAlarmFiredRef.current = false;
  }, [flagFallen, flagAlarm]);

  // ── Handlers ──────────────────────────────────────────────────────────────────
  function handleTap(side: "host" | "guest") {
    if (flagFallen || paused) return;
    if (active === null) {
      tap();
      setActive(side === "host" ? "guest" : "host");
      return;
    }
    if (active !== side) return;
    tap();
    if (side === "host") {
      setHostMs((p) => p + increment * 1000);
      setHostMoves((m) => m + 1);
      setActive("guest");
    } else {
      setGuestMs((p) => p + increment * 1000);
      setGuestMoves((m) => m + 1);
      setActive("host");
    }
  }

  function handlePauseResume() {
    if (flagFallen || active === null) return;
    setPaused((p) => !p);
  }

  function handleReset() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setHostMs(initialMs);
    setGuestMs(initialMs);
    setActive(null);
    setPaused(false);
    setFlagFallen(null);
    setHostMoves(0);
    setGuestMoves(0);
    lastTickRef.current = null;
    lastWarnSecRef.current = -1;
    flagAlarmFiredRef.current = false;
  }

  // ── Sync state back from FullScreenClock ──────────────────────────────────────
  function handleFsStateChange(state: {
    hostMs: number;
    guestMs: number;
    active: ActiveSide;
    paused: boolean;
    flagFallen: "host" | "guest" | null;
    hostMoves: number;
    guestMoves: number;
  }) {
    setHostMs(state.hostMs);
    setGuestMs(state.guestMs);
    setActive(state.active);
    setPaused(state.paused);
    setFlagFallen(state.flagFallen);
    setHostMoves(state.hostMoves);
    setGuestMoves(state.guestMoves);
  }

  // ── Derived ───────────────────────────────────────────────────────────────────
  const hostLow = hostMs < 10_000 && hostMs > 0;
  const guestLow = guestMs < 10_000 && guestMs > 0;
  const hostFlag = flagFallen === "host";
  const guestFlag = flagFallen === "guest";
  const notStarted = active === null && !flagFallen;

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Full-screen overlay ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {fullScreen && (
          <motion.div
            key="fs-clock"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <FullScreenClock
              timeControl={timeControl}
              hostName={hostName}
              guestName={guestName}
              hostAvatarUrl={hostAvatarUrl}
              guestAvatarUrl={guestAvatarUrl}
              onExit={() => setFullScreen(false)}
              initialHostMs={hostMs}
              initialGuestMs={guestMs}
              initialActive={active}
              initialPaused={paused}
              initialHostMoves={hostMoves}
              initialGuestMoves={guestMoves}
              onStateChange={handleFsStateChange}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Inline clock ────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.85, duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-3xl relative z-10"
      >
        {/* Section label row */}
        <div className="flex items-center justify-center gap-2 mb-4">
          <div className="h-px flex-1" style={{ background: "oklch(0.35 0.04 240 / 0.3)" }} />
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/25">
            Chess Clock · {timeControl}
          </span>
          <div className="h-px flex-1" style={{ background: "oklch(0.35 0.04 240 / 0.3)" }} />

          {/* Full-screen button */}
          <motion.button
            onClick={() => setFullScreen(true)}
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.88 }}
            title="Full-screen clock"
            className="ml-1 p-1.5 rounded-full transition-colors"
            style={{
              background: "oklch(0.18 0.06 142 / 0.5)",
              border: "1px solid oklch(0.38 0.12 142 / 0.4)",
            }}
          >
            <Maximize2 className="w-3 h-3 text-green-400/80" />
          </motion.button>

          {/* Mute toggle */}
          <motion.button
            onClick={toggleMute}
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.88 }}
            title={muted ? "Unmute sounds" : "Mute sounds"}
            className="p-1.5 rounded-full transition-colors"
            style={{
              background: muted ? "oklch(0.20 0.04 240 / 0.5)" : "oklch(0.22 0.08 142 / 0.4)",
              border: `1px solid ${muted ? "oklch(0.30 0.04 240 / 0.4)" : "oklch(0.40 0.12 142 / 0.35)"}`,
            }}
          >
            {muted
              ? <VolumeX className="w-3 h-3 text-white/30" />
              : <Volume2 className="w-3 h-3 text-green-400/70" />
            }
          </motion.button>
        </div>

        {/* Clock body */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: "oklch(0.10 0.02 240 / 0.95)",
            border: "1px solid oklch(0.25 0.04 240 / 0.5)",
            boxShadow: "0 8px 40px oklch(0.05 0.02 240 / 0.6)",
          }}
        >
          <div className="grid grid-cols-[1fr_auto_1fr]">

            {/* ── Host panel ─────────────────────────────────────────────── */}
            <motion.button
              onClick={() => handleTap("host")}
              disabled={!!flagFallen || (active !== null && active !== "host" && !paused)}
              whileTap={active === "host" && !paused ? { scale: 0.97 } : {}}
              className="relative flex flex-col items-center justify-center gap-3 p-8 transition-colors duration-200 select-none focus:outline-none"
              style={{
                background: hostFlag
                  ? "oklch(0.20 0.10 25 / 0.9)"
                  : active === "host" && !paused
                  ? "oklch(0.16 0.06 142 / 0.9)"
                  : "transparent",
                cursor: active === "host" && !paused && !flagFallen ? "pointer" : "default",
                borderRight: "1px solid oklch(0.20 0.03 240 / 0.4)",
              }}
            >
              <AnimatePresence>
                {active === "host" && !paused && !flagFallen && (
                  <motion.div key="host-bar" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} exit={{ scaleX: 0 }}
                    className="absolute top-0 left-0 right-0 h-0.5 origin-left"
                    style={{ background: "oklch(0.55 0.18 142)" }} />
                )}
              </AnimatePresence>
              <AnimatePresence>
                {hostLow && active === "host" && !paused && (
                  <motion.div key="host-low" className="absolute inset-0 pointer-events-none"
                    animate={{ opacity: [0, 0.12, 0] }} transition={{ duration: 1, repeat: Infinity }}
                    style={{ background: "oklch(0.65 0.18 40)" }} />
                )}
              </AnimatePresence>

              <div className="relative">
                {hostAvatarUrl ? (
                  <img src={hostAvatarUrl} alt={hostName} className="w-10 h-10 rounded-full object-cover"
                    style={{ border: `2px solid ${active === "host" && !paused ? "#4ade80" : "oklch(0.35 0.04 240 / 0.4)"}` }} />
                ) : (
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                    style={{
                      background: active === "host" && !paused ? "oklch(0.25 0.10 142 / 0.8)" : "oklch(0.18 0.04 240 / 0.6)",
                      border: `2px solid ${active === "host" && !paused ? "#4ade8066" : "oklch(0.30 0.04 240 / 0.4)"}`,
                      color: active === "host" && !paused ? "#4ade80" : "#64748b",
                    }}>
                    {avatarFallback(hostName)}
                  </div>
                )}
                {active === "host" && !paused && !flagFallen && (
                  <motion.div className="absolute inset-0 rounded-full"
                    animate={{ scale: [1, 1.6, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    style={{ border: "1.5px solid #4ade80" }} />
                )}
              </div>

              <div className="flex flex-col items-center gap-0.5">
                <p className="text-xs font-semibold tracking-wide"
                  style={{ color: active === "host" && !paused ? "#4ade80" : "oklch(0.60 0.04 240)" }}>
                  {hostName}
                </p>
                {hostMoves > 0 && (
                  <motion.span
                    key={hostMoves}
                    initial={{ scale: 1.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.2 }}
                    className="text-[10px] font-mono tabular-nums"
                    style={{ color: "oklch(0.50 0.04 240)" }}
                  >
                    move {hostMoves}
                  </motion.span>
                )}
              </div>

              <div className="text-center">
                <span className="font-mono font-black tabular-nums leading-none"
                  style={{
                    fontSize: hostMs < 60_000 ? "3.5rem" : "3rem",
                    color: hostFlag ? "#f87171" : hostLow ? "#fb923c" : active === "host" && !paused ? "#ffffff" : "oklch(0.55 0.04 240)",
                    textShadow: active === "host" && !paused && !hostFlag ? "0 0 20px oklch(0.55 0.18 142 / 0.5)" : "none",
                  }}>
                  {formatTime(hostMs)}
                </span>
                {increment > 0 && <p className="text-[10px] font-mono text-white/20 mt-1">+{increment}s</p>}
              </div>

              {hostFlag && (
                <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full"
                  style={{ background: "oklch(0.25 0.10 25 / 0.8)", border: "1px solid oklch(0.45 0.15 25 / 0.5)" }}>
                  <Flag className="w-3 h-3 text-red-400" />
                  <span className="text-red-400 text-xs font-bold">Time</span>
                </motion.div>
              )}
              {notStarted && <p className="text-[10px] text-white/20 font-mono absolute bottom-3">tap to start</p>}
            </motion.button>

            {/* ── Centre controls ─────────────────────────────────────────── */}
            <div className="flex flex-col items-center justify-center gap-3 px-3 py-6"
              style={{ borderLeft: "1px solid oklch(0.20 0.03 240 / 0.4)" }}>
              <motion.button onClick={handlePauseResume} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.92 }}
                disabled={active === null || !!flagFallen}
                className="w-10 h-10 rounded-full flex items-center justify-center transition-colors disabled:opacity-25"
                style={{
                  background: paused ? "oklch(0.25 0.10 142 / 0.8)" : "oklch(0.18 0.04 240 / 0.6)",
                  border: `1.5px solid ${paused ? "oklch(0.45 0.15 142 / 0.5)" : "oklch(0.30 0.04 240 / 0.4)"}`,
                }}
                title={paused ? "Resume" : "Pause"}>
                {paused ? <Play className="w-4 h-4 text-green-400" /> : <Pause className="w-4 h-4 text-white/50" />}
              </motion.button>

              <motion.button onClick={handleReset} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.92 }}
                className="w-10 h-10 rounded-full flex items-center justify-center transition-colors"
                style={{ background: "oklch(0.16 0.03 240 / 0.6)", border: "1.5px solid oklch(0.28 0.04 240 / 0.4)" }}
                title="Reset clock">
                <RotateCcw className="w-3.5 h-3.5 text-white/35" />
              </motion.button>

              <AnimatePresence>
                {paused && (
                  <motion.span initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                    className="text-[9px] font-mono uppercase tracking-widest"
                    style={{ color: "oklch(0.55 0.12 142 / 0.7)", writingMode: "vertical-rl" }}>
                    paused
                  </motion.span>
                )}
              </AnimatePresence>
            </div>

            {/* ── Guest panel ─────────────────────────────────────────────── */}
            <motion.button
              onClick={() => handleTap("guest")}
              disabled={!!flagFallen || (active !== null && active !== "guest" && !paused)}
              whileTap={active === "guest" && !paused ? { scale: 0.97 } : {}}
              className="relative flex flex-col items-center justify-center gap-3 p-8 transition-colors duration-200 select-none focus:outline-none"
              style={{
                background: guestFlag
                  ? "oklch(0.20 0.10 25 / 0.9)"
                  : active === "guest" && !paused
                  ? "oklch(0.14 0.03 240 / 0.9)"
                  : "transparent",
                cursor: active === "guest" && !paused && !flagFallen ? "pointer" : "default",
              }}
            >
              <AnimatePresence>
                {active === "guest" && !paused && !flagFallen && (
                  <motion.div key="guest-bar" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} exit={{ scaleX: 0 }}
                    className="absolute top-0 left-0 right-0 h-0.5 origin-right"
                    style={{ background: "oklch(0.65 0.04 240)" }} />
                )}
              </AnimatePresence>
              <AnimatePresence>
                {guestLow && active === "guest" && !paused && (
                  <motion.div key="guest-low" className="absolute inset-0 pointer-events-none"
                    animate={{ opacity: [0, 0.12, 0] }} transition={{ duration: 1, repeat: Infinity }}
                    style={{ background: "oklch(0.65 0.18 40)" }} />
                )}
              </AnimatePresence>

              <div className="relative">
                {guestAvatarUrl ? (
                  <img src={guestAvatarUrl} alt={guestName} className="w-10 h-10 rounded-full object-cover"
                    style={{ border: `2px solid ${active === "guest" && !paused ? "#94a3b8" : "oklch(0.35 0.04 240 / 0.4)"}` }} />
                ) : (
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                    style={{
                      background: active === "guest" && !paused ? "oklch(0.22 0.04 240 / 0.8)" : "oklch(0.18 0.04 240 / 0.6)",
                      border: `2px solid ${active === "guest" && !paused ? "#94a3b866" : "oklch(0.30 0.04 240 / 0.4)"}`,
                      color: active === "guest" && !paused ? "#94a3b8" : "#64748b",
                    }}>
                    {avatarFallback(guestName)}
                  </div>
                )}
                {active === "guest" && !paused && !flagFallen && (
                  <motion.div className="absolute inset-0 rounded-full"
                    animate={{ scale: [1, 1.6, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    style={{ border: "1.5px solid #94a3b8" }} />
                )}
              </div>

              <div className="flex flex-col items-center gap-0.5">
                <p className="text-xs font-semibold tracking-wide"
                  style={{ color: active === "guest" && !paused ? "#94a3b8" : "oklch(0.60 0.04 240)" }}>
                  {guestName}
                </p>
                {guestMoves > 0 && (
                  <motion.span
                    key={guestMoves}
                    initial={{ scale: 1.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.2 }}
                    className="text-[10px] font-mono tabular-nums"
                    style={{ color: "oklch(0.50 0.04 240)" }}
                  >
                    move {guestMoves}
                  </motion.span>
                )}
              </div>

              <div className="text-center">
                <span className="font-mono font-black tabular-nums leading-none"
                  style={{
                    fontSize: guestMs < 60_000 ? "3.5rem" : "3rem",
                    color: guestFlag ? "#f87171" : guestLow ? "#fb923c" : active === "guest" && !paused ? "#ffffff" : "oklch(0.55 0.04 240)",
                    textShadow: active === "guest" && !paused && !guestFlag ? "0 0 20px oklch(0.50 0.04 240 / 0.5)" : "none",
                  }}>
                  {formatTime(guestMs)}
                </span>
                {increment > 0 && <p className="text-[10px] font-mono text-white/20 mt-1">+{increment}s</p>}
              </div>

              {guestFlag && (
                <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full"
                  style={{ background: "oklch(0.25 0.10 25 / 0.8)", border: "1px solid oklch(0.45 0.15 25 / 0.5)" }}>
                  <Flag className="w-3 h-3 text-red-400" />
                  <span className="text-red-400 text-xs font-bold">Time</span>
                </motion.div>
              )}
              {notStarted && <p className="text-[10px] text-white/20 font-mono absolute bottom-3">tap to start</p>}
            </motion.button>

          </div>

          {/* Flag-fall banner */}
          <AnimatePresence>
            {flagFallen && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden">
                <div className="flex items-center justify-center gap-2 py-3"
                  style={{ background: "oklch(0.18 0.08 25 / 0.8)", borderTop: "1px solid oklch(0.40 0.12 25 / 0.4)" }}>
                  <Flag className="w-4 h-4 text-red-400" />
                  <span className="text-red-300 text-sm font-bold">
                    {flagFallen === "host" ? hostName : guestName} — flag fallen
                  </span>
                  <motion.button onClick={handleReset} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                    className="ml-4 px-3 py-1 rounded-full text-xs font-mono"
                    style={{ background: "oklch(0.22 0.04 240 / 0.6)", border: "1px solid oklch(0.35 0.04 240 / 0.4)", color: "oklch(0.70 0.04 240)" }}>
                    Reset
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Usage hint */}
        {notStarted && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}
            className="text-center text-[10px] font-mono text-white/18 mt-2">
            Tap either panel to start · Tap your side after each move · <span style={{ color: "oklch(0.55 0.12 142 / 0.6)" }}>⛶ for full-screen</span>
          </motion.p>
        )}
      </motion.div>
    </>
  );
}
