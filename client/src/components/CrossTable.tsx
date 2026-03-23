/**
 * OTB Chess — Cross-Table Component
 * Classic FIDE-style N×N player vs. player results grid.
 * Each cell shows the result when the row-player faced the column-player.
 * Colour-coded: green=win, red=loss, grey=draw, diagonal=blocked.
 * Horizontally scrollable on small screens.
 */
import { useRef, useCallback, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import type { Player, Round } from "@/lib/tournamentData";
import { PlayerAvatar } from "@/components/PlayerAvatar";

// ─── Types ────────────────────────────────────────────────────────────────────
interface CrossTableProps {
  players: Player[];   // sorted by final rank (index 0 = rank 1)
  rounds: Round[];
  tournamentName: string;
  isDark: boolean;
}

// Result from row-player's perspective
type CellResult = "win" | "loss" | "draw" | "none" | "self";

interface Cell {
  result: CellResult;
  score: string;       // "1", "0", "½", or ""
  roundNum: number;
  board: number;
  asWhite: boolean;
}

// ─── Data Builder ─────────────────────────────────────────────────────────────
function buildMatrix(players: Player[], rounds: Round[]): Cell[][] {
  const n = players.length;
  const idToIdx = new Map(players.map((p, i) => [p.id, i]));

  const matrix: Cell[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) =>
      i === j
        ? { result: "self", score: "", roundNum: 0, board: 0, asWhite: false }
        : { result: "none", score: "", roundNum: 0, board: 0, asWhite: false }
    )
  );

  for (const round of rounds) {
    for (const game of round.games) {
      if (game.result === "*") continue;
      const wi = idToIdx.get(game.whiteId);
      const bi = idToIdx.get(game.blackId);
      if (wi === undefined || bi === undefined) continue;

      let whiteResult: CellResult, blackResult: CellResult;
      let whiteScore: string, blackScore: string;

      if (game.result === "1-0") {
        whiteResult = "win";  whiteScore = "1";
        blackResult = "loss"; blackScore = "0";
      } else if (game.result === "0-1") {
        whiteResult = "loss"; whiteScore = "0";
        blackResult = "win";  blackScore = "1";
      } else {
        whiteResult = "draw"; whiteScore = "½";
        blackResult = "draw"; blackScore = "½";
      }

      matrix[wi][bi] = { result: whiteResult, score: whiteScore, roundNum: round.number, board: game.board, asWhite: true };
      matrix[bi][wi] = { result: blackResult, score: blackScore, roundNum: round.number, board: game.board, asWhite: false };
    }
  }

  return matrix;
}

