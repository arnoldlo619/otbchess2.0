/**
 * LichessEmbed.tsx — Secure Lichess iframe shell
 *
 * - Accepts only pre-validated embed URLs from embedUrlBuilder.ts
 * - Shows stable skeleton during load, timeout notice after 12s, retry + fallback
 * - No DOM access, no postMessage, no credential injection
 * - iframe title identifies the game or position for accessibility
 * - referrerPolicy="strict-origin-when-cross-origin"
 * - sandbox with minimum required capabilities
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { ExternalLink, RefreshCw, Loader2, AlertCircle } from "lucide-react";

interface LichessEmbedProps {
  /** Pre-validated embed URL from embedUrlBuilder.ts */
  embedUrl: string;
  /** Accessible title identifying the game or position */
  title: string;
  /** Full-page fallback URL (open in new tab) */
  fallbackUrl: string;
  /** Label for the fallback link */
  fallbackLabel: string;
  /** Minimum height for the iframe container */
  minHeight?: number;
  isDark: boolean;
}

const LOAD_TIMEOUT_MS = 12_000;

export function LichessEmbed({
  embedUrl,
  title,
  fallbackUrl,
  fallbackLabel,
  minHeight = 500,
  isDark,
}: LichessEmbedProps) {
  const [state, setState] = useState<"loading" | "loaded" | "slow" | "error">("loading");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Validate that the URL is on the allowed origin before rendering
  const isValidUrl = (() => {
    try {
      const url = new URL(embedUrl);
      return (
        url.origin === "https://lichess.org" &&
        (url.pathname.startsWith("/embed/game/") || url.pathname === "/embed/analysis")
      );
    } catch {
      return false;
    }
  })();

  useEffect(() => {
    setState("loading");
    timeoutRef.current = setTimeout(() => {
      setState(prev => prev === "loading" ? "slow" : prev);
    }, LOAD_TIMEOUT_MS);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [embedUrl]);

  const handleLoad = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setState("loaded");
  }, []);

  const handleError = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setState("error");
  }, []);

  const handleRetry = useCallback(() => {
    setState("loading");
    timeoutRef.current = setTimeout(() => {
      setState(prev => prev === "loading" ? "slow" : prev);
    }, LOAD_TIMEOUT_MS);
    // Force remount by reloading the iframe
    if (iframeRef.current) {
      iframeRef.current.src = embedUrl;
    }
  }, [embedUrl]);

  if (!isValidUrl) {
    return (
      <div
        className={`rounded-xl border flex items-center justify-center p-6 ${
          isDark ? "bg-red-500/10 border-red-500/20" : "bg-red-50 border-red-200"
        }`}
        style={{ minHeight }}
      >
        <div className="text-center space-y-2">
          <AlertCircle className="w-6 h-6 text-red-400 mx-auto" />
          <p className={`text-sm font-medium ${isDark ? "text-red-400" : "text-red-600"}`}>
            Invalid embed URL
          </p>
          <p className={`text-xs ${isDark ? "text-white/50" : "text-black/50"}`}>
            The embed URL did not pass security validation.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative" style={{ minHeight }}>
      {/* Loading skeleton */}
      {(state === "loading" || state === "slow") && (
        <div
          className={`absolute inset-0 rounded-xl flex flex-col items-center justify-center gap-3 ${
            isDark ? "bg-[#0f1c11] border border-[#1e2e22]" : "bg-[#f0f7f0] border border-[#ADBC9F]/40"
          }`}
          role="status"
          aria-label="Loading Lichess analysis board"
        >
          <Loader2 className="w-6 h-6 animate-spin text-[#7ed957]" />
          <p className={`text-xs ${isDark ? "text-white/50" : "text-black/50"}`}>
            {state === "slow" ? "Taking longer than expected…" : "Loading Lichess board…"}
          </p>
          {state === "slow" && (
            <div className="flex items-center gap-3 mt-1">
              <button
                onClick={handleRetry}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors ${
                  isDark ? "bg-white/10 text-white/70 hover:bg-white/15" : "bg-black/10 text-black/70 hover:bg-black/15"
                }`}
              >
                <RefreshCw className="w-3 h-3" />
                Retry embed
              </button>
              <a
                href={fallbackUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors ${
                  isDark ? "bg-[#7ed957]/15 text-[#7ed957] hover:bg-[#7ed957]/25" : "bg-[#436850]/10 text-[#436850] hover:bg-[#436850]/20"
                }`}
              >
                <ExternalLink className="w-3 h-3" />
                {fallbackLabel}
              </a>
            </div>
          )}
        </div>
      )}

      {/* Error state */}
      {state === "error" && (
        <div
          className={`absolute inset-0 rounded-xl flex flex-col items-center justify-center gap-3 ${
            isDark ? "bg-[#0f1c11] border border-[#1e2e22]" : "bg-[#f0f7f0] border border-[#ADBC9F]/40"
          }`}
          role="alert"
        >
          <AlertCircle className="w-6 h-6 text-amber-400" />
          <p className={`text-sm font-medium ${isDark ? "text-white/70" : "text-black/70"}`}>
            Lichess embed unavailable
          </p>
          <p className={`text-xs text-center max-w-xs ${isDark ? "text-white/40" : "text-black/40"}`}>
            The embed may be blocked by your browser or network settings.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRetry}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors ${
                isDark ? "bg-white/10 text-white/70 hover:bg-white/15" : "bg-black/10 text-black/70 hover:bg-black/15"
              }`}
            >
              <RefreshCw className="w-3 h-3" />
              Retry embed
            </button>
            <a
              href={fallbackUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors ${
                isDark ? "bg-[#7ed957]/15 text-[#7ed957] hover:bg-[#7ed957]/25" : "bg-[#436850]/10 text-[#436850] hover:bg-[#436850]/20"
              }`}
            >
              <ExternalLink className="w-3 h-3" />
              {fallbackLabel}
            </a>
          </div>
        </div>
      )}

      {/* The iframe — always rendered so load/error events fire */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <iframe
        ref={iframeRef}
        src={embedUrl}
        title={title}
        onLoad={handleLoad}
        onError={handleError}
        loading="eager"
        referrerPolicy="strict-origin-when-cross-origin"
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        style={{
          width: "100%",
          minHeight,
          border: "none",
          borderRadius: "12px",
          display: "block",
          // Hide iframe visually while loading/error (but keep it in DOM for events)
          opacity: state === "loaded" ? 1 : 0,
          transition: "opacity 0.3s ease",
        }}
        aria-label={title}
      />

      {/* External fallback link — always visible near the embed */}
      {state === "loaded" && (
        <div className="mt-2 flex justify-end">
          <a
            href={fallbackUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center gap-1.5 text-xs transition-colors ${
              isDark ? "text-white/30 hover:text-white/60" : "text-black/30 hover:text-black/60"
            }`}
          >
            <ExternalLink className="w-3 h-3" />
            {fallbackLabel}
          </a>
        </div>
      )}

      {/* Fair-play notice */}
      <p className={`mt-2 text-[10px] text-center ${isDark ? "text-white/25" : "text-black/25"}`}>
        For study before or after play. Never use analysis during an ongoing game.
        Engine and board controls inside the frame are provided by Lichess.
      </p>
    </div>
  );
}
