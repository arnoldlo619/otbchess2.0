/**
 * UndoSnackbar
 *
 * Floating bottom-centre snackbar shown for 5 seconds after a result is
 * recorded. Features:
 *   - SVG countdown ring that depletes over the undo window
 *   - "Undo" primary action button
 *   - "✕" dismiss button
 *   - Slide-up entrance / slide-down exit animation (CSS keyframes via
 *     Tailwind arbitrary values)
 *   - Adapts to dark / light theme
 */

import React, { useEffect, useState } from "react";
import { Undo2, X } from "lucide-react";
import type { UndoPending } from "@/hooks/useUndoResult";
import { UNDO_DURATION_MS } from "@/hooks/useUndoResult";

interface UndoSnackbarProps {
  pending: UndoPending | null;
  onUndo: () => void;
  onDismiss: () => void;
  isDark?: boolean;
}

const RING_R = 10;
const RING_CIRC = 2 * Math.PI * RING_R; // ≈ 62.83

export function UndoSnackbar({
  pending,
  onUndo,
  onDismiss,
  isDark = false,
}: UndoSnackbarProps) {
  // Track elapsed time for the countdown ring
  const [elapsed, setElapsed] = useState(0);
  // Control mount/unmount animation
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!pending) {
      setVisible(false);
      setElapsed(0);
      return;
    }

    setVisible(true);
    setElapsed(0);

    const start = pending.startedAt;
    let raf: number;

    const tick = () => {
      const now = Date.now();
      const delta = Math.min(now - start, UNDO_DURATION_MS);
      setElapsed(delta);
      if (delta < UNDO_DURATION_MS) {
        raf = requestAnimationFrame(tick);
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [pending]);

  if (!pending && !visible) return null;

  const progress = elapsed / UNDO_DURATION_MS; // 0 → 1
  const dashOffset = RING_CIRC * progress; // ring depletes as time passes
  const secondsLeft = Math.ceil((UNDO_DURATION_MS - elapsed) / 1000);

  return (
    <div
      className={`
        fixed bottom-6 left-1/2 -translate-x-1/2 z-50
        flex items-center gap-3
        px-4 py-3 rounded-2xl
        shadow-2xl border
        transition-all duration-300
        ${visible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0 pointer-events-none"}
        ${
          isDark
            ? "bg-[oklch(0.22_0.06_145)] border-white/12 text-white"
            : "bg-white border-[#E8D9B0] text-[#1A1A1A]"
        }
      `}
      role="status"
      aria-live="polite"
      aria-label={`Result recorded. ${secondsLeft} seconds to undo.`}
    >
      {/* Countdown ring */}
      <div className="relative flex-shrink-0 w-8 h-8">
        <svg
          viewBox="0 0 26 26"
          className="w-full h-full -rotate-90"
          aria-hidden="true"
        >
          {/* Track */}
          <circle
            cx="13"
            cy="13"
            r={RING_R}
            fill="none"
            strokeWidth="2.5"
            className={isDark ? "stroke-white/10" : "stroke-gray-100"}
          />
          {/* Progress arc */}
          <circle
            cx="13"
            cy="13"
            r={RING_R}
            fill="none"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={RING_CIRC}
            strokeDashoffset={dashOffset}
            className={isDark ? "stroke-[#4CAF50]" : "stroke-[#4D6940]"}
            style={{ transition: "stroke-dashoffset 0.05s linear" }}
          />
        </svg>
        {/* Seconds label */}
        <span
          className={`absolute inset-0 flex items-center justify-center text-[10px] font-bold tabular-nums ${
            isDark ? "text-[#4CAF50]" : "text-[#4D6940]"
          }`}
        >
          {secondsLeft}
        </span>
      </div>

      {/* Label */}
      <div className="min-w-0 flex-1">
        <p
          className={`text-xs font-semibold uppercase tracking-wide ${
            isDark ? "text-white/40" : "text-[#6B6B50]"
          }`}
        >
          Result recorded
        </p>
        <p
          className={`text-sm font-bold truncate max-w-[200px] ${
            isDark ? "text-white" : "text-[#1A1A1A]"
          }`}
        >
          {pending?.label}
        </p>
      </div>

      {/* Undo button */}
      <button
        onClick={onUndo}
        className={`
          flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold
          transition-all active:scale-95 flex-shrink-0
          ${
            isDark
              ? "bg-[#4D6940]/40 text-[#4CAF50] hover:bg-[#4D6940]/60"
              : "bg-[#4D6940]/10 text-[#4D6940] hover:bg-[#4D6940]/20"
          }
        `}
        aria-label="Undo result"
      >
        <Undo2 className="w-3.5 h-3.5" />
        Undo
      </button>

      {/* Dismiss */}
      <button
        onClick={onDismiss}
        className={`
          flex-shrink-0 p-1.5 rounded-lg transition-all active:scale-95
          ${
            isDark
              ? "text-white/30 hover:text-white/60 hover:bg-white/08"
              : "text-[#6B6B50]/70 hover:text-[#6B6B50] hover:bg-[#E8D9B0]/50"
          }
        `}
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
