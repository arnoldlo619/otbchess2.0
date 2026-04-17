/**
 * OpeningsProGate — Live Payments edition.
 *
 * Gates the Openings feature behind a Pro subscription.
 *
 * - Authenticated Pro users: pass through immediately.
 * - Authenticated free users: see the upgrade CTA with ProUpgradeModal.
 * - Unauthenticated visitors: see a sign-in prompt (AuthModal).
 *
 * To re-enable open beta access for all users, set BETA_OPEN = true.
 */
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { motion } from "framer-motion";
import {
  Crown,
  BookOpen,
  Lock,
  Sparkles,
  LogIn,
} from "lucide-react";
import { ProUpgradeModal } from "./ProUpgradeModal";
import AuthModal from "./AuthModal";

// ─── Feature flag ─────────────────────────────────────────────────────────────
// Set to true to re-enable open beta (all users pass through for free).
const BETA_OPEN = false;

// ─── Component ────────────────────────────────────────────────────────────────
interface OpeningsProGateProps {
  children: React.ReactNode;
}

export function OpeningsProGate({ children }: OpeningsProGateProps) {
  const { user, loading } = useAuth();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);

  // While auth is loading, show a minimal skeleton
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#22c55e]/30 border-t-[#22c55e] rounded-full animate-spin" />
      </div>
    );
  }

  // ── Open Beta: pass all users through ────────────────────────────────────────
  if (BETA_OPEN) {
    return <>{children}</>;
  }

  // ── Pro users: full access ────────────────────────────────────────────────────
  if (user?.isPro) {
    return <>{children}</>;
  }

  // ── Unauthenticated: sign-in gate ─────────────────────────────────────────────
  if (!user) {
    return (
      <>
        <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="w-full max-w-md text-center"
          >
            {/* Icon */}
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#22c55e]/10 border border-[#22c55e]/20 mb-6">
              <Lock className="w-8 h-8 text-[#22c55e]" />
            </div>

            {/* Badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#22c55e]/10 border border-[#22c55e]/25 text-[#22c55e] text-xs font-bold tracking-wider uppercase mb-4">
              <Crown className="w-3 h-3" />
              Pro Feature
            </div>

            <h2 className="text-2xl font-bold text-white mb-3">
              Sign in to access Openings
            </h2>
            <p className="text-white/50 text-sm leading-relaxed mb-8 max-w-sm mx-auto">
              The Openings Library is a Pro feature. Sign in and upgrade to unlock
              16+ opening lines, study mode, drills, and coach insights.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => setAuthOpen(true)}
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#22c55e] hover:bg-[#16a34a] text-black font-bold text-sm transition-colors"
              >
                <LogIn className="w-4 h-4" />
                Sign in
              </button>
              <button
                onClick={() => setUpgradeOpen(true)}
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-white/10 hover:border-white/20 text-white/70 hover:text-white font-semibold text-sm transition-colors"
              >
                <BookOpen className="w-4 h-4" />
                See what&apos;s included
              </button>
            </div>
          </motion.div>
        </div>

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
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="w-full max-w-md text-center"
        >
          {/* Icon */}
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#22c55e]/10 border border-[#22c55e]/20 mb-6">
            <BookOpen className="w-8 h-8 text-[#22c55e]" />
          </div>

          {/* Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#22c55e]/10 border border-[#22c55e]/25 text-[#22c55e] text-xs font-bold tracking-wider uppercase mb-4">
            <Crown className="w-3 h-3" />
            Pro Feature
          </div>

          <h2 className="text-2xl font-bold text-white mb-3">
            Openings Library is Pro
          </h2>
          <p className="text-white/50 text-sm leading-relaxed mb-8 max-w-sm mx-auto">
            Upgrade to Pro to unlock 16+ opening lines, study mode, trap lines,
            coach insights, and unlimited prep reports.
          </p>

          <button
            onClick={() => setUpgradeOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-[#22c55e] hover:bg-[#16a34a] text-black font-bold text-base transition-colors shadow-lg shadow-[#22c55e]/20"
          >
            <Sparkles className="w-5 h-5" />
            Upgrade to Pro
          </button>

          <p className="mt-3 text-white/25 text-xs">
            Starting at $6.67 / month · Cancel anytime
          </p>
        </motion.div>
      </div>

      <ProUpgradeModal
        isOpen={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        highlightFeature="Openings Library"
        onNeedsAuth={() => setAuthOpen(true)}
      />
    </>
  );
}
