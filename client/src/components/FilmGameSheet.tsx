/**
 * FilmGameSheet — Bottom-sheet overlay for filming / streaming a board game.
 *
 * Features:
 * - Camera permission request with clear explanation
 * - Live camera preview (rear camera by default, front camera toggle)
 * - Board-framing guide overlay (rule-of-thirds crosshair)
 * - Clock overlay toggle: composites player names + live chess clock onto the stream via canvas
 * - Watermark customization: custom text OR uploaded logo image, with position picker
 * - Record button with elapsed timer (records the composited canvas stream when overlay is on)
 * - Stop & share flow (Web Share API → clipboard fallback)
 * - Graceful fallback when camera permission is denied
 */
import { useEffect, useRef, useState, useCallback } from "react";
import {
  X,
  Camera,
  CameraOff,
  FlipHorizontal,
  Circle,
  Square,
  Share2,
  Download,
  AlertTriangle,
  Loader2,
  Layers,
  ImagePlus,
  Type,
  Trash2,
} from "lucide-react";

type WatermarkPosition = "top-right" | "top-left" | "bottom-right" | "bottom-left";

/** Resize an uploaded image to a max-width data URL for use in canvas */
function resizeLogoImage(file: File, maxW = 320): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("Canvas not supported")); return; }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

interface TimerSnapProp {
  status: "idle" | "running" | "paused" | "expired";
  durationSec: number;
  startWallMs: number;
  elapsedAtPauseMs: number;
  savedAt?: number;
}

interface FilmGameSheetProps {
  onClose: () => void;
  isDark: boolean;
  accent: string;
  textMain: string;
  textMuted: string;
  /** Player names to display in the overlay */
  playerWhite?: string;
  playerBlack?: string;
  /** Tournament round timer snapshot (shared clock) */
  timerSnap?: TimerSnapProp | null;
}

type CameraState = "idle" | "requesting" | "denied" | "active";
type RecordState = "idle" | "recording" | "stopped";

