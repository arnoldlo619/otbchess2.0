/**
 * ChessnutBoardPanel
 * ==================
 * Simplified operator UI for the Chessnut Pro Chrome Bluetooth board engine.
 *
 * UX flow (zero manual steps):
 *  1. Place pieces in starting position
 *  2. Click "Connect Board"
 *  3. Board calibrates automatically → tracking starts automatically
 *  4. Play — every move is registered instantly
 *
 * Advanced controls (calibration, piece recognition, logs) are hidden
 * behind a single "Advanced" toggle for power users.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import {
  Bluetooth,
  BluetoothOff,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  XCircle,
  Circle,
  ArrowLeftRight,
  ChevronDown,
  ChevronUp,
  Activity,
  Zap,
  RotateCcw,
  Target,
  Eye,
  FlaskConical,
  Play,
  Pause,
  Grid3x3,
} from "lucide-react";
import {
  ChessnutWebBluetoothAdapter,
  type AdapterState,
} from "@/lib/ChessnutWebBluetoothAdapter";
import {
  ChessnutBoardEngine,
  type EngineState,
  type InferredLegalMove,
  type MismatchInfo,
  type EngineLog,
} from "@/lib/chessnut/ChessnutBoardEngine";
import type { CalibrationProfile } from "@/lib/chessnut/chessnutPieceMap";
import { PIECE_TO_FEN, FEN_TO_PIECE, STARTING_POSITION_MAP } from "@/lib/chessnut/chessnutPieceMap";

// ─── Props ────────────────────────────────────────────────────────────────────
interface ChessnutBoardPanelProps {
  broadcastId: string;
  currentFen: string;
  onMoveAccepted: (san: string, uci: string, fenBefore: string, fenAfter: string) => void;
  onSwitchToManual: () => void;
  isDark?: boolean;
}

// ─── Step type for the inline progress strip ─────────────────────────────────
type SetupStep = "connect" | "reconnecting" | "calibrate" | "tracking" | "ready";

function deriveStep(
  adapterState: AdapterState | null,
  engineState: EngineState | null
): SetupStep {
  if (adapterState?.status === "reconnecting" || adapterState?.status === "connecting") {
    // If we were previously connected (reconnecting), show "reconnecting" step
    if (adapterState.reconnectAttempt > 0) return "reconnecting";
  }
  const connected = adapterState
    ? ["connected", "discovering_services", "listening", "receiving",
       "move_accepted", "mismatch", "needs_review", "diagnostic"].includes(adapterState.status)
    : false;
  if (!connected) return "connect";
  if (!engineState?.isCalibrated) return "calibrate";
  if (!engineState?.trackingEnabled) return "tracking";
  return "ready";
}

// ─── Component ────────────────────────────────────────────────────────────────
export function ChessnutBoardPanel({
  broadcastId,
  currentFen,
  onMoveAccepted,
  onSwitchToManual,
  isDark = true,
}: ChessnutBoardPanelProps) {
  const adapterRef = useRef<ChessnutWebBluetoothAdapter | null>(null);
  const engineRef = useRef<ChessnutBoardEngine | null>(null);

  const [adapterState, setAdapterState] = useState<AdapterState | null>(null);
  const [engineState, setEngineState] = useState<EngineState | null>(null);
  const [pendingMove, setPendingMove] = useState<InferredLegalMove | null>(null);
  const [mismatchInfo, setMismatchInfo] = useState<MismatchInfo | null>(null);
  const [recentLogs, setRecentLogs] = useState<EngineLog[]>([]);
  const [debounceMs, setDebounceMs] = useState(500);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [calibrationMsg, setCalibrationMsg] = useState("");
  const [calibrationStatus, setCalibrationStatus] = useState<"idle" | "waiting" | "success" | "failed">("idle");

  // ─── Init adapter + engine ───────────────────────────────────────────────
  const initEngine = useCallback(() => {
    const adapter = new ChessnutWebBluetoothAdapter(broadcastId, "", false);
    const engine = new ChessnutBoardEngine({
      broadcastId,
      serverUrl: "",
      debounceMs,
      onMove: (move) => {
        if (move.confidence === "ambiguous") {
          setPendingMove(move);
        } else if (move.confidence === "exact") {
          onMoveAccepted(move.san, move.uci, move.fenBefore, move.fenAfter);
        }
      },
      onMismatch: (info) => setMismatchInfo(info),
      onStatusChange: (state) => {
        setEngineState(state);
        setRecentLogs(state.logs.slice(0, 30));
      },
      onStartingPositionRecognized: () => {
        setCalibrationStatus("success");
        setCalibrationMsg("Starting position recognized — board calibrated!");
      },
      onCalibrationComplete: () => {
        setCalibrationStatus("success");
      },
    });

    adapter.onStatusChange((state) => {
      setAdapterState(state);
      engine.setBluetoothConnected(
        ["connected", "discovering_services", "listening", "receiving",
         "move_accepted", "mismatch", "needs_review", "diagnostic"].includes(state.status)
      );
    });
    adapter.onError((msg) => setErrorMsg(msg));

    // Wire raw BLE DataView notifications directly into the engine.
    adapter.onRawBoardData((dv: DataView) => {
      engine.processBlePayload(dv);
    });

    adapterRef.current = adapter;
    engineRef.current = engine;
    engine.setCurrentFen(currentFen);
    setAdapterState(adapter.getStatus());
    setEngineState(engine.getState());
  }, [broadcastId, currentFen, debounceMs, onMoveAccepted]);

  useEffect(() => {
    initEngine();
    return () => {
      adapterRef.current?.disconnect();
    };
  }, [initEngine]);

  // Keep engine FEN in sync
  useEffect(() => {
    engineRef.current?.setCurrentFen(currentFen);
  }, [currentFen]);

  // ─── Handlers ────────────────────────────────────────────────────────────
  const handleConnect = async () => {
    setErrorMsg(null);
    setCalibrationStatus("waiting");
    setCalibrationMsg("Place all pieces in starting position, then connect...");
    await adapterRef.current?.connect();
  };

  const handleDisconnect = () => {
    adapterRef.current?.disconnect();
    engineRef.current?.setBluetoothConnected(false);
  };

  const handleRunCalibration = async () => {
    if (!adapterRef.current) return;
    setCalibrationStatus("waiting");
    setCalibrationMsg("Reading board state...");
    const state = await adapterRef.current.readBoardState();
    if (!state) {
      setCalibrationStatus("failed");
      setCalibrationMsg("Could not read board state. Is the board connected and powered on?");
      return;
    }
    setCalibrationStatus("success");
    setCalibrationMsg("Board calibrated from starting position.");
  };

  const handleResetBoard = () => {
    engineRef.current?.resetBoardState();
    setMismatchInfo(null);
    setPendingMove(null);
  };

  const handleSwitchToManual = () => {
    engineRef.current?.switchToManualMode();
    onSwitchToManual();
  };

  // ─── Derived state ────────────────────────────────────────────────────────
  const isConnected = adapterState
    ? ["connected", "discovering_services", "listening", "receiving",
       "move_accepted", "mismatch", "needs_review", "diagnostic"].includes(adapterState.status)
    : false;
  const isReconnecting = adapterState?.status === "reconnecting";
  const isBusy = adapterState
    ? ["picker_opened", "connecting", "discovering_services", "reconnecting"].includes(adapterState.status)
    : false;
  const isUnsupported = adapterState?.status === "unsupported";
  const step = deriveStep(adapterState, engineState);
  const isTracking = engineState?.trackingEnabled ?? false;

  // ─── Theme ────────────────────────────────────────────────────────────────
  const bg = isDark ? "bg-[oklch(0.18_0.05_145)] border-white/10" : "bg-[#FBFADA]/70 border-[#ADBC9F]";
  const textPrimary = isDark ? "text-white" : "text-[#12372A]";
  const textMuted = isDark ? "text-white/50" : "text-[#436850]";
  const borderMuted = isDark ? "border-white/08" : "border-[#ADBC9F]";
  const bgMuted = isDark ? "bg-white/04" : "bg-[#ADBC9F]/40";

  return (
    <div className={`rounded-xl border overflow-hidden ${bg}`}>

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/08">
        <div className="flex items-center gap-2">
          <Bluetooth className={`w-4 h-4 ${isDark ? "text-blue-400" : "text-blue-600"}`} />
          <span className={`text-sm font-bold ${textPrimary}`}>Chessnut Pro</span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full border bg-amber-500/10 text-amber-400 border-amber-500/20">BETA</span>
        </div>
        <div className="flex items-center gap-2">
          {isTracking && (
            <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 animate-pulse">
              <Activity className="w-2.5 h-2.5" />
              TRACKING
            </span>
          )}
          <span className={`w-2 h-2 rounded-full ${
            isConnected ? "bg-emerald-400" : isReconnecting ? "bg-amber-400 animate-pulse" : isBusy ? "bg-blue-400 animate-pulse" : "bg-white/20"
          }`} />
        </div>
      </div>

      {/* ── Unsupported browser ── */}
      {isUnsupported && (
        <div className="px-4 py-3 bg-red-500/10 border-b border-red-500/20 flex items-start gap-2 text-xs text-red-400">
          <XCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold">Chrome Web Bluetooth not available.</p>
            <p className="opacity-80 mt-0.5">Use Chrome or Edge on desktop, or switch to Manual Mode.</p>
          </div>
        </div>
      )}

      {/* ── Error ── */}
      {errorMsg && (
        <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/20 flex items-start gap-2 text-xs text-red-400">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ── Pending move review ── */}
      {pendingMove && (
        <div className="px-4 py-3 bg-amber-500/10 border-b border-amber-500/20">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs font-semibold text-amber-400">Ambiguous Move — Select the correct one</span>
          </div>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {(pendingMove.candidates ?? [pendingMove.san]).map(san => (
              <button
                key={san}
                onClick={() => {
                  onMoveAccepted(san, pendingMove.uci, pendingMove.fenBefore, pendingMove.fenAfter);
                  setPendingMove(null);
                }}
                className="px-2.5 py-1 rounded-md text-xs font-mono font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/25 hover:bg-amber-500/25 transition-colors"
              >
                {san}
              </button>
            ))}
          </div>
          <button onClick={() => setPendingMove(null)} className="text-xs text-white/30 hover:text-white/50 transition-colors">
            Dismiss
          </button>
        </div>
      )}

      {/* ── Mismatch alert ── */}
      {mismatchInfo && !pendingMove && (
        <div className="px-4 py-3 bg-red-500/10 border-b border-red-500/20">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
            <span className="text-xs font-semibold text-red-400">Board Mismatch — position out of sync</span>
          </div>
          <p className="text-xs text-white/50 mb-2">
            Changed squares: {mismatchInfo.changedSquares.map(c => c.square).join(", ") || "none"}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => { engineRef.current?.resumeTracking(); setMismatchInfo(null); }}
              className="px-2.5 py-1 rounded-md text-xs font-semibold bg-white/08 text-white/60 hover:bg-white/12 border border-white/10 transition-colors"
            >
              Resume Tracking
            </button>
            <button
              onClick={handleSwitchToManual}
              className="px-2.5 py-1 rounded-md text-xs font-semibold bg-red-500/15 text-red-400 border border-red-500/25 hover:bg-red-500/25 transition-colors"
            >
              Switch to Manual
            </button>
          </div>
        </div>
      )}

      {/* ── Main body ── */}
      <div className="px-4 py-4 space-y-4">

        {/* ── Progress strip ── */}
        <ProgressStrip step={step} />

        {/* ── Step-specific guidance ── */}
        {step === "connect" && (
          <div className="text-xs text-white/50 text-center leading-relaxed">
            Place all pieces in the <span className="text-white/80 font-semibold">starting position</span>, then connect.
          </div>
        )}
        {step === "reconnecting" && (
          <div className="flex flex-col items-center gap-1 text-xs text-amber-400 justify-center rounded-lg px-3 py-2 bg-amber-500/08 border border-amber-500/15">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span className="font-semibold">
                Reconnecting… attempt {adapterState?.reconnectAttempt ?? 0}/{adapterState?.reconnectMaxAttempts ?? 3}
              </span>
            </div>
            {adapterState?.reconnectNextRetryMs && (
              <span className="text-[10px] text-amber-300/60">
                Next retry in {Math.round(adapterState.reconnectNextRetryMs / 1000)}s
              </span>
            )}
          </div>
        )}
        {step === "calibrate" && (
          <div className="flex items-center gap-2 text-xs text-blue-400 justify-center">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>Waiting for starting position recognition…</span>
          </div>
        )}
        {step === "tracking" && (
          <div className="flex items-center gap-2 text-xs text-amber-400 justify-center">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>Enabling move tracking…</span>
          </div>
        )}
        {step === "ready" && (
          <div className="flex items-center gap-2 text-xs text-emerald-400 justify-center rounded-lg px-3 py-2 bg-emerald-500/08 border border-emerald-500/15">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span className="font-semibold">Live — moves are being tracked automatically.</span>
          </div>
        )}

        {/* ── Connect / Disconnect button ── */}
        {!isConnected ? (
          isReconnecting ? (
            <button
              onClick={handleDisconnect}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-amber-500/10 text-amber-300 border border-amber-500/25 hover:bg-amber-500/20 transition-colors"
            >
              <XCircle className="w-4 h-4" />
              Cancel Reconnect
            </button>
          ) : (
            <button
              onClick={handleConnect}
              disabled={isBusy || isUnsupported}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-blue-500/15 text-blue-300 border border-blue-500/25 hover:bg-blue-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {isBusy
                ? <><RefreshCw className="w-4 h-4 animate-spin" /> Connecting…</>
                : <><Bluetooth className="w-4 h-4" /> Connect Board</>}
            </button>
          )
        ) : (
          <div className="flex gap-2">
            <button
              onClick={handleDisconnect}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-white/05 text-white/50 border border-white/10 hover:bg-white/08 transition-colors"
            >
              <BluetoothOff className="w-3.5 h-3.5" />
              Disconnect
            </button>
            <button
              onClick={handleResetBoard}
              className="px-3 py-2 rounded-lg text-xs font-semibold bg-white/05 text-white/40 border border-white/08 hover:bg-white/08 transition-colors"
              title="Reset board state (new game)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ── Last accepted move pill ── */}
        {engineState?.lastAcceptedMove && (
          <div className="flex items-center justify-center gap-2 text-xs">
            <Zap className="w-3 h-3 text-emerald-400" />
            <span className={textMuted}>Last move:</span>
            <span className="font-mono font-bold text-emerald-400">{engineState.lastAcceptedMove}</span>
          </div>
        )}

        {/* ── Switch to Manual ── */}
        <button
          onClick={handleSwitchToManual}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-white/04 text-white/40 border border-white/08 hover:bg-white/08 transition-colors"
        >
          <ArrowLeftRight className="w-3 h-3" />
          Switch to Manual Input
        </button>
      </div>

      {/* ── Advanced toggle ── */}
      <button
        onClick={() => setShowAdvanced(v => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 border-t border-white/06 hover:bg-white/02 transition-colors"
      >
        <span className="text-xs text-white/30 font-semibold">Advanced</span>
        {showAdvanced
          ? <ChevronUp className="w-3.5 h-3.5 text-white/20" />
          : <ChevronDown className="w-3.5 h-3.5 text-white/20" />}
      </button>

      {/* ── Advanced panel ── */}
      {showAdvanced && (
        <div className="px-4 pb-4 space-y-4 border-t border-white/04">

          {/* Calibration */}
          <div className="pt-3 space-y-2">
            <div className="flex items-center gap-2 text-xs text-white/50 font-semibold">
              <Target className="w-3.5 h-3.5" />
              Calibration
            </div>
            {calibrationStatus === "success" && (
              <div className="flex items-start gap-2 text-xs rounded-lg px-3 py-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <span>{calibrationMsg}</span>
              </div>
            )}
            {calibrationStatus === "failed" && (
              <div className="flex items-start gap-2 text-xs rounded-lg px-3 py-2 bg-red-500/10 text-red-400 border border-red-500/20">
                <XCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <span>{calibrationMsg}</span>
              </div>
            )}
            {calibrationStatus === "waiting" && (
              <div className="flex items-start gap-2 text-xs rounded-lg px-3 py-2 bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <RefreshCw className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 animate-spin" />
                <span>{calibrationMsg}</span>
              </div>
            )}
            {engineState?.calibrationProfile && (
              <div className={`rounded-lg px-3 py-2 text-xs space-y-1 ${bgMuted} border ${borderMuted}`}>
                <div className="flex items-center justify-between">
                  <span className={textMuted}>Device</span>
                  <span className={`font-mono ${textPrimary}`}>{engineState.calibrationProfile.deviceName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className={textMuted}>Orientation</span>
                  <span className={`font-mono ${textPrimary}`}>{engineState.calibrationProfile.orientation}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className={textMuted}>Profile complete</span>
                  <span className={`font-mono ${engineState.calibrationProfile.isComplete ? "text-emerald-400" : "text-amber-400"}`}>
                    {engineState.calibrationProfile.isComplete ? "Yes" : "Partial"}
                  </span>
                </div>
              </div>
            )}
            <button
              onClick={handleRunCalibration}
              disabled={!isConnected}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-500/12 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Target className="w-3 h-3" />
              Re-Calibrate (Starting Position)
            </button>
          </div>

          {/* Piece recognition */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-white/50 font-semibold">
              <Eye className="w-3.5 h-3.5" />
              Piece Recognition
            </div>
            {!engineState?.lastBoardState ? (
              <p className="text-xs text-white/30 text-center py-2">No board data yet. Connect the board to see live piece recognition.</p>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <StatBox label="Pieces" value={String(engineState.lastBoardState.detectedPieces)} isDark={isDark} />
                  <StatBox label="Unknown" value={String(engineState.lastBoardState.unknownSquares.length)} isDark={isDark} color={engineState.lastBoardState.unknownSquares.length > 0 ? "amber" : "emerald"} />
                  <StatBox label="Changes" value={String(engineState.lastBoardState.changedSquares.length)} isDark={isDark} />
                </div>

                {/* Live 8×8 board grid */}
                <LiveBoardGrid
                  squareMap={engineState.lastBoardState.squareMap}
                  currentFen={currentFen}
                  isDark={isDark}
                />

                {engineState.lastBoardState.unknownSquares.length > 0 && (
                  <div className="rounded-lg px-3 py-2 bg-amber-500/08 border border-amber-500/15 text-xs">
                    <p className="text-amber-400 font-semibold mb-1">Unknown squares:</p>
                    <p className="text-amber-300/70 font-mono">{engineState.lastBoardState.unknownSquares.join(", ")}</p>
                    <p className="text-white/40 mt-1">Re-calibrate from starting position to resolve.</p>
                  </div>
                )}
                <div className={`rounded-lg px-3 py-2 ${bgMuted} border ${borderMuted}`}>
                  <p className="text-xs text-white/40 mb-1">Physical FEN:</p>
                  <p className="text-xs font-mono text-white/60 break-all leading-relaxed">{engineState.lastBoardState.fenPlacement}</p>
                </div>
              </>
            )}
          </div>

          {/* Move tracking controls */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-white/50 font-semibold">
              <Activity className="w-3.5 h-3.5" />
              Move Tracking
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => engineRef.current?.enableTracking()}
                disabled={!engineState?.isCalibrated || engineState?.trackingEnabled}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-500/12 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Play className="w-3 h-3" />
                Enable
              </button>
              <button
                onClick={() => engineRef.current?.disableTracking()}
                disabled={!engineState?.trackingEnabled}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-white/05 text-white/50 border border-white/10 hover:bg-white/08 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Pause className="w-3 h-3" />
                Pause
              </button>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className={textMuted}>Stabilization delay</span>
                <span className="font-mono text-white/60">{debounceMs}ms</span>
              </div>
              <input
                aria-label="Stabilization delay"
                type="range" min={200} max={1500} step={100} value={debounceMs}
                onChange={e => {
                  const v = Number(e.target.value);
                  setDebounceMs(v);
                  engineRef.current?.setDebounceMs(v);
                }}
                className="w-full h-1.5 accent-emerald-400 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-white/20">
                <span>200ms (fast)</span>
                <span>1500ms (slow)</span>
              </div>
            </div>
          </div>

          {/* Readiness checklist */}
          {engineState?.readinessChecklist && (
            <div className="space-y-1.5">
              <div className="text-xs text-white/50 font-semibold mb-1">Readiness</div>
              <ChecklistItem label="Bluetooth connected" checked={engineState.readinessChecklist.bluetoothConnected} isDark={isDark} />
              <ChecklistItem label="Board state readable" checked={engineState.readinessChecklist.boardStateReadable} isDark={isDark} />
              <ChecklistItem label="All pieces recognized" checked={engineState.readinessChecklist.piecesRecognized} isDark={isDark} />
              <ChecklistItem label="Board calibrated" checked={engineState.readinessChecklist.boardCalibrated} isDark={isDark} />
              <ChecklistItem label="Digital/physical match" checked={engineState.readinessChecklist.digitalPhysicalMatch} isDark={isDark} />
              <ChecklistItem label="Move tracking tested" checked={engineState.readinessChecklist.moveTrackingTested} isDark={isDark} />
              <ChecklistItem label="Manual fallback ready" checked={engineState.readinessChecklist.manualFallbackReady} isDark={isDark} />
            </div>
          )}

          {/* Recent logs */}
          {recentLogs.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-white/30">Recent activity:</p>
              <div className="max-h-24 overflow-y-auto space-y-0.5">
                {recentLogs.slice(0, 8).map((log, i) => (
                  <div key={i} className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                    log.level === "error" ? "text-red-400/70" :
                    log.level === "warn" ? "text-amber-400/70" :
                    "text-white/30"
                  }`}>
                    [{log.category}] {log.message}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Test Lab link */}
          <a
            href="/dashboard/tools/chessnut-bluetooth-test-lab"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-blue-400/60 hover:text-blue-400 transition-colors"
          >
            <FlaskConical className="w-3 h-3" />
            Open Chessnut Bluetooth Test Lab
          </a>
        </div>
      )}
    </div>
  );
}

// ─── Live 8×8 Board Grid ──────────────────────────────────────────────────────

type SquareStatus = "expected" | "mismatch" | "unknown" | "empty";

interface LiveBoardGridProps {
  squareMap: Record<string, string>; // square → ChessnutPieceCode
  currentFen: string;
  isDark: boolean;
}

/** Build a square → FEN-char map from a FEN placement string */
function fenToSquareMap(fen: string): Record<string, string> {
  const placement = fen.split(" ")[0];
  const ranks = placement.split("/");
  const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const map: Record<string, string> = {};
  for (let ri = 0; ri < 8; ri++) {
    const rank = 8 - ri;
    let fi = 0;
    for (const ch of ranks[ri]) {
      if (ch >= "1" && ch <= "8") {
        fi += parseInt(ch, 10);
      } else {
        map[`${files[fi]}${rank}`] = ch;
        fi++;
      }
    }
  }
  return map;
}

/** Unicode chess symbols for display */
const PIECE_UNICODE: Record<string, string> = {
  K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙",
  k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟",
};

function LiveBoardGrid({ squareMap, currentFen, isDark }: LiveBoardGridProps) {
  const digitalMap = fenToSquareMap(currentFen);

  // Build 8×8 grid from rank 8 down to rank 1, file a to h
  const ranks = [8, 7, 6, 5, 4, 3, 2, 1];
  const files = ["a", "b", "c", "d", "e", "f", "g", "h"];

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-xs text-white/40">
        <Grid3x3 className="w-3 h-3" />
        <span>Live Board State</span>
        <span className="ml-auto flex items-center gap-2 text-[10px]">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500/50 inline-block" />OK</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-500/50 inline-block" />Unknown</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500/50 inline-block" />Mismatch</span>
        </span>
      </div>

      <div className="rounded-lg overflow-hidden border border-white/08">
        {/* File labels */}
        <div className="grid grid-cols-9 text-[9px] text-white/20 font-mono">
          <div />
          {files.map(f => (
            <div key={f} className="text-center py-0.5">{f}</div>
          ))}
        </div>

        {/* Rows */}
        {ranks.map(rank => (
          <div key={rank} className="grid grid-cols-9">
            {/* Rank label */}
            <div className="flex items-center justify-center text-[9px] text-white/20 font-mono">{rank}</div>

            {files.map(file => {
              const sq = `${file}${rank}`;
              const physPiece = squareMap[sq] ?? "empty";
              const physFen = PIECE_TO_FEN[physPiece as keyof typeof PIECE_TO_FEN] ?? "";
              const digitalFen = digitalMap[sq] ?? "";
              const isLight = (files.indexOf(file) + rank) % 2 === 0;

              let status: SquareStatus;
              if (physPiece === "unknown") {
                status = "unknown";
              } else if (physFen === "" && digitalFen === "") {
                status = "empty";
              } else if (physFen === digitalFen) {
                status = "expected";
              } else {
                status = "mismatch";
              }

              const bgColor =
                status === "expected" ? "bg-emerald-500/20 border-emerald-500/30" :
                status === "unknown"  ? "bg-amber-500/20 border-amber-500/30" :
                status === "mismatch" ? "bg-red-500/20 border-red-500/30" :
                isLight ? "bg-white/04 border-white/06" : "bg-white/02 border-white/04";

              const isWhitePiece = physFen !== "" && physFen === physFen.toUpperCase();
              const pieceColor =
                status === "unknown" ? "text-amber-300" :
                status === "mismatch" ? "text-red-300" :
                isWhitePiece ? "text-white" : "text-white/50";

              const displayChar = physFen ? (PIECE_UNICODE[physFen] ?? physFen) : "";
              const tooltip = [
                `${sq}: physical=${physPiece}`,
                digitalFen ? `digital=${digitalFen}` : "digital=empty",
                status !== "expected" && status !== "empty" ? `⚠ ${status}` : "",
              ].filter(Boolean).join(" | ");

              return (
                <div
                  key={sq}
                  title={tooltip}
                  className={`aspect-square flex items-center justify-center text-sm border ${bgColor} transition-colors cursor-default`}
                >
                  <span className={`leading-none select-none ${pieceColor}`}>{displayChar}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Legend detail */}
      <div className="text-[10px] text-white/25 text-center">
        Hover any square for details · Green = physical matches digital · Red = mismatch
      </div>
    </div>
  );
}

// ─── Progress strip ───────────────────────────────────────────────────────────

const STEPS: { id: SetupStep; label: string }[] = [
  { id: "connect",      label: "Connect" },
  { id: "reconnecting", label: "Reconnect" },
  { id: "calibrate",    label: "Calibrate" },
  { id: "tracking",     label: "Tracking" },
  { id: "ready",        label: "Live" },
];

const STEP_ORDER: SetupStep[] = ["connect", "reconnecting", "calibrate", "tracking", "ready"];

function ProgressStrip({ step }: { step: SetupStep }) {
  const currentIdx = STEP_ORDER.indexOf(step);
  return (
    <div className="flex items-center gap-0">
      {STEPS.map((s, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <div key={s.id} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center flex-1 min-w-0">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border transition-colors ${
                done   ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400" :
                active ? "bg-blue-500/20 border-blue-500/40 text-blue-300 ring-2 ring-blue-500/20" :
                         "bg-white/04 border-white/10 text-white/20"
              }`}>
                {done ? <CheckCircle2 className="w-3 h-3" /> : i + 1}
              </div>
              <span className={`text-[9px] mt-0.5 font-semibold truncate ${
                done ? "text-emerald-400/70" : active ? "text-blue-300/80" : "text-white/20"
              }`}>{s.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`h-px flex-1 mx-1 transition-colors ${done ? "bg-emerald-500/30" : "bg-white/08"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatBox({ label, value, isDark, color }: { label: string; value: string; isDark: boolean; color?: "emerald" | "amber" }) {
  const valueColor = color === "emerald" ? "text-emerald-400" : color === "amber" ? "text-amber-400" : isDark ? "text-white/80" : "text-[#12372A]";
  return (
    <div className={`rounded-md px-2 py-2 text-center ${isDark ? "bg-white/04 border border-white/06" : "bg-[#ADBC9F]/40 border border-[#ADBC9F]"}`}>
      <div className={`text-lg font-bold font-mono ${valueColor}`}>{value}</div>
      <div className={`text-[10px] ${isDark ? "text-white/30" : "text-[#436850]"}`}>{label}</div>
    </div>
  );
}

function ChecklistItem({ label, checked, isDark }: { label: string; checked: boolean; isDark: boolean }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      {checked
        ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
        : <Circle className="w-3.5 h-3.5 text-white/20 flex-shrink-0" />}
      <span className={checked ? (isDark ? "text-white/70" : "text-[#12372A]/85") : (isDark ? "text-white/30" : "text-[#436850]")}>
        {label}
      </span>
    </div>
  );
}
