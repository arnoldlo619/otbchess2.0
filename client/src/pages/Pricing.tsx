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
import { motion, AnimatePresence } from "framer-motion";
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
  ChevronDown,
  ArrowRight,
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useState } from "react";
import { usePageMeta } from "@/hooks/usePageMeta";
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

// ─── FAQ data ─────────────────────────────────────────────────────────────────
const FAQ_ITEMS = [
  {
    q: "Is anything actually free right now?",
    a: "Yes — everything. During open beta, all Pro features are unlocked for every user at no cost. No credit card, no account required to host a tournament.",
  },
  {
    q: "When will paid plans launch?",
    a: "We haven't set a date yet. We'll announce it well in advance and give beta users a clear opt-in window before any charges begin.",
  },
  {
    q: "What is the founding member rate?",
    a: "Users who join during open beta will receive a discounted rate when paid plans launch. No action is needed — your beta participation is noted automatically.",
  },
  {
    q: "Will I be charged automatically when beta ends?",
    a: "No. We will never charge you without explicit opt-in. When paid plans launch you can choose to upgrade, stay on the free tier, or do nothing.",
  },
  {
    q: "What does the Free tier include after beta?",
    a: "The planned Free tier covers tournament hosting for up to 16 players, Swiss and elimination formats, live standings, QR join links, club creation, and game history. No time limit.",
  },
  {
    q: "What does Pro add after beta?",
    a: "Pro unlocks the full openings library (16+ lines with study and drill modes), unlimited analysis reports, coach insights, club battles, priority support, and early access to new features.",
  },
];

