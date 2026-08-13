/** Shared ChessOTB loader for route, panel, and inline async states. */

import { useEffect, useState } from "react";

interface OTBLoaderProps {
  /** Width/height of the animated mark in px. Default: 88 (inline) / 132 (full-page). */
  size?: number;
  /** Concise status announced to assistive technology. */
  label?: string;
  /** If true, wraps in a min-h-screen centered full-page surface. */
  fullPage?: boolean;
  /** Override dark/light background. Auto-detected from <html class="dark"> if omitted. */
  isDark?: boolean;
  /** Additional className for the outer wrapper. */
  className?: string;
}

export function OTBLoader({
  size,
  label,
  fullPage = false,
  isDark,
  className = "",
}: OTBLoaderProps) {
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

  const resolvedSize = size ?? (fullPage ? 132 : 88);
  const statusLabel = label ?? "Loading ChessOTB";

  const inner = (
    <div
      className={`otb-loader ${dark ? "otb-loader--dark" : ""} ${className}`}
      role="status"
      aria-live="polite"
      aria-label={statusLabel}
    >
      <div className="otb-loader__stage" style={{ width: resolvedSize, height: resolvedSize }} aria-hidden="true">
        {Array.from({ length: 7 }, (_, index) => (
          <span
            key={index}
            className="otb-loader__square"
            style={{ animationDelay: `${-1.4285714286 * index}s` }}
          />
        ))}
      </div>

      {label && <p className="otb-loader__label">{label}</p>}
    </div>
  );

  if (!fullPage) return inner;

  return (
    <div
      className={`otb-loader-page ${dark ? "otb-loader-page--dark" : ""}`}
    >
      {inner}
    </div>
  );
}

export default OTBLoader;
