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
import { ThemeToggle } from "@/components/ThemeToggle";
import { TournamentWizard } from "@/components/TournamentWizard";
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
} from "lucide-react";

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
function Nav({ onCreateTournament }: { onCreateTournament: () => void }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme } = useTheme();
  const isDark = theme === "dark";

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
        {/* Logo */}
        <a href="/" className="flex items-center gap-1 group">
          <img
            src="https://files.manuscdn.com/user_upload_by_module/session_file/117675823/bWANpVvGVfpfXSpZ.png"
            alt="OTB Chess"
            className={`nav-logo h-14 w-auto object-contain ${isDark ? "nav-logo-dark" : ""}`}
          />
        </a>

        {/* Desktop Links */}
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
          <Link href="/tournaments">
            <span
              className={`text-sm font-medium transition-colors duration-200 cursor-pointer ${
                isDark
                  ? "text-white/60 hover:text-white"
                  : "text-[#4B5563] hover:text-[#3D6B47]"
              }`}
            >
              Archive
            </span>
          </Link>
        </div>

        {/* CTA + Toggle */}
        <div className="hidden md:flex items-center gap-3">
          <ThemeToggle />
          <button
            onClick={onCreateTournament}
            className={`text-sm font-medium transition-colors ${
              isDark ? "text-white/70 hover:text-white" : "text-[#3D6B47] hover:text-[#2A4A32]"
            }`}
          >
            Sign In
          </button>
        </div>

        {/* Mobile: toggle + menu */}
        <div className="md:hidden flex items-center gap-2">
          <ThemeToggle />
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
          <button
            onClick={() => { onCreateTournament(); setMobileOpen(false); }}
            className={`block w-full text-left py-3 text-sm font-medium border-b last:border-0 ${
              isDark ? "text-white/70 border-white/08" : "text-[#4B5563] border-[#F0F5EE]"
            }`}
          >
            Sign In
          </button>
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
    <section className={`relative min-h-screen flex items-center overflow-hidden pt-16 transition-colors duration-500 ${isDark ? "bg-[oklch(0.20_0.06_145)]" : "bg-white"}`}>
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
          <div className="opacity-0-init animate-fade-in-up" style={{ animationDelay: "0.1s", animationFillMode: "forwards" }}>
            <span className={`inline-flex items-center text-xs font-semibold tracking-widest uppercase px-3 py-1.5 rounded-full border mb-8 ${
              isDark ? "border-white/20 text-white/70 bg-white/05" : "border-[#3D6B47]/30 text-[#3D6B47] bg-[#3D6B47]/06"
            }`}>
              For Chess Clubs & Communities
            </span>
          </div>

          <h1
            className="opacity-0-init animate-fade-in-up text-5xl lg:text-6xl xl:text-7xl font-semibold leading-[1.05] tracking-tight mb-6 text-foreground"
            style={{ fontFamily: "'Clash Display', sans-serif", animationDelay: "0.2s", animationFillMode: "forwards" }}
          >
            Chess Tournaments,
            <br />
            <span className={isDark ? "text-[oklch(0.65_0.14_145)]" : "text-[#3D6B47]"}>
              Over The Board.
            </span>
          </h1>

          <p
            className="opacity-0-init animate-fade-in-up text-lg leading-relaxed mb-10 max-w-xl mx-auto text-muted-foreground"
            style={{ animationDelay: "0.35s", animationFillMode: "forwards" }}
          >
            Set up a rated in-person tournament in minutes. Players sign up with their chess.com username — we pull their ELO and generate optimal pairings automatically.
          </p>

          <div
            className="opacity-0-init animate-fade-in-up flex flex-col sm:flex-row gap-3 justify-center"
            style={{ animationDelay: "0.45s", animationFillMode: "forwards" }}
          >
            <button
              onClick={onCreateTournament}
              className="btn-chess-primary flex items-center justify-center gap-2"
            >
              Host Tournament
              <ArrowRight className="w-4 h-4" />
            </button>
            <Link
              href="/join"
              className="btn-chess-secondary flex items-center justify-center gap-2"
            >
              Join
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div
            className="opacity-0-init animate-fade-in-up mt-3"
            style={{ animationDelay: "0.5s", animationFillMode: "forwards" }}
          >
            <Link
              href="/tournament/otb-demo-2026"
              className={`text-sm font-medium underline underline-offset-4 ${
                isDark ? "text-white/50 hover:text-white/80" : "text-[#4B5563] hover:text-[#3D6B47]"
              }`}
            >
              View live demo →
            </Link>
          </div>

          {/* Social proof */}
          <div
            className="opacity-0-init animate-fade-in-up mt-10 flex items-center justify-center gap-6"
            style={{ animationDelay: "0.55s", animationFillMode: "forwards" }}
          >
            <div className="flex -space-x-2">
              {["#3D6B47", "#769656", "#2A4A32", "#5A8A6A"].map((c, i) => (
                <div key={i} className="w-8 h-8 rounded-full border-2 border-background flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: c }}>
                  {["M", "A", "K", "R"][i]}
                </div>
              ))}
            </div>
            <div>
              <div className="flex items-center gap-1 mb-0.5">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className={`w-3.5 h-3.5 ${isDark ? "fill-[oklch(0.65_0.14_145)] text-[oklch(0.65_0.14_145)]" : "fill-[#3D6B47] text-[#3D6B47]"}`} />
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Trusted by <strong className="text-foreground">80+ chess clubs</strong> worldwide
              </p>
            </div>
          </div>

          {/* Quick-stat chips */}
          <div
            className="opacity-0-init animate-fade-in-up mt-14 flex flex-wrap justify-center gap-3"
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
  const { ref, inView } = useInView();
  const { theme } = useTheme();
  const isDark = theme === "dark";

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
    <section id="how-it-works" className="py-24 transition-colors duration-500 bg-background" ref={ref}>
      <div className="container">
        <div>
          {/* Steps column */}
          <div>
            <div className="mb-12">
              <p className={`text-xs font-semibold tracking-widest uppercase mb-3 ${inView ? "animate-badge-pop" : "opacity-0"} ${isDark ? "text-[oklch(0.65_0.14_145)]" : "text-[#3D6B47]"}`}
                style={{ animationFillMode: "forwards" }}>
                Simple Process
              </p>
              <h2 className={`text-4xl lg:text-5xl font-semibold tracking-tight text-foreground ${inView ? "animate-fade-up-soft" : "opacity-0"}`}
                style={{ fontFamily: "'Clash Display', sans-serif", animationDelay: "100ms", animationFillMode: "forwards" }}>
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
                  className={`relative transition-all duration-500 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
                  style={{ transitionDelay: `${i * 120}ms` }}
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
            Everything your club needs.
            <br />
            Nothing it doesn't.
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
// ─── Visual Showcasee ─────────────────────────────────────────────────────────
function Showcase() {
  const { ref, inView } = useInView();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <section id="for-clubs" className="py-24 overflow-hidden transition-colors duration-500 bg-background" ref={ref}>
      <div className="container">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div className={`transition-all duration-700 ${inView ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-8"}`}>
            <div
              className={`relative rounded-2xl overflow-hidden shadow-xl ${
                isDark ? "bg-[oklch(0.22_0.06_145)]" : "bg-[#F2F7F3]"
              }`}
              style={{ minHeight: "360px" }}
            >
              {/* Decorative chess board grid */}
              <div className="absolute inset-0 chess-board-bg opacity-30" />
              {/* Centered stat block */}
              <div className="relative z-10 flex flex-col items-center justify-center h-full min-h-[360px] gap-8 p-10">
                <div className="grid grid-cols-2 gap-4 w-full max-w-xs">
                  {[
                    { label: "Tournaments", value: "300+" },
                    { label: "Players", value: "550+" },
                    { label: "Chess Clubs", value: "80+" },
                    { label: "Avg Rating", value: "4.9★" },
                  ].map(({ label, value }) => (
                    <div
                      key={label}
                      className={`rounded-xl p-4 text-center border ${
                        isDark
                          ? "bg-[oklch(0.28_0.07_145)] border-white/10"
                          : "bg-white border-[#3D6B47]/12 shadow-sm"
                      }`}
                    >
                      <p
                        className={`text-2xl font-bold mb-1 ${
                          isDark ? "text-[oklch(0.65_0.14_145)]" : "text-[#3D6B47]"
                        }`}
                        style={{ fontFamily: "'Clash Display', sans-serif" }}
                      >
                        {value}
                      </p>
                      <p className="text-xs text-muted-foreground font-medium">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className={`transition-all duration-700 delay-200 ${inView ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"}`}>
            <p className={`text-xs font-semibold tracking-widest uppercase mb-4 ${inView ? "animate-badge-pop" : "opacity-0"} ${isDark ? "text-[oklch(0.65_0.14_145)]" : "text-[#3D6B47]"}`}
              style={{ animationFillMode: "forwards" }}>
              Built for Serious Players
            </p>
            <h2 className={`text-4xl lg:text-5xl font-semibold tracking-tight mb-6 text-foreground ${inView ? "animate-fade-up-soft" : "opacity-0"}`}
              style={{ fontFamily: "'Clash Display', sans-serif", animationDelay: "120ms", animationFillMode: "forwards" }}>
              Every game deserves
              <br />
              a proper stage.
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-8">
              OTB Chess brings the rigor of competitive chess to your local club. Whether you're running a casual Saturday blitz or a serious club championship, the platform handles the logistics so you can focus on the game.
            </p>

            <div className="space-y-4 mb-8">
              {[
                "Automatic ELO-based seeding and pairings",
                "Support for up to 256 players per tournament",
                "Printable pairing sheets and result slips",
                "Post-tournament performance reports",
              ].map((item, idx) => (
                <div
                  key={item}
                  className={`flex items-start gap-3 ${inView ? "animate-check-reveal" : "opacity-0"}`}
                  style={{ animationDelay: `${400 + idx * 80}ms`, animationFillMode: "forwards" }}
                >
                  <CheckCircle2 className={`w-5 h-5 mt-0.5 flex-shrink-0 ${isDark ? "text-[oklch(0.65_0.14_145)]" : "text-[#3D6B47]"}`} />
                  <span className="text-sm text-muted-foreground">{item}</span>
                </div>
              ))}
            </div>

            <a
              href="#"
              onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }}
              className="btn-chess-primary flex items-center gap-2 inline-flex"
            >
              Start a Tournament
              <ChevronRight className="w-4 h-4" />
            </a>
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
            Try it: look up any player.
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
            Free for clubs with up to 20 players. No credit card required.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={onCreateTournament}
              className="bg-white text-[#3D6B47] font-semibold text-sm px-8 py-3 rounded-md hover:bg-[#EEEED2] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
            >
              Create Free Tournament
            </button>
            <Link
              href="/tournament/otb-demo-2026"
              className="border border-white/40 text-white font-semibold text-sm px-8 py-3 rounded-md hover:bg-white/10 transition-all duration-200 inline-block text-center"
            >
              View Live Demo
            </Link>
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
      { label: "Archive", href: "/tournaments" },
      { label: "Demo", href: "/tournament/otb-demo-2026" },
    ],
    Community: [
      { label: "Join a Tournament", href: "/join" },
      { label: "Discord", href: "https://discord.gg" },
      { label: "Twitter", href: "https://twitter.com" },
      { label: "chess.com", href: "https://chess.com" },
    ],
    Company: [
      { label: "About", href: "/#how-it-works" },
      { label: "Contact", href: "mailto:hello@otbchess.app" },
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
    ],
  };

  return (
    <footer className="bg-[#1A1A1A] text-white py-16">
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

  // Handle PWA shortcut: /?action=create opens the wizard immediately
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("action") === "create") {
      setWizardOpen(true);
      // Clean the URL without reloading
      window.history.replaceState({}, "", "/");
    }
  }, []);

  return (
    <div className="min-h-screen">
      <Nav onCreateTournament={() => setWizardOpen(true)} />
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
    </div>
  );
}
