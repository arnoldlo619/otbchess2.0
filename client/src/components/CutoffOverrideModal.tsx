/**
 * CutoffOverrideModal
 *
 * Used in two scenarios:
 *
 * 1. PRE-GENERATE (mode="generate") — shown when the director clicks
 *    "Generate Elimination Bracket" after the Swiss phase completes.
 *    Lets them confirm or adjust the cutoff before the bracket is created.
 *    Props: playerCount, suggestedCutoff, isDark, onConfirm, onCancel
 *
 * 2. POST-GENERATE (mode="change") — shown from the bracket tab to
 *    override the cutoff after auto-generation, as long as no results
 *    have been entered yet.
 *    Props: currentCutoff, totalPlayers, hasResults, isDark, onConfirm, onClose
 *
 * Design: OTB Chess design system (green/dark, Clash Display, OKLCH tokens)
 */

import { useState, useMemo } from "react";
import { X, Trophy, AlertTriangle, ChevronRight, Swords, Info } from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns all valid power-of-2 cutoff sizes up to the player count */
function validCutoffSizes(totalPlayers: number): number[] {
  const sizes: number[] = [];
  for (let n = 2; n <= Math.min(totalPlayers, 64); n *= 2) {
    sizes.push(n);
  }
  if (sizes.length === 0) sizes.push(2);
  return sizes;
}

/** Returns the number of elimination rounds needed for a given cutoff */
function elimRoundsNeeded(cutoff: number): number {
  return Math.ceil(Math.log2(Math.max(cutoff, 2)));
}

// ─── Pre-generate variant props ───────────────────────────────────────────────

interface GenerateModeProps {
  mode: "generate";
  /** Total players in the tournament */
  playerCount: number;
  /** Auto-suggested cutoff (largest power-of-2 ≤ playerCount) */
  suggestedCutoff: number;
  isDark: boolean;
  onConfirm: (cutoff: number) => void;
  onCancel: () => void;
}

// ─── Post-generate variant props ──────────────────────────────────────────────

interface ChangeModeProps {
  mode: "change";
  /** Current cutoff size (auto-generated) */
  currentCutoff: number;
  /** Total number of players in the tournament */
  totalPlayers: number;
  /** Whether any elimination results have already been entered */
  hasResults: boolean;
  isDark: boolean;
  onConfirm: (newCutoff: number) => void;
  onClose: () => void;
}

type CutoffOverrideModalProps = GenerateModeProps | ChangeModeProps;

// ─── Component ────────────────────────────────────────────────────────────────

