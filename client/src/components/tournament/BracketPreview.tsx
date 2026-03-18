/**
 * BracketPreview
 *
 * Renders a compact, animated SVG/HTML preview of the tournament structure
 * based on the selected format, rounds, and player cap.
 *
 * Four visualizations:
 *   - swiss        → Stacked round rows showing score-based pairing concept
 *   - doubleswiss  → Same as Swiss but each board shows two mini-game slots (A/B)
 *   - roundrobin   → N×N grid (up to 8×8) with diagonal shading
 *   - elimination  → Classic single-elimination bracket tree
 */

import React, { useMemo } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Format = "swiss" | "doubleswiss" | "roundrobin" | "elimination";

interface BracketPreviewProps {
  format: Format;
  rounds: number;
  maxPlayers: number;
  isDark: boolean;
}

// ─── Colour helpers ───────────────────────────────────────────────────────────

const GREEN = "#3D6B47";
const GREEN_BG = "rgba(61,107,71,0.12)";
const GREEN_RING = "rgba(61,107,71,0.30)";

function useColors(isDark: boolean) {
  return {
    bg: isDark ? "rgba(61,107,71,0.08)" : "rgba(61,107,71,0.05)",
    border: isDark ? "rgba(255,255,255,0.08)" : "rgba(61,107,71,0.12)",
    cell: isDark ? "rgba(255,255,255,0.06)" : "rgba(61,107,71,0.07)",
    cellActive: GREEN_BG,
    cellBorder: isDark ? "rgba(255,255,255,0.10)" : "rgba(61,107,71,0.15)",
    line: isDark ? "rgba(255,255,255,0.12)" : "rgba(61,107,71,0.18)",
    text: isDark ? "rgba(255,255,255,0.55)" : "#6B7280",
    textBold: isDark ? "rgba(255,255,255,0.85)" : "#1A1A1A",
    green: GREEN,
    greenBg: GREEN_BG,
    greenRing: GREEN_RING,
    playerPill: isDark ? "rgba(255,255,255,0.08)" : "rgba(61,107,71,0.08)",
    playerPillBorder: isDark ? "rgba(255,255,255,0.12)" : "rgba(61,107,71,0.18)",
  };
}

// ─── Player name seeds ────────────────────────────────────────────────────────

const SEED_NAMES = [
  "Alex", "Sam", "Jordan", "Taylor", "Morgan",
  "Casey", "Riley", "Drew", "Quinn", "Blake",
  "Avery", "Reese", "Parker", "Skyler", "Finley",
  "Rowan", "Sage", "Hayden", "Emery", "Kendall",
  "Peyton", "Logan", "Elliot", "Harlow", "River",
  "Sloane", "Indigo", "Wren", "Cleo", "Ash",
  "Dani", "Nico",
];

