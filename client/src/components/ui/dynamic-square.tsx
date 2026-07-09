/**
 * DynamicSquare — Animated feature card with chess-board dot grid background
 * and OTB brand color scheme (forest green / lime green accent).
 *
 * Adapted from the Eldoraui "dynamic-square" pattern.
 * Purple replaced with OTB green palette:
 *   - Dark bg:   oklch(0.20 0.06 145) — deep forest green
 *   - Card bg:   oklch(0.25 0.07 145) — slightly lighter
 *   - Accent:    #7CF562 — OTB lime green (same as bar-loader / icon glow)
 *   - Border:    oklch(0.35 0.09 145 / 0.6)
 *   - Dot grid:  oklch(0.35 0.09 145 / 0.5) on dark, oklch(0.73 0.07 145 / 0.4) on light
 */

import React, { useEffect, useRef, useState } from "react";
import { motion, useAnimationFrame } from "framer-motion";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DynamicSquareProps {
  /** Card title */
  title: string;
  /** Short description text */
  description: string;
  /** Badge label (e.g. "For Clubs", "AI-Powered") */
  tag?: string;
  /** Icon element rendered in the top-left */
  icon?: React.ReactNode;
  /** CTA button text */
  buttonText?: string;
  /** CTA button href — if omitted, button is not rendered */
  buttonHref?: string;
  /** onClick handler (alternative to href) */
  onClick?: () => void;
  /** Extra className on the outer wrapper */
  className?: string;
  /** Force dark mode appearance regardless of theme */
  forceDark?: boolean;
  /** Whether the card is in dark mode (passed from parent) */
  isDark?: boolean;
}

// ── Animated dot grid ─────────────────────────────────────────────────────────

interface DotGridProps {
  isDark: boolean;
}

const DOT_SIZE = 2;
const DOT_GAP = 18;
const GLOW_RADIUS = 80;
const GLOW_COLOR_DARK = "rgba(124, 245, 98, 0.55)";   // #7CF562 at 55%
const GLOW_COLOR_LIGHT = "rgba(67, 104, 80, 0.45)";    // #436850 at 45%

