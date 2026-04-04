/**
 * TiebreakTooltip — A small "?" badge that shows a popover explaining a tiebreak system.
 *
 * Usage:
 *   <TiebreakTooltip type="buchholz" />
 *   <TiebreakTooltip type="bc1" />
 *   <TiebreakTooltip type="sb" />
 *   <TiebreakTooltip type="wins" />
 *
 * The tooltip is keyboard-accessible (focus/blur) and touch-friendly (tap to toggle).
 * It auto-positions above or below based on available space.
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { useTheme } from "@/contexts/ThemeContext";

// ─── Tiebreak definitions ─────────────────────────────────────────────────────

export type TiebreakType = "buchholz" | "bc1" | "sb" | "wins" | "match" | "pts";

interface TiebreakDef {
  label: string;
  abbr: string;
  order: string;
  description: string;
  example: string;
  color: string;
}

export const TIEBREAK_DEFS: Record<TiebreakType, TiebreakDef> = {
  pts: {
    label: "Points",
    abbr: "Pts",
    order: "Primary ranking",
    description: "Total score earned across all rounds. A win = 1 point, a draw = ½ point, a loss = 0 points.",
    example: "3 wins + 1 draw = 3.5 Pts",
    color: "#4CAF50",
  },
  buchholz: {
    label: "Buchholz",
    abbr: "Bch",
    order: "1st tiebreak",
    description:
      "The sum of all your opponents' final scores. A higher Buchholz means you faced stronger competition — a sign of a tougher path through the tournament.",
    example: "You beat players who scored 3, 2.5, and 2 pts → Bch = 7.5",
    color: "#2196F3",
  },
  bc1: {
    label: "Buchholz Cut-1",
    abbr: "Bch1",
    order: "2nd tiebreak",
    description:
      "Same as Buchholz, but the lowest-scoring opponent is removed from the calculation. This reduces the impact of a lucky pairing against a very weak player.",
    example: "Opponents scored 3, 2.5, 2, 0.5 → remove 0.5 → Bch1 = 7.5",
    color: "#03A9F4",
  },
  sb: {
    label: "Sonneborn-Berger",
    abbr: "SB",
    order: "3rd tiebreak",
    description:
      "For each win, add your opponent's full score. For each draw, add half their score. Losses contribute nothing. Rewards beating strong players over weak ones.",
    example: "Beat a 3-pt player (add 3) + drew a 2-pt player (add 1) → SB = 4",
    color: "#9C27B0",
  },
  wins: {
    label: "Number of Wins",
    abbr: "W",
    order: "4th tiebreak",
    description:
      "Total number of decisive wins (not counting draws). Used as a final tiebreak — a player with more wins is ranked higher than one who drew their way to the same score.",
    example: "3W 1D vs 1W 5D — same points, but 3W ranks higher",
    color: "#FF9800",
  },
  match: {
    label: "Match Score",
    abbr: "Match",
    order: "Double Swiss ranking",
    description:
      "In Double Swiss, each round is a 2-game mini-match. A match win (2-0 or 1.5-0.5) = 1 match point. A match draw (1-1) = 0.5. A match loss = 0. Used as the primary ranking in Double Swiss format.",
    example: "2 match wins + 1 match draw = 2.5 match pts",
    color: "#FF5722",
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

interface TiebreakTooltipProps {
  type: TiebreakType;
  /** Position preference — auto-detects if not set */
  position?: "above" | "below";
  /** Extra CSS classes for the trigger button */
  className?: string;
}

