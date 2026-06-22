/**
 * LiveBoardsSection — shows all active broadcasts for a tournament
 * as mini-board thumbnails with player names, move count, and a live pulse.
 * Polls every 8 s and subscribes to the tournament SSE stream for instant updates.
 */
import { useEffect, useState, useCallback } from "react";
import { Link } from "wouter";
import { Radio, ExternalLink, ChevronRight } from "lucide-react";
import { Chessboard } from "react-chessboard";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Broadcast {
  id: string;
  boardNumber: number;
  roundNumber: number;
  whitePlayerName: string;
  blackPlayerName: string;
  whitePlayerElo?: number | null;
  blackPlayerElo?: number | null;
  status: string; // "ready" | "live" | "paused" | "ended"
  currentFen: string;
  lastMoveSan?: string | null;
  moveNumber: number;
  sideToMove: string;
  result?: string | null;
  publicSlug: string;
}

interface LiveBoardsSectionProps {
  tournamentId: string;
  isDark: boolean;
}

// ─── Mini board thumbnail card ─────────────────────────────────────────────────
function BoardCard({ broadcast, isDark }: { broadcast: Broadcast; isDark: boolean }) {
  const isLive = broadcast.status === "live";
  const isEnded = broadcast.status === "ended" || !!broadcast.result;

  const resultLabel =
    broadcast.result === "1-0"
      ? `${broadcast.whitePlayerName} wins`
      : broadcast.result === "0-1"
      ? `${broadcast.blackPlayerName} wins`
      : broadcast.result === "1/2-1/2"
      ? "Draw"
      : null;

  return (
    <Link href={`/live/board/${broadcast.publicSlug}`}>
      <div
        className={`group block rounded-2xl overflow-hidden border transition-all duration-200 hover:scale-[1.02] hover:shadow-xl cursor-pointer ${
          isDark
            ? "bg-[oklch(0.22_0.06_145)] border-white/08 hover:border-[oklch(0.55_0.14_145)/0.4]"
            : "bg-white border-[#EEEED2] hover:border-[#4D6940]/30 shadow-sm"
        }`}
      >
        {/* Board thumbnail */}
        <div className="relative">
          <div className="pointer-events-none select-none">
            <Chessboard
              options={{
                position: broadcast.currentFen,
                boardStyle: {
                  borderRadius: "0",
                  boxShadow: "none",
                },
                darkSquareStyle: {
                  backgroundColor: isDark ? "oklch(0.32 0.09 145)" : "#769656",
                },
                lightSquareStyle: {
                  backgroundColor: isDark ? "oklch(0.55 0.10 145 / 0.35)" : "#eeeed2",
                },
                animationDurationInMs: 150,
              }}
            />
          </div>

          {/* Live / status badge overlay */}
          <div className="absolute top-2 left-2">
            {isLive && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#4CAF50] text-white shadow-md">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                LIVE
              </span>
            )}
            {isEnded && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isDark ? "bg-white/10 text-white/60" : "bg-[#E8D9B0]/40 text-[#6B6B50]"}`}>
                ENDED
              </span>
            )}
            {broadcast.status === "paused" && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isDark ? "bg-yellow-400/20 text-yellow-300" : "bg-yellow-50 text-yellow-600"}`}>
                PAUSED
              </span>
            )}
          </div>

          {/* Board number badge */}
          <div className="absolute top-2 right-2">
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isDark ? "bg-black/40 text-white/70" : "bg-white/80 text-[#6B6B50]"}`}>
              Bd {broadcast.boardNumber}
            </span>
          </div>

          {/* Last move badge */}
          {broadcast.lastMoveSan && isLive && (
            <div className="absolute bottom-2 right-2">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${isDark ? "bg-black/50 text-[oklch(0.75_0.14_145)]" : "bg-white/90 text-[#4D6940]"}`}>
                {broadcast.moveNumber}. {broadcast.lastMoveSan}
              </span>
            </div>
          )}
        </div>

        {/* Player info footer */}
        <div className={`px-3 py-2.5 border-t ${isDark ? "border-white/06" : "border-[#EEEED2]"}`}>
          {/* White player */}
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className={`w-2.5 h-2.5 rounded-sm flex-shrink-0 ${isDark ? "bg-white/80" : "bg-white border border-[#E8D9B0]"}`} />
              <span className={`text-xs font-semibold truncate ${isDark ? "text-white/90" : "text-[#1A1A1A]"}`}>
                {broadcast.whitePlayerName}
              </span>
              {broadcast.whitePlayerElo && (
                <span className={`text-[10px] flex-shrink-0 ${isDark ? "text-white/35" : "text-[#6B6B50]"}`}>
                  {broadcast.whitePlayerElo}
                </span>
              )}
            </div>
            {broadcast.result === "1-0" && (
              <span className="text-[10px] font-bold text-[#4CAF50]">1</span>
            )}
            {broadcast.result === "1/2-1/2" && (
              <span className="text-[10px] font-bold text-yellow-400">½</span>
            )}
          </div>

          {/* Black player */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className={`w-2.5 h-2.5 rounded-sm flex-shrink-0 ${isDark ? "bg-[oklch(0.25_0.07_145)] border border-white/20" : "bg-[#1A1A1A]"}`} />
              <span className={`text-xs font-semibold truncate ${isDark ? "text-white/90" : "text-[#1A1A1A]"}`}>
                {broadcast.blackPlayerName}
              </span>
              {broadcast.blackPlayerElo && (
                <span className={`text-[10px] flex-shrink-0 ${isDark ? "text-white/35" : "text-[#6B6B50]"}`}>
                  {broadcast.blackPlayerElo}
                </span>
              )}
            </div>
            {broadcast.result === "0-1" && (
              <span className="text-[10px] font-bold text-[#4CAF50]">1</span>
            )}
            {broadcast.result === "1/2-1/2" && (
              <span className="text-[10px] font-bold text-yellow-400">½</span>
            )}
          </div>

          {/* Result label or move count */}
          <div className={`mt-2 pt-1.5 border-t flex items-center justify-between ${isDark ? "border-white/06" : "border-[#EEEED2]"}`}>
            {resultLabel ? (
              <span className={`text-[10px] font-semibold ${isDark ? "text-[oklch(0.65_0.14_145)]" : "text-[#4D6940]"}`}>
                {resultLabel}
              </span>
            ) : (
              <span className={`text-[10px] ${isDark ? "text-white/35" : "text-[#6B6B50]"}`}>
                {broadcast.moveNumber > 0 ? `Move ${broadcast.moveNumber}` : "Not started"}
              </span>
            )}
            <ChevronRight className={`w-3 h-3 flex-shrink-0 transition-transform group-hover:translate-x-0.5 ${isDark ? "text-white/25" : "text-[#6B6B50]/70"}`} />
          </div>
        </div>
      </div>
    </Link>
  );
}

