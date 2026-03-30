/**
 * AvatarNavDropdown
 *
 * A single avatar/initials button that opens a unified dropdown containing:
 *   1. User identity header (avatar, display name, chess.com handle)
 *   2. Rating pills (rapid / blitz / bullet) with trend arrows
 *   3. Compact sparkline chart for recent rating history
 *   4. Nav links  — Dashboard, Clubs, Battle, Analyze
 *   5. User actions — My Profile, Sign Out  (or Sign In for guests)
 *
 * The avatar button shows the user's Chess.com profile picture when available,
 * with a shimmer loading state and an initials/icon fallback.
 *
 * Usage:
 *   <AvatarNavDropdown currentPage="Battle" onSignInClick={() => setAuthOpen(true)} />
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Building2,
  Swords,
  Video,
  Crown,
  LogOut,
  LogIn,
  Ghost,
  ChevronDown,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuthContext } from "@/context/AuthContext";
import { useChessAvatar } from "@/hooks/useChessAvatar";
import { GuestMobileMenu } from "@/components/GuestMobileMenu";

// ─── Design tokens ────────────────────────────────────────────────────────────
const OTB_GREEN      = "#4CAF50";
const OTB_GREEN_GLOW = "rgba(61,107,71,";

const NAV_ITEMS = [
  { name: "Dashboard", href: "/join",    icon: LayoutDashboard },
  { name: "Clubs",     href: "/clubs",   icon: Building2 },
  { name: "Battle",    href: "/battle",  icon: Swords },
  { name: "Analyze",   href: "/record",  icon: Video },
];

// ─── Types ────────────────────────────────────────────────────────────────────
interface RatingPoint {
  rating: number;
  recordedAt: string;
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface AvatarNavDropdownProps {
  /** Highlight this nav item as active (e.g. "Battle"). Falls back to URL matching. */
  currentPage?: string;
  /** Called when the guest/unauthenticated user clicks "Sign In". */
  onSignInClick?: () => void;
  /** Extra class names for the outer wrapper */
  className?: string;
  /** Smart dashboard URL (resolves to active tournament or /join). Passed from AppNavBar. */
  dashboardUrl?: string;
}

