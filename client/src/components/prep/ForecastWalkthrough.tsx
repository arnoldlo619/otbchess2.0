import { useMemo, useState } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { BookOpen, ChevronLeft, ChevronRight, FlipVertical2, RotateCcw } from "lucide-react";

import type { ForecastBranch, Insight } from "../../../../shared/prepTypes";

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
  myColor?: "white" | "black" | "not_sure";
  isDark: boolean;
  t: Tokens;
  opponentUsername: string;
  weaknessInsights?: Insight[];
  analysisHrefForUciPath?: (uciPath: string[]) => string | null;
}

function replayPath(path: string[]) {
  const chess = new Chess();
  const uci: string[] = [];
  for (const san of path) {
    try {
      const move = chess.move(san);
      uci.push(move.from + move.to + (move.promotion ?? ""));
    } catch {
      return null;
    }
  }
  return { fen: chess.fen(), uci };
}

function describePosition(fen: string | undefined, path: string[]): string {
  if (!fen) return "Starting chess position. Use the named move buttons to navigate legal continuations.";
  const chess = new Chess(fen);
  const pieces = chess.board().flatMap((rank, rankIndex) => rank.flatMap((piece, fileIndex) => {
    if (!piece) return [];
    const file = String.fromCharCode("a".charCodeAt(0) + fileIndex);
    const square = `${file}${8 - rankIndex}`;
    const color = piece.color === "w" ? "White" : "Black";
    const names = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };
    return [`${color} ${names[piece.type]} on ${square}`];
  }));
  const turn = chess.turn() === "w" ? "White" : "Black";
  return `Position after ${pathLabel(path)}. ${pieces.join(", ")}. ${turn} to move. Use the named move buttons to navigate legal continuations.`;
}

function branchAtPath(branches: ForecastBranch[], path: string[]): ForecastBranch | null {
  let current = branches;
  let selected: ForecastBranch | null = null;
  for (const san of path) {
    selected = current.find(branch => branch.moveSan === san) ?? null;
    if (!selected) return null;
    current = selected.children ?? [];
  }
  return selected;
}

function branchesAtPath(branches: ForecastBranch[], path: string[]): ForecastBranch[] {
  return branchAtPath(branches, path)?.children ?? (path.length === 0 ? branches : []);
}

function pathLabel(path: string[]): string {
  if (path.length === 0) return "Starting position";
  return path.reduce<string[]>((parts, san, index) => {
    if (index % 2 === 0) parts.push(`${Math.floor(index / 2) + 1}. ${san}`);
    else parts.push(san);
    return parts;
  }, []).join(" ");
}

function confidenceLabel(count: number): string {
  if (count >= 8) return "Good sample";
  if (count >= 6) return "Supporting sample";
  return "Small sample";
}

function actorLabel(branch: ForecastBranch, opponentUsername: string): string {
  return branch.actor === "opponent" ? `${opponentUsername}'s tendency` : "Your move";
}

