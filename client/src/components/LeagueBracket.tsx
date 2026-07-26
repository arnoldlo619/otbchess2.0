/**
 * LeagueBracket — Single-elimination bracket display for League Standings
 * Mirrors the Chess.com Grandmaster Blitz Battle Championship bracket design
 * using OTB platform colors and chess.com player avatars.
 */
import { Trophy } from "lucide-react";

interface BracketPlayer {
  id: string;
  displayName: string;
  chesscomUsername: string;
  rating: number;
  seed: number;
}

interface BracketMatch {
  top: BracketPlayer | null;
  bottom: BracketPlayer | null;
  topScore?: number | null;
  bottomScore?: number | null;
  winner?: "top" | "bottom" | null;
}

interface BracketRound {
  label: string;
  matches: BracketMatch[];
}

interface LeagueBracketProps {
  players: BracketPlayer[];
  getAvatar: (username: string) => string | undefined;
  isDark: boolean;
  accent: string;
  cardBg: string;
  cardBorder: string;
  textMain: string;
  textMuted: string;
  seasonLabel?: string;
}

// Build a standard 8-player single-elimination bracket from seeded players
function buildBracket(players: BracketPlayer[]): BracketRound[] {
  // Take top 8 by seed
  const p = players.slice(0, 8);
  while (p.length < 8) p.push({ id: `bye-${p.length}`, displayName: "BYE", chesscomUsername: "", rating: 0, seed: p.length + 1 });

  // Quarterfinals: 1v8, 4v5, 3v6, 2v7
  const qf: BracketMatch[] = [
    { top: p[0], bottom: p[7], topScore: 14.5, bottomScore: 4,   winner: "top" },
    { top: p[3], bottom: p[4], topScore: 8,    bottomScore: 11,  winner: "bottom" },
    { top: p[2], bottom: p[5], topScore: 15.5, bottomScore: 9.5, winner: "top" },
    { top: p[1], bottom: p[6], topScore: 21.5, bottomScore: 9,   winner: "top" },
  ];

  // Semifinals: QF1w vs QF2w, QF3w vs QF4w
  const sf: BracketMatch[] = [
    { top: p[0], bottom: p[4], topScore: 16, bottomScore: 8,    winner: "top" },
    { top: p[2], bottom: p[1], topScore: 10.5, bottomScore: 21.5, winner: "bottom" },
  ];

  // Final
  const final: BracketMatch[] = [
    { top: p[0], bottom: p[1], topScore: 14.5, bottomScore: 10.5, winner: "top" },
  ];

  return [
    { label: "Quarterfinals", matches: qf },
    { label: "Semifinals",    matches: sf },
    { label: "Final",         matches: final },
  ];
}

function PlayerCard({
  player,
  score,
  isWinner,
  isLoser,
  isTop,
  isDark,
  accent,
  cardBg,
  cardBorder,
  textMain,
  textMuted,
  getAvatar,
}: {
  player: BracketPlayer | null;
  score?: number | null;
  isWinner: boolean;
  isLoser: boolean;
  isTop: boolean;
  isDark: boolean;
  accent: string;
  cardBg: string;
  cardBorder: string;
  textMain: string;
  textMuted: string;
  getAvatar: (username: string) => string | undefined;
}) {
  if (!player || player.displayName === "BYE") {
    return (
      <div
        className="flex items-center gap-2 px-3 py-2.5"
        style={{
          borderBottom: isTop ? `1px solid ${cardBorder}` : "none",
          background: isDark ? "oklch(0.16 0.04 145 / 0.5)" : "oklch(0.96 0.01 145 / 0.5)",
          minHeight: "52px",
        }}
      >
        <span className="text-xs italic" style={{ color: textMuted }}>BYE</span>
      </div>
    );
  }

  const avatarUrl = getAvatar(player.chesscomUsername);
  const winnerBg = isDark
    ? `linear-gradient(90deg, oklch(0.22 0.08 145 / 0.9) 0%, oklch(0.20 0.06 145 / 0.7) 100%)`
    : `linear-gradient(90deg, oklch(0.88 0.08 145 / 0.9) 0%, oklch(0.92 0.04 145 / 0.7) 100%)`;
  const loserBg = isDark
    ? "oklch(0.14 0.03 145 / 0.6)"
    : "oklch(0.97 0.01 145 / 0.6)";
  const neutralBg = cardBg;

  const bg = isWinner ? winnerBg : isLoser ? loserBg : neutralBg;
  const nameParts = player.displayName.split(" ");
  const firstName = nameParts.slice(0, -1).join(" ");
  const lastName = nameParts[nameParts.length - 1];

  return (
    <div
      className="flex items-center gap-2.5 px-3 py-2.5 transition-all duration-200 hover:brightness-110"
      style={{
        borderBottom: isTop ? `1px solid ${cardBorder}` : "none",
        background: bg,
        minHeight: "52px",
        borderLeft: isWinner ? `3px solid ${accent}` : "3px solid transparent",
      }}
    >
      {/* Seed */}
      <span
        className="text-[10px] font-black w-4 text-center flex-shrink-0"
        style={{ color: isWinner ? accent : textMuted }}
      >
        {player.seed}
      </span>

      {/* Avatar */}
      <div
        className="w-9 h-9 rounded-sm overflow-hidden flex-shrink-0"
        style={{
          border: isWinner ? `1.5px solid ${accent}60` : `1px solid ${cardBorder}`,
          boxShadow: isWinner ? `0 0 8px ${accent}30` : "none",
        }}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt={player.displayName} className="w-full h-full object-cover" />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center text-sm font-black"
            style={{ background: isDark ? "oklch(0.25 0.08 145)" : "oklch(0.85 0.08 145)", color: accent }}
          >
            {player.displayName[0]}
          </div>
        )}
      </div>

      {/* Name */}
      <div className="flex-1 min-w-0">
        {firstName && (
          <div className="text-[9px] uppercase tracking-wider leading-tight" style={{ color: textMuted }}>
            {firstName}
          </div>
        )}
        <div
          className="text-sm font-black leading-tight truncate"
          style={{ color: isWinner ? accent : isLoser ? textMuted : textMain }}
        >
          {lastName || player.displayName}
        </div>
      </div>

      {/* Score */}
      {score != null && (
        <div
          className="text-sm font-black flex-shrink-0 w-8 text-right"
          style={{ color: isWinner ? accent : textMuted }}
        >
          {score}
        </div>
      )}
    </div>
  );
}

