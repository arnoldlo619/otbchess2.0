/**
 * OTB Chess — Board 1 Broadcast Control Page
 * Route: /tournament/:id/broadcast/:boardNumber
 *
 * Director-only page for managing a live game broadcast.
 * Features: click-to-move board, SAN input, undo, pause/resume,
 * FEN correction, result setting, PGN export, and input source selector.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { Chess } from "chess.js";
import { Chessboard, type SquareHandlerArgs, type PieceDropHandlerArgs } from "react-chessboard";
import { toast } from "sonner";
import {
  Play, Pause, RotateCcw, Copy, Download, ExternalLink,
  Radio, Settings, ChevronLeft, Zap, AlertTriangle,
  CheckCircle2, Clock, Monitor, QrCode
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { QRCodeSVG } from "qrcode.react";

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
  inputSource: "manual" | "chessnut_pro_beta" | "pgn_import";
  currentFen: string;
  pgn: string;
  lastMoveSan?: string | null;
  lastMoveUci?: string | null;
  moveNumber: number;
  sideToMove: "w" | "b";
  result?: string | null;
  publicSlug: string;
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: Broadcast["status"] }) {
  const map: Record<string, { label: string; cls: string }> = {
    ready:    { label: "Ready",   cls: "bg-gray-500/20 text-gray-300 border-gray-500/30" },
    live:     { label: "● LIVE",  cls: "bg-red-500/20 text-red-400 border-red-500/30 animate-pulse" },
    paused:   { label: "Paused",  cls: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
    finished: { label: "Finished",cls: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
    error:    { label: "Error",   cls: "bg-red-700/20 text-red-300 border-red-700/30" },
  };
  const { label, cls } = map[status] ?? map.ready;
  return (
    <span className={`text-xs font-bold px-2.5 py-1 rounded-full border tracking-widest uppercase ${cls}`}>
      {label}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function BroadcastControl() {
  const { id: tournamentId, boardNumber: boardNumberParam } = useParams<{ id: string; boardNumber: string }>();
  const [, navigate] = useLocation();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const boardNumber = parseInt(boardNumberParam ?? "1", 10);

  const [broadcast, setBroadcast] = useState<Broadcast | null>(null);
  const [loading, setLoading] = useState(true);
  const [chess] = useState(() => new Chess());
  const [fen, setFen] = useState("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [legalMoves, setLegalMoves] = useState<string[]>([]);
  const [sanInput, setSanInput] = useState("");
  const [fenInput, setFenInput] = useState("");
  const [showFenModal, setShowFenModal] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [boardFlipped, setBoardFlipped] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const sanInputRef = useRef<HTMLInputElement>(null);

  const publicUrl = broadcast
    ? `${window.location.origin}/live/board/${broadcast.publicSlug}`
    : "";
  const displayUrl = broadcast
    ? `${window.location.origin}/live/board/${broadcast.publicSlug}/display`
    : "";

  // ─── Load or create broadcast ──────────────────────────────────────────────
  useEffect(() => {
    if (!tournamentId) return;
    async function init() {
      setLoading(true);
      try {
        // Check for existing broadcast for this tournament/board
        const res = await fetch(`/api/broadcasts/tournament/${tournamentId}`);
        const list: Broadcast[] = await res.json();
        const existing = list.find((b) => b.boardNumber === boardNumber);
        if (existing) {
          setBroadcast(existing);
          syncChess(existing.currentFen, existing.pgn);
        }
        // If none found, we show the "Start Broadcast" setup form
      } catch (err) {
        console.error("[BroadcastControl] init error", err);
        toast.error("Failed to load broadcast");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [tournamentId, boardNumber]);

  function syncChess(fenStr: string, _pgn?: string) {
    try {
      chess.load(fenStr);
      setFen(fenStr);
    } catch {
      // keep current
    }
  }

  // ─── Create new broadcast ──────────────────────────────────────────────────
  const [setupForm, setSetupForm] = useState({
    whitePlayerName: "White",
    blackPlayerName: "Black",
    whitePlayerElo: "",
    blackPlayerElo: "",
    roundNumber: "1",
  });

  async function createBroadcast() {
    try {
      const res = await fetch("/api/broadcasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tournamentId,
          boardNumber,
          roundNumber: parseInt(setupForm.roundNumber, 10) || 1,
          whitePlayerName: setupForm.whitePlayerName || "White",
          blackPlayerName: setupForm.blackPlayerName || "Black",
          whitePlayerElo: setupForm.whitePlayerElo ? parseInt(setupForm.whitePlayerElo, 10) : null,
          blackPlayerElo: setupForm.blackPlayerElo ? parseInt(setupForm.blackPlayerElo, 10) : null,
        }),
      });
      if (!res.ok) throw new Error("Failed to create broadcast");
      const b: Broadcast = await res.json();
      setBroadcast(b);
      chess.reset();
      setFen(chess.fen());
      toast.success("Broadcast session created!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to create broadcast");
    }
  }

  // ─── Submit move ──────────────────────────────────────────────────────────
  const submitMove = useCallback(async (san: string, uci: string, fenBefore: string, fenAfter: string) => {
    if (!broadcast || submitting) return;
    setSubmitting(true);
    try {
      // Build PGN string from chess.js
      const pgn = chess.pgn();
      const moveNum = chess.history().length;
      const side = chess.turn();

      const res = await fetch(`/api/broadcasts/${broadcast.id}/moves`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ san, uci, fenBefore, fenAfter, pgn, moveNumber: moveNum, sideToMove: side }),
      });
      if (!res.ok) throw new Error("Failed to submit move");
      const { broadcast: updated } = await res.json();
      setBroadcast(updated);
    } catch (err) {
      console.error(err);
      toast.error("Failed to submit move");
      // Revert chess state
      chess.undo();
      setFen(chess.fen());
    } finally {
      setSubmitting(false);
    }
  }, [broadcast, chess, submitting]);

  // ─── Board click handler ───────────────────────────────────────────────────
  function handleSquareClick({ square }: SquareHandlerArgs) {
    if (!broadcast || broadcast.status === "finished" || broadcast.status === "paused") return;

    if (selectedSquare) {
      // Try to make the move
      const fenBefore = chess.fen();
      const move = chess.move({ from: selectedSquare, to: square, promotion: "q" });
      if (move) {
        const fenAfter = chess.fen();
        setFen(fenAfter);
        setSelectedSquare(null);
        setLegalMoves([]);
        submitMove(move.san, move.from + move.to + (move.promotion ?? ""), fenBefore, fenAfter);
      } else {
        // Try selecting the clicked square instead
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
    if (!broadcast || broadcast.status === "finished") return false;
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
    if (!broadcast || !sanInput.trim()) return;
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
  }

  // ─── Undo ──────────────────────────────────────────────────────────────────
  async function handleUndo() {
    if (!broadcast) return;
    try {
      const res = await fetch(`/api/broadcasts/${broadcast.id}/moves/last`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to undo");
      const { broadcast: updated } = await res.json();
      setBroadcast(updated);
      chess.undo();
      setFen(chess.fen());
      toast.success("Last move undone");
    } catch {
      toast.error("Failed to undo move");
    }
  }

  // ─── Status controls ──────────────────────────────────────────────────────
  async function setStatus(status: Broadcast["status"]) {
    if (!broadcast) return;
    try {
      const res = await fetch(`/api/broadcasts/${broadcast.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      const updated: Broadcast = await res.json();
      setBroadcast(updated);
      toast.success(`Broadcast ${status}`);
    } catch {
      toast.error("Failed to update status");
    }
  }

  // ─── FEN correction ───────────────────────────────────────────────────────
  async function handleFenCorrection() {
    if (!broadcast || !fenInput.trim()) return;
    try {
      chess.load(fenInput.trim());
    } catch {
      toast.error("Invalid FEN string");
      return;
    }
    try {
      const res = await fetch(`/api/broadcasts/${broadcast.id}/fen`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fen: fenInput.trim() }),
      });
      if (!res.ok) throw new Error("Failed to set FEN");
      const updated: Broadcast = await res.json();
      setBroadcast(updated);
      setFen(fenInput.trim());
      setShowFenModal(false);
      setFenInput("");
      toast.success("Position updated");
    } catch {
      toast.error("Failed to set position");
    }
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
      if (!res.ok) throw new Error("Failed to set result");
      const updated: Broadcast = await res.json();
      setBroadcast(updated);
      setShowResultModal(false);
      toast.success(`Result set: ${result}`);
    } catch {
      toast.error("Failed to set result");
    }
  }

  // ─── PGN export ───────────────────────────────────────────────────────────
  function exportPgn() {
    if (!broadcast) return;
    const pgn = `[Event "OTB Chess Tournament"]\n[Round "${broadcast.roundNumber}"]\n[Board "${broadcast.boardNumber}"]\n[White "${broadcast.whitePlayerName}"]\n[Black "${broadcast.blackPlayerName}"]\n[Result "${broadcast.result ?? "*"}"]\n\n${broadcast.pgn} ${broadcast.result ?? "*"}`;
    navigator.clipboard.writeText(pgn).then(() => toast.success("PGN copied to clipboard"));
  }

  // ─── Custom square styles ─────────────────────────────────────────────────
  const customSquareStyles: Record<string, React.CSSProperties> = {};
  if (selectedSquare) {
    customSquareStyles[selectedSquare] = { backgroundColor: "rgba(255, 200, 0, 0.5)" };
  }
  for (const sq of legalMoves) {
    const piece = chess.get(sq as any);
    customSquareStyles[sq] = piece
      ? { boxShadow: "inset 0 0 0 3px rgba(76, 175, 80, 0.8)" }
      : {
          background: "radial-gradient(circle, rgba(76,175,80,0.6) 30%, transparent 31%)",
          borderRadius: "50%",
        };
  }
  if (broadcast?.lastMoveUci && broadcast.lastMoveUci.length >= 4) {
    const from = broadcast.lastMoveUci.slice(0, 2);
    const to = broadcast.lastMoveUci.slice(2, 4);
    customSquareStyles[from] = { ...customSquareStyles[from], backgroundColor: "rgba(255, 255, 0, 0.25)" };
    customSquareStyles[to] = { ...customSquareStyles[to], backgroundColor: "rgba(255, 255, 0, 0.35)" };
  }

  // ─── Move list ────────────────────────────────────────────────────────────
  const moveHistory = chess.history();
  const movePairs: [string, string?][] = [];
  for (let i = 0; i < moveHistory.length; i += 2) {
    movePairs.push([moveHistory[i], moveHistory[i + 1]]);
  }

  // ─── Loading state ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? "bg-[oklch(0.15_0.04_145)]" : "bg-gray-50"}`}>
        <div className="text-center space-y-3">
          <Radio className="w-8 h-8 text-[#4CAF50] animate-pulse mx-auto" />
          <p className={`text-sm ${isDark ? "text-white/60" : "text-gray-500"}`}>Loading broadcast...</p>
        </div>
      </div>
    );
  }

  // ─── Setup form (no broadcast yet) ───────────────────────────────────────
  if (!broadcast) {
    return (
      <div className={`min-h-screen ${isDark ? "bg-[oklch(0.15_0.04_145)] text-white" : "bg-gray-50 text-gray-900"}`}>
        <div className="max-w-lg mx-auto px-4 py-12">
          <button onClick={() => navigate(`/tournament/${tournamentId}/manage`)}
            className={`flex items-center gap-1.5 text-sm mb-8 ${isDark ? "text-white/50 hover:text-white" : "text-gray-500 hover:text-gray-900"}`}>
            <ChevronLeft className="w-4 h-4" /> Back to Dashboard
          </button>

          <div className={`rounded-2xl p-8 border ${isDark ? "bg-[oklch(0.18_0.05_145)] border-white/10" : "bg-white border-gray-200 shadow-sm"}`}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[#4CAF50]/20 flex items-center justify-center">
                <Radio className="w-5 h-5 text-[#4CAF50]" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Start Live Broadcast</h1>
                <p className={`text-sm ${isDark ? "text-white/50" : "text-gray-500"}`}>Board {boardNumber} · Tournament</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`text-xs font-semibold uppercase tracking-wider mb-1.5 block ${isDark ? "text-white/50" : "text-gray-500"}`}>White Player</label>
                  <input
                    value={setupForm.whitePlayerName}
                    onChange={(e) => setSetupForm((f) => ({ ...f, whitePlayerName: e.target.value }))}
                    placeholder="White player name"
                    className={`w-full px-3 py-2 rounded-lg text-sm border ${isDark ? "bg-white/05 border-white/10 text-white placeholder-white/30" : "bg-gray-50 border-gray-200 text-gray-900"}`}
                  />
                </div>
                <div>
                  <label className={`text-xs font-semibold uppercase tracking-wider mb-1.5 block ${isDark ? "text-white/50" : "text-gray-500"}`}>Black Player</label>
                  <input
                    value={setupForm.blackPlayerName}
                    onChange={(e) => setSetupForm((f) => ({ ...f, blackPlayerName: e.target.value }))}
                    placeholder="Black player name"
                    className={`w-full px-3 py-2 rounded-lg text-sm border ${isDark ? "bg-white/05 border-white/10 text-white placeholder-white/30" : "bg-gray-50 border-gray-200 text-gray-900"}`}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={`text-xs font-semibold uppercase tracking-wider mb-1.5 block ${isDark ? "text-white/50" : "text-gray-500"}`}>White ELO</label>
                  <input
                    value={setupForm.whitePlayerElo}
                    onChange={(e) => setSetupForm((f) => ({ ...f, whitePlayerElo: e.target.value }))}
                    placeholder="1500"
                    type="number"
                    className={`w-full px-3 py-2 rounded-lg text-sm border ${isDark ? "bg-white/05 border-white/10 text-white placeholder-white/30" : "bg-gray-50 border-gray-200 text-gray-900"}`}
                  />
                </div>
                <div>
                  <label className={`text-xs font-semibold uppercase tracking-wider mb-1.5 block ${isDark ? "text-white/50" : "text-gray-500"}`}>Black ELO</label>
                  <input
                    value={setupForm.blackPlayerElo}
                    onChange={(e) => setSetupForm((f) => ({ ...f, blackPlayerElo: e.target.value }))}
                    placeholder="1500"
                    type="number"
                    className={`w-full px-3 py-2 rounded-lg text-sm border ${isDark ? "bg-white/05 border-white/10 text-white placeholder-white/30" : "bg-gray-50 border-gray-200 text-gray-900"}`}
                  />
                </div>
                <div>
                  <label className={`text-xs font-semibold uppercase tracking-wider mb-1.5 block ${isDark ? "text-white/50" : "text-gray-500"}`}>Round</label>
                  <input
                    value={setupForm.roundNumber}
                    onChange={(e) => setSetupForm((f) => ({ ...f, roundNumber: e.target.value }))}
                    type="number"
                    min="1"
                    className={`w-full px-3 py-2 rounded-lg text-sm border ${isDark ? "bg-white/05 border-white/10 text-white placeholder-white/30" : "bg-gray-50 border-gray-200 text-gray-900"}`}
                  />
                </div>
              </div>

              <button
                onClick={createBroadcast}
                className="w-full py-3 rounded-xl bg-[#4CAF50] text-white font-bold text-sm hover:bg-[#43A047] transition-colors flex items-center justify-center gap-2 mt-2"
              >
                <Radio className="w-4 h-4" />
                Start Broadcast Session
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Main control UI ──────────────────────────────────────────────────────
  return (
    <div className={`min-h-screen ${isDark ? "bg-[oklch(0.13_0.04_145)] text-white" : "bg-gray-50 text-gray-900"}`}>
      {/* Header */}
      <div className={`border-b px-4 py-3 flex items-center justify-between ${isDark ? "bg-[oklch(0.16_0.05_145)] border-white/08" : "bg-white border-gray-200 shadow-sm"}`}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(`/tournament/${tournamentId}/manage`)}
            className={`p-1.5 rounded-lg ${isDark ? "hover:bg-white/08" : "hover:bg-gray-100"}`}>
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-[#4CAF50]" />
            <span className="font-bold text-sm">Broadcast Control</span>
            <span className={`text-xs ${isDark ? "text-white/40" : "text-gray-400"}`}>·</span>
            <span className={`text-xs ${isDark ? "text-white/40" : "text-gray-400"}`}>
              Board {broadcast.boardNumber} · Round {broadcast.roundNumber}
            </span>
          </div>
          <StatusBadge status={broadcast.status} />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowQR(true)}
            className={`p-2 rounded-lg text-xs font-medium flex items-center gap-1.5 ${isDark ? "bg-white/08 hover:bg-white/12 text-white/70" : "bg-gray-100 hover:bg-gray-200 text-gray-600"}`}>
            <QrCode className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">QR</span>
          </button>
          <a href={displayUrl} target="_blank" rel="noreferrer"
            className="px-3 py-1.5 rounded-lg bg-[#4CAF50] text-white text-xs font-bold flex items-center gap-1.5 hover:bg-[#43A047] transition-colors">
            <Monitor className="w-3.5 h-3.5" />
            Venue Display
          </a>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* Left: Board + Controls */}
        <div className="space-y-4">
          {/* Player cards */}
          <div className={`rounded-xl p-4 border ${isDark ? "bg-[oklch(0.17_0.05_145)] border-white/08" : "bg-white border-gray-200 shadow-sm"}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${isDark ? "bg-white/10 text-white" : "bg-gray-100 text-gray-700"}`}>
                  {boardFlipped ? "B" : "W"}
                </div>
                <div>
                  <div className="font-semibold text-sm">{boardFlipped ? broadcast.blackPlayerName : broadcast.whitePlayerName}</div>
                  <div className={`text-xs ${isDark ? "text-white/40" : "text-gray-400"}`}>
                    {boardFlipped ? (broadcast.blackPlayerElo ?? "—") : (broadcast.whitePlayerElo ?? "—")}
                  </div>
                </div>
              </div>
              <div className={`text-xs font-mono px-2 py-1 rounded ${isDark ? "bg-white/08" : "bg-gray-100"}`}>
                {broadcast.sideToMove === (boardFlipped ? "b" : "w") ? "● to move" : ""}
              </div>
              <div className="flex items-center gap-3">
                <div>
                  <div className="font-semibold text-sm text-right">{boardFlipped ? broadcast.whitePlayerName : broadcast.blackPlayerName}</div>
                  <div className={`text-xs text-right ${isDark ? "text-white/40" : "text-gray-400"}`}>
                    {boardFlipped ? (broadcast.whitePlayerElo ?? "—") : (broadcast.blackPlayerElo ?? "—")}
                  </div>
                </div>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${isDark ? "bg-white/05 text-white" : "bg-gray-800 text-white"}`}>
                  {boardFlipped ? "W" : "B"}
                </div>
              </div>
            </div>
          </div>

          {/* Chess board */}
          <div className={`rounded-xl overflow-hidden border ${isDark ? "border-white/08" : "border-gray-200 shadow-sm"}`}>
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
          <form onSubmit={handleSanSubmit} className={`flex gap-2 rounded-xl p-3 border ${isDark ? "bg-[oklch(0.17_0.05_145)] border-white/08" : "bg-white border-gray-200 shadow-sm"}`}>
            <input
              ref={sanInputRef}
              value={sanInput}
              onChange={(e) => setSanInput(e.target.value)}
              placeholder="Enter move (e.g. e4, Nf3, O-O)"
              disabled={broadcast.status === "finished" || broadcast.status === "paused"}
              className={`flex-1 px-3 py-2 rounded-lg text-sm border font-mono ${isDark ? "bg-white/05 border-white/10 text-white placeholder-white/30" : "bg-gray-50 border-gray-200 text-gray-900"}`}
            />
            <button type="submit" disabled={!sanInput.trim() || submitting}
              className="px-4 py-2 rounded-lg bg-[#4CAF50] text-white text-sm font-bold disabled:opacity-40 hover:bg-[#43A047] transition-colors flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5" />
              Submit
            </button>
          </form>

          {/* Control buttons */}
          <div className={`rounded-xl p-4 border grid grid-cols-2 sm:grid-cols-4 gap-2 ${isDark ? "bg-[oklch(0.17_0.05_145)] border-white/08" : "bg-white border-gray-200 shadow-sm"}`}>
            {broadcast.status === "ready" && (
              <button onClick={() => setStatus("live")}
                className="col-span-2 sm:col-span-4 py-2.5 rounded-lg bg-red-500 text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-red-600 transition-colors">
                <Radio className="w-4 h-4" /> Go Live
              </button>
            )}
            {broadcast.status === "live" && (
              <button onClick={() => setStatus("paused")}
                className="py-2.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 font-semibold text-sm flex items-center justify-center gap-1.5 hover:bg-amber-500/30 transition-colors">
                <Pause className="w-3.5 h-3.5" /> Pause
              </button>
            )}
            {broadcast.status === "paused" && (
              <button onClick={() => setStatus("live")}
                className="py-2.5 rounded-lg bg-[#4CAF50]/20 text-[#4CAF50] border border-[#4CAF50]/30 font-semibold text-sm flex items-center justify-center gap-1.5 hover:bg-[#4CAF50]/30 transition-colors">
                <Play className="w-3.5 h-3.5" /> Resume
              </button>
            )}
            <button onClick={handleUndo} disabled={broadcast.moveNumber === 0}
              className={`py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-1.5 transition-colors disabled:opacity-30 ${isDark ? "bg-white/08 text-white/70 hover:bg-white/12" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              <RotateCcw className="w-3.5 h-3.5" /> Undo
            </button>
            <button onClick={() => setBoardFlipped((f) => !f)}
              className={`py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-1.5 transition-colors ${isDark ? "bg-white/08 text-white/70 hover:bg-white/12" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              <Settings className="w-3.5 h-3.5" /> Flip
            </button>
            <button onClick={() => setShowFenModal(true)}
              className={`py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-1.5 transition-colors ${isDark ? "bg-white/08 text-white/70 hover:bg-white/12" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              <AlertTriangle className="w-3.5 h-3.5" /> Set FEN
            </button>
            <button onClick={() => setShowResultModal(true)}
              className={`py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-1.5 transition-colors ${isDark ? "bg-white/08 text-white/70 hover:bg-white/12" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              <CheckCircle2 className="w-3.5 h-3.5" /> Result
            </button>
            <button onClick={exportPgn}
              className={`py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-1.5 transition-colors ${isDark ? "bg-white/08 text-white/70 hover:bg-white/12" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              <Copy className="w-3.5 h-3.5" /> Copy PGN
            </button>
            <a href={publicUrl} target="_blank" rel="noreferrer"
              className={`py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-1.5 transition-colors ${isDark ? "bg-white/08 text-white/70 hover:bg-white/12" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              <ExternalLink className="w-3.5 h-3.5" /> Public Link
            </a>
          </div>
        </div>

        {/* Right: Move list + info */}
        <div className="space-y-4">
          {/* Game info */}
          <div className={`rounded-xl p-4 border ${isDark ? "bg-[oklch(0.17_0.05_145)] border-white/08" : "bg-white border-gray-200 shadow-sm"}`}>
            <h3 className={`text-xs font-bold uppercase tracking-wider mb-3 ${isDark ? "text-white/40" : "text-gray-400"}`}>Game Info</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className={isDark ? "text-white/50" : "text-gray-500"}>Status</span>
                <StatusBadge status={broadcast.status} />
              </div>
              <div className="flex justify-between">
                <span className={isDark ? "text-white/50" : "text-gray-500"}>Move</span>
                <span className="font-mono font-semibold">{Math.ceil(broadcast.moveNumber / 2)}</span>
              </div>
              <div className="flex justify-between">
                <span className={isDark ? "text-white/50" : "text-gray-500"}>To move</span>
                <span className="font-semibold">{broadcast.sideToMove === "w" ? "White" : "Black"}</span>
              </div>
              {broadcast.result && broadcast.result !== "*" && (
                <div className="flex justify-between">
                  <span className={isDark ? "text-white/50" : "text-gray-500"}>Result</span>
                  <span className="font-bold text-[#4CAF50]">{broadcast.result}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className={isDark ? "text-white/50" : "text-gray-500"}>Input</span>
                <span className="capitalize text-xs">{broadcast.inputSource.replace("_", " ")}</span>
              </div>
            </div>
          </div>

          {/* Move list */}
          <div className={`rounded-xl p-4 border ${isDark ? "bg-[oklch(0.17_0.05_145)] border-white/08" : "bg-white border-gray-200 shadow-sm"}`}>
            <h3 className={`text-xs font-bold uppercase tracking-wider mb-3 ${isDark ? "text-white/40" : "text-gray-400"}`}>Move List</h3>
            {movePairs.length === 0 ? (
              <p className={`text-sm text-center py-4 ${isDark ? "text-white/30" : "text-gray-400"}`}>No moves yet</p>
            ) : (
              <div className="space-y-0.5 max-h-64 overflow-y-auto font-mono text-sm">
                {movePairs.map(([white, black], i) => (
                  <div key={i} className={`flex gap-2 px-2 py-1 rounded ${isDark ? "hover:bg-white/05" : "hover:bg-gray-50"}`}>
                    <span className={`w-6 text-right flex-shrink-0 ${isDark ? "text-white/30" : "text-gray-400"}`}>{i + 1}.</span>
                    <span className={`flex-1 ${isDark ? "text-white/80" : "text-gray-700"}`}>{white}</span>
                    <span className={`flex-1 ${isDark ? "text-white/80" : "text-gray-700"}`}>{black ?? ""}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Public link */}
          <div className={`rounded-xl p-4 border ${isDark ? "bg-[oklch(0.17_0.05_145)] border-white/08" : "bg-white border-gray-200 shadow-sm"}`}>
            <h3 className={`text-xs font-bold uppercase tracking-wider mb-3 ${isDark ? "text-white/40" : "text-gray-400"}`}>Share</h3>
            <div className={`text-xs font-mono px-2 py-1.5 rounded break-all mb-2 ${isDark ? "bg-white/05 text-white/60" : "bg-gray-50 text-gray-500"}`}>
              {publicUrl}
            </div>
            <button onClick={() => navigator.clipboard.writeText(publicUrl).then(() => toast.success("Link copied!"))}
              className={`w-full py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${isDark ? "bg-white/08 text-white/70 hover:bg-white/12" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              <Copy className="w-3.5 h-3.5" /> Copy Public Link
            </button>
          </div>
        </div>
      </div>

      {/* FEN Correction Modal */}
      {showFenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className={`w-full max-w-md rounded-2xl p-6 border ${isDark ? "bg-[oklch(0.18_0.05_145)] border-white/10" : "bg-white border-gray-200 shadow-xl"}`}>
            <h2 className="text-lg font-bold mb-1">Set Position</h2>
            <p className={`text-sm mb-4 ${isDark ? "text-white/50" : "text-gray-500"}`}>Paste a FEN string to correct the board position.</p>
            <input
              value={fenInput}
              onChange={(e) => setFenInput(e.target.value)}
              placeholder="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
              className={`w-full px-3 py-2 rounded-lg text-sm font-mono border mb-4 ${isDark ? "bg-white/05 border-white/10 text-white placeholder-white/30" : "bg-gray-50 border-gray-200 text-gray-900"}`}
            />
            <div className="flex gap-2">
              <button onClick={() => setShowFenModal(false)}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold ${isDark ? "bg-white/08 text-white/70" : "bg-gray-100 text-gray-600"}`}>
                Cancel
              </button>
              <button onClick={handleFenCorrection}
                className="flex-1 py-2 rounded-lg bg-[#4CAF50] text-white text-sm font-bold hover:bg-[#43A047] transition-colors">
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Result Modal */}
      {showResultModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className={`w-full max-w-sm rounded-2xl p-6 border ${isDark ? "bg-[oklch(0.18_0.05_145)] border-white/10" : "bg-white border-gray-200 shadow-xl"}`}>
            <h2 className="text-lg font-bold mb-4">Set Result</h2>
            <div className="grid grid-cols-2 gap-3">
              {["1-0", "0-1", "1/2-1/2", "*"].map((r) => (
                <button key={r} onClick={() => handleSetResult(r)}
                  className={`py-3 rounded-xl font-bold text-sm transition-colors ${
                    r === "1-0" ? "bg-white text-gray-900 hover:bg-gray-100" :
                    r === "0-1" ? "bg-gray-900 text-white hover:bg-gray-800" :
                    r === "1/2-1/2" ? "bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30" :
                    isDark ? "bg-white/08 text-white/60 hover:bg-white/12" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}>
                  {r === "1-0" ? `${broadcast.whitePlayerName} wins` :
                   r === "0-1" ? `${broadcast.blackPlayerName} wins` :
                   r === "1/2-1/2" ? "Draw" : "In progress (*)"}
                </button>
              ))}
            </div>
            <button onClick={() => setShowResultModal(false)}
              className={`w-full mt-3 py-2 rounded-lg text-sm font-semibold ${isDark ? "bg-white/08 text-white/70" : "bg-gray-100 text-gray-600"}`}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* QR Modal */}
      {showQR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setShowQR(false)}>
          <div className={`rounded-2xl p-6 border text-center ${isDark ? "bg-[oklch(0.18_0.05_145)] border-white/10" : "bg-white border-gray-200 shadow-xl"}`} onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-1">Spectator QR Code</h2>
            <p className={`text-sm mb-4 ${isDark ? "text-white/50" : "text-gray-500"}`}>Scan to follow the game live</p>
            <div className="bg-white p-4 rounded-xl inline-block">
              <QRCodeSVG value={publicUrl} size={200} />
            </div>
            <p className={`text-xs mt-3 font-mono ${isDark ? "text-white/40" : "text-gray-400"}`}>{publicUrl}</p>
            <button onClick={() => setShowQR(false)}
              className={`mt-4 px-6 py-2 rounded-lg text-sm font-semibold ${isDark ? "bg-white/08 text-white/70" : "bg-gray-100 text-gray-600"}`}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
