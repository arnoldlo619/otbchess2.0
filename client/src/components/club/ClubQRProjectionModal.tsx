/**
 * ClubQRProjectionModal
 * ─────────────────────
 * Full-screen QR projection overlay for club owners and directors.
 * Designed to be displayed on a projector or large monitor so that
 * attendees can scan to join the club or sign in if they're already members.
 *
 * Styled after SpectatorQRScreen — same dark background, same layout,
 * same corner accent marks, same copy/share actions.
 *
 * Smart URL logic:
 *   - Non-members scanning → /clubs/:slug  (join flow)
 *   - Existing members scanning → /clubs/:slug  (already signed in, lands on profile)
 *   - Not signed in → /clubs/:slug redirects to sign-in, then back to club
 *
 * A single URL handles all three cases because the club profile page already
 * shows the correct CTA based on auth + membership state.
 */

import { useEffect, useRef, useState } from "react";
import { useWakeLock } from "@/hooks/useWakeLock";
import { useAccessibleOverlay } from "@/hooks/useAccessibleOverlay";
import { QRCodeSVG } from "qrcode.react";
import {
  X, Maximize2, Copy, Check, Users, ExternalLink, QrCode,
} from "lucide-react";
import { toast } from "sonner";

interface ClubQRProjectionModalProps {
  open: boolean;
  onClose: () => void;
  clubName: string;
  clubSlug: string;
  /** Hex accent color for the club (used for glow + corner marks) */
  accent?: string;
  /** Club emoji flag or avatar initial */
  flag?: string;
  memberCount?: number;
}

