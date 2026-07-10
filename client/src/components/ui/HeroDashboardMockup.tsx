/**
 * HeroDashboardMockup
 *
 * Premium hero section dashboard mockup — styled after Magic UI's startup template.
 * Design: flat (no perspective tilt), centered below CTAs, rounded corners,
 * subtle border + layered shadow, bottom fade-out gradient into hero background.
 *
 * Dark mode: uses the dark tournament screenshot.
 * Light mode: uses the light tournament screenshot.
 */
import React from "react";
import { motion } from "framer-motion";

interface HeroDashboardMockupProps {
  /** Screenshot URL for dark mode */
  darkScreenshotUrl: string;
  /** Screenshot URL for light mode */
  lightScreenshotUrl: string;
  /** Whether the page is in dark mode */
  isDark: boolean;
  /** Alt text for the screenshot */
  alt?: string;
}

export function HeroDashboardMockup({
  darkScreenshotUrl,
  lightScreenshotUrl,
  isDark,
  alt = "OTB Chess tournament dashboard",
}: HeroDashboardMockupProps) {
  const screenshotUrl = isDark ? darkScreenshotUrl : lightScreenshotUrl;

  return (
    <motion.div
      className="relative w-full max-w-5xl mx-auto mt-8 sm:mt-10 px-4 sm:px-6 lg:px-0"
      initial={{ opacity: 0, y: 48 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1], delay: 0.75 }}
    >
      {/* Radial glow behind the mockup */}
      <div
        className="absolute inset-x-0 -top-16 h-48 pointer-events-none"
        style={{
          background: isDark
            ? "radial-gradient(ellipse 80% 50% at 50% 50%, oklch(0.44 0.12 145 / 0.20) 0%, transparent 70%)"
            : "radial-gradient(ellipse 80% 50% at 50% 50%, oklch(0.55 0.13 145 / 0.14) 0%, transparent 70%)",
        }}
      />

      {/* Mockup frame */}
      <div
        className="relative rounded-2xl overflow-hidden"
        style={{
          border: isDark
            ? "1px solid rgba(255, 255, 255, 0.10)"
            : "1px solid rgba(0, 0, 0, 0.10)",
          boxShadow: isDark
            ? "0 4px 6px -1px rgba(0,0,0,0.4), 0 20px 60px -8px rgba(0,0,0,0.6), 0 0 0 1px rgba(74,175,80,0.08)"
            : "0 4px 6px -1px rgba(0,0,0,0.08), 0 20px 60px -8px rgba(0,0,0,0.18), 0 0 0 1px rgba(67,104,80,0.06)",
        }}
      >
        {/* Screenshot */}
        <img
          src={screenshotUrl}
          alt={alt}
          className="w-full block object-cover object-top"
          style={{ maxHeight: "600px" }}
          loading="eager"
          decoding="async"
        />

        {/* Bottom fade-out gradient — blends into hero background */}
        <div
          className="absolute inset-x-0 bottom-0 pointer-events-none"
          style={{
            height: "45%",
            background: isDark
              ? "linear-gradient(to bottom, transparent 0%, oklch(0.20 0.06 145 / 0.85) 60%, oklch(0.20 0.06 145) 100%)"
              : "linear-gradient(to bottom, transparent 0%, rgba(245, 248, 245, 0.85) 60%, #F5F8F5 100%)",
          }}
        />
      </div>
    </motion.div>
  );
}