function BranchButton({
  branch,
  opponentUsername,
  isDark,
  t,
  onSelect,
  onPreview,
}: {
  branch: ForecastBranch;
  opponentUsername: string;
  isDark: boolean;
  t: Tokens;
  onSelect: () => void;
  onPreview: (branch: ForecastBranch | null) => void;
}) {
  const parentGames = branch.parentGames ?? Math.max(branch.count, Math.round(branch.count / Math.max(branch.pct, 0.01)));
  const frequency = Math.round((branch.count / Math.max(parentGames, 1)) * 100);
  const actor = actorLabel(branch, opponentUsername);
  const isOpponent = branch.actor === "opponent";

  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={() => onPreview(branch)}
      onMouseLeave={() => onPreview(null)}
      onFocus={() => onPreview(branch)}
      onBlur={() => onPreview(null)}
      className={`group w-full rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B9A6A] focus-visible:ring-offset-2 ${
        isDark
          ? "border-[#243028]/70 bg-[#111d13] hover:border-[#436850]/70 hover:bg-[#152319] focus-visible:ring-offset-[#0a1409]"
          : "border-[#ADBC9F]/70 bg-white hover:border-[#436850]/50 hover:bg-[#f7faf5] focus-visible:ring-offset-white"
      }`}
      aria-label={`${actor}: ${branch.moveSan}. ${branch.count} of ${parentGames} games, ${frequency} percent.`}
    >
      <span className="flex min-h-11 items-center gap-3">
        <span className={`grid h-9 min-w-11 place-items-center rounded-lg px-2 font-mono text-sm font-bold ${
          isOpponent
            ? isDark ? "bg-amber-400/10 text-amber-300" : "bg-amber-50 text-amber-800"
            : isDark ? "bg-[#436850]/20 text-[#a7d8b1]" : "bg-[#e8f0e5] text-[#23482f]"
        }`}>{branch.moveSan}</span>
        <span className="min-w-0 flex-1">
          <span className={`block text-xs font-semibold ${t.textPrimary}`}>{actor}</span>
          <span className={`mt-0.5 block truncate text-[11px] ${t.textTertiary}`}>
            {branch.label ?? (isOpponent ? "Observed reply" : "Games reaching this choice")}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className={`block text-xs font-semibold tabular-nums ${t.textSecondary}`}>{frequency}%</span>
          <span className={`block text-[10px] tabular-nums ${t.textTertiary}`}>{branch.count}/{parentGames}</span>
        </span>
        {(branch.children?.length ?? 0) > 0 && <ChevronRight aria-hidden="true" className={`h-4 w-4 shrink-0 ${t.textTertiary}`} />}
      </span>
    </button>
  );
}

