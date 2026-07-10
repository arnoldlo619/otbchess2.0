/**
 * MobileBottomNav — persistent bottom tab bar for mobile users.
 *
 * Shows on screens < md (768px). Provides quick access to the 4 core
 * platform destinations: Tournaments, Clubs, Tools, Profile.
 *
 * Respects iOS safe-area-inset-bottom. Hidden on specific full-screen
 * experiences (chess clock, live board, broadcast, print).
 */
import { useLocation, Link } from "wouter";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuthContext } from "@/context/AuthContext";
import {
  TournamentsIcon,
  ClubsIcon,
  AcademyIcon,
} from "@/components/OtbIcons";
import { User, Home } from "lucide-react";

// Routes where bottom nav should be hidden (full-screen experiences)
const HIDDEN_ROUTES = [
  "/clock",
  "/tournament/*/clock",
  "/tournament/*/broadcast-console",
  "/tournament/*/broadcast/",
  "/tournament/*/connect-board",
  "/live/board/",
  "/record/camera",
  "/print",
  "/tournament/*/print",
];

function shouldHideNav(path: string): boolean {
  return HIDDEN_ROUTES.some((pattern) => {
    const regex = new RegExp("^" + pattern.replace(/\*/g, "[^/]+") + "");
    return regex.test(path);
  });
}

interface TabItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string; accentColor?: string }>;
  matchPaths: string[];
}

const TABS: TabItem[] = [
  {
    name: "Home",
    href: "/",
    icon: Home as unknown as TabItem["icon"],
    matchPaths: ["/"],
  },
  {
    name: "Tournaments",
    href: "/tournaments",
    icon: TournamentsIcon,
    matchPaths: ["/tournaments", "/join", "/tournament"],
  },
  {
    name: "Clubs",
    href: "/clubs",
    icon: ClubsIcon,
    matchPaths: ["/clubs", "/join-club"],
  },
  {
    name: "Tools",
    href: "/training",
    icon: AcademyIcon,
    matchPaths: ["/training", "/prep", "/openings", "/record", "/games", "/repertoire"],
  },
  {
    name: "Profile",
    href: "/profile",
    icon: User as unknown as TabItem["icon"],
    matchPaths: ["/profile"],
  },
];

function isActive(path: string, matchPaths: string[]): boolean {
  // Exact match for home
  if (matchPaths.includes("/") && path === "/") return true;
  // Prefix match for others
  return matchPaths.some((m) => m !== "/" && path.startsWith(m));
}

export function MobileBottomNav() {
  const [location] = useLocation();
  const { theme } = useTheme();
  const { user } = useAuthContext();
  const isDark = theme === "dark";

  // Hide on full-screen experiences
  if (shouldHideNav(location)) return null;

  // Hide on desktop (md+) — handled via CSS but also guard here
  // Actually we use CSS hidden md:hidden, so always render

  const isGuest = !user || user.isGuest;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-[var(--z-header)] md:hidden"
      style={{
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
      role="navigation"
      aria-label="Main navigation"
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 border-t ${
          isDark
            ? "bg-[#0d1a0f]/95 border-white/10"
            : "bg-white/95 border-black/5"
        } backdrop-blur-xl`}
      />

      {/* Tab items */}
      <div className="relative flex items-center justify-around px-2 h-16">
        {TABS.map((tab) => {
          const active = isActive(location, tab.matchPaths);
          const Icon = tab.icon;

          // For guest users, show "Sign In" instead of "Profile"
          const label = tab.name === "Profile" && isGuest ? "Sign In" : tab.name;
          const href = tab.name === "Profile" && isGuest ? "/profile" : tab.href;

          return (
            <Link key={tab.name} href={href}>
              <button
                className={`flex flex-col items-center justify-center gap-0.5 w-16 h-12 rounded-xl transition-all duration-200 ${
                  active
                    ? isDark
                      ? "text-[#7CF562]"
                      : "text-[#436850]"
                    : isDark
                      ? "text-white/50 active:text-white/80"
                      : "text-gray-400 active:text-gray-600"
                }`}
                aria-current={active ? "page" : undefined}
              >
                {/* Active indicator dot */}
                {active && (
                  <span
                    className={`absolute top-1.5 w-1 h-1 rounded-full ${
                      isDark ? "bg-[#7CF562]" : "bg-[#436850]"
                    }`}
                  />
                )}
                <Icon
                  size={22}
                  className="shrink-0"
                  accentColor={active ? (isDark ? "#7CF562" : "#436850") : "currentColor"}
                />
                <span className="text-[10px] font-medium leading-none mt-0.5">
                  {label}
                </span>
              </button>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
