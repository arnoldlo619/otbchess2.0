/**
 * DynamicSquare — Animated feature card with chess-board square grid background.
 * The grid is always visible through a semi-transparent card surface.
 * Squares near the cursor glow lime green (#7CF562) — OTB brand accent.
 *
 * Architecture:
 *  - Outer wrapper: dark/light bg with rounded corners + overflow hidden
 *  - Layer 1 (z-0): CSS chess-square grid (SVG pattern via backgroundImage)
 *  - Layer 2 (z-1): Mouse-proximity glow overlay (canvas, pointer-events:none)
 *  - Layer 3 (z-2): Rotating conic-gradient border (1px inset)
 *  - Layer 4 (z-10): Card content on semi-transparent frosted surface
 */

import React, { useEffect, useRef, useState, useCallback } from "react";
import { motion, useAnimationFrame } from "framer-motion";

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

const SQUARE_SIZE = 24;          // chess square size in px
const GLOW_RADIUS = 90;          // px radius of cursor glow
const GLOW_PEAK = 0.55;          // max glow opacity at cursor center

// ── Mouse glow canvas overlay ─────────────────────────────────────────────────

function GlowOverlay({ isDark }: { isDark: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef<{ x: number; y: number } | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Resize canvas to match container
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;
    const { width, height } = wrapper.getBoundingClientRect();
    if (canvas.width !== Math.round(width) || canvas.height !== Math.round(height)) {
      canvas.width = Math.round(width);
      canvas.height = Math.round(height);
    }
  }, []);

  useEffect(() => {
    resizeCanvas();
    const ro = new ResizeObserver(resizeCanvas);
    if (wrapperRef.current) ro.observe(wrapperRef.current);
    return () => ro.disconnect();
  }, [resizeCanvas]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const onMove = (e: MouseEvent) => {
      const rect = wrapper.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const onLeave = () => { mouseRef.current = null; };
    wrapper.addEventListener("mousemove", onMove);
    wrapper.addEventListener("mouseleave", onLeave);
    return () => {
      wrapper.removeEventListener("mousemove", onMove);
      wrapper.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  useAnimationFrame(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { width: w, height: h } = canvas;
    ctx.clearRect(0, 0, w, h);

    const mouse = mouseRef.current;
    if (!mouse) return;

    // Draw glowing squares near cursor
    const glowColor = isDark ? "124, 245, 98" : "67, 104, 80";  // RGB
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
        const alpha = t * t * GLOW_PEAK;  // quadratic falloff
        ctx.fillStyle = `rgba(${glowColor}, ${alpha})`;
        ctx.fillRect(col * SQUARE_SIZE, row * SQUARE_SIZE, SQUARE_SIZE, SQUARE_SIZE);
      }
    }
  });

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

function AnimatedBorder({ isDark }: { isDark: boolean }) {
  const [angle, setAngle] = useState(0);
  useAnimationFrame((t) => {
    setAngle((t / 25) % 360);
  });

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

// ── Chess square grid background ──────────────────────────────────────────────

function ChessGrid({ isDark }: { isDark: boolean }) {
  // Two alternating square colors — subtle, like a real chess board
  const light = isDark ? "oklch(0.26 0.07 145)" : "oklch(0.91 0.03 145)";
  const dark  = isDark ? "oklch(0.22 0.07 145)" : "oklch(0.87 0.04 145)";
  const s = SQUARE_SIZE;

  // SVG checkerboard pattern
  const svg = `
    <svg xmlns='http://www.w3.org/2000/svg' width='${s * 2}' height='${s * 2}'>
      <rect width='${s * 2}' height='${s * 2}' fill='${light}'/>
      <rect x='0' y='0' width='${s}' height='${s}' fill='${dark}'/>
      <rect x='${s}' y='${s}' width='${s}' height='${s}' fill='${dark}'/>
    </svg>
  `.trim();
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

  const handleClick = () => {
    if (onClick) onClick();
    else if (buttonHref) window.location.href = buttonHref;
  };

  // Semi-transparent frosted surface so chess grid shows through
  const surfaceBg = isDark
    ? "oklch(0.22 0.07 145 / 0.82)"
    : "oklch(0.97 0.02 145 / 0.85)";

  const outerBg = isDark
    ? "oklch(0.20 0.06 145)"
    : "oklch(0.89 0.04 145)";

  return (
    <motion.div
      className={`relative rounded-2xl overflow-hidden cursor-pointer group ${className}`}
      style={{ background: outerBg, minHeight: "200px" }}
      whileHover={{ scale: 1.025, y: -4 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 320, damping: 26 }}
      onClick={handleClick}
    >
      {/* Layer 0: Chess square grid */}
      <ChessGrid isDark={isDark} />

      {/* Layer 1: Mouse proximity glow overlay */}
      <GlowOverlay isDark={isDark} />

      {/* Layer 2: Rotating conic border */}
      <AnimatedBorder isDark={isDark} />

      {/* Layer 3: Card content — semi-transparent so grid shows through */}
      <div
        className="relative z-10 m-[1px] rounded-[calc(1rem-1px)] p-6 flex flex-col gap-3 h-[calc(100%-2px)]"
        style={{
          background: surfaceBg,
          backdropFilter: "blur(0px)",  // no blur — keep grid crisp
        }}
      >
        {/* Header: icon + tag */}
        <div className="flex items-center justify-between">
          {icon && (
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors duration-200"
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
          className="text-base font-semibold leading-snug"
          style={{ color: isDark ? "oklch(0.93 0.05 145)" : "oklch(0.24 0.07 155)" }}
        >
          {title}
        </h3>

        {/* Description */}
        <p
          className="text-sm leading-relaxed flex-1"
          style={{ color: isDark ? "oklch(0.68 0.07 145)" : "oklch(0.38 0.09 152)" }}
        >
          {description}
        </p>

        {/* CTA button */}
        {buttonText && (
          <motion.button
            className="mt-2 w-full rounded-xl py-2.5 text-sm font-semibold tracking-wide"
            style={{
              background: isDark
                ? "oklch(0.27 0.08 145 / 0.9)"
                : "oklch(0.41 0.09 152 / 0.09)",
              color: isDark ? "oklch(0.88 0.08 145)" : "oklch(0.24 0.07 155)",
              border: isDark
                ? "1px solid oklch(0.38 0.10 145 / 0.5)"
                : "1px solid oklch(0.41 0.09 152 / 0.22)",
            }}
            whileHover={{
              background: isDark ? "#7CF562" : "oklch(0.41 0.09 152)",
              color: isDark ? "oklch(0.14 0.05 145)" : "#fff",
              scale: 1.02,
            }}
            whileTap={{ scale: 0.97 }}
            transition={{ duration: 0.14 }}
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

export { DynamicSquare as Component };
export default DynamicSquare;