export function CutoffOverrideModal(props: CutoffOverrideModalProps) {
  const isGenerate = props.mode === "generate";

  // Normalise props into a unified shape
  const totalPlayers = isGenerate ? props.playerCount : props.totalPlayers;
  const defaultCutoff = isGenerate ? props.suggestedCutoff : props.currentCutoff;
  const hasResults = isGenerate ? false : props.hasResults;
  const isDark = props.isDark;

  const [selected, setSelected] = useState(defaultCutoff);
  const sizes = useMemo(() => validCutoffSizes(totalPlayers), [totalPlayers]);
  const rounds = elimRoundsNeeded(selected);
  const eliminated = totalPlayers - selected;
  const isUnchanged = !isGenerate && selected === defaultCutoff;

  const handleConfirm = () => {
    if (isGenerate) {
      props.onConfirm(selected);
    } else {
      props.onConfirm(selected);
      props.onClose();
    }
  };

  const handleClose = () => {
    if (isGenerate) {
      props.onCancel();
    } else {
      props.onClose();
    }
  };

  const T = {
    overlay: "fixed inset-0 z-50 flex items-center justify-center p-4",
    card: isDark
      ? "bg-[oklch(0.18_0.06_145)] border-white/10"
      : "bg-white border-gray-200",
    title: isDark ? "text-white" : "text-gray-900",
    subtitle: isDark ? "text-white/50" : "text-gray-500",
    label: isDark ? "text-white/70" : "text-gray-700",
    divider: isDark ? "border-white/08" : "border-gray-100",
    infoCard: isDark ? "bg-white/04" : "bg-gray-50",
    infoLabel: isDark ? "text-white/40" : "text-gray-400",
    infoValue: isDark ? "text-white/85" : "text-gray-800",
    closeBtn: isDark
      ? "hover:bg-white/08 text-white/40 hover:text-white/70"
      : "hover:bg-gray-100 text-gray-400 hover:text-gray-600",
    confirmBtn: isDark
      ? "bg-[#4CAF50]/90 hover:bg-[#4CAF50] text-white disabled:opacity-40 disabled:cursor-not-allowed"
      : "bg-[#3D6B47] hover:bg-[#2d5236] text-white disabled:opacity-40 disabled:cursor-not-allowed",
    cancelBtn: isDark
      ? "bg-white/06 hover:bg-white/10 text-white/60"
      : "bg-gray-100 hover:bg-gray-200 text-gray-600",
  };

  return (
    <div className={T.overlay} style={{ backdropFilter: "blur(4px)" }}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Modal card */}
      <div
        className={`relative w-full max-w-sm rounded-2xl border shadow-2xl overflow-hidden ${T.card}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cutoff-modal-title"
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b ${T.divider}`}>
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
              isDark ? "bg-[#4CAF50]/15" : "bg-green-50"
            }`}>
              {isGenerate
                ? <Swords className={`w-4 h-4 ${isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"}`} />
                : <Trophy className={`w-4 h-4 ${isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"}`} />
              }
            </div>
            <p
              id="cutoff-modal-title"
              className={`text-sm font-black tracking-tight ${T.title}`}
              style={{ fontFamily: "'Clash Display', sans-serif" }}
            >
              {isGenerate ? "Generate Elimination Bracket" : "Change Bracket Cutoff"}
            </p>
          </div>
          <button
            onClick={handleClose}
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${T.closeBtn}`}
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 flex flex-col gap-4">
          {/* Pre-generate description */}
          {isGenerate && (
            <div className={`flex items-start gap-2 px-3 py-2.5 rounded-xl ${T.infoCard}`}>
              <Info className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${T.infoLabel}`} />
              <p className={`text-xs leading-relaxed ${T.subtitle}`}>
                The Swiss phase is complete. Choose how many players advance to the
                elimination bracket. The recommended size is the largest power of 2
                that fits all <strong className={T.label}>{totalPlayers}</strong> players.
              </p>
            </div>
          )}

          {/* Post-generate: locked warning */}
          {!isGenerate && hasResults && (
            <div className={`flex items-start gap-2.5 px-3.5 py-3 rounded-xl border ${
              isDark
                ? "bg-red-500/08 border-red-400/20 text-red-300"
                : "bg-red-50 border-red-200 text-red-700"
            }`}>
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p className="text-xs leading-relaxed">
                Elimination results have already been entered. The cutoff cannot be
                changed once play has begun.
              </p>
            </div>
          )}

          {/* Post-generate: description */}
          {!isGenerate && !hasResults && (
            <p className={`text-xs leading-relaxed ${T.subtitle}`}>
              Select how many players advance from the Swiss phase into the elimination
              bracket. Must be a power of 2. Currently set to{" "}
              <strong>{defaultCutoff}</strong>.
            </p>
          )}

          {/* Size selector grid */}
          <div className="grid grid-cols-3 gap-2">
            {sizes.map((size) => {
              const isActive = selected === size;
              const isDefault = size === defaultCutoff;
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
                  <span
                    className="text-base font-black"
                    style={{ fontFamily: "'Clash Display', sans-serif" }}
                  >
                    {size}
                  </span>
                  <span className={`text-[10px] mt-0.5 font-medium ${
                    isActive
                      ? isDark ? "text-[#4CAF50]/70" : "text-green-600"
                      : isDark ? "text-white/30" : "text-gray-400"
                  }`}>
                    {elimRoundsNeeded(size)}R elim
                  </span>
                  {isDefault && (
                    <span className={`absolute top-1 right-1.5 text-[9px] font-bold ${
                      isDark ? "text-white/25" : "text-gray-300"
                    }`}>
                      {isGenerate ? "rec." : "auto"}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Summary line */}
          {!hasResults && (
            <div className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl ${T.infoCard}`}>
              <span className={`text-xs ${T.subtitle}`}>
                Top{" "}
                <strong className={T.label}>{selected}</strong> players ·{" "}
                {rounds} elimination round{rounds !== 1 ? "s" : ""}
                {eliminated > 0 && (
                  <span> · {eliminated} player{eliminated !== 1 ? "s" : ""} eliminated after Swiss</span>
                )}
                {!isGenerate && selected !== defaultCutoff && (
                  <span className={`ml-1 ${isDark ? "text-amber-400/70" : "text-amber-600"}`}>
                    · bracket will be regenerated
                  </span>
                )}
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`flex gap-2 px-5 py-4 border-t ${T.divider}`}>
          <button
            onClick={handleClose}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${T.cancelBtn}`}
          >
            Cancel
          </button>
          <button
            disabled={hasResults || (!isGenerate && isUnchanged)}
            onClick={handleConfirm}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold transition-all duration-150 ${T.confirmBtn}`}
          >
            {isGenerate ? (
              <>
                <Swords className="w-3.5 h-3.5" />
                Generate
              </>
            ) : (
              <>
                Apply
                <ChevronRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
