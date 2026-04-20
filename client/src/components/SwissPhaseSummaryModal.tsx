/**
 * SwissPhaseSummaryModal
 *
 * Shown BEFORE the CutoffOverrideModal when the director clicks
 * "Generate Elimination Bracket".  Displays the full final Swiss
 * standings with a clear visual divider between players who advance
 * and players who are eliminated, so the director can verify the
 * correct players are moving on before choosing a bracket size.
 *
 * Flow:
 *   1. Director clicks "Generate Elimination Bracket"
 *   2. This modal opens — shows standings, advancing/eliminated split
 *   3. "Looks good — Choose Bracket Size →" opens CutoffOverrideModal
 *   4. "Adjust Cutoff" link also opens CutoffOverrideModal directly
 */

import { useState, useMemo } from "react";
import { X, Swords, ChevronRight, Users, Trophy, ArrowRight } from "lucide-react";
import type { StandingRow } from "@/lib/swiss";
import { suggestElimCutoff } from "@/lib/swiss";

// ─── Seed badge helpers (matches EliminationBracketView) ──────────────────────

function SeedBadge({ seed }: { seed: number }) {
  if (seed === 1) {
    return (
      <span
        className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[9px] font-black flex-shrink-0"
        style={{ background: "linear-gradient(135deg,#ffd700,#b8860b)", color: "#000" }}
        title="Swiss seed #1"
      >
        1
      </span>
    );
  }
  if (seed === 2) {
    return (
      <span
        className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[9px] font-black flex-shrink-0"
        style={{ background: "linear-gradient(135deg,#c0c0c0,#808080)", color: "#000" }}
        title="Swiss seed #2"
      >
        2
      </span>
    );
  }
  if (seed === 3) {
    return (
      <span
        className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[9px] font-black flex-shrink-0"
        style={{ background: "linear-gradient(135deg,#cd7f32,#8b4513)", color: "#fff" }}
        title="Swiss seed #3"
      >
        3
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[9px] font-bold flex-shrink-0 bg-white/10 text-white/50"
      title={`Swiss seed #${seed}`}
    >
      {seed}
    </span>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface SwissPhaseSummaryModalProps {
  standings: StandingRow[];
  /** Total players in the tournament (for cutoff suggestion) */
  playerCount: number;
  isDark: boolean;
  /** Called when director confirms and wants to proceed to bracket-size selection */
  onProceed: () => void;
  onCancel: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SwissPhaseSummaryModal({
  standings,
  playerCount,
  isDark,
  onProceed,
  onCancel,
}: SwissPhaseSummaryModalProps) {
  const suggestedCutoff = useMemo(
    () => suggestElimCutoff(playerCount),
    [playerCount]
  );

  // Allow the director to preview a different cutoff inline before proceeding
  const [previewCutoff, setPreviewCutoff] = useState(suggestedCutoff);

  // Build the valid power-of-2 options
  const cutoffOptions = useMemo(() => {
    const opts: number[] = [];
    for (let n = 2; n <= Math.min(playerCount, 64); n *= 2) opts.push(n);
    if (opts.length === 0) opts.push(2);
    return opts;
  }, [playerCount]);

  const advancing = standings.slice(0, previewCutoff);
  const eliminated = standings.slice(previewCutoff);

  // ── Style tokens ────────────────────────────────────────────────────────────
  const T = {
    overlay: "fixed inset-0 z-50 flex items-center justify-center p-4",
    card: isDark
      ? "bg-[oklch(0.18_0.06_145)] border-white/10"
      : "bg-white border-gray-200",
    title: isDark ? "text-white" : "text-gray-900",
    subtitle: isDark ? "text-white/50" : "text-gray-500",
    divider: isDark ? "border-white/08" : "border-gray-100",
    rowHover: isDark ? "hover:bg-white/04" : "hover:bg-gray-50",
    advancingBg: isDark ? "bg-[#4CAF50]/06" : "bg-green-50/60",
    eliminatedBg: isDark ? "bg-white/02" : "bg-gray-50/40",
    sectionLabel: isDark ? "text-white/35" : "text-gray-400",
    nameText: isDark ? "text-white/90" : "text-gray-800",
    statText: isDark ? "text-white/45" : "text-gray-400",
    scoreText: isDark ? "text-white/80" : "text-gray-700",
    closeBtn: isDark
      ? "hover:bg-white/08 text-white/40 hover:text-white/70"
      : "hover:bg-gray-100 text-gray-400 hover:text-gray-600",
    confirmBtn: isDark
      ? "bg-[#4CAF50]/90 hover:bg-[#4CAF50] text-white"
      : "bg-[#3D6B47] hover:bg-[#2d5236] text-white",
    cancelBtn: isDark
      ? "bg-white/06 hover:bg-white/10 text-white/60"
      : "bg-gray-100 hover:bg-gray-200 text-gray-600",
    cutoffPill: (active: boolean) =>
      active
        ? isDark
          ? "bg-[#4CAF50]/20 border-[#4CAF50]/50 text-[#4CAF50]"
          : "bg-green-50 border-green-400 text-green-700"
        : isDark
          ? "bg-white/04 border-white/08 text-white/50 hover:bg-white/08 hover:border-white/15"
          : "bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100",
  };

  return (
    <div className={T.overlay} style={{ backdropFilter: "blur(6px)" }}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/65"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Modal card */}
      <div
        className={`relative w-full max-w-lg rounded-2xl border shadow-2xl flex flex-col overflow-hidden ${T.card}`}
        style={{ maxHeight: "min(90vh, 680px)" }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="swiss-summary-title"
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className={`flex items-center justify-between px-5 py-4 border-b flex-shrink-0 ${T.divider}`}>
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
              isDark ? "bg-[#4CAF50]/15" : "bg-green-50"
            }`}>
              <Trophy className={`w-4 h-4 ${isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"}`} />
            </div>
            <div>
              <p
                id="swiss-summary-title"
                className={`text-sm font-black tracking-tight leading-none ${T.title}`}
                style={{ fontFamily: "'Clash Display', sans-serif" }}
              >
                Swiss Phase Complete
              </p>
              <p className={`text-[11px] mt-0.5 ${T.subtitle}`}>
                {playerCount} players · verify standings before generating bracket
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${T.closeBtn}`}
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Cutoff preview selector ──────────────────────────────────────── */}
        <div className={`px-5 pt-3.5 pb-2 flex-shrink-0 border-b ${T.divider}`}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[11px] font-semibold ${T.sectionLabel} flex-shrink-0`}>
              Advancing to bracket:
            </span>
            {cutoffOptions.map((n) => (
              <button
                key={n}
                onClick={() => setPreviewCutoff(n)}
                className={`px-2.5 py-0.5 rounded-lg border text-xs font-bold transition-all duration-150 ${T.cutoffPill(previewCutoff === n)}`}
              >
                Top {n}
                {n === suggestedCutoff && (
                  <span className={`ml-1 text-[9px] font-semibold opacity-60`}>rec.</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── Standings table ──────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          {/* Column headers */}
          <div className={`sticky top-0 z-10 grid grid-cols-[28px_1fr_52px_52px_52px] gap-x-2 px-4 py-1.5 border-b ${T.divider} ${
            isDark ? "bg-[oklch(0.18_0.06_145)]" : "bg-white"
          }`}>
            <span className={`text-[10px] font-semibold ${T.sectionLabel}`}>#</span>
            <span className={`text-[10px] font-semibold ${T.sectionLabel}`}>Player</span>
            <span className={`text-[10px] font-semibold text-right ${T.sectionLabel}`}>Pts</span>
            <span className={`text-[10px] font-semibold text-right ${T.sectionLabel}`}>Buch.</span>
            <span className={`text-[10px] font-semibold text-right ${T.sectionLabel}`}>ELO</span>
          </div>

          {/* Advancing section */}
          {advancing.length > 0 && (
            <div className={T.advancingBg}>
              {/* Section label */}
              <div className="flex items-center gap-2 px-4 py-1.5">
                <Swords className={`w-3 h-3 flex-shrink-0 ${isDark ? "text-[#4CAF50]/70" : "text-green-600"}`} />
                <span className={`text-[10px] font-bold uppercase tracking-wider ${
                  isDark ? "text-[#4CAF50]/70" : "text-green-600"
                }`}>
                  Advancing — Top {previewCutoff}
                </span>
              </div>
              {advancing.map((row, idx) => (
                <StandingRowItem
                  key={row.player.id}
                  row={row}
                  seed={idx + 1}
                  isAdvancing={true}
                  isDark={isDark}
                  T={T}
                />
              ))}
            </div>
          )}

          {/* Cutoff divider */}
          {eliminated.length > 0 && (
            <div className={`flex items-center gap-3 px-4 py-2 ${
              isDark ? "bg-white/03 border-y border-white/06" : "bg-gray-100/60 border-y border-gray-200"
            }`}>
              <div className={`flex-1 h-px ${isDark ? "bg-white/10" : "bg-gray-300"}`} />
              <span className={`text-[10px] font-bold uppercase tracking-widest flex-shrink-0 ${
                isDark ? "text-white/30" : "text-gray-400"
              }`}>
                Cutoff — {playerCount - previewCutoff} player{playerCount - previewCutoff !== 1 ? "s" : ""} eliminated after Swiss
              </span>
              <div className={`flex-1 h-px ${isDark ? "bg-white/10" : "bg-gray-300"}`} />
            </div>
          )}

          {/* Eliminated section */}
          {eliminated.length > 0 && (
            <div className={`${T.eliminatedBg} opacity-60`}>
              <div className="flex items-center gap-2 px-4 py-1.5">
                <Users className={`w-3 h-3 flex-shrink-0 ${T.sectionLabel}`} />
                <span className={`text-[10px] font-bold uppercase tracking-wider ${T.sectionLabel}`}>
                  Eliminated after Swiss
                </span>
              </div>
              {eliminated.map((row, idx) => (
                <StandingRowItem
                  key={row.player.id}
                  row={row}
                  seed={previewCutoff + idx + 1}
                  isAdvancing={false}
                  isDark={isDark}
                  T={T}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <div className={`flex gap-2 px-5 py-4 border-t flex-shrink-0 ${T.divider}`}>
          <button
            onClick={onCancel}
            className={`flex-shrink-0 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${T.cancelBtn}`}
          >
            Cancel
          </button>
          <button
            onClick={onProceed}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all duration-150 active:scale-[0.98] ${T.confirmBtn}`}
            style={isDark ? { boxShadow: "0 4px 16px rgba(76,175,80,0.25)" } : {}}
          >
            <span>Looks good — Choose Bracket Size</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Row sub-component ────────────────────────────────────────────────────────

interface RowProps {
  row: StandingRow;
  seed: number;
  isAdvancing: boolean;
  isDark: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T: Record<string, any>;
}

function StandingRowItem({ row, seed, isAdvancing, isDark, T }: RowProps) {
  const scoreStr =
    row.points % 1 === 0 ? String(row.points) : row.points.toFixed(1);
  const buchStr =
    row.buchholz % 1 === 0 ? String(row.buchholz) : row.buchholz.toFixed(1);

  return (
    <div
      className={`grid grid-cols-[28px_1fr_52px_52px_52px] gap-x-2 items-center px-4 py-1.5 transition-colors ${T.rowHover}`}
    >
      {/* Seed badge */}
      <div className="flex items-center justify-center">
        <SeedBadge seed={seed} />
      </div>

      {/* Name + rating inline */}
      <div className="flex items-center gap-1.5 min-w-0">
        <span
          className={`text-xs font-semibold truncate ${
            isAdvancing
              ? isDark
                ? "text-white/90"
                : "text-gray-800"
              : T.nameText
          }`}
        >
          {row.player.name}
        </span>
      </div>

      {/* Points */}
      <span
        className={`text-xs font-bold text-right tabular-nums ${
          isAdvancing
            ? isDark
              ? "text-[#4CAF50]"
              : "text-green-700"
            : T.scoreText
        }`}
      >
        {scoreStr}
      </span>

      {/* Buchholz */}
      <span className={`text-[11px] text-right tabular-nums ${T.statText}`}>
        {buchStr}
      </span>

      {/* ELO */}
      <span className={`text-[11px] text-right tabular-nums ${T.statText}`}>
        {row.player.elo > 0 ? row.player.elo : "—"}
      </span>
    </div>
  );
}
