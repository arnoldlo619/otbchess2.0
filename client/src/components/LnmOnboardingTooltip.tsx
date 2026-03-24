/**
 * LnmOnboardingTooltip
 *
 * A one-time coach mark that explains the Live Notation Mode (LNM) workflow
 * to first-time users. Appears below the "Record Moves" button the first time
 * a battle room is fully populated (both players joined). Dismissed state is
 * persisted to localStorage so it never shows again on this device.
 *
 * Design principles:
 * - Appears with a gentle slide-up + fade animation
 * - Three concise steps with icons, no walls of text
 * - Single "Got it" dismiss button — no multi-step wizard
 * - Pointer arrow anchors it visually to the Record Moves button above
 * - Matches the platform dark/green design system (OKLCH tokens)
 */

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, RotateCcw, BarChart2, X } from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────

export const LNM_TOOLTIP_DISMISSED_KEY = "otb_lnm_tooltip_dismissed";

// ─── Steps ────────────────────────────────────────────────────────────────────

const STEPS = [
  {
    icon: BookOpen,
    title: "Mirror each move",
    body: "After moving a piece on the real board, tap that same piece and destination here to log the notation.",
  },
  {
    icon: RotateCcw,
    title: "Board flips automatically",
    body: "After each move the board rotates to face the next player — just pass the phone across the table.",
  },
  {
    icon: BarChart2,
    title: "Analyse after the game",
    body: "When the battle ends, copy your PGN or tap Analyse Game for a full Stockfish-powered review.",
  },
] as const;

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useLnmTooltip() {
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(LNM_TOOLTIP_DISMISSED_KEY) === "true";
    } catch {
      return false;
    }
  });

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(LNM_TOOLTIP_DISMISSED_KEY, "true");
    } catch {
      // localStorage unavailable (private browsing, storage full) — dismiss in-memory only
    }
    setDismissed(true);
  }, []);

  // Expose a reset helper for testing / dev
  const reset = useCallback(() => {
    try {
      localStorage.removeItem(LNM_TOOLTIP_DISMISSED_KEY);
    } catch {
      // ignore
    }
    setDismissed(false);
  }, []);

  return { dismissed, dismiss, reset };
}

// ─── Component ────────────────────────────────────────────────────────────────

interface LnmOnboardingTooltipProps {
  /** Whether to show the tooltip (parent controls visibility based on battle state) */
  visible: boolean;
  /** Called when the user taps "Got it" */
  onDismiss: () => void;
}

export default function LnmOnboardingTooltip({
  visible,
  onDismiss,
}: LnmOnboardingTooltipProps) {
  // Auto-dismiss after 30 seconds if the user doesn't interact
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(onDismiss, 30_000);
    return () => clearTimeout(timer);
  }, [visible, onDismiss]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="lnm-tooltip"
          initial={{ opacity: 0, y: 10, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.97 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-md relative z-20"
          role="tooltip"
          aria-label="Record Moves feature guide"
        >
          {/* Pointer arrow pointing up toward the Record Moves button */}
          <div
            className="mx-auto mb-[-1px]"
            style={{
              width: 0,
              height: 0,
              borderLeft: "8px solid transparent",
              borderRight: "8px solid transparent",
              borderBottom: "8px solid oklch(0.22 0.08 142 / 0.85)",
            }}
          />

          {/* Card */}
          <div
            className="rounded-2xl p-4 relative overflow-hidden"
            style={{
              background: "oklch(0.13 0.06 142 / 0.92)",
              border: "1px solid oklch(0.35 0.10 142 / 0.45)",
              backdropFilter: "blur(16px)",
              boxShadow:
                "0 8px 32px oklch(0.08 0.04 142 / 0.6), 0 0 0 1px oklch(0.45 0.14 142 / 0.12)",
            }}
          >
            {/* Subtle green glow in top-right corner */}
            <div
              className="absolute -top-8 -right-8 w-32 h-32 rounded-full pointer-events-none"
              style={{
                background:
                  "radial-gradient(circle, oklch(0.55 0.18 142 / 0.12) 0%, transparent 70%)",
              }}
            />

            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div
                  className="w-6 h-6 rounded-lg flex items-center justify-center"
                  style={{ background: "oklch(0.28 0.12 142 / 0.6)" }}
                >
                  <BookOpen className="w-3.5 h-3.5 text-green-400" />
                </div>
                <span
                  className="text-xs font-semibold tracking-wide uppercase"
                  style={{ color: "oklch(0.72 0.14 142)" }}
                >
                  How it works
                </span>
              </div>
              <button
                onClick={onDismiss}
                className="w-6 h-6 rounded-full flex items-center justify-center transition-colors"
                style={{ color: "oklch(0.45 0.04 240)" }}
                aria-label="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Steps */}
            <div className="space-y-3 mb-4">
              {STEPS.map((step, i) => {
                const Icon = step.icon;
                return (
                  <div key={i} className="flex gap-3 items-start">
                    {/* Step number + icon */}
                    <div className="flex-shrink-0 flex flex-col items-center gap-1">
                      <div
                        className="w-7 h-7 rounded-xl flex items-center justify-center"
                        style={{
                          background: "oklch(0.20 0.08 142 / 0.7)",
                          border: "1px solid oklch(0.38 0.12 142 / 0.35)",
                        }}
                      >
                        <Icon className="w-3.5 h-3.5 text-green-400" />
                      </div>
                      {/* Connector line between steps */}
                      {i < STEPS.length - 1 && (
                        <div
                          className="w-px flex-1"
                          style={{
                            height: "12px",
                            background:
                              "linear-gradient(to bottom, oklch(0.38 0.12 142 / 0.3), transparent)",
                          }}
                        />
                      )}
                    </div>

                    {/* Text */}
                    <div className="pb-1">
                      <p
                        className="text-[13px] font-semibold leading-tight mb-0.5"
                        style={{ color: "oklch(0.88 0.06 142)" }}
                      >
                        {step.title}
                      </p>
                      <p
                        className="text-[11.5px] leading-relaxed"
                        style={{ color: "oklch(0.55 0.04 240)" }}
                      >
                        {step.body}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Dismiss CTA */}
            <button
              onClick={onDismiss}
              className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.98]"
              style={{
                background: "oklch(0.28 0.12 142 / 0.7)",
                border: "1px solid oklch(0.45 0.15 142 / 0.4)",
                color: "#4ade80",
              }}
            >
              Got it
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
