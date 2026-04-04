/**
 * BracketPrintSection — Print-optimized elimination bracket tree.
 *
 * Renders a full bracket tree for the Print/PDF page. Designed to work
 * cleanly with window.print() and @media print CSS.
 *
 * Layout: horizontal round columns (R1 → QF → SF → Final → Champion)
 * Each column contains match cards stacked vertically with equal spacing.
 * SVG connector lines link each pair of matches to the next round.
 *
 * Supports:
 *   - Pure elimination (all rounds are elimination)
 *   - Swiss-to-Elimination hybrid (swiss_elim): shows only elim rounds
 *   - Byes (auto-advance, shown with strikethrough placeholder)
 *   - Champion banner when the Final has a result
 */

import { useMemo } from "react";
import { Crown, Trophy } from "lucide-react";
import { type Player, type Game, type Round } from "@/lib/tournamentData";
import { elimRoundLabel } from "@/lib/swiss";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MatchResult {
  whitePlayer: Player | null;
  blackPlayer: Player | null;
  whiteId: string;
  blackId: string;
  result: string;
  isBye: boolean;
  winnerId: string | null;
}

interface BracketRound {
  roundNumber: number;
  label: string;
  matches: MatchResult[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getWinnerId(game: Game): string | null {
  if (game.whiteId === "BYE") return game.blackId;
  if (game.blackId === "BYE") return game.whiteId;
  if (game.result === "1-0") return game.whiteId;
  if (game.result === "0-1") return game.blackId;
  return null; // in progress or draw
}

function buildBracketRounds(
  rounds: Round[],
  players: Player[],
  elimStartRound: number
): BracketRound[] {
  const playerMap = new Map(players.map((p) => [p.id, p]));

  const elimRounds = rounds
    .filter((r) => r.number >= elimStartRound)
    .sort((a, b) => a.number - b.number);

  return elimRounds.map((round) => {
    const sortedGames = [...round.games].sort((a, b) => a.board - b.board);
    const realGames = sortedGames.filter((g) => g.whiteId !== "BYE" || g.blackId !== "BYE");
    const playersInRound = realGames.length * 2;

    const matches: MatchResult[] = sortedGames.map((game) => {
      const isBye = game.whiteId === "BYE" || game.blackId === "BYE";
      return {
        whiteId: game.whiteId,
        blackId: game.blackId,
        whitePlayer: playerMap.get(game.whiteId) ?? null,
        blackPlayer: playerMap.get(game.blackId) ?? null,
        result: game.result,
        isBye,
        winnerId: getWinnerId(game),
      };
    });

    return {
      roundNumber: round.number,
      label: elimRoundLabel(playersInRound),
      matches,
    };
  });
}

// ─── Match Card ───────────────────────────────────────────────────────────────

function MatchCard({
  match,
  isDark,
  isComplete,
}: {
  match: MatchResult;
  isDark: boolean;
  isComplete: boolean;
}) {
  const borderColor = isDark ? "border-white/15" : "border-gray-200";
  const bgCard = isDark ? "bg-[oklch(0.22_0.06_145)]" : "bg-white";
  const textMain = isDark ? "text-white" : "text-gray-900";
  const textMuted = isDark ? "text-white/40" : "text-gray-400";

  const renderPlayer = (
    player: Player | null,
    playerId: string,
    side: "white" | "black"
  ) => {
    const isBye = playerId === "BYE";
    const isWinner = match.winnerId === playerId && isComplete;
    const isLoser = match.winnerId !== null && match.winnerId !== playerId && isComplete && !isBye;

    if (isBye) {
      return (
        <div className={`flex items-center gap-2 px-3 py-2 ${isDark ? "bg-white/04" : "bg-gray-50/60"}`}>
          <div className={`w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center text-xs font-bold ${
            side === "white"
              ? isDark ? "bg-white/80 border-white/20 text-gray-900" : "bg-white border-gray-300 text-gray-600"
              : isDark ? "bg-[oklch(0.15_0.04_145)] border-white/10 text-white/40" : "bg-gray-800 border-gray-600 text-white"
          }`}>
            {side === "white" ? "W" : "B"}
          </div>
          <span className={`text-xs italic ${textMuted}`}>BYE</span>
        </div>
      );
    }

    return (
      <div className={`flex items-center gap-2 px-3 py-2 transition-colors ${
        isWinner
          ? isDark ? "bg-[#3D6B47]/25" : "bg-[#3D6B47]/08"
          : isDark ? "bg-white/04" : "bg-gray-50/60"
      }`}>
        {/* Color indicator */}
        <div className={`w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center text-xs font-bold ${
          side === "white"
            ? isDark ? "bg-white/80 border-white/20 text-gray-900" : "bg-white border-gray-300 text-gray-600"
            : isDark ? "bg-[oklch(0.15_0.04_145)] border-white/10 text-white/40" : "bg-gray-800 border-gray-600 text-white"
        }`}>
          {side === "white" ? "W" : "B"}
        </div>

        {/* Player name + ELO */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 flex-wrap">
            {isWinner && <Trophy className="w-3 h-3 text-[#4CAF50] flex-shrink-0" />}
            <span className={`text-xs font-semibold truncate ${
              isWinner
                ? isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"
                : isLoser
                ? textMuted
                : textMain
            } ${isLoser ? "line-through" : ""}`}
              style={{ fontFamily: "'Clash Display', sans-serif" }}
            >
              {player?.name ?? playerId}
            </span>
            {player?.title && (
              <span className="text-xs font-bold text-[#3D6B47] bg-[#3D6B47]/10 px-1 py-0.5 rounded flex-shrink-0">
                {player.title}
              </span>
            )}
          </div>
          {player && (
            <span className={`text-xs ${textMuted}`}>{player.elo}</span>
          )}
        </div>

        {/* Result */}
        {isComplete && (
          <span className={`text-xs font-bold tabular-nums flex-shrink-0 ${
            isWinner
              ? isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"
              : textMuted
          }`}>
            {isWinner ? "1" : "0"}
          </span>
        )}
      </div>
    );
  };

  return (
    <div
      className={`rounded-lg border overflow-hidden ${borderColor} ${bgCard}`}
      style={{ breakInside: "avoid", minWidth: 180, maxWidth: 220 }}
    >
      {/* White */}
      {renderPlayer(match.whitePlayer, match.whiteId, "white")}
      {/* Divider */}
      <div className={`h-px ${isDark ? "bg-white/08" : "bg-gray-100"}`} />
      {/* Black */}
      {renderPlayer(match.blackPlayer, match.blackId, "black")}
      {/* Result badge */}
      {match.result !== "*" && !match.isBye && (
        <div className={`px-3 py-1 text-center text-xs font-mono font-bold ${
          isDark ? "bg-white/04 text-white/30 border-t border-white/08" : "bg-gray-50 text-gray-400 border-t border-gray-100"
        }`}>
          {match.result}
        </div>
      )}
    </div>
  );
}

// ─── Champion Banner ──────────────────────────────────────────────────────────

function ChampionBanner({ player, isDark }: { player: Player; isDark: boolean }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 px-6 py-8 rounded-2xl border-2 ${
      isDark
        ? "border-[#4CAF50]/30 bg-[#3D6B47]/15"
        : "border-[#3D6B47]/30 bg-[#3D6B47]/06"
    }`} style={{ minWidth: 180, maxWidth: 220 }}>
      <div className="w-12 h-12 rounded-full bg-[#3D6B47] flex items-center justify-center shadow-lg shadow-[#3D6B47]/30">
        <Crown className="w-6 h-6 text-white" strokeWidth={2} />
      </div>
      <div className="text-center">
        <p className={`text-xs font-bold uppercase tracking-widest mb-1 ${isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"}`}>
          Champion
        </p>
        <p
          className={`text-base font-bold ${isDark ? "text-white" : "text-gray-900"}`}
          style={{ fontFamily: "'Clash Display', sans-serif" }}
        >
          {player.name}
        </p>
        {player.title && (
          <span className="inline-block text-xs font-bold text-[#3D6B47] bg-[#3D6B47]/10 px-2 py-0.5 rounded mt-1">
            {player.title}
          </span>
        )}
        <p className={`text-xs mt-1 ${isDark ? "text-white/40" : "text-gray-400"}`}>
          {player.elo} ELO
        </p>
      </div>
    </div>
  );
}

// ─── Connector SVG ────────────────────────────────────────────────────────────

/**
 * Renders SVG connector lines between match cards in adjacent rounds.
 * Each pair of matches in round N feeds into one match in round N+1.
 */
function ConnectorLines({
  matchCount,
  cardHeight,
  cardGap,
  isDark,
}: {
  matchCount: number; // number of matches in the LEFT column
  cardHeight: number;
  cardGap: number;
  isDark: boolean;
}) {
  const totalHeight = matchCount * cardHeight + (matchCount - 1) * cardGap;
  const strokeColor = isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)";
  const connectorWidth = 32;

  const lines: React.ReactNode[] = [];

  for (let i = 0; i < matchCount; i += 2) {
    const topMatchCenterY = i * (cardHeight + cardGap) + cardHeight / 2;
    const bottomMatchCenterY = (i + 1) * (cardHeight + cardGap) + cardHeight / 2;
    const midY = (topMatchCenterY + bottomMatchCenterY) / 2;

    // Horizontal line from top match center-right to mid
    lines.push(
      <line
        key={`top-h-${i}`}
        x1={0} y1={topMatchCenterY}
        x2={connectorWidth / 2} y2={topMatchCenterY}
        stroke={strokeColor} strokeWidth={1.5}
      />
    );
    // Horizontal line from bottom match center-right to mid
    lines.push(
      <line
        key={`bot-h-${i}`}
        x1={0} y1={bottomMatchCenterY}
        x2={connectorWidth / 2} y2={bottomMatchCenterY}
        stroke={strokeColor} strokeWidth={1.5}
      />
    );
    // Vertical line connecting top and bottom
    lines.push(
      <line
        key={`vert-${i}`}
        x1={connectorWidth / 2} y1={topMatchCenterY}
        x2={connectorWidth / 2} y2={bottomMatchCenterY}
        stroke={strokeColor} strokeWidth={1.5}
      />
    );
    // Horizontal line from mid to right edge
    lines.push(
      <line
        key={`mid-h-${i}`}
        x1={connectorWidth / 2} y1={midY}
        x2={connectorWidth} y2={midY}
        stroke={strokeColor} strokeWidth={1.5}
      />
    );
  }

  return (
    <svg
      width={connectorWidth}
      height={totalHeight}
      className="flex-shrink-0"
      style={{ overflow: "visible" }}
    >
      {lines}
    </svg>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface BracketPrintSectionProps {
  rounds: Round[];
  players: Player[];
  isDark: boolean;
  /** For swiss_elim: the round number where elimination starts. For pure elimination: 1. */
  elimStartRound: number;
  tournamentName: string;
}

export function BracketPrintSection({
  rounds,
  players,
  isDark,
  elimStartRound,
  tournamentName,
}: BracketPrintSectionProps) {
  const bracketRounds = useMemo(
    () => buildBracketRounds(rounds, players, elimStartRound),
    [rounds, players, elimStartRound]
  );

  if (bracketRounds.length === 0) {
    return (
      <div className={`rounded-xl border px-6 py-10 text-center ${isDark ? "border-white/08 bg-[oklch(0.22_0.06_145)]" : "border-gray-100 bg-white"}`}>
        <Trophy className={`w-8 h-8 mx-auto mb-3 ${isDark ? "text-white/20" : "text-gray-300"}`} />
        <p className={`text-sm ${isDark ? "text-white/40" : "text-gray-400"}`}>
          No elimination rounds have been generated yet.
        </p>
        <p className={`text-xs mt-1 ${isDark ? "text-white/25" : "text-gray-300"}`}>
          The bracket will appear here once the director advances to the elimination phase.
        </p>
      </div>
    );
  }

  // Find the champion (winner of the Final)
  const finalRound = bracketRounds[bracketRounds.length - 1];
  const finalMatch = finalRound?.matches.find((m) => !m.isBye);
  const playerMap = new Map(players.map((p) => [p.id, p]));
  const champion = finalMatch?.winnerId ? playerMap.get(finalMatch.winnerId) ?? null : null;

  // Approximate card heights for connector SVG sizing
  const CARD_HEIGHT = 80; // px — approximate rendered height of a MatchCard
  const CARD_GAP = 12;    // px — gap between cards in a column

  const textMuted = isDark ? "text-white/40" : "text-gray-500";
  const borderColor = isDark ? "border-white/08" : "border-gray-100";

  return (
    <div className="space-y-6 print-section">
      {/* Section header */}
      <div>
        <h2
          className={`text-lg font-bold ${isDark ? "text-white" : "text-gray-900"}`}
          style={{ fontFamily: "'Clash Display', sans-serif" }}
        >
          Elimination Bracket
        </h2>
        <p className={`text-sm mt-0.5 ${textMuted}`}>
          {tournamentName} · {bracketRounds.length} elimination round{bracketRounds.length !== 1 ? "s" : ""}
          {champion ? ` · Champion: ${champion.name}` : ""}
        </p>
      </div>

      {/* Bracket tree — horizontal scroll on small screens */}
      <div
        className={`rounded-2xl border overflow-x-auto ${isDark ? "border-white/08 bg-[oklch(0.20_0.06_145)]" : "border-gray-100 bg-[#F7FAF8]"}`}
        style={{ padding: "24px 20px" }}
      >
        <div className="flex items-start gap-0" style={{ minWidth: "max-content" }}>
          {bracketRounds.map((round, roundIdx) => {
            const isLastRound = roundIdx === bracketRounds.length - 1;
            const nextRound = bracketRounds[roundIdx + 1];
            const showConnectors = !isLastRound && nextRound && round.matches.length > 1;

            // Only show real (non-bye-only) matches
            const displayMatches = round.matches.filter((m) => !m.isBye || round.matches.length === 1);

            return (
              <div key={round.roundNumber} className="flex items-start gap-0">
                {/* Round column */}
                <div className="flex flex-col" style={{ gap: CARD_GAP }}>
                  {/* Round label */}
                  <div className="text-center mb-2">
                    <span
                      className={`inline-block text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full ${
                        round.label === "Final"
                          ? isDark ? "bg-[#3D6B47]/30 text-[#4CAF50]" : "bg-[#3D6B47]/10 text-[#3D6B47]"
                          : isDark ? "bg-white/08 text-white/50" : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {round.label}
                    </span>
                  </div>

                  {/* Match cards */}
                  <div className="flex flex-col" style={{ gap: CARD_GAP }}>
                    {displayMatches.map((match, matchIdx) => (
                      <MatchCard
                        key={`r${round.roundNumber}-m${matchIdx}`}
                        match={match}
                        isDark={isDark}
                        isComplete={match.result !== "*"}
                      />
                    ))}
                  </div>
                </div>

                {/* Connectors between this round and the next */}
                {showConnectors && (
                  <div className="flex items-center" style={{ paddingTop: 38 /* offset for label */ }}>
                    <ConnectorLines
                      matchCount={displayMatches.length}
                      cardHeight={CARD_HEIGHT}
                      cardGap={CARD_GAP}
                      isDark={isDark}
                    />
                  </div>
                )}

                {/* Gap between rounds */}
                {!isLastRound && <div style={{ width: 8 }} />}
              </div>
            );
          })}

          {/* Champion banner */}
          {champion && (
            <div className="flex items-center gap-0">
              <div className="flex items-center" style={{ paddingTop: 38, marginLeft: 8 }}>
                <svg width={24} height={CARD_HEIGHT} style={{ overflow: "visible" }}>
                  <line
                    x1={0} y1={CARD_HEIGHT / 2}
                    x2={24} y2={CARD_HEIGHT / 2}
                    stroke={isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)"}
                    strokeWidth={1.5}
                  />
                </svg>
              </div>
              <div style={{ paddingTop: 38, marginLeft: 8 }}>
                <ChampionBanner player={champion} isDark={isDark} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className={`flex flex-wrap gap-4 text-xs ${textMuted}`}>
        <span>W = White pieces · B = Black pieces</span>
        <span>1 = Win · 0 = Loss</span>
        <span>BYE = First-round bye (auto-advance)</span>
        <span>· = Match in progress</span>
      </div>

      {/* Print separator */}
      <div className={`border-t pt-4 ${borderColor}`}>
        <p className={`text-xs ${isDark ? "text-white/20" : "text-gray-300"}`}>
          Generated by OTB Chess · otbchess.club · {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
        </p>
      </div>
    </div>
  );
}
