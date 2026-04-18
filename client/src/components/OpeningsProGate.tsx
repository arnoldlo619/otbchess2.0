/**
 * OpeningsProGate — Live Payments edition.
 *
 * Gates the Openings feature behind a Pro subscription.
 *
 * - Authenticated Pro users: pass through immediately.
 * - Authenticated free users: see the upgrade CTA with ProUpgradeModal + "View Demo" button.
 * - Unauthenticated visitors: see a sign-in prompt + "View Demo" button.
 *
 * "View Demo" navigates to /openings/demo — a static demo library with sample openings.
 * To re-enable open beta access for all users, set BETA_OPEN = true.
 */
import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { motion } from "framer-motion";
import {
  Crown,
  BookOpen,
  Sparkles,
  LogIn,
  Eye,
  Lock,
} from "lucide-react";
import { ProUpgradeModal } from "./ProUpgradeModal";
import AuthModal from "./AuthModal";

// ─── Feature flag ─────────────────────────────────────────────────────────────
// Set to true to re-enable open beta (all users pass through for free).
const BETA_OPEN = false;

// ─── Shared gate card wrapper ─────────────────────────────────────────────────
function GateLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen chess-board-bg dark:chess-board-bg bg-[#0d1a0f] flex items-center justify-center px-4 py-12">
      {/* Radial glow behind card */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[#22c55e]/5 blur-3xl" />
      </div>
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-sm"
      >
        {/* Card */}
        <div className="bg-[#0f1f12]/90 backdrop-blur-md border border-[#22c55e]/15 rounded-2xl shadow-2xl shadow-black/40 overflow-hidden">
          {/* Top accent bar */}
          <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-[#22c55e]/60 to-transparent" />

          <div className="px-8 py-10 text-center space-y-6">
            {children}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ─── OTB !! logo mark ─────────────────────────────────────────────────────────
function OtbLogoMark() {
  return (
    <motion.div
      className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#22c55e]/10 border border-[#22c55e]/20 mx-auto"
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.1 }}
    >
      <motion.img
        src="https://d2xsxph8kpxj0f.cloudfront.net/117675823/J6FsDoRMH9x5xbUvpyzxyf/otb-logo-exclamation_a8022818.png"
        alt="OTB!!"
        className="w-10 h-10 object-contain"
        initial={{ rotate: -8 }}
        animate={{ rotate: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 14, delay: 0.2 }}
      />
    </motion.div>
  );
}

// ─── Pro badge ────────────────────────────────────────────────────────────────
function ProBadge() {
  return (
    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#22c55e]/10 border border-[#22c55e]/25 text-[#22c55e] text-xs font-bold tracking-wider uppercase">
      <Crown className="w-3 h-3" />
      Pro Feature
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
interface OpeningsProGateProps {
  children: React.ReactNode;
}

export function OpeningsProGate({ children }: OpeningsProGateProps) {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);

  // While auth is loading, show a minimal skeleton
  if (loading) {
    return (
      <div className="min-h-screen chess-board-bg bg-[#0d1a0f] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#22c55e]/30 border-t-[#22c55e] rounded-full animate-spin" />
      </div>
    );
  }

  // ── Open Beta: pass all users through ────────────────────────────────────────
  if (BETA_OPEN) {
    return <>{children}</>;
  }

  // ── Pro users and OTB Staff: full access ──────────────────────────────────
  if (user?.isPro || user?.isStaff) {
    return <>{children}</>;
  }

  // ── Unauthenticated: sign-in gate ─────────────────────────────────────────────
  if (!user) {
    return (
      <>
        <GateLayout>
          <OtbLogoMark />

          <div className="space-y-2">
            <ProBadge />
            <h2 className="text-xl font-bold text-white pt-1">
              Sign in to access Openings
            </h2>
            <p className="text-white/50 text-sm leading-relaxed max-w-xs mx-auto">
              The Openings Library is a Pro feature. Sign in and upgrade to unlock
              16+ opening lines, study mode, drills, and coach insights.
            </p>
          </div>

          {/* Primary CTAs */}
          <div className="flex flex-col gap-3">
            <button
              onClick={() => setAuthOpen(true)}
              className="flex items-center justify-center gap-2 w-full px-6 py-3 rounded-xl bg-[#22c55e] hover:bg-[#16a34a] text-black font-bold text-sm transition-colors shadow-lg shadow-[#22c55e]/20"
            >
              <LogIn className="w-4 h-4" />
              Sign in to continue
            </button>
            <button
              onClick={() => setUpgradeOpen(true)}
              className="flex items-center justify-center gap-2 w-full px-6 py-3 rounded-xl border border-white/10 hover:border-[#22c55e]/30 hover:bg-[#22c55e]/5 text-white/60 hover:text-white font-semibold text-sm transition-all"
            >
              <BookOpen className="w-4 h-4" />
              See what&apos;s included
            </button>
          </div>

          {/* View Demo CTA */}
          <div className="pt-4 border-t border-white/[0.07]">
            <p className="text-xs text-white/30 mb-3">Not ready to sign up yet?</p>
            <button
              onClick={() => navigate("/openings/demo")}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-amber-500/25 hover:border-amber-500/40 bg-amber-500/5 hover:bg-amber-500/10 text-amber-400 hover:text-amber-300 text-sm font-medium transition-all"
            >
              <Eye className="w-4 h-4" />
              View Demo — No sign-in required
            </button>
          </div>
        </GateLayout>

        <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />
        <ProUpgradeModal
          isOpen={upgradeOpen}
          onClose={() => setUpgradeOpen(false)}
          highlightFeature="Openings Library"
          onNeedsAuth={() => setAuthOpen(true)}
        />
      </>
    );
  }

  // ── Authenticated free user: upgrade gate ─────────────────────────────────────
  return (
    <>
      <GateLayout>
        <OtbLogoMark />

        <div className="space-y-2">
          <ProBadge />
          <h2 className="text-xl font-bold text-white pt-1">
            Openings Library is Pro
          </h2>
          <p className="text-white/50 text-sm leading-relaxed max-w-xs mx-auto">
            Upgrade to Pro to unlock 16+ opening lines, study mode, trap lines,
            coach insights, and unlimited prep reports.
          </p>
        </div>

        {/* Feature highlights */}
        <div className="grid grid-cols-2 gap-2 text-left">
          {[
            { icon: BookOpen, label: "16+ Opening Lines" },
            { icon: Lock,     label: "Study Mode" },
            { icon: Sparkles, label: "Trap Lines" },
            { icon: Crown,    label: "Coach Insights" },
          ].map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#22c55e]/5 border border-[#22c55e]/10 text-white/70 text-xs font-medium"
            >
              <Icon className="w-3.5 h-3.5 text-[#22c55e] shrink-0" />
              {label}
            </div>
          ))}
        </div>

        {/* Primary CTA */}
        <div className="space-y-2">
          <button
            onClick={() => setUpgradeOpen(true)}
            className="inline-flex items-center justify-center gap-2 w-full px-8 py-3.5 rounded-xl bg-[#22c55e] hover:bg-[#16a34a] text-black font-bold text-sm transition-colors shadow-lg shadow-[#22c55e]/20"
          >
            <Sparkles className="w-4 h-4" />
            Upgrade to Pro
          </button>
          <p className="text-white/25 text-xs">
            Starting at $6.67 / month · Cancel anytime
          </p>
        </div>

        {/* View Demo CTA */}
        <div className="pt-4 border-t border-white/[0.07]">
          <p className="text-xs text-white/30 mb-3">Want to explore first?</p>
          <button
            onClick={() => navigate("/openings/demo")}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-amber-500/25 hover:border-amber-500/40 bg-amber-500/5 hover:bg-amber-500/10 text-amber-400 hover:text-amber-300 text-sm font-medium transition-all"
          >
            <Eye className="w-4 h-4" />
            View Demo Library
          </button>
        </div>
      </GateLayout>

      <ProUpgradeModal
        isOpen={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        highlightFeature="Openings Library"
        onNeedsAuth={() => setAuthOpen(true)}
      />
    </>
  );
}
