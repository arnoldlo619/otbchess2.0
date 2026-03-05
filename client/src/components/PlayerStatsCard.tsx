/**
 * OTB Chess — Player Stats Card v3 (Premium Minimalist)
 *
 * Design principles:
 * - Single restrained dark palette — deep forest green, no avatar-tinted gradients
 * - Portrait 3:4 aspect ratio for more breathing room
 * - Large Clash Display typography throughout
 * - Clear 3-zone layout: identity → stats → record
 * - Exportable as 1080×1440 PNG via html2canvas
 */
import { forwardRef, useState } from "react";
import type { PlayerPerformance } from "@/lib/performanceStats";
import { FLAG_EMOJI } from "@/lib/tournamentData";

// ─── Badge config ─────────────────────────────────────────────────────────────
const BADGE_CONFIG: Record<string, { label: string; color: string; textColor: string }> = {
  champion:      { label: "Champion",     color: "rgba(245,158,11,0.18)",  textColor: "#F59E0B" },
  runner_up:     { label: "Runner-Up",    color: "rgba(148,163,184,0.18)", textColor: "#94A3B8" },
  third_place:   { label: "Third Place",  color: "rgba(234,88,12,0.18)",   textColor: "#EA580C" },
  perfect_score: { label: "Perfect",      color: "rgba(52,211,153,0.18)",  textColor: "#34D399" },
  giant_killer:  { label: "Giant Killer", color: "rgba(139,92,246,0.18)",  textColor: "#8B5CF6" },
  iron_wall:     { label: "Iron Wall",    color: "rgba(59,130,246,0.18)",  textColor: "#3B82F6" },
  comeback:      { label: "Comeback",     color: "rgba(244,63,94,0.18)",   textColor: "#F43F5E" },
  consistent:    { label: "Consistent",   color: "rgba(20,184,166,0.18)",  textColor: "#14B8A6" },
  participant:   { label: "Participant",  color: "rgba(255,255,255,0.08)", textColor: "rgba(255,255,255,0.45)" },
};

