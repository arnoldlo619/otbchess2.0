/**
 * SpectatorQRScreen
 * ─────────────────
 * Full-screen projection overlay for the director dashboard.
 * Designed to be displayed on a projector or large monitor so that
 * coaches, parents, and spectators can scan the QR code to open the
 * live tournament spectator view on their phones.
 *
 * Design language mirrors AnnounceModal (dark green bg, white text,
 * Escape-to-close) but uses a blue accent to distinguish the spectator
 * flow from the player-join flow.
 */

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { X, Maximize2, Copy, Check, Tv2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface SpectatorQRScreenProps {
  open: boolean;
  onClose: () => void;
  tournamentName: string;
  spectatorUrl: string;
}

export function SpectatorQRScreen({
  open,
  onClose,
  tournamentName,
  spectatorUrl,
}: SpectatorQRScreenProps) {
  const [copied, setCopied] = useState(false);

  // ── Keyboard / scroll lock ──────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const displayUrl = (() => {
    try {
      const u = new URL(spectatorUrl);
      return u.origin + u.pathname;
    } catch {
      return spectatorUrl.split("?")[0];
    }
  })();

  function copyLink() {
    navigator.clipboard.writeText(spectatorUrl);
    setCopied(true);
    toast.success("Spectator link copied!");
    setTimeout(() => setCopied(false), 2500);
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-[110] flex flex-col items-center justify-center"
      style={{ background: "oklch(0.13 0.06 240)" }}
      role="dialog"
      aria-modal="true"
      aria-label="Spectator QR projection screen"
    >
      {/* ── Close button ─────────────────────────────────────────────────────── */}
      <button
        onClick={onClose}
        aria-label="Close spectator QR screen"
        className="absolute top-4 right-4 sm:top-6 sm:right-6 w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-95 z-10"
        style={{ background: "rgba(255,255,255,0.08)" }}
        onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.16)")}
        onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
      >
        <X className="w-5 h-5 text-white/60" />
      </button>

      {/* ── Escape hint ──────────────────────────────────────────────────────── */}
      <div className="absolute top-4 left-4 sm:top-6 sm:left-6 flex items-center gap-1.5 text-white/25 text-xs select-none">
        <Maximize2 className="w-3.5 h-3.5" />
        <span className="hidden sm:block">Press Escape to close</span>
      </div>

      {/* ── Main content ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row items-center justify-center gap-10 lg:gap-20 px-6 py-10 w-full max-w-5xl text-center lg:text-left">

        {/* Left column: title + live badge + instructions */}
        <div className="flex flex-col items-center lg:items-start gap-5 lg:max-w-xs">
          {/* Live badge */}
          <div
            className="flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold tracking-wide"
            style={{ background: "rgba(59,130,246,0.18)", color: "#93C5FD" }}
          >
            <span
              className="w-2 h-2 rounded-full bg-blue-400"
              style={{ animation: "pulse 1.5s ease-in-out infinite" }}
            />
            LIVE SPECTATOR VIEW
          </div>

          {/* Tournament name */}
          <div>
            <p className="text-white/40 text-xs font-semibold uppercase tracking-[0.2em] mb-2">
              Now watching
            </p>
            <h1
              className="text-white font-bold leading-tight text-3xl sm:text-4xl lg:text-5xl"
              style={{ fontFamily: "'Clash Display', sans-serif" }}
            >
              {tournamentName}
            </h1>
          </div>

          {/* Instruction text */}
          <p className="text-white/40 text-sm sm:text-base leading-relaxed">
            Scan the QR code to follow live standings, pairings, and results on your phone — no account needed.
          </p>

          {/* URL display */}
          <div
            className="flex items-center gap-2 px-4 py-3 rounded-xl w-full"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)" }}
          >
            <Tv2 className="w-4 h-4 flex-shrink-0" style={{ color: "#60A5FA" }} />
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
                background: copied ? "#2563EB" : "rgba(59,130,246,0.15)",
                color: copied ? "#FFFFFF" : "#93C5FD",
                border: "1px solid rgba(59,130,246,0.25)",
              }}
            >
              {copied ? <Check className="w-4 h-4" strokeWidth={2.5} /> : <Copy className="w-4 h-4" />}
              {copied ? "Copied!" : "Copy Link"}
            </button>
            <a
              href={spectatorUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all active:scale-95"
              style={{
                background: "rgba(255,255,255,0.06)",
                color: "rgba(255,255,255,0.55)",
                border: "1px solid rgba(255,255,255,0.10)",
              }}
              title="Open spectator view"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>

        {/* Right column: large QR code */}
        <div className="relative flex-shrink-0">
          {/* Blue glow */}
          <div
            className="absolute inset-0 rounded-3xl blur-3xl scale-110 pointer-events-none"
            style={{ background: "rgba(59,130,246,0.20)" }}
          />

          {/* QR container */}
          <div className="relative p-6 sm:p-8 bg-white rounded-3xl shadow-2xl">
            <QRCodeSVG
              value={spectatorUrl}
              size={280}
              level="H"
              includeMargin={false}
              fgColor="#1E3A5F"
              bgColor="#ffffff"
            />
          </div>

          {/* Blue corner accent marks (mirrors AnnounceModal green accents) */}
          {(["top-0 left-0", "top-0 right-0", "bottom-0 left-0", "bottom-0 right-0"] as const).map((pos) => (
            <div
              key={pos}
              className={`absolute ${pos} w-7 h-7 ${
                pos.includes("top") && pos.includes("left")    ? "border-t-2 border-l-2 rounded-tl-2xl" :
                pos.includes("top") && pos.includes("right")   ? "border-t-2 border-r-2 rounded-tr-2xl" :
                pos.includes("bottom") && pos.includes("left") ? "border-b-2 border-l-2 rounded-bl-2xl" :
                "border-b-2 border-r-2 rounded-br-2xl"
              }`}
              style={{ borderColor: "#3B82F6" }}
            />
          ))}

          {/* "Scan to watch live" label below QR */}
          <p className="text-center text-white/30 text-xs font-semibold uppercase tracking-[0.2em] mt-4 select-none">
            Scan to watch live
          </p>
        </div>
      </div>

      {/* ── Bottom branding strip ─────────────────────────────────────────────── */}
      <div className="absolute bottom-5 flex items-center gap-2 text-white/15 text-xs select-none">
        <Tv2 className="w-3.5 h-3.5" />
        <span>OTB Chess · Live Spectator View</span>
      </div>
    </div>
  );
}
