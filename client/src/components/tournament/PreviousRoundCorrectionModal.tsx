import { useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, RefreshCw, RotateCcw, X } from "lucide-react";
import type { Player, Result, Round } from "@/lib/tournamentData";
import { useAccessibleOverlay } from "@/hooks/useAccessibleOverlay";

interface PreviousRoundCorrectionModalProps {
  round: Round;
  activeRoundNumber: number;
  players: Player[];
  isDark: boolean;
  pairingRegenerationRequired: boolean;
  onApply: (results: Record<string, Result>) => void;
  onClose: () => void;
}

const RESULT_OPTIONS: Array<{ value: Exclude<Result, "*">; label: string }> = [
  { value: "1-0", label: "White wins" },
  { value: "½-½", label: "Draw" },
  { value: "0-1", label: "Black wins" },
];

function displayResult(result: Result): string {
  return result === "*" ? "Pending" : result;
}

export function PreviousRoundCorrectionModal({
  round,
  activeRoundNumber,
  players,
  isDark,
  pairingRegenerationRequired,
  onApply,
  onClose,
}: PreviousRoundCorrectionModalProps) {
  const [results, setResults] = useState<Record<string, Result>>(() =>
    Object.fromEntries(round.games.map((game) => [game.id, game.result])),
  );
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  useAccessibleOverlay({
    open: true,
    onClose,
    containerRef: dialogRef,
    initialFocusRef: cancelRef,
  });

  const playerById = useMemo(() => new Map(players.map((player) => [player.id, player])), [players]);
  const editableGames = round.games.filter((game) => game.whiteId !== "BYE" && game.blackId !== "BYE");
  const changedCount = editableGames.filter((game) => results[game.id] !== game.result).length;
  const allResolved = editableGames.every((game) => results[game.id] && results[game.id] !== "*");
  const canApply = changedCount > 0 && allResolved;

  return (
    <div className="modal-overlay" style={{ zIndex: 10_000 }}>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="previous-round-correction-title"
        aria-describedby="previous-round-correction-description"
        tabIndex={-1}
        className={`modal-card w-[min(100%-1.5rem,44rem)] max-h-[min(46rem,calc(100dvh-2rem))] overflow-hidden rounded-2xl border shadow-2xl ${
          isDark ? "border-amber-400/25 bg-[oklch(0.18_0.04_145)]" : "border-amber-200 bg-white"
        }`}
      >
        <div className={`flex items-start gap-3 border-b px-5 py-4 ${isDark ? "border-white/10" : "border-amber-100"}`}>
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isDark ? "bg-amber-400/15 text-amber-300" : "bg-amber-50 text-amber-700"}`}>
            <RotateCcw className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="previous-round-correction-title" className={`text-lg font-bold ${isDark ? "text-white" : "text-[#12372A]"}`}>
                Correct Round {round.number} results
              </h2>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] ${isDark ? "bg-amber-400/15 text-amber-300" : "bg-amber-50 text-amber-700"}`}>
                Previous round only
              </span>
            </div>
            <p id="previous-round-correction-description" className={`mt-1 text-sm leading-relaxed ${isDark ? "text-white/60" : "text-[#436850]"}`}>
              {pairingRegenerationRequired
                ? `Confirming replaces the unreported Round ${activeRoundNumber} pairings using these corrected results.`
                : "Quad boards stay assigned; section standings update from the corrected results."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close round correction"
            className={`-mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors ${isDark ? "text-white/45 hover:bg-white/08 hover:text-white" : "text-[#436850] hover:bg-[#EEF4EC] hover:text-[#12372A]"}`}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className={`mx-5 mt-4 flex gap-2 rounded-xl border px-3 py-2.5 text-xs leading-relaxed ${isDark ? "border-amber-400/25 bg-amber-400/10 text-amber-100" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            Older rounds stay locked. Review each change before applying because {pairingRegenerationRequired
              ? "the active round assignments will be refreshed."
              : "Quad pairings stay unchanged while standings recalculate."}
          </span>
        </div>

        <div className="max-h-[min(28rem,calc(100dvh-19rem))] overflow-y-auto px-5 py-4">
          <div className="space-y-3">
            {round.games.map((game) => {
              const isBye = game.whiteId === "BYE" || game.blackId === "BYE";
              const white = playerById.get(game.whiteId);
              const black = playerById.get(game.blackId);
              const value = results[game.id] ?? game.result;
              const changed = value !== game.result;

              if (isBye) {
                const byeRecipient = playerById.get(game.whiteId === "BYE" ? game.blackId : game.whiteId);
                return (
                  <div key={game.id} className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 ${isDark ? "border-white/08 bg-white/[0.03]" : "border-[#ADBC9F]/60 bg-[#FBFADA]/70"}`}>
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold ${isDark ? "text-white/80" : "text-[#12372A]"}`}>Board {game.board} · Bye</p>
                      <p className={`mt-0.5 text-xs ${isDark ? "text-white/45" : "text-[#436850]"}`}>{byeRecipient?.name ?? "Player"} receives one point automatically.</p>
                    </div>
                    <span className={`shrink-0 rounded-lg px-2 py-1 text-xs font-bold ${isDark ? "bg-white/08 text-white/55" : "bg-white text-[#436850]"}`}>{displayResult(game.result)}</span>
                  </div>
                );
              }

              return (
                <section key={game.id} aria-label={`Round ${round.number}, Board ${game.board}`} className={`rounded-xl border p-4 transition-colors ${
                  changed
                    ? isDark ? "border-amber-400/40 bg-amber-400/[0.07]" : "border-amber-300 bg-amber-50/70"
                    : isDark ? "border-white/08 bg-white/[0.03]" : "border-[#ADBC9F]/60 bg-[#FBFADA]/50"
                }`}>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className={`text-xs font-black uppercase tracking-[0.12em] ${isDark ? "text-white/45" : "text-[#436850]"}`}>Board {game.board}</span>
                      {changed && <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${isDark ? "bg-amber-400/15 text-amber-300" : "bg-amber-100 text-amber-800"}`}><RefreshCw className="h-3 w-3" aria-hidden="true" />Changed</span>}
                    </div>
                    <span className={`shrink-0 rounded-lg px-2 py-1 text-xs font-bold ${isDark ? "bg-white/08 text-white/60" : "bg-white text-[#436850]"}`}>Was {displayResult(game.result)}</span>
                  </div>
                  <div className={`mb-3 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 text-sm font-semibold ${isDark ? "text-white" : "text-[#12372A]"}`}>
                    <span className="truncate">{white?.name ?? "White"}</span>
                    <span className={`text-xs font-bold ${isDark ? "text-white/35" : "text-[#436850]"}`}>vs</span>
                    <span className="truncate text-right">{black?.name ?? "Black"}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2" role="group" aria-label={`Result for Board ${game.board}`}>
                    {RESULT_OPTIONS.map((option) => {
                      const selected = value === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => setResults((current) => ({ ...current, [game.id]: option.value }))}
                          className={`min-h-11 rounded-xl border px-2 py-2 text-xs font-bold transition-all active:scale-[0.98] ${
                            selected
                              ? option.value === "½-½"
                                ? isDark ? "border-amber-400/50 bg-amber-400/15 text-amber-300" : "border-amber-300 bg-amber-100 text-amber-900"
                                : isDark ? "border-[#4CAF50]/55 bg-[#4CAF50]/18 text-[#7FD48F]" : "border-[#2F7D4E] bg-[#E7F4EC] text-[#164A31]"
                              : isDark ? "border-white/10 bg-white/[0.02] text-white/55 hover:border-white/20 hover:bg-white/[0.06]" : "border-[#ADBC9F] bg-white text-[#436850] hover:border-[#7EAD8E] hover:bg-[#EEF6EA]"
                          }`}
                        >
                          <span className="block text-sm leading-none">{option.value}</span>
                          <span className="mt-1 block text-[10px] font-medium opacity-80">{option.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </div>

        <div className={`flex flex-col-reverse gap-2 border-t px-5 py-4 sm:flex-row sm:items-center sm:justify-between ${isDark ? "border-white/10" : "border-[#ADBC9F]/60"}`}>
          <p className={`text-xs ${isDark ? "text-white/45" : "text-[#436850]"}`}>
            {changedCount === 0 ? "No result changes selected." : `${changedCount} board${changedCount === 1 ? "" : "s"} will be corrected.`}
          </p>
          <div className="flex gap-2">
            <button
              ref={cancelRef}
              type="button"
              onClick={onClose}
              className={`min-h-11 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${isDark ? "bg-white/08 text-white/75 hover:bg-white/12" : "bg-[#EEF4EC] text-[#436850] hover:bg-[#E4EFE5]"}`}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!canApply}
              onClick={() => onApply(results)}
              className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 ${isDark ? "bg-[#4CAF50] text-[#0A1A0F] hover:bg-[#67c969]" : "bg-[#436850] text-white hover:bg-[#2d5235]"}`}
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Apply correction
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
