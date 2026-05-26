/**
 * ChessnutChromeBTPanel
 * =====================
 * Operator UI for the Chrome Web Bluetooth Chessnut Pro adapter.
 *
 * Sections:
 *  1. Browser support status banner
 *  2. Connection controls (Connect / Disconnect / Reconnect / Switch to Manual)
 *  3. Live status grid (device name, board state, last move, FEN match)
 *  4. BLE Diagnostics panel (services, characteristics, raw hex payloads)
 *  5. Test Without Board mode (mocked payloads)
 *  6. Record Raw Payloads developer option
 *
 * Transparency: all labels are honest about what is and isn't working.
 * If parsing is not yet configured, we say so clearly.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import {
  Bluetooth,
  BluetoothOff,
  BluetoothSearching,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Cpu,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Download,
  FlaskConical,
  Wrench,
  Zap,
  Circle,
  XCircle,
  Info,
  Eye,
} from "lucide-react";
import {
  ChessnutWebBluetoothAdapter,
  type AdapterState,
  type AdapterStatus,
  type DiagnosticService,
  type InferredMove,
  buildMockPayloadFromFen,
} from "@/lib/ChessnutWebBluetoothAdapter";

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<AdapterStatus, {
  label: string;
  color: string;
  icon: React.ReactNode;
  pulse: boolean;
}> = {
  unsupported: {
    label: "Unsupported Browser",
    color: "text-red-400 border-red-400/30 bg-red-400/10",
    icon: <XCircle className="w-3.5 h-3.5" />,
    pulse: false,
  },
  ready: {
    label: "Ready to Connect",
    color: "text-white/40 border-white/10 bg-white/5",
    icon: <BluetoothOff className="w-3.5 h-3.5" />,
    pulse: false,
  },
  picker_opened: {
    label: "Device Picker Opened",
    color: "text-blue-400 border-blue-400/30 bg-blue-400/10",
    icon: <BluetoothSearching className="w-3.5 h-3.5 animate-pulse" />,
    pulse: true,
  },
  connecting: {
    label: "Connecting",
    color: "text-blue-400 border-blue-400/30 bg-blue-400/10",
    icon: <BluetoothSearching className="w-3.5 h-3.5 animate-pulse" />,
    pulse: true,
  },
  connected: {
    label: "Connected",
    color: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10",
    icon: <Bluetooth className="w-3.5 h-3.5" />,
    pulse: false,
  },
  discovering_services: {
    label: "Discovering Services",
    color: "text-blue-400 border-blue-400/30 bg-blue-400/10",
    icon: <RefreshCw className="w-3.5 h-3.5 animate-spin" />,
    pulse: true,
  },
  listening: {
    label: "Listening for Board Updates",
    color: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10",
    icon: <Bluetooth className="w-3.5 h-3.5" />,
    pulse: false,
  },
  receiving: {
    label: "Receiving Board State",
    color: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10",
    icon: <Circle className="w-3.5 h-3.5 animate-pulse" />,
    pulse: true,
  },
  move_accepted: {
    label: "Move Accepted",
    color: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10",
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    pulse: false,
  },
  mismatch: {
    label: "Board State Mismatch",
    color: "text-red-400 border-red-400/30 bg-red-400/10",
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
    pulse: false,
  },
  needs_review: {
    label: "Needs Operator Review",
    color: "text-amber-400 border-amber-400/30 bg-amber-400/10",
    icon: <AlertCircle className="w-3.5 h-3.5" />,
    pulse: true,
  },
  disconnected: {
    label: "Disconnected",
    color: "text-white/40 border-white/10 bg-white/5",
    icon: <BluetoothOff className="w-3.5 h-3.5" />,
    pulse: false,
  },
  reconnecting: {
    label: "Reconnecting",
    color: "text-amber-400 border-amber-400/30 bg-amber-400/10",
    icon: <RefreshCw className="w-3.5 h-3.5 animate-spin" />,
    pulse: true,
  },
  error: {
    label: "Error",
    color: "text-red-400 border-red-400/30 bg-red-400/10",
    icon: <XCircle className="w-3.5 h-3.5" />,
    pulse: false,
  },
  diagnostic: {
    label: "Diagnostic Mode",
    color: "text-amber-400 border-amber-400/30 bg-amber-400/10",
    icon: <Wrench className="w-3.5 h-3.5" />,
    pulse: false,
  },
};

// ─── Props ────────────────────────────────────────────────────────────────────
interface ChessnutChromeBTPanelProps {
  broadcastId: string;
  currentFen: string;
  onMoveAccepted: (san: string, uci: string, fenBefore: string, fenAfter: string) => void;
  onSwitchToManual: () => void;
  isDark?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────
export function ChessnutChromeBTPanel({
  broadcastId,
  currentFen,
  onMoveAccepted,
  onSwitchToManual,
  isDark = true,
}: ChessnutChromeBTPanelProps) {
  const adapterRef = useRef<ChessnutWebBluetoothAdapter | null>(null);
  const [adapterState, setAdapterState] = useState<AdapterState>(() => {
    const a = new ChessnutWebBluetoothAdapter(broadcastId, "", false);
    return a.getStatus();
  });
  const [advancedDiscovery, setAdvancedDiscovery] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [showTestMode, setShowTestMode] = useState(false);
  const [showRawPayloads, setShowRawPayloads] = useState(false);
  const [pendingMove, setPendingMove] = useState<InferredMove | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [testFen, setTestFen] = useState("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1");
  const [testResult, setTestResult] = useState<string | null>(null);

  // Initialize adapter
  const initAdapter = useCallback(() => {
    const adapter = new ChessnutWebBluetoothAdapter(broadcastId, "", advancedDiscovery);
    adapter.onStatusChange(setAdapterState);
    adapter.onError((msg) => setErrorMsg(msg));
    adapter.onMove((move) => {
      if (move.confidence === "ambiguous" || move.confidence === "none") {
        setPendingMove(move);
      } else {
        onMoveAccepted(move.san, move.uci, move.fenBefore, move.fenAfter);
      }
    });
    adapterRef.current = adapter;
    setAdapterState(adapter.getStatus());
  }, [broadcastId, advancedDiscovery, onMoveAccepted]);

  useEffect(() => {
    initAdapter();
    return () => { adapterRef.current?.disconnect(); };
  }, [initAdapter]);

  const handleConnect = async () => {
    if (!adapterRef.current) return;
    setErrorMsg(null);
    await adapterRef.current.connect();
  };

  const handleDisconnect = () => {
    adapterRef.current?.disconnect();
  };

  const handleReconnect = async () => {
    adapterRef.current?.disconnect();
    await new Promise(r => setTimeout(r, 500));
    await adapterRef.current?.connect();
  };

  const handleAcceptPendingMove = async () => {
    if (!pendingMove || !adapterRef.current) return;
    await adapterRef.current.submitMoveToBroadcast(pendingMove);
    onMoveAccepted(pendingMove.san, pendingMove.uci, pendingMove.fenBefore, pendingMove.fenAfter);
    setPendingMove(null);
  };

  const handleRejectPendingMove = () => setPendingMove(null);

  const handleCopyRawPayloads = async () => {
    const payloads = adapterRef.current?.getRawPayloads() ?? [];
    await navigator.clipboard.writeText(JSON.stringify(payloads, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTestParse = () => {
    if (!adapterRef.current) return;
    try {
      const mockData = buildMockPayloadFromFen(testFen);
      const state = adapterRef.current.parseBoardState(mockData);
      if (!state) {
        setTestResult("❌ parseBoardState returned null — packet too short");
        return;
      }
      const occupied = state.filter(s => s.piece).length;
      setTestResult(`✅ Parsed ${occupied} pieces from FEN. Board state looks correct.`);
    } catch (e) {
      setTestResult(`❌ Error: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const handleTestInference = () => {
    if (!adapterRef.current) return;
    try {
      const startFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
      const afterE4Fen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";
      const prevData = buildMockPayloadFromFen(startFen);
      const currData = buildMockPayloadFromFen(afterE4Fen);
      const prevState = adapterRef.current.parseBoardState(prevData);
      const currState = adapterRef.current.parseBoardState(currData);
      if (!prevState || !currState) {
        setTestResult("❌ Failed to parse mock board states");
        return;
      }
      const inferred = adapterRef.current.inferMoveFromBoardState(prevState, currState, startFen);
      if (!inferred) {
        setTestResult("❌ inferMoveFromBoardState returned null");
        return;
      }
      if (inferred.confidence === "exact" && inferred.san === "e4") {
        setTestResult(`✅ Move inference correct: ${inferred.san} (${inferred.uci}) — confidence: ${inferred.confidence}`);
      } else {
        setTestResult(`⚠️ Inference result: ${inferred.san || "none"} — confidence: ${inferred.confidence}`);
      }
    } catch (e) {
      setTestResult(`❌ Error: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const status = adapterState.status;
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.error;
  const isConnected = ["connected", "discovering_services", "listening", "receiving", "move_accepted", "mismatch", "needs_review", "diagnostic"].includes(status);
  const isUnsupported = status === "unsupported";
  const isBusy = ["picker_opened", "connecting", "discovering_services"].includes(status);

  const bg = isDark ? "bg-[oklch(0.18_0.05_145)] border-white/10" : "bg-gray-50 border-gray-200";
  const textPrimary = isDark ? "text-white" : "text-gray-900";
  const textMuted = isDark ? "text-white/50" : "text-gray-500";
  const textDim = isDark ? "text-white/30" : "text-gray-400";
  const borderMuted = isDark ? "border-white/08" : "border-gray-200";
  const bgMuted = isDark ? "bg-white/04" : "bg-gray-100";

  return (
    <div className={`rounded-xl border p-4 space-y-4 ${bg}`}>
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bluetooth className={`w-4 h-4 ${isDark ? "text-blue-400" : "text-blue-600"}`} />
          <span className={`text-sm font-bold ${textPrimary}`}>
            Chessnut Pro — Chrome Bluetooth
          </span>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${
            isDark ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : "bg-amber-50 text-amber-600 border-amber-200"
          }`}>EXPERIMENTAL</span>
        </div>
        <StatusBadge cfg={cfg} />
      </div>

      {/* ── Browser support banner ── */}
      {isUnsupported && (
        <div className={`flex items-start gap-2 text-xs rounded-lg px-3 py-2.5 ${
          isDark ? "bg-red-500/10 text-red-400 border border-red-500/20" : "bg-red-50 text-red-600 border border-red-200"
        }`}>
          <XCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Chrome Web Bluetooth is not available in this browser.</p>
            <p className="mt-0.5 opacity-80">
              Use <strong>Chrome</strong> or <strong>Edge</strong> on desktop, or switch to
              Manual Mode / the Local Bridge script.
            </p>
          </div>
        </div>
      )}

      {/* ── Error message ── */}
      {errorMsg && !isUnsupported && (
        <div className={`flex items-start gap-2 text-xs rounded-lg px-3 py-2 ${
          isDark ? "bg-red-500/10 text-red-400 border border-red-500/20" : "bg-red-50 text-red-600 border border-red-200"
        }`}>
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ── Parse not configured notice ── */}
      {isConnected && !adapterState.parseConfigured && status !== "diagnostic" && (
        <div className={`flex items-start gap-2 text-xs rounded-lg px-3 py-2 ${
          isDark ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" : "bg-amber-50 text-amber-700 border border-amber-200"
        }`}>
          <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>
            <strong>Connected — parsing not configured yet.</strong> The board is connected but
            the FEN characteristic UUID was not found. Use the BLE Diagnostics panel to identify
            the correct service/characteristic for this firmware version.
          </span>
        </div>
      )}

      {/* ── Diagnostic mode notice ── */}
      {status === "diagnostic" && (
        <div className={`flex items-start gap-2 text-xs rounded-lg px-3 py-2 ${
          isDark ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" : "bg-amber-50 text-amber-700 border border-amber-200"
        }`}>
          <Wrench className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>
            <strong>Diagnostic Mode.</strong> Known Chessnut UUIDs were not found on this device.
            Open the BLE Diagnostics panel below to inspect available services and characteristics.
          </span>
        </div>
      )}

      {/* ── Test Lab link banner ── */}
      {!isUnsupported && (
        <div className={`flex items-center justify-between text-xs rounded-lg px-3 py-2 ${
          isDark ? "bg-blue-500/08 border border-blue-500/15" : "bg-blue-50 border border-blue-200"
        }`}>
          <div className={`flex items-center gap-2 ${isDark ? "text-blue-300/70" : "text-blue-600"}`}>
            <FlaskConical className="w-3 h-3 flex-shrink-0" />
            <span>Validate the board with the Chessnut Bluetooth Test Lab before live use.</span>
          </div>
          <a
            href="/dashboard/tools/chessnut-bluetooth-test-lab"
            target="_blank"
            rel="noopener noreferrer"
            className={`flex-shrink-0 ml-3 px-2.5 py-1 rounded-md font-medium transition-colors ${
              isDark ? "bg-blue-500/15 text-blue-300 hover:bg-blue-500/25 border border-blue-500/20"
                     : "bg-blue-100 text-blue-700 hover:bg-blue-200 border border-blue-200"
            }`}
          >
            Open Test Lab
          </a>
        </div>
      )}

      {/* ── Pending move confirmation ── */}
      {pendingMove && (
        <div className={`rounded-lg border p-3 space-y-2 ${
          isDark ? "bg-amber-500/10 border-amber-500/25" : "bg-amber-50 border-amber-200"
        }`}>
          <div className={`flex items-center gap-2 text-xs font-semibold ${isDark ? "text-amber-400" : "text-amber-700"}`}>
            <AlertCircle className="w-3.5 h-3.5" />
            {pendingMove.confidence === "ambiguous"
              ? `Ambiguous move — multiple candidates: ${pendingMove.candidates?.join(", ")}`
              : "No legal move matches the board state"}
          </div>
          {pendingMove.isPromotion && (
            <p className={`text-xs ${isDark ? "text-amber-300/80" : "text-amber-600"}`}>
              Promotion detected — please confirm the piece.
            </p>
          )}
          {pendingMove.confidence === "ambiguous" && (
            <div className="flex gap-2">
              <button
                onClick={handleAcceptPendingMove}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  isDark ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25"
                         : "bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                }`}
              >
                Accept {pendingMove.san}
              </button>
              <button
                onClick={handleRejectPendingMove}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  isDark ? "bg-white/06 border border-white/10 text-white/50 hover:bg-white/10"
                         : "bg-gray-100 border border-gray-200 text-gray-600 hover:bg-gray-200"
                }`}
              >
                Reject
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Status grid ── */}
      {!isUnsupported && (
        <div className={`grid grid-cols-2 gap-2 text-xs`}>
          <StatusRow label="Device" value={adapterState.deviceName ?? "—"} textMuted={textMuted} textPrimary={textPrimary} />
          <StatusRow label="GATT" value={adapterState.gattConnected ? "Connected" : "Disconnected"} textMuted={textMuted} textPrimary={textPrimary} />
          <StatusRow label="Board State" value={adapterState.lastBoardUpdateAt
            ? `${Math.round((Date.now() - adapterState.lastBoardUpdateAt) / 1000)}s ago`
            : "No data"} textMuted={textMuted} textPrimary={textPrimary} />
          <StatusRow label="Last Move" value={adapterState.lastAcceptedMove ?? "—"} textMuted={textMuted} textPrimary={textPrimary} />
          <StatusRow label="FEN Match" value={
            adapterState.lastFenMatchStatus === "match" ? "✓ Match"
            : adapterState.lastFenMatchStatus === "mismatch" ? "✗ Mismatch"
            : "—"
          } textMuted={textMuted} textPrimary={textPrimary} />
          <StatusRow label="Parse" value={adapterState.parseConfigured ? "Configured" : "Not configured"} textMuted={textMuted} textPrimary={textPrimary} />
        </div>
      )}

      {/* ── Control buttons ── */}
      {!isUnsupported && (
        <div className="space-y-2">
          {/* Advanced discovery toggle */}
          <label className={`flex items-center gap-2 text-xs cursor-pointer ${textMuted}`}>
            <input
              type="checkbox"
              checked={advancedDiscovery}
              onChange={e => setAdvancedDiscovery(e.target.checked)}
              className="rounded"
            />
            Advanced discovery mode (accept all BLE devices)
          </label>

          {/* Connect / Reconnect / Disconnect */}
          <div className="flex gap-2">
            {!isConnected && (
              <button
                onClick={handleConnect}
                disabled={isBusy}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all ${
                  isBusy ? "opacity-50 cursor-not-allowed" : ""
                } ${isDark
                  ? "bg-blue-500/15 border border-blue-500/30 text-blue-400 hover:bg-blue-500/25"
                  : "bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-100"
                }`}
              >
                {isBusy
                  ? <><BluetoothSearching className="w-4 h-4 animate-pulse" /> Connecting…</>
                  : <><BluetoothSearching className="w-4 h-4" /> Connect Chessnut Pro</>
                }
              </button>
            )}

            {isConnected && (
              <>
                <button
                  onClick={handleReconnect}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all ${
                    isDark ? "bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20"
                           : "bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-100"
                  }`}
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Reconnect
                </button>
                <button
                  onClick={handleDisconnect}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all ${
                    isDark ? "bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20"
                           : "bg-red-50 border border-red-200 text-red-600 hover:bg-red-100"
                  }`}
                >
                  <BluetoothOff className="w-3.5 h-3.5" /> Disconnect
                </button>
              </>
            )}
          </div>

          {/* Switch to Manual Mode */}
          <button
            onClick={onSwitchToManual}
            className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all ${
              isDark ? "bg-white/06 border border-white/10 text-white/60 hover:bg-white/10"
                     : "bg-gray-100 border border-gray-200 text-gray-600 hover:bg-gray-200"
            }`}
          >
            <Cpu className="w-3.5 h-3.5" /> Switch to Manual Mode
          </button>
        </div>
      )}

      {/* ── BLE Diagnostics panel ── */}
      {!isUnsupported && (
        <div className={`rounded-lg border ${borderMuted}`}>
          <button
            onClick={() => setShowDiagnostics(v => !v)}
            className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold ${textMuted} hover:${textPrimary} transition-colors`}
          >
            <span className="flex items-center gap-2">
              <Wrench className="w-3.5 h-3.5" />
              Bluetooth Diagnostics
            </span>
            {showDiagnostics ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showDiagnostics && (
            <div className={`border-t ${borderMuted} p-3 space-y-3`}>
              <DiagnosticsGrid state={adapterState} isDark={isDark} textMuted={textMuted} textPrimary={textPrimary} bgMuted={bgMuted} />
            </div>
          )}
        </div>
      )}

      {/* ── Test Without Board mode ── */}
      {!isUnsupported && (
        <div className={`rounded-lg border ${borderMuted}`}>
          <button
            onClick={() => setShowTestMode(v => !v)}
            className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold ${textMuted} hover:${textPrimary} transition-colors`}
          >
            <span className="flex items-center gap-2">
              <FlaskConical className="w-3.5 h-3.5" />
              Test Without Board
            </span>
            {showTestMode ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showTestMode && (
            <div className={`border-t ${borderMuted} p-3 space-y-3`}>
              <p className={`text-xs ${textMuted}`}>
                Test the board-state parser and move inference engine using mocked BLE payloads.
                No physical board required.
              </p>
              <div className="space-y-1">
                <label className={`text-[10px] font-semibold uppercase tracking-wide ${textDim}`}>
                  Test FEN (position after the move)
                </label>
                <input
                  value={testFen}
                  onChange={e => setTestFen(e.target.value)}
                  className={`w-full text-xs font-mono px-2 py-1.5 rounded-lg border ${
                    isDark ? "bg-white/05 border-white/10 text-white/80 placeholder-white/20"
                           : "bg-gray-50 border-gray-200 text-gray-800"
                  }`}
                  placeholder="FEN string"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleTestParse}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    isDark ? "bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20"
                           : "bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-100"
                  }`}
                >
                  Test Parser
                </button>
                <button
                  onClick={handleTestInference}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    isDark ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20"
                           : "bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                  }`}
                >
                  Test Inference (1.e4)
                </button>
              </div>
              {testResult && (
                <div className={`text-xs font-mono px-2 py-1.5 rounded-lg ${
                  isDark ? "bg-white/05 text-white/70" : "bg-gray-100 text-gray-700"
                }`}>
                  {testResult}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Record Raw Payloads ── */}
      {!isUnsupported && (
        <div className={`rounded-lg border ${borderMuted}`}>
          <button
            onClick={() => setShowRawPayloads(v => !v)}
            className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold ${textMuted} hover:${textPrimary} transition-colors`}
          >
            <span className="flex items-center gap-2">
              <Eye className="w-3.5 h-3.5" />
              Raw BLE Payloads
              {adapterState.rawPayloads.length > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  isDark ? "bg-white/10 text-white/50" : "bg-gray-200 text-gray-500"
                }`}>{adapterState.rawPayloads.length}</span>
              )}
            </span>
            {showRawPayloads ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showRawPayloads && (
            <div className={`border-t ${borderMuted} p-3 space-y-2`}>
              <div className="flex items-center justify-between">
                <p className={`text-xs ${textMuted}`}>Last {adapterState.rawPayloads.length} BLE notifications (newest first)</p>
                <button
                  onClick={handleCopyRawPayloads}
                  className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-all ${
                    isDark ? "bg-white/06 border border-white/10 text-white/50 hover:bg-white/10"
                           : "bg-gray-100 border border-gray-200 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied ? "Copied" : "Copy JSON"}
                </button>
              </div>
              {adapterState.rawPayloads.length === 0 ? (
                <p className={`text-xs ${textDim}`}>No payloads recorded yet. Connect the board and make a move.</p>
              ) : (
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {adapterState.rawPayloads.map((p, i) => (
                    <div key={i} className={`text-[10px] font-mono px-2 py-1 rounded ${
                      isDark ? "bg-white/04 text-white/40" : "bg-gray-50 text-gray-500"
                    }`}>
                      <span className="opacity-50">{new Date(p.ts).toISOString().slice(11, 23)}</span>{" "}
                      <span className="opacity-40">[{p.length}B]</span>{" "}
                      {p.hex}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ cfg }: { cfg: typeof STATUS_CONFIG[AdapterStatus] }) {
  return (
    <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.color}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

function StatusRow({
  label, value, textMuted, textPrimary
}: { label: string; value: string; textMuted: string; textPrimary: string }) {
  return (
    <div>
      <div className={`text-[10px] uppercase tracking-wide font-semibold ${textMuted} opacity-60`}>{label}</div>
      <div className={`text-xs font-medium mt-0.5 ${textPrimary}`}>{value}</div>
    </div>
  );
}

function DiagnosticsGrid({
  state, isDark, textMuted, textPrimary, bgMuted
}: {
  state: AdapterState;
  isDark: boolean;
  textMuted: string;
  textPrimary: string;
  bgMuted: string;
}) {
  const borderMuted = isDark ? "border-white/08" : "border-gray-200";

  return (
    <div className="space-y-3">
      {/* Device info */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <div className={`text-[10px] uppercase tracking-wide font-semibold ${textMuted} opacity-60`}>Device Name</div>
          <div className={`font-mono ${textPrimary}`}>{state.deviceName ?? "—"}</div>
        </div>
        <div>
          <div className={`text-[10px] uppercase tracking-wide font-semibold ${textMuted} opacity-60`}>Device ID</div>
          <div className={`font-mono text-[10px] ${textMuted}`}>{state.deviceId ?? "—"}</div>
        </div>
        <div>
          <div className={`text-[10px] uppercase tracking-wide font-semibold ${textMuted} opacity-60`}>GATT</div>
          <div className={`font-medium ${state.gattConnected ? "text-emerald-400" : textMuted}`}>
            {state.gattConnected ? "Connected" : "Disconnected"}
          </div>
        </div>
        <div>
          <div className={`text-[10px] uppercase tracking-wide font-semibold ${textMuted} opacity-60`}>Services Found</div>
          <div className={textPrimary}>{state.diagnosticServices.length}</div>
        </div>
      </div>

      {/* Services list */}
      {state.diagnosticServices.length === 0 ? (
        <p className={`text-xs ${textMuted}`}>
          No services discovered yet. Connect the board and click "Discover Services."
        </p>
      ) : (
        <div className="space-y-2">
          {state.diagnosticServices.map((svc) => (
            <ServiceCard key={svc.uuid} svc={svc} isDark={isDark} textMuted={textMuted} textPrimary={textPrimary} bgMuted={bgMuted} borderMuted={borderMuted} />
          ))}
        </div>
      )}

      {/* Last error */}
      {state.errorMessage && (
        <div className={`text-xs font-mono px-2 py-1.5 rounded-lg ${
          isDark ? "bg-red-500/10 text-red-400" : "bg-red-50 text-red-600"
        }`}>
          {state.errorMessage}
        </div>
      )}
    </div>
  );
}

function ServiceCard({
  svc, isDark, textMuted, textPrimary, bgMuted, borderMuted
}: {
  svc: DiagnosticService;
  isDark: boolean;
  textMuted: string;
  textPrimary: string;
  bgMuted: string;
  borderMuted: string;
}) {
  const [open, setOpen] = useState(false);

  const isKnown = Object.values({ FEN: "1b7e8261", OPS: "1b7e8271", NORDIC: "6e400001" })
    .some(prefix => svc.uuid.startsWith(prefix));

  return (
    <div className={`rounded-lg border ${borderMuted} ${bgMuted}`}>
      <button
        onClick={() => setOpen(v => !v)}
        className={`w-full flex items-center justify-between px-3 py-2 text-xs`}
      >
        <span className="flex items-center gap-2">
          <span className={`font-mono ${isKnown ? "text-emerald-400" : textMuted}`}>
            {svc.uuid}
          </span>
          {isKnown && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
              Known
            </span>
          )}
        </span>
        <span className={`text-[10px] ${textMuted}`}>
          {svc.characteristics.length} char{svc.characteristics.length !== 1 ? "s" : ""}
          {open ? <ChevronUp className="w-3 h-3 inline ml-1" /> : <ChevronDown className="w-3 h-3 inline ml-1" />}
        </span>
      </button>

      {open && (
        <div className={`border-t ${borderMuted} p-2 space-y-1`}>
          {svc.characteristics.map((ch) => (
            <div key={ch.uuid} className={`text-[10px] font-mono px-2 py-1 rounded ${
              isDark ? "bg-white/04 text-white/50" : "bg-white text-gray-600"
            }`}>
              <div className="flex items-center justify-between">
                <span>{ch.uuid}</span>
                <span className={`text-[9px] ${textMuted}`}>{ch.properties.join(", ")}</span>
              </div>
              {ch.lastNotification && (
                <div className={`mt-0.5 ${isDark ? "text-white/30" : "text-gray-400"}`}>
                  ↳ {ch.lastNotification}
                  {ch.lastNotificationAt && (
                    <span className="ml-2 opacity-50">
                      {new Date(ch.lastNotificationAt).toISOString().slice(11, 23)}
                    </span>
                  )}
                </div>
              )}
              {ch.lastValue && !ch.lastNotification && (
                <div className={`mt-0.5 ${isDark ? "text-white/30" : "text-gray-400"}`}>
                  read: {ch.lastValue}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
