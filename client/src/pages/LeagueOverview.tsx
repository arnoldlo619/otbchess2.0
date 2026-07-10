/**
 * LeagueOverview — /league
 *
 * Marketing overview page explaining what OTB Club Leagues are.
 * Inspired by sports-league landing pages: hero, stats, features, league table preview, CTA.
 * Uses the OTB Chess design system (deep forest green, lime accent, Clash Display headings).
 */
import { useRef, useState } from "react";
import { motion, useInView, Variants } from "framer-motion";
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
const accentGlow = "oklch(0.72 0.19 145 / 0.25)";

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

// ─── Animation Variants ───────────────────────────────────────────────────────
const containerVariants: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08 },
  },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  },
};

const matchCardVariants: Variants = {
  hidden: { opacity: 0, x: -16 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  },
};

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
      <BGPattern variant="checkerboard" mask="fade-edges" size={40} fill="oklch(0.25 0.06 145 / 0.15)" className="absolute inset-0" />
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
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-6 sm:mb-8" style={{ background: accentDim, border: `1px solid oklch(0.72 0.19 145 / 0.3)` }}>
            <Trophy size={14} style={{ color: accent }} />
            <span className="text-xs font-semibold tracking-wide uppercase" style={{ color: accent }}>Club League Feature</span>
          </div>

          <h1
            className="text-4xl sm:text-5xl lg:text-7xl font-black tracking-tight leading-[1.05] mb-5 sm:mb-6"
            style={{ fontFamily: "'Clash Display', sans-serif", color: "#fff" }}
          >
            The Season
            <br />
            <span style={{ color: accent }}>Starts Here.</span>
          </h1>

          <p className="text-base sm:text-lg leading-relaxed max-w-xl mx-auto mb-8 sm:mb-10" style={{ color: "oklch(0.75 0.04 145)" }}>
            Run a structured weekly chess league for your club. Automated pairings, live standings, and a season champion — all from one dashboard.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <Link
              href="/league/new"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl text-sm font-bold transition-all hover:scale-[1.02] active:scale-[0.98] w-full sm:w-auto justify-center"
              style={{ background: accent, color: "#0a1f0f" }}
            >
              Create a League <ArrowRight size={16} />
            </Link>
            <Link
              href="/league-demo"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl text-sm font-bold transition-all hover:opacity-80 w-full sm:w-auto justify-center"
              style={{ background: "oklch(0.22 0.06 145)", color: "#fff", border: "1px solid oklch(0.30 0.08 145)" }}
            >
              View Live Demo <ChevronRight size={16} />
            </Link>
          </div>
        </motion.div>

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
  const inView = useInView(ref, { once: true, amount: 0.15 });

  const textMain = isDark ? "#fff" : "#12372A";
  const textMuted = isDark ? "oklch(0.65 0.06 145)" : "oklch(0.45 0.08 145)";
  const cardBg = isDark ? "oklch(0.18 0.05 145)" : "#fff";
  const cardBorder = isDark ? "oklch(0.25 0.06 145)" : "oklch(0.90 0.03 145)";
  const cardBorderHover = isDark ? "oklch(0.72 0.19 145 / 0.4)" : "oklch(0.72 0.19 145 / 0.5)";
  const cardBgHover = isDark ? "oklch(0.20 0.06 145)" : "oklch(0.99 0.02 145)";

  return (
    <section
      ref={ref}
      className="py-16 sm:py-24 lg:py-32"
      style={{ background: isDark ? "oklch(0.13 0.04 145)" : "oklch(0.97 0.01 145)" }}
    >
      <div className="container max-w-6xl">
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

        {/* Feature grid — staggered container */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate={inView ? "visible" : "hidden"}
          className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5"
        >
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <FeatureCard
                key={feature.title}
                feature={feature}
                Icon={Icon}
                textMain={textMain}
                textMuted={textMuted}
                cardBg={cardBg}
                cardBorder={cardBorder}
                cardBgHover={cardBgHover}
                cardBorderHover={cardBorderHover}
              />
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}

function FeatureCard({
  feature,
  Icon,
  textMain,
  textMuted,
  cardBg,
  cardBorder,
  cardBgHover,
  cardBorderHover,
}: {
  feature: typeof FEATURES[0];
  Icon: React.ElementType;
  textMain: string;
  textMuted: string;
  cardBg: string;
  cardBorder: string;
  cardBgHover: string;
  cardBorderHover: string;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      variants={cardVariants}
      whileHover={{ y: -4, transition: { duration: 0.2, ease: "easeOut" } }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      className="rounded-2xl p-5 sm:p-6 cursor-default"
      style={{
        background: hovered ? cardBgHover : cardBg,
        border: `1px solid ${hovered ? cardBorderHover : cardBorder}`,
        boxShadow: hovered ? `0 8px 32px ${accentGlow}` : "none",
        transition: "background 0.2s, border-color 0.2s, box-shadow 0.2s",
      }}
    >
      <motion.div
        className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
        animate={{ scale: hovered ? 1.12 : 1, background: hovered ? "oklch(0.72 0.19 145 / 0.22)" : accentDim }}
        transition={{ duration: 0.2 }}
      >
        <Icon size={20} style={{ color: accent }} />
      </motion.div>
      <h3 className="text-sm font-bold mb-1.5" style={{ color: textMain }}>{feature.title}</h3>
      <p className="text-xs leading-relaxed" style={{ color: textMuted }}>{feature.description}</p>
    </motion.div>
  );
}

function LeagueTableSection({ isDark }: { isDark: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.2 });

  const textMain = isDark ? "#fff" : "#12372A";
  const textMuted = isDark ? "oklch(0.60 0.05 145)" : "oklch(0.45 0.06 145)";
  const cardBg = isDark ? "oklch(0.16 0.05 145)" : "#fff";
  const cardBorder = isDark ? "oklch(0.24 0.06 145)" : "oklch(0.90 0.03 145)";
  const rowHoverBg = isDark ? "oklch(0.19 0.06 145)" : "oklch(0.96 0.02 145)";

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

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="rounded-2xl overflow-hidden"
          style={{ background: cardBg, border: `1px solid ${cardBorder}` }}
        >
          {/* Table header — mobile shows only #/Player/Pts/Form; desktop shows all */}
          <div
            className="items-center px-4 sm:px-6 py-3 text-[10px] sm:text-xs font-semibold uppercase tracking-wide"
            style={{ color: textMuted, borderBottom: `1px solid ${cardBorder}` }}
          >
            {/* Mobile header */}
            <div className="grid grid-cols-[36px_1fr_48px_52px] sm:hidden">
              <span>#</span>
              <span>Player</span>
              <span className="text-center">Pts</span>
              <span className="text-center">Form</span>
            </div>
            {/* Desktop header */}
            <div className="hidden sm:grid grid-cols-[50px_1fr_80px_50px_50px_50px_60px_70px]">
              <span>#</span>
              <span>Player</span>
              <span className="text-center">Rating</span>
              <span className="text-center">W</span>
              <span className="text-center">D</span>
              <span className="text-center">L</span>
              <span className="text-center">Pts</span>
              <span className="text-center">Form</span>
            </div>
          </div>

          {/* Table rows */}
          {DEMO_STANDINGS.map((player, i) => (
            <StandingsRow
              key={player.rank}
              player={player}
              i={i}
              isLast={i === DEMO_STANDINGS.length - 1}
              isDark={isDark}
              textMain={textMain}
              textMuted={textMuted}
              cardBorder={cardBorder}
              rowHoverBg={rowHoverBg}
            />
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function StandingsRow({
  player,
  i,
  isLast,
  isDark,
  textMain,
  textMuted,
  cardBorder,
  rowHoverBg,
}: {
  player: typeof DEMO_STANDINGS[0];
  i: number;
  isLast: boolean;
  isDark: boolean;
  textMain: string;
  textMuted: string;
  cardBorder: string;
  rowHoverBg: string;
}) {
  const [hovered, setHovered] = useState(false);
  const isTop = i === 0;

  const streakBg = player.streak.startsWith("W")
    ? "oklch(0.25 0.10 145)"
    : player.streak.startsWith("D")
    ? "oklch(0.25 0.04 85)"
    : "oklch(0.25 0.08 25)";
  const streakColor = player.streak.startsWith("W")
    ? accent
    : player.streak.startsWith("D")
    ? "oklch(0.70 0.12 85)"
    : "oklch(0.65 0.18 25)";

  const rowBg = isTop
    ? isDark ? "oklch(0.18 0.07 145 / 0.5)" : "oklch(0.96 0.04 145)"
    : hovered ? rowHoverBg : "";

  return (
    <div
      className="px-4 sm:px-6 py-3 transition-colors"
      style={{
        borderBottom: !isLast ? `1px solid ${cardBorder}` : undefined,
        background: rowBg,
        transition: "background 0.15s",
      }}
      onMouseEnter={() => !isTop && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Mobile row — compact */}
      <div className="grid grid-cols-[36px_1fr_48px_52px] items-center sm:hidden">
        <span className="text-sm font-bold" style={{ color: isTop ? accent : textMain }}>
          {isTop ? "👑" : player.rank}
        </span>
        <span className="text-sm font-semibold truncate" style={{ color: textMain }}>{player.name}</span>
        <span className="text-sm text-center font-bold" style={{ color: textMain }}>{player.pts}</span>
        <span
          className="text-[10px] text-center font-bold px-1.5 py-0.5 rounded mx-auto"
          style={{ background: streakBg, color: streakColor, display: "block", width: "fit-content" }}
        >
          {player.streak}
        </span>
      </div>

      {/* Desktop row — full */}
      <div className="hidden sm:grid grid-cols-[50px_1fr_80px_50px_50px_50px_60px_70px] items-center">
        <span className="text-sm font-bold" style={{ color: isTop ? accent : textMain }}>
          {isTop ? "👑" : player.rank}
        </span>
        <span className="text-sm font-semibold truncate" style={{ color: textMain }}>{player.name}</span>
        <span className="text-xs text-center font-medium" style={{ color: textMuted }}>{player.rating}</span>
        <span className="text-xs text-center font-medium" style={{ color: "oklch(0.65 0.18 145)" }}>{player.w}</span>
        <span className="text-xs text-center font-medium" style={{ color: textMuted }}>{player.d}</span>
        <span className="text-xs text-center font-medium" style={{ color: "oklch(0.60 0.18 25)" }}>{player.l}</span>
        <span className="text-sm text-center font-bold" style={{ color: textMain }}>{player.pts}</span>
        <span
          className="text-[10px] text-center font-bold px-2 py-0.5 rounded"
          style={{ background: streakBg, color: streakColor }}
        >
          {player.streak}
        </span>
      </div>
    </div>
  );
}

function MatchCenterSection({ isDark }: { isDark: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.15 });

  const textMain = isDark ? "#fff" : "#12372A";
  const textMuted = isDark ? "oklch(0.60 0.05 145)" : "oklch(0.45 0.06 145)";
  const cardBg = isDark ? "oklch(0.17 0.05 145)" : "#fff";
  const cardBorder = isDark ? "oklch(0.25 0.06 145)" : "oklch(0.90 0.03 145)";
  const cardBorderHover = isDark ? "oklch(0.72 0.19 145 / 0.4)" : "oklch(0.72 0.19 145 / 0.5)";
  const cardBgHover = isDark ? "oklch(0.20 0.06 145)" : "oklch(0.99 0.02 145)";

  const matches = [
    { white: "Magnus C.", black: "Fabiano C.", board: 1, time: "G/90+30" },
    { white: "Hikaru N.", black: "Ian N.", board: 2, time: "G/90+30" },
    { white: "Gukesh D.", black: "Alireza F.", board: 3, time: "G/90+30" },
    { white: "Wesley S.", black: "Ding L.", board: 4, time: "G/90+30" },
  ];

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

        {/* Match cards — staggered container */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate={inView ? "visible" : "hidden"}
          className="grid sm:grid-cols-2 gap-3 sm:gap-4"
        >
          {matches.map((match) => (
            <MatchCard
              key={match.board}
              match={match}
              textMain={textMain}
              textMuted={textMuted}
              cardBg={cardBg}
              cardBorder={cardBorder}
              cardBgHover={cardBgHover}
              cardBorderHover={cardBorderHover}
            />
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function MatchCard({
  match,
  textMain,
  textMuted,
  cardBg,
  cardBorder,
  cardBgHover,
  cardBorderHover,
}: {
  match: { white: string; black: string; board: number; time: string };
  textMain: string;
  textMuted: string;
  cardBg: string;
  cardBorder: string;
  cardBgHover: string;
  cardBorderHover: string;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      variants={matchCardVariants}
      whileHover={{ x: 4, transition: { duration: 0.18, ease: "easeOut" } }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      className="rounded-xl flex items-center gap-4 min-h-[64px] relative overflow-hidden"
      style={{
        background: hovered ? cardBgHover : cardBg,
        border: `1px solid ${hovered ? cardBorderHover : cardBorder}`,
        boxShadow: hovered ? `0 4px 20px ${accentGlow}` : "none",
        transition: "background 0.2s, border-color 0.2s, box-shadow 0.2s",
        padding: "14px 16px",
      }}
    >
      {/* Left accent bar — reveals on hover */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl"
        style={{
          background: accent,
          opacity: hovered ? 1 : 0,
          transition: "opacity 0.2s",
        }}
      />

      {/* Board number badge */}
      <motion.div
        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold"
        animate={{ scale: hovered ? 1.1 : 1, background: hovered ? "oklch(0.72 0.19 145 / 0.22)" : accentDim }}
        transition={{ duration: 0.18 }}
        style={{ color: accent }}
      >
        {match.board}
      </motion.div>

      {/* Players */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-3 h-3 rounded-sm bg-white border border-gray-300 flex-shrink-0" />
          <span className="text-sm font-semibold truncate" style={{ color: textMain }}>{match.white}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: "oklch(0.20 0.04 145)" }} />
          <span className="text-sm font-semibold truncate" style={{ color: textMain }}>{match.black}</span>
        </div>
      </div>

      {/* Time control */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <Clock size={12} style={{ color: textMuted }} />
        <span className="text-[10px] font-medium" style={{ color: textMuted }}>{match.time}</span>
      </div>
    </motion.div>
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
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-sm font-bold transition-all hover:scale-[1.02] active:scale-[0.98] w-full sm:w-auto justify-center"
              style={{ background: accent, color: "#0a1f0f" }}
            >
              Create Your League <ArrowRight size={16} />
            </Link>
            <Link
              href="/league-demo"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-sm font-bold transition-all hover:opacity-80 w-full sm:w-auto justify-center"
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
