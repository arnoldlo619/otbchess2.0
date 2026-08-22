/*
 * OTB Chess — Full-Screen Check-In Announce Modal
 * Purpose: Display the meetup check-in QR code in a large, high-visibility
 *          format for projection or holding up to a room. Designed to be readable
 *          from across a chess hall. Mirrors the tournament AnnounceModal design.
 *
 * Usage: Club owners open this from the meetup event page header "Check-in QR Code" button.
 *        Members scan the QR code to navigate to the check-in page.
 */

import { useEffect, useRef, useState } from "react";
import { useWakeLock } from "@/hooks/useWakeLock";
import { useAccessibleOverlay } from "@/hooks/useAccessibleOverlay";
import { QRCodeSVG } from "qrcode.react";
import { X, Copy, Check, Maximize2 } from "lucide-react";
import { toast } from "sonner";

interface CheckInAnnounceModalProps {
  open: boolean;
  onClose: () => void;
  eventName: string;
  checkInUrl: string;
}

export function CheckInAnnounceModal({
  open,
  onClose,
  eventName,
  checkInUrl,
}: CheckInAnnounceModalProps) {
  const [urlCopied, setUrlCopied] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  useAccessibleOverlay({
    open,
    onClose,
    containerRef: overlayRef,
    initialFocusRef: closeButtonRef,
  });

  // Keep the screen awake while the QR code is displayed
  useWakeLock(open);

  // Prevent body scroll while open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  function copyUrl() {
    navigator.clipboard.writeText(checkInUrl);
    setUrlCopied(true);
    toast.success("Check-in link copied!");
    setTimeout(() => setUrlCopied(false), 1800);
  }

  // Strip query params from the displayed URL to keep it short and readable
  const displayUrl = (() => {
    try {
      const u = new URL(checkInUrl);
      return u.origin + u.pathname;
    } catch {
      return checkInUrl.split("?")[0];
    }
  })();

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Check in to ${eventName}`}
      tabIndex={-1}
      className="fixed inset-0 z-[100] flex flex-col bg-[oklch(0.14_0.07_145)]"
    >

      {/* ── Sticky top bar ─────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 pt-16 pb-3 sm:px-6 sm:pt-18 sm:pb-4">
        {/* Left: hint */}
        <div className="flex items-center gap-1.5 text-white/25 text-xs">
          <Maximize2 className="w-3.5 h-3.5" />
          <span className="hidden sm:block">Press Escape to close</span>
          <span className="sm:hidden">Tap × to close</span>
        </div>

        {/* Right: close button */}
        <button
          ref={closeButtonRef}
          onClick={onClose}
          aria-label="Close check-in screen"
          className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/60 hover:text-white transition-all active:scale-90 touch-manipulation"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* ── Scrollable content ───────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        <div className="flex flex-col items-center gap-6 sm:gap-8 px-6 py-4 pb-10 w-full max-w-2xl mx-auto text-center">

          {/* Event name */}
          <div>
            <p className="text-white/40 text-sm font-semibold uppercase tracking-[0.2em] mb-1">
              Check in to the meetup
            </p>
            <h1
              className="text-white text-2xl sm:text-4xl font-bold leading-tight"
              style={{ fontFamily: "'Clash Display', sans-serif" }}
            >
              {eventName}
            </h1>
          </div>

          {/* QR code */}
          <div className="relative">
            {/* Glow effect */}
            <div className="absolute inset-0 rounded-3xl bg-[#4CAF50]/20 blur-2xl scale-110 pointer-events-none" />
            <div className="relative p-5 sm:p-7 bg-white rounded-3xl shadow-2xl">
              <QRCodeSVG
                value={checkInUrl}
                size={220}
                level="H"
                includeMargin={false}
                fgColor="#1a1a1a"
                bgColor="#ffffff"
              />
            </div>
            {/* Corner accent marks */}
            {(["top-0 left-0", "top-0 right-0", "bottom-0 left-0", "bottom-0 right-0"] as const).map((pos) => (
              <div
                key={pos}
                className={`absolute ${pos} w-6 h-6 border-[#4CAF50] ${
                  pos.includes("top") && pos.includes("left")    ? "border-t-2 border-l-2 rounded-tl-2xl" :
                  pos.includes("top") && pos.includes("right")   ? "border-t-2 border-r-2 rounded-tr-2xl" :
                  pos.includes("bottom") && pos.includes("left") ? "border-b-2 border-l-2 rounded-bl-2xl" :
                  "border-b-2 border-r-2 rounded-br-2xl"
                }`}
              />
            ))}
          </div>

          {/* Copy link button */}
          <div className="flex flex-col items-center gap-2">
            <p
              className="text-xs font-semibold uppercase tracking-[0.25em] transition-colors duration-300"
              style={{ color: urlCopied ? "#4CAF50" : "rgba(255,255,255,0.35)" }}
            >
              {urlCopied ? "Copied!" : "Or share this link"}
            </p>

            <button
              onClick={copyUrl}
              title="Click to copy check-in link"
              aria-label="Copy check-in link"
              className="group relative flex items-center gap-3 px-8 py-4 rounded-2xl transition-all duration-300 active:scale-95 touch-manipulation overflow-hidden"
              style={{
                background: urlCopied
                  ? "rgba(76,175,80,0.18)"
                  : "rgba(255,255,255,0.06)",
                border: urlCopied
                  ? "1.5px solid rgba(76,175,80,0.55)"
                  : "1.5px solid rgba(255,255,255,0.12)",
                boxShadow: urlCopied
                  ? "0 0 28px 4px rgba(76,175,80,0.25), inset 0 0 16px rgba(76,175,80,0.10)"
                  : "none",
              }}
            >
              {/* Ripple sweep overlay on copy */}
              {urlCopied && (
                <span
                  className="pointer-events-none absolute inset-0 rounded-2xl"
                  style={{
                    background:
                      "radial-gradient(circle at 50% 50%, rgba(76,175,80,0.22) 0%, transparent 70%)",
                    animation: "otb-checkin-flash 0.45s ease-out forwards",
                  }}
                />
              )}

              {/* URL text */}
              <span
                className="relative font-mono font-bold tracking-wide text-lg sm:text-xl select-all transition-colors duration-300 break-all"
                style={{
                  fontFamily: "'Clash Display', monospace",
                  color: urlCopied ? "#6EE77A" : "#ffffff",
                  textShadow: urlCopied
                    ? "0 0 18px rgba(76,175,80,0.70)"
                    : "none",
                }}
              >
                {displayUrl}
              </span>

              {/* Copy / check icon */}
              <span className="relative text-white/30 group-hover:text-white/60 transition-colors flex-shrink-0">
                {urlCopied
                  ? <Check className="w-5 h-5" style={{ color: "#4CAF50" }} />
                  : <Copy className="w-5 h-5" />}
              </span>
            </button>
          </div>

          {/* Instruction hint */}
          <p className="text-white/25 text-xs font-mono tracking-wide">
            Members scan to check in · Sign-in required
          </p>

        </div>
      </div>

      {/* ── Keyframe for the radial sweep flash ─────────────────────────────── */}
      <style>{`
        @keyframes otb-checkin-flash {
          0%   { opacity: 0; transform: scale(0.6); }
          40%  { opacity: 1; transform: scale(1.05); }
          100% { opacity: 0; transform: scale(1.3); }
        }
      `}</style>
    </div>
  );
}