// ─── Sparkline SVG (interactive with hover tooltip) ──────────────────────────
function Sparkline({
  points,
  dates,
  color,
  width = 72,
  height = 24,
}: {
  points: number[];
  dates?: string[];
  color: string;
  width?: number;
  height?: number;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  if (points.length < 2) return null;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const pad = 2;

  // Map points to SVG coordinates
  const coords = points.map((v, i) => {
    const x = pad + (i / (points.length - 1)) * (width - pad * 2);
    const y = pad + ((max - v) / range) * (height - pad * 2);
    return { x: parseFloat(x.toFixed(1)), y: parseFloat(y.toFixed(1)) };
  });

  const polylineStr = coords.map((c) => `${c.x},${c.y}`).join(" ");

  // Area fill path
  const firstX = pad;
  const lastX  = (width - pad).toFixed(1);
  const bottom = (height - pad).toFixed(1);
  const areaPath = `M${firstX},${bottom} L${coords[0].x},${coords[0].y} ${coords.slice(1).map((c) => `L${c.x},${c.y}`).join(" ")} L${lastX},${bottom} Z`;

  const isUp = points[points.length - 1] >= points[0];
  const lineColor = isUp ? "#4ade80" : "#f87171";
  const fillColor = isUp ? "rgba(74,222,128,0.12)" : "rgba(248,113,113,0.12)";

  // Format date for tooltip
  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return iso;
    }
  };

  // Find closest point to mouse X
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * width;
    let closest = 0;
    let minDist = Infinity;
    coords.forEach((c, i) => {
      const dist = Math.abs(c.x - mouseX);
      if (dist < minDist) { minDist = dist; closest = i; }
    });
    setHovered(closest);
  };

  const hoveredCoord = hovered !== null ? coords[hovered] : null;
  const hoveredRating = hovered !== null ? points[hovered] : null;
  const hoveredDate   = hovered !== null && dates ? formatDate(dates[hovered]) : null;

  // Tooltip positioning — flip left if near right edge
  const tooltipX = hoveredCoord ? (hoveredCoord.x > width * 0.65 ? hoveredCoord.x - 4 : hoveredCoord.x + 4) : 0;
  const tooltipAnchor = hoveredCoord && hoveredCoord.x > width * 0.65 ? "end" : "start";

  return (
    <div className="relative" style={{ width, height }}>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHovered(null)}
      >
        {/* Area fill */}
        <path d={areaPath} fill={fillColor} />
        {/* Line */}
        <polyline
          points={polylineStr}
          fill="none"
          stroke={lineColor}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* All dots (subtle) */}
        {coords.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r="1.5" fill={lineColor} opacity="0.4" />
        ))}
        {/* Hovered dot (highlighted) */}
        {hoveredCoord && (
          <>
            <circle cx={hoveredCoord.x} cy={hoveredCoord.y} r="3" fill={lineColor} opacity="0.25" />
            <circle cx={hoveredCoord.x} cy={hoveredCoord.y} r="2" fill={lineColor} />
            {/* Vertical crosshair line */}
            <line
              x1={hoveredCoord.x} y1={pad}
              x2={hoveredCoord.x} y2={height - pad}
              stroke={lineColor}
              strokeWidth="0.75"
              strokeDasharray="2,2"
              opacity="0.5"
            />
          </>
        )}
        {/* SVG tooltip label */}
        {hoveredCoord && hoveredRating !== null && (
          <>
            <rect
              x={tooltipAnchor === "end" ? tooltipX - (hoveredDate ? 62 : 28) : tooltipX}
              y={hoveredCoord.y - 18 < pad ? hoveredCoord.y + 4 : hoveredCoord.y - 18}
              width={hoveredDate ? 62 : 28}
              height={hoveredDate ? 22 : 13}
              rx="3"
              fill="rgba(10,20,12,0.92)"
              stroke={lineColor}
              strokeWidth="0.75"
              opacity="0.95"
            />
            <text
              x={tooltipAnchor === "end" ? tooltipX - (hoveredDate ? 62 : 28) + (hoveredDate ? 31 : 14) : tooltipX + (hoveredDate ? 31 : 14)}
              y={hoveredCoord.y - 18 < pad ? hoveredCoord.y + 12 : hoveredCoord.y - 9}
              textAnchor="middle"
              fill={lineColor}
              fontSize="7"
              fontWeight="700"
              fontFamily="monospace"
            >
              {hoveredRating}
            </text>
            {hoveredDate && (
              <text
                x={tooltipAnchor === "end" ? tooltipX - (hoveredDate ? 62 : 28) + 31 : tooltipX + 31}
                y={hoveredCoord.y - 18 < pad ? hoveredCoord.y + 21 : hoveredCoord.y - 1}
                textAnchor="middle"
                fill="rgba(255,255,255,0.45)"
                fontSize="6"
                fontFamily="sans-serif"
              >
                {hoveredDate}
              </text>
            )}
          </>
        )}
      </svg>
    </div>
  );
}

