/**
 * navRegistry.ts — Single source of truth for global navigation.
 *
 * All public headers, mobile menus, footers, and marketing pages
 * must consume this registry instead of maintaining separate arrays.
 *
 * Canonical public navigation order (per sprint spec):
 *   1. Clubs
 *   2. Tournaments
 *   3. League
 *   4. Tools
 *   5. Pricing
 *   6. Blog
 *
 * The logo serves as the Home link — no duplicate "Home" item needed.
 */

export interface NavItem {
  /** Stable unique key for analytics and active-state matching */
  key: string;
  /** Public display label — stable, never alternates */
  label: string;
  /** Canonical path */
  path: string;
  /** Legacy aliases that redirect to the canonical path */
  aliases?: string[];
  /** Display order (lower = first) */
  order: number;
  /** Whether to show in desktop header */
  desktop: boolean;
  /** Whether to show in mobile menu */
  mobile: boolean;
  /** Whether to show in footer navigation */
  footer: boolean;
  /** Whether the item requires authentication */
  requiresAuth?: boolean;
  /** Analytics identifier */
  analyticsId: string;
}

/** Primary product navigation — consumed by all nav surfaces */
export const NAV_ITEMS: NavItem[] = [
  {
    key: "clubs",
    label: "Clubs",
    path: "/clubs",
    order: 1,
    desktop: true,
    mobile: true,
    footer: true,
    analyticsId: "nav_clubs",
  },
  {
    key: "tournaments",
    label: "Tournaments",
    path: "/tournaments",
    order: 2,
    desktop: true,
    mobile: true,
    footer: true,
    analyticsId: "nav_tournaments",
  },
  {
    key: "league",
    label: "League",
    path: "/league",
    order: 3,
    desktop: true,
    mobile: true,
    footer: true,
    analyticsId: "nav_league",
  },
  {
    key: "tools",
    label: "Tools",
    path: "/training",
    aliases: ["/tools", "/record"],
    order: 4,
    desktop: true,
    mobile: true,
    footer: true,
    analyticsId: "nav_tools",
  },
  {
    key: "pricing",
    label: "Pricing",
    path: "/pricing",
    order: 5,
    desktop: false, // shown in footer and mobile, not primary desktop nav
    mobile: true,
    footer: true,
    analyticsId: "nav_pricing",
  },
  {
    key: "blog",
    label: "Blog",
    path: "/blog",
    order: 6,
    desktop: false,
    mobile: true,
    footer: true,
    analyticsId: "nav_blog",
  },
];

/** Primary CTA action */
export const NAV_CTA_PRIMARY = {
  label: "Host Tournament",
  path: "/tournaments/new",
  analyticsId: "nav_cta_host",
};

/** Secondary participation action */
export const NAV_CTA_SECONDARY = {
  label: "Join Tournament",
  path: "/join",
  analyticsId: "nav_cta_join",
};

/** Desktop nav items (ordered) */
export const DESKTOP_NAV_ITEMS = NAV_ITEMS
  .filter((item) => item.desktop)
  .sort((a, b) => a.order - b.order);

/** Mobile menu items (ordered) */
export const MOBILE_NAV_ITEMS = NAV_ITEMS
  .filter((item) => item.mobile)
  .sort((a, b) => a.order - b.order);

/** Footer nav items (ordered) */
export const FOOTER_NAV_ITEMS = NAV_ITEMS
  .filter((item) => item.footer)
  .sort((a, b) => a.order - b.order);

/**
 * Returns true if the given pathname matches a nav item's canonical path
 * or any of its aliases.
 */
export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (pathname === item.path) return true;
  if (item.aliases?.some((alias) => pathname === alias || pathname.startsWith(alias + "/"))) return true;
  // Prefix match for sub-routes (e.g. /clubs/123 matches /clubs)
  if (item.path !== "/" && pathname.startsWith(item.path + "/")) return true;
  return false;
}
