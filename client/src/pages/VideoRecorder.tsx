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
 *                     Phase 3: live CV overlay, move detection pulse, FEN status bar
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
  Zap,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
type Screen = "permission" | "orientation" | "framing" | "corners" | "corners-reselect" | "recording" | "processing";

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

/** A single entry in the client-side FEN timeline sent to the server on finalize */
export interface FenTimelineEntry {
  /** Elapsed milliseconds from recording start when this FEN was detected */
  timestampMs: number;
  /** Full FEN string of the detected position */
  fen: string;
  /** Detection confidence 0–1 */
  confidence: number;
  /** Number of pieces detected in this frame */
  pieceCount: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
export function formatElapsed(ms: number): string {
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

/**
 * Compare two FEN position parts and return true if they differ by at least
 * one piece (i.e., a move was made).
 */
export function fenPositionsAreDifferent(fenA: string | null, fenB: string | null): boolean {
  if (!fenA || !fenB) return false;
  const posA = fenA.split(" ")[0];
  const posB = fenB.split(" ")[0];
  return posA !== posB;
}

/**
 * Count the number of squares that differ between two FEN position strings.
 * Returns 0 if positions are identical, up to 64 for completely different boards.
 */
export function countFenDifferences(fenA: string, fenB: string): number {
  const expandRank = (rank: string): string[] => {
    const squares: string[] = [];
    for (const ch of rank) {
      if (/\d/.test(ch)) {
        squares.push(...Array(parseInt(ch)).fill(""));
      } else {
        squares.push(ch);
      }
    }
    return squares;
  };

  const boardA = fenA.split(" ")[0].split("/").flatMap(expandRank);
  const boardB = fenB.split(" ")[0].split("/").flatMap(expandRank);
  if (boardA.length !== 64 || boardB.length !== 64) return 64;
  return boardA.filter((sq, i) => sq !== boardB[i]).length;
}

/**
 * Determine if a FEN transition looks like a legal single move
 * (2–4 squares changed: normal move = 2, capture = 2, castling = 4, en passant = 3).
 */
export function looksLikeAMove(fenA: string, fenB: string): boolean {
  const diffs = countFenDifferences(fenA, fenB);
  return diffs >= 2 && diffs <= 4;
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

// ── Live CV Status Bar (recording screen) ─────────────────────────────────────
interface LiveCvStatusBarProps {
  moveCount: number;
  pieceCount: number;
  confidence: number;
  boardDetected: boolean;
  movePulse: boolean;
  fenTimelineLength: number;
}

function LiveCvStatusBar({
  moveCount,
  pieceCount,
  confidence,
  boardDetected,
  movePulse,
  fenTimelineLength,
}: LiveCvStatusBarProps) {
  return (
    <div className="rounded-2xl bg-black/70 backdrop-blur-md border border-white/10 px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full transition-all duration-200 ${
            boardDetected ? "bg-[#4CAF50] animate-pulse" : "bg-red-400"
          }`} />
          <span className={`text-xs font-bold uppercase tracking-wider ${
            boardDetected ? "text-[#4CAF50]" : "text-red-400"
          }`}>
            {boardDetected ? "Board Tracking" : "Board Lost"}
          </span>
        </div>

        {/* Move detection pulse badge */}
        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full transition-all duration-300 ${
          movePulse
            ? "bg-[#4CAF50]/30 border border-[#4CAF50]/60"
            : "bg-white/06 border border-white/10"
        }`}>
          <Zap className={`w-3 h-3 transition-colors duration-200 ${movePulse ? "text-[#4CAF50]" : "text-white/30"}`} />
          <span className={`text-xs font-bold tabular-nums transition-colors duration-200 ${
            movePulse ? "text-[#4CAF50]" : "text-white/40"
          }`}>
            {moveCount} move{moveCount !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <p className="text-xs text-white/30 mb-1">Pieces</p>
          <div className="flex items-center gap-1.5">
            <div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-[#4CAF50] transition-all duration-500"
                style={{ width: `${Math.min(100, (pieceCount / 32) * 100)}%` }}
              />
            </div>
            <span className="text-xs font-bold text-white/60 tabular-nums w-8 text-right">
              {pieceCount}/32
            </span>
          </div>
        </div>

        <div className="flex-1">
          <p className="text-xs text-white/30 mb-1">Confidence</p>
          <div className="flex items-center gap-1.5">
            <div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.round(confidence * 100)}%`,
                  backgroundColor: confidence >= 0.75 ? "#4CAF50" : confidence >= 0.5 ? "#F59E0B" : "#EF4444",
                }}
              />
            </div>
            <span className="text-xs font-bold text-white/60 tabular-nums w-8 text-right">
              {Math.round(confidence * 100)}%
            </span>
          </div>
        </div>
      </div>

      {/* FEN timeline count */}
      {fenTimelineLength > 0 && (
        <div className="mt-2 pt-2 border-t border-white/06 flex items-center justify-between">
          <span className="text-xs text-white/25">Positions logged</span>
          <span className="text-xs font-bold text-white/40 tabular-nums">{fenTimelineLength}</span>
        </div>
      )}
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

  // ── Manual corner selection state ─────────────────────────────────────────
  /** User-tapped board corners in video-native pixel coordinates [TL, TR, BR, BL] */
  const [manualCorners, setManualCorners] = useState<Array<{x: number; y: number}>>([]);
  const CORNER_LABELS = ["Top-Left", "Top-Right", "Bottom-Right", "Bottom-Left"] as const;
  const [opencvReady, setOpencvReady] = useState(false);
  const [cvStatus, setCvStatus] = useState<string>("Initialising CV engine…");
  const [detectedCorners, setDetectedCorners] = useState<Array<{x:number;y:number}> | null>(null);
  const [showTips, setShowTips] = useState(false);
  const [liveFen, setLiveFen] = useState<string | null>(null);
  const [pieceCount, setPieceCount] = useState<number>(0);

  // ── Recording state ───────────────────────────────────────────────────────
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [chunkCount, setChunkCount] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [boardHealth, setBoardHealth] = useState(true);

  // ── Phase 3: Live CV feedback state ──────────────────────────────────────
  /** Number of moves detected during this recording */
  const [liveMovesDetected, setLiveMovesDetected] = useState(0);
  /** True for 1.5 seconds after a move is detected — drives the pulse animation */
  const [movePulse, setMovePulse] = useState(false);
  /** Live confidence during recording */
  const [recordingConfidence, setRecordingConfidence] = useState(0);
  /** Live piece count during recording */
  const [recordingPieceCount, setRecordingPieceCount] = useState(0);
  /** Number of FEN timeline entries accumulated so far */
  const [fenTimelineLength, setFenTimelineLength] = useState(0);

  // ── Processing state ─────────────────────────────────────────────────────────────────────────────────────
  const [session, setSession] = useState<RecordingSession | null>(null);
  const [processingStep, setProcessingStep] = useState(0);
  const [gameId, setGameId] = useState<string | null>(null);
  const [cvProgress, setCvProgress] = useState<{
    pct: number;
    framesProcessed: number;
    totalFrames: number;
    jobFound: boolean;
    lastFen: string | null;
    stablePositions: number;
  } | null>(null);
  const [cvJobError, setCvJobError] = useState<{
    failed: boolean;
    errorMessage: string | null;
    attempts: number;
    retriesExhausted: boolean;
  } | null>(null);

  // ── Refs ─────────────────────────────────────────────────────────────────────────────────────
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
  const workerRef = useRef<Worker | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  // Phase 3 refs — not state to avoid re-renders on every frame
  const fenTimelineRef = useRef<FenTimelineEntry[]>([]);
  const lastFenRef = useRef<string | null>(null);
  const movePulseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // ── Spawn CV Web Worker ───────────────────────────────────────────────────
  useEffect(() => {
    if (screen !== "framing") return;
    if (workerRef.current) return; // already spawned

    try {
      const worker = new Worker("/chess-cv-worker.js");
      workerRef.current = worker;

      worker.onmessage = (e) => {
        const msg = e.data as {
          type: string;
          message?: string;
          boardDetected?: boolean;
          cornersVisible?: boolean;
          lightingOk?: boolean;
          confidence?: number;
          corners?: Array<{x:number;y:number}> | null;
          fen?: string | null;
          fallback?: boolean;
        };

        if (msg.type === "status") {
          setCvStatus(msg.message ?? "Loading…");
        } else if (msg.type === "ready") {
          setOpencvReady(true);
          setCvStatus("CV ready");
        } else if (msg.type === "result") {
          const result = msg as {
            type: string;
            boardDetected?: boolean;
            cornersVisible?: boolean;
            lightingOk?: boolean;
            confidence?: number;
            corners?: Array<{x:number;y:number}> | null;
            fen?: string | null;
            fallback?: boolean;
          };
          setFraming({
            boardDetected: result.boardDetected ?? false,
            cornersVisible: result.cornersVisible ?? false,
            lightingOk: result.lightingOk ?? false,
            confidence: result.confidence ?? 0,
          });
          setBoardHealth(result.boardDetected ?? false);
          setDetectedCorners(result.corners ?? null);

          // Update live FEN from piece classification
          if (result.fen) {
            setLiveFen(result.fen);
            // Count pieces from FEN position part
            const pos = result.fen.split(" ")[0];
            const pieces = pos.replace(/[^pnbrqkPNBRQK]/g, "").length;
            setPieceCount(pieces);
          }

          // Draw detected board outline on overlay canvas
          if (result.corners && result.corners.length === 4 && overlayCanvasRef.current) {
            drawBoardOverlay(result.corners, overlayCanvasRef.current);
          } else if (overlayCanvasRef.current) {
            clearOverlay(overlayCanvasRef.current);
          }
        } else if (msg.type === "error") {
          setCvStatus("CV error — using fallback");
          setOpencvReady(true); // proceed with fallback
        }
      };

      worker.onerror = () => {
        setCvStatus("Worker failed — using fallback");
        setOpencvReady(true);
      };

      worker.postMessage({ type: "init" });
    } catch {
      // Web Workers not supported — proceed without CV
      setOpencvReady(true);
      setCvStatus("CV unavailable");
    }

    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, [screen]);

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
    if (screen === "framing" || screen === "corners" || screen === "corners-reselect" || screen === "recording") {
      startCamera();
    }
    return () => {
      if (screen !== "recording" && screen !== "corners" && screen !== "corners-reselect") {
        streamRef.current?.getTracks().forEach((t) => t.stop());
      }
    };
  }, [screen, startCamera]);

  // ── Send frame to CV worker ───────────────────────────────────────────────
  const runDetection = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;
    if (!workerRef.current) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Downsample to 640×360 for performance before sending to worker
    const W = 640;
    const H = Math.round((video.videoHeight / video.videoWidth) * W) || 360;
    canvas.width = W;
    canvas.height = H;
    ctx.drawImage(video, 0, 0, W, H);

    const imageData = ctx.getImageData(0, 0, W, H);

    // Transfer imageData to worker (zero-copy via transferable)
    workerRef.current.postMessage(
      { type: "detect", imageData, width: W, height: H },
      [imageData.data.buffer]
    );
  }, []);

  // ── Overlay drawing helpers ───────────────────────────────────────────────
  function drawBoardOverlay(
    corners: Array<{x: number; y: number}>,
    overlayCanvas: HTMLCanvasElement
  ) {
    const video = videoRef.current;
    if (!video) return;
    overlayCanvas.width = video.clientWidth;
    overlayCanvas.height = video.clientHeight;

    const ctx = overlayCanvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

    // Scale corners from video native resolution to display size
    const scaleX = video.clientWidth / (video.videoWidth || 640);
    const scaleY = video.clientHeight / (video.videoHeight || 480);

    const scaled = corners.map(c => ({ x: c.x * scaleX, y: c.y * scaleY }));

    // Draw filled quad with low opacity
    ctx.beginPath();
    ctx.moveTo(scaled[0].x, scaled[0].y);
    for (let i = 1; i < scaled.length; i++) ctx.lineTo(scaled[i].x, scaled[i].y);
    ctx.closePath();
    ctx.fillStyle = "rgba(76, 175, 80, 0.08)";
    ctx.fill();

    // Draw border
    ctx.strokeStyle = "rgba(76, 175, 80, 0.85)";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Draw corner dots
    scaled.forEach(c => {
      ctx.beginPath();
      ctx.arc(c.x, c.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = "#4CAF50";
      ctx.fill();
    });
  }

  function clearOverlay(overlayCanvas: HTMLCanvasElement) {
    const ctx = overlayCanvas.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
  }

  // ── Start/stop detection loop ─────────────────────────────────────────────
  useEffect(() => {
    if (screen === "framing" && opencvReady) {
      detectionIntervalRef.current = setInterval(runDetection, 200); // 5fps
    }
    return () => {
      if (detectionIntervalRef.current) clearInterval(detectionIntervalRef.current);
    };
  }, [screen, opencvReady, runDetection]);

  // ── Phase 3: Run detection during recording (2fps) + accumulate FEN timeline ──
  useEffect(() => {
    if (screen !== "recording") return;

    // Re-attach worker message handler for recording-screen CV feedback
    if (workerRef.current) {
      workerRef.current.onmessage = (e) => {
        const msg = e.data as {
          type: string;
          boardDetected?: boolean;
          confidence?: number;
          fen?: string | null;
          corners?: Array<{x:number;y:number}> | null;
        };

        if (msg.type !== "result") return;

        const fen = msg.fen ?? null;
        const confidence = msg.confidence ?? 0;
        const boardDetected = msg.boardDetected ?? false;

        setBoardHealth(boardDetected);
        setRecordingConfidence(confidence);

        if (fen) {
          // Count pieces
          const pos = fen.split(" ")[0];
          const pieces = pos.replace(/[^pnbrqkPNBRQK]/g, "").length;
          setRecordingPieceCount(pieces);

          // ── FEN timeline accumulation ─────────────────────────────────
          const now = Date.now() - startTimeRef.current;
          const prevFen = lastFenRef.current;

          // Always log the first FEN, then only log when position changes
          const isFirstEntry = fenTimelineRef.current.length === 0;
          const positionChanged = prevFen ? fenPositionsAreDifferent(prevFen, fen) : false;

          if (isFirstEntry || positionChanged) {
            const entry: FenTimelineEntry = {
              timestampMs: now,
              fen,
              confidence,
              pieceCount: pieces,
            };
            fenTimelineRef.current.push(entry);
            setFenTimelineLength(fenTimelineRef.current.length);

            // ── Move detection pulse ──────────────────────────────────
            if (!isFirstEntry && prevFen && looksLikeAMove(prevFen, fen)) {
              setLiveMovesDetected((c) => c + 1);
              setMovePulse(true);
              if (movePulseTimeoutRef.current) clearTimeout(movePulseTimeoutRef.current);
              movePulseTimeoutRef.current = setTimeout(() => setMovePulse(false), 1500);
            }

            lastFenRef.current = fen;
          }
        }
      };
    }

    detectionIntervalRef.current = setInterval(runDetection, 500); // 2fps during recording
    return () => {
      if (detectionIntervalRef.current) clearInterval(detectionIntervalRef.current);
      if (movePulseTimeoutRef.current) clearTimeout(movePulseTimeoutRef.current);
    };
  }, [screen, runDetection]);

  // ── Terminate worker on unmount ───────────────────────────────────────────
  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

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

    // Reset Phase 3 state
    fenTimelineRef.current = [];
    lastFenRef.current = null;
    setLiveMovesDetected(0);
    setMovePulse(false);
    setFenTimelineLength(0);
    setRecordingConfidence(0);
    setRecordingPieceCount(0);

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

    // Finalize on server — include the FEN timeline for server-side reconstruction seeding
    const sid = sessionIdRef.current;
    const fenTimeline = fenTimelineRef.current;

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
          // Phase 3: send client-detected FEN timeline to seed server reconstruction
          fenTimeline: fenTimeline.length > 0 ? fenTimeline : undefined,
          // Manual board corners (video-native pixel coords) for server-side perspective warping
          boardCorners: manualCorners.length === 4 ? manualCorners : undefined,
        }),
      });
    } catch (err) {
      console.error("[VideoRecorder] Finalize error:", err);
    }

    setScreen("processing");
    setProcessingStep(1); // "Uploading to server"
  }, [elapsed, whitePlayer, blackPlayer, manualCorners]);
  // ── Poll processing status ────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (screen !== "processing" || !sessionIdRef.current) return;

    const STATUS_TO_STEP: Record<string, number> = {
      recording: 0,
      uploading: 1,
      processing: 1, // concatenating chunks — still in the "uploading" visual step
      queued: 2,
      analyzing: 3,
      complete: 4,
      ready: 4,
      failed: 4,
    };

    // Session status poll (every 5s)
    pollIntervalRef.current = setInterval(async () => {
      try {
        const sid = sessionIdRef.current;
        if (!sid) return;
        const res = await fetch(`/api/recordings/${sid}`, {
          credentials: "include",
        });
        if (!res.ok) return;
        const data = await res.json() as {
          session?: { status: string };
          game?: { id: string } | null;
          cvJob?: { status: string; errorMessage: string | null; attempts: number | null } | null;
        };
        const status = data.session?.status ?? "";
        const step = STATUS_TO_STEP[status] ?? 0;
        setProcessingStep(step);

        // Detect CV job failure
        if (data.cvJob && data.cvJob.status === "failed") {
          const attempts = data.cvJob.attempts ?? 1;
          setCvJobError({
            failed: true,
            errorMessage: data.cvJob.errorMessage,
            attempts,
            retriesExhausted: attempts >= 3,
          });
        } else if (data.cvJob && data.cvJob.status !== "failed") {
          // Clear error if a retry is in progress
          setCvJobError(null);
        }

        if (status === "ready" && data.game?.id) {
          setGameId(data.game.id);
          clearInterval(pollIntervalRef.current!);
        }
      } catch {
        // Keep polling
      }
    }, 5000);

    // CV job progress poll (every 2s) — shows real frame percentage
    const cvPollRef = setInterval(async () => {
      try {
        const sid = sessionIdRef.current;
        if (!sid) return;
        const res = await fetch(`/api/recordings/${sid}/cv-job`, {
          credentials: "include",
        });
        if (!res.ok) return;
        const data = await res.json() as {
          jobFound: boolean;
          pct: number;
          framesProcessed: number;
          totalFrames: number;
          status: string;
          lastFen: string | null;
          stablePositions: number;
        };
        setCvProgress({
          pct: data.pct,
          framesProcessed: data.framesProcessed,
          totalFrames: data.totalFrames,
          jobFound: data.jobFound,
          lastFen: data.lastFen ?? null,
          stablePositions: data.stablePositions ?? 0,
        });
        // Stop cv-job polling once the job is done
        if (data.jobFound && (data.status === "complete" || data.status === "failed")) {
          clearInterval(cvPollRef);
        }
      } catch {
        // Best-effort
      }
    }, 2000);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      clearInterval(cvPollRef);
    };
  }, [screen]);

  // ── Permission check ────────────────────────────────────────────────────────────────────────────
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
      if (movePulseTimeoutRef.current) clearTimeout(movePulseTimeoutRef.current);
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

        {/* Hidden canvas for frame capture */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Overlay canvas — draws detected board quadrilateral */}
        <canvas
          ref={overlayCanvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ zIndex: 5 }}
        />

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
                  <span className="text-xs text-amber-400">{cvStatus}</span>
                </div>
              )}
              {opencvReady && detectedCorners && (
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-[#4CAF50] animate-pulse" />
                  <span className="text-xs text-[#4CAF50]">ONNX active</span>
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

            {/* Live piece classification status */}
            {liveFen && framing.boardDetected && (
              <div className="mt-3 pt-3 border-t border-white/08">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-white/40">Pieces detected</p>
                  <div className="flex items-center gap-1.5">
                    <Grid3x3 className="w-3 h-3 text-[#4CAF50]" />
                    <span className="text-xs font-bold text-[#4CAF50]">{pieceCount} / 32</span>
                  </div>
                </div>
                <p className="text-xs text-white/25 mt-1 font-mono truncate">{liveFen.split(" ")[0]}</p>
              </div>
            )}
          </div>

          {/* Select Board Corners button — always available */}
          <button
            onClick={() => {
              setManualCorners([]);
              setScreen("corners");
            }}
            className="w-full py-4 rounded-2xl bg-[#4CAF50] text-white font-bold text-base active:scale-95 transition-transform flex items-center justify-center gap-2"
          >
            <Grid3x3 className="w-5 h-5" />
            Select Board Corners
          </button>

          <p className="text-center text-xs text-white/30 mt-2">
            Tap the 4 corners of the chess board to begin
          </p>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ── SCREEN 3.5: Manual Corner Selection ───────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────
  if (screen === "corners") {
    const cornersComplete = manualCorners.length === 4;
    const nextCornerLabel = cornersComplete ? "Done" : CORNER_LABELS[manualCorners.length];

    const handleCornerTap = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
      if (cornersComplete) return;
      const video = videoRef.current;
      if (!video) return;

      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      let clientX: number, clientY: number;

      if ("touches" in e) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }

      // Convert tap position from display coordinates to video-native pixel coordinates
      const displayX = clientX - rect.left;
      const displayY = clientY - rect.top;
      const scaleX = (video.videoWidth || 1920) / rect.width;
      const scaleY = (video.videoHeight || 1080) / rect.height;
      const videoX = Math.round(displayX * scaleX);
      const videoY = Math.round(displayY * scaleY);

      setManualCorners((prev) => [...prev, { x: videoX, y: videoY }]);
    };

    return (
      <div className="fixed inset-0 bg-black flex flex-col">
        {/* Live camera feed with tap handler */}
        <div
          className="relative flex-1"
          onClick={handleCornerTap}
          onTouchStart={(e) => {
            if (!cornersComplete) {
              e.preventDefault();
              handleCornerTap(e);
            }
          }}
        >
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover"
            playsInline
            muted
            autoPlay
          />

          {/* Hidden canvas for frame capture */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Draw placed corners as dots + lines */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 10 }}>
            {manualCorners.map((corner, i) => {
              const video = videoRef.current;
              if (!video) return null;
              const rect = video.getBoundingClientRect();
              const displayX = (corner.x / (video.videoWidth || 1920)) * rect.width;
              const displayY = (corner.y / (video.videoHeight || 1080)) * rect.height;

              return (
                <g key={i}>
                  {/* Connecting line to previous corner */}
                  {i > 0 && (() => {
                    const prev = manualCorners[i - 1];
                    const prevX = (prev.x / (video.videoWidth || 1920)) * rect.width;
                    const prevY = (prev.y / (video.videoHeight || 1080)) * rect.height;
                    return (
                      <line
                        x1={prevX} y1={prevY} x2={displayX} y2={displayY}
                        stroke="#4CAF50" strokeWidth="2" strokeDasharray="6,4" opacity="0.8"
                      />
                    );
                  })()}
                  {/* Close the quadrilateral when 4 corners are placed */}
                  {i === 3 && (() => {
                    const first = manualCorners[0];
                    const firstX = (first.x / (video.videoWidth || 1920)) * rect.width;
                    const firstY = (first.y / (video.videoHeight || 1080)) * rect.height;
                    return (
                      <line
                        x1={displayX} y1={displayY} x2={firstX} y2={firstY}
                        stroke="#4CAF50" strokeWidth="2" strokeDasharray="6,4" opacity="0.8"
                      />
                    );
                  })()}
                  {/* Corner dot */}
                  <circle cx={displayX} cy={displayY} r="10" fill="#4CAF50" opacity="0.9" />
                  <circle cx={displayX} cy={displayY} r="4" fill="white" />
                  {/* Label */}
                  <text
                    x={displayX} y={displayY - 16}
                    textAnchor="middle" fill="white" fontSize="11" fontWeight="bold"
                    style={{ textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}
                  >
                    {CORNER_LABELS[i]}
                  </text>
                </g>
              );
            })}

            {/* Semi-transparent fill when all 4 corners placed */}
            {cornersComplete && (() => {
              const video = videoRef.current;
              if (!video) return null;
              const rect = video.getBoundingClientRect();
              const points = manualCorners.map(c => {
                const dx = (c.x / (video.videoWidth || 1920)) * rect.width;
                const dy = (c.y / (video.videoHeight || 1080)) * rect.height;
                return `${dx},${dy}`;
              }).join(" ");
              return <polygon points={points} fill="rgba(76,175,80,0.12)" stroke="#4CAF50" strokeWidth="2.5" />;
            })()}
          </svg>

          {/* Instruction overlay */}
          {!cornersComplete && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
              <div className="bg-black/75 backdrop-blur-md rounded-2xl px-5 py-3 border border-white/10">
                <p className="text-white text-sm font-bold text-center">
                  Tap the <span className="text-[#4CAF50]">{nextCornerLabel}</span> corner of the board
                </p>
                <p className="text-white/40 text-xs text-center mt-1">
                  Corner {manualCorners.length + 1} of 4
                </p>
              </div>
            </div>
          )}

          {cornersComplete && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
              <div className="bg-[#4CAF50]/20 backdrop-blur-md rounded-2xl px-5 py-3 border border-[#4CAF50]/40">
                <p className="text-[#4CAF50] text-sm font-bold text-center">
                  Board corners confirmed
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Bottom controls */}
        <div className="relative z-20 bg-gradient-to-t from-black/95 to-black/60 px-5 pt-4 pb-safe-bottom pb-6">
          <div className="flex items-center gap-3 mb-4">
            {/* Corner progress dots */}
            <div className="flex gap-2">
              {CORNER_LABELS.map((label, i) => (
                <div
                  key={label}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                    i < manualCorners.length
                      ? "bg-[#4CAF50] text-white"
                      : i === manualCorners.length
                      ? "bg-[#4CAF50]/20 border-2 border-[#4CAF50] text-[#4CAF50]"
                      : "bg-white/08 text-white/30 border border-white/15"
                  }`}
                >
                  {i < manualCorners.length ? "\u2713" : i + 1}
                </div>
              ))}
            </div>

            {/* Undo button */}
            {manualCorners.length > 0 && (
              <button
                onClick={() => setManualCorners((prev) => prev.slice(0, -1))}
                className="ml-auto px-3 py-1.5 rounded-lg bg-white/08 text-white/60 text-xs font-medium active:scale-95 transition-transform"
              >
                Undo
              </button>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => {
                setManualCorners([]);
                setScreen("framing");
              }}
              className="flex-1 py-4 rounded-2xl bg-white/08 text-white/60 font-bold text-base active:scale-95 transition-transform"
            >
              Back
            </button>

            <button
              onClick={() => {
                setScreen("recording");
                startRecording();
              }}
              disabled={!cornersComplete}
              className={`flex-[2] py-4 rounded-2xl font-bold text-base transition-all duration-300 flex items-center justify-center gap-2 ${
                cornersComplete
                  ? "bg-[#4CAF50] text-white active:scale-95"
                  : "bg-white/08 text-white/30 cursor-not-allowed"
              }`}
            >
              <Video className="w-5 h-5" />
              {cornersComplete ? "Start Recording" : `Select ${4 - manualCorners.length} more corner${4 - manualCorners.length !== 1 ? "s" : ""}`}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ── SCREEN 3.6: Re-select Corners (during recording) ─────────────────────
  // ─────────────────────────────────────────────────────────────────────────
  if (screen === "corners-reselect") {
    const cornersComplete = manualCorners.length === 4;
    const nextCornerLabel = cornersComplete ? "Done" : CORNER_LABELS[manualCorners.length];

    const handleCornerTap = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
      if (cornersComplete) return;
      const video = videoRef.current;
      if (!video) return;

      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      let clientX: number, clientY: number;

      if ("touches" in e) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }

      const displayX = clientX - rect.left;
      const displayY = clientY - rect.top;
      const scaleX = (video.videoWidth || 1920) / rect.width;
      const scaleY = (video.videoHeight || 1080) / rect.height;
      const videoX = Math.round(displayX * scaleX);
      const videoY = Math.round(displayY * scaleY);

      setManualCorners((prev) => [...prev, { x: videoX, y: videoY }]);
    };

    return (
      <div className="fixed inset-0 bg-black flex flex-col">
        {/* Recording indicator banner */}
        <div className="absolute top-0 left-0 right-0 z-30 bg-red-500/90 backdrop-blur-sm px-4 py-2 flex items-center justify-center gap-2">
          <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
          <span className="text-white text-xs font-bold uppercase tracking-wider">Recording in progress — {formatElapsed(elapsed)}</span>
        </div>

        {/* Live camera feed with tap handler */}
        <div
          className="relative flex-1 mt-8"
          onClick={handleCornerTap}
          onTouchStart={(e) => {
            if (!cornersComplete) {
              e.preventDefault();
              handleCornerTap(e);
            }
          }}
        >
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover"
            playsInline
            muted
            autoPlay
          />

          <canvas ref={canvasRef} className="hidden" />

          {/* Draw placed corners as dots + lines */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 10 }}>
            {manualCorners.map((corner, i) => {
              const video = videoRef.current;
              if (!video) return null;
              const rect = video.getBoundingClientRect();
              const displayX = (corner.x / (video.videoWidth || 1920)) * rect.width;
              const displayY = (corner.y / (video.videoHeight || 1080)) * rect.height;

              return (
                <g key={i}>
                  {i > 0 && (() => {
                    const prev = manualCorners[i - 1];
                    const prevX = (prev.x / (video.videoWidth || 1920)) * rect.width;
                    const prevY = (prev.y / (video.videoHeight || 1080)) * rect.height;
                    return (
                      <line
                        x1={prevX} y1={prevY} x2={displayX} y2={displayY}
                        stroke="#4CAF50" strokeWidth="2" strokeDasharray="6,4" opacity="0.8"
                      />
                    );
                  })()}
                  {i === 3 && (() => {
                    const first = manualCorners[0];
                    const firstX = (first.x / (video.videoWidth || 1920)) * rect.width;
                    const firstY = (first.y / (video.videoHeight || 1080)) * rect.height;
                    return (
                      <line
                        x1={displayX} y1={displayY} x2={firstX} y2={firstY}
                        stroke="#4CAF50" strokeWidth="2" strokeDasharray="6,4" opacity="0.8"
                      />
                    );
                  })()}
                  <circle cx={displayX} cy={displayY} r="10" fill="#4CAF50" opacity="0.9" />
                  <circle cx={displayX} cy={displayY} r="4" fill="white" />
                  <text
                    x={displayX} y={displayY - 16}
                    textAnchor="middle" fill="white" fontSize="11" fontWeight="bold"
                    style={{ textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}
                  >
                    {CORNER_LABELS[i]}
                  </text>
                </g>
              );
            })}

            {cornersComplete && (() => {
              const video = videoRef.current;
              if (!video) return null;
              const rect = video.getBoundingClientRect();
              const points = manualCorners.map(c => {
                const dx = (c.x / (video.videoWidth || 1920)) * rect.width;
                const dy = (c.y / (video.videoHeight || 1080)) * rect.height;
                return `${dx},${dy}`;
              }).join(" ");
              return <polygon points={points} fill="rgba(76,175,80,0.12)" stroke="#4CAF50" strokeWidth="2.5" />;
            })()}
          </svg>

          {/* Instruction overlay */}
          {!cornersComplete && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
              <div className="bg-black/75 backdrop-blur-md rounded-2xl px-5 py-3 border border-white/10">
                <p className="text-white text-sm font-bold text-center">
                  Tap the <span className="text-[#4CAF50]">{nextCornerLabel}</span> corner of the board
                </p>
                <p className="text-white/40 text-xs text-center mt-1">
                  Corner {manualCorners.length + 1} of 4
                </p>
              </div>
            </div>
          )}

          {cornersComplete && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
              <div className="bg-[#4CAF50]/20 backdrop-blur-md rounded-2xl px-5 py-3 border border-[#4CAF50]/40">
                <p className="text-[#4CAF50] text-sm font-bold text-center">
                  New corners confirmed
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Bottom controls */}
        <div className="relative z-20 bg-gradient-to-t from-black/95 to-black/60 px-5 pt-4 pb-safe-bottom pb-6">
          <div className="flex items-center gap-3 mb-4">
            {/* Corner progress dots */}
            <div className="flex gap-2">
              {CORNER_LABELS.map((label, i) => (
                <div
                  key={label}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                    i < manualCorners.length
                      ? "bg-[#4CAF50] text-white"
                      : i === manualCorners.length
                      ? "bg-[#4CAF50]/20 border-2 border-[#4CAF50] text-[#4CAF50]"
                      : "bg-white/08 text-white/30 border border-white/15"
                  }`}
                >
                  {i < manualCorners.length ? "\u2713" : i + 1}
                </div>
              ))}
            </div>

            {/* Undo button */}
            {manualCorners.length > 0 && (
              <button
                onClick={() => setManualCorners((prev) => prev.slice(0, -1))}
                className="ml-auto px-3 py-1.5 rounded-lg bg-white/08 text-white/60 text-xs font-medium active:scale-95 transition-transform"
              >
                Undo
              </button>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => {
                // Cancel — restore previous corners and return to recording
                setManualCorners([]);
                setScreen("recording");
              }}
              className="flex-1 py-4 rounded-2xl bg-white/08 text-white/60 font-bold text-base active:scale-95 transition-transform"
            >
              Cancel
            </button>

            <button
              onClick={() => {
                // Confirm new corners and return to recording
                setScreen("recording");
              }}
              disabled={!cornersComplete}
              className={`flex-[2] py-4 rounded-2xl font-bold text-base transition-all duration-300 flex items-center justify-center gap-2 ${
                cornersComplete
                  ? "bg-[#4CAF50] text-white active:scale-95"
                  : "bg-white/08 text-white/30 cursor-not-allowed"
              }`}
            >
              <CheckCircle2 className="w-5 h-5" />
              {cornersComplete ? "Confirm & Resume" : `Select ${4 - manualCorners.length} more corner${4 - manualCorners.length !== 1 ? "s" : ""}`}
            </button>
          </div>
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
        {/* Small live thumbnail — top-right corner, with corner overlay */}
        <div className="absolute top-0 right-0 w-28 h-20 rounded-bl-2xl overflow-hidden">
          <video
            ref={videoRef}
            className="w-full h-full object-cover opacity-60"
            playsInline
            muted
            autoPlay
          />
          {/* Corner selection overlay — green quadrilateral */}
          {manualCorners.length === 4 && videoRef.current && (() => {
            const nativeW = videoRef.current.videoWidth || 1920;
            const nativeH = videoRef.current.videoHeight || 1080;
            // Thumbnail display size (w-28 h-20 = 112×80px)
            const dispW = 112;
            const dispH = 80;
            const scaled = manualCorners.map(c => ({
              x: (c.x / nativeW) * dispW,
              y: (c.y / nativeH) * dispH,
            }));
            const points = scaled.map(p => `${p.x},${p.y}`).join(' ');
            return (
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none"
                viewBox={`0 0 ${dispW} ${dispH}`}
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* Board quadrilateral fill */}
                <polygon
                  points={points}
                  fill="rgba(76,175,80,0.15)"
                  stroke="#4CAF50"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                  className="animate-pulse"
                />
                {/* Corner dots */}
                {scaled.map((p, i) => (
                  <circle
                    key={i}
                    cx={p.x}
                    cy={p.y}
                    r="2.5"
                    fill="#4CAF50"
                    stroke="white"
                    strokeWidth="0.8"
                  />
                ))}
              </svg>
            );
          })()}
        </div>

        {/* Hidden canvas for detection */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Main content */}
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
          {/* Recording indicator */}
          <div className="flex items-center gap-2 mb-6">
            <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
            <span className="text-red-400 text-sm font-bold uppercase tracking-widest">Recording</span>
          </div>

          {/* Elapsed timer */}
          <div className="text-7xl font-black text-white tabular-nums mb-2 tracking-tight">
            {formatElapsed(elapsed)}
          </div>
          <p className="text-white/30 text-sm mb-6">
            {chunkCount} segment{chunkCount !== 1 ? "s" : ""} saved
          </p>

          {/* ── Phase 3: Move detection pulse ─────────────────────────── */}
          <div className={`relative mb-6 px-6 py-3 rounded-2xl transition-all duration-300 ${
            movePulse
              ? "bg-[#4CAF50]/20 border border-[#4CAF50]/50 scale-105"
              : "bg-white/04 border border-white/08 scale-100"
          }`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${
                movePulse ? "bg-[#4CAF50]/30" : "bg-white/06"
              }`}>
                <Zap className={`w-5 h-5 transition-colors duration-200 ${movePulse ? "text-[#4CAF50]" : "text-white/30"}`} />
              </div>
              <div className="text-left">
                <p className={`text-2xl font-black tabular-nums transition-colors duration-200 ${
                  movePulse ? "text-[#4CAF50]" : "text-white"
                }`}>
                  {liveMovesDetected}
                </p>
                <p className="text-xs text-white/40">
                  {liveMovesDetected === 1 ? "move detected" : "moves detected"}
                </p>
              </div>
            </div>

            {/* Ripple animation on move detection */}
            {movePulse && (
              <div className="absolute inset-0 rounded-2xl border-2 border-[#4CAF50]/40 animate-ping pointer-events-none" />
            )}
          </div>

          {/* Upload status */}
          {uploadError ? (
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              <span className="text-xs text-amber-400">{uploadError}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 mb-4">
              <Wifi className="w-4 h-4 text-[#4CAF50]/60" />
              <span className="text-xs text-white/30">Uploading in background</span>
            </div>
          )}
        </div>

        {/* ── Phase 3: Live CV Status Bar ──────────────────────────────── */}
        <div className="px-6 mb-4">
          <LiveCvStatusBar
            moveCount={liveMovesDetected}
            pieceCount={recordingPieceCount}
            confidence={recordingConfidence}
            boardDetected={boardHealth}
            movePulse={movePulse}
            fenTimelineLength={fenTimelineLength}
          />
        </div>

        {/* Bottom buttons */}
        <div className="px-8 pb-safe-bottom pb-10 space-y-3">
          {/* Re-select Corners button */}
          <button
            onClick={() => {
              setManualCorners([]);
              setScreen("corners-reselect");
            }}
            className="w-full py-3 rounded-2xl bg-white/08 border border-white/10 text-white/60 font-semibold text-sm active:scale-95 transition-transform flex items-center justify-center gap-2"
          >
            <Grid3x3 className="w-4 h-4" />
            Re-select Board Corners
          </button>

          {/* Stop button */}
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
    const isFailed = cvJobError?.failed && cvJobError.retriesExhausted;

    // Determine icon, title, and subtitle based on state
    let icon: React.ReactNode;
    let title: string;
    let subtitle: string;

    if (isReady) {
      icon = <CheckCircle2 className="w-10 h-10 text-[#4CAF50]" />;
      title = "Analysis Ready!";
      subtitle = "Your game has been analysed with Stockfish. Tap below to review.";
    } else if (isFailed) {
      icon = <XCircle className="w-10 h-10 text-red-400" />;
      title = "Analysis Failed";
      subtitle = "The automatic board detection couldn't reconstruct this game. You can enter the PGN manually instead.";
    } else {
      icon = <Loader2 className="w-10 h-10 text-white/40 animate-spin" />;
      title = "Processing Game\u2026";
      subtitle = "This takes 1\u20133 minutes. You can leave this screen \u2014 we'll notify you when it's done.";
    }

    const iconBg = isReady
      ? "bg-[#4CAF50]/20 border border-[#4CAF50]/40"
      : isFailed
        ? "bg-red-500/15 border border-red-500/30"
        : "bg-white/06 border border-white/10";

    return (
      <div className={`min-h-screen ${bg} flex flex-col`}>
        {/* Header */}
        <div className="px-5 pt-safe-top pt-5 pb-4">
          <NavLogo linked={false} />
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-8">
          {/* Icon */}
          <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mb-8 transition-all duration-500 ${iconBg}`}>
            {icon}
          </div>

          <h1 className="text-2xl font-black text-white mb-2">{title}</h1>
          <p className="text-white/50 text-sm text-center mb-10 leading-relaxed">{subtitle}</p>

          {/* Progress steps — hidden when failed */}
          {!isFailed && (
            <div className="w-full max-w-xs mb-6">
              <ProcessingStepBar currentStep={processingStep} />
            </div>
          )}

          {/* CV frame analysis progress — shown only while actively processing */}
          {cvProgress && cvProgress.jobFound && !isReady && !isFailed && (
            <div className="w-full max-w-xs mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-white/50 font-medium">Board analysis</span>
                <span className="text-xs text-[#4CAF50] font-mono font-bold">
                  {cvProgress.pct}%
                  {cvProgress.totalFrames > 0 && (
                    <span className="text-white/30 font-normal ml-1">
                      ({cvProgress.framesProcessed}/{cvProgress.totalFrames} frames)
                    </span>
                  )}
                </span>
              </div>
              <div className="w-full h-1.5 bg-white/08 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#4CAF50] rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${cvProgress.pct}%` }}
                />
              </div>
              {/* Stable positions counter */}
              {cvProgress.stablePositions > 0 && (
                <p className="text-xs text-white/30 mt-2 text-center">
                  {cvProgress.stablePositions} position{cvProgress.stablePositions !== 1 ? 's' : ''} detected
                </p>
              )}
            </div>
          )}

          {/* Live FEN board preview — shown when a position has been detected */}
          {cvProgress && cvProgress.jobFound && !isReady && !isFailed && cvProgress.lastFen && (
            <div className="w-full max-w-xs mb-8">
              <p className="text-xs text-white/30 text-center mb-3">Last detected position</p>
              <div className="rounded-2xl overflow-hidden border border-white/08 shadow-xl">
                <img
                  src={`https://fen2image.chessvision.ai/${encodeURIComponent(cvProgress.lastFen.split(' ')[0])}.png?size=240`}
                  alt="Last detected board position"
                  className="w-full aspect-square object-cover"
                  loading="lazy"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              </div>
            </div>
          )}

          {/* Failure error detail card */}
          {isFailed && cvJobError.errorMessage && (
            <div className="w-full max-w-xs mb-8 rounded-2xl bg-red-500/08 border border-red-500/20 px-5 py-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-red-300 mb-1">Error details</p>
                  <p className="text-xs text-white/40 leading-relaxed">{cvJobError.errorMessage}</p>
                  <p className="text-xs text-white/25 mt-2">Attempts: {cvJobError.attempts}/3</p>
                </div>
              </div>
            </div>
          )}

          {/* Non-exhausted failure — retrying indicator */}
          {cvJobError?.failed && !cvJobError.retriesExhausted && (
            <div className="w-full max-w-xs mb-6 rounded-2xl bg-amber-500/08 border border-amber-500/20 px-5 py-3">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-amber-300">Attempt {cvJobError.attempts}/3 failed — retrying automatically</p>
                  {cvJobError.errorMessage && (
                    <p className="text-xs text-white/30 mt-1">{cvJobError.errorMessage}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          {isReady ? (
            <button
              onClick={() => navigate(`/game/${gameId}/analysis`)}
              className="w-full max-w-xs py-4 rounded-2xl bg-[#4CAF50] text-white font-bold text-base active:scale-95 transition-transform flex items-center justify-center gap-2"
            >
              View Analysis
              <ChevronRight className="w-5 h-5" />
            </button>
          ) : isFailed ? (
            <div className="w-full max-w-xs space-y-3">
              <button
                onClick={() => {
                  // Navigate to /record with sessionId so PGN entry can link to the existing session
                  const sid = sessionIdRef.current;
                  navigate(sid ? `/record?sessionId=${sid}` : "/record");
                }}
                className="w-full py-4 rounded-2xl bg-white/10 text-white font-bold text-base active:scale-95 transition-transform flex items-center justify-center gap-2"
              >
                Enter PGN Manually
                <ChevronRight className="w-5 h-5" />
              </button>
              <button
                onClick={() => navigate("/")}
                className="w-full py-3 rounded-2xl bg-white/04 text-white/40 font-medium text-sm"
              >
                Go home
              </button>
            </div>
          ) : (
            <div className="w-full max-w-xs space-y-3">
              <button
                onClick={() => navigate("/")}
                className="w-full py-3 rounded-2xl bg-white/06 text-white/60 font-medium text-sm"
              >
                Go home — I'll come back later
              </button>
              <button
                onClick={() => {
                  const sid = sessionIdRef.current;
                  navigate(sid ? `/record?sessionId=${sid}` : "/record");
                }}
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
