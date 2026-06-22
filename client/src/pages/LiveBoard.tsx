/**
 * OTB Chess — Public Live Board Page (Mobile-First, Phase 4)
 * Route: /live/board/:slug
 *
 * Read-only spectator view with realtime SSE updates.
 * Mobile-first: fit-to-width board, share button, auto-reconnect with backoff,
 * ChessOTB branding, social feel. Simple, fast, easy to follow.
 */
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useParams } from "wouter";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { Radio, Eye, Clock, Share2, Wifi, WifiOff, ChevronDown, ChevronUp } from "lucide-react";

interface Broadcast {
  id: string;
  tournamentId: string;
  roundNumber: number;
  boardNumber: number;
  whitePlayerName: string;
  blackPlayerName: string;
  whitePlayerElo?: number | null;
  blackPlayerElo?: number | null;
  tournamentName?: string | null;
  status: "ready" | "live" | "paused" | "finished" | "error";
  currentFen: string;
  pgn: string;
  lastMoveSan?: string | null;
  lastMoveUci?: string | null;
  moveNumber: number;
  sideToMove: "w" | "b";
  result?: string | null;
  publicSlug: string;
}

type ConnectionState = "connected" | "connecting" | "disconnected";

function StatusPill({ status }: { status: Broadcast["status"] }) {
  const map: Record<string, { label: string; cls: string }> = {
    ready:    { label: "Starting Soon", cls: "bg-[#6B6B50]/20 text-[#6B6B50]/70 border-[#6B6B50]/30" },
    live:     { label: "● LIVE",        cls: "bg-red-500/20 text-red-400 border-red-500/30 animate-pulse" },
    paused:   { label: "Paused",        cls: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
    finished: { label: "Game Over",     cls: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
    error:    { label: "Error",         cls: "bg-red-700/20 text-red-300 border-red-700/30" },
  };
  const { label, cls } = map[status] ?? map.ready;
  return <span className={`text-xs font-bold px-2 py-0.5 rounded-full border tracking-wider uppercase ${cls}`}>{label}</span>;
}

export default function LiveBoard() {
  const { slug } = useParams<{ slug: string }>();
  const [broadcast, setBroadcast] = useState<Broadcast | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [showMoves, setShowMoves] = useState(false);
  const chessRef = useRef(new Chess());
  const esRef = useRef<EventSource | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempts = useRef(0);

  function applyBroadcast(b: Broadcast) {
    setBroadcast(b);
    try { chessRef.current.load(b.currentFen); } catch { /* ignore */ }
  }

  // ─── SSE with auto-reconnect (exponential backoff) ────────────────────────
  const connectSSE = useCallback((broadcastId: string) => {
    if (esRef.current) esRef.current.close();
    setConnection("connecting");

    const es = new EventSource(`/api/broadcasts/${broadcastId}/events`);
    esRef.current = es;

    es.addEventListener("init", (e) => {
      try {
        applyBroadcast(JSON.parse((e as MessageEvent).data));
        setConnection("connected");
        reconnectAttempts.current = 0;
      } catch { /* ignore */ }
    });

    const handleUpdate = (e: Event) => {
      try {
        const data = JSON.parse((e as MessageEvent).data);
        if (data.broadcast) applyBroadcast(data.broadcast);
        else applyBroadcast(data);
      } catch { /* ignore */ }
    };

    ["move_played", "move_undone", "status_changed", "position_corrected", "broadcast_reset", "result_set", "position_set"].forEach(evt => {
      es.addEventListener(evt, handleUpdate);
    });

    es.onopen = () => {
      setConnection("connected");
      reconnectAttempts.current = 0;
    };

    es.onerror = () => {
      setConnection("disconnected");
      es.close();
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
      reconnectAttempts.current++;
      reconnectRef.current = setTimeout(() => connectSSE(broadcastId), delay);
    };
  }, []);

  // ─── Initial fetch + SSE ──────────────────────────────────────────────────
  useEffect(() => {
    if (!slug) return;
    async function fetchBroadcast() {
      try {
        const res = await fetch(`/api/broadcasts/slug/${slug}`);
        if (!res.ok) { setError("Broadcast not found"); setLoading(false); return; }
        const b: Broadcast = await res.json();
        applyBroadcast(b);
        setLoading(false);
        connectSSE(b.id);
      } catch {
        setError("Failed to load broadcast");
        setLoading(false);
      }
    }
    fetchBroadcast();
    return () => {
      esRef.current?.close();
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
    };
  }, [slug, connectSSE]);

  // ─── Chess Clock State ────────────────────────────────────────────────────────
  const [clockWhiteMs, setClockWhiteMs] = useState<number | null>(null);
  const [clockBlackMs, setClockBlackMs] = useState<number | null>(null);
  const [clockRunning, setClockRunning] = useState(false);
  const [clockLastUpdatedAt, setClockLastUpdatedAt] = useState<number | null>(null);
  const [clockSideToMove, setClockSideToMove] = useState<"w" | "b">("w");
  const [clockTick, setClockTick] = useState(0);
  const clockTickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sync from broadcast row
  useEffect(() => {
    if (!broadcast) return;
    const b = broadcast as typeof broadcast & { whiteTimeMs?: number | null; blackTimeMs?: number | null; clockRunning?: number; clockLastUpdatedAt?: string | null };
    setClockWhiteMs(b.whiteTimeMs ?? null);
    setClockBlackMs(b.blackTimeMs ?? null);
    setClockRunning(!!(b.clockRunning));
    setClockLastUpdatedAt(b.clockLastUpdatedAt ? new Date(b.clockLastUpdatedAt).getTime() : null);
    setClockSideToMove(broadcast.sideToMove);
  }, [broadcast]);

  // Local tick
  useEffect(() => {
    if (clockRunning) {
      clockTickRef.current = setInterval(() => setClockTick(t => t + 1), 100);
    } else {
      if (clockTickRef.current) clearInterval(clockTickRef.current);
    }
    return () => { if (clockTickRef.current) clearInterval(clockTickRef.current); };
  }, [clockRunning]);

  function fmtClock(ms: number | null): string {
    if (ms === null) return "—";
    const totalSec = Math.ceil(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  const displayedWhiteMs = useMemo(() => {
    if (clockWhiteMs === null) return null;
    if (!clockRunning || !clockLastUpdatedAt || clockSideToMove !== "w") return clockWhiteMs;
    return Math.max(0, clockWhiteMs - (Date.now() - clockLastUpdatedAt));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clockWhiteMs, clockRunning, clockLastUpdatedAt, clockSideToMove, clockTick]);

  const displayedBlackMs = useMemo(() => {
    if (clockBlackMs === null) return null;
    if (!clockRunning || !clockLastUpdatedAt || clockSideToMove !== "b") return clockBlackMs;
    return Math.max(0, clockBlackMs - (Date.now() - clockLastUpdatedAt));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clockBlackMs, clockRunning, clockLastUpdatedAt, clockSideToMove, clockTick]);

  const clockHasData = displayedWhiteMs !== null;

  // Add clock_update SSE handler
  // (injected into connectSSE via useEffect below)
  useEffect(() => {
    if (!broadcast?.id) return;
    const es = new EventSource(`/api/broadcasts/${broadcast.id}/events`);
    es.addEventListener("clock_update", (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data);
        setClockWhiteMs(data.whiteTimeMs ?? null);
        setClockBlackMs(data.blackTimeMs ?? null);
        setClockRunning(!!(data.clockRunning));
        setClockLastUpdatedAt(data.clockLastUpdatedAt ? new Date(data.clockLastUpdatedAt).getTime() : null);
        if (data.sideToMove) setClockSideToMove(data.sideToMove);
      } catch { /* ignore */ }
    });
    return () => es.close();
  }, [broadcast?.id]);


  // ─── Share handler ────────────────────────────────────────────────────────
  function handleShare() {
    const url = window.location.href;
    const title = broadcast ? `${broadcast.whitePlayerName} vs ${broadcast.blackPlayerName} — Live on ChessOTB` : "Live Chess — ChessOTB";
    if (navigator.share) {
      navigator.share({ title, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).then(() => {
        // Simple feedback
        const el = document.getElementById("share-toast");
        if (el) { el.classList.remove("opacity-0"); setTimeout(() => el.classList.add("opacity-0"), 2000); }
      });
    }
  }

  // ─── Last move highlight ──────────────────────────────────────────────────
  const customSquareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};
    if (broadcast?.lastMoveUci && broadcast.lastMoveUci.length >= 4) {
      const from = broadcast.lastMoveUci.slice(0, 2);
      const to = broadcast.lastMoveUci.slice(2, 4);
      styles[from] = { backgroundColor: "rgba(76,175,80,0.25)" };
      styles[to] = { backgroundColor: "rgba(76,175,80,0.4)" };
    }
    return styles;
  }, [broadcast?.lastMoveUci]);

  // ─── Move pairs ───────────────────────────────────────────────────────────
  const movePairs = useMemo(() => {
    if (!broadcast?.pgn) return [];
    const moves = broadcast.pgn.replace(/\d+\.\s*/g, "").trim().split(/\s+/).filter(Boolean);
    const pairs: [string, string?][] = [];
    for (let i = 0; i < moves.length; i += 2) {
      pairs.push([moves[i], moves[i + 1]]);
    }
    return pairs;
  }, [broadcast?.pgn]);

  const moveListRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (moveListRef.current) moveListRef.current.scrollTop = moveListRef.current.scrollHeight;
  }, [movePairs]);

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d1a0f] flex items-center justify-center">
        <div className="text-center space-y-3">
          <Radio className="w-8 h-8 text-[#4CAF50] animate-pulse mx-auto" />
          <p className="text-white/50 text-sm">Connecting to broadcast…</p>
        </div>
      </div>
    );
  }

  if (error || !broadcast) {
    return (
      <div className="min-h-screen bg-[#0d1a0f] flex items-center justify-center px-4">
        <div className="text-center space-y-3">
          <Radio className="w-10 h-10 text-[#4CAF50]/50 mx-auto" />
          <p className="text-white/50 text-sm">{error ?? "Broadcast not found"}</p>
          <a href="/" className="text-[#4CAF50] text-sm hover:underline inline-block mt-2">← Back to ChessOTB</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d1a0f] text-white flex flex-col">
      {/* Share toast */}
      <div id="share-toast" className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-[#4CAF50] text-white text-xs font-medium shadow-lg opacity-0 transition-opacity duration-300 pointer-events-none">
        Link copied!
      </div>

      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <header className="border-b border-white/8 bg-[#0d1a0f]/95 backdrop-blur-md px-3 py-2.5 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <a href="/" className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-md bg-[#4CAF50]/20 flex items-center justify-center">
              <Radio className="w-3 h-3 text-[#4CAF50]" />
            </div>
            <span className="font-bold text-xs">ChessOTB</span>
          </a>
          <span className="text-white/15">·</span>
          <StatusPill status={broadcast.status} />
        </div>
        <div className="flex items-center gap-2">
          {/* Connection indicator */}
          {connection === "connected" ? (
            <Wifi className="w-3.5 h-3.5 text-[#4CAF50]" />
          ) : connection === "connecting" ? (
            <Wifi className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
          ) : (
            <WifiOff className="w-3.5 h-3.5 text-red-400" />
          )}
          {/* Share button */}
          <button onClick={handleShare} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#4CAF50]/15 border border-[#4CAF50]/25 text-[#4CAF50] text-xs font-medium hover:bg-[#4CAF50]/25 active:scale-95 transition-transform">
            <Share2 className="w-3 h-3" /> Share
          </button>
        </div>
      </header>

      {/* ─── Main Content ────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col max-w-lg mx-auto w-full px-3 py-3 gap-3">
        {/* Tournament info */}
        {broadcast.tournamentName && (
          <div className="text-center">
            <span className="text-[10px] text-white/30 uppercase tracking-wider font-medium">{broadcast.tournamentName}</span>
            <span className="text-white/15 mx-2">·</span>
            <span className="text-[10px] text-white/25">Round {broadcast.roundNumber} • Board {broadcast.boardNumber}</span>
          </div>
        )}

        {/* Black player (top) */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#1A1A1A] border border-white/10 flex items-center justify-center text-xs font-bold">
              {broadcast.blackPlayerName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="font-semibold text-sm leading-tight">{broadcast.blackPlayerName}</div>
              {broadcast.blackPlayerElo && <div className="text-[11px] text-white/40">{broadcast.blackPlayerElo}</div>}
            </div>
          </div>
          {clockHasData ? (
            <div className={`font-mono font-bold tabular-nums text-xl px-3 py-1 rounded-xl transition-all duration-300 ${
              displayedBlackMs !== null && displayedBlackMs < 10_000 ? "text-red-300 bg-red-600/20 border border-red-500/40 shadow-[0_0_14px_rgba(239,68,68,0.45)] animate-pulse" :
              displayedBlackMs !== null && displayedBlackMs < 60_000 ? "text-red-400 bg-red-500/12 border border-red-500/25 shadow-[0_0_8px_rgba(239,68,68,0.2)]" :
              clockRunning && clockSideToMove === "b" ? "text-white bg-[#4CAF50]/10 border border-[#4CAF50]/20" :
              "text-white/35 bg-white/3"
            }`}>{fmtClock(displayedBlackMs)}</div>
          ) : broadcast.sideToMove === "b" && broadcast.status === "live" ? (
            <div className="flex items-center gap-1.5 text-[11px] text-amber-400 font-medium">
              <Clock className="w-3 h-3" /> Thinking…
            </div>
          ) : null}
        </div>

        {/* Board — fit to width */}
        <div className="rounded-xl overflow-hidden border border-white/8 shadow-2xl w-full aspect-square">
          <Chessboard
            options={{
              position: broadcast.currentFen,
              boardOrientation: "white",
              squareStyles: customSquareStyles,
              animationDurationInMs: 300,
              boardStyle: { borderRadius: "0" },
              darkSquareStyle: { backgroundColor: "#2d4a2d" },
              lightSquareStyle: { backgroundColor: "#c8e6c9" },
            }}
          />
        </div>

        {/* White player (bottom) */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-white/90 border border-white/20 flex items-center justify-center text-xs font-bold text-[#1A1A1A]">
              {broadcast.whitePlayerName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="font-semibold text-sm leading-tight">{broadcast.whitePlayerName}</div>
              {broadcast.whitePlayerElo && <div className="text-[11px] text-white/40">{broadcast.whitePlayerElo}</div>}
            </div>
          </div>
          {clockHasData ? (
            <div className={`font-mono font-bold tabular-nums text-xl px-3 py-1 rounded-xl transition-all duration-300 ${
              displayedWhiteMs !== null && displayedWhiteMs < 10_000 ? "text-red-300 bg-red-600/20 border border-red-500/40 shadow-[0_0_14px_rgba(239,68,68,0.45)] animate-pulse" :
              displayedWhiteMs !== null && displayedWhiteMs < 60_000 ? "text-red-400 bg-red-500/12 border border-red-500/25 shadow-[0_0_8px_rgba(239,68,68,0.2)]" :
              clockRunning && clockSideToMove === "w" ? "text-white bg-[#4CAF50]/10 border border-[#4CAF50]/20" :
              "text-white/35 bg-white/3"
            }`}>{fmtClock(displayedWhiteMs)}</div>
          ) : broadcast.sideToMove === "w" && broadcast.status === "live" ? (
            <div className="flex items-center gap-1.5 text-[11px] text-amber-400 font-medium">
              <Clock className="w-3 h-3" /> Thinking…
            </div>
          ) : null}
        </div>

        {/* ─── Compact Clock Bar ─────────────────────────────────────────── */}
        {clockHasData && (
          <div className="rounded-xl overflow-hidden border border-white/8 bg-white/3">
            <div className="flex items-stretch">
              {/* White side */}
              <div className={`flex-1 flex flex-col items-center justify-center py-3 transition-all duration-300 ${
                clockRunning && clockSideToMove === "w"
                  ? displayedWhiteMs !== null && displayedWhiteMs < 10_000
                    ? "bg-red-600/25 border-r border-red-500/40 shadow-[inset_0_0_20px_rgba(239,68,68,0.15)]"
                    : displayedWhiteMs !== null && displayedWhiteMs < 60_000
                    ? "bg-red-500/15 border-r border-red-500/25"
                    : "bg-[#4CAF50]/8 border-r border-[#4CAF50]/15"
                  : "border-r border-white/6"
              }`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="w-3 h-3 rounded-full bg-white/85 border border-white/20 flex-shrink-0" />
                  <span className="text-[10px] uppercase tracking-widest font-bold text-white/35">{broadcast.whitePlayerName.split(" ")[0]}</span>
                  {clockRunning && clockSideToMove === "w" && (
                    <div className={`w-1.5 h-1.5 rounded-full animate-pulse flex-shrink-0 ${
                      displayedWhiteMs !== null && displayedWhiteMs < 60_000 ? "bg-red-400" : "bg-[#4CAF50]"
                    }`} />
                  )}
                </div>
                <div className={`font-mono font-black tabular-nums leading-none ${
                  displayedWhiteMs !== null && displayedWhiteMs < 10_000 ? "text-red-300 text-2xl animate-pulse" :
                  displayedWhiteMs !== null && displayedWhiteMs < 60_000 ? "text-red-400 text-2xl" :
                  clockRunning && clockSideToMove === "w" ? "text-white text-2xl" : "text-white/30 text-xl"
                }`}>
                  {fmtClock(displayedWhiteMs)}
                </div>
              </div>

              {/* Divider + turn indicator */}
              <div className="flex flex-col items-center justify-center px-2 gap-1">
                <div className="text-[9px] uppercase tracking-widest text-white/20 font-bold">vs</div>
                {broadcast.status === "live" && (
                  <div className={`w-1 h-1 rounded-full ${
                    clockSideToMove === "w" ? "bg-white" : "bg-[#1A1A1A]"
                  }`} />
                )}
              </div>

              {/* Black side */}
              <div className={`flex-1 flex flex-col items-center justify-center py-3 transition-all duration-300 ${
                clockRunning && clockSideToMove === "b"
                  ? displayedBlackMs !== null && displayedBlackMs < 10_000
                    ? "bg-red-600/25 border-l border-red-500/40 shadow-[inset_0_0_20px_rgba(239,68,68,0.15)]"
                    : displayedBlackMs !== null && displayedBlackMs < 60_000
                    ? "bg-red-500/15 border-l border-red-500/25"
                    : "bg-[#4CAF50]/8 border-l border-[#4CAF50]/15"
                  : "border-l border-white/6"
              }`}>
                <div className="flex items-center gap-1.5 mb-1">
                  {clockRunning && clockSideToMove === "b" && (
                    <div className={`w-1.5 h-1.5 rounded-full animate-pulse flex-shrink-0 ${
                      displayedBlackMs !== null && displayedBlackMs < 60_000 ? "bg-red-400" : "bg-[#4CAF50]"
                    }`} />
                  )}
                  <span className="text-[10px] uppercase tracking-widest font-bold text-white/35">{broadcast.blackPlayerName.split(" ")[0]}</span>
                  <div className="w-3 h-3 rounded-full bg-[#1A1A1A] border border-white/15 flex-shrink-0" />
                </div>
                <div className={`font-mono font-black tabular-nums leading-none ${
                  displayedBlackMs !== null && displayedBlackMs < 10_000 ? "text-red-300 text-2xl animate-pulse" :
                  displayedBlackMs !== null && displayedBlackMs < 60_000 ? "text-red-400 text-2xl" :
                  clockRunning && clockSideToMove === "b" ? "text-white text-2xl" : "text-white/30 text-xl"
                }`}>
                  {fmtClock(displayedBlackMs)}
                </div>
              </div>
            </div>

            {/* Bottom label */}
            <div className="border-t border-white/5 px-4 py-1.5 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3 h-3 text-white/20" />
                <span className="text-[10px] text-white/20 uppercase tracking-wider font-medium">Clock</span>
              </div>
              <span className="text-[10px] text-white/20 font-mono">
                {clockRunning
                  ? clockSideToMove === "w"
                    ? `${broadcast.whitePlayerName.split(" ")[0]}'s turn`
                    : `${broadcast.blackPlayerName.split(" ")[0]}'s turn`
                  : broadcast.status === "finished" ? "Game over" : "Paused"}
              </span>
            </div>
          </div>
        )}

        {/* Result banner */}
        {broadcast.result && broadcast.result !== "*" && (
          <div className="rounded-xl bg-[#4CAF50]/10 border border-[#4CAF50]/25 p-3 text-center">
            <div className="text-xl font-black text-[#4CAF50]">{broadcast.result}</div>
            <div className="text-xs text-white/50 mt-0.5">
              {broadcast.result === "1-0" ? `${broadcast.whitePlayerName} wins` :
               broadcast.result === "0-1" ? `${broadcast.blackPlayerName} wins` :
               "Draw"}
            </div>
          </div>
        )}

        {/* Last move + move count */}
        <div className="flex items-center justify-between px-1 text-xs text-white/40">
          <span>
            {broadcast.lastMoveSan ? (
              <span className="font-mono">
                {Math.ceil(broadcast.moveNumber / 2)}.{broadcast.sideToMove === "w" ? ".." : ""} {broadcast.lastMoveSan}
              </span>
            ) : "Waiting for first move…"}
          </span>
          <span>{broadcast.moveNumber} moves</span>
        </div>

        {/* Move list (collapsible on mobile) */}
        <div className="rounded-xl bg-white/3 border border-white/8 overflow-hidden">
          <button onClick={() => setShowMoves(!showMoves)} className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-white/50 hover:text-white/70 active:bg-white/5">
            <span>Move Notation</span>
            {showMoves ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {showMoves && (
            <div ref={moveListRef} className="px-3 pb-3 max-h-48 overflow-y-auto border-t border-white/5">
              {movePairs.length === 0 ? (
                <p className="text-xs text-center py-4 text-white/20">No moves yet</p>
              ) : (
                <div className="space-y-0.5 pt-2 font-mono text-xs">
                  {movePairs.map(([white, black], i) => (
                    <div key={i} className={`flex gap-2 px-2 py-1 rounded ${i === movePairs.length - 1 ? "bg-[#4CAF50]/10" : ""}`}>
                      <span className="w-5 text-right flex-shrink-0 text-white/25">{i + 1}.</span>
                      <span className={`flex-1 ${i === movePairs.length - 1 && !black ? "text-[#4CAF50] font-semibold" : "text-white/70"}`}>{white}</span>
                      <span className={`flex-1 ${i === movePairs.length - 1 && black ? "text-[#4CAF50] font-semibold" : "text-white/70"}`}>{black ?? ""}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* ─── Footer branding ─────────────────────────────────────────────── */}
      <footer className="text-center py-3 border-t border-white/5">
        <a href="/" className="text-[10px] text-white/20 tracking-wider hover:text-white/40">ChessOTB.club — Live Tournament Broadcast</a>
      </footer>
    </div>
  );
}
