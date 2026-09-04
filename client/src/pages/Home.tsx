/*
 * OTB Chess Landing Page
 * Design: "The Board Room" with Apple Minimalism and Chess.com Green
 * Dark Mode: Deep Forest Green CTA Aesthetic with green checkered background and white text
 *
 * Sections:
 * 1. Navigation (with light/dark toggle)
 * 2. Hero
 * 3. Stats Bar
 * 4. How It Works
 * 5. Features
 * 6. Showcase
 * 7. Player ELO Demo
 * 8. Conversion CTA
 * 9. CTA
 * 10. Footer
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, useInView as useMotionInView } from "framer-motion";
import { useChessComProfile } from "@/hooks/useChessComProfile";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { useTheme } from "@/contexts/ThemeContext";
import { usePageMeta } from "@/hooks/usePageMeta";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TOURNAMENT_WIZARD_ACTIVE_KEY, TournamentWizard } from "@/components/TournamentWizard";
import { getAllRegistrations } from "@/lib/registrationStore";
import { resolveTournament, listTournaments, hasDirectorSession } from "@/lib/tournamentRegistry";
import { stripCreateAction } from "@/lib/routeRedirects";
import { DashboardDropdown } from "@/components/DashboardDropdown";

import AuthModal from "../components/AuthModal";
import { ProUpgradeModal } from "../components/ProUpgradeModal";
import { useAuthContext } from "../context/AuthContext";
import {
  Trophy,
  Users,
  Zap,
  Menu,
  X,
  Crown,
  Swords,
  BarChart3,
  Clock as _Clock,
  CheckCircle2 as _CheckCircle2,
  ArrowRight,
  Shield,
  Home as _HomeIcon,
  Building2,
  Video as _Video,
  LogIn as _LogIn,
  LogOut as _LogOut,
  ChevronDown as _ChevronDown,
  Ghost,
  LayoutDashboard,
  BookOpen,
  Brain,
  GraduationCap,
} from "lucide-react";
import { AnimeNavBar } from "@/components/ui/anime-navbar";
import {
  DESKTOP_NAV_ITEMS,
  FOOTER_NAV_ITEMS,
  MOBILE_NAV_ITEMS,
  NAV_CTA_PRIMARY,
  NAV_CTA_SECONDARY,
  isNavItemActive,
} from "@/lib/navRegistry";
import {AvatarNavDropdown} from "@/components/AvatarNavDropdown";
import { MobileNavDrawer } from "@/components/MobileNavDrawer";
import { AnnouncementBanner } from "@/components/ui/announcement-banner";
import { SpinBorderButton } from "@/components/ui/spin-border-button";
import { HeroDashboardMockup } from "@/components/ui/HeroDashboardMockup";
import { AsciiArt } from "@/components/ui/d60-hero";
import { PatternText } from "@/components/ui/pattern-text";
import { normalizePlatformStats } from "@/lib/platformStats";

const LIVE_TOURNAMENT_DEMO_PATH = "/tournament/otb-demo-2026/manage";

// ─── CDN Assets ─────────────────────────────────────────────────────────────
// Mascot illustrations removed; sections use clean text-only layouts.

// ─── Intersection Observer Hook ─────────────────────────────────────────────
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true); },
      { threshold }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

// ─── Count-Up Hook ───────────────────────────────────────────────────────────
// Animates a number from 0 → target over `duration` ms using easeOutExpo.
// `suffix` is appended verbatim (e.g. "+", "★"). `decimals` controls precision.
function useCountUp(
  target: number,
  active: boolean,
  { duration = 1800, suffix = "", decimals = 0, delay = 0 }: {
    duration?: number;
    suffix?: string;
    decimals?: number;
    delay?: number;
  } = {}
) {
  const [display, setDisplay] = useState(`0${suffix}`);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) return;
    // Respect prefers-reduced-motion; jump straight to target.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const fmt = decimals > 0
        ? target.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
        : target.toLocaleString();
      setDisplay(`${fmt}${suffix}`);
      return;
    }
    const timer = setTimeout(() => {
      const easeOutExpo = (t: number) =>
        t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      const tick = (timestamp: number) => {
        if (!startRef.current) startRef.current = timestamp;
        const elapsed = timestamp - startRef.current;
        const progress = Math.min(elapsed / duration, 1);
        const eased = easeOutExpo(progress);
        const current = eased * target;
        const fmt = decimals > 0
          ? current.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
          : Math.floor(current).toLocaleString();
        setDisplay(`${fmt}${suffix}`);
        if (progress < 1) {
          rafRef.current = requestAnimationFrame(tick);
        }
      };
      rafRef.current = requestAnimationFrame(tick);
    }, delay);
    return () => {
      clearTimeout(timer);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      startRef.current = null;
    };
  }, [active, target, duration, suffix, decimals, delay]);

  return display;
}

// ─── Navigation ─────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function Nav({
  onCreateTournament: _onCreateTournament,
  onSignIn,
  onUpgrade,
}: {
  onCreateTournament: () => void;
  onSignIn: () => void;
  onUpgrade?: () => void;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme } = useTheme();

  const isDark = theme === "dark";
  const { user, logout } = useAuthContext();
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const [currentPath] = useLocation();

  return (
    <nav
      aria-label="Main navigation"
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? isDark
            ? "bg-[oklch(0.20_0.06_145)] backdrop-blur-md border-b border-white/10 shadow-sm"
            : "bg-[#F2F7F3]/96 backdrop-blur-md border-b border-[#436850]/12 shadow-sm"
          : "bg-transparent"
      }`}
    >
      <div className="container flex items-center justify-between h-[72px]">
        {/* Logo navigates to landing page */}
        <Link href="/" className="flex items-center gap-1 group cursor-pointer">
          <img
            src="/manus-storage/chessotb-wordmark-320_e1731168.webp"
            alt="OTB Chess Home"
            className={`nav-logo h-8 w-auto object-contain transition-opacity hover:opacity-80 active:opacity-60 ${isDark ? "nav-logo-dark" : ""}`}
          />
        </Link>

        {/* Desktop Links use canonical order from NAV_REGISTRY */}
        <div className="hidden md:flex items-center gap-1">
          {DESKTOP_NAV_ITEMS.map((item) => {
            const isActive = isNavItemActive(item, currentPath);
            return (
              <Link
                key={item.key}
                href={item.path}
                className={`min-h-[44px] px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center ${
                  isActive
                    ? isDark ? "text-white bg-white/10" : "text-[#12372A] bg-[#436850]/12"
                    : isDark ? "text-white/60 hover:text-white hover:bg-white/08" : "text-[#436850] hover:text-[#12372A] hover:bg-[#436850]/08"
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        {/* Right-side: Host Tournament CTA + Sign In / Avatar + Theme Toggle */}
        <div className="hidden md:flex items-center gap-3">
          {/* Host Tournament CTA */}
          <Link
            href={NAV_CTA_PRIMARY.path}
            className={`min-h-[44px] px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center border ${
              isDark
                ? "bg-[#436850] text-white border-[#436850] hover:bg-[#2A4A32]"
                : "bg-[#436850] text-white border-[#436850] hover:bg-[#2A4A32]"
            }`}
          >
            {NAV_CTA_PRIMARY.label}
          </Link>

          {user ? (
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                aria-label="User menu"
                aria-expanded={userMenuOpen}
                className={`min-h-[44px] flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium transition-all border ${
                  user.isGuest
                    ? isDark ? "border-amber-500/30 text-amber-300 hover:bg-amber-500/10" : "border-amber-500/30 text-amber-600 hover:bg-amber-50"
                    : isDark
                      ? "border-white/20 text-white/80 hover:bg-white/10"
                      : "border-[#436850]/20 text-[#436850] hover:bg-[#436850]/08"
                }`}
              >
                {user.isGuest ? (
                  <Ghost className="w-4 h-4" />
                ) : (
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    isDark ? "bg-[#436850] text-white" : "bg-[#436850] text-white"
                  }`}>
                    {(user.displayName || user.email).charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="max-w-[80px] truncate">{user.displayName || user.email}</span>
                {user.isGuest && <span className="text-xs opacity-60">(guest)</span>}
              </button>
              {userMenuOpen && (
                <div
                  className={`absolute right-0 top-full mt-2 w-48 rounded-xl shadow-xl border z-50 overflow-hidden ${
                    isDark ? "bg-[oklch(0.22_0.06_145)] border-white/10" : "bg-white border-[#436850]/12"
                  }`}
                  onMouseLeave={() => setUserMenuOpen(false)}
                >
                  {!user.isGuest && (
                    <Link
                      href="/profile"
                      className={`flex items-center gap-2 px-4 py-3 text-sm transition-colors ${
                        isDark ? "text-white/80 hover:bg-white/08" : "text-[#1a1a1a] hover:bg-[#436850]/06"
                      }`}
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <Crown className="w-4 h-4" /> My Profile
                    </Link>
                  )}
                  {user.isGuest && (
                    <button
                      onClick={() => { setUserMenuOpen(false); onUpgrade?.(); }}
                      className={`flex items-center gap-2 w-full px-4 py-3 text-sm transition-colors ${
                        isDark ? "text-amber-300 hover:bg-amber-500/10" : "text-amber-600 hover:bg-amber-50"
                      }`}
                    >
                      <Crown className="w-4 h-4" /> Create Free Account
                    </button>
                  )}
                  <button
                    onClick={() => { logout(); setUserMenuOpen(false); }}
                    className={`flex items-center gap-2 w-full px-4 py-3 text-sm transition-colors border-t ${
                      isDark ? "text-red-400 hover:bg-white/08 border-white/08" : "text-red-500 hover:bg-red-50 border-[#ADBC9F]/70"
                    }`}
                  >
                    <X className="w-4 h-4" /> Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={onSignIn}
              className={`min-h-[44px] px-3 py-2 text-sm font-medium transition-colors rounded-lg ${
                isDark ? "text-white/70 hover:text-white hover:bg-white/08" : "text-[#436850] hover:text-[#2A4A32] hover:bg-[#436850]/08"
              }`}
            >
              Sign In
            </button>
          )}
          <ThemeToggle />
        </div>

        {/* Mobile: toggle + menu */}
        <div className="md:hidden flex items-center gap-2">
          <button
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-foreground rounded-lg"
            aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className={`md:hidden border-b px-4 pb-4 ${isDark ? "bg-[oklch(0.20_0.06_145)] border-white/10" : "bg-[#F2F7F3] border-[#436850]/12"}`}>
          {/* Host Tournament CTA at top of mobile menu */}
          <Link
            href={NAV_CTA_PRIMARY.path}
            className={`flex items-center justify-center min-h-[48px] w-full mt-3 mb-2 rounded-xl text-sm font-semibold transition-colors ${
              isDark ? "bg-[#436850] text-white" : "bg-[#436850] text-white"
            }`}
            onClick={() => setMobileOpen(false)}
          >
            {NAV_CTA_PRIMARY.label}
          </Link>
          {/* Canonical nav items */}
          {MOBILE_NAV_ITEMS.map((item) => {
            const isActive = isNavItemActive(item, currentPath);
            return (
              <Link
                key={item.key}
                href={item.path}
                className={`flex items-center min-h-[48px] w-full py-3 text-sm font-medium border-b ${
                  isActive
                    ? isDark ? "text-white border-white/08" : "text-[#12372A] border-[#ADBC9F]"
                    : isDark ? "text-white/70 border-white/08" : "text-[#436850] border-[#ADBC9F]"
                }`}
                onClick={() => setMobileOpen(false)}
                aria-current={isActive ? "page" : undefined}
              >
                {item.label}
              </Link>
            );
          })}
          {user ? (
            <>
              <Link
                href="/profile"
                className={`flex items-center min-h-[48px] w-full py-3 text-sm font-medium border-b ${
                  isDark ? "text-white/70 border-white/08" : "text-[#436850] border-[#ADBC9F]"
                }`}
                onClick={() => setMobileOpen(false)}
              >
                My Profile ({user.displayName || user.email})
              </Link>
              <button
                onClick={() => { logout(); setMobileOpen(false); }}
                className={`flex items-center min-h-[48px] w-full text-left py-3 text-sm font-medium border-b text-red-500 ${
                  isDark ? "border-white/08" : "border-[#ADBC9F]"
                }`}
              >
                Sign Out
              </button>
            </>
          ) : (
            <button
              onClick={() => { onSignIn(); setMobileOpen(false); }}
              className={`flex items-center min-h-[48px] w-full text-left py-3 text-sm font-medium border-b ${
                isDark ? "text-white/70 border-white/08" : "text-[#436850] border-[#ADBC9F]"
              }`}
            >
              Sign In
            </button>
          )}
        </div>
      )}
    </nav>
  );
}

// ─── Hero Section ────────────────────────────────────────────────────────────
function Hero({ onCreateTournament }: { onCreateTournament: () => void }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const DARK_SCREENSHOT = "/manus-storage/Screenshot2026-07-09at5.47.32PM_dcaca0c6.png";
  const LIGHT_SCREENSHOT = "/manus-storage/Screenshot2026-07-09at6.00.48PM_cf9817c3.png";

  return (
    <section className={`relative overflow-hidden pt-20 sm:pt-24 md:pt-16 pb-10 sm:pb-0 md:pb-10 transition-colors duration-500 ${isDark ? "bg-[oklch(0.20_0.06_145)]" : "bg-[#F5F8F5]"}`}>
      {/* Chess board texture */}
      <div className={`absolute inset-0 chess-board-bg pointer-events-none ${isDark ? "opacity-40" : "opacity-60"}`} />

      {/* Subtle radial glow */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[80vw] h-[60vh] pointer-events-none"
        style={{
          background: isDark
            ? "radial-gradient(ellipse at 50% 0%, oklch(0.44 0.12 145 / 0.14) 0%, transparent 70%)"
            : "radial-gradient(ellipse at 50% 0%, oklch(0.55 0.13 145 / 0.14) 0%, transparent 65%)",
        }}
      />

      <div className="container relative z-10 h-full">
        {/* Mobile-first hero content */}
        <div className="hero-mobile-content max-w-3xl mx-auto text-center flex flex-col justify-center gap-8 sm:block pt-4 sm:pt-16 lg:pt-24 pb-4 sm:pb-0">
          {/* ── Top group: announcement + heading + subtitle ── */}
          <div className="flex flex-col items-center">
            <div className="opacity-0-init animate-fade-in-up flex justify-center mb-4 sm:mb-8" style={{ animationDelay: "0.1s", animationFillMode: "forwards" }}>
              <AnnouncementBanner
                label="LIVE"
                text="View Live Tournament Demo!"
                href="/tournament/otb-demo-2026/manage"
                isDark={isDark}
              />
            </div>

            <h1
              className="opacity-0-init animate-fade-in-up text-[2.15rem] sm:text-5xl lg:text-6xl xl:text-7xl font-bold leading-[1.06] tracking-tight mb-3 sm:mb-6 text-foreground"
              style={{ fontFamily: "'Clash Display', sans-serif", animationDelay: "0.2s", animationFillMode: "forwards" }}
            >
              Chess Clubs,
              <br />
              Chess Tournaments,
              <br />
              <PatternText
                text="Over The Board."
                className={isDark ? "otb-pattern-text--dark" : "otb-pattern-text--light"}
              />
            </h1>

            {/* SEO H2, visually styled as a subtitle and semantically an H2 for crawlers */}
            <h2
              className="opacity-0-init animate-fade-in-up text-sm sm:text-lg leading-relaxed mb-0 sm:mb-10 max-w-xl mx-auto text-muted-foreground px-4 sm:px-0"
              style={{ animationDelay: "0.35s", animationFillMode: "forwards", fontWeight: 400 }}
            >
              Host tournaments with automatic pairings.
            </h2>
          </div>

          {/* ── Primary tournament actions ── */}
          <div className="flex flex-col items-center gap-0 sm:mt-0">
            <div
              className="opacity-0-init animate-fade-in-up flex flex-col sm:flex-row gap-2.5 sm:gap-3 justify-center items-center w-full max-w-[320px] sm:max-w-none mx-auto px-0"
              style={{
                animationDelay: "0.45s",
                animationFillMode: "forwards",
              }}
            >
              <SpinBorderButton
                variant="solid"
                onClick={onCreateTournament}
                className="w-full sm:w-auto"
              >
                Host Tournament
                <ArrowRight className="w-4 h-4" />
              </SpinBorderButton>
              <SpinBorderButton
                variant="outline"
                onClick={() => window.location.href = "/join"}
                className="w-full sm:w-auto"
              >
                Join a Tournament
                <ArrowRight className="w-4 h-4" />
              </SpinBorderButton>
            </div>
          </div>



        </div>

        {/* ── Hero Dashboard Mockup ── */}
        <HeroDashboardMockup
          darkScreenshotUrl={DARK_SCREENSHOT}
          lightScreenshotUrl={LIGHT_SCREENSHOT}
          isDark={isDark}
          alt="OTB!! Open 2026: live tournament dashboard with Swiss pairings, round timer, and board results"
        />
      </div>
    </section>
  );
}

/// ─── Stats Bar ───────────────────────────────────────────────────────────────
// Slot machine scramble hook randomises digits on hover then settles to the real value.
const SCRAMBLE_CHARS = "0123456789";
function useScramble(value: string, running: boolean) {
  const [scrambled, setScrambled] = useState(value);
  const frameRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const iterRef = useRef(0);
  useEffect(() => {
    if (frameRef.current) clearTimeout(frameRef.current);
    if (!running) { setScrambled(value); return; }
    iterRef.current = 0;
    const totalFrames = 10;
    const tick = () => {
      iterRef.current += 1;
      const progress = iterRef.current / totalFrames;
      const chars = value.split("").map((ch, i) => {
        if (!/[0-9]/.test(ch)) return ch;
        if (progress > i / value.length + 0.3) return ch;
        return SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
      });
      setScrambled(chars.join(""));
      if (iterRef.current < totalFrames) { frameRef.current = setTimeout(tick, 35); }
      else { setScrambled(value); }
    };
    tick();
    return () => { if (frameRef.current) clearTimeout(frameRef.current); };
  }, [running, value]);
  return scrambled;
}

function StatItem({
  target, suffix, decimals, label, delay, active, large = false,
}: {
  target: number; suffix: string; decimals: number;
  label: string; delay: number; active: boolean; large?: boolean;
}) {
  const display = useCountUp(target, active, { duration: 1600, suffix, decimals, delay });
  const [hovered, setHovered] = useState(false);
  const scrambled = useScramble(display, hovered);
  return (
    <div
      className="group cursor-default select-none"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <p
        className={`font-bold text-white mb-1 tabular-nums transition-colors duration-200 group-hover:text-[#7cf562] ${large ? "text-3xl sm:text-4xl lg:text-5xl" : "text-3xl"}`}
        style={{ fontFamily: "'Clash Display', sans-serif", letterSpacing: "-0.01em" }}
      >
        {scrambled}
      </p>
      <p className={`font-medium transition-colors duration-200 group-hover:text-white/90 text-white/70 ${large ? "text-xs sm:text-sm" : "text-sm"}`}>{label}</p>
    </div>
  );
}

function StatsBar() {
  const { ref, inView } = useInView();
  const [liveCounts, setLiveCounts] = useState<{ tournaments: number; players: number; clubs: number } | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  useEffect(() => {
    fetch("/api/platform/stats")
      .then((r) => r.ok ? r.json() : null)
      .then((data: { tournaments?: number; players?: number; clubs?: number } | null) => {
        if (data && typeof data.tournaments === "number") {
          setLiveCounts(normalizePlatformStats(data));
        }
      })
      .catch(() => { /* The neutral unavailable state is rendered below. */ })
      .finally(() => setStatsLoading(false));
  }, []);
  const stats: { target: number; suffix: string; decimals: number; label: string }[] = liveCounts ? [
    { target: liveCounts.tournaments, suffix: "+", decimals: 0, label: "Tournaments Hosted" },
    { target: liveCounts.players, suffix: "+", decimals: 0, label: "Players Registered" },
    { target: liveCounts.clubs, suffix: "+", decimals: 0, label: "Chess Clubs" },
  ] : [];
  return (
    <section
      ref={ref}
      className="relative overflow-hidden mt-0"
      style={{
/* Solid green band with hard contrast edges and no top or bottom faders */
        background: "#436850",
      }}
    >
      {/* Subtle chess texture overlay */}
      <div className="absolute inset-0 chess-board-bg opacity-10 pointer-events-none" />

      <div className="container relative z-10 py-6 sm:py-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-6 sm:gap-8">
          {statsLoading
            ? Array.from({ length: 3 }).map((_, i) => (
                <div key={i} data-testid="platform-stats-loading" className="flex flex-col items-center gap-2">
                  <div className="h-10 w-24 rounded-lg bg-white/20 animate-pulse" />
                  <div className="h-3 w-28 rounded bg-white/15 animate-pulse" />
                </div>
              ))
            : liveCounts ? stats.map((stat, i) => (
                <div
                  key={stat.label}
                  className={`stat-item text-center relative ${
                    inView ? "animate-stat-pop" : "opacity-0"
                  }`}
                  style={{ animationDelay: `${i * 90}ms`, animationFillMode: "forwards" }}
                >
                  <StatItem
                    target={stat.target}
                    suffix={stat.suffix}
                    decimals={stat.decimals}
                    label={stat.label}
                    delay={i * 90}
                    active={inView}
                    large
                  />
                </div>
              )) : (
                <p role="status" className="sm:col-span-3 text-center text-sm font-medium text-white/80">
                  Live platform activity is temporarily unavailable.
                </p>
              )
          }
        </div>

      </div>
    </section>
  );
}

// ─── How It Works ────────────────────────────────────────────────────────────
// ─── MacBook Mockup Frame ───────────────────────────────────────────────────
function MacBookMockup({ src, alt, isDark }: { src: string; alt: string; isDark: boolean }) {
  return (
    <div className="relative mx-auto select-none w-full">
      {/* Lid / Screen */}
      <div
        className="relative"
        style={{
          borderRadius: '12px 12px 0 0',
          background: isDark ? '#1c1c1e' : '#2a2a2a',
          padding: '10px 10px 0 10px',
          boxShadow: isDark
            ? '0 0 0 1px #3a3a3a, 0 -2px 8px rgba(0,0,0,0.6), 0 0 40px 4px oklch(0.65 0.14 145 / 0.22), 0 0 80px 12px oklch(0.65 0.14 145 / 0.10)'
            : '0 0 0 1px #555, 0 -2px 8px rgba(0,0,0,0.4), 0 0 40px 4px oklch(0.65 0.14 145 / 0.18), 0 0 80px 12px oklch(0.65 0.14 145 / 0.08)',
        }}
      >
        {/* Camera dot */}
        <div
          className="absolute left-1/2 -translate-x-1/2"
          style={{ top: 5, width: 6, height: 6, borderRadius: '50%', background: '#3a3a3a', zIndex: 10 }}
        />
        {/* Screen bezel */}
        <div
          style={{
            borderRadius: '6px 6px 0 0',
            overflow: 'hidden',
            aspectRatio: '16/10',
            background: '#000',
          }}
        >
          <img
            decoding="async"
            src={src}
            alt={alt}
            className="w-full h-full object-cover object-center"
            loading="lazy"
          />
        </div>
      </div>
      {/* Base / Hinge */}
      <div
        style={{
          height: 14,
          background: isDark
            ? 'linear-gradient(to bottom, #2a2a2a 0%, #1a1a1a 100%)'
            : 'linear-gradient(to bottom, #3a3a3a 0%, #2a2a2a 100%)',
          borderRadius: '0 0 4px 4px',
          boxShadow: isDark
            ? '0 4px 20px rgba(0,0,0,0.7), 0 0 0 1px #3a3a3a'
            : '0 4px 20px rgba(0,0,0,0.5), 0 0 0 1px #555',
        }}
      />
      {/* Foot / Bottom bar */}
      <div
        className="mx-auto"
        style={{
          height: 5,
          width: '80%',
          background: isDark ? '#222' : '#333',
          borderRadius: '0 0 8px 8px',
          boxShadow: isDark
            ? '0 6px 24px rgba(0,0,0,0.6)'
            : '0 6px 24px rgba(0,0,0,0.4)',
        }}
      />
    </div>
  );
}

// ─── iPhone Mockup Frame ────────────────────────────────────────────────────
function IPhoneMockup({ src, alt, isDark, objectPosition, objectFit }: { src: string; alt: string; isDark: boolean; objectPosition?: string; objectFit?: string }) {
  const [hovered, setHovered] = useState(false);
  // Responsive sizing: clamp between 220px (small mobile) and 320px (desktop)
  // Height maintains the 320:650 (≈1:2.03) aspect ratio
  return (
    <>
    <div
      className="relative mx-auto select-none"
      style={{
        width: "clamp(200px, min(80vw, 320px), 320px)",
        height: "clamp(406px, min(162.5vw, 650px), 650px)",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Gradient glow ring with soft green halo on hover */}
      <div
        className="absolute pointer-events-none z-0"
        style={{
          inset: -3,
          borderRadius: 54,
          opacity: hovered ? 1 : 0,
          boxShadow: hovered
            ? "0 0 28px 4px oklch(0.65 0.18 145 / 0.32), 0 0 56px 10px oklch(0.55 0.14 145 / 0.16), inset 0 0 0 1.5px oklch(0.72 0.22 145 / 0.5)"
            : "none",
          transition: "opacity 350ms ease, box-shadow 350ms ease",
        }}
      />
      {/* Left-side buttons position with the container via percentage */}
      <div className="absolute z-20 rounded-l-sm" style={{ left: -3, top: "21.5%", width: 3, height: "6.15%", background: "#2a2a2a" }} />
      <div className="absolute z-20 rounded-l-sm" style={{ left: -3, top: "30%", width: 3, height: "9.85%", background: "#2a2a2a" }} />
      <div className="absolute z-20 rounded-l-sm" style={{ left: -3, top: "42.3%", width: 3, height: "9.85%", background: "#2a2a2a" }} />
      {/* Right-side button */}
      <div className="absolute z-20 rounded-r-sm" style={{ right: -3, top: "31.5%", width: 3, height: "13.85%", background: "#2a2a2a" }} />

      {/* Phone outer shell, border only with transparent center */}
      <div
        className="absolute inset-0 z-10 pointer-events-none"
        style={{
          borderRadius: 50,
          border: "10px solid #1c1c1e",
          boxShadow: isDark
            ? "0 0 0 1px #3a3a3a, 0 40px 100px rgba(0,0,0,0.8), 0 8px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)"
            : "0 0 0 1px #444, 0 40px 100px rgba(0,0,0,0.5), 0 8px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)",
          background: "transparent",
        }}
      />

      {/* Screen area fills the interior */}
      <div
        className="absolute overflow-hidden"
        style={{
          top: 10,
          left: 10,
          right: 10,
          bottom: 10,
          borderRadius: 42,
          background: "#0a0a0a",
          zIndex: 1,
        }}
      >
        {/* Screenshot image */}
        <img
          decoding="async"
          src={src}
          alt={alt}
          className="absolute inset-0 w-full h-full"
          style={{ objectFit: (objectFit ?? 'fill') as React.CSSProperties["objectFit"], objectPosition: objectPosition ?? "center top" }}
          loading="lazy"
        />




      </div>
    </div>
    </>
  );
}

// ─── Parallax Step Block ─────────────────────────────────────────────────────

// Framer Motion variants for staggered step card reveals
const stepContainerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.11,
      delayChildren: 0.05,
    },
  },
};

