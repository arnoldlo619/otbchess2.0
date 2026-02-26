/**
 * QrScanner — lightweight camera-based QR code scanner
 * Uses jsQR to decode frames from the device camera via getUserMedia.
 * Designed for mobile-first use: requests the rear camera by default.
 */
import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { X, Camera, AlertCircle } from "lucide-react";

interface QrScannerProps {
  onScan: (code: string) => void;
  onClose: () => void;
  isDark: boolean;
}

export function QrScanner({ onScan, onClose, isDark }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const [error, setError] = useState<string>("");
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    let active = true;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (!active) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          setScanning(true);
        }
      } catch {
        setError("Camera access denied. Please allow camera permission and try again.");
      }
    }

    startCamera();

    return () => {
      active = false;
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Scan loop — reads frames from the video element and decodes with jsQR
  useEffect(() => {
    if (!scanning) return;

    function tick() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert",
      });
      if (code?.data) {
        // Extract tournament code from URL like /join/OTB2026 or just a raw code
        const raw = code.data.trim();
        const match = raw.match(/\/join\/([A-Z0-9]{3,12})/i);
        const extracted = match ? match[1].toUpperCase() : raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
        if (extracted) {
          streamRef.current?.getTracks().forEach((t) => t.stop());
          onScan(extracted);
          return;
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [scanning, onScan]);

  const bg = isDark ? "bg-[oklch(0.18_0.05_145)]" : "bg-white";
  const textMain = isDark ? "text-white" : "text-gray-900";
  const textMuted = isDark ? "text-white/55" : "text-gray-500";

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "rgba(0,0,0,0.92)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-safe-top pt-5 pb-4">
        <div className="flex items-center gap-2.5">
          <Camera className="w-5 h-5 text-white" />
          <span className="text-white font-semibold text-base">Scan QR Code</span>
        </div>
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center active:scale-95 transition-transform"
          aria-label="Close scanner"
        >
          <X className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Viewfinder */}
      <div className="flex-1 flex items-center justify-center px-6">
        {error ? (
          <div className={`rounded-2xl p-6 text-center max-w-xs ${bg}`}>
            <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
            <p className={`text-sm font-medium mb-1 ${textMain}`}>Camera unavailable</p>
            <p className={`text-xs leading-relaxed ${textMuted}`}>{error}</p>
            <button
              onClick={onClose}
              className="mt-4 w-full py-2.5 rounded-xl bg-[#3D6B47] text-white text-sm font-semibold"
            >
              Enter code manually
            </button>
          </div>
        ) : (
          <div className="relative w-full max-w-sm aspect-square">
            {/* Video feed */}
            <video
              ref={videoRef}
              className="w-full h-full object-cover rounded-2xl"
              playsInline
              muted
              autoPlay
            />
            {/* Hidden canvas for frame analysis */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Corner brackets overlay */}
            <div className="absolute inset-0 pointer-events-none">
              {/* Top-left */}
              <div className="absolute top-3 left-3 w-8 h-8 border-t-3 border-l-3 border-[#4CAF50] rounded-tl-lg" style={{ borderWidth: "3px 0 0 3px" }} />
              {/* Top-right */}
              <div className="absolute top-3 right-3 w-8 h-8 border-t-3 border-r-3 border-[#4CAF50] rounded-tr-lg" style={{ borderWidth: "3px 3px 0 0" }} />
              {/* Bottom-left */}
              <div className="absolute bottom-3 left-3 w-8 h-8 border-b-3 border-l-3 border-[#4CAF50] rounded-bl-lg" style={{ borderWidth: "0 0 3px 3px" }} />
              {/* Bottom-right */}
              <div className="absolute bottom-3 right-3 w-8 h-8 border-b-3 border-r-3 border-[#4CAF50] rounded-br-lg" style={{ borderWidth: "0 3px 3px 0" }} />
              {/* Scanning line animation */}
              <div
                className="absolute left-4 right-4 h-0.5 bg-[#4CAF50]/70 rounded-full"
                style={{ animation: "scanLine 2s ease-in-out infinite", top: "50%" }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Footer hint */}
      {!error && (
        <div className="px-6 pb-safe-bottom pb-8 text-center">
          <p className="text-white/60 text-sm">
            Point your camera at the host's QR code
          </p>
          <button
            onClick={onClose}
            className="mt-3 text-white/40 text-xs underline underline-offset-2"
          >
            Enter code manually instead
          </button>
        </div>
      )}

      <style>{`
        @keyframes scanLine {
          0%, 100% { transform: translateY(-40px); opacity: 0.4; }
          50% { transform: translateY(40px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
