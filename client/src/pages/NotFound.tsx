import { useLocation } from "wouter";
import { useTheme } from "@/contexts/ThemeContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Crown, ChevronLeft, Search } from "lucide-react";

export default function NotFound() {
  const [, setLocation] = useLocation();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div
      className={`min-h-screen flex flex-col transition-colors duration-300 ${
        isDark ? "bg-[oklch(0.18_0.05_145)]" : "bg-[#F7FAF8]"
      }`}
    >
      {/* Header */}
      <header
        className={`sticky top-0 z-40 border-b transition-colors duration-300 ${
          isDark
            ? "bg-[oklch(0.20_0.06_145)]/95 backdrop-blur-md border-white/08"
            : "bg-white/95 backdrop-blur-md border-gray-100"
        }`}
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 group">
            <div className="w-7 h-7 bg-[#3D6B47] rounded-md flex items-center justify-center">
              <Crown className="w-3.5 h-3.5 text-white" strokeWidth={2} />
            </div>
            <span
              className={`font-semibold text-sm ${isDark ? "text-white/80" : "text-gray-700"}`}
              style={{ fontFamily: "'Clash Display', sans-serif" }}
            >
              OTB Chess
            </span>
          </a>
          <ThemeToggle />
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="text-center max-w-md">
          {/* Chess piece icon */}
          <div className="relative inline-flex mb-8">
            <div
              className={`w-24 h-24 rounded-2xl flex items-center justify-center ${
                isDark ? "bg-[oklch(0.22_0.06_145)]" : "bg-white"
              } shadow-lg`}
            >
              <span className="text-5xl select-none">♟</span>
            </div>
            <div
              className={`absolute -top-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                isDark ? "bg-[#3D6B47] text-white" : "bg-[#3D6B47] text-white"
              }`}
            >
              ?
            </div>
          </div>

          {/* 404 badge */}
          <div
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-4 ${
              isDark ? "bg-[#3D6B47]/20 text-[#4CAF50]" : "bg-[#3D6B47]/10 text-[#3D6B47]"
            }`}
          >
            <Search className="w-3 h-3" />
            404 — Not Found
          </div>

          <h1
            className={`text-4xl font-bold tracking-tight mb-3 ${isDark ? "text-white" : "text-gray-900"}`}
            style={{ fontFamily: "'Clash Display', sans-serif" }}
          >
            This board is empty.
          </h1>
          <p className={`text-base mb-8 leading-relaxed ${isDark ? "text-white/50" : "text-gray-500"}`}>
            The page you're looking for doesn't exist or may have been moved. Check the URL or head back to the home page.
          </p>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => setLocation("/")}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-[#3D6B47] text-white text-sm font-semibold rounded-xl hover:bg-[#2A4A32] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg shadow-[#3D6B47]/30"
              style={{ fontFamily: "'Clash Display', sans-serif" }}
            >
              <Crown className="w-4 h-4" />
              Go to Home
            </button>
            <button
              onClick={() => window.history.back()}
              className={`flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold rounded-xl border transition-all duration-200 hover:-translate-y-0.5 ${
                isDark
                  ? "border-white/15 text-white/70 hover:text-white hover:border-white/30 bg-white/05"
                  : "border-gray-200 text-gray-600 hover:text-gray-900 hover:border-gray-300 bg-white"
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
              Go Back
            </button>
          </div>

          {/* Quick links */}
          <div className={`mt-10 pt-8 border-t ${isDark ? "border-white/08" : "border-gray-100"}`}>
            <p className={`text-xs font-semibold uppercase tracking-widest mb-4 ${isDark ? "text-white/30" : "text-gray-400"}`}>
              Quick links
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {[
                { label: "Join a Tournament", href: "/join" },
                { label: "Archive", href: "/tournaments" },
                { label: "Demo Tournament", href: "/tournament/otb-demo-2026" },
              ].map(({ label, href }) => (
                <a
                  key={href}
                  href={href}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    isDark
                      ? "border-white/10 text-white/50 hover:text-white hover:border-white/20 bg-white/04"
                      : "border-gray-200 text-gray-500 hover:text-gray-800 hover:border-gray-300 bg-white"
                  }`}
                >
                  {label}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
