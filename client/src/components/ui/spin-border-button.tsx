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
 * Light mode glass:  white/cream fill, subtle gray border, dark green text
 * Dark mode glass:   dark fill, white/20 border, white text
 */
import React from "react";
import { cn } from "@/lib/utils";

export interface SpinBorderButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "solid" | "outline" | "glass";
  /** Render as a different element (e.g. pass an <a> or wouter <Link> as child) */
  asChild?: boolean;
  children?: React.ReactNode;
  className?: string;
}

export const SpinBorderButton = React.forwardRef<
  HTMLButtonElement,
  SpinBorderButtonProps
>(({ variant = "solid", className, children, asChild, ...props }, ref) => {
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
        "group relative inline-flex overflow-hidden rounded-lg p-[1.5px]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[oklch(0.65_0.18_145)] focus-visible:ring-offset-2",
        "disabled:pointer-events-none disabled:opacity-50",
        "cursor-pointer",
        className
      )}
      {...props}
    >
      {/* Spinning conic-gradient layer */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-[-200%]",
          "animate-[spin_3s_linear_infinite] group-hover:animate-[spin_1.5s_linear_infinite]",
          isSolid
            ? "bg-[conic-gradient(from_90deg_at_50%_50%,oklch(0.44_0.12_145)_0%,oklch(0.82_0.18_145)_40%,#ffffff_50%,oklch(0.82_0.18_145)_60%,oklch(0.44_0.12_145)_100%)]"
            : "bg-[conic-gradient(from_90deg_at_50%_50%,oklch(0.44_0.12_145)_0%,oklch(0.75_0.16_145)_40%,#ffffff_50%,oklch(0.75_0.16_145)_60%,oklch(0.44_0.12_145)_100%)]"
        )}
      />

      {/* Inner content surface */}
      <span
        className={cn(
          "relative z-10 inline-flex w-full items-center justify-center gap-2 rounded-[5px]",
          "px-6 py-3 text-sm font-semibold tracking-wide",
          "transition-all duration-200",
          isSolid
            ? "bg-[oklch(0.44_0.12_145)] text-white group-hover:bg-[oklch(0.40_0.12_145)]"
            : "bg-[oklch(0.18_0.05_145)/0.85] text-[oklch(0.75_0.14_145)] backdrop-blur-sm group-hover:bg-[oklch(0.22_0.06_145)/0.90] dark:bg-[oklch(0.18_0.05_145)/0.85] dark:text-[oklch(0.78_0.15_145)]"
        )}
      >
        {children}
      </span>
    </button>
  );
});

SpinBorderButton.displayName = "SpinBorderButton";
