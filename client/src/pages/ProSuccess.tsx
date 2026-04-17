/**
 * ProSuccess — /pro/success
 *
 * Stripe redirects here after a successful checkout session.
 * The page re-fetches the user session (so isPro is updated from the
 * webhook-activated DB record) and shows a welcome confirmation.
 *
 * The session_id query param is present but we don't need to use it
 * client-side — the webhook already updated isPro on the server.
 */

import { useEffect, useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  Crown,
  Check,
  BookOpen,
  Brain,
  Target,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export default function ProSuccess() {
  const { user, loading } = useAuth();
  const [pollCount, setPollCount] = useState(0);
  const [confirmed, setConfirmed] = useState(false);

  // Poll /api/auth/me up to 8 times (every 1.5 s) waiting for isPro to be true.
  // The Stripe webhook may arrive a few seconds after the redirect.
  useEffect(() => {
    if (user?.isPro) {
      setConfirmed(true);
      return;
    }
    if (pollCount >= 8 || loading) return;

    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        const data = await res.json();
        if (data?.user?.isPro) {
          setConfirmed(true);
        } else {
          setPollCount((c) => c + 1);
        }
      } catch {
        setPollCount((c) => c + 1);
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [pollCount, user, loading]);

  const isStillWaiting = !confirmed && pollCount < 8 && !user?.isPro;

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-md text-center"
      >
        {isStillWaiting ? (
          /* ── Waiting for webhook ─────────────────────────────────────────── */
          <>
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#22c55e]/10 border border-[#22c55e]/20 mb-6">
              <Loader2 className="w-8 h-8 text-[#22c55e] animate-spin" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">
              Activating your Pro account…
            </h2>
            <p className="text-white/40 text-sm leading-relaxed">
              Your payment was successful. We're activating Pro access now — this takes just a moment.
            </p>
          </>
        ) : (
          /* ── Confirmed ───────────────────────────────────────────────────── */
          <>
            {/* Animated checkmark */}
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
              className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-[#22c55e]/10 border border-[#22c55e]/25 mb-6 relative"
            >
              <Crown className="w-10 h-10 text-[#22c55e]" />
              <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-[#22c55e] flex items-center justify-center">
                <Check className="w-3.5 h-3.5 text-black" strokeWidth={3} />
              </div>
            </motion.div>

            <h2 className="text-3xl font-bold text-white mb-3">
              Welcome to Pro!
            </h2>
            <p className="text-white/50 text-sm leading-relaxed mb-8 max-w-sm mx-auto">
              Your Pro membership is now active. Every feature is unlocked — start exploring.
            </p>

            {/* Quick links */}
            <div className="grid grid-cols-3 gap-3 mb-8">
              {[
                { icon: BookOpen, label: "Openings",  href: "/openings" },
                { icon: Brain,    label: "Insights",  href: "/" },
                { icon: Target,   label: "Prep",      href: "/prep" },
              ].map(({ icon: Icon, label, href }) => (
                <Link key={label} href={href}>
                  <div className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-[#22c55e]/30 hover:bg-[#22c55e]/[0.04] transition-all cursor-pointer group">
                    <Icon className="w-5 h-5 text-[#22c55e] group-hover:scale-110 transition-transform" />
                    <span className="text-white/60 text-xs font-medium">{label}</span>
                  </div>
                </Link>
              ))}
            </div>

            <Link href="/">
              <button className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#22c55e] hover:bg-[#16a34a] text-black font-bold text-sm transition-colors">
                Go to dashboard
                <ArrowRight className="w-4 h-4" />
              </button>
            </Link>

            {/* Manage subscription */}
            <p className="mt-5 text-white/20 text-xs">
              Manage your subscription anytime in{" "}
              <Link href="/profile">
                <span className="text-white/40 hover:text-white/60 underline cursor-pointer transition-colors">
                  your profile
                </span>
              </Link>
            </p>
          </>
        )}
      </motion.div>
    </div>
  );
}
