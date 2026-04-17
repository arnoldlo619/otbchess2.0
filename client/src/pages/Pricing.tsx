/**
 * Pricing — /pricing
 *
 * Public page detailing the Free vs Pro feature tiers.
 * During open beta all Pro features are free — this is clearly communicated
 * with an Open Beta banner at the top and a "Free right now" callout on the
 * Pro card. Future pricing is shown so users understand the value before
 * paid plans launch.
 *
 * When paid plans launch:
 *   1. Remove or update the BETA_OPEN banner
 *   2. Update the Pro card CTA to trigger Stripe checkout
 *   3. Flip BETA_OPEN = false in OpeningsProGate.tsx
 */

import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  Check,
  Minus,
  Crown,
  Sparkles,
  Trophy,
  Users,
  Shield,
  Zap,
  BookOpen,
  Brain,
  Target,
  Video,
  ArrowLeft,
  Gift,
  Star,
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useState } from "react";
import { ProUpgradeModal } from "@/components/ProUpgradeModal";
import AuthModal from "@/components/AuthModal";

// ─── Feature table data ───────────────────────────────────────────────────────
interface FeatureRow {
  label: string;
  icon: React.ElementType;
  free: string | boolean;
  pro: string | boolean;
  category: string;
}

const FEATURES: FeatureRow[] = [
  // Tournaments
  { category: "Tournaments",  label: "Tournament creation",        icon: Trophy,   free: true,          pro: true },
  { category: "Tournaments",  label: "Player registration",        icon: Users,    free: "Up to 16",    pro: "Unlimited" },
  { category: "Tournaments",  label: "Swiss & Elimination formats",icon: Shield,   free: true,          pro: true },
  { category: "Tournaments",  label: "Live scoreboard & pairings", icon: Zap,      free: true,          pro: true },
  { category: "Tournaments",  label: "QR join links",              icon: Zap,      free: true,          pro: true },
  // Openings
  { category: "Openings",     label: "Openings library (16+ lines)",icon: BookOpen, free: false,         pro: true },
  { category: "Openings",     label: "Opening explorer",           icon: Target,   free: false,         pro: true },
  { category: "Openings",     label: "Study mode",                 icon: Brain,    free: false,         pro: true },
  { category: "Openings",     label: "Drill mode",                 icon: Target,   free: false,         pro: true },
  { category: "Openings",     label: "Trap lines",                 icon: Zap,      free: false,         pro: true },
  // Analysis
  { category: "Analysis",     label: "Coach insights",             icon: Brain,    free: "3 / month",   pro: "Unlimited" },
  { category: "Analysis",     label: "Prep reports",               icon: Target,   free: "3 / month",   pro: "Unlimited" },
  { category: "Analysis",     label: "Video analysis",             icon: Video,    free: "3 / month",   pro: "Unlimited" },
  { category: "Analysis",     label: "Game history",               icon: Shield,   free: true,          pro: true },
  // Clubs
  { category: "Clubs",        label: "Club creation & management", icon: Users,    free: true,          pro: true },
  { category: "Clubs",        label: "Club battles",               icon: Shield,   free: false,         pro: true },
  { category: "Clubs",        label: "Club leaderboard",           icon: Trophy,   free: true,          pro: true },
  // Support
  { category: "Support",      label: "Community support",          icon: Star,     free: true,          pro: true },
  { category: "Support",      label: "Priority support",           icon: Zap,      free: false,         pro: true },
  { category: "Support",      label: "Early access features",      icon: Crown,    free: false,         pro: true },
];

const CATEGORIES = ["Tournaments", "Openings", "Analysis", "Clubs", "Support"];

