/**
 * MinimalTournamentNav — clean, minimal header for tournament dashboard pages.
 *
 * Shows only:
 *   - OTB!! logo (far left, links to home)
 *   - centerSlot (optional ReactNode, centered) — used for QR buttons, etc.
 *   - AvatarNavDropdown (far right) — consistent with all other platform headers
 *
 * No animated nav pills, no Dashboard/Clubs/Battle/Analyze links.
 * Used on Director.tsx and Tournament.tsx for a focused, distraction-free experience.
 */

import { type ReactNode } from "react";
import { Link } from "wouter";
import { useTheme } from "@/contexts/ThemeContext";
import { AvatarNavDropdown } from "@/components/AvatarNavDropdown";

const LOGO_URL =
  "https://files.manuscdn.com/user_upload_by_module/session_file/117675823/bWANpVvGVfpfXSpZ.png";

interface MinimalTournamentNavProps {
  onSignInClick?: () => void;
  /** @deprecated Use centerSlot instead. Kept for backwards compat with Tournament.tsx */
  tournamentName?: string;
  /** @deprecated No longer used — logo now serves as the home navigation link */
  backHref?: string;
  /** @deprecated No longer used */
  backLabel?: string;
  /** Optional content to render in the center slot (e.g. QR buttons) */
  centerSlot?: ReactNode;
  /** Active page label forwarded to AvatarNavDropdown for nav highlighting */
  currentPage?: string;
}

export function MinimalTournamentNav({
  onSignInClick,
  tournamentName,
  centerSlot,
  currentPage,
}: MinimalTournamentNavProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  // Determine what to show in the center slot
  const center = centerSlot ?? (tournamentName ? (
    <span
      className={`text-sm font-semibold tracking-tight truncate max-w-[160px] sm:max-w-xs text-center ${
        isDark ? "text-white/60" : "text-black/50"
      }`}
      title={tournamentName}
    >
      {tournamentName}
    </span>
  ) : null);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-[9999] h-14 flex items-center px-3 sm:px-6 border-b transition-colors ${
        isDark
          ? "bg-[oklch(0.18_0.05_145)]/90 border-white/08 backdrop-blur-md"
          : "bg-white/90 border-black/08 backdrop-blur-md"
      }`}
    >
      {/* Left slot — logo only (links to home) */}
      <div className="flex-1 flex items-center">
        <Link href="/" className="flex items-center flex-shrink-0" title="Back to Home">
          <img
            src={LOGO_URL}
            alt="OTB Chess — Back to Home"
            className={`h-7 w-auto object-contain transition-opacity hover:opacity-80 active:scale-95 ${isDark ? "nav-logo-dark" : ""}`}
            draggable={false}
          />
        </Link>
      </div>

      {/* Center slot */}
      {center && (
        <div className="flex items-center justify-center gap-2 px-2">
          {center}
        </div>
      )}

      {/* Right slot — AvatarNavDropdown (consistent with all other platform headers) */}
      <div className="flex-1 flex items-center justify-end">
        <AvatarNavDropdown
          currentPage={currentPage}
          onSignInClick={onSignInClick}
        />
      </div>
    </header>
  );
}
