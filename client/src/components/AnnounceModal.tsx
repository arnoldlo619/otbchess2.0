/*
 * OTB Chess — Full-Screen Announce Modal
 * Purpose: Display the tournament invite code and QR code in a large, high-visibility
 *          format for projection or holding up to a room. Designed to be readable from
 *          across a chess hall without players needing to approach the director's device.
 */

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { X, Copy, Check, Maximize2 } from "lucide-react";
import { toast } from "sonner";

interface AnnounceModalProps {
  open: boolean;
  onClose: () => void;
  tournamentName: string;
  joinUrl: string;
  code: string;
}

export function AnnounceModal({
  open,
  onClose,
  tournamentName,
  joinUrl,
  code,
}: AnnounceModalProps) {
  const [codeCopied, setCodeCopied] = useState(false);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

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

  function copyCode() {
    navigator.clipboard.writeText(code);
    setCodeCopied(true);
    toast.success("Invite code copied!");
    setTimeout(() => setCodeCopied(false), 2000);
  }

  // Strip the ?t= param from the displayed URL to keep it short and readable
  const displayUrl = (() => {
    try {
      const u = new URL(joinUrl);
      return u.origin + u.pathname;
    } catch {
      return joinUrl.split("?")[0];
    }
  })();

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[oklch(0.14_0.07_145)]">
      {/* Close button — top-right */}
      <button
        onClick={onClose}
        aria-label="Close announce screen"
        className="absolute top-4 right-4 sm:top-6 sm:right-6 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/60 hover:text-white transition-all active:scale-95 z-10"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Fullscreen hint */}
      <div className="absolute top-4 left-4 sm:top-6 sm:left-6 flex items-center gap-1.5 text-white/25 text-xs">
        <Maximize2 className="w-3.5 h-3.5" />
        <span className="hidden sm:block">Press Escape to close</span>
      </div>

      {/* Content */}
      <div className="flex flex-col items-center gap-6 sm:gap-8 px-6 py-8 w-full max-w-2xl text-center">

        {/* Tournament name */}
        <div>
          <p className="text-white/40 text-sm font-semibold uppercase tracking-[0.2em] mb-1">
            Join the tournament
          </p>
          <h1
            className="text-white text-2xl sm:text-4xl font-bold leading-tight"
            style={{ fontFamily: "'Clash Display', sans-serif" }}
          >
            {tournamentName}
          </h1>
        </div>

        {/* QR code */}
        <div className="relative">
          {/* Glow effect */}
          <div className="absolute inset-0 rounded-3xl bg-[#4CAF50]/20 blur-2xl scale-110 pointer-events-none" />
          <div className="relative p-5 sm:p-7 bg-white rounded-3xl shadow-2xl">
            <QRCodeSVG
              value={joinUrl}
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
                pos.includes("top") && pos.includes("left")   ? "border-t-2 border-l-2 rounded-tl-2xl" :
                pos.includes("top") && pos.includes("right")  ? "border-t-2 border-r-2 rounded-tr-2xl" :
                pos.includes("bottom") && pos.includes("left") ? "border-b-2 border-l-2 rounded-bl-2xl" :
                "border-b-2 border-r-2 rounded-br-2xl"
              }`}
            />
          ))}
        </div>

        {/* Giant invite code */}
        <div className="flex flex-col items-center gap-2">
          <p className="text-white/35 text-xs font-semibold uppercase tracking-[0.25em]">
            Or enter this code
          </p>
          <button
            onClick={copyCode}
            title="Click to copy"
            className="group flex items-center gap-3 px-8 py-4 rounded-2xl bg-white/08 hover:bg-white/12 border border-white/12 hover:border-white/20 transition-all active:scale-95"
          >
            <span
              className="text-white font-mono font-bold tracking-[0.3em] text-4xl sm:text-5xl select-all"
              style={{ fontFamily: "'Clash Display', monospace" }}
            >
              {code}
            </span>
            <span className="text-white/30 group-hover:text-white/60 transition-colors flex-shrink-0">
              {codeCopied ? <Check className="w-5 h-5 text-[#4CAF50]" /> : <Copy className="w-5 h-5" />}
            </span>
          </button>
        </div>

        {/* Short URL hint */}
        <p className="text-white/25 text-xs font-mono tracking-wide">
          {displayUrl}
        </p>

      </div>
    </div>
  );
}
