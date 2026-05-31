/**
 * FilmGameSheet — Bottom-sheet overlay for filming / streaming a board game.
 *
 * Features:
 * - Camera permission request with clear explanation
 * - Live camera preview (rear camera by default, front camera toggle)
 * - Board-framing guide overlay (rule-of-thirds crosshair)
 * - Record button with elapsed timer
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
} from "lucide-react";

interface FilmGameSheetProps {
  onClose: () => void;
  isDark: boolean;
  accent: string;
  textMain: string;
  textMuted: string;
}

type CameraState = "idle" | "requesting" | "denied" | "active";
type RecordState = "idle" | "recording" | "stopped";

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function FilmGameSheet({ onClose, isDark, accent, textMain, textMuted }: FilmGameSheetProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [cameraState, setCameraState] = useState<CameraState>("idle");
  const [recordState, setRecordState] = useState<RecordState>("idle");
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [elapsed, setElapsed] = useState(0);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(true);

  // Start camera stream
  const startCamera = useCallback(async (facing: "environment" | "user") => {
    setCameraState("requesting");
    setBlobUrl(null);
    setShareError(null);
    try {
      // Stop any existing stream
      streamRef.current?.getTracks().forEach(t => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      setCameraState("active");
    } catch {
      setCameraState("denied");
    }
  }, []);

  // Flip camera
  const flipCamera = useCallback(async () => {
    if (recordState === "recording") return;
    const next = facingMode === "environment" ? "user" : "environment";
    setFacingMode(next);
    await startCamera(next);
  }, [facingMode, recordState, startCamera]);

  // Start recording
  const startRecording = useCallback(() => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : MediaRecorder.isTypeSupported("video/webm")
      ? "video/webm"
      : "video/mp4";
    const recorder = new MediaRecorder(streamRef.current, { mimeType });
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const url = URL.createObjectURL(blob);
      setBlobUrl(url);
    };
    recorder.start(500);
    recorderRef.current = recorder;
    setElapsed(0);
    setRecordState("recording");
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
  }, []);

  // Stop recording
  const stopRecording = useCallback(() => {
    recorderRef.current?.stop();
    if (timerRef.current) clearInterval(timerRef.current);
    setRecordState("stopped");
  }, []);

  // Share / download recorded video
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
        // Fallback: trigger download
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
      if (timerRef.current) clearInterval(timerRef.current);
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  const cardBg = isDark ? "bg-[oklch(0.18_0.06_145)]" : "bg-white";
  const divider = isDark ? "border-white/08" : "border-gray-100";

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className={`relative w-full rounded-t-3xl border-t overflow-hidden ${cardBg} border-${divider} animate-slide-up-fade safe-bottom`}
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
          {/* ── Idle: prompt to start camera ── */}
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
                className={`w-full py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 ${
                  isDark ? "bg-[#4CAF50] text-white" : "bg-[#3D6B47] text-white"
                }`}
              >
                <Camera className="w-4 h-4" />
                Start Camera
              </button>
            </div>
          )}

          {/* ── Requesting permission ── */}
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
              {/* Camera preview */}
              <div className="relative bg-black" style={{ aspectRatio: "16/9" }}>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />

                {/* Board framing guide overlay */}
                {showGuide && recordState === "idle" && (
                  <div className="absolute inset-0 pointer-events-none">
                    {/* Rule-of-thirds grid */}
                    <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
                      {Array.from({ length: 9 }).map((_, i) => (
                        <div key={i} className="border border-white/20" />
                      ))}
                    </div>
                    {/* Center target */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-24 h-24 border-2 border-white/60 rounded-lg flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-white/80" />
                      </div>
                    </div>
                    {/* Guide label */}
                    <div className="absolute bottom-2 left-0 right-0 flex justify-center">
                      <span className="text-[10px] text-white/70 bg-black/50 px-2 py-0.5 rounded-full">
                        Frame the board within the guide
                      </span>
                    </div>
                  </div>
                )}

                {/* Recording indicator */}
                {recordState === "recording" && (
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-red-600 px-2.5 py-1 rounded-full">
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                    <span className="text-white text-xs font-bold">{formatElapsed(elapsed)}</span>
                  </div>
                )}

                {/* Flip camera button */}
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
              <div className="px-5 py-5 space-y-4">
                {/* Guide toggle */}
                {recordState === "idle" && (
                  <button
                    onClick={() => setShowGuide(g => !g)}
                    className={`text-xs font-semibold ${accent} flex items-center gap-1`}
                  >
                    {showGuide ? "Hide" : "Show"} framing guide
                  </button>
                )}

                {/* Record / Stop button */}
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

                {/* Post-recording: share / download */}
                {recordState === "stopped" && blobUrl && (
                  <div className="space-y-3">
                    <div className={`rounded-2xl px-4 py-3 text-center ${isDark ? "bg-white/05" : "bg-gray-50"}`}>
                      <p className={`text-sm font-bold ${textMain} mb-0.5`}>Recording saved!</p>
                      <p className={`text-xs ${textMuted}`}>{formatElapsed(elapsed)} recorded</p>
                    </div>
                    {shareError && (
                      <p className="text-xs text-red-400 text-center">{shareError}</p>
                    )}
                    <button
                      onClick={shareVideo}
                      className={`w-full py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 ${
                        isDark ? "bg-[#4CAF50] text-white" : "bg-[#3D6B47] text-white"
                      }`}
                    >
                      <Share2 className="w-4 h-4" />
                      Share / Post
                    </button>
                    <button
                      onClick={downloadVideo}
                      className={`w-full py-3 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 ${
                        isDark ? "bg-white/10 text-white" : "bg-gray-100 text-gray-700"
                      }`}
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
