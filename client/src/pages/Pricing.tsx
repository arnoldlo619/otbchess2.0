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
  Gift,
  Star,
  Eye,
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useState } from "react";
import { ProUpgradeModal } from "@/components/ProUpgradeModal";
import AuthModal from "@/components/AuthModal";
import { AppNavBar } from "@/components/AppNavBar";

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
  { category: "Tournaments",  label: "Tournament creation",          icon: Trophy,   free: true,          pro: true },
  { category: "Tournaments",  label: "Player registration",          icon: Users,    free: "Up to 16",    pro: "Unlimited" },
  { category: "Tournaments",  label: "Swiss & Elimination formats",  icon: Shield,   free: true,          pro: true },
  { category: "Tournaments",  label: "Live scoreboard & pairings",   icon: Zap,      free: true,          pro: true },
  { category: "Tournaments",  label: "QR join links",                icon: Zap,      free: true,          pro: true },
  // Openings
  { category: "Openings",     label: "Openings library (16+ lines)", icon: BookOpen, free: false,         pro: true },
  { category: "Openings",     label: "Opening explorer",             icon: Target,   free: false,         pro: true },
  { category: "Openings",     label: "Study mode",                   icon: Brain,    free: false,         pro: true },
  { category: "Openings",     label: "Drill mode",                   icon: Target,   free: false,         pro: true },
  { category: "Openings",     label: "Trap lines",                   icon: Zap,      free: false,         pro: true },
  // Analysis
  { category: "Analysis",     label: "Coach insights",               icon: Brain,    free: "3 / month",   pro: "Unlimited" },
  { category: "Analysis",     label: "Prep reports",                 icon: Target,   free: "3 / month",   pro: "Unlimited" },
  { category: "Analysis",     label: "Video analysis",               icon: Video,    free: "3 / month",   pro: "Unlimited" },
  { category: "Analysis",     label: "Game history",                 icon: Shield,   free: true,          pro: true },
  { category: "Analysis",     label: "Repertoire Builder (Beta)",    icon: BookOpen, free: true,          pro: true },
  // Clubs
  { category: "Clubs",        label: "Club creation & management",   icon: Users,    free: true,          pro: true },
  { category: "Clubs",        label: "Club battles",                 icon: Shield,   free: false,         pro: true },
  { category: "Clubs",        label: "Club leaderboard",             icon: Trophy,   free: true,          pro: true },
  // Support
  { category: "Support",      label: "Community support",            icon: Star,     free: true,          pro: true },
  { category: "Support",      label: "Priority support",             icon: Zap,      free: false,         pro: true },
  { category: "Support",      label: "Early access features",        icon: Crown,    free: false,         pro: true },
];

const CATEGORIES = ["Tournaments", "Openings", "Analysis", "Clubs", "Support"];

