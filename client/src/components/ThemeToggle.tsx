import { useTheme } from "@/contexts/ThemeContext";
import { Sun, Moon } from "lucide-react";

/**
 * ThemeToggle — canonical appearance-mode toggle button.
 * Pill style with Sun/Moon icon + slide track.
 * Use this component everywhere a theme toggle is needed in the nav bar.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      onClick={() => toggleTheme?.()}
      title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border transition-all ${
        isDark
          ? "border-white/15 bg-white/08 hover:bg-white/15 text-white/60 hover:text-white"
          : "border-gray-200 bg-white/80 hover:bg-gray-100 text-gray-500 hover:text-gray-800 shadow-sm"
      } backdrop-blur-md ${className}`}
    >
      {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
      {/* Slide track */}
      <div
        className="w-7 h-3.5 rounded-full flex items-center transition-colors flex-shrink-0"
        style={{ background: isDark ? "rgba(255,255,255,0.15)" : "#4CAF50" }}
      >
        <div
          className="w-2.5 h-2.5 rounded-full bg-white shadow transition-transform mx-0.5"
          style={{ transform: isDark ? "translateX(0)" : "translateX(14px)" }}
        />
      </div>
    </button>
  );
}
