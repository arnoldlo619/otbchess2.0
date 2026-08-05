/**
 * ForecastWalkthrough — Board-first interactive Opening Forecast.
 *
 * Features:
 * - Responsive SVG chessboard with animated piece transitions (200ms ease-out)
 * - Engine evaluation bar (vertical, white/black gradient with score indicator)
 * - Click-through move tree: select branch → board updates, breadcrumb, Back/Reset
 * - Perspective labels, color toggle, flip board
 * - Small-sample guards, conditional denominators, confidence tiers
 */

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
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
  colorFilter?: "both" | "white" | "black";
  isDark: boolean;
  t: Tokens;
  opponentUsername: string;
}

interface FNode {
  moveSan: string;
  path: string[];
  fen: string;
  actor: "opponent" | "reply";
  count: number;
  parentCount: number;
  pct: number;
  score: number;
  label?: string;
  rawChildren: ForecastBranch[];
  confidence: "high" | "medium" | "low" | "tiny";
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fenFromPath(path: string[]): string | null {
  const chess = new Chess();
  for (const san of path) {
    try { chess.move(san); } catch { return null; }
  }
  return chess.fen();
}

function confidenceTier(count: number): FNode["confidence"] {
  if (count >= 15) return "high";
  if (count >= 8) return "medium";
  if (count >= 3) return "low";
  return "tiny";
}

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

function pathToBreadcrumb(path: string[]): string {
  if (path.length === 0) return "Starting position";
  const parts: string[] = [];
  for (let i = 0; i < path.length; i++) {
    if (i % 2 === 0) {
      parts.push(`${Math.floor(i / 2) + 1}. ${path[i]}`);
    } else {
      parts.push(path[i]);
    }
  }
  return parts.join(" ");
}

function formatResults(count: number): string {
  return `Based on ${count} game${count !== 1 ? "s" : ""} at this position`;
}

// ── Piece animation helpers ───────────────────────────────────────────────────

const PIECE_GLYPHS: Record<string, string> = {
  wK: "♔", wQ: "♕", wR: "♖", wB: "♗", wN: "♘", wP: "♙",
  bK: "♚", bQ: "♛", bR: "♜", bB: "♝", bN: "♞", bP: "♟",
};

/** Square name → [col 0-7, row 0-7] in board coordinates */
function squareToCoords(sq: string): [number, number] {
  const col = sq.charCodeAt(0) - 97; // a=0..h=7
  const row = 8 - parseInt(sq[1]);   // rank 8=row0..rank 1=row7
  return [col, row];
}

/** Build a stable piece-id → {sq, glyph, color} map from a FEN */
interface PieceInfo {
  sq: string;
  glyph: string;
  color: "w" | "b";
  type: string;
}

function buildPieceMap(fen: string): Map<string, PieceInfo> {
  const chess = new Chess();
  try { chess.load(fen); } catch { /* use default */ }
  const board = chess.board();
  // Count pieces per type to assign stable IDs (e.g. wP-1, wP-2 left→right top→bottom)
  const counters: Record<string, number> = {};
  const map = new Map<string, PieceInfo>();

  // Iterate in a stable order: top-left to bottom-right
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (!piece) continue;
      const typeKey = `${piece.color}${piece.type.toUpperCase()}`;
      counters[typeKey] = (counters[typeKey] ?? 0) + 1;
      const id = `${typeKey}-${counters[typeKey]}`;
      const sq = String.fromCharCode(97 + col) + (8 - row);
      const glyph = PIECE_GLYPHS[typeKey] ?? "?";
      map.set(id, { sq, glyph, color: piece.color, type: piece.type });
    }
  }
  return map;
}

function cellColor(col: number, row: number, isDark: boolean): string {
  const isLight = (col + row) % 2 === 0;
  if (isDark) return isLight ? "#2a3d2e" : "#1a2a1e";
  return isLight ? "#f0d9b5" : "#b58863";
}

// ── Eval Bar ─────────────────────────────────────────────────────────────────

interface EvalBarProps {
  /** Opponent score 0–1 (0.5 = equal) */
  score: number | null;
  isDark: boolean;
  flipped: boolean;
}

