/**
 * Game Analysis — /game/:gameId/analysis
 *
 * Full post-game analysis view with:
 *   - Interactive chessboard (react-chessboard)
 *   - Horizontal eval bar (mobile) / vertical (desktop)
 *   - Color-coded move list with auto-scroll
 *   - Engine summary panel (accuracy, mistakes, key moments)
 *   - Move navigation (keyboard arrows, click, buttons)
 */
import {useState, useEffect, useCallback, useRef, useMemo} from "react";
import { useRoute, useLocation } from "wouter";
import { Chessboard } from "react-chessboard";
import { NavLogo } from "@/components/NavLogo";
import { useTheme } from "../contexts/ThemeContext";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  RotateCcw,
  Loader2,
  AlertCircle,
  Target as _Target,
  TrendingDown as _TrendingDown,
  Zap,
  Award as _Award,
  ArrowLeft,
  Share2,
  Download,
  CheckCircle2,
} from "lucide-react";
import { GameHighlightCard } from "@/components/GameHighlightCard";
import { buildAnnotatedPgn, downloadPgn } from "@/lib/exportPgn";
import { GameVideoPlayer, type MoveTimestamp } from "@/components/GameVideoPlayer";
import { FenScrubber, type FenEntry } from "@/components/FenScrubber";
import { logger } from "@/lib/logger";

import { authFetch } from "@/lib/apiFetch";
import { Chess } from "chess.js";
// ── Types ────────────────────────────────────────────────────────────────────
interface MoveAnalysis {
  id: string;
  gameId: string;
  moveNumber: number;
  color: string;
  san: string;
  fen: string;
  eval: number | null;
  bestMove: string | null;
  classification: string | null;
  winChance: number | null;
  continuation: string | null;
}

interface GameData {
  id: string;
  sessionId: string;
  pgn: string;
  whitePlayer: string | null;
  blackPlayer: string | null;
  result: string | null;
  event: string | null;
  date: string | null;
  totalMoves: number | null;
  openingName: string | null;
  openingEco: string | null;
  // JSON string of MoveTimestamp[] — populated when game came from a video recording
  moveTimestamps: string | null;
}

interface AnalysisSummary {
  totalMoves: number;
  white: PlayerSummary;
  black: PlayerSummary;
}

interface PlayerSummary {
  inaccuracies: number;
  mistakes: number;
  blunders: number;
  bestMoves: number;
  goodMoves: number;
  accuracy: number;
  accuracyLabel?: string;
  bestMoveStreak?: number;
}

interface KeyMoment {
  moveNumber: number;
  color: string;
  san: string;
  classification: string;
  evalSwing: number;
}

interface AnalysisResponse {
  game: GameData;
  session: { status: string; videoKey?: string | null } | null;
  analyses: MoveAnalysis[];
  summary: AnalysisSummary;
  keyMoments: KeyMoment[];
  fenTimeline: FenEntry[];
}

// ── Classification colors ───────────────────────────────────────────────────
const CLASSIFICATION_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  best: { bg: "bg-emerald-500/20", text: "text-emerald-400", dot: "bg-emerald-400" },
  good: { bg: "bg-green-500/20", text: "text-green-400", dot: "bg-green-400" },
  inaccuracy: { bg: "bg-yellow-500/20", text: "text-yellow-400", dot: "bg-yellow-400" },
  mistake: { bg: "bg-orange-500/20", text: "text-orange-400", dot: "bg-orange-400" },
  blunder: { bg: "bg-red-500/20", text: "text-red-400", dot: "bg-red-400" },
};