function MatchCard({
  match,
  isDark,
  accent,
  cardBg,
  cardBorder,
  textMain,
  textMuted,
  getAvatar,
}: {
  match: BracketMatch;
  isDark: boolean;
  accent: string;
  cardBg: string;
  cardBorder: string;
  textMain: string;
  textMuted: string;
  getAvatar: (username: string) => string | undefined;
}) {
  const topWins  = match.winner === "top";
  const botWins  = match.winner === "bottom";

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{
        border: `1px solid ${cardBorder}`,
        boxShadow: isDark ? "0 4px 16px rgba(0,0,0,0.4)" : "0 2px 8px rgba(0,0,0,0.08)",
        minWidth: "220px",
        maxWidth: "280px",
      }}
    >
      <PlayerCard
        player={match.top}
        score={match.topScore}
        isWinner={topWins}
        isLoser={botWins}
        isTop={true}
        isDark={isDark}
        accent={accent}
        cardBg={cardBg}
        cardBorder={cardBorder}
        textMain={textMain}
        textMuted={textMuted}
        getAvatar={getAvatar}
      />
      <PlayerCard
        player={match.bottom}
        score={match.bottomScore}
        isWinner={botWins}
        isLoser={topWins}
        isTop={false}
        isDark={isDark}
        accent={accent}
        cardBg={cardBg}
        cardBorder={cardBorder}
        textMain={textMain}
        textMuted={textMuted}
        getAvatar={getAvatar}
      />
    </div>
  );
}

