import { useMemo, useState } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { BookOpen, Check, ChevronLeft, ChevronRight, Copy, ExternalLink, FlipVertical2, RotateCcw, SkipBack, SkipForward } from "lucide-react";

import type { ForecastBranch } from "../../../../shared/prepTypes";

interface Tokens {
  card: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  [key: string]: string;
}

interface ForecastWalkthroughProps {
  openingForecast: Record<"white" | "black", ForecastBranch[]>;
  /** @deprecated Legacy alias accepted for old links and tests. */
  myColor?: "white" | "black" | "not_sure";
  initialExplorerColor?: "white" | "black";
  isDark: boolean;
  t: Tokens;
  opponentUsername: string;
  opponentRating?: number | null;
  analysisHrefForUciPath?: (uciPath: string[]) => string | null;
}

type BoardColor = "white" | "black";

const LIVIUS_ASSETS = {
  bB: "/manus-storage/bb_f19e11d7.svg",
  bK: "/manus-storage/bk_c580017b.svg",
  bN: "/manus-storage/bn_25e1f702.svg",
  bP: "/manus-storage/bp_a43d79b8.svg",
  bQ: "/manus-storage/bq_ec463ffd.svg",
  bR: "/manus-storage/br_3d562911.svg",
  wB: "/manus-storage/wb_711c3710.svg",
  wK: "/manus-storage/wk_5db8dee7.svg",
  wN: "/manus-storage/wn_ad0aee6a.svg",
  wP: "/manus-storage/wp_338143cc.svg",
  wQ: "/manus-storage/wq_2bb887b5.svg",
  wR: "/manus-storage/wr_fdc96a34.svg",
} as const;

const LIVIUS_PIECES = Object.fromEntries(
  Object.entries(LIVIUS_ASSETS).map(([piece, src]) => [piece, () => (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      draggable={false}
      className="h-[88%] w-[88%] select-none object-contain"
    />
  )]),
);

function replayPath(path: string[]) {
  const chess = new Chess();
  const uci: string[] = [];
  const moves: Array<{ san: string; from: string; to: string; color: BoardColor }> = [];
  for (const san of path) {
    try {
      const move = chess.move(san);
      uci.push(move.from + move.to + (move.promotion ?? ""));
      moves.push({ san: move.san, from: move.from, to: move.to, color: move.color === "w" ? "white" : "black" });
    } catch {
      return null;
    }
  }
  return { fen: chess.fen(), uci, moves, turn: chess.turn() === "w" ? "white" as const : "black" as const };
}

function getPathBranches(branches: ForecastBranch[], path: string[]): ForecastBranch[] {
  const selections: ForecastBranch[] = [];
  let current = branches;
  for (const san of path) {
    const selected = current.find(branch => branch.moveSan === san);
    if (!selected) break;
    selections.push(selected);
    current = selected.children ?? [];
  }
  return selections;
}

function branchesAtPath(branches: ForecastBranch[], path: string[]): ForecastBranch[] {
  const selections = getPathBranches(branches, path);
  return selections.length === path.length ? (selections.at(-1)?.children ?? (path.length === 0 ? branches : [])) : [];
}

function pathLabel(path: string[]): string {
  if (path.length === 0) return "Starting position";
  return path.reduce<string[]>((parts, san, index) => {
    if (index % 2 === 0) parts.push(`${Math.floor(index / 2) + 1}. ${san}`);
    else parts.push(san);
    return parts;
  }, []).join(" ");
}

function describePosition({ fen, path, orientation, sideToMove, opponentUsername, submittedColor }: {
  fen: string;
  path: string[];
  orientation: BoardColor;
  sideToMove: BoardColor;
  opponentUsername: string;
  submittedColor: BoardColor;
}): string {
  const bottomPlayer = orientation === submittedColor ? "You" : opponentUsername;
  const activePlayer = sideToMove === submittedColor ? "You" : opponentUsername;
  return `${pathLabel(path)}. ${activePlayer} to move. ${bottomPlayer} is at the bottom of the board. Current FEN: ${fen}.`;
}

