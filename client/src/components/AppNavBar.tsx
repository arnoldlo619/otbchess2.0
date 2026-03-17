/**
 * AppNavBar — shared animated navigation bar for all pages.
 *
 * Wraps AnimeNavBar with the standard 4-item nav (Dashboard, Clubs, Battle, Analyze),
 * smart Dashboard routing, auth-aware right slot, and theme toggle.
 *
 * Usage:
 *   <AppNavBar defaultActive="Dashboard" />
 *   <AppNavBar defaultActive="Clubs" />
 */

import { useState } from "react";
import { Link } from "wouter";
import { Building2, Swords, Video, LayoutDashboard, LogIn, Ghost, Crown, X } from "lucide-react";
import { AnimeNavBar } from "@/components/ui/anime-navbar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuthContext } from "@/context/AuthContext";
import { listTournaments, hasDirectorSession, resolveTournament } from "@/lib/tournamentRegistry";
import { getAllRegistrations } from "@/lib/registrationStore";

const LOGO_URL =
  "https://files.manuscdn.com/user_upload_by_module/session_file/117675823/bWANpVvGVfpfXSpZ.png";

interface AppNavBarProps {
  /** Which nav tab should be highlighted on mount. Defaults to "Dashboard". */
  defaultActive?: string;
  /** Called when the user opens the auth modal (e.g. clicks Sign In). */
  onSignInClick?: () => void;
  /** Extra class names for the outer wrapper. */
  className?: string;
}

/**
 * Resolve the smartest Dashboard destination for the current device:
 *  1. Most recently created tournament where this device has a director session → /tournament/:id/manage
 *  2. Most recently joined tournament (participant registration)               → /tournament/:id
 *  3. Fallback                                                                 → /join
 */
function getDashboardUrl(): string {
  const allTournaments = listTournaments();
  const directed = allTournaments.find((t) => hasDirectorSession(t.id));
  if (directed) return `/tournament/${directed.id}/manage`;

  const registrations = getAllRegistrations();
  if (registrations.length > 0) {
    const reg = registrations[0];
    const config = resolveTournament(reg.tournamentId);
    const slug = config?.id ?? reg.tournamentId;
    return `/tournament/${slug}`;
  }

  return "/join";
}

export function AppNavBar({ defaultActive = "Dashboard", onSignInClick, className }: AppNavBarProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { user, logout } = useAuthContext();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(defaultActive);

  const dashboardUrl = getDashboardUrl();

  const navItems = [
    {
      name: "Dashboard",
      url: dashboardUrl,
      icon: LayoutDashboard,
      onClick: (e: React.MouseEvent) => {
        e.preventDefault();
        window.location.href = getDashboardUrl();
      },
    },
    { name: "Clubs", url: "/clubs", icon: Building2 },
    { name: "Battle", url: "/battle", icon: Swords },
    { name: "Analyze", url: "/record", icon: Video },
  ];

  const logoEl = (
    <Link href="/" className="flex items-center">
      <img
        src={LOGO_URL}
        alt="OTB Chess"
        className={`h-8 w-auto object-contain transition-opacity hover:opacity-80 ${isDark ? "nav-logo-dark" : ""}`}
        draggable={false}
      />
    </Link>
  );

  const rightSlotEl = (
    <div className="flex items-center gap-3">
      <ThemeToggle />
      {!user && (
        <div className="relative group">
          <button
            onClick={onSignInClick}
            aria-label="Sign In"
            className="w-9 h-9 rounded-full flex items-center justify-center border border-white/20 text-white/70 hover:text-white hover:bg-white/10 transition-all"
          >
            <LogIn className="w-4 h-4" />
          </button>
          <span className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium text-white bg-black/70 backdrop-blur-sm border border-white/10 opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all duration-200 z-50">
            Sign In
          </span>
        </div>
      )}
      {user && (
        <div className="relative">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all border bg-black/40 backdrop-blur-md ${
              user.isGuest
                ? "border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
                : "border-white/20 text-white/80 hover:bg-white/10"
            }`}
          >
            {user.isGuest ? (
              <Ghost className="w-4 h-4" />
            ) : (
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold bg-[#3D6B47] text-white">
                {(user.displayName || user.email).charAt(0).toUpperCase()}
              </span>
            )}
            <span className="hidden sm:inline max-w-[100px] truncate">
              {user.displayName || user.email}
            </span>
            {user.isGuest && <span className="hidden sm:inline text-xs opacity-60">(guest)</span>}
          </button>
          {userMenuOpen && (
            <div
              className="absolute right-0 top-full mt-2 w-52 rounded-xl shadow-xl border z-50 overflow-hidden bg-[oklch(0.22_0.06_145)] border-white/10"
              onMouseLeave={() => setUserMenuOpen(false)}
            >
              {!user.isGuest && (
                <Link
                  href="/profile"
                  className="flex items-center gap-2 px-4 py-3 text-sm text-white/80 hover:bg-white/08 transition-colors"
                  onClick={() => setUserMenuOpen(false)}
                >
                  <Crown className="w-4 h-4" /> My Profile
                </Link>
              )}
              {user.isGuest && (
                <button
                  onClick={() => { setUserMenuOpen(false); onSignInClick?.(); }}
                  className="flex items-center gap-2 w-full px-4 py-3 text-sm text-amber-300 hover:bg-amber-500/10 transition-colors"
                >
                  <Crown className="w-4 h-4" /> Create Free Account
                </button>
              )}
              <button
                onClick={() => { logout(); setUserMenuOpen(false); }}
                className="flex items-center gap-2 w-full px-4 py-3 text-sm text-red-400 hover:bg-white/08 border-t border-white/08 transition-colors"
              >
                <X className="w-4 h-4" /> Sign Out
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <AnimeNavBar
      items={navItems}
      defaultActive={activeTab}
      logo={logoEl}
      rightSlot={rightSlotEl}
      onActiveChange={setActiveTab}
      className={className}
    />
  );
}