// ─── Cell renderer ────────────────────────────────────────────────────────────
function Cell({ value, isProCol }: { value: string | boolean; isProCol?: boolean }) {
  if (value === true) {
    return (
      <div className="flex justify-center">
        <div className={`w-5 h-5 rounded-full flex items-center justify-center ${isProCol ? "bg-[#22c55e]/15" : "bg-white/[0.06]"}`}>
          <Check className={`w-3 h-3 ${isProCol ? "text-[#22c55e]" : "text-white/40"}`} />
        </div>
      </div>
    );
  }
  if (value === false) {
    return (
      <div className="flex justify-center">
        <Minus className="w-4 h-4 text-white/15" />
      </div>
    );
  }
  return (
    <span className={`text-xs font-medium ${isProCol ? "text-[#22c55e]" : "text-white/50"}`}>
      {value}
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function Pricing() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [modalOpen, setModalOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);

  const fadeUp = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.45, ease: "easeOut" as const },
  };

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0a] text-white" : "bg-[#F2F7F3] text-[#1a1a1a]"}`}>

      {/* ── Nav bar ─────────────────────────────────────────────────────────── */}
      <nav className={`sticky top-0 z-50 border-b backdrop-blur-md ${isDark ? "bg-[#0a0a0a]/90 border-white/[0.06]" : "bg-[#F2F7F3]/90 border-[#3D6B47]/10"}`}>
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <ArrowLeft className={`w-4 h-4 transition-transform group-hover:-translate-x-0.5 ${isDark ? "text-white/40" : "text-[#3D6B47]/60"}`} />
            <img
              src="https://files.manuscdn.com/user_upload_by_module/session_file/117675823/bWANpVvGVfpfXSpZ.png"
              alt="OTB Chess"
              className="h-7 w-auto object-contain"
            />
          </Link>
          <div className={`text-xs font-semibold uppercase tracking-wider ${isDark ? "text-white/30" : "text-[#3D6B47]/50"}`}>
            Pricing
          </div>
        </div>
      </nav>

      {/* ── Open Beta banner ────────────────────────────────────────────────── */}
      <div className="bg-[#0d1a0f] border-b border-[#22c55e]/20">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#22c55e]/10 border border-[#22c55e]/25">
            <Sparkles className="w-3 h-3 text-[#22c55e]" />
            <span className="text-[#22c55e] text-[10px] font-bold uppercase tracking-wider">Open Beta</span>
          </div>
          <p className="text-white/60 text-xs">
            All Pro features are <span className="text-white font-semibold">free right now</span> — no account or credit card needed.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-16">

        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <motion.div {...fadeUp} className="text-center mb-14">
          <h1 className={`text-4xl md:text-5xl font-bold tracking-tight mb-4 ${isDark ? "text-white" : "text-[#1a1a1a]"}`}>
            Simple, honest pricing.
          </h1>
          <p className={`text-lg max-w-xl mx-auto leading-relaxed ${isDark ? "text-white/50" : "text-[#4B5563]"}`}>
            Start free and grow with your club. Pro unlocks the full toolkit —
            openings, analysis, and unlimited everything.
          </p>
        </motion.div>

        {/* ── Plan cards ────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
          className="grid md:grid-cols-2 gap-5 mb-16"
        >
          {/* Free card */}
          <div className={`rounded-2xl border p-7 ${isDark ? "bg-white/[0.02] border-white/[0.08]" : "bg-white border-[#3D6B47]/12"}`}>
            <div className="mb-5">
              <p className={`text-xs font-bold uppercase tracking-widest mb-2 ${isDark ? "text-white/40" : "text-[#4B5563]"}`}>Free</p>
              <div className="flex items-baseline gap-1.5">
                <span className={`text-4xl font-bold ${isDark ? "text-white" : "text-[#1a1a1a]"}`}>$0</span>
                <span className={`text-sm ${isDark ? "text-white/30" : "text-[#9CA3AF]"}`}>/ month</span>
              </div>
              <p className={`text-sm mt-2 ${isDark ? "text-white/40" : "text-[#6B7280]"}`}>
                Everything you need to run a club tournament.
              </p>
            </div>
            <Link href="/join">
              <button className={`w-full py-3 rounded-xl text-sm font-semibold transition-colors border ${isDark ? "border-white/10 text-white/70 hover:bg-white/[0.05]" : "border-[#3D6B47]/20 text-[#3D6B47] hover:bg-[#3D6B47]/05"}`}>
                Get started free
              </button>
            </Link>
          </div>

          {/* Pro card */}
          <div className="rounded-2xl border border-[#22c55e]/30 bg-[#0d1a0f] p-7 relative overflow-hidden">
            {/* Glow */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-0 right-0 w-48 h-48 bg-[#22c55e]/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            </div>

            {/* Open Beta badge */}
            <div className="absolute top-5 right-5 flex items-center gap-1 px-2 py-1 rounded-full bg-[#22c55e]/10 border border-[#22c55e]/25">
              <Gift className="w-3 h-3 text-[#22c55e]" />
              <span className="text-[#22c55e] text-[10px] font-bold uppercase tracking-wider">Free now</span>
            </div>

            <div className="mb-5 relative">
              <div className="flex items-center gap-2 mb-2">
                <Crown className="w-4 h-4 text-[#22c55e]" />
                <p className="text-[#22c55e] text-xs font-bold uppercase tracking-widest">Pro</p>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-white/25 text-2xl font-bold line-through decoration-white/20">$9.99</span>
                <span className="text-white/20 text-sm">/ month</span>
              </div>
              <p className="text-[#22c55e] text-sm font-semibold mt-1">Free during open beta</p>
              <p className="text-white/40 text-xs mt-1">
                Full access now. Founding member rate when paid plans launch.
              </p>
            </div>

            <button
              onClick={() => setModalOpen(true)}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold bg-[#22c55e] hover:bg-[#16a34a] text-black transition-colors relative"
            >
              <Sparkles className="w-4 h-4" />
              Upgrade to Pro
            </button>
          </div>
        </motion.div>

        {/* ── Feature comparison table ───────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
        >
          <h2 className={`text-xl font-bold mb-6 ${isDark ? "text-white" : "text-[#1a1a1a]"}`}>
            Full feature breakdown
          </h2>

          <div className={`rounded-2xl border overflow-hidden ${isDark ? "border-white/[0.07]" : "border-[#3D6B47]/12"}`}>
            {/* Table header */}
            <div className={`grid grid-cols-[1fr_100px_100px] border-b ${isDark ? "bg-white/[0.02] border-white/[0.07]" : "bg-[#3D6B47]/[0.03] border-[#3D6B47]/10"}`}>
              <div className={`px-5 py-3 text-xs font-bold uppercase tracking-wider ${isDark ? "text-white/30" : "text-[#6B7280]"}`}>
                Feature
              </div>
              <div className={`px-3 py-3 text-center text-xs font-bold uppercase tracking-wider ${isDark ? "text-white/30" : "text-[#6B7280]"}`}>
                Free
              </div>
              <div className="px-3 py-3 text-center text-xs font-bold uppercase tracking-wider text-[#22c55e]">
                Pro
              </div>
            </div>

            {/* Rows grouped by category */}
            {CATEGORIES.map((cat, catIdx) => {
              const rows = FEATURES.filter((f) => f.category === cat);
              return (
                <div key={cat}>
                  {/* Category header */}
                  <div className={`grid grid-cols-[1fr_100px_100px] border-b ${isDark ? "bg-white/[0.015] border-white/[0.05]" : "bg-[#3D6B47]/[0.02] border-[#3D6B47]/08"} ${catIdx > 0 ? "border-t" : ""}`}>
                    <div className={`px-5 py-2 text-[11px] font-bold uppercase tracking-widest ${isDark ? "text-white/20" : "text-[#9CA3AF]"}`}>
                      {cat}
                    </div>
                    <div />
                    <div />
                  </div>

                  {/* Feature rows */}
                  {rows.map((row, rowIdx) => {
                    const Icon = row.icon;
                    return (
                      <div
                        key={row.label}
                        className={`grid grid-cols-[1fr_100px_100px] items-center border-b ${
                          isDark
                            ? `border-white/[0.04] ${rowIdx % 2 === 0 ? "" : "bg-white/[0.01]"}`
                            : `border-[#3D6B47]/06 ${rowIdx % 2 === 0 ? "" : "bg-[#3D6B47]/[0.015]"}`
                        }`}
                      >
                        <div className="flex items-center gap-2.5 px-5 py-3">
                          <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${isDark ? "text-white/25" : "text-[#9CA3AF]"}`} />
                          <span className={`text-sm ${isDark ? "text-white/65" : "text-[#374151]"}`}>
                            {row.label}
                          </span>
                        </div>
                        <div className="px-3 py-3 flex justify-center">
                          <Cell value={row.free} />
                        </div>
                        <div className="px-3 py-3 flex justify-center">
                          <Cell value={row.pro} isProCol />
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {/* Footer row */}
            <div className={`grid grid-cols-[1fr_100px_100px] ${isDark ? "bg-white/[0.02]" : "bg-[#3D6B47]/[0.02]"}`}>
              <div className="px-5 py-4" />
              <div className="px-3 py-4 flex justify-center">
                <Link href="/join">
                  <button className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${isDark ? "border-white/10 text-white/50 hover:text-white hover:border-white/20" : "border-[#3D6B47]/20 text-[#3D6B47] hover:bg-[#3D6B47]/05"}`}>
                    Get free
                  </button>
                </Link>
              </div>
              <div className="px-3 py-4 flex justify-center">
                <button
                  onClick={() => setModalOpen(true)}
                  className="text-xs font-bold px-3 py-1.5 rounded-lg bg-[#22c55e] hover:bg-[#16a34a] text-black transition-colors"
                >
                  Get Pro
                </button>
              </div>
            </div>
          </div>

          {/* Beta footnote */}
          <p className={`text-center text-xs mt-5 leading-relaxed ${isDark ? "text-white/20" : "text-[#9CA3AF]"}`}>
            During open beta the Pro column is fully accessible to all users at no cost.
            The table above reflects the planned post-beta tier structure.
          </p>
        </motion.div>

        {/* ── FAQ / reassurance strip ────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3, ease: "easeOut" }}
          className="mt-16 grid sm:grid-cols-3 gap-6"
        >
          {[
            {
              icon: Gift,
              title: "Free during open beta",
              body: "Every Pro feature is unlocked for all users while we build and refine the platform.",
            },
            {
              icon: Crown,
              title: "Founding member rate",
              body: "Beta users will receive a special discounted rate when paid plans launch — no action needed.",
            },
            {
              icon: Shield,
              title: "No credit card, ever",
              body: "We will never charge you without explicit opt-in. Cancel or stay free anytime.",
            },
          ].map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className={`rounded-xl border p-5 ${isDark ? "bg-white/[0.02] border-white/[0.06]" : "bg-white border-[#3D6B47]/10"}`}
            >
              <div className="w-8 h-8 rounded-lg bg-[#22c55e]/10 flex items-center justify-center mb-3">
                <Icon className="w-4 h-4 text-[#22c55e]" />
              </div>
              <p className={`text-sm font-semibold mb-1 ${isDark ? "text-white/90" : "text-[#1a1a1a]"}`}>{title}</p>
              <p className={`text-xs leading-relaxed ${isDark ? "text-white/40" : "text-[#6B7280]"}`}>{body}</p>
            </div>
          ))}
        </motion.div>

        {/* ── Back to home ──────────────────────────────────────────────────── */}
        <div className="mt-14 text-center">
          <Link href="/">
            <button className={`inline-flex items-center gap-2 text-sm font-medium transition-colors ${isDark ? "text-white/30 hover:text-white/60" : "text-[#9CA3AF] hover:text-[#4B5563]"}`}>
              <ArrowLeft className="w-4 h-4" />
              Back to home
            </button>
          </Link>
        </div>
      </div>

      {/* ── ProUpgradeModal ────────────────────────────────────────────────── */}
      <ProUpgradeModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onNeedsAuth={() => { setModalOpen(false); setAuthOpen(true); }}
      />
      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  );
}
