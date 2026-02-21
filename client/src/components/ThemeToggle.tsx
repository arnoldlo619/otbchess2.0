import { useTheme } from "@/contexts/ThemeContext";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      onClick={toggleTheme}
      className="theme-toggle"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
    >
      <span className="flex items-center justify-center transition-transform duration-300">
        {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </span>
    </button>
  );
}
