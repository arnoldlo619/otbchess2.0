/*
 * OTB Chess — Printable Pairings Sheet
 * Design: Clean, high-contrast print layout — black on white, no decorative colors
 * Sections:
 *   1. Tournament header (name, venue, date, format, time control)
 *   2. Current round pairing slips (one per board, cut-apart style)
 *   3. Wall chart (all rounds × all players, cross-table)
 *   4. Live standings table
 * Print media: @media print hides all screen chrome, shows only the document
 */

import { useState } from "react";
import { Link } from "wouter";
import { useTheme } from "@/contexts/ThemeContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  DEMO_TOURNAMENT,
  getStandings,
  FLAG_EMOJI,
  type Player,
  type Game,
  type Round,
} from "@/lib/tournamentData";
import {
  Crown,
  Printer,
  ChevronLeft,
  Shield,
  MapPin,
  Calendar,
  Clock,
  Users,
  Trophy,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function resultSymbol(result: string, side: "white" | "black"): string {
  if (result === "*") return "·";
  if (result === "½-½") return "½";
  if (side === "white") return result === "1-0" ? "1" : "0";
  return result === "0-1" ? "1" : "0";
}

function resultForPlayer(playerId: string, game: Game): string {
  if (game.result === "*") return "·";
  if (game.whiteId === playerId) return resultSymbol(game.result, "white");
  if (game.blackId === playerId) return resultSymbol(game.result, "black");
  return "";
}

function colorForPlayer(playerId: string, game: Game): "W" | "B" | null {
  if (game.whiteId === playerId) return "W";
  if (game.blackId === playerId) return "B";
  return null;
}

function opponentFor(playerId: string, game: Game, players: Player[]): Player | null {
  const oppId = game.whiteId === playerId ? game.blackId : game.whiteId;
  return players.find((p) => p.id === oppId) ?? null;
}

// ─── Print Styles (injected via <style> tag) ──────────────────────────────────
const PRINT_CSS = `
@media print {
  .no-print { display: none !important; }
  .print-only { display: block !important; }
  body { background: white !important; color: black !important; }
  .print-page { padding: 0 !important; }
  .print-break { page-break-after: always; }
  .pairing-slip { break-inside: avoid; }
}
@media screen {
  .print-only { display: none; }
}
`;

// ─── Pairing Slip ─────────────────────────────────────────────────────────────
function PairingSlip({
  game,
  players,
  tournamentName,
  round,
  timeControl,
  isDark,
}: {
  game: Game;
  players: Player[];
  tournamentName: string;
  round: number;
  timeControl: string;
  isDark: boolean;
}) {
  const white = players.find((p) => p.id === game.whiteId)!;
  const black = players.find((p) => p.id === game.blackId)!;

  return (
    <div
      className={`pairing-slip border-2 rounded-xl p-5 transition-colors ${
        isDark
          ? "border-white/15 bg-[oklch(0.22_0.06_145)]"
          : "border-gray-200 bg-white"
      }`}
      style={{ breakInside: "avoid" }}
    >
      {/* Slip header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-[#3D6B47] rounded flex items-center justify-center flex-shrink-0">
            <Crown className="w-3 h-3 text-white" strokeWidth={2.5} />
          </div>
          <span
            className={`text-xs font-bold uppercase tracking-widest ${isDark ? "text-white/50" : "text-gray-400"}`}
            style={{ fontFamily: "'Clash Display', sans-serif" }}
          >
            {tournamentName}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
              isDark ? "bg-[#3D6B47]/30 text-[#4CAF50]" : "bg-[#3D6B47]/10 text-[#3D6B47]"
            }`}
          >
            Round {round}
          </span>
          <span
            className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
              isDark ? "border-white/15 text-white/50" : "border-gray-200 text-gray-500"
            }`}
          >
            Board {game.board}
          </span>
        </div>
      </div>

      {/* Players */}
      <div className="space-y-3">
        {/* White */}
        <div
          className={`flex items-center gap-3 p-3 rounded-lg ${
            isDark ? "bg-white/08" : "bg-gray-50"
          }`}
        >
          <div
            className={`w-8 h-8 rounded border-2 flex-shrink-0 flex items-center justify-center text-xs font-bold ${
              isDark ? "bg-white/90 border-white/30 text-gray-900" : "bg-white border-gray-300 text-gray-700"
            }`}
          >
            W
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className={`font-bold text-sm ${isDark ? "text-white" : "text-gray-900"}`}
                style={{ fontFamily: "'Clash Display', sans-serif" }}
              >
                {white.name}
              </span>
              {white.title && (
                <span className="text-xs font-bold text-[#3D6B47] bg-[#3D6B47]/10 px-1.5 py-0.5 rounded">
                  {white.title}
                </span>
              )}
              <span className="text-xs">{FLAG_EMOJI[white.country]}</span>
            </div>
            <span className={`text-xs ${isDark ? "text-white/40" : "text-gray-400"}`}>
              @{white.username} · {white.elo} ELO
            </span>
          </div>
          <div className={`text-right ${isDark ? "text-white/60" : "text-gray-500"}`}>
            <p className={`text-lg font-bold ${isDark ? "text-white" : "text-gray-900"}`}>{white.points}</p>
            <p className="text-xs">pts</p>
          </div>
        </div>

        {/* VS divider */}
        <div className="flex items-center gap-3">
          <div className={`flex-1 h-px ${isDark ? "bg-white/08" : "bg-gray-100"}`} />
          <span className={`text-xs font-bold ${isDark ? "text-white/30" : "text-gray-300"}`}>VS</span>
          <div className={`flex-1 h-px ${isDark ? "bg-white/08" : "bg-gray-100"}`} />
        </div>

        {/* Black */}
        <div
          className={`flex items-center gap-3 p-3 rounded-lg ${
            isDark ? "bg-white/04" : "bg-gray-50/60"
          }`}
        >
          <div
            className={`w-8 h-8 rounded border-2 flex-shrink-0 flex items-center justify-center text-xs font-bold ${
              isDark
                ? "bg-[oklch(0.12_0.04_145)] border-white/10 text-white/60"
                : "bg-gray-800 border-gray-600 text-white"
            }`}
          >
            B
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className={`font-bold text-sm ${isDark ? "text-white" : "text-gray-900"}`}
                style={{ fontFamily: "'Clash Display', sans-serif" }}
              >
                {black.name}
              </span>
              {black.title && (
                <span className="text-xs font-bold text-[#3D6B47] bg-[#3D6B47]/10 px-1.5 py-0.5 rounded">
                  {black.title}
                </span>
              )}
              <span className="text-xs">{FLAG_EMOJI[black.country]}</span>
            </div>
            <span className={`text-xs ${isDark ? "text-white/40" : "text-gray-400"}`}>
              @{black.username} · {black.elo} ELO
            </span>
          </div>
          <div className={`text-right ${isDark ? "text-white/60" : "text-gray-500"}`}>
            <p className={`text-lg font-bold ${isDark ? "text-white" : "text-gray-900"}`}>{black.points}</p>
            <p className="text-xs">pts</p>
          </div>
        </div>
      </div>

      {/* Result entry line */}
      <div
        className={`mt-4 pt-4 border-t flex items-center justify-between ${
          isDark ? "border-white/08" : "border-gray-100"
        }`}
      >
        <div className="flex items-center gap-4">
          <span className={`text-xs ${isDark ? "text-white/30" : "text-gray-400"}`}>Result:</span>
          <div className="flex gap-2">
            {["1-0", "½-½", "0-1"].map((r) => (
              <span
                key={r}
                className={`text-xs font-mono font-bold px-2.5 py-1 rounded border ${
                  isDark ? "border-white/15 text-white/50" : "border-gray-200 text-gray-400"
                }`}
              >
                {r}
              </span>
            ))}
          </div>
        </div>
        <div className={`flex items-center gap-2 text-xs ${isDark ? "text-white/30" : "text-gray-400"}`}>
          <Clock className="w-3 h-3" />
          {timeControl}
        </div>
      </div>
    </div>
  );
}

// ─── Wall Chart ───────────────────────────────────────────────────────────────
function WallChart({
  players,
  rounds,
  isDark,
}: {
  players: Player[];
  rounds: Round[];
  isDark: boolean;
}) {
  const standings = getStandings(players);
  const totalRounds = DEMO_TOURNAMENT.rounds;

  // Build a lookup: playerId → round number → { result, color, opponent }
  const lookup: Record<string, Record<number, { res: string; color: "W" | "B"; oppName: string; oppElo: number }>> = {};
  standings.forEach((p) => {
    lookup[p.id] = {};
    rounds.forEach((round) => {
      const game = round.games.find((g) => g.whiteId === p.id || g.blackId === p.id);
      if (game) {
        const color = colorForPlayer(p.id, game)!;
        const res = resultForPlayer(p.id, game);
        const opp = opponentFor(p.id, game, players);
        lookup[p.id][round.number] = {
          res,
          color,
          oppName: opp?.name.split(" ")[0] ?? "BYE",
          oppElo: opp?.elo ?? 0,
        };
      }
    });
  });

  const headerBg = isDark ? "bg-[oklch(0.20_0.06_145)]" : "bg-[#F0F5EE]";
  const rowBg = isDark ? "bg-[oklch(0.22_0.06_145)]" : "bg-white";
  const altRowBg = isDark ? "bg-[oklch(0.24_0.06_145)]" : "bg-gray-50/60";
  const borderColor = isDark ? "border-white/08" : "border-gray-100";
  const textMuted = isDark ? "text-white/40" : "text-gray-400";
  const textMain = isDark ? "text-white" : "text-gray-900";

  return (
    <div className={`rounded-xl border overflow-hidden ${isDark ? "border-white/08" : "border-gray-100"}`}>
      <div className={`overflow-x-auto`}>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className={headerBg}>
              <th className={`text-left px-4 py-3 text-xs font-bold uppercase tracking-wider ${textMuted} border-b ${borderColor} w-8`}>#</th>
              <th className={`text-left px-4 py-3 text-xs font-bold uppercase tracking-wider ${textMuted} border-b ${borderColor}`}>Player</th>
              <th className={`text-center px-3 py-3 text-xs font-bold uppercase tracking-wider ${textMuted} border-b ${borderColor} w-16`}>ELO</th>
              {Array.from({ length: totalRounds }, (_, i) => i + 1).map((r) => (
                <th
                  key={r}
                  className={`text-center px-3 py-3 text-xs font-bold uppercase tracking-wider border-b ${borderColor} w-20 ${
                    r === DEMO_TOURNAMENT.currentRound
                      ? isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"
                      : textMuted
                  }`}
                >
                  R{r}
                </th>
              ))}
              <th className={`text-center px-4 py-3 text-xs font-bold uppercase tracking-wider ${textMuted} border-b ${borderColor} w-16`}>Pts</th>
              <th className={`text-center px-4 py-3 text-xs font-bold uppercase tracking-wider ${textMuted} border-b ${borderColor} w-20`}>Buch.</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((player, idx) => {
              const isTop3 = idx < 3;
              const medals = ["🥇", "🥈", "🥉"];
              return (
                <tr
                  key={player.id}
                  className={`transition-colors ${idx % 2 === 0 ? rowBg : altRowBg} ${
                    isTop3 ? (isDark ? "border-l-2 border-l-[#4CAF50]" : "border-l-2 border-l-[#3D6B47]") : ""
                  }`}
                >
                  {/* Rank */}
                  <td className={`px-4 py-3 border-b ${borderColor} text-center`}>
                    {isTop3 ? (
                      <span className="text-base">{medals[idx]}</span>
                    ) : (
                      <span className={`text-xs font-bold ${textMuted}`}>{idx + 1}</span>
                    )}
                  </td>

                  {/* Player */}
                  <td className={`px-4 py-3 border-b ${borderColor}`}>
                    <div className="flex items-center gap-2">
                      <span className={`font-semibold ${textMain}`} style={{ fontFamily: "'Clash Display', sans-serif" }}>
                        {player.name}
                      </span>
                      {player.title && (
                        <span className="text-xs font-bold text-[#3D6B47] bg-[#3D6B47]/10 px-1.5 py-0.5 rounded">
                          {player.title}
                        </span>
                      )}
                      <span className="text-xs">{FLAG_EMOJI[player.country]}</span>
                    </div>
                    <span className={`text-xs ${textMuted}`}>@{player.username}</span>
                  </td>

                  {/* ELO */}
                  <td className={`px-3 py-3 border-b ${borderColor} text-center`}>
                    <span className={`text-xs font-mono font-bold ${
                      player.elo >= 2200 ? "text-purple-500"
                      : player.elo >= 2000 ? "text-amber-500"
                      : player.elo >= 1800 ? "text-sky-500"
                      : textMuted
                    }`}>
                      {player.elo}
                    </span>
                  </td>

                  {/* Round cells */}
                  {Array.from({ length: totalRounds }, (_, i) => i + 1).map((r) => {
                    const cell = lookup[player.id]?.[r];
                    const isCurrentRound = r === DEMO_TOURNAMENT.currentRound;
                    return (
                      <td
                        key={r}
                        className={`px-3 py-3 border-b ${borderColor} text-center ${
                          isCurrentRound
                            ? isDark ? "bg-[#3D6B47]/10" : "bg-[#3D6B47]/04"
                            : ""
                        }`}
                      >
                        {cell ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <span
                              className={`text-sm font-bold tabular-nums ${
                                cell.res === "1" ? "text-emerald-500"
                                : cell.res === "0" ? isDark ? "text-white/30" : "text-gray-300"
                                : cell.res === "½" ? "text-blue-500"
                                : isDark ? "text-white/20" : "text-gray-200"
                              }`}
                            >
                              {cell.res}
                            </span>
                            <div className="flex items-center gap-0.5">
                              <span
                                className={`text-[9px] font-bold px-1 rounded ${
                                  cell.color === "W"
                                    ? isDark ? "bg-white/20 text-white/60" : "bg-gray-200 text-gray-500"
                                    : isDark ? "bg-white/08 text-white/30" : "bg-gray-800 text-white"
                                }`}
                              >
                                {cell.color}
                              </span>
                              <span className={`text-[9px] ${textMuted} truncate max-w-[36px]`}>
                                {cell.oppName}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className={`text-xs ${textMuted}`}>—</span>
                        )}
                      </td>
                    );
                  })}

                  {/* Points */}
                  <td className={`px-4 py-3 border-b ${borderColor} text-center`}>
                    <span className={`text-base font-bold tabular-nums ${textMain}`}>
                      {player.points}
                    </span>
                  </td>

                  {/* Buchholz */}
                  <td className={`px-4 py-3 border-b ${borderColor} text-center`}>
                    <span className={`text-xs font-mono ${textMuted}`}>{player.buchholz}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Standings Table ──────────────────────────────────────────────────────────
function StandingsTable({ players, isDark }: { players: Player[]; isDark: boolean }) {
  const standings = getStandings(players);
  const medals = ["🥇", "🥈", "🥉"];
  const borderColor = isDark ? "border-white/08" : "border-gray-100";
  const textMuted = isDark ? "text-white/40" : "text-gray-400";
  const textMain = isDark ? "text-white" : "text-gray-900";
  const rowBg = isDark ? "bg-[oklch(0.22_0.06_145)]" : "bg-white";
  const altRowBg = isDark ? "bg-[oklch(0.24_0.06_145)]" : "bg-gray-50/60";

  return (
    <div className={`rounded-xl border overflow-hidden ${isDark ? "border-white/08" : "border-gray-100"}`}>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className={isDark ? "bg-[oklch(0.20_0.06_145)]" : "bg-[#F0F5EE]"}>
            {["#", "Player", "ELO", "W", "D", "L", "Pts", "Buchholz"].map((h) => (
              <th
                key={h}
                className={`px-4 py-3 text-xs font-bold uppercase tracking-wider ${textMuted} border-b ${borderColor} ${
                  h === "Player" ? "text-left" : "text-center"
                }`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {standings.map((p, i) => (
            <tr key={p.id} className={`transition-colors ${i % 2 === 0 ? rowBg : altRowBg}`}>
              <td className={`px-4 py-3 border-b ${borderColor} text-center`}>
                {i < 3 ? (
                  <span className="text-base">{medals[i]}</span>
                ) : (
                  <span className={`text-xs font-bold ${textMuted}`}>{i + 1}</span>
                )}
              </td>
              <td className={`px-4 py-3 border-b ${borderColor}`}>
                <div className="flex items-center gap-2">
                  <span className={`font-semibold ${textMain}`} style={{ fontFamily: "'Clash Display', sans-serif" }}>
                    {p.name}
                  </span>
                  {p.title && (
                    <span className="text-xs font-bold text-[#3D6B47] bg-[#3D6B47]/10 px-1.5 py-0.5 rounded">
                      {p.title}
                    </span>
                  )}
                  <span className="text-xs">{FLAG_EMOJI[p.country]}</span>
                </div>
                <span className={`text-xs ${textMuted}`}>@{p.username}</span>
              </td>
              <td className={`px-4 py-3 border-b ${borderColor} text-center`}>
                <span className={`text-xs font-mono font-bold ${
                  p.elo >= 2200 ? "text-purple-500"
                  : p.elo >= 2000 ? "text-amber-500"
                  : p.elo >= 1800 ? "text-sky-500"
                  : textMuted
                }`}>{p.elo}</span>
              </td>
              {[p.wins, p.draws, p.losses].map((v, vi) => (
                <td key={vi} className={`px-4 py-3 border-b ${borderColor} text-center`}>
                  <span className={`text-sm font-semibold tabular-nums ${
                    vi === 0 ? "text-emerald-500"
                    : vi === 1 ? "text-blue-500"
                    : isDark ? "text-white/30" : "text-gray-300"
                  }`}>{v}</span>
                </td>
              ))}
              <td className={`px-4 py-3 border-b ${borderColor} text-center`}>
                <span className={`text-base font-bold tabular-nums ${textMain}`}>{p.points}</span>
              </td>
              <td className={`px-4 py-3 border-b ${borderColor} text-center`}>
                <span className={`text-xs font-mono ${textMuted}`}>{p.buchholz}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PrintPage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [activeSection, setActiveSection] = useState<"slips" | "wallchart" | "standings">("slips");

  const tournament = DEMO_TOURNAMENT;
  const currentRound = tournament.roundData.find((r) => r.number === tournament.currentRound);
  const players = tournament.players;

  const sectionTabs = [
    { id: "slips" as const, label: "Pairing Slips", icon: "📋" },
    { id: "wallchart" as const, label: "Wall Chart", icon: "📊" },
    { id: "standings" as const, label: "Standings", icon: "🏆" },
  ];

  return (
    <>
      <style>{PRINT_CSS}</style>

      <div
        className={`min-h-screen transition-colors duration-300 ${
          isDark ? "bg-[oklch(0.18_0.05_145)]" : "bg-[#F7FAF8]"
        }`}
      >
        {/* ── Top Bar (no-print) ─────────────────────────────────────────── */}
        <header
          className={`no-print sticky top-0 z-40 border-b transition-colors duration-300 ${
            isDark
              ? "bg-[oklch(0.20_0.06_145)]/95 backdrop-blur-md border-white/08"
              : "bg-white/95 backdrop-blur-md border-gray-100"
          }`}
        >
          <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
            {/* Left: breadcrumb */}
            <div className="flex items-center gap-2.5">
              <Link href="/" className="flex items-center gap-2 group">
                <div className="w-7 h-7 bg-[#3D6B47] rounded-md flex items-center justify-center">
                  <Crown className="w-3.5 h-3.5 text-white" strokeWidth={2} />
                </div>
                <span
                  className={`font-semibold text-sm hidden sm:block ${isDark ? "text-white/80" : "text-gray-600"}`}
                  style={{ fontFamily: "'Clash Display', sans-serif" }}
                >
                  OTB Chess
                </span>
              </Link>
              <span className={`text-sm ${isDark ? "text-white/20" : "text-gray-300"}`}>/</span>
              <Link
                href="/tournament/otb-demo-2026"
                className={`flex items-center gap-1 text-sm transition-colors ${
                  isDark ? "text-white/50 hover:text-white/80" : "text-gray-400 hover:text-gray-700"
                }`}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Standings
              </Link>
              <span className={`text-sm ${isDark ? "text-white/20" : "text-gray-300"}`}>/</span>
              <div className="flex items-center gap-1.5">
                <Printer className="w-3.5 h-3.5 text-[#3D6B47]" />
                <span
                  className={`text-sm font-semibold ${isDark ? "text-white" : "text-gray-900"}`}
                  style={{ fontFamily: "'Clash Display', sans-serif" }}
                >
                  Print
                </span>
              </div>
            </div>

            {/* Right: Director + Print + Theme */}
            <div className="flex items-center gap-2">
              <Link
                href="/tournament/otb-demo-2026/manage"
                className={`hidden sm:flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md border transition-colors ${
                  isDark
                    ? "border-[#4CAF50]/30 text-[#4CAF50] hover:bg-[#3D6B47]/20"
                    : "border-[#3D6B47]/30 text-[#3D6B47] hover:bg-[#3D6B47]/08"
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                Director
              </Link>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 px-4 py-2 bg-[#3D6B47] text-white text-xs font-semibold rounded-lg hover:bg-[#2A4A32] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg shadow-[#3D6B47]/30"
              >
                <Printer className="w-3.5 h-3.5" />
                Print / Save PDF
              </button>
              <ThemeToggle />
            </div>
          </div>
        </header>

        {/* ── Content ──────────────────────────────────────────────────────── */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 print-page space-y-8">

          {/* ── Tournament Header ─────────────────────────────────────────── */}
          <div
            className={`rounded-2xl border overflow-hidden ${
              isDark ? "border-white/08" : "border-gray-100"
            }`}
          >
            {/* Green accent bar */}
            <div className="h-1.5 bg-gradient-to-r from-[#3D6B47] via-[#4CAF50] to-[#3D6B47]" />
            <div
              className={`px-6 py-6 ${isDark ? "bg-[oklch(0.22_0.06_145)]" : "bg-white"}`}
            >
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 bg-[#3D6B47] rounded-lg flex items-center justify-center">
                      <Crown className="w-4 h-4 text-white" strokeWidth={2} />
                    </div>
                    <span
                      className={`text-xs font-bold uppercase tracking-widest ${isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"}`}
                      style={{ fontFamily: "'Clash Display', sans-serif" }}
                    >
                      OTB Chess
                    </span>
                  </div>
                  <h1
                    className={`text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-gray-900"}`}
                    style={{ fontFamily: "'Clash Display', sans-serif" }}
                  >
                    {tournament.name}
                  </h1>
                  <div className="flex flex-wrap gap-4 mt-3">
                    {[
                      { icon: MapPin, text: tournament.venue },
                      { icon: Calendar, text: tournament.date },
                      { icon: Clock, text: `Time Control: ${tournament.timeControl}` },
                      { icon: Trophy, text: `${tournament.format} · ${tournament.rounds} Rounds` },
                      { icon: Users, text: `${players.length} Players` },
                    ].map(({ icon: Icon, text }) => (
                      <div key={text} className="flex items-center gap-1.5">
                        <Icon className={`w-3.5 h-3.5 ${isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"}`} />
                        <span className={`text-xs ${isDark ? "text-white/60" : "text-gray-500"}`}>{text}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl ${
                      isDark ? "bg-[#3D6B47]/20 text-[#4CAF50]" : "bg-[#3D6B47]/08 text-[#3D6B47]"
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
                    <span className="text-sm font-bold" style={{ fontFamily: "'Clash Display', sans-serif" }}>
                      Round {tournament.currentRound} of {tournament.rounds}
                    </span>
                  </div>
                  <p className={`text-xs mt-1.5 ${isDark ? "text-white/30" : "text-gray-400"}`}>
                    Printed {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Section Tabs (no-print) ───────────────────────────────────── */}
          <div className={`no-print flex gap-1 p-1 rounded-xl w-fit ${isDark ? "bg-white/08" : "bg-gray-100"}`}>
            {sectionTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveSection(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeSection === tab.id
                    ? isDark
                      ? "bg-[#3D6B47] text-white shadow-sm"
                      : "bg-white text-gray-900 shadow-sm"
                    : isDark
                    ? "text-white/50 hover:text-white/70"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── Pairing Slips ─────────────────────────────────────────────── */}
          {activeSection === "slips" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2
                    className={`text-lg font-bold ${isDark ? "text-white" : "text-gray-900"}`}
                    style={{ fontFamily: "'Clash Display', sans-serif" }}
                  >
                    Round {tournament.currentRound} — Pairing Slips
                  </h2>
                  <p className={`text-sm mt-0.5 ${isDark ? "text-white/40" : "text-gray-500"}`}>
                    Cut along the dashed lines and place one slip on each board before the round begins.
                  </p>
                </div>
                <span
                  className={`text-xs font-semibold px-3 py-1.5 rounded-full ${
                    isDark ? "bg-[#3D6B47]/20 text-[#4CAF50]" : "bg-[#3D6B47]/10 text-[#3D6B47]"
                  }`}
                >
                  {currentRound?.games.length ?? 0} boards
                </span>
              </div>

              {/* Cut guide */}
              <div
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border border-dashed text-xs ${
                  isDark ? "border-white/15 text-white/30" : "border-gray-300 text-gray-400"
                }`}
              >
                <span>✂</span>
                <span>Cut along dashed lines · One slip per board · Players keep their copy after the game</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {currentRound?.games.map((game) => (
                  <PairingSlip
                    key={game.id}
                    game={game}
                    players={players}
                    tournamentName={tournament.name}
                    round={tournament.currentRound}
                    timeControl={tournament.timeControl}
                    isDark={isDark}
                  />
                ))}
              </div>

              {/* All rounds slips summary */}
              <div className={`mt-6 pt-6 border-t ${isDark ? "border-white/08" : "border-gray-100"}`}>
                <h3
                  className={`text-sm font-bold mb-4 ${isDark ? "text-white/50" : "text-gray-400"}`}
                  style={{ fontFamily: "'Clash Display', sans-serif" }}
                >
                  Previous Rounds
                </h3>
                <div className="space-y-3">
                  {tournament.roundData
                    .filter((r) => r.number < tournament.currentRound)
                    .reverse()
                    .map((round) => (
                      <div
                        key={round.number}
                        className={`rounded-xl border px-5 py-4 ${
                          isDark ? "bg-[oklch(0.22_0.06_145)] border-white/06" : "bg-white border-gray-100"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <span
                            className={`text-xs font-bold uppercase tracking-widest ${isDark ? "text-white/40" : "text-gray-400"}`}
                          >
                            Round {round.number}
                          </span>
                          <span className={`text-xs ${isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"} font-medium`}>
                            Complete
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                          {round.games.map((g) => {
                            const w = players.find((p) => p.id === g.whiteId);
                            const b = players.find((p) => p.id === g.blackId);
                            return (
                              <div key={g.id} className="flex items-center gap-2 text-xs">
                                <span className={`font-medium ${isDark ? "text-white/70" : "text-gray-700"}`}>
                                  Bd {g.board}
                                </span>
                                <span className={`truncate ${isDark ? "text-white/50" : "text-gray-500"}`}>
                                  {w?.name.split(" ")[0]}
                                </span>
                                <span
                                  className={`font-mono font-bold px-1.5 py-0.5 rounded text-[10px] flex-shrink-0 ${
                                    g.result === "1-0" ? "bg-emerald-100 text-emerald-700"
                                    : g.result === "0-1" ? "bg-red-100 text-red-600"
                                    : "bg-blue-100 text-blue-600"
                                  }`}
                                >
                                  {g.result}
                                </span>
                                <span className={`truncate ${isDark ? "text-white/50" : "text-gray-500"}`}>
                                  {b?.name.split(" ")[0]}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Wall Chart ────────────────────────────────────────────────── */}
          {activeSection === "wallchart" && (
            <div className="space-y-4">
              <div>
                <h2
                  className={`text-lg font-bold ${isDark ? "text-white" : "text-gray-900"}`}
                  style={{ fontFamily: "'Clash Display', sans-serif" }}
                >
                  Wall Chart — All Rounds
                </h2>
                <p className={`text-sm mt-0.5 ${isDark ? "text-white/40" : "text-gray-500"}`}>
                  Cross-table showing results, colors, and opponents for every player across all rounds.
                  Highlighted column = current round.
                </p>
              </div>
              <WallChart players={players} rounds={tournament.roundData} isDark={isDark} />
              <p className={`text-xs ${isDark ? "text-white/25" : "text-gray-300"}`}>
                W = White pieces · B = Black pieces · 1 = Win · ½ = Draw · 0 = Loss · · = In progress
              </p>
            </div>
          )}

          {/* ── Standings ─────────────────────────────────────────────────── */}
          {activeSection === "standings" && (
            <div className="space-y-4">
              <div>
                <h2
                  className={`text-lg font-bold ${isDark ? "text-white" : "text-gray-900"}`}
                  style={{ fontFamily: "'Clash Display', sans-serif" }}
                >
                  Current Standings
                </h2>
                <p className={`text-sm mt-0.5 ${isDark ? "text-white/40" : "text-gray-500"}`}>
                  Sorted by points, then Buchholz tiebreak, then ELO. Updated after Round {tournament.currentRound - 1}.
                </p>
              </div>
              <StandingsTable players={players} isDark={isDark} />
              <p className={`text-xs ${isDark ? "text-white/25" : "text-gray-300"}`}>
                Tiebreak: Buchholz (sum of opponents' scores) · W = Wins · D = Draws · L = Losses
              </p>
            </div>
          )}

          {/* ── Footer ────────────────────────────────────────────────────── */}
          <div
            className={`pt-6 border-t flex items-center justify-between text-xs ${
              isDark ? "border-white/08 text-white/25" : "border-gray-100 text-gray-300"
            }`}
          >
            <span>Generated by OTB Chess · otbchess.app</span>
            <span>
              {tournament.name} · Round {tournament.currentRound}/{tournament.rounds}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
