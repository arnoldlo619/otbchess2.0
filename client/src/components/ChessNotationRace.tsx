import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Keyboard, Zap, Target, ChevronRight } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RacePlayer {
  displayName: string;
  avatarUrl: string | null;
  chesscomUsername: string | null;
  chesscomElo: number | null;
}

interface ChessNotationRaceProps {
  hostPlayer: RacePlayer | null;
  guestPlayer: RacePlayer | null;
  isHost: boolean;
  opponentElo?: number | null;
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

function generateMoveSequence(): string[] {
  const opening = OPENINGS[Math.floor(Math.random() * OPENINGS.length)];
  return opening.split(" ");
}

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
  // Average word = 5 chars; chess moves avg ~3 chars + space = 4
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
  // Build a flat string of "move1 move2 move3 ..."
  const fullText = moves.join(" ");
  // How many chars have been correctly committed (completed moves)
  const committedChars = moves.slice(0, currentMoveIdx).join(" ").length + (currentMoveIdx > 0 ? 1 : 0);

  return (
    <div
      className="font-mono text-lg leading-relaxed tracking-wide select-none"
      style={{ letterSpacing: "0.04em" }}
    >
      {fullText.split("").map((char, i) => {
        let color: string;
        if (i < committedChars) {
          // Already completed move — green
          color = "#4ade80";
        } else if (i < committedChars + typedSoFar.length) {
          // Currently being typed
          const typedChar = typedSoFar[i - committedChars];
          color = typedChar === char ? "#4ade80" : "#f87171";
        } else if (i === committedChars + typedSoFar.length) {
          // Cursor position — bright white
          color = "#ffffff";
        } else {
          // Untyped — dim
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

// ─── Opponent simulated progress display ─────────────────────────────────────

function OpponentMoveDisplay({
  moves,
  completedMoves,
  partialProgress,
}: {
  moves: string[];
  completedMoves: number;
  partialProgress: number; // 0-1 fraction through current move
}) {
  const fullText = moves.join(" ");
  const committedChars = moves.slice(0, completedMoves).join(" ").length + (completedMoves > 0 ? 1 : 0);
  const currentMoveLen = moves[completedMoves]?.length ?? 0;
  const partialChars = Math.floor(partialProgress * currentMoveLen);

  return (
    <div
      className="font-mono text-lg leading-relaxed tracking-wide select-none"
      style={{ letterSpacing: "0.04em" }}
    >
      {fullText.split("").map((char, i) => {
        let color: string;
        if (i < committedChars) {
          color = "oklch(0.75 0.12 80)"; // amber for opponent
        } else if (i < committedChars + partialChars) {
          color = "oklch(0.75 0.12 80 / 0.7)";
        } else if (i === committedChars + partialChars) {
          color = "oklch(0.85 0.14 80)";
        } else {
          color = "oklch(0.65 0.04 240 / 0.4)";
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

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ChessNotationRace({
  hostPlayer,
  guestPlayer,
  isHost,
}: ChessNotationRaceProps) {
  const [moves] = useState<string[]>(() => generateMoveSequence());
  const [typedSoFar, setTypedSoFar] = useState(""); // current move being typed
  const [currentMoveIdx, setCurrentMoveIdx] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [totalKeystrokes, setTotalKeystrokes] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [finished, setFinished] = useState(false);

  // Opponent simulation
  const [opponentMoveIdx, setOpponentMoveIdx] = useState(0);
  const [opponentPartial, setOpponentPartial] = useState(0);
  const opponentIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Elapsed timer
  useEffect(() => {
    if (!startTime || finished) return;
    const id = setInterval(() => setElapsedMs(Date.now() - startTime), 200);
    return () => clearInterval(id);
  }, [startTime, finished]);

  // Opponent simulation — advances at ~30 WPM (avg chess move ~3 chars → ~10 moves/min)
  useEffect(() => {
    if (finished) {
      if (opponentIntervalRef.current) clearInterval(opponentIntervalRef.current);
      return;
    }
    // Tick every 400ms, advance partial progress
    opponentIntervalRef.current = setInterval(() => {
      setOpponentPartial((prev) => {
        const next = prev + 0.18; // fraction per tick
        if (next >= 1) {
          setOpponentMoveIdx((mi) => {
            const nextMi = mi + 1;
            if (nextMi >= moves.length) {
              if (opponentIntervalRef.current) clearInterval(opponentIntervalRef.current);
            }
            return Math.min(nextMi, moves.length);
          });
          return 0;
        }
        return next;
      });
    }, 400);
    return () => {
      if (opponentIntervalRef.current) clearInterval(opponentIntervalRef.current);
    };
  }, [moves.length, finished]);

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      if (finished || currentMoveIdx >= moves.length) return;

      // Start timer on first keystroke
      if (!startTime) setStartTime(Date.now());

      const targetMove = moves[currentMoveIdx];
      setTotalKeystrokes((t) => t + 1);

      // Check for space — attempt to commit current move
      if (val.endsWith(" ")) {
        const typed = val.trimEnd();
        if (typed === targetMove) {
          // Correct — advance
          const nextIdx = currentMoveIdx + 1;
          setCurrentMoveIdx(nextIdx);
          setTypedSoFar("");
          e.target.value = "";
          if (nextIdx >= moves.length) {
            setFinished(true);
            setElapsedMs(Date.now() - (startTime ?? Date.now()));
          }
        } else {
          // Wrong — count error, keep typed
          setErrorCount((c) => c + 1);
          setTypedSoFar(typed);
          e.target.value = typed;
        }
        return;
      }

      // Validate partial typing — count errors for wrong chars
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
    [currentMoveIdx, moves, startTime, typedSoFar, finished]
  );

  const wpm = calcWpm(
    moves.slice(0, currentMoveIdx).join(" ").length + typedSoFar.length,
    elapsedMs
  );
  const accuracy = calcAccuracy(totalKeystrokes - errorCount, totalKeystrokes);
  const myProgress = moves.length > 0 ? (currentMoveIdx / moves.length) * 100 : 0;
  const opponentProgress = moves.length > 0 ? (opponentMoveIdx / moves.length) * 100 : 0;

  const myPlayer = isHost ? hostPlayer : guestPlayer;
  const oppPlayer = isHost ? guestPlayer : hostPlayer;

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
              partialProgress={opponentPartial}
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
            disabled={finished}
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
          {!finished && (
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
    </motion.div>
  );
}
