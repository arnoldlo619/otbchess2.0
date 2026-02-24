/**
 * OTB Chess — Player Stats Card
 *
 * A visually rich, social-media-optimized card showing a player's
 * post-tournament performance. Designed to be:
 *   - Screenshot-friendly (fixed 1080×1080 aspect ratio at 2× scale)
 *   - Exportable as PNG via html2canvas
 *   - Responsive for in-app display
 *
 * Props:
 *   perf           — PlayerPerformance object from performanceStats.ts
 *   tournamentName — display name of the tournament
 *   tournamentDate — display date string
 *   avatarUrl      — chess.com avatar URL (optional); falls back to initials
 *   avatarStatus   — "loading" | "loaded" — shows shimmer skeleton when loading
 *   forExport      — when true, renders in a fixed 540×540px container
 *                    suitable for 2× canvas capture → 1080×1080 PNG
 */
import { forwardRef, useState } from "react";
import type { PlayerPerformance } from "@/lib/performanceStats";
import { FLAG_EMOJI } from "@/lib/tournamentData";

// ─── Badge color map ──────────────────────────────────────────────────────────
const BADGE_GRADIENT: Record<string, string> = {
  champion:      "from-[#B8860B] via-[#FFD700] to-[#DAA520]",
  runner_up:     "from-[#6B7280] via-[#9CA3AF] to-[#D1D5DB]",
  third_place:   "from-[#92400E] via-[#B45309] to-[#D97706]",
  perfect_score: "from-[#065F46] via-[#059669] to-[#34D399]",
  giant_killer:  "from-[#4C1D95] via-[#7C3AED] to-[#A78BFA]",
  iron_wall:     "from-[#1E3A5F] via-[#1D4ED8] to-[#60A5FA]",
  comeback:      "from-[#7F1D1D] via-[#DC2626] to-[#F87171]",
  consistent:    "from-[#064E3B] via-[#047857] to-[#6EE7B7]",
  participant:   "from-[#1F2937] via-[#374151] to-[#6B7280]",
};

// Avatar ring gradient — matches the badge gradient for visual cohesion
const RING_GRADIENT: Record<string, string> = {
  champion:      "from-[#FFD700] to-[#B8860B]",
  runner_up:     "from-[#D1D5DB] to-[#6B7280]",
  third_place:   "from-[#D97706] to-[#92400E]",
  perfect_score: "from-[#34D399] to-[#065F46]",
  giant_killer:  "from-[#A78BFA] to-[#4C1D95]",
  iron_wall:     "from-[#60A5FA] to-[#1E3A5F]",
  comeback:      "from-[#F87171] to-[#7F1D1D]",
  consistent:    "from-[#6EE7B7] to-[#064E3B]",
  participant:   "from-[#6B7280] to-[#1F2937]",
};

// ─── Stat Pill ────────────────────────────────────────────────────────────────
function StatPill({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-2xl px-3 py-3 ${
        accent ? "bg-[#3D6B47] text-white" : "bg-black/08 text-white"
      }`}
    >
      <span className="text-[10px] font-semibold uppercase tracking-widest opacity-70 mb-0.5">
        {label}
      </span>
      <span
        className="text-xl font-black leading-none"
        style={{ fontFamily: "'Clash Display', sans-serif" }}
      >
        {value}
      </span>
      {sub && <span className="text-[9px] opacity-60 mt-0.5">{sub}</span>}
    </div>
  );
}

// ─── Record Bar ───────────────────────────────────────────────────────────────
function RecordBar({ wins, draws, losses }: { wins: number; draws: number; losses: number }) {
  const total = wins + draws + losses;
  if (total === 0) return null;
  const wPct = (wins / total) * 100;
  const dPct = (draws / total) * 100;
  const lPct = (losses / total) * 100;
  return (
    <div className="w-full space-y-1">
      <div className="flex h-2.5 rounded-full overflow-hidden gap-0.5">
        {wins > 0 && (
          <div className="bg-emerald-400 rounded-full transition-all" style={{ width: `${wPct}%` }} />
        )}
        {draws > 0 && (
          <div className="bg-blue-400 rounded-full transition-all" style={{ width: `${dPct}%` }} />
        )}
        {losses > 0 && (
          <div className="bg-red-400 rounded-full transition-all" style={{ width: `${lPct}%` }} />
        )}
      </div>
      <div className="flex justify-between text-[9px] font-semibold opacity-70">
        <span className="text-emerald-300">{wins}W</span>
        <span className="text-blue-300">{draws}D</span>
        <span className="text-red-300">{losses}L</span>
      </div>
    </div>
  );
}

// ─── Rating Change Pill ───────────────────────────────────────────────────────
function RatingChangePill({ change }: { change: number }) {
  const positive = change >= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full ${
        positive ? "bg-emerald-400/20 text-emerald-300" : "bg-red-400/20 text-red-300"
      }`}
    >
      {positive ? "▲" : "▼"} {Math.abs(change)}
    </span>
  );
}

