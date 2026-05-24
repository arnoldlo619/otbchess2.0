/**
 * OTB Chess — Venue Display (Event-Ready)
 * Route: /live/board/:slug/display
 *
 * Full-screen display for projectors/TVs at tournament venues.
 * 3 display modes: Standard, Minimal, Overlay
 * Realtime SSE with auto-reconnect and connection indicator.
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
  displayMode: "standard" | "minimal" | "overlay";
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

  // Clock tick
  useEffect(() => {
    const interval = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

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

    es.onopen = () => {
      setConnection("connected");
      reconnectAttempts.current = 0;
    };

    es.onerror = () => {
      setConnection("disconnected");
      es.close();
      // Exponential backoff reconnect
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
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#4CAF50]/10 border border-[#4CAF50]/20">
            <Wifi className="w-3 h-3 text-[#4CAF50]" />
            <span className="text-[10px] text-[#4CAF50] font-medium">LIVE</span>
          </div>
        ) : connection === "connecting" ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 animate-pulse">
            <Wifi className="w-3 h-3 text-amber-400" />
            <span className="text-[10px] text-amber-400 font-medium">Connecting…</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/20">
            <WifiOff className="w-3 h-3 text-red-400" />
            <span className="text-[10px] text-red-400 font-medium">Reconnecting…</span>
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

  // ─── MINIMAL MODE ─────────────────────────────────────────────────────────
  if (displayMode === "minimal") {
    return (
      <div className="min-h-screen bg-[#080f08] flex items-center justify-center p-4">
        <ConnectionIndicator />
        <div className="w-full max-w-[85vh] mx-auto">
          <div className="rounded-2xl overflow-hidden shadow-[0_0_80px_rgba(76,175,80,0.08)]">
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
          <div className="mt-4 flex items-center justify-between px-2">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded bg-white" />
              <span className="text-white text-lg font-medium">{broadcast.whitePlayerName}</span>
            </div>
            {broadcast.result && <span className="text-2xl font-bold font-mono text-[#4CAF50]">{broadcast.result}</span>}
            <div className="flex items-center gap-3">
              <span className="text-white text-lg font-medium">{broadcast.blackPlayerName}</span>
              <div className="w-4 h-4 rounded bg-gray-700 border border-white/20" />
            </div>
          </div>
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
          <div className="mt-3 bg-black/80 backdrop-blur-lg rounded-xl px-4 py-3 border border-white/10">
            <div className="flex items-center justify-between">
              <div className="text-sm text-white font-medium">{broadcast.whitePlayerName}</div>
              <div className="text-xs text-white/40 font-mono">
                {broadcast.lastMoveSan && `${Math.ceil(broadcast.moveNumber / 2)}. ${broadcast.sideToMove === "w" ? "..." : ""} ${broadcast.lastMoveSan}`}
              </div>
              <div className="text-sm text-white font-medium">{broadcast.blackPlayerName}</div>
            </div>
            {broadcast.result && (
              <div className="text-center mt-1 text-lg font-bold font-mono text-[#4CAF50]">{broadcast.result}</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── STANDARD MODE (default) ──────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#080f08] text-white flex flex-col overflow-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>
      <ConnectionIndicator />

      {/* Tournament name header */}
      {settings.showTournamentName && broadcast.tournamentName && (
        <div className="text-center py-3 border-b border-white/05">
          <span className="text-xs text-white/30 uppercase tracking-widest font-medium">{broadcast.tournamentName}</span>
          <span className="text-xs text-white/20 ml-3">Round {broadcast.roundNumber} • Board {broadcast.boardNumber}</span>
        </div>
      )}

      {/* Top bar */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-white/06">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#4CAF50]/20 flex items-center justify-center">
            <Radio className="w-4 h-4 text-[#4CAF50]" />
          </div>
          <span className="text-white/70 font-semibold tracking-wide">ChessOTB.club</span>
          <span className="text-white/20">·</span>
          <span className="text-white/40 text-sm">Board {broadcast.boardNumber} · Round {broadcast.roundNumber}</span>
        </div>
        <div className="flex items-center gap-4">
          {broadcast.status === "live" && (
            <div className="flex items-center gap-2 text-red-400 text-sm font-bold tracking-widest uppercase">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              LIVE
            </div>
          )}
          {broadcast.status === "paused" && (
            <div className="text-amber-400 text-sm font-bold tracking-widest uppercase">PAUSED</div>
          )}
          {broadcast.status === "finished" && (
            <div className="text-emerald-400 text-sm font-bold tracking-widest uppercase">GAME OVER</div>
          )}
          <div className="flex items-center gap-1.5 text-white/20">
            <Clock className="w-3.5 h-3.5" />
            <span className="text-xs font-mono">{clock.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex items-stretch">
        {/* Board section */}
        <div className="flex-1 flex flex-col items-center justify-center px-8 py-6 gap-4">
          {/* Black player */}
          <div className="w-full max-w-[min(70vh,640px)] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gray-800 border border-white/10 flex items-center justify-center text-base font-bold">
                {broadcast.blackPlayerName.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="font-bold text-lg leading-tight">{broadcast.blackPlayerName}</div>
                {settings.showRatings && broadcast.blackPlayerElo && <div className="text-white/40 text-sm">{broadcast.blackPlayerElo}</div>}
              </div>
            </div>
            {broadcast.sideToMove === "b" && broadcast.status === "live" && (
              <div className="flex items-center gap-2 text-amber-400 text-sm font-semibold">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                To move
              </div>
            )}
          </div>

          {/* Board */}
          <div className="w-full max-w-[min(70vh,640px)] rounded-2xl overflow-hidden border border-white/10 shadow-[0_0_80px_rgba(76,175,80,0.08)]">
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

          {/* White player */}
          <div className="w-full max-w-[min(70vh,640px)] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/90 border border-white/20 flex items-center justify-center text-base font-bold text-gray-900">
                {broadcast.whitePlayerName.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="font-bold text-lg leading-tight">{broadcast.whitePlayerName}</div>
                {settings.showRatings && broadcast.whitePlayerElo && <div className="text-white/40 text-sm">{broadcast.whitePlayerElo}</div>}
              </div>
            </div>
            {broadcast.sideToMove === "w" && broadcast.status === "live" && (
              <div className="flex items-center gap-2 text-amber-400 text-sm font-semibold">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                To move
              </div>
            )}
          </div>
        </div>

        {/* Right panel: move list + QR */}
        <div className="w-72 border-l border-white/06 flex flex-col">
          {settings.showMoveList && (
            <>
              <div className="px-5 py-4 border-b border-white/06">
                <h3 className="text-xs font-bold uppercase tracking-widest text-white/30">Move Notation</h3>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-0.5">
                {movePairs.length === 0 ? (
                  <p className="text-white/20 text-sm text-center mt-8">Waiting for first move…</p>
                ) : (
                  movePairs.map(([white, black], i) => (
                    <div key={i} className={`flex gap-2 px-2 py-1.5 rounded-lg text-sm font-mono ${i === movePairs.length - 1 ? "bg-[#4CAF50]/10" : ""}`}>
                      <span className="w-7 text-right flex-shrink-0 text-white/25 text-xs pt-0.5">{i + 1}.</span>
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
            <div className="px-5 py-4 border-t border-white/06 text-center">
              <div className="text-3xl font-black text-[#4CAF50]">{broadcast.result}</div>
              <div className="text-white/50 text-sm mt-1">
                {broadcast.result === "1-0" ? `${broadcast.whitePlayerName} wins` :
                 broadcast.result === "0-1" ? `${broadcast.blackPlayerName} wins` :
                 "Draw"}
              </div>
            </div>
          )}

          {/* QR Code */}
          {settings.showQr && (
            <div className="px-5 py-4 border-t border-white/06 flex flex-col items-center gap-2">
              <QRCodeSVG value={publicUrl} size={100} bgColor="transparent" fgColor="#4CAF50" level="L" />
              <span className="text-[9px] text-white/20 text-center">Scan to follow on your device</span>
            </div>
          )}

          {/* Move counter */}
          <div className="px-5 py-3 border-t border-white/06 flex justify-between text-xs text-white/30">
            <span>Move {Math.ceil(broadcast.moveNumber / 2) || 0}</span>
            <span>{broadcast.sideToMove === "w" ? "White" : "Black"} to move</span>
          </div>
        </div>
      </div>

      {/* Footer branding */}
      <div className="text-center py-2 border-t border-white/03">
        <span className="text-[9px] text-white/15 tracking-widest uppercase">ChessOTB.club</span>
      </div>
    </div>
  );
}
