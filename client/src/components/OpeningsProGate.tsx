/**
 * OpeningsProGate — Open Beta edition.
 *
 * During the open beta ALL users (including guests and unauthenticated visitors)
 * have full access to the Openings feature. This component renders children
 * immediately and shows a soft "Open Beta" banner at the top of the page so
 * users understand they are getting Pro-level access for free.
 *
 * The ProUpgradeModal is still wired in — clicking the banner CTA opens it so
 * users can see what's included and preview future pricing. No gate is applied.
 *
 * When paid plans launch, flip `BETA_OPEN = false` here and the gate will
 * re-engage, showing the upgrade CTA to non-Pro users.
 */
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  X,
  ChevronRight,
} from "lucide-react";
import { ProUpgradeModal } from "./ProUpgradeModal";

// ─── Feature flag ─────────────────────────────────────────────────────────────
// Set to false when paid plans launch to re-enable the gate.
const BETA_OPEN = true;

// ─── Component ────────────────────────────────────────────────────────────────
interface OpeningsProGateProps {
  children: React.ReactNode;
}

export function OpeningsProGate({ children }: OpeningsProGateProps) {
  const { loading } = useAuth();
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  // While auth is loading, show a minimal skeleton to avoid layout flash
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#22c55e]/30 border-t-[#22c55e] rounded-full animate-spin" />
      </div>
    );
  }

  // ── Open Beta: pass all users through ────────────────────────────────────────
  if (BETA_OPEN) {
    return (
      <>
        {/* Soft beta banner — dismissible */}
        <AnimatePresence>
          {!bannerDismissed && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="relative z-10 bg-[#0d1a0f] border-b border-[#22c55e]/20"
            >
              <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex-shrink-0 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#22c55e]/10 border border-[#22c55e]/25">
                    <Sparkles className="w-3 h-3 text-[#22c55e]" />
                    <span className="text-[#22c55e] text-[10px] font-bold uppercase tracking-wider">
                      Open Beta
                    </span>
                  </div>
                  <p className="text-white/50 text-xs truncate">
                    All Pro features are{" "}
                    <span className="text-white/80 font-semibold">free during open beta</span>
                    {" "}— no account or credit card needed.
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => setUpgradeOpen(true)}
                    className="hidden sm:flex items-center gap-1 text-[#22c55e] text-xs font-semibold hover:text-[#4ade80] transition-colors"
                  >
                    See what&apos;s included
                    <ChevronRight className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => setBannerDismissed(true)}
                    className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/[0.08] text-white/30 hover:text-white/60 transition-colors"
                    aria-label="Dismiss banner"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Full content — no gate */}
        {children}

        {/* Modal — shows feature table and future pricing preview */}
        <ProUpgradeModal
          isOpen={upgradeOpen}
          onClose={() => setUpgradeOpen(false)}
          highlightFeature="Openings Library"
        />
      </>
    );
  }

  // ── Paid mode (future): gate non-Pro users ────────────────────────────────────
  // This branch is unreachable while BETA_OPEN = true.
  // When flipped, non-Pro users will see the upgrade CTA instead of the content.
  return <>{children}</>;
}
