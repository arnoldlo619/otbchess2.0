/**
 * MobileNavDrawer — hamburger menu for all mobile users.
 *
 * Renders a ☰ / ✕ button that opens a slide-out drawer from the right
 * containing the four primary nav links (League, Tournaments, Clubs, Tools)
 * plus a Sign In entry for guests.
 *
 * Usage:
 *   <MobileNavDrawer currentPage="Clubs" onSignInClick={openAuthModal} />
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Trophy, LayoutDashboard, Building2, GraduationCap, LogIn } from "lucide-react";
import { useLocation } from "wouter";
import { useTheme } from "@/contexts/ThemeContext";

const NAV_ITEMS = [
  { name: "League",      href: "/league-demo", icon: Trophy },
  { name: "Tournaments", href: "/join",         icon: LayoutDashboard },
  { name: "Clubs",       href: "/clubs",        icon: Building2 },
  { name: "Tools",       href: "/training",     icon: GraduationCap },
] as const;

const OTB_GREEN      = "#4CAF50";
const OTB_GREEN_GLOW = "rgba(61,107,71,";

interface MobileNavDrawerProps {
  /** Name of the current page — used to highlight the active item */
  currentPage?: string;
  /** Called when the user taps Sign In */
  onSignInClick?: () => void;
  /** Whether the current user is a guest (unauthenticated) */
  isGuest?: boolean;
  /** Extra class names for the outer wrapper */
  className?: string;
}

export function MobileNavDrawer({
  currentPage,
  onSignInClick,
  isGuest = true,
  className = "",
}: MobileNavDrawerProps) {
  const [open, setOpen] = useState(false);
  const [location, navigate] = useLocation();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const isActive = (item: (typeof NAV_ITEMS)[number]) => {
    if (currentPage) return item.name === currentPage;
    return location.startsWith(item.href);
  };

  const handleNav = (href: string) => {
    setOpen(false);
    navigate(href);
  };

  const drawerBg = isDark
    ? "oklch(0.16 0.06 145 / 0.97)"
    : "oklch(0.97 0.02 145 / 0.97)";

  const itemActiveStyle = isDark
    ? { background: `${OTB_GREEN_GLOW}0.20)`, border: `1px solid ${OTB_GREEN_GLOW}0.28)`, color: "#fff" }
    : { background: "rgba(67,104,80,0.12)", border: "1px solid rgba(67,104,80,0.25)", color: "#1a2e1f" };

  const itemDefaultColor = isDark ? "rgba(255,255,255,0.65)" : "rgba(30,50,35,0.65)";
  const dividerColor = isDark ? `${OTB_GREEN_GLOW}0.18)` : "rgba(67,104,80,0.15)";

  return (
    <div className={`relative ${className}`}>
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

      {/* ── Backdrop ── */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[9990]"
            style={{ background: "rgba(0,0,0,0.40)" }}
            onClick={() => setOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Slide-out drawer (from right) ── */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="drawer"
            initial={{ opacity: 0, x: 24, scale: 0.97 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 24, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className="absolute right-0 top-full mt-2 z-[9999] w-56 rounded-2xl overflow-hidden shadow-2xl"
            style={{
              background: drawerBg,
              border: `1px solid ${OTB_GREEN_GLOW}0.22)`,
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              boxShadow: `0 8px 40px rgba(0,0,0,0.45), 0 0 28px ${OTB_GREEN_GLOW}0.10)`,
            }}
          >
            {/* Section label */}
            <div className="px-4 pt-3 pb-1">
              <span
                className="text-[10px] font-bold uppercase tracking-widest"
                style={{ color: OTB_GREEN, opacity: 0.8 }}
              >
                Navigate
              </span>
            </div>

            <div className="flex flex-col gap-0.5 px-2 pb-2">
              {NAV_ITEMS.map((item) => {
                const active = isActive(item);
                return (
                  <button
                    key={item.name}
                    onClick={() => handleNav(item.href)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all text-left"
                    style={active ? itemActiveStyle : { color: itemDefaultColor, border: "1px solid transparent" }}
                    onMouseEnter={(e) => {
                      if (!active) (e.currentTarget as HTMLElement).style.background = isDark ? "rgba(255,255,255,0.07)" : "rgba(67,104,80,0.07)";
                    }}
                    onMouseLeave={(e) => {
                      if (!active) (e.currentTarget as HTMLElement).style.background = "transparent";
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

            {/* Sign In — guests only */}
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

            <div className="h-px mx-3 mb-2" style={{ background: dividerColor }} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
