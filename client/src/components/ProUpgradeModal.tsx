/**
 * ProUpgradeModal — Full-screen Pro upgrade overlay.
 *
 * Features:
 *   - Feature comparison table (Free vs Pro)
 *   - Monthly / Annual plan toggle with savings badge
 *   - Prominent Stripe Checkout button
 *   - Animated entrance (framer-motion)
 *   - Accessible: Escape to close, aria-modal
 *
 * Usage:
 *   <ProUpgradeModal
 *     isOpen={showUpgrade}
 *     onClose={() => setShowUpgrade(false)}
 *     highlightFeature="Openings Library"   // optional — highlights a row
 *   />
 */

import { useState, useEffect, useCallback } from "react";
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
  Loader2,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

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

// ─── Plan definitions ─────────────────────────────────────────────────────────
type PlanId = "monthly" | "annual";

interface Plan {
  id: PlanId;
  label: string;
  price: number;
  period: string;
  savings?: string;
}

const PLANS: Plan[] = [
  { id: "monthly", label: "Monthly", price: 9.99,  period: "/ month" },
  { id: "annual",  label: "Annual",  price: 79.99, period: "/ year",  savings: "Save 33%" },
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
  const { user } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<PlanId>("annual");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleCheckout = async () => {
    if (!user) {
      onClose();
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: selectedPlan }),
        credentials: "include",
      });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        throw new Error(data.error ?? "Failed to start checkout. Please try again.");
      }
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
    }
  };

  const activePlan = PLANS.find((p) => p.id === selectedPlan) ?? PLANS[0];

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
            aria-label="Upgrade to Pro"
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
                  <Crown className="w-6 h-6 text-[#22c55e]" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-1">Upgrade to Pro</h2>
                <p className="text-white/50 text-sm">
                  Unlock the full OTB Chess experience — openings, analysis, and more.
                </p>
              </div>

              {/* Plan toggle */}
              <div className="px-6 py-5">
                <div className="flex items-center justify-center gap-2 mb-6">
                  {PLANS.map((plan) => (
                    <button
                      key={plan.id}
                      onClick={() => setSelectedPlan(plan.id)}
                      className={`relative flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all border ${
                        selectedPlan === plan.id
                          ? "bg-[#22c55e]/10 border-[#22c55e]/40 text-[#22c55e]"
                          : "bg-white/[0.04] border-white/10 text-white/50 hover:text-white/80"
                      }`}
                    >
                      {plan.label}
                      {plan.savings && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#22c55e] text-black">
                          {plan.savings}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Price display */}
                <div className="text-center mb-6">
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-bold text-white">
                      ${activePlan.price.toFixed(2)}
                    </span>
                    <span className="text-white/40 text-sm">{activePlan.period}</span>
                  </div>
                  {selectedPlan === "annual" && (
                    <p className="text-white/40 text-xs mt-1">
                      Billed annually — equivalent to $6.67 / month
                    </p>
                  )}
                </div>

                {/* CTA button */}
                <button
                  onClick={handleCheckout}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-[#22c55e] hover:bg-[#16a34a] disabled:opacity-60 disabled:cursor-not-allowed text-black font-bold text-base transition-colors shadow-lg shadow-[#22c55e]/20"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Redirecting to checkout…
                    </>
                  ) : (
                    <>
                      <Crown className="w-5 h-5" />
                      {user ? `Start ${activePlan.label} Pro` : "Sign in to Upgrade"}
                    </>
                  )}
                </button>

                {error && (
                  <p className="mt-3 text-center text-red-400 text-sm">{error}</p>
                )}

                <p className="mt-3 text-center text-white/30 text-xs">
                  Secure payment via Stripe · Cancel anytime
                </p>
              </div>

              {/* Feature comparison table */}
              <div className="px-6 pb-8">
                <h3 className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-3">
                  What&apos;s included
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

                  {/* Table rows */}
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
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
