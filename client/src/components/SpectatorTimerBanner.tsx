/**
 * SpectatorTimerBanner
 *
 * Projector-friendly round countdown shown on the public Tournament spectator page.
 * Accepts a TimerSnapshot driven by SSE (timer_update events) rather than localStorage,
 * so it works for coaches and parents on any device — not just the director's machine.
 *
 * Visual states:
 *   running  → green accent, live countdown
 *   paused   → amber accent, "Paused" label
 *   expired  → red accent, "Time's Up" with bell emoji
 *   idle     → renders nothing
 */
import { useState, useEffect, useRef } from "react";
import { useTheme } from "@/contexts/ThemeContext";

interface TimerSnap {
  status: "idle" | "running" | "paused" | "expired";
  durationSec: number;
  startWallMs: number;
  elapsedAtPauseMs: number;
  savedAt: number;
}

interface Props {
  snap: TimerSnap | null;
}

function formatMmSs(totalSec: number): string {
  const sec = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function calcRemaining(snap: TimerSnap): number {
  if (snap.status === "paused" || snap.status === "expired") {
    return Math.max(0, snap.durationSec - snap.elapsedAtPauseMs / 1000);
  }
  if (snap.status === "running") {
    const elapsed = (Date.now() - snap.startWallMs) / 1000 + snap.elapsedAtPauseMs / 1000;
    return Math.max(0, snap.durationSec - elapsed);
  }
  return snap.durationSec;
}

export function SpectatorTimerBanner({ snap }: Props) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [remainingSec, setRemainingSec] = useState<number>(() =>
    snap ? calcRemaining(snap) : 0
  );
  const rafRef = useRef<number | null>(null);
  const snapRef = useRef(snap);

  // Keep ref in sync
  useEffect(() => {
    snapRef.current = snap;
    if (snap) setRemainingSec(calcRemaining(snap));
  }, [snap]);

  // Tick every animation frame while running
  useEffect(() => {
    const tick = () => {
      const s = snapRef.current;
      if (s && s.status === "running") {
        setRemainingSec(calcRemaining(s));
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Don't render when idle or no snap
  if (!snap || snap.status === "idle") return null;

  const isExpired = snap.status === "expired" || remainingSec <= 0;
  const isPaused = snap.status === "paused";
  const isNearEnd = !isExpired && !isPaused && remainingSec <= 300; // ≤ 5 min
  const isVeryLow = !isExpired && !isPaused && remainingSec <= 60;  // ≤ 1 min

  const progress = snap.durationSec > 0 ? Math.max(0, remainingSec / snap.durationSec) : 0;

  // Colour scheme
  const accentColor = isExpired
    ? "text-red-500"
    : isVeryLow
    ? "text-red-400"
    : isNearEnd || isPaused
    ? "text-amber-400"
    : "text-emerald-400";

  const bgClass = isExpired
    ? isDark ? "bg-red-950/30 border-red-500/20" : "bg-red-50 border-red-200"
    : isVeryLow
    ? isDark ? "bg-red-950/20 border-red-500/15" : "bg-red-50/60 border-red-200/60"
    : isNearEnd || isPaused
    ? isDark ? "bg-amber-950/20 border-amber-500/15" : "bg-amber-50 border-amber-200"
    : isDark ? "bg-[oklch(0.22_0.06_145)] border-white/10" : "bg-[#F0F5EE] border-[#EEEED2]";

  const ringColor = isExpired
    ? "#EF4444"
    : isVeryLow
    ? "#F87171"
    : isNearEnd || isPaused
    ? "#F59E0B"
    : "#4CAF50";

  const label = isExpired
    ? "⏰ Time's Up"
    : isPaused
    ? `${formatMmSs(remainingSec)} · Paused`
    : formatMmSs(remainingSec);

  const statusLabel = isExpired
    ? "Round Ended"
    : isPaused
    ? "Timer Paused"
    : isNearEnd
    ? "Time Running Out"
    : "Round Timer";

  // SVG ring
  const SIZE = 64;
  const STROKE = 5;
  const R = (SIZE - STROKE) / 2;
  const CIRC = 2 * Math.PI * R;
  const dashOffset = CIRC * (1 - progress);

  return (
    <div
      className={`flex items-center gap-4 px-5 py-4 rounded-2xl border transition-colors duration-300 ${bgClass}`}
      role="timer"
      aria-label={`Round timer: ${label}`}
    >
      {/* SVG progress ring */}
      <div className="relative flex-shrink-0" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} className="rotate-[-90deg]">
          {/* Track */}
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            stroke={isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}
            strokeWidth={STROKE}
          />
          {/* Progress arc */}
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            stroke={ringColor}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={dashOffset}
            style={{ transition: "stroke-dashoffset 0.5s linear, stroke 0.3s" }}
          />
        </svg>
        {/* Centre icon */}
        <div className="absolute inset-0 flex items-center justify-center">
          {isExpired ? (
            <span className="text-red-500 text-xl">⏰</span>
          ) : isPaused ? (
            <svg className={`w-6 h-6 ${accentColor}`} viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg className={`w-6 h-6 ${accentColor}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          )}
        </div>
      </div>

      {/* Text */}
      <div className="min-w-0 flex-1">
        <p className={`text-xs font-semibold uppercase tracking-widest mb-1 ${isDark ? "text-white/40" : "text-gray-400"}`}>
          {statusLabel}
        </p>
        <p
          className={`font-mono font-bold text-2xl sm:text-3xl leading-none tabular-nums ${accentColor} ${
            (isVeryLow || isExpired) && !isPaused ? "animate-pulse" : ""
          }`}
        >
          {label}
        </p>
        {isNearEnd && !isPaused && !isExpired && (
          <p className={`text-xs mt-1 font-medium ${isVeryLow ? "text-red-400" : "text-amber-400"}`}>
            {isVeryLow ? "Less than 1 minute remaining" : "Less than 5 minutes remaining"}
          </p>
        )}
      </div>

      {/* Progress percentage — desktop only */}
      <div className="hidden sm:flex flex-col items-end flex-shrink-0">
        <p className={`text-2xl font-bold tabular-nums ${accentColor}`}>
          {Math.round(progress * 100)}%
        </p>
        <p className={`text-xs ${isDark ? "text-white/30" : "text-gray-400"}`}>remaining</p>
      </div>
    </div>
  );
}
