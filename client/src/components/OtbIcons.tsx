/**
 * OtbIcons — Custom premium SVG icon system for ChessOTB.club
 *
 * Design principles:
 *   - 24×24 viewBox, 1.5px stroke, round linecap/linejoin
 *   - Chess-native motifs: pieces, boards, clocks, crowns
 *   - Duotone-ready: primary path + accent path via `accentColor` prop
 *   - Drop-in replacement for Lucide icons — same `size`, `className`, `style` API
 *   - All icons accept standard SVG props + `accentColor` for duotone
 *
 * Animation: handled at the consumer level via `otb-icon` CSS class in index.css
 */

import React from "react";

// ── Shared types ──────────────────────────────────────────────────────────────

export interface OtbIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  /** Optional accent color for duotone paths (defaults to currentColor at lower opacity) */
  accentColor?: string;
}

const defaults = (size: number | string = 20): React.SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  strokeWidth: "1.5",
  "aria-hidden": true,
});

// ── Navigation icons (sidebar + bottom nav) ───────────────────────────────────

/**
 * FeedIcon — Chess knight silhouette with a speech bubble tail
 * Replaces: Megaphone (Feed / Announcements tab)
 */
export function FeedIcon({ size = 20, accentColor, className, style, ...rest }: OtbIconProps) {
  return (
    <svg {...defaults(size)} className={className} style={style} {...rest}>
      {/* Knight head */}
      <path
        stroke="currentColor"
        d="M9 18H7a2 2 0 0 1-2-2V8c0-2.5 2-4 4-4h4c2 0 4 1.5 4 4v1"
      />
      {/* Knight mane / neck */}
      <path stroke="currentColor" d="M7 12c0-1 .5-2 2-2h2" />
      {/* Base */}
      <path stroke="currentColor" d="M6 18h6" />
      {/* Speech bubble */}
      <path
        stroke={accentColor ?? "currentColor"}
        strokeOpacity={accentColor ? 1 : 0.55}
        d="M16 11h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-1l-1.5 2-1.5-2H16a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1Z"
      />
    </svg>
  );
}

/**
 * EventsIcon — Chess board square with a calendar date dot
 * Replaces: Calendar (Events tab)
 */
export function EventsIcon({ size = 20, accentColor, className, style, ...rest }: OtbIconProps) {
  return (
    <svg {...defaults(size)} className={className} style={style} {...rest}>
      {/* Calendar body */}
      <rect x="3" y="4" width="18" height="17" rx="2" stroke="currentColor" />
      {/* Header divider */}
      <line x1="3" y1="9" x2="21" y2="9" stroke="currentColor" />
      {/* Pin tabs */}
      <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" />
      <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" />
      {/* Chess board 2×2 grid inside calendar */}
      <rect x="6" y="12" width="3" height="3" rx="0.3"
        stroke={accentColor ?? "currentColor"}
        strokeOpacity={accentColor ? 1 : 0.55}
        fill={accentColor ?? "currentColor"}
        fillOpacity={accentColor ? 0.25 : 0.12}
      />
      <rect x="10" y="12" width="3" height="3" rx="0.3"
        stroke={accentColor ?? "currentColor"}
        strokeOpacity={accentColor ? 1 : 0.55}
      />
      <rect x="14" y="12" width="3" height="3" rx="0.3"
        stroke={accentColor ?? "currentColor"}
        strokeOpacity={accentColor ? 1 : 0.55}
        fill={accentColor ?? "currentColor"}
        fillOpacity={accentColor ? 0.25 : 0.12}
      />
    </svg>
  );
}

/**
 * MembersIcon — Two chess pawns side by side
 * Replaces: Users (Members tab)
 */
