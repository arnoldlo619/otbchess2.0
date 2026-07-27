/*
 * OTB Chess — Landing Page
 * Design: "The Board Room" — Apple Minimalism + Chess.com Green
 * Dark Mode: Deep Forest Green CTA Aesthetic — green checkered bg, white text
 *
 * Sections:
 * 1. Navigation (with light/dark toggle)
 * 2. Hero
 * 3. Stats Bar
 * 4. How It Works
 * 5. Features
 * 6. Showcase
 * 7. Player ELO Demo
 * 8. Testimonials
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
import { TournamentWizard } from "@/components/TournamentWizard";
import { getAllRegistrations } from "@/lib/registrationStore";
import { resolveTournament, listTournaments, hasDirectorSession } from "@/lib/tournamentRegistry";
import { DashboardDropdown } from "@/components/DashboardDropdown";

import AuthModal from "../components/AuthModal";
import { ProUpgradeModal } from "../components/ProUpgradeModal";
import { useAuthContext } from "../context/AuthContext";
import {
  Trophy,
  Users,
  Zap,
  ChevronRight,
  Menu,
  X,
  Crown,
  Swords,
  BarChart3,
  Clock as _Clock,
  CheckCircle2 as _CheckCircle2,
  ArrowRight,
  Star,
  Shield,
  Globe,
  Home as _HomeIcon,
  Building2,
  Video as _Video,
  LogIn as _LogIn,
  LogOut as _LogOut,
  ChevronDown as _ChevronDown,
  Ghost,
  LayoutDashboard,
  BookOpen,
  Search,
  TrendingUp,
  Brain,
  Link2,
  GraduationCap,
} from "lucide-react";
import { AnimeNavBar } from "@/components/ui/anime-navbar";
import { DESKTOP_NAV_ITEMS, MOBILE_NAV_ITEMS, NAV_CTA_PRIMARY, isNavItemActive } from "@/lib/navRegistry";
import {AvatarNavDropdown} from "@/components/AvatarNavDropdown";
import { MobileNavDrawer } from "@/components/MobileNavDrawer";
import { HoverBorderGradient } from "@/components/ui/hover-border-gradient";
import { AnnouncementBanner } from "@/components/ui/announcement-banner";
import { SpinBorderButton } from "@/components/ui/spin-border-button";
import { DynamicSquare } from "@/components/ui/dynamic-square";
import { HeroDashboardMockup } from "@/components/ui/HeroDashboardMockup";
import { AsciiArt } from "@/components/ui/d60-hero";

// ─── CDN Assets ─────────────────────────────────────────────────────────────
// (mascot illustrations removed — sections use clean text-only layouts)

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
    // Respect prefers-reduced-motion — jump straight to target
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
        {/* Logo — navigates to landing page */}
        <Link href="/" className="flex items-center gap-1 group cursor-pointer">
          <img
            src="https://files.manuscdn.com/user_upload_by_module/session_file/117675823/bWANpVvGVfpfXSpZ.png"
            alt="OTB Chess — Home"
            className={`nav-logo h-8 w-auto object-contain transition-opacity hover:opacity-80 active:opacity-60 ${isDark ? "nav-logo-dark" : ""}`}
          />
        </Link>

        {/* Desktop Links — canonical order from NAV_REGISTRY */}
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
          {/* Host Tournament CTA — top of mobile menu */}
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
    <section className={`relative overflow-hidden pt-20 sm:pt-24 md:pt-16 pb-[18vh] sm:pb-0 md:pb-10 transition-colors duration-500 ${isDark ? "bg-[oklch(0.20_0.06_145)]" : "bg-[#F5F8F5]"}`}>
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
        {/* On mobile: use flex column to distribute space so View Live Demo sits at bottom of viewport */}
        <div className="hero-mobile-content max-w-3xl mx-auto text-center flex flex-col justify-center gap-8 sm:block pt-4 sm:pt-16 lg:pt-24 pb-4 sm:pb-0">
          {/* ── Top group: announcement + heading + subtitle ── */}
          <div className="flex flex-col items-center">
            <div className="opacity-0-init animate-fade-in-up flex justify-center mb-4 sm:mb-8" style={{ animationDelay: "0.1s", animationFillMode: "forwards" }}>
              <AnnouncementBanner
                label="NEW"
                text="Chicago Chess Club Highlight!"
                href="/blog/chicago-chess-club-highlight"
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
              <span className={isDark ? "text-[oklch(0.65_0.14_145)]" : "text-[#436850]"}>
                Over The Board.
              </span>
            </h1>

            {/* SEO H2 — visually styled as a subtitle, semantically an H2 for crawlers */}
            <h2
              className="opacity-0-init animate-fade-in-up text-sm sm:text-lg leading-relaxed mb-0 sm:mb-10 max-w-xl mx-auto text-muted-foreground px-4 sm:px-0"
              style={{ animationDelay: "0.35s", animationFillMode: "forwards", fontWeight: 400 }}
            >
              <span className="sm:hidden">Sign up with chess.com username — pairings generated automatically.</span>
              <span className="hidden sm:inline">Players sign up with their chess.com username,<br />We generate optimal pairings automatically.</span>
            </h2>
          </div>

          {/* ── Bottom group: CTAs + View live demo ── */}
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
            <div
              className="opacity-0-init animate-fade-in-up mt-4 sm:mt-3 pb-2 sm:pb-0 flex flex-col sm:flex-row items-center gap-3"
              style={{ animationDelay: "0.5s", animationFillMode: "forwards" }}
            >
              <button
                type="button"
                onClick={() => window.location.href = "/tournament/otb-demo-2026/manage"}
                className={`group flex items-center gap-1.5 text-sm font-bold transition-all duration-200 ${
                  isDark
                    ? "text-[#7cf562] hover:text-white"
                    : "text-[#436850] hover:text-[#12372A]"
                }`}
              >
                <span className="relative flex h-2 w-2 flex-shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#7cf562] opacity-70" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#7cf562]" />
                </span>
                View Live Demo Dashboard
                <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
              </button>
            </div>
          </div>



        </div>

        {/* ── Hero Dashboard Mockup ── */}
        <HeroDashboardMockup
          darkScreenshotUrl={DARK_SCREENSHOT}
          lightScreenshotUrl={LIGHT_SCREENSHOT}
          isDark={isDark}
          alt="OTB!! Open 2026 — live tournament dashboard with Swiss pairings, round timer, and board results"
        />
      </div>
    </section>
  );
}

