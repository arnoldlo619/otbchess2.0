/**
 * OTB Chess — Venue Display Page
 * Route: /live/board/:slug/display
 *
 * Full-screen premium dark display designed for projectors and venue monitors.
 * Auto-refreshes via SSE. No controls — spectator-only.
 */
import { useState, useEffect, useRef } from "react";
import { useParams } from "wouter";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { Radio, QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

interface Broadcast {
  id: string;
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

export default function VenueDisplay() {
  const { slug } = useParams<{ slug: string }>();
  const [broadcast, setBroadcast] = useState<Broadcast | null>(null);
  const [loading, setLoading] = useState(true);
  const chessRef = useRef(new Chess());
  const eventSourceRef = useRef<EventSource | null>(null);
  const [showQR, setShowQR] = useState(false);

  const publicUrl = broadcast ? `${window.location.origin}/live/board/${broadcast.publicSlug}` : "";

  function applyBroadcast(b: Broadcast) {
    setBroadcast(b);
    try { chessRef.current.load(b.currentFen); } catch { /* */ }
  }

  useEffect(() => {
    if (!slug) return;
    async function init() {
      try {
        const res = await fetch(`/api/broadcasts/slug/${slug}`);
        if (!res.ok) { setLoading(false); return; }
        const b: Broadcast = await res.json();
        applyBroadcast(b);
        setLoading(false);

        const es = new EventSource(`/api/broadcasts/${b.id}/events`);
        eventSourceRef.current = es;

        const handleUpdate = (e: Event) => {
          try {
            const data = JSON.parse((e as MessageEvent).data);
            applyBroadcast(data.broadcast ?? data);
          } catch { /* */ }
        };

        ["init", "move_played", "move_undone", "status_changed", "result_set", "position_set"].forEach((evt) => {
          es.addEventListener(evt, handleUpdate);
        });
        es.onerror = () => setTimeout(() => es.close(), 3000);
      } catch {
        setLoading(false);
      }
    }
    init();
    return () => eventSourceRef.current?.close();
  }, [slug]);

  // Last move highlight
  const customSquareStyles: Record<string, React.CSSProperties> = {};
  if (broadcast?.lastMoveUci && broadcast.lastMoveUci.length >= 4) {
    const from = broadcast.lastMoveUci.slice(0, 2);
    const to = broadcast.lastMoveUci.slice(2, 4);
    customSquareStyles[from] = { backgroundColor: "rgba(255, 255, 0, 0.22)" };
    customSquareStyles[to] = { backgroundColor: "rgba(255, 255, 0, 0.38)" };
  }

  // Move list
  const history = chessRef.current.history();
  const movePairs: [string, string?][] = [];
  for (let i = 0; i < history.length; i += 2) {
    movePairs.push([history[i], history[i + 1]]);
  }
  const moveListRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (moveListRef.current) moveListRef.current.scrollTop = moveListRef.current.scrollHeight;
  }, [broadcast?.moveNumber]);

  if (loading || !broadcast) {
    return (
      <div className="min-h-screen bg-[#0a0f0a] flex items-center justify-center">
        <div className="text-center space-y-4">
          <Radio className="w-12 h-12 text-[#4CAF50] animate-pulse mx-auto" />
          <p className="text-white/40 text-lg">Loading broadcast...</p>
        </div>
      </div>
    );
  }

  const isFinished = broadcast.status === "finished";
  const isPaused = broadcast.status === "paused";

  return (
    <div className="min-h-screen bg-[#0a0f0a] text-white flex flex-col overflow-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>
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
          {isPaused && (
            <div className="text-amber-400 text-sm font-bold tracking-widest uppercase">PAUSED</div>
          )}
          {isFinished && (
            <div className="text-emerald-400 text-sm font-bold tracking-widest uppercase">GAME OVER</div>
          )}
          <button onClick={() => setShowQR((v) => !v)}
            className="p-2 rounded-lg bg-white/06 hover:bg-white/10 transition-colors">
            <QrCode className="w-4 h-4 text-white/50" />
          </button>
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
                {broadcast.blackPlayerElo && <div className="text-white/40 text-sm">{broadcast.blackPlayerElo}</div>}
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
                boardOrientation: "white",
                squareStyles: customSquareStyles,
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
                {broadcast.whitePlayerElo && <div className="text-white/40 text-sm">{broadcast.whitePlayerElo}</div>}
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

        {/* Right panel: move list */}
        <div className="w-72 border-l border-white/06 flex flex-col">
          <div className="px-5 py-4 border-b border-white/06">
            <h3 className="text-xs font-bold uppercase tracking-widest text-white/30">Move Notation</h3>
          </div>
          <div ref={moveListRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-0.5">
            {movePairs.length === 0 ? (
              <p className="text-white/20 text-sm text-center mt-8">Waiting for first move...</p>
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

          {/* Move counter */}
          <div className="px-5 py-3 border-t border-white/06 flex justify-between text-xs text-white/30">
            <span>Move {Math.ceil(broadcast.moveNumber / 2)}</span>
            <span>{broadcast.sideToMove === "w" ? "White" : "Black"} to move</span>
          </div>
        </div>
      </div>

      {/* QR overlay */}
      {showQR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setShowQR(false)}>
          <div className="bg-[#111] rounded-2xl p-8 text-center border border-white/10" onClick={(e) => e.stopPropagation()}>
            <p className="text-white/60 text-sm mb-4">Scan to follow on your phone</p>
            <div className="bg-white p-4 rounded-xl inline-block">
              <QRCodeSVG value={publicUrl} size={220} />
            </div>
            <p className="text-white/30 text-xs mt-3 font-mono">{publicUrl}</p>
          </div>
        </div>
      )}
    </div>
  );
}
