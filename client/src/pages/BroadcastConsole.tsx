/**
 * OTB Chess — Tournament Day Broadcast Console
 * Route: /tournament/:id/broadcast-console
 *
 * A calm, operational control room for managing Board 1 live broadcasts.
 * Includes: Status Bar, Setup Checklist, Board Control (with Live Operator Mode),
 * Venue Display Monitor, Bridge/Manual Status, Broadcast Logs, Post-Game Export.
 */
import BarLoader from "@/components/ui/bar-loader";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import type { SquareHandlerArgs, PieceDropHandlerArgs } from "react-chessboard";
import { toast } from "sonner";
import {
  Play, Pause, RotateCcw, Copy, Download, ExternalLink,
  Radio, ChevronLeft, Zap, AlertTriangle, CheckCircle2,
  Clock, Monitor, QrCode, SkipBack, FlipVertical,
  Square, Wifi, WifiOff, Shield, Eye, Settings,
  ChevronDown, ChevronUp, Activity, FileText, Share2,
  LifeBuoy, ListChecks, Maximize2, Minimize2, Send,
  RotateCw, AlertCircle, Info, XCircle, Check, ArrowLeftRight,
  Cpu, Plug, Keyboard, Bluetooth
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { ChessnutChromeBTPanel } from "@/components/ChessnutChromeBTPanel";
import { ChessnutBoardPanel } from "@/components/ChessnutBoardPanel";
import { QRCodeSVG } from "qrcode.react";
import { OTBLoader } from "@/components/OTBLoader";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Broadcast {
  id: string;
  tournamentId: string;
  roundNumber: number;
  boardNumber: number;
  whitePlayerName: string;
  blackPlayerName: string;
  whitePlayerElo?: number | null;
  blackPlayerElo?: number | null;
  status: "ready" | "live" | "paused" | "finished" | "error";
  inputSource: "manual" | "chessnut_pro_beta" | "chessnut_chrome_bluetooth" | "pgn_import";
  displayMode: "standard" | "minimal" | "overlay" | "board_only";
  displaySettings?: Record<string, unknown> | null;
  tournamentName?: string | null;
  bridgeToken?: string | null;
  bridgeStatus?: string | null;
  bridgeDeviceName?: string | null;
  bridgeLastSeenAt?: string | null;
  bridgeErrorMessage?: string | null;
  currentFen: string;
  pgn: string;
  lastMoveSan?: string | null;
  lastMoveUci?: string | null;
  moveNumber: number;
  sideToMove: "w" | "b";
  result?: string | null;
  publicSlug: string;
}

type SyncState = "idle" | "syncing" | "saved" | "error";
type OperatorStatus = "ready" | "move_saved" | "waiting_white" | "waiting_black" | "error_illegal" | "syncing" | "display_connected" | "manual_active";

interface LogEntry {
  id: string;
  timestamp: number;
  type: "move" | "display" | "bridge" | "system" | "error";
  severity: "info" | "success" | "warning" | "error";
  message: string;
}

// ─── Checklist Item Type ──────────────────────────────────────────────────────
interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  status?: "incomplete" | "complete" | "warning";
  actionLabel?: string;
  actionFn?: () => void;
}

