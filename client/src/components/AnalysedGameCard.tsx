import { ExternalLink, BookOpen } from "lucide-react";
import type { AnalysedGame } from "../hooks/useMyAnalysedGames";

function formatDate(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short", day: "numeric", year: "numeric",
    });
  } catch {
    return iso;
  }
}

function getResultConfig(result: string | null, isDark: boolean) {
  switch (result) {
    case "1-0":
      return { label: "1 – 0", bg: isDark ? "bg-white/10" : "bg-gray-100", text: isDark ? "text-white" : "text-gray-800", border: isDark ? "border-white/20" : "border-gray-300" };
    case "0-1":
      return { label: "0 – 1", bg: isDark ? "bg-[#4ade80]/15" : "bg-emerald-50", text: isDark ? "text-[#4ade80]" : "text-emerald-700", border: isDark ? "border-[#4ade80]/25" : "border-emerald-200" };
    case "1/2-1/2":
      return { label: "½ – ½", bg: isDark ? "bg-yellow-400/10" : "bg-yellow-50", text: isDark ? "text-yellow-300" : "text-yellow-700", border: isDark ? "border-yellow-400/20" : "border-yellow-200" };
    default:
      return { label: "—", bg: isDark ? "bg-white/5" : "bg-gray-50", text: isDark ? "text-white/40" : "text-gray-400", border: isDark ? "border-white/10" : "border-gray-200" };
  }
}

function accuracyColor(acc: number | null): string {
  if (acc === null) return "bg-white/20";
  if (acc >= 90) return "bg-[#4ade80]";
  if (acc >= 75) return "bg-emerald-400";
  if (acc >= 60) return "bg-yellow-400";
  if (acc >= 45) return "bg-orange-400";
  return "bg-red-400";
}

function AccuracyBar({ label, accuracy, isDark }: { label: string; accuracy: number | null; isDark: boolean }) {
  const pct = accuracy !== null ? Math.min(100, Math.max(0, accuracy)) : 0;
  const muted = isDark ? "text-white/40" : "text-gray-400";
  const textColor = isDark ? "text-white/70" : "text-gray-700";
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className={`text-[10px] font-medium w-10 shrink-0 truncate ${muted}`}>{label}</span>
      <div className={`flex-1 h-1.5 rounded-full overflow-hidden ${isDark ? "bg-white/10" : "bg-gray-200"}`}>
        <div className={`h-full rounded-full transition-all ${accuracyColor(accuracy)}`} style={{ width: accuracy !== null ? `${pct}%` : "0%" }} />
      </div>
      <span className={`text-[10px] font-semibold w-7 text-right shrink-0 ${textColor}`}>
        {accuracy !== null ? `${Math.round(accuracy)}%` : "—"}
      </span>
    </div>
  );
}

export default function AnalysedGameCard({ game, isDark }: { game: AnalysedGame; isDark: boolean }) {
  const resultCfg = getResultConfig(game.result, isDark);
  const card = isDark ? "bg-white/5 border-white/10" : "bg-white border-gray-200";
  const text = isDark ? "text-white" : "text-gray-900";
  const muted = isDark ? "text-white/40" : "text-gray-400";
  const whiteName = game.whitePlayer ?? "White";
  const blackName = game.blackPlayer ?? "Black";
  const hasAccuracy = game.whiteAccuracy !== null || game.blackAccuracy !== null;

  return (
    <a
      href={`/game/${game.id}/analysis`}
      className={`group flex flex-col gap-3 rounded-2xl border p-4 transition-all hover:shadow-md hover:border-[#4ade80]/30 ${card}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-lg border ${resultCfg.bg} ${resultCfg.text} ${resultCfg.border}`}>
            {resultCfg.label}
          </span>
          <div className="min-w-0">
            <p className={`text-sm font-semibold ${text} truncate leading-tight`}>
              {whiteName}<span className={`font-normal ${muted}`}> vs </span>{blackName}
            </p>
            {game.event && <p className={`text-[11px] ${muted} truncate leading-tight mt-0.5`}>{game.event}</p>}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`text-[11px] ${muted}`}>{formatDate(game.date ?? game.createdAt)}</span>
          <ExternalLink className={`w-3.5 h-3.5 ${muted} group-hover:text-[#4ade80] transition-colors`} />
        </div>
      </div>

      {game.openingName && (
        <div className="flex items-center gap-1.5">
          <BookOpen className={`w-3 h-3 shrink-0 ${muted}`} />
          <span className={`text-[11px] ${muted} truncate`}>
            {game.openingEco && <><span className="font-semibold">{game.openingEco}</span>{" · "}</>}
            {game.openingName}
          </span>
        </div>
      )}

      {hasAccuracy && (
        <div className="space-y-1.5 pt-1 border-t border-white/5">
          <AccuracyBar label={whiteName.split(" ")[0]} accuracy={game.whiteAccuracy} isDark={isDark} />
          <AccuracyBar label={blackName.split(" ")[0]} accuracy={game.blackAccuracy} isDark={isDark} />
        </div>
      )}

      {game.totalMoves > 0 && (
        <p className={`text-[10px] ${muted}`}>{game.totalMoves} move{game.totalMoves !== 1 ? "s" : ""}</p>
      )}
    </a>
  );
}