// ─── Inner avatar circle (handles chess.com photo + shimmer + fallback) ───────
function AvatarCircle({
  user,
}: {
  user: { displayName?: string | null; email?: string | null; isGuest?: boolean; chesscomUsername?: string | null; avatarUrl?: string | null } | null;
}) {
  // Prefer stored avatarUrl, then fetch from chess.com
  const chesscomUsername = user?.chesscomUsername ?? null;
  const { url: chesscomUrl, status } = useChessAvatar(
    // Only fetch if no stored avatarUrl already
    user?.avatarUrl ? null : chesscomUsername
  );

  const photoUrl = user?.avatarUrl || chesscomUrl;
  const isLoading = !user?.avatarUrl && !!chesscomUsername && status === "loading";
  const initials  = user
    ? (user.displayName || user.email || "?").charAt(0).toUpperCase()
    : null;

  if (user?.isGuest) {
    return <Ghost className="w-4 h-4 text-amber-300" />;
  }

  if (!user) {
    return <LogIn className="w-4 h-4 text-white/70" />;
  }

  if (isLoading) {
    // Shimmer skeleton while chess.com photo loads
    return (
      <div className="w-full h-full rounded-full animate-pulse bg-white/10" />
    );
  }

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={user.displayName ?? "avatar"}
        className="w-full h-full object-cover rounded-full"
        onError={(e) => {
          // On broken image, hide and let initials show via parent
          (e.currentTarget as HTMLImageElement).style.display = "none";
        }}
      />
    );
  }

  // Initials fallback
  return (
    <span className="text-sm font-bold text-white select-none">{initials}</span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export function AvatarNavDropdown({
  currentPage,
  onSignInClick,
  className = "",
  dashboardUrl,
}: AvatarNavDropdownProps) {
  const { user, logout } = useAuthContext();
  const [open, setOpen]   = useState(false);
  const [location]        = useLocation();
  const wrapperRef        = useRef<HTMLDivElement>(null);

  // Rating history state (ratings + dates for tooltip)
  const [history, setHistory] = useState<{
    rapid: number[]; blitz: number[]; bullet: number[];
    rapidDates: string[]; blitzDates: string[]; bulletDates: string[];
  }>({
    rapid: [], blitz: [], bullet: [],
    rapidDates: [], blitzDates: [], bulletDates: [],
  });
  const [historyLoaded, setHistoryLoaded] = useState(false);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Fetch rating history when dropdown opens (once per session)
  const fetchHistory = useCallback(async () => {
    if (historyLoaded || !user || user.isGuest) return;
    try {
      const res = await fetch("/api/auth/rating-history", { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json() as { history: (RatingPoint & { format: string })[] };
      const rapid:  number[] = [];
      const blitz:  number[] = [];
      const bullet: number[] = [];
      const rapidDates:  string[] = [];
      const blitzDates:  string[] = [];
      const bulletDates: string[] = [];
      // Rows come newest-first; reverse to get chronological order for sparkline
      const sorted = [...data.history].reverse();
      for (const row of sorted) {
        if (row.format === "rapid")  { rapid.push(row.rating);  rapidDates.push(row.recordedAt); }
        if (row.format === "blitz")  { blitz.push(row.rating);  blitzDates.push(row.recordedAt); }
        if (row.format === "bullet") { bullet.push(row.rating); bulletDates.push(row.recordedAt); }
      }
      setHistory({ rapid, blitz, bullet, rapidDates, blitzDates, bulletDates });
      setHistoryLoaded(true);
    } catch {
      // Silently ignore — sparkline just won't show
    }
  }, [historyLoaded, user]);

  useEffect(() => {
    if (open) fetchHistory();
  }, [open, fetchHistory]);

  // Build nav items — use smart dashboardUrl if provided, else fall back to /join
  const resolvedNavItems = NAV_ITEMS.map((item) =>
    item.name === "Dashboard" && dashboardUrl
      ? { ...item, href: dashboardUrl }
      : item
  );

  const isActive = (item: (typeof NAV_ITEMS)[number]) => {
    if (currentPage) return item.name === currentPage;
    return location.startsWith(item.href);
  };

  const buttonBorder = user?.isGuest
    ? "border-amber-500/40"
    : "border-white/20";

  // Determine if any sparkline data exists
  const hasSparkline = history.rapid.length >= 2 || history.blitz.length >= 2 || history.bullet.length >= 2;

  // On mobile, guests see the dedicated hamburger drawer instead of the avatar dropdown
  const isGuest = !user || user.isGuest;

  if (isGuest) {
    return (
      <>
        {/* Mobile: full hamburger drawer */}
        <div className="flex md:hidden">
          <GuestMobileMenu
            currentPage={currentPage}
            onSignInClick={onSignInClick}
          />
        </div>
        {/* Desktop: avatar dropdown (same JSX as the main return below, scoped to desktop) */}
        <div ref={wrapperRef} className={`relative hidden md:block ${className}`}>
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            className={`flex items-center gap-1.5 rounded-full border transition-all border-white/20 bg-black/30 backdrop-blur-md hover:bg-white/10 active:bg-white/15`}
            style={{ padding: "3px 8px 3px 3px" }}
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0"
              style={{ background: "rgba(255,255,255,0.08)" }}
            >
              <LogIn className="w-3.5 h-3.5 text-white/50" />
            </div>
            <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronDown className="w-3.5 h-3.5 text-white/50" />
            </motion.div>
          </button>
          <AnimatePresence>
            {open && (
              <motion.div
                key="backdrop-guest"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="fixed inset-0 z-[9990]"
                onClick={() => setOpen(false)}
              />
            )}
          </AnimatePresence>
          <AnimatePresence>
            {open && (
              <motion.div
                key="dropdown-guest"
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
                className="absolute right-0 top-full mt-2 z-[9999] w-56 rounded-2xl shadow-2xl"
                style={{
                  background: "oklch(0.17 0.06 145 / 0.97)",
                  border: `1px solid ${OTB_GREEN_GLOW}0.22)`,
                  backdropFilter: "blur(20px)",
                  WebkitBackdropFilter: "blur(20px)",
                  boxShadow: `0 8px 32px rgba(0,0,0,0.55)`,
                }}
              >
                <div className="px-2 py-2">
                  <button
                    onClick={() => { setOpen(false); onSignInClick?.(); }}
                    className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-semibold text-white/65 hover:text-white hover:bg-white/07 transition-colors"
                  >
                    <LogIn className="w-4 h-4 flex-shrink-0" />
                    <span>Sign In</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </>
    );
  }

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      {/* ── Avatar button ── */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        className={`flex items-center gap-1.5 rounded-full border transition-all ${buttonBorder} bg-black/30 backdrop-blur-md hover:bg-white/10 active:bg-white/15`}
        style={{ padding: "3px 8px 3px 3px" }}
      >
        {/* Avatar circle */}
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0"
          style={{
            background:
              user && !user.isGuest
                ? "#3D6B47"
                : user?.isGuest
                ? "rgba(245,158,11,0.15)"
                : "rgba(255,255,255,0.08)",
          }}
        >
          <AvatarCircle user={user} />
        </div>
        {/* Chevron */}
        <motion.div
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-3.5 h-3.5 text-white/50" />
        </motion.div>
      </button>

      {/* ── Backdrop ── */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[9990]"
            onClick={() => setOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Dropdown panel ── */}
      {/* On mobile: full-screen slide-up sheet. On desktop: anchored dropdown. */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="dropdown"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className="hidden md:block absolute right-0 top-full mt-2 z-[9999] w-64 rounded-2xl shadow-2xl"
            style={{
              background: "oklch(0.17 0.06 145 / 0.97)",
              border: `1px solid ${OTB_GREEN_GLOW}0.22)`,
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              boxShadow: `0 8px 32px rgba(0,0,0,0.55), 0 0 24px ${OTB_GREEN_GLOW}0.10)`,
              maxHeight: "calc(100dvh - 5rem)",
              overflowY: "auto",
              overflowX: "hidden",
            }}
          >
            {/* ── User identity header (when logged in) ── */}
            {user && !user.isGuest && (
              <div className="flex items-center gap-3 px-4 pt-3 pb-2">
                {/* Larger avatar preview */}
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0"
                  style={{ background: "#3D6B47" }}
                >
                  <AvatarCircle user={user} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate leading-tight">
                    {user.displayName || user.email}
                  </p>
                  {user.chesscomUsername && (
                    <div className="flex flex-col gap-1">
                      <p className="text-[11px] text-white/40 truncate leading-tight">
                        chess.com/{user.chesscomUsername}
                      </p>
                      {/* Compact three-rating row — only shown when at least one rating exists */}
                      {(user.chesscomRapid || user.chesscomBlitz || user.chesscomBullet) && (
                        <div className="flex items-center gap-1.5">
                          {([
                            { label: "Rapid",  icon: "♟", value: user.chesscomRapid,  prev: user.chesscomPrevRapid  },
                            { label: "Blitz",  icon: "⚡", value: user.chesscomBlitz,  prev: user.chesscomPrevBlitz  },
                            { label: "Bullet", icon: "•",  value: user.chesscomBullet, prev: user.chesscomPrevBullet },
                          ] as { label: string; icon: string; value: number | null; prev: number | null }[]).map(
                            ({ label, icon, value, prev }) => {
                              if (!value) return null;
                              // Trend: up ▲ green, down ▼ red, neutral (no prev or unchanged)
                              const trend =
                                prev == null || prev === value
                                  ? null
                                  : value > prev
                                  ? "up"
                                  : "down";
                              const delta = prev != null && prev !== value ? Math.abs(value - prev) : null;
                              return (
                                <span
                                  key={label}
                                  title={`${label}${delta != null ? ` (${trend === "up" ? "+" : "-"}${delta} since last sync)` : ""}`}
                                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold leading-none"
                                  style={{
                                    background: "rgba(76,175,80,0.15)",
                                    border: "1px solid rgba(76,175,80,0.25)",
                                    color: "#4CAF50",
                                  }}
                                >
                                  <span className="opacity-80">{icon}</span>
                                  <span>{value}</span>
                                  {trend === "up" && (
                                    <span className="text-[9px] font-bold" style={{ color: "#4ade80" }}>▲</span>
                                  )}
                                  {trend === "down" && (
                                    <span className="text-[9px] font-bold" style={{ color: "#f87171" }}>▼</span>
                                  )}
                                </span>
                              );
                            }
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Sparkline section ── */}
            {user && !user.isGuest && hasSparkline && (
              <div
                className="mx-3 mb-2 rounded-xl px-3 py-2"
                style={{
                  background: "rgba(0,0,0,0.25)",
                  border: `1px solid ${OTB_GREEN_GLOW}0.12)`,
                }}
              >
                <p className="text-[9px] font-semibold uppercase tracking-widest text-white/25 mb-1.5">
                  Rating History
                </p>
                <div className="flex flex-col gap-1.5">
                  {([
                    { label: "Rapid",  icon: "♟", pts: history.rapid,  dts: history.rapidDates  },
                    { label: "Blitz",  icon: "⚡", pts: history.blitz,  dts: history.blitzDates  },
                    { label: "Bullet", icon: "•",  pts: history.bullet, dts: history.bulletDates },
                  ] as { label: string; icon: string; pts: number[]; dts: string[] }[]).map(({ label, icon, pts, dts }) => {
                    if (pts.length < 2) return null;
                    const latest = pts[pts.length - 1];
                    const earliest = pts[0];
                    const delta = latest - earliest;
                    return (
                      <div key={label} className="flex items-center gap-2">
                        {/* Format label */}
                        <span className="text-[10px] text-white/35 w-10 flex-shrink-0 flex items-center gap-0.5">
                          <span>{icon}</span>
                          <span>{label.slice(0, 1)}</span>
                        </span>
                        {/* Sparkline with tooltip */}
                        <div className="flex-1">
                          <Sparkline points={pts} dates={dts} color={OTB_GREEN} width={80} height={22} />
                        </div>
                        {/* Delta */}
                        <span
                          className="text-[10px] font-semibold w-8 text-right flex-shrink-0"
                          style={{ color: delta >= 0 ? "#4ade80" : "#f87171" }}
                        >
                          {delta >= 0 ? "+" : ""}{delta}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Divider after identity header ── */}
            {user && !user.isGuest && (
              <div
                className="mx-3 mb-1 h-px"
                style={{ background: `${OTB_GREEN_GLOW}0.15)` }}
              />
            )}

            {/* ── Section: Nav links ── */}
            <div className="px-2 pt-1.5 pb-1">
              <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-white/30">
                Navigate
              </p>
              {resolvedNavItems.map((item) => {
                const active = isActive(item);
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                    style={
                      active
                        ? {
                            background: `${OTB_GREEN_GLOW}0.22)`,
                            border: `1px solid ${OTB_GREEN_GLOW}0.28)`,
                            color: "#fff",
                          }
                        : {
                            color: "rgba(255,255,255,0.65)",
                            border: "1px solid transparent",
                          }
                    }
                    onMouseEnter={(e) => {
                      if (!active)
                        (e.currentTarget as HTMLElement).style.background =
                          "rgba(255,255,255,0.07)";
                    }}
                    onMouseLeave={(e) => {
                      if (!active)
                        (e.currentTarget as HTMLElement).style.background = "transparent";
                    }}
                  >
                    <item.icon
                      className="w-4 h-4 flex-shrink-0"
                      style={{ color: active ? OTB_GREEN : undefined }}
                    />
                    <span>{item.name}</span>
                    {active && (
                      <motion.div
                        layoutId="avatar-dropdown-dot"
                        className="ml-auto w-1.5 h-1.5 rounded-full"
                        style={{ background: OTB_GREEN }}
                      />
                    )}
                  </Link>
                );
              })}
            </div>

            {/* ── Divider ── */}
            <div
              className="mx-3 my-1 h-px"
              style={{ background: `${OTB_GREEN_GLOW}0.15)` }}
            />

            {/* ── Section: User actions ── */}
            <div className="px-2 pb-2">
              {user && !user.isGuest && (
                <Link
                  href="/profile"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-white/65 hover:text-white transition-colors"
                  style={{ border: "1px solid transparent" }}
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLElement).style.background =
                      "rgba(255,255,255,0.07)")
                  }
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLElement).style.background = "transparent")
                  }
                >
                  <Crown className="w-4 h-4 flex-shrink-0" />
                  <span>My Profile</span>
                </Link>
              )}

              {user?.isGuest && (
                <button
                  onClick={() => { setOpen(false); onSignInClick?.(); }}
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-semibold text-amber-300 hover:bg-amber-500/10 transition-colors"
                >
                  <Crown className="w-4 h-4 flex-shrink-0" />
                  <span>Create Free Account</span>
                </button>
              )}

              {user ? (
                <button
                  onClick={() => { logout(); setOpen(false); }}
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-semibold text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <LogOut className="w-4 h-4 flex-shrink-0" />
                  <span>Sign Out</span>
                </button>
              ) : (
                <button
                  onClick={() => { setOpen(false); onSignInClick?.(); }}
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-semibold text-white/65 hover:text-white hover:bg-white/07 transition-colors"
                >
                  <LogIn className="w-4 h-4 flex-shrink-0" />
                  <span>Sign In</span>
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Mobile slide-up sheet (signed-in users only, hidden on md+) ── */}
      {/* Rendered via portal at document.body to escape backdrop-filter stacking context */}
      {typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {open && (
            <>
              {/* Backdrop */}
              <motion.div
                key="mobile-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-[9990] md:hidden"
                style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
                onClick={() => setOpen(false)}
              />
              {/* Sheet */}
              <motion.div
                key="mobile-sheet"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", stiffness: 340, damping: 36 }}
                className="fixed bottom-0 left-0 right-0 z-[9999] md:hidden rounded-t-3xl overflow-hidden"
              style={{
                background: "oklch(0.15 0.06 145 / 0.98)",
                border: `1px solid ${OTB_GREEN_GLOW}0.22)`,
                backdropFilter: "blur(24px)",
                WebkitBackdropFilter: "blur(24px)",
                boxShadow: `0 -8px 40px rgba(0,0,0,0.6), 0 0 32px ${OTB_GREEN_GLOW}0.08)`,
                paddingBottom: "env(safe-area-inset-bottom, 16px)",
              }}
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.18)" }} />
              </div>

              {/* User identity */}
              {user && !user.isGuest && (
                <div className="flex items-center gap-3 px-5 pt-2 pb-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0"
                    style={{ background: "#3D6B47" }}
                  >
                    <AvatarCircle user={user} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">
                      {user.displayName || user.email}
                    </p>
                    {user.chesscomUsername && (
                      <p className="text-[11px] text-white/40 truncate">
                        chess.com/{user.chesscomUsername}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Divider */}
              <div className="mx-4 mb-2 h-px" style={{ background: `${OTB_GREEN_GLOW}0.15)` }} />

              {/* Nav links */}
              <div className="px-3 pb-1">
                <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/30">
                  Navigate
                </p>
                {resolvedNavItems.map((item, i) => {
                  const active = isActive(item);
                  return (
                    <motion.div
                      key={item.name}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 + 0.05 }}
                    >
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold transition-colors"
                        style={active
                          ? { background: `${OTB_GREEN_GLOW}0.22)`, border: `1px solid ${OTB_GREEN_GLOW}0.28)`, color: "#fff" }
                          : { color: "rgba(255,255,255,0.65)", border: "1px solid transparent" }
                        }
                      >
                        <div
                          className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ background: active ? `${OTB_GREEN_GLOW}0.25)` : "rgba(255,255,255,0.06)" }}
                        >
                          <item.icon className="w-4 h-4" style={{ color: active ? "#4CAF50" : "rgba(255,255,255,0.5)" }} />
                        </div>
                        <span>{item.name}</span>
                        {active && (
                          <div className="ml-auto w-1.5 h-1.5 rounded-full" style={{ background: "#4CAF50" }} />
                        )}
                      </Link>
                    </motion.div>
                  );
                })}
              </div>

              {/* Divider */}
              <div className="mx-4 my-2 h-px" style={{ background: `${OTB_GREEN_GLOW}0.15)` }} />

              {/* User actions */}
              <div className="px-3 pb-3">
                {user && !user.isGuest && (
                  <Link
                    href="/profile"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold text-white/65 hover:text-white transition-colors"
                    style={{ border: "1px solid transparent" }}
                  >
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,255,255,0.06)" }}>
                      <Crown className="w-4 h-4 text-white/50" />
                    </div>
                    <span>My Profile</span>
                  </Link>
                )}
                <button
                  onClick={() => { logout(); setOpen(false); }}
                  className="flex items-center gap-3 w-full px-3 py-3 rounded-xl text-sm font-semibold text-red-400 hover:bg-red-500/10 transition-colors"
                  style={{ border: "1px solid transparent" }}
                >
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(239,68,68,0.08)" }}>
                    <LogOut className="w-4 h-4 text-red-400" />
                  </div>
                  <span>Sign Out</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
