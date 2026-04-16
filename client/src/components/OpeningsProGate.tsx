/**
 * OpeningsProGate — Pro subscription gate for the Openings feature.
 *
 * Renders children when the user is a Pro member.
 * For free users (including guests and unauthenticated visitors), renders
 * a premium upgrade CTA that clearly communicates the value of Pro.
 *
 * Usage:
 *   <OpeningsProGate>
 *     <OpeningsLibrary />
 *   </OpeningsProGate>
 */
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { motion } from "framer-motion";
import {
  BookOpen,
  Crown,
  Zap,
  Target,
  Brain,
  ChevronRight,
  Lock,
  Star,
} from "lucide-react";

// ─── Pro feature highlights ───────────────────────────────────────────────────
const PRO_FEATURES = [
  {
    icon: BookOpen,
    title: "Opening Library",
    description: "Browse 16 premium openings across all styles and levels.",
  },
  {
    icon: Brain,
    title: "Study Mode",
    description: "Move-by-move interactive study with explanations and hints.",
  },
  {
    icon: Target,
    title: "Drill Mode",
    description: "Reinforce lines with spaced repetition and practice drills.",
  },
  {
    icon: Zap,
    title: "Trap Lines",
    description: "Learn the most dangerous traps your opponents walk into.",
  },
];

// ─── Component ────────────────────────────────────────────────────────────────
interface OpeningsProGateProps {
  children: React.ReactNode;
}

export function OpeningsProGate({ children }: OpeningsProGateProps) {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();

  // While auth is loading, show a minimal skeleton to avoid layout flash
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#22c55e]/30 border-t-[#22c55e] rounded-full animate-spin" />
      </div>
    );
  }

  // Pro users (and the owner) see the full content
  if (user?.isPro) {
    return <>{children}</>;
  }

  // ── Upgrade CTA ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      {/* Hero section */}
      <div className="relative flex-1 flex flex-col items-center justify-center px-6 py-20 overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#22c55e]/5 rounded-full blur-3xl" />
          <div className="absolute top-1/4 right-1/4 w-[300px] h-[300px] bg-[#22c55e]/3 rounded-full blur-2xl" />
        </div>

        {/* Lock badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="relative mb-8 flex items-center justify-center w-20 h-20 rounded-2xl bg-[#22c55e]/10 border border-[#22c55e]/20"
        >
          <Lock className="w-9 h-9 text-[#22c55e]" />
        </motion.div>

        {/* Headline */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-center max-w-lg"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#22c55e]/10 border border-[#22c55e]/20 text-[#22c55e] text-xs font-semibold tracking-wider uppercase mb-5">
            <Crown className="w-3.5 h-3.5" />
            Pro Feature
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 leading-tight">
            Master your openings.<br />
            <span className="text-[#22c55e]">Play better chess.</span>
          </h1>
          <p className="text-white/50 text-lg leading-relaxed">
            The Openings Library is a Pro feature. Study lines, drill positions,
            and learn the traps that win games at club level.
          </p>
        </motion.div>

        {/* Feature grid */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25 }}
          className="grid grid-cols-2 gap-3 mt-10 max-w-xl w-full"
        >
          {PRO_FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="flex gap-3 p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-[#22c55e]/20 transition-colors"
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-[#22c55e]/10 flex items-center justify-center">
                  <Icon className="w-4 h-4 text-[#22c55e]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white/90 mb-0.5">{feature.title}</p>
                  <p className="text-xs text-white/40 leading-relaxed">{feature.description}</p>
                </div>
              </div>
            );
          })}
        </motion.div>

        {/* CTA buttons */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="flex flex-col sm:flex-row gap-3 mt-10 w-full max-w-sm"
        >
          {user ? (
            // Logged-in free user — show upgrade button
            <button
              onClick={() => navigate("/")}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[#22c55e] hover:bg-[#16a34a] text-black font-bold text-sm transition-colors"
            >
              <Crown className="w-4 h-4" />
              Upgrade to Pro
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            // Unauthenticated visitor — show sign in and upgrade options
            <>
              <button
                onClick={() => navigate("/login")}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-white font-semibold text-sm transition-colors border border-white/10"
              >
                Sign In
              </button>
              <button
                onClick={() => navigate("/")}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[#22c55e] hover:bg-[#16a34a] text-black font-bold text-sm transition-colors"
              >
                <Crown className="w-4 h-4" />
                Get Pro
              </button>
            </>
          )}
        </motion.div>

        {/* Social proof */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.55 }}
          className="flex items-center gap-2 mt-8 text-white/30 text-xs"
        >
          <div className="flex -space-x-1.5">
            {["bg-emerald-500", "bg-blue-500", "bg-purple-500", "bg-orange-500"].map((color, i) => (
              <div
                key={i}
                className={`w-6 h-6 rounded-full ${color} border-2 border-[#0a0a0a] flex items-center justify-center`}
              >
                <Star className="w-2.5 h-2.5 text-white" />
              </div>
            ))}
          </div>
          <span>Trusted by club players worldwide</span>
        </motion.div>
      </div>

      {/* Bottom banner for logged-in free users */}
      {user && !user.isPro && (
        <div className="border-t border-white/[0.06] bg-[#0d0d0d] px-6 py-4">
          <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
            <p className="text-white/40 text-sm">
              Signed in as <span className="text-white/60 font-medium">{user.displayName}</span>
            </p>
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-1.5 text-[#22c55e] text-sm font-semibold hover:text-[#4ade80] transition-colors"
            >
              Upgrade to Pro <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
