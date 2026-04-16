/**
 * RatingProgressChart
 *
 * A detailed, full-width interactive chart showing the user's chess.com rating
 * history per format (Rapid / Blitz / Bullet).
 *
 * Features:
 *   - Format tabs (Rapid / Blitz / Bullet) — only shows tabs for formats with data
 *   - Full SVG line chart with area fill, axis labels (Y: rating, X: date), and grid lines
 *   - Interactive hover: crosshair line, highlighted dot, tooltip with exact rating + date
 *   - Empty state when no history exists yet
 *   - Adapts to dark / light theme via `isDark` prop
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { TrendingUp, TrendingDown, Minus, Loader2 } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface HistoryRow {
  format: string;
  rating: number;
  recordedAt: string;
}

interface FormatData {
  ratings: number[];
  dates: string[];
}

type FormatKey = "rapid" | "blitz" | "bullet";

const FORMAT_META: Record<FormatKey, { label: string; icon: string; color: string; fill: string }> = {
  rapid:  { label: "Rapid",  icon: "♟",  color: "#4ade80", fill: "rgba(74,222,128,0.10)"  },
  blitz:  { label: "Blitz",  icon: "⚡", color: "#60a5fa", fill: "rgba(96,165,250,0.10)"  },
  bullet: { label: "Bullet", icon: "•",  color: "#f472b6", fill: "rgba(244,114,182,0.10)" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDateShort(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

function formatDateFull(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return iso;
  }
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface RatingProgressChartProps {
  isDark?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────
export function RatingProgressChart({ isDark = true }: RatingProgressChartProps) {
  const [data, setData] = useState<Record<FormatKey, FormatData>>({
    rapid:  { ratings: [], dates: [] },
    blitz:  { ratings: [], dates: [] },
    bullet: { ratings: [], dates: [] },
  });
  const [loading, setLoading] = useState(true);
  const [activeFormat, setActiveFormat] = useState<FormatKey>("rapid");
  const [hovered, setHovered] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(500);

  // Fetch rating history
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/rating-history", { credentials: "include" });
        if (!res.ok || cancelled) return;
        const json = await res.json() as { history: HistoryRow[] };
        const rapid:  FormatData = { ratings: [], dates: [] };
        const blitz:  FormatData = { ratings: [], dates: [] };
        const bullet: FormatData = { ratings: [], dates: [] };
        // Rows come newest-first; reverse for chronological order
        const sorted = [...json.history].reverse();
        for (const row of sorted) {
          if (row.format === "rapid")  { rapid.ratings.push(row.rating);  rapid.dates.push(row.recordedAt); }
          if (row.format === "blitz")  { blitz.ratings.push(row.rating);  blitz.dates.push(row.recordedAt); }
          if (row.format === "bullet") { bullet.ratings.push(row.rating); bullet.dates.push(row.recordedAt); }
        }
        if (!cancelled) {
          setData({ rapid, blitz, bullet });
          // Auto-select the first format that has data
          const firstWithData = (["rapid", "blitz", "bullet"] as FormatKey[]).find(
            (f) => ({ rapid, blitz, bullet }[f].ratings.length > 0
          ));
          if (firstWithData) setActiveFormat(firstWithData);
        }
      } catch {
        // Silently ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Responsive chart width
  const measureWidth = useCallback(() => {
    if (containerRef.current) {
      setChartWidth(containerRef.current.clientWidth);
    }
  }, []);

  useEffect(() => {
    measureWidth();
    const ro = new ResizeObserver(measureWidth);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [measureWidth]);

  const current = data[activeFormat];
  const { ratings, dates } = current;
  const meta = FORMAT_META[activeFormat];

  // Chart geometry
  const H        = 180;
  const padLeft  = 44;
  const padRight = 12;
  const padTop   = 16;
  const padBot   = 36;
  const W        = chartWidth;
  const innerW   = W - padLeft - padRight;
  const innerH   = H - padTop - padBot;

  const hasData = ratings.length >= 2;
  const minR    = hasData ? Math.min(...ratings) - 20 : 0;
  const maxR    = hasData ? Math.max(...ratings) + 20 : 100;
  const rRange  = maxR - minR || 1;

  const toX = (i: number) => padLeft + (i / (ratings.length - 1)) * innerW;
  const toY = (r: number) => padTop + ((maxR - r) / rRange) * innerH;

  const coords = ratings.map((r, i) => ({ x: toX(i), y: toY(r) }));
  const polylineStr = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const areaPath = hasData
    ? `M${padLeft},${padTop + innerH} L${coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" L")} L${(padLeft + innerW).toFixed(1)},${padTop + innerH} Z`
    : "";

  // Y-axis ticks (5 evenly spaced)
  const yTicks = Array.from({ length: 5 }, (_, i) => {
    const val = Math.round(minR + (i / 4) * rRange);
    return { val, y: toY(val) };
  });

  // X-axis ticks (up to 6 evenly spaced)
  const xTickCount = Math.min(6, ratings.length);
  const xTicks = Array.from({ length: xTickCount }, (_, i) => {
    const idx = Math.round((i / (xTickCount - 1)) * (ratings.length - 1));
    return { idx, x: toX(idx), label: formatDateShort(dates[idx] ?? "") };
  });

  // Mouse interaction
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg || !hasData) return;
    const rect = svg.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * W;
    let closest = 0;
    let minDist = Infinity;
    coords.forEach((c, i) => {
      const dist = Math.abs(c.x - mouseX);
      if (dist < minDist) { minDist = dist; closest = i; }
    });
    setHovered(closest);
  };

  // Summary stats
  const delta    = hasData ? ratings[ratings.length - 1] - ratings[0] : null;
  const peak     = hasData ? Math.max(...ratings) : null;
  const current_ = hasData ? ratings[ratings.length - 1] : null;

  // Theme tokens
  const _cardBg   = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)";
  const tabActive = isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)";
  const tabText   = isDark ? "rgba(255,255,255,0.50)" : "rgba(0,0,0,0.45)";
  const gridColor = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
  const axisText  = isDark ? "rgba(255,255,255,0.30)" : "rgba(0,0,0,0.30)";
  const textMain  = isDark ? "#fff" : "#111";
  const textMuted = isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.45)";

  // Available formats (those with at least 1 data point)
  const availableFormats = (["rapid", "blitz", "bullet"] as FormatKey[]).filter(
    (f) => data[f].ratings.length > 0
  );

  return (
    <div
      className="rounded-3xl border p-5"
      style={{
        background: isDark ? "rgba(255,255,255,0.03)" : "#fff",
        borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5" style={{ color: meta.color }} />
          <h2 className="text-base font-bold" style={{ color: textMain }}>
            Rating Progress
          </h2>
        </div>
        {loading && <Loader2 className="w-4 h-4 animate-spin" style={{ color: meta.color }} />}
      </div>

      {/* Format tabs */}
      {!loading && availableFormats.length > 0 && (
        <div className="flex items-center gap-1.5 mb-4">
          {availableFormats.map((fmt) => {
            const m = FORMAT_META[fmt];
            const isActive = fmt === activeFormat;
            return (
              <button
                key={fmt}
                onClick={() => { setActiveFormat(fmt); setHovered(null); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                style={{
                  background: isActive ? tabActive : "transparent",
                  color: isActive ? m.color : tabText,
                  border: isActive ? `1px solid ${m.color}33` : "1px solid transparent",
                }}
              >
                <span>{m.icon}</span>
                <span>{m.label}</span>
                {data[fmt].ratings.length > 0 && (
                  <span
                    className="text-[10px] font-bold"
                    style={{ color: isActive ? m.color : tabText }}
                  >
                    {data[fmt].ratings[data[fmt].ratings.length - 1]}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: meta.color }} />
        </div>
      )}

      {/* Empty state */}
      {!loading && availableFormats.length === 0 && (
        <div className="flex flex-col items-center justify-center h-40 gap-2">
          <TrendingUp className="w-8 h-8 opacity-20" style={{ color: meta.color }} />
          <p className="text-sm text-center" style={{ color: textMuted }}>
            No rating history yet.
          </p>
          <p className="text-xs text-center" style={{ color: textMuted }}>
            Save your profile with a linked chess.com account to start tracking.
          </p>
        </div>
      )}

      {/* Chart */}
      {!loading && hasData && (
        <>
          {/* Summary stats row */}
          <div className="flex items-center gap-4 mb-3">
            <div>
              <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: textMuted }}>Current</p>
              <p className="text-xl font-bold leading-tight" style={{ color: meta.color }}>{current_}</p>
            </div>
            {delta !== null && (
              <div>
                <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: textMuted }}>Change</p>
                <div className="flex items-center gap-1">
                  {delta > 0 ? (
                    <TrendingUp className="w-3.5 h-3.5" style={{ color: "#4ade80" }} />
                  ) : delta < 0 ? (
                    <TrendingDown className="w-3.5 h-3.5" style={{ color: "#f87171" }} />
                  ) : (
                    <Minus className="w-3.5 h-3.5" style={{ color: textMuted }} />
                  )}
                  <p
                    className="text-sm font-bold leading-tight"
                    style={{ color: delta > 0 ? "#4ade80" : delta < 0 ? "#f87171" : textMuted }}
                  >
                    {delta > 0 ? "+" : ""}{delta}
                  </p>
                </div>
              </div>
            )}
            {peak !== null && (
              <div>
                <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: textMuted }}>Peak</p>
                <p className="text-sm font-bold leading-tight" style={{ color: textMain }}>{peak}</p>
              </div>
            )}
            <div>
              <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: textMuted }}>Sessions</p>
              <p className="text-sm font-bold leading-tight" style={{ color: textMain }}>{ratings.length}</p>
            </div>
          </div>

          {/* SVG chart */}
          <div ref={containerRef} className="w-full">
            <svg
              ref={svgRef}
              width="100%"
              height={H}
              viewBox={`0 0 ${W} ${H}`}
              preserveAspectRatio="none"
              className="cursor-crosshair overflow-visible"
              onMouseMove={handleMouseMove}
              onMouseLeave={() => setHovered(null)}
            >
              {/* Y-axis grid lines + labels */}
              {yTicks.map(({ val, y }) => (
                <g key={val}>
                  <line
                    x1={padLeft} y1={y.toFixed(1)}
                    x2={padLeft + innerW} y2={y.toFixed(1)}
                    stroke={gridColor}
                    strokeWidth="1"
                  />
                  <text
                    x={padLeft - 6}
                    y={(y + 4).toFixed(1)}
                    textAnchor="end"
                    fill={axisText}
                    fontSize="9"
                    fontFamily="monospace"
                  >
                    {val}
                  </text>
                </g>
              ))}

              {/* X-axis labels */}
              {xTicks.map(({ idx, x, label }) => (
                <text
                  key={idx}
                  x={x.toFixed(1)}
                  y={H - 6}
                  textAnchor="middle"
                  fill={axisText}
                  fontSize="8"
                  fontFamily="sans-serif"
                >
                  {label}
                </text>
              ))}

              {/* Area fill */}
              <path d={areaPath} fill={meta.fill} />

              {/* Line */}
              <polyline
                points={polylineStr}
                fill="none"
                stroke={meta.color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* All data dots */}
              {coords.map((c, i) => (
                <circle
                  key={i}
                  cx={c.x.toFixed(1)}
                  cy={c.y.toFixed(1)}
                  r="2.5"
                  fill={meta.color}
                  opacity={hovered === i ? 1 : 0.35}
                />
              ))}

              {/* Hover crosshair + tooltip */}
              {hovered !== null && coords[hovered] && (() => {
                const cx = coords[hovered].x;
                const cy = coords[hovered].y;
                const rating = ratings[hovered];
                const date   = formatDateFull(dates[hovered] ?? "");
                const flipLeft = cx > W * 0.65;
                const ttW = 80;
                const ttH = 30;
                const ttX = flipLeft ? cx - ttW - 6 : cx + 6;
                const ttY = cy - ttH / 2 < padTop ? padTop : cy - ttH / 2;

                return (
                  <>
                    {/* Vertical crosshair */}
                    <line
                      x1={cx.toFixed(1)} y1={padTop}
                      x2={cx.toFixed(1)} y2={padTop + innerH}
                      stroke={meta.color}
                      strokeWidth="1"
                      strokeDasharray="3,3"
                      opacity="0.45"
                    />
                    {/* Hovered dot glow */}
                    <circle cx={cx.toFixed(1)} cy={cy.toFixed(1)} r="6" fill={meta.color} opacity="0.15" />
                    <circle cx={cx.toFixed(1)} cy={cy.toFixed(1)} r="3.5" fill={meta.color} />

                    {/* Tooltip box */}
                    <rect
                      x={ttX.toFixed(1)} y={ttY.toFixed(1)}
                      width={ttW} height={ttH}
                      rx="5"
                      fill={isDark ? "rgba(8,16,10,0.95)" : "rgba(255,255,255,0.97)"}
                      stroke={meta.color}
                      strokeWidth="1"
                      opacity="0.97"
                    />
                    {/* Rating value */}
                    <text
                      x={(ttX + ttW / 2).toFixed(1)}
                      y={(ttY + 12).toFixed(1)}
                      textAnchor="middle"
                      fill={meta.color}
                      fontSize="11"
                      fontWeight="700"
                      fontFamily="monospace"
                    >
                      {rating}
                    </text>
                    {/* Date */}
                    <text
                      x={(ttX + ttW / 2).toFixed(1)}
                      y={(ttY + 24).toFixed(1)}
                      textAnchor="middle"
                      fill={isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.45)"}
                      fontSize="8"
                      fontFamily="sans-serif"
                    >
                      {date}
                    </text>
                  </>
                );
              })()}
            </svg>
          </div>
        </>
      )}

      {/* Single data point — not enough for a line */}
      {!loading && !hasData && availableFormats.length > 0 && (
        <div className="flex flex-col items-center justify-center h-32 gap-2">
          <p className="text-2xl font-bold" style={{ color: meta.color }}>
            {data[activeFormat].ratings[0] ?? "—"}
          </p>
          <p className="text-xs" style={{ color: textMuted }}>
            Only one data point — save your profile again to start tracking progress.
          </p>
        </div>
      )}
    </div>
  );
}