const CLASSIFICATION_COLORS_LIGHT: Record<string, { bg: string; text: string; dot: string }> = {
  best: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  good: { bg: "bg-green-50", text: "text-green-700", dot: "bg-green-500" },
  inaccuracy: { bg: "bg-yellow-50", text: "text-yellow-700", dot: "bg-yellow-500" },
  mistake: { bg: "bg-orange-50", text: "text-orange-700", dot: "bg-orange-500" },
  blunder: { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500" },
};

// ── Eval Bar Component ──────────────────────────────────────────────────────
function EvalBar({
  evalCp,
  isDark,
  orientation,
}: {
  evalCp: number;
  isDark: boolean;
  orientation: "horizontal" | "vertical";
}) {
  // Convert centipawns to white percentage (50% = equal, 100% = white winning)
  const clampedEval = Math.max(-1000, Math.min(1000, evalCp));
  const whitePercent = 50 + (clampedEval / 1000) * 50;

  const evalDisplay =
    Math.abs(evalCp) >= 10000
      ? evalCp > 0
        ? "M" + Math.ceil((10000 - Math.abs(evalCp)) / 100)
        : "-M" + Math.ceil((10000 - Math.abs(evalCp)) / 100)
      : (evalCp / 100).toFixed(1);

  if (orientation === "horizontal") {
    return (
      <div className="w-full space-y-1">
        <div
          className={`h-4 rounded-full overflow-hidden flex ${
            isDark ? "bg-white/20" : "bg-[#ADBC9F]"
          }`}
        >
          <div
            className="bg-white transition-all duration-500 ease-out rounded-l-full"
            style={{ width: `${whitePercent}%` }}
          />
          <div
            className="bg-[#12372A] transition-all duration-500 ease-out rounded-r-full flex-1"
          />
        </div>
        <div className="flex justify-between text-[10px] font-mono">
          <span className={isDark ? "text-white/40" : "text-[#436850]"}>
            {evalCp >= 0 ? `+${evalDisplay}` : evalDisplay}
          </span>
          <span className={isDark ? "text-white/40" : "text-[#436850]"}>
            {evalCp >= 0 ? "White" : "Black"}
          </span>
        </div>
      </div>
    );
  }

  // Vertical eval bar (desktop)
  return (
    <div className="flex flex-col items-center gap-1 h-full">
      <span
        className={`text-[10px] font-mono font-bold ${
          evalCp >= 0
            ? isDark ? "text-white" : "text-[#12372A]"
            : isDark ? "text-white/60" : "text-[#436850]"
        }`}
      >
        {evalCp >= 0 ? `+${evalDisplay}` : evalDisplay}
      </span>
      <div
        className={`w-6 flex-1 rounded-full overflow-hidden flex flex-col ${
          isDark ? "bg-white/20" : "bg-[#ADBC9F]"
        }`}
      >
        <div
          className="bg-[#12372A] transition-all duration-500 ease-out rounded-t-full"
          style={{ height: `${100 - whitePercent}%` }}
        />
        <div
          className="bg-white transition-all duration-500 ease-out rounded-b-full flex-1"
        />
      </div>
    </div>
  );
}

// ── Move List Component ─────────────────────────────────────────────────────
function MoveList({
  analyses,
  currentIndex,
  onSelectMove,
  isDark,
}: {
  analyses: MoveAnalysis[];
  currentIndex: number;
  onSelectMove: (index: number) => void;
  isDark: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (activeRef.current && scrollRef.current) {
      activeRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [currentIndex]);

  // Group moves into pairs (white + black)
  const movePairs: Array<{
    number: number;
    white?: { analysis: MoveAnalysis; index: number };
    black?: { analysis: MoveAnalysis; index: number };
  }> = [];

  for (let i = 0; i < analyses.length; i++) {
    const a = analyses[i];
    const pairIdx = a.moveNumber - 1;
    if (!movePairs[pairIdx]) {
      movePairs[pairIdx] = { number: a.moveNumber };
    }
    if (a.color === "w") {
      movePairs[pairIdx].white = { analysis: a, index: i };
    } else {
      movePairs[pairIdx].black = { analysis: a, index: i };
    }
  }

  const colors = isDark ? CLASSIFICATION_COLORS : CLASSIFICATION_COLORS_LIGHT;

  return (
    <div
      ref={scrollRef}
      className={`overflow-y-auto max-h-[300px] lg:max-h-[500px] rounded-xl border ${
        isDark ? "border-white/10 bg-white/5" : "border-[#ADBC9F] bg-white"
      }`}
    >
      <div className="p-2 space-y-0.5">
        {movePairs.map((pair) => (
          <div key={pair.number} className="flex items-center gap-1">
            <span
              className={`w-8 text-right text-[11px] font-mono flex-shrink-0 ${
                isDark ? "text-white/30" : "text-[#436850]"
              }`}
            >
              {pair.number}.
            </span>
            {/* White move */}
            {pair.white ? (
              <button
                ref={pair.white.index === currentIndex ? activeRef : undefined}
                onClick={() => onSelectMove(pair.white!.index)}
                className={`flex-1 flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-mono transition-all ${
                  pair.white.index === currentIndex
                    ? isDark
                      ? "bg-[#436850] text-white"
                      : "bg-[#436850] text-white"
                    : pair.white.analysis.classification &&
                        pair.white.analysis.classification !== "best" &&
                        pair.white.analysis.classification !== "good"
                      ? `${colors[pair.white.analysis.classification]?.bg ?? ""} ${
                          colors[pair.white.analysis.classification]?.text ?? ""
                        }`
                      : isDark
                        ? "text-white/70 hover:bg-white/5"
                        : "text-[#12372A]/85 hover:bg-[#FBFADA]"
                }`}
              >
                {pair.white.analysis.classification &&
                  pair.white.analysis.classification !== "best" &&
                  pair.white.analysis.classification !== "good" && (
                    <span
                      className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                        colors[pair.white.analysis.classification]?.dot ?? ""
                      }`}
                    />
                  )}
                {pair.white.analysis.san}
              </button>
            ) : (
              <span className="flex-1" />
            )}
            {/* Black move */}
            {pair.black ? (
              <button
                ref={pair.black.index === currentIndex ? activeRef : undefined}
                onClick={() => onSelectMove(pair.black!.index)}
                className={`flex-1 flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-mono transition-all ${
                  pair.black.index === currentIndex
                    ? isDark
                      ? "bg-[#436850] text-white"
                      : "bg-[#436850] text-white"
                    : pair.black.analysis.classification &&
                        pair.black.analysis.classification !== "best" &&
                        pair.black.analysis.classification !== "good"
                      ? `${colors[pair.black.analysis.classification]?.bg ?? ""} ${
                          colors[pair.black.analysis.classification]?.text ?? ""
                        }`
                      : isDark
                        ? "text-white/70 hover:bg-white/5"
                        : "text-[#12372A]/85 hover:bg-[#FBFADA]"
                }`}
              >
                {pair.black.analysis.classification &&
                  pair.black.analysis.classification !== "best" &&
                  pair.black.analysis.classification !== "good" && (
                    <span
                      className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                        colors[pair.black.analysis.classification]?.dot ?? ""
                      }`}
                    />
                  )}
                {pair.black.analysis.san}
              </button>
            ) : (
              <span className="flex-1" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Summary Panel ───────────────────────────────────────────────────────────
function SummaryPanel({
  summary,
  game,
  keyMoments,
  isDark,
  onSelectMoment,
}: {
  summary: AnalysisSummary;
  game: GameData;
  keyMoments: KeyMoment[];
  isDark: boolean;
  onSelectMoment: (moveNumber: number, color: string) => void;
}) {
  const colors = isDark ? CLASSIFICATION_COLORS : CLASSIFICATION_COLORS_LIGHT;

  return (
    <div className="space-y-4">
      {/* Accuracy comparison */}
      <div
        className={`rounded-xl border p-4 ${
          isDark ? "border-white/10 bg-white/5" : "border-[#ADBC9F] bg-white"
        }`}
      >
        <h3
          className={`text-xs font-semibold uppercase tracking-wider mb-3 ${
            isDark ? "text-white/40" : "text-[#436850]"
          }`}
        >
          Accuracy
        </h3>
        {/* Opening badge — shown above the accuracy grid */}
        {(game.openingName || game.openingEco) && (
          <div
            className={`flex items-center gap-2 mb-3 px-3 py-2 rounded-lg text-xs ${
              isDark ? "bg-white/5 text-white/70" : "bg-[#FBFADA]/70 text-[#436850]"
            }`}
          >
            <span className="text-[10px] font-bold tracking-wider text-[#436850] shrink-0">
              {game.openingEco ?? "ECO"}
            </span>
            <span className="truncate">
              {game.openingName ?? "Unknown Opening"}
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          {/* White */}
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-2">
              <div className="w-3 h-3 rounded-full bg-white border border-[#ADBC9F]" />
              <span
                className={`text-xs font-medium truncate ${
                  isDark ? "text-white/70" : "text-[#12372A]/85"
                }`}
              >
                {game.whitePlayer || "White"}
              </span>
            </div>
            <div className="text-3xl font-bold text-[#436850]">
              {summary.white.accuracy}%
            </div>
            {summary.white.accuracyLabel && (
              <div className={`text-[10px] font-semibold uppercase tracking-wider ${
                isDark ? "text-white/30" : "text-[#436850]"
              }`}>
                {summary.white.accuracyLabel}
              </div>
            )}
            <div className="space-y-1">
              <StatRow
                label="Best"
                count={summary.white.bestMoves}
                cls="best"
                colors={colors}
                isDark={isDark}
              />
              <StatRow
                label="Inaccuracies"
                count={summary.white.inaccuracies}
                cls="inaccuracy"
                colors={colors}
                isDark={isDark}
              />
              <StatRow
                label="Mistakes"
                count={summary.white.mistakes}
                cls="mistake"
                colors={colors}
                isDark={isDark}
              />
              <StatRow
                label="Blunders"
                count={summary.white.blunders}
                cls="blunder"
                colors={colors}
                isDark={isDark}
              />
              {(summary.white.bestMoveStreak ?? 0) > 2 && (
                <div className={`text-[10px] pt-1 ${
                  isDark ? "text-emerald-400/70" : "text-emerald-600"
                }`}>
                  {summary.white.bestMoveStreak}-move streak
                </div>
              )}
            </div>
          </div>
          {/* Black */}
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#12372A] dark:bg-white/40" />
              <span
                className={`text-xs font-medium truncate ${
                  isDark ? "text-white/70" : "text-[#12372A]/85"
                }`}
              >
                {game.blackPlayer || "Black"}
              </span>
            </div>
            <div className="text-3xl font-bold text-[#436850]">
              {summary.black.accuracy}%
            </div>
            {summary.black.accuracyLabel && (
              <div className={`text-[10px] font-semibold uppercase tracking-wider ${
                isDark ? "text-white/30" : "text-[#436850]"
              }`}>
                {summary.black.accuracyLabel}
              </div>
            )}
            <div className="space-y-1">
              <StatRow
                label="Best"
                count={summary.black.bestMoves}
                cls="best"
                colors={colors}
                isDark={isDark}
              />
              <StatRow
                label="Inaccuracies"
                count={summary.black.inaccuracies}
                cls="inaccuracy"
                colors={colors}
                isDark={isDark}
              />
              <StatRow
                label="Mistakes"
                count={summary.black.mistakes}
                cls="mistake"
                colors={colors}
                isDark={isDark}
              />
              <StatRow
                label="Blunders"
                count={summary.black.blunders}
                cls="blunder"
                colors={colors}
                isDark={isDark}
              />
              {(summary.black.bestMoveStreak ?? 0) > 2 && (
                <div className={`text-[10px] pt-1 ${
                  isDark ? "text-emerald-400/70" : "text-emerald-600"
                }`}>
                  {summary.black.bestMoveStreak}-move streak
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Game info */}
      <div
        className={`rounded-xl border p-4 ${
          isDark ? "border-white/10 bg-white/5" : "border-[#ADBC9F] bg-white"
        }`}
      >
        <h3
          className={`text-xs font-semibold uppercase tracking-wider mb-2 ${
            isDark ? "text-white/40" : "text-[#436850]"
          }`}
        >
          Game Info
        </h3>
        <div className="space-y-1.5 text-xs">
          {game.event && (
            <InfoRow label="Event" value={game.event} isDark={isDark} />
          )}
          {game.date && (
            <InfoRow label="Date" value={game.date} isDark={isDark} />
          )}
          <InfoRow
            label="Result"
            value={game.result ?? "*"}
            isDark={isDark}
          />
          <InfoRow
            label="Moves"
            value={String(summary.totalMoves)}
            isDark={isDark}
          />
          {game.openingName && (
            <InfoRow
              label="Opening"
              value={`${game.openingEco ? game.openingEco + " " : ""}${game.openingName}`}
              isDark={isDark}
            />
          )}
        </div>
      </div>

      {/* Key moments */}
      {keyMoments.length > 0 && (
        <div
          className={`rounded-xl border p-4 ${
            isDark ? "border-white/10 bg-white/5" : "border-[#ADBC9F] bg-white"
          }`}
        >
          <h3
            className={`text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5 ${
              isDark ? "text-white/40" : "text-[#436850]"
            }`}
          >
            <Zap className="w-3 h-3" />
            Key Moments
          </h3>
          <div className="space-y-1.5">
            {keyMoments.map((m, i) => {
              const cls = m.classification;
              const c = colors[cls] ?? colors["good"];
              return (
                <button
                  key={i}
                  onClick={() => onSelectMoment(m.moveNumber, m.color)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors ${
                    isDark ? "hover:bg-white/5" : "hover:bg-[#FBFADA]"
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                  <span className="font-mono">
                    {m.moveNumber}
                    {m.color === "w" ? "." : "..."} {m.san}
                  </span>
                  <span className={`ml-auto text-[10px] font-medium ${c.text}`}>
                    {cls}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function StatRow({
  label,
  count,
  cls,
  colors,
  isDark,
}: {
  label: string;
  count: number;
  cls: string;
  colors: Record<string, { bg: string; text: string; dot: string }>;
  isDark: boolean;
}) {
  const c = colors[cls];
  return (
    <div className="flex items-center justify-between text-[11px]">
      <div className="flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full ${c?.dot ?? ""}`} />
        <span className={isDark ? "text-white/50" : "text-[#436850]"}>
          {label}
        </span>
      </div>
      <span className={`font-semibold ${c?.text ?? ""}`}>{count}</span>
    </div>
  );
}

function InfoRow({
  label,
  value,
  isDark,
}: {
  label: string;
  value: string;
  isDark: boolean;
}) {
  return (
    <div className="flex justify-between">
      <span className={isDark ? "text-white/40" : "text-[#436850]"}>
        {label}
      </span>
      <span className={`font-medium ${isDark ? "text-white/80" : "text-[#12372A]/85"}`}>
        {value}
      </span>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────
export default function GameAnalysis() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [, navigate] = useLocation();
  const [matched, params] = useRoute("/game/:gameId/analysis");

  const [data, setData] = useState<AnalysisResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1); // -1 = starting position
  const [boardOrientation, setBoardOrientation] = useState<"white" | "black">("white");
  const [highlightStatus, setHighlightStatus] = useState<"idle" | "generating" | "done">("idle");
  const [pgnDownloadStatus, setPgnDownloadStatus] = useState<"idle" | "done">("idle");
  const [selectedFenEntry, setSelectedFenEntry] = useState<FenEntry | null>(null);
  const [showCompletionReport, setShowCompletionReport] = useState(false);
  const highlightCardRef = useRef<HTMLDivElement>(null);

  const gameId = matched ? params?.gameId : null;
  // Prevent double-firing the auto-analysis trigger
  const autoAnalysisFired = useRef(false);
  // Track previous analyzing state to detect the transition to complete
  const wasAnalyzing = useRef(false);

  // ── Fetch analysis data ────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!gameId) return;

    let polling = true;
    const fetchData = async () => {
      try {
        const res = await authFetch(`/api/games/${gameId}/analysis`);
        if (!res.ok) throw new Error("Failed to load analysis");
        const json = (await res.json()) as AnalysisResponse;
        setData(json);
        setLoading(false);

        // Auto-trigger analysis for unanalyzed imported games
        const hasNoAnalysis = json.analyses.length === 0;
        const isNotAnalyzing = json.session?.status !== "analyzing";
        const hasPgn = !!json.game.pgn;
        if (hasNoAnalysis && isNotAnalyzing && hasPgn && !autoAnalysisFired.current) {
          autoAnalysisFired.current = true;
          authFetch(`/api/games/${gameId}/analyze`, { method: "POST", credentials: "include" })
            .then(() => {
              // Start polling now that analysis is running
              setTimeout(() => { if (polling) fetchData(); }, 2000);
            })
            .catch(() => {});
          return;
        }

        // Detect transition from analyzing → complete to show the summary report
        const nowAnalyzing = json.session?.status === "analyzing";
        if (wasAnalyzing.current && !nowAnalyzing && json.analyses.length > 0) {
          setShowCompletionReport(true);
        }
        wasAnalyzing.current = nowAnalyzing;

        // If still analyzing, poll every 3 seconds
        if (
          nowAnalyzing &&
          json.analyses.length < (json.game.totalMoves ?? 0) * 2
        ) {
          setTimeout(() => {
            if (polling) fetchData();
          }, 3000);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
        setLoading(false);
      }
    };

    fetchData();
    return () => {
      polling = false;
    };
  }, [gameId]);

  // ── Compute FEN for current move ────────────────────────────────────────
  // When a FEN entry is selected from the scrubber, show that detected position.
  // Otherwise show the PGN-derived FEN from the Stockfish analysis.
  const currentFen = useMemo(() => {
    if (selectedFenEntry) {
      // FEN scrubber mode — show the raw detected position
      return selectedFenEntry.fen;
    }
    if (!data || currentMoveIndex < 0) {
      return "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    }
    const analysis = data.analyses[currentMoveIndex];
    return analysis?.fen ?? "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  }, [data, currentMoveIndex, selectedFenEntry]);

  const currentEval = useMemo(() => {
    if (selectedFenEntry) return 0; // No eval for raw detected positions
    if (!data || currentMoveIndex < 0) return 0;
    return data.analyses[currentMoveIndex]?.eval ?? 0;
  }, [data, currentMoveIndex, selectedFenEntry]);

  // ── Last-move highlight squares ─────────────────────────────────────────────
  // Derive from/to squares by replaying the SAN on the previous FEN.
  const lastMoveSquares = useMemo<{ from: string; to: string } | null>(() => {
    if (selectedFenEntry || !data || currentMoveIndex < 0) return null;
    const analysis = data.analyses[currentMoveIndex];
    if (!analysis?.san) return null;
    const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    const prevFen =
      currentMoveIndex === 0
        ? STARTING_FEN
        : (data.analyses[currentMoveIndex - 1]?.fen ?? STARTING_FEN);
    try {
      const chess = new Chess(prevFen);
      const move = chess.move(analysis.san);
      if (!move) return null;
      return { from: move.from, to: move.to };
    } catch {
      return null;
    }
  }, [data, currentMoveIndex, selectedFenEntry]);

  // ── Best-move arrow ─────────────────────────────────────────────────────────
  // Convert bestMove SAN → from/to squares using the pre-move FEN.
  // Only show when the played move was NOT already the best move.
  type ChessArrow = { startSquare: string; endSquare: string; color: string };
  const bestMoveArrow = useMemo<ChessArrow[]>(() => {
    if (selectedFenEntry || !data || currentMoveIndex < 0) return [];
    const analysis = data.analyses[currentMoveIndex];
    if (!analysis?.bestMove || analysis.classification === "best") return [];
    const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    const prevFen =
      currentMoveIndex === 0
        ? STARTING_FEN
        : (data.analyses[currentMoveIndex - 1]?.fen ?? STARTING_FEN);
    try {
      const chess = new Chess(prevFen);
      const move = chess.move(analysis.bestMove);
      if (!move) return [];
      return [{ startSquare: move.from, endSquare: move.to, color: "#38bdf8" }];
    } catch {
      return [];
    }
  }, [data, currentMoveIndex, selectedFenEntry]);

  // ── Keyboard navigation ─────────────────────────────────────────────────
  // Use functional setState so these callbacks never need to close over `data`
  // or `currentMoveIndex` — they always see the latest state via the updater fn.
  const goFirst = useCallback(() => setCurrentMoveIndex(-1), []);
  const goPrev = useCallback(
    () => setCurrentMoveIndex((i) => Math.max(-1, i - 1)),
    []
  );
  // Store the analyses length in a ref so goNext/goLast are stable (no data dep)
  const analysesLengthRef = useRef(0);
  useEffect(() => {
    analysesLengthRef.current = data?.analyses.length ?? 0;
  }, [data]);
  const goNext = useCallback(
    () =>
      setCurrentMoveIndex((i) =>
        Math.min(analysesLengthRef.current - 1, i + 1)
      ),
    []
  );
  const goLast = useCallback(
    () => setCurrentMoveIndex(analysesLengthRef.current - 1),
    []
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore key-repeat events (fired when key is held down) — each press
      // should advance exactly one move.
      if (e.repeat) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      } else if (e.key === "Home") {
        e.preventDefault();
        goFirst();
      } else if (e.key === "End") {
        e.preventDefault();
        goLast();
      } else if (e.key === "f") {
        setBoardOrientation((o) => (o === "white" ? "black" : "white"));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // goFirst/goPrev/goNext/goLast are now all stable (no data dependency),
    // so this effect registers exactly once and never re-registers.
  }, [goFirst, goPrev, goNext, goLast]);

  // ── Handle key moment click ─────────────────────────────────────────────
  const handleSelectMoment = useCallback(
    (moveNumber: number, color: string) => {
      if (!data) return;
      const idx = data.analyses.findIndex(
        (a) => a.moveNumber === moveNumber && a.color === color
      );
      if (idx >= 0) setCurrentMoveIndex(idx);
    },
    [data]
  );

  // ── Critical moment (biggest eval swing) ───────────────────────────────────
  const criticalMoment = useMemo(() => {
    if (!data || data.analyses.length === 0) return null;
    let maxSwing = 0;
    let best: (typeof data.analyses)[0] | null = null;
    for (let i = 1; i < data.analyses.length; i++) {
      const prev = data.analyses[i - 1];
      const curr = data.analyses[i];
      if (prev.eval === null || curr.eval === null) continue;
      const swing = Math.abs(curr.eval - prev.eval);
      if (swing > maxSwing) {
        maxSwing = swing;
        best = curr;
      }
    }
    return best ? { analysis: best, swing: maxSwing } : null;
  }, [data]);

  // ── Share / Download highlight ─────────────────────────────────────────────
  const handleShareHighlight = useCallback(async () => {
    if (!highlightCardRef.current || !data) return;
    setHighlightStatus("generating");
    try {
      const { toBlob: htiToBlob } = await import("html-to-image");
      const blobResult = await htiToBlob(highlightCardRef.current, {
        pixelRatio: 2,
        fetchRequestInit: { mode: "cors" },
      });
      if (!blobResult) throw new Error("html-to-image toBlob returned null");
      const blob = blobResult;

      const white = data.game.whitePlayer || "White";
      const black = data.game.blackPlayer || "Black";
      const cls = criticalMoment?.analysis.classification ?? "move";
      const mv = criticalMoment
        ? `${criticalMoment.analysis.moveNumber}${criticalMoment.analysis.color === "w" ? "." : "..."} ${criticalMoment.analysis.san}`
        : "";
      const shareText = `${white} vs ${black} — ${cls} on ${mv} #ChessOTB #ChessOTBclub`;
      const file = new File([blob], "chess-highlight.png", { type: "image/png" });

      // Try native share with image file
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "Chess Game Highlight", text: shareText });
      } else if (navigator.share) {
        await navigator.share({ title: "Chess Game Highlight", text: shareText, url: window.location.href });
      } else {
        // Fallback: trigger download
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `chess-highlight-${data.game.id?.slice(0, 8) ?? "game"}.png`;
        a.click();
        URL.revokeObjectURL(url);
      }

      setHighlightStatus("done");
      setTimeout(() => setHighlightStatus("idle"), 3000);
    } catch (err) {
      logger.error("Highlight generation failed:", err);
      setHighlightStatus("idle");
    }
  }, [data, criticalMoment]);

  // ── Download annotated PGN ───────────────────────────────────────────────
  const handleDownloadPgn = useCallback(() => {
    if (!data) return;
    const pgn = buildAnnotatedPgn(data.game, data.analyses);
    downloadPgn(pgn, data.game);
    setPgnDownloadStatus("done");
    setTimeout(() => setPgnDownloadStatus("idle"), 2500);
  }, [data]);

  const handleDownloadHighlight = useCallback(async () => {
    if (!highlightCardRef.current || !data) return;
    setHighlightStatus("generating");
    try {
      const { toPng: htiToPng } = await import("html-to-image");
      const url = await htiToPng(highlightCardRef.current, {
        pixelRatio: 2,
        fetchRequestInit: { mode: "cors" },
      });
      const a = document.createElement("a");
      a.href = url;
      a.download = `chess-highlight-${data.game.id?.slice(0, 8) ?? "game"}.png`;
      a.click();
      setHighlightStatus("done");
      setTimeout(() => setHighlightStatus("idle"), 3000);
    } catch (err) {
      logger.error("Highlight download failed:", err);
      setHighlightStatus("idle");
    }
  }, [data]);

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center ${
          isDark ? "bg-[#0d1a0f]" : "bg-[#FBFADA]/70"
        }`}
      >
        <div className="flex flex-col items-center gap-3">
          <Loader2
            className={`w-8 h-8 animate-spin ${
              isDark ? "text-[#436850]" : "text-[#436850]"
            }`}
          />
          <span className={`text-sm ${isDark ? "text-white/50" : "text-[#436850]"}`}>
            Loading analysis…
          </span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center ${
          isDark ? "bg-[#0d1a0f]" : "bg-[#FBFADA]/70"
        }`}
      >
        <div className="flex flex-col items-center gap-3 text-center px-4">
          <AlertCircle className="w-8 h-8 text-red-400" />
          <p className={`text-sm ${isDark ? "text-white/60" : "text-[#436850]"}`}>
            {error || "Analysis not found"}
          </p>
          <button
            onClick={() => navigate("/record")}
            className="text-sm text-[#436850] hover:underline"
          >
            Go back to Game Recorder
          </button>
        </div>
      </div>
    );
  }

  const isAnalyzing = data.session?.status === "analyzing";

  // ── Video sync derived values ───────────────────────────────────────────────
  const videoKey = data.session?.videoKey ?? null;
  const parsedMoveTimestamps: MoveTimestamp[] = (() => {
    if (!data.game.moveTimestamps) return [];
    try {
      return JSON.parse(data.game.moveTimestamps) as MoveTimestamp[];
    } catch {
      return [];
    }
  })();

  const analysisProgress =
    data.game.totalMoves && data.game.totalMoves > 0
      ? Math.round((data.analyses.length / (data.game.totalMoves * 2)) * 100)
      : data.analyses.length > 0
        ? 100
        : 0;

  // FEN timeline from CV pipeline (may be empty for manually-entered games)
  const fenTimeline = data.fenTimeline ?? [];

  return (
    <div
      className={`min-h-screen ${
        isDark
          ? "bg-[#0d1a0f] text-white"
          : "bg-gradient-to-b from-gray-50 to-white text-[#12372A]"
      }`}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header
        className={`sticky top-0 z-50 backdrop-blur-xl border-b otb-header-safe ${
          isDark ? "bg-[#0d1a0f]/80 border-white/10" : "bg-white/80 border-[#ADBC9F]"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-3">
          <button
            onClick={() => navigate("/record")}
            className={`p-1.5 rounded-lg transition-colors ${
              isDark ? "hover:bg-white/10" : "hover:bg-[#ADBC9F]/50"
            }`}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <NavLogo linked={false} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium truncate">
                {data.game.whitePlayer || "White"} vs{" "}
                {data.game.blackPlayer || "Black"}
              </span>
              {data.game.result && data.game.result !== "*" && (
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    isDark ? "bg-white/10 text-white/60" : "bg-[#ADBC9F]/40 text-[#436850]"
                  }`}
                >
                  {data.game.result}
                </span>
              )}
            </div>
          </div>
          {isAnalyzing && (
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-[#436850]" />
              <span className="text-xs text-[#436850] font-medium">
                {analysisProgress}%
              </span>
            </div>
          )}
          {/* Download PGN button */}
          {!isAnalyzing && data.analyses.length > 0 && (
            <button
              onClick={handleDownloadPgn}
              title="Download annotated PGN"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                pgnDownloadStatus === "done"
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : isDark
                    ? "bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"
                    : "bg-[#ADBC9F]/40 text-[#436850] hover:bg-[#ADBC9F] hover:text-[#12372A]"
              }`}
            >
              {pgnDownloadStatus === "done" ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              {pgnDownloadStatus === "done" ? "Downloaded!" : "PGN"}
            </button>
          )}
        </div>
      </header>

      {/* ── Main Content ─────────────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left: Board + Eval + Controls */}
          <div className="flex-1 space-y-4">
            {/* Eval bar (horizontal on mobile) */}
            <div className="lg:hidden">
              <EvalBar evalCp={currentEval} isDark={isDark} orientation="horizontal" />
            </div>

            {/* FEN scrubber mode banner */}
            {selectedFenEntry && (
              <div
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs border ${
                  isDark
                    ? "bg-[#436850]/15 border-[#436850]/30 text-[#7ab88a]"
                    : "bg-[#436850]/8 border-[#436850]/20 text-[#2d5235]"
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-[#436850] animate-pulse flex-shrink-0" />
                <span className="font-medium">Detected position</span>
                <span className={isDark ? "text-white/40" : "text-[#436850]"}>
                  — CV snapshot, not from PGN
                </span>
                <button
                  onClick={() => setSelectedFenEntry(null)}
                  className={`ml-auto text-[10px] px-2 py-0.5 rounded font-medium transition-colors ${
                    isDark
                      ? "bg-white/10 hover:bg-white/20 text-white/60"
                      : "bg-[#ADBC9F] hover:bg-[#ADBC9F] text-[#436850]"
                  }`}
                >
                  Back to PGN
                </button>
              </div>
            )}

            {/* Auto-analysis progress banner — shown for imported games being analyzed */}
            {isAnalyzing && data.analyses.length === 0 && (
              <div
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
                  isDark
                    ? "bg-[#436850]/15 border-[#436850]/30 text-[#7ab88a]"
                    : "bg-[#436850]/8 border-[#436850]/20 text-[#2d5235]"
                }`}
              >
                <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Analyzing game with Stockfish…</p>
                  <p className={`text-xs mt-0.5 ${
                    isDark ? "text-white/40" : "text-[#436850]"
                  }`}>
                    Move-by-move analysis is running in the background. This page will update automatically.
                  </p>
                </div>
              </div>
            )}
            {isAnalyzing && data.analyses.length > 0 && (
              <div
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border ${
                  isDark
                    ? "bg-[#436850]/10 border-[#436850]/20 text-[#7ab88a]"
                    : "bg-[#436850]/6 border-[#436850]/15 text-[#2d5235]"
                }`}
              >
                <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
                <span className="text-xs font-medium">
                  Analyzing… {analysisProgress}% ({data.analyses.length} of {(data.game.totalMoves ?? 0) * 2} moves)
                </span>
                <div className={`ml-auto h-1.5 w-24 rounded-full overflow-hidden ${
                  isDark ? "bg-white/10" : "bg-[#ADBC9F]"
                }`}>
                  <div
                    className="h-full bg-[#436850] rounded-full transition-all duration-500"
                    style={{ width: `${analysisProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Analysis completion report — shown once when auto-analysis finishes */}
            {showCompletionReport && !isAnalyzing && data.analyses.length > 0 && (
              <div
                className={`rounded-xl border p-4 ${
                  isDark
                    ? "bg-[#0f2414] border-[#436850]/40"
                    : "bg-[#f0faf2] border-[#436850]/30"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                    <span className={`text-sm font-semibold ${
                      isDark ? "text-white" : "text-[#12372A]"
                    }`}>
                      Analysis complete
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {(() => {
                      const firstError = data.analyses.findIndex(
                        (a) => a.classification === "blunder" || a.classification === "mistake"
                      );
                      return firstError >= 0 ? (
                        <button
                          onClick={() => {
                            setCurrentMoveIndex(firstError);
                            setShowCompletionReport(false);
                          }}
                          className={`text-xs px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                            isDark
                              ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                              : "bg-red-50 text-red-600 hover:bg-red-100"
                          }`}
                        >
                          Review Mistakes
                        </button>
                      ) : null;
                    })()}
                    <button
                      onClick={() => setShowCompletionReport(false)}
                      className={`text-xs px-2 py-0.5 rounded transition-colors ${
                        isDark
                          ? "text-white/40 hover:text-white/70 hover:bg-white/10"
                          : "text-[#436850] hover:text-[#436850] hover:bg-[#ADBC9F]/50"
                      }`}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>

                {/* White summary */}
                <div className="mt-3 grid grid-cols-2 gap-3">
                  {[{ label: data.game.whitePlayer || "White", s: data.summary.white }, { label: data.game.blackPlayer || "Black", s: data.summary.black }].map(({ label, s }) => (
                    <div
                      key={label}
                      className={`rounded-lg p-3 ${
                        isDark ? "bg-white/5" : "bg-white border border-[#ADBC9F]/70"
                      }`}
                    >
                      <p className={`text-xs font-semibold mb-2 truncate ${
                        isDark ? "text-white/70" : "text-[#436850]"
                      }`}>{label}</p>
                      <div className="flex items-baseline gap-1 mb-2">
                        <span className={`text-2xl font-bold ${
                          isDark ? "text-white" : "text-[#12372A]"
                        }`}>{s.accuracy}%</span>
                        <span className={`text-xs ${
                          isDark ? "text-white/40" : "text-[#436850]"
                        }`}>accuracy</span>
                      </div>
                      <div className="space-y-1">
                        {s.blunders > 0 && (
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5 text-xs text-red-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                              Blunders
                            </span>
                            <span className="text-xs font-bold text-red-400">{s.blunders}</span>
                          </div>
                        )}
                        {s.mistakes > 0 && (
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5 text-xs text-orange-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                              Mistakes
                            </span>
                            <span className="text-xs font-bold text-orange-400">{s.mistakes}</span>
                          </div>
                        )}
                        {s.inaccuracies > 0 && (
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5 text-xs text-yellow-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                              Inaccuracies
                            </span>
                            <span className="text-xs font-bold text-yellow-400">{s.inaccuracies}</span>
                          </div>
                        )}
                        {s.blunders === 0 && s.mistakes === 0 && s.inaccuracies === 0 && (
                          <p className="text-xs text-emerald-400 font-medium">Clean game!</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Board area */}
            <div className="flex gap-3">
              {/* Vertical eval bar (desktop only) */}
              <div className="hidden lg:flex w-8">
                <EvalBar evalCp={currentEval} isDark={isDark} orientation="vertical" />
              </div>

              {/* Chessboard */}
              <div className="flex-1 max-w-[600px]">
                <Chessboard
                  options={{
                    position: currentFen,
                    boardOrientation: boardOrientation,
                    allowDragging: false,
                    boardStyle: {
                      borderRadius: "12px",
                      boxShadow: isDark
                        ? "0 8px 32px rgba(0,0,0,0.4)"
                        : "0 4px 20px rgba(0,0,0,0.1)",
                    },
                    darkSquareStyle: { backgroundColor: "#436850" },
                    lightSquareStyle: { backgroundColor: "#E8E0D5" },
                    // Last-move highlight
                    squareStyles: lastMoveSquares
                      ? {
                          [lastMoveSquares.from]: { backgroundColor: "rgba(255, 213, 79, 0.45)" },
                          [lastMoveSquares.to]: { backgroundColor: "rgba(255, 213, 79, 0.65)" },
                        }
                      : {},
                    // Best-move arrow (sky blue, only when played move wasn't best)
                    arrows: bestMoveArrow,
                    arrowOptions: {
                      color: "#38bdf8",
                      secondaryColor: "#38bdf8",
                      tertiaryColor: "#38bdf8",
                      arrowLengthReducerDenominator: 8,
                      sameTargetArrowLengthReducerDenominator: 4,
                      arrowWidthDenominator: 6,
                      activeArrowWidthMultiplier: 0.9,
                      opacity: 0.85,
                      activeOpacity: 0.5,
                      arrowStartOffset: 0.35,
                    },
                    clearArrowsOnClick: false,
                    clearArrowsOnPositionChange: true,
                  }}
                />
              </div>
            </div>

            {/* Move info */}
            {currentMoveIndex >= 0 && data.analyses[currentMoveIndex] && (
              <div
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl ${
                  isDark ? "bg-white/5" : "bg-[#FBFADA]/70"
                }`}
              >
                {(() => {
                  const a = data.analyses[currentMoveIndex];
                  const cls = a.classification ?? "good";
                  const c = (isDark ? CLASSIFICATION_COLORS : CLASSIFICATION_COLORS_LIGHT)[cls];
                  return (
                    <>
                      <span className={`w-2 h-2 rounded-full ${c?.dot ?? ""}`} />
                      <span className="text-sm font-mono font-medium">
                        {a.moveNumber}
                        {a.color === "w" ? "." : "..."} {a.san}
                      </span>
                      <span
                        className={`text-xs font-medium capitalize ${c?.text ?? ""}`}
                      >
                        {cls}
                      </span>
                      {a.bestMove && a.classification !== "best" && (
                        <span
                          className={`ml-auto text-xs ${
                            isDark ? "text-white/40" : "text-[#436850]"
                          }`}
                        >
                          Best: {a.bestMove}
                        </span>
                      )}
                    </>
                  );
                })()}
              </div>
            )}

            {/* Navigation controls */}
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={goFirst}
                disabled={currentMoveIndex <= -1}
                className={`p-2 rounded-lg transition-colors ${
                  currentMoveIndex <= -1
                    ? isDark ? "text-white/20" : "text-[#436850]/70"
                    : isDark
                      ? "text-white/60 hover:bg-white/10"
                      : "text-[#436850] hover:bg-[#ADBC9F]/50"
                }`}
              >
                <ChevronsLeft className="w-5 h-5" />
              </button>
              <button
                onClick={goPrev}
                disabled={currentMoveIndex <= -1}
                className={`p-2 rounded-lg transition-colors ${
                  currentMoveIndex <= -1
                    ? isDark ? "text-white/20" : "text-[#436850]/70"
                    : isDark
                      ? "text-white/60 hover:bg-white/10"
                      : "text-[#436850] hover:bg-[#ADBC9F]/50"
                }`}
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() =>
                  setBoardOrientation((o) => (o === "white" ? "black" : "white"))
                }
                className={`p-2 rounded-lg transition-colors ${
                  isDark
                    ? "text-white/60 hover:bg-white/10"
                    : "text-[#436850] hover:bg-[#ADBC9F]/50"
                }`}
                title="Flip board (F)"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
              <button
                onClick={goNext}
                disabled={currentMoveIndex >= data.analyses.length - 1}
                className={`p-2 rounded-lg transition-colors ${
                  currentMoveIndex >= data.analyses.length - 1
                    ? isDark ? "text-white/20" : "text-[#436850]/70"
                    : isDark
                      ? "text-white/60 hover:bg-white/10"
                      : "text-[#436850] hover:bg-[#ADBC9F]/50"
                }`}
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              <button
                onClick={goLast}
                disabled={currentMoveIndex >= data.analyses.length - 1}
                className={`p-2 rounded-lg transition-colors ${
                  currentMoveIndex >= data.analyses.length - 1
                    ? isDark ? "text-white/20" : "text-[#436850]/70"
                    : isDark
                      ? "text-white/60 hover:bg-white/10"
                      : "text-[#436850] hover:bg-[#ADBC9F]/50"
                }`}
              >
                <ChevronsRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Right: Move list + Summary */}
          <div className="lg:w-[360px] space-y-4">
            {/* Video player — only shown when this game came from a video recording */}
            {videoKey && data.game.sessionId && (
              <GameVideoPlayer
                sessionId={data.game.sessionId}
                moveTimestamps={parsedMoveTimestamps}
                currentMoveIndex={currentMoveIndex}
                totalMoves={data.analyses.length}
                isDark={isDark}
              />
            )}

            {/* FEN timeline scrubber — only shown when CV pipeline produced detected positions */}
            {fenTimeline.length > 0 && (
              <FenScrubber
                fenTimeline={fenTimeline}
                onSelectFen={(entry) => {
                  setSelectedFenEntry(entry);
                  // When returning to PGN mode, restore board to current move
                  if (!entry) setCurrentMoveIndex((i) => i);
                }}
                selectedEntry={selectedFenEntry}
                isDark={isDark}
              />
            )}

            {/* Move list */}
            <MoveList
              analyses={data.analyses}
              currentIndex={currentMoveIndex}
              onSelectMove={setCurrentMoveIndex}
              isDark={isDark}
            />

            {/* Summary panel */}
            {data.summary && (
              <SummaryPanel
                summary={data.summary}
                game={data.game}
                keyMoments={data.keyMoments}
                isDark={isDark}
                onSelectMoment={handleSelectMoment}
              />
            )}

            {/* ── Game Highlight Generator ─────────────────────────────── */}
            {criticalMoment && data.analyses.length > 0 && (
              <div
                className={`rounded-2xl border p-4 space-y-3 ${
                  isDark
                    ? "bg-[#0f1f12] border-white/10"
                    : "bg-white border-[#ADBC9F]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[#436850]" />
                  <span
                    className={`text-sm font-semibold ${
                      isDark ? "text-white" : "text-[#12372A]"
                    }`}
                  >
                    Game Highlight
                  </span>
                  <span
                    className={`ml-auto text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      isDark
                        ? "bg-white/10 text-white/50"
                        : "bg-[#ADBC9F]/40 text-[#436850]"
                    }`}
                  >
                    Move {criticalMoment.analysis.moveNumber}
                    {criticalMoment.analysis.color === "w" ? "." : "..."}{" "}
                    {criticalMoment.analysis.san}
                  </span>
                </div>

                <p
                  className={`text-xs leading-relaxed ${
                    isDark ? "text-white/50" : "text-[#436850]"
                  }`}
                >
                  The biggest swing of the game —{" "}
                  <span className="font-medium capitalize">
                    {criticalMoment.analysis.classification}
                  </span>{" "}
                  with a{" "}
                  {(criticalMoment.swing / 100).toFixed(1)} cp eval shift.
                  Share it as a 1080×1080 PNG.
                </p>

                {/* Preview thumbnail */}
                <div
                  className={`rounded-xl overflow-hidden border ${
                    isDark ? "border-white/10" : "border-[#ADBC9F]"
                  }`}
                  style={{ maxHeight: 200, overflow: "hidden" }}
                >
                  <div style={{ transform: "scale(0.37)", transformOrigin: "top left", width: "270%", pointerEvents: "none" }}>
                    <GameHighlightCard
                      fen={criticalMoment.analysis.fen ?? "start"}
                      moveNumber={criticalMoment.analysis.moveNumber}
                      moveColor={criticalMoment.analysis.color}
                      san={criticalMoment.analysis.san}
                      classification={criticalMoment.analysis.classification ?? "good"}
                      evalCp={criticalMoment.analysis.eval ?? 0}
                      evalSwing={criticalMoment.swing}
                      whitePlayer={data.game.whitePlayer ?? "White"}
                      blackPlayer={data.game.blackPlayer ?? "Black"}
                      result={data.game.result}
                      openingName={data.game.openingName}
                      openingEco={data.game.openingEco}
                      whiteAccuracy={data.summary?.white?.accuracy ?? null}
                      blackAccuracy={data.summary?.black?.accuracy ?? null}
                      boardOrientation={boardOrientation}
                    />
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={handleShareHighlight}
                    disabled={highlightStatus === "generating"}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                      highlightStatus === "done"
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        : highlightStatus === "generating"
                          ? isDark
                            ? "bg-white/5 text-white/30 cursor-not-allowed"
                            : "bg-[#ADBC9F]/40 text-[#436850] cursor-not-allowed"
                          : "bg-[#436850] hover:bg-[#4a7d55] text-white"
                    }`}
                  >
                    {highlightStatus === "generating" ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : highlightStatus === "done" ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <Share2 className="w-4 h-4" />
                    )}
                    {highlightStatus === "generating"
                      ? "Generating…"
                      : highlightStatus === "done"
                        ? "Shared!"
                        : "Share Highlight"}
                  </button>
                  <button
                    onClick={handleDownloadHighlight}
                    disabled={highlightStatus === "generating"}
                    className={`px-3 py-2.5 rounded-xl transition-all ${
                      highlightStatus === "generating"
                        ? isDark
                          ? "text-white/20 cursor-not-allowed"
                          : "text-[#436850]/70 cursor-not-allowed"
                        : isDark
                          ? "text-white/50 hover:bg-white/10 hover:text-white"
                          : "text-[#436850] hover:bg-[#ADBC9F]/50 hover:text-[#12372A]"
                    }`}
                    title="Download PNG"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ── Hidden full-resolution export card (off-screen) ──────────────── */}
      {criticalMoment && (
        <div
          style={{
            position: "fixed",
            left: "-9999px",
            top: 0,
            width: 540,
            height: 540,
            pointerEvents: "none",
            zIndex: -1,
          }}
        >
          <GameHighlightCard
            ref={highlightCardRef}
            fen={criticalMoment.analysis.fen ?? "start"}
            moveNumber={criticalMoment.analysis.moveNumber}
            moveColor={criticalMoment.analysis.color}
            san={criticalMoment.analysis.san}
            classification={criticalMoment.analysis.classification ?? "good"}
            evalCp={criticalMoment.analysis.eval ?? 0}
            evalSwing={criticalMoment.swing}
            whitePlayer={data.game.whitePlayer ?? "White"}
            blackPlayer={data.game.blackPlayer ?? "Black"}
            result={data.game.result}
            openingName={data.game.openingName}
            openingEco={data.game.openingEco}
            whiteAccuracy={data.summary?.white?.accuracy ?? null}
            blackAccuracy={data.summary?.black?.accuracy ?? null}
            boardOrientation={boardOrientation}
          />
        </div>
      )}
    </div>
  );
}
