/**
 * FullScreenClock
 *
 * A full-screen landscape chess clock overlay designed to sit flat on the
 * table between two players. Layout:
 *
 *   ┌──────────────┬───┬──────────────┐
 *   │  HOST time   │ ● │  GUEST time  │
 *   │  (rotated    │   │  (normal     │
 *   │   180°)      │   │   upright)   │
 *   └──────────────┴───┴──────────────┘
 *
 * The host panel is rotated 180° so the host, sitting on the left side of the
 * phone, reads their time upright. The guest panel is normal orientation.
 *
 * Tap your half to end your turn and start the opponent's clock.
 * A narrow centre strip holds Pause/Resume and Exit buttons.
 *
 * Uses:
 *  - document.requestFullscreen() when available
 *  - Screen Wake Lock API to prevent the phone sleeping mid-game
 *  - useClockSounds for audio + haptic feedback
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Pause, Play, Minimize2, Flag, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { useClockSounds } from "../hooks/useClockSounds";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FullScreenClockProps {
  timeControl: string;
  hostName: string;
  guestName: string;
  hostAvatarUrl?: string | null;
  guestAvatarUrl?: string | null;
  onExit: () => void;
  /** Sync initial times from the inline clock so state is preserved on enter */
  initialHostMs?: number;
  initialGuestMs?: number;
  initialActive?: "host" | "guest" | null;
  initialPaused?: boolean;
  /** Called on every state change so the inline clock stays in sync */
  onStateChange?: (state: {
    hostMs: number;
    guestMs: number;
    active: "host" | "guest" | null;
    paused: boolean;
    flagFallen: "host" | "guest" | null;
  }) => void;
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

// ─── Component ────────────────────────────────────────────────────────────────

