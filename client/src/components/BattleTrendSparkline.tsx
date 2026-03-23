/**
 * BattleTrendSparkline.tsx
 * SVG area-chart sparkline showing weekly battle activity over the last N weeks.
 * Features: smooth cardinal spline, area fill, hover crosshair + tooltip, trend badge.
 */

import { useState, useCallback } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { WeekBucket } from "@/lib/battleTrend";
import { computeTrendDelta } from "@/lib/battleTrend";

// ─── SVG geometry helpers ─────────────────────────────────────────────────────

const W = 560;
const H = 120;
const PAD_X = 4;
const PAD_Y = 12;

function ratingToY(value: number, min: number, max: number): number {
  if (max === min) return H / 2;
  return PAD_Y + ((max - value) / (max - min)) * (H - PAD_Y * 2);
}

function pointsToCardinalSpline(
  pts: { x: number; y: number }[],
  tension = 0.4
): string {
  if (pts.length < 2) return pts.map((p) => `${p.x},${p.y}`).join(" ");
  const cmds: string[] = [`M ${pts[0].x} ${pts[0].y}`];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(i + 2, pts.length - 1)];
    const cp1x = p1.x + ((p2.x - p0.x) * tension) / 2;
    const cp1y = p1.y + ((p2.y - p0.y) * tension) / 2;
    const cp2x = p2.x - ((p3.x - p1.x) * tension) / 2;
    const cp2y = p2.y - ((p3.y - p1.y) * tension) / 2;
    cmds.push(`C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`);
  }
  return cmds.join(" ");
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  buckets: WeekBucket[];
  accent?: string;
}

