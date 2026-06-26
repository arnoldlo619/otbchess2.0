/**
 * ClubShareModal — full social share modal for clubs.
 * Channels: Copy Link, QR Code (download), X/Twitter, Facebook, WhatsApp, Email.
 */
import React, { useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  X,
  Copy,
  Check,
  Download,
  Share2,
  Mail,
  MessageCircle,
} from "lucide-react";
import { toast } from "sonner";

interface ClubShareModalProps {
  clubName: string;
  clubSlug: string;
  clubId: string;
  tagline?: string;
  accentColor?: string;
  isDark?: boolean;
  onClose: () => void;
}

function buildShareUrl(slug: string, id: string) {
  return `https://chessotb.club/clubs/${slug || id}`;
}

export function ClubShareModal({
  clubName,
  clubSlug,
  clubId,
  tagline,
  accentColor = "#436850",
  isDark = false,
  onClose,
}: ClubShareModalProps) {
  const shareUrl = buildShareUrl(clubSlug, clubId);
  const shareText = tagline
    ? `${clubName} — ${tagline}`
    : `Join ${clubName} on ChessOTB.club`;

  const [copied, setCopied] = useState(false);
  const qrRef = useRef<SVGSVGElement>(null);

  // ── Helpers ──────────────────────────────────────────────────────────────────
  function handleCopy() {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      toast.success("Link copied!");
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleDownloadQR() {
    const svg = document.getElementById("club-share-qr");
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const size = 400;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = new Image();
    img.onload = () => {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);
      const a = document.createElement("a");
      a.download = `${clubName.replace(/\s+/g, "-").toLowerCase()}-qr.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
    };
    img.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgData)))}`;
  }

  // ── Social share URLs ─────────────────────────────────────────────────────
  const encoded = encodeURIComponent(shareUrl);
  const encodedText = encodeURIComponent(shareText);

  const channels = [
    {
      id: "x",
      label: "X / Twitter",
      bg: "#000000",
      icon: (
        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden>
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.259 5.63 5.905-5.63Zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      ),
      href: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encoded}`,
    },
    {
      id: "facebook",
      label: "Facebook",
      bg: "#1877F2",
      icon: (
        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden>
          <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.267h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
        </svg>
      ),
      href: `https://www.facebook.com/sharer/sharer.php?u=${encoded}`,
    },
    {
      id: "whatsapp",
      label: "WhatsApp",
      bg: "#25D366",
      icon: <MessageCircle className="w-4 h-4" />,
      href: `https://wa.me/?text=${encodedText}%20${encoded}`,
    },
    {
      id: "email",
      label: "Email",
      bg: "#6B7280",
      icon: <Mail className="w-4 h-4" />,
      href: `mailto:?subject=${encodeURIComponent(`Join ${clubName} on ChessOTB.club`)}&body=${encodedText}%0A%0A${encoded}`,
    },
  ];

  // ── Styles ────────────────────────────────────────────────────────────────
  const overlay = "fixed inset-0 z-[9999] flex items-center justify-center p-4";
  const backdrop = "absolute inset-0 bg-black/60 backdrop-blur-sm";
  const panel = `relative w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden ${
    isDark ? "bg-[#1a2e1f] border border-white/10" : "bg-white border border-[#ADBC9F]"
  }`;
  const titleCls = `text-base font-bold ${isDark ? "text-white" : "text-[#12372A]"}`;
  const subtitleCls = `text-xs mt-0.5 ${isDark ? "text-white/50" : "text-[#436850]"}`;
  const dividerCls = `border-t ${isDark ? "border-white/8" : "border-[#ADBC9F]/40"}`;

  return (
    <div className={overlay} role="dialog" aria-modal aria-label={`Share ${clubName}`}>
      {/* Backdrop */}
      <div className={backdrop} onClick={onClose} />

      {/* Panel */}
      <div className={panel}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: `${accentColor}22` }}
            >
              <Share2 className="w-4 h-4" style={{ color: accentColor }} />
            </div>
            <div>
              <p className={titleCls}>Share Club</p>
              <p className={subtitleCls}>{clubName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition hover:scale-110 ${
              isDark ? "bg-white/8 text-white/60 hover:text-white" : "bg-black/5 text-[#436850] hover:text-[#12372A]"
            }`}
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className={dividerCls} />

        {/* QR Code */}
        <div className="flex flex-col items-center py-5 px-5 gap-3">
          <div className="rounded-2xl p-3 bg-white shadow-md">
            <QRCodeSVG
              id="club-share-qr"
              value={shareUrl}
              size={148}
              level="H"
              includeMargin={false}
              fgColor="#12372A"
              bgColor="#ffffff"
            />
          </div>
          <button
            onClick={handleDownloadQR}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition hover:opacity-80 ${
              isDark ? "bg-white/8 text-white/70" : "bg-[#FBFADA] text-[#436850] border border-[#ADBC9F]"
            }`}
          >
            <Download className="w-3 h-3" />
            Download QR
          </button>
        </div>

        <div className={dividerCls} />

        {/* Copy Link */}
        <div className="px-5 py-4">
          <p className={`text-[10px] font-semibold uppercase tracking-widest mb-2 ${isDark ? "text-white/40" : "text-[#436850]"}`}>
            Club Link
          </p>
          <div className={`flex items-center gap-2 rounded-xl px-3 py-2.5 ${isDark ? "bg-white/8 border border-white/10" : "bg-[#FBFADA] border border-[#ADBC9F]"}`}>
            <span className={`flex-1 text-xs font-mono truncate ${isDark ? "text-white/70" : "text-[#12372A]"}`}>
              {shareUrl}
            </span>
            <button
              onClick={handleCopy}
              className="flex-shrink-0 flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg transition"
              style={{ background: accentColor, color: "#fff" }}
              aria-label="Copy link"
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>

        <div className={dividerCls} />

        {/* Social channels */}
        <div className="px-5 py-4">
          <p className={`text-[10px] font-semibold uppercase tracking-widest mb-3 ${isDark ? "text-white/40" : "text-[#436850]"}`}>
            Share Via
          </p>
          <div className="grid grid-cols-4 gap-2">
            {channels.map((ch) => (
              <a
                key={ch.id}
                href={ch.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-1.5 py-2.5 rounded-xl transition hover:scale-105 hover:opacity-90"
                style={{ background: ch.bg, color: "#fff" }}
                aria-label={`Share on ${ch.label}`}
              >
                {ch.icon}
                <span className="text-[9px] font-semibold leading-none">{ch.label}</span>
              </a>
            ))}
          </div>
        </div>

        {/* Native share (mobile) */}
        {typeof navigator !== "undefined" && navigator.share && (
          <div className="px-5 pb-5">
            <button
              onClick={() =>
                navigator.share({ title: clubName, text: shareText, url: shareUrl })
              }
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition hover:opacity-90"
              style={{ background: accentColor, color: "#fff" }}
            >
              <Share2 className="w-4 h-4" />
              Share via Device
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
