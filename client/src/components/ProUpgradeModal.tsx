/**
 * ProUpgradeModal — Live Stripe Payments edition.
 *
 * Shows a monthly / annual plan toggle, feature comparison table, and a
 * "Start Pro" button that calls POST /api/billing/checkout to create a
 * Stripe Checkout session and redirects the user.
 *
 * If the user is not signed in, clicking the CTA opens the AuthModal first.
 *
 * Usage:
 *   <ProUpgradeModal
 *     isOpen={showUpgrade}
 *     onClose={() => setShowUpgrade(false)}
 *     highlightFeature="Openings Library"   // optional — highlights a row
 *   />
 */

import { useEffect, useCallback, useState } from "react";
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
  Loader2,
  AlertCircle,
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

// ─── Cell renderer ────────────────────────────────────────────────────────────
function FeatureCell({ value }: { value: string | boolean }) {
  if (value === true)  return <Check className="w-4 h-4 text-[#22c55e] mx-auto" />;
  if (value === false) return <Minus className="w-4 h-4 text-white/20 mx-auto" />;
  return <span className="text-white/70 text-xs font-medium">{value}</span>;
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface ProUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Optionally highlight a specific feature row by label */
  highlightFeature?: string;
  /** Called when user needs to sign in first before upgrading */
  onNeedsAuth?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────
export function ProUpgradeModal({ isOpen, onClose, highlightFeature, onNeedsAuth }: ProUpgradeModalProps) {
  const { user } = useAuth();
  const [billingInterval, setBillingInterval] = useState<"monthly" | "annual">("annual");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Close on Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
      setError(null);
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleKeyDown]);

  // ── Checkout handler ──────────────────────────────────────────────────────
  const handleCheckout = async () => {
    // Require sign-in
    if (!user) {
      onClose();
      onNeedsAuth?.();
      return;
    }
    // Already Pro
    if (user.isPro) {
      onClose();
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ interval: billingInterval }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.error ?? "Failed to start checkout.");
      }
      // Redirect to Stripe Checkout
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  if (typeof document === "undefined") return null;

  const monthlyPrice = 9.99;
  const annualPrice  = 79.99;
  const annualMonthly = (annualPrice / 12).toFixed(2);
  const savingsPct = Math.round((1 - annualPrice / (monthlyPrice * 12)) * 100);

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
            transition={{ duration: 0.28, ease: "easeOut" }}
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
                <h2 className="text-2xl font-bold text-white mb-2">
                  Upgrade to Pro
                </h2>
                <p className="text-white/50 text-sm max-w-md mx-auto leading-relaxed">
                  Unlock the full OTB toolkit — openings library, coach insights,
                  unlimited analysis, and more.
                </p>
              </div>

              {/* Billing interval toggle */}
              <div className="px-6 py-5 border-b border-white/[0.06]">
                <div className="flex items-center justify-center gap-2 mb-5">
                  <div className="flex items-center bg-white/[0.04] rounded-xl p-1 gap-1 border border-white/[0.06]">
                    <button
                      onClick={() => setBillingInterval("monthly")}
                      className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                        billingInterval === "monthly"
                          ? "bg-white/[0.08] text-white"
                          : "text-white/40 hover:text-white/60"
                      }`}
                    >
                      Monthly
                    </button>
                    <button
                      onClick={() => setBillingInterval("annual")}
                      className={`relative px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                        billingInterval === "annual"
                          ? "bg-[#22c55e]/15 text-[#22c55e]"
                          : "text-white/40 hover:text-white/60"
                      }`}
                    >
                      Annual
                      <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#22c55e]/20 text-[#22c55e] border border-[#22c55e]/30">
                        Save {savingsPct}%
                      </span>
                    </button>
                  </div>
                </div>

                {/* Pricing display */}
                <div className="text-center mb-5">
                  {billingInterval === "monthly" ? (
                    <>
                      <div className="flex items-baseline justify-center gap-1">
                        <span className="text-white/40 text-lg">$</span>
                        <span className="text-white text-4xl font-bold">{monthlyPrice.toFixed(2)}</span>
                        <span className="text-white/30 text-sm">/ month</span>
                      </div>
                      <p className="text-white/30 text-xs mt-1">Billed monthly · cancel anytime</p>
                    </>
                  ) : (
                    <>
                      <div className="flex items-baseline justify-center gap-1">
                        <span className="text-white/40 text-lg">$</span>
                        <span className="text-white text-4xl font-bold">{annualMonthly}</span>
                        <span className="text-white/30 text-sm">/ month</span>
                      </div>
                      <p className="text-white/30 text-xs mt-1">
                        ${annualPrice.toFixed(2)} billed annually · cancel anytime
                      </p>
                    </>
                  )}
                </div>

                {/* Error message */}
                {error && (
                  <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-4">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {error}
                  </div>
                )}

                {/* CTA button */}
                <button
                  onClick={handleCheckout}
                  disabled={loading || user?.isPro}
                  className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-[#22c55e] hover:bg-[#16a34a] disabled:opacity-60 disabled:cursor-not-allowed text-black font-bold text-base transition-colors shadow-lg shadow-[#22c55e]/20"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Redirecting to checkout…
                    </>
                  ) : user?.isPro ? (
                    <>
                      <Check className="w-5 h-5" />
                      You&apos;re already Pro
                    </>
                  ) : !user ? (
                    <>
                      <Sparkles className="w-5 h-5" />
                      Sign in to upgrade
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      Start Pro — {billingInterval === "annual" ? `$${annualPrice.toFixed(2)}/yr` : `$${monthlyPrice.toFixed(2)}/mo`}
                    </>
                  )}
                </button>
                <p className="mt-2.5 text-center text-white/25 text-xs">
                  Secure checkout via Stripe · Cancel anytime · No hidden fees
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
