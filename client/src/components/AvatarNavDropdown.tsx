/**
 * AvatarNavDropdown
 *
 * A single avatar/initials button that opens a unified dropdown containing:
 *   1. Nav links  — Dashboard, Clubs, Battle, Analyze
 *   2. Divider
 *   3. User actions — My Profile, Sign Out  (or Sign In for guests)
 *
 * The avatar button shows the user's Chess.com profile picture when available,
 * with a shimmer loading state and an initials/icon fallback.
 *
 * Usage:
 *   <AvatarNavDropdown currentPage="Battle" onSignInClick={() => setAuthOpen(true)} />
 */

import { useState, useRef, useEffect } from "react";
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

// ─── Design tokens ────────────────────────────────────────────────────────────
const OTB_GREEN      = "#4CAF50";
const OTB_GREEN_GLOW = "rgba(61,107,71,";

const NAV_ITEMS = [
  { name: "Dashboard", href: "/join",    icon: LayoutDashboard },
  { name: "Clubs",     href: "/clubs",   icon: Building2 },
  { name: "Battle",    href: "/battle",  icon: Swords },
  { name: "Analyze",   href: "/record",  icon: Video },
] as const;

// ─── Props ────────────────────────────────────────────────────────────────────
interface AvatarNavDropdownProps {
  /** Highlight this nav item as active (e.g. "Battle"). Falls back to URL matching. */
  currentPage?: string;
  /** Called when the guest/unauthenticated user clicks "Sign In". */
  onSignInClick?: () => void;
  /** Extra class names for the outer wrapper */
  className?: string;
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
}: AvatarNavDropdownProps) {
  const { user, logout } = useAuthContext();
  const [open, setOpen]   = useState(false);
  const [location]        = useLocation();
  const wrapperRef        = useRef<HTMLDivElement>(null);

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

  const isActive = (item: (typeof NAV_ITEMS)[number]) => {
    if (currentPage) return item.name === currentPage;
    return location.startsWith(item.href);
  };

  const buttonBorder = user?.isGuest
    ? "border-amber-500/40"
    : "border-white/20";

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
      <AnimatePresence>
        {open && (
          <motion.div
            key="dropdown"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className="absolute right-0 top-full mt-2 z-[9999] w-52 rounded-2xl overflow-hidden shadow-2xl"
            style={{
              background: "oklch(0.17 0.06 145 / 0.97)",
              border: `1px solid ${OTB_GREEN_GLOW}0.22)`,
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              boxShadow: `0 8px 32px rgba(0,0,0,0.55), 0 0 24px ${OTB_GREEN_GLOW}0.10)`,
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
                              // Trend: up ▲ green, down ▼ red, neutral — (no prev or unchanged)
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
              {NAV_ITEMS.map((item) => {
                const active = isActive(item);
                return (
                  <Link key={item.name} href={item.href}>
                    <a
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
                    </a>
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
                <Link href="/profile">
                  <a
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
                  </a>
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
    </div>
  );
}
