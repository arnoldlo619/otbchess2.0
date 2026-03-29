/**
 * GuestMobileMenu
 *
 * A simple hamburger button + compact dropdown menu for unauthenticated
 * mobile users. Shows Clubs, Battle, Analyze, and Sign In in a clean list.
 */

import { useState, useEffect, useRef } from "react";
import { Building2, Swords, Video, LogIn } from "lucide-react";
import { Link, useLocation } from "wouter";

const NAV_ITEMS = [
  { name: "Clubs",   href: "/clubs",  icon: Building2 },
  { name: "Battle",  href: "/battle", icon: Swords },
  { name: "Analyze", href: "/record", icon: Video },
] as const;

interface GuestMobileMenuProps {
  currentPage?: string;
  onSignInClick?: () => void;
}

export function GuestMobileMenu({ onSignInClick }: GuestMobileMenuProps) {
  const [open, setOpen] = useState(false);
  const [location] = useLocation();
  const ref = useRef<HTMLDivElement>(null);

  // Close on route change
  useEffect(() => { setOpen(false); }, [location]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative md:hidden">
      {/* Hamburger button */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        className="flex items-center justify-center w-9 h-9 rounded-xl transition-colors duration-150"
        style={{
          color: open ? "#4CAF50" : "rgba(255,255,255,0.75)",
          background: open ? "rgba(61,107,71,0.20)" : "rgba(255,255,255,0.07)",
          border: `1px solid ${open ? "rgba(61,107,71,0.40)" : "rgba(255,255,255,0.10)"}`,
        }}
      >
        {/* Simple 3-line / X icon */}
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          {open ? (
            <>
              <line x1="3" y1="3" x2="15" y2="15" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
              <line x1="15" y1="3" x2="3" y2="15" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            </>
          ) : (
            <>
              <line x1="3" y1="5"  x2="15" y2="5"  stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
              <line x1="3" y1="9"  x2="15" y2="9"  stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
              <line x1="3" y1="13" x2="15" y2="13" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            </>
          )}
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-48 rounded-2xl overflow-hidden z-[9999]"
          style={{
            background: "oklch(0.17 0.06 145 / 0.97)",
            border: "1px solid rgba(61,107,71,0.25)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.45)",
          }}
        >
          {/* Nav links */}
          <div className="py-1.5">
            {NAV_ITEMS.map(({ name, href, icon: Icon }) => (
              <Link key={name} href={href}>
                <a
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors duration-100"
                  style={{ color: location.startsWith(href) ? "#fff" : "rgba(255,255,255,0.70)" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.07)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <Icon size={15} style={{ color: location.startsWith(href) ? "#4CAF50" : "rgba(255,255,255,0.45)", flexShrink: 0 }} />
                  {name}
                </a>
              </Link>
            ))}
          </div>

          {/* Divider */}
          <div className="mx-3 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />

          {/* Sign In */}
          <div className="py-1.5">
            <button
              onClick={() => { setOpen(false); onSignInClick?.(); }}
              className="flex items-center gap-3 w-full px-4 py-2.5 text-sm font-semibold transition-colors duration-100"
              style={{ color: "#4CAF50" }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(76,175,80,0.08)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <LogIn size={15} style={{ flexShrink: 0 }} />
              Sign In
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
