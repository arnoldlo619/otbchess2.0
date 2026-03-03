/**
 * OTB Chess — Cross-Table Component
 * Classic FIDE-style N×N player vs. player results grid.
 * Each cell shows the result when the row-player faced the column-player.
 * Colour-coded: green=win, red=loss, grey=draw, diagonal=blocked.
 * Horizontally scrollable on small screens.
 */
import { useRef, useCallback, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import type { Player, Round, Result } from "@/lib/tournamentData";
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
function buildMatrix(
  players: Player[],
  rounds: Round[]
): Cell[][] {
  const n = players.length;
  const idToIdx = new Map(players.map((p, i) => [p.id, i]));

  // Initialize all cells as "none"
  const matrix: Cell[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) =>
      i === j
        ? { result: "self", score: "", roundNum: 0, board: 0, asWhite: false }
        : { result: "none", score: "", roundNum: 0, board: 0, asWhite: false }
    )
  );

  for (const round of rounds) {
    for (const game of round.games) {
      if (game.result === "*") continue; // unplayed
      const wi = idToIdx.get(game.whiteId);
      const bi = idToIdx.get(game.blackId);
      if (wi === undefined || bi === undefined) continue;

      let whiteResult: CellResult;
      let blackResult: CellResult;
      let whiteScore: string;
      let blackScore: string;

      if (game.result === "1-0") {
        whiteResult = "win"; whiteScore = "1";
        blackResult = "loss"; blackScore = "0";
      } else if (game.result === "0-1") {
        whiteResult = "loss"; whiteScore = "0";
        blackResult = "win"; blackScore = "1";
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
      <td className={`w-9 h-9 text-center border ${isDark ? "border-white/06 bg-white/04" : "border-gray-100 bg-gray-50"}`}>
        <div className={`w-full h-full flex items-center justify-center`}>
          <div className={`w-4 h-0.5 ${isDark ? "bg-white/15" : "bg-gray-300"}`} />
        </div>
      </td>
    );
  }

  if (cell.result === "none") {
    return (
      <td className={`w-9 h-9 text-center border ${isDark ? "border-white/06" : "border-gray-100"}`}>
        <span className={`text-xs ${isDark ? "text-white/20" : "text-gray-300"}`}>·</span>
      </td>
    );
  }

  const colorMap = {
    win:  isDark ? "bg-[#3D6B47]/40 text-[#4CAF50] border-[#4CAF50]/20" : "bg-[#3D6B47]/08 text-[#3D6B47] border-[#3D6B47]/15",
    loss: isDark ? "bg-red-900/30 text-red-400 border-red-500/20" : "bg-red-50 text-red-600 border-red-200",
    draw: isDark ? "bg-white/06 text-white/50 border-white/10" : "bg-gray-50 text-gray-500 border-gray-200",
  };

  const cls = colorMap[cell.result as "win" | "loss" | "draw"];

  return (
    <td className={`w-9 h-9 text-center border ${isDark ? "border-white/06" : "border-gray-100"} p-0`}>
      <div
        title={`R${cell.roundNum} Bd${cell.board} as ${cell.asWhite ? "White" : "Black"}`}
        className={`w-full h-full flex items-center justify-center text-xs font-bold border rounded-sm cursor-default select-none ${cls}`}
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
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(tableRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: isDark ? "#1a2e1e" : "#ffffff",
        logging: false,
      });
      const link = document.createElement("a");
      link.download = `${tournamentName.toLowerCase().replace(/\s+/g, "-")}-cross-table.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch {
      // silent
    }
    setExporting(false);
  }, [isDark, tournamentName]);

  const bg = isDark ? "bg-[oklch(0.22_0.06_145)]" : "bg-white";
  const border = isDark ? "border-white/08" : "border-gray-100";
  const textMain = isDark ? "text-white" : "text-gray-900";
  const textMuted = isDark ? "text-white/40" : "text-gray-400";

  return (
    <div className={`rounded-2xl border overflow-hidden ${bg} ${border}`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-5 py-4 border-b ${border}`}>
        <div>
          <h3
            className={`text-base font-black ${textMain}`}
            style={{ fontFamily: "'Clash Display', sans-serif" }}
          >
            Cross-Table
          </h3>
          <p className={`text-xs mt-0.5 ${textMuted}`}>
            Result from row player's perspective · hover a cell for round/board info
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

      {/* Scrollable table */}
      <div className="overflow-x-auto" ref={tableRef}>
        <div className={`p-4 ${bg}`}>
          {/* Legend */}
          <div className="flex items-center gap-4 mb-3 flex-wrap">
            {[
              { label: "Win", cls: isDark ? "bg-[#3D6B47]/40 text-[#4CAF50]" : "bg-[#3D6B47]/08 text-[#3D6B47]" },
              { label: "Loss", cls: isDark ? "bg-red-900/30 text-red-400" : "bg-red-50 text-red-600" },
              { label: "Draw", cls: isDark ? "bg-white/06 text-white/50" : "bg-gray-50 text-gray-500" },
            ].map(({ label, cls }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className={`w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center ${cls}`}>
                  {label === "Win" ? "1" : label === "Loss" ? "0" : "½"}
                </div>
                <span className={`text-[11px] ${textMuted}`}>{label}</span>
              </div>
            ))}
            <span className={`text-[11px] ${textMuted} ml-auto`}>
              W = White · B = Black (tooltip)
            </span>
          </div>

          <table className="border-collapse min-w-max">
            <thead>
              <tr>
                {/* Rank + Name header */}
                <th className={`text-left pr-3 pb-2 text-xs font-semibold ${textMuted} whitespace-nowrap min-w-[160px]`}>
                  Player
                </th>
                {/* Column numbers */}
                {players.map((_, j) => (
                  <th
                    key={j}
                    className={`w-9 text-center pb-2 text-xs font-bold ${isDark ? "text-white/40" : "text-gray-400"}`}
                  >
                    {j + 1}
                  </th>
                ))}
                {/* Score column */}
                <th className={`pl-3 pb-2 text-xs font-semibold ${textMuted} whitespace-nowrap`}>
                  Score
                </th>
                <th className={`pl-2 pb-2 text-xs font-semibold ${textMuted} whitespace-nowrap`}>
                  Buch.
                </th>
              </tr>
            </thead>
            <tbody>
              {players.map((player, i) => (
                <tr key={player.id} className="group">
                  {/* Rank + Player name */}
                  <td className={`pr-3 py-1 border-b ${isDark ? "border-white/04" : "border-gray-50"}`}>
                    <div className="flex items-center gap-2 min-w-[160px]">
                      <span className={`w-5 text-center text-xs font-bold flex-shrink-0 ${isDark ? "text-white/25" : "text-gray-300"}`}>
                        {i + 1}
                      </span>
                      <PlayerAvatar
                        username={player.username}
                        name={player.name}
                        size={22}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1">
                          {player.title && (
                            <span className="text-[9px] font-bold text-[#3D6B47] bg-[#3D6B47]/10 px-1 py-0.5 rounded leading-none flex-shrink-0">
                              {player.title}
                            </span>
                          )}
                          <span className={`text-xs font-semibold truncate max-w-[90px] ${isDark ? "text-white" : "text-gray-900"}`}>
                            {player.name}
                          </span>
                        </div>
                        <span className={`text-[10px] ${textMuted}`}>{player.elo}</span>
                      </div>
                    </div>
                  </td>
                  {/* Result cells */}
                  {matrix[i].map((cell, j) => (
                    <ResultCell key={j} cell={cell} isDark={isDark} />
                  ))}
                  {/* Score */}
                  <td className={`pl-3 py-1 border-b ${isDark ? "border-white/04" : "border-gray-50"}`}>
                    <span
                      className={`text-sm font-black tabular-nums ${isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"}`}
                      style={{ fontFamily: "'Clash Display', sans-serif" }}
                    >
                      {player.points}
                    </span>
                  </td>
                  {/* Buchholz */}
                  <td className={`pl-2 py-1 border-b ${isDark ? "border-white/04" : "border-gray-50"}`}>
                    <span className={`text-xs tabular-nums ${textMuted}`}>
                      {player.buchholz.toFixed(1)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