export function MembersIcon({ size = 20, accentColor, className, style, ...rest }: OtbIconProps) {
  return (
    <svg {...defaults(size)} className={className} style={style} {...rest}>
      {/* Left pawn (slightly behind) */}
      <circle cx="8.5" cy="6" r="2"
        stroke={accentColor ?? "currentColor"}
        strokeOpacity={accentColor ? 1 : 0.55}
      />
      <path
        stroke={accentColor ?? "currentColor"}
        strokeOpacity={accentColor ? 1 : 0.55}
        d="M6.5 10c0-1 .9-2 2-2s2 1 2 2v1H6.5v-1Z"
      />
      <line x1="5.5" y1="18" x2="11.5" y2="18"
        stroke={accentColor ?? "currentColor"}
        strokeOpacity={accentColor ? 1 : 0.55}
      />
      <line x1="8.5" y1="11" x2="8.5" y2="18"
        stroke={accentColor ?? "currentColor"}
        strokeOpacity={accentColor ? 1 : 0.55}
      />
      {/* Right pawn (foreground) */}
      <circle cx="15.5" cy="6" r="2" stroke="currentColor" />
      <path stroke="currentColor" d="M13.5 10c0-1 .9-2 2-2s2 1 2 2v1h-4v-1Z" />
      <line x1="12.5" y1="18" x2="18.5" y2="18" stroke="currentColor" />
      <line x1="15.5" y1="11" x2="15.5" y2="18" stroke="currentColor" />
    </svg>
  );
}

/**
 * TournamentsIcon — Chess king crown / trophy hybrid
 * Replaces: Trophy (Tournaments tab)
 */
export function TournamentsIcon({ size = 20, accentColor, className, style, ...rest }: OtbIconProps) {
  return (
    <svg {...defaults(size)} className={className} style={style} {...rest}>
      {/* Cup body */}
      <path stroke="currentColor" d="M6 3h12l-2 7a4 4 0 0 1-8 0L6 3Z" />
      {/* Handles */}
      <path stroke="currentColor" d="M6 5H4a2 2 0 0 0 0 4h2" />
      <path stroke="currentColor" d="M18 5h2a2 2 0 0 1 0 4h-2" />
      {/* Stem */}
      <line x1="12" y1="10" x2="12" y2="16" stroke="currentColor" />
      {/* Base */}
      <path stroke="currentColor" d="M8 16h8" />
      <path stroke="currentColor" d="M7 19h10" />
      {/* Crown points inside cup */}
      <path
        stroke={accentColor ?? "currentColor"}
        strokeOpacity={accentColor ? 1 : 0.6}
        d="M8.5 7l1.5 2 2-3 2 3 1.5-2"
      />
    </svg>
  );
}

/**
 * LeaguesIcon — Shield with chess knight silhouette
 * Replaces: Award (Leagues tab)
 */
export function LeaguesIcon({ size = 20, accentColor, className, style, ...rest }: OtbIconProps) {
  return (
    <svg {...defaults(size)} className={className} style={style} {...rest}>
      {/* Shield */}
      <path stroke="currentColor" d="M12 2L4 6v5c0 4.5 3.5 8.5 8 10 4.5-1.5 8-5.5 8-10V6L12 2Z" />
      {/* Knight inside shield */}
      <path
        stroke={accentColor ?? "currentColor"}
        strokeOpacity={accentColor ? 1 : 0.65}
        d="M10 16h4M10 16v-2c0-.5.3-1 .8-1.3L12 12l-1-1.5c-.3-.4-.2-1 .2-1.3l1.3-.9c.3-.2.5-.5.5-.8V7h-1l-.5.5"
      />
    </svg>
  );
}

// ── AppNavBar icons ───────────────────────────────────────────────────────────

/**
 * ClubsIcon — Chess castle / rook tower
 * Replaces: Building2 (Clubs nav item)
 */
export function ClubsIcon({ size = 20, accentColor, className, style, ...rest }: OtbIconProps) {
  return (
    <svg {...defaults(size)} className={className} style={style} {...rest}>
      {/* Rook body */}
      <rect x="7" y="8" width="10" height="13" rx="1" stroke="currentColor" />
      {/* Battlements */}
      <path stroke="currentColor" d="M7 8V5h2v2h2V5h2v2h2V5h2v3" />
      {/* Arrow slit */}
      <line x1="12" y1="12" x2="12" y2="17"
        stroke={accentColor ?? "currentColor"}
        strokeOpacity={accentColor ? 1 : 0.55}
      />
      <line x1="10" y1="14" x2="14" y2="14"
        stroke={accentColor ?? "currentColor"}
        strokeOpacity={accentColor ? 1 : 0.55}
      />
      {/* Base */}
      <line x1="5" y1="21" x2="19" y2="21" stroke="currentColor" />
    </svg>
  );
}

