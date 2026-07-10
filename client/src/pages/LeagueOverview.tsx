/**
 * LeagueOverview — /league
 *
 * Marketing overview page explaining what OTB Club Leagues are.
 * Inspired by sports-league landing pages: hero, stats, features, league table preview, CTA.
 * Uses the OTB Chess design system (deep forest green, lime accent, Clash Display headings).
 */
import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { useTheme } from "@/contexts/ThemeContext";
import { AppNavBar } from "@/components/AppNavBar";
import { BGPattern } from "@/components/ui/bg-pattern";
import { Link } from "wouter";
import {
  Trophy,
  Users,
  Calendar,
  BarChart3,
  Shield,
  Swords,
  ChevronRight,
  ArrowRight,
  Crown,
  Clock,
  Target,
  Zap,
} from "lucide-react";

// ─── Design Tokens ────────────────────────────────────────────────────────────
const accent = "oklch(0.72 0.19 145)";
const accentDim = "oklch(0.72 0.19 145 / 0.15)";

// ─── Demo Data ────────────────────────────────────────────────────────────────
const DEMO_STANDINGS = [
  { rank: 1, name: "Magnus C.", rating: 2830, w: 8, d: 3, l: 0, pts: 19, streak: "W5" },
  { rank: 2, name: "Hikaru N.", rating: 2790, w: 7, d: 4, l: 0, pts: 18, streak: "W3" },
  { rank: 3, name: "Fabiano C.", rating: 2780, w: 7, d: 2, l: 2, pts: 16, streak: "W2" },
  { rank: 4, name: "Ian N.", rating: 2760, w: 6, d: 3, l: 2, pts: 15, streak: "D1" },
  { rank: 5, name: "Gukesh D.", rating: 2783, w: 5, d: 4, l: 2, pts: 14, streak: "L1" },
  { rank: 6, name: "Alireza F.", rating: 2760, w: 5, d: 3, l: 3, pts: 13, streak: "W1" },
];

const FEATURES = [
  {
    icon: Calendar,
    title: "Weekly Matchups",
    description: "Automated round-robin or Swiss pairings generated every week. Players know exactly who they face next.",
  },
  {
    icon: BarChart3,
    title: "Live Standings",
    description: "Real-time leaderboard with points, win streaks, and tiebreakers. Everyone sees where they stand.",
  },
  {
    icon: Shield,
    title: "Commissioner Control",
    description: "One club leader manages the league — reports results, advances weeks, and handles disputes.",
  },
  {
    icon: Users,
    title: "Player Profiles",
    description: "Each player's chess.com stats, match history, and league performance in one place.",
  },
  {
    icon: Target,
    title: "Season Format",
    description: "Set the number of weeks, max players, and format type. Run multiple seasons per year.",
  },
  {
    icon: Zap,
    title: "Instant Setup",
    description: "Create a league in under 60 seconds. Share the invite link and start collecting RSVPs.",
  },
];

// ─── Section Components ───────────────────────────────────────────────────────

