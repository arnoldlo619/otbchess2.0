/** Shared ChessOTB loader for route, panel, and inline async states. */

import { useEffect, useRef, useState } from "react";

export const OTB_LOADER_VIDEO_SOURCE = "/videos/chessotb-club-loader.mp4";
export const OTB_LOADER_POSTER_SOURCE = "/videos/chessotb-club-loader-poster.webp";

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
  const [reducedMotion, setReducedMotion] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  const [videoUnavailable, setVideoUnavailable] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

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

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPreference = () => setReducedMotion(mediaQuery.matches);
    syncPreference();
    mediaQuery.addEventListener("change", syncPreference);
    return () => mediaQuery.removeEventListener("change", syncPreference);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || videoUnavailable) return;

    if (reducedMotion) {
      video.pause();
      video.currentTime = 0;
      return;
    }

    void video.play().catch(() => undefined);
  }, [reducedMotion, videoUnavailable]);

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
      <div
        className={`otb-loader__stage ${videoUnavailable ? "otb-loader__stage--fallback" : ""}`}
        style={{ width: resolvedSize, height: resolvedSize }}
        aria-hidden="true"
      >
        {videoUnavailable ? (
          Array.from({ length: 7 }, (_, index) => (
            <span
              key={index}
              className="otb-loader__square"
              style={{ animationDelay: `${-1.4285714286 * index}s` }}
            />
          ))
        ) : (
          <video
            ref={videoRef}
            className="otb-loader__video"
            src={OTB_LOADER_VIDEO_SOURCE}
            poster={OTB_LOADER_POSTER_SOURCE}
            autoPlay={!reducedMotion}
            loop={!reducedMotion}
            muted
            playsInline
            preload="auto"
            onError={() => setVideoUnavailable(true)}
          />
        )}
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
