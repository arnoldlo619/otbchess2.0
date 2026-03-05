/**
 * OTB Chess — Player Stats Card v4 (Premium Portrait)
 *
 * Inspired by ProfileCard design pattern:
 * - Full-width tall card with blurred avatar header zone
 * - Large avatar overlapping header/body boundary
 * - Large readable name — no overflow
 * - Clean stat grid with generous spacing
 * - Animated stat counters on mount
 * - Exportable as PNG via html2canvas
 */
import { forwardRef, useState, useEffect, useRef } from "react";
import type { PlayerPerformance } from "@/lib/performanceStats";
import { FLAG_EMOJI } from "@/lib/tournamentData";

// ─── Badge config ─────────────────────────────────────────────────────────────
const BADGE_CONFIG: Record<string, { color: string; textColor: string; glow: string }> = {
  champion:      { color: "rgba(245,158,11,0.20)",  textColor: "#F59E0B", glow: "rgba(245,158,11,0.15)" },
  runner_up:     { color: "rgba(148,163,184,0.20)", textColor: "#94A3B8", glow: "rgba(148,163,184,0.10)" },
  third_place:   { color: "rgba(234,88,12,0.20)",   textColor: "#EA580C", glow: "rgba(234,88,12,0.12)" },
  perfect_score: { color: "rgba(52,211,153,0.20)",  textColor: "#34D399", glow: "rgba(52,211,153,0.12)" },
  giant_killer:  { color: "rgba(139,92,246,0.20)",  textColor: "#A78BFA", glow: "rgba(139,92,246,0.12)" },
  iron_wall:     { color: "rgba(59,130,246,0.20)",  textColor: "#60A5FA", glow: "rgba(59,130,246,0.12)" },
  comeback:      { color: "rgba(244,63,94,0.20)",   textColor: "#FB7185", glow: "rgba(244,63,94,0.12)" },
  consistent:    { color: "rgba(20,184,166,0.20)",  textColor: "#2DD4BF", glow: "rgba(20,184,166,0.12)" },
  participant:   { color: "rgba(255,255,255,0.08)", textColor: "rgba(255,255,255,0.45)", glow: "transparent" },
};

// ─── Animated counter ─────────────────────────────────────────────────────────
function useAnimatedValue(target: number, duration = 900, delay = 0) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf: number;
    const start = performance.now() + delay;
    const animate = (now: number) => {
      if (now < start) { raf = requestAnimationFrame(animate); return; }
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, delay]);
  return value;
}