/// ─── Stats Bar ───────────────────────────────────────────────────────────────
// Slot machine scramble hook — randomises digits on hover then settles to the real value
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
  const { theme } = useTheme();
  const isDark = theme === "dark";
  // Floor values shown while loading or on API failure — never show false zeros
  const FLOORS = { tournaments: 300, players: 550, clubs: 80 };
  const [liveCounts, setLiveCounts] = useState<{ tournaments: number; players: number; clubs: number } | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  useEffect(() => {
    fetch("/api/platform/stats")
      .then((r) => r.ok ? r.json() : null)
      .then((data: { tournaments?: number; players?: number; clubs?: number } | null) => {
        if (data && typeof data.tournaments === "number") {
          setLiveCounts({
            tournaments: Math.max(data.tournaments, FLOORS.tournaments),
            players: Math.max(data.players ?? 0, FLOORS.players),
            clubs: Math.max(data.clubs ?? 0, FLOORS.clubs),
          });
        }
      })
      .catch(() => { /* silently keep floor values */ })
      .finally(() => setStatsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const counts = liveCounts ?? FLOORS;
  const stats: { target: number; suffix: string; decimals: number; label: string; demo?: boolean }[] = [
    { target: counts.tournaments, suffix: "+", decimals: 0, label: "Tournaments Hosted" },
    { target: counts.players, suffix: "+", decimals: 0, label: "Players Registered" },
    { target: counts.clubs, suffix: "+", decimals: 0, label: "Chess Clubs" },
    { target: 4.9, suffix: "★", decimals: 1, label: "Avg. Host Rating", demo: true },
  ];
  return (
    <section
      ref={ref}
      className="relative overflow-hidden mt-0"
      style={{
/* Solid green band — hard contrast edges, no top/bottom faders */
        background: "#436850",
      }}
    >
      {/* Subtle chess texture overlay */}
      <div className="absolute inset-0 chess-board-bg opacity-10 pointer-events-none" />

      <div className="container relative z-10 py-6 sm:py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-6 sm:gap-8">
          {statsLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex flex-col items-center gap-2">
                  <div className="h-10 w-24 rounded-lg bg-white/20 animate-pulse" />
                  <div className="h-3 w-28 rounded bg-white/15 animate-pulse" />
                </div>
              ))
            : stats.map((stat, i) => (
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
                  {stat.demo && (
                    <span className="absolute -top-1 -right-1 text-[9px] font-bold uppercase tracking-wider bg-white/20 text-white/70 px-1.5 py-0.5 rounded-full">
                      Beta
                    </span>
                  )}
                </div>
              ))
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

// ─── Phone Lightbox Modal ──────────────────────────────────────────────────
function PhoneLightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.88)", backdropFilter: "blur(12px)" }}
      onClick={onClose}
    >
      {/* Close button */}
      <button
        className="absolute top-5 right-5 z-10 flex items-center justify-center w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors duration-200"
        onClick={onClose}
        aria-label="Close lightbox"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M2 2L16 16M16 2L2 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </button>

      {/* Screenshot in phone frame */}
      <div
        className="relative flex items-center justify-center"
        style={{ maxHeight: "90vh", maxWidth: "min(420px, 90vw)" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Subtle glow behind the modal phone */}
        <div
          className="absolute pointer-events-none"
          style={{
            inset: -16,
            borderRadius: 70,
            boxShadow: "0 0 60px 16px oklch(0.65 0.18 145 / 0.28), 0 0 120px 32px oklch(0.55 0.14 145 / 0.14)",
          }}
        />
        {/* Phone shell */}
        <div
          style={{
            width: "min(380px, 88vw)",
            aspectRatio: "320 / 650",
            borderRadius: 50,
            border: "10px solid #1c1c1e",
            boxShadow: "0 0 0 1px #3a3a3a, 0 40px 120px rgba(0,0,0,0.9)",
            background: "#0a0a0a",
            overflow: "hidden",
            position: "relative",
          }}
        >
          <img
            src={src}
            alt={alt}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              objectPosition: "center top",
              display: "block",
            }}
            draggable={false}
          />
        </div>
        {/* Caption */}
        <p
          className="absolute -bottom-8 left-0 right-0 text-center text-white/50 text-xs tracking-wide"
        >
          {alt} · Click outside or press Esc to close
        </p>
      </div>
    </div>
  );
}