export function TiebreakTooltip({ type, position, className = "" }: TiebreakTooltipProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [open, setOpen] = useState(false);
  const [resolvedPosition, setResolvedPosition] = useState<"above" | "below">(position ?? "above");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const def = TIEBREAK_DEFS[type];

  // Auto-detect position based on available space
  const detectPosition = useCallback(() => {
    if (position) {
      setResolvedPosition(position);
      return;
    }
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;
    setResolvedPosition(spaceAbove > 200 || spaceAbove > spaceBelow ? "above" : "below");
  }, [position]);

  const handleOpen = useCallback(() => {
    detectPosition();
    setOpen(true);
  }, [detectPosition]);

  const handleClose = useCallback(() => setOpen(false), []);

  const handleToggle = useCallback(() => {
    if (open) {
      handleClose();
    } else {
      handleOpen();
    }
  }, [open, handleOpen, handleClose]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target as Node) &&
        tooltipRef.current && !tooltipRef.current.contains(e.target as Node)
      ) {
        handleClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, handleClose]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, handleClose]);

  return (
    <span className="relative inline-flex items-center" style={{ verticalAlign: "middle" }}>
      {/* Trigger button */}
      <button
        ref={triggerRef}
        type="button"
        aria-label={`Explain ${def.label}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={handleToggle}
        onMouseEnter={handleOpen}
        onMouseLeave={handleClose}
        onFocus={handleOpen}
        onBlur={handleClose}
        className={`inline-flex items-center justify-center rounded-full transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ${
          open
            ? isDark
              ? "bg-white/20 text-white"
              : "bg-[#3D6B47]/20 text-[#3D6B47]"
            : isDark
            ? "bg-white/10 text-white/40 hover:bg-white/20 hover:text-white/70"
            : "bg-gray-200/80 text-gray-400 hover:bg-[#3D6B47]/15 hover:text-[#3D6B47]"
        } ${className}`}
        style={{
          width: "14px",
          height: "14px",
          fontSize: "9px",
          fontWeight: 800,
          lineHeight: 1,
          marginLeft: "3px",
          flexShrink: 0,
        }}
      >
        ?
      </button>

      {/* Popover */}
      {open && (
        <div
          ref={tooltipRef}
          role="dialog"
          aria-label={`${def.label} explanation`}
          className={`absolute z-50 w-64 rounded-xl shadow-xl border transition-all duration-150 ${
            isDark
              ? "bg-[oklch(0.22_0.06_145)] border-white/12 text-white"
              : "bg-white border-[#E8F0E8] text-gray-800"
          }`}
          style={{
            left: "50%",
            transform: "translateX(-50%)",
            ...(resolvedPosition === "above"
              ? { bottom: "calc(100% + 8px)" }
              : { top: "calc(100% + 8px)" }),
            // Prevent overflow on small screens
            maxWidth: "min(264px, calc(100vw - 32px))",
          }}
          onMouseEnter={handleOpen}
          onMouseLeave={handleClose}
        >
          {/* Arrow */}
          <div
            className={`absolute left-1/2 -translate-x-1/2 w-0 h-0 ${
              resolvedPosition === "above"
                ? "top-full border-t-8 border-x-8 border-x-transparent"
                : "bottom-full border-b-8 border-x-8 border-x-transparent"
            }`}
            style={{
              borderTopColor: resolvedPosition === "above"
                ? (isDark ? "oklch(0.22 0.06 145)" : "white")
                : "transparent",
              borderBottomColor: resolvedPosition === "below"
                ? (isDark ? "oklch(0.22 0.06 145)" : "white")
                : "transparent",
            }}
          />

          {/* Content */}
          <div className="p-3.5">
            {/* Header */}
            <div className="flex items-center gap-2 mb-2">
              <span
                className="text-xs font-black px-1.5 py-0.5 rounded-md"
                style={{
                  background: `${def.color}22`,
                  color: def.color,
                  border: `1px solid ${def.color}44`,
                }}
              >
                {def.abbr}
              </span>
              <span className={`text-sm font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
                {def.label}
              </span>
              <span
                className={`ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                  isDark ? "bg-white/08 text-white/40" : "bg-gray-100 text-gray-400"
                }`}
              >
                {def.order}
              </span>
            </div>

            {/* Description */}
            <p className={`text-xs leading-relaxed mb-2.5 ${isDark ? "text-white/70" : "text-gray-600"}`}>
              {def.description}
            </p>

            {/* Example */}
            <div
              className={`text-xs px-2.5 py-2 rounded-lg font-mono ${
                isDark ? "bg-white/06 text-white/50" : "bg-gray-50 text-gray-500"
              }`}
            >
              {def.example}
            </div>
          </div>
        </div>
      )}
    </span>
  );
}