export default function FullScreenClock({
  timeControl,
  hostName,
  guestName,
  hostAvatarUrl,
  guestAvatarUrl,
  onExit,
  initialHostMs,
  initialGuestMs,
  initialActive = null,
  initialPaused = false,
  onStateChange,
}: FullScreenClockProps) {
  const { increment } = parseTimeControl(timeControl);
  const defaultMs = parseTimeControl(timeControl).minutes * 60_000;

  const [hostMs, setHostMs] = useState(initialHostMs ?? defaultMs);
  const [guestMs, setGuestMs] = useState(initialGuestMs ?? defaultMs);
  const [active, setActive] = useState<ActiveSide>(initialActive);
  const [paused, setPaused] = useState(initialPaused);
  const [flagFallen, setFlagFallen] = useState<"host" | "guest" | null>(null);

  const { tap, warningTick, flagAlarm, muted, toggleMute } = useClockSounds();

  const lastTickRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastWarnSecRef = useRef(-1);
  const flagAlarmFiredRef = useRef(false);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Wake Lock ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function acquireWakeLock() {
      try {
        if ("wakeLock" in navigator) {
          wakeLockRef.current = await navigator.wakeLock.request("screen");
        }
      } catch {
        // Silently ignore — wake lock is a nice-to-have
      }
    }
    acquireWakeLock();

    // Re-acquire after visibility change (wake lock is released on tab hide)
    const handleVisibility = () => {
      if (document.visibilityState === "visible") acquireWakeLock();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      wakeLockRef.current?.release().catch(() => {});
    };
  }, []);

  // ── Fullscreen API ────────────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (el.requestFullscreen) {
      el.requestFullscreen().catch(() => {});
    }
    return () => {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, []);

  // ── Tick loop ─────────────────────────────────────────────────────────────────
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
    if (active && !paused && !flagFallen) {
      lastTickRef.current = performance.now();
      rafRef.current = requestAnimationFrame(tick);
    } else {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastTickRef.current = null;
    }
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [active, paused, flagFallen, tick]);

  // ── Warning tick ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!active || paused || flagFallen) return;
    const ms = active === "host" ? hostMs : guestMs;
    if (ms <= 0 || ms >= 10_000) { lastWarnSecRef.current = -1; return; }
    const sec = Math.ceil(ms / 1000);
    if (sec !== lastWarnSecRef.current) {
      lastWarnSecRef.current = sec;
      warningTick();
    }
  }, [active, paused, flagFallen, hostMs, guestMs, warningTick]);

  // ── Flag alarm ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (flagFallen && !flagAlarmFiredRef.current) {
      flagAlarmFiredRef.current = true;
      flagAlarm();
    }
    if (!flagFallen) flagAlarmFiredRef.current = false;
  }, [flagFallen, flagAlarm]);

  // ── Sync state back to parent ─────────────────────────────────────────────────
  useEffect(() => {
    onStateChange?.({ hostMs, guestMs, active, paused, flagFallen });
  }, [hostMs, guestMs, active, paused, flagFallen, onStateChange]);

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
      setActive("guest");
    } else {
      setGuestMs((p) => p + increment * 1000);
      setActive("host");
    }
  }

  function handlePauseResume() {
    if (flagFallen || active === null) return;
    setPaused((p) => !p);
  }

  function handleReset() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const ms = parseTimeControl(timeControl).minutes * 60_000;
    setHostMs(ms);
    setGuestMs(ms);
    setActive(null);
    setPaused(false);
    setFlagFallen(null);
    lastTickRef.current = null;
    lastWarnSecRef.current = -1;
    flagAlarmFiredRef.current = false;
  }

  function handleExit() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    onExit();
  }

  // ── Derived ───────────────────────────────────────────────────────────────────
  const hostLow = hostMs < 10_000 && hostMs > 0;
  const guestLow = guestMs < 10_000 && guestMs > 0;
  const hostFlag = flagFallen === "host";
  const guestFlag = flagFallen === "guest";
  const notStarted = active === null && !flagFallen;

  // ── Panel colours ─────────────────────────────────────────────────────────────
  function panelBg(side: "host" | "guest") {
    const flag = side === "host" ? hostFlag : guestFlag;
    const isActive = active === side && !paused;
    if (flag) return "oklch(0.14 0.08 25)";
    if (isActive) return side === "host" ? "oklch(0.11 0.05 142)" : "oklch(0.09 0.02 240)";
    return "oklch(0.07 0.01 240)";
  }

  function timeColor(side: "host" | "guest") {
    const flag = side === "host" ? hostFlag : guestFlag;
    const low = side === "host" ? hostLow : guestLow;
    const isActive = active === side && !paused;
    if (flag) return "#f87171";
    if (low) return "#fb923c";
    if (isActive) return "#ffffff";
    return "oklch(0.42 0.04 240)";
  }

  function accentColor(side: "host" | "guest") {
    return side === "host" ? "#4ade80" : "#94a3b8";
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex"
      style={{ background: "oklch(0.06 0.01 240)", touchAction: "none" }}
    >
      {/* ── Host panel (left, rotated 180°) ──────────────────────────────────── */}
      <motion.button
        className="relative flex-1 flex flex-col items-center justify-center gap-4 focus:outline-none select-none overflow-hidden"
        style={{
          background: panelBg("host"),
          transform: "rotate(180deg)",
          transition: "background 0.3s ease",
          borderRight: "1px solid oklch(0.18 0.03 240 / 0.5)",
        }}
        onClick={() => handleTap("host")}
        disabled={!!flagFallen || (active !== null && active !== "host" && !paused)}
      >
        {/* Active top bar (appears at bottom due to rotation, i.e. near the host) */}
        <AnimatePresence>
          {active === "host" && !paused && !flagFallen && (
            <motion.div
              key="host-fs-bar"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              exit={{ scaleX: 0 }}
              className="absolute top-0 left-0 right-0 h-1 origin-left"
              style={{ background: "oklch(0.55 0.18 142)" }}
            />
          )}
        </AnimatePresence>

        {/* Low-time pulse */}
        <AnimatePresence>
          {hostLow && active === "host" && !paused && (
            <motion.div
              key="host-fs-low"
              className="absolute inset-0 pointer-events-none"
              animate={{ opacity: [0, 0.15, 0] }}
              transition={{ duration: 1, repeat: Infinity }}
              style={{ background: "oklch(0.65 0.18 40)" }}
            />
          )}
        </AnimatePresence>

        {/* Player name */}
        <p
          className="text-sm font-bold tracking-widest uppercase"
          style={{ color: active === "host" && !paused ? accentColor("host") : "oklch(0.45 0.04 240)" }}
        >
          {hostName}
        </p>

        {/* Big time */}
        <span
          className="font-mono font-black tabular-nums leading-none"
          style={{
            fontSize: "clamp(4rem, 14vw, 9rem)",
            color: timeColor("host"),
            textShadow: active === "host" && !paused && !hostFlag
              ? "0 0 40px oklch(0.55 0.18 142 / 0.5)"
              : "none",
          }}
        >
          {formatTime(hostMs)}
        </span>

        {increment > 0 && (
          <p className="text-xs font-mono" style={{ color: "oklch(0.40 0.04 240)" }}>
            +{increment}s
          </p>
        )}

        {/* Flag */}
        {hostFlag && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-2 px-4 py-2 rounded-full"
            style={{ background: "oklch(0.22 0.10 25 / 0.8)", border: "1px solid oklch(0.45 0.15 25 / 0.5)" }}
          >
            <Flag className="w-4 h-4 text-red-400" />
            <span className="text-red-300 text-sm font-bold">Flag fallen</span>
          </motion.div>
        )}

        {/* Tap hint */}
        {notStarted && (
          <p className="absolute bottom-6 text-[11px] font-mono" style={{ color: "oklch(0.35 0.04 240)" }}>
            tap to start
          </p>
        )}
      </motion.button>

      {/* ── Centre strip ─────────────────────────────────────────────────────── */}
      <div
        className="flex flex-col items-center justify-center gap-3 px-2 py-4 shrink-0"
        style={{
          width: "52px",
          background: "oklch(0.08 0.01 240)",
          borderLeft: "1px solid oklch(0.18 0.03 240 / 0.4)",
          borderRight: "1px solid oklch(0.18 0.03 240 / 0.4)",
        }}
      >
        {/* Exit full-screen */}
        <motion.button
          onClick={handleExit}
          whileHover={{ scale: 1.15 }}
          whileTap={{ scale: 0.88 }}
          className="w-9 h-9 rounded-full flex items-center justify-center"
          style={{
            background: "oklch(0.16 0.03 240 / 0.8)",
            border: "1px solid oklch(0.30 0.04 240 / 0.5)",
          }}
          title="Exit full-screen"
        >
          <Minimize2 className="w-4 h-4 text-white/40" />
        </motion.button>

        {/* Pause / Resume */}
        <motion.button
          onClick={handlePauseResume}
          whileHover={{ scale: 1.15 }}
          whileTap={{ scale: 0.88 }}
          disabled={active === null || !!flagFallen}
          className="w-9 h-9 rounded-full flex items-center justify-center disabled:opacity-20"
          style={{
            background: paused ? "oklch(0.22 0.10 142 / 0.8)" : "oklch(0.16 0.03 240 / 0.8)",
            border: `1px solid ${paused ? "oklch(0.45 0.15 142 / 0.5)" : "oklch(0.30 0.04 240 / 0.5)"}`,
          }}
          title={paused ? "Resume" : "Pause"}
        >
          {paused
            ? <Play className="w-4 h-4 text-green-400" />
            : <Pause className="w-4 h-4 text-white/40" />
          }
        </motion.button>

        {/* Reset */}
        <motion.button
          onClick={handleReset}
          whileHover={{ scale: 1.15 }}
          whileTap={{ scale: 0.88 }}
          className="w-9 h-9 rounded-full flex items-center justify-center"
          style={{
            background: "oklch(0.14 0.02 240 / 0.8)",
            border: "1px solid oklch(0.26 0.03 240 / 0.4)",
          }}
          title="Reset"
        >
          <RotateCcw className="w-3.5 h-3.5 text-white/30" />
        </motion.button>

        {/* Mute */}
        <motion.button
          onClick={toggleMute}
          whileHover={{ scale: 1.15 }}
          whileTap={{ scale: 0.88 }}
          className="w-9 h-9 rounded-full flex items-center justify-center"
          style={{
            background: muted ? "oklch(0.16 0.03 240 / 0.8)" : "oklch(0.20 0.07 142 / 0.6)",
            border: `1px solid ${muted ? "oklch(0.28 0.03 240 / 0.4)" : "oklch(0.40 0.12 142 / 0.4)"}`,
          }}
          title={muted ? "Unmute" : "Mute"}
        >
          {muted
            ? <VolumeX className="w-3.5 h-3.5 text-white/30" />
            : <Volume2 className="w-3.5 h-3.5 text-green-400/70" />
          }
        </motion.button>

        {/* Paused indicator */}
        <AnimatePresence>
          {paused && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-[8px] font-mono uppercase tracking-widest mt-1"
              style={{ color: "oklch(0.55 0.12 142 / 0.7)", writingMode: "vertical-rl" }}
            >
              paused
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* ── Guest panel (right, normal orientation) ──────────────────────────── */}
      <motion.button
        className="relative flex-1 flex flex-col items-center justify-center gap-4 focus:outline-none select-none overflow-hidden"
        style={{
          background: panelBg("guest"),
          transition: "background 0.3s ease",
        }}
        onClick={() => handleTap("guest")}
        disabled={!!flagFallen || (active !== null && active !== "guest" && !paused)}
      >
        {/* Active top bar */}
        <AnimatePresence>
          {active === "guest" && !paused && !flagFallen && (
            <motion.div
              key="guest-fs-bar"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              exit={{ scaleX: 0 }}
              className="absolute top-0 left-0 right-0 h-1 origin-right"
              style={{ background: "oklch(0.65 0.04 240)" }}
            />
          )}
        </AnimatePresence>

        {/* Low-time pulse */}
        <AnimatePresence>
          {guestLow && active === "guest" && !paused && (
            <motion.div
              key="guest-fs-low"
              className="absolute inset-0 pointer-events-none"
              animate={{ opacity: [0, 0.15, 0] }}
              transition={{ duration: 1, repeat: Infinity }}
              style={{ background: "oklch(0.65 0.18 40)" }}
            />
          )}
        </AnimatePresence>

        {/* Player name */}
        <p
          className="text-sm font-bold tracking-widest uppercase"
          style={{ color: active === "guest" && !paused ? accentColor("guest") : "oklch(0.45 0.04 240)" }}
        >
          {guestName}
        </p>

        {/* Big time */}
        <span
          className="font-mono font-black tabular-nums leading-none"
          style={{
            fontSize: "clamp(4rem, 14vw, 9rem)",
            color: timeColor("guest"),
            textShadow: active === "guest" && !paused && !guestFlag
              ? "0 0 40px oklch(0.50 0.04 240 / 0.5)"
              : "none",
          }}
        >
          {formatTime(guestMs)}
        </span>

        {increment > 0 && (
          <p className="text-xs font-mono" style={{ color: "oklch(0.40 0.04 240)" }}>
            +{increment}s
          </p>
        )}

        {/* Flag */}
        {guestFlag && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-2 px-4 py-2 rounded-full"
            style={{ background: "oklch(0.22 0.10 25 / 0.8)", border: "1px solid oklch(0.45 0.15 25 / 0.5)" }}
          >
            <Flag className="w-4 h-4 text-red-400" />
            <span className="text-red-300 text-sm font-bold">Flag fallen</span>
          </motion.div>
        )}

        {/* Tap hint */}
        {notStarted && (
          <p className="absolute bottom-6 text-[11px] font-mono" style={{ color: "oklch(0.35 0.04 240)" }}>
            tap to start
          </p>
        )}
      </motion.button>

      {/* Flag-fall full-width banner at bottom */}
      <AnimatePresence>
        {flagFallen && (
          <motion.div
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-3 py-3"
            style={{
              background: "oklch(0.16 0.08 25 / 0.95)",
              borderTop: "1px solid oklch(0.40 0.12 25 / 0.5)",
            }}
          >
            <Flag className="w-4 h-4 text-red-400" />
            <span className="text-red-300 text-sm font-bold">
              {flagFallen === "host" ? hostName : guestName} — flag fallen
            </span>
            <motion.button
              onClick={handleReset}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="ml-3 px-3 py-1 rounded-full text-xs font-mono"
              style={{
                background: "oklch(0.20 0.03 240 / 0.7)",
                border: "1px solid oklch(0.35 0.04 240 / 0.5)",
                color: "oklch(0.70 0.04 240)",
              }}
            >
              Reset
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
