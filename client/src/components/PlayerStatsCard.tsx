/**
 * OTB Chess — Player Stats Card v5 (Accent-Customisable Portrait)
 *
 * v5 changes:
 * - New `accentColor` prop (hex string) replaces all hardcoded green accent
 *   values so the card can be personalised before export/share.
 * - Accent is applied to: rank ordinal, score stat, W bar, title chip,
 *   brand logo background, and the header glow when no badge glow exists.
 * - Defaults to the badge's own textColor so the card looks great out of
 *   the box without any user interaction.
 *
 * Original features:
 * - Full-width tall card with blurred avatar header zone
 * - Large avatar overlapping header/body boundary
 * - Large readable name — no overflow
 * - Clean stat grid with generous spacing
 * - Animated stat counters on mount
 * - Exportable as PNG via html2canvas
 */
import { forwardRef, useState, useEffect } from "react";
import type { PlayerPerformance } from "@/lib/performanceStats";
import { FLAG_EMOJI } from "@/lib/tournamentData";

// ─── Accent palette ───────────────────────────────────────────────────────────
/** Curated palette exposed to the Report page color picker. */
export interface AccentSwatch {
  id: string;
  label: string;
  hex: string;
  /** Subtle glow used in the header gradient */
  glow: string;
}

export const ACCENT_PALETTE: AccentSwatch[] = [
  { id: "green",  label: "Forest",  hex: "#4CAF50", glow: "rgba(76,175,80,0.18)"   },
  { id: "gold",   label: "Gold",    hex: "#F59E0B", glow: "rgba(245,158,11,0.18)"  },
  { id: "purple", label: "Royal",   hex: "#A78BFA", glow: "rgba(167,139,250,0.18)" },
  { id: "blue",   label: "Ocean",   hex: "#60A5FA", glow: "rgba(96,165,250,0.18)"  },
  { id: "rose",   label: "Rose",    hex: "#FB7185", glow: "rgba(251,113,133,0.18)" },
  { id: "teal",   label: "Teal",    hex: "#2DD4BF", glow: "rgba(45,212,191,0.18)"  },
  { id: "orange", label: "Ember",   hex: "#FB923C", glow: "rgba(251,146,60,0.18)"  },
  { id: "silver", label: "Silver",  hex: "#94A3B8", glow: "rgba(148,163,184,0.14)" },
];

/** Default accent for a given badge — matches the badge's textColor. */
export function defaultAccentForBadge(badge: string): string {
  const map: Record<string, string> = {
    champion:      "#F59E0B",
    runner_up:     "#94A3B8",
    third_place:   "#EA580C",
    perfect_score: "#34D399",
    giant_killer:  "#A78BFA",
    iron_wall:     "#60A5FA",
    comeback:      "#FB7185",
    consistent:    "#2DD4BF",
    participant:   "#4CAF50",
  };
  return map[badge] ?? "#4CAF50";
}

/** Convert a hex colour to an rgba glow string at a given opacity. */
export function hexToGlow(hex: string, alpha = 0.18): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return `rgba(76,175,80,${alpha})`;
  return `rgba(${r},${g},${b},${alpha})`;
}

// ─── Badge config (for badge pill only — accent is now separate) ──────────────
const BADGE_CONFIG: Record<string, { color: string; textColor: string }> = {
  champion:      { color: "rgba(245,158,11,0.20)",  textColor: "#F59E0B" },
  runner_up:     { color: "rgba(148,163,184,0.20)", textColor: "#94A3B8" },
  third_place:   { color: "rgba(234,88,12,0.20)",   textColor: "#EA580C" },
  perfect_score: { color: "rgba(52,211,153,0.20)",  textColor: "#34D399" },
  giant_killer:  { color: "rgba(139,92,246,0.20)",  textColor: "#A78BFA" },
  iron_wall:     { color: "rgba(59,130,246,0.20)",  textColor: "#60A5FA" },
  comeback:      { color: "rgba(244,63,94,0.20)",   textColor: "#FB7185" },
  consistent:    { color: "rgba(20,184,166,0.20)",  textColor: "#2DD4BF" },
  participant:   { color: "rgba(255,255,255,0.08)", textColor: "rgba(255,255,255,0.45)" },
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
  accentColor,
  animDelay,
  forExport,
}: {
  label: string;
  value: number | string;
  sub?: string;
  accent?: boolean;
  accentColor?: string;
  animDelay?: number;
  forExport?: boolean;
}) {
  const numericTarget = typeof value === "number" ? value : parseFloat(String(value)) || 0;
  const animated = useAnimatedValue(numericTarget, 900, animDelay ?? 0);
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
          color: accent && accentColor ? accentColor : "white",
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
  /** Hex accent color — defaults to the badge's own color */
  accentColor?: string;
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
      accentColor: accentColorProp,
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

    // Resolve the effective accent color
    const accentColor = accentColorProp ?? defaultAccentForBadge(badge);
    const accentGlow = hexToGlow(accentColor, 0.18);

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
            background: `radial-gradient(ellipse at 50% 0%, ${accentGlow} 0%, transparent 70%)`,
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
                  background: accentColor,
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
                OTBchess.club
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
                border: `3px solid ${accentColor}50`,
                boxShadow: `0 4px 20px rgba(0,0,0,0.4), 0 0 0 1px ${accentColor}20`,
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
                    background: accentColor,
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
                  color: accentColor,
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
            <StatBlock label="Score" value={points} sub="pts" accent accentColor={accentColor} animDelay={0} forExport={forExport} />
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
                {wins > 0 && <div style={{ width: `${wPct}%`, background: accentColor, borderRadius: 999 }} />}
                {draws > 0 && <div style={{ width: `${dPct}%`, background: "rgba(255,255,255,0.22)", borderRadius: 999 }} />}
                {losses > 0 && <div style={{ width: `${lPct}%`, background: "rgba(239,68,68,0.55)", borderRadius: 999 }} />}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: forExport ? 16 : 10, fontWeight: 700, color: accentColor }}>{wins}W</span>
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
