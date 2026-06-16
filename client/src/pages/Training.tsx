/**
 * Training Hub — /training
 *
 * Each feature card expands inline to reveal a side-by-side preview:
 *   left: demo screenshot  |  right: description + highlights + CTA
 */
import { useState } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import {
  BookOpen,
  Target,
  ChevronRight,
  GraduationCap,
  Zap,
  Brain,
  Swords,
  Video,
  ExternalLink,
  X,
  ArrowRight,
} from "lucide-react";
import { AppNavBar } from "@/components/AppNavBar";
import { BGPattern } from "@/components/ui/bg-pattern";

interface FeatureCard {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  description: string;
  cta: string;
  href: string;
  external?: boolean;
  previewImg: string;
  previewAlt: string;
  accent: string;
  accentBg: string;
  border: string;
  borderActive: string;
  highlights: string[];
}

export default function Training() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  const features: FeatureCard[] = [
    {
      icon: Video,
      title: "Video Editor",
      subtitle: "Upload Game · Live Board · Export with Notation",
      description:
        "Upload your OTB game video and open a side-by-side editor: your video plays on the left while a live interactive digital chessboard sits on the right. Register each move for White and Black as you watch, then export a polished video with the board overlay embedded — perfect for game reviews, club content, and social sharing.",
      cta: "Open Video Editor",
      href: "https://otbanalysis.lovable.app",
      external: true,
      previewImg: "/manus-storage/video-editor-demo_b4d06aa7.png",
      previewAlt: "Video Editor — side-by-side OTB game video and interactive digital chessboard",
      accent: isDark ? "text-[#5B9A6A]" : "text-[#3D6B47]",
      accentBg: isDark ? "bg-[#5B9A6A]/10" : "bg-[#3D6B47]/08",
      border: isDark ? "border-[#2e4a34]/60" : "border-gray-200",
      borderActive: isDark ? "border-[#5B9A6A]/50" : "border-[#3D6B47]/40",
      highlights: ["Side-by-side video + board view", "Live move registration", "Export with board overlay"],
    },
    {
      icon: Swords,
      title: "Repertoire Builder",
      subtitle: "Interactive Board · Move Tree · Stockfish Engine",
      description:
        "Build your own opening repertoire with an interactive chessboard powered by Stockfish. Explore candidate moves from the Lichess database, see frequency and win-rate data, and save your preparation lines.",
      cta: "Build Repertoire",
      href: "/repertoire",
      previewImg: "/manus-storage/video-editor-demo_b4d06aa7.png",
      previewAlt: "Repertoire Builder — interactive opening tree with Stockfish analysis",
      accent: isDark ? "text-[#5B9A6A]" : "text-[#3D6B47]",
      accentBg: isDark ? "bg-[#5B9A6A]/10" : "bg-[#3D6B47]/08",
      border: isDark ? "border-[#2e4a34]/60" : "border-gray-200",
      borderActive: isDark ? "border-[#5B9A6A]/50" : "border-[#3D6B47]/40",
      highlights: ["Stockfish 18 engine analysis", "Lichess database explorer", "Save & manage repertoires"],
    },
    {
      icon: Target,
      title: "Matchup Prep",
      subtitle: "Scout Report · Problem Lines · Game Plan",
      description:
        "Enter any chess.com username and get a deep pre-game scouting report in seconds. Discover your opponent's opening tendencies, preparation depth, recurring mistake patterns, and the exact moves where they most commonly go wrong.",
      cta: "Prepare for Opponent",
      href: "/prep",
      previewImg: "/manus-storage/video-editor-demo_b4d06aa7.png",
      previewAlt: "Matchup Prep — opponent scouting report with opening tendencies and mistake patterns",
      accent: isDark ? "text-[#5B9A6A]" : "text-[#3D6B47]",
      accentBg: isDark ? "bg-[#5B9A6A]/10" : "bg-[#3D6B47]/08",
      border: isDark ? "border-[#2e4a34]/60" : "border-gray-200",
      borderActive: isDark ? "border-[#5B9A6A]/50" : "border-[#3D6B47]/40",
      highlights: ["Opening tendency analysis", "Preparation depth scoring", "Recurring mistake patterns"],
    },
    {
      icon: BookOpen,
      title: "Openings Library",
      subtitle: "Study Lines · Drill Positions · Build Your Book",
      description:
        "Explore a curated library of 18+ openings and 110+ annotated lines. Study move-by-move with interactive boards, drill critical positions with spaced-repetition flashcards, and build a personalized repertoire tailored to your playing style.",
      cta: "Browse Openings",
      href: "/openings",
      previewImg: "/manus-storage/video-editor-demo_b4d06aa7.png",
      previewAlt: "Openings Library — curated opening lines with interactive board and drill mode",
      accent: isDark ? "text-[#5B9A6A]" : "text-[#3D6B47]",
      accentBg: isDark ? "bg-[#5B9A6A]/10" : "bg-[#3D6B47]/08",
      border: isDark ? "border-[#2e4a34]/60" : "border-gray-200",
      borderActive: isDark ? "border-[#5B9A6A]/50" : "border-[#3D6B47]/40",
      highlights: ["18+ openings covered", "110+ annotated lines", "Spaced-repetition drill mode"],
    },
  ];

  const handleCta = (f: FeatureCard) => {
    if (f.external) {
      window.open(f.href, "_blank", "noopener,noreferrer");
    } else {
      window.location.href = f.href;
    }
  };

  return (
    <div className={`relative min-h-screen ${isDark ? "bg-[#0a1409]" : "bg-[#f8faf8]"}`}>
      <BGPattern variant="checkerboard" mask="fade-top" fill={isDark ? "#5B9A6A" : "#3D6B47"} size={32} />
      <AppNavBar defaultActive="Training" />

      <div className="max-w-3xl mx-auto px-4 pt-16 pb-24">

        {/* ── Page Header ── */}
        <div className="text-center mb-12">
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest mb-4 ${
            isDark ? "bg-[#5B9A6A]/12 text-[#5B9A6A]" : "bg-[#3D6B47]/08 text-[#3D6B47]"
          }`}>
            <GraduationCap className="w-3.5 h-3.5" />
            Player Development
          </div>
          <h1 className={`text-3xl sm:text-4xl font-bold tracking-tight mb-3 ${isDark ? "text-white" : "text-gray-900"}`}>
            Training
          </h1>
          <p className={`text-base leading-relaxed max-w-md mx-auto ${isDark ? "text-white/70" : "text-gray-600"}`}>
            Study openings, build your repertoire, and scout your next opponent — everything you need to prepare and improve.
          </p>
        </div>

        {/* ── Feature Cards ── */}
        <div className="space-y-4">
          {features.map((f, idx) => {
            const Icon = f.icon;
            const isOpen = activeIdx === idx;

            return (
              <div
                key={f.href}
                className={`rounded-2xl border transition-all duration-300 overflow-hidden ${
                  isDark
                    ? `bg-[#0f1c11] ${isOpen ? f.borderActive : f.border} ${isOpen ? "shadow-xl shadow-[#5B9A6A]/20" : ""}`
                    : `bg-white shadow-sm ${isOpen ? f.borderActive : f.border} ${isOpen ? "shadow-xl shadow-[#3D6B47]/15" : ""}`
                }`}
              >
                {/* ── Collapsed header row (always visible, clickable) ── */}
                <button
                  onClick={() => setActiveIdx(isOpen ? null : idx)}
                  className={`w-full text-left p-5 sm:p-6 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset ${
                    isDark
                      ? `hover:bg-[#132817] focus-visible:ring-[#5B9A6A]`
                      : `hover:bg-gray-50/70 focus-visible:ring-[#3D6B47]`
                  }`}
                >
                  <div className="flex items-center gap-4">
                    {/* Icon */}
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${f.accentBg}`}>
                      <Icon className={`w-5 h-5 ${f.accent}`} />
                    </div>

                    {/* Title + badges */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <h2 className={`text-lg font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
                          {f.title}
                        </h2>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex-shrink-0 ${
                          isDark
                            ? "bg-amber-400/12 text-amber-400 border border-amber-400/25"
                            : "bg-amber-50 text-amber-600 border border-amber-200"
                        }`}>
                          <Zap className="w-2.5 h-2.5" />
                          In Beta
                        </span>
                        {f.external && (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0 ${
                            isDark
                              ? "bg-white/06 text-white/45 border border-white/10"
                              : "bg-gray-100 text-gray-400 border border-gray-200"
                          }`}>
                            <ExternalLink className="w-2.5 h-2.5" />
                            External
                          </span>
                        )}
                      </div>
                      <p className={`text-xs font-medium ${isDark ? "text-white/60" : "text-gray-500"}`}>
                        {f.subtitle}
                      </p>
                    </div>

                    {/* Expand / collapse indicator */}
                    <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-300 ${
                      isOpen
                        ? isDark ? "bg-[#5B9A6A]/20 text-[#5B9A6A]" : "bg-[#3D6B47]/10 text-[#3D6B47]"
                        : isDark ? "text-white/25" : "text-gray-300"
                    }`}>
                      {isOpen
                        ? <X className="w-4 h-4" />
                        : <ChevronRight className="w-4 h-4" />
                      }
                    </div>
                  </div>
                </button>

                {/* ── Expanded preview panel ── */}
                {isOpen && (
                  <div className={`border-t ${isDark ? "border-[#1e3a22]" : "border-gray-100"}`}>
                    {/* Side-by-side layout */}
                    <div className="flex flex-col sm:flex-row">

                      {/* Left: demo screenshot */}
                      <div className={`sm:w-[55%] shrink-0 ${isDark ? "bg-[#0a1409]" : "bg-gray-950"} flex items-center justify-center overflow-hidden`}>
                        <img
                          src={f.previewImg}
                          alt={f.previewAlt}
                          className="w-full h-full object-cover object-top max-h-72 sm:max-h-none sm:h-64 lg:h-72"
                          loading="lazy"
                          decoding="async"
                        />
                      </div>

                      {/* Right: description + highlights + CTA */}
                      <div className={`flex-1 p-5 sm:p-6 flex flex-col justify-between gap-4 ${
                        isDark ? "bg-[#0f1c11]" : "bg-white"
                      }`}>
                        {/* Description */}
                        <p className={`text-sm leading-relaxed ${isDark ? "text-white/75" : "text-gray-600"}`}>
                          {f.description}
                        </p>

                        {/* Highlight pills */}
                        <div className="flex flex-wrap gap-2">
                          {f.highlights.map((h) => (
                            <span
                              key={h}
                              className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${
                                isDark ? "bg-white/08 text-white/65" : "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {h}
                            </span>
                          ))}
                        </div>

                        {/* CTA button */}
                        <button
                          onClick={() => handleCta(f)}
                          className={`inline-flex items-center justify-center gap-2 w-full sm:w-auto px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 active:scale-[0.97] ${
                            isDark
                              ? "bg-[#5B9A6A] hover:bg-[#4e8a5c] text-white shadow-lg shadow-[#5B9A6A]/25"
                              : "bg-[#3D6B47] hover:bg-[#2f5438] text-white shadow-md shadow-[#3D6B47]/20"
                          }`}
                        >
                          {f.cta}
                          {f.external
                            ? <ExternalLink className="w-3.5 h-3.5" />
                            : <ArrowRight className="w-3.5 h-3.5" />
                          }
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Coming Soon teaser ── */}
        <div className={`mt-6 rounded-2xl border border-dashed p-5 text-center ${
          isDark ? "border-white/08 bg-white/02" : "border-gray-200 bg-gray-50/50"
        }`}>
          <div className="flex items-center justify-center gap-2 mb-1.5">
            <Brain className={`w-4 h-4 ${isDark ? "text-white/20" : "text-gray-300"}`} />
            <Zap className={`w-4 h-4 ${isDark ? "text-white/20" : "text-gray-300"}`} />
          </div>
          <p className={`text-sm font-medium mb-0.5 ${isDark ? "text-white/55" : "text-gray-500"}`}>
            More training tools coming soon
          </p>
          <p className={`text-xs ${isDark ? "text-white/40" : "text-gray-400"}`}>
            Endgame drills · Tactics trainer · Personalized study plans
          </p>
        </div>

      </div>
    </div>
  );
}
