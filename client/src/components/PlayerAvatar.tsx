/**
 * OTB Chess — PlayerAvatar
 *
 * A compact, reusable avatar component that fetches a player's chess.com
 * profile photo and displays it in a rounded container. Falls back to
 * styled initials when no photo is available or while loading.
 *
 * Props:
 *   username  — chess.com username (used for API fetch)
 *   name      — display name (used for initials fallback)
 *   size      — pixel size of the avatar (default 32)
 *   className — additional Tailwind classes for the outer wrapper
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
  size?: number;
  className?: string;
  /** When true, shows a small chess.com badge on the photo */
  showBadge?: boolean;
}

export function PlayerAvatar({
  username,
  name,
  size = 32,
  className = "",
  showBadge = false,
}: PlayerAvatarProps) {
  const { url, status } = useChessAvatar(username);
  const [imgError, setImgError] = useState(false);

  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const colorClass = usernameToColor(username);
  const showPhoto = status === "loaded" && url && !imgError;
  const showShimmer = status === "loading";
  const fontSize = Math.round(size * 0.38);
  const badgeSize = Math.round(size * 0.38);

  return (
    <div
      className={`relative flex-shrink-0 rounded-full overflow-hidden ${className}`}
      style={{ width: size, height: size }}
    >
      {showShimmer ? (
        /* Shimmer skeleton */
        <div className="w-full h-full animate-shimmer rounded-full" />
      ) : showPhoto ? (
        /* chess.com avatar photo */
        <img
          src={url}
          alt={`${username}'s avatar`}
          className="w-full h-full object-cover"
          crossOrigin="anonymous"
          onError={() => setImgError(true)}
        />
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

      {/* chess.com verified badge */}
      {showBadge && showPhoto && (
        <div
          className="absolute -bottom-0.5 -right-0.5 rounded-full bg-[#81b64c] border border-white/30 flex items-center justify-center"
          style={{ width: badgeSize, height: badgeSize }}
          title="chess.com verified"
        >
          <svg
            viewBox="0 0 24 24"
            className="fill-white"
            style={{ width: badgeSize * 0.6, height: badgeSize * 0.6 }}
          >
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
          </svg>
        </div>
      )}
    </div>
  );
}
