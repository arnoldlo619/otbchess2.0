/**
 * OTB Chess — PlayerAvatar
 *
 * A compact, reusable avatar component that:
 *  - Fetches a chess.com profile photo (with sessionStorage caching)
 *  - Renders a Lichess flair emoji when platform is "lichess"
 *  - Falls back to premium OTB-green initials when no photo is available
 *
 * Props:
 *   username    — chess.com or Lichess username (used for API fetch)
 *   name        — display name (used for initials fallback)
 *   platform    — "chesscom" | "lichess" | undefined (defaults to chesscom)
 *   avatarUrl   — pre-fetched avatar URL (skips the hook fetch if provided)
 *   flairEmoji  — Lichess flair emoji (e.g. "🔥") for Lichess players
 *   size        — pixel size of the avatar (default 32)
 *   className   — additional Tailwind classes for the outer wrapper
 *   showBadge   — when true, shows a platform badge on the photo
 */

import { useState } from "react";
import { useChessAvatar, toProxiedAvatarUrl } from "@/hooks/useChessAvatar";

/**
 * Deterministic OTB-green gradient from username hash.
 *
 * Instead of random off-brand colors, all default avatars stay within the
 * OTB dark-green design system. The hash selects one of 8 carefully tuned
 * dark-green gradient pairs — each unique but harmonious with the UI.
 *
 * Inspired by CRED's premium dark monochromatic avatar treatment.
 */
function usernameToGradient(username: string): { from: string; to: string; ring: string } {
  // 8 OTB-green family gradient stops (dark forest → teal-green range)
  const gradients = [
    // Deep forest green
    { from: "#0d2b14", to: "#1a4a25", ring: "rgba(74,222,128,0.18)" },
    // Rich emerald
    { from: "#0a2e1a", to: "#15532e", ring: "rgba(52,211,153,0.18)" },
    // Dark teal-green
    { from: "#0c2d24", to: "#134e3e", ring: "rgba(45,212,191,0.15)" },
    // Midnight green
    { from: "#0b2416", to: "#173d26", ring: "rgba(74,222,128,0.14)" },
    // Olive-green dark
    { from: "#1a2d0e", to: "#2d4a18", ring: "rgba(163,230,53,0.14)" },
    // Deep pine
    { from: "#0d2b1e", to: "#1a4a33", ring: "rgba(52,211,153,0.16)" },
    // Forest shadow
    { from: "#0f2a12", to: "#1e4a22", ring: "rgba(74,222,128,0.20)" },
    // Dark sage
    { from: "#1a2e1a", to: "#2e4e2e", ring: "rgba(134,239,172,0.14)" },
  ];

  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = (hash * 31 + username.charCodeAt(i)) & 0xffffffff;
  }
  return gradients[Math.abs(hash) % gradients.length];
}

interface PlayerAvatarProps {
  username: string;
  name: string;
  platform?: "chesscom" | "lichess";
  /** Pre-fetched avatar URL — skips the internal hook fetch */
  avatarUrl?: string;
  /** Lichess flair emoji for Lichess players */
  flairEmoji?: string;
  size?: number;
  className?: string;
  /** When true, shows a small platform badge on the photo */
  showBadge?: boolean;
}

