import { useLocation } from "wouter";
import { useTheme } from "@/contexts/ThemeContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NavLogo } from "@/components/NavLogo";
import { Crown, ChevronLeft, Search } from "lucide-react";
import { SpinBorderButton } from "@/components/ui/spin-border-button";

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
        className={`sticky top-0 z-40 border-b otb-header-safe transition-colors duration-300 ${
          isDark
            ? "bg-[oklch(0.20_0.06_145)]/95 backdrop-blur-md border-white/08"
            : "bg-white/95 backdrop-blur-md border-[#ADBC9F]/70"
        }`}
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <NavLogo />
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
                isDark ? "bg-[#436850] text-white" : "bg-[#436850] text-white"
              }`}
            >
              ?
            </div>
          </div>

          {/* 404 badge */}
          <div
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-4 ${
              isDark ? "bg-[#436850]/20 text-[#4CAF50]" : "bg-[#436850]/10 text-[#436850]"
            }`}
          >
            <Search className="w-3 h-3" />
            404 — Not Found
          </div>

          <h1
            className={`text-4xl font-bold tracking-tight mb-3 ${isDark ? "text-white" : "text-[#12372A]"}`}
            style={{ fontFamily: "'Clash Display', sans-serif" }}
          >
            This board is empty.
          </h1>
          <p className={`text-base mb-8 leading-relaxed ${isDark ? "text-white/70" : "text-[#436850]"}`}>
            The page you're looking for doesn't exist or may have been moved. Check the URL or head back to the home page.
          </p>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => setLocation("/")}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-[#436850] text-white text-sm font-semibold rounded-xl hover:bg-[#2A4A32] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg shadow-[#436850]/30"
              style={{ fontFamily: "'Clash Display', sans-serif" }}
            >
              <Crown className="w-4 h-4" />
              Go to Home
            </button>
            <SpinBorderButton
              variant="glass"
              onClick={() => window.history.back()}
            >
              <ChevronLeft className="w-4 h-4" />
              Go Back
            </SpinBorderButton>
          </div>

          {/* Quick links */}
          <div className={`mt-10 pt-8 border-t ${isDark ? "border-white/08" : "border-[#ADBC9F]/70"}`}>
            <p className={`text-xs font-semibold uppercase tracking-widest mb-4 ${isDark ? "text-white/55" : "text-[#436850]"}`}>
              Quick links
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {[
                { label: "Join a Tournament", href: "/join" },
                { label: "Tools", href: "/training" },
                { label: "Clubs", href: "/clubs" },
                { label: "Demo Tournament", href: "/tournament/otb-demo-2026" },
                { label: "League Demo", href: "/league-demo" },
              ].map(({ label, href }) => (
                <a
                  key={href}
                  href={href}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    isDark
                      ? "border-white/10 text-white/70 hover:text-white hover:border-white/25 bg-white/05"
                      : "border-[#ADBC9F] text-[#436850] hover:text-[#12372A] hover:border-[#ADBC9F] bg-white"
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