/**
 * AcademyIcon — Chess bishop with graduation mortarboard
 * Replaces: GraduationCap (Academy / League nav item)
 */
export function AcademyIcon({ size = 20, accentColor, className, style, ...rest }: OtbIconProps) {
  return (
    <svg {...defaults(size)} className={className} style={style} {...rest}>
      {/* Mortarboard top */}
      <path stroke="currentColor" d="M12 3L2 8l10 5 10-5-10-5Z" />
      {/* Tassel */}
      <path
        stroke={accentColor ?? "currentColor"}
        strokeOpacity={accentColor ? 1 : 0.55}
        d="M20 8v5"
      />
      {/* Diploma scroll */}
      <path stroke="currentColor" d="M6 11v4a6 6 0 0 0 12 0v-4" />
    </svg>
  );
}

/**
 * DashboardIcon — Chess board 2×2 grid (tools/dashboard)
 * Replaces: LayoutDashboard (Tools nav item)
 */
export function DashboardIcon({ size = 20, accentColor, className, style, ...rest }: OtbIconProps) {
  return (
    <svg {...defaults(size)} className={className} style={style} {...rest}>
      {/* Outer board */}
      <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" />
      {/* Grid lines */}
      <line x1="3" y1="12" x2="21" y2="12" stroke="currentColor" />
      <line x1="12" y1="3" x2="12" y2="21" stroke="currentColor" />
      {/* Accent squares (chess pattern) */}
      <rect x="3" y="3" width="9" height="9" rx="2"
        fill={accentColor ?? "currentColor"}
        fillOpacity={accentColor ? 0.15 : 0.08}
        stroke="none"
      />
      <rect x="12" y="12" width="9" height="9" rx="2"
        fill={accentColor ?? "currentColor"}
        fillOpacity={accentColor ? 0.15 : 0.08}
        stroke="none"
      />
    </svg>
  );
}

// ── Action / utility icons ────────────────────────────────────────────────────

/**
 * ChessClockIcon — Two-faced chess clock
 * Replaces: Clock (Timer, time controls)
 */
export function ChessClockIcon({ size = 20, accentColor, className, style, ...rest }: OtbIconProps) {
  return (
    <svg {...defaults(size)} className={className} style={style} {...rest}>
      {/* Left clock face */}
      <circle cx="8" cy="12" r="5" stroke="currentColor" />
      {/* Right clock face */}
      <circle cx="16" cy="12" r="5"
        stroke={accentColor ?? "currentColor"}
        strokeOpacity={accentColor ? 1 : 0.6}
      />
      {/* Clock bridge */}
      <line x1="8" y1="7" x2="16" y2="7" stroke="currentColor" />
      {/* Buttons on top */}
      <rect x="6" y="5" width="4" height="2" rx="1" stroke="currentColor" />
      <rect x="14" y="5" width="4" height="2" rx="1"
        stroke={accentColor ?? "currentColor"}
        strokeOpacity={accentColor ? 1 : 0.6}
      />
      {/* Left hand (stopped) */}
      <line x1="8" y1="12" x2="8" y2="9" stroke="currentColor" />
      {/* Right hand (running) */}
      <line x1="16" y1="12" x2="18" y2="10"
        stroke={accentColor ?? "currentColor"}
        strokeOpacity={accentColor ? 1 : 0.6}
      />
    </svg>
  );
}

/**
 * RatingIcon — Bar chart with upward pawn
 * Replaces: BarChart2 / TrendingUp (Ratings, stats)
 */
export function RatingIcon({ size = 20, accentColor, className, style, ...rest }: OtbIconProps) {
  return (
    <svg {...defaults(size)} className={className} style={style} {...rest}>
      {/* Bars */}
      <rect x="3" y="14" width="4" height="7" rx="1" stroke="currentColor" />
      <rect x="10" y="9" width="4" height="12" rx="1" stroke="currentColor" />
      <rect x="17" y="4" width="4" height="17" rx="1"
        stroke={accentColor ?? "currentColor"}
        strokeOpacity={accentColor ? 1 : 0.7}
        fill={accentColor ?? "currentColor"}
        fillOpacity={accentColor ? 0.15 : 0.08}
      />
      {/* Pawn on top of tallest bar */}
      <circle cx="19" cy="2.5" r="1"
        stroke={accentColor ?? "currentColor"}
        strokeOpacity={accentColor ? 1 : 0.7}
      />
    </svg>
  );
}