// ─── Avatar ───────────────────────────────────────────────────────────────────
function CardAvatar({
  name,
  username,
  avatarUrl,
  avatarStatus,
  size,
}: {
  name: string;
  username: string;
  avatarUrl: string | null | undefined;
  avatarStatus: "loading" | "loaded";
  size: number;
}) {
  const [imgError, setImgError] = useState(false);
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const showPhoto = avatarStatus === "loaded" && avatarUrl && !imgError;
  const showShimmer = avatarStatus === "loading";

  return (
    <div
      className="relative flex-shrink-0 rounded-2xl overflow-hidden"
      style={{
        width: size,
        height: size,
        background: "rgba(255,255,255,0.06)",
        boxShadow: "0 0 0 1.5px rgba(255,255,255,0.10)",
      }}
    >
      {showShimmer ? (
        <div className="w-full h-full animate-pulse" style={{ background: "rgba(255,255,255,0.08)" }} />
      ) : showPhoto ? (
        <img
          src={avatarUrl!}
          alt={`${username}'s avatar`}
          className="w-full h-full object-cover"
          crossOrigin="anonymous"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <span
            className="font-black text-white/70"
            style={{
              fontFamily: "'Clash Display', sans-serif",
              fontSize: Math.round(size * 0.38),
            }}
          >
            {initials}
          </span>
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

    const badgeCfg = BADGE_CONFIG[badge] ?? BADGE_CONFIG.participant;
    const flag = FLAG_EMOJI[player.country] ?? "";
    const ordinal =
      rank === 1 ? "1st" : rank === 2 ? "2nd" : rank === 3 ? "3rd" : `${rank}th`;
    const ratingSign = ratingChange >= 0 ? "+" : "";

    // Sizes: export = 1080×1440, display = responsive portrait
    const exportW = 1080;
    const exportH = 1440;
    const avatarSize = forExport ? 100 : 72;

    // W/D/L bar
    const total = wins + draws + losses;
    const wPct = total > 0 ? (wins / total) * 100 : 0;
    const dPct = total > 0 ? (draws / total) * 100 : 0;
    const lPct = total > 0 ? (losses / total) * 100 : 0;

    return (
      <div
        ref={ref}
        data-stats-card
        className={`relative overflow-hidden select-none ${
          forExport ? "rounded-[48px]" : "w-full rounded-3xl"
        }`}
        style={{
          fontFamily: "'Inter', sans-serif",
          ...(forExport
            ? { width: exportW, height: exportH }
            : { aspectRatio: "3/4" }),
        }}
      >
        {/* ── Background ── */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(160deg, oklch(0.20 0.055 148) 0%, oklch(0.15 0.07 148) 55%, oklch(0.11 0.09 148) 100%)",
          }}
        />

        {/* ── Subtle dot-grid texture ── */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
            opacity: 0.6,
          }}
        />

        {/* ── Top-right glow ── */}
        <div
          className="absolute pointer-events-none"
          style={{
            top: "-20%",
            right: "-15%",
            width: "60%",
            height: "60%",
            background: "radial-gradient(circle, oklch(0.55 0.18 148) 0%, transparent 70%)",
            opacity: 0.12,
            borderRadius: "50%",
          }}
        />

        {/* ── Content ── */}
        <div
          className="relative z-10 h-full flex flex-col"
          style={{ padding: forExport ? 72 : 28 }}
        >

          {/* ── Zone 1: Header ── */}
          <div className="flex items-start justify-between mb-auto" style={{ marginBottom: forExport ? 56 : 20 }}>
            {/* Brand */}
            <div className="flex items-center gap-2">
              <div
                style={{
                  width: forExport ? 36 : 22,
                  height: forExport ? 36 : 22,
                  borderRadius: forExport ? 8 : 6,
                  background: "oklch(0.48 0.16 148)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg
                  viewBox="0 0 24 24"
                  style={{ width: forExport ? 20 : 13, height: forExport ? 20 : 13, fill: "white" }}
                >
                  <path d="M11 2h2v2h2v2h-2v2h2l1 2H8l1-2h2V6H9V4h2V2zm-4 9h10l1 9H6l1-9z" />
                </svg>
              </div>
              <span
                style={{
                  fontFamily: "'Clash Display', sans-serif",
                  fontSize: forExport ? 18 : 10,
                  fontWeight: 800,
                  color: "rgba(255,255,255,0.45)",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                }}
              >
                OTBchess.app
              </span>
            </div>

            {/* Tournament name */}
            <div style={{ textAlign: "right", maxWidth: forExport ? 380 : 140 }}>
              <p
                style={{
                  fontSize: forExport ? 14 : 8,
                  fontWeight: 700,
                  color: "rgba(255,255,255,0.25)",
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                  marginBottom: 2,
                }}
              >
                Final Report
              </p>
              <p
                style={{
                  fontSize: forExport ? 18 : 10,
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.55)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {tournamentName}
              </p>
              {tournamentDate && (
                <p
                  style={{
                    fontSize: forExport ? 14 : 8,
                    color: "rgba(255,255,255,0.25)",
                    marginTop: 2,
                  }}
                >
                  {tournamentDate}
                </p>
              )}
            </div>
          </div>

          {/* ── Zone 2: Player identity ── */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: forExport ? 32 : 16,
              marginBottom: forExport ? 52 : 20,
            }}
          >
            <CardAvatar
              name={player.name}
              username={player.username}
              avatarUrl={avatarUrl}
              avatarStatus={avatarStatus}
              size={avatarSize}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Title chip */}
              {player.title && (
                <span
                  style={{
                    display: "inline-block",
                    fontSize: forExport ? 14 : 9,
                    fontWeight: 900,
                    padding: forExport ? "4px 10px" : "2px 6px",
                    borderRadius: forExport ? 6 : 4,
                    background: "oklch(0.48 0.16 148)",
                    color: "white",
                    marginBottom: forExport ? 10 : 5,
                    fontFamily: "'Clash Display', sans-serif",
                  }}
                >
                  {player.title}
                </span>
              )}
              {/* Player name */}
              <p
                style={{
                  fontFamily: "'Clash Display', sans-serif",
                  fontSize: forExport ? 52 : 22,
                  fontWeight: 800,
                  color: "white",
                  lineHeight: 1.05,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  marginBottom: forExport ? 10 : 4,
                }}
              >
                {flag} {player.name}
              </p>
              {/* Username · ELO */}
              <p
                style={{
                  fontSize: forExport ? 18 : 10,
                  color: "rgba(255,255,255,0.38)",
                  fontWeight: 500,
                  marginBottom: forExport ? 16 : 8,
                }}
              >
                @{player.username} · {player.elo} ELO
              </p>
              {/* Badge pill */}
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  fontSize: forExport ? 16 : 10,
                  fontWeight: 700,
                  padding: forExport ? "6px 16px" : "3px 10px",
                  borderRadius: 999,
                  background: badgeCfg.color,
                  color: badgeCfg.textColor,
                  letterSpacing: "0.02em",
                }}
              >
                {badgeLabel || badgeCfg.label}
              </span>
            </div>
          </div>

          {/* ── Divider ── */}
          <div
            style={{
              height: 1,
              background: "rgba(255,255,255,0.08)",
              marginBottom: forExport ? 52 : 20,
            }}
          />

          {/* ── Zone 3: Stats grid (2×2) ── */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: forExport ? 32 : 12,
              marginBottom: forExport ? 52 : 20,
            }}
          >
            {[
              { label: "Rank", value: ordinal, sub: `of ${totalPlayers}`, accent: true },
              { label: "Score", value: String(points), sub: "pts", accent: false },
              { label: "Performance", value: String(performanceRating), sub: `${ratingSign}${ratingChange} ELO`, accent: false },
              { label: "Best Streak", value: `${longestStreak}W`, sub: "consecutive", accent: false },
            ].map(({ label, value, sub, accent }) => (
              <div
                key={label}
                style={{
                  background: "rgba(255,255,255,0.04)",
                  borderRadius: forExport ? 24 : 12,
                  padding: forExport ? "28px 24px" : "12px 14px",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <p
                  style={{
                    fontSize: forExport ? 14 : 8,
                    fontWeight: 700,
                    color: "rgba(255,255,255,0.30)",
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                    marginBottom: forExport ? 8 : 3,
                  }}
                >
                  {label}
                </p>
                <p
                  style={{
                    fontFamily: "'Clash Display', sans-serif",
                    fontSize: forExport ? 64 : 28,
                    fontWeight: 800,
                    color: accent ? "oklch(0.75 0.18 148)" : "white",
                    lineHeight: 1,
                    marginBottom: forExport ? 6 : 2,
                  }}
                >
                  {value}
                </p>
                <p
                  style={{
                    fontSize: forExport ? 14 : 8,
                    color: "rgba(255,255,255,0.30)",
                    fontWeight: 500,
                  }}
                >
                  {sub}
                </p>
              </div>
            ))}
          </div>

          {/* ── Zone 4: W/D/L bar ── */}
          {total > 0 && (
            <div style={{ marginBottom: forExport ? 52 : 20 }}>
              {/* Bar */}
              <div
                style={{
                  display: "flex",
                  height: forExport ? 10 : 5,
                  borderRadius: 999,
                  overflow: "hidden",
                  gap: 2,
                  marginBottom: forExport ? 14 : 6,
                }}
              >
                {wins > 0 && (
                  <div
                    style={{
                      width: `${wPct}%`,
                      background: "#4CAF50",
                      borderRadius: 999,
                    }}
                  />
                )}
                {draws > 0 && (
                  <div
                    style={{
                      width: `${dPct}%`,
                      background: "rgba(255,255,255,0.25)",
                      borderRadius: 999,
                    }}
                  />
                )}
                {losses > 0 && (
                  <div
                    style={{
                      width: `${lPct}%`,
                      background: "rgba(239,68,68,0.6)",
                      borderRadius: 999,
                    }}
                  />
                )}
              </div>
              {/* Labels */}
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span
                  style={{
                    fontSize: forExport ? 16 : 10,
                    fontWeight: 700,
                    color: "#4CAF50",
                  }}
                >
                  {wins}W
                </span>
                <span
                  style={{
                    fontSize: forExport ? 16 : 10,
                    fontWeight: 700,
                    color: "rgba(255,255,255,0.30)",
                  }}
                >
                  {draws}D
                </span>
                <span
                  style={{
                    fontSize: forExport ? 16 : 10,
                    fontWeight: 700,
                    color: "rgba(239,68,68,0.6)",
                  }}
                >
                  {losses}L
                </span>
              </div>
            </div>
          )}

          {/* ── Zone 5: Footer chips ── */}
          <div
            style={{
              marginTop: "auto",
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              gap: forExport ? 24 : 10,
            }}
          >
            {bestWin ? (
              <div>
                <p
                  style={{
                    fontSize: forExport ? 12 : 7,
                    fontWeight: 700,
                    color: "rgba(255,255,255,0.22)",
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                    marginBottom: forExport ? 6 : 2,
                  }}
                >
                  Best Win
                </p>
                <p
                  style={{
                    fontSize: forExport ? 20 : 11,
                    fontWeight: 700,
                    color: "rgba(255,255,255,0.65)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    maxWidth: forExport ? 320 : 120,
                  }}
                >
                  {bestWin.opponent.name}
                </p>
                <p
                  style={{
                    fontSize: forExport ? 14 : 8,
                    color: "rgba(255,255,255,0.30)",
                  }}
                >
                  {bestWin.opponent.elo} ELO
                </p>
              </div>
            ) : (
              <div />
            )}
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <p
                style={{
                  fontSize: forExport ? 12 : 7,
                  fontWeight: 700,
                  color: "rgba(255,255,255,0.22)",
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                  marginBottom: forExport ? 6 : 2,
                }}
              >
                Buchholz
              </p>
              <p
                style={{
                  fontSize: forExport ? 20 : 11,
                  fontWeight: 700,
                  color: "rgba(255,255,255,0.55)",
                }}
              >
                {buchholz.toFixed(1)}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

PlayerStatsCard.displayName = "PlayerStatsCard";
export default PlayerStatsCard;
