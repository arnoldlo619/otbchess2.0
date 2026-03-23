/**
 * MobileNavDrawer — shared hamburger menu for all inner-page headers.
 *
 * Renders a ☰ / ✕ button that opens a slide-down drawer with the four
 * primary nav links: Dashboard, Clubs, Battle, Analyze.
 *
 * Usage:
 *   <MobileNavDrawer currentPage="Battle" />
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, LayoutDashboard, Building2, Swords, Video } from "lucide-react";
import { Link, useLocation } from "wouter";

const NAV_ITEMS = [
  { name: "Dashboard", href: "/join",    icon: LayoutDashboard },
  { name: "Clubs",     href: "/clubs",   icon: Building2 },
  { name: "Battle",    href: "/battle",  icon: Swords },
  { name: "Analyze",   href: "/record",  icon: Video },
] as const;

const OTB_GREEN      = "#4CAF50";
const OTB_GREEN_GLOW = "rgba(61,107,71,";

interface MobileNavDrawerProps {
  /** Name of the current page — used to highlight the active item */
  currentPage?: string;
  /** Extra class names for the outer wrapper */
  className?: string;
}

export function MobileNavDrawer({ currentPage, className = "" }: MobileNavDrawerProps) {
  const [open, setOpen] = useState(false);
  const [location] = useLocation();

  const isActive = (item: (typeof NAV_ITEMS)[number]) => {
    if (currentPage) return item.name === currentPage;
    return location.startsWith(item.href);
  };

  return (
    <div className={`relative ${className}`}>
      {/* ── Hamburger / Close button ── */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        className="flex items-center justify-center w-9 h-9 rounded-xl text-white/70 hover:text-white hover:bg-white/10 active:bg-white/15 transition-all"
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
            style={{ background: "rgba(0,0,0,0.45)" }}
            onClick={() => setOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Drawer ── */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="drawer"
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 340, damping: 30 }}
            className="absolute right-0 top-full mt-2 z-[9999] w-52 rounded-2xl overflow-hidden shadow-2xl"
            style={{
              background: "oklch(0.18 0.06 145 / 0.97)",
              border: `1px solid ${OTB_GREEN_GLOW}0.22)`,
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 24px ${OTB_GREEN_GLOW}0.12)`,
            }}
          >
            {/* Divider line at top */}
            <div className="h-px mx-3 mt-2" style={{ background: `${OTB_GREEN_GLOW}0.20)` }} />

            <div className="flex flex-col gap-0.5 p-2">
              {NAV_ITEMS.map((item) => {
                const active = isActive(item);
                return (
                  <Link key={item.name} href={item.href}>
                    <a
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all"
                      style={
                        active
                          ? {
                              background: `${OTB_GREEN_GLOW}0.20)`,
                              border: `1px solid ${OTB_GREEN_GLOW}0.28)`,
                              color: "#fff",
                            }
                          : { color: "rgba(255,255,255,0.65)", border: "1px solid transparent" }
                      }
                      onMouseEnter={(e) => {
                        if (!active) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)";
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
                          layoutId="mobile-drawer-dot"
                          className="ml-auto w-1.5 h-1.5 rounded-full"
                          style={{ background: OTB_GREEN }}
                        />
                      )}
                    </a>
                  </Link>
                );
              })}
            </div>

            <div className="h-px mx-3 mb-2" style={{ background: `${OTB_GREEN_GLOW}0.12)` }} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
