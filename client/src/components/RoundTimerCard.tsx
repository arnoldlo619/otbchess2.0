/**
 * RoundTimerCard
 *
 * Sidebar card for the Director Dashboard showing a per-round countdown clock.
 *
 * Layout:
 *   - Large circular SVG progress ring with MM:SS in the centre
 *   - Status label (Idle / Running / Paused / Time's Up!)
 *   - Start / Pause / Reset icon buttons
 *   - Duration selector (quick-pick chips: 15 / 20 / 30 / 45 / 60 min)
 *   - Near-end warning banner when ≤ 5 min remain
 */

import React, { useState } from "react";
import { Play, Pause, RotateCcw, Bell } from "lucide-react";
import type { UseRoundTimerReturn } from "@/hooks/useRoundTimer";

const RING_R = 52;
const RING_CIRC = 2 * Math.PI * RING_R; // ≈ 326.7

const DURATION_PRESETS = [15, 20, 30, 45, 60];

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

interface RoundTimerCardProps {
  timer: UseRoundTimerReturn;
  roundNumber: number;
  isDark?: boolean;
}

export function RoundTimerCard({
  timer,
  roundNumber,
  isDark = false,
}: RoundTimerCardProps) {
  const { status, durationSec, remainingSec, nearEndFired, start, pause, reset, setDurationMin } =
    timer;

  const [customMin, setCustomMin] = useState("");

  const progress = durationSec > 0 ? 1 - remainingSec / durationSec : 0;
  const dashOffset = RING_CIRC * (1 - progress); // arc depletes as time runs

  const isRunning = status === "running";
  const isExpired = status === "expired";
  const isIdle = status === "idle";
  const isNearEnd = nearEndFired && !isExpired;

  // Colour tokens
  const ringColour = isExpired
    ? "#ef4444"
    : isNearEnd
    ? "#f59e0b"
    : "#4CAF50";

  const trackColour = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";

  const currentDurationMin = Math.round(durationSec / 60);

  return (
    <div
      className={`rounded-2xl border p-5 space-y-4 ${
        isDark
          ? "bg-[oklch(0.22_0.06_145)] border-white/08"
          : "bg-white border-gray-100"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3
          className={`text-xs font-bold uppercase tracking-widest ${
            isDark ? "text-white/40" : "text-gray-400"
          }`}
        >
          Round {roundNumber} Timer
        </h3>
        {isNearEnd && (
          <span className="flex items-center gap-1 text-xs font-bold text-amber-500 animate-pulse">
            <Bell className="w-3 h-3" />
            5 min left
          </span>
        )}
        {isExpired && (
          <span className="text-xs font-bold text-red-500">Time&apos;s Up!</span>
        )}
      </div>

      {/* Progress ring + time display */}
      <div className="flex flex-col items-center gap-3">
        <div className="relative w-32 h-32">
          <svg
            viewBox="0 0 120 120"
            className="w-full h-full -rotate-90"
            aria-hidden="true"
          >
            {/* Track */}
            <circle
              cx="60"
              cy="60"
              r={RING_R}
              fill="none"
              strokeWidth="7"
              stroke={trackColour}
            />
            {/* Progress arc */}
            <circle
              cx="60"
              cy="60"
              r={RING_R}
              fill="none"
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={RING_CIRC}
              strokeDashoffset={dashOffset}
              stroke={ringColour}
              style={{ transition: "stroke-dashoffset 0.25s linear, stroke 0.3s ease" }}
            />
          </svg>
          {/* Time label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              className={`text-2xl font-bold tabular-nums tracking-tight ${
                isExpired
                  ? "text-red-500"
                  : isNearEnd
                  ? "text-amber-500"
                  : isDark
                  ? "text-white"
                  : "text-gray-900"
              }`}
            >
              {formatTime(remainingSec)}
            </span>
            <span
              className={`text-[10px] font-semibold uppercase tracking-widest mt-0.5 ${
                isDark ? "text-white/30" : "text-gray-400"
              }`}
            >
              {isExpired
                ? "Expired"
                : isRunning
                ? "Running"
                : status === "paused"
                ? "Paused"
                : "Ready"}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {/* Start / Pause */}
          {isRunning ? (
            <button
              onClick={pause}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95 ${
                isDark
                  ? "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
                  : "bg-amber-50 text-amber-600 hover:bg-amber-100"
              }`}
              aria-label="Pause timer"
            >
              <Pause className="w-4 h-4" />
              Pause
            </button>
          ) : (
            <button
              onClick={start}
              disabled={isExpired}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${
                isDark
                  ? "bg-[#3D6B47]/40 text-[#4CAF50] hover:bg-[#3D6B47]/60"
                  : "bg-[#3D6B47]/10 text-[#3D6B47] hover:bg-[#3D6B47]/20"
              }`}
              aria-label="Start timer"
            >
              <Play className="w-4 h-4" />
              {status === "paused" ? "Resume" : "Start"}
            </button>
          )}

          {/* Reset */}
          <button
            onClick={reset}
            className={`p-2 rounded-xl transition-all active:scale-95 ${
              isDark
                ? "text-white/30 hover:text-white/60 hover:bg-white/08"
                : "text-gray-300 hover:text-gray-500 hover:bg-gray-100"
            }`}
            aria-label="Reset timer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Duration selector — only when idle */}
      {isIdle && (
        <div className="space-y-2">
          <p
            className={`text-xs font-semibold uppercase tracking-wide ${
              isDark ? "text-white/30" : "text-gray-400"
            }`}
          >
            Duration
          </p>
          <div className="flex flex-wrap gap-1.5">
            {DURATION_PRESETS.map((min) => (
              <button
                key={min}
                onClick={() => setDurationMin(min)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all active:scale-95 ${
                  currentDurationMin === min
                    ? isDark
                      ? "bg-[#3D6B47]/50 text-[#4CAF50]"
                      : "bg-[#3D6B47]/15 text-[#3D6B47]"
                    : isDark
                    ? "bg-white/06 text-white/50 hover:bg-white/12"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                {min}m
              </button>
            ))}
            {/* Custom input */}
            <input
              type="number"
              min={1}
              max={180}
              placeholder="Custom"
              value={customMin}
              onChange={(e) => setCustomMin(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const v = parseInt(customMin, 10);
                  if (!isNaN(v) && v > 0) {
                    setDurationMin(v);
                    setCustomMin("");
                  }
                }
              }}
              className={`w-16 px-2 py-1 rounded-lg text-xs font-bold border outline-none transition-colors ${
                isDark
                  ? "bg-white/06 border-white/10 text-white placeholder-white/20 focus:border-[#4CAF50]/50"
                  : "bg-gray-50 border-gray-200 text-gray-700 placeholder-gray-300 focus:border-[#3D6B47]/40"
              }`}
            />
          </div>
        </div>
      )}

      {/* Near-end warning banner */}
      {isNearEnd && (
        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold ${
            isDark
              ? "bg-amber-500/15 text-amber-400"
              : "bg-amber-50 text-amber-600"
          }`}
        >
          <Bell className="w-3.5 h-3.5 flex-shrink-0" />
          Push notification sent — 5 min warning delivered to all participants.
        </div>
      )}
    </div>
  );
}
