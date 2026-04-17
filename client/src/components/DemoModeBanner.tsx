/**
 * DemoModeBanner — Sticky banner shown when a user is browsing the Openings
 * feature in demo mode (not a Pro subscriber).
 *
 * Shows a clear "Demo Mode" label, a short message, and two CTAs:
 *   1. Upgrade to Pro (opens ProUpgradeModal)
 *   2. Sign in (opens AuthModal) — only shown to unauthenticated users
 */
import { useState } from "react";
import { Eye, Sparkles, X, LogIn } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ProUpgradeModal } from "./ProUpgradeModal";
import AuthModal from "./AuthModal";
import { useAuth } from "@/hooks/useAuth";

interface DemoModeBannerProps {
  /** Called when the user clicks "Exit Demo" to go back to the gate screen */
  onExitDemo: () => void;
}

export function DemoModeBanner({ onExitDemo }: DemoModeBannerProps) {
  const { user } = useAuth();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <>
      <AnimatePresence>
        <motion.div
          key="demo-banner"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="sticky top-0 z-40 w-full bg-gradient-to-r from-amber-500/15 via-amber-400/10 to-amber-500/15 border-b border-amber-500/25 backdrop-blur-xl"
        >
          <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center gap-3">
            {/* Icon + label */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/20 border border-amber-500/30">
                <Eye className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider hidden sm:block">
                Demo Mode
              </span>
            </div>

            {/* Divider */}
            <div className="w-px h-4 bg-amber-500/20 hidden sm:block" />

            {/* Message */}
            <p className="text-xs text-amber-300/70 flex-1 min-w-0 truncate">
              You&apos;re previewing the Openings Library.{" "}
              <span className="hidden md:inline">
                Some lines are locked — upgrade to Pro for full access.
              </span>
            </p>

            {/* CTAs */}
            <div className="flex items-center gap-2 shrink-0">
              {!user && (
                <button
                  onClick={() => setAuthOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/20 text-white/60 hover:text-white text-xs font-medium transition-all"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Sign in</span>
                </button>
              )}
              <button
                onClick={() => setUpgradeOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 hover:border-amber-500/50 text-amber-300 hover:text-amber-200 text-xs font-semibold transition-all"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Upgrade to Pro
              </button>
              <button
                onClick={() => {
                  setDismissed(true);
                  onExitDemo();
                }}
                className="p-1.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5 transition-all"
                title="Exit demo"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      <ProUpgradeModal
        isOpen={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        highlightFeature="Openings Library"
        onNeedsAuth={() => {
          setUpgradeOpen(false);
          setAuthOpen(true);
        }}
      />
      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />
    </>
  );
}