// ─── Cell renderer ────────────────────────────────────────────────────────────
function Cell({ value, isProCol, isDark }: { value: string | boolean; isProCol?: boolean; isDark: boolean }) {
  if (value === true) {
    return (
      <div className="flex justify-center">
        <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
          isProCol
            ? "bg-[#22c55e]/20"
            : isDark ? "bg-white/[0.07]" : "bg-[#436850]/10"
        }`}>
          <Check className={`w-3 h-3 ${
            isProCol
              ? "text-[#22c55e]"
              : isDark ? "text-white/50" : "text-[#436850]"
          }`} />
        </div>
      </div>
    );
  }
  if (value === false) {
    return (
      <div className="flex justify-center">
        <Minus className={`w-4 h-4 ${isDark ? "text-white/15" : "text-[#D1D5DB]"}`} />
      </div>
    );
  }
  return (
    <span className={`text-xs font-semibold ${
      isProCol
        ? "text-[#22c55e]"
        : isDark ? "text-white/50" : "text-[#436850]"
    }`}>
      {value}
    </span>
  );
}

// ─── FAQ accordion item ───────────────────────────────────────────────────────
function FaqItem({ q, a, isDark }: { q: string; a: string; isDark: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className={`border-b last:border-0 ${isDark ? "border-white/[0.07]" : "border-[#ADBC9F]/50"}`}
    >
      <button
        className={`w-full flex items-center justify-between gap-4 py-4 text-left text-sm font-semibold transition-colors ${
          isDark ? "text-white/80 hover:text-white" : "text-[#12372A] hover:text-[#12372A]"
        }`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span>{q}</span>
        <ChevronDown
          className={`w-4 h-4 flex-shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""} ${
            isDark ? "text-white/40" : "text-[#436850]"
          }`}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <p className={`pb-4 text-sm leading-relaxed ${isDark ? "text-white/55" : "text-[#436850]"}`}>
              {a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function Pricing() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  usePageMeta({
    title: "Pricing — ChessOTB.club",
    description: "Free for chess clubs during open beta. Pro features include unlimited tournaments, advanced analytics, and priority support.",
    path: "/pricing",
  });

  const fadeUp = {
    initial: { opacity: 0, y: 24 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5, ease: "easeOut" as const },
  };

  return (
    <div className={`min-h-screen relative ${isDark ? "bg-[#0d1a0f] text-white" : "bg-[#F2F7F3] text-[#1a1a1a]"}`}>

      {/* ── Micro-checkered background ─────────────────────────────────────── */}
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
          <h1 className={`text-4xl md:text-5xl font-bold tracking-tight mb-4 ${isDark ? "text-white" : "text-[#1a1a1a]"}`}
            style={{ fontFamily: "'Clash Display', sans-serif" }}>
            Simple, honest pricing.
          </h1>
          <p className={`text-lg max-w-xl mx-auto leading-relaxed ${isDark ? "text-white/50" : "text-[#436850]"}`}>
            Everything is free during open beta. When paid plans launch, Free stays free forever — Pro unlocks the full toolkit.
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
                <span className={`text-sm ${isDark ? "text-white/30" : "text-[#9CA3AF]"}`}>/ month, forever</span>
              </div>
              <p className={`text-sm mt-2 ${isDark ? "text-white/40" : "text-[#6B7280]"}`}>
                Everything you need to run a club tournament.
              </p>
            </div>
            <Link
              href="/join"
              className={`w-full py-3 rounded-xl text-sm font-semibold transition-all duration-200 border flex items-center justify-center ${
                isDark
                  ? "border-white/10 text-white/70 hover:bg-white/[0.07] hover:border-white/20 hover:text-white"
                  : "border-[#436850]/20 text-[#436850] hover:bg-[#436850]/08 hover:border-[#436850]/40"
              }`}
              style={{ minHeight: "44px" }}
            >
              Get started free
            </Link>
          </motion.div>

          {/* Pro card — recommended, always dark for visual hierarchy */}
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

            {/* Micro-checkered overlay */}
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
              <p className="text-white/60 text-xs mt-1">
                Full access now. Founding member rate when paid plans launch.
              </p>
            </div>

            {/* CTA: no payment modal — direct to join/explore */}
            <Link
              href="/join"
              className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold bg-[#22c55e] hover:bg-[#16a34a] text-black transition-all duration-200 relative hover:shadow-lg hover:shadow-[#22c55e]/30 active:scale-[0.98]"
              style={{ minHeight: "44px" }}
            >
              <Sparkles className="w-4 h-4" />
              Start using Pro — it's free
            </Link>

            {/* View Demo link */}
            <div className="mt-3 text-center">
              <Link
                href="/openings/demo"
                className="inline-flex items-center gap-1.5 text-xs text-white/50 hover:text-white/80 transition-colors"
              >
                <Eye className="w-3.5 h-3.5" />
                Explore the openings library first
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
          <h2 className={`text-xl font-bold mb-6 ${isDark ? "text-white" : "text-[#1a1a1a]"}`}
            style={{ fontFamily: "'Clash Display', sans-serif" }}>
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
                          <Cell value={row.free} isDark={isDark} />
                        </div>
                        <div className="px-3 py-3 flex justify-center">
                          <Cell value={row.pro} isProCol isDark={isDark} />
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
                <Link
                  href="/join"
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all duration-200 flex items-center justify-center ${isDark ? "border-white/10 text-white/50 hover:text-white hover:border-white/25 hover:bg-white/[0.06]" : "border-[#436850]/20 text-[#436850] hover:bg-[#436850]/08 hover:border-[#436850]/35"}`}
                  style={{ minHeight: "36px" }}
                >
                  Get free
                </Link>
              </div>
              <div className="px-3 py-4 flex justify-center">
                <Link
                  href="/join"
                  className="text-xs font-bold px-3 py-1.5 rounded-lg bg-[#22c55e] hover:bg-[#16a34a] text-black transition-all duration-200 hover:shadow-md hover:shadow-[#22c55e]/25 active:scale-95 flex items-center justify-center"
                  style={{ minHeight: "36px" }}
                >
                  Start free
                </Link>
              </div>
            </div>
          </div>

          {/* Beta footnote */}
          <p className={`text-center text-xs mt-5 leading-relaxed ${isDark ? "text-white/30" : "text-[#9CA3AF]"}`}>
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
              <div className="w-9 h-9 rounded-xl bg-[#22c55e]/10 border border-[#22c55e]/20 flex items-center justify-center mb-3">
                <Icon className="w-4 h-4 text-[#22c55e]" />
              </div>
              <p className={`text-sm font-semibold mb-1.5 ${isDark ? "text-white/90" : "text-[#1a1a1a]"}`}>{title}</p>
              <p className={`text-xs leading-relaxed ${isDark ? "text-white/40" : "text-[#6B7280]"}`}>{body}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* ── FAQ ───────────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4, ease: "easeOut" }}
          className="mt-16"
        >
          <h2
            className={`text-xl font-bold mb-6 ${isDark ? "text-white" : "text-[#1a1a1a]"}`}
            style={{ fontFamily: "'Clash Display', sans-serif" }}
          >
            Frequently asked questions
          </h2>
          <div
            className={`rounded-2xl border overflow-hidden backdrop-blur-sm ${
              isDark ? "border-white/[0.08] bg-black/20" : "border-[#436850]/12 bg-white/70"
            }`}
          >
            <div className="px-5 sm:px-6 divide-y-0">
              {FAQ_ITEMS.map((item) => (
                <FaqItem key={item.q} q={item.q} a={item.a} isDark={isDark} />
              ))}
            </div>
          </div>
        </motion.div>

        {/* ── Final CTA ─────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5, ease: "easeOut" }}
          className={`mt-16 rounded-2xl border p-8 text-center ${
            isDark
              ? "bg-[oklch(0.22_0.07_145)] border-white/[0.07]"
              : "bg-[#436850] border-[#2A4A32]/20"
          }`}
        >
          <h3
            className={`text-xl sm:text-2xl font-bold mb-2 ${isDark ? "text-white" : "text-white"}`}
            style={{ fontFamily: "'Clash Display', sans-serif" }}
          >
            Start for free today.
          </h3>
          <p className={`text-sm mb-6 ${isDark ? "text-white/55" : "text-white/80"}`}>
            No credit card. No account required to host your first tournament.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/tournaments/new"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold bg-white text-[#436850] hover:bg-[#EEEED2] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
              style={{ minHeight: "44px" }}
            >
              Host a Tournament
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/join"
              className={`inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold border transition-all duration-200 hover:-translate-y-0.5 ${
                isDark
                  ? "border-white/20 text-white/80 hover:bg-white/10 hover:text-white"
                  : "border-white/40 text-white hover:bg-white/20"
              }`}
              style={{ minHeight: "44px" }}
            >
              Join a Tournament
            </Link>
          </div>
        </motion.div>

        {/* ── Back to home ──────────────────────────────────────────────────── */}
        <div className="mt-10 text-center">
          <Link
            href="/"
            className={`inline-flex items-center gap-2 text-sm font-medium transition-colors ${isDark ? "text-white/30 hover:text-white/60" : "text-[#9CA3AF] hover:text-[#436850]"}`}
          >
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
