/**
 * AppNavBar — shared animated navigation bar for all pages.
 *
 * Wraps AnimeNavBar with the standard 4-item nav (Dashboard, Clubs, Battle, Analyze),
 * smart Dashboard routing, auth-aware right slot, and theme toggle.
 *
 * On desktop: full animated pill nav centred + theme toggle + avatar dropdown (right).
 * On mobile:  logo (left) + theme toggle + avatar dropdown (right).
 *             Nav links are inside the avatar dropdown — no hamburger button.
 *
 * Usage:
 *   <AppNavBar defaultActive="Dashboard" />
 *   <AppNavBar defaultActive="Clubs" />
 */

import { useState } from "react";
import { Link } from "wouter";
import { Building2, Swords, Video, LayoutDashboard } from "lucide-react";
import { AnimeNavBar } from "@/components/ui/anime-navbar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuthContext } from "@/context/AuthContext";
import { listTournaments, hasDirectorSession, resolveTournament } from "@/lib/tournamentRegistry";
import { getAllRegistrations } from "@/lib/registrationStore";
import { DashboardDropdown } from "@/components/DashboardDropdown";
import { AvatarNavDropdown } from "@/components/AvatarNavDropdown";
import { GuestMobileMenu } from "@/components/GuestMobileMenu";

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

function getDashboardTooltip(): string | undefined {
  const allTournaments = listTournaments();
  const directed = allTournaments.find((t) => hasDirectorSession(t.id));
  if (directed) {
    const name = directed.name || directed.id;
    return `${name} — Director View`;
  }

  const registrations = getAllRegistrations();
  if (registrations.length > 0) {
    const reg = registrations[0];
    const config = resolveTournament(reg.tournamentId);
    const name = config?.name || reg.tournamentId;
    return `${name} — Player View`;
  }

  return undefined;
}

export function AppNavBar({ defaultActive = "Dashboard", onSignInClick, className }: AppNavBarProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { user } = useAuthContext();
  const [activeTab, setActiveTab] = useState(defaultActive);

  const dashboardUrl     = getDashboardUrl();
  const dashboardTooltip = getDashboardTooltip();

  const navItems = [
    {
      name: "Dashboard",
      url: dashboardUrl,
      icon: LayoutDashboard,
      tooltip: dashboardTooltip,
      dropdown: <DashboardDropdown />,
      onClick: (e: React.MouseEvent) => {
        e.preventDefault();
        window.location.href = getDashboardUrl();
      },
    },
    { name: "Clubs",   url: "/clubs",   icon: Building2 },
    { name: "Battle",  url: "/battle",  icon: Swords },
    { name: "Analyze", url: "/record",  icon: Video },
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

  // Right slot:
  //   Desktop / signed-in: theme toggle + avatar dropdown
  //   Mobile + guest:      theme toggle + hamburger menu (GuestMobileMenu)
  //                        (avatar dropdown hidden — no avatar to tap)
  const isGuest = !user || user.isGuest;

  const rightSlotEl = (
    <div className="flex items-center gap-2">
      <ThemeToggle />
      {/* Hamburger — mobile only, unauthenticated only */}
      {isGuest && (
        <div className="flex md:hidden">
          <GuestMobileMenu
            currentPage={activeTab}
            onSignInClick={onSignInClick}
          />
        </div>
      )}
      {/* Avatar dropdown — always on desktop; on mobile only when signed in */}
      <div className={isGuest ? "hidden md:flex" : "flex"}>
        <AvatarNavDropdown
          currentPage={activeTab}
          onSignInClick={onSignInClick}
          dashboardUrl={dashboardUrl}
        />
      </div>
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
