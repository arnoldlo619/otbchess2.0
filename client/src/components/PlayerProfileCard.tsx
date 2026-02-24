/**
 * OTB Chess — PlayerProfileCard
 *
 * A rich floating profile tooltip that appears on hover over any player name
 * in the Director Dashboard. Shows:
 *   - Avatar (chess.com photo / Lichess flair / initials)
 *   - Name, title, country flag, platform badge
 *   - ELO rating + points in this tournament
 *   - W / D / L record as a mini bar chart
 *   - Color history (W/B chips for each round played)
 *   - Buchholz tiebreak score
 *   - Rating history sparkline (last 10 rated games, live from API)
 *   - "New" badge if joined in the last 5 minutes
 *
 * Usage:
 *   <PlayerHoverCard player={player} isDark={isDark}>
 *     <span>{player.name}</span>
 *   </PlayerHoverCard>
 *
 * The card auto-flips left/right and up/down to stay within the viewport.
 */

import { useState, useRef, useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { FLAG_EMOJI } from "@/lib/tournamentData";
import type { Player } from "@/lib/tournamentData";
import { useRatingHistory, type RatingPoint, type TimeControl } from "@/hooks/useRatingHistory";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function PlatformBadge({ platform }: { platform?: "chesscom" | "lichess" }) {
  if (!platform) return null;
  return platform === "lichess" ? (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-500">
      <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 fill-current">
        <path d="M19 22H5v-2h14v2M13 2a5 5 0 0 1 5 5c0 1.64-.8 3.09-2.03 4L17 13H7l1.03-2C6.8 10.09 6 8.64 6 7a5 5 0 0 1 5-5h2m0 2h-2a3 3 0 0 0-3 3c0 1.12.61 2.1 1.5 2.63L9.5 11h5l-.5-2.37A3 3 0 0 0 15.5 7a3 3 0 0 0-2.5-3z" />
      </svg>
      Lichess
    </span>
  ) : (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#81b64c]/15 text-[#3D6B47]">
      <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 fill-current">
        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
      </svg>
      chess.com
    </span>
  );
}

function ColorChip({ color }: { color: "W" | "B" }) {
  return (
    <div
      className={`w-5 h-5 rounded-sm border text-[9px] font-bold flex items-center justify-center ${
        color === "W"
          ? "bg-white border-gray-300 text-gray-500"
          : "bg-gray-800 border-gray-600 text-gray-300"
      }`}
    >
      {color}
    </div>
  );
}

// ─── Sparkline ────────────────────────────────────────────────────────────────

interface SparklineProps {
  points: RatingPoint[];
  width?: number;
  height?: number;
  isDark: boolean;
}

/** Format a Unix-ms timestamp as "Mon DD" (e.g. "Feb 18") */
function formatDate(ms: number): string {
  if (!ms) return "Unknown date";
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function Sparkline({ points, width = 224, height = 44, isDark }: SparklineProps) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  if (points.length < 2) return null;

  const ratings = points.map((p) => p.rating);
  const minR = Math.min(...ratings);
  const maxR = Math.max(...ratings);
  const range = maxR - minR || 1;

  const padX = 4;
  const padY = 6;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  // Map each point to SVG coordinates
  const coords = points.map((p, i) => ({
    x: padX + (i / (points.length - 1)) * innerW,
    y: padY + (1 - (p.rating - minR) / range) * innerH,
    result: p.result,
    rating: p.rating,
    date: p.date,
  }));

  // Build smooth polyline path using cardinal spline approximation
  function smoothPath(pts: { x: number; y: number }[]): string {
    if (pts.length < 2) return "";
    let d = `M ${pts[0].x},${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const cp1x = pts[i].x + (pts[i + 1].x - (pts[i - 1]?.x ?? pts[i].x)) / 6;
      const cp1y = pts[i].y + (pts[i + 1].y - (pts[i - 1]?.y ?? pts[i].y)) / 6;
      const cp2x = pts[i + 1].x - (pts[i + 2]?.x ?? pts[i + 1].x - pts[i].x + pts[i + 1].x - pts[i].x) / 6;
      const cp2y = pts[i + 1].y - (pts[i + 2]?.y ?? pts[i + 1].y - pts[i].y + pts[i + 1].y - pts[i].y) / 6;
      d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${pts[i + 1].x},${pts[i + 1].y}`;
    }
    return d;
  }

  // Area fill path (close at bottom)
  function areaPath(pts: { x: number; y: number }[]): string {
    const line = smoothPath(pts);
    return `${line} L ${pts[pts.length - 1].x},${padY + innerH} L ${pts[0].x},${padY + innerH} Z`;
  }

  const linePath = smoothPath(coords);
  const fillPath = areaPath(coords);

  // Trend: compare last point to first
  const trend = ratings[ratings.length - 1] - ratings[0];
  const lineColor =
    trend > 0 ? "#22c55e" : trend < 0 ? "#f87171" : isDark ? "#6b7280" : "#9ca3af";
  // Stable fill gradient ID (no random — avoids re-render flicker)
  const fillId = "spark-fill-static";

  // Last point for the endpoint dot
  const last = coords[coords.length - 1];

  // Tooltip for the active dot
  const activeDot = activeIdx !== null ? coords[activeIdx] : null;
  const activePoint = activeIdx !== null ? points[activeIdx] : null;

  // Tooltip positioning — flip left if near right edge
  const TOOLTIP_W = 80;
  const tooltipX = activeDot
    ? activeDot.x + TOOLTIP_W > width
      ? activeDot.x - TOOLTIP_W - 4
      : activeDot.x + 6
    : 0;
  const tooltipY = activeDot ? Math.max(0, activeDot.y - 28) : 0;

  const tooltipBg = isDark ? "#1a2e1f" : "#ffffff";
  const tooltipBorder = isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.10)";
  const tooltipText = isDark ? "#ffffff" : "#111827";
  const tooltipSub = isDark ? "rgba(255,255,255,0.45)" : "#6b7280";

  const resultLabel =
    activePoint?.result === "win"
      ? "Win"
      : activePoint?.result === "loss"
      ? "Loss"
      : "Draw";
  const resultColor =
    activePoint?.result === "win"
      ? "#22c55e"
      : activePoint?.result === "loss"
      ? "#f87171"
      : isDark
      ? "#60a5fa"
      : "#3b82f6";

  return (
    <div className="relative" style={{ width, height: height + 2 }}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="overflow-visible block"
        onMouseLeave={() => setActiveIdx(null)}
        aria-label="Rating history sparkline"
      >
        <defs>
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity="0.25" />
            <stop offset="100%" stopColor={lineColor} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Area fill */}
        <path d={fillPath} fill={`url(#${fillId})`} />

        {/* Line */}
        <path
          d={linePath}
          fill="none"
          stroke={lineColor}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Vertical crosshair on active dot */}
        {activeDot && (
          <line
            x1={activeDot.x}
            y1={padY}
            x2={activeDot.x}
            y2={padY + innerH}
            stroke={isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.10)"}
            strokeWidth="1"
            strokeDasharray="2 2"
          />
        )}

        {/* Result dots on each data point */}
        {coords.map((c, i) => {
          const isActive = i === activeIdx;
          const dotColor =
            c.result === "win"
              ? "#22c55e"
              : c.result === "loss"
              ? "#f87171"
              : isDark
              ? "#60a5fa"
              : "#3b82f6";
          return (
            <g key={i}>
              {/* Visible dot */}
              <circle
                cx={c.x}
                cy={c.y}
                r={isActive ? 4 : i === coords.length - 1 ? 3 : 2}
                fill={dotColor}
                stroke={isDark ? "#1a2e1f" : "#ffffff"}
                strokeWidth={isActive ? 1.5 : 1}
                style={{ transition: "r 0.1s ease" }}
              />
              {/* Invisible enlarged hit target */}
              <circle
                cx={c.x}
                cy={c.y}
                r={10}
                fill="transparent"
                onMouseEnter={() => setActiveIdx(i)}
                style={{ cursor: "crosshair" }}
              />
            </g>
          );
        })}

        {/* Endpoint rating label (hidden when a dot is active) */}
        {activeIdx === null && (
          <text
            x={last.x + 5}
            y={last.y + 4}
            fontSize="9"
            fontWeight="600"
            fill={lineColor}
            className="tabular-nums"
          >
            {last.rating}
          </text>
        )}

        {/* Floating tooltip rendered inside SVG as a foreignObject */}
        {activeDot && activePoint && (
          <foreignObject
            x={tooltipX}
            y={tooltipY}
            width={TOOLTIP_W}
            height={44}
            style={{ overflow: "visible", pointerEvents: "none" }}
          >
            <div
              style={{
                background: tooltipBg,
                border: `1px solid ${tooltipBorder}`,
                borderRadius: 8,
                padding: "4px 7px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.18)",
                whiteSpace: "nowrap",
                display: "inline-block",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: tooltipText,
                  fontVariantNumeric: "tabular-nums",
                  lineHeight: 1.3,
                }}
              >
                {activeDot.rating}
              </div>
              <div
                style={{
                  fontSize: 9.5,
                  color: tooltipSub,
                  lineHeight: 1.3,
                }}
              >
                {formatDate(activePoint.date)}
              </div>
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 600,
                  color: resultColor,
                  lineHeight: 1.3,
                }}
              >
                {resultLabel}
              </div>
            </div>
          </foreignObject>
        )}
      </svg>
    </div>
  );
}

