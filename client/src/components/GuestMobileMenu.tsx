/**
 * GuestMobileMenu
 *
 * A premium minimalist hamburger button + full-screen slide-up drawer
 * shown ONLY on mobile viewports for unauthenticated (guest / signed-out) users.
 *
 * Design language:
 *   - Animated three-line → X morphing icon (no icon library swap — pure SVG lines)
 *   - Frosted-glass full-screen overlay with OTB dark-green gradient
 *   - Staggered nav link entrance animation
 *   - Subtle green glow accent on active item
 *   - Tap anywhere outside the links to close
 *
 * Usage (inside AppNavBar rightSlot, mobile only, guest only):
 *   <GuestMobileMenu currentPage="Dashboard" onSignInClick={...} />
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LayoutDashboard, Building2, Swords, Video, LogIn } from "lucide-react";
import { Link, useLocation } from "wouter";

// ── Design tokens ──────────────────────────────────────────────────────────────
const OTB_GREEN      = "#4CAF50";
const OTB_GREEN_GLOW = "rgba(61,107,71,";

const NAV_ITEMS = [
  { name: "Dashboard", href: "/join",   icon: LayoutDashboard, label: "Your tournaments & games" },
  { name: "Clubs",     href: "/clubs",  icon: Building2,       label: "Browse & join chess clubs" },
  { name: "Battle",    href: "/battle", icon: Swords,          label: "Club vs club matches" },
  { name: "Analyze",   href: "/record", icon: Video,           label: "Record & analyze your games" },
] as const;

// ── Animated hamburger icon (pure SVG morphing lines) ─────────────────────────
function HamburgerIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Top line */}
      <motion.line
        x1="3" y1="6" x2="17" y2="6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        animate={open
          ? { x1: 4, y1: 4, x2: 16, y2: 16, opacity: 1 }
          : { x1: 3, y1: 6,  x2: 17, y2: 6,  opacity: 1 }
        }
        transition={{ duration: 0.22, ease: "easeInOut" }}
      />
      {/* Middle line */}
      <motion.line
        x1="3" y1="10" x2="17" y2="10"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        animate={open
          ? { opacity: 0, scaleX: 0 }
          : { opacity: 1, scaleX: 1 }
        }
        style={{ originX: "50%", originY: "50%" }}
        transition={{ duration: 0.15, ease: "easeInOut" }}
      />
      {/* Bottom line */}
      <motion.line
        x1="3" y1="14" x2="17" y2="14"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        animate={open
          ? { x1: 4, y1: 16, x2: 16, y2: 4, opacity: 1 }
          : { x1: 3, y1: 14, x2: 17, y2: 14, opacity: 1 }
        }
        transition={{ duration: 0.22, ease: "easeInOut" }}
      />
    </svg>
  );
}

// ── Props ──────────────────────────────────────────────────────────────────────
interface GuestMobileMenuProps {
  currentPage?: string;
  onSignInClick?: () => void;
}

