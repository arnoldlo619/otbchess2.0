/**
 * UserRepertoirePanel
 *
 * A minimalist, Apple-like panel for the user to declare their opening
 * repertoire. Appears in the Matchup Prep page to personalize prep.
 *
 * Design:
 * - Compact pill-selector UI (no dropdowns)
 * - Persists to localStorage immediately on change
 * - Collapsible — shows a summary line when collapsed
 * - Shows color assignment toggle at top
 */

import { useState } from "react";
import { ChevronDown, ChevronUp, User } from "lucide-react";
import {
  UserRepertoire,
  WHITE_FIRST_MOVES,
  BLACK_VS_E4,
  BLACK_VS_D4,
  loadUserRepertoire,
  saveUserRepertoire,
} from "../lib/userRepertoire";

interface UserRepertoirePanelProps {
  value: UserRepertoire;
  onChange: (r: UserRepertoire) => void;
}

export function UserRepertoirePanel({ value, onChange }: UserRepertoirePanelProps) {
  const [expanded, setExpanded] = useState(!value.whiteFirstMove && !value.blackVsE4);

  function update(patch: Partial<UserRepertoire>) {
    const next = { ...value, ...patch };
    onChange(next);
    saveUserRepertoire(next);
  }

  // Summary line when collapsed
  const summaryParts: string[] = [];
  if (value.expectedColor === "white") summaryParts.push("Playing White");
  else if (value.expectedColor === "black") summaryParts.push("Playing Black");
  if (value.whiteFirstMove && value.whiteFirstMove !== "other") summaryParts.push(`1.${value.whiteFirstMove}`);
  if (value.blackVsE4 && value.blackVsE4 !== "other") summaryParts.push(value.blackVsE4 + " vs e4");
  if (value.blackVsD4 && value.blackVsD4 !== "other") summaryParts.push(value.blackVsD4 + " vs d4");
  const summary = summaryParts.length > 0 ? summaryParts.join(" · ") : "Tell us your repertoire for smarter prep";

  const isConfigured = !!(value.whiteFirstMove || value.blackVsE4 || value.blackVsD4);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors"
      >
        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${isConfigured ? "bg-emerald-500/20" : "bg-white/10"}`}>
          <User className={`w-3.5 h-3.5 ${isConfigured ? "text-emerald-400" : "text-white/40"}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-0.5">My Repertoire</div>
          <div className={`text-sm truncate ${isConfigured ? "text-white/80" : "text-white/35 italic"}`}>{summary}</div>
        </div>
        {expanded
          ? <ChevronUp className="w-4 h-4 text-white/30 flex-shrink-0" />
          : <ChevronDown className="w-4 h-4 text-white/30 flex-shrink-0" />
        }
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 space-y-5 border-t border-white/8">

          {/* Expected color */}
          <div className="pt-4">
            <div className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2">Expected color</div>
            <div className="flex gap-2">
              {(["white", "black", null] as const).map(color => (
                <button
                  key={String(color)}
                  onClick={() => update({ expectedColor: color })}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
                    value.expectedColor === color
                      ? color === "white"
                        ? "bg-white text-black"
                        : color === "black"
                        ? "bg-zinc-800 text-white border border-white/20"
                        : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60"
                  }`}
                >
                  {color === null ? "Unknown" : color === "white" ? "⬜ White" : "⬛ Black"}
                </button>
              ))}
            </div>
          </div>

          {/* White first move */}
          <div>
            <div className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2">My first move as White</div>
            <div className="flex flex-wrap gap-2">
              {WHITE_FIRST_MOVES.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => update({ whiteFirstMove: opt.value === value.whiteFirstMove ? null : opt.value })}
                  className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
                    value.whiteFirstMove === opt.value
                      ? "bg-emerald-500 text-black font-semibold"
                      : "bg-white/8 text-white/50 hover:bg-white/15 hover:text-white/80"
                  }`}
                  title={opt.description}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Black vs 1.e4 */}
          <div>
            <div className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2">My response to 1.e4</div>
            <div className="flex flex-wrap gap-2">
              {BLACK_VS_E4.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => update({ blackVsE4: opt.value === value.blackVsE4 ? null : opt.value })}
                  className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
                    value.blackVsE4 === opt.value
                      ? "bg-emerald-500 text-black font-semibold"
                      : "bg-white/8 text-white/50 hover:bg-white/15 hover:text-white/80"
                  }`}
                  title={opt.description}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Black vs 1.d4 */}
          <div>
            <div className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2">My response to 1.d4</div>
            <div className="flex flex-wrap gap-2">
              {BLACK_VS_D4.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => update({ blackVsD4: opt.value === value.blackVsD4 ? null : opt.value })}
                  className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
                    value.blackVsD4 === opt.value
                      ? "bg-emerald-500 text-black font-semibold"
                      : "bg-white/8 text-white/50 hover:bg-white/15 hover:text-white/80"
                  }`}
                  title={opt.description}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Clear button */}
          {isConfigured && (
            <button
              onClick={() => {
                update({ whiteFirstMove: null, blackVsE4: null, blackVsD4: null, expectedColor: null });
              }}
              className="text-xs text-white/25 hover:text-white/50 transition-colors"
            >
              Clear repertoire
            </button>
          )}
        </div>
      )}
    </div>
  );
}