function formatTime(seconds: number): string {
  if (seconds < 0) seconds = 0;
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

/** Draw the HUD overlay onto the canvas each animation frame */
function drawOverlay(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  opts: {
    playerWhite: string;
    playerBlack: string;
    whiteTimeSec: number;
    blackTimeSec: number;
    activeColor: "white" | "black" | null;
    recordState: RecordState;
    elapsed: number;
    watermarkText: string;
    watermarkLogoImg: HTMLImageElement | null;
    watermarkPosition: WatermarkPosition;
  }
) {
  const { width: w, height: h } = ctx.canvas;

  // Draw camera frame
  ctx.drawImage(video, 0, 0, w, h);

  const { playerWhite, playerBlack, whiteTimeSec, blackTimeSec, activeColor, recordState, elapsed } = opts;

  // ── Bottom HUD bar ──────────────────────────────────────────────────────────
  const barH = Math.round(h * 0.12);
  const barY = h - barH;

  // Semi-transparent bar background
  ctx.fillStyle = "rgba(0,0,0,0.65)";
  ctx.fillRect(0, barY, w, barH);

  // Thin green accent line at top of bar
  ctx.fillStyle = "#4CAF50";
  ctx.fillRect(0, barY, w, 2);

  const pad = Math.round(w * 0.025);
  const fontSize = Math.round(barH * 0.38);
  const smallFont = Math.round(barH * 0.26);
  const centerX = w / 2;

  // ── White player (left) ─────────────────────────────────────────────────────
  const whiteActive = activeColor === "white";
  ctx.fillStyle = whiteActive ? "#ffffff" : "rgba(255,255,255,0.55)";
  ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(playerWhite || "White", pad, barY + barH * 0.38);

  // White clock
  const whiteTimeStr = formatTime(whiteTimeSec);
  ctx.font = `bold ${Math.round(fontSize * 1.15)}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
  ctx.fillStyle = whiteActive ? "#4CAF50" : "rgba(255,255,255,0.55)";
  ctx.fillText(whiteTimeStr, pad, barY + barH * 0.72);

  // White piece icon (♔)
  ctx.font = `${Math.round(fontSize * 0.9)}px serif`;
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fillText("♔", pad + ctx.measureText(whiteTimeStr).width + 6, barY + barH * 0.72);

  // ── Black player (right) ────────────────────────────────────────────────────
  const blackActive = activeColor === "black";
  ctx.fillStyle = blackActive ? "#ffffff" : "rgba(255,255,255,0.55)";
  ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
  ctx.textAlign = "right";
  ctx.fillText(playerBlack || "Black", w - pad, barY + barH * 0.38);

  const blackTimeStr = formatTime(blackTimeSec);
  ctx.font = `bold ${Math.round(fontSize * 1.15)}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
  ctx.fillStyle = blackActive ? "#4CAF50" : "rgba(255,255,255,0.55)";
  ctx.fillText(blackTimeStr, w - pad, barY + barH * 0.72);

  ctx.font = `${Math.round(fontSize * 0.9)}px serif`;
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.textAlign = "right";
  ctx.fillText("♚", w - pad - ctx.measureText(blackTimeStr).width - 6, barY + barH * 0.72);

  // ── VS divider (center) ─────────────────────────────────────────────────────
  ctx.font = `bold ${smallFont}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.textAlign = "center";
  ctx.fillText("VS", centerX, barY + barH * 0.55);

  // ── Recording indicator (top-left) ─────────────────────────────────────────
  if (recordState === "recording") {
    const dotR = Math.round(h * 0.012);
    const dotX = pad + dotR;
    const dotY = Math.round(h * 0.045);
    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.arc(dotX, dotY, dotR, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = `bold ${Math.round(smallFont * 0.95)}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "left";
    ctx.fillText(formatElapsed(elapsed), dotX + dotR + 6, dotY);
  }

  // ── Watermark (position-aware) ─────────────────────────────────────────────
  const { watermarkText, watermarkLogoImg, watermarkPosition } = opts;
  const wmPad = Math.round(w * 0.025);
  const wmY = Math.round(h * 0.045);
  const wmBottomY = barY - Math.round(h * 0.02);
  const isTop = watermarkPosition.startsWith("top");
  const isRight = watermarkPosition.endsWith("right");
  const wmAnchorY = isTop ? wmY : wmBottomY;

  if (watermarkLogoImg) {
    // Draw logo image — scale to ~8% of canvas height
    const logoH = Math.round(h * 0.08);
    const logoW = Math.round(watermarkLogoImg.width * (logoH / watermarkLogoImg.height));
    const logoX = isRight ? w - wmPad - logoW : wmPad;
    const logoY = isTop ? wmAnchorY - logoH / 2 : wmAnchorY - logoH / 2;
    ctx.globalAlpha = 0.85;
    ctx.drawImage(watermarkLogoImg, logoX, logoY, logoW, logoH);
    ctx.globalAlpha = 1;
  } else if (watermarkText) {
    ctx.font = `bold ${smallFont}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
    ctx.fillStyle = "rgba(76,175,80,0.75)";
    ctx.textAlign = isRight ? "right" : "left";
    ctx.textBaseline = "middle";
    ctx.fillText(watermarkText, isRight ? w - wmPad : wmPad, wmAnchorY);
  }
}

function useTimerRemaining(snap: TimerSnapProp | null | undefined): number {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    if (!snap || snap.status === "idle") { setRemaining(0); return; }
    if (snap.status === "paused") { setRemaining(Math.max(0, snap.durationSec - Math.round(snap.elapsedAtPauseMs / 1000))); return; }
    if (snap.status === "expired") { setRemaining(0); return; }
    const calc = () => { const e = Math.round((Date.now() - snap.startWallMs + snap.elapsedAtPauseMs) / 1000); setRemaining(Math.max(0, snap.durationSec - e)); };
    calc();
    const t = setInterval(calc, 1000);
    return () => clearInterval(t);
  }, [snap]);
  return remaining;
}

export function FilmGameSheet({
  onClose,
  isDark,
  accent,
  textMain,
  textMuted,
  playerWhite = "White",
  playerBlack = "Black",
  timerSnap,
}: FilmGameSheetProps) {
  const timerRemaining = useTimerRemaining(timerSnap);
  // For the overlay: both players share the round timer; show it as the clock value
  const sharedTimeSec = timerRemaining;
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rafRef = useRef<number>(0);

  const [cameraState, setCameraState] = useState<CameraState>("idle");
  const [recordState, setRecordState] = useState<RecordState>("idle");
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [elapsed, setElapsed] = useState(0);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(true);
  const [showOverlay, setShowOverlay] = useState(true);

  // ── Watermark state ─────────────────────────────────────────────────────────
  const [watermarkText, setWatermarkText] = useState("ChessOTB.club");
  const [watermarkLogoDataUrl, setWatermarkLogoDataUrl] = useState<string | null>(null);
  const [watermarkPosition, setWatermarkPosition] = useState<WatermarkPosition>("top-right");
  const [logoUploadError, setLogoUploadError] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  // Pre-loaded HTMLImageElement for canvas drawing (avoids async in rAF)
  const watermarkLogoImgRef = useRef<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!watermarkLogoDataUrl) { watermarkLogoImgRef.current = null; return; }
    const img = new Image();
    img.onload = () => { watermarkLogoImgRef.current = img; };
    img.src = watermarkLogoDataUrl;
  }, [watermarkLogoDataUrl]);

  // Keep a ref to the latest overlay state so the rAF loop always reads fresh values
  const overlayStateRef = useRef({
    playerWhite, playerBlack,
    whiteTimeSec: sharedTimeSec, blackTimeSec: sharedTimeSec,
    activeColor: null as "white" | "black" | null,
    recordState: "idle" as RecordState, elapsed: 0,
    watermarkText: "ChessOTB.club",
    watermarkLogoImg: null as HTMLImageElement | null,
    watermarkPosition: "top-right" as WatermarkPosition,
  });
  useEffect(() => {
    overlayStateRef.current = {
      playerWhite, playerBlack,
      whiteTimeSec: sharedTimeSec, blackTimeSec: sharedTimeSec,
      activeColor: null, recordState, elapsed,
      watermarkText,
      watermarkLogoImg: watermarkLogoImgRef.current,
      watermarkPosition,
    };
  }, [playerWhite, playerBlack, sharedTimeSec, recordState, elapsed, watermarkText, watermarkPosition]);

  const handleLogoUpload = useCallback(async (file: File) => {
    setLogoUploadError(null);
    if (!file.type.startsWith("image/")) { setLogoUploadError("Please upload an image file (JPEG, PNG, WebP, SVG)."); return; }
    if (file.size > 5 * 1024 * 1024) { setLogoUploadError("Image must be 5 MB or smaller."); return; }
    setLogoUploading(true);
    try {
      const dataUrl = await resizeLogoImage(file);
      setWatermarkLogoDataUrl(dataUrl);
    } catch {
      setLogoUploadError("Failed to process image. Try another file.");
    } finally {
      setLogoUploading(false);
    }
  }, []);

  // rAF loop: composite video + overlay onto canvas
  const startRaf = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const loop = () => {
      if (video.readyState >= 2) {
        // Match canvas to video dimensions
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth || 1280;
          canvas.height = video.videoHeight || 720;
        }
        if (overlayStateRef.current.recordState !== "stopped") {
          drawOverlay(ctx, video, overlayStateRef.current);
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }, []);

  const stopRaf = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  // Start camera stream
  const startCamera = useCallback(async (facing: "environment" | "user") => {
    setCameraState("requesting");
    setBlobUrl(null);
    setShareError(null);
    stopRaf();
    try {
      streamRef.current?.getTracks().forEach(t => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setCameraState("active");
      // Start canvas compositing loop
      startRaf();
      // Build canvas stream for recording (30fps)
      if (canvasRef.current) {
        const audioTrack = stream.getAudioTracks()[0];
        const canvasStream = (canvasRef.current as HTMLCanvasElement & { captureStream?: (fps: number) => MediaStream }).captureStream?.(30);
        if (canvasStream && audioTrack) canvasStream.addTrack(audioTrack);
        canvasStreamRef.current = canvasStream ?? null;
      }
    } catch {
      setCameraState("denied");
    }
  }, [startRaf, stopRaf]);

  // Flip camera
  const flipCamera = useCallback(async () => {
    if (recordState === "recording") return;
    const next = facingMode === "environment" ? "user" : "environment";
    setFacingMode(next);
    await startCamera(next);
  }, [facingMode, recordState, startCamera]);

  // Start recording — use canvas stream when overlay is on, raw stream otherwise
  const startRecording = useCallback(() => {
    const recordSource = showOverlay && canvasStreamRef.current ? canvasStreamRef.current : streamRef.current;
    if (!recordSource) return;
    chunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : MediaRecorder.isTypeSupported("video/webm")
      ? "video/webm"
      : "video/mp4";
    const recorder = new MediaRecorder(recordSource, { mimeType });
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      setBlobUrl(URL.createObjectURL(blob));
    };
    recorder.start(500);
    recorderRef.current = recorder;
    setElapsed(0);
    setRecordState("recording");
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
  }, [showOverlay]);

  // Stop recording
  const stopRecording = useCallback(() => {
    recorderRef.current?.stop();
    if (timerRef.current) clearInterval(timerRef.current);
    setRecordState("stopped");
  }, []);

  // Share / download
  const shareVideo = useCallback(async () => {
    if (!blobUrl) return;
    setShareError(null);
    try {
      const res = await fetch(blobUrl);
      const blob = await res.blob();
      const file = new File([blob], `chess-game-${Date.now()}.webm`, { type: blob.type });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "My Chess Game" });
      } else {
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = file.name;
        a.click();
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") {
        setShareError("Could not share. Try downloading instead.");
      }
    }
  }, [blobUrl]);

  const downloadVideo = useCallback(() => {
    if (!blobUrl) return;
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = `chess-game-${Date.now()}.webm`;
    a.click();
  }, [blobUrl]);

  // Cleanup
  useEffect(() => {
    return () => {
      stopRaf();
      streamRef.current?.getTracks().forEach(t => t.stop());
      if (timerRef.current) clearInterval(timerRef.current);
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl, stopRaf]);

  const cardBg = isDark ? "bg-[oklch(0.18_0.06_145)]" : "bg-white";

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className={`relative w-full rounded-t-3xl border-t overflow-hidden ${cardBg} ${isDark ? "border-white/08" : "border-gray-100"} animate-slide-up-fade safe-bottom`}
        style={{ maxHeight: "92dvh" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className={`w-10 h-1 rounded-full ${isDark ? "bg-white/20" : "bg-gray-300"}`} />
        </div>

        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-3 border-b ${isDark ? "border-white/06" : "border-gray-100"}`}>
          <div className="flex items-center gap-2">
            <Camera className={`w-4 h-4 ${accent}`} />
            <span className={`text-sm font-bold ${textMain}`}>Film Your Game</span>
          </div>
          <button
            onClick={onClose}
            className={`w-8 h-8 rounded-full flex items-center justify-center ${isDark ? "bg-white/10 hover:bg-white/15" : "bg-gray-100 hover:bg-gray-200"} transition-colors`}
          >
            <X className={`w-4 h-4 ${textMuted}`} />
          </button>
        </div>

        <div className="overflow-y-auto" style={{ maxHeight: "calc(92dvh - 80px)" }}>
          {/* ── Idle ── */}
          {cameraState === "idle" && (
            <div className="px-5 py-8 flex flex-col items-center text-center gap-5">
              <div className={`w-20 h-20 rounded-3xl flex items-center justify-center ${isDark ? "bg-[#4CAF50]/15" : "bg-[#3D6B47]/08"}`}>
                <Camera className={`w-10 h-10 ${accent}`} />
              </div>
              <div>
                <p className={`text-base font-bold ${textMain} mb-1`}>Record Your Board</p>
                <p className={`text-sm ${textMuted} leading-relaxed`}>
                  Set up your phone on a tripod angled at the board from the side. Capture both players and the full board for the best view.
                </p>
              </div>
              <div className={`w-full rounded-2xl px-4 py-3 text-left ${isDark ? "bg-white/05" : "bg-gray-50"}`}>
                <p className={`text-xs font-bold ${accent} uppercase tracking-wider mb-2`}>Tips for best results</p>
                <ul className={`text-xs ${textMuted} space-y-1.5`}>
                  <li>📐 Place phone horizontally on a tripod</li>
                  <li>🎯 Angle from the side — capture the full board</li>
                  <li>💡 Ensure good lighting on the board</li>
                  <li>🔇 Quiet environment improves audio quality</li>
                </ul>
              </div>
              <button
                onClick={() => startCamera(facingMode)}
                className={`w-full py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 ${isDark ? "bg-[#4CAF50] text-white" : "bg-[#3D6B47] text-white"}`}
              >
                <Camera className="w-4 h-4" />
                Start Camera
              </button>
            </div>
          )}

          {/* ── Requesting ── */}
          {cameraState === "requesting" && (
            <div className="px-5 py-12 flex flex-col items-center text-center gap-4">
              <Loader2 className={`w-10 h-10 ${accent} animate-spin`} />
              <p className={`text-sm font-semibold ${textMain}`}>Requesting camera access…</p>
              <p className={`text-xs ${textMuted}`}>Allow camera and microphone when prompted</p>
            </div>
          )}

          {/* ── Denied ── */}
          {cameraState === "denied" && (
            <div className="px-5 py-8 flex flex-col items-center text-center gap-5">
              <div className="w-16 h-16 rounded-3xl bg-red-500/15 flex items-center justify-center">
                <CameraOff className="w-8 h-8 text-red-400" />
              </div>
              <div>
                <p className={`text-base font-bold ${textMain} mb-1`}>Camera Access Denied</p>
                <p className={`text-sm ${textMuted} leading-relaxed`}>
                  To film your game, allow camera access in your browser settings, then try again.
                </p>
              </div>
              <div className="w-full rounded-2xl px-4 py-3 bg-amber-500/10 border border-amber-500/20">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-400 text-left">
                    On iOS: Settings → Safari → Camera → Allow. On Android: tap the lock icon in the address bar.
                  </p>
                </div>
              </div>
              <button
                onClick={() => startCamera(facingMode)}
                className={`w-full py-4 rounded-2xl font-bold text-sm ${isDark ? "bg-white/10 text-white" : "bg-gray-100 text-gray-700"}`}
              >
                Try Again
              </button>
            </div>
          )}

          {/* ── Active camera ── */}
          {cameraState === "active" && (
            <div className="flex flex-col">
              {/* Preview: show canvas (composited) or raw video */}
              <div className="relative bg-black" style={{ aspectRatio: "16/9" }}>
                {/* Hidden raw video — source for canvas compositing */}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{ opacity: showOverlay ? 0 : 1 }}
                />
                {/* Canvas preview (always rendered, hidden when overlay off) */}
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{ opacity: showOverlay ? 1 : 0 }}
                />

                {/* Board framing guide overlay (DOM layer, not composited) */}
                {showGuide && recordState === "idle" && (
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
                      {Array.from({ length: 9 }).map((_, i) => (
                        <div key={i} className="border border-white/20" />
                      ))}
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-24 h-24 border-2 border-white/60 rounded-lg flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-white/80" />
                      </div>
                    </div>
                    <div className="absolute bottom-2 left-0 right-0 flex justify-center">
                      <span className="text-[10px] text-white/70 bg-black/50 px-2 py-0.5 rounded-full">
                        Frame the board within the guide
                      </span>
                    </div>
                  </div>
                )}

                {/* REC indicator (DOM layer — shown when raw video is displayed) */}
                {!showOverlay && recordState === "recording" && (
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-red-600 px-2.5 py-1 rounded-full">
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                    <span className="text-white text-xs font-bold">{formatElapsed(elapsed)}</span>
                  </div>
                )}

                {/* Flip camera */}
                {recordState !== "recording" && (
                  <button
                    onClick={flipCamera}
                    className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/50 flex items-center justify-center"
                  >
                    <FlipHorizontal className="w-4 h-4 text-white" />
                  </button>
                )}
              </div>

              {/* Controls */}
              <div className="px-5 py-5 space-y-3">
                {/* Toggle row */}
                {recordState !== "stopped" && (
                  <div className="flex items-center gap-3">
                    {/* Clock overlay toggle */}
                    <button
                      onClick={() => setShowOverlay(o => !o)}
                      disabled={recordState === "recording"}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                        showOverlay
                          ? isDark ? "bg-[#4CAF50]/20 text-[#4CAF50]" : "bg-[#3D6B47]/10 text-[#3D6B47]"
                          : isDark ? "bg-white/08 text-white/50" : "bg-gray-100 text-gray-400"
                      } disabled:opacity-40 disabled:cursor-not-allowed`}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      Clock Overlay {showOverlay ? "On" : "Off"}
                    </button>

                    {/* Framing guide toggle */}
                    {recordState === "idle" && (
                      <button
                        onClick={() => setShowGuide(g => !g)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                          showGuide
                            ? isDark ? "bg-white/10 text-white/70" : "bg-gray-200 text-gray-600"
                            : isDark ? "bg-white/05 text-white/30" : "bg-gray-50 text-gray-300"
                        }`}
                      >
                        Guide {showGuide ? "On" : "Off"}
                      </button>
                    )}
                  </div>
                )}

                {/* Overlay preview info */}
                {showOverlay && recordState === "idle" && (
                  <div className={`rounded-xl px-3 py-2.5 ${isDark ? "bg-white/05" : "bg-gray-50"}`}>
                    <p className={`text-xs font-semibold ${accent} mb-1`}>Clock overlay preview</p>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={`text-xs font-bold ${textMain}`}>{playerWhite}</p>
                        <p className={`text-sm font-black ${accent}`}>{formatTime(sharedTimeSec)}</p>
                      </div>
                      <span className={`text-xs ${textMuted}`}>VS</span>
                      <div className="text-right">
                        <p className={`text-xs font-bold ${textMain}`}>{playerBlack}</p>
                        <p className={`text-sm font-black ${accent}`}>{formatTime(sharedTimeSec)}</p>
                      </div>
                    </div>
                    <p className={`text-[10px] ${textMuted} mt-1.5`}>
                      {canvasStreamRef.current ? "✓ Overlay will be baked into the recording" : "⚠ Canvas capture not supported — overlay visible in preview only"}
                    </p>
                  </div>
                )}

                {/* Watermark customization panel */}
                {showOverlay && recordState === "idle" && (
                  <div className={`rounded-xl overflow-hidden ${isDark ? "bg-white/05" : "bg-gray-50"}`}>
                    {/* Panel header */}
                    <div className={`px-3 py-2.5 flex items-center justify-between border-b ${isDark ? "border-white/06" : "border-gray-100"}`}>
                      <span className={`text-xs font-bold ${textMain}`}>Watermark</span>
                      <span className={`text-[10px] ${textMuted}`}>Baked into recording</span>
                    </div>

                    <div className="px-3 py-3 space-y-3">
                      {/* Text vs Logo toggle */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => setWatermarkLogoDataUrl(null)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                            !watermarkLogoDataUrl
                              ? isDark ? "bg-[#4CAF50]/20 text-[#4CAF50]" : "bg-[#3D6B47]/10 text-[#3D6B47]"
                              : isDark ? "bg-white/08 text-white/40" : "bg-gray-100 text-gray-400"
                          }`}
                        >
                          <Type className="w-3 h-3" /> Text
                        </button>
                        <button
                          onClick={() => logoInputRef.current?.click()}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                            watermarkLogoDataUrl
                              ? isDark ? "bg-[#4CAF50]/20 text-[#4CAF50]" : "bg-[#3D6B47]/10 text-[#3D6B47]"
                              : isDark ? "bg-white/08 text-white/40" : "bg-gray-100 text-gray-400"
                          }`}
                        >
                          {logoUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <ImagePlus className="w-3 h-3" />}
                          Logo
                        </button>
                        <input
                          ref={logoInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); e.target.value = ""; }}
                        />
                      </div>

                      {/* Text input */}
                      {!watermarkLogoDataUrl && (
                        <input
                          type="text"
                          value={watermarkText}
                          onChange={(e) => setWatermarkText(e.target.value.slice(0, 40))}
                          placeholder="Your watermark text…"
                          maxLength={40}
                          className={`w-full px-3 py-2 rounded-lg text-xs font-semibold outline-none border ${
                            isDark
                              ? "bg-white/08 border-white/10 text-white placeholder:text-white/30 focus:border-[#4CAF50]/50"
                              : "bg-white border-gray-200 text-gray-800 placeholder:text-gray-300 focus:border-[#3D6B47]/40"
                          } transition-colors`}
                        />
                      )}

                      {/* Logo preview + remove */}
                      {watermarkLogoDataUrl && (
                        <div className="flex items-center gap-2">
                          <img src={watermarkLogoDataUrl} alt="Logo" className="h-8 rounded object-contain" style={{ maxWidth: 80 }} />
                          <button
                            onClick={() => setWatermarkLogoDataUrl(null)}
                            className={`flex items-center gap-1 text-xs ${isDark ? "text-white/40 hover:text-red-400" : "text-gray-400 hover:text-red-500"} transition-colors`}
                          >
                            <Trash2 className="w-3 h-3" /> Remove
                          </button>
                        </div>
                      )}

                      {logoUploadError && <p className="text-[10px] text-red-400">{logoUploadError}</p>}

                      {/* Position picker */}
                      <div>
                        <p className={`text-[10px] font-semibold ${textMuted} uppercase tracking-wider mb-1.5`}>Position</p>
                        <div className="grid grid-cols-2 gap-1.5">
                          {(["top-left", "top-right", "bottom-left", "bottom-right"] as WatermarkPosition[]).map((pos) => (
                            <button
                              key={pos}
                              onClick={() => setWatermarkPosition(pos)}
                              className={`py-1.5 rounded-lg text-[10px] font-semibold capitalize transition-colors ${
                                watermarkPosition === pos
                                  ? isDark ? "bg-[#4CAF50]/20 text-[#4CAF50]" : "bg-[#3D6B47]/10 text-[#3D6B47]"
                                  : isDark ? "bg-white/06 text-white/40" : "bg-gray-100 text-gray-400"
                              }`}
                            >
                              {pos.replace("-", " ")}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Record / Stop */}
                {recordState !== "stopped" && (
                  <button
                    onClick={recordState === "idle" ? startRecording : stopRecording}
                    className={`w-full py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-colors ${
                      recordState === "recording"
                        ? "bg-red-600 text-white"
                        : isDark ? "bg-[#4CAF50] text-white" : "bg-[#3D6B47] text-white"
                    }`}
                  >
                    {recordState === "recording" ? (
                      <>
                        <Square className="w-4 h-4 fill-white" />
                        Stop Recording ({formatElapsed(elapsed)})
                      </>
                    ) : (
                      <>
                        <Circle className="w-4 h-4 fill-red-500 text-red-500" />
                        Start Recording
                      </>
                    )}
                  </button>
                )}

                {/* Post-recording */}
                {recordState === "stopped" && blobUrl && (
                  <div className="space-y-3">
                    <div className={`rounded-2xl px-4 py-3 text-center ${isDark ? "bg-white/05" : "bg-gray-50"}`}>
                      <p className={`text-sm font-bold ${textMain} mb-0.5`}>Recording saved!</p>
                      <p className={`text-xs ${textMuted}`}>{formatElapsed(elapsed)} recorded{showOverlay ? " · with clock overlay" : ""}</p>
                    </div>
                    {shareError && <p className="text-xs text-red-400 text-center">{shareError}</p>}
                    <button
                      onClick={shareVideo}
                      className={`w-full py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 ${isDark ? "bg-[#4CAF50] text-white" : "bg-[#3D6B47] text-white"}`}
                    >
                      <Share2 className="w-4 h-4" />
                      Share / Post
                    </button>
                    <button
                      onClick={downloadVideo}
                      className={`w-full py-3 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 ${isDark ? "bg-white/10 text-white" : "bg-gray-100 text-gray-700"}`}
                    >
                      <Download className="w-4 h-4" />
                      Save to Device
                    </button>
                    <button
                      onClick={() => { setRecordState("idle"); setBlobUrl(null); setElapsed(0); }}
                      className={`w-full py-3 rounded-2xl font-semibold text-sm ${isDark ? "text-white/50" : "text-gray-400"}`}
                    >
                      Record Again
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
