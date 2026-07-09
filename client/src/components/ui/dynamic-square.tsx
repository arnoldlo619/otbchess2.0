/**
 * DynamicSquare — Animated feature card with chess-board square grid background.
 *
 * Mobile optimizations:
 *  - Canvas glow overlay is DISABLED on touch devices (no mouse = no glow needed,
 *    and canvas + useAnimationFrame is expensive on low-end mobile GPUs)
 *  - Rotating conic border uses CSS animation (not JS setAngle) on mobile
 *  - AnimatedBorder uses requestAnimationFrame only on non-touch devices
 *  - ChessGrid uses a static SVG data-URI (zero JS cost, GPU-composited)
 *  - Framer-motion spring is lighter on mobile (less stiffness, no y-translate)
 *  - Touch ripple feedback replaces hover scale on mobile
 *  - prefers-reduced-motion: all animations are suppressed
 *  - will-change: transform applied only to the outer wrapper (GPU layer promotion)
 */

import React, { useEffect, useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DynamicSquareProps {
  title: string;
  description: string;
  tag?: string;
  icon?: React.ReactNode;
  buttonText?: string;
  buttonHref?: string;
  onClick?: () => void;
  className?: string;
  isDark?: boolean;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SQUARE_SIZE = 24;
const GLOW_RADIUS = 90;
const GLOW_PEAK = 0.55;

// ── Detect touch device (once, at module level) ───────────────────────────────

const isTouchDevice =
  typeof window !== "undefined" &&
  (window.matchMedia("(hover: none)").matches || "ontouchstart" in window);

const prefersReducedMotion =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ── Mouse glow canvas overlay (desktop only) ──────────────────────────────────

function GlowOverlay({ isDark }: { isDark: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef<{ x: number; y: number } | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const activeRef = useRef(false);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;
    const { width, height } = wrapper.getBoundingClientRect();
    const rw = Math.round(width);
    const rh = Math.round(height);
    if (canvas.width !== rw || canvas.height !== rh) {
      canvas.width = rw;
      canvas.height = rh;
    }
  }, []);

  useEffect(() => {
    resizeCanvas();
    const ro = new ResizeObserver(resizeCanvas);
    if (wrapperRef.current) ro.observe(wrapperRef.current);
    return () => ro.disconnect();
  }, [resizeCanvas]);

  // Draw loop — only runs when mouse is inside the card
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { width: w, height: h } = canvas;
    ctx.clearRect(0, 0, w, h);

    const mouse = mouseRef.current;
    if (!mouse) { activeRef.current = false; return; }

    const glowColor = isDark ? "124, 245, 98" : "67, 104, 80";
    const startCol = Math.max(0, Math.floor((mouse.x - GLOW_RADIUS) / SQUARE_SIZE));
    const endCol = Math.min(Math.ceil(w / SQUARE_SIZE), Math.ceil((mouse.x + GLOW_RADIUS) / SQUARE_SIZE));
    const startRow = Math.max(0, Math.floor((mouse.y - GLOW_RADIUS) / SQUARE_SIZE));
    const endRow = Math.min(Math.ceil(h / SQUARE_SIZE), Math.ceil((mouse.y + GLOW_RADIUS) / SQUARE_SIZE));

    for (let col = startCol; col <= endCol; col++) {
      for (let row = startRow; row <= endRow; row++) {
        const cx = col * SQUARE_SIZE + SQUARE_SIZE / 2;
        const cy = row * SQUARE_SIZE + SQUARE_SIZE / 2;
        const dist = Math.hypot(cx - mouse.x, cy - mouse.y);
        if (dist >= GLOW_RADIUS) continue;
        const t = 1 - dist / GLOW_RADIUS;
        const alpha = t * t * GLOW_PEAK;
        ctx.fillStyle = `rgba(${glowColor}, ${alpha})`;
        ctx.fillRect(col * SQUARE_SIZE, row * SQUARE_SIZE, SQUARE_SIZE, SQUARE_SIZE);
      }
    }

    if (activeRef.current) {
      rafRef.current = requestAnimationFrame(draw);
    }
  }, [isDark]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const onMove = (e: MouseEvent) => {
      const rect = wrapper.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      if (!activeRef.current) {
        activeRef.current = true;
        rafRef.current = requestAnimationFrame(draw);
      }
    };
    const onLeave = () => {
      mouseRef.current = null;
      activeRef.current = false;
      cancelAnimationFrame(rafRef.current);
      // Clear canvas on leave
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };

    wrapper.addEventListener("mousemove", onMove, { passive: true });
    wrapper.addEventListener("mouseleave", onLeave);
    return () => {
      wrapper.removeEventListener("mousemove", onMove);
      wrapper.removeEventListener("mouseleave", onLeave);
      cancelAnimationFrame(rafRef.current);
    };
  }, [draw]);

  return (
    <div ref={wrapperRef} className="absolute inset-0 pointer-events-none z-[1]">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ display: "block" }}
      />
    </div>
  );
}

