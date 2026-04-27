/**
 * Training Hub — /training
 *
 * Central hub for all player development features:
 *   1. Openings & Repertoire — study and drill opening lines
 *   2. Matchup Prep — deep scout analysis against any chess.com player
 */
import { useLocation } from "wouter";
import { useTheme } from "@/contexts/ThemeContext";
import { BookOpen, Target, ChevronRight, GraduationCap, Zap, Brain } from "lucide-react";
import { AppNavBar } from "@/components/AppNavBar";

export default function Training() {
  const [, navigate] = useLocation();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const features = [
    {
      icon: BookOpen,
      title: "Openings & Repertoire",
      subtitle: "Study Lines · Drill Positions · Build Your Book",
      description:
        "Explore a curated library of 18+ openings and 110+ annotated lines. Study move-by-move with interactive boards, drill critical positions with spaced-repetition flashcards, and build a personalized repertoire tailored to your playing style.",
      cta: "Browse Openings",
      href: "/openings",
      accent: isDark ? "text-[#5B9A6A]" : "text-[#3D6B47]",
      accentBg: isDark ? "bg-[#5B9A6A]/10" : "bg-[#3D6B47]/08",
      border: isDark ? "border-[#2e4a34]/60 hover:border-[#5B9A6A]/40" : "border-gray-200 hover:border-[#3D6B47]/40",
      highlights: ["18+ openings covered", "110+ annotated lines", "Spaced-repetition drill mode"],
    },
    {
      icon: Target,
      title: "Matchup Prep",
      subtitle: "Scout Report · Problem Lines · Game Plan",
      description:
        "Enter any chess.com username and get a deep pre-game scouting report in seconds. Discover your opponent's opening tendencies, preparation depth, recurring mistake patterns, and the exact moves where they most commonly go wrong.",
      cta: "Prepare for Opponent",
      href: "/prep",
      accent: isDark ? "text-blue-400" : "text-blue-600",
      accentBg: isDark ? "bg-blue-500/10" : "bg-blue-50",
      border: isDark ? "border-blue-500/20 hover:border-blue-500/40" : "border-blue-200/60 hover:border-blue-400/60",
      highlights: ["Opening tendency analysis", "Preparation depth scoring", "Recurring mistake patterns"],
    },
  ];

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a1409]" : "bg-[#f8faf8]"}`}>
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
          <p className={`text-base leading-relaxed max-w-md mx-auto ${isDark ? "text-white/50" : "text-gray-500"}`}>
            Study openings, build your repertoire, and scout your next opponent — everything you need to prepare and improve.
          </p>
        </div>

        {/* ── Feature Cards ── */}
        <div className="space-y-4">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <button
                key={f.href}
                onClick={() => navigate(f.href)}
                className={`w-full text-left rounded-2xl border p-5 sm:p-6 transition-all duration-200 active:scale-[0.99] group ${
                  isDark
                    ? `bg-[#0f1c11] ${f.border}`
                    : `bg-white shadow-sm ${f.border}`
                }`}
              >
                {/* Header row */}
                <div className="flex items-start gap-4 mb-4">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${f.accentBg}`}>
                    <Icon className={`w-5 h-5 ${f.accent}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className={`text-lg font-bold mb-0.5 ${isDark ? "text-white" : "text-gray-900"}`}>
                      {f.title}
                    </h2>
                    <p className={`text-xs font-medium ${isDark ? "text-white/35" : "text-gray-400"}`}>
                      {f.subtitle}
                    </p>
                  </div>
                  <ChevronRight className={`w-5 h-5 shrink-0 mt-1 transition-transform group-hover:translate-x-0.5 ${isDark ? "text-white/20" : "text-gray-300"}`} />
                </div>

                {/* Description */}
                <p className={`text-sm leading-relaxed mb-4 ${isDark ? "text-white/55" : "text-gray-500"}`}>
                  {f.description}
                </p>

                {/* Highlight pills */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {f.highlights.map((h) => (
                    <span
                      key={h}
                      className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${
                        isDark ? "bg-white/05 text-white/40" : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {h}
                    </span>
                  ))}
                </div>

                {/* CTA */}
                <div className={`inline-flex items-center gap-1.5 text-sm font-semibold ${f.accent}`}>
                  {f.cta}
                  <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                </div>
              </button>
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
          <p className={`text-sm font-medium mb-0.5 ${isDark ? "text-white/30" : "text-gray-400"}`}>
            More training tools coming soon
          </p>
          <p className={`text-xs ${isDark ? "text-white/18" : "text-gray-300"}`}>
            Endgame drills · Tactics trainer · Personalized study plans
          </p>
        </div>

      </div>
    </div>
  );
}
