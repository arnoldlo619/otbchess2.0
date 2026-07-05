/**
 * OTB Chess — Quads Director Panel
 *
 * Renders inside the Tournament Director page when format === "quads".
 * Shows:
 *  - Section overview cards (rating range, players, status)
 *  - Per-section pairings with result entry
 *  - Per-section standings with tiebreaks
 *  - Manual adjustment tools (swap players, regenerate section)
 */
import { useState, useMemo } from "react";
import {
  Users,
  Trophy,
  ChevronDown,
  ChevronUp,
  ArrowLeftRight,
  RotateCcw,
} from "lucide-react";
import type { Player, Game, Result } from "../../lib/tournamentData";
import type { QuadSection } from "../../lib/quads";
import {
  calculateQuadStandings,
  formatRatingRange,
  getSectionWinners,
} from "../../lib/quads";

// ─── Types ────────────────────────────────────────────────────────────────────

interface QuadsDirectorPanelProps {
  sections: QuadSection[];
  players: Player[];
  games: Game[];
  currentRound: number;
  totalRounds: number;
  onEnterResult: (gameId: string, result: Result) => void;
  onSwapPlayers?: (sectionId: string, playerIdA: string, playerIdB: string) => void;
  onAdvanceRound?: () => void;
  onCompleteTournament?: () => void;
  isDark: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getPlayerName(players: Player[], id: string): string {
  if (id === "BYE") return "BYE";
  return players.find((p) => p.id === id)?.name ?? id;
}

function getPlayerRating(players: Player[], id: string): number {
  return players.find((p) => p.id === id)?.elo ?? 0;
}

function resultLabel(result: Result): string {
  switch (result) {
    case "1-0": return "1–0";
    case "0-1": return "0–1";
    case "½-½": return "½–½";
    case "*": return "—";
    default: return result;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function QuadsDirectorPanel({
  sections,
  players,
  games,
  currentRound,
  totalRounds,
  onEnterResult,
  onSwapPlayers,
  onAdvanceRound,
  onCompleteTournament,
  isDark,
}: QuadsDirectorPanelProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>(
    sections[0]?.id ?? null
  );
  const [activeTab, setActiveTab] = useState<"pairings" | "standings">("pairings");

  // Group games by section
  const gamesBySection = useMemo(() => {
    const map = new Map<string, Game[]>();
    for (const section of sections) {
      map.set(section.id, games.filter((g) => g.sectionId === section.id));
    }
    return map;
  }, [sections, games]);

  // Calculate standings per section
  const standingsBySection = useMemo(() => {
    const map = new Map<string, ReturnType<typeof calculateQuadStandings>>();
    for (const section of sections) {
      const sectionGames = gamesBySection.get(section.id) ?? [];
      map.set(section.id, calculateQuadStandings(section, sectionGames, players));
    }
    return map;
  }, [sections, gamesBySection, players]);

  // Section completion status
  const sectionStatus = useMemo(() => {
    const map = new Map<string, { completed: number; total: number; pct: number }>();
    for (const section of sections) {
      const sectionGames = gamesBySection.get(section.id) ?? [];
      const completed = sectionGames.filter((g) => g.result !== "*").length;
      const total = sectionGames.length;
      map.set(section.id, { completed, total, pct: total > 0 ? Math.round((completed / total) * 100) : 0 });
    }
    return map;
  }, [sections, gamesBySection]);

  const T = {
    card: isDark ? "oklch(0.18 0.03 145)" : "#ffffff",
    cardBorder: isDark ? "oklch(0.28 0.04 145)" : "#e5e7eb",
    text: isDark ? "oklch(0.92 0.02 145)" : "#1a1a1a",
    textMuted: isDark ? "oklch(0.65 0.03 145)" : "#6b7280",
    green: "oklch(0.72 0.19 145)",
    greenBg: isDark ? "oklch(0.22 0.06 145)" : "oklch(0.96 0.04 145)",
    greenBorder: isDark ? "oklch(0.35 0.10 145)" : "oklch(0.80 0.12 145)",
    goldBg: isDark ? "oklch(0.25 0.06 85)" : "oklch(0.95 0.06 85)",
    goldBorder: isDark ? "oklch(0.40 0.10 85)" : "oklch(0.80 0.10 85)",
    gold: "oklch(0.75 0.15 85)",
  };

  return (
    <div className="space-y-4">
      {/* Section Overview Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: T.textMuted }}>
          Sections ({sections.length})
        </h3>
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab("pairings")}
            className="px-3 py-1 rounded-lg text-xs font-semibold transition-all"
            style={{
              background: activeTab === "pairings" ? T.greenBg : "transparent",
              color: activeTab === "pairings" ? T.green : T.textMuted,
              border: `1px solid ${activeTab === "pairings" ? T.greenBorder : "transparent"}`,
            }}
          >
            Pairings
          </button>
          <button
            onClick={() => setActiveTab("standings")}
            className="px-3 py-1 rounded-lg text-xs font-semibold transition-all"
            style={{
              background: activeTab === "standings" ? T.greenBg : "transparent",
              color: activeTab === "standings" ? T.green : T.textMuted,
              border: `1px solid ${activeTab === "standings" ? T.greenBorder : "transparent"}`,
            }}
          >
            Standings
          </button>
        </div>
      </div>

      {/* Section Cards */}
      {sections.map((section) => {
        const isExpanded = expandedSection === section.id;
        const status = sectionStatus.get(section.id)!;
        const standings = standingsBySection.get(section.id) ?? [];
        const sectionGames = gamesBySection.get(section.id) ?? [];
        const winner = status.pct === 100 ? getSectionWinners(standings)[0] : null;

        return (
          <div
            key={section.id}
            className="rounded-xl border overflow-hidden transition-all"
            style={{
              background: T.card,
              borderColor: winner ? T.goldBorder : T.cardBorder,
            }}
          >
            {/* Section Header */}
            <button
              onClick={() => setExpandedSection(isExpanded ? null : section.id)}
              className="w-full flex items-center justify-between px-4 py-3 text-left"
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{
                    background: section.type === "quad" ? T.greenBg : T.goldBg,
                    border: `1px solid ${section.type === "quad" ? T.greenBorder : T.goldBorder}`,
                  }}
                >
                  {section.type === "quad" ? (
                    <Users size={14} style={{ color: T.green }} />
                  ) : (
                    <ArrowLeftRight size={14} style={{ color: T.gold }} />
                  )}
                </div>
                <div>
                  <div className="text-sm font-semibold" style={{ color: T.text }}>
                    {section.name}
                  </div>
                  <div className="text-xs" style={{ color: T.textMuted }}>
                    {formatRatingRange(section)} · {section.playerIds.length} players
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {/* Progress indicator */}
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: isDark ? "oklch(0.25 0.02 145)" : "#e5e7eb" }}>
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${status.pct}%`, background: status.pct === 100 ? T.gold : T.green }}
                    />
                  </div>
                  <span className="text-xs font-mono" style={{ color: T.textMuted }}>
                    {status.completed}/{status.total}
                  </span>
                </div>
                {winner && (
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ background: T.goldBg, border: `1px solid ${T.goldBorder}` }}>
                    <Trophy size={10} style={{ color: T.gold }} />
                    <span className="text-xs font-semibold" style={{ color: T.gold }}>
                      {getPlayerName(players, winner.playerId).split(" ")[0]}
                    </span>
                  </div>
                )}
                {isExpanded ? (
                  <ChevronUp size={16} style={{ color: T.textMuted }} />
                ) : (
                  <ChevronDown size={16} style={{ color: T.textMuted }} />
                )}
              </div>
            </button>

            {/* Expanded Content */}
            {isExpanded && (
              <div className="px-4 pb-4 border-t" style={{ borderColor: T.cardBorder }}>
                {activeTab === "pairings" ? (
                  <PairingsView
                    section={section}
                    games={sectionGames}
                    players={players}
                    currentRound={currentRound}
                    totalRounds={totalRounds}
                    onEnterResult={onEnterResult}
                    isDark={isDark}
                    T={T}
                  />
                ) : (
                  <StandingsView
                    section={section}
                    standings={standings}
                    players={players}
                    isDark={isDark}
                    T={T}
                  />
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Round Advancement CTA */}
      {onAdvanceRound && (() => {
        const currentRoundGames = games.filter((g) => g.round === currentRound);
        const allCurrentDone = currentRoundGames.every((g) => g.result !== "*");
        const isLastRound = currentRound >= totalRounds;
        const allDone = games.every((g) => g.result !== "*");

        if (allDone && isLastRound && onCompleteTournament) {
          return (
            <button
              onClick={onCompleteTournament}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-[0.98]"
              style={{ background: T.gold, boxShadow: "0 4px 16px rgba(180,140,40,0.3)" }}
            >
              <Trophy size={16} />
              Finalize Tournament
            </button>
          );
        }

        if (allCurrentDone && !isLastRound) {
          return (
            <button
              onClick={onAdvanceRound}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-[0.98]"
              style={{ background: "#436850", boxShadow: "0 4px 16px rgba(61,107,71,0.35)" }}
            >
              Advance to Round {currentRound + 1}
            </button>
          );
        }

        return null;
      })()}
    </div>
  );
}

// ─── Pairings Sub-View ────────────────────────────────────────────────────────

function PairingsView({
  section,
  games,
  players,
  currentRound,
  totalRounds,
  onEnterResult,
  isDark,
  T,
}: {
  section: QuadSection;
  games: Game[];
  players: Player[];
  currentRound: number;
  totalRounds: number;
  onEnterResult: (gameId: string, result: Result) => void;
  isDark: boolean;
  T: Record<string, string>;
}) {
  const rounds = Array.from({ length: totalRounds }, (_, i) => i + 1);

  return (
    <div className="space-y-3 pt-3">
      {rounds.map((roundNum) => {
        const roundGames = games.filter((g) => g.round === roundNum);
        const isActive = roundNum === currentRound;
        const isCompleted = roundGames.every((g) => g.result !== "*");

        return (
          <div key={roundNum}>
            <div className="flex items-center gap-2 mb-2">
              <span
                className="text-xs font-bold uppercase tracking-wider"
                style={{ color: isActive ? T.green : T.textMuted }}
              >
                Round {roundNum}
              </span>
              {isCompleted && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: T.greenBg, color: T.green, border: `1px solid ${T.greenBorder}` }}>
                  ✓
                </span>
              )}
            </div>
            <div className="space-y-1.5">
              {roundGames.map((game) => (
                <GameRow
                  key={game.id}
                  game={game}
                  players={players}
                  onEnterResult={onEnterResult}
                  isActive={isActive}
                  isDark={isDark}
                  T={T}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Game Row ─────────────────────────────────────────────────────────────────

function GameRow({
  game,
  players,
  onEnterResult,
  isActive,
  isDark,
  T,
}: {
  game: Game;
  players: Player[];
  onEnterResult: (gameId: string, result: Result) => void;
  isActive: boolean;
  isDark: boolean;
  T: Record<string, string>;
}) {
  const isBye = game.blackId === "BYE";
  const isPending = game.result === "*";

  return (
    <div
      className="flex items-center justify-between rounded-lg px-3 py-2 transition-all"
      style={{
        background: isDark ? "oklch(0.15 0.02 145)" : "#f9fafb",
        border: `1px solid ${isActive && isPending ? T.greenBorder : "transparent"}`,
        opacity: !isActive && isPending ? 0.6 : 1,
      }}
    >
      {/* White player */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className="w-3 h-3 rounded-sm border" style={{ background: "#fff", borderColor: "#ccc" }} />
        <span className="text-sm font-medium truncate" style={{ color: T.text }}>
          {getPlayerName(players, game.whiteId)}
        </span>
        <span className="text-[10px] font-mono" style={{ color: T.textMuted }}>
          {getPlayerRating(players, game.whiteId)}
        </span>
      </div>

      {/* Result / Buttons */}
      <div className="flex items-center gap-1 mx-2">
        {isPending && isActive && !isBye ? (
          <>
            <button
              onClick={() => onEnterResult(game.id, "1-0")}
              className="px-2 py-0.5 rounded text-[11px] font-bold transition-all hover:scale-105"
              style={{ background: T.greenBg, color: T.green, border: `1px solid ${T.greenBorder}` }}
            >
              1–0
            </button>
            <button
              onClick={() => onEnterResult(game.id, "½-½")}
              className="px-2 py-0.5 rounded text-[11px] font-bold transition-all hover:scale-105"
              style={{ background: isDark ? "oklch(0.22 0.02 145)" : "#f3f4f6", color: T.textMuted, border: `1px solid ${T.cardBorder}` }}
            >
              ½–½
            </button>
            <button
              onClick={() => onEnterResult(game.id, "0-1")}
              className="px-2 py-0.5 rounded text-[11px] font-bold transition-all hover:scale-105"
              style={{ background: T.greenBg, color: T.green, border: `1px solid ${T.greenBorder}` }}
            >
              0–1
            </button>
          </>
        ) : (
          <span
            className="text-sm font-bold px-2"
            style={{
              color: game.result === "1-0" ? T.green : game.result === "0-1" ? T.green : T.textMuted,
            }}
          >
            {resultLabel(game.result)}
          </span>
        )}
      </div>

      {/* Black player */}
      <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
        <span className="text-[10px] font-mono" style={{ color: T.textMuted }}>
          {isBye ? "" : getPlayerRating(players, game.blackId)}
        </span>
        <span className="text-sm font-medium truncate text-right" style={{ color: isBye ? T.textMuted : T.text }}>
          {getPlayerName(players, game.blackId)}
        </span>
        <span className="w-3 h-3 rounded-sm" style={{ background: "#1a1a1a" }} />
      </div>
    </div>
  );
}

// ─── Standings Sub-View ───────────────────────────────────────────────────────

function StandingsView({
  section,
  standings,
  players,
  isDark,
  T,
}: {
  section: QuadSection;
  standings: ReturnType<typeof calculateQuadStandings>;
  players: Player[];
  isDark: boolean;
  T: Record<string, string>;
}) {
  return (
    <div className="pt-3">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ color: T.textMuted }}>
            <th className="text-left py-1 px-1 text-xs font-semibold">#</th>
            <th className="text-left py-1 px-1 text-xs font-semibold">Player</th>
            <th className="text-center py-1 px-1 text-xs font-semibold">Pts</th>
            <th className="text-center py-1 px-1 text-xs font-semibold">W</th>
            <th className="text-center py-1 px-1 text-xs font-semibold">D</th>
            <th className="text-center py-1 px-1 text-xs font-semibold">L</th>
            <th className="text-center py-1 px-1 text-xs font-semibold">SB</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((s, idx) => {
            const isWinner = s.finalRank === 1;
            return (
              <tr
                key={s.playerId}
                className="transition-all"
                style={{
                  background: isWinner ? T.goldBg : idx % 2 === 0 ? "transparent" : (isDark ? "oklch(0.15 0.01 145)" : "#f9fafb"),
                }}
              >
                <td className="py-1.5 px-1 font-bold" style={{ color: isWinner ? T.gold : T.textMuted }}>
                  {s.finalRank}
                </td>
                <td className="py-1.5 px-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium" style={{ color: T.text }}>
                      {getPlayerName(players, s.playerId)}
                    </span>
                    <span className="text-[10px] font-mono" style={{ color: T.textMuted }}>
                      {getPlayerRating(players, s.playerId)}
                    </span>
                  </div>
                </td>
                <td className="py-1.5 px-1 text-center font-bold" style={{ color: T.green }}>
                  {s.score % 1 === 0 ? s.score : s.score.toFixed(1)}
                </td>
                <td className="py-1.5 px-1 text-center" style={{ color: T.text }}>{s.wins}</td>
                <td className="py-1.5 px-1 text-center" style={{ color: T.textMuted }}>{s.draws}</td>
                <td className="py-1.5 px-1 text-center" style={{ color: T.textMuted }}>{s.losses}</td>
                <td className="py-1.5 px-1 text-center font-mono text-xs" style={{ color: T.textMuted }}>
                  {s.sonnebornBerger.toFixed(2)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