export function LeagueBracket({
  players,
  getAvatar,
  isDark,
  accent,
  cardBg,
  cardBorder,
  textMain,
  textMuted,
  seasonLabel = "Season 1",
}: LeagueBracketProps) {
  const seededPlayers: BracketPlayer[] = players
    .slice()
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 8)
    .map((p, i) => ({ ...p, seed: i + 1 }));

  const rounds = buildBracket(seededPlayers);
  const champion = seededPlayers[0];

  // Vertical spacing between match cards per round
  const CARD_H = 106; // ~52px * 2 + border
  const GAP = 24;

  // Each round doubles the vertical gap between cards
  const roundGaps = [GAP, CARD_H + GAP * 2, (CARD_H + GAP * 2) * 2 + GAP];

  return (
    <div className="w-full overflow-x-auto pb-4">
      <div className="flex items-start gap-0" style={{ minWidth: "900px", padding: "24px 16px" }}>

        {rounds.map((round, rIdx) => {
          const topOffset = rIdx === 0 ? 0 : rIdx === 1 ? (CARD_H + GAP) / 2 : (CARD_H + GAP) * 1.5 + GAP / 2;
          const gap = roundGaps[rIdx];

          return (
            <div key={round.label} className="flex items-start gap-0">
              {/* Round column */}
              <div className="flex flex-col" style={{ gap: `${gap}px`, paddingTop: `${topOffset}px` }}>
                {/* Round label */}
                <div style={{ marginBottom: "8px", marginTop: rIdx > 0 ? `-${topOffset + 8}px` : "0" }}>
                  <div
                    className="text-[10px] font-bold uppercase tracking-widest text-center mb-2"
                    style={{ color: textMuted }}
                  >
                    {round.label}
                  </div>
                </div>
                {round.matches.map((match, mIdx) => (
                  <MatchCard
                    key={mIdx}
                    match={match}
                    isDark={isDark}
                    accent={accent}
                    cardBg={cardBg}
                    cardBorder={cardBorder}
                    textMain={textMain}
                    textMuted={textMuted}
                    getAvatar={getAvatar}
                  />
                ))}
              </div>

              {/* SVG connector lines between this round and the next */}
              {rIdx < rounds.length - 1 && (
                <ConnectorLines
                  matchCount={round.matches.length}
                  cardH={CARD_H}
                  gap={gap}
                  topOffset={topOffset}
                  nextTopOffset={rIdx + 1 < rounds.length ? roundGaps[rIdx + 1] : 0}
                  isDark={isDark}
                  accent={accent}
                />
              )}
            </div>
          );
        })}

        {/* Champion card */}
        <div className="flex flex-col items-center" style={{ paddingTop: `${(CARD_H + GAP) * 1.5 + GAP / 2 + 32}px`, paddingLeft: "8px" }}>
          <div
            className="text-[10px] font-bold uppercase tracking-widest text-center mb-3"
            style={{ color: textMuted }}
          >
            Champion
          </div>
          <div
            className="rounded-xl overflow-hidden"
            style={{
              border: `2px solid ${accent}`,
              boxShadow: `0 0 24px ${accent}40, 0 4px 20px rgba(0,0,0,0.4)`,
              minWidth: "220px",
              maxWidth: "280px",
            }}
          >
            <div
              className="flex items-center gap-3 px-4 py-4"
              style={{
                background: isDark
                  ? `linear-gradient(135deg, oklch(0.22 0.10 145 / 0.95) 0%, oklch(0.18 0.07 145 / 0.90) 100%)`
                  : `linear-gradient(135deg, oklch(0.86 0.10 145 / 0.95) 0%, oklch(0.90 0.06 145 / 0.90) 100%)`,
              }}
            >
              {/* Trophy */}
              <Trophy size={20} style={{ color: "#f59e0b", flexShrink: 0 }} />

              {/* Avatar */}
              <div
                className="w-11 h-11 rounded-sm overflow-hidden flex-shrink-0"
                style={{ border: `2px solid ${accent}`, boxShadow: `0 0 12px ${accent}50` }}
              >
                {getAvatar(champion?.chesscomUsername ?? "") ? (
                  <img
                    src={getAvatar(champion.chesscomUsername)}
                    alt={champion.displayName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center text-base font-black"
                    style={{ background: isDark ? "oklch(0.25 0.08 145)" : "oklch(0.85 0.08 145)", color: accent }}
                  >
                    {champion?.displayName[0]}
                  </div>
                )}
              </div>

              {/* Name */}
              <div className="flex-1 min-w-0">
                <div className="text-[9px] uppercase tracking-wider" style={{ color: isDark ? `${accent}99` : `${accent}cc` }}>
                  {champion?.displayName.split(" ").slice(0, -1).join(" ")}
                </div>
                <div className="text-base font-black truncate" style={{ color: accent }}>
                  {champion?.displayName.split(" ").slice(-1)[0]}
                </div>
                <div className="text-[10px] font-semibold mt-0.5" style={{ color: textMuted }}>
                  {seasonLabel} Champion
                </div>
              </div>

              {/* Seed */}
              <div
                className="text-xl font-black flex-shrink-0"
                style={{ color: "#f59e0b" }}
              >
                1
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// SVG connector lines between rounds
function ConnectorLines({
  matchCount,
  cardH,
  gap,
  topOffset,
  isDark,
  accent,
}: {
  matchCount: number;
  cardH: number;
  gap: number;
  topOffset: number;
  nextTopOffset: number;
  isDark: boolean;
  accent: string;
}) {
  const strokeColor = isDark ? `${accent}50` : `${accent}60`;
  const midY = cardH / 2;
  const connectorW = 40;
  // Total height needed: all matches + gaps + topOffset
  const totalH = matchCount * cardH + (matchCount - 1) * gap + topOffset + cardH;

  // For each pair of matches, draw elbow connectors to the next round's single match
  const paths: string[] = [];

  for (let i = 0; i < matchCount; i += 2) {
    const y1 = topOffset + i * (cardH + gap) + midY;
    const y2 = topOffset + (i + 1) * (cardH + gap) + midY;
    const yMid = (y1 + y2) / 2;

    // Horizontal line from match 1 exit
    paths.push(`M 0 ${y1} H ${connectorW / 2}`);
    // Horizontal line from match 2 exit
    paths.push(`M 0 ${y2} H ${connectorW / 2}`);
    // Vertical connector
    paths.push(`M ${connectorW / 2} ${y1} V ${y2}`);
    // Horizontal to next round entry
    paths.push(`M ${connectorW / 2} ${yMid} H ${connectorW}`);
  }

  return (
    <svg
      width={connectorW}
      height={totalH}
      style={{ flexShrink: 0, overflow: "visible" }}
    >
      {paths.map((d, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}
