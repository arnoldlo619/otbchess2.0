/**
 * ProUpgradeModal — Open Beta edition.
 *
 * During the open beta all Pro features are free. This modal communicates
 * that clearly, shows what's included, and previews future pricing so users
 * understand the value before paid plans launch.
 *
 * Stripe infrastructure (server/billing.ts) is fully wired and ready to
 * activate — just add the four STRIPE_* secrets when payments go live.
 *
 * Usage:
 *   <ProUpgradeModal
 *     isOpen={showUpgrade}
 *     onClose={() => setShowUpgrade(false)}
 *     highlightFeature="Openings Library"   // optional — highlights a row
 *   />
 */

import { useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Crown,
  Check,
  Minus,
  Zap,
  Shield,
  BookOpen,
  Brain,
  Target,
  Video,
  Trophy,
  Users,
  Sparkles,
  Gift,
} from "lucide-react";

// ─── Feature comparison data ─────────────────────────────────────────────────
interface FeatureRow {
  label: string;
  icon?: React.ElementType;
  free: string | boolean;
  pro: string | boolean;
  highlight?: boolean;
}

const FEATURES: FeatureRow[] = [
  { label: "Tournament Management",  icon: Trophy,    free: true,          pro: true },
  { label: "Player Registration",    icon: Users,     free: "Up to 16",    pro: "Unlimited" },
  { label: "Swiss & Elimination",    icon: Shield,    free: true,          pro: true },
  { label: "Live Scoreboard",        icon: Zap,       free: true,          pro: true },
  { label: "Openings Library",       icon: BookOpen,  free: false,         pro: true,  highlight: true },
  { label: "Opening Explorer",       icon: Target,    free: false,         pro: true,  highlight: true },
  { label: "Coach Insights",         icon: Brain,     free: false,         pro: true,  highlight: true },
  { label: "Prep Reports",           icon: Target,    free: "3 / month",   pro: "Unlimited" },
  { label: "Video Analysis",         icon: Video,     free: "3 / month",   pro: "Unlimited" },
  { label: "Club Battles",           icon: Shield,    free: false,         pro: true },
  { label: "Priority Support",       icon: Zap,       free: false,         pro: true },
  { label: "Early Access Features",  icon: Crown,     free: false,         pro: true },
];