// ─── Cell renderer ────────────────────────────────────────────────────────────
function Cell({ value, isProCol }: { value: string | boolean; isProCol?: boolean }) {
  if (value === true) {
    return (
      <div className="flex justify-center">
        <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-transform group-hover:scale-110 ${isProCol ? "bg-[#22c55e]/20" : "bg-white/[0.07]"}`}>
          <Check className={`w-3 h-3 ${isProCol ? "text-[#22c55e]" : "text-white/50"}`} />
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
    <span className={`text-xs font-semibold ${isProCol ? "text-[#22c55e]" : "text-white/50"}`}>
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
    initial: { opacity: 0, y: 24 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5, ease: "easeOut" as const },
  };

  return (
    <div className={`min-h-screen relative ${isDark ? "bg-[#0d1a0f] text-white" : "bg-[#F2F7F3] text-[#1a1a1a]"}`}>

      {/* ── Micro-checkered background (same as Home hero) ─────────────────── */}
      <div className="chess-board-bg absolute inset-0 pointer-events-none" style={{ opacity: isDark ? 1 : 0.6 }} />

      {/* ── AppNavBar ───────────────────────────────────────────────────────── */}
      <AppNavBar defaultActive="" />

      {/* ── Open Beta banner ────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className={`relative z-10 border-b ${isDark ? "bg-[#0a1a0c]/80 border-[#22c55e]/20" : "bg-[#f0fdf4]/80 border-[#22c55e]/25"} backdrop-blur-sm`}
      >
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#22c55e]/10 border border-[#22c55e]/30">
            <Sparkles className="w-3 h-3 text-[#22c55e]" />
            <span className="text-[#22c55e] text-[10px] font-bold uppercase tracking-wider">Open Beta</span>
          </div>
          <p className={`text-xs ${isDark ? "text-white/60" : "text-[#374151]"}`}>
            All Pro features are <span className={`font-semibold ${isDark ? "text-white" : "text-[#1a1a1a]"}`}>free right now</span> — no account or credit card needed.
          </p>
        </div>
      </motion.div>

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-16">

        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <motion.div {...fadeUp} className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border mb-5 backdrop-blur-sm
            bg-[#22c55e]/10 border-[#22c55e]/25">
            <Crown className="w-3.5 h-3.5 text-[#22c55e]" />
            <span className="text-[#22c55e] text-xs font-bold uppercase tracking-wider">Pricing</span>
          </div>
          <h1 className={`text-4xl md:text-5xl font-bold tracking-tight mb-4 ${isDark ? "text-white" : "text-[#1a1a1a]"}`}>
            Simple, honest pricing.
          </h1>
          <p className={`text-lg max-w-xl mx-auto leading-relaxed ${isDark ? "text-white/50" : "text-[#436850]"}`}>
            Start free and grow with your club. Pro unlocks the full toolkit —
            openings, analysis, and unlimited everything.
          </p>
        </motion.div>

        {/* ── Plan cards ────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
          className="grid md:grid-cols-2 gap-5 mb-16"
        >
          {/* Free card */}
          <motion.div
            whileHover={{ y: -4, scale: 1.01 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className={`rounded-2xl border p-7 cursor-default backdrop-blur-sm transition-shadow duration-300 hover:shadow-xl ${
              isDark
                ? "bg-white/[0.03] border-white/[0.10] hover:border-white/20 hover:shadow-black/40"
                : "bg-white/80 border-[#436850]/15 hover:border-[#436850]/30 hover:shadow-[#436850]/10"
            }`}
          >
            <div className="mb-5">
              <p className={`text-xs font-bold uppercase tracking-widest mb-2 ${isDark ? "text-white/40" : "text-[#436850]"}`}>Free</p>
              <div className="flex items-baseline gap-1.5">
                <span className={`text-4xl font-bold ${isDark ? "text-white" : "text-[#1a1a1a]"}`}>$0</span>
                <span className={`text-sm ${isDark ? "text-white/30" : "text-[#9CA3AF]"}`}>/ month</span>
              </div>
              <p className={`text-sm mt-2 ${isDark ? "text-white/40" : "text-[#6B7280]"}`}>
                Everything you need to run a club tournament.
              </p>
            </div>
            <Link href="/join">
              <button className={`w-full py-3 rounded-xl text-sm font-semibold transition-all duration-200 border group ${
                isDark
                  ? "border-white/10 text-white/70 hover:bg-white/[0.07] hover:border-white/20 hover:text-white"
                  : "border-[#436850]/20 text-[#436850] hover:bg-[#436850]/08 hover:border-[#436850]/40"
              }`}>
                Get started free
              </button>
            </Link>
          </motion.div>

          {/* Pro card */}
          <motion.div
            whileHover={{ y: -4, scale: 1.01 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="rounded-2xl border border-[#22c55e]/35 bg-[#0d1a0f]/90 p-7 relative overflow-hidden cursor-default backdrop-blur-sm transition-shadow duration-300 hover:shadow-2xl hover:shadow-[#22c55e]/15 hover:border-[#22c55e]/55"
          >
            {/* Ambient glow */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-0 right-0 w-56 h-56 bg-[#22c55e]/8 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-40 h-40 bg-[#22c55e]/5 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />
            </div>

            {/* Micro-checkered overlay on Pro card */}
            <div className="absolute inset-0 chess-board-bg opacity-[0.04] pointer-events-none rounded-2xl" />

            {/* Open Beta badge */}
            <div className="absolute top-5 right-5 flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#22c55e]/15 border border-[#22c55e]/30">
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
              className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold bg-[#22c55e] hover:bg-[#16a34a] text-black transition-all duration-200 relative hover:shadow-lg hover:shadow-[#22c55e]/30 active:scale-[0.98]"
            >
              <Sparkles className="w-4 h-4" />
              Upgrade to Pro
            </button>
            {/* View Demo link */}
            <div className="mt-3 text-center">
              <Link
                href="/openings/demo"
                className="inline-flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 transition-colors"
              >
                <Eye className="w-3.5 h-3.5" />
                View Demo — explore before you upgrade
              </Link>
            </div>
          </motion.div>
        </motion.div>

        {/* ── Feature comparison table ───────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
        >
          <h2 className={`text-xl font-bold mb-6 ${isDark ? "text-white" : "text-[#1a1a1a]"}`}>
            Full feature breakdown
          </h2>

          <div className={`rounded-2xl border overflow-hidden backdrop-blur-sm ${isDark ? "border-white/[0.08] bg-black/20" : "border-[#436850]/12 bg-white/70"}`}>
            {/* Table header */}
            <div className={`grid grid-cols-[1fr_100px_100px] border-b ${isDark ? "bg-white/[0.03] border-white/[0.07]" : "bg-[#436850]/[0.04] border-[#436850]/10"}`}>
              <div className={`px-5 py-3.5 text-xs font-bold uppercase tracking-wider ${isDark ? "text-white/30" : "text-[#6B7280]"}`}>
                Feature
              </div>
              <div className={`px-3 py-3.5 text-center text-xs font-bold uppercase tracking-wider ${isDark ? "text-white/30" : "text-[#6B7280]"}`}>
                Free
              </div>
              <div className="px-3 py-3.5 text-center text-xs font-bold uppercase tracking-wider text-[#22c55e]">
                Pro
              </div>
            </div>

            {/* Rows grouped by category */}
            {CATEGORIES.map((cat, catIdx) => {
              const rows = FEATURES.filter((f) => f.category === cat);
              return (
                <div key={cat}>
                  {/* Category header */}
                  <div className={`grid grid-cols-[1fr_100px_100px] border-b ${isDark ? "bg-white/[0.02] border-white/[0.05]" : "bg-[#436850]/[0.025] border-[#436850]/08"} ${catIdx > 0 ? "border-t" : ""}`}>
                    <div className={`px-5 py-2 text-[11px] font-bold uppercase tracking-widest ${isDark ? "text-white/25" : "text-[#9CA3AF]"}`}>
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
                        className={`group grid grid-cols-[1fr_100px_100px] items-center border-b transition-colors duration-150 ${
                          isDark
                            ? `border-white/[0.04] hover:bg-white/[0.03] ${rowIdx % 2 === 0 ? "" : "bg-white/[0.01]"}`
                            : `border-[#436850]/06 hover:bg-[#436850]/[0.04] ${rowIdx % 2 === 0 ? "" : "bg-[#436850]/[0.015]"}`
                        }`}
                      >
                        <div className="flex items-center gap-2.5 px-5 py-3">
                          <Icon className={`w-3.5 h-3.5 flex-shrink-0 transition-colors ${isDark ? "text-white/25 group-hover:text-[#22c55e]/60" : "text-[#9CA3AF] group-hover:text-[#436850]/70"}`} />
                          <span className={`text-sm transition-colors ${isDark ? "text-white/65 group-hover:text-white/85" : "text-[#374151] group-hover:text-[#1a1a1a]"}`}>
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
            <div className={`grid grid-cols-[1fr_100px_100px] ${isDark ? "bg-white/[0.025]" : "bg-[#436850]/[0.025]"}`}>
              <div className="px-5 py-4" />
              <div className="px-3 py-4 flex justify-center">
                <Link href="/join">
                  <button className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all duration-200 ${isDark ? "border-white/10 text-white/50 hover:text-white hover:border-white/25 hover:bg-white/[0.06]" : "border-[#436850]/20 text-[#436850] hover:bg-[#436850]/08 hover:border-[#436850]/35"}`}>
                    Get free
                  </button>
                </Link>
              </div>
              <div className="px-3 py-4 flex justify-center">
                <button
                  onClick={() => setModalOpen(true)}
                  className="text-xs font-bold px-3 py-1.5 rounded-lg bg-[#22c55e] hover:bg-[#16a34a] text-black transition-all duration-200 hover:shadow-md hover:shadow-[#22c55e]/25 active:scale-95"
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

        {/* ── Reassurance strip ─────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3, ease: "easeOut" }}
          className="mt-16 grid sm:grid-cols-3 gap-5"
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
            <motion.div
              key={title}
              whileHover={{ y: -3, scale: 1.02 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className={`rounded-xl border p-5 cursor-default backdrop-blur-sm transition-shadow duration-300 hover:shadow-lg ${
                isDark
                  ? "bg-white/[0.03] border-white/[0.08] hover:border-white/15 hover:shadow-black/30"
                  : "bg-white/80 border-[#436850]/10 hover:border-[#436850]/25 hover:shadow-[#436850]/08"
              }`}
            >
              <div className="w-9 h-9 rounded-xl bg-[#22c55e]/10 border border-[#22c55e]/20 flex items-center justify-center mb-3 transition-colors group-hover:bg-[#22c55e]/15">
                <Icon className="w-4 h-4 text-[#22c55e]" />
              </div>
              <p className={`text-sm font-semibold mb-1.5 ${isDark ? "text-white/90" : "text-[#1a1a1a]"}`}>{title}</p>
              <p className={`text-xs leading-relaxed ${isDark ? "text-white/40" : "text-[#6B7280]"}`}>{body}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* ── Back to home ──────────────────────────────────────────────────── */}
        <div className="mt-14 text-center">
          <Link href="/">
            <button className={`inline-flex items-center gap-2 text-sm font-medium transition-colors ${isDark ? "text-white/30 hover:text-white/60" : "text-[#9CA3AF] hover:text-[#436850]"}`}>
              ← Back to home
            </button>
          </Link>
        </div>
      </div>

      {/* ── Modals ────────────────────────────────────────────────────────────── */}
      <ProUpgradeModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onNeedsAuth={() => { setModalOpen(false); setAuthOpen(true); }}
      />
      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  );
}