// ─── Cell Renderer ────────────────────────────────────────────────────────────
function ResultCell({ cell, isDark }: { cell: Cell; isDark: boolean }) {
  if (cell.result === "self") {
    return (
      <td className="p-0.5">
        <div className={`w-10 h-10 flex items-center justify-center rounded-md ${isDark ? "bg-white/04" : "bg-gray-100"}`}>
          <div className={`w-4 h-0.5 rounded-full ${isDark ? "bg-white/15" : "bg-gray-300"}`} />
        </div>
      </td>
    );
  }

  if (cell.result === "none") {
    return (
      <td className="p-0.5">
        <div className={`w-10 h-10 flex items-center justify-center rounded-md ${isDark ? "bg-white/02" : "bg-gray-50"}`}>
          <span className={`text-sm ${isDark ? "text-white/15" : "text-gray-200"}`}>·</span>
        </div>
      </td>
    );
  }

  const colorMap = {
    win:  isDark
      ? "bg-[#3D6B47]/35 text-[#5DC467] border border-[#4CAF50]/25 shadow-[0_0_8px_rgba(76,175,80,0.15)]"
      : "bg-emerald-50 text-emerald-700 border border-emerald-200",
    loss: isDark
      ? "bg-red-900/25 text-red-400 border border-red-500/20"
      : "bg-red-50 text-red-600 border border-red-200",
    draw: isDark
      ? "bg-white/06 text-white/45 border border-white/08"
      : "bg-gray-50 text-gray-500 border border-gray-200",
  };

  const cls = colorMap[cell.result as "win" | "loss" | "draw"];

  return (
    <td className="p-0.5">
      <div
        title={`Round ${cell.roundNum} · Board ${cell.board} · as ${cell.asWhite ? "White" : "Black"}`}
        className={`w-10 h-10 flex items-center justify-center rounded-md text-sm font-bold cursor-default select-none transition-transform hover:scale-110 ${cls}`}
      >
        {cell.score}
      </div>
    </td>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function CrossTable({ players, rounds, tournamentName, isDark }: CrossTableProps) {
  const matrix = buildMatrix(players, rounds);
  const tableRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  const handleExport = useCallback(async () => {
    if (!tableRef.current) return;
    setExporting(true);
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(tableRef.current, {
        pixelRatio: 2,
        backgroundColor: isDark ? "#1a2e1e" : "#ffffff",
        fetchRequestInit: { mode: "cors" },
      });
      const link = document.createElement("a");
      link.download = `${tournamentName.toLowerCase().replace(/\s+/g, "-")}-cross-table.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      // silent
    }
    setExporting(false);
  }, [isDark, tournamentName]);

  const bg      = isDark ? "bg-[oklch(0.22_0.06_145)]" : "bg-white";
  const border  = isDark ? "border-white/08" : "border-gray-100";
  const textMain = isDark ? "text-white" : "text-gray-900";
  const textMuted = isDark ? "text-white/40" : "text-gray-400";
  const rowHover = isDark ? "hover:bg-white/03" : "hover:bg-gray-50/70";

  return (
    <div className={`rounded-2xl border overflow-hidden ${bg} ${border}`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-6 py-4 border-b ${border}`}>
        <div>
          <h3
            className={`text-lg font-black ${textMain}`}
            style={{ fontFamily: "'Clash Display', sans-serif" }}
          >
            Cross-Table
          </h3>
          <p className={`text-xs mt-0.5 ${textMuted}`}>
            Results from each row player's perspective · hover a cell for round & board info
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Legend */}
          <div className="hidden sm:flex items-center gap-3">
            {[
              { label: "Win",  score: "1", cls: isDark ? "bg-[#3D6B47]/35 text-[#5DC467] border border-[#4CAF50]/25" : "bg-emerald-50 text-emerald-700 border border-emerald-200" },
              { label: "Draw", score: "½", cls: isDark ? "bg-white/06 text-white/45 border border-white/08" : "bg-gray-50 text-gray-500 border border-gray-200" },
              { label: "Loss", score: "0", cls: isDark ? "bg-red-900/25 text-red-400 border border-red-500/20" : "bg-red-50 text-red-600 border border-red-200" },
            ].map(({ label, score, cls }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className={`w-6 h-6 rounded text-xs font-bold flex items-center justify-center ${cls}`}>
                  {score}
                </div>
                <span className={`text-xs ${textMuted}`}>{label}</span>
              </div>
            ))}
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
      </div>

      {/* Scrollable table */}
      <div className="overflow-x-auto" ref={tableRef}>
        <div className={`p-4 ${bg}`}>
          <table className="w-full border-collapse" style={{ minWidth: `${Math.max(480, players.length * 44 + 280)}px` }}>
            <thead className="sticky top-0 z-20">
              <tr className={`${isDark ? "bg-[oklch(0.22_0.06_145)]" : "bg-white"}`}>
                {/* Player column header — sticky left + top */}
                <th className={`text-left pb-3 pr-4 text-xs font-semibold uppercase tracking-wider ${textMuted} w-[220px] sticky left-0 z-30 ${isDark ? "bg-[oklch(0.22_0.06_145)]" : "bg-white"}`}>
                  Player
                </th>
                {/* Column numbers */}
                {players.map((_, j) => (
                  <th
                    key={j}
                    className={`pb-3 text-center text-xs font-bold w-11 ${isDark ? "text-white/35" : "text-gray-400"} ${isDark ? "bg-[oklch(0.22_0.06_145)]" : "bg-white"}`}
                  >
                    {j + 1}
                  </th>
                ))}
                {/* Score */}
                <th className={`pb-3 pl-4 text-xs font-semibold uppercase tracking-wider ${textMuted} text-right whitespace-nowrap ${isDark ? "bg-[oklch(0.22_0.06_145)]" : "bg-white"}`}>
                  Score
                </th>
                {/* Buchholz */}
                <th className={`pb-3 pl-3 text-xs font-semibold uppercase tracking-wider ${textMuted} text-right whitespace-nowrap ${isDark ? "bg-[oklch(0.22_0.06_145)]" : "bg-white"}`}>
                  Buch.
                </th>
              </tr>
            </thead>
            <tbody>
              {players.map((player, i) => (
                <tr
                  key={player.id}
                  className={`group transition-colors ${rowHover}`}
                >
                  {/* Rank + Player name — sticky */}
                  <td className={`pr-4 py-1.5 border-b ${isDark ? "border-white/04" : "border-gray-100"} sticky left-0 z-10 ${isDark ? "bg-[oklch(0.22_0.06_145)] group-hover:bg-[oklch(0.24_0.06_145)]" : "bg-white group-hover:bg-gray-50/70"}`}>
                    <div className="flex items-center gap-2.5">
                      {/* Rank number */}
                      <span
                        className={`w-6 text-center text-xs font-black flex-shrink-0 tabular-nums ${
                          i === 0 ? (isDark ? "text-yellow-400" : "text-yellow-600")
                          : i === 1 ? (isDark ? "text-gray-300" : "text-gray-500")
                          : i === 2 ? (isDark ? "text-amber-600" : "text-amber-700")
                          : (isDark ? "text-white/25" : "text-gray-300")
                        }`}
                      >
                        {i + 1}
                      </span>
                      <PlayerAvatar
                        username={player.username}
                        name={player.name}
                        size={26}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          {player.title && (
                            <span className="text-[9px] font-bold text-[#3D6B47] bg-[#3D6B47]/12 px-1.5 py-0.5 rounded leading-none flex-shrink-0">
                              {player.title}
                            </span>
                          )}
                          <span className={`text-sm font-semibold truncate ${isDark ? "text-white" : "text-gray-900"}`}>
                            {player.name}
                          </span>
                        </div>
                        <span className={`text-[11px] ${textMuted} tabular-nums`}>{player.elo} ELO</span>
                      </div>
                    </div>
                  </td>

                  {/* Result cells */}
                  {matrix[i].map((cell, j) => (
                    <ResultCell key={j} cell={cell} isDark={isDark} />
                  ))}

                  {/* Score */}
                  <td className={`pl-4 py-1.5 border-b ${isDark ? "border-white/04" : "border-gray-100"} text-right`}>
                    <span
                      className={`text-base font-black tabular-nums ${isDark ? "text-[#5DC467]" : "text-[#3D6B47]"}`}
                      style={{ fontFamily: "'Clash Display', sans-serif" }}
                    >
                      {player.points}
                    </span>
                  </td>

                  {/* Buchholz */}
                  <td className={`pl-3 py-1.5 border-b ${isDark ? "border-white/04" : "border-gray-100"} text-right`}>
                    <span className={`text-sm tabular-nums font-medium ${textMuted}`}>
                      {player.buchholz.toFixed(1)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile legend */}
      <div className={`flex sm:hidden items-center gap-4 px-6 py-3 border-t ${border}`}>
        {[
          { label: "Win",  score: "1", cls: isDark ? "bg-[#3D6B47]/35 text-[#5DC467] border border-[#4CAF50]/25" : "bg-emerald-50 text-emerald-700 border border-emerald-200" },
          { label: "Draw", score: "½", cls: isDark ? "bg-white/06 text-white/45 border border-white/08" : "bg-gray-50 text-gray-500 border border-gray-200" },
          { label: "Loss", score: "0", cls: isDark ? "bg-red-900/25 text-red-400 border border-red-500/20" : "bg-red-50 text-red-600 border border-red-200" },
        ].map(({ label, score, cls }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className={`w-6 h-6 rounded text-xs font-bold flex items-center justify-center ${cls}`}>
              {score}
            </div>
            <span className={`text-xs ${textMuted}`}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
