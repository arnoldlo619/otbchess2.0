/**
 * OTB Chess — Public Live Board Page
 * Route: /live/board/:slug
 *
 * Read-only spectator view with realtime SSE updates.
 * Shows the board, player names, move list, and game status.
 */
import { useState, useEffect, useRef } from "react";
import { useParams } from "wouter";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { Radio, Eye, Clock, ExternalLink } from "lucide-react";

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
  currentFen: string;
  pgn: string;
  lastMoveSan?: string | null;
  lastMoveUci?: string | null;
  moveNumber: number;
  sideToMove: "w" | "b";
  result?: string | null;
  publicSlug: string;
}

function StatusPill({ status }: { status: Broadcast["status"] }) {
  const map: Record<string, { label: string; cls: string }> = {
    ready:    { label: "Starting Soon", cls: "bg-gray-500/20 text-gray-300 border-gray-500/30" },
    live:     { label: "● LIVE",        cls: "bg-red-500/20 text-red-400 border-red-500/30 animate-pulse" },
    paused:   { label: "Paused",        cls: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
    finished: { label: "Game Over",     cls: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
    error:    { label: "Error",         cls: "bg-red-700/20 text-red-300 border-red-700/30" },
  };
  const { label, cls } = map[status] ?? map.ready;
  return (
    <span className={`text-xs font-bold px-2.5 py-1 rounded-full border tracking-widest uppercase ${cls}`}>
      {label}
    </span>
  );
}

export default function LiveBoard() {
  const { slug } = useParams<{ slug: string }>();
  const [broadcast, setBroadcast] = useState<Broadcast | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [spectators] = useState(Math.floor(Math.random() * 12) + 2); // decorative
  const chessRef = useRef(new Chess());
  const eventSourceRef = useRef<EventSource | null>(null);

  function applyBroadcast(b: Broadcast) {
    setBroadcast(b);
    try {
      chessRef.current.load(b.currentFen);
    } catch { /* ignore */ }
  }

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

        // Subscribe to SSE
        const es = new EventSource(`/api/broadcasts/${b.id}/events`);
        eventSourceRef.current = es;

        es.addEventListener("init", (e) => {
          try { applyBroadcast(JSON.parse((e as MessageEvent).data)); } catch { /* */ }
        });
        es.addEventListener("move_played", (e) => {
          try {
            const { broadcast: updated } = JSON.parse((e as MessageEvent).data);
            applyBroadcast(updated);
          } catch { /* */ }
        });
        es.addEventListener("move_undone", (e) => {
          try {
            const { broadcast: updated } = JSON.parse((e as MessageEvent).data);
            applyBroadcast(updated);
          } catch { /* */ }
        });
        es.addEventListener("status_changed", (e) => {
          try {
            const { broadcast: updated } = JSON.parse((e as MessageEvent).data);
            applyBroadcast(updated);
          } catch { /* */ }
        });
        es.addEventListener("result_set", (e) => {
          try {
            const { broadcast: updated } = JSON.parse((e as MessageEvent).data);
            applyBroadcast(updated);
          } catch { /* */ }
        });
        es.addEventListener("position_set", (e) => {
          try {
            const { broadcast: updated } = JSON.parse((e as MessageEvent).data);
            applyBroadcast(updated);
          } catch { /* */ }
        });
        es.onerror = () => {
          // Reconnect silently
          setTimeout(() => es.close(), 3000);
        };
      } catch {
        setError("Failed to load broadcast");
        setLoading(false);
      }
    }
    fetchBroadcast();

    return () => {
      eventSourceRef.current?.close();
    };
  }, [slug]);

  // ─── Last move highlight ──────────────────────────────────────────────────
  const customSquareStyles: Record<string, React.CSSProperties> = {};
  if (broadcast?.lastMoveUci && broadcast.lastMoveUci.length >= 4) {
    const from = broadcast.lastMoveUci.slice(0, 2);
    const to = broadcast.lastMoveUci.slice(2, 4);
    customSquareStyles[from] = { backgroundColor: "rgba(255, 255, 0, 0.25)" };
    customSquareStyles[to] = { backgroundColor: "rgba(255, 255, 0, 0.35)" };
  }

  // ─── Move list ────────────────────────────────────────────────────────────
  const history = chessRef.current.history();
  const movePairs: [string, string?][] = [];
  for (let i = 0; i < history.length; i += 2) {
    movePairs.push([history[i], history[i + 1]]);
  }
  const moveListRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (moveListRef.current) {
      moveListRef.current.scrollTop = moveListRef.current.scrollHeight;
    }
  }, [broadcast?.moveNumber]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[oklch(0.13_0.04_145)] flex items-center justify-center">
        <div className="text-center space-y-3">
          <Radio className="w-8 h-8 text-[#4CAF50] animate-pulse mx-auto" />
          <p className="text-white/50 text-sm">Loading broadcast...</p>
        </div>
      </div>
    );
  }

  if (error || !broadcast) {
    return (
      <div className="min-h-screen bg-[oklch(0.13_0.04_145)] flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-white/50 text-sm">{error ?? "Broadcast not found"}</p>
          <a href="/" className="text-[#4CAF50] text-sm hover:underline">← Back to ChessOTB</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[oklch(0.13_0.04_145)] text-white">
      {/* Header */}
      <div className="border-b border-white/08 bg-[oklch(0.16_0.05_145)] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#4CAF50]/20 flex items-center justify-center">
              <Radio className="w-3.5 h-3.5 text-[#4CAF50]" />
            </div>
            <span className="font-bold text-sm">ChessOTB</span>
          </a>
          <span className="text-white/20">·</span>
          <span className="text-white/50 text-xs">Board {broadcast.boardNumber} · Round {broadcast.roundNumber}</span>
          <StatusPill status={broadcast.status} />
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-white/40 text-xs">
            <Eye className="w-3.5 h-3.5" />
            {spectators} watching
          </div>
          <a href={`/live/board/${slug}/display`} target="_blank" rel="noreferrer"
            className="text-xs text-white/40 hover:text-white/70 flex items-center gap-1">
            <ExternalLink className="w-3 h-3" /> Venue Display
          </a>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
        {/* Board */}
        <div className="space-y-4">
          {/* Black player */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-gray-800 border border-white/10 flex items-center justify-center text-xs font-bold">
                {broadcast.blackPlayerName.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="font-semibold text-sm">{broadcast.blackPlayerName}</div>
                {broadcast.blackPlayerElo && (
                  <div className="text-xs text-white/40">{broadcast.blackPlayerElo}</div>
                )}
              </div>
            </div>
            {broadcast.sideToMove === "b" && broadcast.status === "live" && (
              <div className="flex items-center gap-1.5 text-xs text-amber-400">
                <Clock className="w-3.5 h-3.5" />
                <span>Thinking...</span>
              </div>
            )}
          </div>

          <div className="rounded-xl overflow-hidden border border-white/08 shadow-2xl">
            <Chessboard
              options={{
                position: broadcast.currentFen,
                boardOrientation: "white",
                squareStyles: customSquareStyles,
                animationDurationInMs: 300,
                boardStyle: { borderRadius: "0" },
              }}
            />
          </div>

          {/* White player */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-white/90 border border-white/20 flex items-center justify-center text-xs font-bold text-gray-900">
                {broadcast.whitePlayerName.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="font-semibold text-sm">{broadcast.whitePlayerName}</div>
                {broadcast.whitePlayerElo && (
                  <div className="text-xs text-white/40">{broadcast.whitePlayerElo}</div>
                )}
              </div>
            </div>
            {broadcast.sideToMove === "w" && broadcast.status === "live" && (
              <div className="flex items-center gap-1.5 text-xs text-amber-400">
                <Clock className="w-3.5 h-3.5" />
                <span>Thinking...</span>
              </div>
            )}
          </div>

          {/* Result banner */}
          {broadcast.result && broadcast.result !== "*" && (
            <div className="rounded-xl bg-[#4CAF50]/15 border border-[#4CAF50]/30 p-4 text-center">
              <div className="text-2xl font-black text-[#4CAF50]">{broadcast.result}</div>
              <div className="text-sm text-white/60 mt-1">
                {broadcast.result === "1-0" ? `${broadcast.whitePlayerName} wins` :
                 broadcast.result === "0-1" ? `${broadcast.blackPlayerName} wins` :
                 "Draw"}
              </div>
            </div>
          )}
        </div>

        {/* Right: Move list */}
        <div className="space-y-4">
          <div className="rounded-xl bg-[oklch(0.17_0.05_145)] border border-white/08 p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white/40 mb-3">Moves</h3>
            {movePairs.length === 0 ? (
              <p className="text-sm text-center py-6 text-white/30">Waiting for first move...</p>
            ) : (
              <div ref={moveListRef} className="space-y-0.5 max-h-96 overflow-y-auto font-mono text-sm">
                {movePairs.map(([white, black], i) => (
                  <div key={i} className="flex gap-2 px-2 py-1 rounded hover:bg-white/05">
                    <span className="w-6 text-right flex-shrink-0 text-white/30">{i + 1}.</span>
                    <span className={`flex-1 ${i === movePairs.length - 1 && !black ? "text-[#4CAF50] font-semibold" : "text-white/80"}`}>{white}</span>
                    <span className={`flex-1 ${i === movePairs.length - 1 && black ? "text-[#4CAF50] font-semibold" : "text-white/80"}`}>{black ?? ""}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Game info */}
          <div className="rounded-xl bg-[oklch(0.17_0.05_145)] border border-white/08 p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-white/50">Move</span>
              <span className="font-mono font-semibold">{Math.ceil(broadcast.moveNumber / 2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/50">To move</span>
              <span className="font-semibold">{broadcast.sideToMove === "w" ? "White" : "Black"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/50">Round</span>
              <span>{broadcast.roundNumber}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
