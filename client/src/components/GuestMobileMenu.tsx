/**
 * GuestMobileMenu
 *
 * A simple hamburger button + compact dropdown menu for unauthenticated
 * mobile users. Shows Clubs, Training, Chess Clock, and Sign In in a clean list.
 *
 * The dropdown is rendered via ReactDOM.createPortal at document.body to
 * escape any backdrop-filter / transform stacking contexts in parent navbars.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Building2, GraduationCap, LogIn, Trophy, Shield, Timer, Sun, Moon } from "lucide-react";
import { useLocation } from "wouter";
import { useActiveTournament } from "@/hooks/useActiveTournament";
import { useTheme } from "@/contexts/ThemeContext";

const NAV_ITEMS = [
  { name: "League",      href: "/league-demo", icon: Trophy },
  { name: "Clubs",       href: "/clubs",       icon: Building2 },
  { name: "Tools",   href: "/training",    icon: GraduationCap },
  { name: "Chess Clock",href: "/clock",       icon: Timer },
] as const;

interface GuestMobileMenuProps {
  currentPage?: string;
  onSignInClick?: () => void;
}

export function GuestMobileMenu({ onSignInClick }: GuestMobileMenuProps) {
  const [open, setOpen] = useState(false);
  const [location] = useLocation();
  const activeTournament = useActiveTournament();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Position state for the dropdown (computed from button position)
  const [dropdownPos, setDropdownPos] = useState<{ top: number; right: number }>({ top: 0, right: 16 });

  // Close on route change
  useEffect(() => { setOpen(false); }, [location]);

  // Compute dropdown position from button bounding rect
  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setDropdownPos({
      top: rect.bottom + 8,
      right: window.innerWidth - rect.right,
    });
  }, []);

  // Close on outside click (checks both button and portal dropdown)
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const inButton = buttonRef.current?.contains(target);
      const inDropdown = dropdownRef.current?.contains(target);
      if (!inButton && !inDropdown) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleOpen = () => {
    updatePosition();
    setOpen((v) => !v);
  };

  const dropdown = (
    <div
      ref={dropdownRef}
      style={{
        position: "fixed",
        top: dropdownPos.top,
        right: dropdownPos.right,
        width: 220,
        zIndex: 99999,
        borderRadius: 16,
        overflow: "hidden",
        background: isDark ? "oklch(0.17 0.06 145 / 0.97)" : "rgba(255,255,255,0.97)",
        border: isDark ? "1px solid rgba(61,107,71,0.25)" : "1px solid rgba(0,0,0,0.08)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        boxShadow: isDark ? "0 8px 32px rgba(0,0,0,0.45)" : "0 8px 32px rgba(0,0,0,0.12)",
      }}
    >
      {/* Active Tournament — shown first if user has one */}
      {activeTournament && (
        <>
          <div style={{ paddingTop: 6, paddingBottom: 6 }}>
            <a
              href={activeTournament.href}
              onClick={(e) => { e.preventDefault(); setOpen(false); window.location.href = activeTournament.href; }}
              className="flex items-center gap-3 px-4 py-3 text-sm font-semibold transition-colors duration-100"
              style={{ color: "#4CAF50" }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(76,175,80,0.10)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(76,175,80,0.18)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {activeTournament.role === "director"
                  ? <Shield size={14} style={{ color: "#4CAF50" }} />
                  : <Trophy size={14} style={{ color: "#4CAF50" }} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(76,175,80,0.7)", marginBottom: 1 }}>
                  {activeTournament.status === "in_progress" ? "● LIVE" : activeTournament.role === "director" ? "Your Tournament" : "Active Tournament"}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {activeTournament.name}
                </div>
              </div>
            </a>
          </div>
          <div style={{ margin: "0 12px", height: 1, background: "rgba(255,255,255,0.08)" }} />
        </>
      )}

      {/* Nav links */}
      <div style={{ paddingTop: 6, paddingBottom: 6 }}>
        {NAV_ITEMS.map(({ name, href, icon: Icon }) => (
          <a
            key={name}
            href={href}
            onClick={(e) => { e.preventDefault(); setOpen(false); window.location.href = href; }}
            className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors duration-100"
            style={{ color: location.startsWith(href) ? (isDark ? "#fff" : "#111827") : (isDark ? "rgba(255,255,255,0.70)" : "#374151") }}
            onMouseEnter={e => (e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            <Icon size={15} style={{ color: location.startsWith(href) ? "#4CAF50" : (isDark ? "rgba(255,255,255,0.45)" : "#6B7280"), flexShrink: 0 }} />
            {name}
          </a>
        ))}
      </div>

      {/* Divider */}
      <div style={{ margin: "0 12px", height: 1, background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)" }} />

      {/* Sign In */}
      <div style={{ paddingTop: 6, paddingBottom: 6 }}>
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

      {/* Divider */}
      <div style={{ margin: "0 12px", height: 1, background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)" }} />

      {/* Appearance toggle */}
      <div style={{ paddingTop: 6, paddingBottom: 6 }}>
        <button
          onClick={() => { toggleTheme?.(); }}
          className="flex items-center gap-3 w-full px-4 py-2.5 text-sm font-medium transition-colors duration-100"
          style={{ color: isDark ? "rgba(255,255,255,0.70)" : "#374151" }}
          onMouseEnter={e => (e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)")}
          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
        >
          {isDark
            ? <Sun size={15} style={{ color: "rgba(255,255,255,0.45)", flexShrink: 0 }} />
            : <Moon size={15} style={{ color: "#6B7280", flexShrink: 0 }} />}
          <span>{isDark ? "Light Mode" : "Dark Mode"}</span>
          {/* Mini pill toggle */}
          <div
            style={{
              marginLeft: "auto",
              width: 28,
              height: 15,
              borderRadius: 999,
              background: isDark ? "rgba(255,255,255,0.12)" : "#436850",
              display: "flex",
              alignItems: "center",
              flexShrink: 0,
              padding: "0 2px",
            }}
          >
            <div
              style={{
                width: 11,
                height: 11,
                borderRadius: "50%",
                background: "#fff",
                boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                transform: isDark ? "translateX(0)" : "translateX(13px)",
                transition: "transform 0.2s",
              }}
            />
          </div>
        </button>
      </div>
    </div>
  );

  return (
    <div className="relative md:hidden">
      {/* Hamburger button */}
      <button
        ref={buttonRef}
        onClick={handleOpen}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        className="flex items-center justify-center w-9 h-9 rounded-xl transition-colors duration-150"
        style={{
          color: open ? "#4CAF50" : "rgba(255,255,255,0.75)",
          background: open ? "rgba(61,107,71,0.20)" : "rgba(255,255,255,0.07)",
          border: `1px solid ${open ? "rgba(61,107,71,0.40)" : "rgba(255,255,255,0.10)"}`,
        }}
      >
        {/* 3-line / X icon */}
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

      {/* Dropdown rendered via portal to escape backdrop-filter stacking context */}
      {open && typeof document !== "undefined" && createPortal(dropdown, document.body)}
    </div>
  );
}
// test
// test
// test
// test
