/**
 * OTB Chess — Venue Display (Event-Ready, Phase 4)
 * Route: /live/board/:slug/display
 *
 * Full-screen display for projectors/TVs at tournament venues.
 * 4 display modes: Standard, Minimal, Overlay, Board Only
 * Realtime SSE with auto-reconnect, heartbeat ping to console, and connection indicator.
 * Designed for 16:9 screens with large, readable text at 3+ meters viewing distance.
 */
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useParams } from "wouter";
import { Chessboard } from "react-chessboard";
import { QRCodeSVG } from "qrcode.react";
import { Wifi, WifiOff, Clock, Radio } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Broadcast {
  id: string;
  whitePlayerName: string;
  blackPlayerName: string;
  whitePlayerElo?: number | null;
  blackPlayerElo?: number | null;
  tournamentName?: string | null;
  roundNumber: number;
  boardNumber: number;
  status: "ready" | "live" | "paused" | "finished" | "error";
  displayMode: "standard" | "minimal" | "overlay" | "board_only";
  displaySettings?: Record<string, unknown> | null;
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

// ─── Main Component ───────────────────────────────────────────────────────────
export default function VenueDisplay() {
  const { slug } = useParams<{ slug: string }>();
  const [broadcast, setBroadcast] = useState<Broadcast | null>(null);
  const [loading, setLoading] = useState(true);
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [clock, setClock] = useState(new Date());
  const esRef = useRef<EventSource | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempts = useRef(0);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Wall clock tick
  useEffect(() => {
    const interval = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // ─── Chess Clock State ────────────────────────────────────────────────────────────────────────────────
  const [clockWhiteMs, setClockWhiteMs] = useState<number | null>(null);
  const [clockBlackMs, setClockBlackMs] = useState<number | null>(null);
  const [clockRunning, setClockRunning] = useState(false);
  const [clockLastUpdatedAt, setClockLastUpdatedAt] = useState<number | null>(null);
  const [clockSideToMove, setClockSideToMove] = useState<"w" | "b">("w");
  const [clockTick, setClockTick] = useState(0);
  const clockTickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sync clock from broadcast row
  useEffect(() => {
    if (!broadcast) return;
    const b = broadcast as typeof broadcast & { whiteTimeMs?: number | null; blackTimeMs?: number | null; clockRunning?: number; clockLastUpdatedAt?: string | null };
    setClockWhiteMs(b.whiteTimeMs ?? null);
    setClockBlackMs(b.blackTimeMs ?? null);
    setClockRunning(!!(b.clockRunning));
    setClockLastUpdatedAt(b.clockLastUpdatedAt ? new Date(b.clockLastUpdatedAt).getTime() : null);
    setClockSideToMove(broadcast.sideToMove);
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

  /** Format ms as M:SS or H:MM:SS */
  function fmtClock(ms: number | null): string {
    if (ms === null) return "—";
    const totalSec = Math.ceil(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  // Displayed times (subtract elapsed from active side)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const displayedWhiteMs = useMemo(() => {
    if (clockWhiteMs === null) return null;
    if (!clockRunning || !clockLastUpdatedAt || clockSideToMove !== "w") return clockWhiteMs;
    return Math.max(0, clockWhiteMs - (Date.now() - clockLastUpdatedAt));
  }, [clockWhiteMs, clockRunning, clockLastUpdatedAt, clockSideToMove, clockTick]); // eslint-disable-line react-hooks/exhaustive-deps

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const displayedBlackMs = useMemo(() => {
    if (clockBlackMs === null) return null;
    if (!clockRunning || !clockLastUpdatedAt || clockSideToMove !== "b") return clockBlackMs;
    return Math.max(0, clockBlackMs - (Date.now() - clockLastUpdatedAt));
  }, [clockBlackMs, clockRunning, clockLastUpdatedAt, clockSideToMove, clockTick]); // eslint-disable-line react-hooks/exhaustive-deps

  const clockHasData = displayedWhiteMs !== null;

  // ─── Heartbeat ping to console (every 30s) ────────────────────────────────
  useEffect(() => {
    if (!broadcast?.id) return;
    const sendPing = () => {
      fetch(`/api/broadcasts/${broadcast.id}/display-ping`, { method: "POST" }).catch(() => {});
    };
    sendPing(); // immediate first ping
    pingIntervalRef.current = setInterval(sendPing, 30000);
    return () => { if (pingIntervalRef.current) clearInterval(pingIntervalRef.current); };
  }, [broadcast?.id]);

  // ─── Fetch broadcast by slug ──────────────────────────────────────────────
  const fetchBroadcast = useCallback(async () => {
    try {
      const res = await fetch(`/api/broadcasts/slug/${slug}`);
      if (res.ok) {
        const data = await res.json();
        setBroadcast(data);
        return data;
      }
    } catch { /* ignore */ }
    setLoading(false);
    return null;
  }, [slug]);

  // ─── SSE with auto-reconnect ──────────────────────────────────────────────
  const connectSSE = useCallback((broadcastId: string) => {
    if (esRef.current) { esRef.current.close(); }
    setConnection("connecting");

    const es = new EventSource(`/api/broadcasts/${broadcastId}/events`);
    esRef.current = es;

    es.addEventListener("init", (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data);
        setBroadcast(data);
        setConnection("connected");
        reconnectAttempts.current = 0;
      } catch { /* ignore */ }
    });

    const handleUpdate = (e: Event) => {
      try {
        const data = JSON.parse((e as MessageEvent).data);
        if (data.broadcast) setBroadcast(data.broadcast);
        else setBroadcast(data);
      } catch { /* ignore */ }
    };

    ["move_played", "move_undone", "status_changed", "position_corrected", "display_settings_changed", "broadcast_reset", "result_set", "position_set"].forEach(evt => {
      es.addEventListener(evt, handleUpdate);
    });

    // Chess clock updates
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

  useEffect(() => {
    fetchBroadcast().then((data) => {
      setLoading(false);
      if (data?.id) connectSSE(data.id);
    });
    return () => {
      esRef.current?.close();
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
    };
  }, [fetchBroadcast, connectSSE]);

  // ─── Display settings helpers ─────────────────────────────────────────────
  const settings = useMemo(() => ({
    showQr: true,
    showMoveList: true,
    showRatings: true,
    showTournamentName: true,
    boardOrientation: "white" as "white" | "black",
    fontSize: "normal",
    ...(broadcast?.displaySettings as Record<string, unknown> ?? {}),
  }), [broadcast?.displaySettings]);

  const displayMode = broadcast?.displayMode ?? "standard";

  // Font size multiplier for big-screen readability
  const fontScale = settings.fontSize === "large" ? 1.3 : settings.fontSize === "small" ? 0.85 : 1;

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

  // ─── Last move highlight ──────────────────────────────────────────────────
  const squareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};
    if (broadcast?.lastMoveUci && broadcast.lastMoveUci.length >= 4) {
      const from = broadcast.lastMoveUci.slice(0, 2);
      const to = broadcast.lastMoveUci.slice(2, 4);
      styles[from] = { backgroundColor: "rgba(76,175,80,0.25)" };
      styles[to] = { backgroundColor: "rgba(76,175,80,0.4)" };
    }
    return styles;
  }, [broadcast?.lastMoveUci]);

  const publicUrl = broadcast ? `${window.location.origin}/live/board/${broadcast.publicSlug}` : "";

  // ─── Connection indicator component ───────────────────────────────────────
  function ConnectionIndicator() {
    return (
      <div className="fixed top-4 right-4 z-50">
        {connection === "connected" ? (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#4CAF50]/10 border border-[#4CAF50]/20">
            <Wifi className="w-3.5 h-3.5 text-[#4CAF50]" />
            <span className="text-xs text-[#4CAF50] font-bold tracking-wider">LIVE</span>
          </div>
        ) : connection === "connecting" ? (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 animate-pulse">
            <Wifi className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs text-amber-400 font-medium">Connecting…</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20">
            <WifiOff className="w-3.5 h-3.5 text-red-400" />
            <span className="text-xs text-red-400 font-medium">Reconnecting…</span>
          </div>
        )}
      </div>
    );
  }

  // ─── Loading / Error ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#080f08]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-[#4CAF50] border-t-transparent animate-spin" />
          <span className="text-sm text-white/40">Connecting to broadcast…</span>
        </div>
      </div>
    );
  }

  if (!broadcast) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#080f08]">
        <div className="text-center">
          <Radio className="w-12 h-12 text-[#4CAF50] animate-pulse mx-auto mb-3" />
          <p className="text-white/50 text-lg">Broadcast not found</p>
          <p className="text-white/30 text-sm mt-1">Waiting for director to start…</p>
        </div>
      </div>
    );
  }

  // ─── BOARD ONLY MODE ──────────────────────────────────────────────────────
  if (displayMode === "board_only") {
    return (
      <div className="min-h-screen bg-[#080f08] flex items-center justify-center p-2">
        <ConnectionIndicator />
        <div className="w-full max-w-[92vh] mx-auto relative">
          <div className="rounded-xl overflow-hidden shadow-[0_0_100px_rgba(76,175,80,0.06)]">
            <Chessboard
              options={{
                position: broadcast.currentFen,
                boardOrientation: settings.boardOrientation as "white" | "black",
                squareStyles,
                animationDurationInMs: 400,
                boardStyle: { borderRadius: "0" },
                darkSquareStyle: { backgroundColor: "#2d4a2d" },
                lightSquareStyle: { backgroundColor: "#c8e6c9" },
              }}
            />
          </div>

          {/* Clock overlay — shown only when clock data is available */}
          {clockHasData && (
            <>
              {/* Black clock — top-left corner (black is at top when board orientation is white) */}
              <div className={`absolute top-2 left-2 flex flex-col items-start px-4 py-2 rounded-xl backdrop-blur-md transition-all duration-300 ${
                displayedBlackMs !== null && displayedBlackMs < 10_000
                  ? "bg-red-500/30 border-2 border-red-500/70 shadow-[0_0_24px_rgba(239,68,68,0.5)]"
                  : displayedBlackMs !== null && displayedBlackMs < 60_000
                  ? "bg-red-500/20 border border-red-500/40"
                  : clockRunning && clockSideToMove === "b"
                  ? "bg-[#4CAF50]/15 border border-[#4CAF50]/40"
                  : "bg-black/60 border border-white/10"
              }`}>
                <div className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-0.5">
                  {settings.boardOrientation === "black" ? broadcast.whitePlayerName : broadcast.blackPlayerName}
                </div>
                <div className={`font-mono font-black tabular-nums leading-none ${
                  displayedBlackMs !== null && displayedBlackMs < 10_000 ? "text-red-300" :
                  displayedBlackMs !== null && displayedBlackMs < 60_000 ? "text-red-400" :
                  clockRunning && clockSideToMove === "b" ? "text-white" : "text-white/40"
                }`} style={{ fontSize: `${2.4 * fontScale}rem` }}>
                  {settings.boardOrientation === "black" ? fmtClock(displayedWhiteMs) : fmtClock(displayedBlackMs)}
                </div>
                {clockRunning && clockSideToMove === "b" && settings.boardOrientation !== "black" && (
                  <div className={`mt-1 w-2 h-2 rounded-full animate-pulse self-end ${
                    displayedBlackMs !== null && displayedBlackMs < 10_000 ? "bg-red-400" : "bg-[#4CAF50]"
                  }`} />
                )}
                {clockRunning && clockSideToMove === "w" && settings.boardOrientation === "black" && (
                  <div className="mt-1 w-2 h-2 rounded-full animate-pulse self-end bg-[#4CAF50]" />
                )}
              </div>

              {/* White clock — bottom-right corner (white is at bottom when board orientation is white) */}
              <div className={`absolute bottom-2 right-2 flex flex-col items-end px-4 py-2 rounded-xl backdrop-blur-md transition-all duration-300 ${
                displayedWhiteMs !== null && displayedWhiteMs < 10_000
                  ? "bg-red-500/30 border-2 border-red-500/70 shadow-[0_0_24px_rgba(239,68,68,0.5)]"
                  : displayedWhiteMs !== null && displayedWhiteMs < 60_000
                  ? "bg-red-500/20 border border-red-500/40"
                  : clockRunning && clockSideToMove === "w"
                  ? "bg-[#4CAF50]/15 border border-[#4CAF50]/40"
                  : "bg-black/60 border border-white/10"
              }`}>
                <div className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-0.5 text-right">
                  {settings.boardOrientation === "black" ? broadcast.blackPlayerName : broadcast.whitePlayerName}
                </div>
                <div className={`font-mono font-black tabular-nums leading-none ${
                  displayedWhiteMs !== null && displayedWhiteMs < 10_000 ? "text-red-300" :
                  displayedWhiteMs !== null && displayedWhiteMs < 60_000 ? "text-red-400" :
                  clockRunning && clockSideToMove === "w" ? "text-white" : "text-white/40"
                }`} style={{ fontSize: `${2.4 * fontScale}rem` }}>
                  {settings.boardOrientation === "black" ? fmtClock(displayedBlackMs) : fmtClock(displayedWhiteMs)}
                </div>
                {clockRunning && clockSideToMove === "w" && settings.boardOrientation !== "black" && (
                  <div className={`mt-1 w-2 h-2 rounded-full animate-pulse ${
                    displayedWhiteMs !== null && displayedWhiteMs < 10_000 ? "bg-red-400" : "bg-[#4CAF50]"
                  }`} />
                )}
                {clockRunning && clockSideToMove === "b" && settings.boardOrientation === "black" && (
                  <div className="mt-1 w-2 h-2 rounded-full animate-pulse bg-[#4CAF50]" />
                )}
              </div>
            </>
          )}

          {/* Status pill — shown in top-right when game is over or paused */}
          {(broadcast.status === "finished" || broadcast.status === "paused") && (
            <div className={`absolute top-2 right-2 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider backdrop-blur-md ${
              broadcast.status === "finished"
                ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-300"
                : "bg-amber-500/20 border border-amber-500/40 text-amber-300"
            }`}>
              {broadcast.status === "finished"
                ? (broadcast.result && broadcast.result !== "*" ? broadcast.result : "Game Over")
                : "Paused"}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── MINIMAL MODE ─────────────────────────────────────────────────────────
  if (displayMode === "minimal") {
    return (
      <div className="min-h-screen bg-[#080f08] flex items-center justify-center p-6">
        <ConnectionIndicator />
        <div className="w-full max-w-[80vh] mx-auto">
          {/* Player names above board */}
          <div className="flex items-center justify-between mb-4 px-2">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#1A1A1A] border border-white/10 flex items-center justify-center font-bold text-sm">
                {broadcast.blackPlayerName.charAt(0).toUpperCase()}
              </div>
              <span className="text-white font-bold" style={{ fontSize: `${1.4 * fontScale}rem` }}>{broadcast.blackPlayerName}</span>
              {settings.showRatings && broadcast.blackPlayerElo && <span className="text-white/40 text-sm">{broadcast.blackPlayerElo}</span>}
            </div>
            {clockHasData ? (
              <div className={`font-mono font-bold tabular-nums text-2xl px-3 py-1 rounded-lg ${
                displayedBlackMs !== null && displayedBlackMs < 10_000 ? "text-red-400 bg-red-500/10" :
                displayedBlackMs !== null && displayedBlackMs < 60_000 ? "text-red-400" :
                clockRunning && clockSideToMove === "b" ? "text-white" : "text-white/30"
              }`}>{fmtClock(displayedBlackMs)}</div>
            ) : broadcast.sideToMove === "b" && broadcast.status === "live" ? (
              <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" /> To move
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl overflow-hidden shadow-[0_0_80px_rgba(76,175,80,0.08)] border border-white/5">
            <Chessboard
              options={{
                position: broadcast.currentFen,
                boardOrientation: settings.boardOrientation as "white" | "black",
                squareStyles,
                animationDurationInMs: 400,
                boardStyle: { borderRadius: "0" },
                darkSquareStyle: { backgroundColor: "#2d4a2d" },
                lightSquareStyle: { backgroundColor: "#c8e6c9" },
              }}
            />
          </div>

          {/* White player below board */}
          <div className="flex items-center justify-between mt-4 px-2">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/90 border border-white/20 flex items-center justify-center font-bold text-sm text-[#1A1A1A]">
                {broadcast.whitePlayerName.charAt(0).toUpperCase()}
              </div>
              <span className="text-white font-bold" style={{ fontSize: `${1.4 * fontScale}rem` }}>{broadcast.whitePlayerName}</span>
              {settings.showRatings && broadcast.whitePlayerElo && <span className="text-white/40 text-sm">{broadcast.whitePlayerElo}</span>}
            </div>
            {clockHasData ? (
              <div className={`font-mono font-bold tabular-nums text-2xl px-3 py-1 rounded-lg ${
                displayedWhiteMs !== null && displayedWhiteMs < 10_000 ? "text-red-400 bg-red-500/10" :
                displayedWhiteMs !== null && displayedWhiteMs < 60_000 ? "text-red-400" :
                clockRunning && clockSideToMove === "w" ? "text-white" : "text-white/30"
              }`}>{fmtClock(displayedWhiteMs)}</div>
            ) : broadcast.sideToMove === "w" && broadcast.status === "live" ? (
              <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" /> To move
              </div>
            ) : null}
          </div>

          {/* Result overlay */}
          {broadcast.result && broadcast.result !== "*" && (
            <div className="mt-4 text-center">
              <span className="text-3xl font-black font-mono text-[#4CAF50]">{broadcast.result}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── OVERLAY MODE ─────────────────────────────────────────────────────────
  if (displayMode === "overlay") {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center p-4 relative">
        <ConnectionIndicator />
        <div className="w-full max-w-[70vh] mx-auto">
          {/* Board wrapper — relative for clock corner overlays */}
          <div className="relative">
            <div className="rounded-xl overflow-hidden shadow-2xl">
              <Chessboard
                options={{
                  position: broadcast.currentFen,
                  boardOrientation: settings.boardOrientation as "white" | "black",
                  squareStyles,
                  animationDurationInMs: 300,
                  boardStyle: { borderRadius: "0" },
                  darkSquareStyle: { backgroundColor: "#2d4a2d" },
                  lightSquareStyle: { backgroundColor: "#c8e6c9" },
                }}
              />
            </div>

            {/* Clock corner overlays — only when clock data is available */}
            {clockHasData && (
              <>
                {/* Top-left: black's clock (black is at top when orientation is white) */}
                <div className={`absolute top-2 left-2 flex flex-col items-start px-3 py-1.5 rounded-lg backdrop-blur-md transition-all duration-300 ${
                  displayedBlackMs !== null && displayedBlackMs < 10_000
                    ? "bg-red-500/35 border-2 border-red-500/70 shadow-[0_0_20px_rgba(239,68,68,0.5)]"
                    : displayedBlackMs !== null && displayedBlackMs < 60_000
                    ? "bg-red-500/20 border border-red-500/40"
                    : clockRunning && clockSideToMove === "b"
                    ? "bg-[#4CAF50]/20 border border-[#4CAF50]/40"
                    : "bg-black/65 border border-white/12"
                }`}>
                  <div className="text-[9px] uppercase tracking-widest font-bold text-white/40 leading-none mb-0.5">
                    {settings.boardOrientation === "black" ? broadcast.whitePlayerName : broadcast.blackPlayerName}
                  </div>
                  <div className={`font-mono font-black tabular-nums leading-none text-2xl ${
                    displayedBlackMs !== null && displayedBlackMs < 10_000 ? "text-red-300" :
                    displayedBlackMs !== null && displayedBlackMs < 60_000 ? "text-red-400" :
                    clockRunning && clockSideToMove === "b" ? "text-white" : "text-white/35"
                  }`}>
                    {settings.boardOrientation === "black" ? fmtClock(displayedWhiteMs) : fmtClock(displayedBlackMs)}
                  </div>
                  {((clockRunning && clockSideToMove === "b" && settings.boardOrientation !== "black") ||
                    (clockRunning && clockSideToMove === "w" && settings.boardOrientation === "black")) && (
                    <div className={`mt-0.5 w-1.5 h-1.5 rounded-full animate-pulse self-end ${
                      displayedBlackMs !== null && displayedBlackMs < 10_000 ? "bg-red-400" : "bg-[#4CAF50]"
                    }`} />
                  )}
                </div>

                {/* Bottom-right: white's clock */}
                <div className={`absolute bottom-2 right-2 flex flex-col items-end px-3 py-1.5 rounded-lg backdrop-blur-md transition-all duration-300 ${
                  displayedWhiteMs !== null && displayedWhiteMs < 10_000
                    ? "bg-red-500/35 border-2 border-red-500/70 shadow-[0_0_20px_rgba(239,68,68,0.5)]"
                    : displayedWhiteMs !== null && displayedWhiteMs < 60_000
                    ? "bg-red-500/20 border border-red-500/40"
                    : clockRunning && clockSideToMove === "w"
                    ? "bg-[#4CAF50]/20 border border-[#4CAF50]/40"
                    : "bg-black/65 border border-white/12"
                }`}>
                  <div className="text-[9px] uppercase tracking-widest font-bold text-white/40 leading-none mb-0.5 text-right">
                    {settings.boardOrientation === "black" ? broadcast.blackPlayerName : broadcast.whitePlayerName}
                  </div>
                  <div className={`font-mono font-black tabular-nums leading-none text-2xl ${
                    displayedWhiteMs !== null && displayedWhiteMs < 10_000 ? "text-red-300" :
                    displayedWhiteMs !== null && displayedWhiteMs < 60_000 ? "text-red-400" :
                    clockRunning && clockSideToMove === "w" ? "text-white" : "text-white/35"
                  }`}>
                    {settings.boardOrientation === "black" ? fmtClock(displayedBlackMs) : fmtClock(displayedWhiteMs)}
                  </div>
                  {((clockRunning && clockSideToMove === "w" && settings.boardOrientation !== "black") ||
                    (clockRunning && clockSideToMove === "b" && settings.boardOrientation === "black")) && (
                    <div className={`mt-0.5 w-1.5 h-1.5 rounded-full animate-pulse ${
                      displayedWhiteMs !== null && displayedWhiteMs < 10_000 ? "bg-red-400" : "bg-[#4CAF50]"
                    }`} />
                  )}
                </div>
              </>
            )}
          </div>

          {/* Bottom info bar — player names, last move, result */}
          <div className="mt-3 bg-black/80 backdrop-blur-lg rounded-xl border border-white/10 overflow-hidden">
            {/* Player names row */}
            <div className="flex items-center justify-between px-5 py-2.5">
              {/* White */}
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-white/90 border border-white/20 flex-shrink-0" />
                <span className="text-sm text-white font-semibold">{broadcast.whitePlayerName}</span>
                {settings.showRatings && broadcast.whitePlayerElo && (
                  <span className="text-xs text-white/35">{broadcast.whitePlayerElo}</span>
                )}
              </div>
              {/* Last move / status */}
              <div className="text-xs text-white/40 font-mono px-2">
                {broadcast.status === "live" ? (
                  <span className="flex items-center gap-1.5 text-red-400 font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /> LIVE
                  </span>
                ) : broadcast.lastMoveSan ? (
                  `${Math.ceil(broadcast.moveNumber / 2)}. ${broadcast.sideToMove === "w" ? "..." : ""} ${broadcast.lastMoveSan}`
                ) : null}
              </div>
              {/* Black */}
              <div className="flex items-center gap-2">
                {settings.showRatings && broadcast.blackPlayerElo && (
                  <span className="text-xs text-white/35">{broadcast.blackPlayerElo}</span>
                )}
                <span className="text-sm text-white font-semibold">{broadcast.blackPlayerName}</span>
                <div className="w-4 h-4 rounded-full bg-[#1A1A1A] border border-white/15 flex-shrink-0" />
              </div>
            </div>
            {/* Result bar */}
            {broadcast.result && broadcast.result !== "*" && (
              <div className="border-t border-white/8 text-center py-1.5 text-lg font-black font-mono text-[#4CAF50]">
                {broadcast.result}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── STANDARD MODE (default) — optimized for 16:9 projector ───────────────
  return (
    <div className="min-h-screen bg-[#080f08] text-white flex flex-col overflow-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>
      <ConnectionIndicator />

      {/* Tournament name header */}
      {settings.showTournamentName && broadcast.tournamentName && (
        <div className="text-center py-3 border-b border-white/5">
          <span className="text-sm text-white/40 uppercase tracking-[0.2em] font-semibold" style={{ fontSize: `${0.85 * fontScale}rem` }}>
            {broadcast.tournamentName}
          </span>
          <span className="text-white/20 ml-4 text-sm">Round {broadcast.roundNumber} • Board {broadcast.boardNumber}</span>
        </div>
      )}

      {/* Top bar */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-white/6">
        <div className="flex items-center gap-4">
          <div className="w-9 h-9 rounded-lg bg-[#4CAF50]/20 flex items-center justify-center">
            <Radio className="w-4.5 h-4.5 text-[#4CAF50]" />
          </div>
          <span className="text-white/70 font-bold tracking-wide text-base">ChessOTB.club</span>
          <span className="text-white/15">·</span>
          <span className="text-white/40 text-sm">Board {broadcast.boardNumber} · Round {broadcast.roundNumber}</span>
        </div>
        <div className="flex items-center gap-5">
          {broadcast.status === "live" && (
            <div className="flex items-center gap-2 text-red-400 font-black tracking-[0.15em] uppercase" style={{ fontSize: `${0.9 * fontScale}rem` }}>
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              LIVE
            </div>
          )}
          {broadcast.status === "paused" && (
            <div className="text-amber-400 font-bold tracking-[0.15em] uppercase text-sm">PAUSED</div>
          )}
          {broadcast.status === "finished" && (
            <div className="text-emerald-400 font-bold tracking-[0.15em] uppercase text-sm">GAME OVER</div>
          )}
          <div className="flex items-center gap-1.5 text-white/25">
            <Clock className="w-4 h-4" />
            <span className="text-sm font-mono">{clock.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
          </div>
        </div>
      </div>

      {/* Main content — 16:9 optimized layout */}
      <div className="flex-1 flex items-stretch min-h-0">
        {/* Board section */}
        <div className="flex-1 flex flex-col items-center justify-center px-8 py-4 gap-3">
          {/* Black player (top) */}
          <div className="w-full max-w-[min(72vh,680px)] flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-[#1A1A1A] border-2 border-white/10 flex items-center justify-center font-bold text-lg">
                {broadcast.blackPlayerName.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="font-bold leading-tight" style={{ fontSize: `${1.4 * fontScale}rem` }}>{broadcast.blackPlayerName}</div>
                {settings.showRatings && broadcast.blackPlayerElo && (
                  <div className="text-white/40" style={{ fontSize: `${0.9 * fontScale}rem` }}>{broadcast.blackPlayerElo}</div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Chess clock for black */}
              {clockHasData && (
                <div className={`flex flex-col items-center justify-center px-5 py-2 rounded-xl transition-all duration-300 ${
                  displayedBlackMs !== null && displayedBlackMs < 10_000
                    ? "bg-red-500/20 border-2 border-red-500/60 shadow-[0_0_20px_rgba(239,68,68,0.3)]"
                    : displayedBlackMs !== null && displayedBlackMs < 60_000
                    ? "bg-red-500/15 border border-red-500/25"
                    : clockRunning && clockSideToMove === "b"
                    ? "bg-[#4CAF50]/10 border border-[#4CAF50]/30"
                    : "bg-white/3 border border-white/8"
                }`}>
                  <div className={`font-mono font-bold tabular-nums text-3xl leading-none ${
                    displayedBlackMs !== null && displayedBlackMs < 10_000 ? "text-red-400" :
                    displayedBlackMs !== null && displayedBlackMs < 60_000 ? "text-red-400" :
                    clockRunning && clockSideToMove === "b" ? "text-white" : "text-white/35"
                  }`} style={{ fontSize: `${2 * fontScale}rem` }}>
                    {fmtClock(displayedBlackMs)}
                  </div>
                  {clockRunning && clockSideToMove === "b" && (
                    <div className={`mt-1 w-1.5 h-1.5 rounded-full animate-pulse ${
                      displayedBlackMs !== null && displayedBlackMs < 10_000 ? "bg-red-400" : "bg-[#4CAF50]"
                    }`} />
                  )}
                </div>
              )}
              {!clockHasData && broadcast.sideToMove === "b" && broadcast.status === "live" && (
                <div className="flex items-center gap-2 text-amber-400 font-semibold" style={{ fontSize: `${0.9 * fontScale}rem` }}>
                  <span className="w-3 h-3 rounded-full bg-amber-400 animate-pulse" />
                  To move
                </div>
              )}
            </div>
          </div>

          {/* Board */}
          <div className="w-full max-w-[min(72vh,680px)] rounded-2xl overflow-hidden border border-white/10 shadow-[0_0_100px_rgba(76,175,80,0.06)]">
            <Chessboard
              options={{
                position: broadcast.currentFen,
                boardOrientation: settings.boardOrientation as "white" | "black",
                squareStyles,
                animationDurationInMs: 400,
                boardStyle: { borderRadius: "0" },
                darkSquareStyle: { backgroundColor: "#2d4a2d" },
                lightSquareStyle: { backgroundColor: "#c8e6c9" },
              }}
            />
          </div>

          {/* White player (bottom) */}
          <div className="w-full max-w-[min(72vh,680px)] flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-white/90 border-2 border-white/20 flex items-center justify-center font-bold text-lg text-[#1A1A1A]">
                {broadcast.whitePlayerName.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="font-bold leading-tight" style={{ fontSize: `${1.4 * fontScale}rem` }}>{broadcast.whitePlayerName}</div>
                {settings.showRatings && broadcast.whitePlayerElo && (
                  <div className="text-white/40" style={{ fontSize: `${0.9 * fontScale}rem` }}>{broadcast.whitePlayerElo}</div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Chess clock for white */}
              {clockHasData && (
                <div className={`flex flex-col items-center justify-center px-5 py-2 rounded-xl transition-all duration-300 ${
                  displayedWhiteMs !== null && displayedWhiteMs < 10_000
                    ? "bg-red-500/20 border-2 border-red-500/60 shadow-[0_0_20px_rgba(239,68,68,0.3)]"
                    : displayedWhiteMs !== null && displayedWhiteMs < 60_000
                    ? "bg-red-500/15 border border-red-500/25"
                    : clockRunning && clockSideToMove === "w"
                    ? "bg-[#4CAF50]/10 border border-[#4CAF50]/30"
                    : "bg-white/3 border border-white/8"
                }`}>
                  <div className={`font-mono font-bold tabular-nums leading-none ${
                    displayedWhiteMs !== null && displayedWhiteMs < 10_000 ? "text-red-400" :
                    displayedWhiteMs !== null && displayedWhiteMs < 60_000 ? "text-red-400" :
                    clockRunning && clockSideToMove === "w" ? "text-white" : "text-white/35"
                  }`} style={{ fontSize: `${2 * fontScale}rem` }}>
                    {fmtClock(displayedWhiteMs)}
                  </div>
                  {clockRunning && clockSideToMove === "w" && (
                    <div className={`mt-1 w-1.5 h-1.5 rounded-full animate-pulse ${
                      displayedWhiteMs !== null && displayedWhiteMs < 10_000 ? "bg-red-400" : "bg-[#4CAF50]"
                    }`} />
                  )}
                </div>
              )}
              {!clockHasData && broadcast.sideToMove === "w" && broadcast.status === "live" && (
                <div className="flex items-center gap-2 text-amber-400 font-semibold" style={{ fontSize: `${0.9 * fontScale}rem` }}>
                  <span className="w-3 h-3 rounded-full bg-amber-400 animate-pulse" />
                  To move
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right panel: move list + QR */}
        <div className="w-80 border-l border-white/6 flex flex-col">
          {settings.showMoveList && (
            <>
              <div className="px-5 py-4 border-b border-white/6">
                <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-white/30">Move Notation</h3>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-0.5">
                {movePairs.length === 0 ? (
                  <p className="text-white/20 text-sm text-center mt-8">Waiting for first move…</p>
                ) : (
                  movePairs.map(([white, black], i) => (
                    <div key={i} className={`flex gap-2 px-3 py-2 rounded-lg font-mono ${i === movePairs.length - 1 ? "bg-[#4CAF50]/10" : ""}`} style={{ fontSize: `${0.95 * fontScale}rem` }}>
                      <span className="w-8 text-right flex-shrink-0 text-white/25 text-sm pt-0.5">{i + 1}.</span>
                      <span className={`flex-1 ${i === movePairs.length - 1 && !black ? "text-[#4CAF50] font-bold" : "text-white/75"}`}>{white}</span>
                      <span className={`flex-1 ${i === movePairs.length - 1 && black ? "text-[#4CAF50] font-bold" : "text-white/75"}`}>{black ?? ""}</span>
                    </div>
                  ))
                )}
              </div>
            </>
          )}

          {/* Result */}
          {broadcast.result && broadcast.result !== "*" && (
            <div className="px-5 py-5 border-t border-white/6 text-center">
              <div className="font-black text-[#4CAF50]" style={{ fontSize: `${2.2 * fontScale}rem` }}>{broadcast.result}</div>
              <div className="text-white/50 mt-1" style={{ fontSize: `${0.9 * fontScale}rem` }}>
                {broadcast.result === "1-0" ? `${broadcast.whitePlayerName} wins` :
                 broadcast.result === "0-1" ? `${broadcast.blackPlayerName} wins` :
                 "Draw"}
              </div>
            </div>
          )}

          {/* QR Code */}
          {settings.showQr && (
            <div className="px-5 py-5 border-t border-white/6 flex flex-col items-center gap-2">
              <QRCodeSVG value={publicUrl} size={110} bgColor="transparent" fgColor="#4CAF50" level="L" />
              <span className="text-[10px] text-white/25 text-center tracking-wide">Scan to follow on your device</span>
            </div>
          )}

          {/* Move counter */}
          <div className="px-5 py-3 border-t border-white/6 flex justify-between text-sm text-white/30">
            <span>Move {Math.ceil(broadcast.moveNumber / 2) || 0}</span>
            <span>{broadcast.sideToMove === "w" ? "White" : "Black"} to move</span>
          </div>
        </div>
      </div>

      {/* Footer branding */}
      <div className="text-center py-2 border-t border-white/3">
        <span className="text-[10px] text-white/15 tracking-[0.2em] uppercase font-medium">ChessOTB.club — Live Tournament Broadcast</span>
      </div>
    </div>
  );
}