const stepItemVariants = {
  hidden: { opacity: 0, y: 28 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: "easeOut" as const },
  },
};

const stepMockupVariants = {
  hidden: { opacity: 0, y: 52, scale: 0.93 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.85, ease: "easeOut" as const },
  },
};

const stepMockup2Variants = {
  hidden: { opacity: 0, y: 68, scale: 0.91 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.85, ease: "easeOut" as const, delay: 0.14 },
  },
};

const stepAccentVariants = {
  hidden: { opacity: 0, scaleX: 0, originX: 0 },
  visible: {
    opacity: 1,
    scaleX: 1,
    transition: { duration: 0.5, ease: "easeOut" as const, delay: 0.05 },
  },
};

function StepBadge({ number, icon, isDark }: { number: string; icon: React.ReactNode; isDark: boolean }) {
  return (
    <div className={`otb-step-badge ${isDark ? "otb-step-badge--dark" : ""}`}>
      <span className="otb-step-badge__icon" aria-hidden="true">{icon}</span>
      <span>Step {number}</span>
    </div>
  );
}

function ParallaxStep({
  number,
  icon,
  title,
  description,
  cta,
  ctaHref,
  imageSrc,
  imageAlt,
  imageSrc2,
  imageAlt2,
  objectPosition,
  objectPosition2,
  objectFit,
  objectFit2,
  phoneLeft,
  isDark,
  mockupType,
  caption1,
  caption2,
}: {
  number: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  cta?: string;
  ctaHref?: string;
  imageSrc: string;
  imageAlt: string;
  imageSrc2?: string;
  imageAlt2?: string;
  objectPosition?: string;
  objectPosition2?: string;
  objectFit?: string;
  objectFit2?: string;
  phoneLeft: boolean;
  isDark: boolean;
  mockupType?: 'phone' | 'macbook';
  caption1?: string;
  caption2?: string;
}) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const isInView = useMotionInView(sectionRef, { once: true, amount: 0.10 });

  // MacBook step: side-by-side layout
  if (mockupType === 'macbook') {
    return (
      <div
        ref={sectionRef}
        className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20 py-20 lg:py-28"
      >
        {/* MacBook mockup on the left */}
        <motion.div
          className="flex-[1.6] flex justify-center lg:justify-end group cursor-pointer"
          variants={stepMockupVariants}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
        >
          <div className="w-full transition-transform duration-300 ease-out group-hover:scale-[1.03] group-hover:-translate-y-1.5" style={{ maxWidth: 640 }}>
            <MacBookMockup src={imageSrc} alt={imageAlt} isDark={isDark} />
          </div>
        </motion.div>

        {/* Text content on the right with staggered children */}
        <motion.div
          className="flex-1 max-w-md"
          variants={stepContainerVariants}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
        >
          <motion.div variants={stepItemVariants} className="mb-6 inline-flex select-none">
            <StepBadge number={number} icon={icon} isDark={isDark} />
          </motion.div>
          <div className="relative">
            <span
              className={`absolute -top-8 -left-2 text-[120px] font-black leading-none select-none pointer-events-none step-number ${
                isDark ? "text-white/[0.09]" : "text-black/[0.07]"
              }`}
              style={{ fontFamily: "'Clash Display', sans-serif" }}
            >
              {number}
            </span>
            <motion.h3
              variants={stepItemVariants}
              className="relative text-3xl lg:text-4xl font-bold text-foreground mb-4 leading-tight"
              style={{ fontFamily: "'Clash Display', sans-serif" }}
            >
              {title}
            </motion.h3>
          </div>
          <motion.p variants={stepItemVariants} className="text-muted-foreground text-lg leading-relaxed mb-8">
            {description}
          </motion.p>
          <motion.div
            variants={stepAccentVariants}
            className={`w-12 h-1 rounded-full mb-6 ${isDark ? "bg-[oklch(0.65_0.14_145)]" : "bg-[#436850]"}`}
          />
          {cta && ctaHref && (
            <motion.a
              variants={stepItemVariants}
              href={ctaHref}
              className={`inline-flex items-center gap-2 text-sm font-semibold transition-colors duration-200 ${
                isDark ? "text-[oklch(0.65_0.14_145)] hover:text-[oklch(0.75_0.16_145)]" : "text-[#436850] hover:text-[#2A4A32]"
              }`}
            >
              {cta} <ArrowRight className="w-4 h-4" />
            </motion.a>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <div
      ref={sectionRef}
      className={`flex flex-col ${
        phoneLeft ? "lg:flex-row" : "lg:flex-row-reverse"
      } items-center gap-8 sm:gap-12 lg:gap-20 py-12 sm:py-16 lg:py-28 px-4 sm:px-0`}
    >
      {/* Phone mockup(s) */}
      <div
        className={`flex-1 flex w-full justify-center ${phoneLeft ? "lg:justify-start" : "lg:justify-end"}`}
      >
        <div className="flex flex-col items-center gap-8 sm:flex-row sm:items-end sm:gap-8">
          <motion.div
            className="group cursor-pointer flex flex-col items-center gap-3"
            variants={stepMockupVariants}
            initial="hidden"
            animate={isInView ? "visible" : "hidden"}
          >
            <div className="transition-transform duration-300 ease-out group-hover:scale-[1.04] group-hover:-translate-y-1">
              <IPhoneMockup src={imageSrc} alt={imageAlt} isDark={isDark} objectPosition={objectPosition} objectFit={(objectFit as string | undefined)} />
            </div>
            {caption1 && (
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold tracking-widest uppercase select-none border ${
                isDark
                  ? 'text-xs text-white bg-white/10 border-white/25'
                  : 'text-[10px] bg-[#436850]/15 text-[#2d4a35] border-[#436850]/50'
              }`}>
                {caption1}
              </span>
            )}
          </motion.div>
          {imageSrc2 && (
            <motion.div
              className="group cursor-pointer flex flex-col items-center gap-3"
              variants={stepMockup2Variants}
              initial="hidden"
              animate={isInView ? "visible" : "hidden"}
            >
              <div className="transition-transform duration-300 ease-out group-hover:scale-[1.04] group-hover:-translate-y-1">
                <IPhoneMockup src={imageSrc2} alt={imageAlt2 ?? ""} isDark={isDark} objectPosition={objectPosition2} objectFit={(objectFit2 ?? objectFit) as string | undefined} />
              </div>
              {caption2 && (
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold tracking-widest uppercase select-none border ${
                  isDark
                    ? 'text-xs text-white bg-white/10 border-white/25'
                    : 'text-[10px] bg-[#436850]/15 text-[#2d4a35] border-[#436850]/50'
                }`}>
                  {caption2}
                </span>
              )}
            </motion.div>
          )}
        </div>
      </div>

      {/* Text content with staggered children */}
      <motion.div
        className="flex-1 w-full max-w-md px-2 sm:px-0"
        variants={stepContainerVariants}
        initial="hidden"
        animate={isInView ? "visible" : "hidden"}
      >
        {/* Step badge */}
        <motion.div variants={stepItemVariants} className="mb-6 inline-flex select-none">
          <StepBadge number={number} icon={icon} isDark={isDark} />
        </motion.div>

        {/* Step number watermark + heading */}
        <div className="relative">
          <span
            className={`absolute -top-8 -left-2 text-[120px] font-black leading-none select-none pointer-events-none step-number ${
              isDark ? "text-white/[0.09]" : "text-black/[0.07]"
            }`}
            style={{ fontFamily: "'Clash Display', sans-serif" }}
          >
            {number}
          </span>
          <motion.h3
            variants={stepItemVariants}
            className="relative text-3xl lg:text-4xl font-bold text-foreground mb-4 leading-tight"
            style={{ fontFamily: "'Clash Display', sans-serif" }}
          >
            {title}
          </motion.h3>
        </div>

        <motion.p variants={stepItemVariants} className="text-muted-foreground text-lg leading-relaxed mb-8">
          {description}
        </motion.p>

        {/* Divider accent grows from left */}
        <motion.div
          variants={stepAccentVariants}
          className={`w-12 h-1 rounded-full mb-6 ${isDark ? "bg-[oklch(0.65_0.14_145)]" : "bg-[#436850]"}`}
        />
        {cta && ctaHref && (
          <motion.a
            variants={stepItemVariants}
            href={ctaHref}
            className={`inline-flex items-center gap-2 text-sm font-semibold transition-colors duration-200 ${
              isDark ? "text-[oklch(0.65_0.14_145)] hover:text-[oklch(0.75_0.16_145)]" : "text-[#436850] hover:text-[#2A4A32]"
            }`}
          >
            {cta} <ArrowRight className="w-4 h-4" />
          </motion.a>
        )}
      </motion.div>
    </div>
  );
}

