/**
 * OTB Chess — Round Timeline Component
 * Displays every round's pairings as a vertical timeline of board cards.
 * Each board card shows: board number, white player vs black player,
 * result badge, and duration. Players are shown with their avatar, name,
 * title, and ELO. Exportable as a single PNG.
 */
import { useRef, useCallback, useState } from "react";
import { Download, Loader2, ChevronDown, ChevronUp, CheckCircle2, Clock, Circle } from "lucide-react";
import type { Player, Round, Result } from "@/lib/tournamentData";
import { PlayerAvatar } from "@/components/PlayerAvatar";

// ─── Types ────────────────────────────────────────────────────────────────────
interface RoundTimelineProps {
  players: Player[];
  rounds: Round[];
  tournamentName: string;
  isDark: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function resultLabel(result: Result): {
  text: string;
  white: "win" | "loss" | "draw" | "pending";
  black: "win" | "loss" | "draw" | "pending";
} {
  switch (result) {
    case "1-0":  return { text: "1 – 0", white: "win",  black: "loss" };
    case "0-1":  return { text: "0 – 1", white: "loss", black: "win"  };
    case "½-½":  return { text: "½ – ½", white: "draw", black: "draw" };
    default:     return { text: "· – ·", white: "pending", black: "pending" };
  }
}

function outcomeStyle(outcome: "win" | "loss" | "draw" | "pending", isDark: boolean) {
  if (outcome === "win")     return isDark ? "text-[#5DC467] font-black" : "text-[#3D6B47] font-black";
  if (outcome === "loss")    return isDark ? "text-red-400/60" : "text-red-500/60";
  if (outcome === "draw")    return isDark ? "text-white/50" : "text-gray-500";
  return isDark ? "text-white/25" : "text-gray-300";
}

// ─── Board Card ───────────────────────────────────────────────────────────────
function BoardCard({
  game,
  playerMap,
  isDark,
}: {
  game: Round["games"][number];
  playerMap: Map<string, Player>;
  isDark: boolean;
}) {
  const white = playerMap.get(game.whiteId);
  const black = playerMap.get(game.blackId);
  if (!white || !black) return null;

  const { text: resultText, white: whiteOutcome, black: blackOutcome } = resultLabel(game.result);
  const bg     = isDark ? "bg-[oklch(0.24_0.06_145)]" : "bg-white";
  const border = isDark ? "border-white/08" : "border-gray-100";
  const textMain  = isDark ? "text-white" : "text-gray-900";
  const textMuted = isDark ? "text-white/40" : "text-gray-400";

  const resultBadgeCls =
    game.result === "*"
      ? isDark ? "bg-white/06 text-white/35" : "bg-gray-100 text-gray-400"
      : game.result === "½-½"
      ? isDark ? "bg-white/08 text-white/55" : "bg-gray-100 text-gray-600"
      : isDark ? "bg-[#3D6B47]/30 text-[#5DC467]" : "bg-[#3D6B47]/08 text-[#3D6B47]";

  function PlayerRow({
    player,
    outcome,
    color,
  }: {
    player: Player;
    outcome: "win" | "loss" | "draw" | "pending";
    color: "W" | "B";
  }) {
    const isWin = outcome === "win";
    return (
      <div
        className={`flex items-center gap-3 py-2.5 px-3 rounded-xl transition-colors ${
          isWin
            ? isDark ? "bg-[#3D6B47]/18" : "bg-[#3D6B47]/06"
            : ""
        }`}
      >
        {/* Piece colour dot */}
        <div
          className={`w-3.5 h-3.5 rounded-full flex-shrink-0 border-2 ${
            color === "W"
              ? isDark
                ? "bg-white/85 border-white/30"
                : "bg-white border-gray-300 shadow-sm"
              : isDark
              ? "bg-[oklch(0.15_0.04_145)] border-white/20"
              : "bg-gray-800 border-gray-600"
          }`}
        />
        <PlayerAvatar username={player.username} name={player.name} size={30} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            {player.title && (
              <span className="text-[9px] font-bold text-[#3D6B47] bg-[#3D6B47]/12 px-1.5 py-0.5 rounded leading-none flex-shrink-0">
                {player.title}
              </span>
            )}
            <span className={`text-sm font-semibold truncate ${textMain} ${outcomeStyle(outcome, isDark)}`}>
              {player.name}
            </span>
          </div>
          <span className={`text-[11px] ${textMuted} tabular-nums`}>{player.elo} ELO</span>
        </div>
        {/* Score */}
        <span
          className={`text-base font-black tabular-nums flex-shrink-0 ${outcomeStyle(outcome, isDark)}`}
          style={{ fontFamily: "'Clash Display', sans-serif" }}
        >
          {outcome === "win" ? "1" : outcome === "loss" ? "0" : outcome === "draw" ? "½" : "·"}
        </span>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border overflow-hidden ${bg} ${border} transition-shadow hover:shadow-md`}>
      {/* Board header */}
      <div
        className={`flex items-center justify-between px-4 py-2.5 border-b ${border} ${
          isDark ? "bg-white/03" : "bg-gray-50/70"
        }`}
      >
        <span className={`text-xs font-bold uppercase tracking-widest ${textMuted}`}>
          Board {game.board}
        </span>
        <div className="flex items-center gap-2">
          {game.duration && (
            <span className={`text-xs ${textMuted} flex items-center gap-1`}>
              <Clock className="w-3 h-3" />
              {game.duration}
            </span>
          )}
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${resultBadgeCls}`}>
            {resultText}
          </span>
        </div>
      </div>
      {/* Players */}
      <div className="p-2 space-y-0.5">
        <PlayerRow player={white} outcome={whiteOutcome} color="W" />
        <PlayerRow player={black} outcome={blackOutcome} color="B" />
      </div>
    </div>
  );
}

// ─── Round Panel ──────────────────────────────────────────────────────────────
function RoundPanel({
  round,
  playerMap,
  isDark,
  defaultOpen,
}: {
  round: Round;
  playerMap: Map<string, Player>;
  isDark: boolean;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const border    = isDark ? "border-white/08" : "border-gray-100";
  const textMain  = isDark ? "text-white" : "text-gray-900";
  const textMuted = isDark ? "text-white/40" : "text-gray-400";

  const completedGames = round.games.filter((g) => g.result !== "*").length;
  const totalGames     = round.games.length;
  const progressPct    = totalGames > 0 ? (completedGames / totalGames) * 100 : 0;

  const StatusIcon =
    round.status === "completed" ? CheckCircle2
    : round.status === "in_progress" ? Clock
    : Circle;

  const statusColor =
    round.status === "completed"
      ? isDark ? "text-[#5DC467] bg-[#3D6B47]/20" : "text-[#3D6B47] bg-[#3D6B47]/08"
      : round.status === "in_progress"
      ? isDark ? "text-amber-300 bg-amber-400/10" : "text-amber-700 bg-amber-50"
      : isDark ? "text-white/30 bg-white/05" : "text-gray-400 bg-gray-50";

  const statusIconColor =
    round.status === "completed"
      ? isDark ? "text-[#5DC467]" : "text-[#3D6B47]"
      : round.status === "in_progress"
      ? isDark ? "text-amber-300" : "text-amber-600"
      : isDark ? "text-white/20" : "text-gray-300";

  const statusLabel =
    round.status === "completed" ? "Complete" :
    round.status === "in_progress" ? "In Progress" : "Upcoming";

  return (
    <div
      className={`rounded-2xl border overflow-hidden ${
        isDark ? "bg-[oklch(0.22_0.06_145)]" : "bg-white"
      } ${border}`}
    >
      {/* Round header — clickable to expand/collapse */}
      <button
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between px-6 py-4 transition-colors ${
          isDark ? "hover:bg-white/03" : "hover:bg-gray-50/60"
        }`}
      >
        <div className="flex items-center gap-4">
          {/* Status icon */}
          <StatusIcon className={`w-5 h-5 flex-shrink-0 ${statusIconColor}`} />

          {/* Round number badge */}
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center text-base font-black flex-shrink-0 ${
              round.status === "completed"
                ? isDark ? "bg-[#3D6B47]/30 text-[#5DC467]" : "bg-[#3D6B47]/10 text-[#3D6B47]"
                : isDark ? "bg-white/08 text-white/60" : "bg-gray-100 text-gray-500"
            }`}
            style={{ fontFamily: "'Clash Display', sans-serif" }}
          >
            {round.number}
          </div>

          <div className="text-left">
            <div className="flex items-center gap-2">
              <span
                className={`text-base font-bold ${textMain}`}
                style={{ fontFamily: "'Clash Display', sans-serif" }}
              >
                Round {round.number}
              </span>
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${statusColor}`}>
                {statusLabel}
              </span>
            </div>
            <span className={`text-xs ${textMuted}`}>
              {completedGames} of {totalGames} boards complete
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Progress bar */}
          {totalGames > 0 && (
            <div className="hidden sm:flex flex-col items-end gap-1">
              <div className={`w-24 h-1.5 rounded-full overflow-hidden ${isDark ? "bg-white/08" : "bg-gray-100"}`}>
                <div
                  className={`h-full rounded-full transition-all ${
                    round.status === "completed"
                      ? isDark ? "bg-[#5DC467]" : "bg-[#3D6B47]"
                      : isDark ? "bg-amber-400" : "bg-amber-500"
                  }`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <span className={`text-[10px] tabular-nums ${textMuted}`}>
                {completedGames}/{totalGames}
              </span>
            </div>
          )}
          {open
            ? <ChevronUp className={`w-4 h-4 ${textMuted}`} />
            : <ChevronDown className={`w-4 h-4 ${textMuted}`} />
          }
        </div>
      </button>

      {/* Board cards grid */}
      {open && (
        <div className={`px-5 pb-5 border-t ${border} pt-5`}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {round.games.map((game) => (
              <BoardCard
                key={game.id}
                game={game}
                playerMap={playerMap}
                isDark={isDark}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function RoundTimeline({ players, rounds, tournamentName, isDark }: RoundTimelineProps) {
  const playerMap  = new Map(players.map((p) => [p.id, p]));
  const timelineRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  const handleExport = useCallback(async () => {
    if (!timelineRef.current) return;
    setExporting(true);
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(timelineRef.current, {
        pixelRatio: 2,
        backgroundColor: isDark ? "#1a2e1e" : "#f7faf8",
        fetchRequestInit: { mode: "cors" },
      });
      const link = document.createElement("a");
      link.download = `${tournamentName.toLowerCase().replace(/\s+/g, "-")}-rounds.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      // silent
    }
    setExporting(false);
  }, [isDark, tournamentName]);

  const textMain  = isDark ? "text-white" : "text-gray-900";
  const textMuted = isDark ? "text-white/40" : "text-gray-400";

  const completedCount = rounds.filter((r) => r.status === "completed").length;

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3
            className={`text-lg font-black ${textMain}`}
            style={{ fontFamily: "'Clash Display', sans-serif" }}
          >
            Round by Round
          </h3>
          <p className={`text-xs mt-0.5 ${textMuted}`}>
            {completedCount} of {rounds.length} rounds complete · click a round to expand
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            isDark
              ? "bg-white/08 hover:bg-white/12 text-white/70"
              : "bg-gray-100 hover:bg-gray-200 text-gray-600"
          }`}
        >
          {exporting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Download className="w-3.5 h-3.5" />
          )}
          Export PNG
        </button>
      </div>

      {/* Timeline */}
      <div className="space-y-3" ref={timelineRef}>
        {rounds.map((round, i) => (
          <RoundPanel
            key={round.number}
            round={round}
            playerMap={playerMap}
            isDark={isDark}
            defaultOpen={i === 0}
          />
        ))}
      </div>
    </div>
  );
}
