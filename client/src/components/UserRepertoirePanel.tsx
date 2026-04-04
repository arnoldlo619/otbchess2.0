/**
 * UserRepertoirePanel
 *
 * A minimalist, Apple-like panel for the user to declare their opening
 * repertoire. Appears in the Matchup Prep page to personalize prep.
 *
 * Features:
 * - chess.com username sync: auto-detects repertoire from actual game history
 * - Manual override: pill-selector UI for each repertoire dimension
 * - Persists to localStorage immediately on change
 * - Collapsible — shows a summary line when collapsed
 * - Shows color assignment toggle at top
 */

import { useState, useRef, useEffect } from "react";
import { ChevronDown, ChevronUp, User, Search, CheckCircle, AlertCircle, Loader2, RefreshCw, X } from "lucide-react";
import {
  UserRepertoire,
  WHITE_FIRST_MOVES,
  BLACK_VS_E4,
  BLACK_VS_D4,
  saveUserRepertoire,
} from "../lib/userRepertoire";
import {
  useChessComRepertoire,
  DetectedRepertoire,
} from "../hooks/useChessComRepertoire";

interface UserRepertoirePanelProps {
  value: UserRepertoire;
  onChange: (r: UserRepertoire) => void;
}

// ─── Detected result card ─────────────────────────────────────────────────────

function DetectedResultCard({
  detected,
  onApply,
  onDismiss,
}: {
  detected: DetectedRepertoire;
  onApply: () => void;
  onDismiss: () => void;
}) {
  const hasAny = detected.whiteFirstMove || detected.blackVsE4 || detected.blackVsD4;

  if (!hasAny) {
    return (
      <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-sm text-white/50 flex items-center gap-2">
        <AlertCircle className="w-4 h-4 text-yellow-400 flex-shrink-0" />
        <span>Not enough games found to detect repertoire. Set manually below.</span>
        <button onClick={onDismiss} className="ml-auto text-white/30 hover:text-white/60">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-emerald-500/8 border border-emerald-500/20 p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span className="text-xs font-semibold text-emerald-300 uppercase tracking-wider">
            Detected from {detected.gamesAnalyzed} games
          </span>
        </div>
        <button onClick={onDismiss} className="text-white/30 hover:text-white/60">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {detected.whiteFirstMove && (
          <div className="rounded-lg bg-white/8 p-2 text-center">
            <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">As White</div>
            <div className="text-sm font-semibold text-white">1.{detected.whiteFirstMove.value}</div>
            <div className="text-[10px] text-emerald-400">{detected.whiteFirstMove.pct}% of games</div>
          </div>
        )}
        {detected.blackVsE4 && (
          <div className="rounded-lg bg-white/8 p-2 text-center">
            <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">vs 1.e4</div>
            <div className="text-sm font-semibold text-white truncate">{detected.blackVsE4.value}</div>
            <div className="text-[10px] text-emerald-400">{detected.blackVsE4.pct}% of games</div>
          </div>
        )}
        {detected.blackVsD4 && (
          <div className="rounded-lg bg-white/8 p-2 text-center">
            <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">vs 1.d4</div>
            <div className="text-sm font-semibold text-white truncate">{detected.blackVsD4.value}</div>
            <div className="text-[10px] text-emerald-400">{detected.blackVsD4.pct}% of games</div>
          </div>
        )}
      </div>

      <button
        onClick={onApply}
        className="w-full py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-semibold transition-colors"
      >
        Apply Detected Repertoire
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function UserRepertoirePanel({ value, onChange }: UserRepertoirePanelProps) {
  const [expanded, setExpanded] = useState(!value.whiteFirstMove && !value.blackVsE4);
  const [usernameInput, setUsernameInput] = useState(value.chesscomUsername ?? "");
  const [showDetected, setShowDetected] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { status, detected, error, detect, reset } = useChessComRepertoire();

  // Auto-expand when not configured
  useEffect(() => {
    if (!value.whiteFirstMove && !value.blackVsE4 && !value.blackVsD4) {
      setExpanded(true);
    }
  }, [value.whiteFirstMove, value.blackVsE4, value.blackVsD4]);

  function update(patch: Partial<UserRepertoire>) {
    const next = { ...value, ...patch };
    onChange(next);
    saveUserRepertoire(next);
  }

  async function handleSync() {
    if (!usernameInput.trim()) return;
    setShowDetected(false);
    await detect(usernameInput.trim());
    setShowDetected(true);
    // Persist the username
    update({ chesscomUsername: usernameInput.trim() });
  }

  function handleApplyDetected() {
    if (!detected) return;
    const patch: Partial<UserRepertoire> = {};
    if (detected.whiteFirstMove) patch.whiteFirstMove = detected.whiteFirstMove.value;
    if (detected.blackVsE4) patch.blackVsE4 = detected.blackVsE4.value;
    if (detected.blackVsD4) patch.blackVsD4 = detected.blackVsD4.value;
    update(patch);
    setShowDetected(false);
  }

  function handleDismissDetected() {
    setShowDetected(false);
    reset();
  }

  function handleReset() {
    reset();
    setShowDetected(false);
    setUsernameInput("");
    update({ chesscomUsername: null, whiteFirstMove: null, blackVsE4: null, blackVsD4: null, expectedColor: null });
  }

  // Summary line when collapsed
  const summaryParts: string[] = [];
  if (value.chesscomUsername) summaryParts.push(`@${value.chesscomUsername}`);
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

          {/* chess.com username sync */}
          <div className="pt-4">
            <div className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2">
              Auto-detect from chess.com
            </div>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={usernameInput}
                  onChange={e => setUsernameInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSync()}
                  placeholder="chess.com username"
                  className="w-full bg-white/8 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-emerald-500/50 focus:bg-white/12 transition-all"
                  disabled={status === "loading"}
                />
              </div>
              <button
                onClick={handleSync}
                disabled={!usernameInput.trim() || status === "loading"}
                className="px-3 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 text-sm font-medium"
              >
                {status === "loading" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : status === "success" || status === "not_found" || status === "error" ? (
                  <RefreshCw className="w-4 h-4" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                {status === "loading" ? "Syncing…" : "Sync"}
              </button>
            </div>

            {/* Error state */}
            {(status === "error" || status === "not_found") && error && (
              <div className="mt-2 flex items-center gap-2 text-xs text-red-400">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Detected result */}
            {showDetected && status === "success" && detected && (
              <div className="mt-3">
                <DetectedResultCard
                  detected={detected}
                  onApply={handleApplyDetected}
                  onDismiss={handleDismissDetected}
                />
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-white/8" />
            <span className="text-[10px] text-white/25 uppercase tracking-wider">or set manually</span>
            <div className="flex-1 h-px bg-white/8" />
          </div>

          {/* Expected color */}
          <div>
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
          {(isConfigured || value.chesscomUsername) && (
            <button
              onClick={handleReset}
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