// ─── Main section ──────────────────────────────────────────────────────────────
export function LiveBoardsSection({ tournamentId, isDark }: LiveBoardsSectionProps) {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBroadcasts = useCallback(async () => {
    try {
      const res = await fetch(`/api/broadcasts/tournament/${tournamentId}`);
      if (!res.ok) return;
      const data: Broadcast[] = await res.json();
      // Show all non-ended broadcasts first, then ended ones
      const sorted = [...data].sort((a, b) => {
        const order = { live: 0, paused: 1, ready: 2, ended: 3 };
        const ao = order[a.status as keyof typeof order] ?? 4;
        const bo = order[b.status as keyof typeof order] ?? 4;
        if (ao !== bo) return ao - bo;
        return a.boardNumber - b.boardNumber;
      });
      setBroadcasts(sorted);
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  // Initial fetch + polling every 8 s
  useEffect(() => {
    fetchBroadcasts();
    const interval = setInterval(fetchBroadcasts, 8000);
    return () => clearInterval(interval);
  }, [fetchBroadcasts]);

  // SSE subscription for instant updates when a move is pushed
  useEffect(() => {
    let es: EventSource | null = null;
    let retryTimeout: ReturnType<typeof setTimeout>;

    const connect = () => {
      es = new EventSource(`/api/sse?channel=tournament-${tournamentId}`);
      es.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (
            msg.type === "broadcast_move" ||
            msg.type === "broadcast_status" ||
            msg.type === "broadcast_created"
          ) {
            fetchBroadcasts();
          }
        } catch {
          // ignore malformed messages
        }
      };
      es.onerror = () => {
        es?.close();
        retryTimeout = setTimeout(connect, 5000);
      };
    };

    connect();
    return () => {
      es?.close();
      clearTimeout(retryTimeout);
    };
  }, [tournamentId, fetchBroadcasts]);

  // Don't render if no broadcasts at all
  if (!loading && broadcasts.length === 0) return null;

  const liveCount = broadcasts.filter((b) => b.status === "live").length;

  return (
    <div className={`rounded-2xl border overflow-hidden mb-6 ${isDark ? "bg-[oklch(0.20_0.06_145)] border-white/08" : "bg-[#F8FAF7] border-[#EEEED2]"}`}>
      {/* Section header */}
      <div className={`px-4 py-3 flex items-center justify-between border-b ${isDark ? "border-white/06" : "border-[#EEEED2]"}`}>
        <div className="flex items-center gap-2">
          <Radio className={`w-4 h-4 ${liveCount > 0 ? "text-[#4CAF50]" : isDark ? "text-white/40" : "text-[#6B6B50]"}`} />
          <span className={`text-sm font-bold ${isDark ? "text-white" : "text-[#1A1A1A]"}`}>
            Live Boards
          </span>
          {liveCount > 0 && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#4CAF50]/15 text-[#4CAF50]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#4CAF50] animate-pulse" />
              {liveCount} live
            </span>
          )}
        </div>
        <Link href={`/tournament/${tournamentId}/broadcasts`}>
          <div className={`flex items-center gap-1 text-xs font-medium transition-colors ${isDark ? "text-white/40 hover:text-white/70" : "text-[#6B6B50] hover:text-[#6B6B50]"}`}>
            View all
            <ExternalLink className="w-3 h-3" />
          </div>
        </Link>
      </div>

      {/* Board thumbnails grid */}
      <div className="p-3">
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={`rounded-2xl overflow-hidden animate-pulse ${isDark ? "bg-white/05" : "bg-[#E8D9B0]/40"}`}
                style={{ aspectRatio: "1 / 1.3" }}
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {broadcasts.map((b) => (
              <BoardCard key={b.id} broadcast={b} isDark={isDark} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