function EvalBar({ score, isDark, flipped }: EvalBarProps) {
  // score is opponent's score (0=opponent loses, 1=opponent wins)
  // We show White advantage at top, Black at bottom (standard)
  // White advantage = 1 - score (if opponent is Black, score=0.7 means Black wins → white losing)
  // We'll treat score as "active side advantage" and just show it as a gradient

  const TOTAL_HEIGHT = 416; // matches board max height in px (visual reference)

  // Convert score to a 0–100 percentage where 0=white winning, 100=black winning
  // score=0.5 → 50% (equal)
  // score=0.7 → 70% (opponent doing well, shown as black advantage if opponent=black)
  const clampedScore = score === null ? 0.5 : Math.max(0, Math.min(1, score));

  // "blackPct" = how much of the bar is black (from top)
  const blackPct = flipped
    ? Math.round(clampedScore * 100)
    : Math.round((1 - clampedScore) * 100);

  const whiteScore = Math.round((1 - clampedScore) * 100);
  const blackScore = Math.round(clampedScore * 100);

  // Format numeric eval: convert 0–100 to a ±centipawn-style display
  // We don't have real engine eval, so show as score percentage
  const evalLabel = score === null
    ? "—"
    : clampedScore === 0.5
      ? "="
      : clampedScore > 0.5
        ? `+${Math.round((clampedScore - 0.5) * 200) / 100}`
        : `-${Math.round((0.5 - clampedScore) * 200) / 100}`;

  return (
    <div
      className="flex flex-col items-center gap-1 shrink-0"
      style={{ width: 20 }}
      aria-label={`Evaluation bar: ${evalLabel}`}
      title={`Position score: ${evalLabel}`}
    >
      {/* Score label top (black) */}
      <span className={`text-[9px] font-bold tabular-nums ${isDark ? "text-white/30" : "text-black/30"}`}>
        {blackScore}
      </span>

      {/* Bar */}
      <div
        className="relative rounded-full overflow-hidden flex-1"
        style={{
          width: 10,
          minHeight: 120,
          background: isDark ? "#1a2a1e" : "#b58863",
        }}
      >
        {/* White portion */}
        <div
          className="absolute bottom-0 left-0 right-0 rounded-b-full transition-all duration-300 ease-out"
          style={{
            height: `${100 - blackPct}%`,
            background: isDark
              ? "linear-gradient(to top, rgba(255,255,255,0.92), rgba(255,255,255,0.75))"
              : "linear-gradient(to top, #f0d9b5, #e8c98a)",
          }}
        />
        {/* Midpoint tick */}
        <div
          className="absolute left-0 right-0"
          style={{
            top: "50%",
            height: 1,
            background: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)",
          }}
        />
        {/* Score indicator dot */}
        <div
          className="absolute left-1/2 -translate-x-1/2 w-2 h-2 rounded-full border border-white/30 transition-all duration-300 ease-out"
          style={{
            top: `calc(${blackPct}% - 4px)`,
            background: blackPct < 50
              ? (isDark ? "#5B9A6A" : "#436850")
              : (isDark ? "rgba(255,255,255,0.9)" : "#f0d9b5"),
          }}
        />
      </div>

      {/* Score label bottom (white) */}
      <span className={`text-[9px] font-bold tabular-nums ${isDark ? "text-white/30" : "text-black/30"}`}>
        {whiteScore}
      </span>

      {/* Eval label */}
      <span
        className={`text-[9px] font-mono font-bold tabular-nums ${
          score === null || clampedScore === 0.5
            ? (isDark ? "text-white/25" : "text-black/25")
            : clampedScore > 0.5
              ? (isDark ? "text-amber-400/70" : "text-amber-700")
              : (isDark ? "text-sky-400/70" : "text-sky-700")
        }`}
        style={{ writingMode: "horizontal-tb" }}
      >
        {evalLabel}
      </span>
    </div>
  );
}

// ── Animated Board ────────────────────────────────────────────────────────────

interface BoardProps {
  fen: string;
  prevFen: string;
  flipped: boolean;
  isDark: boolean;
  lastMove: { from: string; to: string } | null;
}

