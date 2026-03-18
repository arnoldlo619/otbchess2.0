/**
 * MinimalTournamentNav — clean, minimal header for tournament dashboard pages.
 *
 * Shows only:
 *   - Back-to-dashboard chevron (mobile only, left of logo) — when backHref is provided
 *   - OTB!! logo (far left, links to home)
 *   - Tournament name (centered, subtle, truncated)
 *   - Theme toggle + sign-in / user menu (far right)
 *
 * No animated nav pills, no Dashboard/Clubs/Battle/Analyze links.
 * Used on Director.tsx and Tournament.tsx for a focused, distraction-free experience.
 */

import { useState } from "react";
import { Link } from "wouter";
import { LogIn, Ghost, Crown, X, ChevronLeft, LayoutDashboard } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuthContext } from "@/context/AuthContext";

const LOGO_URL =
  "https://files.manuscdn.com/user_upload_by_module/session_file/117675823/bWANpVvGVfpfXSpZ.png";

interface MinimalTournamentNavProps {
  onSignInClick?: () => void;
  tournamentName?: string;
  /** If provided, shows a mobile-only back button on the left side of the nav */
  backHref?: string;
  /** Label for the back button. Defaults to "Dashboard" */
  backLabel?: string;
}

export function MinimalTournamentNav({
  onSignInClick,
  tournamentName,
  backHref,
  backLabel = "Dashboard",
}: MinimalTournamentNavProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { user, logout } = useAuthContext();
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-[9999] h-14 flex items-center px-3 sm:px-6 border-b transition-colors ${
        isDark
          ? "bg-[oklch(0.18_0.05_145)]/90 border-white/08 backdrop-blur-md"
          : "bg-white/90 border-black/08 backdrop-blur-md"
      }`}
    >
      {/* Left slot — back button (mobile) + logo */}
      <div className="flex-1 flex items-center gap-1.5">
        {/* Mobile back-to-dashboard button — only shown when backHref is provided */}
        {backHref && (
          <Link href={backHref}>
            <button
              className={`sm:hidden flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 border ${
                isDark
                  ? "bg-[#4CAF50]/12 border-[#4CAF50]/25 text-[#4CAF50] hover:bg-[#4CAF50]/22"
                  : "bg-[#3D6B47]/08 border-[#3D6B47]/20 text-[#3D6B47] hover:bg-[#3D6B47]/15"
              }`}
              title={`Back to ${backLabel}`}
            >
              <ChevronLeft className="w-3.5 h-3.5 -ml-0.5" />
              <span>{backLabel}</span>
            </button>
          </Link>
        )}

        {/* Logo — always visible, links to home */}
        <Link href="/" className="flex items-center flex-shrink-0">
          <img
            src={LOGO_URL}
            alt="OTB Chess"
            className={`h-7 w-auto object-contain transition-opacity hover:opacity-80 ${isDark ? "nav-logo-dark" : ""}`}
            draggable={false}
          />
        </Link>
      </div>

      {/* Tournament name — centered */}
      {tournamentName && (
        <div className="flex-1 flex items-center justify-center min-w-0 px-2">
          <span
            className={`text-sm font-semibold tracking-tight truncate max-w-[160px] sm:max-w-xs text-center ${
              isDark ? "text-white/60" : "text-black/50"
            }`}
            title={tournamentName}
          >
            {tournamentName}
          </span>
        </div>
      )}

      {/* Right slot — theme toggle + sign-in / user menu */}
      <div className="flex-1 flex items-center justify-end gap-2">
        <ThemeToggle />

        {!user && (
          <div className="relative group">
            <button
              onClick={onSignInClick}
              aria-label="Sign In"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                isDark
                  ? "border-white/20 text-white/70 hover:text-white hover:bg-white/10"
                  : "border-black/15 text-black/60 hover:text-black hover:bg-black/05"
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign In</span>
            </button>
          </div>
        )}

        {user && (
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all border ${
                isDark
                  ? user.isGuest
                    ? "border-amber-500/40 text-amber-300 hover:bg-amber-500/10 bg-black/30"
                    : "border-white/20 text-white/80 hover:bg-white/10 bg-black/30"
                  : user.isGuest
                  ? "border-amber-400/50 text-amber-700 hover:bg-amber-50 bg-white"
                  : "border-black/15 text-black/70 hover:bg-black/05 bg-white"
              }`}
            >
              {user.isGuest ? (
                <Ghost className="w-4 h-4" />
              ) : (
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold bg-[#3D6B47] text-white flex-shrink-0">
                  {(user.displayName || user.email).charAt(0).toUpperCase()}
                </span>
              )}
              <span className="hidden sm:inline max-w-[80px] truncate">
                {user.displayName || user.email}
              </span>
              {user.isGuest && <span className="hidden sm:inline text-xs opacity-60">(guest)</span>}
            </button>

            {userMenuOpen && (
              <div
                className={`absolute right-0 top-full mt-2 w-52 rounded-xl shadow-xl border z-50 overflow-hidden ${
                  isDark
                    ? "bg-[oklch(0.22_0.06_145)] border-white/10"
                    : "bg-white border-black/10"
                }`}
                onMouseLeave={() => setUserMenuOpen(false)}
              >
                {!user.isGuest && (
                  <Link
                    href="/profile"
                    className={`flex items-center gap-2 px-4 py-3 text-sm transition-colors ${
                      isDark ? "text-white/80 hover:bg-white/08" : "text-black/70 hover:bg-black/05"
                    }`}
                    onClick={() => setUserMenuOpen(false)}
                  >
                    <Crown className="w-4 h-4" /> My Profile
                  </Link>
                )}
                {user.isGuest && (
                  <button
                    onClick={() => { setUserMenuOpen(false); onSignInClick?.(); }}
                    className="flex items-center gap-2 w-full px-4 py-3 text-sm text-amber-500 hover:bg-amber-500/10 transition-colors"
                  >
                    <Crown className="w-4 h-4" /> Create Free Account
                  </button>
                )}
                <button
                  onClick={() => { logout(); setUserMenuOpen(false); }}
                  className={`flex items-center gap-2 w-full px-4 py-3 text-sm text-red-400 transition-colors border-t ${
                    isDark ? "hover:bg-white/08 border-white/08" : "hover:bg-red-50 border-black/08"
                  }`}
                >
                  <X className="w-4 h-4" /> Sign Out
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
