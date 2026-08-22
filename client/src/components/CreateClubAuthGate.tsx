/**
 * CreateClubAuthGate
 *
 * Shown when a logged-out user clicks "Create Club".
 * Presents three options:
 *   1. Sign in → then open wizard
 *   2. Sign up → then open wizard
 *   3. Preview the wizard (read-only demo, no account needed)
 */

import { useRef, useState } from "react";
import { X, Trophy, Users, Star, ChevronRight, Eye } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import AuthModal from "@/components/AuthModal";
import { useAccessibleOverlay } from "@/hooks/useAccessibleOverlay";

interface Props {
  onClose: () => void;
  /** Called after successful auth so the parent can open the real wizard */
  onAuthenticated: () => void;
  /** Called when user chooses "Preview" (no auth) */
  onPreview: () => void;
}

export function CreateClubAuthGate({ onClose, onAuthenticated, onPreview }: Props) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [showAuth, setShowAuth] = useState(false);
  const [authTab, setAuthTab] = useState<"signin" | "signup">("signup");
  const overlayRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  useAccessibleOverlay({
    open: !showAuth,
    onClose,
    containerRef: overlayRef,
    initialFocusRef: closeButtonRef,
  });

  const bg = isDark ? "bg-[#0d1a0f]" : "bg-white";
  const card = isDark ? "bg-[#142018]" : "bg-[#f5f8f5]";
  const border = isDark ? "border-white/10" : "border-black/8";
  const textMain = isDark ? "text-white" : "text-[#12372A]";
  const textMuted = isDark ? "text-white/55" : "text-[#436850]";
  const accent = isDark ? "oklch(0.65 0.14 145)" : "#436850";

  const perks = [
    { icon: Trophy, label: "Host OTB tournaments" },
    { icon: Users, label: "Build your chess community" },
    { icon: Star, label: "Track ratings & results" },
  ];

  if (showAuth) {
    return (
      <AuthModal
        isOpen
        onClose={() => setShowAuth(false)}
        initialTab={authTab}
        onSuccess={() => {
          setShowAuth(false);
          onAuthenticated();
        }}
      />
    );
  }

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-club-auth-title"
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Card */}
      <div
        className={`relative w-full max-w-sm rounded-2xl border ${border} ${bg} shadow-2xl overflow-hidden`}
        style={{ fontFamily: "'Inter', sans-serif" }}
      >
        {/* Micro-checkered hero */}
        <div
          className="relative h-28 flex items-center justify-center overflow-hidden"
          style={{
            background: isDark ? "oklch(0.18 0.06 145)" : "#e8f5e9",
          }}
        >
          <div
            className="absolute inset-0 opacity-40"
            style={{
              backgroundImage: `repeating-conic-gradient(${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"} 0% 25%, transparent 0% 50%)`,
              backgroundSize: "8px 8px",
            }}
          />
          <div className="relative text-center">
            <div
              className="text-3xl font-black tracking-tight"
              style={{ fontFamily: "'Clash Display', sans-serif", color: accent }}
            >
              OTB!!
            </div>
            <p className={`text-xs mt-0.5 font-medium ${isDark ? "text-white/60" : "text-[#436850]/70"}`}>
              Start your chess club
            </p>
          </div>
        </div>

        {/* Close */}
        <button
          ref={closeButtonRef}
          onClick={onClose}
          aria-label="Close create club sign-in options"
          className={`absolute top-3 right-3 p-1.5 rounded-lg transition-colors ${isDark ? "text-white/40 hover:text-white/80 hover:bg-white/10" : "text-[#436850] hover:text-[#12372A] hover:bg-black/5"}`}
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-5 space-y-4">
          <div>
            <h2 id="create-club-auth-title" className={`text-lg font-bold ${textMain}`}>Create a Club</h2>
            <p className={`text-sm mt-0.5 ${textMuted}`}>
              Sign in or create an account to get started.
            </p>
          </div>

          {/* Perks */}
          <div className={`rounded-xl border ${border} ${card} p-3 space-y-2`}>
            {perks.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2.5">
                <div
                  className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                  style={{ background: isDark ? "oklch(0.22 0.07 145)" : "#d4edda" }}
                >
                  <Icon className="w-3.5 h-3.5" style={{ color: accent }} />
                </div>
                <span className={`text-sm font-medium ${textMain}`}>{label}</span>
              </div>
            ))}
          </div>

          {/* CTAs */}
          <div className="space-y-2">
            <button
              onClick={() => { setAuthTab("signup"); setShowAuth(true); }}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98]"
              style={{ background: `linear-gradient(135deg, ${accent}, oklch(0.55 0.16 145))` }}
            >
              <span>Create free account</span>
              <ChevronRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => { setAuthTab("signin"); setShowAuth(true); }}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-semibold border transition-all hover:opacity-80 active:scale-[0.98] ${border} ${isDark ? "text-white/80 bg-white/5 hover:bg-white/8" : "text-[#12372A]/85 bg-[#FBFADA]/70 hover:bg-[#ADBC9F]/50"}`}
            >
              <span>Sign in to existing account</span>
              <ChevronRight className="w-4 h-4" />
            </button>

            <button
              onClick={onPreview}
              className={`w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-medium transition-colors ${isDark ? "text-white/40 hover:text-white/60" : "text-[#436850] hover:text-[#436850]"}`}
            >
              <Eye className="w-3.5 h-3.5" />
              Preview wizard without signing in
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
