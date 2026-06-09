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
  Target,
  BookOpen,
  Search,
  TrendingUp,
  Brain,
  Maximize2,
  Link2,
  GraduationCap,
  Timer,
  Star as StarIcon,
} from "lucide-react";
import { AnimeNavBar } from "@/components/ui/anime-navbar";
import {AvatarNavDropdown} from "@/components/AvatarNavDropdown";
import { HoverBorderGradient } from "@/components/ui/hover-border-gradient";
import { SpinBorderButton } from "@/components/ui/spin-border-button";
import { GlassButton } from "@/components/ui/apple-tahoe-liquid-glass-button";

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
    <section className={`relative min-h-screen flex items-center overflow-hidden pt-28 sm:pt-24 md:pt-16 transition-colors duration-500 ${isDark ? "bg-[oklch(0.20_0.06_145)]" : "bg-[#F5F8F5]"}`}>
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

      <div className="container relative z-10">
        <div className="max-w-3xl mx-auto text-center py-24 lg:py-32">
          <div className="opacity-0-init animate-fade-in-up flex justify-center mb-8" style={{ animationDelay: "0.1s", animationFillMode: "forwards" }}>
            <HoverBorderGradient
              as="span"
              containerClassName={isDark ? "bg-[oklch(0.18_0.05_145)]" : "bg-[#EEF5EE]"}
              className={`text-[11px] font-semibold tracking-[0.18em] uppercase leading-none ${
                isDark ? "text-white/75 bg-[oklch(0.18_0.05_145)]" : "text-[#3D6B47] bg-[#EEF5EE]"
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

          {/* SEO H2 — visually styled as a subtitle, semantically an H2 for crawlers */}
          <h2
            className="opacity-0-init animate-fade-in-up text-base sm:text-lg leading-relaxed mb-8 sm:mb-10 max-w-xl mx-auto text-muted-foreground px-2 sm:px-0"
            style={{ animationDelay: "0.35s", animationFillMode: "forwards", fontWeight: 400 }}
          >
            <span className="sm:hidden">Players sign up with their chess.com username — we generate optimal pairings automatically.</span>
            <span className="hidden sm:inline">Players sign up with their chess.com username — we generate optimal pairings automatically.</span>
          </h2>

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
              { icon: <Link2 className="w-3.5 h-3.5" />, label: "Chess.com" },
              { icon: <Globe className="w-3.5 h-3.5" />, label: "Lichess" },
              { icon: <Swords className="w-3.5 h-3.5" />, label: "TakeTakeTake" },
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

// ─── iPhone Mockup Frame ────────────────────────────────────────────────────
function IPhoneMockup({ src, alt, isDark }: { src: string; alt: string; isDark: boolean }) {
  return (
    <div
      className="relative mx-auto select-none"
      style={{ width: 320, height: 650 }}
    >
      {/* Side buttons — left */}
      <div className="absolute left-[-3px] top-[140px] w-[3px] h-[40px] rounded-l-sm z-20" style={{ background: "#2a2a2a" }} />
      <div className="absolute left-[-3px] top-[195px] w-[3px] h-[64px] rounded-l-sm z-20" style={{ background: "#2a2a2a" }} />
      <div className="absolute left-[-3px] top-[275px] w-[3px] h-[64px] rounded-l-sm z-20" style={{ background: "#2a2a2a" }} />
      {/* Side button — right */}
      <div className="absolute right-[-3px] top-[205px] w-[3px] h-[90px] rounded-r-sm z-20" style={{ background: "#2a2a2a" }} />

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
          className="absolute inset-0 w-full h-full object-cover object-top"
          loading="lazy"
        />

        {/* Dynamic island notch — overlaid on top of screenshot */}
        <div
          className="absolute left-1/2 -translate-x-1/2"
          style={{ top: 12, width: 120, height: 32, background: "#000", borderRadius: 20, zIndex: 10 }}
        />

        {/* Status bar overlay */}
        <div
          className="absolute top-0 left-0 right-0 flex items-start justify-between px-5"
          style={{ paddingTop: 10, zIndex: 11, background: "linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, transparent 100%)" }}
        >
          <span className="text-white text-[10px] font-semibold" style={{ paddingTop: 2 }}>9:41</span>
          <div className="flex items-center gap-1" style={{ paddingTop: 2 }}>
            {/* Signal bars */}
            <svg width="14" height="10" viewBox="0 0 14 10" fill="white">
              <rect x="0" y="3" width="2" height="7" rx="0.5" opacity="0.9"/>
              <rect x="3" y="2" width="2" height="8" rx="0.5" opacity="0.9"/>
              <rect x="6" y="1" width="2" height="9" rx="0.5" opacity="0.9"/>
              <rect x="9" y="0" width="2" height="10" rx="0.5" opacity="0.9"/>
            </svg>
            {/* WiFi */}
            <svg width="12" height="9" viewBox="0 0 12 9" fill="white" opacity="0.9">
              <path d="M6 7.5a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm0-2.5c1.1 0 2.1.4 2.8 1.1l1-1A5.5 5.5 0 0 0 6 3.5a5.5 5.5 0 0 0-3.8 1.6l1 1A3.5 3.5 0 0 1 6 5zm0-3C7.9 2 9.6 2.8 10.8 4l1-1A7.5 7.5 0 0 0 6 1 7.5 7.5 0 0 0 1.2 3l1 1A5.5 5.5 0 0 1 6 2z"/>
            </svg>
            {/* Battery */}
            <svg width="20" height="10" viewBox="0 0 20 10" fill="none">
              <rect x="0.5" y="0.5" width="16" height="9" rx="2.5" stroke="white" strokeOpacity="0.4"/>
              <rect x="1.5" y="1.5" width="12" height="7" rx="1.5" fill="white"/>
              <path d="M18 3.5V6.5C18.8 6.2 19.5 5.7 19.5 5C19.5 4.3 18.8 3.8 18 3.5Z" fill="white" fillOpacity="0.4"/>
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Parallax Step Block ─────────────────────────────────────────────────────
function ParallaxStep({
  number,
  icon,
  title,
  description,
  imageSrc,
  imageAlt,
  phoneLeft,
  isDark,
  mockupType,
}: {
  number: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  imageSrc: string;
  imageAlt: string;
  phoneLeft: boolean;
  isDark: boolean;
  mockupType?: 'phone' | 'macbook';
}) {
  const { ref, inView } = useInView(0.2);
  const accentColor = isDark ? "text-[oklch(0.65_0.14_145)]" : "text-[#3D6B47]";
  const accentBg = isDark ? "bg-[oklch(0.65_0.14_145)]/15" : "bg-[#3D6B47]/10";

  // MacBook step: side-by-side layout, mockup capped at 480px
  if (mockupType === 'macbook') {
    return (
      <div
        ref={ref}
        className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20 py-20 lg:py-28"
      >
        {/* MacBook mockup — left, bigger and wider */}
        <div
          className={`flex-[1.6] flex justify-center lg:justify-end transition-all duration-700 ease-out ${
            inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
          }`}
          style={{ transitionDelay: "0ms" }}
        >
          <div
            className="w-full transition-all duration-700 ease-out"
            style={{
              maxWidth: 640,
              transform: inView ? "none" : "translateX(-40px)",
              transitionDelay: "60ms",
            }}
          >
            <MacBookMockup src={imageSrc} alt={imageAlt} isDark={isDark} />
          </div>
        </div>

        {/* Text content — right */}
        <div
          className={`flex-1 max-w-md transition-all duration-700 ease-out ${
            inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
          style={{ transitionDelay: "150ms" }}
        >
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold tracking-wider uppercase mb-6 ${accentBg} ${accentColor}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center ${accentColor} border border-current`}>
              {icon}
            </span>
            Step {number}
          </div>
          <div className="relative">
            <span
              className={`absolute -top-8 -left-2 text-[120px] font-black leading-none select-none pointer-events-none ${
                isDark ? "text-white/[0.09]" : "text-black/[0.07]"
              }`}
              style={{ fontFamily: "'Clash Display', sans-serif" }}
            >
              {number}
            </span>
            <h3
              className="relative text-3xl lg:text-4xl font-bold text-foreground mb-4 leading-tight"
              style={{ fontFamily: "'Clash Display', sans-serif" }}
            >
              {title}
            </h3>
          </div>
          <p className="text-muted-foreground text-lg leading-relaxed mb-8">{description}</p>
          <div className={`w-12 h-1 rounded-full ${isDark ? "bg-[oklch(0.65_0.14_145)]" : "bg-[#3D6B47]"}`} />
        </div>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className={`flex flex-col ${
        phoneLeft ? "lg:flex-row" : "lg:flex-row-reverse"
      } items-center gap-12 lg:gap-20 py-20 lg:py-28`}
    >
      {/* Phone mockup */}
      <div
        className="flex-1 flex justify-center lg:justify-end transition-all duration-700 ease-out"
        style={{ transitionDelay: "0ms" }}
      >
        <div
          className="transition-all duration-700 ease-out"
          style={{
            transform: inView ? "none" : `translateX(${phoneLeft ? "-40px" : "40px"})`,
            transitionDelay: "60ms",
            opacity: inView ? 1 : 0,
          }}
        >
          <IPhoneMockup src={imageSrc} alt={imageAlt} isDark={isDark} />
        </div>
      </div>

      {/* Text content */}
      <div
        className={`flex-1 max-w-md transition-all duration-700 ease-out ${
          inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        }`}
        style={{ transitionDelay: "150ms" }}
      >
        {/* Step badge */}
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold tracking-wider uppercase mb-6 ${accentBg} ${accentColor}`}>
          <span className={`w-5 h-5 rounded-full flex items-center justify-center ${accentColor} border border-current`}>
            {icon}
          </span>
          Step {number}
        </div>

        {/* Step number watermark */}
        <div className="relative">
          <span
            className={`absolute -top-8 -left-2 text-[120px] font-black leading-none select-none pointer-events-none ${
              isDark ? "text-white/[0.09]" : "text-black/[0.07]"
            }`}
            style={{ fontFamily: "'Clash Display', sans-serif" }}
          >
            {number}
          </span>
          <h3
            className="relative text-3xl lg:text-4xl font-bold text-foreground mb-4 leading-tight"
            style={{ fontFamily: "'Clash Display', sans-serif" }}
          >
            {title}
          </h3>
        </div>

        <p className="text-muted-foreground text-lg leading-relaxed mb-8">
          {description}
        </p>

        {/* Divider accent */}
        <div className={`w-12 h-1 rounded-full ${isDark ? "bg-[oklch(0.65_0.14_145)]" : "bg-[#3D6B47]"}`} />
      </div>
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
      imageSrc: "/manus-storage/otb-join-form_28254c54.webp",
      imageAlt: "Player join form with chess.com username lookup",
      phoneLeft: false,
    },
    {
      number: "03",
      icon: <Swords className="w-3 h-3" />,
      title: "Optimal Pairings Generated",
      description: "Our algorithm creates balanced, fair pairings based on ELO. No manual work. Standings update live as results come in.",
      imageSrc: "/manus-storage/otb-board-pairings_41832e9e.webp",
      imageAlt: "Board pairings screen showing matchups",
      phoneLeft: true,
    },
  ];

  return (
    <section id="how-it-works" className={`transition-colors duration-500 ${
      isDark ? "bg-background" : "bg-background"
    }`}>
      {/* Section header */}
      <div className="container pt-24 pb-4">
        <div className="text-center">
          <p className={`text-xs font-semibold tracking-widest uppercase mb-4 ${
            isDark ? "text-[oklch(0.65_0.14_145)]" : "text-[#3D6B47]"
          }`}>
            Simple Process
          </p>
          <h2
            className="text-4xl lg:text-5xl font-bold tracking-tight text-foreground"
            style={{ fontFamily: "'Clash Display', sans-serif" }}
          >
            3 Simple Steps to Launch
          </h2>
          <p className="mt-4 text-muted-foreground text-lg max-w-xl mx-auto">
            Create Tournament, Share QR Code, Automate Pairings!
          </p>
        </div>
      </div>

      {/* Divider */}
      <div className="container">
        <div className={`h-px w-full mt-12 ${
          isDark ? "bg-white/[0.06]" : "bg-gray-100"
        }`} />
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
            imageSrc={step.imageSrc}
            imageAlt={step.imageAlt}
            phoneLeft={step.phoneLeft}
            isDark={isDark}
            mockupType={step.mockupType}
          />
        ))}
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
    { icon: <Shield className="w-5 h-5" />, title: "Club Management", description: "Build your club community. Manage rosters, post events, run polls, and track member ELO history — all in one place.", tag: "For Clubs", href: "/clubs", tooltip: "Manage your club roster, events & ELO history" },
    { icon: <BookOpen className="w-5 h-5" />, title: "Openings & Repertoire", description: "Study 18+ openings with interactive chessboards, expert coaching notes, and spaced-repetition drills — built for OTB club players.", tag: "Training", href: "/repertoire", tooltip: "Study openings with interactive boards & drills" },
    { icon: <Brain className="w-5 h-5" />, title: "Scout Report & Matchup Prep", description: "AI-powered opponent scouting. Analyze your next round opponent's openings, problem lines, and exact blunder patterns before you sit down.", tag: "AI-Powered", href: "/prep", tooltip: "Enter a username to generate a full scout report" },
    { icon: <Trophy className="w-5 h-5" />, title: "Chess Club League", description: "Incentivize club members to show up weekly for Club League Matchup Games.", tag: "Club Feature", href: "/league-demo", tooltip: "See a live demo of weekly club league matchups" },
    { icon: <BarChart3 className="w-5 h-5" />, title: "Live Standings & Results", description: "Real-time leaderboard updates as results come in. Shareable public link for spectators, players, and club members.", tag: "Real-Time", href: "/tournaments", tooltip: "Browse live and past tournament standings" },
    { icon: <Globe className="w-5 h-5" />, title: "Automated Shareable Content", description: "Auto-generate tournament recap posts, player cards, and standings graphics ready to share on Instagram or WhatsApp.", tag: "Share-Ready", tooltip: "Coming soon — auto-generated recap graphics" },
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
          {features.map((feature, i) => {
            const cardContent = (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isDark ? "bg-white/10 text-[oklch(0.65_0.14_145)]" : "bg-[#3D6B47]/08 text-[#3D6B47]"}`}>
                    {feature.icon}
                  </div>
                  <span className="tag-elo">{feature.tag}</span>
                </div>
                <h3 className="text-base font-semibold text-foreground mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                {(feature as { href?: string }).href && (
                  <p className={`text-xs font-semibold mt-3 ${isDark ? "text-[oklch(0.65_0.14_145)]" : "text-[#3D6B47]"}`}>View feature →</p>
                )}
              </>
            );
            const f = feature as { href?: string; tooltip?: string };
            const cls = `card-chess p-6 transition-all duration-500 relative group ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"} ${
              f.href ? "cursor-pointer hover:scale-[1.02] hover:shadow-lg" : ""
            }`;
            const style = { transitionDelay: `${(i + 1) * 80}ms` };
            const tooltipEl = f.tooltip ? (
              <span
                className={`pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium shadow-lg
                  opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-20
                  ${isDark ? "bg-[oklch(0.18_0.06_145)] text-[oklch(0.85_0.10_145)] border border-white/10" : "bg-[#1a2e1a] text-white"}`}
              >
                {f.tooltip}
              </span>
            ) : null;
            return f.href ? (
              <a
                key={feature.title}
                href={f.href}
                className={cls}
                style={style}
              >
                {tooltipEl}
                {cardContent}
              </a>
            ) : (
              <div
                key={feature.title}
                className={cls}
                style={style}
              >
                {tooltipEl}
                {cardContent}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
// ─── Features CTA Banner ─────────────────────────────────────────────────────

// ─── Features Carousel — Chess Club League + Matchup Prep ───────────────────
// Per-slide accent colors: [light mode hex, dark mode oklch]
const SLIDE_COLORS: Array<{ light: string; dark: string }> = [
  { light: "rgba(61,107,71,0.18)",  dark: "rgba(34,197,94,0.18)"  }, // tournaments — forest green
  { light: "rgba(37,99,235,0.16)",  dark: "rgba(96,165,250,0.18)" }, // league — blue
  { light: "rgba(217,119,6,0.16)",  dark: "rgba(251,191,36,0.18)" }, // rated game — amber
  { light: "rgba(124,58,237,0.16)", dark: "rgba(167,139,250,0.18)" }, // prep — violet
];

const CAROUSEL_SLIDES = [
  {
    id: "tournaments",
    badge: "Swiss + Elim Format",
    badgeIcon: <Trophy className="w-3.5 h-3.5" />,
    headline: "Run a tournament.\nNot a spreadsheet.",
    sub: "Swiss pairings, live standings, and elimination brackets — all from one director dashboard. Players join with their chess.com username. No accounts, no friction.",
    bullets: [
      { icon: <Zap className="w-4 h-4" />, text: "Swiss rounds → elimination bracket in one seamless flow" },
      { icon: <TrendingUp className="w-4 h-4" />, text: "Live standings with Buchholz tiebreaks, updated instantly" },
      { icon: <Users className="w-4 h-4" />, text: "Players join via chess.com username — ratings auto-imported" },
    ],
    cta: { label: "Host a Tournament", href: "/?action=create" },
    ctaSecondary: null,
    screenshot: "https://d2xsxph8kpxj0f.cloudfront.net/117675823/J6FsDoRMH9x5xbUvpyzxyf/tournament-director_3b1b3c41.png",
    screenshotAlt: "Swiss Tournament Director Dashboard — Round 5 Pairings",
  },
  {
    id: "league",
    badge: "Chess Club League",
    badgeIcon: <Swords className="w-3.5 h-3.5" />,
    headline: "Your club.\nA real season.",
    sub: "Weekly matchups, live standings, and a season champion. Powered by chess.com — members link their username once and their rating follows them all season.",
    bullets: [
      { icon: <Trophy className="w-4 h-4" />, text: "Fantasy-style weekly matchups between club members" },
      { icon: <BarChart3 className="w-4 h-4" />, text: "Live standings, form guides, and head-to-head records" },
      { icon: <Link2 className="w-4 h-4" />, text: "chess.com integration — ratings & avatars auto-synced" },
    ],
    cta: { label: "Explore Chess Leagues", href: "/league-demo" },
    ctaSecondary: null,
    screenshot: "https://d2xsxph8kpxj0f.cloudfront.net/117675823/J6FsDoRMH9x5xbUvpyzxyf/league-tight_ca26e3fd.png",
    screenshotAlt: "Chess Club League Dashboard",
    screenshotAspectRatio: "2318/1165",
    screenshotObjectFit: "contain" as const,
  },
  {
    id: "rated-game",
    badge: "OTB Rated Games",
    badgeIcon: <Trophy className="w-3.5 h-3.5" />,
    headline: "Play rated.\nEarn your OTB ELO.",
    sub: "Register a rated game on the chess clock, share a QR code with your opponent, and your OTB Elo updates automatically when the game ends — no arbiter required.",
    bullets: [
      { icon: <Timer className="w-4 h-4" />, text: "Built into the clock — register a rated game in seconds" },
      { icon: <StarIcon className="w-4 h-4" />, text: "Earn a real OTB Blitz and Rapid Elo, tracked over time" },
      { icon: <TrendingUp className="w-4 h-4" />, text: "Leaderboard, W/L/D record, and rating history on your profile" },
    ],
    cta: { label: "Play a Rated Game", href: "/clock?register=true" },
    ctaSecondary: null,
    screenshot: "/manus-storage/otb-rated-game-carousel_ed800e01.webp",
    screenshotAlt: "OTB Rated Game — Register modal with QR code on chess clock",
  },
  {
    id: "prep",
    badge: "Matchup Prep",
    badgeIcon: <Search className="w-3.5 h-3.5" />,
    headline: "Know your opponent\nbefore move one.",
    sub: "Enter any chess.com username. Get opening tendencies, problem lines, exact blunder patterns, and AI-generated coaching insights — ready before you sit down at the board.",
    bullets: [
      { icon: <Search className="w-4 h-4" />, text: "Scout openings, tendencies, and weaknesses instantly" },
      { icon: <Target className="w-4 h-4" />, text: "Problem Lines: exact moves where they usually go wrong" },
      { icon: <Brain className="w-4 h-4" />, text: "Deep scout report: line depth, recurring mistakes, repertoire consistency" },
    ],
    cta: { label: "Try Matchup Prep", href: "/prep" },
    ctaSecondary: null,
    screenshot: "https://files.manuscdn.com/user_upload_by_module/session_file/117675823/ldjNZgAdszCUXLEl.webp",
    screenshotAlt: "Matchup Prep — Scout Report showing hikaru's weaknesses and game plan",
  },
];

function Showcase() {
  const { ref, inView } = useInView();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [activeSlide, setActiveSlide] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [progressKey, setProgressKey] = useState(0); // bump to restart CSS animation
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [lightboxAlt, setLightboxAlt] = useState("");
  const slide = CAROUSEL_SLIDES[activeSlide];

  // Close lightbox on Escape key
  useEffect(() => {
    if (!lightboxSrc) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setLightboxSrc(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxSrc]);

  // Auto-advance every 6 seconds; pause on hover
  useEffect(() => {
    if (isHovered) return;
    const timer = setInterval(() => {
      setActiveSlide(prev => (prev + 1) % CAROUSEL_SLIDES.length);
      setProgressKey(k => k + 1);
    }, 6000);
    return () => clearInterval(timer);
  }, [isHovered]);

  // Reset progress bar when slide changes manually
  const goToSlide = (i: number) => {
    setActiveSlide(i);
    setProgressKey(k => k + 1);
  };

  const accentText = isDark ? "text-[oklch(0.65_0.14_145)]" : "text-[#3D6B47]";
  const _accentBg   = isDark ? "bg-[oklch(0.65_0.14_145)]/15 text-[oklch(0.65_0.14_145)]" : "bg-[#3D6B47]/10 text-[#3D6B47]";
  const slideGlassColor = isDark
    ? SLIDE_COLORS[activeSlide]?.dark
    : SLIDE_COLORS[activeSlide]?.light;

  return (
    <section id="for-clubs" className="py-24 overflow-hidden transition-colors duration-500 bg-background" ref={ref}>
      <div className="container">

        {/* ── Slide selector tabs ── */}
        <div className={`flex justify-center mb-14 ${inView ? "animate-fade-up-soft" : "opacity-0"}`} style={{ animationFillMode: "forwards" }}>
          <div className={`inline-flex rounded-2xl p-1.5 gap-1 ${
            isDark ? "bg-[oklch(0.18_0.06_145)] border border-white/08" : "bg-[#F0F5EE] border border-[#3D6B47]/10"
          }`}>
            {CAROUSEL_SLIDES.map((s, i) => (
              <button
                key={s.id}
                onClick={() => goToSlide(i)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  activeSlide === i
                    ? isDark
                      ? "bg-[oklch(0.28_0.09_145)] text-white shadow-sm"
                      : "bg-white text-gray-900 shadow-sm"
                    : isDark
                      ? "text-white/40 hover:text-white/70"
                      : "text-gray-400 hover:text-gray-700"
                }`}
              >
                <span className={activeSlide === i ? accentText : ""}>{s.badgeIcon}</span>
                {s.badge}
              </button>
            ))}
          </div>
        </div>

        {/* ── Slide content ── */}
        <div
          key={slide.id}
          className="grid lg:grid-cols-2 gap-16 items-center"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >

          {/* Left — screenshot with chess-board backdrop */}
          <div className={`transition-all duration-700 ${inView ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-8"}`}>
            <div
              className={`relative rounded-2xl p-4 shadow-2xl ${
                isDark ? "bg-[oklch(0.18_0.06_145)]" : "bg-[#E8F0E9]"
              }`}
            >
              {/* Chess-board micro-grid backdrop */}
              <div className="absolute inset-0 rounded-2xl chess-board-bg opacity-25 pointer-events-none" />
              {/* Subtle inner glow border */}
              <div className={`absolute inset-0 rounded-2xl pointer-events-none ${
                isDark
                  ? "ring-1 ring-inset ring-[oklch(0.65_0.14_145)]/20"
                  : "ring-1 ring-inset ring-[#3D6B47]/15"
              }`} />
              {/* Screenshot — fills frame; per-slide objectFit override for wide images; click to expand */}
              <div
                className="relative rounded-xl overflow-hidden shadow-xl cursor-zoom-in group/img"
                style={{ aspectRatio: slide.screenshotAspectRatio ?? "16/10" }}
                onClick={() => { setLightboxSrc(slide.screenshot!); setLightboxAlt(slide.screenshotAlt); }}
              >
                <img
                  src={slide.screenshot!}
                  alt={slide.screenshotAlt}
                  className={`w-full h-full transition-transform duration-700 ease-out ${isHovered && !slide.screenshotObjectFit ? "scale-[1.06]" : "scale-100"}`}
                  style={{ objectFit: slide.screenshotObjectFit ?? "cover", objectPosition: "top" }}
                />
                {/* Subtle bottom fade */}
                <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
                {/* Expand hint — appears on hover */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity duration-200 pointer-events-none">
                  <div className="bg-black/50 backdrop-blur-sm rounded-full p-3">
                    <Maximize2 className="w-5 h-5 text-white" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right — text */}
          <div className={`transition-all duration-700 delay-200 ${inView ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"}`}>
            <p className={`text-xs font-semibold tracking-widest uppercase mb-4 ${accentText}`}>
              {slide.badge}
            </p>
            <h2
              className="text-4xl lg:text-5xl font-semibold tracking-tight mb-6 text-foreground"
              style={{ fontFamily: "'Clash Display', sans-serif", whiteSpace: "pre-line" }}
            >
              {slide.headline}
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-8 text-base">
              {slide.sub}
            </p>

            <div className="space-y-4 mb-10">
              {slide.bullets.map((b, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    isDark ? "bg-[oklch(0.65_0.14_145)]/15 text-[oklch(0.65_0.14_145)]" : "bg-[#3D6B47]/08 text-[#3D6B47]"
                  }`}>{b.icon}</div>
                  <p className="text-sm text-muted-foreground leading-relaxed pt-1.5">{b.text}</p>
                </div>
              ))}
            </div>

            <GlassButton
              size="default"
              onClick={() => window.location.href = slide.cta.href}
              className="text-white"
              glassColor={slideGlassColor}
              style={{ transition: "all 0.4s ease" }}
            >
              {slide.cta.label}
              <ChevronRight className="w-4 h-4" />
            </GlassButton>
          </div>
        </div>

        {/* ── Progress bar ── */}
        <div className="flex justify-center mt-10 mb-2">
          <div className={`relative w-48 h-0.5 rounded-full overflow-hidden ${
            isDark ? "bg-white/10" : "bg-gray-200"
          }`}>
            <div
              key={progressKey}
              className={`absolute inset-y-0 left-0 rounded-full ${
                isDark ? "bg-[oklch(0.65_0.14_145)]" : "bg-[#3D6B47]"
              } ${isHovered ? "[animation-play-state:paused]" : "[animation-play-state:running]"}`}
              style={{
                animation: "carousel-progress 6s linear forwards",
              }}
            />
          </div>
        </div>

        {/* ── Dot indicators ── */}
        <div className="flex justify-center gap-2 mt-3">
          {CAROUSEL_SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => goToSlide(i)}
              className={`rounded-full transition-all duration-300 ${
                activeSlide === i
                  ? `w-6 h-2 ${isDark ? "bg-[oklch(0.65_0.14_145)]" : "bg-[#3D6B47]"}`
                  : `w-2 h-2 ${isDark ? "bg-white/20 hover:bg-white/40" : "bg-gray-300 hover:bg-gray-400"}`
              }`}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>

      </div>

      {/* ── Lightbox modal ── */}
      {lightboxSrc && (
        // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 md:p-8"
          onClick={() => setLightboxSrc(null)}
          onKeyDown={(e) => e.key === "Escape" && setLightboxSrc(null)}
          role="dialog"
          aria-modal="true"
          aria-label={lightboxAlt}
        >
          {/* Close button */}
          <button
            className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-full p-2.5 transition-colors duration-150 z-10"
            onClick={() => setLightboxSrc(null)}
            aria-label="Close image"
          >
            <X className="w-5 h-5 text-white" />
          </button>

          {/* Image — stop propagation so clicking image itself doesn't close */}
          <div
            className="relative max-w-5xl w-full max-h-[90vh] rounded-2xl overflow-hidden shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <img
              src={lightboxSrc}
              alt={lightboxAlt}
              className="w-full h-full object-contain"
            />
            {/* ESC hint */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-xs text-white/50 select-none">
              Press Esc or click outside to close
            </div>
          </div>
        </div>
      )}
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
      className={`py-24 transition-colors duration-500 relative overflow-hidden ${isDark ? "bg-[oklch(0.23_0.07_145)]" : "bg-[#F0F5EE]"}`}
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
          <p className={`text-xs font-semibold tracking-widest uppercase mb-3 ${isDark ? "text-[oklch(0.65_0.14_145)]" : "text-[#3D6B47]"}`}>
            chess.com Integration
          </p>
          <h2 className="text-4xl font-semibold tracking-tight mb-4 text-foreground" style={{ fontFamily: "'Clash Display', sans-serif" }}>
            Play Online,
            <br />
            Improve OTB.
          </h2>
          <p className="text-muted-foreground">
            Enter your chess.com username to see your OTB Profile. Try{" "}
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
                              style={{ background: isDark ? "oklch(0.65 0.14 145 / 0.18)" : "rgba(61,107,71,0.12)", color: isDark ? "oklch(0.75 0.14 145)" : "#3D6B47" }}
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
                      <div className="w-4 h-4 rounded-full border-2 animate-spin" style={{ borderColor: isDark ? "oklch(0.65 0.14 145 / 0.3)" : "#3D6B47", borderTopColor: isDark ? "oklch(0.65 0.14 145)" : "#3D6B47" }} />
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
                                  <span className="text-[11px] font-bold flex-shrink-0" style={{ fontFamily: "'JetBrains Mono', monospace", color: isDark ? "oklch(0.72 0.16 145)" : "#3D6B47" }}>{o.pct}%</span>
                                </div>
                                <div className="h-1 rounded-full overflow-hidden" style={{ background: isDark ? "oklch(0.28 0.07 145 / 0.6)" : "rgba(61,107,71,0.10)" }}>
                                  <div
                                    className="h-full rounded-full transition-all duration-700"
                                    style={{ width: `${o.pct}%`, background: isDark ? "linear-gradient(90deg, oklch(0.55 0.14 145), oklch(0.72 0.16 145))" : "linear-gradient(90deg, #3D6B47, #5a9e6a)" }}
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
                                  <span className="text-[11px] font-bold flex-shrink-0" style={{ fontFamily: "'JetBrains Mono', monospace", color: isDark ? "oklch(0.72 0.16 145)" : "#3D6B47" }}>{o.pct}%</span>
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
                            style={{ fontFamily: "'JetBrains Mono', monospace", color: isDark ? "oklch(0.72 0.16 145)" : "#3D6B47" }}
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
            Growing your chess club
            <br />
            starts here.
          </h2>
          <p className="text-white/75 text-lg mb-10">
            Free for chess club owners who sign up. No credit card required.
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
      { label: "Pricing", href: "/pricing" },
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
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { user } = useAuthContext();
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

  // SEO: set page title, description, and keywords on mount
  useEffect(() => {
    document.title = "ChessOTB.club — Chess Tournaments Over The Board";
    const desc = document.querySelector("meta[name='description']");
    if (desc) desc.setAttribute("content", "Host and manage over-the-board chess tournaments with Swiss pairings, live standings, and elimination brackets. Free for chess clubs.");
    let kw = document.querySelector("meta[name='keywords']");
    if (!kw) {
      kw = document.createElement("meta");
      kw.setAttribute("name", "keywords");
      document.head.appendChild(kw);
    }
    kw.setAttribute("content", "chess tournament, over the board chess, OTB chess, Swiss pairings, chess club tournament, chess bracket, chess standings, chess.com ELO");
    return () => { document.title = "ChessOTB.club"; };
  }, []);

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
    { name: "Training",    url: "/training",     icon: GraduationCap },
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
      leagueUrl={leagueNavUrl}
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
      <PlayerDemo />
      <Showcase />
      <Testimonials />
      <CTASection onCreateTournament={() => setWizardOpen(true)} />
      <Footer />
      <TournamentWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />
      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} isDark={isDark} />
      <ProUpgradeModal isOpen={upgradeOpen} onClose={() => setUpgradeOpen(false)} />


    </div>
  );
}