interface LandingStep {
  number: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  cta: string;
  ctaHref: string;
  imageSrc: string;
  imageAlt: string;
  imageSrc2?: string;
  imageAlt2?: string;
  objectPosition?: string;
  objectPosition2?: string;
  objectFit?: string;
  objectFit2?: string;
  phoneLeft: boolean;
  mockupType?: "phone" | "macbook";
  caption1?: string;
  caption2?: string;
}

function HowItWorks() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const steps: LandingStep[] = [
    {
      number: "01",
      icon: <Trophy className="w-3 h-3" />,
      title: "Create Your Tournament, Share QR Code",
      description: "Set your format, rounds, and venue in under 3 minutes. Instantly get a shareable QR code. Players scan and register on the spot.",
      cta: "Host a Tournament",
      ctaHref: NAV_CTA_PRIMARY.path,
      imageSrc: "/manus-storage/qr-screen-720_e2bcd40f.webp",
      imageAlt: "Tournament QR Code screen",
      phoneLeft: true,
      mockupType: "macbook",
    },
    {
      number: "02",
      icon: <Users className="w-3 h-3" />,
      title: "Players Sign Up with chess.com ELO",
      description: "Share a link. Players enter their chess.com username, and we automatically pull their verified ELO rating in real time.",
      cta: "Try the Join Flow",
      ctaHref: "/join/OTB2026",
      imageSrc: "/manus-storage/otb-join-form_28254c54.webp",
      imageAlt: "Player join form with chess.com username lookup",
      imageSrc2: "/manus-storage/player-signup-confirm-600_8416caa0.webp",
      imageAlt2: "Player profile confirmation with chess.com ELO",
      phoneLeft: false,
    },
    {
      number: "03",
      icon: <Swords className="w-3 h-3" />,
      title: "Optimal Pairings Generated",
      description: "Our algorithm creates balanced, fair pairings based on ELO. No manual work. Standings update live as results come in.",
      cta: "View Live Demo",
      ctaHref: LIVE_TOURNAMENT_DEMO_PATH,
      imageSrc: "/manus-storage/exit-gallery-600_9c924914.webp",
      imageAlt: "Player board assignment screen showing opponent and board number",
      imageSrc2: "/manus-storage/Screenshot2026-06-25at2.25.15AM_1efe6544.png",
      imageAlt2: "Live board pairings screen with player matchups and result entry",
      phoneLeft: true,
      objectFit: "contain",
      objectPosition: "center",
      objectFit2: "contain",
      objectPosition2: "center",
      caption1: "Player View",
      caption2: "Host View",
    },
  ];

  return (
    <section id="how-it-works" className={`transition-colors duration-500 ${
      isDark ? "bg-background" : "bg-background"
    }`}>
      {/* Section header */}
      <div className="container pt-20 pb-4 text-center">
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-5 ${
          isDark ? "bg-[oklch(0.65_0.14_145)]/15 text-[oklch(0.65_0.14_145)]" : "bg-[#436850]/10 text-[#436850]"
        }`}>
          <Zap className="w-3 h-3" />
          How It Works
        </div>
        <h2
          className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground mb-4"
          style={{ fontFamily: "'Clash Display', sans-serif" }}
        >
          The easiest way to host a chess tournament
        </h2>
        <p className="text-muted-foreground text-lg max-w-xl mx-auto">
          No spreadsheets. No manual pairings. Just a QR code and a room full of chess players.
        </p>
      </div>

      {/* Parallax step blocks */}
      <div className="container">
        {steps.map((step) => (
          <ParallaxStep
            key={step.number}
            number={step.number}
            icon={step.icon}
            title={step.title}
            description={step.description}
            cta={step.cta}
            ctaHref={step.ctaHref}
            imageSrc={step.imageSrc}
            imageAlt={step.imageAlt}
            imageSrc2={step.imageSrc2}
            imageAlt2={step.imageAlt2}
            objectPosition={step.objectPosition}
            objectPosition2={step.objectPosition2}
            objectFit={step.objectFit}
            objectFit2={step.objectFit2}
            phoneLeft={step.phoneLeft}
            isDark={isDark}
            mockupType={step.mockupType}
            caption1={step.caption1}
            caption2={step.caption2}
          />
        ))}
      </div>
    </section>
  );
}

// ─── Capabilities Bento ───────────────────────────────────────────────────────
// Asymmetric bento grid covering 6 platform capability groups.
// Row 1: Tournament Operations (wide, 2/3) + Clubs & Community (narrow, 1/3)
// Row 2: League (1/3) + Matchup Prep (1/3) + Openings & Training (1/3)
// Row 3: Live Results & Shareable Content (full-width)

interface BentoCardProps {
  tag: string;
  title: string;
  description: string;
  cta: string;
  href: string;
  icon: React.ReactNode;
  screenshot?: string;
  screenshotAlt?: string;
  cardImage?: string; // inline image shown below description text
  isDark: boolean;
  inView: boolean;
  delay?: number;
  accent?: boolean; // highlights the primary card
  className?: string;
}

function BentoCard({
  tag, title, description, cta, href, icon, screenshot, screenshotAlt, cardImage,
  isDark, inView, delay = 0, accent = false, className = "",
}: BentoCardProps) {
  const prefersReducedMotion = typeof window !== "undefined"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;

  const surface = accent
    ? isDark
      ? "bg-[oklch(0.28_0.10_145)] border-[oklch(0.55_0.14_145)/0.35]"
      : "bg-[#436850] border-[#2A4A32]/20"
    : isDark
      ? "bg-[oklch(0.22_0.07_145)] border-white/[0.07]"
      : "bg-white border-[#ADBC9F]/50";

  const tagColor = accent
    ? isDark ? "text-[#7CF562] bg-[oklch(0.20_0.08_145)] border-[oklch(0.45_0.12_145)/0.5]" : "text-white bg-white/20 border-white/30"
    : isDark ? "text-[oklch(0.65_0.14_145)] bg-[oklch(0.18_0.06_145)] border-[oklch(0.38_0.10_145)/0.5]" : "text-[#436850] bg-[#EEF5EE] border-[#ADBC9F]/50";

  const titleColor = accent
    ? isDark ? "text-white" : "text-white"
    : isDark ? "text-[oklch(0.93_0.05_145)]" : "text-[#12372A]";

  const descColor = accent
    ? isDark ? "text-white/70" : "text-white/80"
    : isDark ? "text-[oklch(0.68_0.07_145)]" : "text-[#436850]";

  const ctaColor = accent
    ? isDark
      ? "bg-white/10 hover:bg-white/20 text-white border-white/20"
      : "bg-white/20 hover:bg-white/30 text-white border-white/30"
    : isDark
      ? "bg-[oklch(0.27_0.08_145)] hover:bg-[oklch(0.32_0.10_145)] text-[oklch(0.88_0.08_145)] border-[oklch(0.38_0.10_145)/0.5]"
      : "bg-[#EEF5EE] hover:bg-[#436850] hover:text-white text-[#12372A] border-[#ADBC9F]/50";

  return (
    <Link
      href={href}
      className={`group relative rounded-2xl border overflow-hidden cursor-pointer flex flex-col transition-all duration-500 ${surface} ${className} ${
        inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      }`}
      style={{ transitionDelay: `${delay}ms` }}
      aria-label={`${tag}: ${title}`}
    >

      {/* Hover lift respects reduced motion */}
      <div
        className={`absolute inset-0 pointer-events-none rounded-2xl transition-opacity duration-300 ${
          prefersReducedMotion ? "" : "group-hover:opacity-100 opacity-0"
        }`}
        style={{
          boxShadow: isDark
            ? "0 8px 32px oklch(0.12 0.05 145 / 0.6), 0 0 0 1px oklch(0.55 0.14 145 / 0.15)"
            : "0 8px 32px rgba(67,104,80,0.14), 0 0 0 1px rgba(67,104,80,0.12)",
        }}
      />

      {/* Screenshot shown when provided */}
      {screenshot && (
        <div className="relative overflow-hidden" style={{ aspectRatio: "16/9", flexShrink: 0 }}>
          <img
            decoding="async"
            src={screenshot}
            alt={screenshotAlt ?? title}
            className={`w-full h-full object-cover object-top transition-transform duration-700 ease-out ${
              prefersReducedMotion ? "" : "group-hover:scale-[1.04]"
            }`}
            loading="lazy"
          />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: isDark
                ? "linear-gradient(to bottom, transparent 60%, oklch(0.22 0.07 145 / 0.85) 100%)"
                : "linear-gradient(to bottom, transparent 60%, rgba(255,255,255,0.85) 100%)",
            }}
          />
        </div>
      )}

      {/* Content */}
      <div className="flex flex-col gap-3 p-5 sm:p-6 flex-1">
        {/* Tag + icon row */}
        <div className="flex items-center justify-between gap-2">
          <span
            className={`text-[10px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-full border ${tagColor}`}
          >
            {tag}
          </span>
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
              accent
                ? isDark ? "bg-white/10" : "bg-white/20"
                : isDark ? "bg-[oklch(0.30_0.09_145)/0.7]" : "bg-[#436850]/10"
            }`}
            style={{ color: accent ? (isDark ? "#7CF562" : "#fff") : isDark ? "#7CF562" : "#436850" }}
          >
            {icon}
          </div>
        </div>

        {/* Title */}
        <h2
          className={`text-lg sm:text-xl font-semibold leading-snug ${titleColor}`}
          style={{ fontFamily: "'Clash Display', sans-serif" }}
        >
          {title}
        </h2>

        {/* Description */}
        <p className={`text-xs sm:text-sm leading-relaxed ${cardImage ? "" : "flex-1"} ${descColor}`}>
          {description}
        </p>

        {/* Inline card image fills remaining space when provided */}
        {cardImage && (
          <div className="relative overflow-hidden rounded-xl mt-2 flex-1" style={{ minHeight: "180px" }}>
            <img
              decoding="async"
              src={cardImage}
              alt={`${title} feature preview`}
              className={`absolute inset-0 w-full h-full object-cover object-top transition-transform duration-700 ease-out ${
                prefersReducedMotion ? "" : "group-hover:scale-[1.03]"
              }`}
              loading="lazy"
            />
            {/* Bottom fade so it blends into the card */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: isDark
                  ? "linear-gradient(to bottom, transparent 60%, oklch(0.22 0.07 145 / 0.85) 100%)"
                  : "linear-gradient(to bottom, transparent 60%, rgba(255,255,255,0.90) 100%)",
              }}
            />
          </div>
        )}

        {/* CTA */}
        <div
          className={`mt-1 w-full rounded-xl py-2.5 text-sm font-semibold tracking-wide border text-center transition-all duration-200 ${ctaColor}`}
          style={{ minHeight: "44px", display: "flex", alignItems: "center", justifyContent: "center" }}
          aria-hidden="true"
        >
          {cta}
        </div>
      </div>
    </Link>
  );
}

