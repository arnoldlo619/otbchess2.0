/**
 * CapacityBadge
 *
 * Displays "X / Y players" with a thin fill bar and colour-coded states:
 *   green  — < 75 % full
 *   amber  — 75 – 99 % full
 *   red    — 100 % full (shows "Full" label)
 *
 * Single size variant:
 *   "md"  — wider card for the sidebar Event Info panel
 */

import React from "react";
import { Users } from "lucide-react";

export type CapacityState = "ok" | "warning" | "full";

export function getCapacityState(current: number, max: number): CapacityState {
  if (max <= 0) return "ok";
  const pct = current / max;
  if (pct >= 1) return "full";
  if (pct >= 0.75) return "warning";
  return "ok";
}

export function getCapacityPct(current: number, max: number): number {
  if (max <= 0) return 0;
  return Math.min(1, current / max);
}

interface CapacityBadgeProps {
  current: number;
  max: number;
  isDark?: boolean;
  /** "md" = sidebar card row */
  size?: "md";
}

export function CapacityBadge({
  current,
  max,
  isDark = false,
  size: _size = "md",
}: CapacityBadgeProps) {
  const state = getCapacityState(current, max);
  const pct = getCapacityPct(current, max);

  // Colour tokens per state
  const colours = {
    ok: {
      bg: isDark ? "bg-[#3D6B47]/25" : "bg-[#3D6B47]/10",
      text: isDark ? "text-[#4CAF50]" : "text-[#3D6B47]",
      bar: "bg-[#4CAF50]",
      icon: isDark ? "text-[#4CAF50]" : "text-[#3D6B47]",
    },
    warning: {
      bg: isDark ? "bg-amber-500/20" : "bg-amber-50",
      text: isDark ? "text-amber-400" : "text-amber-600",
      bar: "bg-amber-400",
      icon: isDark ? "text-amber-400" : "text-amber-500",
    },
    full: {
      bg: isDark ? "bg-red-500/20" : "bg-red-50",
      text: isDark ? "text-red-400" : "text-red-600",
      bar: "bg-red-500",
      icon: isDark ? "text-red-400" : "text-red-500",
    },
  }[state];

  /* ── Sidebar "md" variant ────────────────────────────────────────────────── */
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
              isDark ? "bg-[#4CAF50]/10" : "bg-[#3D6B47]/08"
            }`}
          >
            <Users className={`w-4 h-4 ${colours.icon}`} />
          </div>
          <div>
            <p
              className={`text-xs ${isDark ? "text-white/35" : "text-gray-400"}`}
            >
              Players
            </p>
            <p
              className={`text-sm font-semibold ${isDark ? "text-white" : "text-gray-800"}`}
            >
              {current}{" "}
              <span
                className={`font-normal text-xs ${isDark ? "text-white/40" : "text-gray-400"}`}
              >
                / {max}
              </span>
              {state === "full" && (
                <span
                  className={`ml-1.5 text-xs font-bold uppercase tracking-wide ${colours.text}`}
                >
                  Full
                </span>
              )}
            </p>
          </div>
        </div>
        <span className={`text-xs font-semibold ${colours.text}`}>
          {Math.round(pct * 100)}%
        </span>
      </div>
      {/* Fill bar */}
      <div
        className={`h-1.5 rounded-full overflow-hidden ${isDark ? "bg-white/10" : "bg-gray-100"}`}
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ${colours.bar}`}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
    </div>
  );
}