function actorLabel(branch: ForecastBranch, opponentUsername: string): string {
  return branch.actor === "opponent" ? `${opponentUsername}'s tendency` : "Your candidate";
}

function actorTone(branch: ForecastBranch) {
  return branch.actor === "opponent"
    ? "border-[#7ED957]/35 bg-[#7ED957]/10 text-[#d1f5ba]"
    : "border-[#FFF598]/45 bg-[#FFF598]/10 text-[#FFF598]";
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

  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={() => onPreview(branch)}
      onMouseLeave={() => onPreview(null)}
      onFocus={() => onPreview(branch)}
      onBlur={() => onPreview(null)}
      className={`group flex min-h-14 w-full items-center gap-3 rounded-lg border px-3.5 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7ED957] focus-visible:ring-offset-2 ${
        isDark
          ? "border-white/10 bg-[#0b2a20] hover:border-[#7ED957]/50 hover:bg-[#10382a] focus-visible:ring-offset-[#08241a]"
          : "border-[#bfd2b7] bg-white hover:border-[#436850]/60 hover:bg-[#f7faf5] focus-visible:ring-offset-white"
      }`}
      aria-label={`${actor}: ${branch.moveSan}. Seen in ${branch.count} of ${parentGames} games reaching this position.`}
    >
      <span className={`grid min-h-10 min-w-14 place-items-center rounded-md border px-2 font-mono text-base font-bold ${actorTone(branch)}`}>
        {branch.moveSan}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-sm font-semibold ${t.textPrimary}`}>{actor}</span>
        <span className={`mt-0.5 block truncate text-xs ${t.textTertiary}`}>{branch.label ?? "Observed continuation"}</span>
      </span>
      <span className="shrink-0 text-right">
        <span className={`block text-sm font-bold tabular-nums ${t.textSecondary}`}>{frequency}%</span>
        <span className={`block text-xs tabular-nums ${t.textTertiary}`}>{branch.count}/{parentGames}</span>
      </span>
      <ChevronRight aria-hidden="true" className={`h-4 w-4 shrink-0 ${t.textTertiary}`} />
    </button>
  );
}

function PlayerRail({
  label,
  color,
  detail,
  toMove,
  isDark,
}: {
  label: string;
  color: BoardColor;
  detail: string;
  toMove: boolean;
  isDark: boolean;
}) {
  return (
    <div className={`flex min-h-10 items-center justify-between gap-3 px-1.5 ${isDark ? "text-white/65" : "text-[#315640]"}`}>
      <div className="flex min-w-0 items-center gap-2">
        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-md text-[10px] font-bold ${color === "white" ? "border border-[#d5caa8] bg-[#F0E6C5] text-[#294330]" : "border border-white/10 bg-[#1a2621] text-white/80"}`}>
          {label === "You" ? "YOU" : label.slice(0, 2).toUpperCase()}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{label}</span>
          <span className="block text-xs opacity-70">{color === "white" ? "White pieces" : "Black pieces"}{detail ? ` · ${detail}` : ""}</span>
        </span>
      </div>
      {toMove && <span className="shrink-0 rounded-full border border-[#7ED957]/45 bg-[#7ED957]/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[#aeea91]">To move</span>}
    </div>
  );
}