// ─── Cell renderer ────────────────────────────────────────────────────────────
function FeatureCell({ value }: { value: string | boolean }) {
  if (value === true) {
    return <Check className="w-4 h-4 text-[#22c55e] mx-auto" />;
  }
  if (value === false) {
    return <Minus className="w-4 h-4 text-white/20 mx-auto" />;
  }
  return <span className="text-white/70 text-xs font-medium">{value}</span>;
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface ProUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Optionally highlight a specific feature row by label */
  highlightFeature?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────
export function ProUpgradeModal({ isOpen, onClose, highlightFeature }: ProUpgradeModalProps) {
  // Close on Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleKeyDown]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="pro-upgrade-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Modal panel */}
          <motion.div
            key="pro-upgrade-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Open Beta — All Pro Features Free"
            initial={{ opacity: 0, y: 32, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-[201] flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-[#0d1a0f] border border-[#22c55e]/20 shadow-2xl pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-white/60 hover:text-white transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Header */}
              <div className="px-6 pt-8 pb-6 text-center border-b border-white/[0.06]">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#22c55e]/10 border border-[#22c55e]/20 mb-4">
                  <Gift className="w-6 h-6 text-[#22c55e]" />
                </div>

                {/* Open Beta badge */}
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#22c55e]/10 border border-[#22c55e]/25 text-[#22c55e] text-xs font-bold tracking-wider uppercase mb-4">
                  <Sparkles className="w-3 h-3" />
                  Open Beta
                </div>

                <h2 className="text-2xl font-bold text-white mb-2">
                  All Pro Features — Free Right Now
                </h2>
                <p className="text-white/50 text-sm max-w-md mx-auto leading-relaxed">
                  We're in open beta. Every Pro feature is unlocked for all users at no cost
                  while we build, refine, and grow the platform together.
                </p>
              </div>

              {/* Open Beta value prop */}
              <div className="px-6 py-5 border-b border-white/[0.06]">
                <div className="rounded-xl bg-[#22c55e]/[0.07] border border-[#22c55e]/20 p-5">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-[#22c55e]/15 flex items-center justify-center">
                      <Crown className="w-5 h-5 text-[#22c55e]" />
                    </div>
                    <div>
                      <p className="text-white font-semibold text-sm mb-1">
                        You have full Pro access — no credit card needed
                      </p>
                      <p className="text-white/45 text-xs leading-relaxed">
                        Explore the Openings Library, run Coach Insights, and use every feature
                        below. When paid plans launch, early beta users will receive a special
                        founding member rate.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Future pricing preview */}
                <div className="mt-4 flex items-center gap-3">
                  <div className="flex-1 rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 text-center">
                    <p className="text-white/30 text-[10px] font-semibold uppercase tracking-wider mb-1">
                      Future Monthly
                    </p>
                    <div className="flex items-baseline justify-center gap-0.5">
                      <span className="text-white/20 text-xs">$</span>
                      <span className="text-white/40 text-2xl font-bold line-through decoration-white/20">9.99</span>
                    </div>
                    <p className="text-white/20 text-[10px] mt-0.5">/ month</p>
                  </div>
                  <div className="flex-1 rounded-xl bg-[#22c55e]/[0.05] border border-[#22c55e]/15 p-4 text-center relative overflow-hidden">
                    <div className="absolute top-2 right-2">
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#22c55e]/20 text-[#22c55e] border border-[#22c55e]/30">
                        BEST VALUE
                      </span>
                    </div>
                    <p className="text-white/30 text-[10px] font-semibold uppercase tracking-wider mb-1">
                      Future Annual
                    </p>
                    <div className="flex items-baseline justify-center gap-0.5">
                      <span className="text-white/30 text-xs">$</span>
                      <span className="text-white/50 text-2xl font-bold line-through decoration-white/30">79.99</span>
                    </div>
                    <p className="text-white/30 text-[10px] mt-0.5">/ year · save 33%</p>
                  </div>
                </div>
                <p className="text-center text-white/25 text-[11px] mt-2">
                  Prices shown are planned — no charges during open beta
                </p>
              </div>

              {/* CTA — just close the modal, user already has access */}
              <div className="px-6 py-5 border-b border-white/[0.06]">
                <button
                  onClick={onClose}
                  className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-[#22c55e] hover:bg-[#16a34a] text-black font-bold text-base transition-colors shadow-lg shadow-[#22c55e]/20"
                >
                  <Sparkles className="w-5 h-5" />
                  Start Exploring — It&apos;s Free
                </button>
                <p className="mt-2.5 text-center text-white/25 text-xs">
                  No account required · No credit card · Open beta
                </p>
              </div>

              {/* Feature comparison table */}
              <div className="px-6 pb-8 pt-5">
                <h3 className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-3">
                  Everything that&apos;s included
                </h3>
                <div className="rounded-xl border border-white/[0.06] overflow-hidden">
                  {/* Table header */}
                  <div className="grid grid-cols-[1fr_80px_80px] bg-white/[0.03] border-b border-white/[0.06]">
                    <div className="px-4 py-2.5 text-white/30 text-xs font-semibold uppercase tracking-wider">
                      Feature
                    </div>
                    <div className="px-2 py-2.5 text-center text-white/30 text-xs font-semibold uppercase tracking-wider">
                      Free
                    </div>
                    <div className="px-2 py-2.5 text-center text-[#22c55e] text-xs font-semibold uppercase tracking-wider">
                      Pro
                    </div>
                  </div>

                  {/* Table rows — during beta, Pro column reflects what users actually get */}
                  {FEATURES.map((row, idx) => {
                    const isHighlighted =
                      row.highlight ||
                      (highlightFeature !== undefined && row.label === highlightFeature);
                    const Icon = row.icon;
                    return (
                      <div
                        key={row.label}
                        className={`grid grid-cols-[1fr_80px_80px] items-center transition-colors ${
                          isHighlighted
                            ? "bg-[#22c55e]/[0.05] border-l-2 border-[#22c55e]/40"
                            : idx % 2 === 0
                            ? "bg-transparent"
                            : "bg-white/[0.015]"
                        } ${idx < FEATURES.length - 1 ? "border-b border-white/[0.04]" : ""}`}
                      >
                        <div className="flex items-center gap-2.5 px-4 py-3">
                          {Icon && (
                            <Icon
                              className={`w-3.5 h-3.5 flex-shrink-0 ${
                                isHighlighted ? "text-[#22c55e]" : "text-white/30"
                              }`}
                            />
                          )}
                          <span
                            className={`text-sm ${
                              isHighlighted ? "text-white font-semibold" : "text-white/60"
                            }`}
                          >
                            {row.label}
                          </span>
                        </div>
                        <div className="px-2 py-3 text-center">
                          <FeatureCell value={row.free} />
                        </div>
                        <div className="px-2 py-3 text-center">
                          <FeatureCell value={row.pro} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Beta footnote */}
                <p className="text-center text-white/20 text-[11px] mt-4 leading-relaxed">
                  During open beta all Pro features are available to everyone.
                  The Free / Pro split above reflects the planned post-beta structure.
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
