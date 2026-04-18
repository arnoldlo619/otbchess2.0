/**
 * SwissStandingsPanel
 *
 * A collapsible summary panel showing the final Swiss phase standings
 * alongside the elimination bracket. Displays seed, name, rating, score,
 * and Buchholz for each player who advanced (and optionally those who did not).
 *
 * Used in:
 *  - Director.tsx bracket tab (swiss_elim, elimPhase === "elimination")
 *  - Tournament.tsx public bracket view (swiss_elim)
 */

import { useState } from "react";
import { ChevronDown, ChevronUp, List } from "lucide-react";
import type { StandingRow } from "@/lib/swiss";

interface SwissStandingsPanelProps {
  /** Final Swiss standings (all players, sorted by rank) */
  standings: StandingRow[];
  /** Number of players who advanced to the bracket (top N) */
  cutoff: number;
  /** Number of Swiss rounds played */
  swissRounds: number;
  isDark: boolean;
  /** Whether to start collapsed (default: false) */
  defaultCollapsed?: boolean;
}

function seedColor(seed: number, isDark: boolean): string {
  if (seed === 1) return isDark ? "bg-amber-400/20 text-amber-300 border-amber-400/30" : "bg-amber-50 text-amber-600 border-amber-200";
  if (seed === 2) return isDark ? "bg-slate-400/20 text-slate-300 border-slate-400/30" : "bg-slate-50 text-slate-500 border-slate-200";
  if (seed === 3) return isDark ? "bg-orange-400/15 text-orange-300 border-orange-400/25" : "bg-orange-50 text-orange-500 border-orange-200";
  return isDark ? "bg-white/06 text-white/40 border-white/08" : "bg-gray-50 text-gray-400 border-gray-200";
}

