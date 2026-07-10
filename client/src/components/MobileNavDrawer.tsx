/**
 * MobileNavDrawer — hamburger menu for all mobile users.
 *
 * Features:
 *  - Hamburger / ✕ toggle button
 *  - Slide-out dropdown drawer (from right, spring animation)
 *  - Click-outside-to-close (backdrop click + useEffect ref listener)
 *  - Swipe-right-to-close (touch gesture, 60 px threshold)
 *  - Signed-in user identity header: avatar + display name + chess.com username
 *  - Guest: Sign In CTA at the bottom
 *  - SPA navigation via Wouter (no full-page reloads)
 *  - Dark / light mode
 *  - prefers-reduced-motion respected by Framer Motion
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Menu, X, Trophy, LayoutDashboard, Building2,
  GraduationCap, LogIn, Ghost,
} from "lucide-react";
import { useLocation } from "wouter";
import { useTheme } from "@/contexts/ThemeContext";
import { useChessAvatar } from "@/hooks/useChessAvatar";
import type { AuthUser } from "@/hooks/useAuth";

// ─── Nav items ────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { name: "League",      href: "/league", icon: Trophy },
  { name: "Tournaments", href: "/join",         icon: LayoutDashboard },
  { name: "Clubs",       href: "/clubs",        icon: Building2 },
  { name: "Tools",       href: "/training",     icon: GraduationCap },
] as const;

// ─── Design tokens ────────────────────────────────────────────────────────────
const OTB_GREEN      = "#4CAF50";
const OTB_GREEN_GLOW = "rgba(61,107,71,";

// ─── Avatar sub-component ─────────────────────────────────────────────────────
function DrawerAvatar({ user }: { user: AuthUser }) {
  const chesscomUsername = user.chesscomUsername ?? null;
  const { url: chesscomUrl, status } = useChessAvatar(
    user.avatarUrl ? null : chesscomUsername,
  );
  const photoUrl  = user.avatarUrl || chesscomUrl;
  const isLoading = !user.avatarUrl && !!chesscomUsername && status === "loading";
  const initials  = (user.displayName || user.email || "?").charAt(0).toUpperCase();

  if (user.isGuest) {
    return (
      <div className="w-10 h-10 rounded-full flex items-center justify-center bg-amber-500/20 border border-amber-400/30">
        <Ghost className="w-5 h-5 text-amber-300" />
      </div>
    );
  }

  return (
    <div
      className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0"
      style={{
        background: `${OTB_GREEN_GLOW}0.25)`,
        border: `1.5px solid ${OTB_GREEN_GLOW}0.40)`,
        boxShadow: `0 0 12px ${OTB_GREEN_GLOW}0.20)`,
      }}
    >
      {isLoading && (
        <div className="w-full h-full rounded-full animate-pulse bg-white/10" />
      )}
      {!isLoading && photoUrl && (
        <img
          src={photoUrl}
          alt={user.displayName ?? "avatar"}
          className="w-full h-full object-cover rounded-full"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
        />
      )}
      {!isLoading && !photoUrl && (
        <span className="text-sm font-bold text-white select-none">{initials}</span>
      )}
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface MobileNavDrawerProps {
  /** Name of the current page — used to highlight the active item */
  currentPage?: string;
  /** Called when the user taps Sign In */
  onSignInClick?: () => void;
  /** Whether the current user is a guest (unauthenticated) */
  isGuest?: boolean;
  /** Full user object for the identity header (null / undefined for guests) */
  user?: AuthUser | null;
  /** Extra class names for the outer wrapper */
  className?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────