// ─── Avatar Component ─────────────────────────────────────────────────────────
/**
 * Renders the player avatar with:
 *  - A gradient ring matching the badge colour
 *  - The chess.com photo when available
 *  - A shimmer skeleton while the URL is loading
 *  - Polished initials fallback when no photo exists
 */
function PlayerAvatar({
  name,
  username,
  avatarUrl,
  avatarStatus,
  badge,
  size,
}: {
  name: string;
  username: string;
  avatarUrl: string | null | undefined;
  avatarStatus: "loading" | "loaded";
  badge: string;
  size: number; // px
}) {
  const [imgError, setImgError] = useState(false);
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const ringGradient = RING_GRADIENT[badge] ?? RING_GRADIENT.participant;
  const showPhoto = avatarStatus === "loaded" && avatarUrl && !imgError;
  const showShimmer = avatarStatus === "loading";

  // Ring is 3px, gap is 2px → inner content is size - 10px
  const innerSize = size - 10;

  return (
    <div
      className="flex-shrink-0 relative"
      style={{ width: size, height: size }}
    >
      {/* Gradient ring */}
      <div
        className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${ringGradient} p-[3px]`}
      >
        <div className="w-full h-full rounded-[10px] overflow-hidden bg-black/30">
          {showShimmer ? (
            /* Shimmer skeleton */
            <div className="w-full h-full animate-shimmer" />
          ) : showPhoto ? (
            /* Real chess.com avatar */
            <img
              src={avatarUrl!}
              alt={`${username}'s chess.com avatar`}
              className="w-full h-full object-cover"
              crossOrigin="anonymous"
              onError={() => setImgError(true)}
              style={{ width: innerSize, height: innerSize }}
            />
          ) : (
            /* Initials fallback */
            <div className="w-full h-full flex items-center justify-center">
              <span
                className="font-black text-white/90"
                style={{
                  fontFamily: "'Clash Display', sans-serif",
                  fontSize: Math.round(innerSize * 0.36),
                }}
              >
                {initials}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* chess.com logo badge — only when showing real photo */}
      {showPhoto && (
        <div
          className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#81b64c] border-2 border-white/20 flex items-center justify-center"
          title="chess.com verified"
        >
          <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 fill-white">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" />
          </svg>
        </div>
      )}
    </div>
  );
}

// ─── Main Card ────────────────────────────────────────────────────────────────
export interface PlayerStatsCardProps {
  perf: PlayerPerformance;
  tournamentName: string;
  tournamentDate?: string;
  /** Chess.com avatar URL — pass null for confirmed no-avatar, undefined while loading */
  avatarUrl?: string | null;
  /** "loading" shows shimmer skeleton; "loaded" shows photo or initials fallback */
  avatarStatus?: "loading" | "loaded";
  forExport?: boolean;
}

