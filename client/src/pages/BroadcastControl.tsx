/**
 * OTB Chess — Board 1 Broadcast Control (Event-Ready)
 * Route: /tournament/:id/broadcast/:boardNumber
 *
 * 3-column operator panel:
 *  Left:   Broadcast setup, status, player info, input source, controls
 *  Center: Interactive chessboard, turn indicator, SAN input
 *  Right:  Move list, PGN tools, correction tools, display links
 */
import BarLoader from "@/components/ui/bar-loader";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { Chess } from "chess.js";
import { Chessboard, type SquareHandlerArgs, type PieceDropHandlerArgs } from "react-chessboard";
import { toast } from "sonner";
import {
  Play, Pause, RotateCcw, Copy, Download, ExternalLink,
  Radio, Settings, ChevronLeft, Zap, AlertTriangle,
  CheckCircle2, Clock, Monitor, QrCode, SkipBack, SkipForward,
  Upload, Trash2, RefreshCw, Eye, EyeOff, FlipVertical,
  Square, FileText, Wifi, WifiOff, Shield, Cpu
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { QRCodeSVG } from "qrcode.react";
import { ChessnutProPanel } from "@/components/ChessnutProPanel";
import { ChessnutChromeBTPanel } from "@/components/ChessnutChromeBTPanel";
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
  displayMode: "standard" | "minimal" | "overlay";
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

// ─── Demo PGN ────────────────────────────────────────────────────────────────
const DEMO_PGN = "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3 Nb8 10. d4 Nbd7 11. Nbd2 Bb7 12. Bc2 Re8 13. Nf1 Bf8 14. Ng3 g6";

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status, syncState }: { status: Broadcast["status"]; syncState: SyncState }) {
  if (syncState === "syncing") {
    return (
      <span className="text-xs font-bold px-2.5 py-1 rounded-full border tracking-widest uppercase bg-blue-500/20 text-blue-400 border-blue-500/30 animate-pulse">
        Syncing…
      </span>
    );
  }
  if (syncState === "error") {
    return (
      <span className="text-xs font-bold px-2.5 py-1 rounded-full border tracking-widest uppercase bg-red-700/20 text-red-300 border-red-700/30">
        Sync Error
      </span>
    );
  }
  const map: Record<string, { label: string; cls: string }> = {
    ready:    { label: "Ready",    cls: "bg-[#436850]/20 text-[#436850]/70 border-[#436850]/30" },
    live:     { label: "● LIVE",   cls: "bg-red-500/20 text-red-400 border-red-500/30 animate-pulse" },
    paused:   { label: "Paused",   cls: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
    finished: { label: "Finished", cls: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
    error:    { label: "Error",    cls: "bg-red-700/20 text-red-300 border-red-700/30" },
  };
  const { label, cls } = map[status] ?? map.ready;
  return (
    <span className={`text-xs font-bold px-2.5 py-1 rounded-full border tracking-widest uppercase ${cls}`}>
      {label}
    </span>
  );
}

// ─── Confirmation Dialog ──────────────────────────────────────────────────────
function ConfirmDialog({ open, title, message, onConfirm, onCancel }: {
  open: boolean; title: string; message: string; onConfirm: () => void; onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[oklch(0.15_0.04_145)] border border-white/10 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
        <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
        <p className="text-sm text-white/60 mb-5">{message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 text-sm rounded-lg border border-white/10 text-white/70 hover:bg-white/05">
            Cancel
          </button>
          <button onClick={onConfirm} className="px-4 py-2 text-sm rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 font-medium">
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function BroadcastControl() {
  const { id: tournamentId, boardNumber: boardNumberParam } = useParams<{ id: string; boardNumber: string }>();
  const [, navigate] = useLocation();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const boardNumber = parseInt(boardNumberParam ?? "1", 10);

  // ─── Pre-fill data from Director query params ──────────────────────────────
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

  // Core state
  const [broadcast, setBroadcast] = useState<Broadcast | null>(null);
  const [loading, setLoading] = useState(true);
  const [chess] = useState(() => new Chess());
  const [fen, setFen] = useState("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [legalMoves, setLegalMoves] = useState<string[]>([]);
  const [sanInput, setSanInput] = useState("");
  const [fenInput, setFenInput] = useState("");
  const [boardFlipped, setBoardFlipped] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const [submitting, setSubmitting] = useState(false);
  const sanInputRef = useRef<HTMLInputElement>(null);
  const moveListRef = useRef<HTMLDivElement>(null);

  // Confirmation dialogs
  const [confirmAction, setConfirmAction] = useState<{ title: string; message: string; action: () => void } | null>(null);

  // PGN Import
  const [pgnImportText, setPgnImportText] = useState("");
  const [showPgnImport, setShowPgnImport] = useState(false);

  // Correction
  const [showCorrection, setShowCorrection] = useState(false);
  const [correctionFen, setCorrectionFen] = useState("");
  const [correctionNote, setCorrectionNote] = useState("");

  // Demo mode
  const [demoMode, setDemoMode] = useState(false);
  const [demoPlaying, setDemoPlaying] = useState(false);
  const demoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Display settings
  const [showDisplaySettings, setShowDisplaySettings] = useState(false);
  const [displaySettings, setDisplaySettings] = useState<Record<string, unknown>>({
    showQr: true, showMoveList: true, showRatings: true, showTournamentName: true,
    boardOrientation: "white", theme: "dark", fontSize: "normal",
  });

  // ─── Fetch broadcast ────────────────────────────────────────────────────────
  const fetchBroadcast = useCallback(async () => {
    try {
      // First try to find existing broadcast for this tournament + board
      const listRes = await fetch(`/api/broadcasts/tournament/${tournamentId}`);
      if (listRes.ok) {
        const broadcasts: Broadcast[] = await listRes.json();
        const existing = broadcasts.find(b => b.boardNumber === boardNumber);
        if (existing) {
          setBroadcast(existing);
          chess.load(existing.currentFen);
          setFen(existing.currentFen);
          if (existing.displaySettings) setDisplaySettings(existing.displaySettings as Record<string, unknown>);
          setLoading(false);
          return;
        }
      }
      // Auto-create if none exists — pre-fill from Director query params
      const createRes = await fetch("/api/broadcasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tournamentId,
          boardNumber,
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
      }
    } catch (err) {
      console.error("Failed to fetch broadcast", err);
      toast.error("Failed to load broadcast");
    } finally {
      setLoading(false);
    }
  }, [tournamentId, boardNumber, chess, prefill]);

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
        }
      } catch { /* ignore */ }
    });
    es.addEventListener("status_changed", (e) => {
      try { const data = JSON.parse(e.data); if (data.broadcast) setBroadcast(data.broadcast); } catch { /* ignore */ }
    });
    es.addEventListener("position_corrected", (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.broadcast) {
          setBroadcast(data.broadcast);
          chess.load(data.broadcast.currentFen);
          setFen(data.broadcast.currentFen);
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
        }
      } catch { /* ignore */ }
    });
    return () => es.close();
  }, [broadcast?.id, chess]);

  // ─── Move submission ───────────────────────────────────────────────────────
  const submitMove = useCallback(async (san: string, uci: string, fenBefore: string, fenAfter: string) => {
    if (!broadcast || submitting) return;
    setSubmitting(true);
    setSyncState("syncing");
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
        // Rollback local state
        chess.load(fenBefore);
        setFen(fenBefore);
        setSyncState("error");
      } else {
        const data = await res.json();
        if (data.broadcast) setBroadcast(data.broadcast);
        setSyncState("saved");
        setTimeout(() => setSyncState("idle"), 1500);
      }
    } catch {
      chess.load(fenBefore);
      setFen(fenBefore);
      toast.error("Network error — move not saved");
      setSyncState("error");
    } finally {
      setSubmitting(false);
    }
  }, [broadcast, chess, submitting]);

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
      toast.error(`Invalid move: ${sanInput}`);
      return;
    }
    const fenAfter = chess.fen();
    setFen(fenAfter);
    setSanInput("");
    submitMove(move.san, move.from + move.to + (move.promotion ?? ""), fenBefore, fenAfter);
    sanInputRef.current?.focus();
  }

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
      }
    } catch { toast.error("Failed to update status"); }
  }

  // ─── Undo ─────────────────────────────────────────────────────────────────
  async function handleUndo() {
    if (!broadcast) return;
    try {
      const res = await fetch(`/api/broadcasts/${broadcast.id}/moves/last`, { method: "DELETE" });
      if (res.ok) {
        const data = await res.json();
        if (data.broadcast) {
          setBroadcast(data.broadcast);
          chess.load(data.broadcast.currentFen);
          setFen(data.broadcast.currentFen);
          toast.success("Move undone");
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
      }
    } catch { toast.error("Failed to reset"); }
  }

  // ─── FEN correction ───────────────────────────────────────────────────────
  async function handleCorrection() {
    if (!broadcast || !correctionFen.trim()) return;
    try {
      const testChess = new Chess();
      testChess.load(correctionFen.trim());
    } catch {
      toast.error("Invalid FEN");
      return;
    }
    try {
      const res = await fetch(`/api/broadcasts/${broadcast.id}/correction`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fen: correctionFen.trim(), note: correctionNote || "Position corrected by operator" }),
      });
      if (res.ok) {
        const updated = await res.json();
        setBroadcast(updated);
        chess.load(updated.currentFen);
        setFen(updated.currentFen);
        setShowCorrection(false);
        setCorrectionFen("");
        setCorrectionNote("");
        toast.success("Position corrected");
      }
    } catch { toast.error("Failed to apply correction"); }
  }

  // ─── PGN Import ───────────────────────────────────────────────────────────
  async function handlePgnImport() {
    if (!broadcast || !pgnImportText.trim()) return;
    try {
      const importChess = new Chess();
      importChess.loadPgn(pgnImportText.trim());
      const importedFen = importChess.fen();
      const importedPgn = importChess.pgn();
      // Apply correction with imported PGN
      const res = await fetch(`/api/broadcasts/${broadcast.id}/correction`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fen: importedFen, pgn: importedPgn, note: "PGN imported by operator" }),
      });
      if (res.ok) {
        const updated = await res.json();
        setBroadcast(updated);
        chess.load(updated.currentFen);
        setFen(updated.currentFen);
        setShowPgnImport(false);
        setPgnImportText("");
        toast.success("PGN imported successfully");
      }
    } catch {
      toast.error("Invalid PGN or import failed");
    }
  }

  // ─── Display settings ─────────────────────────────────────────────────────
  async function saveDisplaySettings(newSettings: Record<string, unknown>, newMode?: string) {
    if (!broadcast) return;
    try {
      await fetch(`/api/broadcasts/${broadcast.id}/display-settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayMode: newMode ?? broadcast.displayMode, displaySettings: newSettings }),
      });
      setDisplaySettings(newSettings);
    } catch { toast.error("Failed to save display settings"); }
  }

  // ─── Demo mode ────────────────────────────────────────────────────────────
  function startDemo() {
    if (!broadcast) return;
    setDemoMode(true);
    const demoChess = new Chess();
    demoChess.loadPgn(DEMO_PGN);
    const moves = demoChess.history({ verbose: true });
    let moveIdx = 0;
    chess.reset();
    setFen(chess.fen());

    const interval = setInterval(() => {
      if (moveIdx >= moves.length) {
        clearInterval(interval);
        setDemoPlaying(false);
        return;
      }
      const m = moves[moveIdx];
      const fenBefore = chess.fen();
      chess.move(m.san);
      const fenAfter = chess.fen();
      setFen(fenAfter);
      submitMove(m.san, m.from + m.to + (m.promotion ?? ""), fenBefore, fenAfter);
      moveIdx++;
    }, 2500);
    demoIntervalRef.current = interval;
    setDemoPlaying(true);
  }

  function stopDemo() {
    if (demoIntervalRef.current) {
      clearInterval(demoIntervalRef.current);
      demoIntervalRef.current = null;
    }
    setDemoPlaying(false);
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
    if (moveListRef.current) {
      moveListRef.current.scrollTop = moveListRef.current.scrollHeight;
    }
  }, [movePairs]);

  // ─── Public URLs ──────────────────────────────────────────────────────────
  const publicUrl = broadcast ? `${window.location.origin}/live/board/${broadcast.publicSlug}` : "";
  const venueUrl = broadcast ? `${window.location.origin}/live/board/${broadcast.publicSlug}/display` : "";

  // ─── Copy helpers ─────────────────────────────────────────────────────────
  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text).then(() => toast.success(`${label} copied`));
  }

  function downloadPgn() {
    if (!broadcast) return;
    const header = `[White "${broadcast.whitePlayerName}"]\n[Black "${broadcast.blackPlayerName}"]\n[Result "${broadcast.result ?? "*"}"]\n[Round "${broadcast.roundNumber}"]\n[Board "${broadcast.boardNumber}"]\n\n`;
    const blob = new Blob([header + broadcast.pgn], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `board${broadcast.boardNumber}-round${broadcast.roundNumber}.pgn`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ─── Loading state ────────────────────────────────────────────────────────
  if (loading) {
    return <OTBLoader fullPage isDark label="Loading broadcast control…" />;
  }

  if (!broadcast) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0d1a0f]">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-3" />
          <p className="text-white/70">Failed to load broadcast</p>
          <button onClick={() => navigate(`/tournament/${tournamentId}/manage`)} className="mt-4 text-sm text-[#4CAF50] hover:underline">
            ← Back to Director
          </button>
        </div>
      </div>
    );
  }

  const turnLabel = chess.turn() === "w" ? "White to move" : "Black to move";
  const canMove = broadcast.status === "live" || broadcast.status === "ready";

  return (
    <div className="min-h-screen bg-[#0d1a0f] text-white">
      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={!!confirmAction}
        title={confirmAction?.title ?? ""}
        message={confirmAction?.message ?? ""}
        onConfirm={() => { confirmAction?.action(); setConfirmAction(null); }}
        onCancel={() => setConfirmAction(null)}
      />

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/08 bg-[#0d1a0f]/95 backdrop-blur-md px-4 py-3">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(`/tournament/${tournamentId}/manage`)} className="p-2 rounded-lg hover:bg-white/05 text-white/60">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <Radio className="w-5 h-5 text-red-400" />
            <span className="font-bold text-sm">Board {broadcast.boardNumber} Broadcast</span>
            {demoMode && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold">DEMO</span>}
          </div>
          <div className="flex items-center gap-3">
            {/* Bridge Token — always visible for easy CLI copy */}
            {broadcast.bridgeToken && (
              <div className="flex items-center gap-1.5 bg-white/05 border border-white/10 rounded-lg px-2.5 py-1.5 group">
                <Cpu className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="text-[10px] text-white/40 font-medium hidden sm:inline">Bridge Token</span>
                <code className="text-[10px] font-mono text-emerald-300/80 max-w-[120px] truncate">
                  {broadcast.bridgeToken}
                </code>
                <button
                  onClick={() => copyToClipboard(broadcast.bridgeToken!, "Bridge Token")}
                  title="Copy bridge token"
                  className="p-0.5 rounded hover:bg-white/10 text-white/30 hover:text-emerald-400 transition-colors"
                >
                  <Copy className="w-3 h-3" />
                </button>
              </div>
            )}
            <StatusBadge status={broadcast.status} syncState={syncState} />
          </div>
        </div>
      </header>

      {/* 3-Column Layout */}
      <div className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-[280px_1fr_300px] gap-4 p-4">

        {/* ═══ LEFT COLUMN ═══ */}
        <div className="space-y-4">
          {/* Players */}
          <div className="rounded-xl border border-white/08 bg-[oklch(0.14_0.04_145)] p-4 space-y-3">
            <h3 className="text-xs font-bold text-white/40 uppercase tracking-wider">Players</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-white flex items-center justify-center text-[10px] font-bold text-[#12372A]">W</div>
                <span className="text-sm font-medium truncate">{broadcast.whitePlayerName}</span>
                {broadcast.whitePlayerElo && <span className="text-xs text-white/40">{broadcast.whitePlayerElo}</span>}
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-[#12372A] flex items-center justify-center text-[10px] font-bold text-white">B</div>
                <span className="text-sm font-medium truncate">{broadcast.blackPlayerName}</span>
                {broadcast.blackPlayerElo && <span className="text-xs text-white/40">{broadcast.blackPlayerElo}</span>}
              </div>
            </div>
            <div className="text-xs text-white/30">Round {broadcast.roundNumber} • Board {broadcast.boardNumber}</div>
          </div>

          {/* Controls */}
          <div className="rounded-xl border border-white/08 bg-[oklch(0.14_0.04_145)] p-4 space-y-3">
            <h3 className="text-xs font-bold text-white/40 uppercase tracking-wider">Controls</h3>
            <div className="grid grid-cols-2 gap-2">
              {broadcast.status === "ready" && (
                <button onClick={() => updateStatus("live")} className="col-span-2 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-[#4CAF50]/20 border border-[#4CAF50]/30 text-[#4CAF50] text-sm font-medium hover:bg-[#4CAF50]/30">
                  <Play className="w-4 h-4" /> Start Broadcast
                </button>
              )}
              {broadcast.status === "live" && (
                <button onClick={() => updateStatus("paused")} className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500/15 border border-amber-500/25 text-amber-400 text-xs font-medium hover:bg-amber-500/25">
                  <Pause className="w-3.5 h-3.5" /> Pause
                </button>
              )}
              {broadcast.status === "paused" && (
                <button onClick={() => updateStatus("live")} className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#4CAF50]/15 border border-[#4CAF50]/25 text-[#4CAF50] text-xs font-medium hover:bg-[#4CAF50]/25">
                  <Play className="w-3.5 h-3.5" /> Resume
                </button>
              )}
              {(broadcast.status === "live" || broadcast.status === "paused") && (
                <button onClick={() => setConfirmAction({ title: "End Game?", message: "This will mark the broadcast as finished. You can still set a result after.", action: () => updateStatus("finished") })} className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/15 border border-red-500/25 text-red-400 text-xs font-medium hover:bg-red-500/25">
                  <Square className="w-3.5 h-3.5" /> End
                </button>
              )}
              <button onClick={handleUndo} disabled={broadcast.moveNumber === 0} className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-white/10 text-white/60 text-xs font-medium hover:bg-white/05 disabled:opacity-30">
                <SkipBack className="w-3.5 h-3.5" /> Undo
              </button>
              <button onClick={() => setBoardFlipped(!boardFlipped)} className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-white/10 text-white/60 text-xs font-medium hover:bg-white/05">
                <FlipVertical className="w-3.5 h-3.5" /> Flip
              </button>
              <button onClick={() => setConfirmAction({ title: "Reset Broadcast?", message: "This will delete all moves and reset the board to the starting position.", action: handleReset })} className="col-span-2 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-red-500/20 text-red-400/70 text-xs font-medium hover:bg-red-500/10">
                <RefreshCw className="w-3.5 h-3.5" /> Reset Broadcast
              </button>
            </div>
          </div>

          {/* Result */}
          {(broadcast.status === "live" || broadcast.status === "paused" || broadcast.status === "finished") && (
            <div className="rounded-xl border border-white/08 bg-[oklch(0.14_0.04_145)] p-4 space-y-3">
              <h3 className="text-xs font-bold text-white/40 uppercase tracking-wider">Set Result</h3>
              <div className="grid grid-cols-4 gap-1.5">
                {["1-0", "0-1", "1/2-1/2", "*"].map(r => (
                  <button key={r} onClick={() => setConfirmAction({ title: "Set Result?", message: `Set game result to ${r}?`, action: () => handleSetResult(r) })}
                    className={`px-2 py-1.5 rounded-lg text-xs font-mono font-bold border ${broadcast.result === r ? "bg-[#4CAF50]/20 border-[#4CAF50]/40 text-[#4CAF50]" : "border-white/10 text-white/50 hover:bg-white/05"}`}>
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Demo Mode */}
          <div className="rounded-xl border border-white/08 bg-[oklch(0.14_0.04_145)] p-4 space-y-3">
            <h3 className="text-xs font-bold text-white/40 uppercase tracking-wider">Demo / Test</h3>
            {!demoMode ? (
              <button onClick={startDemo} className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-amber-500/20 text-amber-400 text-xs font-medium hover:bg-amber-500/10">
                <Zap className="w-3.5 h-3.5" /> Start Demo
              </button>
            ) : (
              <div className="space-y-2">
                <div className="text-xs text-amber-400/70">Demo mode active — moves auto-play</div>
                <button onClick={stopDemo} className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-red-500/20 text-red-400 text-xs font-medium hover:bg-red-500/10">
                  <Pause className="w-3.5 h-3.5" /> Stop Demo
                </button>
              </div>
            )}
          </div>

          {/* Input Source */}
          <div className="rounded-xl border border-white/08 bg-[oklch(0.14_0.04_145)] p-4 space-y-3">
            <h3 className="text-xs font-bold text-white/40 uppercase tracking-wider">Input Source</h3>
            <div className="space-y-1.5">
              {(["manual", "chessnut_pro_beta", "chessnut_chrome_bluetooth", "pgn_import"] as const).map(src => (
                <button
                  key={src}
                  disabled={broadcast.inputSource === src}
                  onClick={async () => {
                    if (!broadcast || broadcast.inputSource === src) return;
                    try {
                      const res = await fetch(`/api/broadcasts/${broadcast.id}/input-source`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ source: src }),
                      });
                      if (!res.ok) throw new Error(await res.text());
                      const data = await res.json();
                      // Server returns the full updated broadcast object
                      setBroadcast(data);
                      toast.success(
                        src === "chessnut_pro_beta" ? "Switched to Chessnut Pro — bridge token ready" :
                        src === "chessnut_chrome_bluetooth" ? "Switched to Chrome Bluetooth — connect your board" :
                        src === "pgn_import" ? "Switched to PGN Import mode" :
                        "Switched to Manual Input"
                      );
                    } catch (err) {
                      toast.error("Failed to switch input source");
                    }
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs border transition-all duration-150 active:scale-[0.98] ${
                    broadcast.inputSource === src
                      ? "bg-[#4CAF50]/10 border-[#4CAF50]/30 text-[#4CAF50] cursor-default"
                      : "border-white/05 text-white/40 hover:bg-white/08 hover:border-white/15 hover:text-white/60 cursor-pointer"
                  }`}
                >
                  {src === "manual" && "⌨️ Manual Input"}
                  {src === "chessnut_pro_beta" && "♟ Chessnut Pro (Beta)"}
                  {src === "chessnut_chrome_bluetooth" && "🔵 Chrome Bluetooth (Direct)"}
                  {src === "pgn_import" && "📄 PGN Import"}
                </button>
              ))}
            </div>
            {broadcast.inputSource === "chessnut_pro_beta" && broadcast.bridgeToken && (
              <div className="mt-2 p-2 rounded-lg bg-white/03 border border-white/05">
                <div className="text-[10px] text-white/30 mb-1">Bridge Token</div>
                <div className="flex items-center gap-2">
                  <code className="text-[10px] text-white/50 truncate flex-1">{broadcast.bridgeToken}</code>
                  <button onClick={() => copyToClipboard(broadcast.bridgeToken!, "Token")} className="p-1 rounded hover:bg-white/05">
                    <Copy className="w-3 h-3 text-white/40" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ═══ CENTER COLUMN ═══ */}
        <div className="space-y-4">
          {/* Turn indicator */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${chess.turn() === "w" ? "bg-white shadow-[0_0_8px_rgba(255,255,255,0.4)]" : "bg-[#12372A] border border-white/20"}`} />
              <span className="text-sm font-medium text-white/70">{turnLabel}</span>
              {broadcast.lastMoveSan && (
                <span className="text-xs text-white/40 font-mono">Last: {broadcast.lastMoveSan}</span>
              )}
            </div>
            {broadcast.result && (
              <span className="text-lg font-bold font-mono text-[#4CAF50]">{broadcast.result}</span>
            )}
          </div>

          {/* Chess board */}
          <div className="rounded-xl overflow-hidden border border-white/08 shadow-2xl max-w-[560px] mx-auto">
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
          <form onSubmit={handleSanSubmit} className="flex gap-2 rounded-xl p-3 border border-white/08 bg-[oklch(0.14_0.04_145)] max-w-[560px] mx-auto">
            <input
              ref={sanInputRef}
              value={sanInput}
              onChange={(e) => setSanInput(e.target.value)}
              placeholder="Enter move (e.g. e4, Nf3, O-O)"
              disabled={!canMove || submitting}
              className="flex-1 px-3 py-2 rounded-lg text-sm border font-mono bg-white/05 border-white/10 text-white placeholder-white/30 disabled:opacity-40"
            />
            <button type="submit" disabled={!canMove || !sanInput.trim() || submitting}
              className="px-4 py-2 rounded-lg bg-[#4CAF50]/20 border border-[#4CAF50]/30 text-[#4CAF50] text-sm font-medium hover:bg-[#4CAF50]/30 disabled:opacity-30">
              {submitting ? "…" : "Play"}
            </button>
          </form>
        </div>

        {/* ═══ RIGHT COLUMN ═══ */}
        <div className="space-y-4">
          {/* Move list */}
          <div className="rounded-xl border border-white/08 bg-[oklch(0.14_0.04_145)] p-4">
            <h3 className="text-xs font-bold text-white/40 uppercase tracking-wider mb-3">Moves</h3>
            <div ref={moveListRef} className="max-h-[240px] overflow-y-auto space-y-0.5 font-mono text-xs">
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

          {/* PGN Tools */}
          <div className="rounded-xl border border-white/08 bg-[oklch(0.14_0.04_145)] p-4 space-y-2">
            <h3 className="text-xs font-bold text-white/40 uppercase tracking-wider mb-2">PGN Tools</h3>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => copyToClipboard(broadcast.pgn, "PGN")} className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-white/10 text-white/60 text-xs hover:bg-white/05">
                <Copy className="w-3 h-3" /> Copy
              </button>
              <button onClick={downloadPgn} className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-white/10 text-white/60 text-xs hover:bg-white/05">
                <Download className="w-3 h-3" /> Download
              </button>
              <button onClick={() => setShowPgnImport(!showPgnImport)} className="col-span-2 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-white/10 text-white/60 text-xs hover:bg-white/05">
                <Upload className="w-3 h-3" /> Import PGN
              </button>
            </div>
            {showPgnImport && (
              <div className="space-y-2 pt-2 border-t border-white/05">
                <textarea
                  value={pgnImportText}
                  onChange={(e) => setPgnImportText(e.target.value)}
                  placeholder="Paste PGN here…"
                  rows={4}
                  className="w-full px-3 py-2 rounded-lg text-xs font-mono bg-white/05 border border-white/10 text-white placeholder-white/30 resize-none"
                />
                <div className="flex gap-2">
                  <button onClick={handlePgnImport} disabled={!pgnImportText.trim()} className="flex-1 px-3 py-1.5 rounded-lg bg-[#4CAF50]/20 border border-[#4CAF50]/30 text-[#4CAF50] text-xs font-medium disabled:opacity-30">
                    Load PGN
                  </button>
                  <button onClick={() => { setShowPgnImport(false); setPgnImportText(""); }} className="px-3 py-1.5 rounded-lg border border-white/10 text-white/40 text-xs">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Correction Tools */}
          <div className="rounded-xl border border-white/08 bg-[oklch(0.14_0.04_145)] p-4 space-y-2">
            <h3 className="text-xs font-bold text-white/40 uppercase tracking-wider mb-2">Corrections</h3>
            <button onClick={() => setShowCorrection(!showCorrection)} className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-amber-500/20 text-amber-400/70 text-xs hover:bg-amber-500/10">
              <Settings className="w-3 h-3" /> Set Custom FEN
            </button>
            {showCorrection && (
              <div className="space-y-2 pt-2 border-t border-white/05">
                <input
                  value={correctionFen}
                  onChange={(e) => setCorrectionFen(e.target.value)}
                  placeholder="Paste FEN…"
                  className="w-full px-3 py-2 rounded-lg text-xs font-mono bg-white/05 border border-white/10 text-white placeholder-white/30"
                />
                <input
                  value={correctionNote}
                  onChange={(e) => setCorrectionNote(e.target.value)}
                  placeholder="Correction note (optional)"
                  className="w-full px-3 py-2 rounded-lg text-xs bg-white/05 border border-white/10 text-white placeholder-white/30"
                />
                <button onClick={() => setConfirmAction({ title: "Apply Correction?", message: "This will override the current position. A correction record will be logged.", action: handleCorrection })}
                  disabled={!correctionFen.trim()}
                  className="w-full px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-medium disabled:opacity-30">
                  Apply Correction
                </button>
              </div>
            )}
          </div>

          {/* Chessnut Pro Bridge Panel */}
          {broadcast.inputSource === "chessnut_pro_beta" && (
            <ChessnutProPanel
              broadcastId={broadcast.id}
              bridgeToken={broadcast.bridgeToken}
              bridgeStatus={broadcast.bridgeStatus ?? "not_configured"}
              bridgeDeviceName={broadcast.bridgeDeviceName ?? null}
              bridgeLastSeenAt={broadcast.bridgeLastSeenAt ?? null}
              bridgeErrorMessage={broadcast.bridgeErrorMessage ?? null}
              onTokenRegenerated={(newToken) => {
                setBroadcast(prev => prev ? { ...prev, bridgeToken: newToken } : prev);
                toast.success("Bridge token regenerated");
              }}
            />
          )}

          {/* Chessnut Pro — Chrome Web Bluetooth (Direct) Panel */}
          {broadcast.inputSource === "chessnut_chrome_bluetooth" && (
            <ChessnutChromeBTPanel
              broadcastId={broadcast.id}
              currentFen={chess.fen()}
              onMoveAccepted={(san, uci, fenBefore, fenAfter) => {
                // Apply move to local chess state and sync with server
                try {
                  chess.load(fenBefore);
                  chess.move(san);
                  setFen(chess.fen());
                } catch { /* ignore local apply error */ }
                submitMove(san, uci, fenBefore, fenAfter);
              }}
              onSwitchToManual={async () => {
                try {
                  const res = await fetch(`/api/broadcasts/${broadcast.id}/input-source`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ source: "manual" }),
                  });
                  if (!res.ok) throw new Error(await res.text());
                  const data = await res.json();
                  // Server returns the full updated broadcast object
                  setBroadcast(data);
                  toast.success("Switched to Manual Input");
                } catch {
                  toast.error("Failed to switch input source");
                }
              }}
            />
          )}

          {/* Display Links */}
          <div className="rounded-xl border border-white/08 bg-[oklch(0.14_0.04_145)] p-4 space-y-2">
            <h3 className="text-xs font-bold text-white/40 uppercase tracking-wider mb-2">Display</h3>
            <div className="grid grid-cols-1 gap-2">
              <a href={venueUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#4CAF50]/15 border border-[#4CAF50]/25 text-[#4CAF50] text-xs font-medium hover:bg-[#4CAF50]/25">
                <Monitor className="w-3.5 h-3.5" /> Open Venue Display
              </a>
              <button onClick={() => copyToClipboard(publicUrl, "Public link")} className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-white/10 text-white/60 text-xs hover:bg-white/05">
                <Copy className="w-3 h-3" /> Copy Public Link
              </button>
              <button onClick={() => setShowDisplaySettings(!showDisplaySettings)} className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-white/10 text-white/60 text-xs hover:bg-white/05">
                <Settings className="w-3 h-3" /> Display Settings
              </button>
            </div>

            {showDisplaySettings && (
              <div className="space-y-2 pt-2 border-t border-white/05">
                <div className="text-[10px] text-white/30 uppercase tracking-wider">Display Mode</div>
                <div className="grid grid-cols-3 gap-1">
                  {(["standard", "minimal", "overlay"] as const).map(mode => (
                    <button key={mode} onClick={() => saveDisplaySettings(displaySettings, mode)}
                      className={`px-2 py-1.5 rounded text-[10px] font-medium border ${broadcast.displayMode === mode ? "bg-[#4CAF50]/15 border-[#4CAF50]/30 text-[#4CAF50]" : "border-white/10 text-white/40 hover:bg-white/05"}`}>
                      {mode.charAt(0).toUpperCase() + mode.slice(1)}
                    </button>
                  ))}
                </div>
                <div className="space-y-1.5 pt-1">
                  {[
                    { key: "showQr", label: "Show QR Code" },
                    { key: "showMoveList", label: "Show Move List" },
                    { key: "showRatings", label: "Show Ratings" },
                    { key: "showTournamentName", label: "Show Tournament Name" },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center justify-between cursor-pointer">
                      <span className="text-[10px] text-white/50">{label}</span>
                      <input
                        type="checkbox"
                        checked={!!displaySettings[key]}
                        onChange={(e) => {
                          const updated = { ...displaySettings, [key]: e.target.checked };
                          saveDisplaySettings(updated);
                        }}
                        className="w-3.5 h-3.5 rounded accent-[#4CAF50]"
                      />
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* QR Code */}
            <div className="pt-2 flex justify-center">
              <QRCodeSVG value={publicUrl} size={80} bgColor="transparent" fgColor="#4CAF50" level="L" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
