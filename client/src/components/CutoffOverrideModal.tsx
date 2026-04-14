/**
 * CutoffOverrideModal — lets the tournament director change the elimination
 * bracket cutoff size after it has been auto-generated, as long as no
 * elimination results have been entered yet.
 *
 * Design: OTB Chess design system (green/dark, Clash Display, OKLCH tokens)
 */

import { useState } from "react";
import { X, Trophy, AlertTriangle, ChevronRight } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CutoffOverrideModalProps {
  /** Current cutoff size (auto-generated) */
  currentCutoff: number;
  /** Total number of players in the tournament */
  totalPlayers: number;
  /** Whether any elimination results have already been entered */
  hasResults: boolean;
  /** Dark mode flag */
  isDark: boolean;
  /** Called when the director confirms a new cutoff size */
  onConfirm: (newCutoff: number) => void;
  /** Called when the modal is dismissed */
  onClose: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns all valid power-of-2 cutoff sizes up to the player count */
function validCutoffSizes(totalPlayers: number): number[] {
  const sizes: number[] = [];
  for (let n = 2; n <= Math.min(totalPlayers, 64); n *= 2) {
    sizes.push(n);
  }
  return sizes;
}

/** Returns the number of elimination rounds needed for a given cutoff */
function elimRoundsNeeded(cutoff: number): number {
  return Math.ceil(Math.log2(cutoff));
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CutoffOverrideModal({
  currentCutoff,
  totalPlayers,
  hasResults,
  isDark,
  onConfirm,
  onClose,
}: CutoffOverrideModalProps) {
  const [selected, setSelected] = useState(currentCutoff);
  const sizes = validCutoffSizes(totalPlayers);

  const roundsNeeded = elimRoundsNeeded(selected);
  const isUnchanged = selected === currentCutoff;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className={`relative w-full max-w-sm rounded-2xl border shadow-2xl overflow-hidden ${
          isDark
            ? "bg-[oklch(0.18_0.06_145)] border-white/10"
            : "bg-white border-gray-200"
        }`}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b ${
          isDark ? "border-white/08" : "border-gray-100"
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
              isDark ? "bg-[#4CAF50]/15" : "bg-green-50"
            }`}>
              <Trophy className={`w-4 h-4 ${isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"}`} />
            </div>
            <p className={`text-sm font-black tracking-tight ${isDark ? "text-white" : "text-gray-900"}`}
              style={{ fontFamily: "'Clash Display', sans-serif" }}>
              Change Bracket Cutoff
            </p>
          </div>
          <button
            onClick={onClose}
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
              isDark
                ? "hover:bg-white/08 text-white/40 hover:text-white/70"
                : "hover:bg-gray-100 text-gray-400 hover:text-gray-600"
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 flex flex-col gap-4">
          {/* Warning if results already entered */}
          {hasResults && (
            <div className={`flex items-start gap-2.5 px-3.5 py-3 rounded-xl border ${
              isDark
                ? "bg-red-500/08 border-red-400/20 text-red-300"
                : "bg-red-50 border-red-200 text-red-700"
            }`}>
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p className="text-xs leading-relaxed">
                Elimination results have already been entered. The cutoff cannot be changed once play has begun.
              </p>
            </div>
          )}

          {/* Description */}
          {!hasResults && (
            <p className={`text-xs leading-relaxed ${isDark ? "text-white/45" : "text-gray-500"}`}>
              Select how many players advance from the Swiss phase into the elimination bracket.
              Must be a power of 2. Currently set to <strong>{currentCutoff}</strong>.
            </p>
          )}

          {/* Size selector */}
          <div className="grid grid-cols-3 gap-2">
            {sizes.map((size) => {
              const isActive = selected === size;
              const isCurrent = size === currentCutoff;
              return (
                <button
                  key={size}
                  disabled={hasResults}
                  onClick={() => setSelected(size)}
                  className={`relative flex flex-col items-center justify-center py-3 rounded-xl border text-sm font-bold transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed ${
                    isActive
                      ? isDark
                        ? "bg-[#4CAF50]/20 border-[#4CAF50]/50 text-[#4CAF50]"
                        : "bg-green-50 border-green-400 text-green-700"
                      : isDark
                        ? "bg-white/04 border-white/08 text-white/60 hover:bg-white/08 hover:border-white/15"
                        : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100 hover:border-gray-300"
                  }`}
                >
                  <span className="text-base font-black" style={{ fontFamily: "'Clash Display', sans-serif" }}>
                    {size}
                  </span>
                  <span className={`text-[10px] mt-0.5 font-medium ${
                    isActive
                      ? isDark ? "text-[#4CAF50]/70" : "text-green-600"
                      : isDark ? "text-white/30" : "text-gray-400"
                  }`}>
                    {elimRoundsNeeded(size)}R elim
                  </span>
                  {isCurrent && (
                    <span className={`absolute top-1 right-1.5 text-[9px] font-bold ${
                      isDark ? "text-white/25" : "text-gray-300"
                    }`}>
                      auto
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Summary line */}
          {!hasResults && (
            <div className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl ${
              isDark ? "bg-white/04" : "bg-gray-50"
            }`}>
              <span className={`text-xs ${isDark ? "text-white/40" : "text-gray-500"}`}>
                Top <strong className={isDark ? "text-white/70" : "text-gray-700"}>{selected}</strong> players
                · {roundsNeeded} elimination round{roundsNeeded !== 1 ? "s" : ""}
                {selected !== currentCutoff && (
                  <span className={`ml-1 ${isDark ? "text-amber-400/70" : "text-amber-600"}`}>
                    · bracket will be regenerated
                  </span>
                )}
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`flex gap-2 px-5 py-4 border-t ${
          isDark ? "border-white/08" : "border-gray-100"
        }`}>
          <button
            onClick={onClose}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
              isDark
                ? "bg-white/06 hover:bg-white/10 text-white/60"
                : "bg-gray-100 hover:bg-gray-200 text-gray-600"
            }`}
          >
            Cancel
          </button>
          <button
            disabled={hasResults || isUnchanged}
            onClick={() => {
              onConfirm(selected);
              onClose();
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed ${
              isDark
                ? "bg-[#4CAF50]/90 hover:bg-[#4CAF50] text-white"
                : "bg-[#3D6B47] hover:bg-[#2d5236] text-white"
            }`}
          >
            Apply
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
