/**
 * BorderBeam — animated conic-gradient beam that travels around a border.
 * Ported from Magic UI (magicui.design) for use in the hero dashboard mockup.
 */
import React from "react";

interface BorderBeamProps {
  /** Size of the beam in pixels */
  size?: number;
  /** Duration of one full rotation in seconds */
  duration?: number;
  /** Delay before the animation starts in seconds */
  delay?: number;
  /** Starting color of the beam */
  colorFrom?: string;
  /** Ending color of the beam */
  colorTo?: string;
  /** Additional className */
  className?: string;
}

export function BorderBeam({
  size = 200,
  duration = 12,
  delay = 0,
  colorFrom = "#ffaa40",
  colorTo = "#9c40ff",
  className = "",
}: BorderBeamProps) {
  return (
    <div
      className={`absolute inset-0 rounded-[inherit] pointer-events-none ${className}`}
      style={
        {
          "--size": `${size}px`,
          "--duration": `${duration}s`,
          "--delay": `-${delay}s`,
          "--color-from": colorFrom,
          "--color-to": colorTo,
        } as React.CSSProperties
      }
    >
      <div
        className="absolute inset-0 rounded-[inherit]"
        style={{
          background:
            "linear-gradient(to right, transparent, transparent)",
          maskImage:
            "linear-gradient(white, white), linear-gradient(white, white)",
          maskComposite: "exclude",
          WebkitMaskComposite: "xor",
        }}
      />
      {/* The actual animated beam */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "inherit",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            aspectRatio: "1",
            width: "var(--size)",
            animationName: "border-beam",
            animationDuration: "var(--duration)",
            animationDelay: "var(--delay)",
            animationTimingFunction: "linear",
            animationIterationCount: "infinite",
            background: `conic-gradient(from 0deg, transparent 0deg, var(--color-from) 60deg, var(--color-to) 120deg, transparent 180deg)`,
            offsetPath: `rect(0 auto auto 0 round inherit)`,
            // Fallback for browsers without offset-path rect support
          }}
          className="animate-border-beam"
        />
      </div>
    </div>
  );
}