function HeroSection({ isDark }: { isDark: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });

  return (
    <section
      className="relative overflow-hidden"
      style={{
        background: isDark
          ? "linear-gradient(180deg, oklch(0.14 0.06 145) 0%, oklch(0.18 0.07 145) 100%)"
          : "linear-gradient(180deg, #0f1f14 0%, #1a3a22 100%)",
        minHeight: "85vh",
      }}
    >
      {/* Chess texture background */}
      <BGPattern variant="checkerboard" mask="fade-edges" size={40} fill="oklch(0.25 0.06 145 / 0.15)" className="absolute inset-0" />

      {/* Radial glow */}
      <div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(ellipse, oklch(0.35 0.15 145 / 0.2) 0%, transparent 70%)" }}
      />

      <div ref={ref} className="relative z-10 container max-w-6xl pt-32 sm:pt-40 pb-20 sm:pb-28">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="text-center max-w-3xl mx-auto"
        >
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-6 sm:mb-8" style={{ background: accentDim, border: `1px solid oklch(0.72 0.19 145 / 0.3)` }}>
            <Trophy size={14} style={{ color: accent }} />
            <span className="text-xs font-semibold tracking-wide uppercase" style={{ color: accent }}>Club League Feature</span>
          </div>

          {/* Headline */}
          <h1
            className="text-4xl sm:text-5xl lg:text-7xl font-black tracking-tight leading-[1.05] mb-5 sm:mb-6"
            style={{ fontFamily: "'Clash Display', sans-serif", color: "#fff" }}
          >
            The Season
            <br />
            <span style={{ color: accent }}>Starts Here.</span>
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-lg leading-relaxed max-w-xl mx-auto mb-8 sm:mb-10" style={{ color: "oklch(0.75 0.04 145)" }}>
            Run a structured weekly chess league for your club. Automated pairings, live standings, and a season champion — all from one dashboard.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <Link
              href="/league/new"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl text-sm font-bold transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{ background: accent, color: "#0a1f0f" }}
            >
              Create a League <ArrowRight size={16} />
            </Link>
            <Link
              href="/league-demo"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl text-sm font-bold transition-all hover:opacity-80"
              style={{ background: "oklch(0.22 0.06 145)", color: "#fff", border: "1px solid oklch(0.30 0.08 145)" }}
            >
              View Live Demo <ChevronRight size={16} />
            </Link>
          </div>
        </motion.div>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
          className="mt-14 sm:mt-20 grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 max-w-2xl mx-auto"
        >
          {[
            { value: "12", label: "Week Season" },
            { value: "20", label: "Max Players" },
            { value: "60s", label: "Setup Time" },
            { value: "∞", label: "Free Forever" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-2xl sm:text-3xl font-black" style={{ color: accent }}>{stat.value}</div>
              <div className="text-[11px] sm:text-xs font-medium uppercase tracking-wide mt-1" style={{ color: "oklch(0.55 0.06 145)" }}>{stat.label}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function FeaturesSection({ isDark }: { isDark: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.2 });

  const textMain = isDark ? "#fff" : "#12372A";
  const textMuted = isDark ? "oklch(0.65 0.06 145)" : "oklch(0.45 0.08 145)";
  const cardBg = isDark ? "oklch(0.18 0.05 145)" : "#fff";
  const cardBorder = isDark ? "oklch(0.25 0.06 145)" : "oklch(0.90 0.03 145)";

  return (
    <section
      ref={ref}
      className="py-16 sm:py-24 lg:py-32"
      style={{ background: isDark ? "oklch(0.13 0.04 145)" : "oklch(0.97 0.01 145)" }}
    >
      <div className="container max-w-6xl">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-12 sm:mb-16"
        >
          <h2
            className="text-2xl sm:text-3xl lg:text-5xl font-bold tracking-tight mb-4"
            style={{ fontFamily: "'Clash Display', sans-serif", color: textMain }}
          >
            Everything Your League Needs
          </h2>
          <p className="text-sm sm:text-base max-w-lg mx-auto" style={{ color: textMuted }}>
            Built specifically for over-the-board chess clubs that want structured weekly competition.
          </p>
        </motion.div>

        {/* Feature grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {FEATURES.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="rounded-2xl p-5 sm:p-6 transition-all hover:scale-[1.01]"
                style={{ background: cardBg, border: `1px solid ${cardBorder}` }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: accentDim }}
                >
                  <Icon size={20} style={{ color: accent }} />
                </div>
                <h3 className="text-sm font-bold mb-1.5" style={{ color: textMain }}>{feature.title}</h3>
                <p className="text-xs leading-relaxed" style={{ color: textMuted }}>{feature.description}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function LeagueTableSection({ isDark }: { isDark: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.2 });

  const textMain = isDark ? "#fff" : "#12372A";
  const textMuted = isDark ? "oklch(0.60 0.05 145)" : "oklch(0.45 0.06 145)";
  const cardBg = isDark ? "oklch(0.16 0.05 145)" : "#fff";
  const cardBorder = isDark ? "oklch(0.24 0.06 145)" : "oklch(0.90 0.03 145)";
  const rowHover = isDark ? "oklch(0.19 0.06 145)" : "oklch(0.96 0.02 145)";

  return (
    <section
      ref={ref}
      className="py-16 sm:py-24 lg:py-32"
      style={{ background: isDark ? "oklch(0.15 0.05 145)" : "oklch(0.95 0.02 145)" }}
    >
      <div className="container max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="mb-10 sm:mb-14"
        >
          <div className="flex items-center gap-3 mb-3">
            <Crown size={20} style={{ color: accent }} />
            <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: accent }}>League Table</span>
          </div>
          <h2
            className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight mb-3"
            style={{ fontFamily: "'Clash Display', sans-serif", color: textMain }}
          >
            Live Standings
          </h2>
          <p className="text-sm max-w-md" style={{ color: textMuted }}>
            Real-time leaderboard updated after every match. Players track their position, form, and path to the title.
          </p>
        </motion.div>

        {/* Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="rounded-2xl overflow-hidden"
          style={{ background: cardBg, border: `1px solid ${cardBorder}` }}
        >
          {/* Table header */}
          <div
            className="grid grid-cols-[40px_1fr_60px_40px_40px_40px_50px_50px] sm:grid-cols-[50px_1fr_80px_50px_50px_50px_60px_70px] items-center px-4 sm:px-6 py-3 text-[10px] sm:text-xs font-semibold uppercase tracking-wide"
            style={{ color: textMuted, borderBottom: `1px solid ${cardBorder}` }}
          >
            <span>#</span>
            <span>Player</span>
            <span className="text-center">Rating</span>
            <span className="text-center">W</span>
            <span className="text-center">D</span>
            <span className="text-center">L</span>
            <span className="text-center">Pts</span>
            <span className="text-center">Form</span>
          </div>

          {/* Table rows */}
          {DEMO_STANDINGS.map((player, i) => (
            <div
              key={player.rank}
              className="grid grid-cols-[40px_1fr_60px_40px_40px_40px_50px_50px] sm:grid-cols-[50px_1fr_80px_50px_50px_50px_60px_70px] items-center px-4 sm:px-6 py-3 transition-colors"
              style={{
                borderBottom: i < DEMO_STANDINGS.length - 1 ? `1px solid ${cardBorder}` : undefined,
                background: i === 0 ? (isDark ? "oklch(0.18 0.07 145 / 0.5)" : "oklch(0.96 0.04 145)") : undefined,
              }}
              onMouseEnter={(e) => { if (i > 0) e.currentTarget.style.background = rowHover; }}
              onMouseLeave={(e) => { if (i > 0) e.currentTarget.style.background = ""; }}
            >
              <span className="text-sm font-bold" style={{ color: i === 0 ? accent : textMain }}>
                {i === 0 ? "👑" : player.rank}
              </span>
              <span className="text-sm font-semibold truncate" style={{ color: textMain }}>{player.name}</span>
              <span className="text-xs text-center font-medium" style={{ color: textMuted }}>{player.rating}</span>
              <span className="text-xs text-center font-medium" style={{ color: "oklch(0.65 0.18 145)" }}>{player.w}</span>
              <span className="text-xs text-center font-medium" style={{ color: textMuted }}>{player.d}</span>
              <span className="text-xs text-center font-medium" style={{ color: "oklch(0.60 0.18 25)" }}>{player.l}</span>
              <span className="text-sm text-center font-bold" style={{ color: textMain }}>{player.pts}</span>
              <span
                className="text-[10px] text-center font-bold px-2 py-0.5 rounded"
                style={{
                  background: player.streak.startsWith("W") ? "oklch(0.25 0.10 145)" : player.streak.startsWith("D") ? "oklch(0.25 0.04 85)" : "oklch(0.25 0.08 25)",
                  color: player.streak.startsWith("W") ? accent : player.streak.startsWith("D") ? "oklch(0.70 0.12 85)" : "oklch(0.65 0.18 25)",
                }}
              >
                {player.streak}
              </span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function MatchCenterSection({ isDark }: { isDark: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.2 });

  const textMain = isDark ? "#fff" : "#12372A";
  const textMuted = isDark ? "oklch(0.60 0.05 145)" : "oklch(0.45 0.06 145)";
  const cardBg = isDark ? "oklch(0.17 0.05 145)" : "#fff";
  const cardBorder = isDark ? "oklch(0.25 0.06 145)" : "oklch(0.90 0.03 145)";

  return (
    <section
      ref={ref}
      className="py-16 sm:py-24 lg:py-32"
      style={{ background: isDark ? "oklch(0.13 0.04 145)" : "oklch(0.97 0.01 145)" }}
    >
      <div className="container max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="mb-10 sm:mb-14"
        >
          <div className="flex items-center gap-3 mb-3">
            <Swords size={20} style={{ color: accent }} />
            <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: accent }}>Match Center</span>
          </div>
          <h2
            className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight mb-3"
            style={{ fontFamily: "'Clash Display', sans-serif", color: textMain }}
          >
            This Week's Matchups
          </h2>
          <p className="text-sm max-w-md" style={{ color: textMuted }}>
            Players see their opponent, prep their openings, and show up ready to compete.
          </p>
        </motion.div>

        {/* Match cards */}
        <div className="grid sm:grid-cols-2 gap-4">
          {[
            { white: "Magnus C.", black: "Fabiano C.", board: 1, time: "G/90+30" },
            { white: "Hikaru N.", black: "Ian N.", board: 2, time: "G/90+30" },
            { white: "Gukesh D.", black: "Alireza F.", board: 3, time: "G/90+30" },
            { white: "Wesley S.", black: "Ding L.", board: 4, time: "G/90+30" },
          ].map((match, i) => (
            <motion.div
              key={match.board}
              initial={{ opacity: 0, y: 16 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.1 + i * 0.08 }}
              className="rounded-xl p-4 sm:p-5 flex items-center gap-4"
              style={{ background: cardBg, border: `1px solid ${cardBorder}` }}
            >
              {/* Board number */}
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold"
                style={{ background: accentDim, color: accent }}
              >
                {match.board}
              </div>

              {/* Players */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-3 h-3 rounded-sm bg-white border border-gray-300 flex-shrink-0" />
                  <span className="text-sm font-semibold truncate" style={{ color: textMain }}>{match.white}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-sm bg-gray-800 flex-shrink-0" />
                  <span className="text-sm font-semibold truncate" style={{ color: textMain }}>{match.black}</span>
                </div>
              </div>

              {/* Time control */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <Clock size={12} style={{ color: textMuted }} />
                <span className="text-[10px] font-medium" style={{ color: textMuted }}>{match.time}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTASection({ isDark }: { isDark: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });

  return (
    <section
      ref={ref}
      className="relative py-20 sm:py-28 lg:py-36 overflow-hidden"
      style={{
        background: isDark
          ? "linear-gradient(180deg, oklch(0.15 0.05 145) 0%, oklch(0.12 0.06 145) 100%)"
          : "linear-gradient(180deg, oklch(0.95 0.02 145) 0%, oklch(0.92 0.03 145) 100%)",
      }}
    >
      <BGPattern variant="checkerboard" mask="fade-edges" size={48} fill="oklch(0.25 0.06 145 / 0.08)" className="absolute inset-0" />

      <div className="relative z-10 container max-w-3xl text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
        >
          <h2
            className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight mb-5"
            style={{ fontFamily: "'Clash Display', sans-serif", color: isDark ? "#fff" : "#12372A" }}
          >
            Ready to Run Your
            <br />
            <span style={{ color: accent }}>Club League?</span>
          </h2>
          <p className="text-sm sm:text-base mb-8 max-w-md mx-auto" style={{ color: isDark ? "oklch(0.65 0.05 145)" : "oklch(0.45 0.06 145)" }}>
            Set up in under 60 seconds. Free forever. No credit card required.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/league/new"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-sm font-bold transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{ background: accent, color: "#0a1f0f" }}
            >
              Create Your League <ArrowRight size={16} />
            </Link>
            <Link
              href="/league-demo"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-sm font-bold transition-all hover:opacity-80"
              style={{
                background: isDark ? "oklch(0.20 0.06 145)" : "#fff",
                color: isDark ? "#fff" : "#12372A",
                border: `1px solid ${isDark ? "oklch(0.30 0.07 145)" : "oklch(0.88 0.03 145)"}`,
              }}
            >
              Explore Demo <ChevronRight size={16} />
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LeagueOverview() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div className="min-h-screen" style={{ background: isDark ? "oklch(0.13 0.04 145)" : "oklch(0.97 0.01 145)" }}>
      <AppNavBar />
      <HeroSection isDark={isDark} />
      <FeaturesSection isDark={isDark} />
      <LeagueTableSection isDark={isDark} />
      <MatchCenterSection isDark={isDark} />
      <CTASection isDark={isDark} />
    </div>
  );
}