export function PlayerAvatar({
  username,
  name,
  platform = "chesscom",
  avatarUrl: propAvatarUrl,
  flairEmoji,
  size = 32,
  className = "",
  showBadge = false,
}: PlayerAvatarProps) {
  // Only fetch from chess.com if no pre-fetched URL is provided and platform is chesscom
  const { url: fetchedUrl, status } = useChessAvatar(
    platform === "chesscom" && !propAvatarUrl ? username : ""
  );
  const [imgError, setImgError] = useState(false);

  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const gradient = usernameToGradient(username || name);

  // Route all avatar URLs through the server-side /api/avatar-proxy to prevent
  // mixed-content warnings on HTTPS and allow html2canvas without tainted canvas errors.
  const resolvedUrl = toProxiedAvatarUrl(propAvatarUrl || fetchedUrl);
  // Show a photo for chess.com players and for Lichess players who have an avatarUrl
  const showPhoto = resolvedUrl && !imgError && (platform === "chesscom" || (platform === "lichess" && !!propAvatarUrl));
  const showShimmer = !propAvatarUrl && status === "loading" && platform === "chesscom";
  const showFlair = platform === "lichess" && flairEmoji;
  const fontSize = Math.round(size * 0.38);
  const emojiFontSize = Math.round(size * 0.52);
  const badgeSize = Math.round(size * 0.38);
  // Grid cell size scales with avatar: fine grid for small avatars, standard for larger
  const gridSize = size <= 24 ? 6 : size <= 40 ? 8 : size <= 64 ? 10 : 14;
  // Ring width scales with avatar size
  const ringWidth = size <= 24 ? 1 : size <= 48 ? 1.5 : 2;

  return (
    <div
      className={`relative flex-shrink-0 rounded-full overflow-hidden ${className}`}
      style={{ width: size, height: size }}
    >
      {showShimmer ? (
        /* Shimmer skeleton while chess.com avatar loads */
        <div className="w-full h-full animate-shimmer rounded-full" />
      ) : showPhoto ? (
        /* chess.com / Lichess avatar photo (proxied through /api/avatar-proxy) */
        <img
          src={resolvedUrl!}
          alt={`${username}'s avatar`}
          className="w-full h-full object-cover"
          crossOrigin="anonymous"
          aria-hidden="true"
          onError={() => setImgError(true)}
        />
      ) : showFlair ? (
        /* Lichess flair emoji — OTB green base instead of orange */
        <div
          className="w-full h-full flex items-center justify-center"
          style={{
            background: `linear-gradient(135deg, ${gradient.from}, ${gradient.to})`,
          }}
        >
          <span
            className="leading-none select-none"
            style={{ fontSize: emojiFontSize }}
            role="img"
            aria-label="Lichess flair"
          >
            {flairEmoji}
          </span>
        </div>
      ) : (
        /* Premium OTB-green initials fallback */
        <div
          className="w-full h-full flex items-center justify-center relative"
          style={{
            background: `linear-gradient(145deg, ${gradient.from}, ${gradient.to})`,
          }}
        >
          {/* Micro-grid watermark — matches OTB design system */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `
                linear-gradient(rgba(118,255,136,0.06) 1px, transparent 1px),
                linear-gradient(90deg, rgba(118,255,136,0.06) 1px, transparent 1px)
              `,
              backgroundSize: `${gridSize}px ${gridSize}px`,
            }}
          />
          {/* Subtle inner ring */}
          <div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              boxShadow: `inset 0 0 0 ${ringWidth}px ${gradient.ring}`,
            }}
          />
          {/* Initials */}
          <span
            className="relative font-bold text-white leading-none tracking-wide z-10"
            style={{ fontSize }}
          >
            {initials}
          </span>
        </div>
      )}

      {/* Platform badge */}
      {showBadge && (showPhoto || showFlair) && (
        <div
          className={`absolute -bottom-0.5 -right-0.5 rounded-full border border-white/30 flex items-center justify-center ${
            platform === "lichess" ? "bg-[#4CAF50]" : "bg-[#81b64c]"
          }`}
          style={{ width: badgeSize, height: badgeSize }}
          title={platform === "lichess" ? "Lichess verified" : "chess.com verified"}
        >
          {platform === "lichess" ? (
            /* Lichess knight icon */
            <svg
              viewBox="0 0 24 24"
              className="fill-white"
              style={{ width: badgeSize * 0.65, height: badgeSize * 0.65 }}
            >
              <path d="M19 22H5v-2h14v2M13 2a5 5 0 0 1 5 5c0 1.64-.8 3.09-2.03 4L17 13H7l1.03-2C6.8 10.09 6 8.64 6 7a5 5 0 0 1 5-5h2m0 2h-2a3 3 0 0 0-3 3c0 1.12.61 2.1 1.5 2.63L9.5 11h5l-.5-2.37A3 3 0 0 0 15.5 7a3 3 0 0 0-2.5-3z" />
            </svg>
          ) : (
            /* chess.com checkmark */
            <svg
              viewBox="0 0 24 24"
              className="fill-white"
              style={{ width: badgeSize * 0.6, height: badgeSize * 0.6 }}
            >
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
            </svg>
          )}
        </div>
      )}
    </div>
  );
}
