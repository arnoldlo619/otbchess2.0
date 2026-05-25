/**
 * ChessnutTestLab.tsx
 * Route: /dashboard/tools/chessnut-bluetooth-test-lab
 *
 * A dedicated internal testing page for validating Chessnut Pro Chrome Web Bluetooth.
 * Admin/director access only. Never affects real tournament broadcasts.
 *
 * Sections:
 *  1. Browser Compatibility
 *  2. Device Connection
 *  3. BLE Services & Characteristics
 *  4. Raw Payload Monitor
 *  5. Board-State Debugger
 *  6. Move Inference Tester
 *  7. Production Readiness Status
 *  + Board Mapping Calibration
 *  + Real-Device Test Checklist
 *  + Readiness Report Generator
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { Chess } from "chess.js";
import { toast } from "sonner";
import {
  Bluetooth, BluetoothConnected, BluetoothOff, BluetoothSearching,
  Wifi, WifiOff, CheckCircle2, XCircle, AlertTriangle, HelpCircle,
  Copy, Download, Trash2, RefreshCw, Play, Square, ChevronDown,
  ChevronRight, FlaskConical, Shield, Radio, Cpu, Zap, SkipBack,
  ClipboardList, FileText, Settings, Eye, EyeOff, ArrowRight,
  RotateCcw, Target, Activity
} from "lucide-react";
import { useAuthContext } from "@/context/AuthContext";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BleService {
  uuid: string;
  isPrimary: boolean;
  characteristics: BleCharacteristic[];
}

interface BleCharacteristic {
  uuid: string;
  properties: {
    read: boolean;
    write: boolean;
    writeWithoutResponse: boolean;
    notify: boolean;
    indicate: boolean;
  };
  value?: string; // last read value as hex
  isSubscribed: boolean;
  isCandidate: boolean;
  isWriteCandidate: boolean;
}

interface RawPayload {
  id: string;
  timestamp: string;
  serviceUuid: string;
  characteristicUuid: string;
  byteLength: number;
  hex: string;
  bytes: number[];
  text?: string;
}

interface SquareState {
  square: string;
  piece: string; // "" = empty, "P"=wP, "p"=bP, "N"=wN, etc.
}

type ChecklistStatus = "not_tested" | "passed" | "failed" | "skipped";

interface ChecklistItem {
  id: string;
  label: string;
  status: ChecklistStatus;
}

type ReadinessLevel =
  | "not_ready"
  | "diagnostics_only"
  | "connected_parser_incomplete"
  | "parser_working"
  | "ready_for_rehearsal"
  | "event_ready_beta";

type CalibrationStep =
  | "idle"
  | "clear_board"
  | "place_a1"
  | "place_h1"
  | "place_a8"
  | "place_h8"
  | "inferring"
  | "done"
  | "failed";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toHex(bytes: number[]): string {
  return bytes.map(b => b.toString(16).padStart(2, "0")).join(" ");
}

function tryDecodeText(bytes: number[]): string | undefined {
  try {
    const str = new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(bytes));
    if (str.length > 0 && str.split("").every(c => c.charCodeAt(0) >= 32 || c === "\n")) {
      return str;
    }
  } catch { /* not valid UTF-8 */ }
  return undefined;
}

function statusColor(s: "working" | "incomplete" | "not_working" | "unknown"): string {
  if (s === "working") return "text-[#4CAF50]";
  if (s === "incomplete") return "text-amber-400";
  if (s === "not_working") return "text-red-400";
  return "text-white/40";
}

function statusIcon(s: "working" | "incomplete" | "not_working" | "unknown") {
  if (s === "working") return <CheckCircle2 className="w-4 h-4 text-[#4CAF50]" />;
  if (s === "incomplete") return <AlertTriangle className="w-4 h-4 text-amber-400" />;
  if (s === "not_working") return <XCircle className="w-4 h-4 text-red-400" />;
  return <HelpCircle className="w-4 h-4 text-white/30" />;
}

const CHECKLIST_DEFAULTS: ChecklistItem[] = [
  { id: "charged", label: "Chessnut Pro charged", status: "not_tested" },
  { id: "not_connected_other", label: "Board not connected to another app", status: "not_tested" },
  { id: "chrome_edge", label: "Chrome or Edge desktop confirmed", status: "not_tested" },
  { id: "https", label: "HTTPS or localhost confirmed", status: "not_tested" },
  { id: "picker", label: "Device appears in Bluetooth picker", status: "not_tested" },
  { id: "gatt", label: "GATT connection successful", status: "not_tested" },
  { id: "services", label: "Services discovered", status: "not_tested" },
  { id: "notify_char", label: "Notifiable characteristic found", status: "not_tested" },
  { id: "payloads", label: "Raw payloads received", status: "not_tested" },
  { id: "start_pos", label: "Starting position parsed", status: "not_tested" },
  { id: "mapping", label: "Board mapping confirmed", status: "not_tested" },
  { id: "e2e4", label: "1.e4 inferred correctly", status: "not_tested" },
  { id: "e7e5", label: "1...e5 inferred correctly", status: "not_tested" },
  { id: "g1f3", label: "2.Nf3 inferred correctly", status: "not_tested" },
  { id: "capture", label: "Capture inferred correctly", status: "not_tested" },
  { id: "mismatch", label: "Undo/mismatch behavior tested", status: "not_tested" },
  { id: "demo_broadcast", label: "Demo broadcast updated", status: "not_tested" },
  { id: "venue_display", label: "Venue display updated", status: "not_tested" },
  { id: "disconnect_recovery", label: "Disconnect recovery tested", status: "not_tested" },
  { id: "manual_fallback", label: "Manual Mode fallback tested", status: "not_tested" },
];

