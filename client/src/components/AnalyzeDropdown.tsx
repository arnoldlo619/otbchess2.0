/**
 * AnalyzeDropdown — Dropdown menu for the Analyze nav item.
 *
 * Provides two navigation options:
 *   1. "Analysis" — Navigate to games history page (for analyzing past games)
 *   2. "Matchup Prep" — Navigate to matchup prep page (for preparing against opponents)
 *
 * Rendered below the "Analyze" tab on hover.
 */

import { Link } from "wouter";
import { BarChart3, Target } from "lucide-react";
import { cn } from "@/lib/utils";

export function AnalyzeDropdown() {
  return (
    <div
      className={cn(
        "absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 rounded-lg",
        "bg-white dark:bg-[#1a2f1f] border border-gray-200 dark:border-[#2d4a35]",
        "shadow-lg dark:shadow-2xl z-50",
        "py-2 px-0"
      )}
    >
      {/* Analysis Option */}
      <Link
        href="/games"
        className={cn(
          "flex items-center gap-3 px-4 py-2.5 text-sm font-medium",
          "text-gray-700 dark:text-gray-200",
          "hover:bg-gray-100 dark:hover:bg-[#2d4a35]",
          "transition-colors duration-150",
          "cursor-pointer"
        )}
      >
        <BarChart3 className="w-4 h-4 text-[#4CAF50]" />
        <span>Analysis</span>
      </Link>

      {/* Matchup Prep Option */}
      <Link
        href="/prep"
        className={cn(
          "flex items-center gap-3 px-4 py-2.5 text-sm font-medium",
          "text-gray-700 dark:text-gray-200",
          "hover:bg-gray-100 dark:hover:bg-[#2d4a35]",
          "transition-colors duration-150",
          "cursor-pointer"
        )}
      >
        <Target className="w-4 h-4 text-[#4CAF50]" />
        <span>Matchup Prep</span>
      </Link>
    </div>
  );
}
