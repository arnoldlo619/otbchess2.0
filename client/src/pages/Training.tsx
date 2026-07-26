/**
 * Training Hub — /training
 *
 * Premium bento-grid layout replacing the Gallery4 carousel.
 * Design system: OTB Chess brand tokens (forest green + bone + dark).
 * DESIGN_VARIANCE: 8 / MOTION_INTENSITY: 6 / VISUAL_DENSITY: 4
 */
import { useTheme } from "@/contexts/ThemeContext";
import { AppNavBar } from "@/components/AppNavBar";
import { BGPattern } from "@/components/ui/bg-pattern";
import { useLocation } from "wouter";
import { ArrowRight, ExternalLink, Lock } from "lucide-react";

// ─── Tool Definitions ─────────────────────────────────────────────────────────
const TOOLS = [
  {
    id: "matchup-prep",
    title: "Matchup Prep",
    tagline: "Scout your opponent before you sit down.",
    description:
      "Enter any chess.com username and get a deep pre-game scouting report in seconds — opening tendencies, preparation depth, and the exact moves where they most commonly go wrong.",
    cta: "Prepare for Opponent",
    href: "/prep",
    external: false,
    image: "/manus-storage/matchup-prep-demo_02ab6c2d.webp",
    highlights: ["Opening tendency analysis", "Preparation depth scoring", "Recurring mistake patterns"],
    accent: "#436850",
    size: "hero", // spans 2 cols
  },
  {
    id: "repertoire-builder",
    title: "Repertoire Builder",
    tagline: "Build your opening playbook.",
    description:
      "Interactive chessboard powered by Stockfish 18. Explore candidate moves from the Lichess database, see frequency and win-rate data, and save your preparation lines.",
    cta: "Build Repertoire",
    href: "/repertoire",
    external: false,
    image: "/manus-storage/repertoire-builder-demo_2866e1f4.webp",
    highlights: ["Stockfish 18 engine", "Lichess database", "Save & manage lines"],
    accent: "#2d5a3a",
    size: "medium",
  },
  {
    id: "openings-library",
    title: "Openings Library",
    tagline: "Study 18+ openings, 110+ lines.",
    description:
      "Curated library with interactive boards, annotated lines, and spaced-repetition flashcard drills to lock in your repertoire.",
    cta: "Browse Openings",
    href: "/openings",
    external: false,
    image: "/manus-storage/openings-library-demo_29aa7bc2.webp",
    highlights: ["18+ openings", "110+ annotated lines", "Spaced-repetition drills"],
    accent: "#1a3d28",
    size: "medium",
  },
  {
    id: "video-editor",
    title: "Video Editor",
    tagline: "Annotate your OTB games on video.",
    description:
      "Upload your OTB game video and open a side-by-side editor: your video plays on the left while a live interactive digital chessboard sits on the right.",
    cta: "Open Video Editor",
    href: "https://otbanalysis.lovable.app",
    external: true,
    image: "/manus-storage/video-editor-demo_b4d06aa7.png",
    highlights: ["Side-by-side video + board", "Live move registration", "Export with overlay"],
    accent: "#0f2a1a",
    size: "tall",
  },
  {
    id: "chess-clock",
    title: "Chess Clock",
    tagline: "A precision digital clock for OTB play.",
    description:
      "Full-screen two-player chess clock with configurable time controls — Bullet, Blitz, Rapid, Classical, and custom. Tap your half to pass the turn. Sound cues, increment support, and a clean distraction-free interface.",
    cta: "Open Chess Clock",
    href: "/clock",
    external: false,
    image: "/manus-storage/chess-clock-demo_9ce126e7.webp",
    highlights: ["Bullet / Blitz / Rapid / Classical", "Increment support", "Sound cues"],
    accent: "#12372A",
    size: "medium",
  },
] as const;

const COMING_SOON = [
  { label: "Endgame Drills", desc: "Master rook endings, pawn races, and K+P vs K." },
  { label: "Tactics Trainer", desc: "Daily puzzles calibrated to your rating." },
  { label: "Study Plans", desc: "Personalized weekly prep based on your weaknesses." },
];