/**
 * BattleIcon — Two knights crossing swords (crossed)
 * Replaces: Swords (Battle / matchup)
 */
export function BattleIcon({ size = 20, accentColor, className, style, ...rest }: OtbIconProps) {
  return (
    <svg {...defaults(size)} className={className} style={style} {...rest}>
      {/* Left sword */}
      <line x1="3" y1="21" x2="15" y2="9" stroke="currentColor" />
      <path stroke="currentColor" d="M15 9l2-4 2 1-1 2-3 1Z" />
      <line x1="3" y1="21" x2="5" y2="19" stroke="currentColor" strokeWidth="2.5" />
      {/* Right sword */}
      <line x1="21" y1="21" x2="9" y2="9"
        stroke={accentColor ?? "currentColor"}
        strokeOpacity={accentColor ? 1 : 0.65}
      />
      <path
        stroke={accentColor ?? "currentColor"}
        strokeOpacity={accentColor ? 1 : 0.65}
        d="M9 9l-2-4-2 1 1 2 3 1Z"
      />
      <line x1="21" y1="21" x2="19" y2="19"
        stroke={accentColor ?? "currentColor"}
        strokeOpacity={accentColor ? 1 : 0.65}
        strokeWidth="2.5"
      />
    </svg>
  );
}

/**
 * PrepIcon — Chess board with magnifying glass
 * Replaces: Target / Search (Match prep, analysis)
 */
export function PrepIcon({ size = 20, accentColor, className, style, ...rest }: OtbIconProps) {
  return (
    <svg {...defaults(size)} className={className} style={style} {...rest}>
      {/* Board */}
      <rect x="2" y="2" width="13" height="13" rx="1.5" stroke="currentColor" />
      {/* Board grid */}
      <line x1="2" y1="8.5" x2="15" y2="8.5" stroke="currentColor" strokeOpacity="0.4" />
      <line x1="8.5" y1="2" x2="8.5" y2="15" stroke="currentColor" strokeOpacity="0.4" />
      {/* Magnifying glass */}
      <circle cx="17" cy="17" r="4"
        stroke={accentColor ?? "currentColor"}
        strokeOpacity={accentColor ? 1 : 0.7}
      />
      <line x1="20" y1="20" x2="22" y2="22"
        stroke={accentColor ?? "currentColor"}
        strokeOpacity={accentColor ? 1 : 0.7}
      />
    </svg>
  );
}

/**
 * LiveIcon — Lightning bolt with chess piece
 * Replaces: Zap / Radio (Live games, streaming)
 */
export function LiveIcon({ size = 20, accentColor, className, style, ...rest }: OtbIconProps) {
  return (
    <svg {...defaults(size)} className={className} style={style} {...rest}>
      {/* Lightning bolt */}
      <path stroke="currentColor" d="M13 2L4 14h7l-1 8 9-12h-7l1-8Z" />
      {/* Glow ring */}
      <circle cx="12" cy="12" r="9"
        stroke={accentColor ?? "currentColor"}
        strokeOpacity={accentColor ? 0.4 : 0.2}
        strokeDasharray="3 3"
      />
    </svg>
  );
}

/**
 * FollowIcon — Bell with chess pawn silhouette
 * Replaces: Bell (Follow / notifications)
 */
export function FollowIcon({ size = 20, accentColor, className, style, ...rest }: OtbIconProps) {
  return (
    <svg {...defaults(size)} className={className} style={style} {...rest}>
      {/* Bell body */}
      <path stroke="currentColor" d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      {/* Clapper */}
      <path stroke="currentColor" d="M13.73 21a2 2 0 0 1-3.46 0" />
      {/* Pawn on top */}
      <circle cx="12" cy="3" r="1.5"
        stroke={accentColor ?? "currentColor"}
        strokeOpacity={accentColor ? 1 : 0.6}
      />
    </svg>
  );
}

