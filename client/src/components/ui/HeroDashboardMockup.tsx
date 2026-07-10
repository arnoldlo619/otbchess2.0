/**
 * HeroDashboardMockup
 *
 * A premium browser-frame mockup component for the landing page hero section.
 * Design pattern: Linear / Magic UI — browser chrome with perspective tilt,
 * radial glow, gradient mask at top, and a subtle border glow.
 *
 * The mockup fades in from below on mount (framer-motion).
 */
import React from "react";
import { motion } from "framer-motion";

interface HeroDashboardMockupProps {
  /** Screenshot URL to display inside the browser frame */
  screenshotUrl: string;
  /** Whether the page is in dark mode */
  isDark: boolean;
  /** Alt text for the screenshot */
  alt?: string;
}

export function HeroDashboardMockup({
  screenshotUrl,
  isDark,
  alt = "OTB Chess tournament dashboard",
}: HeroDashboardMockupProps) {
  const accent = isDark ? "oklch(0.65 0.14 145)" : "#436850";
  const accentRgb = isDark ? "74, 175, 80" : "67, 104, 80";

  return (
    <motion.div
      className="relative w-full max-w-5xl mx-auto mt-10 sm:mt-12"
      initial={{ opacity: 0, y: 40, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.75 }}
      style={{ perspective: "1200px" }}
    >
      {/* Radial glow behind the mockup */}
      <div
        className="absolute inset-x-0 -top-12 h-64 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 70% 60% at 50% 40%, rgba(${accentRgb}, ${isDark ? "0.18" : "0.12"}) 0%, transparent 70%)`,
          zIndex: 0,
        }}
      />

      {/* 3D-tilted browser frame wrapper */}
      <motion.div
        className="relative rounded-xl overflow-hidden"
        style={{
          transformStyle: "preserve-3d",
          rotateX: "6deg",
          transformOrigin: "50% 100%",
          boxShadow: isDark
            ? `0 0 0 1px rgba(${accentRgb}, 0.22), 0 32px 80px rgba(0,0,0,0.55), 0 0 60px rgba(${accentRgb}, 0.10)`
            : `0 0 0 1px rgba(${accentRgb}, 0.18), 0 24px 64px rgba(0,0,0,0.18), 0 0 40px rgba(${accentRgb}, 0.08)`,
          zIndex: 1,
        }}
      >
        {/* ── Browser Chrome Bar ── */}
        <div
          className="flex items-center gap-2 px-4 py-3 select-none"
          style={{
            background: isDark ? "oklch(0.14 0.04 145)" : "oklch(0.96 0.01 145)",
            borderBottom: isDark
              ? "1px solid rgba(255,255,255,0.07)"
              : "1px solid rgba(0,0,0,0.08)",
          }}
        >
          {/* Traffic lights */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="w-3 h-3 rounded-full bg-[#FF5F57]" />
            <span className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
            <span className="w-3 h-3 rounded-full bg-[#28C840]" />
          </div>

          {/* URL bar */}
          <div
            className="flex-1 flex items-center gap-1.5 rounded-md px-3 py-1.5 mx-2 max-w-sm mx-auto"
            style={{
              background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
              border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.07)",
            }}
          >
            {/* Lock icon */}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ color: accent, flexShrink: 0 }}>
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span
              className="text-[11px] font-medium truncate"
              style={{ color: isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.45)" }}
            >
              chessotb.club/tournament/otb-open-2026
            </span>
          </div>

          {/* Right spacer — mirrors traffic lights width */}
          <div className="w-[54px] flex-shrink-0" />
        </div>

        {/* ── Screenshot ── */}
        <div className="relative overflow-hidden" style={{ maxHeight: "520px" }}>
          <img
            src={screenshotUrl}
            alt={alt}
            className="w-full object-cover object-top block"
            style={{ display: "block" }}
            loading="eager"
            decoding="async"
          />

          {/* Bottom fade-out gradient — blends screenshot into hero background */}
          <div
            className="absolute inset-x-0 bottom-0 h-40 pointer-events-none"
            style={{
              background: isDark
                ? "linear-gradient(to bottom, transparent 0%, oklch(0.20 0.06 145) 100%)"
                : "linear-gradient(to bottom, transparent 0%, #F5F8F5 100%)",
            }}
          />
        </div>
      </motion.div>

      {/* Top gradient mask — blends mockup top into hero */}
      <div
        className="absolute inset-x-0 top-0 h-10 pointer-events-none"
        style={{
          background: isDark
            ? "linear-gradient(to bottom, oklch(0.20 0.06 145) 0%, transparent 100%)"
            : "linear-gradient(to bottom, #F5F8F5 0%, transparent 100%)",
          zIndex: 2,
        }}
      />
    </motion.div>
  );
}