export default function BattleTrendSparkline({
  buckets,
  accent = "#4ade80",
}: Props) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  const hasData = buckets.some((b) => b.total > 0);
  const maxVal = Math.max(...buckets.map((b) => b.total), 1);
  const minVal = 0;

  const stepX = buckets.length > 1 ? (W - PAD_X * 2) / (buckets.length - 1) : W / 2;
  const pts = buckets.map((b, i) => ({
    x: PAD_X + i * stepX,
    y: ratingToY(b.total, minVal, maxVal),
  }));

  const linePath = pointsToCardinalSpline(pts);
  const areaPath =
    pts.length > 0
      ? `${linePath} L ${pts[pts.length - 1].x} ${H} L ${pts[0].x} ${H} Z`
      : "";

  const trendDelta = computeTrendDelta(buckets);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const mouseX = ((e.clientX - rect.left) / rect.width) * W;
      let closest = 0;
      let minDist = Infinity;
      pts.forEach((p, i) => {
        const d = Math.abs(p.x - mouseX);
        if (d < minDist) {
          minDist = d;
          closest = i;
        }
      });
      setActiveIdx(closest);
    },
    [pts]
  );

  const activeBucket = activeIdx !== null ? buckets[activeIdx] : null;
  const activePt = activeIdx !== null ? pts[activeIdx] : null;

  // Tooltip x flip when near right edge
  const tooltipX =
    activePt !== null
      ? activePt.x > W * 0.7
        ? activePt.x - 110
        : activePt.x + 10
      : 0;
  const tooltipY = activePt !== null ? Math.max(activePt.y - 36, 2) : 0;

  return (
    <div className="w-full">
      {/* Trend badge row */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs text-white/50">8-week trend</span>
        {trendDelta !== null ? (
          <span
            className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full"
            style={{
              background:
                trendDelta > 0
                  ? "rgba(74,222,128,0.12)"
                  : trendDelta < 0
                  ? "rgba(248,113,113,0.12)"
                  : "rgba(255,255,255,0.06)",
              color:
                trendDelta > 0
                  ? "#4ade80"
                  : trendDelta < 0
                  ? "#f87171"
                  : "rgba(255,255,255,0.4)",
            }}
          >
            {trendDelta > 0 ? (
              <TrendingUp className="w-3 h-3" />
            ) : trendDelta < 0 ? (
              <TrendingDown className="w-3 h-3" />
            ) : (
              <Minus className="w-3 h-3" />
            )}
            {trendDelta > 0 ? "+" : ""}
            {trendDelta}% vs prior 4 weeks
          </span>
        ) : (
          <span className="text-[11px] text-white/20">Not enough data</span>
        )}
        {activeBucket && (
          <span className="ml-auto text-[11px] text-white/60">
            <span className="font-bold text-white">{activeBucket.total}</span>{" "}
            battles · week of {activeBucket.label}
          </span>
        )}
      </div>

      {/* SVG sparkline */}
      {!hasData ? (
        <div className="flex items-center justify-center h-[120px] rounded-xl bg-white/3 border border-white/5">
          <p className="text-white/20 text-xs">No battle data yet</p>
        </div>
      ) : (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-[120px] overflow-visible cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setActiveIdx(null)}
        >
          <defs>
            <linearGradient id="trendAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accent} stopOpacity="0.25" />
              <stop offset="100%" stopColor={accent} stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Horizontal grid lines */}
          {[0.25, 0.5, 0.75, 1].map((frac) => {
            const y = PAD_Y + frac * (H - PAD_Y * 2);
            const val = Math.round(maxVal * (1 - frac));
            return (
              <g key={frac}>
                <line
                  x1={PAD_X}
                  y1={y}
                  x2={W - PAD_X}
                  y2={y}
                  stroke="rgba(255,255,255,0.05)"
                  strokeWidth="1"
                />
                <text
                  x={W - PAD_X + 4}
                  y={y + 4}
                  fontSize="9"
                  fill="rgba(255,255,255,0.2)"
                  textAnchor="start"
                >
                  {val}
                </text>
              </g>
            );
          })}

          {/* Area fill */}
          <path d={areaPath} fill="url(#trendAreaGrad)" />

          {/* Line */}
          <path
            d={linePath}
            fill="none"
            stroke={accent}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Week label ticks (every 2nd label to avoid crowding) */}
          {buckets.map((b, i) => {
            if (i % 2 !== 0) return null;
            return (
              <text
                key={i}
                x={pts[i].x}
                y={H + 14}
                fontSize="9"
                fill="rgba(255,255,255,0.25)"
                textAnchor="middle"
              >
                {b.label}
              </text>
            );
          })}

          {/* Dots */}
          {pts.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={activeIdx === i ? 4.5 : 2.5}
              fill={activeIdx === i ? accent : "rgba(74,222,128,0.6)"}
              stroke={activeIdx === i ? "rgba(0,0,0,0.4)" : "none"}
              strokeWidth="1"
              style={{ transition: "r 0.1s ease" }}
            />
          ))}

          {/* Invisible enlarged hit targets */}
          {pts.map((p, i) => (
            <circle
              key={`hit-${i}`}
              cx={p.x}
              cy={p.y}
              r={18}
              fill="transparent"
            />
          ))}

          {/* Crosshair + tooltip */}
          {activePt && activeBucket && (
            <g>
              <line
                x1={activePt.x}
                y1={PAD_Y}
                x2={activePt.x}
                y2={H}
                stroke={accent}
                strokeWidth="1"
                strokeDasharray="3 3"
                opacity="0.4"
              />
              {/* Tooltip box */}
              <foreignObject
                x={tooltipX}
                y={tooltipY}
                width="108"
                height="52"
                style={{ overflow: "visible" }}
              >
                <div
                  style={{
                    background: "rgba(10,25,18,0.92)",
                    border: `1px solid ${accent}33`,
                    borderRadius: "8px",
                    padding: "6px 8px",
                    backdropFilter: "blur(8px)",
                    fontSize: "11px",
                    color: "rgba(255,255,255,0.8)",
                    lineHeight: 1.4,
                    whiteSpace: "nowrap",
                  }}
                >
                  <div style={{ fontWeight: 700, color: accent }}>
                    {activeBucket.total} battles
                  </div>
                  <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "10px" }}>
                    {activeBucket.label}
                  </div>
                  <div style={{ display: "flex", gap: "6px", marginTop: "2px", fontSize: "10px" }}>
                    <span style={{ color: "#4ade80" }}>{activeBucket.wins}W</span>
                    <span style={{ color: "#fbbf24" }}>{activeBucket.draws}D</span>
                    <span style={{ color: "rgba(248,113,113,0.8)" }}>{activeBucket.losses}L</span>
                  </div>
                </div>
              </foreignObject>
            </g>
          )}
        </svg>
      )}
    </div>
  );
}
