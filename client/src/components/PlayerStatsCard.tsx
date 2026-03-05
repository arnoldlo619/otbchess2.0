/**
 * OTB Chess — Player Stats Card (Redesigned)
 *
 * Clean, minimalist, premium design aligned with the platform's design system.
 * - Dark card with subtle green-tinted gradient — no busy multi-colour gradients
 * - Large typography, generous spacing, clear visual hierarchy
 * - Exportable as 1080×1080 PNG via html2canvas
 */
import { forwardRef, useState } from "react";
import type { PlayerPerformance } from "@/lib/performanceStats";
import { FLAG_EMOJI } from "@/lib/tournamentData";

// ─── Badge accent colours ─────────────────────────────────────────────────────
// Each badge gets a single accent colour used for the rank pill and badge chip.
const BADGE_ACCENT: Record<string, { bg: string; text: string; ring: string }> = {
  champion:      { bg: "bg-amber-400/20",   text: "text-amber-300",   ring: "ring-amber-400/40" },
  runner_up:     { bg: "bg-slate-400/20",   text: "text-slate-300",   ring: "ring-slate-400/40" },
  third_place:   { bg: "bg-orange-400/20",  text: "text-orange-300",  ring: "ring-orange-400/40" },
  perfect_score: { bg: "bg-emerald-400/20", text: "text-emerald-300", ring: "ring-emerald-400/40" },
  giant_killer:  { bg: "bg-violet-400/20",  text: "text-violet-300",  ring: "ring-violet-400/40" },
  iron_wall:     { bg: "bg-blue-400/20",    text: "text-blue-300",    ring: "ring-blue-400/40" },
  comeback:      { bg: "bg-rose-400/20",    text: "text-rose-300",    ring: "ring-rose-400/40" },
  consistent:    { bg: "bg-teal-400/20",    text: "text-teal-300",    ring: "ring-teal-400/40" },
  participant:   { bg: "bg-white/10",       text: "text-white/50",    ring: "ring-white/20" },
};

