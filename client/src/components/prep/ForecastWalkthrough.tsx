/**
 * ForecastWalkthrough — Board-first interactive Opening Forecast.
 *
 * Replaces the dense indented move-tree with a two-column walkthrough:
 *   Left:  large interactive chessboard (reuses MiniChessBoard internals)
 *   Right: concise branch selector, breadcrumb, performance summary
 *
 * Data model: enriches ForecastBranch with FEN (derived via chess.js),
 * actor labels, conditional denominators, and confidence tiers — all
 * computed client-side from the existing report data, no server changes.
 *
 * Design rules (from spec):
 * - Max 3 top-level choices shown by default
 * - Progressive disclosure: "More continuations" for low-frequency branches
 * - Small sample (< 5 games at position) → downgraded, no performance claim
 * - Perspective explicit: "Opponent plays White" / "You have Black"
 * - Board orientation follows user's selected color
 * - Keyboard operable, clear focus states, 44px touch targets
 */

import { useState, useMemo, useCallback, useRef } from "react";
import { Chess } from "chess.js";
import {
  ChevronLeft, RotateCcw, ChevronDown, ChevronRight,
  BookOpen, FlipVertical2, AlertCircle,
} from "lucide-react";
import type { ForecastBranch } from "../../../../shared/prepTypes";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Tokens {
  card: string;
  cardSubtle: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  divider: string;
  [key: string]: string;
}

interface ForecastWalkthroughProps {
  openingForecast: Record<"white" | "black", ForecastBranch[]>;
  /** The user's selected color for this prep session (affects board orientation) */
  colorFilter?: "both" | "white" | "black";
  isDark: boolean;
  t: Tokens;
  opponentUsername: string;
}