// ─── Stat block ───────────────────────────────────────────────────────────────
function StatBlock({
  label,
  value,
  sub,
  accent,
  animDelay,
  forExport,
}: {
  label: string;
  value: number | string;
  sub?: string;
  accent?: boolean;
  animDelay?: number;
  forExport?: boolean;
}) {
  const numericTarget = typeof value === "number" ? value : parseFloat(String(value)) || 0;
  const animated = useAnimatedValue(forExport ? numericTarget : numericTarget, 900, animDelay ?? 0);
  const display = typeof value === "string" && isNaN(parseFloat(value))
    ? value
    : typeof value === "number"
    ? animated
    : String(value);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: forExport ? "28px 20px" : "14px 10px",
        background: "rgba(255,255,255,0.04)",
        borderRadius: forExport ? 20 : 12,
        border: "1px solid rgba(255,255,255,0.07)",
        gap: forExport ? 8 : 4,
      }}
    >
      <span
        style={{
          fontFamily: "'Clash Display', sans-serif",
          fontSize: forExport ? 56 : 26,
          fontWeight: 800,
          lineHeight: 1,
          color: accent ? "oklch(0.78 0.18 148)" : "white",
        }}
      >
        {display}
      </span>
      {sub && (
        <span
          style={{
            fontSize: forExport ? 14 : 9,
            color: "rgba(255,255,255,0.35)",
            fontWeight: 500,
          }}
        >
          {sub}
        </span>
      )}
      <span
        style={{
          fontSize: forExport ? 13 : 8,
          fontWeight: 700,
          color: "rgba(255,255,255,0.28)",
          textTransform: "uppercase",
          letterSpacing: "0.10em",
        }}
      >
        {label}
      </span>
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

    const [imgError, setImgError] = useState(false);
    const badgeCfg = BADGE_CONFIG[badge] ?? BADGE_CONFIG.participant;
    const flag = FLAG_EMOJI[player.country] ?? "";
    const ordinal = rank === 1 ? "1st" : rank === 2 ? "2nd" : rank === 3 ? "3rd" : `${rank}th`;
    const ratingSign = ratingChange >= 0 ? "+" : "";
    const showPhoto = avatarStatus === "loaded" && avatarUrl && !imgError;

    const total = wins + draws + losses;
    const wPct = total > 0 ? (wins / total) * 100 : 0;
    const dPct = total > 0 ? (draws / total) * 100 : 0;
    const lPct = total > 0 ? (losses / total) * 100 : 0;

    // Export dimensions
    const EW = 900;
    const EH = 1200;

    const avatarDisplaySize = forExport ? 120 : 80;
    const headerH = forExport ? 240 : 140;

    return (
      <div
        ref={ref}
        data-stats-card
        className={forExport ? "" : "w-full"}
        style={{
          fontFamily: "'Inter', sans-serif",
          borderRadius: forExport ? 40 : 24,
          overflow: "hidden",
          position: "relative",
          background: "linear-gradient(160deg, oklch(0.20 0.055 148) 0%, oklch(0.14 0.07 148) 60%, oklch(0.10 0.09 148) 100%)",
          boxShadow: forExport ? "none" : "0 8px 32px rgba(0,0,0,0.4)",
          ...(forExport ? { width: EW, height: EH } : {}),
        }}
      >
        {/* ── Dot-grid texture ── */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.035) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
            pointerEvents: "none",
          }}
        />

        {/* ── Header zone: blurred avatar background ── */}
        <div
          style={{
            position: "relative",
            height: headerH,
            overflow: "hidden",
            background: badgeCfg.glow !== "transparent"
              ? `radial-gradient(ellipse at 50% 0%, ${badgeCfg.glow} 0%, transparent 70%)`
              : "rgba(255,255,255,0.02)",
          }}
        >
          {/* Blurred avatar as background */}
          {showPhoto && (
            <img
              src={avatarUrl!}
              alt=""
              crossOrigin="anonymous"
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                filter: "blur(24px) saturate(0.4) brightness(0.35)",
                transform: "scale(1.1)",
              }}
            />
          )}

          {/* Top bar: brand + tournament */}
          <div
            style={{
              position: "relative",
              zIndex: 2,
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              padding: forExport ? "36px 48px 0" : "18px 22px 0",
            }}
          >
            {/* Brand */}
            <div style={{ display: "flex", alignItems: "center", gap: forExport ? 10 : 6 }}>
              <div
                style={{
                  width: forExport ? 34 : 20,
                  height: forExport ? 34 : 20,
                  borderRadius: forExport ? 8 : 5,
                  background: "oklch(0.48 0.16 148)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <svg
                  viewBox="0 0 24 24"
                  style={{ width: forExport ? 18 : 11, height: forExport ? 18 : 11, fill: "white" }}
                >
                  <path d="M11 2h2v2h2v2h-2v2h2l1 2H8l1-2h2V6H9V4h2V2zm-4 9h10l1 9H6l1-9z" />
                </svg>
              </div>
              <span
                style={{
                  fontFamily: "'Clash Display', sans-serif",
                  fontSize: forExport ? 16 : 9,
                  fontWeight: 800,
                  color: "rgba(255,255,255,0.50)",
                  letterSpacing: "0.10em",
                  textTransform: "uppercase",
                }}
              >
                OTBchess.app
              </span>
            </div>

            {/* Tournament */}
            <div style={{ textAlign: "right", maxWidth: forExport ? 360 : 160 }}>
              <p
                style={{
                  fontSize: forExport ? 12 : 7,
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
                  fontSize: forExport ? 16 : 9,
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
                <p style={{ fontSize: forExport ? 12 : 7, color: "rgba(255,255,255,0.25)", marginTop: 2 }}>
                  {tournamentDate}
                </p>
              )}
            </div>
          </div>

          {/* Badge pill — bottom-left of header */}
          <div
            style={{
              position: "absolute",
              bottom: forExport ? 32 : 16,
              left: forExport ? 48 : 22,
              zIndex: 3,
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                fontSize: forExport ? 15 : 9,
                fontWeight: 700,
                padding: forExport ? "6px 16px" : "3px 10px",
                borderRadius: 999,
                background: badgeCfg.color,
                color: badgeCfg.textColor,
                backdropFilter: "blur(8px)",
                border: `1px solid ${badgeCfg.textColor}30`,
              }}
            >
              {badgeLabel}
            </span>
          </div>
        </div>

        {/* ── Body ── */}
        <div
          style={{
            position: "relative",
            padding: forExport ? "0 48px 48px" : "0 22px 22px",
            marginTop: forExport ? -60 : -36,
          }}
        >
          {/* ── Avatar + identity row ── */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: forExport ? 24 : 14,
              marginBottom: forExport ? 32 : 16,
            }}
          >
            {/* Avatar */}
            <div
              style={{
                width: avatarDisplaySize,
                height: avatarDisplaySize,
                borderRadius: forExport ? 24 : 16,
                overflow: "hidden",
                flexShrink: 0,
                background: "rgba(255,255,255,0.07)",
                border: "3px solid rgba(255,255,255,0.12)",
                boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
              }}
            >
              {showPhoto ? (
                <img
                  src={avatarUrl!}
                  alt={player.name}
                  crossOrigin="anonymous"
                  onError={() => setImgError(true)}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'Clash Display', sans-serif",
                      fontSize: Math.round(avatarDisplaySize * 0.38),
                      fontWeight: 800,
                      color: "rgba(255,255,255,0.7)",
                    }}
                  >
                    {player.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                  </span>
                </div>
              )}
            </div>

            {/* Name + meta */}
            <div style={{ flex: 1, minWidth: 0, paddingBottom: forExport ? 8 : 4 }}>
              {/* Title chip */}
              {player.title && (
                <span
                  style={{
                    display: "inline-block",
                    fontSize: forExport ? 13 : 8,
                    fontWeight: 900,
                    padding: forExport ? "3px 10px" : "2px 6px",
                    borderRadius: 4,
                    background: "oklch(0.48 0.16 148)",
                    color: "white",
                    marginBottom: forExport ? 8 : 4,
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
                  fontSize: forExport ? 48 : 22,
                  fontWeight: 800,
                  color: "white",
                  lineHeight: 1.05,
                  marginBottom: forExport ? 8 : 4,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {flag} {player.name}
              </p>
              {/* Username · ELO */}
              <p
                style={{
                  fontSize: forExport ? 16 : 9,
                  color: "rgba(255,255,255,0.38)",
                  fontWeight: 500,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                @{player.username} · {player.elo} ELO
              </p>
            </div>

            {/* Rank hero — top right */}
            <div
              style={{
                flexShrink: 0,
                textAlign: "center",
                paddingBottom: forExport ? 8 : 4,
              }}
            >
              <p
                style={{
                  fontFamily: "'Clash Display', sans-serif",
                  fontSize: forExport ? 72 : 36,
                  fontWeight: 900,
                  lineHeight: 1,
                  color: "oklch(0.78 0.18 148)",
                }}
              >
                {ordinal}
              </p>
              <p
                style={{
                  fontSize: forExport ? 14 : 8,
                  color: "rgba(255,255,255,0.28)",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                of {totalPlayers}
              </p>
            </div>
          </div>

          {/* ── Divider ── */}
          <div style={{ height: 1, background: "rgba(255,255,255,0.08)", marginBottom: forExport ? 32 : 16 }} />

          {/* ── Stats grid: 3 columns ── */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: forExport ? 16 : 8,
              marginBottom: forExport ? 32 : 16,
            }}
          >
            <StatBlock label="Score" value={points} sub="pts" animDelay={0} forExport={forExport} />
            <StatBlock label="Performance" value={performanceRating} sub={`${ratingSign}${ratingChange}`} animDelay={100} forExport={forExport} />
            <StatBlock label="Streak" value={`${longestStreak}W`} sub="best run" animDelay={200} forExport={forExport} />
          </div>

          {/* ── W/D/L bar ── */}
          {total > 0 && (
            <div style={{ marginBottom: forExport ? 32 : 16 }}>
              <div
                style={{
                  display: "flex",
                  height: forExport ? 10 : 6,
                  borderRadius: 999,
                  overflow: "hidden",
                  gap: 2,
                  marginBottom: forExport ? 12 : 6,
                }}
              >
                {wins > 0 && <div style={{ width: `${wPct}%`, background: "#4CAF50", borderRadius: 999 }} />}
                {draws > 0 && <div style={{ width: `${dPct}%`, background: "rgba(255,255,255,0.22)", borderRadius: 999 }} />}
                {losses > 0 && <div style={{ width: `${lPct}%`, background: "rgba(239,68,68,0.55)", borderRadius: 999 }} />}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: forExport ? 16 : 10, fontWeight: 700, color: "#4CAF50" }}>{wins}W</span>
                <span style={{ fontSize: forExport ? 16 : 10, fontWeight: 700, color: "rgba(255,255,255,0.28)" }}>{draws}D</span>
                <span style={{ fontSize: forExport ? 16 : 10, fontWeight: 700, color: "rgba(239,68,68,0.55)" }}>{losses}L</span>
              </div>
            </div>
          )}

          {/* ── Footer: best win + buchholz ── */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              gap: forExport ? 24 : 12,
              paddingTop: forExport ? 24 : 12,
              borderTop: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            {bestWin ? (
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    fontSize: forExport ? 11 : 7,
                    fontWeight: 700,
                    color: "rgba(255,255,255,0.22)",
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                    marginBottom: forExport ? 5 : 2,
                  }}
                >
                  Best Win
                </p>
                <p
                  style={{
                    fontSize: forExport ? 18 : 11,
                    fontWeight: 700,
                    color: "rgba(255,255,255,0.65)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {bestWin.opponent.name}
                </p>
                <p style={{ fontSize: forExport ? 13 : 8, color: "rgba(255,255,255,0.28)" }}>
                  {bestWin.opponent.elo} ELO
                </p>
              </div>
            ) : <div />}
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <p
                style={{
                  fontSize: forExport ? 11 : 7,
                  fontWeight: 700,
                  color: "rgba(255,255,255,0.22)",
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                  marginBottom: forExport ? 5 : 2,
                }}
              >
                Buchholz
              </p>
              <p style={{ fontSize: forExport ? 18 : 11, fontWeight: 700, color: "rgba(255,255,255,0.55)" }}>
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