/**
 * ProfileIcon — Chess king piece (user identity)
 * Replaces: User / Crown (Profile, account)
 */
export function ProfileIcon({ size = 20, accentColor, className, style, ...rest }: OtbIconProps) {
  return (
    <svg {...defaults(size)} className={className} style={style} {...rest}>
      {/* King cross top */}
      <line x1="12" y1="2" x2="12" y2="6" stroke="currentColor" />
      <line x1="10" y1="4" x2="14" y2="4" stroke="currentColor" />
      {/* King crown */}
      <path stroke="currentColor" d="M8 7l1 3h6l1-3-2 1.5-2-3-2 3L8 7Z" />
      {/* King body */}
      <rect x="8" y="10" width="8" height="4" rx="0.5" stroke="currentColor" />
      {/* Base */}
      <path stroke="currentColor" d="M6 14h12v2a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-2Z" />
      {/* Base foot */}
      <line x1="5" y1="19" x2="19" y2="19"
        stroke={accentColor ?? "currentColor"}
        strokeOpacity={accentColor ? 1 : 0.5}
      />
    </svg>
  );
}

/**
 * SignInIcon — Chess door with arrow (login)
 * Replaces: LogIn (Sign in / auth)
 */
export function SignInIcon({ size = 20, accentColor, className, style, ...rest }: OtbIconProps) {
  return (
    <svg {...defaults(size)} className={className} style={style} {...rest}>
      {/* Door frame */}
      <path stroke="currentColor" d="M15 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10" />
      {/* Arrow entering */}
      <polyline
        stroke={accentColor ?? "currentColor"}
        strokeOpacity={accentColor ? 1 : 0.8}
        points="10 17 15 12 10 7"
      />
      <line x1="15" y1="12" x2="3" y2="12"
        stroke={accentColor ?? "currentColor"}
        strokeOpacity={accentColor ? 1 : 0.8}
      />
    </svg>
  );
}

/**
 * SignOutIcon — Chess door with arrow (logout)
 * Replaces: LogOut (Sign out)
 */
export function SignOutIcon({ size = 20, accentColor, className, style, ...rest }: OtbIconProps) {
  return (
    <svg {...defaults(size)} className={className} style={style} {...rest}>
      {/* Door frame */}
      <path stroke="currentColor" d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      {/* Arrow exiting */}
      <polyline
        stroke={accentColor ?? "currentColor"}
        strokeOpacity={accentColor ? 1 : 0.8}
        points="16 17 21 12 16 7"
      />
      <line x1="21" y1="12" x2="9" y2="12"
        stroke={accentColor ?? "currentColor"}
        strokeOpacity={accentColor ? 1 : 0.8}
      />
    </svg>
  );
}

/**
 * ThemeIcon — Half sun / half moon (theme toggle)
 * Replaces: Sun + Moon (Theme toggle)
 */
export function ThemeIcon({ size = 20, accentColor, className, style, ...rest }: OtbIconProps) {
  return (
    <svg {...defaults(size)} className={className} style={style} {...rest}>
      {/* Circle */}
      <circle cx="12" cy="12" r="5" stroke="currentColor" />
      {/* Left half = sun rays */}
      <line x1="12" y1="2" x2="12" y2="4" stroke="currentColor" />
      <line x1="12" y1="20" x2="12" y2="22" stroke="currentColor" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" stroke="currentColor" />
      <line x1="4" y1="12" x2="2" y2="12" stroke="currentColor" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" stroke="currentColor" />
      {/* Right half = moon crescent overlay */}
      <path
        stroke={accentColor ?? "currentColor"}
        strokeOpacity={accentColor ? 1 : 0.6}
        fill={accentColor ?? "currentColor"}
        fillOpacity={accentColor ? 0.1 : 0.05}
        d="M12 7a5 5 0 0 1 5 5 5 5 0 0 1-5 5V7Z"
      />
    </svg>
  );
}

/**
 * QrShareIcon — QR code with chess pawn center
 * Replaces: QrCode (Share QR)
 */
