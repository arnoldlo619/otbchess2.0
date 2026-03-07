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
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRoute, useLocation } from "wouter";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
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
  Target,
  TrendingDown,
  Zap,
  Award,
  ArrowLeft,
} from "lucide-react";

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
  session: { status: string } | null;
  analyses: MoveAnalysis[];
  summary: AnalysisSummary;
  keyMoments: KeyMoment[];
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
            isDark ? "bg-gray-700" : "bg-gray-300"
          }`}
        >
          <div
            className="bg-white transition-all duration-500 ease-out rounded-l-full"
            style={{ width: `${whitePercent}%` }}
          />
          <div
            className="bg-gray-900 transition-all duration-500 ease-out rounded-r-full flex-1"
          />
        </div>
        <div className="flex justify-between text-[10px] font-mono">
          <span className={isDark ? "text-white/40" : "text-gray-400"}>
            {evalCp >= 0 ? `+${evalDisplay}` : evalDisplay}
          </span>
          <span className={isDark ? "text-white/40" : "text-gray-400"}>
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
            ? isDark ? "text-white" : "text-gray-900"
            : isDark ? "text-white/60" : "text-gray-500"
        }`}
      >
        {evalCp >= 0 ? `+${evalDisplay}` : evalDisplay}
      </span>
      <div
        className={`w-6 flex-1 rounded-full overflow-hidden flex flex-col ${
          isDark ? "bg-gray-700" : "bg-gray-300"
        }`}
      >
        <div
          className="bg-gray-900 transition-all duration-500 ease-out rounded-t-full"
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
        isDark ? "border-white/10 bg-white/5" : "border-gray-200 bg-white"
      }`}
    >
      <div className="p-2 space-y-0.5">
        {movePairs.map((pair) => (
          <div key={pair.number} className="flex items-center gap-1">
            <span
              className={`w-8 text-right text-[11px] font-mono flex-shrink-0 ${
                isDark ? "text-white/30" : "text-gray-400"
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
                      ? "bg-[#3D6B47] text-white"
                      : "bg-[#3D6B47] text-white"
                    : pair.white.analysis.classification &&
                        pair.white.analysis.classification !== "best" &&
                        pair.white.analysis.classification !== "good"
                      ? `${colors[pair.white.analysis.classification]?.bg ?? ""} ${
                          colors[pair.white.analysis.classification]?.text ?? ""
                        }`
                      : isDark
                        ? "text-white/70 hover:bg-white/5"
                        : "text-gray-700 hover:bg-gray-50"
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
                      ? "bg-[#3D6B47] text-white"
                      : "bg-[#3D6B47] text-white"
                    : pair.black.analysis.classification &&
                        pair.black.analysis.classification !== "best" &&
                        pair.black.analysis.classification !== "good"
                      ? `${colors[pair.black.analysis.classification]?.bg ?? ""} ${
                          colors[pair.black.analysis.classification]?.text ?? ""
                        }`
                      : isDark
                        ? "text-white/70 hover:bg-white/5"
                        : "text-gray-700 hover:bg-gray-50"
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
          isDark ? "border-white/10 bg-white/5" : "border-gray-200 bg-white"
        }`}
      >
        <h3
          className={`text-xs font-semibold uppercase tracking-wider mb-3 ${
            isDark ? "text-white/40" : "text-gray-400"
          }`}
        >
          Accuracy
        </h3>
        {/* Opening badge — shown above the accuracy grid */}
        {(game.openingName || game.openingEco) && (
          <div
            className={`flex items-center gap-2 mb-3 px-3 py-2 rounded-lg text-xs ${
              isDark ? "bg-white/5 text-white/70" : "bg-gray-50 text-gray-600"
            }`}
          >
            <span className="text-[10px] font-bold tracking-wider text-[#3D6B47] shrink-0">
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
              <div className="w-3 h-3 rounded-full bg-white border border-gray-300" />
              <span
                className={`text-xs font-medium truncate ${
                  isDark ? "text-white/70" : "text-gray-700"
                }`}
              >
                {game.whitePlayer || "White"}
              </span>
            </div>
            <div className="text-3xl font-bold text-[#3D6B47]">
              {summary.white.accuracy}%
            </div>
            {summary.white.accuracyLabel && (
              <div className={`text-[10px] font-semibold uppercase tracking-wider ${
                isDark ? "text-white/30" : "text-gray-400"
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
              <div className="w-3 h-3 rounded-full bg-gray-900 dark:bg-gray-600" />
              <span
                className={`text-xs font-medium truncate ${
                  isDark ? "text-white/70" : "text-gray-700"
                }`}
              >
                {game.blackPlayer || "Black"}
              </span>
            </div>
            <div className="text-3xl font-bold text-[#3D6B47]">
              {summary.black.accuracy}%
            </div>
            {summary.black.accuracyLabel && (
              <div className={`text-[10px] font-semibold uppercase tracking-wider ${
                isDark ? "text-white/30" : "text-gray-400"
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
          isDark ? "border-white/10 bg-white/5" : "border-gray-200 bg-white"
        }`}
      >
        <h3
          className={`text-xs font-semibold uppercase tracking-wider mb-2 ${
            isDark ? "text-white/40" : "text-gray-400"
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
            isDark ? "border-white/10 bg-white/5" : "border-gray-200 bg-white"
          }`}
        >
          <h3
            className={`text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5 ${
              isDark ? "text-white/40" : "text-gray-400"
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
                    isDark ? "hover:bg-white/5" : "hover:bg-gray-50"
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
        <span className={isDark ? "text-white/50" : "text-gray-500"}>
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
      <span className={isDark ? "text-white/40" : "text-gray-400"}>
        {label}
      </span>
      <span className={`font-medium ${isDark ? "text-white/80" : "text-gray-700"}`}>
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

  const gameId = matched ? params?.gameId : null;

  // ── Fetch analysis data ─────────────────────────────────────────────────
  useEffect(() => {
    if (!gameId) return;

    let polling = true;
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/games/${gameId}/analysis`);
        if (!res.ok) throw new Error("Failed to load analysis");
        const json = (await res.json()) as AnalysisResponse;
        setData(json);
        setLoading(false);

        // If still analyzing, poll every 3 seconds
        if (
          json.session?.status === "analyzing" &&
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
  const currentFen = useMemo(() => {
    if (!data || currentMoveIndex < 0) {
      return "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    }
    const analysis = data.analyses[currentMoveIndex];
    return analysis?.fen ?? "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  }, [data, currentMoveIndex]);

  const currentEval = useMemo(() => {
    if (!data || currentMoveIndex < 0) return 0;
    return data.analyses[currentMoveIndex]?.eval ?? 0;
  }, [data, currentMoveIndex]);

  // ── Keyboard navigation ─────────────────────────────────────────────────
  const goFirst = useCallback(() => setCurrentMoveIndex(-1), []);
  const goPrev = useCallback(
    () => setCurrentMoveIndex((i) => Math.max(-1, i - 1)),
    []
  );
  const goNext = useCallback(
    () =>
      setCurrentMoveIndex((i) =>
        data ? Math.min(data.analyses.length - 1, i + 1) : i
      ),
    [data]
  );
  const goLast = useCallback(
    () => setCurrentMoveIndex(data ? data.analyses.length - 1 : -1),
    [data]
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
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

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center ${
          isDark ? "bg-[#0d1a0f]" : "bg-gray-50"
        }`}
      >
        <div className="flex flex-col items-center gap-3">
          <Loader2
            className={`w-8 h-8 animate-spin ${
              isDark ? "text-[#3D6B47]" : "text-[#3D6B47]"
            }`}
          />
          <span className={`text-sm ${isDark ? "text-white/50" : "text-gray-500"}`}>
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
          isDark ? "bg-[#0d1a0f]" : "bg-gray-50"
        }`}
      >
        <div className="flex flex-col items-center gap-3 text-center px-4">
          <AlertCircle className="w-8 h-8 text-red-400" />
          <p className={`text-sm ${isDark ? "text-white/60" : "text-gray-600"}`}>
            {error || "Analysis not found"}
          </p>
          <button
            onClick={() => navigate("/record")}
            className="text-sm text-[#3D6B47] hover:underline"
          >
            Go back to Game Recorder
          </button>
        </div>
      </div>
    );
  }

  const isAnalyzing = data.session?.status === "analyzing";
  const analysisProgress =
    data.game.totalMoves && data.game.totalMoves > 0
      ? Math.round((data.analyses.length / (data.game.totalMoves * 2)) * 100)
      : data.analyses.length > 0
        ? 100
        : 0;

  return (
    <div
      className={`min-h-screen ${
        isDark
          ? "bg-[#0d1a0f] text-white"
          : "bg-gradient-to-b from-gray-50 to-white text-gray-900"
      }`}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header
        className={`sticky top-0 z-50 backdrop-blur-xl border-b ${
          isDark ? "bg-[#0d1a0f]/80 border-white/10" : "bg-white/80 border-gray-200"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-3">
          <button
            onClick={() => navigate("/record")}
            className={`p-1.5 rounded-lg transition-colors ${
              isDark ? "hover:bg-white/10" : "hover:bg-gray-100"
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
                    isDark ? "bg-white/10 text-white/60" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {data.game.result}
                </span>
              )}
            </div>
          </div>
          {isAnalyzing && (
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-[#3D6B47]" />
              <span className="text-xs text-[#3D6B47] font-medium">
                {analysisProgress}%
              </span>
            </div>
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
                    darkSquareStyle: { backgroundColor: "#3D6B47" },
                    lightSquareStyle: { backgroundColor: "#E8E0D5" },
                  }}
                />
              </div>
            </div>

            {/* Move info */}
            {currentMoveIndex >= 0 && data.analyses[currentMoveIndex] && (
              <div
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl ${
                  isDark ? "bg-white/5" : "bg-gray-50"
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
                            isDark ? "text-white/40" : "text-gray-400"
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
                    ? isDark ? "text-white/20" : "text-gray-300"
                    : isDark
                      ? "text-white/60 hover:bg-white/10"
                      : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <ChevronsLeft className="w-5 h-5" />
              </button>
              <button
                onClick={goPrev}
                disabled={currentMoveIndex <= -1}
                className={`p-2 rounded-lg transition-colors ${
                  currentMoveIndex <= -1
                    ? isDark ? "text-white/20" : "text-gray-300"
                    : isDark
                      ? "text-white/60 hover:bg-white/10"
                      : "text-gray-600 hover:bg-gray-100"
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
                    : "text-gray-600 hover:bg-gray-100"
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
                    ? isDark ? "text-white/20" : "text-gray-300"
                    : isDark
                      ? "text-white/60 hover:bg-white/10"
                      : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              <button
                onClick={goLast}
                disabled={currentMoveIndex >= data.analyses.length - 1}
                className={`p-2 rounded-lg transition-colors ${
                  currentMoveIndex >= data.analyses.length - 1
                    ? isDark ? "text-white/20" : "text-gray-300"
                    : isDark
                      ? "text-white/60 hover:bg-white/10"
                      : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <ChevronsRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Right: Move list + Summary */}
          <div className="lg:w-[360px] space-y-4">
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
          </div>
        </div>
      </main>
    </div>
  );
}