// ─── iPhone Mockup Frame ────────────────────────────────────────────────────
function IPhoneMockup({ src, alt, isDark, objectPosition, objectFit }: { src: string; alt: string; isDark: boolean; objectPosition?: string; objectFit?: string }) {
  const [hovered, setHovered] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const handleClose = useCallback(() => setLightboxOpen(false), []);
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
      {/* Gradient glow ring — soft green halo on hover */}
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
      {/* Side buttons — left (positions scale with the container via percentage) */}
      <div className="absolute z-20 rounded-l-sm" style={{ left: -3, top: "21.5%", width: 3, height: "6.15%", background: "#2a2a2a" }} />
      <div className="absolute z-20 rounded-l-sm" style={{ left: -3, top: "30%", width: 3, height: "9.85%", background: "#2a2a2a" }} />
      <div className="absolute z-20 rounded-l-sm" style={{ left: -3, top: "42.3%", width: 3, height: "9.85%", background: "#2a2a2a" }} />
      {/* Side button — right */}
      <div className="absolute z-20 rounded-r-sm" style={{ right: -3, top: "31.5%", width: 3, height: "13.85%", background: "#2a2a2a" }} />

      {/* Phone outer shell — border only, transparent center */}
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

      {/* Screen area — fills the interior */}
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
  const accentColor = isDark ? "text-[oklch(0.65_0.14_145)]" : "text-[#436850]";
  const accentBg = isDark ? "bg-[oklch(0.65_0.14_145)]/15" : "bg-[#436850]/10";

  // MacBook step: side-by-side layout
  if (mockupType === 'macbook') {
    return (
      <div
        ref={sectionRef}
        className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20 py-20 lg:py-28"
      >
        {/* MacBook mockup — left */}
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

        {/* Text content — right, staggered children */}
        <motion.div
          className="flex-1 max-w-md"
          variants={stepContainerVariants}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
        >
          <motion.div
            variants={stepItemVariants}
            whileHover={{ scale: 1.06, y: -2 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold tracking-wider uppercase mb-6 cursor-default select-none ${accentBg} ${accentColor}`}
          >
            <span className={`w-5 h-5 rounded-full flex items-center justify-center ${accentColor} border border-current`}>
              {icon}
            </span>
            Step {number}
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

      {/* Text content — staggered children */}
      <motion.div
        className="flex-1 w-full max-w-md px-2 sm:px-0"
        variants={stepContainerVariants}
        initial="hidden"
        animate={isInView ? "visible" : "hidden"}
      >
        {/* Step badge */}
        <motion.div
          variants={stepItemVariants}
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold tracking-wider uppercase mb-6 ${accentBg} ${accentColor}`}
        >
          <span className={`w-5 h-5 rounded-full flex items-center justify-center ${accentColor} border border-current`}>
            {icon}
          </span>
          Step {number}
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

        {/* Divider accent — grows from left */}
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

function HowItWorks() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const steps = [
    {
      number: "01",
      icon: <Trophy className="w-3 h-3" />,
      title: "Create Your Tournament, Share QR Code",
      description: "Set your format, rounds, and venue in under 3 minutes. Instantly get a shareable QR code — players scan and register on the spot.",
      cta: "Host a Tournament",
      ctaHref: "/?action=create",
      imageSrc: "/manus-storage/qr-screen_b1e19e90.webp",
      imageAlt: "Tournament QR Code screen",
      phoneLeft: true,
      mockupType: 'macbook' as const,
    },
    {
      number: "02",
      icon: <Users className="w-3 h-3" />,
      title: "Players Sign Up with chess.com ELO",
      description: "Share a link. Players enter their chess.com username — we automatically pull their verified ELO rating in real time.",
      cta: "Try the Join Flow",
      ctaHref: "/join/OTB2026",
      imageSrc: "/manus-storage/otb-join-form_28254c54.webp",
      imageAlt: "Player join form with chess.com username lookup",
      imageSrc2: "/manus-storage/player-signup-confirm_b5b69600.webp",
      imageAlt2: "Player profile confirmation with chess.com ELO",
      phoneLeft: false,
    },
    {
      number: "03",
      icon: <Swords className="w-3 h-3" />,
      title: "Optimal Pairings Generated",
      description: "Our algorithm creates balanced, fair pairings based on ELO. No manual work. Standings update live as results come in.",
      cta: "View Live Demo",
      ctaHref: "/tournaments/new",
      imageSrc: "/manus-storage/IMG_63952_5020b27c.jpg",
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
          Up and running in minutes.
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
            cta={(step as any).cta}
            ctaHref={(step as any).ctaHref}
            imageSrc={step.imageSrc}
            imageAlt={step.imageAlt}
            imageSrc2={(step as any).imageSrc2}
            imageAlt2={(step as any).imageAlt2}
            objectPosition={(step as any).objectPosition}
            objectPosition2={(step as any).objectPosition2}
            objectFit={(step as any).objectFit}
            objectFit2={(step as any).objectFit2}
            phoneLeft={step.phoneLeft}
            isDark={isDark}
            mockupType={step.mockupType}
            caption1={(step as any).caption1}
            caption2={(step as any).caption2}
          />
        ))}
      </div>
    </section>
  );
}

// ─── Ecosystem Pathways ─────────────────────────────────────────────────────
function EcosystemPathways() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { ref, inView } = useInView();

  const pathways = [
    {
      icon: <Trophy className="w-5 h-5" />,
      label: "Tournaments",
      description: "Host Swiss or round-robin events with automatic pairings and live standings.",
      href: "/tournaments",
      cta: "Browse Tournaments",
    },
    {
      icon: <Users className="w-5 h-5" />,
      label: "Clubs",
      description: "Build your club's home base — members, events, history, and leaderboards.",
      href: "/clubs",
      cta: "Explore Clubs",
    },
    {
      icon: <BarChart3 className="w-5 h-5" />,
      label: "League",
      description: "Run a season-long club league with cumulative standings and tiebreaks.",
      href: "/league",
      cta: "View League",
    },
    {
      icon: <Swords className="w-5 h-5" />,
      label: "Match Prep Tools",
      description: "Openings library, opponent analysis, and matchup prep — all in one place.",
      href: "/tools",
      cta: "Open Tools",
    },
  ];

  return (
    <section
      className={`py-14 sm:py-20 transition-colors duration-500 ${
        isDark ? "bg-[oklch(0.18_0.05_145)]" : "bg-[#F0F5E8]"
      }`}
      ref={ref}
    >
      <div className="container">
        <div className={`text-center mb-10 transition-all duration-700 ${
          inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
        }`}>
          <p className={`text-xs font-bold uppercase tracking-widest mb-3 ${
            isDark ? "text-[oklch(0.65_0.14_145)]" : "text-[#436850]"
          }`}>Platform</p>
          <h2
            className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-foreground"
            style={{ fontFamily: "'Clash Display', sans-serif" }}
          >
            Everything in one ecosystem.
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {pathways.map((p, i) => (
            <a
              key={p.label}
              href={p.href}
              className={`group flex flex-col gap-4 p-5 rounded-2xl border transition-all duration-300 hover:-translate-y-1 ${
                isDark
                  ? "bg-white/[0.04] border-white/[0.08] hover:border-[oklch(0.65_0.14_145)]/40 hover:bg-white/[0.07]"
                  : "bg-white border-[#ADBC9F]/50 hover:border-[#436850]/40 hover:shadow-md"
              } ${
                inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
              }`}
              style={{ transitionDelay: `${i * 60}ms`, animationFillMode: "forwards" }}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                isDark ? "bg-[oklch(0.65_0.14_145)]/15 text-[oklch(0.65_0.14_145)]" : "bg-[#436850]/10 text-[#436850]"
              }`}>
                {p.icon}
              </div>
              <div className="flex-1">
                <p className={`text-sm font-bold mb-1 ${
                  isDark ? "text-white" : "text-[#12372A]"
                }`}>{p.label}</p>
                <p className={`text-xs leading-relaxed ${
                  isDark ? "text-white/50" : "text-[#436850]/70"
                }`}>{p.description}</p>
              </div>
              <span className={`inline-flex items-center gap-1 text-xs font-semibold transition-colors duration-200 ${
                isDark
                  ? "text-[oklch(0.65_0.14_145)] group-hover:text-[oklch(0.75_0.16_145)]"
                  : "text-[#436850] group-hover:text-[#12372A]"
              }`}>
                {p.cta} <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </a>
          ))}
        </div>
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

      {/* Hover lift — respects reduced motion */}
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

      {/* Screenshot — shown when provided */}
      {screenshot && (
        <div className="relative overflow-hidden" style={{ aspectRatio: "16/9", flexShrink: 0 }}>
          <img
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
        <h3
          className={`text-base sm:text-lg font-semibold leading-snug ${titleColor}`}
          style={{ fontFamily: "'Clash Display', sans-serif" }}
        >
          {title}
        </h3>

        {/* Description */}
        <p className={`text-xs sm:text-sm leading-relaxed ${cardImage ? "" : "flex-1"} ${descColor}`}>
          {description}
        </p>

        {/* Inline card image — fills remaining space when provided */}
        {cardImage && (
          <div className="relative overflow-hidden rounded-xl mt-2 flex-1" style={{ minHeight: "180px" }}>
            <img
              src={cardImage}
              alt=""
              aria-hidden="true"
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
            Tournaments, clubs, leagues, and match prep — one platform, built for OTB chess.
          </p>
        </div>

        {/* ── Bento grid ── */}
        {/* Row 1: Tournament Operations (wide) + Clubs & Community (narrow) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <BentoCard
            tag="Club League"
            title="Weekly Club League"
            description="Season-long matchups, live leaderboards, and a playoff bracket. Give your members a reason to show up every week — and crown a champion at the end of the season."
            cta="View Live Demo"
            href="/league-demo"
            icon={<Trophy className="w-4 h-4" />}
            screenshot="/manus-storage/league-bracket-demo_5ed2beda.png"
            screenshotAlt="ChessOTB Club League Playoff Bracket Display with player standings"
            isDark={isDark}
            inView={inView}
            delay={80}
            accent
            className="sm:col-span-2"
          />
          <BentoCard
            tag="Clubs & Community"
            title="Club Roster & Events"
            description="Manage your club roster, post events, run polls, and track every member's OTB ELO history — all in one place."
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
            tag="League"
            title="Weekly Club League"
            description="Season-long matchups with a live leaderboard. Give members a reason to show up every week."
            cta="View League Demo"
            href="/league-demo"
            icon={<Zap className="w-4 h-4" />}
            isDark={isDark}
            inView={inView}
            delay={240}
          />
          <BentoCard
            tag="Matchup Preparation"
            title="Scout Your Next Opponent"
            description="AI-powered scouting report: openings, problem lines, and blunder patterns from their chess.com history — before you sit down."
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
            description="Study 18+ openings with interactive boards, coaching notes, and spaced-repetition drills — built for over-the-board club players."
            cta="Study Openings"
            href="/repertoire"
            icon={<BookOpen className="w-4 h-4" />}
            isDark={isDark}
            inView={inView}
            delay={400}
          />
        </div>

        {/* Row 3: Live Results & Shareable Content — full-width horizontal card */}
        <div
          className={`group relative rounded-2xl border overflow-hidden cursor-pointer flex flex-col sm:flex-row items-stretch transition-all duration-500 ${
            inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          } ${
            isDark
              ? "bg-[oklch(0.22_0.07_145)] border-white/[0.07]"
              : "bg-white border-[#ADBC9F]/50"
          }`}
          style={{ transitionDelay: "480ms" }}
          onClick={() => { const [, nav] = [null, (p: string) => { window.location.href = p; }]; nav("/tournaments"); }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); window.location.href = "/tournaments"; } }}
          aria-label="Live Results & Shareable Content: view live standings"
        >
          {/* Left: text content */}
          <div className="flex flex-col gap-3 p-5 sm:p-6 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span
                className={`text-[10px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-full border ${
                  isDark
                    ? "text-[oklch(0.65_0.14_145)] bg-[oklch(0.18_0.06_145)] border-[oklch(0.38_0.10_145)/0.5]"
                    : "text-[#436850] bg-[#EEF5EE] border-[#ADBC9F]/50"
                }`}
              >
                Live Results & Sharing
              </span>
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  isDark ? "bg-[oklch(0.30_0.09_145)/0.7]" : "bg-[#436850]/10"
                }`}
                style={{ color: isDark ? "#7CF562" : "#436850" }}
              >
                <BarChart3 className="w-4 h-4" />
              </div>
            </div>
            <h3
              className={`text-base sm:text-lg font-semibold leading-snug ${
                isDark ? "text-[oklch(0.93_0.05_145)]" : "text-[#12372A]"
              }`}
              style={{ fontFamily: "'Clash Display', sans-serif" }}
            >
              Real-Time Standings & Auto-Generated Recap Posts
            </h3>
            <p className={`text-xs sm:text-sm leading-relaxed ${
              isDark ? "text-[oklch(0.68_0.07_145)]" : "text-[#436850]"
            }`}>
              Leaderboards update the moment a result is entered. Share a public link with spectators, or auto-generate tournament recap posts, player cards, and standings graphics for Instagram or WhatsApp.
            </p>
            <button
              className={`mt-1 w-full sm:w-auto rounded-xl px-5 py-2.5 text-sm font-semibold tracking-wide border transition-all duration-200 ${
                isDark
                  ? "bg-[oklch(0.27_0.08_145)] hover:bg-[oklch(0.32_0.10_145)] text-[oklch(0.88_0.08_145)] border-[oklch(0.38_0.10_145)/0.5]"
                  : "bg-[#EEF5EE] hover:bg-[#436850] hover:text-white text-[#12372A] border-[#ADBC9F]/50"
              }`}
              style={{ minHeight: "44px" }}
              onClick={(e) => { e.stopPropagation(); window.location.href = "/tournaments"; }}
              aria-label="View live standings"
            >
              View Live Standings
            </button>
          </div>
          {/* Right: screenshot */}
          <div
            className="relative overflow-hidden sm:w-[45%] flex-shrink-0"
            style={{ minHeight: "180px" }}
          >
            <img
              src="/manus-storage/player-report-card_3a4bdbf7.png"
              alt="Player performance report card showing score, ELO, streak and recent form"
              className="absolute inset-0 w-full h-full object-cover object-top"
              loading="lazy"
            />
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: isDark
                  ? "linear-gradient(to right, oklch(0.22 0.07 145 / 0.6) 0%, transparent 40%)"
                  : "linear-gradient(to right, rgba(255,255,255,0.6) 0%, transparent 40%)",
              }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
// ─── Features CTA Banner ─────────────────────────────────────────────────────

// ─── Showcase — Contra Labs-style 2×2 Image-Dominant Feature Grid ───────────

const SHOWCASE_FEATURES = [
  {
    id: "tournaments",
    tag: "Swiss + Elim Format",
    title: "Run a\nTournament",
    description: "Swiss pairings, live standings, and elimination brackets — all from one director dashboard.",
    href: "/?action=create",
    screenshot: "https://d2xsxph8kpxj0f.cloudfront.net/117675823/J6FsDoRMH9x5xbUvpyzxyf/tournament-director_3b1b3c41.png",
    screenshotAlt: "Swiss Tournament Director Dashboard",
  },
  {
    id: "league",
    tag: "Chess Club League",
    title: "Host a\nLeague",
    description: "Weekly matchups and a season champion — incentivize your members to show up every week.",
    href: "/league",
    screenshot: "https://d2xsxph8kpxj0f.cloudfront.net/117675823/J6FsDoRMH9x5xbUvpyzxyf/league-tight_ca26e3fd.png",
    screenshotAlt: "Chess Club League Dashboard",
  },
  {
    id: "rated-game",
    tag: "OTB Rated Games",
    title: "Club OTB\nRating",
    description: "Earn a real over-the-board ELO that updates automatically after every rated club game.",
    href: "/clock?register=true",
    screenshot: "/manus-storage/otb-rated-game-carousel_ed800e01.webp",
    screenshotAlt: "OTB Rated Game with QR code on chess clock",
  },
  {
    id: "prep",
    tag: "Matchup Prep",
    title: "Build OTB\nRepertoire",
    description: "Scout any chess.com player's openings, problem lines, and blunder patterns before you sit down.",
    href: "/prep",
    screenshot: "https://files.manuscdn.com/user_upload_by_module/session_file/117675823/ldjNZgAdszCUXLEl.webp",
    screenshotAlt: "Scout Report showing opponent weaknesses",
  },
];

function Showcase() {
  const { ref, inView } = useInView();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [, navigate] = useLocation();

  // Section background: muted sage (light) / deep forest (dark) — Contra Labs style
  const sectionBg = isDark
    ? "bg-[oklch(0.16_0.05_145)]"
    : "bg-[oklch(0.92_0.03_160)]";

  // Card background: dark teal (both modes, image-dominant)
  const cardBg = isDark
    ? "bg-[oklch(0.22_0.06_170)]"
    : "bg-[oklch(0.35_0.06_170)]";

  return (
    <section
      id="for-clubs"
      className={`py-12 sm:py-16 lg:py-24 overflow-hidden transition-colors duration-500 ${sectionBg}`}
      ref={ref}
    >
      <div className="container max-w-6xl">

        {/* ── Section header — left-aligned, editorial serif ── */}
        <div className={`mb-8 sm:mb-12 mx-auto max-w-lg text-center transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
          <h2
            className={`text-2xl sm:text-3xl lg:text-5xl font-semibold tracking-tight mb-3 sm:mb-4 ${
              isDark ? "text-white" : "text-[#12372A]"
            }`}
            style={{ fontFamily: "'Clash Display', sans-serif" }}
          >
            Explore the OTB
            <br />
            Chess ecosystem
          </h2>
          <p className={`text-base leading-relaxed ${
            isDark ? "text-white/60" : "text-[#436850]"
          }`}>
            Four tools that power your over-the-board chess experience — from hosting tournaments to scouting your next opponent.
          </p>
        </div>

        {/* ── 2×2 Card Grid ── */}
        <div className="grid sm:grid-cols-2 gap-3">
          {SHOWCASE_FEATURES.map((feature, i) => (
            <div
              key={feature.id}
              className={`group relative rounded-2xl overflow-hidden cursor-pointer transition-all duration-500 ${
                inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
              } ${cardBg}`}
              style={{
                transitionDelay: `${(i + 1) * 100}ms`,
                aspectRatio: "4/3",
              }}
              onClick={() => {
                if (feature.href.startsWith("/")) navigate(feature.href);
                else window.open(feature.href, "_blank", "noopener");
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (feature.href.startsWith("/")) navigate(feature.href);
                  else window.open(feature.href, "_blank", "noopener");
                }
              }}
              aria-label={`${feature.tag}: ${feature.title.replace("\n", " ")}`}
            >
              {/* Screenshot image — fills entire card */}
              <img
                src={feature.screenshot}
                alt={feature.screenshotAlt}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06]"
              />

              {/* Gradient scrim — stronger at bottom for text readability */}
              <div
                className="absolute inset-0 pointer-events-none transition-opacity duration-300"
                style={{
                  background: "linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.05) 40%, rgba(0,0,0,0.55) 100%)",
                }}
              />

              {/* Hover overlay — subtle green tint */}
              <div className="absolute inset-0 bg-[oklch(0.45_0.14_145)]/0 group-hover:bg-[oklch(0.45_0.14_145)]/10 transition-colors duration-300 pointer-events-none" />

              {/* Tag label removed for minimalist look */}

              {/* Title + description — bottom-left overlay */}
              <div className="absolute bottom-5 left-5 right-14 z-10">
                <h3
                  className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-white leading-tight mb-2"
                  style={{ fontFamily: "'Clash Display', sans-serif", whiteSpace: "pre-line" }}
                >
                  {feature.title}
                </h3>
                {feature.description && (
                  <p className="text-[13px] text-white/70 leading-snug">
                    {feature.description}
                  </p>
                )}
              </div>

              {/* Arrow hint — bottom-right, appears on hover */}
              <div className="absolute bottom-5 right-5 z-10 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0">
                <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <ArrowRight className="w-5 h-5 text-white" />
                </div>
              </div>
            </div>
          ))}
        </div>
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

            {/* Profile card — premium redesign */}
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
                          <img src={`/api/avatar-proxy?url=${encodeURIComponent(profile.avatar)}`} alt={profile.username} className="w-12 h-12 rounded-xl object-cover" crossOrigin="anonymous" style={{ boxShadow: isDark ? "0 0 0 2px oklch(0.65 0.14 145 / 0.3)" : "0 0 0 2px rgba(61,107,71,0.2)" }} />
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
                        {profile.rapid || profile.blitz || profile.bullet || "—"}
                      </div>
                      <div className="text-[10px] font-semibold uppercase tracking-widest mt-1" style={{ color: isDark ? "oklch(0.50 0.08 145)" : "#7a9e7a" }}>
                        Rapid ELO
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
                              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: isDark ? "oklch(0.50 0.08 145)" : "#7a9e7a" }}>Form — Last {total} Games</span>
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

// ─── Testimonials ─────────────────────────────────────────────────────────────
function Testimonials() {
  const { ref, inView } = useInView();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const testimonials = [
    { quote: "We ran a 24-player Swiss last Saturday. I shared the QR code, players scanned and registered in under 2 minutes, and Round 1 pairings were ready before everyone had even sat down. Genuinely the smoothest tournament I've ever directed.", author: "Marcus T.", role: "Club President, NYC Chess Society", elo: "1842" },
    { quote: "The ELO pull from chess.com eliminated every rating dispute we used to have. One player tried to claim a higher rating — I just showed him the screen. Done. No spreadsheets, no arguments, no drama.", author: "Aisha K.", role: "Tournament Director, London Chess Club", elo: "2105" },
    { quote: "Our club night went from 45 minutes of setup chaos to 8 minutes flat. 32 players, 5 rounds of Swiss, live standings on the projector. People were checking standings between moves. We're not going back to paper.", author: "Rafael M.", role: "Organizer, São Paulo Open Chess", elo: "1654" },
  ];

  return (
    <section id="testimonials" className="py-12 sm:py-16 lg:py-24 transition-colors duration-500 bg-background" ref={ref}>
      <div className="container">
        <div className="text-center mb-8 sm:mb-12 lg:mb-16">
          <p className={`text-xs font-semibold tracking-widest uppercase mb-3 ${inView ? "animate-badge-pop" : "opacity-0"} ${isDark ? "text-[oklch(0.65_0.14_145)]" : "text-[#436850]"}`}
            style={{ animationFillMode: "forwards" }}>
            From the Community
          </p>
          <h2 className={`text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight text-foreground ${inView ? "animate-fade-up-soft" : "opacity-0"}`}
            style={{ fontFamily: "'Clash Display', sans-serif", animationDelay: "100ms", animationFillMode: "forwards" }}>
            Clubs that made the move.
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <div
              key={t.author}
              className={`card-chess card-testimonial p-6 ${inView ? "animate-fade-up-soft" : "opacity-0"}`}
              style={{ animationDelay: `${200 + i * 120}ms`, animationFillMode: "forwards" }}
            >
              <div className="flex items-center gap-1 mb-4">
                {[...Array(5)].map((_, j) => (
                  <Star key={j} className={`w-4 h-4 ${isDark ? "fill-[oklch(0.65_0.14_145)] text-[oklch(0.65_0.14_145)]" : "fill-[#436850] text-[#436850]"}`} />
                ))}
              </div>
              <p className="text-muted-foreground text-sm leading-relaxed mb-6 italic">"{t.quote}"</p>
              <div className={`flex items-center justify-between pt-4 border-t ${isDark ? "border-white/10" : "border-[#ADBC9F]"}`}>
                <div>
                  <p className="font-semibold text-foreground text-sm">{t.author}</p>
                  <p className="text-xs text-muted-foreground">{t.role}</p>
                </div>
                <span className="tag-elo">{t.elo}</span>
              </div>
            </div>
          ))}
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
              onClick={() => window.location.href = "/tournaments/new"}
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
    Platform: [
      { label: "Clubs", href: "/clubs" },
      { label: "Tournaments", href: "/tournaments" },
      { label: "League", href: "/league" },
      { label: "Tools", href: "/training" },
      { label: "Pricing", href: "/pricing" },
    ],
    Community: [
      { label: "Host Tournament", href: "/tournaments/new" },
      { label: "Join a Tournament", href: "/join" },
      { label: "Discord", href: "https://discord.gg/chessotb" },
      { label: "X / Twitter", href: "https://x.com/chessotbclub" },
    ],
    Company: [
      { label: "About", href: "/#how-it-works" },
      { label: "Blog", href: "/blog" },
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
      {/* Dark overlay — lighter in center to reveal trophy, darker at edges to keep text legible */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 70% 90% at 50% 50%, oklch(0.12 0.05 145 / 0.68) 0%, oklch(0.10 0.04 145 / 0.90) 100%)" }}
      />
      <div className="container relative z-10">
        <div className="grid md:grid-cols-4 gap-10 mb-12">
          <div>
            <div className="flex items-center gap-1 mb-4">
              <img
                src="https://files.manuscdn.com/user_upload_by_module/session_file/117675823/bWANpVvGVfpfXSpZ.png"
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
  const [wizardOpen, setWizardOpen] = useState(false);
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
  // Active tab state — synced with AnimeNavBar via IntersectionObserver
  const [activeNavTab, setActiveNavTab] = useState("Tournaments");

  // SEO
  usePageMeta({
    title: "ChessOTB.club — The Home for Over-the-Board Chess",
    description: "Host and manage over-the-board chess tournaments with Swiss pairings, live standings, and QR check-in. Free for chess clubs.",
    path: "/",
  });

  // Handle PWA shortcut: /?action=create opens the wizard immediately
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("action") === "create") {
      setWizardOpen(true);
      // Clean the URL without reloading
      window.history.replaceState({}, "", "/");
    }
  }, []);

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

    // No live tournament — send to join page
    return "/join";
  };

  // AnimeNavBar items — Home removed; logo navigates to landing page
  const navItems = [
    { name: "Clubs",       url: "/clubs",         icon: Building2,      sectionId: "for-clubs" },
    { name: "Tournaments", url: getDashboardUrl(), icon: LayoutDashboard, dropdown: <DashboardDropdown />, onClick: (e: React.MouseEvent) => { e.preventDefault(); window.location.href = getDashboardUrl(); } },
    { name: "League",      url: leagueNavUrl,    icon: Trophy,         tooltip: myLeagues.length ? (myLeagues.find((l) => l.status === "active")?.name ?? myLeagues[0]?.name) : "View League Demo", onClick: (e: React.MouseEvent) => { e.preventDefault(); window.location.href = leagueNavUrl; } },
    { name: "Tools",    url: "/training",     icon: GraduationCap },
  ];

  const logoEl = (
    <Link href="/" className="flex items-center">
      <img
        src="https://files.manuscdn.com/user_upload_by_module/session_file/117675823/bWANpVvGVfpfXSpZ.png"
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
      <Hero onCreateTournament={() => setWizardOpen(true)} />
      <StatsBar />
      <HowItWorks />
      <Features />
      <PlayerDemo />
      <Testimonials />
      <CTASection onCreateTournament={() => setWizardOpen(true)} />
      <Footer />
      <TournamentWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />
      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} isDark={isDark} />
      <ProUpgradeModal isOpen={upgradeOpen} onClose={() => setUpgradeOpen(false)} />


    </div>
  );
}