function seedName(i: number): string {
  return SEED_NAMES[i % SEED_NAMES.length];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** A tiny player pill used across all visualizations */
function PlayerPill({
  name,
  score,
  highlight,
  c,
  compact = false,
}: {
  name: string;
  score?: string;
  highlight?: boolean;
  c: ReturnType<typeof useColors>;
  compact?: boolean;
}) {
  return (
    <div
      className="flex items-center gap-1 rounded-md"
      style={{
        padding: compact ? "2px 6px" : "3px 8px",
        background: highlight ? c.greenBg : c.playerPill,
        border: `1px solid ${highlight ? c.green : c.playerPillBorder}`,
        boxShadow: highlight ? `0 0 0 2px ${c.greenRing}` : "none",
        transition: "all 0.2s",
        minWidth: 0,
      }}
    >
      <span
        className="text-[10px] font-semibold truncate"
        style={{ color: highlight ? c.green : c.textBold, maxWidth: compact ? 36 : 52 }}
      >
        {name}
      </span>
      {score !== undefined && (
        <span
          className="text-[9px] font-bold ml-0.5 flex-shrink-0"
          style={{ color: highlight ? c.green : c.text }}
        >
          {score}
        </span>
      )}
    </div>
  );
}

// ─── Swiss Preview ────────────────────────────────────────────────────────────

function SwissPreview({
  rounds,
  maxPlayers,
  isDark,
  doubleSwiss = false,
}: {
  rounds: number;
  maxPlayers: number;
  isDark: boolean;
  doubleSwiss?: boolean;
}) {
  const c = useColors(isDark);
  const displayRounds = Math.min(rounds, 5);
  const boardsPerRound = Math.min(Math.floor(maxPlayers / 2), 3);

  // Generate deterministic "fake" pairings per round
  const roundData = useMemo(() => {
    return Array.from({ length: displayRounds }, (_, ri) => ({
      round: ri + 1,
      boards: Array.from({ length: boardsPerRound }, (_, bi) => {
        const offset = ri * boardsPerRound + bi * 2;
        return {
          white: seedName(offset),
          black: seedName(offset + 1),
          result: ri < displayRounds - 1 ? (bi % 3 === 0 ? "1-0" : bi % 3 === 1 ? "0-1" : "½-½") : null,
        };
      }),
    }));
  }, [displayRounds, boardsPerRound]);

  return (
    <div className="space-y-2">
      {roundData.map((rd) => (
        <div key={rd.round}>
          {/* Round label */}
          <div className="flex items-center gap-2 mb-1">
            <span
              className="text-[9px] font-bold uppercase tracking-wider"
              style={{ color: c.green }}
            >
              R{rd.round}
            </span>
            <div className="flex-1 h-px" style={{ background: c.line }} />
            {rd.boards[0].result === null && (
              <span
                className="text-[9px] font-medium px-1.5 py-0.5 rounded-full"
                style={{ background: GREEN_BG, color: c.green }}
              >
                upcoming
              </span>
            )}
          </div>

          {/* Boards */}
          <div className="space-y-1">
            {rd.boards.map((board, bi) => (
              <div key={bi} className="flex items-center gap-1.5">
                {/* Board number */}
                <span
                  className="text-[9px] w-4 text-right flex-shrink-0"
                  style={{ color: c.text }}
                >
                  {bi + 1}
                </span>

                {/* White player */}
                <PlayerPill
                  name={board.white}
                  highlight={board.result === "1-0"}
                  c={c}
                  compact
                />

                {/* VS / result */}
                <div
                  className="flex-shrink-0 text-[9px] font-bold text-center"
                  style={{
                    color: board.result ? c.green : c.text,
                    minWidth: doubleSwiss ? 28 : 20,
                  }}
                >
                  {board.result
                    ? board.result
                    : doubleSwiss
                    ? "A+B"
                    : "vs"}
                </div>

                {/* Black player */}
                <PlayerPill
                  name={board.black}
                  highlight={board.result === "0-1"}
                  c={c}
                  compact
                />

                {/* Double Swiss: two game slots */}
                {doubleSwiss && (
                  <div className="flex gap-0.5 ml-auto flex-shrink-0">
                    {(["A", "B"] as const).map((g) => (
                      <div
                        key={g}
                        className="text-[8px] font-bold rounded px-1 py-0.5"
                        style={{
                          background:
                            board.result !== null
                              ? GREEN_BG
                              : c.cell,
                          color:
                            board.result !== null
                              ? c.green
                              : c.text,
                          border: `1px solid ${board.result !== null ? c.green : c.cellBorder}`,
                        }}
                      >
                        {g}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* "…more rounds" indicator */}
      {rounds > displayRounds && (
        <div
          className="text-center text-[9px] font-medium py-1"
          style={{ color: c.text }}
        >
          + {rounds - displayRounds} more rounds
        </div>
      )}

      {/* Summary footer */}
      <div
        className="flex items-center justify-between pt-1 mt-1"
        style={{ borderTop: `1px solid ${c.line}` }}
      >
        <span className="text-[9px]" style={{ color: c.text }}>
          {maxPlayers} players · {rounds} rounds
        </span>
        <span className="text-[9px] font-semibold" style={{ color: c.green }}>
          {doubleSwiss
            ? `${rounds * 2} games/player`
            : `~${rounds} games/player`}
        </span>
      </div>
    </div>
  );
}

// ─── Round Robin Preview ──────────────────────────────────────────────────────

function RoundRobinPreview({
  maxPlayers,
  rounds,
  isDark,
}: {
  maxPlayers: number;
  rounds: number;
  isDark: boolean;
}) {
  const c = useColors(isDark);
  // Cap grid at 8 players for readability
  const n = Math.min(maxPlayers, 8);
  const names = useMemo(() => Array.from({ length: n }, (_, i) => seedName(i)), [n]);

  // Simulate results for the first few completed rounds
  const completedRounds = Math.min(2, rounds);
  const results: Record<string, string> = {};
  let gameIdx = 0;
  for (let r = 0; r < completedRounds; r++) {
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        // Only include pairings from this round (simplified: sequential)
        if (gameIdx % (n / 2) === r % (n / 2)) {
          const key = `${i}-${j}`;
          results[key] = gameIdx % 3 === 0 ? "1" : gameIdx % 3 === 1 ? "0" : "½";
        }
        gameIdx++;
      }
    }
  }

  const cellSize = Math.max(18, Math.min(26, Math.floor(200 / n)));

  return (
    <div className="space-y-2">
      {/* Grid */}
      <div className="overflow-x-auto">
        <table style={{ borderCollapse: "separate", borderSpacing: 2 }}>
          <thead>
            <tr>
              <th style={{ width: cellSize, height: cellSize }} />
              {names.map((name, j) => (
                <th key={j} style={{ width: cellSize, height: cellSize }}>
                  <div
                    className="text-[8px] font-bold truncate text-center"
                    style={{ color: c.green, maxWidth: cellSize }}
                  >
                    {name.slice(0, 3)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {names.map((rowName, i) => (
              <tr key={i}>
                {/* Row header */}
                <td>
                  <div
                    className="text-[8px] font-bold truncate text-right pr-1"
                    style={{ color: c.green, maxWidth: 36 }}
                  >
                    {rowName.slice(0, 3)}
                  </div>
                </td>
                {names.map((_, j) => {
                  const isDiag = i === j;
                  const key = i < j ? `${i}-${j}` : `${j}-${i}`;
                  const res = results[key];
                  const displayRes = res !== undefined
                    ? i < j ? res : res === "1" ? "0" : res === "0" ? "1" : "½"
                    : null;

                  return (
                    <td key={j}>
                      <div
                        style={{
                          width: cellSize,
                          height: cellSize,
                          borderRadius: 4,
                          background: isDiag
                            ? isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.06)"
                            : displayRes !== null
                            ? GREEN_BG
                            : c.cell,
                          border: `1px solid ${isDiag ? "transparent" : displayRes !== null ? c.green : c.cellBorder}`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {isDiag ? (
                          <div
                            style={{
                              width: "60%",
                              height: "60%",
                              background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
                              borderRadius: 2,
                              transform: "rotate(45deg)",
                            }}
                          />
                        ) : displayRes !== null ? (
                          <span
                            className="text-[9px] font-bold"
                            style={{ color: c.green }}
                          >
                            {displayRes}
                          </span>
                        ) : null}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div
        className="flex items-center justify-between pt-1"
        style={{ borderTop: `1px solid ${c.line}` }}
      >
        <span className="text-[9px]" style={{ color: c.text }}>
          {maxPlayers} players · {rounds} rounds
        </span>
        <span className="text-[9px] font-semibold" style={{ color: c.green }}>
          {maxPlayers - 1} games/player
        </span>
      </div>
    </div>
  );
}

// ─── Elimination Bracket Preview ──────────────────────────────────────────────

function EliminationPreview({
  maxPlayers,
  isDark,
}: {
  maxPlayers: number;
  isDark: boolean;
}) {
  const c = useColors(isDark);

  // Compute bracket size (next power of 2)
  const bracketSize = useMemo(() => {
    let s = 2;
    while (s < maxPlayers) s *= 2;
    return s;
  }, [maxPlayers]);

  const rounds = Math.log2(bracketSize);
  // Cap visual rounds at 4 for space
  const visRounds = Math.min(rounds, 4);

  // Build bracket columns
  const columns = useMemo(() => {
    return Array.from({ length: visRounds }, (_, ri) => {
      const matchCount = bracketSize / Math.pow(2, ri + 1);
      const displayCount = Math.min(matchCount, 4);
      return Array.from({ length: displayCount }, (_, mi) => {
        const isCompleted = ri < visRounds - 2;
        const p1 = seedName(ri * 8 + mi * 2);
        const p2 = seedName(ri * 8 + mi * 2 + 1);
        const winner = isCompleted ? (mi % 2 === 0 ? p1 : p2) : null;
        return { p1, p2, winner, isCompleted };
      });
    });
  }, [bracketSize, visRounds]);

  const colWidth = 72;
  const matchHeight = 36;
  const matchGap = 8;
  const svgWidth = visRounds * (colWidth + 16);
  const maxMatchesInCol0 = columns[0]?.length ?? 1;
  const svgHeight = maxMatchesInCol0 * (matchHeight + matchGap) + 8;

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <svg
          width={svgWidth}
          height={svgHeight}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          style={{ display: "block" }}
        >
          {columns.map((col, ci) => {
            const x = ci * (colWidth + 16);
            const totalMatchesInCol = col.length;
            const spacing = svgHeight / totalMatchesInCol;

            return col.map((match, mi) => {
              const cy = spacing * mi + spacing / 2;
              const y = cy - matchHeight / 2;

              // Draw connector line to next column
              const nextCol = columns[ci + 1];
              let connectorJsx: React.ReactNode = null;
              if (nextCol) {
                const nextSpacing = svgHeight / nextCol.length;
                const nextMi = Math.floor(mi / 2);
                const nextCy = nextSpacing * nextMi + nextSpacing / 2;
                const lineX1 = x + colWidth;
                const lineX2 = x + colWidth + 16;
                connectorJsx = (
                  <path
                    key={`conn-${ci}-${mi}`}
                    d={`M ${lineX1} ${cy} C ${lineX1 + 8} ${cy}, ${lineX2 - 8} ${nextCy}, ${lineX2} ${nextCy}`}
                    fill="none"
                    stroke={match.winner ? c.green : c.line}
                    strokeWidth={match.winner ? 1.5 : 1}
                    strokeDasharray={match.winner ? "none" : "3 2"}
                  />
                );
              }

              return (
                <g key={`${ci}-${mi}`}>
                  {connectorJsx}
                  {/* Match box */}
                  <rect
                    x={x}
                    y={y}
                    width={colWidth}
                    height={matchHeight}
                    rx={5}
                    fill={match.isCompleted ? GREEN_BG : isDark ? "rgba(255,255,255,0.04)" : "rgba(61,107,71,0.04)"}
                    stroke={match.isCompleted ? c.green : c.cellBorder}
                    strokeWidth={match.isCompleted ? 1.5 : 1}
                  />
                  {/* Player 1 */}
                  <text
                    x={x + 6}
                    y={y + 13}
                    fontSize={9}
                    fontWeight={match.winner === match.p1 ? "700" : "400"}
                    fill={match.winner === match.p1 ? c.green : c.textBold}
                    fontFamily="system-ui, sans-serif"
                  >
                    {match.p1.slice(0, 7)}
                  </text>
                  {/* Divider */}
                  <line
                    x1={x + 4}
                    y1={y + matchHeight / 2}
                    x2={x + colWidth - 4}
                    y2={y + matchHeight / 2}
                    stroke={c.line}
                    strokeWidth={0.75}
                  />
                  {/* Player 2 */}
                  <text
                    x={x + 6}
                    y={y + matchHeight - 7}
                    fontSize={9}
                    fontWeight={match.winner === match.p2 ? "700" : "400"}
                    fill={match.winner === match.p2 ? c.green : match.isCompleted ? c.text : c.textBold}
                    fontFamily="system-ui, sans-serif"
                    opacity={match.isCompleted && match.winner !== match.p2 ? 0.45 : 1}
                  >
                    {match.p2.slice(0, 7)}
                  </text>
                  {/* Round label above first match */}
                  {mi === 0 && (
                    <text
                      x={x + colWidth / 2}
                      y={y - 5}
                      fontSize={8}
                      fontWeight="700"
                      textAnchor="middle"
                      fill={c.green}
                      fontFamily="system-ui, sans-serif"
                    >
                      {ci === visRounds - 1
                        ? "Final"
                        : ci === visRounds - 2
                        ? "Semi"
                        : `R${ci + 1}`}
                    </text>
                  )}
                </g>
              );
            });
          })}
        </svg>
      </div>

      {/* Footer */}
      <div
        className="flex items-center justify-between pt-1"
        style={{ borderTop: `1px solid ${c.line}` }}
      >
        <span className="text-[9px]" style={{ color: c.text }}>
          {maxPlayers} players · {rounds} rounds
        </span>
        <span className="text-[9px] font-semibold" style={{ color: c.green }}>
          {bracketSize - 1} total games
        </span>
      </div>
    </div>
  );
}

// ─── Format badge + description header ───────────────────────────────────────

const FORMAT_META: Record<
  Format,
  { icon: string; label: string; desc: string }
> = {
  swiss: {
    icon: "⚔️",
    label: "Swiss System",
    desc: "Players are paired by score each round. No eliminations — everyone plays all rounds.",
  },
  doubleswiss: {
    icon: "🔄",
    label: "Double Swiss",
    desc: "Each board plays two games per round — once as White, once as Black. Balanced color exposure.",
  },
  roundrobin: {
    icon: "🔁",
    label: "Round Robin",
    desc: "Every player faces every other player. Most comprehensive format.",
  },
  elimination: {
    icon: "🏆",
    label: "Single Elimination",
    desc: "Lose once and you're out. High-stakes bracket drama.",
  },
};

// ─── Main export ──────────────────────────────────────────────────────────────

export function BracketPreview({
  format,
  rounds,
  maxPlayers,
  isDark,
}: BracketPreviewProps) {
  const c = useColors(isDark);
  const meta = FORMAT_META[format];

  return (
    <div className="space-y-3">
      {/* Format header */}
      <div className="flex items-start gap-2">
        <span className="text-base leading-none mt-0.5">{meta.icon}</span>
        <div>
          <div
            className="text-xs font-bold"
            style={{ color: c.green }}
          >
            {meta.label}
          </div>
          <div
            className="text-[10px] leading-snug mt-0.5"
            style={{ color: c.text }}
          >
            {meta.desc}
          </div>
        </div>
      </div>

      {/* Visualization */}
      <div
        className="rounded-xl p-3"
        style={{
          background: c.bg,
          border: `1px solid ${c.border}`,
        }}
      >
        {format === "swiss" && (
          <SwissPreview
            rounds={rounds}
            maxPlayers={maxPlayers}
            isDark={isDark}
          />
        )}
        {format === "doubleswiss" && (
          <SwissPreview
            rounds={rounds}
            maxPlayers={maxPlayers}
            isDark={isDark}
            doubleSwiss
          />
        )}
        {format === "roundrobin" && (
          <RoundRobinPreview
            maxPlayers={maxPlayers}
            rounds={rounds}
            isDark={isDark}
          />
        )}
        {format === "elimination" && (
          <EliminationPreview
            maxPlayers={maxPlayers}
            isDark={isDark}
          />
        )}
      </div>
    </div>
  );
}

export default BracketPreview;