export function QrShareIcon({ size = 20, accentColor, className, style, ...rest }: OtbIconProps) {
  return (
    <svg {...defaults(size)} className={className} style={style} {...rest}>
      {/* Top-left QR block */}
      <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" />
      <rect x="5" y="5" width="3" height="3" rx="0.3"
        fill="currentColor" fillOpacity="0.6" stroke="none"
      />
      {/* Top-right QR block */}
      <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" />
      <rect x="16" y="5" width="3" height="3" rx="0.3"
        fill="currentColor" fillOpacity="0.6" stroke="none"
      />
      {/* Bottom-left QR block */}
      <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" />
      <rect x="5" y="16" width="3" height="3" rx="0.3"
        fill="currentColor" fillOpacity="0.6" stroke="none"
      />
      {/* Bottom-right: pawn (brand element) */}
      <circle cx="17.5" cy="16" r="1.5"
        stroke={accentColor ?? "currentColor"}
        strokeOpacity={accentColor ? 1 : 0.7}
      />
      <path
        stroke={accentColor ?? "currentColor"}
        strokeOpacity={accentColor ? 1 : 0.7}
        d="M15.5 20h4M16 20v-2.5"
      />
    </svg>
  );
}

/**
 * SettingsIcon — Chess gear with knight silhouette
 * Replaces: Settings (Settings page)
 */
export function SettingsIcon({ size = 20, accentColor, className, style, ...rest }: OtbIconProps) {
  return (
    <svg {...defaults(size)} className={className} style={style} {...rest}>
      {/* Gear outer */}
      <path stroke="currentColor" d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      <path stroke="currentColor" d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  );
}

/**
 * HomeIcon — Chess house / home with pawn chimney
 * Replaces: Home (Home nav)
 */
export function HomeIcon({ size = 20, accentColor, className, style, ...rest }: OtbIconProps) {
  return (
    <svg {...defaults(size)} className={className} style={style} {...rest}>
      {/* House */}
      <path stroke="currentColor" d="M3 12L12 3l9 9" />
      <path stroke="currentColor" d="M5 10v9a1 1 0 0 0 1 1h4v-5h4v5h4a1 1 0 0 0 1-1v-9" />
      {/* Pawn chimney */}
      <circle cx="12" cy="7" r="1.2"
        stroke={accentColor ?? "currentColor"}
        strokeOpacity={accentColor ? 1 : 0.6}
      />
    </svg>
  );
}

/**
 * SearchIcon — Magnifying glass with chess board grid
 * Replaces: Search
 */
export function SearchIcon({ size = 20, accentColor, className, style, ...rest }: OtbIconProps) {
  return (
    <svg {...defaults(size)} className={className} style={style} {...rest}>
      {/* Lens */}
      <circle cx="10" cy="10" r="7" stroke="currentColor" />
      {/* Handle */}
      <line x1="15.5" y1="15.5" x2="21" y2="21"
        stroke={accentColor ?? "currentColor"}
        strokeOpacity={accentColor ? 1 : 0.7}
      />
      {/* Mini board grid inside lens */}
      <line x1="7" y1="10" x2="13" y2="10" stroke="currentColor" strokeOpacity="0.35" />
      <line x1="10" y1="7" x2="10" y2="13" stroke="currentColor" strokeOpacity="0.35" />
    </svg>
  );
}

// ── Convenience re-exports for drop-in use ────────────────────────────────────

export {
  FeedIcon as OtbFeed,
  EventsIcon as OtbEvents,
  MembersIcon as OtbMembers,
  TournamentsIcon as OtbTournaments,
  LeaguesIcon as OtbLeagues,
  ClubsIcon as OtbClubs,
  AcademyIcon as OtbAcademy,
  DashboardIcon as OtbDashboard,
  ChessClockIcon as OtbClock,
  RatingIcon as OtbRating,
  BattleIcon as OtbBattle,
  PrepIcon as OtbPrep,
  LiveIcon as OtbLive,
  FollowIcon as OtbFollow,
  ProfileIcon as OtbProfile,
  SignInIcon as OtbSignIn,
  SignOutIcon as OtbSignOut,
  ThemeIcon as OtbTheme,
  QrShareIcon as OtbQrShare,
  SettingsIcon as OtbSettings,
  HomeIcon as OtbHome,
  SearchIcon as OtbSearch,
};
