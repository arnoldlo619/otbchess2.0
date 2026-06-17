/**
 * Training Hub — /training
 *
 * Gallery4-style horizontal scrolling carousel.
 * Each feature card has its own individualized image, description, highlights, and CTA.
 */
import { useState } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { GraduationCap, Brain, Zap, X } from "lucide-react";
import { AppNavBar } from "@/components/AppNavBar";
import { BGPattern } from "@/components/ui/bg-pattern";
import { TrainingGallery, type TrainingFeatureItem } from "@/components/ui/training-gallery";

// ─── Feature Data ─────────────────────────────────────────────────────────────
// Images: Video Editor uses the uploaded screenshot; others use curated Unsplash
// images that represent chess study, analysis, and opening preparation.
const FEATURES: TrainingFeatureItem[] = [
  {
    id: "video-editor",
    title: "Video Editor",
    description:
      "Upload your OTB game video and open a side-by-side editor: your video plays on the left while a live interactive digital chessboard sits on the right. Register each move as you watch, then export a polished video with the board overlay embedded.",
    cta: "Open Video Editor",
    href: "https://otbanalysis.lovable.app",
    external: true,
    image: "/manus-storage/video-editor-demo_b4d06aa7.png",
    imageAlt: "Video Editor — side-by-side OTB game video and interactive digital chessboard",
    highlights: ["Side-by-side video + board", "Live move registration", "Export with board overlay"],
  },
  {
    id: "repertoire-builder",
    title: "Repertoire Builder",
    description:
      "Build your own opening repertoire with an interactive chessboard powered by Stockfish 18. Explore candidate moves from the Lichess database, see frequency and win-rate data, and save your preparation lines.",
    cta: "Build Repertoire",
    href: "/repertoire",
    image:
      "/manus-storage/repertoire-builder-demo_2866e1f4.webp",
    imageAlt: "Repertoire Builder — chess pieces on a board representing opening preparation",
    highlights: ["Stockfish 18 engine", "Lichess database explorer", "Save & manage repertoires"],
  },
  {
    id: "matchup-prep",
    title: "Matchup Prep",
    description:
      "Enter any chess.com username and get a deep pre-game scouting report in seconds. Discover your opponent's opening tendencies, preparation depth, and the exact moves where they most commonly go wrong.",
    cta: "Prepare for Opponent",
    href: "/prep",
    image:
      "/manus-storage/matchup-prep-demo_02ab6c2d.webp",
    imageAlt: "Matchup Prep — chess analysis and opponent scouting",
    highlights: ["Opening tendency analysis", "Preparation depth scoring", "Recurring mistake patterns"],
  },
  {
    id: "openings-library",
    title: "Openings Library",
    description:
      "Explore a curated library of 18+ openings and 110+ annotated lines. Study move-by-move with interactive boards, drill critical positions with spaced-repetition flashcards, and build a personalized repertoire.",
    cta: "Browse Openings",
    href: "/openings",
    image:
      "/manus-storage/openings-library-demo_29aa7bc2.webp",
    imageAlt: "Openings Library — chess board with opening position study",
    highlights: ["18+ openings covered", "110+ annotated lines", "Spaced-repetition drills"],
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Training() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  return (
    <div className={`relative min-h-screen ${isDark ? "bg-[#0a1409]" : "bg-[#f8faf8]"}`}>
      <BGPattern variant="checkerboard" mask="fade-top" fill={isDark ? "#5B9A6A" : "#3D6B47"} size={32} />
      <AppNavBar defaultActive="Training" />

      <div className="max-w-5xl mx-auto px-4 pt-24 pb-24">

        {/* ── Page Header ── */}
        <div className="text-center mb-12">
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest mb-4 ${
            isDark ? "bg-[#5B9A6A]/12 text-[#5B9A6A]" : "bg-[#3D6B47]/08 text-[#3D6B47]"
          }`}>
            <GraduationCap className="w-3.5 h-3.5" />
            Player Development
          </div>
          <h1
            className={`text-3xl sm:text-4xl font-bold tracking-tight mb-3 ${isDark ? "text-white" : "text-gray-900"}`}
            style={{ fontFamily: "'Clash Display', sans-serif" }}
          >
            Training
          </h1>
          <p className={`text-base leading-relaxed max-w-md mx-auto ${isDark ? "text-white/70" : "text-gray-600"}`}>
            Study openings, build your repertoire, and scout your next opponent — everything you need to prepare and improve.
          </p>
        </div>

        {/* ── Gallery4 Carousel ── */}
        <TrainingGallery
          title="Feature Toolkit"
          description="Four tools to sharpen your preparation, study your openings, and analyse your games."
          items={FEATURES}
          onImageClick={(src) => setLightboxSrc(src)}
        />

        {/* ── Coming Soon teaser ── */}
        <div className={`mt-10 rounded-2xl border border-dashed p-5 text-center ${
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

      {/* ── Lightbox overlay ── */}
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
          onClick={() => setLightboxSrc(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Screenshot fullscreen view"
        >
          <button
            onClick={() => setLightboxSrc(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            aria-label="Close fullscreen view"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={lightboxSrc}
            alt="Feature demo fullscreen"
            onClick={(e) => e.stopPropagation()}
            className="max-w-[92vw] max-h-[88vh] rounded-xl shadow-2xl object-contain"
          />
          <p className="absolute bottom-5 left-1/2 -translate-x-1/2 text-white/40 text-xs select-none">
            Click outside to close
          </p>
        </div>
      )}
    </div>
  );
}
