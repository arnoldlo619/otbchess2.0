/**
 * HeroDashboardMockup
 *
 * Premium hero section dashboard mockup — exact port of the Magic UI
 * startup template hero-section.tsx pattern:
 *
 * - Outer wrapper: perspective:2000px + fade-up entrance animation
 * - Inner frame: rounded-xl border + before: blur glow (image-glow animation)
 * - BorderBeam: animated conic-gradient beam travelling around the border
 * - Images: full-width, object-cover, dark/light mode swap
 * - Bottom fade-out gradient into hero background
 * - Hover: subtle scale-up + intensified glow via CSS group hover
 */
import React, { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { BorderBeam } from "./border-beam";

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
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  // Brand colors for the beam
  const colorFrom = isDark ? "oklch(0.65 0.14 145)" : "oklch(0.55 0.13 145)";
  const colorTo = isDark ? "oklch(0.44 0.12 145)" : "oklch(0.41 0.09 152)";

  // Background color for the fade-out gradient (must match hero section bg)
  const heroBg = isDark ? "oklch(0.20 0.06 145)" : "#F5F8F5";

  // Glow color for hover intensification
  const glowColor = isDark
    ? "oklch(0.55 0.14 145 / 0.55)"
    : "oklch(0.45 0.12 145 / 0.35)";
  const glowColorBase = isDark
    ? "oklch(0.44 0.12 145 / 0.20)"
    : "oklch(0.41 0.09 152 / 0.12)";

  return (
    <div
      ref={ref}
      className="relative mt-[5rem] mb-[-10rem] w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-0 group hidden md:block"
      style={{ perspective: "2000px" }}
    >
      {/* Fade-out overlay at the bottom — blends into the green stats bar */}
      <div
        className="absolute inset-x-0 bottom-0 z-10 pointer-events-none"
        style={{
          height: "35%",
          background: `linear-gradient(to top, #436850 0%, ${heroBg} 60%, transparent 100%)`,
        }}
      />

      {/* Ambient glow behind the frame — intensifies on hover */}
      <div
        className="absolute inset-x-4 -inset-y-4 rounded-2xl pointer-events-none transition-all duration-500 ease-out blur-2xl"
        style={{
          background: `radial-gradient(ellipse 70% 40% at 50% 100%, ${glowColorBase}, transparent)`,
        }}
      />
      <div
        className="absolute inset-x-4 -inset-y-4 rounded-2xl pointer-events-none opacity-0 group-hover:opacity-100 transition-all duration-500 ease-out blur-2xl"
        style={{
          background: `radial-gradient(ellipse 80% 50% at 50% 100%, ${glowColor}, transparent)`,
        }}
      />

      {/* Inner frame — scales up on hover */}
      <motion.div
        className={`relative rounded-xl border border-border bg-white/[0.01] overflow-hidden
          before:absolute before:bottom-1/2 before:left-0 before:top-0
          before:h-full before:w-full before:opacity-0
          before:[filter:blur(180px)]
          before:[background-image:linear-gradient(to_bottom,${isDark ? "oklch(0.44_0.12_145)" : "oklch(0.55_0.13_145)"},${isDark ? "oklch(0.44_0.12_145)" : "oklch(0.55_0.13_145)"},transparent_40%)]
          ${inView ? "before:animate-image-glow" : ""}
        `}
        initial={{ opacity: 0, y: 48 }}
        animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 48 }}
        transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1], delay: 0.4 }}
        whileHover={{
          scale: 1.018,
          transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] },
        }}
        style={{
          willChange: "transform",
        }}
      >
        {/* Animated border beam */}
        <BorderBeam
          size={250}
          duration={12}
          delay={11}
          colorFrom={colorFrom}
          colorTo={colorTo}
        />

        {/* Dark mode screenshot */}
        <img
          src={darkScreenshotUrl}
          alt={alt}
          className={`relative w-full h-full rounded-[inherit] object-cover object-top block ${isDark ? "" : "hidden"}`}
        />

        {/* Light mode screenshot */}
        <img
          src={lightScreenshotUrl}
          alt={alt}
          className={`relative w-full h-full rounded-[inherit] object-cover object-top block ${isDark ? "hidden" : ""}`}
        />
      </motion.div>
    </div>
  );
}
