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
 *   <AppNavBar defaultActive="Tournaments" />
 *   <AppNavBar defaultActive="Clubs" />
 */

import { useState } from "react";
import { Link } from "wouter";
import { Building2, Swords, Video, LayoutDashboard } from "lucide-react";
import { AnimeNavBar } from "@/components/ui/anime-navbar";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuthContext } from "@/context/AuthContext";
import { listTournaments, hasDirectorSession, resolveTournament } from "@/lib/tournamentRegistry";
import { getAllRegistrations } from "@/lib/registrationStore";
import { useActiveTournament } from "@/hooks/useActiveTournament";
import { DashboardDropdown } from "@/components/DashboardDropdown";
import { AvatarNavDropdown } from "@/components/AvatarNavDropdown";
import { GuestMobileMenu } from "@/components/GuestMobileMenu";

const LOGO_URL =
  "https://d2xsxph8kpxj0f.cloudfront.net/117675823/J6FsDoRMH9x5xbUvpyzxyf/otb-logo-exclamation_0b3fa613.png";

interface AppNavBarProps {
  /** Which nav tab should be highlighted on mount. Defaults to "Tournaments". */
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

export function AppNavBar({ defaultActive = "Tournaments", onSignInClick, className }: AppNavBarProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { user } = useAuthContext();
  const [activeTab, setActiveTab] = useState(defaultActive);
  const activeTournament = useActiveTournament();

  const dashboardUrl     = getDashboardUrl();
  const dashboardTooltip = getDashboardTooltip();

  // Active indicator dot — shown on the Tournaments tab when user has a live/lobby tournament
  const showActiveDot =
    !!activeTournament &&
    (activeTournament.status === "in_progress" || activeTournament.status === "registration" || activeTournament.status === "unknown");

  const navItems = [
    {
      name: "Tournaments",
      url: dashboardUrl,
      icon: LayoutDashboard,
      tooltip: dashboardTooltip,
      badge: showActiveDot ? (
        <span
          className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#4CAF50] shadow-[0_0_6px_rgba(76,175,80,0.8)]"
          style={{ animation: activeTournament?.status === "in_progress" ? "pulse 2s cubic-bezier(0.4,0,0.6,1) infinite" : "none" }}
        />
      ) : undefined,
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
  //   Desktop / signed-in: avatar dropdown (theme toggle is inside the dropdown)
  //   Mobile + guest:      hamburger menu (GuestMobileMenu)
  //                        (avatar dropdown hidden — no avatar to tap)
  const isGuest = !user || user.isGuest;

  const rightSlotEl = (
    <div className="flex items-center gap-2">
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
      isDark={isDark}
      className={className}
    />
  );
}
