/**
 * AppNavBar — shared animated navigation bar for all pages.
 *
 * Wraps AnimeNavBar with the standard 4-item nav (Dashboard, Clubs, Training, Analyze),
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


import { Link } from "wouter";
import { ClubsIcon, TournamentsIcon, AcademyIcon, LeaguesIcon } from "@/components/OtbIcons";
import { AnimeNavBar } from "@/components/ui/anime-navbar";
import { useTheme } from "@/contexts/ThemeContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuthContext } from "@/context/AuthContext";
import { listTournaments, hasDirectorSession, resolveTournament } from "@/lib/tournamentRegistry";
import { getAllRegistrations } from "@/lib/registrationStore";
import { useActiveTournament } from "@/hooks/useActiveTournament";
import { useEffect, useState } from "react";
import { DashboardDropdown } from "@/components/DashboardDropdown";
import { TrainingDropdown } from "@/components/TrainingDropdown";
import { LeagueDropdown } from "@/components/LeagueDropdown";
import { AvatarNavDropdown } from "@/components/AvatarNavDropdown";
import { MobileNavDrawer } from "@/components/MobileNavDrawer";

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

interface MyLeague { id: string; name: string; status: string; currentWeek: number; totalWeeks: number; }

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

  // Fetch user's leagues to compute smart League nav URL
  const [myLeagues, setMyLeagues] = useState<MyLeague[]>([]);
  const isGuest2 = !user || user.isGuest;
  useEffect(() => {
    if (isGuest2) { setMyLeagues([]); return; }
    fetch("/api/leagues/mine", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: MyLeague[]) => setMyLeagues(Array.isArray(data) ? data : []))
      .catch(() => setMyLeagues([]));
  }, [isGuest2]);

  // Pick the best league to navigate to:
  // 1. Active league (status = "active") first
  // 2. Any league (draft, completed)
  // 3. Fallback to demo page
  const leagueNavUrl = (() => {
    if (!myLeagues.length) return "/league-demo";
    const active = myLeagues.find((l) => l.status === "active");
    const target = active ?? myLeagues[0];
    return `/league/${target.id}`;
  })();

  const dashboardUrl     = getDashboardUrl();
  const dashboardTooltip = getDashboardTooltip();

  // Active indicator dot — shown on the Tournaments tab when user has a live/lobby tournament
  const showActiveDot =
    !!activeTournament &&
    (activeTournament.status === "in_progress" || activeTournament.status === "registration" || activeTournament.status === "unknown");

  const navItems = [
    { name: "League",
      url: leagueNavUrl,
      icon: LeaguesIcon,
      tooltip: myLeagues.length
        ? (myLeagues.find((l) => l.status === "active")?.name ?? myLeagues[0]?.name)
        : "View League Demo",
      dropdown: <LeagueDropdown />,
      onClick: (e: React.MouseEvent) => {
        e.preventDefault();
        window.location.href = leagueNavUrl;
      },
    },
    { name: "Tournaments",
      url: dashboardUrl,
      icon: TournamentsIcon,
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
    { name: "Clubs",    url: "/clubs",    icon: ClubsIcon },
    { name: "Tools", url: "/training", icon: AcademyIcon, dropdown: <TrainingDropdown /> },
  ];

  const logoEl = (
    <Link href="/" className="flex items-center">
      <img
        src={LOGO_URL}
        alt="OTB Chess"
        className="h-9 w-auto object-contain transition-opacity hover:opacity-90"
        style={{ mixBlendMode: isDark ? "screen" : "normal" }}
        draggable={false}
      />
    </Link>
  );

  // Right slot:
  //   All users:        theme toggle (always visible)
  //   Mobile (all):     MobileNavDrawer hamburger (md:hidden)
  //   Desktop:          AvatarNavDropdown (hidden md:flex for guests, always flex for signed-in)
  const isGuest = !user || user.isGuest;

  const rightSlotEl = (
    <div className="flex items-center gap-2">
      {/* Theme toggle — always visible */}
      <ThemeToggle />
      {/* Hamburger — mobile only, all users */}
      <div className="flex md:hidden">
        <MobileNavDrawer
          currentPage={activeTab}
          onSignInClick={onSignInClick}
          isGuest={isGuest}
          user={user}
        />
      </div>
      {/* Avatar dropdown — desktop only for guests; always shown for signed-in */}
      <div className={isGuest ? "hidden md:flex" : "flex"}>
        <AvatarNavDropdown
          currentPage={activeTab}
          onSignInClick={onSignInClick}
          dashboardUrl={dashboardUrl}
          leagueUrl={leagueNavUrl}
        />
      </div>
    </div>
  );

  return (
    <nav aria-label="Main navigation">
      <AnimeNavBar
        items={navItems}
        defaultActive={activeTab}
        logo={logoEl}
        rightSlot={rightSlotEl}
        onActiveChange={setActiveTab}
        isDark={isDark}
        className={className}
      />
    </nav>
  );
}