export function MobileNavDrawer({
  currentPage,
  onSignInClick,
  isGuest = true,
  user = null,
  className = "",
}: MobileNavDrawerProps) {
  const [open, setOpen]         = useState(false);
  const [location, navigate]    = useLocation();
  const { theme }               = useTheme();
  const isDark                  = theme === "dark";

  // ── Refs for click-outside detection ──────────────────────────────────────
  const wrapperRef = useRef<HTMLDivElement>(null);

  // ── Swipe-to-close state ──────────────────────────────────────────────────
  const swipeStartX      = useRef<number | null>(null);
  const SWIPE_THRESHOLD  = 60; // px rightward swipe to dismiss

  // ── Click-outside listener ────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    // Slight delay so the opening click doesn't immediately close
    const id = setTimeout(() => {
      document.addEventListener("mousedown", handler);
      document.addEventListener("touchstart", handler);
    }, 50);
    return () => {
      clearTimeout(id);
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [open]);

  // ── Swipe handlers ────────────────────────────────────────────────────────
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    swipeStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (swipeStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - swipeStartX.current;
    if (dx > SWIPE_THRESHOLD) setOpen(false);
    swipeStartX.current = null;
  }, []);

  // ── Nav helpers ───────────────────────────────────────────────────────────
  const isActive = (item: (typeof NAV_ITEMS)[number]) => {
    if (currentPage) return item.name === currentPage;
    return location.startsWith(item.href);
  };

  const handleNav = (href: string) => {
    setOpen(false);
    navigate(href);
  };

  // ── Design tokens ─────────────────────────────────────────────────────────
  const drawerBg = isDark
    ? "oklch(0.16 0.06 145 / 0.97)"
    : "oklch(0.97 0.02 145 / 0.97)";

  const itemActiveStyle = isDark
    ? { background: `${OTB_GREEN_GLOW}0.20)`, border: `1px solid ${OTB_GREEN_GLOW}0.28)`, color: "#fff" }
    : { background: "rgba(67,104,80,0.12)", border: "1px solid rgba(67,104,80,0.25)", color: "#1a2e1f" };

  const itemDefaultColor = isDark ? "rgba(255,255,255,0.65)" : "rgba(30,50,35,0.65)";
  const dividerColor     = isDark ? `${OTB_GREEN_GLOW}0.18)` : "rgba(67,104,80,0.15)";
  const textPrimary      = isDark ? "rgba(255,255,255,0.92)" : "rgba(15,30,18,0.92)";
  const textSecondary    = isDark ? "rgba(255,255,255,0.45)" : "rgba(30,50,35,0.45)";

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>

      {/* ── Hamburger / Close button ── */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        className={`flex items-center justify-center w-9 h-9 rounded-xl transition-all active:scale-95 ${
          isDark
            ? "text-white/70 hover:text-white hover:bg-white/10 active:bg-white/15"
            : "text-black/60 hover:text-black hover:bg-black/08 active:bg-black/12"
        }`}
      >
        <AnimatePresence mode="wait" initial={false}>
          {open ? (
            <motion.span
              key="close"
              initial={{ opacity: 0, rotate: -45, scale: 0.7 }}
              animate={{ opacity: 1, rotate: 0, scale: 1 }}
              exit={{ opacity: 0, rotate: 45, scale: 0.7 }}
              transition={{ duration: 0.18 }}
              className="flex"
            >
              <X className="w-5 h-5" />
            </motion.span>
          ) : (
            <motion.span
              key="menu"
              initial={{ opacity: 0, rotate: 45, scale: 0.7 }}
              animate={{ opacity: 1, rotate: 0, scale: 1 }}
              exit={{ opacity: 0, rotate: -45, scale: 0.7 }}
              transition={{ duration: 0.18 }}
              className="flex"
            >
              <Menu className="w-5 h-5" />
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      {/* ── Slide-out drawer (from right, spring) ── */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="drawer"
            initial={{ opacity: 0, x: 24, scale: 0.97 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 24, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className="absolute right-0 top-full mt-2 z-[9999] w-60 rounded-2xl overflow-hidden shadow-2xl"
            style={{
              background: drawerBg,
              border: `1px solid ${OTB_GREEN_GLOW}0.22)`,
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              boxShadow: `0 8px 40px rgba(0,0,0,0.45), 0 0 28px ${OTB_GREEN_GLOW}0.10)`,
            }}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >

            {/* ── User identity header (signed-in only) ── */}
            {!isGuest && user && (
              <>
                <div className="flex items-center gap-3 px-4 pt-4 pb-3">
                  <DrawerAvatar user={user} />
                  <div className="flex flex-col min-w-0">
                    <span
                      className="text-sm font-bold truncate leading-tight"
                      style={{ color: textPrimary }}
                    >
                      {user.displayName || user.email}
                    </span>
                    {user.chesscomUsername && (
                      <span
                        className="text-[11px] truncate leading-tight mt-0.5"
                        style={{ color: OTB_GREEN, opacity: 0.85 }}
                      >
                        chess.com/{user.chesscomUsername}
                      </span>
                    )}
                    {!user.chesscomUsername && (
                      <span
                        className="text-[11px] truncate leading-tight mt-0.5"
                        style={{ color: textSecondary }}
                      >
                        {user.email}
                      </span>
                    )}
                  </div>
                </div>
                <div className="h-px mx-3" style={{ background: dividerColor }} />
              </>
            )}

            {/* ── Guest identity header ── */}
            {isGuest && (
              <>
                <div className="flex items-center gap-3 px-4 pt-4 pb-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{
                      background: "rgba(255,255,255,0.06)",
                      border: "1.5px solid rgba(255,255,255,0.12)",
                    }}
                  >
                    <Ghost className="w-5 h-5" style={{ color: textSecondary }} />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span
                      className="text-sm font-semibold"
                      style={{ color: textPrimary }}
                    >
                      Guest
                    </span>
                    <span
                      className="text-[11px]"
                      style={{ color: textSecondary }}
                    >
                      Sign in for full access
                    </span>
                  </div>
                </div>
                <div className="h-px mx-3" style={{ background: dividerColor }} />
              </>
            )}

            {/* ── Nav section label ── */}
            <div className="px-4 pt-2.5 pb-1">
              <span
                className="text-[10px] font-bold uppercase tracking-widest"
                style={{ color: OTB_GREEN, opacity: 0.75 }}
              >
                Navigate
              </span>
            </div>

            {/* ── Nav items ── */}
            <div className="flex flex-col gap-0.5 px-2 pb-2">
              {NAV_ITEMS.map((item) => {
                const active = isActive(item);
                return (
                  <button
                    key={item.name}
                    onClick={() => handleNav(item.href)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all text-left"
                    style={active
                      ? itemActiveStyle
                      : { color: itemDefaultColor, border: "1px solid transparent" }
                    }
                    onMouseEnter={(e) => {
                      if (!active)
                        (e.currentTarget as HTMLElement).style.background =
                          isDark ? "rgba(255,255,255,0.07)" : "rgba(67,104,80,0.07)";
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
                        layoutId="mobile-drawer-active-dot"
                        className="ml-auto w-1.5 h-1.5 rounded-full"
                        style={{ background: OTB_GREEN }}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* ── Sign In CTA — guests only ── */}
            {isGuest && onSignInClick && (
              <>
                <div className="h-px mx-3" style={{ background: dividerColor }} />
                <div className="p-2">
                  <button
                    onClick={() => { setOpen(false); onSignInClick(); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all"
                    style={{
                      background: `${OTB_GREEN_GLOW}0.15)`,
                      border: `1px solid ${OTB_GREEN_GLOW}0.30)`,
                      color: isDark ? "#fff" : "#1a2e1f",
                    }}
                  >
                    <LogIn className="w-4 h-4 flex-shrink-0" style={{ color: OTB_GREEN }} />
                    <span>Sign In</span>
                  </button>
                </div>
              </>
            )}

            {/* ── Bottom swipe hint (subtle) ── */}
            <div className="flex justify-center pb-3 pt-1">
              <div
                className="w-8 h-1 rounded-full opacity-20"
                style={{ background: isDark ? "#fff" : "#1a2e1f" }}
              />
            </div>

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
