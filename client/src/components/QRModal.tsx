/*
 * OTB Chess — QR Code Modal
 * Design: Clean centered modal with large QR code, tournament info, and copy/share actions
 * Used by: Director dashboard, Tournament wizard share step
 */

import { QRCodeSVG } from "qrcode.react";
import { useTheme } from "@/contexts/ThemeContext";
import { Crown, X, Copy, Check, Smartphone, Download } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface QRModalProps {
  open: boolean;
  onClose: () => void;
  tournamentName: string;
  joinUrl: string;
  code: string;
}

export function QRModal({ open, onClose, tournamentName, joinUrl, code }: QRModalProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  async function handleCopy() {
    await navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    toast.success("Join link copied!");
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownload() {
    // Get the SVG element and convert to downloadable PNG
    const svg = document.getElementById("otb-qr-code");
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
      a.download = `otb-chess-${code.toLowerCase()}-qr.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(svgData);
    toast.success("QR code downloaded!");
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className={`absolute inset-0 ${isDark ? "bg-black/70" : "bg-black/40"} backdrop-blur-sm`} />

      {/* Modal */}
      <div
        className={`relative w-full max-w-sm rounded-3xl border shadow-2xl overflow-hidden ${
          isDark ? "bg-[oklch(0.22_0.06_145)] border-white/10" : "bg-white border-gray-100"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Green accent bar */}
        <div className="h-1 bg-gradient-to-r from-[#3D6B47] via-[#4CAF50] to-[#3D6B47]" />

        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b ${isDark ? "border-white/08" : "border-gray-100"}`}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-[#3D6B47] rounded-xl flex items-center justify-center">
              <Crown className="w-4 h-4 text-white" strokeWidth={2} />
            </div>
            <div>
              <p
                className={`font-bold text-sm leading-tight ${isDark ? "text-white" : "text-gray-900"}`}
                style={{ fontFamily: "'Clash Display', sans-serif" }}
              >
                Player Join QR Code
              </p>
              <p className={`text-xs ${isDark ? "text-white/40" : "text-gray-400"}`}>
                {tournamentName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
              isDark ? "hover:bg-white/10 text-white/50" : "hover:bg-gray-100 text-gray-400"
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
                id="otb-qr-code"
                value={joinUrl}
                size={200}
                level="H"
                includeMargin={false}
                fgColor="#1a1a1a"
                bgColor="#ffffff"
                imageSettings={{
                  src: "",
                  height: 0,
                  width: 0,
                  excavate: false,
                }}
              />
            </div>
            {/* Corner decorations */}
            {["top-0 left-0", "top-0 right-0", "bottom-0 left-0", "bottom-0 right-0"].map((pos) => (
              <div
                key={pos}
                className={`absolute ${pos} w-5 h-5 border-[#3D6B47] ${
                  pos.includes("top") && pos.includes("left") ? "border-t-2 border-l-2 rounded-tl-xl" :
                  pos.includes("top") && pos.includes("right") ? "border-t-2 border-r-2 rounded-tr-xl" :
                  pos.includes("bottom") && pos.includes("left") ? "border-b-2 border-l-2 rounded-bl-xl" :
                  "border-b-2 border-r-2 rounded-br-xl"
                }`}
              />
            ))}
          </div>

          {/* Code badge */}
          <div className={`flex flex-col items-center gap-1`}>
            <p className={`text-xs font-semibold uppercase tracking-widest ${isDark ? "text-white/30" : "text-gray-400"}`}>
              Tournament Code
            </p>
            <div className={`px-5 py-2 rounded-xl ${isDark ? "bg-white/08" : "bg-gray-50"}`}>
              <span
                className={`text-2xl font-bold tracking-[0.2em] font-mono ${isDark ? "text-white" : "text-gray-900"}`}
                style={{ fontFamily: "'Clash Display', sans-serif" }}
              >
                {code}
              </span>
            </div>
          </div>

          {/* Instructions */}
          <div className={`w-full rounded-xl px-4 py-3 flex items-start gap-3 ${isDark ? "bg-[#3D6B47]/15" : "bg-[#3D6B47]/06"}`}>
            <Smartphone className={`w-4 h-4 mt-0.5 flex-shrink-0 ${isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"}`} />
            <p className={`text-xs leading-relaxed ${isDark ? "text-white/60" : "text-gray-600"}`}>
              Players scan this code with their phone camera to open the join page. They enter their chess.com username and their ELO is pulled automatically.
            </p>
          </div>

          {/* Actions */}
          <div className="w-full grid grid-cols-2 gap-2">
            <button
              onClick={handleCopy}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                copied
                  ? isDark ? "border-[#4CAF50]/40 text-[#4CAF50] bg-[#3D6B47]/15" : "border-[#3D6B47]/40 text-[#3D6B47] bg-[#3D6B47]/08"
                  : isDark ? "border-white/10 text-white/70 hover:bg-white/05" : "border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copied!" : "Copy Link"}
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium bg-[#3D6B47] text-white hover:bg-[#2A4A32] transition-all hover:-translate-y-0.5 hover:shadow-md hover:shadow-[#3D6B47]/30"
            >
              <Download className="w-3.5 h-3.5" />
              Save QR
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
