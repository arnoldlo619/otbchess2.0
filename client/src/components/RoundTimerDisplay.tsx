/**
 * RoundTimerDisplay
 *
 * Read-only compact countdown clock shown on the participant Tournament page.
 * Mirrors the director's round timer via useParticipantTimer (localStorage).
 *
 * Renders nothing when the director has not started a timer (status = "idle").
 *
 * Visual states:
 *   running  → green ring + white MM:SS
 *   paused   → amber ring + "Paused" label
 *   expired  → red ring + "Time's Up"
 *   near-end → amber ring + pulsing MM:SS
 */

import { useTheme } from "@/contexts/ThemeContext";
import { useParticipantTimer } from "@/hooks/useParticipantTimer";

function formatMmSs(totalSec: number): string {
  const sec = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

interface Props {
  tournamentId: string;
}

export function RoundTimerDisplay({ tournamentId }: Props) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { isActive, status, remainingSec, durationSec, isNearEnd } =
    useParticipantTimer(tournamentId);

  // Hide when no timer is active
  if (!isActive && status !== "expired") return null;

  // SVG ring parameters
  const SIZE = 56;
  const STROKE = 4;
  const R = (SIZE - STROKE) / 2;
  const CIRC = 2 * Math.PI * R;
  const progress = durationSec > 0 ? Math.max(0, remainingSec / durationSec) : 0;
  const dashOffset = CIRC * (1 - progress);

  // Colour scheme
  const isExpired = status === "expired";
  const isPaused = status === "paused";
  const ringColour = isExpired
    ? "#EF4444"
    : isNearEnd || isPaused
    ? "#F59E0B"
    : "#4CAF50";
  const textColour = isExpired ? "text-red-500" : isNearEnd ? "text-amber-400" : "text-emerald-400";

  const label = isExpired
    ? "Time's Up"
    : isPaused
    ? `${formatMmSs(remainingSec)} · Paused`
    : formatMmSs(remainingSec);

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-colors duration-300 ${
        isDark
          ? "bg-[oklch(0.22_0.06_145)] border-white/10"
          : "bg-[#F0F5EE] border-[#EEEED2]"
      }`}
      role="timer"
      aria-label={`Round timer: ${label}`}
    >
      {/* SVG ring */}
      <div className="relative flex-shrink-0" style={{ width: SIZE, height: SIZE }}>
        {/* Track */}
        <svg width={SIZE} height={SIZE} className="rotate-[-90deg]">
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
            stroke={ringColour}
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
            <span className="text-red-500 text-lg">⏰</span>
          ) : isPaused ? (
            <svg className="w-5 h-5 text-amber-400" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          )}
        </div>
      </div>

      {/* Text */}
      <div className="min-w-0">
        <p
          className={`text-xs font-medium uppercase tracking-widest mb-0.5 ${
            isDark ? "text-white/40" : "text-gray-400"
          }`}
        >
          Round Timer
        </p>
        <p
          className={`font-mono font-bold text-xl leading-none tabular-nums ${textColour} ${
            isNearEnd && !isPaused && !isExpired ? "animate-pulse" : ""
          }`}
        >
          {label}
        </p>
        {isNearEnd && !isPaused && !isExpired && (
          <p className="text-xs text-amber-400 mt-0.5 font-medium">Less than 5 min left</p>
        )}
      </div>
    </div>
  );
}
