/**
 * AsciiArt — "D60-hero"
 * Animated ASCII art video banner. Drop it behind your content:
 * <div className="relative h-40"><AsciiArt className="absolute inset-0" /></div>
 * Source: https://21st.dev/community/ascii/editor?from=835f9c49-9087-4db1-a02d-62a0d38bff59
 *
 * Uses objectFit: "contain" so the full trophy animation is always visible.
 * Pass `style` to override objectPosition or other CSS properties per usage.
 */
import React from "react";

export function AsciiArt({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <video
      className={className}
      src="https://assets.21st.dev/ascii-recipes/videos/user_3GYHFar2zrRr79sK3wSzHGVOC0I/4b89c015-6b11-4816-b442-b125da0c8091.mp4"
      poster="https://assets.21st.dev/ascii-recipes/thumbnails/user_3GYHFar2zrRr79sK3wSzHGVOC0I/eb38ebaf-a2ac-432d-bf49-2fc832ae9eeb.png"
      autoPlay
      loop
      muted
      playsInline
      aria-label="D60-hero — animated ASCII art"
      style={{
        display: "block",
        width: "100%",
        height: "100%",
        objectFit: "contain",
        objectPosition: "center center",
        ...style,
      }}
    />
  );
}
