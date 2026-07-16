import { useLocation, useSearch } from "wouter";
import { useTheme } from "@/contexts/ThemeContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NavLogo } from "@/components/NavLogo";
import { Crown, ChevronLeft, Search, WifiOff, Lock, UserX, Hash } from "lucide-react";
import { SpinBorderButton } from "@/components/ui/spin-border-button";

// ─── Error variant definitions ────────────────────────────────────────────────
type ErrorVariant = "404" | "invalid-code" | "closed" | "username-not-found" | "network";

interface ErrorConfig {
  icon: React.ReactNode;
  badge: string;
  headline: string;
  body: string;
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel?: string;
  secondaryHref?: string;
}

function getErrorConfig(variant: ErrorVariant): ErrorConfig {
  switch (variant) {
    case "invalid-code":
      return {
        icon: <Hash className="w-10 h-10 text-amber-400" />,
        badge: "Invalid Code",
        headline: "That code didn't match.",
        body: "The tournament code you entered doesn't exist or has expired. Double-check with your tournament director and try again.",
        primaryLabel: "Try Again",
        primaryHref: "/join",
        secondaryLabel: "Try the Demo",
        secondaryHref: "/join/OTB2026",
      };
    case "closed":
      return {
        icon: <Lock className="w-10 h-10 text-amber-400" />,
        badge: "Registration Closed",
        headline: "This tournament is no longer accepting players.",
        body: "Registration for this tournament has closed. Contact the tournament director if you believe this is an error, or find another open event.",
        primaryLabel: "Find Tournaments",
        primaryHref: "/tournaments",
        secondaryLabel: "Go Home",
        secondaryHref: "/",
      };
    case "username-not-found":
      return {
        icon: <UserX className="w-10 h-10 text-red-400" />,
        badge: "Player Not Found",
        headline: "We couldn't find that username.",
        body: "No chess.com or Lichess profile matched that username. Check the spelling and make sure your account is public.",
        primaryLabel: "Try Again",
        primaryHref: "/join",
        secondaryLabel: "Go Home",
        secondaryHref: "/",
      };
    case "network":
      return {
        icon: <WifiOff className="w-10 h-10 text-blue-400" />,
        badge: "Connection Error",
        headline: "Something went wrong.",
        body: "We couldn't reach the server. Check your internet connection and try again. Your registration data is safe.",
        primaryLabel: "Retry",
        primaryHref: typeof window !== "undefined" ? window.location.href : "/",
        secondaryLabel: "Go Home",
        secondaryHref: "/",
      };
    default: // 404
      return {
        icon: <span className="text-5xl select-none">♟</span>,
        badge: "404 — Not Found",
        headline: "This board is empty.",
        body: "The page you're looking for doesn't exist or may have been moved. Check the URL or head back to the home page.",
        primaryLabel: "Go to Home",
        primaryHref: "/",
        secondaryLabel: "Go Back",
        secondaryHref: "__back__",
      };
  }
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function NotFound() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  // Allow ?error=invalid-code|closed|username-not-found|network to surface specific variants
  const errorParam = (() => {
    try {
      return new URLSearchParams(search ?? "").get("error") as ErrorVariant | null;
    } catch {
      return null;
    }
  })();
  const variant: ErrorVariant = (errorParam && ["invalid-code", "closed", "username-not-found", "network"].includes(errorParam))
    ? errorParam
    : "404";

  const config = getErrorConfig(variant);

  const badgeColor = {
    "404": isDark ? "bg-[#436850]/20 text-[#4CAF50]" : "bg-[#436850]/10 text-[#436850]",
    "invalid-code": isDark ? "bg-amber-500/15 text-amber-300" : "bg-amber-50 text-amber-700",
    "closed": isDark ? "bg-amber-500/15 text-amber-300" : "bg-amber-50 text-amber-700",
    "username-not-found": isDark ? "bg-red-500/15 text-red-300" : "bg-red-50 text-red-700",
    "network": isDark ? "bg-blue-500/15 text-blue-300" : "bg-blue-50 text-blue-700",
  }[variant];

  const iconBg = {
    "404": isDark ? "bg-[oklch(0.22_0.06_145)]" : "bg-white",
    "invalid-code": isDark ? "bg-amber-500/10" : "bg-amber-50",
    "closed": isDark ? "bg-amber-500/10" : "bg-amber-50",
    "username-not-found": isDark ? "bg-red-500/10" : "bg-red-50",
    "network": isDark ? "bg-blue-500/10" : "bg-blue-50",
  }[variant];

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
          {/* Icon */}
          <div className="relative inline-flex mb-8">
            <div
              className={`w-24 h-24 rounded-2xl flex items-center justify-center shadow-lg ${iconBg}`}
            >
              {config.icon}
            </div>
            {variant === "404" && (
              <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold bg-[#436850] text-white">
                ?
              </div>
            )}
          </div>

          {/* Badge */}
          <div
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-4 ${badgeColor}`}
          >
            <Search className="w-3 h-3" />
            {config.badge}
          </div>

          <h1
            className={`text-3xl sm:text-4xl font-bold tracking-tight mb-3 ${isDark ? "text-white" : "text-[#12372A]"}`}
            style={{ fontFamily: "'Clash Display', sans-serif" }}
          >
            {config.headline}
          </h1>
          <p className={`text-base mb-8 leading-relaxed ${isDark ? "text-white/70" : "text-[#436850]"}`}>
            {config.body}
          </p>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => {
                if (config.primaryHref === "__back__") window.history.back();
                else setLocation(config.primaryHref);
              }}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-[#436850] text-white text-sm font-semibold rounded-xl hover:bg-[#2A4A32] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg shadow-[#436850]/30"
              style={{ fontFamily: "'Clash Display', sans-serif" }}
            >
              <Crown className="w-4 h-4" />
              {config.primaryLabel}
            </button>
            {config.secondaryLabel && (
              <SpinBorderButton
                variant="glass"
                onClick={() => {
                  if (config.secondaryHref === "__back__") window.history.back();
                  else setLocation(config.secondaryHref!);
                }}
              >
                <ChevronLeft className="w-4 h-4" />
                {config.secondaryLabel}
              </SpinBorderButton>
            )}
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