// ─── Confirmation Dialog ──────────────────────────────────────────────────────
function ConfirmDialog({ open, title, message, confirmLabel, onConfirm, onCancel }: {
  open: boolean; title: string; message: string; confirmLabel?: string; onConfirm: () => void; onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[oklch(0.15_0.04_145)] border border-white/10 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
        <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
        <p className="text-sm text-white/60 mb-5">{message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 text-sm rounded-lg border border-white/10 text-white/70 hover:bg-white/5">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2 text-sm rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 font-medium">
            {confirmLabel ?? "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: Broadcast["status"] }) {
  const map: Record<string, { label: string; cls: string }> = {
    ready:    { label: "Ready",    cls: "bg-[#436850]/20 text-[#436850]/70 border-[#436850]/30" },
    live:     { label: "● LIVE",   cls: "bg-red-500/20 text-red-400 border-red-500/30 animate-pulse" },
    paused:   { label: "Paused",   cls: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
    finished: { label: "Finished", cls: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
    error:    { label: "Error",    cls: "bg-red-700/20 text-red-300 border-red-700/30" },
  };
  const { label, cls } = map[status] ?? map.ready;
  return <span className={`text-xs font-bold px-2.5 py-1 rounded-full border tracking-widest uppercase ${cls}`}>{label}</span>;
}

// ─── Operator Confidence Badge ────────────────────────────────────────────────
function OperatorBadge({ status }: { status: OperatorStatus }) {
  const map: Record<OperatorStatus, { label: string; cls: string }> = {
    ready:            { label: "Ready",              cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
    move_saved:       { label: "Move saved",         cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
    waiting_white:    { label: "Waiting for White",  cls: "bg-white/10 text-white/70 border-white/20" },
    waiting_black:    { label: "Waiting for Black",  cls: "bg-[#436850]/20 text-[#436850]/70 border-[#436850]/30" },
    error_illegal:    { label: "Illegal move",       cls: "bg-red-500/15 text-red-400 border-red-500/30" },
    syncing:          { label: "Syncing…",           cls: "bg-blue-500/15 text-blue-400 border-blue-500/30 animate-pulse" },
    display_connected:{ label: "Display connected",  cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
    manual_active:    { label: "Manual Mode active", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  };
  const { label, cls } = map[status] ?? map.ready;
  return <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${cls}`}>{label}</span>;
}

// ─── Log Severity Icon ────────────────────────────────────────────────────────
function LogIcon({ severity }: { severity: LogEntry["severity"] }) {
  switch (severity) {
    case "success": return <Check className="w-3 h-3 text-emerald-400" />;
    case "warning": return <AlertTriangle className="w-3 h-3 text-amber-400" />;
    case "error": return <XCircle className="w-3 h-3 text-red-400" />;
    default: return <Info className="w-3 h-3 text-blue-400" />;
  }
}

// ─── Clock Helpers ────────────────────────────────────────────────────────────────────────────────
/** Format milliseconds as M:SS or H:MM:SS */
function formatClock(ms: number | null): string {
  if (ms === null) return "—";
  const totalSec = Math.ceil(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Single clock face used in Venue Display and Operator Mode */
function ClockFace({
  label, timeMs, isActive, isLow, compact = false,
}: {
  label: string; timeMs: number | null; isActive: boolean; isLow: boolean; compact?: boolean;
}) {
  const low = isLow && timeMs !== null && timeMs < 60_000;
  const critical = isLow && timeMs !== null && timeMs < 10_000;
  return (
    <div className={`flex flex-col items-center justify-center rounded-2xl transition-all duration-300 ${
      compact ? "px-4 py-2" : "px-8 py-5"
    } ${
      critical ? "bg-red-500/20 border-2 border-red-500/60 shadow-[0_0_20px_rgba(239,68,68,0.3)]" :
      low ? "bg-amber-500/15 border border-amber-500/30" :
      isActive ? "bg-[#4CAF50]/10 border border-[#4CAF50]/30 shadow-[0_0_12px_rgba(76,175,80,0.15)]" :
      "bg-white/3 border border-white/8"
    }`}>
      <div className={`font-mono font-bold tabular-nums tracking-tight leading-none ${
        compact ? "text-2xl" : "text-5xl"
      } ${
        critical ? "text-red-400" : low ? "text-amber-400" : isActive ? "text-white" : "text-white/40"
      }`}>
        {formatClock(timeMs)}
      </div>
      <div className={`mt-1 font-medium uppercase tracking-widest ${
        compact ? "text-[9px]" : "text-[11px]"
      } ${
        isActive ? "text-white/60" : "text-white/25"
      }`}>
        {label}
      </div>
      {isActive && (
        <div className={`mt-1 rounded-full ${
          compact ? "w-1 h-1" : "w-1.5 h-1.5"
        } ${
          critical ? "bg-red-400 animate-pulse" : "bg-[#4CAF50] animate-pulse"
        }`} />
      )}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────────────────────────
export default function BroadcastConsole() {
  const { id: tournamentId } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  // ─── Core State ─────────────────────────────────────────────────────────────
  const [broadcast, setBroadcast] = useState<Broadcast | null>(null);
  const [loading, setLoading] = useState(true);
  const [chess] = useState(() => new Chess());
  const [fen, setFen] = useState("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [legalMoves, setLegalMoves] = useState<string[]>([]);
  const [sanInput, setSanInput] = useState("");
  const [boardFlipped, setBoardFlipped] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const [submitting, setSubmitting] = useState(false);
  const [operatorStatus, setOperatorStatus] = useState<OperatorStatus>("ready");
  const sanInputRef = useRef<HTMLInputElement>(null);
  const moveListRef = useRef<HTMLDivElement>(null);

  // ─── UI Mode ────────────────────────────────────────────────────────────────
  const [operatorMode, setOperatorMode] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("control");
  const [logFilter, setLogFilter] = useState<"all" | "move" | "display" | "bridge" | "error">("all");

  // ─── Confirmation ───────────────────────────────────────────────────────────
  const [confirmAction, setConfirmAction] = useState<{ title: string; message: string; confirmLabel?: string; action: () => void } | null>(null);

  // ─── Chess Clock State ─────────────────────────────────────────────────────
  const [clockWhiteMs, setClockWhiteMs] = useState<number | null>(null);
  const [clockBlackMs, setClockBlackMs] = useState<number | null>(null);
  const [clockRunning, setClockRunning] = useState(false);
  const [clockLastUpdatedAt, setClockLastUpdatedAt] = useState<number | null>(null);
  // Local tick — updates every 100ms when clock is running
  const [clockTick, setClockTick] = useState(0);
  const clockTickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sync clock state from broadcast row
  useEffect(() => {
    if (!broadcast) return;
    const b = broadcast as Broadcast & { whiteTimeMs?: number | null; blackTimeMs?: number | null; clockRunning?: number; clockLastUpdatedAt?: string | null };
    setClockWhiteMs(b.whiteTimeMs ?? null);
    setClockBlackMs(b.blackTimeMs ?? null);
    setClockRunning(!!(b.clockRunning));
    setClockLastUpdatedAt(b.clockLastUpdatedAt ? new Date(b.clockLastUpdatedAt).getTime() : null);
  }, [broadcast]);

  // Local tick interval
  useEffect(() => {
    if (clockRunning) {
      clockTickRef.current = setInterval(() => setClockTick(t => t + 1), 100);
    } else {
      if (clockTickRef.current) clearInterval(clockTickRef.current);
    }
    return () => { if (clockTickRef.current) clearInterval(clockTickRef.current); };
  }, [clockRunning]);

  // Compute displayed times (subtract elapsed from active side)
  const displayedWhiteMs = useMemo(() => {
    if (clockWhiteMs === null) return null;
    if (!clockRunning || !clockLastUpdatedAt || broadcast?.sideToMove !== "w") return clockWhiteMs;
    const elapsed = Date.now() - clockLastUpdatedAt;
    return Math.max(0, clockWhiteMs - elapsed);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clockWhiteMs, clockRunning, clockLastUpdatedAt, broadcast?.sideToMove, clockTick]);

  const displayedBlackMs = useMemo(() => {
    if (clockBlackMs === null) return null;
    if (!clockRunning || !clockLastUpdatedAt || broadcast?.sideToMove !== "b") return clockBlackMs;
    const elapsed = Date.now() - clockLastUpdatedAt;
    return Math.max(0, clockBlackMs - elapsed);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clockBlackMs, clockRunning, clockLastUpdatedAt, broadcast?.sideToMove, clockTick]);

  // Clock preset state
  const [clockPresetMin, setClockPresetMin] = useState(90);
  // Auto-switch clock on move — enabled by default, operator can disable
  const [autoSwitchClock, setAutoSwitchClock] = useState(true);

  // ─── Broadcast Logs ─────────────────────────────────────────────────────────
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const addLog = useCallback((type: LogEntry["type"], severity: LogEntry["severity"], message: string) => {
    setLogs(prev => [...prev.slice(-99), { id: crypto.randomUUID(), timestamp: Date.now(), type, severity, message }]);
  }, []);


  // Clock API helper (declared after addLog)
  const clockAction = useCallback(async (action: string, extra?: { whiteTimeMs?: number; blackTimeMs?: number }) => {
    if (!broadcast) return;
    try {
      const res = await fetch(`/api/broadcasts/${broadcast.id}/clock`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      if (res.ok) {
        const data = await res.json();
        setClockWhiteMs(data.whiteTimeMs ?? null);
        setClockBlackMs(data.blackTimeMs ?? null);
        setClockRunning(!!(data.clockRunning));
        setClockLastUpdatedAt(data.clockLastUpdatedAt ? new Date(data.clockLastUpdatedAt).getTime() : null);
        addLog("system", "info", `Clock: ${action}`);
      }
    } catch { toast.error("Clock update failed"); }
  }, [broadcast, addLog]);

  // ─── Venue Display Health ───────────────────────────────────────────────────
  const [displayConnected, setDisplayConnected] = useState(false);
  const [displayLastPing, setDisplayLastPing] = useState<number | null>(null);
  const displayStale = displayLastPing ? (Date.now() - displayLastPing > 60000) : true;

  // ─── Readiness Checklist ────────────────────────────────────────────────────
  const [checklistState, setChecklistState] = useState<Record<string, "incomplete" | "complete" | "warning">>(() => {
    try {
      const saved = localStorage.getItem(`otb_checklist_${tournamentId}`);
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });

  useEffect(() => {
    localStorage.setItem(`otb_checklist_${tournamentId}`, JSON.stringify(checklistState));
  }, [checklistState, tournamentId]);

  function toggleChecklist(id: string) {
    setChecklistState(prev => ({
      ...prev,
      [id]: prev[id] === "complete" ? "incomplete" : "complete",
    }));
  }

  // ─── Pre-fill from query params ────────────────────────────────────────────
  const prefill = useMemo(() => {
    const sp = new URLSearchParams(window.location.search);
    return {
      whiteName: sp.get("whiteName") ?? undefined,
      blackName: sp.get("blackName") ?? undefined,
      whiteElo: sp.get("whiteElo") ? Number(sp.get("whiteElo")) : undefined,
      blackElo: sp.get("blackElo") ? Number(sp.get("blackElo")) : undefined,
      round: sp.get("round") ? Number(sp.get("round")) : 1,
      tournamentName: sp.get("tournamentName") ?? undefined,
    };
  }, []);

  // ─── Fetch broadcast ───────────────────────────────────────────────────────
  const fetchBroadcast = useCallback(async () => {
    try {
      const listRes = await fetch(`/api/broadcasts/tournament/${tournamentId}`);
      if (listRes.ok) {
        const broadcasts: Broadcast[] = await listRes.json();
        // Find the latest Board 1 broadcast (most recent round)
        const board1 = broadcasts
          .filter(b => b.boardNumber === 1)
          .sort((a, b) => b.roundNumber - a.roundNumber)[0];
        if (board1) {
          setBroadcast(board1);
          chess.load(board1.currentFen);
          setFen(board1.currentFen);
          addLog("system", "info", `Loaded broadcast: Round ${board1.roundNumber}`);
          setLoading(false);
          return;
        }
      }
      // Auto-create if none exists
      const createRes = await fetch("/api/broadcasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tournamentId,
          boardNumber: 1,
          roundNumber: prefill.round,
          whitePlayerName: prefill.whiteName ?? "White",
          blackPlayerName: prefill.blackName ?? "Black",
          whitePlayerElo: prefill.whiteElo ?? null,
          blackPlayerElo: prefill.blackElo ?? null,
          tournamentName: prefill.tournamentName ?? null,
        }),
      });
      if (createRes.ok) {
        const created = await createRes.json();
        setBroadcast(created);
        chess.load(created.currentFen);
        setFen(created.currentFen);
        addLog("system", "success", "Broadcast created");
      }
    } catch (err) {
      console.error("Failed to fetch broadcast", err);
      toast.error("Failed to load broadcast");
      addLog("system", "error", "Failed to load broadcast");
    } finally {
      setLoading(false);
    }
  }, [tournamentId, chess, prefill, addLog]);

  useEffect(() => { fetchBroadcast(); }, [fetchBroadcast]);

  // ─── SSE subscription ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!broadcast?.id) return;
    const es = new EventSource(`/api/broadcasts/${broadcast.id}/events`);

    es.addEventListener("move_played", (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.broadcast) {
          setBroadcast(data.broadcast);
          chess.load(data.broadcast.currentFen);
          setFen(data.broadcast.currentFen);
          addLog("move", "success", `Move: ${data.san ?? data.broadcast.lastMoveSan}`);
          setOperatorStatus("move_saved");
          setTimeout(() => {
            setOperatorStatus(data.broadcast.sideToMove === "w" ? "waiting_white" : "waiting_black");
          }, 1500);
        }
      } catch { /* ignore */ }
    });

    es.addEventListener("move_undone", (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.broadcast) {
          setBroadcast(data.broadcast);
          chess.load(data.broadcast.currentFen);
          setFen(data.broadcast.currentFen);
          addLog("move", "warning", "Move undone");
        }
      } catch { /* ignore */ }
    });

    es.addEventListener("status_changed", (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.broadcast) {
          setBroadcast(data.broadcast);
          addLog("system", "info", `Status: ${data.status}`);
        }
      } catch { /* ignore */ }
    });

    es.addEventListener("position_corrected", (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.broadcast) {
          setBroadcast(data.broadcast);
          chess.load(data.broadcast.currentFen);
          setFen(data.broadcast.currentFen);
          addLog("system", "warning", "Position corrected");
        }
      } catch { /* ignore */ }
    });

    es.addEventListener("broadcast_reset", (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.broadcast) {
          setBroadcast(data.broadcast);
          chess.reset();
          setFen(chess.fen());
          addLog("system", "warning", "Broadcast reset");
        }
      } catch { /* ignore */ }
    });

    es.addEventListener("bridge_status", (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.status === "connected") {
          addLog("bridge", "success", `Bridge connected${data.deviceName ? ` (${data.deviceName})` : ""}`);
        } else if (data.status === "disconnected") {
          addLog("bridge", "error", "Bridge disconnected");
        }
      } catch { /* ignore */ }
    });

    es.addEventListener("display_ping", () => {
      setDisplayConnected(true);
      setDisplayLastPing(Date.now());
    });

    es.addEventListener("clock_update", (e) => {
      try {
        const data = JSON.parse(e.data);
        setClockWhiteMs(data.whiteTimeMs ?? null);
        setClockBlackMs(data.blackTimeMs ?? null);
        setClockRunning(!!(data.clockRunning));
        setClockLastUpdatedAt(data.clockLastUpdatedAt ? new Date(data.clockLastUpdatedAt).getTime() : null);
      } catch { /* ignore */ }
    });

    es.onerror = () => {
      addLog("system", "warning", "Realtime connection interrupted — reconnecting…");
    };

    return () => es.close();
  }, [broadcast?.id, chess, addLog]);

  // ─── Operator status tracking ──────────────────────────────────────────────
  useEffect(() => {
    if (!broadcast) return;
    if (syncState === "syncing") { setOperatorStatus("syncing"); return; }
    if (broadcast.status === "ready") { setOperatorStatus("ready"); return; }
    if (broadcast.status === "finished") { setOperatorStatus("ready"); return; }
    if (broadcast.inputSource === "manual") {
      if (broadcast.sideToMove === "w") setOperatorStatus("waiting_white");
      else setOperatorStatus("waiting_black");
    }
  }, [broadcast, syncState]);

  // ─── Move submission ───────────────────────────────────────────────────────
  const submitMove = useCallback(async (san: string, uci: string, fenBefore: string, fenAfter: string) => {
    if (!broadcast || submitting) return;
    if (broadcast.status === "finished") {
      toast.error("Broadcast has ended. Cannot submit moves.");
      addLog("move", "error", "Rejected: broadcast finished");
      return;
    }
    setSubmitting(true);
    setSyncState("syncing");
    setOperatorStatus("syncing");
    try {
      const res = await fetch(`/api/broadcasts/${broadcast.id}/moves`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          san, uci, fenBefore, fenAfter,
          pgn: chess.pgn(),
          moveNumber: broadcast.moveNumber + 1,
          sideToMove: fenAfter.split(" ")[1] ?? "w",
          source: broadcast.inputSource,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        toast.error(err.error || "Failed to submit move");
        chess.load(fenBefore);
        setFen(fenBefore);
        setSyncState("error");
        setOperatorStatus("error_illegal");
        addLog("move", "error", `Rejected: ${err.error || san}`);
        setTimeout(() => setOperatorStatus(broadcast.sideToMove === "w" ? "waiting_white" : "waiting_black"), 3000);
      } else {
        const data = await res.json();
        if (data.broadcast) setBroadcast(data.broadcast);
        setSyncState("saved");
        setOperatorStatus("move_saved");
        setTimeout(() => setSyncState("idle"), 1500);
        // Auto-switch clock if running and auto-switch is enabled
        if (autoSwitchClock && clockRunning) {
          clockAction("switch");
        }
      }
    } catch {
      chess.load(fenBefore);
      setFen(fenBefore);
      toast.error("Network error — move not saved");
      setSyncState("error");
      addLog("system", "error", "Network error on move submit");
    } finally {
      setSubmitting(false);
    }
  }, [broadcast, chess, submitting, addLog, autoSwitchClock, clockRunning, clockAction]);

  // ─── Board click handler ───────────────────────────────────────────────────
  function handleSquareClick({ square }: SquareHandlerArgs) {
    if (!broadcast || broadcast.status === "finished" || broadcast.status === "paused" || submitting) return;
    if (selectedSquare) {
      const fenBefore = chess.fen();
      const move = chess.move({ from: selectedSquare, to: square, promotion: "q" });
      if (move) {
        const fenAfter = chess.fen();
        setFen(fenAfter);
        setSelectedSquare(null);
        setLegalMoves([]);
        submitMove(move.san, move.from + move.to + (move.promotion ?? ""), fenBefore, fenAfter);
      } else {
        const piece = chess.get(square as any);
        if (piece && piece.color === chess.turn()) {
          setSelectedSquare(square);
          const moves = chess.moves({ square: square as any, verbose: true });
          setLegalMoves(moves.map((m: any) => m.to));
        } else {
          setSelectedSquare(null);
          setLegalMoves([]);
        }
      }
    } else {
      const piece = chess.get(square as any);
      if (piece && piece.color === chess.turn()) {
        setSelectedSquare(square);
        const moves = chess.moves({ square: square as any, verbose: true });
        setLegalMoves(moves.map((m: any) => m.to));
      }
    }
  }

  function handlePieceDrop({ sourceSquare, targetSquare }: PieceDropHandlerArgs): boolean {
    if (!broadcast || broadcast.status === "finished" || submitting) return false;
    if (!targetSquare) return false;
    const fenBefore = chess.fen();
    const move = chess.move({ from: sourceSquare, to: targetSquare, promotion: "q" });
    if (!move) return false;
    const fenAfter = chess.fen();
    setFen(fenAfter);
    setSelectedSquare(null);
    setLegalMoves([]);
    submitMove(move.san, move.from + move.to + (move.promotion ?? ""), fenBefore, fenAfter);
    return true;
  }

  // ─── SAN input handler ────────────────────────────────────────────────────
  function handleSanSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!broadcast || !sanInput.trim() || submitting) return;
    const fenBefore = chess.fen();
    const move = chess.move(sanInput.trim());
    if (!move) {
      toast.error(`Illegal move: ${sanInput}. Check the board and try again.`);
      setOperatorStatus("error_illegal");
      addLog("move", "error", `Illegal: ${sanInput}`);
      setTimeout(() => setOperatorStatus(broadcast.sideToMove === "w" ? "waiting_white" : "waiting_black"), 3000);
      return;
    }
    const fenAfter = chess.fen();
    setFen(fenAfter);
    setSanInput("");
    submitMove(move.san, move.from + move.to + (move.promotion ?? ""), fenBefore, fenAfter);
    sanInputRef.current?.focus();
  }

  // ─── Keyboard shortcuts (Cmd+Z for undo) ──────────────────────────────────
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        handleUndo();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  // ─── Status controls ──────────────────────────────────────────────────────
  async function updateStatus(status: string) {
    if (!broadcast) return;
    try {
      const res = await fetch(`/api/broadcasts/${broadcast.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        const updated = await res.json();
        setBroadcast(updated);
        toast.success(`Broadcast ${status}`);
        addLog("system", "success", `Broadcast ${status}`);
      }
    } catch { toast.error("Failed to update status"); }
  }

  // ─── Undo ─────────────────────────────────────────────────────────────────
  async function handleUndo() {
    if (!broadcast || broadcast.moveNumber === 0) return;
    try {
      const res = await fetch(`/api/broadcasts/${broadcast.id}/moves/last`, { method: "DELETE" });
      if (res.ok) {
        const data = await res.json();
        if (data.broadcast) {
          setBroadcast(data.broadcast);
          chess.load(data.broadcast.currentFen);
          setFen(data.broadcast.currentFen);
          toast.success("Move undone");
          addLog("move", "warning", "Undo performed");
        }
      }
    } catch { toast.error("Failed to undo"); }
  }

  // ─── Set result ───────────────────────────────────────────────────────────
  async function handleSetResult(result: string) {
    if (!broadcast) return;
    try {
      const res = await fetch(`/api/broadcasts/${broadcast.id}/result`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result }),
      });
      if (res.ok) {
        const updated = await res.json();
        setBroadcast(updated);
        toast.success(`Result: ${result}`);
        addLog("system", "success", `Result set: ${result}`);
      }
    } catch { toast.error("Failed to set result"); }
  }

  // ─── Reset ────────────────────────────────────────────────────────────────
  async function handleReset() {
    if (!broadcast) return;
    try {
      const res = await fetch(`/api/broadcasts/${broadcast.id}/reset`, { method: "POST" });
      if (res.ok) {
        const updated = await res.json();
        setBroadcast(updated);
        chess.reset();
        setFen(chess.fen());
        toast.success("Broadcast reset");
        addLog("system", "warning", "Broadcast reset to starting position");
      }
    } catch { toast.error("Failed to reset"); }
  }

  // ─── Start Next Round ─────────────────────────────────────────────────────
  async function handleStartNextRound() {
    if (!broadcast) return;
    try {
      const createRes = await fetch("/api/broadcasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tournamentId,
          boardNumber: 1,
          roundNumber: broadcast.roundNumber + 1,
          whitePlayerName: "White",
          blackPlayerName: "Black",
          tournamentName: broadcast.tournamentName,
        }),
      });
      if (createRes.ok) {
        const created = await createRes.json();
        setBroadcast(created);
        chess.reset();
        setFen(chess.fen());
        toast.success(`Round ${created.roundNumber} broadcast created`);
        addLog("system", "success", `Started Round ${created.roundNumber} broadcast`);
      }
    } catch { toast.error("Failed to create next round broadcast"); }
  }

  // ─── Custom square styles ─────────────────────────────────────────────────
  const customSquareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};
    if (selectedSquare) {
      styles[selectedSquare] = { background: "rgba(255, 200, 0, 0.45)", borderRadius: "4px" };
    }
    for (const sq of legalMoves) {
      const piece = chess.get(sq as any);
      if (piece) {
        styles[sq] = { background: "radial-gradient(circle, transparent 55%, rgba(76,175,80,0.5) 55%)", borderRadius: "50%" };
      } else {
        styles[sq] = { background: "radial-gradient(circle, rgba(76,175,80,0.45) 25%, transparent 25%)", borderRadius: "50%" };
      }
    }
    if (broadcast?.lastMoveUci && broadcast.lastMoveUci.length >= 4) {
      const from = broadcast.lastMoveUci.slice(0, 2);
      const to = broadcast.lastMoveUci.slice(2, 4);
      styles[from] = { ...styles[from], background: "rgba(76,175,80,0.2)" };
      styles[to] = { ...styles[to], background: "rgba(76,175,80,0.35)" };
    }
    return styles;
  }, [selectedSquare, legalMoves, broadcast?.lastMoveUci, chess]);

  // ─── Move pairs for display ───────────────────────────────────────────────
  const movePairs = useMemo(() => {
    if (!broadcast?.pgn) return [];
    const moves = broadcast.pgn.replace(/\d+\.\s*/g, "").trim().split(/\s+/).filter(Boolean);
    const pairs: [string, string?][] = [];
    for (let i = 0; i < moves.length; i += 2) {
      pairs.push([moves[i], moves[i + 1]]);
    }
    return pairs;
  }, [broadcast?.pgn]);

  // Auto-scroll move list
  useEffect(() => {
    if (moveListRef.current) moveListRef.current.scrollTop = moveListRef.current.scrollHeight;
  }, [movePairs]);

  // ─── Public URLs ──────────────────────────────────────────────────────────
  const publicUrl = broadcast ? `${window.location.origin}/live/board/${broadcast.publicSlug}` : "";
  const venueUrl = broadcast ? `${window.location.origin}/live/board/${broadcast.publicSlug}/display` : "";

  // ─── Copy helpers ─────────────────────────────────────────────────────────
  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text).then(() => toast.success(`${label} copied`));
  }

  // ─── PGN Download ─────────────────────────────────────────────────────────
  function downloadPgn() {
    if (!broadcast) return;
    const header = `[Event "${broadcast.tournamentName ?? "OTB Chess Tournament"}"]\n[White "${broadcast.whitePlayerName}"]\n[Black "${broadcast.blackPlayerName}"]\n[Result "${broadcast.result ?? "*"}"]\n[Round "${broadcast.roundNumber}"]\n[Board "${broadcast.boardNumber}"]\n[Date "${new Date().toISOString().slice(0, 10)}"]\n\n`;
    const blob = new Blob([header + broadcast.pgn + (broadcast.result ? ` ${broadcast.result}` : "")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `board1-round${broadcast.roundNumber}.pgn`;
    a.click();
    URL.revokeObjectURL(url);
    addLog("system", "success", "PGN exported");
  }

  // ─── Filtered logs ────────────────────────────────────────────────────────
  const filteredLogs = useMemo(() => {
    if (logFilter === "all") return logs;
    if (logFilter === "error") return logs.filter(l => l.severity === "error" || l.severity === "warning");
    return logs.filter(l => l.type === logFilter);
  }, [logs, logFilter]);

  // ─── Checklist items ──────────────────────────────────────────────────────
  const checklistItems = useMemo((): ChecklistItem[] => [
    { id: "pairing", label: "Board 1 pairing selected", description: "White and Black players confirmed", actionLabel: undefined },
    { id: "names", label: "Player names confirmed", description: `${broadcast?.whitePlayerName ?? "?"} vs ${broadcast?.blackPlayerName ?? "?"}` },
    { id: "venue_open", label: "Venue display opened", description: "Big screen showing the board", actionLabel: "Open Venue Display", actionFn: () => window.open(venueUrl, "_blank") },
    { id: "projector", label: "Connected to projector/TV", description: "Display visible on the big screen" },
    { id: "qr_visible", label: "QR code visible", description: "Spectators can scan to follow along" },
    { id: "manual_tested", label: "Manual Mode tested", description: "Submitted a test move and confirmed display updated" },
    { id: "demo_tested", label: "Demo move tested", description: "Ran a demo move to verify the pipeline" },
    { id: "undo_tested", label: "Undo tested", description: "Confirmed undo works correctly" },
    { id: "pgn_tested", label: "PGN export tested", description: "Downloaded or copied PGN successfully" },
    { id: "bridge_token", label: "Bridge token generated", description: "If using Chessnut Pro Beta", status: broadcast?.bridgeToken ? "complete" : "incomplete" },
    { id: "bridge_heartbeat", label: "Bridge heartbeat detected", description: "If using Chessnut Pro Beta", status: broadcast?.bridgeStatus === "connected" ? "complete" : "incomplete" },
    { id: "fallback_operator", label: "Manual fallback operator assigned", description: "Someone ready to enter moves manually" },
    { id: "internet", label: "Internet connection confirmed", description: "Stable connection verified" },
    { id: "hotspot", label: "Backup hotspot available", description: "Mobile hotspot as fallback" },
    { id: "scoresheet", label: "Physical scoresheet ready", description: "Paper backup for the game" },
    { id: "operator_ready", label: "Broadcast operator ready", description: "Operator briefed and in position" },
  ], [broadcast, venueUrl]);

  // ─── Loading state ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <OTBLoader fullPage isDark label="Loading broadcast console…" />
    );
  }

  if (!broadcast) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0d1a0f]">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-3" />
          <p className="text-white/70">Failed to load broadcast</p>
          <button onClick={() => navigate(`/tournament/${tournamentId}/manage`)} className="mt-4 text-sm text-[#4CAF50] hover:underline">← Back to Director</button>
        </div>
      </div>
    );
  }

  const turnLabel = chess.turn() === "w" ? "White to move" : "Black to move";
  const canMove = broadcast.status === "live" || broadcast.status === "ready";

  // ═══════════════════════════════════════════════════════════════════════════
  // LIVE OPERATOR MODE — compact focused UI
  // ═══════════════════════════════════════════════════════════════════════════
  if (operatorMode) {
    return (
      <div className="min-h-screen bg-[#0d1a0f] text-white flex flex-col">
        <ConfirmDialog
          open={!!confirmAction}
          title={confirmAction?.title ?? ""}
          message={confirmAction?.message ?? ""}
          confirmLabel={confirmAction?.confirmLabel}
          onConfirm={() => { confirmAction?.action(); setConfirmAction(null); }}
          onCancel={() => setConfirmAction(null)}
        />

        {/* Compact header */}
        <header className="border-b border-white/8 px-4 py-2 flex items-center justify-between bg-[#0d1a0f]/95 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <button onClick={() => setOperatorMode(false)} className="p-1.5 rounded-lg hover:bg-white/5 text-white/60">
              <Minimize2 className="w-4 h-4" />
            </button>
            <Radio className="w-4 h-4 text-red-400" />
            <span className="text-sm font-bold">Live Operator Mode</span>
            <StatusBadge status={broadcast.status} />
          </div>
          <div className="flex items-center gap-2">
            <OperatorBadge status={operatorStatus} />
          </div>
        </header>

        {/* Main operator layout */}
        <div className="flex-1 flex flex-col lg:flex-row gap-4 p-4 max-w-[1400px] mx-auto w-full">
          {/* Board — large */}
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            {/* Turn indicator */}
            <div className="flex items-center gap-3">
              <div className={`w-4 h-4 rounded-full ${chess.turn() === "w" ? "bg-white shadow-[0_0_10px_rgba(255,255,255,0.5)]" : "bg-[#12372A] border-2 border-white/30"}`} />
              <span className="text-base font-semibold text-white/80">{turnLabel}</span>
              {broadcast.lastMoveSan && (
                <span className="text-sm text-white/40 font-mono bg-white/5 px-2 py-0.5 rounded">Last: {broadcast.lastMoveSan}</span>
              )}
              {broadcast.result && <span className="text-xl font-bold font-mono text-[#4CAF50]">{broadcast.result}</span>}
            </div>

            {/* Board */}
            <div className="rounded-xl overflow-hidden border border-white/8 shadow-2xl w-full max-w-[600px]">
              <Chessboard
                options={{
                  position: fen,
                  boardOrientation: boardFlipped ? "black" : "white",
                  onSquareClick: handleSquareClick,
                  onPieceDrop: handlePieceDrop,
                  squareStyles: customSquareStyles,
                  animationDurationInMs: 200,
                  boardStyle: { borderRadius: "0" },
                }}
              />
            </div>

            {/* SAN input — large */}
            <form onSubmit={handleSanSubmit} className="flex gap-2 w-full max-w-[600px]">
              <input
                ref={sanInputRef}
                value={sanInput}
                onChange={(e) => setSanInput(e.target.value)}
                placeholder="Enter move (e.g. e4, Nf3, O-O)"
                disabled={!canMove || submitting}
                autoFocus
                className="flex-1 px-4 py-3 rounded-xl text-base border font-mono bg-white/5 border-white/10 text-white placeholder-white/30 disabled:opacity-40 focus:border-[#4CAF50]/50 focus:ring-1 focus:ring-[#4CAF50]/30 outline-none"
              />
              <button type="submit" disabled={!canMove || !sanInput.trim() || submitting}
                className="px-6 py-3 rounded-xl bg-[#4CAF50]/20 border border-[#4CAF50]/30 text-[#4CAF50] text-base font-semibold hover:bg-[#4CAF50]/30 disabled:opacity-30 transition-colors">
                <Send className="w-5 h-5" />
              </button>
            </form>

            {/* Quick controls */}
            <div className="flex items-center gap-2 flex-wrap justify-center">
              <button onClick={handleUndo} disabled={broadcast.moveNumber === 0} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/10 text-white/60 text-sm hover:bg-white/5 disabled:opacity-30">
                <SkipBack className="w-4 h-4" /> Undo
              </button>
              {broadcast.status === "live" && (
                <button onClick={() => updateStatus("paused")} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500/15 border border-amber-500/25 text-amber-400 text-sm hover:bg-amber-500/25">
                  <Pause className="w-4 h-4" /> Pause
                </button>
              )}
              {broadcast.status === "paused" && (
                <button onClick={() => updateStatus("live")} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#4CAF50]/15 border border-[#4CAF50]/25 text-[#4CAF50] text-sm hover:bg-[#4CAF50]/25">
                  <Play className="w-4 h-4" /> Resume
                </button>
              )}
              <button onClick={() => setBoardFlipped(!boardFlipped)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/10 text-white/60 text-sm hover:bg-white/5">
                <FlipVertical className="w-4 h-4" /> Flip
              </button>
              {(broadcast.status === "live" || broadcast.status === "paused") && (
                <button onClick={() => setConfirmAction({ title: "End Game?", message: "Set the result and finish the broadcast.", action: () => updateStatus("finished") })}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/15 border border-red-500/25 text-red-400 text-sm hover:bg-red-500/25">
                  <Square className="w-4 h-4" /> End Game
                </button>
              )}
            </div>
          </div>

          {/* Side panel — move list */}
          <div className="w-full lg:w-[240px] shrink-0">
            <div className="rounded-xl border border-white/8 bg-[oklch(0.14_0.04_145)] p-4 h-full">
              <h3 className="text-xs font-bold text-white/40 uppercase tracking-wider mb-3">Moves</h3>
              <div ref={moveListRef} className="max-h-[400px] overflow-y-auto space-y-0.5 font-mono text-sm">
                {movePairs.length === 0 && <div className="text-white/20 text-center py-4">No moves yet</div>}
                {movePairs.map(([w, b], i) => (
                  <div key={i} className="flex items-center gap-1.5 py-0.5">
                    <span className="w-7 text-white/30 text-right">{i + 1}.</span>
                    <span className="w-16 text-white/80">{w}</span>
                    <span className="w-16 text-white/60">{b ?? ""}</span>
                  </div>
                ))}
              </div>
              {/* Players */}
              <div className="mt-4 pt-3 border-t border-white/5 space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-white text-[8px] font-bold text-[#12372A] flex items-center justify-center">W</div>
                  <span className="text-xs text-white/70 truncate">{broadcast.whitePlayerName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-[#12372A] text-[8px] font-bold text-white flex items-center justify-center">B</div>
                  <span className="text-xs text-white/70 truncate">{broadcast.blackPlayerName}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FULL BROADCAST CONSOLE — control room layout
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-[#0d1a0f] text-white">
      <ConfirmDialog
        open={!!confirmAction}
        title={confirmAction?.title ?? ""}
        message={confirmAction?.message ?? ""}
        confirmLabel={confirmAction?.confirmLabel}
        onConfirm={() => { confirmAction?.action(); setConfirmAction(null); }}
        onCancel={() => setConfirmAction(null)}
      />

      {/* ─── Top Status Bar ────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-white/8 bg-[#0d1a0f]/95 backdrop-blur-md px-4 py-3">
        <div className="max-w-[1600px] mx-auto">
          {/* Row 1: Nav + Title + Status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate(`/tournament/${tournamentId}/manage`)} className="p-2 rounded-lg hover:bg-white/5 text-white/60">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <Radio className="w-5 h-5 text-red-400" />
              <div>
                <h1 className="text-sm font-bold">{broadcast.tournamentName ?? "Tournament"} — Board 1</h1>
                <div className="text-[11px] text-white/40">Round {broadcast.roundNumber} • {broadcast.whitePlayerName} vs {broadcast.blackPlayerName}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge status={broadcast.status} />
              <OperatorBadge status={operatorStatus} />
              <button onClick={() => setOperatorMode(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#4CAF50]/15 border border-[#4CAF50]/25 text-[#4CAF50] text-xs font-medium hover:bg-[#4CAF50]/25">
                <Maximize2 className="w-3.5 h-3.5" /> Live Operator Mode
              </button>
            </div>
          </div>

          {/* Row 2: Quick info chips */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/50">
              Input: {broadcast.inputSource === "manual" ? "Manual" : broadcast.inputSource === "chessnut_pro_beta" ? "Chessnut Pro" : broadcast.inputSource === "chessnut_chrome_bluetooth" ? "Chrome BT" : "PGN"}
            </span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${displayConnected && !displayStale ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-amber-500/10 border-amber-500/20 text-amber-400"}`}>
              {displayConnected && !displayStale ? "Display connected" : "Display not detected"}
            </span>
            <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/50 hover:text-[#4CAF50] flex items-center gap-1">
              <ExternalLink className="w-2.5 h-2.5" /> Public Link
            </a>
            {/* Controls */}
            <div className="ml-auto flex items-center gap-1.5">
              {broadcast.status === "ready" && (
                <button onClick={() => setConfirmAction({
                  title: "Go Live?",
                  message: `Confirm Board 1 pairing: ${broadcast.whitePlayerName} (White) vs ${broadcast.blackPlayerName} (Black), Round ${broadcast.roundNumber}. This will start the live broadcast.`,
                  confirmLabel: "Go Live",
                  action: () => updateStatus("live"),
                })} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#4CAF50]/20 border border-[#4CAF50]/30 text-[#4CAF50] text-xs font-medium hover:bg-[#4CAF50]/30">
                  <Play className="w-3.5 h-3.5" /> Start Broadcast
                </button>
              )}
              {broadcast.status === "live" && (
                <button onClick={() => updateStatus("paused")} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/25 text-amber-400 text-xs font-medium hover:bg-amber-500/25">
                  <Pause className="w-3.5 h-3.5" /> Pause
                </button>
              )}
              {broadcast.status === "paused" && (
                <button onClick={() => updateStatus("live")} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#4CAF50]/15 border border-[#4CAF50]/25 text-[#4CAF50] text-xs font-medium hover:bg-[#4CAF50]/25">
                  <Play className="w-3.5 h-3.5" /> Resume
                </button>
              )}
              {(broadcast.status === "live" || broadcast.status === "paused") && (
                <button onClick={() => setConfirmAction({ title: "End Game?", message: "This will finish the broadcast. Set the result first if needed.", action: () => updateStatus("finished") })}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-500/15 border border-red-500/25 text-red-400 text-xs font-medium hover:bg-red-500/25">
                  <Square className="w-3.5 h-3.5" /> End
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ─── Section Navigation ────────────────────────────────────────────── */}
      <div className="border-b border-white/5 bg-[#0d1a0f]/80 sticky top-[88px] z-30">
        <div className="max-w-[1600px] mx-auto px-4 flex items-center gap-1 overflow-x-auto py-2">
          {[
            { id: "control", label: "Board Control", icon: Activity },
            { id: "checklist", label: "Setup Checklist", icon: ListChecks },
            { id: "display", label: "Venue Display", icon: Monitor },
            { id: "logs", label: "Logs", icon: FileText },
            { id: "recovery", label: "Recovery", icon: LifeBuoy },
            { id: "export", label: "Post-Game", icon: Download },
          ].map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setActiveSection(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${activeSection === id ? "bg-[#4CAF50]/15 border border-[#4CAF50]/25 text-[#4CAF50]" : "text-white/40 hover:text-white/60 hover:bg-white/5 border border-transparent"}`}>
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Main Content ──────────────────────────────────────────────────── */}
      <main className="max-w-[1600px] mx-auto p-4">

        {/* ═══ BOARD CONTROL SECTION ═══ */}
        {activeSection === "control" && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
            {/* Board + Input */}
            <div className="space-y-4">
              {/* Turn + last move */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${chess.turn() === "w" ? "bg-white shadow-[0_0_8px_rgba(255,255,255,0.4)]" : "bg-[#12372A] border border-white/20"}`} />
                  <span className="text-sm font-medium text-white/70">{turnLabel}</span>
                  {broadcast.lastMoveSan && <span className="text-xs text-white/40 font-mono">Last: {broadcast.lastMoveSan}</span>}
                </div>
                {broadcast.result && <span className="text-lg font-bold font-mono text-[#4CAF50]">{broadcast.result}</span>}
              </div>

              {/* Board */}
              <div className="rounded-xl overflow-hidden border border-white/8 shadow-2xl max-w-[560px] mx-auto">
                <Chessboard
                  options={{
                    position: fen,
                    boardOrientation: boardFlipped ? "black" : "white",
                    onSquareClick: handleSquareClick,
                    onPieceDrop: handlePieceDrop,
                    squareStyles: customSquareStyles,
                    animationDurationInMs: 200,
                    boardStyle: { borderRadius: "0" },
                  }}
                />
              </div>

              {/* SAN input */}
              <form onSubmit={handleSanSubmit} className="flex gap-2 max-w-[560px] mx-auto">
                <input
                  ref={sanInputRef}
                  value={sanInput}
                  onChange={(e) => setSanInput(e.target.value)}
                  placeholder="Enter move (e.g. e4, Nf3, O-O)"
                  disabled={!canMove || submitting}
                  className="flex-1 px-3 py-2.5 rounded-xl text-sm border font-mono bg-white/5 border-white/10 text-white placeholder-white/30 disabled:opacity-40 focus:border-[#4CAF50]/50 outline-none"
                />
                <button type="submit" disabled={!canMove || !sanInput.trim() || submitting}
                  className="px-5 py-2.5 rounded-xl bg-[#4CAF50]/20 border border-[#4CAF50]/30 text-[#4CAF50] text-sm font-medium hover:bg-[#4CAF50]/30 disabled:opacity-30">
                  {submitting ? "…" : "Play"}
                </button>
              </form>

              {/* Quick controls row */}
              <div className="flex items-center gap-2 flex-wrap max-w-[560px] mx-auto">
                <button onClick={handleUndo} disabled={broadcast.moveNumber === 0} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/10 text-white/60 text-xs hover:bg-white/5 disabled:opacity-30">
                  <SkipBack className="w-3.5 h-3.5" /> Undo
                </button>
                <button onClick={() => setBoardFlipped(!boardFlipped)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/10 text-white/60 text-xs hover:bg-white/5">
                  <FlipVertical className="w-3.5 h-3.5" /> Flip
                </button>
                <button onClick={() => setConfirmAction({ title: "Reset?", message: "Delete all moves and reset to starting position?", action: handleReset })}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-500/20 text-red-400/70 text-xs hover:bg-red-500/10">
                  <RotateCcw className="w-3.5 h-3.5" /> Reset
                </button>
              </div>
            </div>

            {/* Right sidebar — moves + result + links */}
            <div className="space-y-4">
              {/* Move list */}
              <div className="rounded-xl border border-white/8 bg-[oklch(0.14_0.04_145)] p-4">
                <h3 className="text-xs font-bold text-white/40 uppercase tracking-wider mb-3">Moves</h3>
                <div ref={moveListRef} className="max-h-[200px] overflow-y-auto space-y-0.5 font-mono text-xs">
                  {movePairs.length === 0 && <div className="text-white/20 text-center py-4">No moves yet</div>}
                  {movePairs.map(([w, b], i) => (
                    <div key={i} className="flex items-center gap-1 py-0.5">
                      <span className="w-6 text-white/30 text-right">{i + 1}.</span>
                      <span className="w-14 text-white/80">{w}</span>
                      <span className="w-14 text-white/60">{b ?? ""}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Set Result */}
              {(broadcast.status === "live" || broadcast.status === "paused" || broadcast.status === "finished") && (
                <div className="rounded-xl border border-white/8 bg-[oklch(0.14_0.04_145)] p-4 space-y-2">
                  <h3 className="text-xs font-bold text-white/40 uppercase tracking-wider">Result</h3>
                  <div className="grid grid-cols-4 gap-1.5">
                    {["1-0", "0-1", "1/2-1/2", "*"].map(r => (
                      <button key={r} onClick={() => setConfirmAction({ title: "Set Result?", message: `Set game result to ${r}?`, action: () => handleSetResult(r) })}
                        className={`px-2 py-1.5 rounded-lg text-xs font-mono font-bold border ${broadcast.result === r ? "bg-[#4CAF50]/20 border-[#4CAF50]/40 text-[#4CAF50]" : "border-white/10 text-white/50 hover:bg-white/5"}`}>
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Chess Clock Panel */}
              <div className="rounded-xl border border-white/8 bg-[oklch(0.14_0.04_145)] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-white/40 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-3 h-3" /> Clock
                  </h3>
                  {clockWhiteMs !== null && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
                      clockRunning ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-white/5 border-white/10 text-white/30"
                    }`}>{clockRunning ? "Running" : "Paused"}</span>
                  )}
                </div>

                {clockWhiteMs === null ? (
                  /* Set clock time */
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] text-white/40 w-16">Minutes</label>
                      <input
                        type="number" min={1} max={300} value={clockPresetMin}
                        onChange={e => setClockPresetMin(Number(e.target.value))}
                        className="flex-1 px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-white text-xs font-mono text-center outline-none focus:border-[#4CAF50]/50"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      {[5, 10, 15, 30, 60, 90].map(m => (
                        <button key={m} onClick={() => setClockPresetMin(m)}
                          className={`px-2 py-1 rounded-lg text-[10px] font-mono border transition-colors ${
                            clockPresetMin === m ? "bg-[#4CAF50]/20 border-[#4CAF50]/40 text-[#4CAF50]" : "border-white/10 text-white/40 hover:bg-white/5"
                          }`}>
                          {m}m
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => clockAction("set", { whiteTimeMs: clockPresetMin * 60_000, blackTimeMs: clockPresetMin * 60_000 })}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#4CAF50]/15 border border-[#4CAF50]/25 text-[#4CAF50] text-xs font-medium hover:bg-[#4CAF50]/25">
                      <Clock className="w-3.5 h-3.5" /> Set Clock
                    </button>
                  </div>
                ) : (
                  /* Clock running UI */
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <ClockFace
                        label={broadcast.whitePlayerName.split(" ")[0]}
                        timeMs={displayedWhiteMs}
                        isActive={clockRunning && broadcast.sideToMove === "w"}
                        isLow={true}
                        compact
                      />
                      <ClockFace
                        label={broadcast.blackPlayerName.split(" ")[0]}
                        timeMs={displayedBlackMs}
                        isActive={clockRunning && broadcast.sideToMove === "b"}
                        isLow={true}
                        compact
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {!clockRunning ? (
                        <button onClick={() => clockAction("start")}
                          className="col-span-2 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-[#4CAF50]/15 border border-[#4CAF50]/25 text-[#4CAF50] text-[10px] font-medium hover:bg-[#4CAF50]/25">
                          <Play className="w-3 h-3" /> Start
                        </button>
                      ) : (
                        <button onClick={() => clockAction("pause")}
                          className="col-span-2 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/25 text-amber-400 text-[10px] font-medium hover:bg-amber-500/25">
                          <Pause className="w-3 h-3" /> Pause
                        </button>
                      )}
                      <button onClick={() => clockAction("reset")}
                        className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg border border-white/10 text-white/40 text-[10px] hover:bg-white/5">
                        <RotateCcw className="w-3 h-3" />
                      </button>
                    </div>
                    {/* Auto-switch toggle */}
                    <button
                      onClick={() => setAutoSwitchClock(v => !v)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-[10px] font-medium transition-colors ${
                        autoSwitchClock
                          ? "bg-[#4CAF50]/8 border-[#4CAF50]/20 text-[#4CAF50]/80 hover:bg-[#4CAF50]/15"
                          : "bg-white/3 border-white/8 text-white/30 hover:bg-white/6"
                      }`}
                      title="When enabled, the clock automatically switches sides after each move is submitted"
                    >
                      <span className="flex items-center gap-1.5">
                        <ArrowLeftRight className="w-3 h-3" />
                        Auto-switch on move
                      </span>
                      <span className={`w-7 h-4 rounded-full relative transition-colors ${
                        autoSwitchClock ? "bg-[#4CAF50]/50" : "bg-white/10"
                      }`}>
                        <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all ${
                          autoSwitchClock ? "left-3.5" : "left-0.5"
                        }`} />
                      </span>
                    </button>
                  </div>
                )}
              </div>

              {/* Input Source Panel */}
              <div className="rounded-xl border border-white/8 bg-[oklch(0.14_0.04_145)] p-4 space-y-2">
                <h3 className="text-xs font-bold text-white/40 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Cpu className="w-3 h-3" /> Input Source
                </h3>
                {/* Manual Mode */}
                <button
                  onClick={async () => {
                    if (!broadcast || broadcast.inputSource === "manual") return;
                    try {
                      const res = await fetch(`/api/broadcasts/${broadcast.id}/input-source`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ source: "manual" }),
                      });
                      if (res.ok) { const d = await res.json(); setBroadcast(d); toast.success("Switched to Manual Mode"); addLog("system", "info", "Input source: Manual"); }
                    } catch { toast.error("Failed to switch input source"); }
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                    broadcast?.inputSource === "manual"
                      ? "bg-[#4CAF50]/15 border-[#4CAF50]/40 text-[#4CAF50]"
                      : "border-white/10 text-white/50 hover:bg-white/5 hover:text-white/70"
                  }`}
                >
                  <Keyboard className="w-3.5 h-3.5 shrink-0" />
                  <span>Manual Input</span>
                  {broadcast?.inputSource === "manual" && <span className="ml-auto text-[9px] bg-[#4CAF50]/20 text-[#4CAF50] px-1.5 py-0.5 rounded-full">ACTIVE</span>}
                </button>
                {/* Chessnut Pro Beta */}
                <button
                  onClick={async () => {
                    if (!broadcast || broadcast.inputSource === "chessnut_pro_beta") return;
                    try {
                      const res = await fetch(`/api/broadcasts/${broadcast.id}/input-source`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ source: "chessnut_pro_beta" }),
                      });
                      if (res.ok) { const d = await res.json(); setBroadcast(d); toast.success("Switched to Chessnut Pro (Beta)"); addLog("bridge", "info", "Input source: Chessnut Pro Beta"); }
                    } catch { toast.error("Failed to switch input source"); }
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                    broadcast?.inputSource === "chessnut_pro_beta"
                      ? "bg-blue-500/15 border-blue-500/40 text-blue-400"
                      : "border-white/10 text-white/50 hover:bg-white/5 hover:text-white/70"
                  }`}
                >
                  <Plug className="w-3.5 h-3.5 shrink-0" />
                  <span>Chessnut Pro (Beta)</span>
                  {broadcast?.inputSource === "chessnut_pro_beta" && <span className="ml-auto text-[9px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-full">ACTIVE</span>}
                  {broadcast?.inputSource !== "chessnut_pro_beta" && <span className="ml-auto text-[9px] bg-white/5 text-white/30 px-1.5 py-0.5 rounded-full">BLE</span>}
                </button>
                {/* Chrome Web Bluetooth (Direct) */}
                <button
                  onClick={async () => {
                    if (!broadcast || broadcast.inputSource === "chessnut_chrome_bluetooth") return;
                    try {
                      const res = await fetch(`/api/broadcasts/${broadcast.id}/input-source`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ source: "chessnut_chrome_bluetooth" }),
                      });
                      if (res.ok) { const d = await res.json(); setBroadcast(d); toast.success("Switched to Chrome Bluetooth (Direct)"); addLog("bridge", "info", "Input source: Chrome Web Bluetooth"); }
                    } catch { toast.error("Failed to switch input source"); }
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                    broadcast?.inputSource === "chessnut_chrome_bluetooth"
                      ? "bg-purple-500/15 border-purple-500/40 text-purple-300"
                      : "border-white/10 text-white/50 hover:bg-white/5 hover:text-white/70"
                  }`}
                >
                  <Bluetooth className="w-3.5 h-3.5 shrink-0" />
                  <span>Chrome Bluetooth (Direct)</span>
                  {broadcast?.inputSource === "chessnut_chrome_bluetooth" && <span className="ml-auto text-[9px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded-full">ACTIVE</span>}
                  {broadcast?.inputSource !== "chessnut_chrome_bluetooth" && <span className="ml-auto text-[9px] bg-white/5 text-white/30 px-1.5 py-0.5 rounded-full">WEB BT</span>}
                </button>
                {/* Chrome BT Panel — inline when active */}
                {broadcast?.inputSource === "chessnut_chrome_bluetooth" && (
                  <div className="mt-2">
                    <ChessnutBoardPanel
                      broadcastId={broadcast.id}
                      currentFen={fen}
                      onMoveAccepted={submitMove}
                      onSwitchToManual={async () => {
                        try {
                          const res = await fetch(`/api/broadcasts/${broadcast.id}/input-source`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ source: "manual" }),
                          });
                          if (res.ok) { const d = await res.json(); setBroadcast(d); toast.success("Switched to Manual Mode"); }
                        } catch { toast.error("Failed to switch"); }
                      }}
                      isDark={isDark}
                    />
                  </div>
                )}
                {/* Show bridge status if Chessnut Pro is active */}
                {broadcast?.inputSource === "chessnut_pro_beta" && (
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-[10px] ${
                    broadcast.bridgeStatus === "connected" ? "bg-emerald-500/8 border-emerald-500/20 text-emerald-400" : "bg-amber-500/8 border-amber-500/20 text-amber-400"
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      broadcast.bridgeStatus === "connected" ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
                    }`} />
                    {broadcast.bridgeStatus === "connected" ? `Bridge connected — ${broadcast.bridgeDeviceName ?? "Chessnut Pro"}` : "Bridge not connected — run bridge.mjs"}
                  </div>
                )}
              </div>
              {/* Display Links */}
              <div className="rounded-xl border border-white/8 bg-[oklch(0.14_0.04_145)] p-4 space-y-2">
                <h3 className="text-xs font-bold text-white/40 uppercase tracking-wider mb-2">Display</h3>
                <a href={venueUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#4CAF50]/15 border border-[#4CAF50]/25 text-[#4CAF50] text-xs font-medium hover:bg-[#4CAF50]/25">
                  <Monitor className="w-3.5 h-3.5" /> Open Venue Display
                </a>
                <button onClick={() => copyToClipboard(publicUrl, "Public link")} className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-white/10 text-white/60 text-xs hover:bg-white/5">
                  <Copy className="w-3 h-3" /> Copy Public Link
                </button>
                <div className="pt-2 flex justify-center">
                  <QRCodeSVG value={publicUrl} size={72} bgColor="transparent" fgColor="#4CAF50" level="L" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══ SETUP CHECKLIST SECTION ═══ */}
        {activeSection === "checklist" && (
          <div className="max-w-2xl mx-auto space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Broadcast Readiness</h2>
              <span className="text-xs text-white/40">
                {Object.values(checklistState).filter(s => s === "complete").length} / {checklistItems.length} complete
              </span>
            </div>
            <p className="text-sm text-white/50">Run through this checklist before the tournament starts to confirm everything is working.</p>
            <div className="space-y-2">
              {checklistItems.map(item => {
                const status = checklistState[item.id] ?? item.status ?? "incomplete";
                return (
                  <div key={item.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${status === "complete" ? "bg-emerald-500/5 border-emerald-500/20" : status === "warning" ? "bg-amber-500/5 border-amber-500/20" : "bg-white/2 border-white/8"}`}>
                    <button onClick={() => toggleChecklist(item.id)} className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${status === "complete" ? "bg-emerald-500 border-emerald-500" : "border-white/20 hover:border-white/40"}`}>
                      {status === "complete" && <Check className="w-3 h-3 text-white" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium ${status === "complete" ? "text-white/50 line-through" : "text-white/80"}`}>{item.label}</div>
                      <div className="text-[11px] text-white/30">{item.description}</div>
                    </div>
                    {item.actionLabel && item.actionFn && (
                      <button onClick={item.actionFn} className="shrink-0 px-2.5 py-1 rounded-lg bg-[#4CAF50]/15 border border-[#4CAF50]/25 text-[#4CAF50] text-[10px] font-medium hover:bg-[#4CAF50]/25">
                        {item.actionLabel}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══ VENUE DISPLAY MONITOR SECTION ═══ */}
        {activeSection === "display" && (
          <div className="max-w-2xl mx-auto space-y-4">
            <h2 className="text-lg font-bold">Venue Display Monitor</h2>

            {/* Status card */}
            <div className={`rounded-xl border p-5 ${displayConnected && !displayStale ? "bg-emerald-500/5 border-emerald-500/20" : "bg-amber-500/5 border-amber-500/20"}`}>
              <div className="flex items-center gap-3 mb-3">
                {displayConnected && !displayStale ? (
                  <><Wifi className="w-5 h-5 text-emerald-400" /><span className="text-base font-semibold text-emerald-400">Venue display connected.</span></>
                ) : displayLastPing ? (
                  <><WifiOff className="w-5 h-5 text-amber-400" /><span className="text-base font-semibold text-amber-400">Venue display may be stale. Refresh display.</span></>
                ) : (
                  <><WifiOff className="w-5 h-5 text-amber-400" /><span className="text-base font-semibold text-amber-400">Venue display not detected. Open display page.</span></>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs text-white/50">
                <div><span className="text-white/30">Last ping:</span> {displayLastPing ? new Date(displayLastPing).toLocaleTimeString() : "Never"}</div>
                <div><span className="text-white/30">Display mode:</span> {broadcast.displayMode}</div>
                <div><span className="text-white/30">Latest FEN:</span> <span className="font-mono truncate">{broadcast.currentFen.split(" ")[0]?.slice(0, 20)}…</span></div>
                <div><span className="text-white/30">Last move:</span> {broadcast.lastMoveSan ?? "—"}</div>
              </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-3">
              <a href={venueUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#4CAF50]/15 border border-[#4CAF50]/25 text-[#4CAF50] text-sm font-medium hover:bg-[#4CAF50]/25">
                <Monitor className="w-4 h-4" /> Open Venue Display
              </a>
              <button onClick={() => copyToClipboard(venueUrl, "Venue URL")} className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-white/10 text-white/60 text-sm hover:bg-white/5">
                <Copy className="w-4 h-4" /> Copy Display URL
              </button>
            </div>

            {/* Refresh instructions */}
            <div className="rounded-xl border border-white/8 bg-white/2 p-4">
              <h3 className="text-sm font-semibold text-white/70 mb-2">Refresh Display Instructions</h3>
              <ol className="text-xs text-white/50 space-y-1.5 list-decimal list-inside">
                <li>Click the venue browser window on the projector laptop.</li>
                <li>Press F5 or Ctrl+R to refresh.</li>
                <li>The latest position will reload automatically from the server.</li>
              </ol>
            </div>
          </div>
        )}

        {/* ═══ BROADCAST LOGS SECTION ═══ */}
        {activeSection === "logs" && (
          <div className="max-w-3xl mx-auto space-y-4">
            <h2 className="text-lg font-bold">Broadcast Logs</h2>
            {/* Filter tabs */}
            <div className="flex items-center gap-1">
              {(["all", "move", "display", "bridge", "error"] as const).map(f => (
                <button key={f} onClick={() => setLogFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize ${logFilter === f ? "bg-[#4CAF50]/15 border border-[#4CAF50]/25 text-[#4CAF50]" : "text-white/40 hover:text-white/60 hover:bg-white/5 border border-transparent"}`}>
                  {f === "error" ? "Errors" : f}
                </button>
              ))}
            </div>
            {/* Log entries */}
            <div className="rounded-xl border border-white/8 bg-[oklch(0.14_0.04_145)] p-4 max-h-[500px] overflow-y-auto">
              {filteredLogs.length === 0 && <div className="text-center text-white/20 py-8 text-sm">No log entries yet</div>}
              {filteredLogs.slice().reverse().map(log => (
                <div key={log.id} className="flex items-start gap-2 py-1.5 border-b border-white/5 last:border-0">
                  <LogIcon severity={log.severity} />
                  <span className="text-[10px] text-white/30 font-mono shrink-0 w-[70px]">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </span>
                  <span className={`text-xs ${log.severity === "error" ? "text-red-400" : log.severity === "warning" ? "text-amber-400" : log.severity === "success" ? "text-emerald-400" : "text-white/60"}`}>
                    {log.message}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ RECOVERY TOOLS SECTION ═══ */}
        {activeSection === "recovery" && (
          <div className="max-w-2xl mx-auto space-y-4">
            <h2 className="text-lg font-bold">Recovery Tools</h2>
            <p className="text-sm text-white/50">Quick guides for common event-day problems. The goal is to reduce panic during the live event.</p>
            <div className="space-y-3">
              {[
                {
                  title: "Chessnut bridge disconnects",
                  steps: ["Display stays on last valid position.", "Switch to Manual Mode.", "Continue entering moves manually."],
                  action: "Switch to Manual",
                  actionFn: () => { toast.success("Manual Mode active"); addLog("bridge", "warning", "Switched to Manual Mode"); },
                },
                {
                  title: "Operator entered wrong move",
                  steps: ["Click Undo to remove the last move.", "Enter the correct move.", "Confirm the display updated."],
                  action: "Undo Last Move",
                  actionFn: handleUndo,
                },
                {
                  title: "Venue display freezes",
                  steps: ["Click the venue browser window.", "Press F5 to refresh.", "Latest position reloads automatically."],
                  action: "Open Display",
                  actionFn: () => window.open(venueUrl, "_blank"),
                },
                {
                  title: "Internet drops temporarily",
                  steps: ["Pause the broadcast if needed.", "Use the physical scoresheet.", "Resume and backfill PGN when connection returns."],
                  action: "Pause Broadcast",
                  actionFn: () => updateStatus("paused"),
                },
                {
                  title: "Physical board and digital board desync",
                  steps: ["Pause Chessnut Pro Beta.", "Switch to Manual Mode.", "Set FEN or undo to correct position.", "Resume manually."],
                  action: "Undo Last Move",
                  actionFn: handleUndo,
                },
                {
                  title: "Game ends",
                  steps: ["Set the result (1-0, 0-1, ½-½).", "Export PGN.", "Archive the broadcast.", "Start next round if needed."],
                  action: "Go to Post-Game",
                  actionFn: () => setActiveSection("export"),
                },
              ].map((problem, idx) => (
                <div key={idx} className="rounded-xl border border-white/8 bg-white/2 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-white/80">{problem.title}</h3>
                    <button onClick={problem.actionFn} className="px-2.5 py-1 rounded-lg bg-[#4CAF50]/15 border border-[#4CAF50]/25 text-[#4CAF50] text-[10px] font-medium hover:bg-[#4CAF50]/25">
                      {problem.action}
                    </button>
                  </div>
                  <ol className="text-xs text-white/50 space-y-1 list-decimal list-inside">
                    {problem.steps.map((step, i) => <li key={i}>{step}</li>)}
                  </ol>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ POST-GAME EXPORT SECTION ═══ */}
        {activeSection === "export" && (
          <div className="max-w-2xl mx-auto space-y-4">
            <h2 className="text-lg font-bold">Post-Game Export</h2>

            {broadcast.status !== "finished" ? (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5 text-center">
                <Clock className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                <p className="text-sm text-amber-400 font-medium">Game still in progress</p>
                <p className="text-xs text-white/40 mt-1">End the game and set a result to access export tools.</p>
                <button onClick={() => setConfirmAction({ title: "End Game?", message: "This will finish the broadcast.", action: () => updateStatus("finished") })}
                  className="mt-3 px-4 py-2 rounded-lg bg-red-500/15 border border-red-500/25 text-red-400 text-xs font-medium hover:bg-red-500/25">
                  End Game Now
                </button>
              </div>
            ) : (
              <>
                {/* Result display */}
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-white/50">Game finished</div>
                      <div className="text-2xl font-bold font-mono text-[#4CAF50] mt-1">{broadcast.result ?? "*"}</div>
                      <div className="text-xs text-white/40 mt-1">{broadcast.whitePlayerName} vs {broadcast.blackPlayerName} • {broadcast.moveNumber} moves</div>
                    </div>
                    <CheckCircle2 className="w-10 h-10 text-emerald-400/50" />
                  </div>
                </div>

                {/* Set/change result */}
                <div className="rounded-xl border border-white/8 bg-[oklch(0.14_0.04_145)] p-4 space-y-2">
                  <h3 className="text-xs font-bold text-white/40 uppercase tracking-wider">Set / Change Result</h3>
                  <div className="grid grid-cols-4 gap-2">
                    {["1-0", "0-1", "1/2-1/2", "*"].map(r => (
                      <button key={r} onClick={() => handleSetResult(r)}
                        className={`px-3 py-2 rounded-lg text-sm font-mono font-bold border ${broadcast.result === r ? "bg-[#4CAF50]/20 border-[#4CAF50]/40 text-[#4CAF50]" : "border-white/10 text-white/50 hover:bg-white/5"}`}>
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Export actions */}
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => copyToClipboard(broadcast.pgn, "PGN")} className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-white/10 text-white/60 text-sm hover:bg-white/5">
                    <Copy className="w-4 h-4" /> Copy PGN
                  </button>
                  <button onClick={downloadPgn} className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-white/10 text-white/60 text-sm hover:bg-white/5">
                    <Download className="w-4 h-4" /> Download PGN
                  </button>
                  <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-white/10 text-white/60 text-sm hover:bg-white/5">
                    <Eye className="w-4 h-4" /> View Replay
                  </a>
                  <button onClick={() => copyToClipboard(publicUrl, "Replay link")} className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-white/10 text-white/60 text-sm hover:bg-white/5">
                    <Share2 className="w-4 h-4" /> Copy Replay Link
                  </button>
                </div>

                {/* Next round */}
                <div className="rounded-xl border border-[#4CAF50]/20 bg-[#4CAF50]/5 p-5 text-center">
                  <p className="text-sm text-white/60 mb-3">Ready for the next round?</p>
                  <button onClick={() => setConfirmAction({
                    title: "Start Next Round?",
                    message: `This will create a new Board 1 broadcast for Round ${broadcast.roundNumber + 1}. The current game will remain archived.`,
                    confirmLabel: "Start Round " + (broadcast.roundNumber + 1),
                    action: handleStartNextRound,
                  })} className="px-5 py-2.5 rounded-xl bg-[#4CAF50]/20 border border-[#4CAF50]/30 text-[#4CAF50] text-sm font-semibold hover:bg-[#4CAF50]/30">
                    Start Next Round Board 1 Broadcast
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
