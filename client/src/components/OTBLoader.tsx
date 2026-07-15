/**
 * OTBLoader — Platform-wide loader component
 *
 * Uses the 3D isometric chess board SMIL-animated SVG as the brand loader.
 * SVG SMIL animations play correctly inside <img> tags in all modern browsers.
 *
 * Usage:
 *   <OTBLoader />                        — default (96px, no label)
 *   <OTBLoader size={120} label="Loading tournament…" />
 *   <OTBLoader fullPage />               — centered full-page overlay
 *   <OTBLoader fullPage label="Loading" isDark />
 */

interface OTBLoaderProps {
  /** Width/height of the animation in px. Default: 96 */
  size?: number;
  /** Optional text label shown below the animation */
  label?: string;
  /** If true, wraps in a min-h-screen centered full-page container */
  fullPage?: boolean;
  /** Override dark background for full-page variant. Auto-detected via CSS class if omitted. */
  isDark?: boolean;
  /** Additional className for the wrapper */
  className?: string;
}

const SVG_SRC = "/manus-storage/3DChess_d323926b.svg";

export function OTBLoader({
  size = 96,
  label,
  fullPage = false,
  isDark,
  className = "",
}: OTBLoaderProps) {
  const inner = (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <img
        src={SVG_SRC}
        alt="Loading…"
        width={size}
        height={size}
        style={{ width: size, height: size, objectFit: "contain" }}
        draggable={false}
      />
      {label && (
        <p
          className={`text-sm font-medium tracking-wide ${
            isDark === false
              ? "text-[#436850]/70"
              : "text-white/50"
          }`}
        >
          {label}
        </p>
      )}
    </div>
  );

  if (!fullPage) return inner;

  return (
    <div
      className={`min-h-screen flex items-center justify-center ${
        isDark === false
          ? "bg-white"
          : "bg-[#0a1409]"
      }`}
    >
      {inner}
    </div>
  );
}

export default OTBLoader;