export function SwissStandingsPanel({
  standings,
  cutoff,
  swissRounds,
  isDark,
  defaultCollapsed = false,
}: SwissStandingsPanelProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [showAll, setShowAll] = useState(false);

  const advancing = standings.slice(0, cutoff);
  const eliminated = standings.slice(cutoff);
  const displayElim = showAll ? eliminated : eliminated.slice(0, 3);

  return (
    <div
      className={`rounded-2xl border overflow-hidden transition-all duration-200 ${
        isDark
          ? "bg-[oklch(0.22_0.06_145)] border-white/08"
          : "bg-white border-gray-100 shadow-sm"
      }`}
    >
      {/* Header */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className={`w-full flex items-center justify-between px-5 py-4 transition-colors ${
          isDark ? "hover:bg-white/03" : "hover:bg-gray-50"
        }`}
      >
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
            isDark ? "bg-[#4CAF50]/15" : "bg-green-50"
          }`}>
            <List className={`w-4 h-4 ${isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"}`} />
          </div>
          <div className="text-left">
            <p
              className={`text-sm font-black tracking-tight ${isDark ? "text-white" : "text-gray-900"}`}
              style={{ fontFamily: "'Clash Display', sans-serif" }}
            >
              Swiss Standings
            </p>
            <p className={`text-xs mt-0.5 ${isDark ? "text-white/40" : "text-gray-500"}`}>
              {swissRounds} round{swissRounds !== 1 ? "s" : ""} · {standings.length} players · Top {cutoff} advanced
            </p>
          </div>
        </div>
        <div className={`flex-shrink-0 ${isDark ? "text-white/30" : "text-gray-400"}`}>
          {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </div>
      </button>

      {/* Body */}
      {!collapsed && (
        <div className={`border-t ${isDark ? "border-white/06" : "border-gray-100"}`}>
          {/* Column headers */}
          <div className={`grid grid-cols-[2rem_1fr_3.5rem_3.5rem] gap-x-2 px-5 py-2 ${
            isDark ? "bg-white/02" : "bg-gray-50/80"
          }`}>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-white/25" : "text-gray-400"}`}>#</span>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-white/25" : "text-gray-400"}`}>Player</span>
            <span className={`text-[10px] font-bold uppercase tracking-wider text-right ${isDark ? "text-white/25" : "text-gray-400"}`}>Pts</span>
            <span className={`text-[10px] font-bold uppercase tracking-wider text-right ${isDark ? "text-white/25" : "text-gray-400"}`}>Buch.</span>
          </div>

          {/* Advancing players */}
          <div className={`divide-y ${isDark ? "divide-white/04" : "divide-gray-50"}`}>
            {advancing.map((row, idx) => {
              const seed = idx + 1;
              return (
                <div
                  key={row.player.id}
                  className={`grid grid-cols-[2rem_1fr_3.5rem_3.5rem] gap-x-2 items-center px-5 py-2.5 transition-colors ${
                    isDark ? "hover:bg-white/02" : "hover:bg-gray-50/60"
                  }`}
                >
                  {/* Seed badge */}
                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded-lg text-[10px] font-black border ${seedColor(seed, isDark)}`}>
                    {seed}
                  </span>

                  {/* Name + rating */}
                  <div className="min-w-0 flex items-center gap-2">
                    <span className={`text-sm font-semibold truncate ${isDark ? "text-white/90" : "text-gray-900"}`}>
                      {row.player.name}
                    </span>
                    {row.player.elo && (
                      <span className={`flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                        isDark ? "bg-white/06 text-white/35" : "bg-gray-100 text-gray-400"
                      }`}>
                        {row.player.elo}
                      </span>
                    )}
                  </div>

                  {/* Points */}
                  <span className={`text-sm font-black tabular-nums text-right ${isDark ? "text-white/85" : "text-gray-800"}`}>
                    {row.points % 1 === 0 ? row.points.toFixed(0) : row.points.toFixed(1)}
                  </span>

                  {/* Buchholz */}
                  <span className={`text-xs font-semibold tabular-nums text-right ${isDark ? "text-white/35" : "text-gray-400"}`}>
                    {row.buchholz.toFixed(1)}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Divider + eliminated players (if any) */}
          {eliminated.length > 0 && (
            <>
              <div className={`flex items-center gap-3 px-5 py-2 ${
                isDark ? "bg-white/02 border-t border-white/06" : "bg-gray-50/80 border-t border-gray-100"
              }`}>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-white/20" : "text-gray-300"}`}>
                  Did not advance
                </span>
                <div className={`flex-1 h-px ${isDark ? "bg-white/06" : "bg-gray-200"}`} />
              </div>
              <div className={`divide-y ${isDark ? "divide-white/04" : "divide-gray-50"}`}>
                {displayElim.map((row, idx) => {
                  const rank = cutoff + idx + 1;
                  return (
                    <div
                      key={row.player.id}
                      className={`grid grid-cols-[2rem_1fr_3.5rem_3.5rem] gap-x-2 items-center px-5 py-2 opacity-50 transition-colors ${
                        isDark ? "hover:bg-white/02" : "hover:bg-gray-50/60"
                      }`}
                    >
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-lg text-[10px] font-bold border ${
                        isDark ? "bg-white/04 text-white/30 border-white/06" : "bg-gray-50 text-gray-300 border-gray-200"
                      }`}>
                        {rank}
                      </span>
                      <div className="min-w-0 flex items-center gap-2">
                        <span className={`text-sm font-medium truncate ${isDark ? "text-white/60" : "text-gray-500"}`}>
                          {row.player.name}
                        </span>
                      </div>
                      <span className={`text-sm font-semibold tabular-nums text-right ${isDark ? "text-white/50" : "text-gray-400"}`}>
                        {row.points % 1 === 0 ? row.points.toFixed(0) : row.points.toFixed(1)}
                      </span>
                      <span className={`text-xs font-medium tabular-nums text-right ${isDark ? "text-white/25" : "text-gray-300"}`}>
                        {row.buchholz.toFixed(1)}
                      </span>
                    </div>
                  );
                })}
              </div>
              {eliminated.length > 3 && (
                <div className={`px-5 py-3 border-t ${isDark ? "border-white/06" : "border-gray-100"}`}>
                  <button
                    onClick={() => setShowAll((s) => !s)}
                    className={`text-xs font-semibold transition-colors ${
                      isDark ? "text-white/30 hover:text-white/55" : "text-gray-400 hover:text-gray-600"
                    }`}
                  >
                    {showAll
                      ? "Show less"
                      : `Show ${eliminated.length - 3} more eliminated player${eliminated.length - 3 !== 1 ? "s" : ""}`}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