export function ClubQRProjectionModal({
  open,
  onClose,
  clubName,
  clubSlug,
  accent = "#4CAF50",
  flag = "♟",
  memberCount,
}: ClubQRProjectionModalProps) {
  const [copied, setCopied] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  useAccessibleOverlay({
    open,
    onClose,
    containerRef: dialogRef,
    initialFocusRef: closeButtonRef,
  });

  // Keep screen awake while the QR is displayed
  useWakeLock(open);

  // Build the club URL — always the public club profile page
  const clubUrl = (() => {
    const base = typeof window !== "undefined"
      ? `${window.location.protocol}//${window.location.host}`
      : "https://chessotb.club";
    return `${base}/clubs/${encodeURIComponent(clubSlug)}`;
  })();

  const displayUrl = (() => {
    try {
      const u = new URL(clubUrl);
      return u.host + u.pathname;
    } catch {
      return clubUrl;
    }
  })();

  // ── Scroll lock ─────────────────────────────────────────────────────────────
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  // ── Helpers ─────────────────────────────────────────────────────────────────
  function copyLink() {
    navigator.clipboard.writeText(clubUrl).catch(() => {});
    setCopied(true);
    toast.success("Club link copied!");
    setTimeout(() => setCopied(false), 2500);
  }

  // Derive a slightly lighter glow color from accent
  const glowColor = accent + "33";
  const accentLight = accent + "CC";

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-[10000] flex flex-col"
      style={{ background: "oklch(0.13 0.06 240)" }}
      role="dialog"
      aria-modal="true"
      aria-label="Club QR projection screen"
      tabIndex={-1}
    >
      {/* ── Sticky top bar ───────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
        {/* Left: hint */}
        <div className="flex items-center gap-1.5 text-white/25 text-xs select-none">
          <Maximize2 className="w-3.5 h-3.5" />
          <span className="hidden sm:block">Press Escape to close</span>
          <span className="sm:hidden">Tap × to close</span>
        </div>
        {/* Right: close button — 44×44 px minimum tap target */}
        <button
          ref={closeButtonRef}
          onClick={onClose}
          aria-label="Close club QR screen"
          className="w-11 h-11 rounded-full flex items-center justify-center transition-all active:scale-90 touch-manipulation"
          style={{ background: "rgba(255,255,255,0.08)" }}
          onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.16)")}
          onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
        >
          <X className="w-5 h-5 text-white/60" />
        </button>
      </div>

      {/* ── Scrollable content ────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto overscroll-contain flex flex-col items-center justify-start sm:justify-center">

        {/* ── Main content ─────────────────────────────────────────────────────── */}
        <div className="flex flex-col lg:flex-row items-center justify-center gap-10 lg:gap-20 px-6 py-6 pb-10 w-full max-w-5xl text-center lg:text-left">

          {/* Left column: club identity + instructions */}
          <div className="flex flex-col items-center lg:items-start gap-5 lg:max-w-xs">

            {/* Join badge */}
            <div
              className="flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold tracking-wide"
              style={{ background: accent + "28", color: accentLight }}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: accent, animation: "pulse 1.5s ease-in-out infinite" }}
              />
              JOIN THE CLUB
            </div>

            {/* Club identity */}
            <div>
              <p className="text-white/40 text-xs font-semibold uppercase tracking-[0.2em] mb-2">
                Now recruiting
              </p>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-4xl">{flag}</span>
                <h1
                  className="text-white font-bold leading-tight text-3xl sm:text-4xl lg:text-5xl"
                  style={{ fontFamily: "'Clash Display', sans-serif" }}
                >
                  {clubName}
                </h1>
              </div>
              {memberCount !== undefined && memberCount > 0 && (
                <div className="flex items-center gap-1.5 mt-2">
                  <Users className="w-3.5 h-3.5" style={{ color: accent }} />
                  <span className="text-white/40 text-sm">
                    {memberCount.toLocaleString()} member{memberCount !== 1 ? "s" : ""}
                  </span>
                </div>
              )}
            </div>

            {/* Instruction text */}
            <p className="text-white/40 text-sm sm:text-base leading-relaxed">
              Scan the QR code to join the club. New members will be prompted to create an account — existing members will be taken straight to the club page.
            </p>

            {/* URL display */}
            <div
              className="flex items-center gap-2 px-4 py-3 rounded-xl w-full"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)" }}
            >
              <QrCode className="w-4 h-4 flex-shrink-0" style={{ color: accent }} />
              <span className="text-white/55 text-xs font-mono truncate flex-1">
                {displayUrl}
              </span>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 w-full">
              <button
                onClick={copyLink}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all active:scale-95"
                style={{
                  background: copied ? accent : accent + "26",
                  color: copied ? "#FFFFFF" : accentLight,
                  border: `1px solid ${accent}40`,
                }}
              >
                {copied ? <Check className="w-4 h-4" strokeWidth={2.5} /> : <Copy className="w-4 h-4" />}
                {copied ? "Copied!" : "Copy Link"}
              </button>
              <a
                href={clubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all active:scale-95"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  color: "rgba(255,255,255,0.55)",
                  border: "1px solid rgba(255,255,255,0.10)",
                }}
                title="Open club page"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Right column: large QR code */}
          <div className="relative flex-shrink-0">
            {/* Accent glow */}
            <div
              className="absolute inset-0 rounded-3xl blur-3xl scale-110 pointer-events-none"
              style={{ background: glowColor }}
            />

            {/* QR container */}
            <div className="relative p-6 sm:p-8 bg-white rounded-3xl shadow-2xl">
              <QRCodeSVG
                value={clubUrl}
                size={280}
                level="H"
                includeMargin={false}
                fgColor="#1E3A5F"
                bgColor="#ffffff"
              />
            </div>

            {/* Corner accent marks */}
            {(["top-0 left-0", "top-0 right-0", "bottom-0 left-0", "bottom-0 right-0"] as const).map((pos) => (
              <div
                key={pos}
                className={`absolute ${pos} w-7 h-7 ${
                  pos.includes("top") && pos.includes("left")    ? "border-t-2 border-l-2 rounded-tl-2xl" :
                  pos.includes("top") && pos.includes("right")   ? "border-t-2 border-r-2 rounded-tr-2xl" :
                  pos.includes("bottom") && pos.includes("left") ? "border-b-2 border-l-2 rounded-bl-2xl" :
                  "border-b-2 border-r-2 rounded-br-2xl"
                }`}
                style={{ borderColor: accent }}
              />
            ))}

            {/* "Scan to join" label */}
            <p className="text-center text-white/30 text-xs font-semibold uppercase tracking-[0.2em] mt-4 select-none">
              Scan to join
            </p>
          </div>
        </div>

        {/* ── Bottom branding strip ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-center gap-2 text-white/15 text-xs select-none py-4">
          <QrCode className="w-3.5 h-3.5" />
          <span>OTB Chess · Club Membership</span>
        </div>

      </div>{/* end scrollable wrapper */}
    </div>
  );
}
