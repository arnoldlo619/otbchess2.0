/**
 * OTB Chess — PlayerAvatar
 *
 * A compact, reusable avatar component that:
 *  - Fetches a chess.com profile photo (with sessionStorage caching)
 *  - Renders a Lichess flair emoji when platform is "lichess"
 *  - Falls back to styled initials when no photo is available
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
import { useChessAvatar } from "@/hooks/useChessAvatar";

// Deterministic colour from username for the initials background
function usernameToColor(username: string): string {
  const colors = [
    "bg-emerald-600",
    "bg-teal-600",
    "bg-blue-600",
    "bg-violet-600",
    "bg-amber-600",
    "bg-rose-600",
    "bg-cyan-600",
    "bg-indigo-600",
  ];
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = (hash * 31 + username.charCodeAt(i)) & 0xffffffff;
  }
  return colors[Math.abs(hash) % colors.length];
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

  const colorClass = usernameToColor(username);
  const resolvedUrl = propAvatarUrl || fetchedUrl;
  const showPhoto = resolvedUrl && !imgError && platform === "chesscom";
  const showShimmer = !propAvatarUrl && status === "loading" && platform === "chesscom";
  const showFlair = platform === "lichess" && flairEmoji;
  const fontSize = Math.round(size * 0.38);
  const emojiFontSize = Math.round(size * 0.52);
  const badgeSize = Math.round(size * 0.38);

  return (
    <div
      className={`relative flex-shrink-0 rounded-full overflow-hidden ${className}`}
      style={{ width: size, height: size }}
    >
      {showShimmer ? (
        /* Shimmer skeleton while chess.com avatar loads */
        <div className="w-full h-full animate-shimmer rounded-full" />
      ) : showPhoto ? (
        /* chess.com avatar photo */
        <img
          src={resolvedUrl!}
          alt={`${username}'s avatar`}
          className="w-full h-full object-cover"
          crossOrigin="anonymous"
          aria-hidden="true"
          onError={() => setImgError(true)}
        />
      ) : showFlair ? (
        /* Lichess flair emoji on a dark gradient background */
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-500 to-orange-700">
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
        /* Initials fallback */
        <div
          className={`w-full h-full flex items-center justify-center ${colorClass}`}
        >
          <span
            className="font-bold text-white leading-none"
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
            platform === "lichess" ? "bg-orange-500" : "bg-[#81b64c]"
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