// ─── Sparkline shimmer skeleton ───────────────────────────────────────────────

function SparklineSkeleton({ isDark }: { isDark: boolean }) {
  return (
    <div
      className={`h-11 rounded-lg animate-pulse ${
        isDark ? "bg-white/05" : "bg-gray-100"
      }`}
    />
  );
}

// ─── Time-control pill toggle ────────────────────────────────────────────────────

const TC_PILLS: { label: string; value: TimeControl }[] = [
  { label: "All", value: "all" },
  { label: "Rapid", value: "rapid" },
  { label: "Blitz", value: "blitz" },
  { label: "Bullet", value: "bullet" },
];

function TCPill({
  label,
  active,
  isDark,
  onClick,
}: {
  label: string;
  active: boolean;
  isDark: boolean;
  onClick: () => void;
}) {
  const base = "text-[9px] font-semibold px-1.5 py-0.5 rounded-full cursor-pointer transition-all select-none";
  const activeStyle = "bg-[#3D6B47] text-white";
  const inactiveStyle = isDark
    ? "bg-white/08 text-white/50 hover:bg-white/15 hover:text-white/80"
    : "bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600";
  return (
    <button
      type="button"
      className={`${base} ${active ? activeStyle : inactiveStyle}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

// ─── Sparkline section (with hook) ───────────────────────────────────────────────

function SparklineSection({
  player,
  isDark,
  visible,
}: {
  player: Player;
  isDark: boolean;
  visible: boolean;
}) {
  const [tc, setTc] = useState<TimeControl>("all");
  const platform = player.platform ?? "chesscom";
  const { status, points } = useRatingHistory({
    username: player.username,
    platform,
    count: 10,
    timeControl: tc,
    enabled: visible && !!player.username,
  });

  const textSub = isDark ? "text-white/40" : "text-gray-400";
  const divider = isDark ? "border-white/08" : "border-gray-100";

  // Don't render the section at all if there's an error and no data
  if (status === "error") return null;

  // Compute trend label from filtered points
  let trendLabel = "";
  let trendColor = textSub;
  if (points.length >= 2) {
    const delta = points[points.length - 1].rating - points[0].rating;
    if (delta > 0) {
      trendLabel = `+${delta}`;
      trendColor = "text-emerald-500";
    } else if (delta < 0) {
      trendLabel = `${delta}`;
      trendColor = "text-red-400";
    } else {
      trendLabel = "±0";
    }
  }

  return (
    <div className={`px-4 pb-4 border-t ${divider} pt-3`}>
      {/* Header row: label + trend badge */}
      <div className="flex items-center justify-between mb-2">
        <p className={`text-[10px] uppercase tracking-wider font-semibold ${textSub}`}>
          Rating History
        </p>
        {trendLabel && (
          <span className={`text-[10px] font-bold tabular-nums ${trendColor}`}>
            {trendLabel} last 10
          </span>
        )}
      </div>

      {/* Time-control pill row */}
      <div className="flex items-center gap-1 mb-2">
        {TC_PILLS.map((pill) => (
          <TCPill
            key={pill.value}
            label={pill.label}
            active={tc === pill.value}
            isDark={isDark}
            onClick={() => setTc(pill.value)}
          />
        ))}
      </div>

      {status === "loading" && <SparklineSkeleton isDark={isDark} />}

      {status === "success" && points.length >= 2 && (
        <Sparkline points={points} isDark={isDark} />
      )}

      {status === "success" && points.length < 2 && (
        <p className={`text-[10px] ${textSub} italic`}>
          {tc === "all"
            ? "Not enough rated games to display"
            : `No ${tc} games in the last 10 games`}
        </p>
      )}
    </div>
  );
}

// ─── Card Content ─────────────────────────────────────────────────────────────

function CardContent({
  player,
  isDark,
  visible,
}: {
  player: Player;
  isDark: boolean;
  visible: boolean;
}) {
  const total = player.wins + player.draws + player.losses;
  const winPct = total > 0 ? (player.wins / total) * 100 : 0;
  const drawPct = total > 0 ? (player.draws / total) * 100 : 0;
  const lossPct = total > 0 ? (player.losses / total) * 100 : 0;
  const isNew = player.joinedAt ? Date.now() - player.joinedAt < 5 * 60 * 1000 : false;

  const bg = isDark
    ? "bg-[oklch(0.22_0.06_145)] border-white/10"
    : "bg-white border-gray-200";
  const textMain = isDark ? "text-white" : "text-gray-900";
  const textSub = isDark ? "text-white/40" : "text-gray-400";
  const divider = isDark ? "border-white/08" : "border-gray-100";
  const statBg = isDark ? "bg-white/05" : "bg-gray-50";

  return (
    <div
      className={`rounded-2xl border shadow-2xl overflow-hidden w-64 ${bg}`}
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      {/* Header — avatar + name + badges */}
      <div className={`px-4 pt-4 pb-3 border-b ${divider}`}>
        <div className="flex items-start gap-3">
          <PlayerAvatar
            username={player.username}
            name={player.name}
            platform={player.platform}
            avatarUrl={player.avatarUrl}
            flairEmoji={player.flairEmoji}
            size={48}
            showBadge
            className="rounded-xl flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              {player.title && (
                <span className="text-xs font-bold text-[#3D6B47] bg-[#3D6B47]/10 px-1.5 py-0.5 rounded">
                  {player.title}
                </span>
              )}
              {isNew && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-500 animate-pulse">
                  NEW
                </span>
              )}
            </div>
            <p
              className={`text-sm font-bold leading-tight mt-0.5 truncate ${textMain}`}
              style={{ fontFamily: "'Clash Display', sans-serif" }}
            >
              {player.name}
            </p>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <span className="text-xs">{FLAG_EMOJI[player.country]}</span>
              <span className={`text-xs ${textSub}`}>@{player.username}</span>
              <PlatformBadge platform={player.platform} />
            </div>
          </div>
        </div>
      </div>

      {/* ELO + Points row */}
      <div className={`grid grid-cols-2 divide-x ${isDark ? "divide-white/08" : "divide-gray-100"}`}>
        <div className={`px-4 py-3 ${statBg}`}>
          <p className={`text-[10px] uppercase tracking-wider font-semibold ${textSub}`}>ELO</p>
          <p className={`text-xl font-bold tabular-nums ${textMain}`}>{player.elo}</p>
        </div>
        <div className={`px-4 py-3 ${statBg}`}>
          <p className={`text-[10px] uppercase tracking-wider font-semibold ${textSub}`}>Points</p>
          <p className={`text-xl font-bold tabular-nums text-[#3D6B47]`}>{player.points}</p>
        </div>
      </div>

      {/* W / D / L record */}
      <div className={`px-4 py-3 border-t ${divider}`}>
        <p className={`text-[10px] uppercase tracking-wider font-semibold mb-2 ${textSub}`}>
          Record
        </p>
        {/* Bar */}
        {total > 0 && (
          <div className="flex h-1.5 rounded-full overflow-hidden mb-2">
            {winPct > 0 && (
              <div className="bg-emerald-500 transition-all" style={{ width: `${winPct}%` }} />
            )}
            {drawPct > 0 && (
              <div className="bg-blue-400 transition-all" style={{ width: `${drawPct}%` }} />
            )}
            {lossPct > 0 && (
              <div className="bg-red-400 transition-all" style={{ width: `${lossPct}%` }} />
            )}
          </div>
        )}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
            <span className={`text-xs font-semibold ${textMain}`}>{player.wins}W</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
            <span className={`text-xs font-semibold ${textMain}`}>{player.draws}D</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
            <span className={`text-xs font-semibold ${textMain}`}>{player.losses}L</span>
          </div>
          <div className="ml-auto">
            <span className={`text-[10px] ${textSub}`}>
              Buch. <span className={`font-semibold ${textMain}`}>{player.buchholz.toFixed(1)}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Color history */}
      {player.colorHistory.length > 0 && (
        <div className={`px-4 pb-4 border-t ${divider} pt-3`}>
          <p className={`text-[10px] uppercase tracking-wider font-semibold mb-2 ${textSub}`}>
            Colors
          </p>
          <div className="flex items-center gap-1">
            {player.colorHistory.map((c, i) => (
              <ColorChip key={i} color={c} />
            ))}
            {/* Next color prediction */}
            {player.colorHistory.length > 0 && (
              <>
                <span className={`text-[10px] mx-1 ${textSub}`}>→</span>
                <div
                  className={`w-5 h-5 rounded-sm border-2 border-dashed text-[9px] font-bold flex items-center justify-center opacity-50 ${
                    player.colorHistory[player.colorHistory.length - 1] === "W"
                      ? "border-gray-600 text-gray-400"
                      : "border-gray-300 text-gray-500"
                  }`}
                >
                  {player.colorHistory[player.colorHistory.length - 1] === "W" ? "B" : "W"}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Rating history sparkline */}
      {player.username && (
        <SparklineSection player={player} isDark={isDark} visible={visible} />
      )}
    </div>
  );
}

// ─── Hover Wrapper ────────────────────────────────────────────────────────────

interface PlayerHoverCardProps {
  player: Player;
  isDark: boolean;
  children: ReactNode;
  /** Extra classes on the trigger wrapper */
  className?: string;
  /** Disable the hover card (e.g. on touch devices) */
  disabled?: boolean;
}

export function PlayerHoverCard({
  player,
  isDark,
  children,
  className = "",
  disabled = false,
}: PlayerHoverCardProps) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Detect touch device — disable hover card on touch
  const isTouchDevice =
    typeof window !== "undefined" &&
    (navigator.maxTouchPoints > 0 || "ontouchstart" in window);

  function computePosition() {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const cardW = 256; // w-64
    const cardH = 420; // approximate (taller now with sparkline)
    const gap = 8;

    // Default: below and aligned to left of trigger
    let top = rect.bottom + gap + window.scrollY;
    let left = rect.left + window.scrollX;

    // Flip right if card would overflow right edge
    if (left + cardW > window.innerWidth - 16) {
      left = rect.right + window.scrollX - cardW;
    }
    // Flip up if card would overflow bottom
    if (rect.bottom + gap + cardH > window.innerHeight) {
      top = rect.top - cardH - gap + window.scrollY;
    }
    // Clamp left to viewport
    left = Math.max(8, Math.min(left, window.innerWidth - cardW - 8));

    setPos({ top, left });
  }

  function handleMouseEnter() {
    if (disabled || isTouchDevice) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    computePosition();
    timerRef.current = setTimeout(() => setVisible(true), 180);
  }

  function handleMouseLeave() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setVisible(false), 120);
  }

  function handleCardMouseEnter() {
    if (timerRef.current) clearTimeout(timerRef.current);
  }

  function handleCardMouseLeave() {
    timerRef.current = setTimeout(() => setVisible(false), 120);
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <>
      <div
        ref={triggerRef}
        className={`inline-flex ${className}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {children}
      </div>

      {visible &&
        createPortal(
          <div
            ref={cardRef}
            className="fixed z-[9999] pointer-events-auto"
            style={{
              top: pos.top,
              left: pos.left,
              animation: "profileCardIn 0.15s cubic-bezier(0.16, 1, 0.3, 1) forwards",
            }}
            onMouseEnter={handleCardMouseEnter}
            onMouseLeave={handleCardMouseLeave}
          >
            <CardContent player={player} isDark={isDark} visible={visible} />
          </div>,
          document.body
        )}
    </>
  );
}