// ── Component ──────────────────────────────────────────────────────────────────
export function GuestMobileMenu({ currentPage, onSignInClick }: GuestMobileMenuProps) {
  const [open, setOpen] = useState(false);
  const [location] = useLocation();

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // Close on route change
  useEffect(() => { setOpen(false); }, [location]);

  const isActive = (item: (typeof NAV_ITEMS)[number]) => {
    if (currentPage) return item.name === currentPage;
    return location.startsWith(item.href);
  };

  return (
    <>
      {/* ── Hamburger button ── */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close navigation menu" : "Open navigation menu"}
        aria-expanded={open}
        aria-controls="guest-mobile-drawer"
        className="relative flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-200 select-none"
        style={{
          color: open ? OTB_GREEN : "rgba(255,255,255,0.75)",
          background: open
            ? `${OTB_GREEN_GLOW}0.18)`
            : "rgba(255,255,255,0.06)",
          border: `1px solid ${open ? OTB_GREEN_GLOW + "0.35)" : "rgba(255,255,255,0.10)"}`,
        }}
      >
        <HamburgerIcon open={open} />
      </button>

      {/* ── Full-screen drawer ── */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              key="guest-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="fixed inset-0 z-[9990]"
              style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }}
              onClick={() => setOpen(false)}
            />

            {/* Drawer panel — slides up from bottom on mobile */}
            <motion.div
              id="guest-mobile-drawer"
              key="guest-drawer"
              role="dialog"
              aria-modal="true"
              aria-label="Navigation menu"
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 34, mass: 0.9 }}
              className="fixed bottom-0 left-0 right-0 z-[9999] rounded-t-3xl overflow-hidden"
              style={{
                background: "linear-gradient(160deg, oklch(0.16 0.06 145) 0%, oklch(0.12 0.04 145) 100%)",
                border: `1px solid ${OTB_GREEN_GLOW}0.22)`,
                borderBottom: "none",
                boxShadow: `0 -8px 48px rgba(0,0,0,0.55), 0 0 32px ${OTB_GREEN_GLOW}0.10)`,
              }}
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div
                  className="w-10 h-1 rounded-full"
                  style={{ background: "rgba(255,255,255,0.15)" }}
                />
              </div>

              {/* Header */}
              <div className="px-6 pt-2 pb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: OTB_GREEN }}>
                    Navigation
                  </p>
                  <p className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
                    ChessOTB.club
                  </p>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-xl"
                  style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.45)" }}
                  aria-label="Close menu"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <line x1="2" y1="2" x2="12" y2="12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                    <line x1="12" y1="2" x2="2" y2="12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              {/* Divider */}
              <div className="mx-6 h-px" style={{ background: `${OTB_GREEN_GLOW}0.15)` }} />

              {/* Nav links */}
              <nav className="px-4 py-4 space-y-1.5">
                {NAV_ITEMS.map((item, i) => {
                  const active = isActive(item);
                  return (
                    <motion.div
                      key={item.name}
                      initial={{ opacity: 0, x: -16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.06 + i * 0.055, type: "spring", stiffness: 380, damping: 28 }}
                    >
                      <Link href={item.href}>
                        <a
                          onClick={() => setOpen(false)}
                          className="flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-150 group"
                          style={
                            active
                              ? {
                                  background: `${OTB_GREEN_GLOW}0.18)`,
                                  border: `1px solid ${OTB_GREEN_GLOW}0.30)`,
                                  boxShadow: `0 0 16px ${OTB_GREEN_GLOW}0.10)`,
                                }
                              : {
                                  background: "rgba(255,255,255,0.03)",
                                  border: "1px solid rgba(255,255,255,0.06)",
                                }
                          }
                        >
                          {/* Icon container */}
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{
                              background: active
                                ? `${OTB_GREEN_GLOW}0.22)`
                                : "rgba(255,255,255,0.05)",
                              border: `1px solid ${active ? OTB_GREEN_GLOW + "0.28)" : "rgba(255,255,255,0.08)"}`,
                            }}
                          >
                            <item.icon
                              size={18}
                              style={{ color: active ? OTB_GREEN : "rgba(255,255,255,0.50)" }}
                            />
                          </div>

                          {/* Text */}
                          <div className="flex-1 min-w-0">
                            <p
                              className="text-sm font-semibold leading-tight"
                              style={{ color: active ? "#fff" : "rgba(255,255,255,0.75)" }}
                            >
                              {item.name}
                            </p>
                            <p
                              className="text-[11px] mt-0.5 truncate"
                              style={{ color: active ? "rgba(255,255,255,0.50)" : "rgba(255,255,255,0.28)" }}
                            >
                              {item.label}
                            </p>
                          </div>

                          {/* Active indicator dot */}
                          {active && (
                            <motion.div
                              layoutId="guest-active-dot"
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ background: OTB_GREEN, boxShadow: `0 0 8px ${OTB_GREEN}` }}
                            />
                          )}
                        </a>
                      </Link>
                    </motion.div>
                  );
                })}
              </nav>

              {/* Divider */}
              <div className="mx-6 h-px" style={{ background: `${OTB_GREEN_GLOW}0.12)` }} />

              {/* Sign In CTA */}
              <motion.div
                className="px-4 py-4"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.32, duration: 0.22 }}
              >
                <button
                  onClick={() => { setOpen(false); onSignInClick?.(); }}
                  className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl text-sm font-semibold transition-all duration-200 active:scale-[0.98]"
                  style={{
                    background: `linear-gradient(135deg, ${OTB_GREEN_GLOW}0.30) 0%, ${OTB_GREEN_GLOW}0.18) 100%)`,
                    border: `1px solid ${OTB_GREEN_GLOW}0.40)`,
                    color: "#fff",
                    boxShadow: `0 0 20px ${OTB_GREEN_GLOW}0.15)`,
                  }}
                >
                  <LogIn size={16} style={{ color: OTB_GREEN }} />
                  Sign in to your account
                </button>
              </motion.div>

              {/* Safe area spacer for iOS home indicator */}
              <div className="h-safe-bottom" style={{ paddingBottom: "env(safe-area-inset-bottom, 12px)" }} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
