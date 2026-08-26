/**
 * PlayerProfileSheet — Mobile bottom sheet that slides up when a player avatar
 * is tapped in the tournament Standings tab.
 *
 * Shows:
 *  - chess.com avatar, username, title, country flag
 *  - Rapid / Blitz / Bullet ratings from chess.com
 *  - ELO sparkline over last 50 games with min/max/current range
 *  - W/D/L record from last 50 games
 *  - Link to chess.com profile
 */
import { useEffect, useRef, useState } from "react";
import { X, ExternalLink, TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { Player } from "@/lib/tournamentData";
import { useAccessibleOverlay } from "@/hooks/useAccessibleOverlay";

// ─── Country flag helper ──────────────────────────────────────────────────────
const COUNTRY_FLAGS: Record<string, string> = {
  US: "🇺🇸", GB: "🇬🇧", DE: "🇩🇪", FR: "🇫🇷", ES: "🇪🇸", IT: "🇮🇹",
  RU: "🇷🇺", CN: "🇨🇳", IN: "🇮🇳", BR: "🇧🇷", CA: "🇨🇦", AU: "🇦🇺",
  NL: "🇳🇱", NO: "🇳🇴", SE: "🇸🇪", DK: "🇩🇰", FI: "🇫🇮", PL: "🇵🇱",
  UA: "🇺🇦", AR: "🇦🇷", MX: "🇲🇽", JP: "🇯🇵", KR: "🇰🇷", NG: "🇳🇬",
  ZA: "🇿🇦", EG: "🇪🇬", RO: "🇷🇴", HU: "🇭🇺", CZ: "🇨🇿", SK: "🇸🇰",
  AT: "🇦🇹", CH: "🇨🇭", BE: "🇧🇪", PT: "🇵🇹", GR: "🇬🇷", TR: "🇹🇷",
  IL: "🇮🇱", IR: "🇮🇷", AZ: "🇦🇿", AM: "🇦🇲", GE: "🇬🇪", BY: "🇧🇾",
  RS: "🇷🇸", HR: "🇭🇷", SI: "🇸🇮", BG: "🇧🇬", LT: "🇱🇹", LV: "🇱🇻",
  EE: "🇪🇪", IS: "🇮🇸", NZ: "🇳🇿", SG: "🇸🇬", PH: "🇵🇭", VN: "🇻🇳",
  ID: "🇮🇩", MY: "🇲🇾", TH: "🇹🇭", PK: "🇵🇰", BD: "🇧🇩", LK: "🇱🇰",
  PE: "🇵🇪", CO: "🇨🇴", CL: "🇨🇱", VE: "🇻🇪", CU: "🇨🇺",
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface EloGame {
  index: number;
  rating: number;
  result: string;
  timeClass: string;
  date: string;
}

interface EloHistory {
  games: EloGame[];
  minRating: number | null;
  maxRating: number | null;
  currentRating: number | null;
}

interface ChessProfile {
  profile: {
    username: string;
    name?: string;
    title?: string;
    country?: string;
    avatar?: string;
    url?: string;
    followers?: number;
  };
  stats: {
    chess_rapid?: { last?: { rating: number }; best?: { rating: number } };
    chess_blitz?: { last?: { rating: number }; best?: { rating: number } };
    chess_bullet?: { last?: { rating: number }; best?: { rating: number } };
  };
}

// ─── Sparkline SVG ────────────────────────────────────────────────────────────
function EloSparkline({ games, isDark }: { games: EloGame[]; isDark: boolean }) {
  if (games.length < 2) return null;

  const W = 300;
  const H = 80;
  const PAD = 8;

  const ratings = games.map((g) => g.rating);
  const minR = Math.min(...ratings);
  const maxR = Math.max(...ratings);
  const range = maxR - minR || 1;

  const toX = (i: number) => PAD + (i / (games.length - 1)) * (W - PAD * 2);
  const toY = (r: number) => H - PAD - ((r - minR) / range) * (H - PAD * 2);

  const points = games.map((g, i) => `${toX(i).toFixed(1)},${toY(g.rating).toFixed(1)}`).join(" ");
  const areaPoints = `${toX(0).toFixed(1)},${H} ${points} ${toX(games.length - 1).toFixed(1)},${H}`;

  // Trend: compare first 10 vs last 10
  const firstAvg = ratings.slice(0, 10).reduce((a, b) => a + b, 0) / Math.min(10, ratings.length);
  const lastAvg = ratings.slice(-10).reduce((a, b) => a + b, 0) / Math.min(10, ratings.length);
  const trend = lastAvg - firstAvg;
  const trendColor = trend > 10 ? "#4CAF50" : trend < -10 ? "#ef4444" : "#94a3b8";

  return (
    <div className="relative w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height: "80px" }}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="eloGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={trendColor} stopOpacity="0.25" />
            <stop offset="100%" stopColor={trendColor} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {/* Area fill */}
        <polygon points={areaPoints} fill="url(#eloGrad)" />
        {/* Line */}
        <polyline
          points={points}
          fill="none"
          stroke={trendColor}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* Current rating dot */}
        <circle
          cx={toX(games.length - 1).toFixed(1)}
          cy={toY(ratings[ratings.length - 1]).toFixed(1)}
          r="3.5"
          fill={trendColor}
          stroke={isDark ? "#0f1f12" : "#fff"}
          strokeWidth="2"
        />
      </svg>
      {/* Trend indicator */}
      <div className="absolute top-1 right-1 flex items-center gap-1">
        {trend > 10 ? (
          <TrendingUp className="w-3.5 h-3.5" style={{ color: "#4CAF50" }} />
        ) : trend < -10 ? (
          <TrendingDown className="w-3.5 h-3.5" style={{ color: "#ef4444" }} />
        ) : (
          <Minus className="w-3.5 h-3.5" style={{ color: "#94a3b8" }} />
        )}
        <span className="text-[10px] font-bold" style={{ color: trendColor }}>
          {trend > 0 ? "+" : ""}{Math.round(trend)}
        </span>
      </div>
    </div>
  );
}

// ─── Rating Pill ──────────────────────────────────────────────────────────────
function RatingPill({ label, rating, isDark }: { label: string; rating: number | undefined; isDark: boolean }) {
  if (!rating) return null;
  return (
    <div
      className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-2xl flex-1"
      style={{ background: isDark ? "oklch(0.22 0.06 145)" : "oklch(0.94 0.02 145)" }}
    >
      <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: isDark ? "oklch(0.55 0.08 145)" : "oklch(0.45 0.06 145)" }}>
        {label}
      </span>
      <span className="text-lg font-black tabular-nums" style={{ color: isDark ? "oklch(0.92 0.04 145)" : "oklch(0.20 0.08 145)" }}>
        {rating}
      </span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
interface PlayerProfileSheetProps {
  player: Player | null;
  onClose: () => void;
  isDark: boolean;
  /** 1-based rank of the player in the current standings */
  rank?: number;
  /** Total number of players in the tournament */
  totalPlayers?: number;
  /** Current round number */
  currentRound?: number;
  /** Total rounds in the tournament */
  totalRounds?: number;
}

export function PlayerProfileSheet({ player, onClose, isDark, rank, totalPlayers, currentRound, totalRounds }: PlayerProfileSheetProps) {
  const [chessProfile, setChessProfile] = useState<ChessProfile | null>(null);
  const [eloHistory, setEloHistory] = useState<EloHistory | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [loadingElo, setLoadingElo] = useState(false);
  const [profileError, setProfileError] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const startYRef = useRef<number | null>(null);
  const [dragY, setDragY] = useState(0);

  const isOpen = !!player;
  useAccessibleOverlay({
    open: isOpen,
    onClose,
    containerRef: sheetRef,
    initialFocusRef: closeButtonRef,
  });

  const playerUsername = player?.username;
  const playerPlatform = player?.platform;

  // Fetch chess.com data when player changes
  useEffect(() => {
    if (!playerUsername) {
      setChessProfile(null);
      setEloHistory(null);
      setProfileError(false);
      return;
    }
    if (playerPlatform === "lichess") return; // lichess handled differently

    const username = playerUsername;
    setLoadingProfile(true);
    setLoadingElo(true);
    setProfileError(false);
    setChessProfile(null);
    setEloHistory(null);

    // Fetch profile + stats
    fetch(`/api/chess/player/${encodeURIComponent(username)}`)
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((data: ChessProfile) => setChessProfile(data))
      .catch(() => setProfileError(true))
      .finally(() => setLoadingProfile(false));

    // Fetch ELO history
    fetch(`/api/chess/player/${encodeURIComponent(username)}/elo-history`)
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((data: EloHistory) => setEloHistory(data))
      .catch(() => {/* non-fatal */})
      .finally(() => setLoadingElo(false));
  }, [playerPlatform, playerUsername]);

  // Close on backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  // Drag-to-dismiss
  const handleTouchStart = (e: React.TouchEvent) => {
    startYRef.current = e.touches[0].clientY;
    setDragY(0);
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (startYRef.current === null) return;
    const delta = e.touches[0].clientY - startYRef.current;
    if (delta > 0) setDragY(delta);
  };
  const handleTouchEnd = () => {
    if (dragY > 80) {
      onClose();
    }
    setDragY(0);
    startYRef.current = null;
  };

  if (!player) return null;

  const flag = COUNTRY_FLAGS[player.country?.toUpperCase() ?? ""] ?? "";
  const displayName = player.name || player.username;
  const platform = player.platform ?? "chesscom";

  // Resolved ratings: prefer live chess.com data, fall back to Player fields
  const rapidRating = chessProfile?.stats?.chess_rapid?.last?.rating ?? player.rapidElo;
  const blitzRating = chessProfile?.stats?.chess_blitz?.last?.rating ?? player.blitzElo;
  const bulletRating = chessProfile?.stats?.chess_bullet?.last?.rating ?? player.bulletElo;

  // Avatar: prefer live chess.com avatar, fall back to player.avatarUrl
  const avatarUrl = chessProfile?.profile?.avatar ?? player.avatarUrl;
  const profileUrl = chessProfile?.profile?.url ?? (platform === "chesscom"
    ? `https://www.chess.com/member/${player.username}`
    : `https://lichess.org/@/${player.username}`);

  // ELO range display
  const eloGames = eloHistory?.games ?? [];
  const minElo = eloHistory?.minRating;
  const maxElo = eloHistory?.maxRating;
  const currentElo = eloHistory?.currentRating;

  // W/D/L from last 50 games
  const wins = eloGames.filter((g) => g.result === "win").length;
  const draws = eloGames.filter((g) => ["stalemate", "insufficient", "50move", "repetition", "agreed", "timevsinsufficient"].includes(g.result)).length;
  const losses = eloGames.length - wins - draws;
  const tournamentGames = player.wins + player.draws + player.losses;
  const tournamentScoreRate = tournamentGames > 0
    ? Math.round(((player.wins + player.draws * 0.5) / tournamentGames) * 100)
    : null;
  const platformLabel = platform === "chesscom" ? "chess.com" : "Lichess";

  const bgSheet = isDark ? "oklch(0.14 0.05 145)" : "oklch(0.98 0.01 145)";
  const bgOverlay = isDark ? "rgba(0,0,0,0.72)" : "rgba(0,0,0,0.45)";
  const textMain = isDark ? "oklch(0.95 0.02 145)" : "oklch(0.18 0.06 145)";
  const textMuted = isDark ? "oklch(0.58 0.05 145)" : "oklch(0.48 0.06 145)";
  const dividerColor = isDark ? "oklch(0.24 0.05 145)" : "oklch(0.88 0.03 145)";
  const accent = "#4CAF50";

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[90] transition-opacity duration-300"
        style={{ background: bgOverlay, opacity: isOpen ? 1 : 0, pointerEvents: isOpen ? "auto" : "none" }}
        onClick={handleBackdropClick}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={`${displayName} player profile`}
        tabIndex={-1}
        className="fixed bottom-0 left-0 right-0 z-[91] rounded-t-[28px] overflow-hidden"
        style={{
          background: bgSheet,
          transform: `translateY(${isOpen ? dragY : "100%"}px)`,
          transition: dragY > 0 ? "none" : "transform 0.38s cubic-bezier(0.32, 0.72, 0, 1)",
          maxHeight: "88dvh",
          boxShadow: "0 -8px 40px rgba(0,0,0,0.35)",
          border: `1px solid ${dividerColor}`,
          borderBottom: "none",
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: isDark ? "oklch(0.35 0.04 145)" : "oklch(0.80 0.03 145)" }} />
        </div>

        {/* Close button */}
        <button
          ref={closeButtonRef}
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-90"
          style={{ background: isDark ? "oklch(0.22 0.05 145)" : "oklch(0.90 0.02 145)", color: textMuted }}
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Scrollable content */}
        <div className="overflow-y-auto" style={{ maxHeight: "calc(88dvh - 32px)" }}>
          <div className="px-5 pb-8 space-y-5">

            {/* ── Public identity header ── */}
            <div
              className="relative overflow-hidden rounded-[24px] border p-4"
              style={{
                background: isDark ? "linear-gradient(135deg, oklch(0.23 0.07 145), oklch(0.17 0.05 145))" : "linear-gradient(135deg, oklch(0.96 0.03 145), oklch(0.99 0.01 145))",
                borderColor: `${accent}33`,
              }}
            >
              <div className="pointer-events-none absolute -right-10 -top-14 h-40 w-40 rounded-full" style={{ background: `${accent}18`, filter: "blur(18px)" }} />
              <div className="relative flex items-start justify-between gap-3">
                <p className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: accent }}>Player Profile</p>
                <a
                  href={profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-xl transition active:scale-90"
                  style={{ background: isDark ? "oklch(0.15 0.04 145 / 0.65)" : "white", color: accent, border: `1px solid ${accent}33` }}
                  aria-label={`Open ${displayName}'s ${platformLabel} profile`}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
              <div className="relative mt-3 flex items-center gap-4">
                <div
                  className="relative flex-shrink-0 overflow-hidden rounded-2xl"
                  style={{ width: 76, height: 76, background: isDark ? "oklch(0.20 0.06 145)" : "oklch(0.90 0.03 145)", border: `2px solid ${accent}66` }}
                >
                  {avatarUrl ? (
                    <img loading="lazy" decoding="async" src={avatarUrl} alt={`${displayName} avatar`} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-2xl font-black" style={{ color: accent }}>
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {player.title && (
                      <span className="rounded-md px-1.5 py-0.5 text-xs font-black" style={{ background: `${accent}22`, color: accent, border: `1px solid ${accent}44` }}>
                        {player.title}
                      </span>
                    )}
                    <span className="truncate text-lg font-black" style={{ color: textMain }}>{displayName}</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    {flag && <span className="text-sm" aria-label={`Country: ${player.country}`}>{flag}</span>}
                    <span className="truncate text-sm" style={{ color: textMuted }}>@{player.username}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="rounded-full px-2 py-1 text-[10px] font-bold" style={{ background: isDark ? "oklch(0.15 0.04 145 / 0.72)" : "white", color: textMuted, border: `1px solid ${dividerColor}` }}>
                      {platformLabel}
                    </span>
                    <span className="rounded-full px-2 py-1 text-[10px] font-bold tabular-nums" style={{ background: `${accent}18`, color: accent, border: `1px solid ${accent}33` }}>
                      ELO {player.elo}
                    </span>
                    {tournamentGames > 0 && (
                      <span className="rounded-full px-2 py-1 text-[10px] font-bold tabular-nums" style={{ background: isDark ? "oklch(0.15 0.04 145 / 0.72)" : "white", color: textMuted, border: `1px solid ${dividerColor}` }}>
                        {tournamentGames} game{tournamentGames === 1 ? "" : "s"} played
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {tournamentScoreRate !== null && (
                <div className="relative mt-3 flex items-center justify-between rounded-xl px-3 py-2" style={{ background: isDark ? "oklch(0.15 0.04 145 / 0.62)" : "white", border: `1px solid ${dividerColor}` }}>
                  <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: textMuted }}>Event score rate</span>
                  <span className="text-sm font-black tabular-nums" style={{ color: accent }}>{tournamentScoreRate}%</span>
                </div>
              )}
            </div>

            {/* ── Divider ── */}
            <div style={{ height: 1, background: dividerColor }} />

            {/* ── Tournament Performance ── */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: textMuted }}>Tournament Performance</span>
                {currentRound && totalRounds && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: isDark ? "oklch(0.22 0.06 145)" : "oklch(0.92 0.03 145)", color: textMuted }}>
                    Round {currentRound}/{totalRounds}
                  </span>
                )}
              </div>

              {/* Rank + Points hero row */}
              <div className="flex gap-2 mb-2">
                {/* Rank */}
                {rank && totalPlayers && (
                  <div
                    className="flex-1 flex flex-col items-center justify-center py-3 rounded-2xl"
                    style={{ background: rank <= 3 ? `${accent}18` : isDark ? "oklch(0.20 0.05 145)" : "oklch(0.93 0.02 145)", border: rank <= 3 ? `1px solid ${accent}44` : `1px solid ${dividerColor}` }}
                  >
                    <span className="text-2xl leading-none">
                      {rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-widest mt-1" style={{ color: textMuted }}>of {totalPlayers}</span>
                  </div>
                )}
                {/* Points */}
                <div
                  className="flex-1 flex flex-col items-center justify-center py-3 rounded-2xl"
                  style={{ background: isDark ? "oklch(0.20 0.06 145)" : "oklch(0.93 0.02 145)", border: `1px solid ${dividerColor}` }}
                >
                  <span className="text-2xl font-black tabular-nums leading-none" style={{ color: accent }}>
                    {player.points % 1 === 0 ? player.points.toFixed(0) : player.points.toFixed(1)}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-widest mt-1" style={{ color: textMuted }}>Points</span>
                </div>
                {/* Buchholz */}
                <div
                  className="flex-1 flex flex-col items-center justify-center py-3 rounded-2xl"
                  style={{ background: isDark ? "oklch(0.20 0.05 145)" : "oklch(0.93 0.02 145)", border: `1px solid ${dividerColor}` }}
                >
                  <span className="text-2xl font-black tabular-nums leading-none" style={{ color: textMain }}>
                    {player.buchholz.toFixed(1)}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-widest mt-1" style={{ color: textMuted }}>Buch.</span>
                </div>
              </div>

              {/* W / D / L tournament record */}
              <div className="flex gap-2">
                <div className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl" style={{ background: "oklch(0.35 0.12 145 / 0.15)", border: "1px solid oklch(0.45 0.15 145 / 0.25)" }}>
                  <span className="text-base font-black" style={{ color: "#4CAF50" }}>{player.wins}</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "oklch(0.55 0.10 145)" }}>W</span>
                </div>
                <div className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl" style={{ background: isDark ? "oklch(0.20 0.04 145 / 0.5)" : "oklch(0.92 0.02 145)", border: `1px solid ${dividerColor}` }}>
                  <span className="text-base font-black" style={{ color: textMuted }}>{player.draws}</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: textMuted }}>D</span>
                </div>
                <div className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl" style={{ background: "oklch(0.30 0.12 15 / 0.15)", border: "1px solid oklch(0.45 0.12 15 / 0.25)" }}>
                  <span className="text-base font-black" style={{ color: "#ef4444" }}>{player.losses}</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "oklch(0.55 0.10 15)" }}>L</span>
                </div>
              </div>

              {/* Color history */}
              {player.colorHistory && player.colorHistory.length > 0 && (
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: textMuted }}>Colors:</span>
                  <div className="flex gap-1">
                    {player.colorHistory.map((c, idx) => (
                      <div
                        key={idx}
                        className="w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-black"
                        style={{
                          background: c === "W" ? (isDark ? "oklch(0.90 0.02 145)" : "white") : (isDark ? "oklch(0.18 0.06 145)" : "oklch(0.22 0.06 145)"),
                          color: c === "W" ? "oklch(0.18 0.06 145)" : "oklch(0.90 0.02 145)",
                          border: `1px solid ${dividerColor}`,
                        }}
                      >
                        {c}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── Divider ── */}
            <div style={{ height: 1, background: dividerColor }} />

            {/* ── Online ratings ── */}
            {loadingProfile ? (
              <div className="flex gap-2">
                {[1, 2, 3].map((k) => (
                  <div key={k} className="flex-1 h-14 rounded-2xl animate-pulse" style={{ background: isDark ? "oklch(0.20 0.05 145)" : "oklch(0.92 0.02 145)" }} />
                ))}
              </div>
            ) : profileError ? (
              <p className="text-xs text-center py-2" style={{ color: textMuted }}>
                Could not load chess.com profile
              </p>
            ) : (
              <div className="flex gap-2">
                <RatingPill label="Rapid" rating={rapidRating} isDark={isDark} />
                <RatingPill label="Blitz" rating={blitzRating} isDark={isDark} />
                <RatingPill label="Bullet" rating={bulletRating} isDark={isDark} />
              </div>
            )}

            {/* ── ELO history sparkline ── */}
            {(loadingElo || eloGames.length > 0) && (
              <>
                <div style={{ height: 1, background: dividerColor }} />
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-widest" style={{ color: textMuted }}>
                      ELO — Last {eloGames.length || 50} Games
                    </span>
                    {currentElo && (
                      <span className="text-sm font-black tabular-nums" style={{ color: accent }}>{currentElo}</span>
                    )}
                  </div>

                  {loadingElo ? (
                    <div className="w-full h-20 rounded-xl animate-pulse" style={{ background: isDark ? "oklch(0.20 0.05 145)" : "oklch(0.92 0.02 145)" }} />
                  ) : (
                    <>
                      <div
                        className="rounded-2xl p-3"
                        style={{ background: isDark ? "oklch(0.17 0.05 145)" : "oklch(0.96 0.01 145)", border: `1px solid ${dividerColor}` }}
                      >
                        <EloSparkline games={eloGames} isDark={isDark} />
                      </div>

                      {/* Min / Max / Current range */}
                      {minElo && maxElo && (
                        <div className="flex items-center justify-between mt-2 px-1">
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] font-semibold" style={{ color: textMuted }}>Low</span>
                            <span className="text-xs font-black tabular-nums" style={{ color: "#ef4444" }}>{minElo}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] font-semibold" style={{ color: textMuted }}>Range</span>
                            <span className="text-xs font-bold tabular-nums" style={{ color: textMuted }}>{maxElo - minElo}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] font-semibold" style={{ color: textMuted }}>Peak</span>
                            <span className="text-xs font-black tabular-nums" style={{ color: "#4CAF50" }}>{maxElo}</span>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </>
            )}

            {/* ── W/D/L record ── */}
            {eloGames.length > 0 && !loadingElo && (
              <>
                <div style={{ height: 1, background: dividerColor }} />
                <div>
                  <span className="text-xs font-bold uppercase tracking-widest block mb-2" style={{ color: textMuted }}>
                    Last {eloGames.length} Games
                  </span>
                  <div className="flex gap-2">
                    {/* Win bar */}
                    <div className="flex-1 rounded-2xl p-3 text-center" style={{ background: "oklch(0.35 0.12 145 / 0.18)", border: "1px solid oklch(0.45 0.15 145 / 0.3)" }}>
                      <div className="text-xl font-black" style={{ color: "#4CAF50" }}>{wins}</div>
                      <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "oklch(0.55 0.10 145)" }}>Wins</div>
                    </div>
                    <div className="flex-1 rounded-2xl p-3 text-center" style={{ background: isDark ? "oklch(0.20 0.04 145 / 0.5)" : "oklch(0.92 0.02 145)", border: `1px solid ${dividerColor}` }}>
                      <div className="text-xl font-black" style={{ color: textMuted }}>{draws}</div>
                      <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: textMuted }}>Draws</div>
                    </div>
                    <div className="flex-1 rounded-2xl p-3 text-center" style={{ background: "oklch(0.30 0.12 15 / 0.18)", border: "1px solid oklch(0.45 0.12 15 / 0.3)" }}>
                      <div className="text-xl font-black" style={{ color: "#ef4444" }}>{losses}</div>
                      <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "oklch(0.55 0.10 15)" }}>Losses</div>
                    </div>
                  </div>
                  {/* Win rate bar */}
                  {eloGames.length > 0 && (
                    <div className="mt-3">
                      <div className="flex h-2 rounded-full overflow-hidden gap-0.5">
                        <div style={{ width: `${(wins / eloGames.length) * 100}%`, background: "#4CAF50", borderRadius: "9999px 0 0 9999px" }} />
                        <div style={{ width: `${(draws / eloGames.length) * 100}%`, background: isDark ? "oklch(0.35 0.04 145)" : "oklch(0.75 0.04 145)" }} />
                        <div style={{ width: `${(losses / eloGames.length) * 100}%`, background: "#ef4444", borderRadius: "0 9999px 9999px 0" }} />
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className="text-[10px]" style={{ color: "#4CAF50" }}>{Math.round((wins / eloGames.length) * 100)}%</span>
                        <span className="text-[10px]" style={{ color: textMuted }}>{Math.round((draws / eloGames.length) * 100)}%</span>
                        <span className="text-[10px]" style={{ color: "#ef4444" }}>{Math.round((losses / eloGames.length) * 100)}%</span>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ── View on chess.com ── */}
            <a
              href={profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl text-sm font-bold transition-all active:scale-[0.98]"
              style={{
                background: isDark ? "oklch(0.22 0.06 145)" : "oklch(0.92 0.03 145)",
                color: accent,
                border: `1px solid ${accent}33`,
              }}
            >
              <ExternalLink className="w-4 h-4" />
              View on {platform === "chesscom" ? "chess.com" : "Lichess"}
            </a>

          </div>
        </div>
      </div>
    </>
  );
}