function DotGrid({ isDark }: DotGridProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const onLeave = () => { mouseRef.current = null; };
    container.addEventListener("mousemove", onMove);
    container.addEventListener("mouseleave", onLeave);
    return () => {
      container.removeEventListener("mousemove", onMove);
      container.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  useAnimationFrame(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const baseDotColor = isDark
      ? "rgba(124, 245, 98, 0.18)"
      : "rgba(67, 104, 80, 0.22)";
    const glowColor = isDark ? GLOW_COLOR_DARK : GLOW_COLOR_LIGHT;
    const mouse = mouseRef.current;

    for (let x = DOT_GAP / 2; x < w; x += DOT_GAP) {
      for (let y = DOT_GAP / 2; y < h; y += DOT_GAP) {
        let alpha = 1;
        if (mouse) {
          const dist = Math.hypot(x - mouse.x, y - mouse.y);
          if (dist < GLOW_RADIUS) {
            alpha = 1 + (1 - dist / GLOW_RADIUS) * 3.5;
          }
        }
        ctx.beginPath();
        ctx.arc(x, y, DOT_SIZE / 2, 0, Math.PI * 2);
        if (mouse && Math.hypot(x - mouse.x, y - mouse.y) < GLOW_RADIUS) {
          const dist = Math.hypot(x - mouse.x, y - mouse.y);
          const t = 1 - dist / GLOW_RADIUS;
          // Interpolate between base and glow
          ctx.fillStyle = t > 0.5 ? glowColor : baseDotColor;
          ctx.globalAlpha = Math.min(1, alpha * 0.6);
        } else {
          ctx.fillStyle = baseDotColor;
          ctx.globalAlpha = 1;
        }
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  });

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden rounded-2xl">
      <canvas
        ref={canvasRef}
        width={320}
        height={220}
        className="w-full h-full"
        style={{ display: "block" }}
      />
    </div>
  );
}

// ── Animated border gradient ──────────────────────────────────────────────────

function AnimatedBorder({ isDark }: { isDark: boolean }) {
  const [angle, setAngle] = useState(0);
  useAnimationFrame((t) => {
    setAngle((t / 20) % 360);
  });

  const borderColor = isDark
    ? `conic-gradient(from ${angle}deg, oklch(0.35 0.09 145 / 0.0) 0deg, #7CF562 60deg, oklch(0.35 0.09 145 / 0.0) 120deg)`
    : `conic-gradient(from ${angle}deg, oklch(0.73 0.07 145 / 0.0) 0deg, oklch(0.41 0.09 152) 60deg, oklch(0.73 0.07 145 / 0.0) 120deg)`;

  return (
    <div
      className="absolute inset-0 rounded-2xl"
      style={{
        padding: "1px",
        background: borderColor,
        WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
        WebkitMaskComposite: "xor",
        maskComposite: "exclude",
        pointerEvents: "none",
      }}
    />
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function DynamicSquare({
  title,
  description,
  tag,
  icon,
  buttonText,
  buttonHref,
  onClick,
  className = "",
  isDark = false,
}: DynamicSquareProps) {
  const bgCard = isDark
    ? "oklch(0.22 0.07 145)"
    : "oklch(0.97 0.02 145)";
  const bgOuter = isDark
    ? "oklch(0.18 0.06 145 / 0.6)"
    : "oklch(0.93 0.04 135 / 0.8)";

  const handleClick = () => {
    if (onClick) onClick();
    else if (buttonHref) window.location.href = buttonHref;
  };

  return (
    <motion.div
      className={`relative rounded-2xl overflow-hidden cursor-pointer group ${className}`}
      style={{ background: bgOuter }}
      whileHover={{ scale: 1.025, y: -3 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 340, damping: 28 }}
      onClick={handleClick}
    >
      {/* Animated dot grid background */}
      <DotGrid isDark={isDark} />

      {/* Animated rotating border */}
      <AnimatedBorder isDark={isDark} />

      {/* Card content */}
      <div
        className="relative z-10 p-6 flex flex-col gap-3"
        style={{ background: bgCard, margin: "1px", borderRadius: "calc(1rem - 1px)" }}
      >
        {/* Header row: icon + tag */}
        <div className="flex items-center justify-between">
          {icon && (
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{
                background: isDark
                  ? "oklch(0.30 0.09 145 / 0.6)"
                  : "oklch(0.41 0.09 152 / 0.10)",
                color: isDark ? "#7CF562" : "oklch(0.41 0.09 152)",
              }}
            >
              {icon}
            </div>
          )}
          {tag && (
            <span
              className="text-[10px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-full"
              style={{
                background: isDark
                  ? "oklch(0.30 0.09 145 / 0.7)"
                  : "oklch(0.41 0.09 152 / 0.12)",
                color: isDark ? "#7CF562" : "oklch(0.41 0.09 152)",
                border: isDark
                  ? "1px solid oklch(0.40 0.10 145 / 0.5)"
                  : "1px solid oklch(0.41 0.09 152 / 0.25)",
              }}
            >
              {tag}
            </span>
          )}
        </div>

        {/* Title */}
        <h3
          className="text-base font-semibold leading-snug"
          style={{ color: isDark ? "oklch(0.92 0.05 145)" : "oklch(0.24 0.07 155)" }}
        >
          {title}
        </h3>

        {/* Description */}
        <p
          className="text-sm leading-relaxed"
          style={{ color: isDark ? "oklch(0.65 0.08 145)" : "oklch(0.41 0.09 152)" }}
        >
          {description}
        </p>

        {/* CTA button */}
        {buttonText && (
          <motion.button
            className="mt-2 w-full rounded-xl py-2.5 text-sm font-semibold tracking-wide transition-colors"
            style={{
              background: isDark
                ? "oklch(0.28 0.08 145)"
                : "oklch(0.41 0.09 152 / 0.08)",
              color: isDark ? "oklch(0.88 0.08 145)" : "oklch(0.24 0.07 155)",
              border: isDark
                ? "1px solid oklch(0.38 0.10 145 / 0.5)"
                : "1px solid oklch(0.41 0.09 152 / 0.20)",
            }}
            whileHover={{
              background: isDark ? "#7CF562" : "oklch(0.41 0.09 152)",
              color: isDark ? "oklch(0.15 0.06 145)" : "#fff",
              scale: 1.02,
            }}
            whileTap={{ scale: 0.97 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => {
              e.stopPropagation();
              if (buttonHref) window.location.href = buttonHref;
              else if (onClick) onClick();
            }}
          >
            {buttonText}
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}

// Named export for the import pattern used in the demo: import { Component }
export { DynamicSquare as Component };
export default DynamicSquare;