const PlayerStatsCard = forwardRef<HTMLDivElement, PlayerStatsCardProps>(
  (
    {
      perf,
      tournamentName,
      tournamentDate,
      avatarUrl,
      avatarStatus = "loaded",
      forExport = false,
    },
    ref
  ) => {
    const {
      player,
      rank,
      totalPlayers,
      points,
      wins,
      draws,
      losses,
      performanceRating,
      ratingChange,
      bestWin,
      biggestUpset,
      longestStreak,
      buchholz,
      badge,
      badgeLabel,
    } = perf;

    const gradient = BADGE_GRADIENT[badge] ?? BADGE_GRADIENT.participant;
    const flag = FLAG_EMOJI[player.country] ?? "";
    const ordinal =
      rank === 1 ? "1st" : rank === 2 ? "2nd" : rank === 3 ? "3rd" : `${rank}th`;

    const avatarSize = forExport ? 72 : 56;

    return (
      <div
        ref={ref}
        data-stats-card
        className={`relative overflow-hidden rounded-3xl select-none ${
          forExport ? "w-[540px] h-[540px]" : "w-full aspect-square max-w-[480px]"
        }`}
        style={{ fontFamily: "'Inter', sans-serif" }}
      >
        {/* ── Background gradient ── */}
        <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`} />

        {/* ── Checkerboard texture overlay ── */}
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: `repeating-conic-gradient(#fff 0% 25%, transparent 0% 50%)`,
            backgroundSize: "40px 40px",
          }}
        />

        {/* ── Noise grain overlay ── */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
        />

        {/* ── Dark vignette ── */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/20" />

        {/* ── Content ── */}
        <div className="relative z-10 h-full flex flex-col p-5 text-white">

          {/* Top row: tournament name + OTB Chess brand */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] opacity-60 mb-0.5">
                Tournament Report
              </p>
              <p className="text-xs font-semibold opacity-90 truncate leading-tight">
                {tournamentName}
              </p>
              {tournamentDate && (
                <p className="text-[9px] opacity-50 mt-0.5">{tournamentDate}</p>
              )}
            </div>
            <div className="flex items-center gap-1 ml-3 flex-shrink-0">
              <div className="w-5 h-5 rounded-md bg-white/20 flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-3 h-3 fill-white">
                  <path d="M3 3h4v4H3V3zm7 0h4v4h-4V3zm7 0h4v4h-4V3zM3 10h4v4H3v-4zm7 0h4v4h-4v-4zm7 0h4v4h-4v-4zM3 17h4v4H3v-4zm7 0h4v4h-4v-4zm7 0h4v4h-4v-4z" />
                </svg>
              </div>
              <span
                className="text-[9px] font-bold opacity-70"
                style={{ fontFamily: "'Clash Display', sans-serif" }}
              >
                OTBChess
              </span>
            </div>
          </div>

          {/* Player identity */}
          <div className="flex items-center gap-3 mb-3">
            {/* Avatar with gradient ring */}
            <PlayerAvatar
              name={player.name}
              username={player.username}
              avatarUrl={avatarUrl}
              avatarStatus={avatarStatus}
              badge={badge}
              size={avatarSize}
            />

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                {player.title && (
                  <span className="text-[10px] font-black bg-white/25 px-1.5 py-0.5 rounded-md tracking-wide">
                    {player.title}
                  </span>
                )}
                <span
                  className="text-lg font-black leading-tight truncate"
                  style={{ fontFamily: "'Clash Display', sans-serif" }}
                >
                  {player.name}
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-sm">{flag}</span>
                <span className="text-[10px] opacity-60 font-medium">
                  @{player.username}
                </span>
                <span className="text-[10px] opacity-50">·</span>
                <span className="text-[10px] opacity-60 font-medium">
                  {player.elo} ELO
                </span>
              </div>
            </div>
          </div>

          {/* Badge */}
          <div className="mb-3">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/30">
              {badgeLabel}
            </span>
          </div>

          {/* Main stats grid */}
          <div className="grid grid-cols-4 gap-1.5 mb-3">
            <StatPill label="Rank" value={ordinal} sub={`of ${totalPlayers}`} accent />
            <StatPill label="Score" value={points} sub="pts" />
            <StatPill
              label="Perf."
              value={performanceRating}
              sub={<RatingChangePill change={ratingChange} />}
            />
            <StatPill label="Streak" value={`${longestStreak}W`} sub="best run" />
          </div>

          {/* Record bar */}
          <div className="mb-3">
            <RecordBar wins={wins} draws={draws} losses={losses} />
          </div>

          {/* Best win / biggest upset */}
          <div className="flex gap-1.5 mb-3">
            {bestWin && (
              <div className="flex-1 bg-black/20 backdrop-blur-sm rounded-xl px-2.5 py-2 border border-white/10">
                <p className="text-[8px] font-bold uppercase tracking-widest opacity-50 mb-0.5">
                  Best Win
                </p>
                <p className="text-xs font-bold truncate">{bestWin.opponent.name}</p>
                <p className="text-[9px] opacity-60">{bestWin.opponent.elo} ELO</p>
              </div>
            )}
            {biggestUpset && (
              <div className="flex-1 bg-black/20 backdrop-blur-sm rounded-xl px-2.5 py-2 border border-white/10">
                <p className="text-[8px] font-bold uppercase tracking-widest opacity-50 mb-0.5">
                  Biggest Upset
                </p>
                <p className="text-xs font-bold truncate">{biggestUpset.opponent.name}</p>
                <p className="text-[9px] opacity-60">+{biggestUpset.eloGap} ELO gap</p>
              </div>
            )}
            {!bestWin && !biggestUpset && (
              <div className="flex-1 bg-black/20 backdrop-blur-sm rounded-xl px-2.5 py-2 border border-white/10">
                <p className="text-[8px] font-bold uppercase tracking-widest opacity-50 mb-0.5">
                  Buchholz
                </p>
                <p className="text-xs font-bold">{buchholz.toFixed(1)}</p>
                <p className="text-[9px] opacity-60">tiebreak score</p>
              </div>
            )}
          </div>

          {/* Footer: color balance + branding */}
          <div className="mt-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 rounded-sm bg-white/90" />
                <span className="text-[9px] opacity-60">{perf.whiteGames}</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 rounded-sm bg-black/60 border border-white/20" />
                <span className="text-[9px] opacity-60">{perf.blackGames}</span>
              </div>
              <span className="text-[9px] opacity-40">·</span>
              <span className="text-[9px] opacity-60">Buch: {buchholz.toFixed(1)}</span>
            </div>
            <span className="text-[8px] opacity-40 font-medium">otbchess.app</span>
          </div>
        </div>
      </div>
    );
  }
);

PlayerStatsCard.displayName = "PlayerStatsCard";
export default PlayerStatsCard;
