/**
 * AchievementBadge
 *
 * SVG-based badge component for displaying player achievements.
 * Supports multiple badge types with distinct visual treatments.
 * Renders inline or in a grid, with tooltip on hover.
 */

import { useState } from "react";

export type AchievementType =
  | "quad_champion"
  | "quad1_champion"
  | "perfect_score"
  | "undefeated"
  | "upset_winner"
  | "tournament_mvp"
  | "most_improved"
  | "best_game"
  | "sportsmanship";

interface AchievementBadgeProps {
  type: AchievementType;
  size?: number;
  showLabel?: boolean;
  earned?: string; // date earned
  tournamentName?: string;
}

const BADGE_CONFIG: Record<AchievementType, {
  label: string;
  shortLabel: string;
  description: string;
  primaryColor: string;
  secondaryColor: string;
  icon: string; // SVG path data
}> = {
  quad_champion: {
    label: "Quad Champion",
    shortLabel: "Champion",
    description: "Won your quad section",
    primaryColor: "oklch(0.75 0.15 85)",   // gold
    secondaryColor: "oklch(0.55 0.12 85)",
    icon: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
  },
  quad1_champion: {
    label: "Quad 1 Champion",
    shortLabel: "Quad 1",
    description: "Won the top-rated quad section",
    primaryColor: "oklch(0.80 0.18 85)",   // bright gold
    secondaryColor: "oklch(0.60 0.15 85)",
    icon: "M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z",
  },
  perfect_score: {
    label: "Perfect Score",
    shortLabel: "Perfect",
    description: "Won all games in the tournament",
    primaryColor: "oklch(0.70 0.20 145)", // emerald green
    secondaryColor: "oklch(0.50 0.15 145)",
    icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  undefeated: {
    label: "Undefeated",
    shortLabel: "Undefeated",
    description: "Finished without a single loss",
    primaryColor: "oklch(0.65 0.15 250)", // steel blue
    secondaryColor: "oklch(0.45 0.12 250)",
    icon: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  },
  upset_winner: {
    label: "Upset Winner",
    shortLabel: "Upset",
    description: "Won as the lowest-seeded player",
    primaryColor: "oklch(0.70 0.18 30)",  // orange-red
    secondaryColor: "oklch(0.50 0.15 30)",
    icon: "M13 10V3L4 14h7v7l9-11h-7z",
  },
  tournament_mvp: {
    label: "Tournament MVP",
    shortLabel: "MVP",
    description: "Most valuable player of the tournament",
    primaryColor: "oklch(0.75 0.20 300)", // purple
    secondaryColor: "oklch(0.55 0.15 300)",
    icon: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
  },
  most_improved: {
    label: "Most Improved",
    shortLabel: "Improved",
    description: "Showed the most rating improvement",
    primaryColor: "oklch(0.65 0.15 170)", // teal
    secondaryColor: "oklch(0.45 0.12 170)",
    icon: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6",
  },
  best_game: {
    label: "Best Game",
    shortLabel: "Best Game",
    description: "Played the most impressive game",
    primaryColor: "oklch(0.70 0.15 200)", // cyan
    secondaryColor: "oklch(0.50 0.12 200)",
    icon: "M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z",
  },
  sportsmanship: {
    label: "Sportsmanship",
    shortLabel: "Sportsman",
    description: "Recognized for excellent sportsmanship",
    primaryColor: "oklch(0.70 0.12 60)",  // warm yellow
    secondaryColor: "oklch(0.50 0.10 60)",
    icon: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z",
  },
};

export default function AchievementBadge({
  type,
  size = 32,
  showLabel = false,
  earned,
  tournamentName,
}: AchievementBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const config = BADGE_CONFIG[type];
  if (!config) return null;

  const innerSize = size * 0.5;

  return (
    <div
      className="relative inline-flex flex-col items-center"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* Badge SVG */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="drop-shadow-sm"
      >
        {/* Outer ring */}
        <circle cx="24" cy="24" r="22" fill={config.secondaryColor} opacity="0.3" />
        <circle cx="24" cy="24" r="20" fill="oklch(0.14 0.03 145)" />
        <circle cx="24" cy="24" r="18" stroke={config.primaryColor} strokeWidth="2" fill="none" opacity="0.8" />

        {/* Inner glow */}
        <circle cx="24" cy="24" r="15" fill={config.primaryColor} opacity="0.08" />

        {/* Icon */}
        <g transform={`translate(${24 - innerSize / 2}, ${24 - innerSize / 2}) scale(${innerSize / 24})`}>
          <path
            d={config.icon}
            fill="none"
            stroke={config.primaryColor}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      </svg>

      {/* Label below badge */}
      {showLabel && (
        <span
          className="text-[9px] font-medium mt-0.5 text-center leading-tight"
          style={{ color: config.primaryColor }}
        >
          {config.shortLabel}
        </span>
      )}

      {/* Tooltip */}
      {showTooltip && (
        <div
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 rounded-lg text-center whitespace-nowrap z-50 pointer-events-none"
          style={{ background: "oklch(0.20 0.04 145)", border: "1px solid oklch(0.30 0.05 145)" }}
        >
          <div className="text-[10px] font-semibold" style={{ color: "oklch(0.90 0.02 145)" }}>
            {config.label}
          </div>
          <div className="text-[9px]" style={{ color: "oklch(0.60 0.04 145)" }}>
            {config.description}
          </div>
          {tournamentName && (
            <div className="text-[8px] mt-0.5" style={{ color: "oklch(0.50 0.04 145)" }}>
              {tournamentName}{earned ? ` • ${earned}` : ""}
            </div>
          )}
          {/* Tooltip arrow */}
          <div
            className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0"
            style={{ borderLeft: "4px solid transparent", borderRight: "4px solid transparent", borderTop: "4px solid oklch(0.30 0.05 145)" }}
          />
        </div>
      )}
    </div>
  );
}

// ─── Badge Grid (for profile display) ────────────────────────────────────────

interface Achievement {
  type: AchievementType;
  tournamentName: string;
  earned: string;
}

export function AchievementBadgeGrid({
  achievements,
  maxVisible = 6,
  badgeSize = 28,
}: {
  achievements: Achievement[];
  maxVisible?: number;
  badgeSize?: number;
}) {
  const visible = achievements.slice(0, maxVisible);
  const remaining = achievements.length - maxVisible;

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {visible.map((a, i) => (
        <AchievementBadge
          key={`${a.type}-${i}`}
          type={a.type}
          size={badgeSize}
          tournamentName={a.tournamentName}
          earned={a.earned}
        />
      ))}
      {remaining > 0 && (
        <span
          className="text-[9px] font-medium px-1.5 py-0.5 rounded-full"
          style={{ background: "oklch(0.22 0.04 145)", color: "oklch(0.60 0.04 145)" }}
        >
          +{remaining}
        </span>
      )}
    </div>
  );
}

// Export config for use in other components
export { BADGE_CONFIG };
export type { AchievementBadgeProps };