export function ForecastWalkthrough({
  openingForecast,
  myColor = "white",
  initialExplorerColor,
  isDark,
  t,
  opponentUsername,
  opponentRating,
  analysisHrefForUciPath,
}: ForecastWalkthroughProps) {
  const initialColor: BoardColor = initialExplorerColor ?? (myColor === "black" ? "black" : "white");
  const [playerColor, setPlayerColor] = useState<BoardColor>(initialColor);
  const opponentColor: BoardColor = playerColor === "white" ? "black" : "white";
  const rootBranches = useMemo(() => openingForecast[opponentColor] ?? [], [openingForecast, opponentColor]);
  const [selectedPath, setSelectedPath] = useState<string[]>([]);
  const [previewBranch, setPreviewBranch] = useState<ForecastBranch | null>(null);
  const [flipped, setFlipped] = useState(initialColor === "black");
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const [prefersReducedMotion] = useState(() =>
    typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  const selectedBranches = useMemo(() => getPathBranches(rootBranches, selectedPath), [rootBranches, selectedPath]);
  const currentBranches = useMemo(() => branchesAtPath(rootBranches, selectedPath), [rootBranches, selectedPath]);
  const displayedPath = useMemo(
    () => previewBranch ? (previewBranch.previewPath ?? [...selectedPath, previewBranch.moveSan]) : selectedPath,
    [previewBranch, selectedPath],
  );
  const replay = useMemo(() => replayPath(displayedPath), [displayedPath]);
  const committedReplay = useMemo(() => replayPath(selectedPath), [selectedPath]);
  const lastMove = replay?.moves[replay.moves.length - 1];
  const sideToMove = replay?.turn ?? "white";
  const orientation: BoardColor = flipped ? "black" : "white";
  const topColor: BoardColor = orientation === "white" ? "black" : "white";
  const bottomColor: BoardColor = orientation;
  const candidateUci = previewBranch?.moveUci ?? (() => {
    if (!previewBranch) return undefined;
    return replayPath([...selectedPath, previewBranch.moveSan])?.uci.at(-1);
  })();
  const squareStyles = useMemo(() => {
    if (!lastMove) return {};
    return {
      [lastMove.from]: { backgroundColor: "rgba(255, 245, 152, 0.28)" },
      [lastMove.to]: { backgroundColor: "rgba(255, 245, 152, 0.46)", boxShadow: "inset 0 0 0 2px rgba(255, 245, 152, 0.42)" },
    };
  }, [lastMove]);
  const positionDescription = useMemo(() => describePosition({
    fen: replay?.fen ?? new Chess().fen(),
    path: displayedPath,
    orientation,
    sideToMove,
    opponentUsername,
    submittedColor: playerColor,
  }), [displayedPath, opponentUsername, orientation, playerColor, replay?.fen, sideToMove]);
  const analysisHref = selectedPath.length > 0 && analysisHrefForUciPath
    ? analysisHrefForUciPath(committedReplay?.uci ?? [])
    : null;
  const nextActor = currentBranches[0]?.actor === "opponent" ? "Opponent tendency" : "Your decision";
  const decisionPath = selectedPath.length > 0 ? selectedPath.slice(0, -1) : [];
  const topIsUser = topColor === playerColor;
  const bottomIsUser = bottomColor === playerColor;
  const topDetail = topIsUser ? "Your side" : opponentRating ? `${opponentRating} rating` : "Opponent";
  const bottomDetail = bottomIsUser ? "Your side" : opponentRating ? `${opponentRating} rating` : "Opponent";

  const handleCopyFen = async () => {
    const fen = committedReplay?.fen ?? replay?.fen ?? new Chess().fen();
    try {
      await navigator.clipboard.writeText(fen);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
  };

  if (rootBranches.length === 0) return null;

  return (
    <section id="opening-forecast" className={`${t.card} overflow-hidden p-4 sm:p-6`} aria-labelledby="opening-forecast-title">
      <header className="flex flex-wrap items-start gap-3 border-b border-current/10 pb-4 sm:pb-5">
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${isDark ? "bg-[#7ED957]/10 text-[#aeea91]" : "bg-[#e5f2df] text-[#315640]"}`}>
          <BookOpen aria-hidden="true" className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 id="opening-forecast-title" className={`text-lg font-bold tracking-tight sm:text-xl ${t.textPrimary}`}>Legal line explorer</h2>
          <p className={`mt-1 text-sm ${t.textSecondary}`}>Every move is ordered and attributed to the correct side.</p>
        </div>
        <div className={`flex items-center gap-3 text-xs font-semibold ${t.textTertiary}`} aria-label="Move ownership key">
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#FFF598]" />Your move</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#7ED957]" />Opponent move</span>
        </div>
      </header>

      <fieldset className={`mt-4 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2.5 ${isDark ? "border-white/10 bg-black/15" : "border-[#d8e1d3] bg-[#f7faf5]"}`}>
        <legend className="sr-only">Your playing color in the Legal Line Explorer</legend>
        <span className={`mr-1 text-xs font-semibold ${t.textSecondary}`}>Playing</span>
        {(["white", "black"] as const).map(color => (
          <button
            key={color}
            type="button"
            aria-pressed={playerColor === color}
            onClick={() => { setPlayerColor(color); setSelectedPath([]); setPreviewBranch(null); setFlipped(color === "black"); }}
            className={`min-h-9 rounded-md border px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7ED957] ${playerColor === color ? (isDark ? "border-[#7ED957]/55 bg-[#7ED957]/10 text-[#d7ffbc]" : "border-[#5b8c58] bg-[#e5f2df] text-[#234f31]") : (isDark ? "border-white/10 text-white/60 hover:bg-white/[0.05]" : "border-[#c8d8c1] text-[#436850] hover:bg-white")}`}
          >
            {color === "white" ? "White" : "Black"}
          </button>
        ))}
      </fieldset>

      <div className={`mt-4 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-3 ${isDark ? "border-white/10 bg-black/15" : "border-[#d8e1d3] bg-[#f7faf5]"}`} aria-label="Current legal move sequence">
        {selectedBranches.length > 0 ? selectedBranches.map((branch, index) => (
          <span key={`${branch.moveSan}-${index}`} className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 font-mono text-sm font-bold ${actorTone(branch)}`}>
            {index % 2 === 0 ? `${Math.floor(index / 2) + 1}.` : ""} {branch.moveSan}
          </span>
        )) : <span className={`text-sm ${t.textTertiary}`}>Select an observed line to begin.</span>}
      </div>

      <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,1.03fr)_minmax(22rem,.97fr)] xl:gap-10">
        <div className="min-w-0">
          <PlayerRail
            label={topIsUser ? "You" : opponentUsername}
            color={topColor}
            detail={topDetail}
            toMove={sideToMove === topColor}
            isDark={isDark}
          />
          <p id="forecast-board-instructions" role="status" aria-live="polite" className="sr-only">{positionDescription} Use the named move buttons to navigate legal continuations.</p>
          <div className={`overflow-hidden rounded-md border shadow-[0_12px_30px_rgba(0,0,0,0.16)] ${isDark ? "border-white/15 bg-[#061F17]" : "border-[#6F9F69]/50 bg-[#F0E6C5]"}`}>
            <div aria-hidden="true" inert>
              <Chessboard
                options={{
                  pieces: LIVIUS_PIECES,
                  position: replay?.fen ?? new Chess().fen(),
                  boardOrientation: orientation,
                  allowDragging: false,
                  animationDurationInMs: prefersReducedMotion ? 0 : 180,
                  showNotation: true,
                  darkSquareStyle: { backgroundColor: "#6F9F69" },
                  lightSquareStyle: { backgroundColor: "#F0E6C5" },
                  darkSquareNotationStyle: { color: "#F0E6C5", fontWeight: 700, fontSize: "11px" },
                  lightSquareNotationStyle: { color: "#294330", fontWeight: 700, fontSize: "11px" },
                  squareStyles,
                  arrows: candidateUci && previewBranch ? [{ startSquare: candidateUci.slice(0, 2), endSquare: candidateUci.slice(2, 4), color: "rgba(255,245,152,0.72)" }] : [],
                  boardStyle: { borderRadius: "5px", boxShadow: "none" },
                }}
              />
            </div>
          </div>
          <PlayerRail
            label={bottomIsUser ? "You" : opponentUsername}
            color={bottomColor}
            detail={bottomDetail}
            toMove={sideToMove === bottomColor}
            isDark={isDark}
          />

          <div className={`mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2.5 ${isDark ? "border-white/10 bg-black/15" : "border-[#d8e1d3] bg-[#f7faf5]"}`}>
            <span className={`text-xs font-medium ${t.textSecondary}`}>Position {selectedPath.length + 1} · {sideToMove === "white" ? "White" : "Black"} to move</span>
            <span className={`max-w-full truncate font-mono text-[11px] ${t.textTertiary}`}>{pathLabel(displayedPath)}</span>
          </div>
          <div className="mt-3 grid grid-cols-5 gap-2" aria-label="Replay controls">
            <button type="button" onClick={() => setSelectedPath([])} disabled={selectedPath.length === 0} className={`inline-flex min-h-11 items-center justify-center gap-1 rounded-md border px-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${isDark ? "border-white/10 bg-white/[0.04] text-white/75 hover:bg-white/[0.09]" : "border-[#c8d8c1] bg-white text-[#315640] hover:bg-[#f2f7ef]"}`}><SkipBack aria-hidden="true" className="h-3.5 w-3.5" /><span className="hidden sm:inline">Start</span></button>
            <button type="button" onClick={() => setSelectedPath(path => path.slice(0, -1))} disabled={selectedPath.length === 0} className={`inline-flex min-h-11 items-center justify-center gap-1 rounded-md border px-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${isDark ? "border-white/10 bg-white/[0.04] text-white/75 hover:bg-white/[0.09]" : "border-[#c8d8c1] bg-white text-[#315640] hover:bg-[#f2f7ef]"}`}><ChevronLeft aria-hidden="true" className="h-3.5 w-3.5" /><span className="hidden sm:inline">Back</span></button>
            <button type="button" onClick={() => currentBranches[0] && setSelectedPath(path => [...path, currentBranches[0].moveSan])} disabled={currentBranches.length === 0} className={`inline-flex min-h-11 items-center justify-center gap-1 rounded-md border px-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${isDark ? "border-white/10 bg-white/[0.04] text-white/75 hover:bg-white/[0.09]" : "border-[#c8d8c1] bg-white text-[#315640] hover:bg-[#f2f7ef]"}`}><span className="hidden sm:inline">Next</span><SkipForward aria-hidden="true" className="h-3.5 w-3.5" /></button>
            <button type="button" onClick={() => setSelectedPath(decisionPath)} disabled={selectedPath.length === 0} className={`inline-flex min-h-11 items-center justify-center gap-1 rounded-md border px-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${isDark ? "border-white/10 bg-white/[0.04] text-white/75 hover:bg-white/[0.09]" : "border-[#c8d8c1] bg-white text-[#315640] hover:bg-[#f2f7ef]"}`}><RotateCcw aria-hidden="true" className="h-3.5 w-3.5" /><span className="hidden sm:inline">Decision</span></button>
            <button type="button" onClick={() => setFlipped(value => !value)} aria-pressed={flipped} className={`inline-flex min-h-11 items-center justify-center gap-1 rounded-md border px-2 text-xs font-semibold transition-colors ${isDark ? "border-white/10 bg-white/[0.04] text-white/75 hover:bg-white/[0.09]" : "border-[#c8d8c1] bg-white text-[#315640] hover:bg-[#f2f7ef]"}`}><FlipVertical2 aria-hidden="true" className="h-3.5 w-3.5" /><span className="hidden sm:inline">Flip</span></button>
          </div>
        </div>

        <div className="min-w-0">
          <p className={`text-xs font-bold uppercase tracking-[0.14em] ${currentBranches[0]?.actor === "opponent" ? (isDark ? "text-[#aeea91]" : "text-[#315640]") : (isDark ? "text-[#FFF598]" : "text-[#6f6500]")}`}>{nextActor}</p>
          <h3 className={`mt-2 text-2xl font-bold tracking-tight sm:text-3xl ${t.textPrimary}`}>{currentBranches.length > 0 ? "Choose a branch to prepare" : "Observed branch complete"}</h3>
          <p className={`mt-2 text-sm leading-relaxed ${t.textSecondary}`}>{currentBranches.length > 0 ? "These are observed continuations from the selected legal position, not engine recommendations." : "Use Start, Back, or Decision to review an earlier position."}</p>

          <div className="mt-5 space-y-2.5">
            {currentBranches.length > 0 ? currentBranches.map(branch => (
              <BranchButton key={`${selectedPath.join("-")}-${branch.moveSan}`} branch={branch} opponentUsername={opponentUsername} isDark={isDark} t={t} onSelect={() => { setSelectedPath(path => [...path, branch.moveSan]); setPreviewBranch(null); }} onPreview={setPreviewBranch} />
            )) : (
              <div className={`rounded-lg border p-4 text-sm ${isDark ? "border-white/10 bg-black/15" : "border-[#d8e1d3] bg-[#f7faf5]"} ${t.textSecondary}`}>No further continuation met the evidence threshold.</div>
            )}
          </div>

          <div className={`mt-5 rounded-lg border p-4 ${isDark ? "border-white/10 bg-[#0b2a20]" : "border-[#c8d8c1] bg-[#f7faf5]"}`}>
            <p className={`text-[10px] font-bold uppercase tracking-[0.14em] ${t.textTertiary}`}>Observed recent branch</p>
            <p className={`mt-2 font-mono text-base font-bold ${t.textPrimary}`}>{pathLabel(selectedPath)}</p>
            <p className={`mt-2 text-sm leading-relaxed ${t.textSecondary}`}>{selectedBranches.at(-1) ? `Seen in ${selectedBranches.at(-1)!.count} of ${selectedBranches.at(-1)!.parentGames ?? selectedBranches.at(-1)!.count} games reaching this position.` : "Select a branch to see its supporting evidence."}</p>
            {analysisHref && <a href={analysisHref} className={`mt-3 inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7ED957] ${isDark ? "bg-[#7ED957]/10 text-[#b9f29c] hover:bg-[#7ED957]/15" : "bg-[#e5f2df] text-[#315640] hover:bg-[#d8ebd1]"}`}>Open supporting analysis <ExternalLink aria-hidden="true" className="h-4 w-4" /></a>}
          </div>

          <div className={`mt-4 rounded-lg border p-4 ${isDark ? "border-white/10 bg-black/15" : "border-[#c8d8c1] bg-white"}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className={`text-[10px] font-bold uppercase tracking-[0.14em] ${t.textTertiary}`}>Position to practice</p>
                <p className={`mt-1 text-sm font-semibold ${t.textPrimary}`}>{sideToMove === playerColor ? "Your move" : "Opponent to move"}</p>
              </div>
              <button type="button" onClick={() => void handleCopyFen()} className={`inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7ED957] ${isDark ? "bg-[#7ED957] text-[#08241a] hover:bg-[#a0e87d]" : "bg-[#315640] text-white hover:bg-[#23482f]"}`}>
                {copyStatus === "copied" ? <Check aria-hidden="true" className="h-4 w-4" /> : <Copy aria-hidden="true" className="h-4 w-4" />}
                {copyStatus === "copied" ? "Copied" : "Copy FEN"}
              </button>
            </div>
            <code className={`mt-3 block break-all rounded-md border px-3 py-2.5 text-xs leading-relaxed ${isDark ? "border-white/10 bg-black/20 text-white/70" : "border-[#d8e1d3] bg-[#f7faf5] text-[#315640]"}`}>{committedReplay?.fen ?? replay?.fen ?? new Chess().fen()}</code>
            <p aria-live="polite" className={`mt-2 text-xs ${copyStatus === "failed" ? "text-red-500" : t.textTertiary}`}>{copyStatus === "failed" ? "Unable to copy the FEN. Select and copy it manually." : "Use this legal position for focused rehearsal."}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