function Features() {
  const { ref, inView } = useInView();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <section
      id="features"
      className={`py-12 sm:py-16 lg:py-24 transition-colors duration-500 ${isDark ? "bg-[oklch(0.20_0.06_145)]" : "bg-[#F5F8F5]"}`}
      ref={ref}
    >
      <div className="container">
        {/* Section header */}
        <div className={`text-center mb-8 sm:mb-12 lg:mb-16 transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
          <p className={`text-xs font-semibold tracking-widest uppercase mb-3 ${isDark ? "text-[oklch(0.65_0.14_145)]" : "text-[#436850]"}`}>
            Platform
          </p>
          <h2
            className="text-2xl sm:text-3xl lg:text-5xl font-semibold tracking-tight text-foreground"
            style={{ fontFamily: "'Clash Display', sans-serif" }}
          >
            Everything in one ecosystem.
          </h2>
          <p className={`mt-3 text-sm sm:text-base max-w-xl mx-auto ${isDark ? "text-white/55" : "text-[#436850]"}`}>
            Tournaments, clubs, leagues, and match prep. One platform built for OTB chess.
          </p>
        </div>

        {/* ── Bento grid ── */}
        {/* Row 1: Tournament Operations (wide) + Clubs & Community (narrow) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <BentoCard
            tag="Club League"
            title="Weekly Club League"
            description="Season-long matchups, live leaderboards, and a playoff bracket. Give your members a reason to show up every week. Crown a champion at the end of the season."
            cta="View Live Demo"
            href="/league-demo"
            icon={<Trophy className="w-4 h-4" />}
            screenshot="/manus-storage/league-bracket-720_695d699b.webp"
            screenshotAlt="ChessOTB Club League Playoff Bracket: Quarterfinals through Champion"
            isDark={isDark}
            inView={inView}
            delay={80}
            accent
            className="sm:col-span-2"
          />
          <BentoCard
            tag="Clubs & Community"
            title="Club Roster & Events"
            description="Manage your club roster, post events, run polls, and track every member's OTB ELO history in one place."
            cta="Explore Clubs"
            href="/clubs"
            icon={<Shield className="w-4 h-4" />}
            cardImage="/manus-storage/clubs-mobile-card_59196444.png"
            isDark={isDark}
            inView={inView}
            delay={160}
            className="sm:col-span-1"
          />
        </div>

        {/* Row 2: League + Matchup Prep + Openings */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <BentoCard
            tag="Tournament Director"
            title="Intuitive Host Dashboard"
            description="Run Swiss, Round Robin, or Elimination tournaments from one dashboard. Pairings, timers, results, and standings update in real time."
            cta="Host a Tournament"
            href={NAV_CTA_PRIMARY.path}
            icon={<BarChart3 className="w-4 h-4" />}
            isDark={isDark}
            inView={inView}
            delay={240}
          />
          <BentoCard
            tag="Matchup Preparation"
            title="Scout Your Next Opponent"
            description="AI-powered scouting report: openings, problem lines, and blunder patterns from their chess.com history before you sit down."
            cta="Try Scout Report"
            href="/prep"
            icon={<Brain className="w-4 h-4" />}
            isDark={isDark}
            inView={inView}
            delay={320}
          />
          <BentoCard
            tag="Openings & Training"
            title="Build Your OTB Repertoire"
            description="Study 18+ openings with interactive boards, coaching notes, and spaced-repetition drills for over-the-board club players."
            cta="Study Openings"
            href="/repertoire"
            icon={<BookOpen className="w-4 h-4" />}
            isDark={isDark}
            inView={inView}
            delay={400}
          />
        </div>

        {/* Row 3: Player Performance Reports full-width horizontal card */}
        <Link
          href="/tournaments"
          className={`group relative rounded-2xl border cursor-pointer grid grid-cols-1 sm:grid-cols-[1fr_48%] transition-all duration-500 ${
            inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          } ${
            isDark
              ? "bg-[oklch(0.22_0.07_145)] border-white/[0.07] hover:border-white/[0.13]"
              : "bg-white border-[#ADBC9F]/50 hover:border-[#436850]/30"
          }`}
          style={{ transitionDelay: "480ms" }}
          aria-label="Player Performance Reports: view tournament results"
        >
          {/* Left: text content */}
          <div className="flex flex-col justify-between gap-4 p-6 sm:p-8">
            <div className="flex flex-col gap-3">
              {/* Tag + icon row */}
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 text-[10px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-full border ${
                    isDark
                      ? "text-[oklch(0.65_0.14_145)] bg-[oklch(0.18_0.06_145)] border-[oklch(0.38_0.10_145)/0.5]"
                      : "text-[#436850] bg-[#EEF5EE] border-[#ADBC9F]/50"
                  }`}
                >
                  <BarChart3 className="w-3 h-3" />
                  Player Reports
                </span>
              </div>
              {/* Headline */}
              <h3
                className={`text-xl sm:text-2xl font-bold leading-tight ${
                  isDark ? "text-[oklch(0.95_0.05_145)]" : "text-[#12372A]"
                }`}
                style={{ fontFamily: "'Clash Display', sans-serif" }}
              >
                Post-Tournament Reports,
                <br />
                <span className={isDark ? "text-[oklch(0.72_0.18_145)]" : "text-[#436850]"}>
                  Auto-Generated & Shareable
                </span>
              </h3>
              {/* Feature bullets */}
              <ul className={`flex flex-col gap-1.5 text-sm ${
                isDark ? "text-[oklch(0.65_0.07_145)]" : "text-[#436850]"
              }`}>
                {[
                  "Score, ELO performance & rating change",
                  "Win streak, recent form & best win",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      isDark ? "bg-[oklch(0.72_0.18_145)]" : "bg-[#436850]"
                    }`} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            {/* CTA */}
            <span
              className={`w-full sm:w-auto self-start rounded-xl px-5 py-2.5 text-sm font-semibold tracking-wide border transition-all duration-200 active:scale-95 ${
                isDark
                  ? "bg-[oklch(0.27_0.08_145)] hover:bg-[oklch(0.32_0.10_145)] text-[oklch(0.88_0.08_145)] border-[oklch(0.38_0.10_145)/0.5]"
                  : "bg-[#EEF5EE] hover:bg-[#436850] hover:text-white text-[#12372A] border-[#ADBC9F]/50"
              }`}
              style={{ minHeight: "44px" }}
            >
              View Player Reports →
            </span>
          </div>

          {/* Right: player cards grid image in landscape that fills the column */}
          <div className={`relative overflow-hidden sm:border-l ${
            isDark ? "border-white/[0.06]" : "border-[#ADBC9F]/30"
          }`} style={{ minWidth: 0 }}>
            <img
              decoding="async"
              src="/manus-storage/player-cards-grid_60400ab2.png"
              alt="Player cards grid: Levy Rozman 1st and Magnus Carlsen 2nd, OTB!! Open 2026"
              className="block w-full h-full object-cover object-top"
              style={{ minHeight: "200px", maxHeight: "320px" }}
              loading="lazy"
            />
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: isDark
                  ? "linear-gradient(to right, oklch(0.22 0.07 145 / 0.55) 0%, transparent 35%)"
                  : "linear-gradient(to right, rgba(255,255,255,0.55) 0%, transparent 35%)",
              }}
            />
          </div>
        </Link>
      </div>
    </section>
  );
}
// ─── Player Card Demo ─────────────────────────────────────────────────────────
function PlayerDemo() {
  const { ref, inView } = useInView();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [username, setUsername] = useState("");
  const { status, profile, error: lookupError, lookup, reset: _reset, analysisLoading } = useChessComProfile();
  const loading = status === "loading";

  const handleLookup = () => {
    if (!username.trim()) return;
    lookup(username.trim());
  };

  return (
    <section
      id="player-demo"
      className={`py-12 sm:py-16 lg:py-24 transition-colors duration-500 relative overflow-hidden ${isDark ? "bg-[oklch(0.23_0.07_145)]" : "bg-[#FBFADA]"}`}
      ref={ref}
    >
      {/* YouTube video background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
        <iframe
          src="https://www.youtube.com/embed/KEi0wr1vRG8?autoplay=1&mute=1&loop=1&playlist=KEi0wr1vRG8&controls=0&showinfo=0&rel=0&modestbranding=1&playsinline=1&enablejsapi=0"
          allow="autoplay; encrypted-media"
          allowFullScreen={false}
          title=""
          aria-hidden="true"
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            width: "177.78vh",
            minWidth: "100%",
            height: "56.25vw",
            minHeight: "100%",
            transform: "translate(-50%, -50%)",
            border: "none",
            opacity: 0.35,
            pointerEvents: "none",
          }}
        />
        {/* Dark overlay to ensure text readability */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: isDark
              ? "oklch(0.23 0.07 145 / 0.58)"
              : "oklch(0.93 0.04 145 / 0.65)",
          }}
        />
      </div>
      <div className="container relative z-10">
        <div className="max-w-2xl mx-auto text-center mb-12">
          <p className={`text-xs font-semibold tracking-widest uppercase mb-3 ${isDark ? "text-[oklch(0.65_0.14_145)]" : "text-[#436850]"}`}>
            chess.com Integration
          </p>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight mb-4 text-foreground" style={{ fontFamily: "'Clash Display', sans-serif" }}>
            Play Online,
            <br className="hidden sm:block" />
            <span className="sm:hidden"> </span>
            Improve OTB.
          </h2>
          <p className="text-muted-foreground">
            Enter your chess.com username to see your OTB Profile. Try{" "}
            <code className={`px-1.5 py-0.5 rounded text-xs border ${isDark ? "bg-[oklch(0.28_0.08_145)] text-[oklch(0.65_0.14_145)] border-white/10" : "bg-white text-[#436850] border-[#EEEED2]"}`}>hikaru</code>{" "}
            or{" "}
            <code className={`px-1.5 py-0.5 rounded text-xs border ${isDark ? "bg-[oklch(0.28_0.08_145)] text-[oklch(0.65_0.14_145)] border-white/10" : "bg-white text-[#436850] border-[#EEEED2]"}`}>gothamchess</code>.
          </p>
        </div>

        <div
          className={`max-w-md mx-auto transition-all duration-500 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
        >
          <div className="card-chess p-6">
            <div className="flex gap-3 mb-6">
              <input
                type="text"
                aria-label="Chess.com username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLookup()}
                placeholder="chess.com username..."
                className={`flex-1 px-4 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#436850]/30 focus:border-[#436850] transition-all ${
                  isDark
                    ? "bg-[oklch(0.22_0.06_145)] border-white/10 text-white placeholder:text-white/30"
                    : "bg-[#FBFADA]/50 border-[#EEEED2] text-[#12372A]"
                }`}
              />
              <button
                onClick={handleLookup}
                disabled={loading || !username.trim()}
                className="btn-chess-primary text-sm px-5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "..." : "Look Up"}
              </button>
            </div>

            {/* Error state */}
            {(status === "not_found" || status === "error") && (
              <div className={`rounded-xl p-3 text-sm text-center ${isDark ? "bg-red-900/20 text-red-300 border border-red-800/30" : "bg-red-50 text-red-600 border border-red-200"}`}>
                {lookupError || "Username not found on chess.com."}
              </div>
            )}

            {/* Profile card with premium redesign */}
            {profile && status === "success" && (
              <div
                className="animate-fade-in-up overflow-hidden rounded-2xl"
                style={{
                  background: isDark
                    ? "linear-gradient(160deg, oklch(0.24 0.07 145) 0%, oklch(0.20 0.06 145) 100%)"
                    : "linear-gradient(160deg, #ffffff 0%, #f4f8f2 100%)",
                  border: isDark ? "1px solid oklch(0.35 0.08 145 / 0.5)" : "1px solid #d4e4cc",
                  boxShadow: isDark
                    ? "0 0 0 1px oklch(0.65 0.14 145 / 0.08), 0 20px 40px oklch(0.12 0.05 145 / 0.6)"
                    : "0 4px 24px rgba(61,107,71,0.10), 0 1px 4px rgba(61,107,71,0.06)",
                }}
              >
                {/* ── Hero header ─────────────────────────────── */}
                <div
                  className="px-5 pt-5 pb-4"
                  style={{
                    background: isDark
                      ? "linear-gradient(135deg, oklch(0.65 0.14 145 / 0.10) 0%, transparent 60%)"
                      : "linear-gradient(135deg, rgba(61,107,71,0.06) 0%, transparent 60%)",
                    borderBottom: isDark ? "1px solid oklch(0.35 0.08 145 / 0.4)" : "1px solid #e2eddb",
                  }}
                >
                  <div className="flex items-center justify-between">
                    {/* Avatar + identity */}
                    <div className="flex items-center gap-3.5">
                      <div className="relative">
                        {profile.avatar ? (
                          <img loading="lazy" decoding="async" src={`/api/avatar-proxy?url=${encodeURIComponent(profile.avatar)}`} alt={profile.username} className="w-12 h-12 rounded-xl object-cover" crossOrigin="anonymous" style={{ boxShadow: isDark ? "0 0 0 2px oklch(0.65 0.14 145 / 0.3)" : "0 0 0 2px rgba(61,107,71,0.2)" }} />
                        ) : (
                          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-base" style={{ background: "oklch(0.45 0.14 145)", boxShadow: "0 0 0 2px oklch(0.65 0.14 145 / 0.3)" }}>
                            {profile.username[0].toUpperCase()}
                          </div>
                        )}
                        {/* Live indicator */}
                        <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center" style={{ background: isDark ? "oklch(0.22 0.06 145)" : "#fff" }}>
                          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-bold text-foreground" style={{ fontFamily: "'Clash Display', sans-serif", fontSize: "0.95rem" }}>
                            {profile.name || profile.username}
                          </span>
                          {profile.title && (
                            <span
                              className="text-[10px] font-black px-1.5 py-0.5 rounded-md tracking-wide"
                              style={{ background: isDark ? "oklch(0.65 0.14 145 / 0.18)" : "rgba(61,107,71,0.12)", color: isDark ? "oklch(0.75 0.14 145)" : "#436850" }}
                            >
                              {profile.title}
                            </span>
                          )}
                          {profile.countryFlag && <span className="text-sm leading-none">{profile.countryFlag}</span>}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                          <span className="text-[11px]" style={{ color: isDark ? "oklch(0.55 0.08 145)" : "#6b8f6b" }}>chess.com · Live data</span>
                        </div>
                      </div>
                    </div>
                    {/* Primary ELO */}
                    <div className="text-right">
                      <div
                        className="text-3xl font-black leading-none"
                        style={{ fontFamily: "'JetBrains Mono', monospace", color: isDark ? "oklch(0.72 0.16 145)" : "#2d5a35" }}
                      >
                        {profile.rapid || profile.blitz || profile.bullet || "Not available"}
                      </div>
                      <div className="text-[10px] font-semibold uppercase tracking-widest mt-1" style={{ color: isDark ? "oklch(0.50 0.08 145)" : "#7a9e7a" }}>
                        {profile.rapid || profile.blitz || profile.bullet ? "Rapid ELO" : "No rating available"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Rating pills row ────────────────────────── */}
                {(profile.blitz > 0 || profile.bullet > 0) && (
                  <div className="flex gap-px" style={{ borderBottom: isDark ? "1px solid oklch(0.30 0.07 145 / 0.5)" : "1px solid #e2eddb" }}>
                    {[
                      { label: "Rapid", val: profile.rapid },
                      { label: "Blitz", val: profile.blitz },
                      { label: "Bullet", val: profile.bullet },
                    ]
                      .filter((r) => r.val > 0)
                      .map((r, i, arr) => (
                        <div
                          key={r.label}
                          className="flex-1 py-3 text-center"
                          style={{
                            borderRight: i < arr.length - 1 ? (isDark ? "1px solid oklch(0.30 0.07 145 / 0.5)" : "1px solid #e2eddb") : "none",
                            background: isDark ? "oklch(0.21 0.06 145 / 0.5)" : "rgba(61,107,71,0.03)",
                          }}
                        >
                          <div className="text-sm font-bold" style={{ color: isDark ? "oklch(0.88 0.06 145)" : "#1a2e1a", fontFamily: "'JetBrains Mono', monospace" }}>{r.val}</div>
                          <div className="text-[10px] font-semibold uppercase tracking-wider mt-0.5" style={{ color: isDark ? "oklch(0.50 0.08 145)" : "#7a9e7a" }}>{r.label}</div>
                        </div>
                      ))}
                  </div>
                )}

                {/* ── Game Analysis ───────────────────────────── */}
                <div className="px-5 py-4 space-y-4">
                  {analysisLoading && (
                    <div className="flex items-center justify-center gap-2 py-4">
                      <div className="w-4 h-4 rounded-full border-2 animate-spin" style={{ borderColor: isDark ? "oklch(0.65 0.14 145 / 0.3)" : "#436850", borderTopColor: isDark ? "oklch(0.65 0.14 145)" : "#436850" }} />
                      <span className="text-xs" style={{ color: isDark ? "oklch(0.50 0.08 145)" : "#7a9e7a" }}>Analysing last 50 games…</span>
                    </div>
                  )}

                  {profile.analysis && !analysisLoading && (
                    <>
                      {/* W/D/L Mini-Bar */}
                      {(profile.analysis.wins + profile.analysis.draws + profile.analysis.losses) > 0 && (() => {
                        const total = profile.analysis.wins + profile.analysis.draws + profile.analysis.losses;
                        const wPct = Math.round((profile.analysis.wins / total) * 100);
                        const dPct = Math.round((profile.analysis.draws / total) * 100);
                        const lPct = 100 - wPct - dPct;
                        return (
                          <div
                            className="rounded-xl px-4 py-3 space-y-2.5"
                            style={{
                              background: isDark ? "oklch(0.18 0.05 145 / 0.6)" : "rgba(61,107,71,0.05)",
                              border: isDark ? "1px solid oklch(0.32 0.07 145 / 0.4)" : "1px solid rgba(61,107,71,0.12)",
                            }}
                          >
                            {/* Label row */}
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: isDark ? "oklch(0.50 0.08 145)" : "#7a9e7a" }}>Form: Last {total} Games</span>
                              <div className="flex items-center gap-3">
                                <span className="text-[11px] font-bold" style={{ fontFamily: "'JetBrains Mono', monospace", color: isDark ? "oklch(0.72 0.18 145)" : "#2e7d32" }}>
                                  {profile.analysis.wins}W
                                </span>
                                <span className="text-[11px] font-bold" style={{ fontFamily: "'JetBrains Mono', monospace", color: isDark ? "oklch(0.70 0.04 240)" : "#888" }}>
                                  {profile.analysis.draws}D
                                </span>
                                <span className="text-[11px] font-bold" style={{ fontFamily: "'JetBrains Mono', monospace", color: isDark ? "oklch(0.65 0.18 20)" : "#c62828" }}>
                                  {profile.analysis.losses}L
                                </span>
                              </div>
                            </div>
                            {/* Segmented bar */}
                            <div className="flex h-2.5 rounded-full overflow-hidden gap-px">
                              {wPct > 0 && (
                                <div
                                  className="h-full transition-all duration-700 rounded-l-full"
                                  style={{
                                    width: `${wPct}%`,
                                    background: isDark
                                      ? "linear-gradient(90deg, oklch(0.50 0.18 145), oklch(0.68 0.20 145))"
                                      : "linear-gradient(90deg, #2e7d32, #43a047)",
                                    borderRadius: dPct === 0 && lPct === 0 ? "9999px" : "9999px 0 0 9999px",
                                  }}
                                />
                              )}
                              {dPct > 0 && (
                                <div
                                  className="h-full transition-all duration-700"
                                  style={{
                                    width: `${dPct}%`,
                                    background: isDark ? "oklch(0.40 0.04 240)" : "#bdbdbd",
                                    borderRadius: wPct === 0 && lPct === 0 ? "9999px" : wPct === 0 ? "9999px 0 0 9999px" : lPct === 0 ? "0 9999px 9999px 0" : "0",
                                  }}
                                />
                              )}
                              {lPct > 0 && (
                                <div
                                  className="h-full transition-all duration-700 rounded-r-full"
                                  style={{
                                    width: `${lPct}%`,
                                    background: isDark
                                      ? "linear-gradient(90deg, oklch(0.45 0.18 20), oklch(0.58 0.20 20))"
                                      : "linear-gradient(90deg, #c62828, #e53935)",
                                    borderRadius: wPct === 0 && dPct === 0 ? "9999px" : "0 9999px 9999px 0",
                                  }}
                                />
                              )}
                            </div>
                            {/* Win % label */}
                            <p className="text-[10px]" style={{ color: isDark ? "oklch(0.45 0.06 145)" : "#9ab89a" }}>
                              {wPct}% win rate
                            </p>
                          </div>
                        );
                      })()}

                      {/* Openings as White */}
                      {profile.analysis.openingsWhite.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-2.5">
                            <div className="w-3 h-3 rounded-sm border-2" style={{ background: "#f5f5f0", borderColor: isDark ? "oklch(0.40 0.06 145)" : "#c0c0b0" }} />
                            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: isDark ? "oklch(0.50 0.08 145)" : "#7a9e7a" }}>Openings as White</span>
                          </div>
                          <div className="space-y-2">
                            {profile.analysis.openingsWhite.map((o) => (
                              <div key={o.name}>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs truncate pr-3 flex-1" style={{ color: isDark ? "oklch(0.80 0.05 145)" : "#2a3a2a" }}>{o.name}</span>
                                  <span className="text-[11px] font-bold flex-shrink-0" style={{ fontFamily: "'JetBrains Mono', monospace", color: isDark ? "oklch(0.72 0.16 145)" : "#436850" }}>{o.pct}%</span>
                                </div>
                                <div className="h-1 rounded-full overflow-hidden" style={{ background: isDark ? "oklch(0.28 0.07 145 / 0.6)" : "rgba(61,107,71,0.10)" }}>
                                  <div
                                    className="h-full rounded-full transition-all duration-700"
                                    style={{ width: `${o.pct}%`, background: isDark ? "linear-gradient(90deg, oklch(0.55 0.14 145), oklch(0.72 0.16 145))" : "linear-gradient(90deg, #436850, #5a9e6a)" }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Openings as Black */}
                      {profile.analysis.openingsBlack.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-2.5">
                            <div className="w-3 h-3 rounded-sm" style={{ background: isDark ? "oklch(0.25 0.05 145)" : "#2a2a2a", border: "2px solid transparent", outline: isDark ? "1px solid oklch(0.40 0.06 145)" : "1px solid #888" }} />
                            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: isDark ? "oklch(0.50 0.08 145)" : "#7a9e7a" }}>Openings as Black</span>
                          </div>
                          <div className="space-y-2">
                            {profile.analysis.openingsBlack.map((o) => (
                              <div key={o.name}>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs truncate pr-3 flex-1" style={{ color: isDark ? "oklch(0.80 0.05 145)" : "#2a3a2a" }}>{o.name}</span>
                                  <span className="text-[11px] font-bold flex-shrink-0" style={{ fontFamily: "'JetBrains Mono', monospace", color: isDark ? "oklch(0.72 0.16 145)" : "#436850" }}>{o.pct}%</span>
                                </div>
                                <div className="h-1 rounded-full overflow-hidden" style={{ background: isDark ? "oklch(0.28 0.07 145 / 0.6)" : "rgba(61,107,71,0.10)" }}>
                                  <div
                                    className="h-full rounded-full transition-all duration-700"
                                    style={{ width: `${o.pct}%`, background: isDark ? "linear-gradient(90deg, oklch(0.45 0.10 145), oklch(0.62 0.14 145))" : "linear-gradient(90deg, #2d5a35, #4a8a5a)" }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Endgame win % */}
                      {profile.analysis.endgameWinPct !== null && (
                        <div
                          className="flex items-center justify-between rounded-xl px-4 py-3"
                          style={{
                            background: isDark ? "oklch(0.65 0.14 145 / 0.08)" : "rgba(61,107,71,0.06)",
                            border: isDark ? "1px solid oklch(0.65 0.14 145 / 0.15)" : "1px solid rgba(61,107,71,0.15)",
                          }}
                        >
                          <div>
                            <div className="text-xs font-semibold" style={{ color: isDark ? "oklch(0.80 0.05 145)" : "#2a3a2a" }}>Endgame Win Rate</div>
                            <div className="text-[10px] mt-0.5" style={{ color: isDark ? "oklch(0.50 0.08 145)" : "#7a9e7a" }}>{profile.analysis.endgameGames} games &gt; 30 moves</div>
                          </div>
                          <div
                            className="text-2xl font-black"
                            style={{ fontFamily: "'JetBrains Mono', monospace", color: isDark ? "oklch(0.72 0.16 145)" : "#436850" }}
                          >
                            {profile.analysis.endgameWinPct}%
                          </div>
                        </div>
                      )}

                      <p className="text-[10px] text-center" style={{ color: isDark ? "oklch(0.40 0.06 145)" : "#a0b8a0" }}>
                        Based on last {profile.analysis.gamesAnalyzed} games
                      </p>
                    </>
                  )}
                </div>

                {/* ── CTA footer ──────────────────────────────── */}
                <div
                  className="px-5 pb-5"
                  style={{ borderTop: isDark ? "1px solid oklch(0.30 0.07 145 / 0.5)" : "1px solid #e2eddb" }}
                >
                  <button
                    onClick={() => toast.success(`${profile.username} added to tournament!`)}
                    className="w-full btn-chess-primary text-sm py-3 mt-4 rounded-xl font-semibold tracking-wide"
                    style={{ letterSpacing: "0.03em" }}
                  >
                    Add to Tournament
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── CTA Section ─────────────────────────────────────────────────────────────
function CTASection({ onCreateTournament }: { onCreateTournament: () => void }) {
  const { ref, inView } = useInView();

  return (
    <section className="py-16 sm:py-20 lg:py-28 bg-[#436850] relative overflow-hidden" ref={ref}>
      {/* Dark overlay for text legibility */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at 50% 50%, oklch(0.22 0.10 145 / 0.70) 0%, oklch(0.28 0.12 145 / 0.90) 100%)",
        }}
      />
      <div className="absolute inset-0 chess-board-bg opacity-[0.12] pointer-events-none" />

      <div className="container relative z-10">
        <div
          className={`max-w-2xl mx-auto text-center ${inView ? "animate-fade-up-soft" : "opacity-0"}`}
          style={{ animationFillMode: "forwards" }}
        >
          <h2
            className="text-2xl sm:text-3xl lg:text-5xl font-semibold text-white tracking-tight mb-4 sm:mb-5"
            style={{ fontFamily: "'Clash Display', sans-serif" }}
          >
            Growing your chess club
            <br className="hidden sm:block" />
            <span className="sm:hidden"> </span>
            starts here.
          </h2>
          <p className="text-white/90 text-base sm:text-lg lg:text-xl mb-8 sm:mb-10">
            Free for chess club owners who sign up. No credit card required.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={onCreateTournament}
              className="bg-white text-[#436850] font-semibold text-base px-8 py-3.5 rounded-lg hover:bg-[#EEEED2] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
            >
              Create Free Tournament
            </button>
            <SpinBorderButton
              variant="glass"
              onClick={() => window.location.href = LIVE_TOURNAMENT_DEMO_PATH}
              data-testid="final-live-tournament-demo"
            >
              View Live Demo
              <ArrowRight className="w-4 h-4" />
            </SpinBorderButton>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function Footer() {
  const links: Record<string, { label: string; href: string }[]> = {
    Platform: FOOTER_NAV_ITEMS
      .filter((item) => item.key !== "blog")
      .map((item) => ({ label: item.label, href: item.path })),
    Community: [
      { label: NAV_CTA_PRIMARY.label, href: NAV_CTA_PRIMARY.path },
      { label: "Join a Tournament", href: NAV_CTA_SECONDARY.path },
      { label: "Discord", href: "https://discord.gg/chessotb" },
      { label: "X / Twitter", href: "https://x.com/chessotbclub" },
    ],
    Company: [
      { label: "About", href: "/#how-it-works" },
      { label: "Blog", href: FOOTER_NAV_ITEMS.find((item) => item.key === "blog")?.path ?? "/blog" },
      { label: "Contact", href: "mailto:info@chessotb.club" },
      { label: "Terms", href: "/terms" },
    ],
  };

  return (
    <footer className="bg-[#12372A] text-white py-10 sm:py-12 lg:py-16 relative overflow-hidden" style={{ paddingBottom: "max(5rem, calc(5rem + env(safe-area-inset-bottom, 0px)))" }}>
      {/* Animated ASCII trophy backdrop */}
      <AsciiArt
        className="absolute inset-0 w-full h-full"
        style={{ objectFit: "contain", objectPosition: "center center", opacity: 0.38 }}
      />
      {/* Dark overlay is lighter in center to reveal trophy and darker at edges to keep text legible */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 70% 90% at 50% 50%, oklch(0.12 0.05 145 / 0.68) 0%, oklch(0.10 0.04 145 / 0.90) 100%)" }}
      />
      <div className="container relative z-10">
        <div className="grid md:grid-cols-4 gap-10 mb-12">
          <div>
            <div className="flex items-center gap-1 mb-4">
              <img
                loading="lazy"
                decoding="async"
                src="/manus-storage/chessotb-wordmark-320_e1731168.webp"
                alt="OTB Chess"
                className="h-9 w-auto object-contain drop-shadow-[0_0_6px_rgba(100,200,100,0.2)]"
              />
            </div>
            <p className="text-base text-white/70 leading-relaxed">
              PLAY MORE CHESS OTB!!
            </p>
          </div>

          {Object.entries(links).map(([category, items]) => (
            <div key={category}>
              <p className="text-sm font-semibold tracking-widest uppercase text-white/60 mb-4">{category}</p>
              <ul className="space-y-2.5">
                {items.map((item) => (
                  <li key={item.label}>
                    <a
                      href={item.href}
                      className="text-base text-white/75 hover:text-white transition-colors"
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-white/65">© 2026 OTB Chess. All rights reserved.</p>
          <p className="text-sm text-white/65">Powered by chess.com API · Not affiliated with chess.com</p>
        </div>
      </div>
    </footer>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Home() {
  const [wizardOpen, setWizardOpen] = useState(() =>
    typeof window !== "undefined" && window.sessionStorage.getItem(TOURNAMENT_WIZARD_ACTIVE_KEY) === "1"
  );
  const [authOpen, setAuthOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { user, logout } = useAuthContext();
  // League smart routing: fetch user's leagues to pick the best destination
  interface MyLeague { id: string; name: string; status: string; }
  const [myLeagues, setMyLeagues] = useState<MyLeague[]>([]);
  const isGuest = !user || user.isGuest;
  useEffect(() => {
    if (isGuest) { setMyLeagues([]); return; }
    fetch("/api/leagues/mine", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: MyLeague[]) => setMyLeagues(Array.isArray(data) ? data : []))
      .catch(() => setMyLeagues([]));
  }, [isGuest]);
  const leagueNavUrl = (() => {
    if (!myLeagues.length) return "/league-demo";
    const active = myLeagues.find((l) => l.status === "active");
    const target = active ?? myLeagues[0];
    return `/league/${target.id}`;
  })();
  // Active tab state synced with AnimeNavBar via IntersectionObserver.
  const [activeNavTab, setActiveNavTab] = useState("Tournaments");
  const openTournamentWizard = useCallback(() => {
    try { window.sessionStorage.setItem(TOURNAMENT_WIZARD_ACTIVE_KEY, "1"); } catch { /* storage may be unavailable */ }
    setWizardOpen(true);
  }, []);
  const closeTournamentWizard = useCallback(() => {
    try { window.sessionStorage.removeItem(TOURNAMENT_WIZARD_ACTIVE_KEY); } catch { /* storage may be unavailable */ }
    setWizardOpen(false);
  }, []);

  // SEO
  usePageMeta({
    title: "ChessOTB | Host Chess Tournaments Over the Board",
    description: "Host and manage over-the-board chess tournaments with Swiss pairings, live standings, and QR check-in. Free for chess clubs.",
    path: "/",
  });

  // Handle PWA shortcut: /?action=create opens the wizard immediately
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("action") === "create") {
      openTournamentWizard();
      // Remove only the internal action flag while preserving source/campaign params.
      window.history.replaceState({}, "", stripCreateAction(window.location.search, window.location.hash));
    }
  }, [openTournamentWizard]);

  // ── Dashboard smart routing ──────────────────────────────────────────────────────────────────────────────────────────
  // Priority: 1. Active (non-completed) directed tournament → /tournament/:id/manage
  //           2. Active (non-completed) joined tournament   → /tournament/:id
  //           3. Not signed in or no live tournament        → /join
  //
  // "Active" means status is registration, in_progress, or paused (NOT completed).
  // Users can only be in one tournament at a time.
  const getDashboardUrl = (): string => {
    const allTournaments = listTournaments();

    // Helper: read tournament status from director state in localStorage
    const getTournamentStatus = (id: string): string => {
      try {
        const raw = localStorage.getItem(`otb-director-state-v2-${id}`);
        if (raw) {
          const parsed = JSON.parse(raw) as { status?: string };
          return parsed.status ?? "unknown";
        }
      } catch { /* ignore */ }
      return "unknown";
    };

    // Priority 1: Active directed tournament (director has a session AND it’s not completed)
    const directedTournament = allTournaments.find((t) => {
      if (!hasDirectorSession(t.id)) return false;
      const status = getTournamentStatus(t.id);
      return status !== "completed"; // registration, in_progress, paused, unknown all qualify
    });
    if (directedTournament) return `/tournament/${directedTournament.id}/manage`;

    // Priority 2: Active participant registration (not completed)
    const registrations = getAllRegistrations();
    for (const reg of registrations) {
      const config = resolveTournament(reg.tournamentId);
      const tournamentId = config?.id ?? reg.tournamentId;
      const status = getTournamentStatus(tournamentId);
      if (status !== "completed") {
        return `/tournament/${tournamentId}`;
      }
    }

  // No live tournament, so send to join page.
    return "/join";
  };

  // AnimeNavBar items; Home removed and logo navigates to landing page.
  const navItems = [
    { name: "Clubs",       url: "/clubs",         icon: Building2,      sectionId: "for-clubs" },
    { name: "Tournaments", url: getDashboardUrl(), icon: LayoutDashboard, dropdown: <DashboardDropdown />, onClick: (e: React.MouseEvent) => { e.preventDefault(); window.location.href = getDashboardUrl(); } },
    { name: "League",      url: leagueNavUrl,    icon: Trophy,         tooltip: myLeagues.length ? (myLeagues.find((l) => l.status === "active")?.name ?? myLeagues[0]?.name) : "View League Demo", onClick: (e: React.MouseEvent) => { e.preventDefault(); window.location.href = leagueNavUrl; } },
    { name: "Tools",    url: "/training",     icon: GraduationCap },
  ];

  const logoEl = (
    <Link href="/" className="flex items-center">
      <img
        src="/manus-storage/chessotb-wordmark-320_e1731168.webp"
        alt="OTB Chess"
        className={`h-8 w-auto object-contain transition-opacity hover:opacity-80 ${isDark ? "nav-logo-dark" : ""}`}
      />
    </Link>
  );

  const isGuestUser = !user || user.isGuest;

  const rightSlotEl = (
    <div className="flex items-center gap-2">
      <ThemeToggle />
      {/* Mobile: hamburger drawer for ALL users (hides the wide avatar pill that causes overflow) */}
      <div className="flex md:hidden">
        <MobileNavDrawer
          currentPage={activeNavTab}
          onSignInClick={() => setAuthOpen(true)}
          onSignOutClick={!isGuestUser ? logout : undefined}
          isGuest={isGuestUser}
          user={user}
        />
      </div>
      {/* Desktop: full avatar dropdown (hidden on mobile to avoid overflow) */}
      <div className="hidden md:flex">
        <AvatarNavDropdown
          currentPage={activeNavTab}
          onSignInClick={() => setAuthOpen(true)}
          dashboardUrl={getDashboardUrl()}
          leagueUrl={leagueNavUrl}
        />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      {!wizardOpen && (
        <AnimeNavBar
          items={navItems}
          defaultActive={activeNavTab}
          logo={logoEl}
          rightSlot={rightSlotEl}
          onActiveChange={setActiveNavTab}
          isDark={isDark}
        />
      )}
      <Hero onCreateTournament={openTournamentWizard} />
      <StatsBar />
      <HowItWorks />
      <Features />
      <PlayerDemo />
      <CTASection onCreateTournament={openTournamentWizard} />
      <Footer />
      <TournamentWizard open={wizardOpen} onClose={closeTournamentWizard} />
      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} isDark={isDark} />
      <ProUpgradeModal isOpen={upgradeOpen} onClose={() => setUpgradeOpen(false)} />


    </div>
  );
}