// ─── Avatar ───────────────────────────────────────────────────────────────────
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
  size: number;
}) {
  const [imgError, setImgError] = useState(false);
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const accent = BADGE_ACCENT[badge] ?? BADGE_ACCENT.participant;
  const showPhoto = avatarStatus === "loaded" && avatarUrl && !imgError;
  const showShimmer = avatarStatus === "loading";

  return (
    <div
      className={`relative flex-shrink-0 rounded-2xl overflow-hidden ring-2 ${accent.ring}`}
      style={{ width: size, height: size }}
    >
      {showShimmer ? (
        <div className="w-full h-full bg-white/10 animate-pulse" />
      ) : showPhoto ? (
        <img
          src={avatarUrl!}
          alt={`${username}'s avatar`}
          className="w-full h-full object-cover"
          crossOrigin="anonymous"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-white/08">
          <span
            className="font-black text-white/80"
            style={{
              fontFamily: "'Clash Display', sans-serif",
              fontSize: Math.round(size * 0.36),
            }}
          >
            {initials}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Stat Block ───────────────────────────────────────────────────────────────
function StatBlock({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string | number;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span
        className={`text-2xl font-black leading-none tabular-nums ${
          highlight ? "text-[#4CAF50]" : "text-white"
        }`}
        style={{ fontFamily: "'Clash Display', sans-serif" }}
      >
        {value}
      </span>
      {sub && (
        <span className="text-[9px] font-semibold text-white/40 tabular-nums">{sub}</span>
      )}
      <span className="text-[8px] font-bold uppercase tracking-widest text-white/30 mt-0.5">
        {label}
      </span>
    </div>
  );
}

// ─── W/D/L Bar ───────────────────────────────────────────────────────────────
function RecordBar({ wins, draws, losses }: { wins: number; draws: number; losses: number }) {
  const total = wins + draws + losses;
  if (total === 0) return null;
  const wPct = (wins / total) * 100;
  const dPct = (draws / total) * 100;
  const lPct = (losses / total) * 100;
  return (
    <div className="w-full space-y-2">
      {/* Bar */}
      <div className="flex h-1.5 rounded-full overflow-hidden gap-px">
        {wins > 0 && (
          <div className="bg-emerald-400 rounded-full" style={{ width: `${wPct}%` }} />
        )}
        {draws > 0 && (
          <div className="bg-white/30 rounded-full" style={{ width: `${dPct}%` }} />
        )}
        {losses > 0 && (
          <div className="bg-red-400/70 rounded-full" style={{ width: `${lPct}%` }} />
        )}
      </div>
      {/* Labels */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-emerald-400">{wins}W</span>
        <span className="text-[10px] font-bold text-white/30">{draws}D</span>
        <span className="text-[10px] font-bold text-red-400/70">{losses}L</span>
      </div>
    </div>
  );
}

// ─── Main Card ────────────────────────────────────────────────────────────────
export interface PlayerStatsCardProps {
  perf: PlayerPerformance;
  tournamentName: string;
  tournamentDate?: string;
  avatarUrl?: string | null;
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
      buchholz,
      badge,
      badgeLabel,
      longestStreak,
    } = perf;

    const accent = BADGE_ACCENT[badge] ?? BADGE_ACCENT.participant;
    const flag = FLAG_EMOJI[player.country] ?? "";
    const ordinal =
      rank === 1 ? "1st" : rank === 2 ? "2nd" : rank === 3 ? "3rd" : `${rank}th`;
    const ratingSign = ratingChange >= 0 ? "+" : "";
    const avatarSize = forExport ? 80 : 64;

    return (
      <div
        ref={ref}
        data-stats-card
        className={`relative overflow-hidden select-none ${
          forExport
            ? "w-[540px] h-[540px] rounded-[32px]"
            : "w-full aspect-square max-w-[480px] rounded-3xl"
        }`}
        style={{ fontFamily: "'Inter', sans-serif" }}
      >
        {/* ── Background: deep dark with subtle green tint ── */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(145deg, oklch(0.18 0.04 145) 0%, oklch(0.14 0.06 145) 60%, oklch(0.12 0.08 145) 100%)",
          }}
        />

        {/* ── Subtle chess-square texture ── */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `repeating-conic-gradient(#fff 0% 25%, transparent 0% 50%)`,
            backgroundSize: "48px 48px",
          }}
        />

        {/* ── Radial glow behind avatar area ── */}
        <div
          className="absolute top-0 left-0 w-48 h-48 rounded-full opacity-20 blur-3xl pointer-events-none"
          style={{ background: "oklch(0.65 0.18 145)" }}
        />

        {/* ── Content ── */}
        <div className="relative z-10 h-full flex flex-col p-6 gap-4">

          {/* ── Top bar: brand + tournament ── */}
          <div className="flex items-start justify-between">
            {/* OTB brand mark */}
            <div className="flex items-center gap-1.5">
              <div
                className="w-6 h-6 rounded-md flex items-center justify-center"
                style={{ background: "oklch(0.45 0.15 145)" }}
              >
                {/* Chess king icon */}
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-white">
                  <path d="M11 2h2v2h2v2h-2v2h2l1 2H8l1-2h2V6H9V4h2V2zm-4 9h10l1 9H6l1-9z" />
                </svg>
              </div>
              <span
                className="text-[10px] font-black text-white/50 tracking-wider uppercase"
                style={{ fontFamily: "'Clash Display', sans-serif" }}
              >
                OTB Chess
              </span>
            </div>
            {/* Tournament info */}
            <div className="text-right">
              <p className="text-[9px] font-bold uppercase tracking-widest text-white/30 mb-0.5">
                Final Report
              </p>
              <p className="text-[10px] font-semibold text-white/60 truncate max-w-[140px]">
                {tournamentName}
              </p>
              {tournamentDate && (
                <p className="text-[9px] text-white/30 mt-0.5">{tournamentDate}</p>
              )}
            </div>
          </div>

          {/* ── Player identity ── */}
          <div className="flex items-center gap-4">
            <PlayerAvatar
              name={player.name}
              username={player.username}
              avatarUrl={avatarUrl}
              avatarStatus={avatarStatus}
              badge={badge}
              size={avatarSize}
            />
            <div className="flex-1 min-w-0">
              {/* Name */}
              <div className="flex items-center gap-2 flex-wrap mb-1">
                {player.title && (
                  <span
                    className="text-[10px] font-black px-1.5 py-0.5 rounded"
                    style={{
                      background: "oklch(0.45 0.15 145)",
                      color: "white",
                    }}
                  >
                    {player.title}
                  </span>
                )}
                <span
                  className="text-xl font-black text-white leading-tight truncate"
                  style={{ fontFamily: "'Clash Display', sans-serif" }}
                >
                  {flag} {player.name}
                </span>
              </div>
              {/* Username + ELO */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-white/40 font-medium">
                  @{player.username}
                </span>
                <span className="text-[10px] text-white/20">·</span>
                <span className="text-[10px] font-bold text-white/50">
                  {player.elo} ELO
                </span>
              </div>
              {/* Badge pill */}
              <div className="mt-2">
                <span
                  className={`inline-flex items-center text-[10px] font-bold px-2.5 py-1 rounded-full ${accent.bg} ${accent.text}`}
                >
                  {badgeLabel}
                </span>
              </div>
            </div>
          </div>

          {/* ── Divider ── */}
          <div className="h-px bg-white/08" />

          {/* ── Key stats row ── */}
          <div className="grid grid-cols-4 gap-2">
            <StatBlock
              label="Rank"
              value={ordinal}
              sub={`of ${totalPlayers}`}
              highlight
            />
            <StatBlock label="Score" value={points} sub="pts" />
            <StatBlock
              label="Perf."
              value={performanceRating}
              sub={`${ratingSign}${ratingChange}`}
            />
            <StatBlock label="Streak" value={`${longestStreak}W`} sub="best" />
          </div>

          {/* ── Divider ── */}
          <div className="h-px bg-white/08" />

          {/* ── W/D/L bar ── */}
          <RecordBar wins={wins} draws={draws} losses={losses} />

          {/* ── Footer: best win + buchholz ── */}
          <div className="mt-auto flex items-end justify-between gap-3">
            {bestWin ? (
              <div className="flex-1 min-w-0">
                <p className="text-[8px] font-bold uppercase tracking-widest text-white/25 mb-0.5">
                  Best Win
                </p>
                <p className="text-[11px] font-bold text-white/70 truncate">
                  {bestWin.opponent.name}
                </p>
                <p className="text-[9px] text-white/35">{bestWin.opponent.elo} ELO</p>
              </div>
            ) : (
              <div />
            )}
            <div className="text-right flex-shrink-0">
              <p className="text-[8px] font-bold uppercase tracking-widest text-white/25 mb-0.5">
                Buchholz
              </p>
              <p className="text-[11px] font-bold text-white/60">{buchholz.toFixed(1)}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

PlayerStatsCard.displayName = "PlayerStatsCard";
export default PlayerStatsCard;