function AnimatedBoard({ fen, prevFen, flipped, isDark, lastMove }: BoardProps) {
  const CELL = 52;
  const SIZE = CELL * 8;

  // Build current piece map
  const currentPieces = useMemo(() => buildPieceMap(fen), [fen]);
  const prevPieces = useMemo(() => buildPieceMap(prevFen), [prevFen]);

  // Track which pieces are "new" (appeared) vs "moved" vs "same"
  // For animation: if a piece ID exists in both maps, animate from prev coords to current coords
  // If only in current, it's a promotion or appeared (no animation needed)

  const pieceElements = useMemo(() => {
    const elements: React.ReactNode[] = [];

    currentPieces.forEach((info, id) => {
      const [boardCol, boardRow] = squareToCoords(info.sq);
      const displayCol = flipped ? 7 - boardCol : boardCol;
      const displayRow = flipped ? 7 - boardRow : boardRow;
      const x = displayCol * CELL + CELL / 2;
      const y = displayRow * CELL + CELL / 2 + 1;

      // Check if this piece was somewhere else before
      const prevInfo = prevPieces.get(id);
      let fromX = x;
      let fromY = y;
      let shouldAnimate = false;

      if (prevInfo && prevInfo.sq !== info.sq) {
        const [prevBoardCol, prevBoardRow] = squareToCoords(prevInfo.sq);
        const prevDisplayCol = flipped ? 7 - prevBoardCol : prevBoardCol;
        const prevDisplayRow = flipped ? 7 - prevBoardRow : prevBoardRow;
        fromX = prevDisplayCol * CELL + CELL / 2;
        fromY = prevDisplayRow * CELL + CELL / 2 + 1;
        shouldAnimate = true;
      }

      const deltaX = x - fromX;
      const deltaY = y - fromY;

      elements.push(
        <text
          key={id}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={CELL * 0.72}
          fill={info.color === "w" ? "#ffffff" : "#1a1a1a"}
          stroke={info.color === "w" ? "rgba(0,0,0,0.85)" : "rgba(255,255,255,0.25)"}
          strokeWidth={info.color === "w" ? "6" : "3"}
          strokeLinejoin="round"
          paintOrder="stroke"
          style={{
            userSelect: "none",
            transform: shouldAnimate
              ? `translate(${fromX}px, ${fromY}px)`
              : `translate(${x}px, ${y}px)`,
            animation: shouldAnimate
              ? `piece-move-${id.replace(/[^a-zA-Z0-9]/g, "")} 200ms ease-out forwards`
              : undefined,
          }}
        >
          {info.glyph}
        </text>
      );

      if (shouldAnimate) {
        // Inject a keyframe animation via a style tag approach
        // We'll use CSS custom properties instead — see below
      }
    });

    return elements;
  }, [currentPieces, prevPieces, flipped, CELL]);

  // Build inline <style> for piece animations
  const animationStyles = useMemo(() => {
    const rules: string[] = [];
    currentPieces.forEach((info, id) => {
      const prevInfo = prevPieces.get(id);
      if (!prevInfo || prevInfo.sq === info.sq) return;

      const [boardCol, boardRow] = squareToCoords(info.sq);
      const displayCol = flipped ? 7 - boardCol : boardCol;
      const displayRow = flipped ? 7 - boardRow : boardRow;
      const x = displayCol * CELL + CELL / 2;
      const y = displayRow * CELL + CELL / 2 + 1;

      const [prevBoardCol, prevBoardRow] = squareToCoords(prevInfo.sq);
      const prevDisplayCol = flipped ? 7 - prevBoardCol : prevBoardCol;
      const prevDisplayRow = flipped ? 7 - prevBoardRow : prevBoardRow;
      const fromX = prevDisplayCol * CELL + CELL / 2;
      const fromY = prevDisplayRow * CELL + CELL / 2 + 1;

      const animName = `piece-move-${id.replace(/[^a-zA-Z0-9]/g, "")}`;
      rules.push(`
        @keyframes ${animName} {
          from { transform: translate(${fromX}px, ${fromY}px); }
          to   { transform: translate(${x}px, ${y}px); }
        }
      `);
    });
    return rules.join("\n");
  }, [currentPieces, prevPieces, flipped, CELL]);

  return (
    <div
      className={`rounded-xl overflow-hidden border ${isDark ? "border-[#243028]/70" : "border-[#ADBC9F]/60"}`}
      style={{ width: "100%", maxWidth: SIZE, aspectRatio: "1 / 1", flexShrink: 0 }}
      aria-label={`Chessboard position`}
    >
      {animationStyles && <style>{animationStyles}</style>}
      <style>{`
        @keyframes sq-flash-to {
          0%   { opacity: 0.85; }
          40%  { opacity: 0.65; }
          100% { opacity: 0; }
        }
        @keyframes sq-flash-from {
          0%   { opacity: 0.45; }
          100% { opacity: 0; }
        }
        .sq-flash-to  { animation: sq-flash-to  600ms ease-out forwards; }
        .sq-flash-from { animation: sq-flash-from 400ms ease-out forwards; }
      `}</style>
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
              <g key={`${row}-${col}`}>
                <rect x={col * CELL} y={row * CELL} width={CELL} height={CELL} fill={fill} />
                {/* Flash overlay on destination square */}
                {isLastTo && (
                  <rect
                    key={`flash-to-${lastMove?.to}`}
                    x={col * CELL} y={row * CELL}
                    width={CELL} height={CELL}
                    fill={isDark ? "#7eca8f" : "#f6f669"}
                    className="sq-flash-to"
                    style={{ pointerEvents: "none" }}
                  />
                )}
                {/* Subtle fade on source square */}
                {isLastFrom && (
                  <rect
                    key={`flash-from-${lastMove?.from}`}
                    x={col * CELL} y={row * CELL}
                    width={CELL} height={CELL}
                    fill={isDark ? "#5B9A6A" : "#e8e84a"}
                    className="sq-flash-from"
                    style={{ pointerEvents: "none" }}
                  />
                )}
              </g>
            );
          })
        )}

        {/* Animated pieces */}
        {pieceElements}

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

  return (
    <button
      onClick={() => onSelect(node)}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all ${rowBg}`}
      style={{ minHeight: "44px" }}
      aria-pressed={isSelected}
      aria-label={`${node.moveSan}${node.label ? `, ${node.label}` : ""}, ${Math.round(node.pct * 100)}% frequency, ${node.count} games`}
    >
      <span className={`shrink-0 w-[3px] h-6 rounded-full transition-all ${isSelected ? (isDark ? "bg-[#5B9A6A]" : "bg-[#436850]") : "bg-transparent"}`} />
      <span className={`font-mono text-sm font-bold shrink-0 ${isDark ? "text-white" : "text-[#12372A]"}`}>
        {node.moveSan}
      </span>
      <span className={`flex-1 text-xs truncate ${t.textSecondary}`}>
        {node.label ?? (isOpponent ? "—" : "continuation")}
      </span>
      <span className={`shrink-0 text-[11px] font-medium ${isTiny ? t.textTertiary : t.textSecondary}`}>
        {isTiny
          ? `${node.count}g`
          : `${Math.round(node.pct * 100)}% · ${node.count}`}
      </span>
      <span className={`shrink-0 text-[10px] font-semibold ${actorColor}`}>
        {isOpponent ? "↑" : "↓"}
      </span>
      {node.rawChildren.length > 0 && (
        <ChevronRight className={`w-3.5 h-3.5 shrink-0 ${t.textTertiary}`} />
      )}
    </button>
  );
}

// ── Performance summary ───────────────────────────────────────────────────────

function PerformanceSummary({ node, isDark, t }: { node: FNode; isDark: boolean; t: Tokens }) {
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
        {formatResults(node.count)}
        {isLow && " · Limited data — treat with caution"}
      </p>
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
  const defaultOpponentColor: "white" | "black" =
    colorFilter === "black" ? "black"
    : colorFilter === "white" ? "white"
    : "white";

  const [opponentColor, setOpponentColor] = useState<"white" | "black">(defaultOpponentColor);
  const [selectedPath, setSelectedPath] = useState<string[]>([]);
  const [selectedNode, setSelectedNode] = useState<FNode | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [flipped, setFlipped] = useState(opponentColor === "black");

  // Track previous FEN for piece animation
  const prevFenRef = useRef<string>(new Chess().fen());
  const [prevFen, setPrevFen] = useState<string>(new Chess().fen());

  const handleColorSwitch = useCallback((c: "white" | "black") => {
    setOpponentColor(c);
    setSelectedPath([]);
    setSelectedNode(null);
    setShowMore(false);
    setFlipped(c === "black");
    const startFen = new Chess().fen();
    prevFenRef.current = startFen;
    setPrevFen(startFen);
  }, []);

  const currentBranches = useMemo((): FNode[] => {
    const rootBranches = openingForecast[opponentColor] ?? [];
    if (rootBranches.length === 0) return [];

    if (selectedPath.length === 0) {
      const totalGames = rootBranches.reduce((s, b) => s + b.count, 0);
      return enrichBranches(rootBranches, [], totalGames, opponentColor, 0);
    }

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

  const primaryBranches = useMemo(() => currentBranches.slice(0, 3), [currentBranches]);
  const moreBranches = useMemo(() => currentBranches.slice(3), [currentBranches]);

  const currentFen = useMemo(() => {
    if (selectedPath.length === 0) return new Chess().fen();
    return fenFromPath(selectedPath) ?? new Chess().fen();
  }, [selectedPath]);

  // Derive last move for highlight
  const lastMove = useMemo(() => {
    if (selectedPath.length === 0) return null;
    const prevPath = selectedPath.slice(0, -1);
    const c = new Chess();
    for (const san of prevPath) {
      try { c.move(san); } catch { return null; }
    }
    const lastSan = selectedPath[selectedPath.length - 1];
    try {
      const result = c.move(lastSan);
      return result ? { from: result.from, to: result.to } : null;
    } catch { return null; }
  }, [selectedPath]);

  const handleSelectBranch = useCallback((node: FNode) => {
    // Capture current FEN as "previous" before updating
    const curFen = fenFromPath(selectedPath) ?? new Chess().fen();
    setPrevFen(curFen);
    prevFenRef.current = curFen;
    setSelectedPath(node.path);
    setSelectedNode(node);
    setShowMore(false);
  }, [selectedPath]);

  const handleBack = useCallback(() => {
    if (selectedPath.length === 0) return;
    const curFen = fenFromPath(selectedPath) ?? new Chess().fen();
    setPrevFen(curFen);
    const newPath = selectedPath.slice(0, -1);
    setSelectedPath(newPath);
    setSelectedNode(null);
    setShowMore(false);
  }, [selectedPath]);

  const handleReset = useCallback(() => {
    const curFen = fenFromPath(selectedPath) ?? new Chess().fen();
    setPrevFen(curFen);
    setSelectedPath([]);
    setSelectedNode(null);
    setShowMore(false);
  }, [selectedPath]);

  const breadcrumb = pathToBreadcrumb(selectedPath);
  const stepLabel = selectedPath.length === 0 ? "Starting position" : `Step ${selectedPath.length}`;
  const hasData = (openingForecast.white?.length ?? 0) > 0 || (openingForecast.black?.length ?? 0) > 0;
  const hasColorData = (openingForecast[opponentColor]?.length ?? 0) > 0;
  const opponentPerspective = opponentColor === "white" ? "Opponent plays White" : "Opponent plays Black";
  const yourPerspective = opponentColor === "white" ? "You have Black" : "You have White";

  // Current eval score: use selectedNode's score, or null at root
  const evalScore = selectedNode?.score ?? null;

  if (!hasData) return null;

  return (
    <div className={`${t.card} p-4 sm:p-5`}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-4">
        <BookOpen className={`w-4 h-4 shrink-0 ${isDark ? "text-[#5B9A6A]" : "text-[#436850]"}`} />
        <h3 className={`font-bold text-sm flex-1 ${t.textPrimary}`}>Opening Forecast</h3>

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
          <div className="flex flex-col lg:flex-row gap-4">

            {/* Left: Board + Eval bar */}
            <div className="flex flex-col gap-2 w-full lg:w-auto" style={{ maxWidth: 436 }}>
              <div className="flex items-stretch gap-2">
                {/* Eval bar */}
                <EvalBar score={evalScore} isDark={isDark} flipped={flipped} />

                {/* Animated board */}
                <div className="flex-1">
                  <AnimatedBoard
                    fen={currentFen}
                    prevFen={prevFen}
                    flipped={flipped}
                    isDark={isDark}
                    lastMove={lastMove}
                  />
                </div>
              </div>

              {/* Breadcrumb */}
              <div className={`text-[11px] font-mono px-2 py-1.5 rounded-lg ${isDark ? "bg-[#0d1a0f]/60 text-white/40" : "bg-[#f0f4ec] text-[#436850]/60"}`}>
                {breadcrumb}
              </div>
            </div>

            {/* Right: Branch selector + detail */}
            <div className="flex-1 flex flex-col gap-3 min-w-0">

              {/* Step indicator + nav */}
              <div className="flex items-center gap-2 flex-wrap">
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
                    ? "No further branches with enough data. End of tracked line."
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

              {/* Performance summary */}
              {selectedNode && (
                <PerformanceSummary node={selectedNode} isDark={isDark} t={t} />
              )}

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