// ─── Tool Card ────────────────────────────────────────────────────────────────
function ToolCard({
  tool,
  isDark,
}: {
  tool: (typeof TOOLS)[number];
  isDark: boolean;
}) {
  const [, navigate] = useLocation();

  const handleClick = () => {
    if (tool.external) {
      window.open(tool.href, "_blank", "noopener,noreferrer");
    } else {
      navigate(tool.href);
    }
  };

  const isHero = tool.size === "hero";
  const isTall = tool.size === "tall";

  return (
    <div
      onClick={handleClick}
      className={`group relative overflow-hidden rounded-2xl cursor-pointer ${
        isHero ? "col-span-2 row-span-1 min-h-[320px] sm:min-h-[360px]" :
        isTall ? "col-span-1 row-span-2 min-h-[320px]" :
        "col-span-1 row-span-1 min-h-[220px]"
      } ${isDark ? "bg-[#0d1a0f] border border-[#1e2e22]/80" : "bg-white border border-[#ADBC9F]/50"}`}
      style={{
        boxShadow: isDark
          ? "0 2px 24px rgba(0,0,0,0.4)"
          : "0 2px 16px rgba(67,104,80,0.08)",
        transition: "transform 0.32s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.28s ease, border-color 0.22s ease",
        willChange: "transform",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(-4px) scale(1.012)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = isDark
          ? "0 16px 48px rgba(0,0,0,0.55), 0 0 0 1.5px rgba(91,154,106,0.38)"
          : "0 16px 40px rgba(67,104,80,0.18), 0 0 0 1.5px rgba(67,104,80,0.30)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = "";
        (e.currentTarget as HTMLDivElement).style.boxShadow = isDark
          ? "0 2px 24px rgba(0,0,0,0.4)"
          : "0 2px 16px rgba(67,104,80,0.08)";
      }}
    >
      {/* Background image with parallax-like scale on hover */}
      <div className="absolute inset-0 overflow-hidden">
        <img
          src={tool.image}
          alt={tool.title}
          className="w-full h-full object-cover object-top group-hover:scale-[1.06]"
          style={{ transition: "transform 0.55s cubic-bezier(0.25,0.46,0.45,0.94)" }}
          loading="lazy"
          decoding="async"
        />
        {/* Gradient overlay — lightens slightly on hover via opacity */}
        <div
          className="absolute inset-0 transition-opacity duration-300 group-hover:opacity-80"
          style={{
            background: isHero
              ? "linear-gradient(135deg, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.45) 55%, rgba(0,0,0,0.15) 100%)"
              : "linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.55) 45%, rgba(0,0,0,0.10) 100%)",
          }}
        />
        {/* Accent glow — fades in on hover */}
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-400 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at 20% 80%, ${tool.accent}22 0%, transparent 65%)`,
          }}
        />
      </div>

      {/* External badge */}
      {tool.external && (
        <div className="absolute top-3 right-3 z-10">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-black/50 text-white/70 border border-white/15 backdrop-blur-sm">
            <ExternalLink className="w-2.5 h-2.5" />
            External
          </span>
        </div>
      )}

      {/* Content — lifts slightly on hover */}
      <div
        className={`absolute inset-0 flex flex-col justify-end p-5 sm:p-6 ${
          isHero ? "sm:max-w-[55%]" : ""
        }`}
        style={{ transition: "transform 0.32s cubic-bezier(0.34,1.56,0.64,1)" }}
      >
        {/* Tagline */}
        <p className="text-[11px] font-semibold uppercase tracking-widest text-white/50 mb-1.5 transition-colors duration-200 group-hover:text-white/70">
          {tool.tagline}
        </p>

        {/* Title */}
        <h2
          className={`font-bold text-white leading-tight mb-2 transition-colors duration-200 ${
            isHero ? "text-2xl sm:text-3xl" : "text-lg sm:text-xl"
          }`}
          style={{ fontFamily: "'Clash Display', sans-serif" }}
        >
          {tool.title}
        </h2>

        {/* Description — only on hero and tall */}
        {(isHero || isTall) && (
          <p className="text-sm text-white/65 leading-relaxed mb-3 line-clamp-2 transition-colors duration-200 group-hover:text-white/80">
            {tool.description}
          </p>
        )}

        {/* Highlight pills — shift up slightly on hover */}
        <div className="flex flex-wrap gap-1.5 mb-4 transition-transform duration-300 group-hover:-translate-y-0.5">
          {tool.highlights.map((h) => (
            <span
              key={h}
              className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/10 text-white/70 border border-white/10 backdrop-blur-sm transition-all duration-200 group-hover:bg-white/15 group-hover:border-white/20 group-hover:text-white/85"
            >
              {h}
            </span>
          ))}
        </div>

        {/* CTA — arrow slides on hover */}
        <div className="flex items-center gap-1.5">
          <span
            className="inline-flex items-center gap-1.5 text-sm font-semibold transition-all duration-200 group-hover:gap-3"
            style={{ color: "#7ab88a", transition: "gap 0.2s ease, color 0.2s ease" }}
          >
            <span className="transition-colors duration-200 group-hover:text-[#9dd4a8]">{tool.cta}</span>
            {tool.external ? (
              <ExternalLink
                className="w-3.5 h-3.5 shrink-0"
                style={{ transition: "transform 0.2s ease" }}
              />
            ) : (
              <ArrowRight
                className="w-3.5 h-3.5 shrink-0"
                style={{ transition: "transform 0.22s cubic-bezier(0.34,1.56,0.64,1)" }}
              />
            )}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Coming Soon Cell ─────────────────────────────────────────────────────────
function ComingSoonCell({
  item,
  isDark,
}: {
  item: (typeof COMING_SOON)[number];
  isDark: boolean;
}) {
  return (
    <div
      className={`relative rounded-2xl p-5 flex flex-col gap-2 ${
        isDark
          ? "bg-[#0d1a0f]/60 border border-[#1e2e22]/60"
          : "bg-[#f0f5f0] border border-[#ADBC9F]/40"
      }`}
    >
      <div className="flex items-center gap-2">
        <Lock
          className={`w-3.5 h-3.5 ${isDark ? "text-white/25" : "text-[#436850]/40"}`}
        />
        <span
          className={`text-xs font-bold uppercase tracking-widest ${
            isDark ? "text-white/30" : "text-[#436850]/50"
          }`}
        >
          Coming Soon
        </span>
      </div>
      <p
        className={`text-sm font-semibold ${
          isDark ? "text-white/45" : "text-[#12372A]/60"
        }`}
        style={{ fontFamily: "'Clash Display', sans-serif" }}
      >
        {item.label}
      </p>
      <p className={`text-xs leading-relaxed ${isDark ? "text-white/30" : "text-[#436850]/50"}`}>
        {item.desc}
      </p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Training() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div
      className={`relative min-h-screen ${isDark ? "bg-[#0a1409]" : "bg-[#f4f7f4]"}`}
    >
      <BGPattern
        variant="checkerboard"
        mask="fade-top"
        fill={isDark ? "#5B9A6A" : "#436850"}
        size={32}
      />
      <AppNavBar defaultActive="Tools" />

      <div className="max-w-5xl mx-auto px-4 pt-24 sm:pt-28 lg:pt-32 pb-16 sm:pb-20 lg:pb-24">

        {/* ── Page Header ── */}
        <div className="mb-10 sm:mb-12">
          <p
            className={`text-[11px] font-bold uppercase tracking-[0.22em] mb-3 ${
              isDark ? "text-[#5B9A6A]/70" : "text-[#436850]/60"
            }`}
          >
            Training & Preparation
          </p>
          <h1
            className={`text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-none mb-3 ${
              isDark ? "text-white" : "text-[#12372A]"
            }`}
            style={{ fontFamily: "'Clash Display', sans-serif" }}
          >
            Your Chess Toolkit
          </h1>
          <p
            className={`text-base leading-relaxed max-w-lg ${
              isDark ? "text-white/55" : "text-[#436850]/80"
            }`}
          >
            Scout opponents, build your repertoire, and study openings — everything you need to show up prepared.
          </p>
        </div>

        {/* ── Bento Grid ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {/* Hero card — Matchup Prep (spans 2 cols on lg) */}
          <div className="sm:col-span-2 lg:col-span-2">
            <ToolCard tool={TOOLS[0]} isDark={isDark} />
          </div>

          {/* Video Editor — tall card on lg (spans 2 rows) */}
          <div className="sm:col-span-1 lg:row-span-2">
            <ToolCard tool={TOOLS[3]} isDark={isDark} />
          </div>

          {/* Repertoire Builder */}
          <div className="sm:col-span-1">
            <ToolCard tool={TOOLS[1]} isDark={isDark} />
          </div>

          {/* Openings Library */}
          <div className="sm:col-span-1">
            <ToolCard tool={TOOLS[2]} isDark={isDark} />
          </div>

          {/* Chess Clock */}
          <div className="sm:col-span-1">
            <ToolCard tool={TOOLS[4]} isDark={isDark} />
          </div>
        </div>

        {/* ── Coming Soon Row ── */}
        <div className="mt-4 sm:mt-5">
          <div
            className={`rounded-2xl p-5 sm:p-6 ${
              isDark
                ? "bg-[#0d1a0f]/40 border border-[#1e2e22]/50"
                : "bg-white/60 border border-[#ADBC9F]/40"
            }`}
          >
            <p
              className={`text-xs font-bold uppercase tracking-[0.18em] mb-4 ${
                isDark ? "text-white/25" : "text-[#436850]/40"
              }`}
            >
              On the roadmap
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {COMING_SOON.map((item) => (
                <ComingSoonCell key={item.label} item={item} isDark={isDark} />
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
