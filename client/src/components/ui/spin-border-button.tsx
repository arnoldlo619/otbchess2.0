/**
 * SpinBorderButton — spinning conic-gradient animated border button.
 *
 * Three variants:
 *  • "solid"   — filled green background, white text (Host Tournament style)
 *  • "outline" — transparent fill, shows the spinning border as the border
 *  • "glass"   — glassmorphic secondary CTA; auto-adapts for light/dark mode
 *
 * The conic gradient (solid/outline) spins continuously and speeds up on hover.
 * The glass variant uses a static border with a shimmer sweep on hover.
 *
 * All variants: the last SVG child (arrow icon) slides 4px right on hover via
 * the `[&>svg:last-child]` group-hover selector — no JSX changes needed at call sites.
 *
 * Light mode glass:  white/cream fill, subtle gray border, dark green text
 * Dark mode glass:   dark fill, white/20 border, white text
 */
import React from "react";
import { cn } from "@/lib/utils";

export interface SpinBorderButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "solid" | "outline" | "glass";
  /** Render as a different element (e.g. pass an anchor or wouter Link as child) */
  asChild?: boolean;
  children?: React.ReactNode;
  className?: string;
}

/** Tailwind classes shared by all variants to animate the last SVG (arrow icon) */
const ARROW_SLIDE =
  "[&>svg:last-child]:transition-transform [&>svg:last-child]:duration-200 [&>svg:last-child]:ease-out group-hover:[&>svg:last-child]:translate-x-1";

export const SpinBorderButton = React.forwardRef<
  HTMLButtonElement,
  SpinBorderButtonProps
>(({ variant = "solid", className, children, asChild: _asChild, ...props }, ref) => {
  const isSolid = variant === "solid";
  const isGlass = variant === "glass";

  // ── Glass variant ──────────────────────────────────────────────────────────
  if (isGlass) {
    return (
      <button
        ref={ref}
        className={cn(
          "group relative inline-flex items-center justify-center gap-2 overflow-hidden",
          "rounded-lg px-6 py-3 text-sm font-semibold tracking-wide",
          "transition-all duration-300 ease-out",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
          "disabled:pointer-events-none disabled:opacity-50",
          "cursor-pointer",

          // ── Light mode (base) ──────────────────────────────────────────────
          "border border-black/10 text-[#2A4A32]",
          "bg-white/70 backdrop-blur-md",
          "hover:bg-white/90 hover:border-[#3D6B47]/30 hover:text-[#1f3826]",
          "hover:shadow-[0_2px_16px_rgba(61,107,71,0.12)]",
          "focus-visible:ring-[#3D6B47]/40",

          // ── Dark mode overrides ────────────────────────────────────────────
          "dark:border-white/20 dark:text-white",
          "dark:bg-white/08",
          "dark:hover:bg-white/14 dark:hover:border-white/35",
          "dark:hover:shadow-[0_0_20px_rgba(255,255,255,0.08)]",
          "dark:focus-visible:ring-white/40",

          // ── Arrow micro-interaction ────────────────────────────────────────
          ARROW_SLIDE,

          className
        )}
        {...props}
      >
        {/* Shimmer sweep on hover — adapts colour per mode */}
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 -translate-x-full",
            "group-hover:translate-x-full transition-transform duration-700 ease-in-out",
          )}
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, rgba(61,107,71,0.06) 50%, transparent 100%)",
          }}
        />
        {/* Dark mode shimmer override via a second layer */}
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 -translate-x-full opacity-0",
            "dark:opacity-100",
            "group-hover:translate-x-full transition-transform duration-700 ease-in-out",
          )}
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.07) 50%, transparent 100%)",
          }}
        />
        {children}
      </button>
    );
  }

  // ── Solid / Outline variants (spinning conic-gradient border) ──────────────
  return (
    <button
      ref={ref}
      className={cn(
        "group relative inline-flex overflow-hidden rounded-xl p-[2px]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[oklch(0.65_0.18_145)] focus-visible:ring-offset-2",
        "disabled:pointer-events-none disabled:opacity-50",
        "cursor-pointer",
        className
      )}
      {...props}
    >
      {/* Spinning conic-gradient layer — uses a square aspect-ratio pseudo-element
          trick so the gradient always covers the button regardless of width */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
          "aspect-square w-[200%]",
          "animate-[spin_3s_linear_infinite] group-hover:animate-[spin_1.5s_linear_infinite]",
          isSolid
            ? "bg-[conic-gradient(from_90deg_at_50%_50%,oklch(0.44_0.12_145)_0%,oklch(0.82_0.18_145)_40%,#ffffff_50%,oklch(0.82_0.18_145)_60%,oklch(0.44_0.12_145)_100%)]"
            : "bg-[conic-gradient(from_90deg_at_50%_50%,oklch(0.44_0.12_145)_0%,oklch(0.75_0.16_145)_40%,#ffffff_50%,oklch(0.75_0.16_145)_60%,oklch(0.44_0.12_145)_100%)]"
        )}
      />

      {/* Inner content surface */}
      <span
        className={cn(
          "relative z-10 inline-flex w-full items-center justify-center gap-2 rounded-[9px]",
          "px-6 py-3.5 text-sm font-semibold tracking-wide whitespace-nowrap",
          "transition-all duration-200",
          // Arrow micro-interaction
          ARROW_SLIDE,
          isSolid
            ? "bg-[oklch(0.44_0.12_145)] text-white group-hover:bg-[oklch(0.40_0.12_145)]"
            : "bg-white text-[#2A4A32] group-hover:bg-[oklch(0.97_0.01_145)] dark:bg-[oklch(0.20_0.06_145)] dark:text-white dark:group-hover:bg-[oklch(0.22_0.06_145)]"
        )}
      >
        {children}
      </span>
    </button>
  );
});

SpinBorderButton.displayName = "SpinBorderButton";
