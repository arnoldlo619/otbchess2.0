import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Keyboard, Zap, Target, ChevronRight, Wifi, WifiOff } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RacePlayer {
  displayName: string;
  avatarUrl: string | null;
  chesscomUsername: string | null;
  chesscomElo: number | null;
}

interface ChessNotationRaceProps {
  battleCode: string;       // e.g. "ABC123" — used to sync via API
  hostPlayer: RacePlayer | null;
  guestPlayer: RacePlayer | null;
  isHost: boolean;
  opponentElo?: number | null;
}

// Server-side race state shape (mirrors RacePlayerState in server/index.ts)
interface RemotePlayerState {
  moveIdx: number;
  wpm: number;
  finished: boolean;
  updatedAt: number;
  openingIdx: number;
}

interface RemoteRaceState {
  openingIdx: number;
  host: RemotePlayerState | null;
  guest: RemotePlayerState | null;
}

// ─── Chess move pools ─────────────────────────────────────────────────────────

const OPENINGS = [
  "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O",
  "d4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3 h6 Bh4 b6 cxd5 exd5",
  "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be3 e5 Nb3 Be6 f3 Be7",
  "d4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5 O-O Nc6 d5 Ne7",
  "e4 e6 d4 d5 Nc3 Bb4 e5 c5 a3 Bxc3 bxc3 Ne7 Qg4 Qc7 Qxg7 Rg8",
  "c4 e5 Nc3 Nf6 Nf3 Nc6 g3 d5 cxd5 Nxd5 Bg2 Nb6 O-O Be7 d3 O-O",
  "e4 e5 Nf3 Nf6 Nxe5 d6 Nf3 Nxe4 d4 d5 Bd3 Nc6 O-O Be7 c4 Nb4",
  "d4 f5 g3 Nf6 Bg2 e6 Nf3 Be7 O-O O-O c4 d6 Nc3 Qe8 b3 a5",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function avatarFallback(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function calcWpm(charsTyped: number, elapsedMs: number): number {
  if (elapsedMs < 1000) return 0;
  const minutes = elapsedMs / 60000;
  return Math.round(charsTyped / 4 / minutes);
}

function calcAccuracy(correct: number, total: number): number {
  if (total === 0) return 100;
  return Math.round((correct / total) * 100);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatBadge({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold"
      style={{
        background: accent
          ? "oklch(0.22 0.08 142 / 0.5)"
          : "oklch(0.16 0.03 240 / 0.6)",
        border: `1px solid ${accent ? "oklch(0.45 0.15 142 / 0.4)" : "oklch(0.35 0.03 240 / 0.3)"}`,
        color: accent ? "#4ade80" : "oklch(0.75 0.04 240)",
      }}
    >
      <span className="opacity-60">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function PlayerAvatar({ player, side }: { player: RacePlayer | null; side: "left" | "right" }) {
  const [imgError, setImgError] = useState(false);
  const name = player?.displayName ?? (side === "left" ? "You" : "Opponent");
  const avatarUrl = player?.avatarUrl;
  const showImg = avatarUrl && !imgError;

  return (
    <div className="flex items-center gap-2">
      {side === "right" && (
        <div className="text-right">
          <p className="text-white/80 text-sm font-semibold leading-tight">{name}</p>
          {player?.chesscomUsername && (
            <p className="text-white/30 text-xs font-mono">@{player.chesscomUsername}</p>
          )}
        </div>
      )}
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center overflow-hidden shrink-0 text-sm font-bold"
        style={{
          background: side === "left"
            ? "oklch(0.25 0.10 142 / 0.8)"
            : "oklch(0.22 0.04 240 / 0.8)",
          border: `1.5px solid ${side === "left" ? "oklch(0.45 0.15 142 / 0.5)" : "oklch(0.40 0.04 240 / 0.4)"}`,
          color: side === "left" ? "#4ade80" : "#94a3b8",
        }}
      >
        {showImg ? (
          <img
            src={avatarUrl}
            alt={name}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          avatarFallback(name)
        )}
      </div>
      {side === "left" && (
        <div>
          <p className="text-white/80 text-sm font-semibold leading-tight">{name}</p>
          {player?.chesscomUsername && (
            <p className="text-white/30 text-xs font-mono">@{player.chesscomUsername}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Move display with character-level highlighting ───────────────────────────

function MoveDisplay({
  moves,
  typedSoFar,
  currentMoveIdx,
}: {
  moves: string[];
  typedSoFar: string;
  currentMoveIdx: number;
}) {
  const fullText = moves.join(" ");
  const committedChars = moves.slice(0, currentMoveIdx).join(" ").length + (currentMoveIdx > 0 ? 1 : 0);

  return (
    <div
      className="font-mono text-lg leading-relaxed tracking-wide select-none"
      style={{ letterSpacing: "0.04em" }}
    >
      {fullText.split("").map((char, i) => {
        let color: string;
        if (i < committedChars) {
          color = "#4ade80";
        } else if (i < committedChars + typedSoFar.length) {
          const typedChar = typedSoFar[i - committedChars];
          color = typedChar === char ? "#4ade80" : "#f87171";
        } else if (i === committedChars + typedSoFar.length) {
          color = "#ffffff";
        } else {
          color = "oklch(0.65 0.04 240 / 0.5)";
        }
        return (
          <span key={i} style={{ color, transition: "color 0.1s" }}>
            {char}
          </span>
        );
      })}
    </div>
  );
}

// ─── Opponent real-time progress display ─────────────────────────────────────

function OpponentMoveDisplay({
  moves,
  completedMoves,
  opponentWpm,
}: {
  moves: string[];
  completedMoves: number;
  opponentWpm: number;
}) {
  const fullText = moves.join(" ");
  const committedChars =
    moves.slice(0, completedMoves).join(" ").length + (completedMoves > 0 ? 1 : 0);

  return (
    <div
      className="font-mono text-lg leading-relaxed tracking-wide select-none"
      style={{ letterSpacing: "0.04em" }}
    >
      {fullText.split("").map((char, i) => {
        let color: string;
        if (i < committedChars) {
          color = "oklch(0.75 0.12 80)"; // amber for opponent
        } else if (i === committedChars) {
          color = "oklch(0.85 0.14 80)"; // cursor
        } else {
          color = "oklch(0.65 0.04 240 / 0.4)";
        }
        return (
          <span key={i} style={{ color, transition: "color 0.15s" }}>
            {char}
          </span>
        );
      })}
      {opponentWpm > 0 && (
        <span className="ml-2 text-[10px] font-mono opacity-40">
          {opponentWpm} WPM
        </span>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ChessNotationRace({
  battleCode,
  hostPlayer,
  guestPlayer,
  isHost,
}: ChessNotationRaceProps) {
  // ── Opening sequence — determined by server on first GET /race ────────────
  const [openingIdx, setOpeningIdx] = useState<number | null>(null);
  const moves = openingIdx !== null ? OPENINGS[openingIdx].split(" ") : [];

  // ── My typing state ───────────────────────────────────────────────────────
  const [typedSoFar, setTypedSoFar] = useState("");
  const [currentMoveIdx, setCurrentMoveIdx] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [totalKeystrokes, setTotalKeystrokes] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [finished, setFinished] = useState(false);

  // ── Opponent real-time state ──────────────────────────────────────────────
  const [opponentMoveIdx, setOpponentMoveIdx] = useState(0);
  const [opponentWpm, setOpponentWpm] = useState(0);
  const [opponentFinished, setOpponentFinished] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"connecting" | "live" | "offline">("connecting");

  const inputRef = useRef<HTMLInputElement>(null);
  const lastPushedMoveIdx = useRef(-1);

  // ── Focus input on mount ──────────────────────────────────────────────────
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // ── Elapsed timer ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!startTime || finished) return;
    const id = setInterval(() => setElapsedMs(Date.now() - startTime), 200);
    return () => clearInterval(id);
  }, [startTime, finished]);

  // ── Fetch race state from server (poll every 800ms) ───────────────────────
  useEffect(() => {
    if (!battleCode) return;

    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/battles/${battleCode}/race`);
        if (!res.ok) throw new Error("non-ok");
        const data: RemoteRaceState = await res.json();
        if (cancelled) return;

        // On first successful fetch, lock in the opening sequence
        setOpeningIdx((prev) => (prev === null ? data.openingIdx : prev));
        setSyncStatus("live");

        // Update opponent state
        const opp = isHost ? data.guest : data.host;
        if (opp) {
          setOpponentMoveIdx(opp.moveIdx);
          setOpponentWpm(opp.wpm);
          setOpponentFinished(opp.finished);
        }
      } catch {
        if (!cancelled) setSyncStatus("offline");
      }
    }

    // Initial fetch immediately
    poll();
    const id = setInterval(poll, 800);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [battleCode, isHost]);

  // ── Push my progress to server whenever moveIdx changes ──────────────────
  const pushProgress = useCallback(
    async (moveIdx: number, wpm: number, isFinished: boolean) => {
      if (!battleCode) return;
      try {
        await fetch(`/api/battles/${battleCode}/race`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ moveIdx, wpm, finished: isFinished }),
        });
      } catch {
        // silently ignore push errors — poll will catch up
      }
    },
    [battleCode]
  );

  // ── Derived stats ─────────────────────────────────────────────────────────
  const wpm = calcWpm(
    moves.slice(0, currentMoveIdx).join(" ").length + typedSoFar.length,
    elapsedMs
  );
  const accuracy = calcAccuracy(totalKeystrokes - errorCount, totalKeystrokes);
  const myProgress = moves.length > 0 ? (currentMoveIdx / moves.length) * 100 : 0;
  const opponentProgress = moves.length > 0 ? (opponentMoveIdx / moves.length) * 100 : 0;

  const myPlayer = isHost ? hostPlayer : guestPlayer;
  const oppPlayer = isHost ? guestPlayer : hostPlayer;

  // ── Input handler ─────────────────────────────────────────────────────────
  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      if (finished || currentMoveIdx >= moves.length || moves.length === 0) return;

      if (!startTime) setStartTime(Date.now());

      const targetMove = moves[currentMoveIdx];
      setTotalKeystrokes((t) => t + 1);

      if (val.endsWith(" ")) {
        const typed = val.trimEnd();
        if (typed === targetMove) {
          const nextIdx = currentMoveIdx + 1;
          setCurrentMoveIdx(nextIdx);
          setTypedSoFar("");
          e.target.value = "";
          const isFinished = nextIdx >= moves.length;
          if (isFinished) {
            setFinished(true);
            setElapsedMs(Date.now() - (startTime ?? Date.now()));
          }
          // Push to server on every move commit (debounced by only pushing when idx changes)
          if (nextIdx !== lastPushedMoveIdx.current) {
            lastPushedMoveIdx.current = nextIdx;
            const newWpm = calcWpm(
              moves.slice(0, nextIdx).join(" ").length,
              startTime ? Date.now() - startTime : 0
            );
            pushProgress(nextIdx, newWpm, isFinished);
          }
        } else {
          setErrorCount((c) => c + 1);
          setTypedSoFar(typed);
          e.target.value = typed;
        }
        return;
      }

      const prevTyped = typedSoFar;
      if (val.length > prevTyped.length) {
        const newChar = val[val.length - 1];
        const expectedChar = targetMove[val.length - 1];
        if (newChar !== expectedChar) {
          setErrorCount((c) => c + 1);
        }
      }

      setTypedSoFar(val);
    },
    [currentMoveIdx, moves, startTime, typedSoFar, finished, pushProgress]
  );

  // ── Loading state while opening is being fetched ──────────────────────────
  if (openingIdx === null) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9, duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-3xl relative z-10 mt-2"
      >
        <div
          className="rounded-2xl px-6 py-8 flex items-center justify-center gap-3"
          style={{
            background: "oklch(0.12 0.03 240 / 0.85)",
            border: "1px solid oklch(0.30 0.04 240 / 0.4)",
            backdropFilter: "blur(12px)",
          }}
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
            className="w-4 h-4 rounded-full border-2 border-green-400/30 border-t-green-400"
          />
          <span className="text-white/40 text-sm font-mono">Syncing race…</span>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.9, duration: 0.5, ease: "easeOut" }}
      className="w-full max-w-3xl relative z-10 mt-2"
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <Keyboard className="w-3.5 h-3.5 text-green-400/70" />
          <span className="text-white/40 text-xs font-mono uppercase tracking-widest">
            Notation Race
          </span>
          {/* Sync status indicator */}
          <div className="flex items-center gap-1">
            {syncStatus === "live" ? (
              <Wifi className="w-3 h-3 text-green-400/60" />
            ) : syncStatus === "offline" ? (
              <WifiOff className="w-3 h-3 text-red-400/60" />
            ) : (
              <motion.div
                animate={{ opacity: [0.3, 0.8, 0.3] }}
                transition={{ duration: 1.2, repeat: Infinity }}
              >
                <Wifi className="w-3 h-3 text-white/30" />
              </motion.div>
            )}
            <span
              className="text-[10px] font-mono"
              style={{
                color:
                  syncStatus === "live"
                    ? "oklch(0.65 0.15 142 / 0.7)"
                    : syncStatus === "offline"
                    ? "oklch(0.65 0.15 25 / 0.7)"
                    : "oklch(0.65 0.04 240 / 0.5)",
              }}
            >
              {syncStatus === "live" ? "live" : syncStatus === "offline" ? "offline" : "…"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatBadge label="WPM" value={String(wpm)} accent />
          <StatBadge label="ACC" value={`${accuracy}%`} accent />
        </div>
      </div>

      {/* Two-panel race area */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: "oklch(0.12 0.03 240 / 0.85)",
          border: "1px solid oklch(0.30 0.04 240 / 0.4)",
          backdropFilter: "blur(12px)",
        }}
      >
        {/* Player header row */}
        <div
          className="grid grid-cols-2 divide-x divide-white/10"
          style={{ borderBottom: "1px solid oklch(0.25 0.04 240 / 0.4)" }}
        >
          {/* You */}
          <div className="flex items-center justify-between px-4 py-3">
            <PlayerAvatar player={myPlayer} side="left" />
            <div
              className="text-[10px] font-mono font-bold px-2 py-0.5 rounded"
              style={{
                background: "oklch(0.22 0.08 142 / 0.4)",
                color: "#4ade80",
                border: "1px solid oklch(0.40 0.12 142 / 0.3)",
              }}
            >
              YOU
            </div>
          </div>
          {/* Opponent */}
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <div
                className="text-[10px] font-mono font-bold px-2 py-0.5 rounded"
                style={{
                  background: "oklch(0.20 0.05 80 / 0.4)",
                  color: "oklch(0.75 0.12 80)",
                  border: "1px solid oklch(0.40 0.08 80 / 0.3)",
                }}
              >
                OPP
              </div>
              {/* Live dot when opponent is active */}
              {opponentMoveIdx > 0 && !opponentFinished && (
                <motion.span
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 1.2, repeat: Infinity }}
                  className="w-1.5 h-1.5 rounded-full bg-amber-400"
                />
              )}
              {opponentFinished && (
                <span className="text-[10px] font-mono text-amber-400/70">Done</span>
              )}
            </div>
            <PlayerAvatar player={oppPlayer} side="right" />
          </div>
        </div>

        {/* Move text panels */}
        <div className="grid grid-cols-2 divide-x divide-white/10">
          {/* Your panel */}
          <div className="p-4 min-h-[120px] relative">
            <div className="text-[10px] font-mono text-white/25 uppercase tracking-widest mb-3">
              Round 1
            </div>
            <MoveDisplay
              moves={moves}
              typedSoFar={typedSoFar}
              currentMoveIdx={currentMoveIdx}
            />
            {/* Progress */}
            <div className="flex items-center gap-2 mt-4">
              <span className="text-[10px] font-mono text-white/30">{Math.round(myProgress)}%</span>
              <div className="flex-1 h-0.5 rounded-full" style={{ background: "oklch(0.25 0.04 240 / 0.4)" }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: "oklch(0.55 0.18 142)", width: `${myProgress}%` }}
                  transition={{ duration: 0.15 }}
                />
              </div>
            </div>
          </div>

          {/* Opponent panel */}
          <div className="p-4 min-h-[120px] relative">
            <div className="text-[10px] font-mono text-white/25 uppercase tracking-widest mb-3">
              Round 1
            </div>
            <OpponentMoveDisplay
              moves={moves}
              completedMoves={opponentMoveIdx}
              opponentWpm={opponentWpm}
            />
            {/* Progress */}
            <div className="flex items-center gap-2 mt-4">
              <span className="text-[10px] font-mono text-white/30">{Math.round(opponentProgress)}%</span>
              <div className="flex-1 h-0.5 rounded-full" style={{ background: "oklch(0.25 0.04 240 / 0.4)" }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: "oklch(0.75 0.12 80)", width: `${opponentProgress}%` }}
                  transition={{ duration: 0.15 }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Input row */}
        <div
          className="flex items-center gap-3 px-4 py-3"
          style={{ borderTop: "1px solid oklch(0.25 0.04 240 / 0.4)" }}
        >
          <ChevronRight className="w-3.5 h-3.5 text-green-400/60 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            onChange={handleInput}
            disabled={finished || moves.length === 0}
            placeholder={finished ? "Race complete!" : "Type the next move…"}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            className="flex-1 bg-transparent outline-none font-mono text-sm placeholder:text-white/20"
            style={{ color: "#4ade80", caretColor: "#4ade80" }}
          />
          {finished && (
            <div className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-yellow-400" />
              <span className="text-yellow-400 text-xs font-mono font-bold">Done!</span>
            </div>
          )}
          {!finished && moves.length > 0 && (
            <div className="flex items-center gap-1 text-white/20 text-[10px] font-mono">
              <Target className="w-3 h-3" />
              <span>{moves[currentMoveIdx] ?? "—"}</span>
            </div>
          )}
        </div>
      </div>

      {/* Finished state overlay */}
      {finished && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mt-3 rounded-xl px-4 py-3 flex items-center justify-between"
          style={{
            background: "oklch(0.20 0.08 142 / 0.5)",
            border: "1px solid oklch(0.45 0.15 142 / 0.4)",
          }}
        >
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-yellow-400" />
            <span className="text-green-400 font-bold text-sm">Notation complete!</span>
          </div>
          <div className="flex items-center gap-3">
            <StatBadge label="WPM" value={String(wpm)} accent />
            <StatBadge label="ACC" value={`${accuracy}%`} accent />
          </div>
        </motion.div>
      )}

      {/* Opponent finished banner */}
      {opponentFinished && !finished && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 rounded-xl px-4 py-2.5 flex items-center gap-2"
          style={{
            background: "oklch(0.18 0.05 80 / 0.5)",
            border: "1px solid oklch(0.40 0.08 80 / 0.4)",
          }}
        >
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-amber-400/80 text-xs font-mono">
            {(isHost ? guestPlayer : hostPlayer)?.displayName ?? "Opponent"} finished — keep going!
          </span>
        </motion.div>
      )}
    </motion.div>
  );
}
