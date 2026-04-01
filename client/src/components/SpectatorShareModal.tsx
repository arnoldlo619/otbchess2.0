/*
 * OTB Chess — Spectator Share Modal
 * Design: Clean modal with large QR code encoding the live spectator URL,
 *         a copyable link, and an "Open" button. Distinct from QRModal (player join).
 * Used by: Director dashboard header "Watch Live" button
 */

import { QRCodeSVG } from "qrcode.react";
import { useTheme } from "@/contexts/ThemeContext";
import { X, Copy, Check, ExternalLink, Download, Tv2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface SpectatorShareModalProps {
  open: boolean;
  onClose: () => void;
  tournamentName: string;
  spectatorUrl: string;
}

export function SpectatorShareModal({
  open,
  onClose,
  tournamentName,
  spectatorUrl,
}: SpectatorShareModalProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  async function handleCopy() {
    await navigator.clipboard.writeText(spectatorUrl);
    setCopied(true);
    toast.success("Spectator link copied!");
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownload() {
    const svg = document.getElementById("otb-spectator-qr");
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    canvas.width = 400;
    canvas.height = 400;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = new Image();
    img.onload = () => {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, 400, 400);
      ctx.drawImage(img, 0, 0, 400, 400);
      const a = document.createElement("a");
      a.download = `otb-chess-spectator-qr.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
    toast.success("QR code downloaded!");
  }

  return (
    <div
      className="modal-overlay z-50"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div
        className={`fixed inset-0 ${isDark ? "bg-black/70" : "bg-black/40"} backdrop-blur-sm`}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className={`relative z-10 w-full max-w-sm my-auto rounded-3xl border shadow-2xl overflow-hidden ${
          isDark
            ? "bg-[oklch(0.22_0.06_145)] border-white/10"
            : "bg-white border-gray-100"
        }`}
        style={{ marginTop: "max(1rem, 10vh)", marginBottom: "max(1rem, 10vh)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Teal/blue accent bar — visually distinct from the green join QR */}
        <div className="h-1 bg-gradient-to-r from-[#1a6b8a] via-[#2196F3] to-[#1a6b8a]" />

        {/* Header */}
        <div
          className={`flex items-center justify-between px-5 py-4 border-b ${
            isDark ? "border-white/08" : "border-gray-100"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-[#1a6b8a] rounded-xl flex items-center justify-center">
              <Tv2 className="w-4 h-4 text-white" strokeWidth={2} />
            </div>
            <div>
              <p
                className={`font-bold text-sm leading-tight ${
                  isDark ? "text-white" : "text-gray-900"
                }`}
                style={{ fontFamily: "'Clash Display', sans-serif" }}
              >
                Watch Live
              </p>
              <p
                className={`text-xs ${isDark ? "text-white/40" : "text-gray-400"}`}
              >
                {tournamentName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
              isDark
                ? "hover:bg-white/10 text-white/50"
                : "hover:bg-gray-100 text-gray-400"
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* QR Code */}
        <div className="px-5 py-6 flex flex-col items-center gap-5">
          {/* QR wrapper */}
          <div className="relative">
            <div className="p-4 bg-white rounded-2xl shadow-lg">
              <QRCodeSVG
                id="otb-spectator-qr"
                value={spectatorUrl}
                size={200}
                level="H"
                includeMargin={false}
                fgColor="#1a1a1a"
                bgColor="#ffffff"
              />
            </div>
            {/* Corner decorations — blue tint to match spectator theme */}
            {(["top-0 left-0", "top-0 right-0", "bottom-0 left-0", "bottom-0 right-0"] as const).map((pos) => (
              <div
                key={pos}
                className={`absolute ${pos} w-5 h-5 border-[#1a6b8a] ${
                  pos.includes("top") && pos.includes("left")
                    ? "border-t-2 border-l-2 rounded-tl-xl"
                    : pos.includes("top") && pos.includes("right")
                    ? "border-t-2 border-r-2 rounded-tr-xl"
                    : pos.includes("bottom") && pos.includes("left")
                    ? "border-b-2 border-l-2 rounded-bl-xl"
                    : "border-b-2 border-r-2 rounded-br-xl"
                }`}
              />
            ))}
          </div>

          {/* Live badge */}
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#2196F3] animate-pulse" />
            <p
              className={`text-xs font-semibold uppercase tracking-widest ${
                isDark ? "text-[#2196F3]" : "text-[#1a6b8a]"
              }`}
            >
              Live Spectator View
            </p>
          </div>

          {/* Instructions */}
          <div
            className={`w-full rounded-xl px-4 py-3 flex items-start gap-3 ${
              isDark ? "bg-[#1a6b8a]/15" : "bg-[#1a6b8a]/06"
            }`}
          >
            <Tv2
              className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                isDark ? "text-[#2196F3]" : "text-[#1a6b8a]"
              }`}
            />
            <p
              className={`text-xs leading-relaxed ${
                isDark ? "text-white/60" : "text-gray-600"
              }`}
            >
              Share this QR code with coaches, parents, and spectators. The page
              updates live as results are entered — no account or login required.
            </p>
          </div>

          {/* URL display */}
          <div
            className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-mono ${
              isDark
                ? "bg-white/05 border-white/10 text-white/50"
                : "bg-gray-50 border-gray-200 text-gray-500"
            }`}
          >
            <span className="flex-1 truncate">{spectatorUrl}</span>
          </div>

          {/* Actions */}
          <div className="w-full grid grid-cols-3 gap-2">
            <button
              onClick={handleCopy}
              className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                copied
                  ? isDark
                    ? "border-[#2196F3]/40 text-[#2196F3] bg-[#1a6b8a]/15"
                    : "border-[#1a6b8a]/40 text-[#1a6b8a] bg-[#1a6b8a]/08"
                  : isDark
                  ? "border-white/10 text-white/70 hover:bg-white/05"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {copied ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              {copied ? "Copied!" : "Copy"}
            </button>
            <button
              onClick={handleDownload}
              className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                isDark
                  ? "border-white/10 text-white/70 hover:bg-white/05"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              Save
            </button>
            <a
              href={spectatorUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium bg-[#1a6b8a] text-white hover:bg-[#155a75] transition-all hover:-translate-y-0.5 hover:shadow-md hover:shadow-[#1a6b8a]/30"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
