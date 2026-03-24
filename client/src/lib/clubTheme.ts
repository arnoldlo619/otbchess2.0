/**
 * clubTheme.ts
 *
 * Shared per-category gradient + badge theme for all club surfaces:
 *   - FeaturedClubsCarousel
 *   - ClubLeaderboard
 *   - ClubProfile
 *
 * Each category has a `dark` and `light` variant so cards look great
 * in both themes. The `glow` value is always dark-safe (used for
 * box-shadow on hover, which is subtle enough in both modes).
 */

export interface ClubThemeVariant {
  grad: string;   // Tailwind bg-gradient-to-br class stops
  badge: string;  // Tailwind classes for the category pill
  glow: string;   // Tailwind group-hover:shadow-* class
}

export interface ClubThemeEntry {
  dark: ClubThemeVariant;
  light: ClubThemeVariant;
}

export const CATEGORY_THEME: Record<string, ClubThemeEntry> = {
  competitive: {
    dark:  { grad: "from-red-950 via-rose-900 to-red-800",           glow: "group-hover:shadow-red-900/50",     badge: "bg-red-500/20 text-red-300 border-red-500/30" },
    light: { grad: "from-red-400 via-rose-300 to-red-200",           glow: "group-hover:shadow-red-300/40",     badge: "bg-red-600/15 text-red-700 border-red-400/40" },
  },
  casual: {
    dark:  { grad: "from-blue-950 via-blue-900 to-indigo-800",       glow: "group-hover:shadow-blue-900/50",    badge: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
    light: { grad: "from-blue-400 via-sky-300 to-indigo-200",        glow: "group-hover:shadow-blue-300/40",    badge: "bg-blue-600/15 text-blue-700 border-blue-400/40" },
  },
  scholastic: {
    dark:  { grad: "from-yellow-950 via-amber-900 to-yellow-800",    glow: "group-hover:shadow-amber-900/50",   badge: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30" },
    light: { grad: "from-amber-400 via-yellow-300 to-amber-200",     glow: "group-hover:shadow-amber-300/40",   badge: "bg-amber-600/15 text-amber-700 border-amber-400/40" },
  },
  online: {
    dark:  { grad: "from-purple-950 via-violet-900 to-purple-800",   glow: "group-hover:shadow-purple-900/50",  badge: "bg-purple-500/20 text-purple-300 border-purple-500/30" },
    light: { grad: "from-purple-400 via-violet-300 to-purple-200",   glow: "group-hover:shadow-purple-300/40",  badge: "bg-purple-600/15 text-purple-700 border-purple-400/40" },
  },
  otb: {
    dark:  { grad: "from-emerald-950 via-green-900 to-emerald-800",  glow: "group-hover:shadow-emerald-900/50", badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
    light: { grad: "from-emerald-400 via-green-300 to-emerald-200",  glow: "group-hover:shadow-emerald-300/40", badge: "bg-emerald-600/15 text-emerald-700 border-emerald-400/40" },
  },
  blitz: {
    dark:  { grad: "from-orange-950 via-orange-900 to-amber-800",    glow: "group-hover:shadow-orange-900/50",  badge: "bg-orange-500/20 text-orange-300 border-orange-500/30" },
    light: { grad: "from-orange-400 via-amber-300 to-orange-200",    glow: "group-hover:shadow-orange-300/40",  badge: "bg-orange-600/15 text-orange-700 border-orange-400/40" },
  },
  correspondence: {
    dark:  { grad: "from-cyan-950 via-teal-900 to-cyan-800",         glow: "group-hover:shadow-cyan-900/50",    badge: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30" },
    light: { grad: "from-cyan-400 via-teal-300 to-cyan-200",         glow: "group-hover:shadow-cyan-300/40",    badge: "bg-cyan-600/15 text-cyan-700 border-cyan-400/40" },
  },
  club: {
    dark:  { grad: "from-green-950 via-green-900 to-green-800",      glow: "group-hover:shadow-green-900/50",   badge: "bg-green-500/20 text-green-300 border-green-500/30" },
    light: { grad: "from-green-400 via-emerald-300 to-green-200",    glow: "group-hover:shadow-green-300/40",   badge: "bg-green-600/15 text-green-700 border-green-400/40" },
  },
  school: {
    dark:  { grad: "from-yellow-950 via-amber-900 to-yellow-800",    glow: "group-hover:shadow-amber-900/50",   badge: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30" },
    light: { grad: "from-yellow-400 via-amber-300 to-yellow-200",    glow: "group-hover:shadow-yellow-300/40",  badge: "bg-yellow-600/15 text-yellow-700 border-yellow-400/40" },
  },
  university: {
    dark:  { grad: "from-indigo-950 via-indigo-900 to-blue-800",     glow: "group-hover:shadow-indigo-900/50",  badge: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30" },
    light: { grad: "from-indigo-400 via-blue-300 to-indigo-200",     glow: "group-hover:shadow-indigo-300/40",  badge: "bg-indigo-600/15 text-indigo-700 border-indigo-400/40" },
  },
  community: {
    dark:  { grad: "from-teal-950 via-teal-900 to-cyan-800",         glow: "group-hover:shadow-teal-900/50",    badge: "bg-teal-500/20 text-teal-300 border-teal-500/30" },
    light: { grad: "from-teal-400 via-cyan-300 to-teal-200",         glow: "group-hover:shadow-teal-300/40",    badge: "bg-teal-600/15 text-teal-700 border-teal-400/40" },
  },
  professional: {
    dark:  { grad: "from-rose-950 via-rose-900 to-pink-800",         glow: "group-hover:shadow-rose-900/50",    badge: "bg-rose-500/20 text-rose-300 border-rose-500/30" },
    light: { grad: "from-rose-400 via-pink-300 to-rose-200",         glow: "group-hover:shadow-rose-300/40",    badge: "bg-rose-600/15 text-rose-700 border-rose-400/40" },
  },
  other: {
    dark:  { grad: "from-slate-900 via-slate-800 to-slate-700",      glow: "group-hover:shadow-slate-800/50",   badge: "bg-slate-500/20 text-slate-300 border-slate-500/30" },
    light: { grad: "from-slate-400 via-gray-300 to-slate-200",       glow: "group-hover:shadow-slate-300/40",   badge: "bg-slate-600/15 text-slate-700 border-slate-400/40" },
  },
};

const FALLBACK_ENTRIES: ClubThemeEntry[] = [
  { dark: { grad: "from-emerald-950 via-green-900 to-emerald-800",  glow: "group-hover:shadow-emerald-900/50", badge: CATEGORY_THEME.other.dark.badge  }, light: { grad: "from-emerald-400 via-green-300 to-emerald-200",  glow: "group-hover:shadow-emerald-300/40", badge: CATEGORY_THEME.other.light.badge } },
  { dark: { grad: "from-blue-950 via-blue-900 to-indigo-800",       glow: "group-hover:shadow-blue-900/50",    badge: CATEGORY_THEME.other.dark.badge  }, light: { grad: "from-blue-400 via-sky-300 to-indigo-200",        glow: "group-hover:shadow-blue-300/40",    badge: CATEGORY_THEME.other.light.badge } },
  { dark: { grad: "from-purple-950 via-violet-900 to-purple-800",   glow: "group-hover:shadow-purple-900/50",  badge: CATEGORY_THEME.other.dark.badge  }, light: { grad: "from-purple-400 via-violet-300 to-purple-200",   glow: "group-hover:shadow-purple-300/40",  badge: CATEGORY_THEME.other.light.badge } },
  { dark: { grad: "from-amber-950 via-yellow-900 to-amber-800",     glow: "group-hover:shadow-amber-900/50",   badge: CATEGORY_THEME.other.dark.badge  }, light: { grad: "from-amber-400 via-yellow-300 to-amber-200",     glow: "group-hover:shadow-amber-300/40",   badge: CATEGORY_THEME.other.light.badge } },
  { dark: { grad: "from-rose-950 via-pink-900 to-rose-800",         glow: "group-hover:shadow-rose-900/50",    badge: CATEGORY_THEME.other.dark.badge  }, light: { grad: "from-rose-400 via-pink-300 to-rose-200",         glow: "group-hover:shadow-rose-300/40",    badge: CATEGORY_THEME.other.light.badge } },
  { dark: { grad: "from-cyan-950 via-teal-900 to-cyan-800",         glow: "group-hover:shadow-cyan-900/50",    badge: CATEGORY_THEME.other.dark.badge  }, light: { grad: "from-cyan-400 via-teal-300 to-cyan-200",         glow: "group-hover:shadow-cyan-300/40",    badge: CATEGORY_THEME.other.light.badge } },
];

/**
 * Returns the resolved { grad, glow, badge } for a club given the current theme mode.
 */
export function resolveClubTheme(
  categoryOrId: { category?: string | null; id: string },
  isDark: boolean
): ClubThemeVariant {
  const cat = categoryOrId.category ?? "other";
  const mode = isDark ? "dark" : "light";
  if (CATEGORY_THEME[cat]) return CATEGORY_THEME[cat][mode];
  const idx = categoryOrId.id.charCodeAt(categoryOrId.id.length - 1) % FALLBACK_ENTRIES.length;
  return FALLBACK_ENTRIES[idx][mode];
}
