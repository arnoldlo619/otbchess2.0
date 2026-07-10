/**
 * HeroDashboardMockup
 *
 * Premium hero section dashboard mockup — exact port of the Magic UI
 * startup template hero-section.tsx pattern:
 *
 * - Outer wrapper: perspective:2000px + fade-up entrance animation
 * - Inner frame: rounded-xl border + before: blur glow (image-glow animation)
 * - BorderBeam: animated conic-gradient beam travelling around the border
 * - Images: full-width, object-contain, dark/light mode swap
 * - After pseudo-element: gradient fade from bottom into hero background
 *
 * Dark mode: dark tournament screenshot (green-themed)
 * Light mode: light tournament screenshot (white/sage-themed)
 */
import React, { useRef } from "react";
import { useInView } from "framer-motion";
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

  return (
    <div
      ref={ref}
      className="relative mt-[5rem] w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-0"
      style={{
        perspective: "2000px",
        // After pseudo-element: fade bottom of mockup into hero background
      }}
    >
      {/* Fade-out overlay at the bottom — matches Magic UI's after:absolute pattern */}
      <div
        className="absolute inset-x-0 bottom-0 z-10 pointer-events-none"
        style={{
          height: "40%",
          background: `linear-gradient(to top, ${heroBg} 30%, transparent 100%)`,
        }}
      />

      {/* Inner frame: border + glow pseudo-element */}
      <div
        className={`relative rounded-xl border border-border bg-white/[0.01] overflow-hidden
          before:absolute before:bottom-1/2 before:left-0 before:top-0
          before:h-full before:w-full before:opacity-0
          before:[filter:blur(180px)]
          before:[background-image:linear-gradient(to_bottom,${isDark ? "oklch(0.44_0.12_145)" : "oklch(0.55_0.13_145)"},${isDark ? "oklch(0.44_0.12_145)" : "oklch(0.55_0.13_145)"},transparent_40%)]
          ${inView ? "before:animate-image-glow" : ""}
        `}
        style={{
          opacity: inView ? 1 : 0,
          transform: inView ? "translateY(0)" : "translateY(3rem)",
          transition: "opacity 0.65s cubic-bezier(0.22,1,0.36,1) 0.4s, transform 0.65s cubic-bezier(0.22,1,0.36,1) 0.4s",
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
      </div>
    </div>
  );
}
