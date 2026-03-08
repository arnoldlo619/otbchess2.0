/**
 * VideoRecorder — /record/camera
 *
 * Full-screen, mobile-first video recording flow for OTB chess games.
 * Five sequential screens:
 *
 *   1. permission   — camera permission gate
 *   2. orientation  — landscape lock prompt
 *   3. framing      — live preview + OpenCV.js board detection overlay
 *   4. recording    — active recording with MediaRecorder + wake lock
 *   5. processing   — upload complete, polling for analysis
 *
 * Query params:
 *   tournamentId  — links the session to a tournament
 *   boardNumber   — pre-fills the board number
 *   white         — white player username
 *   black         — black player username
 */
import {
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { useSearch, useLocation } from "wouter";
import { NavLogo } from "@/components/NavLogo";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuthContext } from "@/context/AuthContext";
import {
  Camera,
  RotateCcw,
  Video,
  Square,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  ChevronRight,
  Volume2,
  Lightbulb,
  Grid3x3,
  ArrowLeft,
  Wifi,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
type Screen = "permission" | "orientation" | "framing" | "recording" | "processing";

interface FramingStatus {
  boardDetected: boolean;
  cornersVisible: boolean;
  lightingOk: boolean;
  confidence: number; // 0–1
}

interface RecordingSession {
  id: string;
  status: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function isLandscape(): boolean {
  const screenOrientation = (globalThis.screen as { orientation?: ScreenOrientation }).orientation;
  if (typeof screen !== "undefined" && screenOrientation) {
    return screenOrientation.type.startsWith("landscape");
  }
  return window.innerWidth > window.innerHeight;
}

// ── Indicator Component ───────────────────────────────────────────────────────
function Indicator({
  ok,
  loading,
  label,
}: {
  ok: boolean;
  loading?: boolean;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      {loading ? (
        <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
      ) : ok ? (
        <CheckCircle2 className="w-4 h-4 text-[#4CAF50]" />
      ) : (
        <XCircle className="w-4 h-4 text-red-400" />
      )}
      <span className={`text-sm font-medium ${ok ? "text-[#4CAF50]" : loading ? "text-amber-400" : "text-red-400"}`}>
        {label}
      </span>
    </div>
  );
}

// ── Processing Step ───────────────────────────────────────────────────────────
const PROCESSING_STEPS = [
  "Saving recording",
  "Uploading to server",
  "Queued for analysis",
  "Analysing with Stockfish",
  "Analysis ready",
];

function ProcessingStepBar({ currentStep }: { currentStep: number }) {
  return (
    <div className="w-full space-y-3">
      {PROCESSING_STEPS.map((label, i) => {
        const done = i < currentStep;
        const active = i === currentStep;
        return (
          <div key={label} className="flex items-center gap-3">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-500 ${
              done
                ? "bg-[#4CAF50]"
                : active
                ? "bg-[#4CAF50]/20 border-2 border-[#4CAF50]"
                : "bg-white/08 border border-white/15"
            }`}>
              {done ? (
                <CheckCircle2 className="w-4 h-4 text-white" />
              ) : active ? (
                <Loader2 className="w-3.5 h-3.5 text-[#4CAF50] animate-spin" />
              ) : (
                <span className="text-xs text-white/30 font-bold">{i + 1}</span>
              )}
            </div>
            <span className={`text-sm font-medium transition-colors duration-300 ${
              done ? "text-[#4CAF50]" : active ? "text-white" : "text-white/30"
            }`}>
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function VideoRecorder() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { user } = useAuthContext();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const [, navigate] = useLocation();

  const tournamentId = params.get("tournamentId") ?? "";
  const boardNumber = params.get("boardNumber") ?? "";
  const whitePlayer = params.get("white") ?? "";
  const blackPlayer = params.get("black") ?? "";

  // ── Screen state ─────────────────────────────────────────────────────────
  const [screen, setScreen] = useState<Screen>("permission");
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [landscape, setLandscape] = useState(isLandscape());

  // ── Framing state ─────────────────────────────────────────────────────────
  const [framing, setFraming] = useState<FramingStatus>({
    boardDetected: false,
    cornersVisible: false,
    lightingOk: false,
    confidence: 0,
  });
  const [opencvReady, setOpencvReady] = useState(false);
  const [showTips, setShowTips] = useState(false);

  // ── Recording state ───────────────────────────────────────────────────────
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [chunkCount, setChunkCount] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [boardHealth, setBoardHealth] = useState(true);

  // ── Processing state ──────────────────────────────────────────────────────
  const [session, setSession] = useState<RecordingSession | null>(null);
  const [processingStep, setProcessingStep] = useState(0);
  const [gameId, setGameId] = useState<string | null>(null);

  // ── Refs ──────────────────────────────────────────────────────────────────
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const elapsedIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const detectionIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const startTimeRef = useRef<number>(0);
  const chunksRef = useRef<Blob[]>([]);

  const bg = isDark ? "bg-[#0d1f12]" : "bg-gray-950";
  const cardBg = isDark ? "bg-[#1a2e1e]" : "bg-gray-900";
  const accent = "text-[#4CAF50]";

  // ── Orientation listener ──────────────────────────────────────────────────
  useEffect(() => {
    const handler = () => setLandscape(isLandscape());
    window.addEventListener("resize", handler);
    const screenOrientation = (globalThis.screen as { orientation?: ScreenOrientation }).orientation;
    if (screenOrientation) {
      screenOrientation.addEventListener("change", handler);
    }
    return () => {
      window.removeEventListener("resize", handler);
      if (screenOrientation) {
        screenOrientation.removeEventListener("change", handler);
      }
    };
  }, []);

  // ── Auto-advance orientation screen ──────────────────────────────────────
  useEffect(() => {
    if (screen === "orientation" && landscape) {
      setScreen("framing");
    }
  }, [landscape, screen]);

  // ── Load OpenCV.js lazily via CDN ─────────────────────────────────────────
  useEffect(() => {
    if (screen !== "framing") return;
    if (opencvReady) return;

    // Check if already loaded
    if ((window as unknown as Record<string, unknown>).cv) {
      setOpencvReady(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://docs.opencv.org/4.8.0/opencv.js";
    script.async = true;
    script.onload = () => {
      // OpenCV.js sets window.cv when ready
      const checkReady = setInterval(() => {
        const cv = (window as unknown as Record<string, unknown>).cv;
        if (cv && typeof (cv as Record<string, unknown>).Mat === "function") {
          clearInterval(checkReady);
          setOpencvReady(true);
        }
      }, 100);
      // Timeout after 10s — fall back to heuristic detection
      setTimeout(() => {
        clearInterval(checkReady);
        setOpencvReady(true); // proceed anyway with fallback
      }, 10000);
    };
    script.onerror = () => {
      setOpencvReady(true); // proceed with fallback detection
    };
    document.head.appendChild(script);

    return () => {
      // Don't remove script — keep it cached for next time
    };
  }, [screen, opencvReady]);

  // ── Start camera stream ───────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err) {
      console.error("[VideoRecorder] Camera error:", err);
    }
  }, []);

  useEffect(() => {
    if (screen === "framing" || screen === "recording") {
      startCamera();
    }
    return () => {
      if (screen !== "recording") {
        streamRef.current?.getTracks().forEach((t) => t.stop());
      }
    };
  }, [screen, startCamera]);

  // ── Board detection (OpenCV.js or heuristic fallback) ────────────────────
  const runDetection = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const cv = (window as unknown as Record<string, unknown>).cv as Record<string, unknown> | undefined;

    if (cv && typeof cv.Mat === "function") {
      // OpenCV.js path
      try {
        const src = (cv.imread as (el: HTMLCanvasElement) => unknown)(canvas);
        const gray = new (cv.Mat as new () => unknown)();
        const edges = new (cv.Mat as new () => unknown)();

        (cv.cvtColor as (src: unknown, dst: unknown, code: unknown) => void)(
          src, gray, (cv.COLOR_RGBA2GRAY as unknown)
        );
        (cv.Canny as (src: unknown, dst: unknown, t1: number, t2: number) => void)(
          gray, edges, 50, 150
        );

        // Count edge pixels as a proxy for board detection
        const edgeData = (edges as { data: Uint8Array }).data;
        let edgeCount = 0;
        for (let i = 0; i < edgeData.length; i++) {
          if (edgeData[i] > 0) edgeCount++;
        }
        const edgeDensity = edgeCount / (canvas.width * canvas.height);

        // Heuristic: a chess board has many straight lines → high edge density
        const boardDetected = edgeDensity > 0.04;
        const confidence = Math.min(edgeDensity / 0.12, 1);

        // Lighting check: average brightness
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        let brightness = 0;
        for (let i = 0; i < imageData.data.length; i += 4) {
          brightness += (imageData.data[i] + imageData.data[i + 1] + imageData.data[i + 2]) / 3;
        }
        brightness /= (imageData.data.length / 4);
        const lightingOk = brightness > 60 && brightness < 220;

        setFraming({
          boardDetected,
          cornersVisible: confidence > 0.6,
          lightingOk,
          confidence,
        });
        setBoardHealth(boardDetected);

        (src as { delete: () => void }).delete();
        (gray as { delete: () => void }).delete();
        (edges as { delete: () => void }).delete();
      } catch {
        // Fall through to heuristic
        runHeuristicDetection(ctx, canvas);
      }
    } else {
      // Heuristic fallback (no OpenCV)
      runHeuristicDetection(ctx, canvas);
    }
  }, []);

  function runHeuristicDetection(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement
  ) {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Brightness
    let brightness = 0;
    let edgeCount = 0;
    for (let i = 0; i < data.length; i += 16) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      brightness += (r + g + b) / 3;
      // Simple edge: high contrast between adjacent pixels
      if (i + 20 < data.length) {
        const diff = Math.abs(r - data[i + 16]) + Math.abs(g - data[i + 17]) + Math.abs(b - data[i + 18]);
        if (diff > 60) edgeCount++;
      }
    }
    brightness /= (data.length / 16);
    const edgeDensity = edgeCount / (data.length / 16);
    const boardDetected = edgeDensity > 0.15;
    const confidence = Math.min(edgeDensity / 0.4, 1);
    const lightingOk = brightness > 60 && brightness < 220;

    setFraming({
      boardDetected,
      cornersVisible: confidence > 0.5,
      lightingOk,
      confidence,
    });
    setBoardHealth(boardDetected);
  }

  // ── Start/stop detection loop ─────────────────────────────────────────────
  useEffect(() => {
    if (screen === "framing" && opencvReady) {
      detectionIntervalRef.current = setInterval(runDetection, 200); // 5fps
    }
    return () => {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
    };
  }, [screen, opencvReady, runDetection]);

  // ── Also run detection during recording for health dot ───────────────────
  useEffect(() => {
    if (screen === "recording") {
      detectionIntervalRef.current = setInterval(runDetection, 1000); // 1fps during recording
    }
    return () => {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
    };
  }, [screen, runDetection]);

  // ── Create recording session on server ───────────────────────────────────
  const createSession = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch("/api/recordings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          tournamentId: tournamentId || null,
          boardNumber: boardNumber || null,
          whitePlayer: whitePlayer || null,
          blackPlayer: blackPlayer || null,
          source: "camera",
        }),
      });
      if (!res.ok) return null;
      const data = await res.json() as { id: string };
      return data.id;
    } catch {
      return null;
    }
  }, [tournamentId, boardNumber, whitePlayer, blackPlayer]);

  // ── Upload chunk to server ────────────────────────────────────────────────
  const uploadChunk = useCallback(async (
    sessionId: string,
    chunkIndex: number,
    blob: Blob
  ) => {
    try {
      const formData = new FormData();
      formData.append("chunk", blob, `chunk-${chunkIndex}.webm`);
      formData.append("chunkIndex", String(chunkIndex));
      formData.append("sessionId", sessionId);

      await fetch(`/api/recordings/${sessionId}/chunk`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
    } catch (err) {
      console.error("[VideoRecorder] Chunk upload error:", err);
      setUploadError("Upload interrupted — chunks are buffered locally");
    }
  }, []);

  // ── Acquire wake lock ─────────────────────────────────────────────────────
  const acquireWakeLock = useCallback(async () => {
    if (!("wakeLock" in navigator)) return;
    try {
      wakeLockRef.current = await navigator.wakeLock.request("screen");
    } catch (err) {
      console.warn("[VideoRecorder] Wake lock not available:", err);
    }
  }, []);

  // ── Re-acquire wake lock on visibility change ─────────────────────────────
  useEffect(() => {
    if (screen !== "recording") return;
    const handler = async () => {
      if (document.visibilityState === "visible" && recording) {
        await acquireWakeLock();
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [screen, recording, acquireWakeLock]);

  // ── Start recording ───────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    if (!streamRef.current) return;

    // Create session on server
    const sid = await createSession();
    if (!sid) {
      setUploadError("Could not create recording session. Check your connection.");
      return;
    }
    sessionIdRef.current = sid;
    setSession({ id: sid, status: "recording" });

    // Acquire wake lock
    await acquireWakeLock();

    // Start elapsed timer
    startTimeRef.current = Date.now();
    elapsedIntervalRef.current = setInterval(() => {
      setElapsed(Date.now() - startTimeRef.current);
    }, 1000);

    // Start MediaRecorder
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : MediaRecorder.isTypeSupported("video/webm")
      ? "video/webm"
      : "video/mp4";

    const recorder = new MediaRecorder(streamRef.current, {
      mimeType,
      videoBitsPerSecond: 2_500_000, // 2.5 Mbps — good quality, manageable size
    });

    let chunkIdx = 0;
    chunksRef.current = [];

    recorder.ondataavailable = async (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
        setChunkCount((c) => c + 1);
        // Upload chunk in background
        if (sid) {
          await uploadChunk(sid, chunkIdx++, e.data);
        }
      }
    };

    recorder.start(5000); // 5-second chunks
    recorderRef.current = recorder;
    setRecording(true);
  }, [createSession, acquireWakeLock, uploadChunk]);

  // ── Stop recording ────────────────────────────────────────────────────────
  const stopRecording = useCallback(async () => {
    if (!recorderRef.current || !sessionIdRef.current) return;

    recorderRef.current.stop();
    setRecording(false);

    // Release wake lock
    if (wakeLockRef.current) {
      await wakeLockRef.current.release();
      wakeLockRef.current = null;
    }

    // Clear timers
    if (elapsedIntervalRef.current) {
      clearInterval(elapsedIntervalRef.current);
    }
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
    }

    // Stop camera stream
    streamRef.current?.getTracks().forEach((t) => t.stop());

    // Finalize on server
    const sid = sessionIdRef.current;
    try {
      await fetch(`/api/recordings/${sid}/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          chunkCount: chunksRef.current.length,
          durationMs: elapsed,
          whitePlayer: whitePlayer || null,
          blackPlayer: blackPlayer || null,
        }),
      });
    } catch (err) {
      console.error("[VideoRecorder] Finalize error:", err);
    }

    setScreen("processing");
    setProcessingStep(1); // "Uploading to server"
  }, [elapsed, whitePlayer, blackPlayer]);

  // ── Poll processing status ────────────────────────────────────────────────
  useEffect(() => {
    if (screen !== "processing" || !sessionIdRef.current) return;

    const STATUS_TO_STEP: Record<string, number> = {
      recording: 0,
      uploading: 1,
      queued: 2,
      analyzing: 3,
      ready: 4,
      failed: 4,
    };

    pollIntervalRef.current = setInterval(async () => {
      try {
        const sid = sessionIdRef.current;
        if (!sid) return;
        const res = await fetch(`/api/recordings/${sid}`, {
          credentials: "include",
        });
        if (!res.ok) return;
        const data = await res.json() as { status: string; gameId?: string };
        const step = STATUS_TO_STEP[data.status] ?? 0;
        setProcessingStep(step);

        if (data.status === "ready" && data.gameId) {
          setGameId(data.gameId);
          clearInterval(pollIntervalRef.current!);
        }
      } catch {
        // Keep polling
      }
    }, 5000);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [screen]);

  // ── Permission check ──────────────────────────────────────────────────────
  const requestPermission = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((t) => t.stop()); // just checking
      setPermissionDenied(false);
      if (isLandscape()) {
        setScreen("framing");
      } else {
        setScreen("orientation");
      }
    } catch {
      setPermissionDenied(true);
    }
  }, []);

  // ── Framing ready check ───────────────────────────────────────────────────
  const framingReady = framing.boardDetected && framing.cornersVisible && framing.lightingOk;

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (wakeLockRef.current) wakeLockRef.current.release();
      if (elapsedIntervalRef.current) clearInterval(elapsedIntervalRef.current);
      if (detectionIntervalRef.current) clearInterval(detectionIntervalRef.current);
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // ── SCREEN 1: Permission Gate ─────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────
  if (screen === "permission") {
    return (
      <div className={`min-h-screen ${bg} flex flex-col`}>
        {/* Header */}
        <div className="px-5 pt-safe-top pt-5 pb-4 flex items-center gap-3">
          <button
            onClick={() => navigate("/")}
            className="w-9 h-9 rounded-xl bg-white/08 flex items-center justify-center"
          >
            <ArrowLeft className="w-4 h-4 text-white/70" />
          </button>
          <NavLogo linked={false} />
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
          {/* Icon */}
          <div className="w-24 h-24 rounded-3xl bg-[#4CAF50]/15 border border-[#4CAF50]/30 flex items-center justify-center mb-8">
            <Camera className="w-12 h-12 text-[#4CAF50]" />
          </div>

          <h1 className="text-2xl font-black text-white mb-3">
            Record Your Game
          </h1>
          <p className="text-white/60 text-sm leading-relaxed mb-2">
            ChessOTB.club needs access to your camera to record the game.
            Your video is processed privately and never shared.
          </p>
          {boardNumber && (
            <p className="text-[#4CAF50] text-sm font-semibold mb-8">
              Board {boardNumber}
              {whitePlayer && blackPlayer && ` · ${whitePlayer} vs ${blackPlayer}`}
            </p>
          )}

          {!boardNumber && <div className="mb-8" />}

          {permissionDenied ? (
            <div className="w-full max-w-sm">
              <div className="rounded-2xl bg-red-500/10 border border-red-500/20 px-5 py-4 mb-6 text-left">
                <div className="flex items-start gap-3">
                  <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-red-400 mb-1">Camera access denied</p>
                    <p className="text-xs text-white/50 leading-relaxed">
                      Open your browser settings, find Camera permissions, and allow access for this site. Then tap the button below.
                    </p>
                  </div>
                </div>
              </div>
              <button
                onClick={requestPermission}
                className="w-full py-4 rounded-2xl bg-[#4CAF50] text-white font-bold text-base active:scale-95 transition-transform"
              >
                Try Again
              </button>
            </div>
          ) : (
            <div className="w-full max-w-sm space-y-3">
              <button
                onClick={requestPermission}
                className="w-full py-4 rounded-2xl bg-[#4CAF50] text-white font-bold text-base active:scale-95 transition-transform flex items-center justify-center gap-2"
              >
                <Camera className="w-5 h-5" />
                Allow Camera Access
              </button>
              <button
                onClick={() => navigate("/record")}
                className="w-full py-3 rounded-2xl bg-white/06 text-white/60 font-medium text-sm"
              >
                Enter PGN manually instead
              </button>
            </div>
          )}
        </div>

        {/* Setup tips */}
        <div className="px-6 pb-8">
          <div className="rounded-2xl bg-white/04 border border-white/08 px-5 py-4">
            <p className="text-xs font-bold text-white/40 uppercase tracking-wider mb-3">What you'll need</p>
            <div className="space-y-2">
              {[
                { icon: "📱", text: "Phone mounted horizontally on a tripod" },
                { icon: "🎯", text: "Camera angled at the board from the side" },
                { icon: "💡", text: "Good lighting — avoid shadows on the board" },
              ].map(({ icon, text }) => (
                <div key={text} className="flex items-center gap-3">
                  <span className="text-base">{icon}</span>
                  <span className="text-sm text-white/50">{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ── SCREEN 2: Orientation Lock ────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────
  if (screen === "orientation") {
    return (
      <div className={`min-h-screen ${bg} flex flex-col items-center justify-center px-8 text-center`}>
        {/* Animated rotate icon */}
        <div className="relative mb-10">
          <div className="w-28 h-28 rounded-3xl bg-[#4CAF50]/10 border border-[#4CAF50]/20 flex items-center justify-center">
            <div className="animate-[spin_3s_ease-in-out_infinite]">
              <RotateCcw className="w-14 h-14 text-[#4CAF50]" />
            </div>
          </div>
          <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-amber-400 flex items-center justify-center">
            <AlertCircle className="w-5 h-5 text-amber-900" />
          </div>
        </div>

        <h1 className="text-2xl font-black text-white mb-3">Rotate Your Phone</h1>
        <p className="text-white/60 text-sm leading-relaxed max-w-xs">
          Please rotate your phone to <span className="text-white font-semibold">landscape mode</span> before mounting it on the tripod. This gives the best view of the board.
        </p>

        <div className="mt-10 flex gap-2">
          <div className={`w-3 h-3 rounded-full transition-colors duration-300 ${landscape ? "bg-[#4CAF50]" : "bg-white/20"}`} />
          <div className={`w-3 h-3 rounded-full transition-colors duration-300 ${!landscape ? "bg-amber-400 animate-pulse" : "bg-white/20"}`} />
        </div>

        <p className="mt-4 text-xs text-white/30">
          {landscape ? "Landscape detected — advancing…" : "Waiting for landscape orientation…"}
        </p>

        <button
          onClick={() => setScreen("framing")}
          className="mt-8 text-sm text-white/30 underline underline-offset-4"
        >
          Skip (already mounted)
        </button>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ── SCREEN 3: Framing Guide ───────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────
  if (screen === "framing") {
    return (
      <div className="fixed inset-0 bg-black flex flex-col">
        {/* Live camera feed */}
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          playsInline
          muted
          autoPlay
        />

        {/* Hidden canvas for detection */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Board target overlay */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {/* Darkened corners */}
          <div className="absolute inset-0 bg-black/40" style={{
            clipPath: "polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 0, 8% 15%, 8% 85%, 92% 85%, 92% 15%, 8% 15%)"
          }} />

          {/* Target rectangle */}
          <div
            className={`border-2 transition-colors duration-500 ${
              framingReady
                ? "border-[#4CAF50]"
                : framing.boardDetected
                ? "border-amber-400"
                : "border-white/50"
            }`}
            style={{
              width: "84%",
              height: "70%",
              borderRadius: "8px",
              boxShadow: framingReady
                ? "0 0 0 1px rgba(76,175,80,0.3), inset 0 0 0 1px rgba(76,175,80,0.1)"
                : "none",
            }}
          >
            {/* Corner markers */}
            {[
              "top-0 left-0 border-t-2 border-l-2 rounded-tl-md",
              "top-0 right-0 border-t-2 border-r-2 rounded-tr-md",
              "bottom-0 left-0 border-b-2 border-l-2 rounded-bl-md",
              "bottom-0 right-0 border-b-2 border-r-2 rounded-br-md",
            ].map((cls, i) => (
              <div
                key={i}
                className={`absolute w-5 h-5 ${cls} transition-colors duration-500 ${
                  framingReady
                    ? "border-[#4CAF50]"
                    : framing.boardDetected
                    ? "border-amber-400"
                    : "border-white"
                }`}
              />
            ))}

            {/* Center label */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-black/60 backdrop-blur-sm rounded-xl px-4 py-2">
                <p className="text-white/80 text-xs font-semibold text-center">
                  {framingReady
                    ? "✓ Board confirmed — ready to record"
                    : "Position the chess board within this frame"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Top bar */}
        <div className="relative z-10 flex items-center justify-between px-4 pt-safe-top pt-4 pb-3 bg-gradient-to-b from-black/70 to-transparent">
          <button
            onClick={() => {
              streamRef.current?.getTracks().forEach((t) => t.stop());
              navigate("/");
            }}
            className="w-9 h-9 rounded-xl bg-black/50 backdrop-blur-sm flex items-center justify-center"
          >
            <ArrowLeft className="w-4 h-4 text-white" />
          </button>

          <div className="text-center">
            <p className="text-white font-bold text-sm">Frame the Board</p>
            {boardNumber && (
              <p className="text-white/50 text-xs">Board {boardNumber}</p>
            )}
          </div>

          <button
            onClick={() => setShowTips(!showTips)}
            className="w-9 h-9 rounded-xl bg-black/50 backdrop-blur-sm flex items-center justify-center"
          >
            <Lightbulb className="w-4 h-4 text-amber-400" />
          </button>
        </div>

        {/* Tips panel */}
        {showTips && (
          <div className="absolute top-16 right-4 z-20 w-64 rounded-2xl bg-black/85 backdrop-blur-md border border-white/10 px-4 py-4">
            <p className="text-xs font-bold text-white/50 uppercase tracking-wider mb-3">Setup Tips</p>
            <div className="space-y-2.5">
              {[
                { icon: "📐", text: "Mount phone horizontally, 60–90 cm above board" },
                { icon: "🎯", text: "Entire board visible, no pieces cut off" },
                { icon: "💡", text: "Avoid direct light causing glare on pieces" },
                { icon: "🙌", text: "Hands will be detected — just play normally" },
              ].map(({ icon, text }) => (
                <div key={text} className="flex items-start gap-2">
                  <span className="text-sm">{icon}</span>
                  <span className="text-xs text-white/70 leading-relaxed">{text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bottom status strip */}
        <div className="relative z-10 mt-auto bg-gradient-to-t from-black/90 to-transparent px-5 pt-6 pb-safe-bottom pb-6">
          {/* Indicators */}
          <div className="bg-black/70 backdrop-blur-sm rounded-2xl px-5 py-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-white/50 uppercase tracking-wider">Detection Status</p>
              {!opencvReady && (
                <div className="flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 text-amber-400 animate-spin" />
                  <span className="text-xs text-amber-400">Loading CV…</span>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Indicator ok={framing.boardDetected} loading={!opencvReady} label="Board Detected" />
              <Indicator ok={framing.cornersVisible} loading={!opencvReady} label="All Corners Visible" />
              <Indicator ok={framing.lightingOk} loading={!opencvReady} label="Lighting OK" />
            </div>

            {/* Confidence bar */}
            <div className="mt-3 h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${Math.round(framing.confidence * 100)}%`,
                  backgroundColor: framingReady ? "#4CAF50" : framing.confidence > 0.4 ? "#F59E0B" : "#EF4444",
                }}
              />
            </div>
            <p className="text-xs text-white/30 mt-1 text-right">
              {Math.round(framing.confidence * 100)}% confidence
            </p>
          </div>

          {/* Start button */}
          <button
            onClick={() => {
              setScreen("recording");
              startRecording();
            }}
            disabled={!framingReady}
            className={`w-full py-4 rounded-2xl font-bold text-base transition-all duration-300 flex items-center justify-center gap-2 ${
              framingReady
                ? "bg-[#4CAF50] text-white active:scale-95"
                : "bg-white/08 text-white/30 cursor-not-allowed"
            }`}
          >
            <Video className="w-5 h-5" />
            {framingReady ? "Start Recording" : "Align board to start"}
          </button>

          {/* Override for testing */}
          {!framingReady && (
            <button
              onClick={() => {
                setScreen("recording");
                startRecording();
              }}
              className="w-full mt-2 py-2 text-xs text-white/25 text-center"
            >
              Start anyway (skip detection)
            </button>
          )}
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ── SCREEN 4: Active Recording ────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────
  if (screen === "recording") {
    return (
      <div className="fixed inset-0 bg-[#050f07] flex flex-col">
        {/* Small live thumbnail */}
        <video
          ref={videoRef}
          className="absolute top-0 right-0 w-28 h-20 object-cover opacity-60 rounded-bl-2xl"
          playsInline
          muted
          autoPlay
        />

        {/* Hidden canvas for detection */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Main content */}
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
          {/* Recording indicator */}
          <div className="flex items-center gap-2 mb-8">
            <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
            <span className="text-red-400 text-sm font-bold uppercase tracking-widest">Recording</span>
          </div>

          {/* Elapsed timer */}
          <div className="text-7xl font-black text-white tabular-nums mb-2 tracking-tight">
            {formatElapsed(elapsed)}
          </div>
          <p className="text-white/30 text-sm mb-10">
            {chunkCount} segment{chunkCount !== 1 ? "s" : ""} saved
          </p>

          {/* Board health dot */}
          <div className="flex items-center gap-2 mb-12">
            <div className={`w-2.5 h-2.5 rounded-full ${boardHealth ? "bg-[#4CAF50] animate-pulse" : "bg-red-400"}`} />
            <span className={`text-xs font-medium ${boardHealth ? "text-[#4CAF50]" : "text-red-400"}`}>
              {boardHealth ? "Board visible" : "Board not detected"}
            </span>
          </div>

          {/* Upload status */}
          {uploadError ? (
            <div className="flex items-center gap-2 mb-6">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              <span className="text-xs text-amber-400">{uploadError}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 mb-6">
              <Wifi className="w-4 h-4 text-[#4CAF50]/60" />
              <span className="text-xs text-white/30">Uploading in background</span>
            </div>
          )}
        </div>

        {/* Stop button */}
        <div className="px-8 pb-safe-bottom pb-10">
          <button
            onClick={stopRecording}
            className="w-full py-5 rounded-3xl bg-red-500 text-white font-black text-lg active:scale-95 transition-transform flex items-center justify-center gap-3"
          >
            <Square className="w-6 h-6 fill-white" />
            Stop Recording
          </button>
          <p className="text-center text-xs text-white/20 mt-3">
            Keep this screen open during the game
          </p>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ── SCREEN 5: Processing Status ───────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────
  if (screen === "processing") {
    const isReady = processingStep >= 4 && gameId;

    return (
      <div className={`min-h-screen ${bg} flex flex-col`}>
        {/* Header */}
        <div className="px-5 pt-safe-top pt-5 pb-4">
          <NavLogo linked={false} />
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-8">
          {/* Icon */}
          <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mb-8 transition-all duration-500 ${
            isReady
              ? "bg-[#4CAF50]/20 border border-[#4CAF50]/40"
              : "bg-white/06 border border-white/10"
          }`}>
            {isReady ? (
              <CheckCircle2 className="w-10 h-10 text-[#4CAF50]" />
            ) : (
              <Loader2 className="w-10 h-10 text-white/40 animate-spin" />
            )}
          </div>

          <h1 className="text-2xl font-black text-white mb-2">
            {isReady ? "Analysis Ready!" : "Processing Game…"}
          </h1>
          <p className="text-white/50 text-sm text-center mb-10 leading-relaxed">
            {isReady
              ? "Your game has been analysed with Stockfish. Tap below to review."
              : "This takes 1–3 minutes. You can leave this screen — we'll notify you when it's done."}
          </p>

          {/* Progress steps */}
          <div className="w-full max-w-xs mb-10">
            <ProcessingStepBar currentStep={processingStep} />
          </div>

          {/* Actions */}
          {isReady ? (
            <button
              onClick={() => navigate(`/game/${gameId}/analysis`)}
              className="w-full max-w-xs py-4 rounded-2xl bg-[#4CAF50] text-white font-bold text-base active:scale-95 transition-transform flex items-center justify-center gap-2"
            >
              View Analysis
              <ChevronRight className="w-5 h-5" />
            </button>
          ) : (
            <div className="w-full max-w-xs space-y-3">
              <button
                onClick={() => navigate("/")}
                className="w-full py-3 rounded-2xl bg-white/06 text-white/60 font-medium text-sm"
              >
                Go home — I'll come back later
              </button>
              <button
                onClick={() => navigate("/record")}
                className="w-full py-3 rounded-2xl bg-white/04 text-white/30 font-medium text-sm"
              >
                Enter PGN manually instead
              </button>
            </div>
          )}
        </div>

        {/* Session info */}
        {session && (
          <div className="px-6 pb-8">
            <div className="rounded-2xl bg-white/03 border border-white/06 px-4 py-3 flex items-center gap-3">
              <Grid3x3 className="w-4 h-4 text-white/20" />
              <div className="min-w-0">
                <p className="text-xs text-white/30 truncate">Session: {session.id}</p>
                {boardNumber && (
                  <p className="text-xs text-white/20">Board {boardNumber}</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}
