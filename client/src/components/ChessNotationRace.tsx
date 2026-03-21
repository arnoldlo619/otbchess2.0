/**
 * BattleAmbientTicker
 *
 * A purely decorative, non-interactive component that renders an auto-scrolling
 * stream of chess notation in the background of the battle room. It adds visual
 * depth and atmosphere without interfering with the real OTB battle flow.
 *
 * Props are accepted for future extensibility (e.g. showing the actual game's
 * opening name) but the component never requires user input.
 */

import { motion } from "framer-motion";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RacePlayer {
  displayName: string;
  avatarUrl: string | null;
  chesscomUsername: string | null;
  chesscomElo: number | null;
}

// Props kept compatible with existing Battle.tsx usage so no call-site changes needed.
interface ChessNotationRaceProps {
  battleCode: string;
  hostPlayer: RacePlayer | null;
  guestPlayer: RacePlayer | null;
  isHost: boolean;
  opponentElo?: number | null;
}

// ─── Opening data ─────────────────────────────────────────────────────────────

const OPENINGS: { name: string; moves: string }[] = [
  { name: "Ruy López", moves: "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O h3 Na5 Bc2 c5 d4" },
  { name: "Queen's Gambit", moves: "d4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3 h6 Bh4 b6 cxd5 Nxd5 Bxe7 Qxe7" },
  { name: "Sicilian Defence", moves: "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be3 e5 Nb3 Be6 f3 Be7 Qd2 O-O" },
  { name: "King's Indian", moves: "d4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5 O-O Nc6 d5 Ne7 Ne1 Nd7" },
  { name: "French Defence", moves: "e4 e6 d4 d5 Nc3 Bb4 e5 c5 a3 Bxc3 bxc3 Ne7 Qg4 Qc7 Qxg7 Rg8 Qxh7 cxd4" },
  { name: "English Opening", moves: "c4 e5 Nc3 Nf6 Nf3 Nc6 g3 d5 cxd5 Nxd5 Bg2 Nb6 O-O Be7 d3 O-O Be3 f5" },
  { name: "Petrov Defence", moves: "e4 e5 Nf3 Nf6 Nxe5 d6 Nf3 Nxe4 d4 d5 Bd3 Nc6 O-O Be7 c4 Nb4 Be2 O-O" },
  { name: "Dutch Defence", moves: "d4 f5 g3 Nf6 Bg2 e6 Nf3 Be7 O-O O-O c4 d6 Nc3 Qe8 b3 a5 Ba3 Qh5" },
  { name: "Caro-Kann", moves: "e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5 Ng3 Bg6 h4 h6 Nf3 Nd7 h5 Bh7 Bd3 Bxd3" },
  { name: "Nimzo-Indian", moves: "d4 Nf6 c4 e6 Nc3 Bb4 e3 O-O Bd3 d5 Nf3 c5 O-O Nc6 a3 Bxc3 bxc3 dxc4" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Deterministically pick an opening based on the battle code. */
function pickOpening(battleCode: string): { name: string; moves: string } {
  let hash = 0;
  for (let i = 0; i < battleCode.length; i++) {
    hash = (hash * 31 + battleCode.charCodeAt(i)) >>> 0;
  }
  return OPENINGS[hash % OPENINGS.length];
}

/** Split a move string into individual tokens. */
function tokenize(moves: string): string[] {
  return moves.split(" ").filter(Boolean);
}

// ─── Ambient Ticker ───────────────────────────────────────────────────────────

/**
 * Renders a slow, looping horizontal ticker of chess move tokens.
 * Completely non-interactive — pointer-events-none, aria-hidden.
 */
function MoveTicker({ tokens }: { tokens: string[] }) {
  // Duplicate tokens so the loop appears seamless
  const doubled = [...tokens, ...tokens, ...tokens];

  return (
    <div
      className="w-full overflow-hidden pointer-events-none select-none"
      aria-hidden="true"
      style={{ maskImage: "linear-gradient(to right, transparent, black 12%, black 88%, transparent)" }}
    >
      <motion.div
        className="flex gap-4 whitespace-nowrap"
        animate={{ x: ["0%", "-33.333%"] }}
        transition={{ duration: 28, repeat: Infinity, ease: "linear" }}
      >
        {doubled.map((token, i) => (
          <span
            key={i}
            className="font-mono text-xs shrink-0"
            style={{
              color: i % 2 === 0
                ? "oklch(0.55 0.14 142 / 0.35)"
                : "oklch(0.65 0.04 240 / 0.20)",
              letterSpacing: "0.06em",
            }}
          >
            {token}
          </span>
        ))}
      </motion.div>
    </div>
  );
}

/**
 * Renders a slow vertical cascade of move tokens — like a matrix rain but with
 * chess notation. Purely decorative.
 */
function MoveColumn({ tokens, delay, speed }: { tokens: string[]; delay: number; speed: number }) {
  const doubled = [...tokens, ...tokens];
  return (
    <motion.div
      className="flex flex-col gap-3 pointer-events-none select-none"
      aria-hidden="true"
      animate={{ y: ["0%", "-50%"] }}
      transition={{ duration: speed, repeat: Infinity, ease: "linear", delay }}
    >
      {doubled.map((token, i) => (
        <span
          key={i}
          className="font-mono text-[11px] leading-none"
          style={{
            color: i % 3 === 0
              ? "oklch(0.55 0.18 142 / 0.28)"
              : i % 3 === 1
              ? "oklch(0.65 0.04 240 / 0.15)"
              : "oklch(0.75 0.12 80 / 0.12)",
            letterSpacing: "0.04em",
          }}
        >
          {token}
        </span>
      ))}
    </motion.div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export default function ChessNotationRace({
  battleCode,
}: ChessNotationRaceProps) {
  const opening = pickOpening(battleCode);
  const tokens = tokenize(opening.moves);

  // Stagger columns with different speeds for organic feel
  const columns = [
    { delay: 0,   speed: 18 },
    { delay: 2.5, speed: 22 },
    { delay: 1.2, speed: 15 },
    { delay: 3.8, speed: 25 },
    { delay: 0.7, speed: 20 },
  ];

  return (
    <div
      className="w-full max-w-3xl relative z-0 mt-10 pointer-events-none"
      aria-hidden="true"
    >
      {/* Opening name label — very subtle */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 1 }}
        className="flex items-center justify-center gap-2 mb-4"
      >
        <div
          className="h-px flex-1 max-w-[80px]"
          style={{ background: "linear-gradient(to right, transparent, oklch(0.45 0.12 142 / 0.25))" }}
        />
        <span
          className="text-[10px] font-mono uppercase tracking-[0.2em]"
          style={{ color: "oklch(0.55 0.12 142 / 0.35)" }}
        >
          {opening.name}
        </span>
        <div
          className="h-px flex-1 max-w-[80px]"
          style={{ background: "linear-gradient(to left, transparent, oklch(0.45 0.12 142 / 0.25))" }}
        />
      </motion.div>

      {/* Horizontal ticker row */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.4, duration: 1.2 }}
        className="mb-3"
      >
        <MoveTicker tokens={tokens} />
      </motion.div>

      {/* Vertical columns — matrix-style cascade */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.6, duration: 1.5 }}
        className="flex justify-center gap-8 h-24 overflow-hidden"
        style={{
          maskImage: "linear-gradient(to bottom, transparent, black 20%, black 80%, transparent)",
        }}
      >
        {columns.map((col, i) => (
          <MoveColumn
            key={i}
            tokens={tokens}
            delay={col.delay}
            speed={col.speed}
          />
        ))}
      </motion.div>

      {/* Second ticker row — slightly slower, reversed direction */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.8, duration: 1.2 }}
        className="mt-3"
      >
        <div
          className="w-full overflow-hidden pointer-events-none select-none"
          aria-hidden="true"
          style={{ maskImage: "linear-gradient(to right, transparent, black 12%, black 88%, transparent)" }}
        >
          <motion.div
            className="flex gap-4 whitespace-nowrap"
            animate={{ x: ["-33.333%", "0%"] }}
            transition={{ duration: 34, repeat: Infinity, ease: "linear" }}
          >
            {[...tokens, ...tokens, ...tokens].map((token, i) => (
              <span
                key={i}
                className="font-mono text-[10px] shrink-0"
                style={{
                  color: i % 2 === 0
                    ? "oklch(0.50 0.04 240 / 0.18)"
                    : "oklch(0.55 0.14 142 / 0.22)",
                  letterSpacing: "0.05em",
                }}
              >
                {token}
              </span>
            ))}
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