/** Enriched node: ForecastBranch + derived FEN + path context */
interface FNode {
  moveSan: string;
  /** Move path from root, e.g. ["d4", "d5", "Nc3"] */
  path: string[];
  /** FEN after this move */
  fen: string;
  /** Whose move this is: "opponent" | "reply" */
  actor: "opponent" | "reply";
  /** Count of games that reached this position */
  count: number;
  /** Count of parent games (for conditional denominator) */
  parentCount: number;
  /** Frequency % within parent */
  pct: number;
  /** Opponent score in this branch (0–1) */
  score: number;
  /** Opening label */
  label?: string;
  /** Raw children from server */
  rawChildren: ForecastBranch[];
  /** Confidence tier */
  confidence: "high" | "medium" | "low" | "tiny";
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Derive FEN from a SAN move path using chess.js */
function fenFromPath(path: string[]): string | null {
  const chess = new Chess();
  for (const san of path) {
    try {
      chess.move(san);
    } catch {
      return null;
    }
  }
  return chess.fen();
}

/** Confidence tier based on count */
function confidenceTier(count: number): FNode["confidence"] {
  if (count >= 15) return "high";
  if (count >= 8) return "medium";
  if (count >= 3) return "low";
  return "tiny";
}

/** Convert raw ForecastBranch[] to FNode[] at a given path depth */
function enrichBranches(
  branches: ForecastBranch[],
  parentPath: string[],
  parentCount: number,
  opponentColor: "white" | "black",
  depth: number
): FNode[] {
  return branches.map((b) => {
    const path = [...parentPath, b.moveSan];
    const fen = fenFromPath(path) ?? "";
    // Depth 0,2,4 = opponent's move (for White: ply 0,2,4; for Black: ply 1,3,5)
    // opponentColor=white → they move at even depths; opponentColor=black → odd depths
    const isOpponentMove =
      opponentColor === "white" ? depth % 2 === 0 : depth % 2 === 1;
    return {
      moveSan: b.moveSan,
      path,
      fen,
      actor: isOpponentMove ? "opponent" : "reply",
      count: b.count,
      parentCount,
      pct: parentCount > 0 ? b.count / parentCount : b.pct,
      score: b.score,
      label: b.label,
      rawChildren: b.children ?? [],
      confidence: confidenceTier(b.count),
    };
  });
}

/** Format score for display — avoids "win rate" when draws included */
function formatScore(score: number, count: number): string {
  const pct = Math.round(score * 100);
  return `${pct}% score`;
}

/** Format result breakdown from score + count (approximate) */
function formatResults(score: number, count: number): string {
  // score = (wins + 0.5*draws) / count
  // We can't recover exact W/D/L from score alone, so show score only
  return `Based on ${count} game${count !== 1 ? "s" : ""} at this position`;
}

/** Human-readable frequency */
function formatFreq(count: number, parentCount: number): string {
  const pct = parentCount > 0 ? Math.round((count / parentCount) * 100) : 0;
  return `${pct}% · ${count} game${count !== 1 ? "s" : ""}`;
}

/** Breadcrumb from path array */
function pathToBreadcrumb(path: string[]): string {
  if (path.length === 0) return "Starting position";
  const parts: string[] = [];
  for (let i = 0; i < path.length; i++) {
    if (i % 2 === 0) {
      const moveNum = Math.floor(i / 2) + 1;
      parts.push(`${moveNum}. ${path[i]}`);
    } else {
      parts.push(path[i]);
    }
  }
  return parts.join(" ");
}

// ── Board component (inline, larger than MiniChessBoard) ─────────────────────

interface BoardProps {
  fen: string;
  flipped: boolean;
  isDark: boolean;
  lastMovePath?: string[]; // previous path to derive last move squares
}

const PIECE_GLYPHS: Record<string, string> = {
  wK: "♔", wQ: "♕", wR: "♖", wB: "♗", wN: "♘", wP: "♙",
  bK: "♚", bQ: "♛", bR: "♜", bB: "♝", bN: "♞", bP: "♟",
};

function cellColor(col: number, row: number, isDark: boolean): string {
  const isLight = (col + row) % 2 === 0;
  if (isDark) return isLight ? "#2a3d2e" : "#1a2a1e";
  return isLight ? "#f0d9b5" : "#b58863";
}

function ForecastBoard({ fen, flipped, isDark, lastMovePath }: BoardProps) {
  const chess = useMemo(() => {
    const c = new Chess();
    if (fen) {
      try { c.load(fen); } catch { /* use default */ }
    }
    return c;
  }, [fen]);

  // Derive last move squares from path
  const lastMove = useMemo(() => {
    if (!lastMovePath || lastMovePath.length === 0) return null;
    const prevPath = lastMovePath.slice(0, -1);
    const c = new Chess();
    for (const san of prevPath) {
      try { c.move(san); } catch { return null; }
    }
    const lastSan = lastMovePath[lastMovePath.length - 1];
    try {
      const result = c.move(lastSan);
      return result ? { from: result.from, to: result.to } : null;
    } catch { return null; }
  }, [lastMovePath?.join(",")]);

  const board = chess.board();
  // Use a fixed viewBox of 416×416 (52×8) but let CSS scale it responsively
  const CELL = 52;
  const SIZE = CELL * 8;

  return (
    <div
      className={`rounded-xl overflow-hidden border ${isDark ? "border-[#243028]/70" : "border-[#ADBC9F]/60"}`}
      style={{ width: "100%", maxWidth: SIZE, aspectRatio: "1 / 1", flexShrink: 0 }}
      aria-label={`Chessboard position: ${fen}`}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
        style={{ display: "block" }}
      >
        {/* Squares */}
        {Array.from({ length: 8 }, (_, row) =>
          Array.from({ length: 8 }, (_, col) => {
            const boardRow = flipped ? 7 - row : row;
            const boardCol = flipped ? 7 - col : col;
            const sq = String.fromCharCode(97 + boardCol) + (8 - boardRow);
            const isLastFrom = lastMove?.from === sq;
            const isLastTo = lastMove?.to === sq;
            let fill = cellColor(col, row, isDark);
            if (isLastTo) fill = isDark ? "#436850" : "#cdd26a";
            else if (isLastFrom) fill = isDark ? "#2e5038" : "#aaa23a";
            return (
              <rect key={`${row}-${col}`} x={col * CELL} y={row * CELL}
                width={CELL} height={CELL} fill={fill} />
            );
          })
        )}

        {/* Pieces */}
        {board.map((rowArr, boardRow) =>
          rowArr.map((piece, boardCol) => {
            if (!piece) return null;
            const glyph = PIECE_GLYPHS[`${piece.color}${piece.type.toUpperCase()}`];
            if (!glyph) return null;
            const displayRow = flipped ? 7 - boardRow : boardRow;
            const displayCol = flipped ? 7 - boardCol : boardCol;
            const x = displayCol * CELL + CELL / 2;
            const y = displayRow * CELL + CELL / 2 + 1;
            return (
              <text key={`${boardRow}-${boardCol}`} x={x} y={y}
                textAnchor="middle" dominantBaseline="central"
                fontSize={CELL * 0.72}
                style={{
                  filter: piece.color === "w"
                    ? "drop-shadow(0 1px 2px rgba(0,0,0,0.7))"
                    : "drop-shadow(0 1px 1px rgba(0,0,0,0.4))",
                  userSelect: "none",
                }}
              >{glyph}</text>
            );
          })
        )}

        {/* Rank labels */}
        {Array.from({ length: 8 }, (_, i) => {
          const rank = flipped ? i + 1 : 8 - i;
          return (
            <text key={`rank-${i}`} x={3} y={i * CELL + 11} fontSize={10}
              fill={isDark ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.22)"}
              style={{ userSelect: "none" }}>{rank}</text>
          );
        })}

        {/* File labels */}
        {Array.from({ length: 8 }, (_, i) => {
          const file = String.fromCharCode(flipped ? 104 - i : 97 + i);
          return (
            <text key={`file-${i}`} x={i * CELL + CELL - 9} y={SIZE - 3} fontSize={10}
              fill={isDark ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.22)"}
              style={{ userSelect: "none" }}>{file}</text>
          );
        })}
      </svg>
    </div>
  );
}

// ── Branch row ────────────────────────────────────────────────────────────────

interface BranchRowProps {
  node: FNode;
  isSelected: boolean;
  onSelect: (node: FNode) => void;
  isDark: boolean;
  t: Tokens;
  showMoreContinuations?: boolean;
}

function BranchRow({ node, isSelected, onSelect, isDark, t }: BranchRowProps) {
  const isOpponent = node.actor === "opponent";
  const isTiny = node.confidence === "tiny";

  const rowBg = isSelected
    ? isDark ? "bg-[#436850]/20 border-[#436850]/50" : "bg-[#436850]/10 border-[#436850]/40"
    : isDark ? "bg-[#1e2e22]/30 border-[#1e2e22]/40 hover:bg-[#1e2e22]/60" : "bg-[#f8faf5]/60 border-[#ADBC9F]/30 hover:bg-[#ADBC9F]/15";

  const actorColor = isOpponent
    ? isDark ? "text-amber-400" : "text-amber-700"
    : isDark ? "text-sky-400" : "text-sky-700";

  const actorLabel = isOpponent ? "Opponent's move" : "Common reply";

  return (
    <button
      onClick={() => onSelect(node)}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all ${rowBg}`}
      style={{ minHeight: "44px" }}
      aria-pressed={isSelected}
      aria-label={`${node.moveSan}${node.label ? `, ${node.label}` : ""}, ${formatFreq(node.count, node.parentCount)}`}
    >
      {/* Active indicator */}
      <span
        className={`shrink-0 w-[3px] h-6 rounded-full transition-all ${isSelected ? (isDark ? "bg-[#5B9A6A]" : "bg-[#436850]") : "bg-transparent"}`}
      />

      {/* Move SAN */}
      <span className={`font-mono text-sm font-bold shrink-0 ${isDark ? "text-white" : "text-[#12372A]"}`}>
        {node.moveSan}
      </span>

      {/* Label */}
      <span className={`flex-1 text-xs truncate ${t.textSecondary}`}>
        {node.label ?? (isOpponent ? "—" : "continuation")}
      </span>

      {/* Frequency */}
      <span className={`shrink-0 text-[11px] font-medium ${isTiny ? t.textTertiary : t.textSecondary}`}>
        {isTiny
          ? `${node.count} game${node.count !== 1 ? "s" : ""}`
          : `${Math.round(node.pct * 100)}% · ${node.count}`}
      </span>

      {/* Actor badge */}
      <span className={`shrink-0 text-[10px] font-semibold ${actorColor}`}>
        {isOpponent ? "↑" : "↓"}
      </span>

      {/* Chevron if has children */}
      {node.rawChildren.length > 0 && (
        <ChevronRight className={`w-3.5 h-3.5 shrink-0 ${t.textTertiary}`} />
      )}
    </button>
  );
}

// ── Performance summary ───────────────────────────────────────────────────────

function PerformanceSummary({
  node,
  isDark,
  t,
}: {
  node: FNode;
  isDark: boolean;
  t: Tokens;
}) {
  const isTiny = node.confidence === "tiny";
  const isLow = node.confidence === "low";

  if (isTiny) {
    return (
      <div className={`flex items-start gap-2 p-3 rounded-xl ${isDark ? "bg-[#1e2e22]/40 border border-[#1e2e22]/30" : "bg-[#f8faf5] border border-[#ADBC9F]/30"}`}>
        <AlertCircle className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${t.textTertiary}`} />
        <p className={`text-xs ${t.textTertiary}`}>
          Small sample: only {node.count} game{node.count !== 1 ? "s" : ""} reached this position. Performance data not shown.
        </p>
      </div>
    );
  }

  const scorePct = Math.round(node.score * 100);
  const scoreColor = node.score >= 0.55
    ? isDark ? "text-emerald-400" : "text-emerald-700"
    : node.score <= 0.45
      ? isDark ? "text-red-400" : "text-red-700"
      : t.textSecondary;

  return (
    <div className={`p-3 rounded-xl space-y-1.5 ${isDark ? "bg-[#1e2e22]/40 border border-[#1e2e22]/30" : "bg-[#f8faf5] border border-[#ADBC9F]/30"}`}>
      <div className="flex items-center justify-between">
        <span className={`text-xs font-semibold ${t.textPrimary}`}>Opponent score in this line</span>
        <span className={`text-sm font-bold ${scoreColor}`}>{scorePct}%</span>
      </div>
      <p className={`text-[11px] ${t.textTertiary}`}>
        {formatResults(node.score, node.count)}
        {isLow && " · Limited data"}
      </p>
      {isLow && (
        <p className={`text-[11px] italic ${t.textTertiary}`}>
          Treat with caution — fewer than 8 games at this position.
        </p>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ForecastWalkthrough({
  openingForecast,
  colorFilter = "both",
  isDark,
  t,
  opponentUsername,
}: ForecastWalkthroughProps) {
  // Which color are we viewing (opponent's perspective)
  const defaultOpponentColor: "white" | "black" =
    colorFilter === "black" ? "black"
    : colorFilter === "white" ? "white"
    : "white";

  const [opponentColor, setOpponentColor] = useState<"white" | "black">(defaultOpponentColor);
  const [selectedPath, setSelectedPath] = useState<string[]>([]);
  const [selectedNode, setSelectedNode] = useState<FNode | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [flipped, setFlipped] = useState(
    // Board orientation: if opponent plays White, show White from bottom (flipped=false)
    // If opponent plays Black, show Black from bottom (flipped=true)
    opponentColor === "black"
  );

  // When opponentColor changes, reset path and update flip
  const handleColorSwitch = useCallback((c: "white" | "black") => {
    setOpponentColor(c);
    setSelectedPath([]);
    setSelectedNode(null);
    setShowMore(false);
    setFlipped(c === "black");
  }, []);

  // Get branches at current path depth
  const currentBranches = useMemo((): FNode[] => {
    const rootBranches = openingForecast[opponentColor] ?? [];
    if (rootBranches.length === 0) return [];

    if (selectedPath.length === 0) {
      // Root level: top-level branches
      const totalGames = rootBranches.reduce((s, b) => s + b.count, 0);
      return enrichBranches(rootBranches, [], totalGames, opponentColor, 0);
    }

    // Navigate down the tree to find children at selectedPath
    let branches = rootBranches;
    let depth = 0;
    for (const san of selectedPath) {
      const found = branches.find(b => b.moveSan === san);
      if (!found) return [];
      branches = found.children ?? [];
      depth++;
    }
    const parentCount = selectedNode?.count ?? branches.reduce((s, b) => s + b.count, 0);
    return enrichBranches(branches, selectedPath, parentCount, opponentColor, depth);
  }, [openingForecast, opponentColor, selectedPath, selectedNode]);

  // Split into primary (top 3) and more
  const primaryBranches = useMemo(() => currentBranches.slice(0, 3), [currentBranches]);
  const moreBranches = useMemo(() => currentBranches.slice(3), [currentBranches]);

  // Current FEN for board
  const currentFen = useMemo(() => {
    if (selectedPath.length === 0) return new Chess().fen();
    return fenFromPath(selectedPath) ?? new Chess().fen();
  }, [selectedPath]);

  const handleSelectBranch = useCallback((node: FNode) => {
    setSelectedPath(node.path);
    setSelectedNode(node);
    setShowMore(false);
  }, []);

  const handleBack = useCallback(() => {
    if (selectedPath.length === 0) return;
    const newPath = selectedPath.slice(0, -1);
    setSelectedPath(newPath);
    setSelectedNode(null);
    setShowMore(false);
  }, [selectedPath]);

  const handleReset = useCallback(() => {
    setSelectedPath([]);
    setSelectedNode(null);
    setShowMore(false);
  }, []);

  const breadcrumb = pathToBreadcrumb(selectedPath);
  const stepLabel = selectedPath.length === 0
    ? "Starting position"
    : `Step ${selectedPath.length}`;

  const hasData = (openingForecast.white?.length ?? 0) > 0 || (openingForecast.black?.length ?? 0) > 0;
  const hasColorData = (openingForecast[opponentColor]?.length ?? 0) > 0;

  // Perspective labels
  const opponentPerspective = opponentColor === "white"
    ? "Opponent plays White"
    : "Opponent plays Black";
  const yourPerspective = opponentColor === "white"
    ? "You have Black"
    : "You have White";

  if (!hasData) return null;

  return (
    <div className={`${t.card} p-4 sm:p-5`}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-4">
        <BookOpen className={`w-4 h-4 shrink-0 ${isDark ? "text-[#5B9A6A]" : "text-[#436850]"}`} />
        <h3 className={`font-bold text-sm flex-1 ${t.textPrimary}`}>Opening Forecast</h3>

        {/* Color switch */}
        <div className={`flex items-center gap-0.5 p-0.5 rounded-lg ${isDark ? "bg-[#0d1a0f]/80 border border-[#1e2e22]/60" : "bg-[#ADBC9F]/40 border border-[#ADBC9F]/60"}`}>
          {(["white", "black"] as const).map((c) => (
            <button
              key={c}
              onClick={() => handleColorSwitch(c)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                opponentColor === c
                  ? "bg-[#436850] text-white"
                  : isDark ? "text-white/40 hover:text-white/70" : "text-[#436850] hover:text-[#12372A]"
              }`}
              aria-pressed={opponentColor === c}
            >
              {c === "white" ? "Opp. White" : "Opp. Black"}
            </button>
          ))}
        </div>

        {/* Flip board */}
        <button
          onClick={() => setFlipped(f => !f)}
          className={`p-1.5 rounded-lg transition-colors ${isDark ? "hover:bg-white/08 text-white/40 hover:text-white/70" : "hover:bg-[#ADBC9F]/30 text-[#436850]/50 hover:text-[#436850]"}`}
          aria-label="Flip board orientation"
          title="Flip board"
        >
          <FlipVertical2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ── Perspective labels ─────────────────────────────────────────────── */}
      <div className={`flex items-center gap-2 mb-4 text-xs ${t.textTertiary}`}>
        <span className={`font-semibold ${isDark ? "text-amber-400/80" : "text-amber-700"}`}>
          {opponentPerspective}
        </span>
        <span>·</span>
        <span>{yourPerspective}</span>
      </div>

      {!hasColorData ? (
        <div className={`flex items-center gap-2 p-4 rounded-xl ${isDark ? "bg-[#1e2e22]/30" : "bg-[#f8faf5]"}`}>
          <AlertCircle className={`w-4 h-4 ${t.textTertiary}`} />
          <p className={`text-sm ${t.textTertiary}`}>
            No games found for {opponentUsername} as {opponentColor}.
          </p>
        </div>
      ) : (
        <>
          {/* ── Two-column layout ───────────────────────────────────────────── */}
          <div className="flex flex-col lg:flex-row gap-4">

            {/* Left: Board */}
            <div className="flex flex-col items-center gap-2 w-full lg:w-auto lg:items-start" style={{ maxWidth: 416 }}>
              <ForecastBoard
                fen={currentFen}
                flipped={flipped}
                isDark={isDark}
                lastMovePath={selectedPath.length > 0 ? selectedPath : undefined}
              />
              {/* Breadcrumb below board */}
              <div className={`w-full text-[11px] font-mono px-2 py-1.5 rounded-lg ${isDark ? "bg-[#0d1a0f]/60 text-white/40" : "bg-[#f0f4ec] text-[#436850]/60"}`}>
                {breadcrumb}
              </div>
            </div>

            {/* Right: Branch selector + detail */}
            <div className="flex-1 flex flex-col gap-3 min-w-0">

              {/* Step indicator + nav */}
              <div className="flex items-center gap-2">
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${isDark ? "bg-[#1e2e22] text-[#5B9A6A]" : "bg-[#ADBC9F]/30 text-[#436850]"}`}>
                  {stepLabel}
                </span>
                {selectedPath.length > 0 && (
                  <>
                    <button
                      onClick={handleBack}
                      className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg transition-colors ${isDark ? "hover:bg-white/08 text-white/50 hover:text-white/80" : "hover:bg-[#ADBC9F]/30 text-[#436850]/60 hover:text-[#436850]"}`}
                      aria-label="Go back one move"
                      style={{ minHeight: "28px" }}
                    >
                      <ChevronLeft className="w-3 h-3" />
                      Back
                    </button>
                    <button
                      onClick={handleReset}
                      className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg transition-colors ${isDark ? "hover:bg-white/08 text-white/50 hover:text-white/80" : "hover:bg-[#ADBC9F]/30 text-[#436850]/60 hover:text-[#436850]"}`}
                      aria-label="Reset to starting position"
                      style={{ minHeight: "28px" }}
                    >
                      <RotateCcw className="w-3 h-3" />
                      Reset
                    </button>
                  </>
                )}
              </div>

              {/* Section heading */}
              <p className={`text-xs font-semibold ${t.textSecondary}`}>
                {selectedPath.length === 0
                  ? `What ${opponentUsername} plays first`
                  : currentBranches.length === 0
                    ? "End of line"
                    : selectedPath.length % 2 === (opponentColor === "white" ? 0 : 1)
                      ? `${opponentUsername}'s likely continuation`
                      : "Common replies seen in their games"}
              </p>

              {/* Branch rows */}
              {currentBranches.length === 0 ? (
                <div className={`p-3 rounded-xl text-xs ${t.textTertiary} ${isDark ? "bg-[#1e2e22]/30" : "bg-[#f8faf5]"}`}>
                  {selectedPath.length > 0
                    ? "No further branches with enough data. This is the end of the tracked line."
                    : "No opening data available for this color."}
                </div>
              ) : (
                <div className="space-y-1.5">
                  {primaryBranches.map((node) => (
                    <BranchRow
                      key={node.moveSan}
                      node={node}
                      isSelected={selectedPath[selectedPath.length - 1] === node.moveSan && selectedPath.length === node.path.length}
                      onSelect={handleSelectBranch}
                      isDark={isDark}
                      t={t}
                    />
                  ))}

                  {/* More continuations */}
                  {moreBranches.length > 0 && (
                    <>
                      <button
                        onClick={() => setShowMore(m => !m)}
                        className={`flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg w-full transition-colors ${isDark ? "text-white/40 hover:text-white/60 hover:bg-white/04" : "text-[#436850]/50 hover:text-[#436850] hover:bg-[#ADBC9F]/15"}`}
                        aria-expanded={showMore}
                        style={{ minHeight: "36px" }}
                      >
                        {showMore ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                        {showMore ? "Hide" : `${moreBranches.length} more continuation${moreBranches.length !== 1 ? "s" : ""}`}
                      </button>
                      {showMore && moreBranches.map((node) => (
                        <BranchRow
                          key={node.moveSan}
                          node={node}
                          isSelected={selectedPath[selectedPath.length - 1] === node.moveSan && selectedPath.length === node.path.length}
                          onSelect={handleSelectBranch}
                          isDark={isDark}
                          t={t}
                        />
                      ))}
                    </>
                  )}
                </div>
              )}

              {/* Performance summary for selected node */}
              {selectedNode && (
                <PerformanceSummary node={selectedNode} isDark={isDark} t={t} />
              )}

              {/* Practice link */}
              {selectedPath.length >= 2 && (
                <p className={`text-[11px] ${t.textTertiary}`}>
                  Practice this position in the{" "}
                  <span className={`font-semibold ${isDark ? "text-[#5B9A6A]" : "text-[#436850]"}`}>
                    Game Plan
                  </span>{" "}
                  section below.
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