export function ForecastWalkthrough({
  openingForecast,
  myColor = "white",
  isDark,
  t,
  opponentUsername,
  analysisHrefForUciPath,
}: ForecastWalkthroughProps) {
  const submittedColor = myColor === "black" ? "black" : "white";
  const opponentColor = submittedColor === "white" ? "black" : "white";
  const rootBranches = useMemo(() => openingForecast[opponentColor] ?? [], [openingForecast, opponentColor]);
  const [selectedPath, setSelectedPath] = useState<string[]>([]);
  const [previewBranch, setPreviewBranch] = useState<ForecastBranch | null>(null);
  const [flipped, setFlipped] = useState(submittedColor === "black");
  const [prefersReducedMotion] = useState(() =>
    typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  const selectedBranch = useMemo(() => branchAtPath(rootBranches, selectedPath), [rootBranches, selectedPath]);
  const currentBranches = useMemo(() => branchesAtPath(rootBranches, selectedPath), [rootBranches, selectedPath]);
  const displayedPath = previewBranch?.previewPath ?? selectedPath;
  const replay = useMemo(() => replayPath(displayedPath), [displayedPath]);
  const positionDescription = useMemo(() => describePosition(replay?.fen, displayedPath), [replay?.fen, displayedPath]);
  const analysisHref = selectedPath.length > 0 && analysisHrefForUciPath
    ? analysisHrefForUciPath(replayPath(selectedPath)?.uci ?? [])
    : null;
  const nextActor = currentBranches[0]?.actor === "opponent" ? `${opponentUsername}'s tendency` : "Your move";
  const screenReaderInstructions = "Chessboard piece display. Use the named move buttons beside the board to navigate each legal position.";

  if (rootBranches.length === 0) return null;

  return (
    <section id="opening-forecast" className={`${t.card} p-4 sm:p-5`} aria-labelledby="opening-forecast-title">
      <header className="flex flex-wrap items-start gap-3 border-b border-current/10 pb-4">
        <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${isDark ? "bg-[#436850]/15 text-[#8dcc9b]" : "bg-[#e8f0e5] text-[#315640]"}`}>
          <BookOpen aria-hidden="true" className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 id="opening-forecast-title" className={`text-sm font-bold ${t.textPrimary}`}>Opening Forecast</h2>
          <p className={`mt-0.5 text-xs ${t.textTertiary}`}>
            You play {submittedColor === "white" ? "White" : "Black"}. Every branch is replayed from a legal position.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setFlipped(value => !value)}
          className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B9A6A] ${isDark ? "text-white/65 hover:bg-white/5 hover:text-white" : "text-[#436850] hover:bg-[#e8f0e5]"}`}
          aria-label="Flip chessboard orientation"
        >
          <FlipVertical2 aria-hidden="true" className="h-4 w-4" />
          <span className="hidden sm:inline">Flip board</span>
        </button>
      </header>

      <div className="mt-4 grid gap-5 xl:grid-cols-[minmax(280px,440px)_minmax(300px,1fr)]">
        <div className="min-w-0">
          <div className="overflow-hidden rounded-xl">
            <p id="forecast-board-instructions" role="status" aria-live="polite" className="sr-only">{positionDescription} {screenReaderInstructions}</p>
            <div aria-hidden="true" inert>
            <Chessboard
              options={{
                position: replay?.fen ?? new Chess().fen(),
                boardOrientation: flipped ? "black" : "white",
                allowDragging: false,
                animationDurationInMs: prefersReducedMotion ? 0 : 180,
                darkSquareStyle: { backgroundColor: isDark ? "#294330" : "#769656" },
                lightSquareStyle: { backgroundColor: isDark ? "#dfe8d9" : "#eeeed2" },
                boardStyle: { borderRadius: "12px", boxShadow: isDark ? "0 12px 30px rgba(0,0,0,.25)" : "0 12px 30px rgba(18,55,42,.12)" },
              }}
            />
            </div>
          </div>
          <p className={`mt-2 truncate rounded-lg px-3 py-2 font-mono text-[11px] ${isDark ? "bg-black/20 text-white/55" : "bg-[#f1f5ee] text-[#436850]"}`}>
            {pathLabel(displayedPath)}
          </p>
        </div>

        <div className="min-w-0">
          <div className="flex min-h-11 flex-wrap items-center gap-2">
            <span className={`mr-auto text-xs font-bold uppercase tracking-[0.12em] ${t.textSecondary}`}>{nextActor}</span>
            <button
              type="button"
              onClick={() => setSelectedPath(path => path.slice(0, -1))}
              disabled={selectedPath.length === 0}
              className={`inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B9A6A] disabled:cursor-not-allowed disabled:opacity-35 ${isDark ? "text-white/65 hover:bg-white/5" : "text-[#436850] hover:bg-[#e8f0e5]"}`}
            >
              <ChevronLeft aria-hidden="true" className="h-4 w-4" /> Back
            </button>
            <button
              type="button"
              onClick={() => setSelectedPath([])}
              disabled={selectedPath.length === 0}
              className={`inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B9A6A] disabled:cursor-not-allowed disabled:opacity-35 ${isDark ? "text-white/65 hover:bg-white/5" : "text-[#436850] hover:bg-[#e8f0e5]"}`}
            >
              <RotateCcw aria-hidden="true" className="h-4 w-4" /> Reset
            </button>
          </div>

          <div className="mt-2 space-y-2">
            {currentBranches.length > 0 ? currentBranches.map(branch => (
              <BranchButton
                key={`${selectedPath.join("-")}-${branch.moveSan}`}
                branch={branch}
                opponentUsername={opponentUsername}
                isDark={isDark}
                t={t}
                onSelect={() => {
                  setSelectedPath(path => [...path, branch.moveSan]);
                  setPreviewBranch(null);
                }}
                onPreview={setPreviewBranch}
              />
            )) : (
              <p className={`rounded-xl border border-current/10 p-4 text-sm ${t.textTertiary}`}>No further continuation met the evidence threshold.</p>
            )}
          </div>

          {selectedBranch && (
            <div className={`mt-3 rounded-xl border p-3 ${isDark ? "border-[#243028]/70 bg-[#0d1a0f]/60" : "border-[#ADBC9F]/60 bg-[#f7faf5]"}`}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className={`text-xs font-semibold ${t.textPrimary}`}>{confidenceLabel(selectedBranch.count)}</span>
                <span className={`text-[11px] ${t.textTertiary}`}>Based on {selectedBranch.count} game{selectedBranch.count === 1 ? "" : "s"} reaching this position</span>
                {selectedBranch.label && <span className={`text-[11px] font-semibold ${t.textSecondary}`}>{selectedBranch.label}</span>}
              </div>
              {analysisHref && (
                <a href={analysisHref} className={`mt-3 inline-flex min-h-11 items-center rounded-lg px-3 text-xs font-semibold ${isDark ? "bg-[#436850]/20 text-[#a7d8b1] hover:bg-[#436850]/30" : "bg-[#e8f0e5] text-[#23482f] hover:bg-[#dce9d8]"}`}>
                  Analyze this position
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
