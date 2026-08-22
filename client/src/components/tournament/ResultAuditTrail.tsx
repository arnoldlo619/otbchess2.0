import { Clock3, History, RotateCcw, UserRoundCheck } from "lucide-react";
import type { ResultHistoryEntry } from "@/lib/directorState";
import type { Player, Result } from "@/lib/tournamentData";
import type { QuadSection } from "@/lib/quads";

interface ResultAuditTrailProps {
  entries: ResultHistoryEntry[];
  players: Player[];
  sections?: QuadSection[];
  isDark: boolean;
  canUndo?: boolean;
  undoLabel?: string;
  onUndo?: () => void;
}

const RESULT_LABELS: Record<Result, string> = {
  "1-0": "1–0",
  "0-1": "0–1",
  "½-½": "½–½",
  "*": "Pending",
};

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time unavailable";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function ResultAuditTrail({
  entries,
  players,
  sections,
  isDark,
  canUndo = false,
  undoLabel,
  onUndo,
}: ResultAuditTrailProps) {
  if (entries.length === 0) return null;

  const playerNames = new Map(players.map((player) => [player.id, player.name]));
  const sectionNames = new Map((sections ?? []).map((section) => [section.id, section.name]));
  const recentEntries = entries.slice(-8).reverse();

  return (
    <section
      aria-labelledby="result-audit-heading"
      className={`mt-4 overflow-hidden rounded-2xl border ${
        isDark ? "border-white/10 bg-white/[0.035]" : "border-[#ADBC9F]/70 bg-white"
      }`}
    >
      <div className={`flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 ${isDark ? "border-white/10" : "border-[#ADBC9F]/60"}`}>
        <div className="flex min-w-0 items-center gap-2.5">
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${isDark ? "bg-[#436850]/25 text-[#6FCF7F]" : "bg-[#E8F5E9] text-[#436850]"}`}>
            <History className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h3 id="result-audit-heading" className={`text-sm font-bold ${isDark ? "text-white" : "text-[#12372A]"}`}>
              Result activity
            </h3>
            <p className={`text-[11px] ${isDark ? "text-white/45" : "text-[#436850]"}`}>
              Latest recorded changes, newest first
            </p>
          </div>
        </div>
        {canUndo && onUndo && (
          <button
            type="button"
            onClick={onUndo}
            className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${
              isDark
                ? "border-amber-400/30 bg-amber-400/10 text-amber-300 hover:bg-amber-400/15"
                : "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
            }`}
            aria-label={undoLabel ? `Undo ${undoLabel}` : "Undo latest result"}
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Undo latest
          </button>
        )}
      </div>

      <ol className="divide-y divide-current/10">
        {recentEntries.map((entry) => {
          const whiteName = playerNames.get(entry.whiteId) ?? "White";
          const blackName = playerNames.get(entry.blackId) ?? "Black";
          const sectionName = entry.sectionId ? sectionNames.get(entry.sectionId) : undefined;
          const actionLabel = entry.action === "undone" ? "Undid" : entry.action === "corrected" ? "Corrected" : "Recorded";

          return (
            <li key={entry.id} className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={`text-xs font-bold ${isDark ? "text-white" : "text-[#12372A]"}`}>
                    {actionLabel} {RESULT_LABELS[entry.newResult]}
                  </span>
                  {entry.previousResult && (
                    <span className={`text-[10px] ${isDark ? "text-white/35" : "text-[#6B7F72]"}`}>
                      from {RESULT_LABELS[entry.previousResult]}
                    </span>
                  )}
                  {sectionName && (
                    <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] ${isDark ? "bg-white/8 text-white/55" : "bg-[#EEF4EC] text-[#436850]"}`}>
                      {sectionName}
                    </span>
                  )}
                </div>
                <p className={`mt-1 truncate text-[11px] ${isDark ? "text-white/50" : "text-[#436850]"}`}>
                  Round {entry.round}, Board {entry.board}: {whiteName} vs {blackName}
                </p>
              </div>
              <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] ${isDark ? "text-white/40" : "text-[#6B7F72]"}`}>
                <span className="inline-flex items-center gap-1">
                  <UserRoundCheck className="h-3 w-3" aria-hidden="true" />
                  {entry.actorName}
                </span>
                <time dateTime={entry.timestamp} className="inline-flex items-center gap-1">
                  <Clock3 className="h-3 w-3" aria-hidden="true" />
                  {formatTimestamp(entry.timestamp)}
                </time>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
