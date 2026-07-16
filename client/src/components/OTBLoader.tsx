/**
 * OTBLoader — Platform-wide loader component
 *
 * Uses the 3D isometric chess board SMIL-animated SVG as the brand loader.
 * SVG SMIL animations play correctly inside <img> tags in all modern browsers.
 *
 * Usage:
 *   <OTBLoader />                        — inline (96px, no label)
 *   <OTBLoader size={120} label="Loading tournament…" />
 *   <OTBLoader fullPage />               — centered full-page overlay (auto theme)
 *   <OTBLoader fullPage isDark />        — force dark background
 *   <OTBLoader fullPage isDark={false} /> — force light background
 */

import { useEffect, useState } from "react";

interface OTBLoaderProps {
  /** Width/height of the animation in px. Default: 120 (inline) / 240 (fullPage) */
  size?: number;
  /** Optional text label shown below the animation */
  label?: string;
  /** If true, wraps in a min-h-screen centered full-page container */
  fullPage?: boolean;
  /** Override dark/light background. Auto-detected from <html class="dark"> if omitted. */
  isDark?: boolean;
  /** Additional className for the wrapper */
  className?: string;
}

const SVG_SRC = "/manus-storage/3DChess_d323926b.svg";

export function OTBLoader({
  size,
  label,
  fullPage = false,
  isDark,
  className = "",
}: OTBLoaderProps) {
  // Auto-detect dark mode from the html element if isDark is not explicitly set
  const [autoDark, setAutoDark] = useState(() =>
    typeof document !== "undefined"
      ? document.documentElement.classList.contains("dark")
      : true
  );

  useEffect(() => {
    if (isDark !== undefined) return; // explicit override — no need to observe
    const check = () =>
      setAutoDark(document.documentElement.classList.contains("dark"));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => obs.disconnect();
  }, [isDark]);

  const dark = isDark !== undefined ? isDark : autoDark;

  // Default size: 240px for fullPage, 120px for inline
  const resolvedSize = size ?? (fullPage ? 240 : 120);

  const inner = (
    <div
      className={`flex flex-col items-center justify-center gap-4 ${className}`}
    >
      {/* Subtle ambient glow ring behind the board */}
      <div
        style={{
          position: "relative",
          width: resolvedSize,
          height: resolvedSize,
        }}
      >
        {/* Pulsing radial glow */}
        <div
          style={{
            position: "absolute",
            inset: "-20%",
            borderRadius: "50%",
            background: dark
              ? "radial-gradient(circle, rgba(91,154,106,0.18) 0%, transparent 70%)"
              : "radial-gradient(circle, rgba(67,104,80,0.12) 0%, transparent 70%)",
            animation: "otb-pulse 2s ease-in-out infinite",
          }}
        />
        <img
          src={SVG_SRC}
          alt="Loading…"
          width={resolvedSize}
          height={resolvedSize}
          style={{
            width: resolvedSize,
            height: resolvedSize,
            objectFit: "contain",
            position: "relative",
            zIndex: 1,
            // Invert the SVG in dark mode so the black board reads as white/light
            filter: dark ? "invert(1) brightness(0.9)" : "none",
          }}
          draggable={false}
        />
      </div>

      {label && (
        <p
          style={{
            fontSize: 13,
            fontWeight: 500,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: dark ? "rgba(255,255,255,0.45)" : "rgba(67,104,80,0.65)",
            margin: 0,
          }}
        >
          {label}
        </p>
      )}

      {/* Keyframe injected once via a style tag */}
      <style>{`
        @keyframes otb-pulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50%       { opacity: 1;   transform: scale(1.08); }
        }
      `}</style>
    </div>
  );

  if (!fullPage) return inner;

  return (
    <div
      style={{
        minHeight: "100svh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: dark ? "#0a1409" : "#ffffff",
      }}
    >
      {inner}
    </div>
  );
}

export default OTBLoader;