const CHECKLIST_KEY = "chessnut_test_lab_checklist";
const CALIBRATION_KEY = "chessnut_board_calibration";
const RECENT_UUIDS_KEY = "chessnut_recent_uuids";

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ChessnutTestLab() {
  const { user } = useAuthContext();
  const [, navigate] = useLocation();

  // ── Auth guard ──────────────────────────────────────────────────────────────
  // Only staff members can access the Test Lab (isStaff = OTB team / admin)
  useEffect(() => {
    if (user !== undefined && user !== null && !user.isStaff) {
      navigate("/");
    }
  }, [user, navigate]);

  // ── Section collapse state ──────────────────────────────────────────────────
  const [openSections, setOpenSections] = useState<Set<string>>(
    new Set(["compat", "connect", "services", "payloads", "board", "inference", "readiness"])
  );
  const toggleSection = (id: string) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  // ── BLE state ───────────────────────────────────────────────────────────────
  const [bleSupported, setBleSupported] = useState<boolean | null>(null);
  const [isSecureContext, setIsSecureContext] = useState(false);
  const [browserName, setBrowserName] = useState("Unknown");
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [gattConnected, setGattConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [advancedMode, setAdvancedMode] = useState(false);
  const [extraUuids, setExtraUuids] = useState("");
  const [recentUuids, setRecentUuids] = useState<string[]>([]);

  const deviceRef = useRef<BluetoothDevice | null>(null);
  const gattRef = useRef<BluetoothRemoteGATTServer | null>(null);

  // ── Services state ──────────────────────────────────────────────────────────
  const [services, setServices] = useState<BleService[]>([]);
  const [expandedServices, setExpandedServices] = useState<Set<string>>(new Set());
  const characteristicRefs = useRef<Map<string, BluetoothRemoteGATTCharacteristic>>(new Map());

  // ── Payload state ───────────────────────────────────────────────────────────
  const [payloads, setPayloads] = useState<RawPayload[]>([]);
  const [recording, setRecording] = useState(false);
  const payloadIdRef = useRef(0);

  // ── Board state ─────────────────────────────────────────────────────────────
  const [prevBoardState, setPrevBoardState] = useState<SquareState[] | null>(null);
  const [currBoardState, setCurrBoardState] = useState<SquareState[] | null>(null);
  const [parsedFen, setParsedFen] = useState<string | null>(null);
  const [candidateCharUuid, setCandidateCharUuid] = useState<string | null>(null);

  // ── Inference state ─────────────────────────────────────────────────────────
  const [inferenceFen, setInferenceFen] = useState("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  const [inferenceResult, setInferenceResult] = useState<{
    confidence: "exact" | "ambiguous" | "mismatch" | "requires_confirmation" | "none";
    san?: string;
    uci?: string;
    fenBefore?: string;
    fenAfter?: string;
    candidates?: string[];
    message: string;
  } | null>(null);
  const [demobroadcastId, setDemoBroadcastId] = useState<string | null>(null);
  const [creatingDemo, setCreatingDemo] = useState(false);
  const [sendingMove, setSendingMove] = useState(false);

  // ── Calibration state ───────────────────────────────────────────────────────
  const [calibStep, setCalibStep] = useState<CalibrationStep>("idle");
  const [calibMapping, setCalibMapping] = useState<Record<string, number> | null>(null);
  const [calibPayloads, setCalibPayloads] = useState<{ square: string; idx: number }[]>([]);
  const [calibStatus, setCalibStatus] = useState<"not_calibrated" | "in_progress" | "inferred" | "saved" | "failed">("not_calibrated");

  // ── Checklist state ─────────────────────────────────────────────────────────
  const [checklist, setChecklist] = useState<ChecklistItem[]>(() => {
    try {
      const saved = localStorage.getItem(CHECKLIST_KEY);
      if (saved) return JSON.parse(saved);
    } catch { /* ignore */ }
    return CHECKLIST_DEFAULTS;
  });

  // ── Readiness state ─────────────────────────────────────────────────────────
  const [readinessChecks, setReadinessChecks] = useState<Record<string, "working" | "incomplete" | "not_working" | "unknown">>({
    discovery: "unknown",
    gatt: "unknown",
    services: "unknown",
    notifications: "unknown",
    raw_payload: "unknown",
    parser: "unknown",
    inference: "unknown",
    broadcast_submission: "unknown",
    manual_fallback: "working",
  });

  // ── Persist checklist ───────────────────────────────────────────────────────
  useEffect(() => {
    localStorage.setItem(CHECKLIST_KEY, JSON.stringify(checklist));
  }, [checklist]);

  // ── Load recent UUIDs ───────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const saved = localStorage.getItem(RECENT_UUIDS_KEY);
      if (saved) setRecentUuids(JSON.parse(saved));
    } catch { /* ignore */ }
  }, []);

  // ── Load calibration ────────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CALIBRATION_KEY);
      if (saved) {
        setCalibMapping(JSON.parse(saved));
        setCalibStatus("saved");
      }
    } catch { /* ignore */ }
  }, []);

  // ── Browser detection ───────────────────────────────────────────────────────
  useEffect(() => {
    const ua = navigator.userAgent;
    if (ua.includes("Edg/")) setBrowserName("Microsoft Edge");
    else if (ua.includes("Chrome/")) setBrowserName("Google Chrome");
    else if (ua.includes("Firefox/")) setBrowserName("Mozilla Firefox");
    else if (ua.includes("Safari/")) setBrowserName("Safari");
    else setBrowserName("Unknown Browser");

    setBleSupported("bluetooth" in navigator);
    setIsSecureContext(window.isSecureContext);
  }, []);

  // ── Update readiness when BLE state changes ─────────────────────────────────
  useEffect(() => {
    setReadinessChecks(prev => ({
      ...prev,
      discovery: deviceName ? "working" : prev.discovery,
      gatt: gattConnected ? "working" : (deviceName && !gattConnected ? "not_working" : prev.gatt),
      services: services.length > 0 ? "working" : prev.services,
      notifications: services.some(s => s.characteristics.some(c => c.isSubscribed)) ? "working" : prev.notifications,
      raw_payload: payloads.length > 0 ? "working" : prev.raw_payload,
    }));
  }, [deviceName, gattConnected, services, payloads]);

  // ─── BLE Connect ─────────────────────────────────────────────────────────────
  const connectDevice = useCallback(async () => {
    if (!("bluetooth" in navigator)) {
      setConnectionError("Web Bluetooth is not supported in this browser.");
      return;
    }
    setConnecting(true);
    setConnectionError(null);
    try {
      const extra = extraUuids
        .split(",")
        .map(s => s.trim())
        .filter(Boolean);

      const options: RequestDeviceOptions = advancedMode
        ? {
            acceptAllDevices: true,
            optionalServices: [
              "0000fff0-0000-1000-8000-00805f9b34fb",
              "6e400001-b5a3-f393-e0a9-e50e24dcca9e",
              ...extra,
            ],
          }
        : {
            filters: [
              { namePrefix: "Chessnut" },
              { namePrefix: "CHESSNUT" },
              { namePrefix: "ChessnutGo" },
            ],
            optionalServices: [
              "0000fff0-0000-1000-8000-00805f9b34fb",
              "6e400001-b5a3-f393-e0a9-e50e24dcca9e",
              ...extra,
            ],
          };

      const device = await navigator.bluetooth.requestDevice(options);
      deviceRef.current = device;
      setDeviceName(device.name ?? "Unknown Device");

      device.addEventListener("gattserverdisconnected", () => {
        setGattConnected(false);
        setConnectionError("Bluetooth disconnected. The venue display is preserving the last valid position.");
        toast.error("Chessnut Pro disconnected");
      });

      const server = await device.gatt!.connect();
      gattRef.current = server;
      setGattConnected(true);
      toast.success(`Connected to ${device.name ?? "Chessnut Pro"}`);

      // Auto-discover services
      await discoverServices(server);

      // Save UUIDs to recent list
      if (extra.length > 0) {
        const updated = Array.from(new Set([...extra, ...recentUuids])).slice(0, 10);
        setRecentUuids(updated);
        localStorage.setItem(RECENT_UUIDS_KEY, JSON.stringify(updated));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("User cancelled")) {
        setConnectionError("Device picker was cancelled.");
      } else {
        setConnectionError(msg);
        toast.error("Connection failed: " + msg);
      }
    } finally {
      setConnecting(false);
    }
  }, [advancedMode, extraUuids, recentUuids]);

  const disconnectDevice = useCallback(() => {
    if (gattRef.current?.connected) {
      gattRef.current.disconnect();
    }
    setGattConnected(false);
    setDeviceName(null);
    setServices([]);
    characteristicRefs.current.clear();
    deviceRef.current = null;
    gattRef.current = null;
  }, []);

  // ─── Discover Services ────────────────────────────────────────────────────────
  const discoverServices = useCallback(async (server: BluetoothRemoteGATTServer) => {
    try {
      const rawServices = await server.getPrimaryServices();
      const discovered: BleService[] = [];

      for (const svc of rawServices) {
        const rawChars = await svc.getCharacteristics();
        const chars: BleCharacteristic[] = rawChars.map(c => ({
          uuid: c.uuid,
          properties: {
            read: c.properties.read,
            write: c.properties.write,
            writeWithoutResponse: c.properties.writeWithoutResponse,
            notify: c.properties.notify,
            indicate: c.properties.indicate,
          },
          isSubscribed: false,
          isCandidate: false,
          isWriteCandidate: false,
        }));
        characteristicRefs.current.set(svc.uuid, rawChars[0]); // store first for access
        rawChars.forEach(c => characteristicRefs.current.set(c.uuid, c));
        discovered.push({ uuid: svc.uuid, isPrimary: true, characteristics: chars });
      }

      setServices(discovered);
      setReadinessChecks(prev => ({ ...prev, services: discovered.length > 0 ? "working" : "not_working" }));
    } catch (err) {
      toast.error("Failed to discover services: " + (err instanceof Error ? err.message : String(err)));
      setReadinessChecks(prev => ({ ...prev, services: "not_working" }));
    }
  }, []);

  // ─── Read Characteristic ──────────────────────────────────────────────────────
  const readCharacteristic = useCallback(async (charUuid: string) => {
    const char = characteristicRefs.current.get(charUuid);
    if (!char) return;
    try {
      const value = await char.readValue();
      const bytes = Array.from(new Uint8Array(value.buffer));
      const hex = toHex(bytes);
      setServices(prev => prev.map(s => ({
        ...s,
        characteristics: s.characteristics.map(c =>
          c.uuid === charUuid ? { ...c, value: hex } : c
        ),
      })));
      toast.success(`Read: ${hex.slice(0, 40)}${hex.length > 40 ? "…" : ""}`);
    } catch (err) {
      toast.error("Read failed: " + (err instanceof Error ? err.message : String(err)));
    }
  }, []);

  // ─── Subscribe to Characteristic ─────────────────────────────────────────────
  const subscribeCharacteristic = useCallback(async (charUuid: string, serviceUuid: string) => {
    const char = characteristicRefs.current.get(charUuid);
    if (!char) return;
    try {
      await char.startNotifications();
      char.addEventListener("characteristicvaluechanged", (event: Event) => {
        const target = event.target as BluetoothRemoteGATTCharacteristic;
        if (!target.value) return;
        const bytes = Array.from(new Uint8Array(target.value.buffer));
        const payload: RawPayload = {
          id: String(++payloadIdRef.current),
          timestamp: new Date().toISOString(),
          serviceUuid,
          characteristicUuid: charUuid,
          byteLength: bytes.length,
          hex: toHex(bytes),
          bytes,
          text: tryDecodeText(bytes),
        };
        setPayloads(prev => [payload, ...prev].slice(0, 50));
        setReadinessChecks(p => ({ ...p, raw_payload: "working", notifications: "working" }));

        // If this is the candidate characteristic, try to parse board state
        if (charUuid === candidateCharUuid || candidateCharUuid === null) {
          tryParseBoardState(bytes, charUuid);
        }
      });
      setServices(prev => prev.map(s => ({
        ...s,
        characteristics: s.characteristics.map(c =>
          c.uuid === charUuid ? { ...c, isSubscribed: true } : c
        ),
      })));
      toast.success("Subscribed to notifications");
    } catch (err) {
      toast.error("Subscribe failed: " + (err instanceof Error ? err.message : String(err)));
    }
  }, [candidateCharUuid]);

  const unsubscribeCharacteristic = useCallback(async (charUuid: string) => {
    const char = characteristicRefs.current.get(charUuid);
    if (!char) return;
    try {
      await char.stopNotifications();
      setServices(prev => prev.map(s => ({
        ...s,
        characteristics: s.characteristics.map(c =>
          c.uuid === charUuid ? { ...c, isSubscribed: false } : c
        ),
      })));
      toast.success("Unsubscribed");
    } catch (err) {
      toast.error("Unsubscribe failed: " + (err instanceof Error ? err.message : String(err)));
    }
  }, []);

  // ─── Board State Parser ───────────────────────────────────────────────────────
  // Chessnut Pro sends 36-byte packets: [0x21, 0x01, ...32 bytes of board data...]
  // Each nibble encodes one square. Squares are in order a8→h8, a7→h7, ..., a1→h1
  // Piece encoding: 0=empty, 1=wK, 2=wQ, 3=wR, 4=wB, 5=wN, 6=wP, 7=bK, 8=bQ, 9=bR, A=bB, B=bN, C=bP
  const PIECE_MAP: Record<number, string> = {
    0: "", 1: "K", 2: "Q", 3: "R", 4: "B", 5: "N", 6: "P",
    7: "k", 8: "q", 9: "r", 10: "b", 11: "n", 12: "p",
  };

  const tryParseBoardState = useCallback((bytes: number[], _charUuid: string) => {
    if (bytes.length < 34) return;
    // Skip header bytes if present
    const start = (bytes[0] === 0x21 && bytes[1] === 0x01) ? 2 : 0;
    if (bytes.length - start < 32) return;

    const squares: SquareState[] = [];
    const files = ["a", "b", "c", "d", "e", "f", "g", "h"];

    for (let rank = 7; rank >= 0; rank--) {
      for (let file = 0; file < 8; file++) {
        const byteIdx = start + (7 - rank) * 4 + Math.floor(file / 2);
        const nibble = file % 2 === 0
          ? (bytes[byteIdx] >> 4) & 0x0f
          : bytes[byteIdx] & 0x0f;
        const piece = PIECE_MAP[nibble] ?? "";
        squares.push({ square: `${files[file]}${rank + 1}`, piece });
      }
    }

    setPrevBoardState(currBoardState);
    setCurrBoardState(squares);

    // Try to build FEN from board state
    const fen = buildFenFromSquares(squares);
    if (fen) {
      setParsedFen(fen);
      setReadinessChecks(p => ({ ...p, parser: "working" }));
    } else {
      setReadinessChecks(p => ({ ...p, parser: "incomplete" }));
    }
  }, [currBoardState]);

  function buildFenFromSquares(squares: SquareState[]): string | null {
    try {
      let fen = "";
      for (let rank = 8; rank >= 1; rank--) {
        let empty = 0;
        for (let file = 0; file < 8; file++) {
          const sq = squares.find(s => s.square === `${"abcdefgh"[file]}${rank}`);
          if (!sq || sq.piece === "") {
            empty++;
          } else {
            if (empty > 0) { fen += empty; empty = 0; }
            fen += sq.piece;
          }
        }
        if (empty > 0) fen += empty;
        if (rank > 1) fen += "/";
      }
      return fen + " w - - 0 1"; // side to move unknown from board alone
    } catch {
      return null;
    }
  }

  // ─── Move Inference ───────────────────────────────────────────────────────────
  const runInference = useCallback(() => {
    if (!prevBoardState || !currBoardState) {
      setInferenceResult({ confidence: "none", message: "No board state data available. Connect the board and make a move." });
      return;
    }
    try {
      const chess = new Chess(inferenceFen);
      const legalMoves = chess.moves({ verbose: true });
      const matches: typeof legalMoves = [];

      for (const move of legalMoves) {
        const testChess = new Chess(inferenceFen);
        testChess.move(move);
        const resultFen = testChess.fen().split(" ")[0];
        const expectedFen = buildFenFromSquares(currBoardState)?.split(" ")[0];
        if (resultFen === expectedFen) {
          matches.push(move);
        }
      }

      if (matches.length === 0) {
        setInferenceResult({
          confidence: "mismatch",
          message: "Move rejected. The physical board position does not match the current digital game.",
        });
        setReadinessChecks(p => ({ ...p, inference: "incomplete" }));
      } else if (matches.length === 1) {
        const m = matches[0];
        const afterChess = new Chess(inferenceFen);
        afterChess.move(m);
        setInferenceResult({
          confidence: "exact",
          san: m.san,
          uci: m.from + m.to + (m.promotion ?? ""),
          fenBefore: inferenceFen,
          fenAfter: afterChess.fen(),
          message: `Exact match found: ${m.san}`,
        });
        setReadinessChecks(p => ({ ...p, inference: "working" }));
      } else {
        setInferenceResult({
          confidence: "ambiguous",
          candidates: matches.map(m => m.san),
          message: `Multiple candidate moves found. Operator confirmation required.`,
        });
        setReadinessChecks(p => ({ ...p, inference: "incomplete" }));
      }
    } catch (err) {
      setInferenceResult({
        confidence: "mismatch",
        message: "Inference error: " + (err instanceof Error ? err.message : String(err)),
      });
    }
  }, [prevBoardState, currBoardState, inferenceFen]);

  // ─── Demo Broadcast ───────────────────────────────────────────────────────────
  const createDemoBroadcast = useCallback(async () => {
    setCreatingDemo(true);
    try {
      const res = await fetch("/api/broadcasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tournamentId: "demo",
          roundNumber: 1,
          boardNumber: 1,
          whitePlayerName: "Test White",
          blackPlayerName: "Test Black",
          inputSource: "chessnut_chrome_bluetooth",
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setDemoBroadcastId(data.id);
      toast.success("Demo broadcast created");
    } catch (err) {
      toast.error("Failed to create demo broadcast: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setCreatingDemo(false);
    }
  }, []);

  const sendTestMove = useCallback(async () => {
    if (!inferenceResult || inferenceResult.confidence !== "exact" || !inferenceResult.san) {
      toast.error("No exact move to send");
      return;
    }
    if (!demobroadcastId) {
      toast.error("Create a demo broadcast first");
      return;
    }
    setSendingMove(true);
    try {
      const res = await fetch(`/api/broadcasts/${demobroadcastId}/moves`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          san: inferenceResult.san,
          uci: inferenceResult.uci,
          fenBefore: inferenceResult.fenBefore,
          fenAfter: inferenceResult.fenAfter,
          moveNumber: 1,
          sideToMove: "b",
          source: "chessnut_chrome_bluetooth",
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success(`Move ${inferenceResult.san} sent to demo broadcast`);
      setReadinessChecks(p => ({ ...p, broadcast_submission: "working" }));
      updateChecklist("demo_broadcast", "passed");
    } catch (err) {
      toast.error("Failed to send move: " + (err instanceof Error ? err.message : String(err)));
      setReadinessChecks(p => ({ ...p, broadcast_submission: "not_working" }));
    } finally {
      setSendingMove(false);
    }
  }, [inferenceResult, demobroadcastId]);

  // ─── Checklist ────────────────────────────────────────────────────────────────
  const updateChecklist = useCallback((id: string, status: ChecklistStatus) => {
    setChecklist(prev => prev.map(item => item.id === id ? { ...item, status } : item));
  }, []);

  // ─── Calibration ─────────────────────────────────────────────────────────────
  const calibrationSquences = [
    { step: "place_a1" as CalibrationStep, label: "Place a white rook on a1", square: "a1" },
    { step: "place_h1" as CalibrationStep, label: "Move the rook to h1", square: "h1" },
    { step: "place_a8" as CalibrationStep, label: "Move the rook to a8", square: "a8" },
    { step: "place_h8" as CalibrationStep, label: "Move the rook to h8", square: "h8" },
  ];

  const captureCalibPayload = useCallback(() => {
    if (!currBoardState) {
      toast.error("No board state — subscribe to a characteristic first");
      return;
    }
    const occupied = currBoardState.filter(s => s.piece !== "");
    if (occupied.length !== 1) {
      toast.error(`Expected exactly 1 piece, found ${occupied.length}`);
      return;
    }
    const currentSeq = calibrationSquences.find(s => s.step === calibStep);
    if (!currentSeq) return;

    const squareIdx = currBoardState.findIndex(s => s.piece !== "");
    setCalibPayloads(prev => [...prev, { square: currentSeq.square, idx: squareIdx }]);
    toast.success(`Captured: ${currentSeq.square} → index ${squareIdx}`);

    const steps: CalibrationStep[] = ["place_a1", "place_h1", "place_a8", "place_h8"];
    const currentIdx = steps.indexOf(calibStep);
    if (currentIdx < steps.length - 1) {
      setCalibStep(steps[currentIdx + 1]);
    } else {
      // All 4 captured — infer mapping
      setCalibStep("inferring");
      const mapping: Record<string, number> = {};
      [...calibPayloads, { square: currentSeq.square, idx: squareIdx }].forEach(p => {
        mapping[p.square] = p.idx;
      });
      setCalibMapping(mapping);
      setCalibStatus("inferred");
      setCalibStep("done");
    }
  }, [calibStep, currBoardState, calibPayloads, calibrationSquences]);

  const saveCalibration = useCallback(() => {
    if (!calibMapping) return;
    localStorage.setItem(CALIBRATION_KEY, JSON.stringify(calibMapping));
    setCalibStatus("saved");
    toast.success("Board mapping saved");
  }, [calibMapping]);

  // ─── Readiness Report ─────────────────────────────────────────────────────────
  const computeReadinessLevel = (): ReadinessLevel => {
    const checks = Object.values(readinessChecks);
    const working = checks.filter(c => c === "working").length;
    if (working === 0) return "not_ready";
    if (working <= 2) return "diagnostics_only";
    if (readinessChecks.parser !== "working") return "connected_parser_incomplete";
    if (readinessChecks.inference !== "working") return "parser_working";
    if (readinessChecks.broadcast_submission !== "working") return "ready_for_rehearsal";
    return "event_ready_beta";
  };

  const readinessLevel = computeReadinessLevel();

  const readinessLevelLabel: Record<ReadinessLevel, string> = {
    not_ready: "Not Ready",
    diagnostics_only: "Diagnostics Only",
    connected_parser_incomplete: "Connected — Parser Incomplete",
    parser_working: "Parser Working in Test Lab",
    ready_for_rehearsal: "Ready for Controlled Rehearsal",
    event_ready_beta: "Event Ready Beta",
  };

  const readinessLevelColor: Record<ReadinessLevel, string> = {
    not_ready: "text-red-400 border-red-400/30 bg-red-400/05",
    diagnostics_only: "text-orange-400 border-orange-400/30 bg-orange-400/05",
    connected_parser_incomplete: "text-amber-400 border-amber-400/30 bg-amber-400/05",
    parser_working: "text-yellow-300 border-yellow-300/30 bg-yellow-300/05",
    ready_for_rehearsal: "text-[#4CAF50] border-[#4CAF50]/30 bg-[#4CAF50]/05",
    event_ready_beta: "text-emerald-300 border-emerald-300/30 bg-emerald-300/05",
  };

  const generateReport = useCallback(() => {
    const report = {
      generatedAt: new Date().toISOString(),
      browserSupport: bleSupported ? "supported" : "not_supported",
      browserName,
      isSecureContext,
      deviceName,
      servicesDiscovered: services.length,
      characteristics: services.flatMap(s => s.characteristics.map(c => ({
        uuid: c.uuid,
        properties: c.properties,
        isCandidate: c.isCandidate,
      }))),
      candidateCharacteristic: candidateCharUuid,
      parserStatus: readinessChecks.parser,
      calibrationStatus: calibStatus,
      moveInferenceStatus: readinessChecks.inference,
      broadcastSubmissionStatus: readinessChecks.broadcast_submission,
      checklistResults: checklist.reduce((acc, item) => {
        acc[item.id] = item.status;
        return acc;
      }, {} as Record<string, string>),
      overallReadiness: readinessLevel,
      recommendation:
        readinessLevel === "event_ready_beta" ? "Use Chrome Bluetooth Beta" :
        readinessLevel === "ready_for_rehearsal" ? "Run a full rehearsal before live use" :
        readinessLevel === "parser_working" ? "Use Local Bridge or Manual Mode — parser needs real-device validation" :
        "Use Manual Mode — Chrome Bluetooth is not ready for live use",
      knownIssues: [
        ...(readinessChecks.parser !== "working" ? ["Board-state parser not fully validated with real device"] : []),
        ...(readinessChecks.inference !== "working" ? ["Move inference not validated with real device"] : []),
        ...(readinessChecks.gatt !== "working" ? ["GATT connection not established"] : []),
      ],
    };
    navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    toast.success("Readiness report copied to clipboard");
  }, [bleSupported, browserName, isSecureContext, deviceName, services, candidateCharUuid, readinessChecks, calibStatus, checklist, readinessLevel]);

  // ─── Export Payloads ──────────────────────────────────────────────────────────
  const exportPayloads = useCallback(() => {
    const data = {
      deviceName,
      capturedAt: new Date().toISOString(),
      services: services.map(s => ({ uuid: s.uuid, characteristics: s.characteristics.map(c => c.uuid) })),
      payloads,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chessnut-ble-debug-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("BLE debug log exported");
  }, [deviceName, services, payloads]);

  // ─── Render helpers ───────────────────────────────────────────────────────────
  function SectionHeader({ id, icon, title, badge }: { id: string; icon: React.ReactNode; title: string; badge?: string }) {
    const isOpen = openSections.has(id);
    return (
      <button
        onClick={() => toggleSection(id)}
        className="w-full flex items-center justify-between p-4 hover:bg-white/03 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-[#4CAF50]">{icon}</span>
          <span className="text-sm font-bold text-white/80 uppercase tracking-wider">{title}</span>
          {badge && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#4CAF50]/15 text-[#4CAF50] border border-[#4CAF50]/20">
              {badge}
            </span>
          )}
        </div>
        {isOpen ? <ChevronDown className="w-4 h-4 text-white/30" /> : <ChevronRight className="w-4 h-4 text-white/30" />}
      </button>
    );
  }

  function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
    return (
      <div className={`rounded-xl border border-white/08 bg-[oklch(0.14_0.04_145)] ${className}`}>
        {children}
      </div>
    );
  }

  const checklistStatusColors: Record<ChecklistStatus, string> = {
    not_tested: "text-white/30 border-white/10",
    passed: "text-[#4CAF50] border-[#4CAF50]/30 bg-[#4CAF50]/08",
    failed: "text-red-400 border-red-400/30 bg-red-400/08",
    skipped: "text-white/40 border-white/15",
  };

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[oklch(0.10_0.04_145)] text-white">
      {/* Header */}
      <div className="border-b border-white/08 bg-[oklch(0.12_0.04_145)] sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FlaskConical className="w-5 h-5 text-[#4CAF50]" />
            <div>
              <h1 className="text-sm font-bold text-white">Chessnut Pro Bluetooth Test Lab</h1>
              <p className="text-[10px] text-white/40">Internal diagnostic tool — admin only</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={`px-3 py-1.5 rounded-lg border text-xs font-bold ${readinessLevelColor[readinessLevel]}`}>
              {readinessLevelLabel[readinessLevel]}
            </div>
            {gattConnected ? (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#4CAF50]/10 border border-[#4CAF50]/20">
                <BluetoothConnected className="w-3.5 h-3.5 text-[#4CAF50]" />
                <span className="text-[11px] text-[#4CAF50] font-medium">{deviceName}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/05 border border-white/10">
                <BluetoothOff className="w-3.5 h-3.5 text-white/40" />
                <span className="text-[11px] text-white/40">Not connected</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">

        {/* ═══ SECTION 1: Browser Compatibility ═══ */}
        <Card>
          <SectionHeader id="compat" icon={<Shield className="w-4 h-4" />} title="1. Browser Compatibility" />
          {openSections.has("compat") && (
            <div className="p-4 pt-0 space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  {
                    label: "Web Bluetooth API",
                    value: bleSupported === null ? "Checking…" : bleSupported ? "Supported" : "Not Supported",
                    ok: bleSupported === true,
                  },
                  {
                    label: "Secure Context",
                    value: isSecureContext ? "HTTPS / localhost" : "Not Secure",
                    ok: isSecureContext,
                  },
                  {
                    label: "Browser",
                    value: browserName,
                    ok: browserName.includes("Chrome") || browserName.includes("Edge"),
                  },
                  {
                    label: "Can Use Bluetooth",
                    value: bleSupported && isSecureContext ? "Yes" : "No",
                    ok: !!(bleSupported && isSecureContext),
                  },
                ].map(item => (
                  <div key={item.label} className={`p-3 rounded-lg border ${item.ok ? "border-[#4CAF50]/20 bg-[#4CAF50]/05" : "border-red-400/20 bg-red-400/05"}`}>
                    <div className="text-[10px] text-white/40 mb-1">{item.label}</div>
                    <div className={`text-sm font-bold ${item.ok ? "text-[#4CAF50]" : "text-red-400"}`}>{item.value}</div>
                  </div>
                ))}
              </div>
              {(!bleSupported || !isSecureContext) && (
                <div className="p-3 rounded-lg bg-amber-400/08 border border-amber-400/20 text-xs text-amber-300">
                  <strong>Action required:</strong> Use Chrome or Edge on desktop. Make sure the site is served over HTTPS or localhost. Web Bluetooth is not available in Firefox, Safari, or non-secure contexts.
                </div>
              )}
            </div>
          )}
        </Card>

        {/* ═══ SECTION 2: Device Connection ═══ */}
        <Card>
          <SectionHeader id="connect" icon={<Bluetooth className="w-4 h-4" />} title="2. Device Connection" badge={gattConnected ? "Connected" : undefined} />
          {openSections.has("connect") && (
            <div className="p-4 pt-0 space-y-4">
              <div className="p-3 rounded-lg bg-white/03 border border-white/05 text-[11px] text-white/50">
                Some Bluetooth devices do not appear unless they are powered on, charged, nearby, and not already connected to another app.
              </div>

              {/* Advanced mode toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium text-white/70">Advanced Discovery Mode</div>
                  <div className="text-[10px] text-white/40">Shows all nearby Bluetooth devices (not just Chessnut)</div>
                </div>
                <button
                  onClick={() => setAdvancedMode(!advancedMode)}
                  className={`w-10 h-5 rounded-full transition-colors relative ${advancedMode ? "bg-[#4CAF50]" : "bg-white/15"}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${advancedMode ? "translate-x-5" : "translate-x-0.5"}`} />
                </button>
              </div>

              {/* Optional UUIDs */}
              <div>
                <label className="text-[10px] text-white/40 block mb-1">Optional Service UUIDs (comma-separated)</label>
                <input
                  value={extraUuids}
                  onChange={e => setExtraUuids(e.target.value)}
                  placeholder="e.g. 0000fff0-0000-1000-8000-00805f9b34fb"
                  className="w-full px-3 py-2 rounded-lg bg-white/05 border border-white/10 text-xs text-white/80 placeholder:text-white/25 focus:outline-none focus:border-[#4CAF50]/40"
                />
                {recentUuids.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {recentUuids.map(u => (
                      <button key={u} onClick={() => setExtraUuids(u)} className="text-[9px] px-2 py-0.5 rounded bg-white/05 border border-white/08 text-white/40 hover:text-white/60">
                        {u.slice(0, 8)}…
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Connection buttons */}
              <div className="flex gap-2">
                <button
                  onClick={connectDevice}
                  disabled={connecting || !bleSupported || !isSecureContext}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#4CAF50]/15 border border-[#4CAF50]/25 text-[#4CAF50] text-xs font-medium hover:bg-[#4CAF50]/25 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {connecting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <BluetoothSearching className="w-3.5 h-3.5" />}
                  {connecting ? "Connecting…" : "Connect Chessnut Pro"}
                </button>
                {gattConnected && (
                  <button
                    onClick={disconnectDevice}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg border border-red-400/25 text-red-400 text-xs hover:bg-red-400/08"
                  >
                    <BluetoothOff className="w-3.5 h-3.5" /> Disconnect
                  </button>
                )}
                {deviceRef.current && !gattConnected && (
                  <button
                    onClick={connectDevice}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg border border-amber-400/25 text-amber-400 text-xs hover:bg-amber-400/08"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Reconnect
                  </button>
                )}
              </div>

              {/* Status */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded-lg bg-white/03 border border-white/05">
                  <span className="text-white/40">Device: </span>
                  <span className="text-white/70">{deviceName ?? "None"}</span>
                </div>
                <div className="p-2 rounded-lg bg-white/03 border border-white/05">
                  <span className="text-white/40">GATT: </span>
                  <span className={gattConnected ? "text-[#4CAF50]" : "text-white/40"}>
                    {gattConnected ? "Connected" : "Disconnected"}
                  </span>
                </div>
              </div>
              {connectionError && (
                <div className="p-3 rounded-lg bg-red-400/08 border border-red-400/20 text-xs text-red-300">
                  {connectionError}
                </div>
              )}
            </div>
          )}
        </Card>

        {/* ═══ SECTION 3: BLE Services & Characteristics ═══ */}
        <Card>
          <SectionHeader id="services" icon={<Cpu className="w-4 h-4" />} title="3. BLE Services & Characteristics" badge={services.length > 0 ? `${services.length} services` : undefined} />
          {openSections.has("services") && (
            <div className="p-4 pt-0 space-y-3">
              {services.length === 0 ? (
                <div className="text-xs text-white/30 text-center py-6">
                  {gattConnected ? "No services discovered yet." : "Connect a device to discover services."}
                </div>
              ) : (
                <>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(JSON.stringify(services, null, 2));
                        toast.success("Services copied as JSON");
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-white/50 text-xs hover:bg-white/05"
                    >
                      <Copy className="w-3 h-3" /> Copy All as JSON
                    </button>
                  </div>
                  {services.map(svc => (
                    <div key={svc.uuid} className="rounded-lg border border-white/08 overflow-hidden">
                      <button
                        onClick={() => setExpandedServices(prev => {
                          const next = new Set(prev);
                          if (next.has(svc.uuid)) { next.delete(svc.uuid); } else { next.add(svc.uuid); }
                          return next;
                        })}
                        className="w-full flex items-center justify-between p-3 hover:bg-white/03 text-left"
                      >
                        <div>
                          <div className="text-xs font-mono text-white/70">{svc.uuid}</div>
                          <div className="text-[10px] text-white/30">{svc.characteristics.length} characteristics</div>
                        </div>
                        {expandedServices.has(svc.uuid) ? <ChevronDown className="w-3.5 h-3.5 text-white/30" /> : <ChevronRight className="w-3.5 h-3.5 text-white/30" />}
                      </button>
                      {expandedServices.has(svc.uuid) && (
                        <div className="border-t border-white/05 divide-y divide-white/05">
                          {svc.characteristics.map(char => (
                            <div key={char.uuid} className={`p-3 space-y-2 ${char.isCandidate ? "bg-[#4CAF50]/05" : ""}`}>
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="text-[11px] font-mono text-white/60 truncate">{char.uuid}</div>
                                  <div className="flex gap-1 mt-1 flex-wrap">
                                    {char.properties.read && <span className="px-1.5 py-0.5 rounded text-[9px] bg-blue-400/10 text-blue-300 border border-blue-400/20">read</span>}
                                    {char.properties.write && <span className="px-1.5 py-0.5 rounded text-[9px] bg-purple-400/10 text-purple-300 border border-purple-400/20">write</span>}
                                    {char.properties.writeWithoutResponse && <span className="px-1.5 py-0.5 rounded text-[9px] bg-purple-400/10 text-purple-300 border border-purple-400/20">write-no-resp</span>}
                                    {char.properties.notify && <span className="px-1.5 py-0.5 rounded text-[9px] bg-[#4CAF50]/10 text-[#4CAF50] border border-[#4CAF50]/20">notify</span>}
                                    {char.properties.indicate && <span className="px-1.5 py-0.5 rounded text-[9px] bg-amber-400/10 text-amber-300 border border-amber-400/20">indicate</span>}
                                  </div>
                                  {char.value && (
                                    <div className="mt-1 text-[10px] font-mono text-white/40 truncate">Last read: {char.value}</div>
                                  )}
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                <button onClick={() => navigator.clipboard.writeText(char.uuid).then(() => toast.success("UUID copied"))} className="text-[10px] px-2 py-1 rounded border border-white/10 text-white/40 hover:text-white/60 hover:bg-white/05">
                                  Copy UUID
                                </button>
                                {char.properties.read && (
                                  <button onClick={() => readCharacteristic(char.uuid)} className="text-[10px] px-2 py-1 rounded border border-blue-400/20 text-blue-300 hover:bg-blue-400/08">
                                    Read
                                  </button>
                                )}
                                {char.properties.notify && !char.isSubscribed && (
                                  <button onClick={() => subscribeCharacteristic(char.uuid, svc.uuid)} className="text-[10px] px-2 py-1 rounded border border-[#4CAF50]/20 text-[#4CAF50] hover:bg-[#4CAF50]/08">
                                    Subscribe
                                  </button>
                                )}
                                {char.isSubscribed && (
                                  <button onClick={() => unsubscribeCharacteristic(char.uuid)} className="text-[10px] px-2 py-1 rounded border border-amber-400/20 text-amber-300 hover:bg-amber-400/08">
                                    Stop Notifications
                                  </button>
                                )}
                                <button
                                  onClick={() => {
                                    setCandidateCharUuid(char.uuid);
                                    setServices(prev => prev.map(s => ({
                                      ...s,
                                      characteristics: s.characteristics.map(c => ({
                                        ...c,
                                        isCandidate: c.uuid === char.uuid,
                                      })),
                                    })));
                                    toast.success("Marked as board-state candidate");
                                  }}
                                  className={`text-[10px] px-2 py-1 rounded border ${char.isCandidate ? "border-[#4CAF50]/40 text-[#4CAF50] bg-[#4CAF50]/10" : "border-white/10 text-white/40 hover:text-white/60 hover:bg-white/05"}`}
                                >
                                  {char.isCandidate ? "✓ Board-State Candidate" : "Mark as Candidate"}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </Card>

        {/* ═══ SECTION 4: Raw Payload Monitor ═══ */}
        <Card>
          <SectionHeader id="payloads" icon={<Activity className="w-4 h-4" />} title="4. Raw Payload Monitor" badge={payloads.length > 0 ? `${payloads.length} payloads` : undefined} />
          {openSections.has("payloads") && (
            <div className="p-4 pt-0 space-y-3">
              <div className="p-3 rounded-lg bg-white/03 border border-white/05 text-[11px] text-white/50">
                Move one piece at a time on the board while recording payloads. Capture starting position, e2→e4, e7→e5, g1→f3, and one capture if possible.
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setRecording(!recording)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium ${recording ? "border-red-400/25 text-red-400 bg-red-400/08" : "border-[#4CAF50]/25 text-[#4CAF50] bg-[#4CAF50]/08"}`}
                >
                  {recording ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                  {recording ? "Stop Recording" : "Start Recording"}
                </button>
                <button onClick={exportPayloads} disabled={payloads.length === 0} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 text-white/50 text-xs hover:bg-white/05 disabled:opacity-40">
                  <Download className="w-3 h-3" /> Export BLE Debug Log JSON
                </button>
                <button onClick={() => setPayloads([])} disabled={payloads.length === 0} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 text-white/50 text-xs hover:bg-white/05 disabled:opacity-40">
                  <Trash2 className="w-3 h-3" /> Clear
                </button>
              </div>
              {payloads.length === 0 ? (
                <div className="text-xs text-white/25 text-center py-8">No payloads yet. Subscribe to a characteristic and move a piece.</div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {payloads.map(p => (
                    <div key={p.id} className="p-3 rounded-lg bg-white/03 border border-white/05 font-mono text-[10px] space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-white/30">{new Date(p.timestamp).toLocaleTimeString()}</span>
                        <span className="text-white/30">{p.byteLength} bytes</span>
                      </div>
                      <div className="text-white/50 break-all">{p.hex}</div>
                      <div className="text-white/30">[{p.bytes.join(", ")}]</div>
                      {p.text && <div className="text-amber-300/60">UTF-8: {p.text}</div>}
                      <div className="text-white/20 truncate">char: {p.characteristicUuid}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>

        {/* ═══ SECTION 5: Board-State Debugger ═══ */}
        <Card>
          <SectionHeader id="board" icon={<Target className="w-4 h-4" />} title="5. Board-State Debugger" />
          {openSections.has("board") && (
            <div className="p-4 pt-0 space-y-4">
              {!currBoardState ? (
                <div className="text-xs text-white/30 text-center py-8">
                  No board state data. Subscribe to a notifiable characteristic and move a piece.
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: "Previous State", state: prevBoardState },
                      { label: "Current State", state: currBoardState },
                    ].map(({ label, state }) => (
                      <div key={label}>
                        <div className="text-[10px] text-white/40 mb-2">{label}</div>
                        {state ? (
                          <div className="grid grid-cols-8 gap-0.5">
                            {["8","7","6","5","4","3","2","1"].flatMap(rank =>
                              ["a","b","c","d","e","f","g","h"].map(file => {
                                const sq = state.find(s => s.square === `${file}${rank}`);
                                const changed = prevBoardState && currBoardState &&
                                  prevBoardState.find(s => s.square === `${file}${rank}`)?.piece !==
                                  currBoardState.find(s => s.square === `${file}${rank}`)?.piece;
                                const isDark = (file.charCodeAt(0) - 97 + parseInt(rank)) % 2 === 0;
                                return (
                                  <div
                                    key={`${file}${rank}`}
                                    className={`aspect-square flex items-center justify-center text-[8px] font-bold rounded-sm
                                      ${changed ? "ring-1 ring-amber-400" : ""}
                                      ${isDark ? "bg-[#2d5a27]" : "bg-[#4a7c3f]/40"}
                                    `}
                                  >
                                    {sq?.piece && (
                                      <span className={sq.piece === sq.piece.toUpperCase() ? "text-white" : "text-black/80"}>
                                        {sq.piece.toUpperCase()}
                                      </span>
                                    )}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        ) : (
                          <div className="text-xs text-white/20 text-center py-4">No data</div>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="p-2 rounded bg-white/03 border border-white/05">
                      <span className="text-white/40">Pieces: </span>
                      <span className="text-white/70">{currBoardState.filter(s => s.piece !== "").length}/32</span>
                    </div>
                    <div className="p-2 rounded bg-white/03 border border-white/05">
                      <span className="text-white/40">Changed: </span>
                      <span className="text-amber-300">
                        {prevBoardState
                          ? currBoardState.filter((s, i) => s.piece !== prevBoardState[i]?.piece).length
                          : "—"}
                      </span>
                    </div>
                    <div className="p-2 rounded bg-white/03 border border-white/05">
                      <span className="text-white/40">FEN: </span>
                      <span className="text-white/60 font-mono text-[9px]">{parsedFen?.split(" ")[0].slice(0, 20) ?? "—"}</span>
                    </div>
                  </div>
                  {currBoardState.filter(s => s.piece !== "").length !== 32 && (
                    <div className="p-3 rounded-lg bg-amber-400/08 border border-amber-400/20 text-xs text-amber-300">
                      Starting position does not match. Check piece placement or board orientation. Expected 32 pieces, found {currBoardState.filter(s => s.piece !== "").length}.
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </Card>

        {/* ═══ SECTION 6: Move Inference Tester ═══ */}
        <Card>
          <SectionHeader id="inference" icon={<Zap className="w-4 h-4" />} title="6. Move Inference Tester" />
          {openSections.has("inference") && (
            <div className="p-4 pt-0 space-y-4">
              <div>
                <label className="text-[10px] text-white/40 block mb-1">Current FEN (position before the move)</label>
                <input
                  value={inferenceFen}
                  onChange={e => setInferenceFen(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white/05 border border-white/10 text-xs font-mono text-white/80 focus:outline-none focus:border-[#4CAF50]/40"
                />
              </div>
              <button
                onClick={runInference}
                disabled={!currBoardState}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#4CAF50]/15 border border-[#4CAF50]/25 text-[#4CAF50] text-xs font-medium hover:bg-[#4CAF50]/25 disabled:opacity-40"
              >
                <Zap className="w-3.5 h-3.5" /> Run Move Inference
              </button>

              {inferenceResult && (
                <div className={`p-4 rounded-lg border space-y-2 ${
                  inferenceResult.confidence === "exact" ? "border-[#4CAF50]/30 bg-[#4CAF50]/05" :
                  inferenceResult.confidence === "ambiguous" ? "border-amber-400/30 bg-amber-400/05" :
                  "border-red-400/30 bg-red-400/05"
                }`}>
                  <div className="flex items-center gap-2">
                    {inferenceResult.confidence === "exact" && <CheckCircle2 className="w-4 h-4 text-[#4CAF50]" />}
                    {inferenceResult.confidence === "ambiguous" && <AlertTriangle className="w-4 h-4 text-amber-400" />}
                    {(inferenceResult.confidence === "mismatch" || inferenceResult.confidence === "none") && <XCircle className="w-4 h-4 text-red-400" />}
                    <span className="text-xs font-medium text-white/80">{inferenceResult.message}</span>
                  </div>
                  {inferenceResult.san && (
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div><span className="text-white/40">SAN: </span><span className="text-white font-bold">{inferenceResult.san}</span></div>
                      <div><span className="text-white/40">UCI: </span><span className="font-mono text-white/70">{inferenceResult.uci}</span></div>
                    </div>
                  )}
                  {inferenceResult.candidates && (
                    <div className="text-xs">
                      <span className="text-white/40">Candidates: </span>
                      <span className="text-amber-300">{inferenceResult.candidates.join(", ")}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Demo broadcast integration */}
              <div className="border-t border-white/08 pt-4 space-y-3">
                <div className="text-xs font-medium text-white/60">Send Test Move to Demo Broadcast</div>
                {!demobroadcastId ? (
                  <button
                    onClick={createDemoBroadcast}
                    disabled={creatingDemo}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 text-white/50 text-xs hover:bg-white/05 disabled:opacity-40"
                  >
                    {creatingDemo ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Radio className="w-3 h-3" />}
                    Create Demo Broadcast
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="text-[10px] text-[#4CAF50]">Demo broadcast ready: {demobroadcastId.slice(0, 8)}…</div>
                    <a
                      href={`/live/board/${demobroadcastId}/display`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-white/40 hover:text-white/60 underline"
                    >
                      Open Venue Display
                    </a>
                  </div>
                )}
                {demobroadcastId && (
                  <button
                    onClick={sendTestMove}
                    disabled={sendingMove || inferenceResult?.confidence !== "exact"}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#4CAF50]/15 border border-[#4CAF50]/25 text-[#4CAF50] text-xs font-medium hover:bg-[#4CAF50]/25 disabled:opacity-40"
                  >
                    {sendingMove ? <RefreshCw className="w-3 h-3 animate-spin" /> : <ArrowRight className="w-3 h-3" />}
                    Send Test Move to Demo Broadcast
                  </button>
                )}
              </div>
            </div>
          )}
        </Card>

        {/* ═══ BOARD MAPPING CALIBRATION ═══ */}
        <Card>
          <SectionHeader id="calibration" icon={<Settings className="w-4 h-4" />} title="Board Mapping Calibration" badge={calibStatus !== "not_calibrated" ? calibStatus.replace("_", " ") : undefined} />
          {openSections.has("calibration") && (
            <div className="p-4 pt-0 space-y-4">
              <div className="text-xs text-white/50">
                If the board connects but square orientation is unclear, use this calibration flow to map physical board positions to digital squares.
              </div>
              <div className="flex items-center gap-3">
                <div className={`px-3 py-1.5 rounded-lg border text-xs font-medium ${
                  calibStatus === "saved" ? "border-[#4CAF50]/30 bg-[#4CAF50]/08 text-[#4CAF50]" :
                  calibStatus === "inferred" ? "border-amber-400/30 bg-amber-400/08 text-amber-300" :
                  calibStatus === "in_progress" ? "border-blue-400/30 bg-blue-400/08 text-blue-300" :
                  calibStatus === "failed" ? "border-red-400/30 bg-red-400/08 text-red-400" :
                  "border-white/10 text-white/40"
                }`}>
                  {calibStatus === "not_calibrated" ? "Not Calibrated" :
                   calibStatus === "in_progress" ? "Calibration In Progress" :
                   calibStatus === "inferred" ? "Mapping Inferred" :
                   calibStatus === "saved" ? "Mapping Saved" : "Calibration Failed"}
                </div>
              </div>

              {calibStep === "idle" && (
                <button
                  onClick={() => { setCalibStep("clear_board"); setCalibStatus("in_progress"); setCalibPayloads([]); }}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 text-white/50 text-xs hover:bg-white/05"
                >
                  <Play className="w-3 h-3" /> Start Calibration
                </button>
              )}

              {calibStep === "clear_board" && (
                <div className="p-4 rounded-lg bg-blue-400/05 border border-blue-400/20 space-y-3">
                  <div className="text-xs text-blue-300 font-medium">Step 1: Clear the board completely</div>
                  <div className="text-xs text-white/50">Remove all pieces from the board, then click Continue.</div>
                  <button onClick={() => setCalibStep("place_a1")} className="px-3 py-2 rounded-lg bg-blue-400/15 border border-blue-400/25 text-blue-300 text-xs hover:bg-blue-400/25">
                    Continue →
                  </button>
                </div>
              )}

              {["place_a1", "place_h1", "place_a8", "place_h8"].includes(calibStep) && (
                <div className="p-4 rounded-lg bg-blue-400/05 border border-blue-400/20 space-y-3">
                  <div className="text-xs text-blue-300 font-medium">
                    {calibrationSquences.find(s => s.step === calibStep)?.label}
                  </div>
                  <div className="text-xs text-white/50">Place the piece, wait for a payload to be received, then click Capture.</div>
                  <div className="text-[10px] text-white/30">Payloads captured: {calibPayloads.length}/4</div>
                  <button onClick={captureCalibPayload} disabled={!currBoardState} className="px-3 py-2 rounded-lg bg-blue-400/15 border border-blue-400/25 text-blue-300 text-xs hover:bg-blue-400/25 disabled:opacity-40">
                    Capture Position
                  </button>
                </div>
              )}

              {calibStep === "done" && calibMapping && (
                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-[#4CAF50]/05 border border-[#4CAF50]/20 text-xs text-[#4CAF50]">
                    Board mapping inferred from 4 corner positions.
                  </div>
                  <div className="font-mono text-[10px] text-white/40 p-3 rounded bg-white/03 border border-white/05">
                    {JSON.stringify(calibMapping, null, 2)}
                  </div>
                  {calibStatus !== "saved" && (
                    <button onClick={saveCalibration} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#4CAF50]/15 border border-[#4CAF50]/25 text-[#4CAF50] text-xs hover:bg-[#4CAF50]/25">
                      Save Mapping Profile
                    </button>
                  )}
                </div>
              )}

              {calibStep !== "idle" && calibStep !== "done" && (
                <button
                  onClick={() => { setCalibStep("idle"); setCalibStatus("not_calibrated"); setCalibPayloads([]); }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 text-white/40 text-xs hover:bg-white/05"
                >
                  <RotateCcw className="w-3 h-3" /> Reset Calibration
                </button>
              )}
            </div>
          )}
        </Card>

        {/* ═══ SECTION 7: Production Readiness Status ═══ */}
        <Card>
          <SectionHeader id="readiness" icon={<CheckCircle2 className="w-4 h-4" />} title="7. Production Readiness Status" />
          {openSections.has("readiness") && (
            <div className="p-4 pt-0 space-y-4">
              <div className="space-y-2">
                {[
                  { key: "discovery", label: "Bluetooth Discovery" },
                  { key: "gatt", label: "GATT Connection" },
                  { key: "services", label: "Service Discovery" },
                  { key: "notifications", label: "Notification Subscription" },
                  { key: "raw_payload", label: "Raw Payload Received" },
                  { key: "parser", label: "Board-State Parser" },
                  { key: "inference", label: "Move Inference" },
                  { key: "broadcast_submission", label: "Broadcast Submission" },
                  { key: "manual_fallback", label: "Manual Fallback" },
                ].map(({ key, label }) => {
                  const status = readinessChecks[key] as "working" | "incomplete" | "not_working" | "unknown";
                  return (
                    <div key={key} className="flex items-center justify-between py-2 border-b border-white/05 last:border-0">
                      <span className="text-xs text-white/60">{label}</span>
                      <div className={`flex items-center gap-1.5 text-xs font-medium ${statusColor(status)}`}>
                        {statusIcon(status)}
                        <span className="capitalize">{status.replace("_", " ")}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className={`p-4 rounded-xl border text-center ${readinessLevelColor[readinessLevel]}`}>
                <div className="text-xs text-white/40 mb-1">Overall Status</div>
                <div className="text-lg font-bold">{readinessLevelLabel[readinessLevel]}</div>
                {readinessLevel === "not_ready" && (
                  <div className="text-xs mt-2 opacity-70">Chrome can see the board, but ChessOTB has not identified the board-state data yet.</div>
                )}
                {readinessLevel === "diagnostics_only" && (
                  <div className="text-xs mt-2 opacity-70">Raw Bluetooth data is being received. Parser configuration is still needed.</div>
                )}
                {readinessLevel === "connected_parser_incomplete" && (
                  <div className="text-xs mt-2 opacity-70">Chrome can see the board, but ChessOTB has not identified the board-state data yet.</div>
                )}
                {readinessLevel === "event_ready_beta" && (
                  <div className="text-xs mt-2 opacity-70">Chessnut Bluetooth passed the demo test. Run a full rehearsal before using it live.</div>
                )}
              </div>

              <div className="p-3 rounded-lg bg-white/03 border border-white/05 text-xs text-white/50">
                <strong className="text-white/70">Recommendation:</strong> For tournament reliability, Manual Mode remains the safest production input. Use Chessnut Chrome Bluetooth only after a successful rehearsal with the physical board.
              </div>

              <button
                onClick={generateReport}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-white/10 text-white/60 text-xs hover:bg-white/05"
              >
                <FileText className="w-3.5 h-3.5" /> Generate Chessnut Bluetooth Readiness Report
              </button>
            </div>
          )}
        </Card>

        {/* ═══ REAL-DEVICE TEST CHECKLIST ═══ */}
        <Card>
          <SectionHeader
            id="checklist"
            icon={<ClipboardList className="w-4 h-4" />}
            title="Real-Device Test Checklist"
            badge={`${checklist.filter(i => i.status === "passed").length}/${checklist.length} passed`}
          />
          {openSections.has("checklist") && (
            <div className="p-4 pt-0 space-y-2">
              {checklist.map(item => (
                <div key={item.id} className={`flex items-center justify-between p-2.5 rounded-lg border ${checklistStatusColors[item.status]}`}>
                  <span className="text-xs text-white/70">{item.label}</span>
                  <div className="flex gap-1">
                    {(["not_tested", "passed", "failed", "skipped"] as ChecklistStatus[]).map(s => (
                      <button
                        key={s}
                        onClick={() => updateChecklist(item.id, s)}
                        className={`text-[9px] px-2 py-0.5 rounded border transition-colors ${
                          item.status === s
                            ? s === "passed" ? "bg-[#4CAF50]/20 border-[#4CAF50]/40 text-[#4CAF50]" :
                              s === "failed" ? "bg-red-400/20 border-red-400/40 text-red-400" :
                              s === "skipped" ? "bg-white/10 border-white/20 text-white/60" :
                              "bg-white/05 border-white/15 text-white/40"
                            : "border-white/05 text-white/20 hover:text-white/40"
                        }`}
                      >
                        {s === "not_tested" ? "—" : s === "passed" ? "✓" : s === "failed" ? "✗" : "skip"}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <button
                onClick={() => setChecklist(CHECKLIST_DEFAULTS)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/08 text-white/30 text-xs hover:bg-white/05 mt-2"
              >
                <RotateCcw className="w-3 h-3" /> Reset Checklist
              </button>
            </div>
          )}
        </Card>

      </div>
    </div>
  );
}