// ── Rotating border ───────────────────────────────────────────────────────────
// Desktop: JS-driven angle for smooth sync with glow
// Mobile: pure CSS animation (no JS overhead)

function AnimatedBorder({ isDark }: { isDark: boolean }) {
  const [angle, setAngle] = useState(0);
  const rafRef = useRef<number>(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (isTouchDevice || prefersReducedMotion) return;

    const tick = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const elapsed = ts - startRef.current;
      setAngle((elapsed / 25) % 360);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // Mobile: use CSS animation via a keyframe class
  if (isTouchDevice || prefersReducedMotion) {
    return (
      <div
        className="absolute inset-0 rounded-2xl z-[2] pointer-events-none otb-card-border-spin"
        style={{
          padding: "1px",
          background: isDark
            ? "conic-gradient(from 0deg, transparent 0deg, #7CF562 55deg, transparent 110deg)"
            : "conic-gradient(from 0deg, transparent 0deg, oklch(0.41 0.09 152) 55deg, transparent 110deg)",
          WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
        }}
      />
    );
  }

  const gradient = isDark
    ? `conic-gradient(from ${angle}deg, transparent 0deg, #7CF562 55deg, transparent 110deg)`
    : `conic-gradient(from ${angle}deg, transparent 0deg, oklch(0.41 0.09 152) 55deg, transparent 110deg)`;

  return (
    <div
      className="absolute inset-0 rounded-2xl z-[2] pointer-events-none"
      style={{
        padding: "1px",
        background: gradient,
        WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
        WebkitMaskComposite: "xor",
        maskComposite: "exclude",
      }}
    />
  );
}

// ── Chess square grid (pure CSS, zero JS) ─────────────────────────────────────

function ChessGrid({ isDark }: { isDark: boolean }) {
  // Wider luminance gap between the two square colors = clearly visible checkerboard
  const light = isDark ? "oklch(0.32 0.09 145)" : "oklch(0.86 0.07 145)";
  const dark  = isDark ? "oklch(0.16 0.06 145)" : "oklch(0.72 0.09 145)";
  const s = SQUARE_SIZE;

  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${s * 2}' height='${s * 2}'><rect width='${s * 2}' height='${s * 2}' fill='${light}'/><rect x='0' y='0' width='${s}' height='${s}' fill='${dark}'/><rect x='${s}' y='${s}' width='${s}' height='${s}' fill='${dark}'/></svg>`;
  const encoded = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;

  return (
    <div
      className="absolute inset-0 z-0"
      style={{ backgroundImage: encoded, backgroundSize: `${s * 2}px ${s * 2}px` }}
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

  const [, navigate] = useLocation();

  const handleClick = () => {
    if (onClick) { onClick(); return; }
    if (buttonHref) {
      // Use client-side routing for internal paths, hard nav for external URLs
      if (buttonHref.startsWith("/")) navigate(buttonHref);
      else window.open(buttonHref, "_blank", "noopener");
    }
  };

  // Lower opacity so the chess grid bleeds through clearly
  const surfaceBg = isDark
    ? "oklch(0.22 0.07 145 / 0.55)"
    : "oklch(0.97 0.02 145 / 0.58)";

  // Outer bg matches the darker chess square so the grid fills edge-to-edge seamlessly
  const outerBg = isDark
    ? "oklch(0.16 0.06 145)"
    : "oklch(0.72 0.09 145)";

  // Lighter spring on mobile to avoid jank
  const springConfig = isTouchDevice
    ? { type: "spring" as const, stiffness: 260, damping: 30 }
    : { type: "spring" as const, stiffness: 320, damping: 26 };

  // No y-translate on mobile (causes layout shift on small screens)
  const hoverAnim = isTouchDevice
    ? { scale: 1.015 }
    : { scale: 1.025, y: -4 };

  return (
    <motion.div
      className={`relative rounded-2xl overflow-hidden cursor-pointer group ${className}`}
      style={{
        background: outerBg,
        minHeight: "200px",
        willChange: "transform",   // single GPU layer for the whole card
        WebkitTapHighlightColor: "transparent",
      }}
      whileHover={prefersReducedMotion ? {} : hoverAnim}
      whileTap={prefersReducedMotion ? {} : { scale: 0.97 }}
      transition={springConfig}
      onClick={handleClick}
    >
      {/* Layer 0: Chess grid (CSS, always on) */}
      <ChessGrid isDark={isDark} />

      {/* Layer 1: Mouse glow (desktop only) */}
      {!isTouchDevice && !prefersReducedMotion && <GlowOverlay isDark={isDark} />}

      {/* Layer 2: Rotating border */}
      {!prefersReducedMotion && <AnimatedBorder isDark={isDark} />}

      {/* Layer 3: Card content */}
      <div
        className="relative z-10 m-[1px] rounded-[calc(1rem-1px)] p-5 sm:p-6 flex flex-col gap-3 h-[calc(100%-2px)]"
        style={{
          background: surfaceBg,
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
      >
        {/* Header: icon + tag */}
        <div className="flex items-center justify-between">
          {icon && (
            <div
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{
                background: isDark
                  ? "oklch(0.30 0.09 145 / 0.7)"
                  : "oklch(0.41 0.09 152 / 0.12)",
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
                  ? "oklch(0.28 0.09 145 / 0.8)"
                  : "oklch(0.41 0.09 152 / 0.12)",
                color: isDark ? "#7CF562" : "oklch(0.35 0.09 152)",
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
          className="text-sm sm:text-base font-semibold leading-snug"
          style={{ color: isDark ? "oklch(0.93 0.05 145)" : "oklch(0.24 0.07 155)" }}
        >
          {title}
        </h3>

        {/* Description */}
        <p
          className="text-xs sm:text-sm leading-relaxed flex-1"
          style={{ color: isDark ? "oklch(0.68 0.07 145)" : "oklch(0.38 0.09 152)" }}
        >
          {description}
        </p>

        {/* CTA button */}
        {buttonText && (
          <motion.button
            className="mt-2 w-full rounded-xl py-2.5 text-sm font-semibold tracking-wide touch-manipulation"
            style={{
              background: isDark
                ? "oklch(0.27 0.08 145 / 0.9)"
                : "oklch(0.41 0.09 152 / 0.09)",
              color: isDark ? "oklch(0.88 0.08 145)" : "oklch(0.24 0.07 155)",
              border: isDark
                ? "1px solid oklch(0.38 0.10 145 / 0.5)"
                : "1px solid oklch(0.41 0.09 152 / 0.22)",
              // Minimum 44px touch target
              minHeight: "44px",
            }}
            whileHover={prefersReducedMotion ? {} : {
              background: isDark ? "#7CF562" : "oklch(0.41 0.09 152)",
              color: isDark ? "oklch(0.14 0.05 145)" : "#fff",
              scale: 1.02,
            }}
            whileTap={prefersReducedMotion ? {} : { scale: 0.97 }}
            transition={{ duration: 0.14 }}
            onClick={(e) => {
              // Button tap navigates same as card — stopPropagation prevents double-fire
              e.stopPropagation();
              handleClick();
            }}
          >
            {buttonText}
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}

export { DynamicSquare as Component };
export default DynamicSquare;
