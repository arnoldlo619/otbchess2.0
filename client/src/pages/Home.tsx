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

import { useState, useEffect, useRef } from "react";
import { useChessComProfile } from "@/hooks/useChessComProfile";
import { Link } from "wouter";
import { toast } from "sonner";
import { useTheme } from "@/contexts/ThemeContext";
import { TournamentWizard } from "@/components/TournamentWizard";
import { getAllRegistrations } from "@/lib/registrationStore";
import { resolveTournament, listTournaments, hasDirectorSession } from "@/lib/tournamentRegistry";
import { DashboardDropdown } from "@/components/DashboardDropdown";

import AuthModal from "../components/AuthModal";
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
  Clock,
  CheckCircle2,
  ArrowRight,
  Star,
  Shield,
  Globe,
  Home as HomeIcon,
  Building2,
  Video,
  LogIn,
  LogOut,
  ChevronDown,
  Ghost,
  LayoutDashboard,
  Target,
  BookOpen,
  Search,
  TrendingUp,
  Brain,
} from "lucide-react";
import { AnimeNavBar } from "@/components/ui/anime-navbar";
import { GuestMobileMenu } from "@/components/GuestMobileMenu";
import { AvatarNavDropdown } from "@/components/AvatarNavDropdown";
import { HoverBorderGradient } from "@/components/ui/hover-border-gradient";
import { SpinBorderButton } from "@/components/ui/spin-border-button";

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
function Nav({
  onCreateTournament,
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

  const navLinks: { label: string; id: string }[] = [];
  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? isDark
            ? "bg-[oklch(0.20_0.06_145)] backdrop-blur-md border-b border-white/10 shadow-sm"
            : "bg-[#F2F7F3]/96 backdrop-blur-md border-b border-[#3D6B47]/12 shadow-sm"
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

        {/* Desktop Links — centre (empty if navLinks is empty) */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <button
              key={link.id}
              onClick={() => scrollTo(link.id)}
              className={`text-sm font-medium transition-colors duration-200 ${
                isDark
                  ? "text-white/60 hover:text-white"
                  : "text-[#4B5563] hover:text-[#3D6B47]"
              }`}
            >
              {link.label}
            </button>
          ))}
        </div>

        {/* Right-side: Sign In / Avatar → Archive → Toggle → [Tournament Dashboard] */}
        <div className="hidden md:flex items-center gap-4">
          {user ? (
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all border ${
                  user.isGuest
                    ? isDark ? "border-amber-500/30 text-amber-300 hover:bg-amber-500/10" : "border-amber-500/30 text-amber-600 hover:bg-amber-50"
                    : isDark
                      ? "border-white/20 text-white/80 hover:bg-white/10"
                      : "border-[#3D6B47]/20 text-[#3D6B47] hover:bg-[#3D6B47]/08"
                }`}
              >
                {user.isGuest ? (
                  <Ghost className="w-4 h-4" />
                ) : (
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    isDark ? "bg-[#3D6B47] text-white" : "bg-[#3D6B47] text-white"
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
                    isDark ? "bg-[oklch(0.22_0.06_145)] border-white/10" : "bg-white border-[#3D6B47]/12"
                  }`}
                  onMouseLeave={() => setUserMenuOpen(false)}
                >
                  {!user.isGuest && (
                    <Link
                      href="/profile"
                      className={`flex items-center gap-2 px-4 py-3 text-sm transition-colors ${
                        isDark ? "text-white/80 hover:bg-white/08" : "text-[#1a1a1a] hover:bg-[#3D6B47]/06"
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
                      isDark ? "text-red-400 hover:bg-white/08 border-white/08" : "text-red-500 hover:bg-red-50 border-gray-100"
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
              className={`text-sm font-medium transition-colors ${
                isDark ? "text-white/70 hover:text-white" : "text-[#3D6B47] hover:text-[#2A4A32]"
              }`}
            >
              Sign In
            </button>
          )}
          <Link href="/clubs">
            <span
              className={`text-sm font-medium transition-colors duration-200 cursor-pointer ${
                isDark
                  ? "text-white/60 hover:text-white"
                  : "text-[#4B5563] hover:text-[#3D6B47]"
              }`}
            >
              Clubs
            </span>
          </Link>
          <Link href="/record">
            <span
              className={`text-sm font-medium transition-colors duration-200 cursor-pointer ${
                isDark
                  ? "text-white/60 hover:text-white"
                  : "text-[#4B5563] hover:text-[#3D6B47]"
              }`}
            >
              Analyze
            </span>
          </Link>

        </div>

        {/* Mobile: toggle + menu */}
        <div className="md:hidden flex items-center gap-2">
          <button
            className="p-2 text-foreground"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className={`md:hidden border-b px-4 pb-4 ${isDark ? "bg-[oklch(0.20_0.06_145)] border-white/10" : "bg-[#F2F7F3] border-[#3D6B47]/12"}`}>
          {navLinks.map((link) => (
            <button
              key={link.id}
              onClick={() => { scrollTo(link.id); setMobileOpen(false); }}
              className={`block w-full text-left py-3 text-sm font-medium border-b last:border-0 ${
                isDark ? "text-white/70 border-white/08" : "text-[#4B5563] border-[#F0F5EE]"
              }`}
            >
              {link.label}
            </button>
          ))}
          {user ? (
            <>
              <Link
                href="/profile"
                className={`block w-full py-3 text-sm font-medium border-b ${
                  isDark ? "text-white/70 border-white/08" : "text-[#4B5563] border-[#F0F5EE]"
                }`}
                onClick={() => setMobileOpen(false)}
              >
                My Profile ({user.displayName || user.email})
              </Link>
              <button
                onClick={() => { logout(); setMobileOpen(false); }}
                className={`block w-full text-left py-3 text-sm font-medium border-b text-red-500 ${
                  isDark ? "border-white/08" : "border-[#F0F5EE]"
                }`}
              >
                Sign Out
              </button>
            </>
          ) : (
            <button
              onClick={() => { onSignIn(); setMobileOpen(false); }}
              className={`block w-full text-left py-3 text-sm font-medium border-b ${
                isDark ? "text-white/70 border-white/08" : "text-[#4B5563] border-[#F0F5EE]"
              }`}
            >
              Sign In
            </button>
          )}
          <Link href="/clubs">
            <span
              className={`block w-full py-3 text-sm font-medium border-b ${
                isDark ? "text-white/70 border-white/08" : "text-[#4B5563] border-[#F0F5EE]"
              }`}
              onClick={() => setMobileOpen(false)}
            >
              Clubs
            </span>
          </Link>
          <Link href="/record">
            <span
              className={`block w-full py-3 text-sm font-medium border-b ${
                isDark ? "text-white/70 border-white/08" : "text-[#4B5563] border-[#F0F5EE]"
              }`}
              onClick={() => setMobileOpen(false)}
            >
              Analyze
            </span>
          </Link>

        </div>
      )}
    </nav>
  );
}

// ─── Hero Section ────────────────────────────────────────────────────────────
function Hero({ onCreateTournament }: { onCreateTournament: () => void }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <section className={`relative min-h-screen flex items-center overflow-hidden pt-28 sm:pt-24 md:pt-16 transition-colors duration-500 ${isDark ? "bg-[oklch(0.20_0.06_145)]" : "bg-white"}`}>
      {/* Chess board texture */}
      <div className="absolute inset-0 chess-board-bg opacity-40 pointer-events-none" />

      {/* Subtle radial glow */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[80vw] h-[60vh] pointer-events-none"
        style={{
          background: isDark
            ? "radial-gradient(ellipse at 50% 0%, oklch(0.44 0.12 145 / 0.14) 0%, transparent 70%)"
            : "radial-gradient(ellipse at 50% 0%, oklch(0.55 0.13 145 / 0.07) 0%, transparent 70%)",
        }}
      />

      <div className="container relative z-10">
        <div className="max-w-3xl mx-auto text-center py-24 lg:py-32">
          <div className="opacity-0-init animate-fade-in-up flex justify-center mb-8" style={{ animationDelay: "0.1s", animationFillMode: "forwards" }}>
            <HoverBorderGradient
              as="span"
              containerClassName={isDark ? "bg-[oklch(0.18_0.05_145)]" : "bg-white"}
              className={`text-[11px] font-semibold tracking-[0.18em] uppercase leading-none ${
                isDark ? "text-white/75 bg-[oklch(0.18_0.05_145)]" : "text-[#3D6B47] bg-white"
              }`}
            >
              For Chess Clubs &amp; Communities
            </HoverBorderGradient>
          </div>

          <h1
            className="opacity-0-init animate-fade-in-up text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-semibold leading-[1.05] tracking-tight mb-5 sm:mb-6 text-foreground"
            style={{ fontFamily: "'Clash Display', sans-serif", animationDelay: "0.2s", animationFillMode: "forwards" }}
          >
            Chess Tournaments,
            <br />
            <span className={isDark ? "text-[oklch(0.65_0.14_145)]" : "text-[#3D6B47]"}>
              Over The Board.
            </span>
          </h1>

          <p
            className="opacity-0-init animate-fade-in-up text-base sm:text-lg leading-relaxed mb-8 sm:mb-10 max-w-xl mx-auto text-muted-foreground px-2 sm:px-0"
            style={{ animationDelay: "0.35s", animationFillMode: "forwards" }}
          >
            {/* Short single-line on mobile, full copy on sm+ */}
            <span className="sm:hidden">Set up in minutes. Pairings generated automatically.</span>
            <span className="hidden sm:inline">Set up in minutes. Players sign up with their chess.com username, we generate optimal pairings automatically.</span>
          </p>

          <div
            className="opacity-0-init animate-fade-in-up flex flex-col sm:flex-row gap-3 justify-center items-center w-full max-w-sm sm:max-w-none mx-auto"
            style={{
              animationDelay: "0.45s",
              animationFillMode: "forwards",
              paddingBottom: "max(0px, env(safe-area-inset-bottom, 0px))",
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
            className="opacity-0-init animate-fade-in-up mt-3"
            style={{ animationDelay: "0.5s", animationFillMode: "forwards" }}
          >
            <Link
              href="/tournament/otb-demo-2026/manage"
              className={`text-sm font-medium underline underline-offset-4 ${
                isDark ? "text-white/50 hover:text-white/80" : "text-[#4B5563] hover:text-[#3D6B47]"
              }`}
            >
              View live demo →
            </Link>
          </div>



          {/* Quick-stat chips */}
          <div
            className="opacity-0-init animate-fade-in-up mt-14 hidden sm:flex flex-wrap justify-center gap-3"
            style={{ animationDelay: "0.65s", animationFillMode: "forwards" }}
          >
            {[
              { icon: <Zap className="w-3.5 h-3.5" />, label: "Setup in < 3 min" },
              { icon: <BarChart3 className="w-3.5 h-3.5" />, label: "99.9% ELO accuracy" },
              { icon: <Shield className="w-3.5 h-3.5" />, label: "Swiss & Round Robin" },
              { icon: <Globe className="w-3.5 h-3.5" />, label: "80+ clubs worldwide" },
            ].map(({ icon, label }) => (
              <span
                key={label}
                className={`stat-pill inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-all duration-300 cursor-default select-none ${
                  isDark
                    ? "border-white/15 text-white/60 bg-white/04 hover:border-[oklch(0.65_0.14_145)]/50 hover:text-white/90 hover:bg-[oklch(0.65_0.14_145)]/10"
                    : "border-[#3D6B47]/20 text-[#3D6B47]/80 bg-[#3D6B47]/05 hover:border-[#3D6B47]/50 hover:text-[#3D6B47] hover:bg-[#3D6B47]/10"
                }`}
                style={{ position: "relative" }}
              >
                {icon}
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/// ─── Stats Bar ───────────────────────────────────────────────────────────────
function StatItem({
  target, suffix, decimals, label, delay, active,
}: {
  target: number; suffix: string; decimals: number;
  label: string; delay: number; active: boolean;
}) {
  const display = useCountUp(target, active, { duration: 1600, suffix, decimals, delay });
  return (
    <div>
      <p className="text-3xl font-bold text-white mb-1 tabular-nums" style={{ fontFamily: "'Clash Display', sans-serif" }}>
        {display}
      </p>
      <p className="text-sm text-white/70 font-medium">{label}</p>
    </div>
  );
}

function StatsBar() {
  const { ref, inView } = useInView();
  const stats: { target: number; suffix: string; decimals: number; label: string }[] = [
    { target: 300, suffix: "+", decimals: 0, label: "Tournaments Hosted" },
    { target: 550, suffix: "+", decimals: 0, label: "Players Registered" },
    { target: 80, suffix: "+", decimals: 0, label: "Chess Clubs" },
    { target: 4.9, suffix: "★", decimals: 1, label: "Average Rating" },
  ];
  return (
    <section ref={ref} className="bg-[#3D6B47] py-10">
      <div className="container">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat, i) => (
            <div
              key={stat.label}
              className={`stat-item text-center ${inView ? "animate-stat-pop" : "opacity-0"}`}
              style={{ animationDelay: `${i * 90}ms`, animationFillMode: "forwards" }}
            >
              <StatItem
                target={stat.target}
                suffix={stat.suffix}
                decimals={stat.decimals}
                label={stat.label}
                delay={i * 90}
                active={inView}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── How It Works ────────────────────────────────────────────────────────────
function HowItWorks() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  // Per-element refs for scroll-reveal
  const labelRef = useRef<HTMLParagraphElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const cardRefs = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)];

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      // Skip animation — ensure elements are visible
      [labelRef, headingRef, ...cardRefs].forEach(r => {
        if (r.current) {
          r.current.style.opacity = "1";
          r.current.style.transform = "none";
        }
      });
      return;
    }

    const targets: Array<{ el: HTMLElement; delay: number; cls: string }> = [
      { el: labelRef.current!, delay: 0,   cls: "scroll-reveal-init" },
      { el: headingRef.current!, delay: 80, cls: "scroll-reveal-heading" },
      ...cardRefs.map((r, i) => ({ el: r.current!, delay: 160 + i * 110, cls: "scroll-reveal-init" })),
    ].filter(t => t.el);

    const observers: IntersectionObserver[] = [];

    targets.forEach(({ el, delay, cls }) => {
      el.classList.add(cls);
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setTimeout(() => el.classList.add("scroll-revealed"), delay);
            obs.disconnect();
          }
        },
        { threshold: 0.15 }
      );
      obs.observe(el);
      observers.push(obs);
    });

    return () => observers.forEach(o => o.disconnect());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const steps = [
    {
      number: "01",
      icon: <Trophy className="w-6 h-6" />,
      title: "Create Your Tournament",
      description: "Set the format (Swiss, Round Robin, Knockout), number of rounds, time control, and venue. Takes under 3 minutes.",
    },
    {
      number: "02",
      icon: <Users className="w-6 h-6" />,
      title: "Players Sign Up with chess.com",
      description: "Share a link. Players enter their chess.com username — we automatically pull their verified ELO rating in real time.",
    },
    {
      number: "03",
      icon: <Swords className="w-6 h-6" />,
      title: "Optimal Pairings Generated",
      description: "Our algorithm creates balanced, fair pairings based on ELO. No manual work. Standings update live as results come in.",
    },
  ];

  return (
    <section id="how-it-works" className="py-24 transition-colors duration-500 bg-background">
      <div className="container">
        <div>
          {/* Steps column */}
          <div>
            <div className="mb-12">
              <p
                ref={labelRef}
                className={`text-xs font-semibold tracking-widest uppercase mb-3 ${isDark ? "text-[oklch(0.65_0.14_145)]" : "text-[#3D6B47]"}`}
              >
                Simple Process
              </p>
              <h2
                ref={headingRef}
                className="text-4xl lg:text-5xl font-semibold tracking-tight text-foreground"
                style={{ fontFamily: "'Clash Display', sans-serif" }}
              >
                From zero to tournament
                <br />
                in three moves.
              </h2>
            </div>
            <div className="grid md:grid-cols-3 gap-6 relative">
              <div className={`hidden md:block absolute top-12 left-1/3 right-1/3 h-px ${isDark ? "bg-white/10" : "bg-[#EEEED2]"}`} />
              {steps.map((step, i) => (
                <div
                  key={step.number}
                  ref={cardRefs[i]}
                  className="relative"
                >
                  <div className="card-chess step-card p-6">
                    <div className="flex items-start justify-between mb-5">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? "bg-white/10 text-[oklch(0.65_0.14_145)]" : "bg-[#3D6B47]/08 text-[#3D6B47]"}`}>
                        {step.icon}
                      </div>
                      <span
                        className={`step-number text-4xl font-bold ${isDark ? "text-white/10" : "text-[#EEEED2]"}`}
                        style={{ fontFamily: "'Clash Display', sans-serif" }}
                      >
                        {step.number}
                      </span>
                    </div>
                    <h3 className="text-base font-semibold text-foreground mb-2">{step.title}</h3>
                    <p className="text-muted-foreground leading-relaxed text-sm">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Features ────────────────────────────────────────────────────────────────
function Features() {
  const { ref, inView } = useInView();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const features = [
    { icon: <Globe className="w-5 h-5" />, title: "chess.com API Integration", description: "Players sign up with their chess.com username. ELO ratings are pulled automatically — no manual entry, no disputes.", tag: "Live ELO Sync" },
    { icon: <Zap className="w-5 h-5" />, title: "Smart Pairing Engine", description: "Swiss system pairings optimized by ELO, color balance, and previous opponents. Handles tiebreaks automatically.", tag: "Algorithm-Powered" },
    { icon: <BarChart3 className="w-5 h-5" />, title: "Live Standings & Results", description: "Real-time leaderboard updates as results are submitted. Shareable public link for spectators and club members.", tag: "Real-Time" },
    { icon: <Clock className="w-5 h-5" />, title: "Multiple Formats", description: "Swiss, Round Robin, Single Elimination, and Double Elimination. Set time controls, bye rules, and scoring systems.", tag: "Flexible" },
    { icon: <Shield className="w-5 h-5" />, title: "Club Management", description: "Manage your club's roster, track member ELO history over time, and organize recurring weekly or monthly events.", tag: "For Clubs" },
    { icon: <CheckCircle2 className="w-5 h-5" />, title: "Result Verification", description: "Players confirm results from their device. Disputes are flagged for the tournament director to resolve instantly.", tag: "Verified" },
  ];

  return (
    <section
      id="features"
      className={`py-24 transition-colors duration-500 ${isDark ? "bg-[oklch(0.23_0.07_145)]" : "bg-[#F0F5EE]"}`}
      ref={ref}
    >
      <div className="container">
        <div className="text-center mb-16">
          <p className={`text-xs font-semibold tracking-widest uppercase mb-3 ${inView ? "animate-badge-pop" : "opacity-0"} ${isDark ? "text-[oklch(0.65_0.14_145)]" : "text-[#3D6B47]"}`}
            style={{ animationFillMode: "forwards" }}>
            Platform Features
          </p>
          <h2 className={`text-4xl lg:text-5xl font-semibold tracking-tight text-foreground ${inView ? "animate-fade-up-soft" : "opacity-0"}`}
            style={{ fontFamily: "'Clash Display', sans-serif", animationDelay: "100ms", animationFillMode: "forwards" }}>
            Take your club to the next level
          </h2>
        </div>

        {/* Feature cards — full width 3-column grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((feature, i) => (
            <div
              key={feature.title}
              className={`card-chess p-6 transition-all duration-500 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
              style={{ transitionDelay: `${(i + 1) * 80}ms` }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isDark ? "bg-white/10 text-[oklch(0.65_0.14_145)]" : "bg-[#3D6B47]/08 text-[#3D6B47]"}`}>
                  {feature.icon}
                </div>
                <span className="tag-elo">{feature.tag}</span>
              </div>
              <h3 className="text-base font-semibold text-foreground mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
// ─── Chess Club Chess League — Matchup Prep ─────────────────────────────────
function Showcase() {
  const { ref, inView } = useInView();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const steps = [
    {
      icon: <Search className="w-5 h-5" />,
      title: "Pull Club Member Games",
      desc: "Connect your chess.com club and we automatically import every member's recent games for analysis.",
    },
    {
      icon: <Brain className="w-5 h-5" />,
      title: "Analyze Play Styles",
      desc: "Our engine identifies each player's opening repertoire, tactical tendencies, and endgame patterns.",
    },
    {
      icon: <Target className="w-5 h-5" />,
      title: "Get Strategic Lines",
      desc: "Receive tailored preparation lines and counter-strategies for your next round matchup.",
    },
    {
      icon: <TrendingUp className="w-5 h-5" />,
      title: "Track Your Progress",
      desc: "Monitor how your prep translates to results across league rounds and club events.",
    },
  ];

  return (
    <section id="for-clubs" className="py-24 overflow-hidden transition-colors duration-500 bg-background" ref={ref}>
      <div className="container">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left — visual card */}
          <div className={`transition-all duration-700 ${inView ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-8"}`}>
            <div
              className={`relative rounded-2xl overflow-hidden shadow-xl ${
                isDark ? "bg-[oklch(0.22_0.06_145)]" : "bg-[#F2F7F3]"
              }`}
              style={{ minHeight: "420px" }}
            >
              {/* Decorative chess board grid */}
              <div className="absolute inset-0 chess-board-bg opacity-20" />
              <div className="relative z-10 flex flex-col h-full min-h-[420px] p-8">
                {/* Header */}
                <div className="mb-6">
                  <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider mb-4 ${
                    isDark ? "bg-[oklch(0.65_0.14_145)]/15 text-[oklch(0.65_0.14_145)]" : "bg-[#3D6B47]/10 text-[#3D6B47]"
                  }`}>
                    <Swords className="w-3.5 h-3.5" /> Chess League
                  </div>
                  <h3 className={`text-lg font-bold ${
                    isDark ? "text-white" : "text-gray-900"
                  }`} style={{ fontFamily: "'Clash Display', sans-serif" }}>
                    Matchup Prep Dashboard
                  </h3>
                </div>

                {/* Mock prep card */}
                <div className={`rounded-xl border p-4 mb-4 ${
                  isDark ? "bg-[oklch(0.25_0.06_145)] border-white/10" : "bg-white border-[#3D6B47]/12 shadow-sm"
                }`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        isDark ? "bg-amber-400/15 text-amber-400" : "bg-amber-50 text-amber-600"
                      }`}>
                        <Crown className="w-4 h-4" />
                      </div>
                      <div>
                        <p className={`text-sm font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>Round 3 Opponent</p>
                        <p className={`text-xs ${isDark ? "text-white/40" : "text-gray-400"}`}>chess.com/member/opponent42</p>
                      </div>
                    </div>
                    <span className={`text-xs font-bold px-2 py-1 rounded-md ${
                      isDark ? "bg-blue-400/15 text-blue-300" : "bg-blue-50 text-blue-600"
                    }`}>1847 Rapid</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: "Plays 1.d4", pct: "68%" },
                      { label: "King's Indian", pct: "45%" },
                      { label: "Endgame Win", pct: "52%" },
                    ].map(({ label, pct }) => (
                      <div key={label} className={`rounded-lg p-2 text-center ${
                        isDark ? "bg-white/05" : "bg-gray-50"
                      }`}>
                        <p className={`text-sm font-bold ${
                          isDark ? "text-[oklch(0.65_0.14_145)]" : "text-[#3D6B47]"
                        }`} style={{ fontFamily: "'Clash Display', sans-serif" }}>{pct}</p>
                        <p className={`text-[10px] ${isDark ? "text-white/40" : "text-gray-500"}`}>{label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Suggested line */}
                <div className={`rounded-xl border p-4 ${
                  isDark ? "bg-[oklch(0.25_0.06_145)] border-white/10" : "bg-white border-[#3D6B47]/12 shadow-sm"
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    <BookOpen className={`w-4 h-4 ${isDark ? "text-[oklch(0.65_0.14_145)]" : "text-[#3D6B47]"}`} />
                    <p className={`text-xs font-bold uppercase tracking-wider ${isDark ? "text-[oklch(0.65_0.14_145)]" : "text-[#3D6B47]"}`}>Suggested Prep</p>
                  </div>
                  <p className={`text-sm font-mono ${isDark ? "text-white/70" : "text-gray-700"}`}>
                    1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.e4 d6 5.Nf3 O-O 6.Be2 e5
                  </p>
                  <p className={`text-xs mt-1.5 ${isDark ? "text-white/35" : "text-gray-400"}`}>
                    King's Indian Defense — Classical Variation
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right — text content */}
          <div className={`transition-all duration-700 delay-200 ${inView ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"}`}>
            <p className={`text-xs font-semibold tracking-widest uppercase mb-4 ${inView ? "animate-badge-pop" : "opacity-0"} ${isDark ? "text-[oklch(0.65_0.14_145)]" : "text-[#3D6B47]"}`}
              style={{ animationFillMode: "forwards" }}>
              Chess Club Chess League
            </p>
            <h2 className={`text-4xl lg:text-5xl font-semibold tracking-tight mb-6 text-foreground ${inView ? "animate-fade-up-soft" : "opacity-0"}`}
              style={{ fontFamily: "'Clash Display', sans-serif", animationDelay: "120ms", animationFillMode: "forwards" }}>
              Prep like the
              <br />
              pros do.
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Professional chess players spend hours studying their opponents before every tournament round. The Chess Club Chess League brings that same preparation edge to your local club.
            </p>
            <p className="text-muted-foreground leading-relaxed mb-8">
              Using the chess.com API, we pull your club members' game history, analyze their opening choices, tactical patterns, and weaknesses — then generate strategic preparation lines tailored to your next matchup. It's like having a personal coach for every round.
            </p>

            <div className="space-y-4 mb-8">
              {steps.map((step, idx) => (
                <div
                  key={step.title}
                  className={`flex items-start gap-3 ${inView ? "animate-check-reveal" : "opacity-0"}`}
                  style={{ animationDelay: `${400 + idx * 100}ms`, animationFillMode: "forwards" }}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    isDark ? "bg-[oklch(0.65_0.14_145)]/15 text-[oklch(0.65_0.14_145)]" : "bg-[#3D6B47]/08 text-[#3D6B47]"
                  }`}>
                    {step.icon}
                  </div>
                  <div>
                    <p className={`text-sm font-semibold mb-0.5 ${isDark ? "text-white" : "text-gray-900"}`}>{step.title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/clubs"
                className="btn-chess-primary flex items-center gap-2 inline-flex"
              >
                Explore Chess Leagues
                <ChevronRight className="w-4 h-4" />
              </Link>
              <Link
                href="/prep"
                className="btn-chess-secondary flex items-center gap-2 inline-flex"
              >
                Try Matchup Prep
                <Target className="w-4 h-4" />
              </Link>
            </div>
          </div>
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
  const { status, profile, error: lookupError, lookup, reset } = useChessComProfile();
  const loading = status === "loading";

  const handleLookup = () => {
    if (!username.trim()) return;
    lookup(username.trim());
  };

  return (
    <section
      id="player-demo"
      className={`py-24 transition-colors duration-500 ${isDark ? "bg-[oklch(0.23_0.07_145)]" : "bg-[#F0F5EE]"}`}
      ref={ref}
    >
      <div className="container">
        <div className="max-w-2xl mx-auto text-center mb-12">
          <p className={`text-xs font-semibold tracking-widest uppercase mb-3 ${isDark ? "text-[oklch(0.65_0.14_145)]" : "text-[#3D6B47]"}`}>
            chess.com Integration
          </p>
          <h2 className="text-4xl font-semibold tracking-tight mb-4 text-foreground" style={{ fontFamily: "'Clash Display', sans-serif" }}>
            Seamless User Onboarding
          </h2>
          <p className="text-muted-foreground">
            Enter a chess.com username below to see how player registration works. Try{" "}
            <code className={`px-1.5 py-0.5 rounded text-xs border ${isDark ? "bg-[oklch(0.28_0.08_145)] text-[oklch(0.65_0.14_145)] border-white/10" : "bg-white text-[#3D6B47] border-[#EEEED2]"}`}>hikaru</code>{" "}
            or{" "}
            <code className={`px-1.5 py-0.5 rounded text-xs border ${isDark ? "bg-[oklch(0.28_0.08_145)] text-[oklch(0.65_0.14_145)] border-white/10" : "bg-white text-[#3D6B47] border-[#EEEED2]"}`}>gothamchess</code>.
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
                className={`flex-1 px-4 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3D6B47]/30 focus:border-[#3D6B47] transition-all ${
                  isDark
                    ? "bg-[oklch(0.22_0.06_145)] border-white/10 text-white placeholder:text-white/30"
                    : "bg-[#F0F5EE]/50 border-[#EEEED2] text-[#1A1A1A]"
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

            {/* Profile card */}
            {profile && status === "success" && (
              <div className={`border rounded-xl p-4 animate-fade-in-up ${isDark ? "border-white/10 bg-[oklch(0.22_0.06_145)]" : "border-[#EEEED2] bg-[#F0F5EE]/50"}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {profile.avatar ? (
                      <img src={profile.avatar} alt={profile.username} className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <div className="w-10 h-10 bg-[#3D6B47] rounded-full flex items-center justify-center text-white font-bold text-sm">
                        {profile.username[0].toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-foreground text-sm">{profile.name || profile.username}</p>
                        {profile.title && (
                          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${isDark ? "text-[oklch(0.65_0.14_145)] bg-[oklch(0.65_0.14_145)]/15" : "text-[#3D6B47] bg-[#3D6B47]/10"}`}>
                            {profile.title}
                          </span>
                        )}
                        {profile.countryFlag && <span className="text-base">{profile.countryFlag}</span>}
                      </div>
                      <p className="text-xs text-muted-foreground">chess.com verified · Live data</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-2xl font-bold ${isDark ? "text-[oklch(0.65_0.14_145)]" : "text-[#3D6B47]"}`}
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      {profile.rapid || profile.blitz || profile.bullet || "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">Rapid ELO</p>
                  </div>
                </div>
                {(profile.blitz > 0 || profile.bullet > 0) && (
                  <div className={`mt-3 pt-3 border-t flex gap-4 ${isDark ? "border-white/10" : "border-[#EEEED2]"}`}>
                    {profile.blitz > 0 && (
                      <div className="text-center flex-1">
                        <p className="text-sm font-bold text-foreground">{profile.blitz}</p>
                        <p className="text-xs text-muted-foreground">Blitz</p>
                      </div>
                    )}
                    {profile.bullet > 0 && (
                      <div className="text-center flex-1">
                        <p className="text-sm font-bold text-foreground">{profile.bullet}</p>
                        <p className="text-xs text-muted-foreground">Bullet</p>
                      </div>
                    )}
                  </div>
                )}
                <div className={`mt-3 pt-3 border-t ${isDark ? "border-white/10" : "border-[#EEEED2]"}`}>
                  <button
                    onClick={() => toast.success(`${profile.username} added to tournament!`)}
                    className="w-full btn-chess-primary text-sm py-2"
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
    <section id="testimonials" className="py-24 transition-colors duration-500 bg-background" ref={ref}>
      <div className="container">
        <div className="text-center mb-16">
          <p className={`text-xs font-semibold tracking-widest uppercase mb-3 ${inView ? "animate-badge-pop" : "opacity-0"} ${isDark ? "text-[oklch(0.65_0.14_145)]" : "text-[#3D6B47]"}`}
            style={{ animationFillMode: "forwards" }}>
            From the Community
          </p>
          <h2 className={`text-4xl font-semibold tracking-tight text-foreground ${inView ? "animate-fade-up-soft" : "opacity-0"}`}
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
                  <Star key={j} className={`w-4 h-4 ${isDark ? "fill-[oklch(0.65_0.14_145)] text-[oklch(0.65_0.14_145)]" : "fill-[#3D6B47] text-[#3D6B47]"}`} />
                ))}
              </div>
              <p className="text-muted-foreground text-sm leading-relaxed mb-6 italic">"{t.quote}"</p>
              <div className={`flex items-center justify-between pt-4 border-t ${isDark ? "border-white/10" : "border-[#F0F5EE]"}`}>
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
    <section className="py-28 bg-[#3D6B47] relative overflow-hidden" ref={ref}>
      <div className="absolute inset-0 chess-board-bg opacity-10 pointer-events-none" />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at 50% 50%, oklch(0.55 0.18 145 / 0.18) 0%, transparent 65%)",
        }}
      />

      <div className="container relative z-10">
        <div
          className={`max-w-2xl mx-auto text-center ${inView ? "animate-fade-up-soft" : "opacity-0"}`}
          style={{ animationFillMode: "forwards" }}
        >
          <h2
            className="text-4xl lg:text-5xl font-semibold text-white tracking-tight mb-5"
            style={{ fontFamily: "'Clash Display', sans-serif" }}
          >
            Your next tournament
            <br />
            starts here.
          </h2>
          <p className="text-white/75 text-lg mb-10">
            Free for clubs with up to 62 players. No credit card required.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={onCreateTournament}
              className="bg-white text-[#3D6B47] font-semibold text-sm px-8 py-3 rounded-md hover:bg-[#EEEED2] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
            >
              Create Free Tournament
            </button>
            <SpinBorderButton
              variant="glass"
              onClick={() => window.location.href = "/tournament/otb-demo-2026/manage"}
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
    Product: [
      { label: "Features", href: "/#features" },
      { label: "How It Works", href: "/#how-it-works" },
      { label: "Demo", href: "/tournament/otb-demo-2026/manage" },
    ],
    Community: [
      { label: "Join a Tournament", href: "/join" },
      { label: "Discord", href: "https://discord.gg" },
      { label: "Twitter", href: "https://twitter.com" },
      { label: "chess.com", href: "https://chess.com" },
    ],
    Company: [
      { label: "About", href: "/#how-it-works" },
      { label: "Contact", href: "mailto:info@chessotb.club" },
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
    ],
  };

  return (
    <footer className="bg-[#1A1A1A] text-white py-16" style={{ paddingBottom: "max(4rem, calc(4rem + env(safe-area-inset-bottom, 0px)))" }}>
      <div className="container">
        <div className="grid md:grid-cols-4 gap-10 mb-12">
          <div>
            <div className="flex items-center gap-1 mb-4">
              <img
                src="https://files.manuscdn.com/user_upload_by_module/session_file/117675823/bWANpVvGVfpfXSpZ.png"
                alt="OTB Chess"
                className="h-9 w-auto object-contain drop-shadow-[0_0_6px_rgba(100,200,100,0.2)]"
              />
            </div>
            <p className="text-sm text-white/50 leading-relaxed">
              Over The Board. Built for chess clubs that take the game seriously.
            </p>
          </div>

          {Object.entries(links).map(([category, items]) => (
            <div key={category}>
              <p className="text-xs font-semibold tracking-widest uppercase text-white/40 mb-4">{category}</p>
              <ul className="space-y-2.5">
                {items.map((item) => (
                  <li key={item.label}>
                    <a
                      href={item.href}
                      className="text-sm text-white/60 hover:text-white transition-colors"
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
          <p className="text-xs text-white/30">© 2026 OTB Chess. All rights reserved.</p>
          <p className="text-xs text-white/30">Powered by chess.com API · Not affiliated with chess.com</p>
        </div>
      </div>
    </footer>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Home() {
  const [wizardOpen, setWizardOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { user, logout } = useAuthContext();
  // Active tab state — synced with AnimeNavBar via IntersectionObserver
  const [activeNavTab, setActiveNavTab] = useState("Tournaments");

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
    { name: "Tournaments", url: getDashboardUrl(), icon: LayoutDashboard, dropdown: <DashboardDropdown />, onClick: (e: React.MouseEvent) => { e.preventDefault(); window.location.href = getDashboardUrl(); } },
    { name: "Clubs", url: "/clubs", icon: Building2, sectionId: "for-clubs" },
    { name: "Battle", url: "/battle", icon: Swords },
    { name: "Analyze", url: "/record", icon: Video, sectionId: "how-it-works" },
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

  const rightSlotEl = (
    <AvatarNavDropdown
      currentPage={activeNavTab}
      onSignInClick={() => setAuthOpen(true)}
      dashboardUrl={getDashboardUrl()}
    />
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
      <Showcase />
      <PlayerDemo />
      <Testimonials />
      <CTASection onCreateTournament={() => setWizardOpen(true)} />
      <Footer />
      <TournamentWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />
      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} isDark={isDark} />


    </div>
  );
}
