/**
 * Matchup Prep Page — /prep/:username
 *
 * Redesigned 3-tab interface: Scout Report → Study Lines → Practice Board
 * - Scout Report: opponent profile, top weaknesses, game plan summary
 * - Study Lines: ranked prep lines with inline ChessLineViewer (interactive board)
 * - Practice Board: ChessPracticeBoard (SRS quiz with real chessboard)
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuthContext } from "@/context/AuthContext";
import {
  Search, Target, BookOpen,
  Shield as _Shield, Clock as _Clock, Crown as _Crown,
  TrendingUp as _TrendingUp, Eye, Loader2,
  CircleDot as _CircleDot, RefreshCw, ChevronRight, Trophy,
  Activity, Bookmark, BookmarkCheck,
  Trash2, AlertCircle, Crosshair, Flame, Dumbbell, AlertTriangle, ArrowRight, PlayCircle,
  Zap, GitBranch, BarChart3, ChevronDown,
} from "lucide-react";
import ChessLineViewer from "../components/ChessLineViewer";
import ChessPracticeBoard from "../components/ChessPracticeBoard";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import {
  UserRepertoire,
  loadUserRepertoire,
  enrichPrepLines,
  generateMatchupSummary,
  type EnrichedPrepLine,
} from "../lib/userRepertoire";
import {
  getRecentlyScouted,
  addRecentlyScouted,
  removeRecentlyScouted,
} from "../lib/recentlyScouted";
import {
  useOpponentProfile,
  countryCodeToFlag,
} from "../hooks/useOpponentProfile";

import { authFetch } from "@/lib/apiFetch";
import { NavLogo } from "@/components/NavLogo";
import { AvatarNavDropdown } from "@/components/AvatarNavDropdown";

// ── Types ─────────────────────────────────────────────────────────────────────

interface OpeningStat {
  name: string;
  eco: string;
  count: number;
  wins: number;
  draws: number;
  losses: number;
  winRate: number;
  moves: string;
  weaknessScore: number;
}

interface PlayStyleProfile {
  username: string;
  gamesAnalyzed: number;
  rating: { rapid: number | null; blitz: number | null; bullet: number | null };
  overall: { wins: number; draws: number; losses: number; winRate: number };
  asWhite: { wins: number; draws: number; losses: number; winRate: number; games: number };
  asBlack: { wins: number; draws: number; losses: number; winRate: number; games: number };
  whiteOpenings: OpeningStat[];
  blackOpenings: OpeningStat[];
  endgameProfile: { checkmates: number; resignations: number; timeouts: number; draws: number; total: number };
  firstMoveAsWhite: { move: string; count: number; pct: number }[];
  avgGameLength: number;
  dominantTimeControl?: "rapid" | "blitz" | "bullet" | "mixed";
  timeControlSplit?: {
    rapid: { games: number; winRate: number };
    blitz: { games: number; winRate: number };
    bullet: { games: number; winRate: number };
  };
}

interface PrepLine {
  name: string;
  eco: string;
  moves: string;
  rationale: string;
  confidence: "high" | "medium" | "low";
  lineType?: "main" | "surprise";
  exploits?: string;
  useAs?: "white" | "black";
  sampleSize?: number;
  mainIdea?: string;
  keyPlan?: string;
}

interface ProblemLine {
  name: string;
  eco: string;
  color: "white" | "black";
  moves: string;
  problemHalfMove: number;
  problemMove: string;
  betterMove?: string;
  gamesCount: number;
  lossCount: number;
  lossRate: number;
  coachingNote?: string;
}

interface VictoryPlanItem {
  action: string;
  reason: string;
  category: "opening" | "middlegame" | "endgame" | "psychological";
}

interface BehaviorProfile {
  avgGameLength: number;
  timeoutPct: number;
  resignPct: number;
  blunderPhase: "opening" | "middlegame" | "endgame";
  lossPhaseDistribution: { opening: number; middlegame: number; endgame: number };
  strategyNote: string;
}

interface OpeningTreeNode {
  move: string;
  label: string;
  count: number;
  pct: number;
  winRate: number;
  children: OpeningTreeNode[];
}

interface PrepRecommendation {
  useAs: "white" | "black";
  target: string;
  evidence: string;
  confidence: "high" | "moderate" | "low";
  plan: string;
  category: "opening" | "middlegame" | "endgame";
  sampleSize: number;
  winRate: number;
}

interface EnginePatternEvidence {
  gameUrl?: string;
  move?: string;
  phase?: string;
  eco?: string;
}

interface EnginePattern {
  patternType: "opening_trap" | "tactical_weakness" | "endgame_weakness" | "time_pressure" | "phase_blunder";
  label: string;
  description: string;
  frequency: number;
  totalGames: number;
  confidence: "high" | "moderate" | "low";
  severityScore: number;
  evidence: EnginePatternEvidence[];
}

interface EnginePatterns {
  patterns: EnginePattern[];
  gamesAnalyzed: number;
  positionsAnalyzed: number;
  avgBlundersPerGame: number;
  avgMistakesPerGame: number;
  worstPhase: "opening" | "middlegame" | "endgame";
  weakOpenings: { eco: string; name: string; blunderRate: number; games: number }[];
}

interface PrepReport {
  opponent: PlayStyleProfile;
  prepLines: PrepLine[];
  insights: string[];
  problemLines?: ProblemLine[];
  victoryPlan?: VictoryPlanItem[];
  prepRecommendations?: PrepRecommendation[];
  behavior?: BehaviorProfile;
  openingTree?: { asWhite: OpeningTreeNode[]; asBlack: OpeningTreeNode[] };
  enginePatterns?: EnginePatterns;
  generatedAt: string;
  _cached?: boolean;
}

type Tab = "scout" | "lines" | "practice";

interface SavedReportMeta {
  id: number;
  opponentUsername: string;
  opponentName: string | null;
  winRate: number | null;
  gamesAnalyzed: number | null;
  prepLinesCount: number | null;
  savedAt: string;
}


// ── Terminology helper ─────────────────────────────────────────────────────────
/** Returns true if an opening name is a Black defense (chosen by Black) */
function isBlackDefenseUI(name: string): boolean {
  const n = name.toLowerCase();
  const blackKeywords = [
    "sicilian", "french", "caro-kann", "pirc", "modern defense", "king's indian",
    "nimzo-indian", "queen's gambit declined", "dutch", "englund", "slav",
    "semi-slav", "scandinavian", "alekhine", "benoni", "benko", "grunfeld",
    "king's indian defense", "nimzo", "qgd", "defense", "defence",
  ];
  return blackKeywords.some(k => n.includes(k));
}

// ── Design tokens ─────────────────────────────────────────────────────────────

type Tokens = ReturnType<typeof useDesignTokens>;

function useDesignTokens(isDark: boolean) {
  return {
    page:          isDark ? "bg-[#0a1409]"                                           : "bg-[#f8faf8]",
    card:          isDark ? "bg-[#0f1c11] border border-[#243028]/70 rounded-2xl"   : "bg-white border border-[#ADBC9F]/80 rounded-2xl shadow-sm",
    cardSubtle:    isDark ? "bg-[#0d1a0f]/60 border border-[#1e2e22]/60 rounded-xl" : "bg-[#FBFADA]/70/70 border border-[#ADBC9F]/60 rounded-xl",
    header:        isDark ? "bg-[#0a1409]/95 border-b border-[#1e2e22]/80"          : "bg-white/95 border-b border-[#ADBC9F]/70",
    input:         isDark ? "bg-[#0a1409] border-[#243028]/70 text-white placeholder:text-white/50 focus:border-[#4a8a5a]/60" : "bg-white border-[#ADBC9F] text-[#12372A] placeholder:text-[#436850]/60 focus:border-[#436850]",
    textPrimary:   isDark ? "text-white"       : "text-[#12372A]",
    textSecondary: isDark ? "text-white/55"    : "text-[#436850]",
    textTertiary:  isDark ? "text-white/30"    : "text-[#436850]",
    accent:        "text-[#5B9A6A]",
    accentBg:      isDark ? "bg-[#5B9A6A]/10 text-[#5B9A6A]" : "bg-[#436850]/08 text-[#436850]",
    divider:       isDark ? "border-[#1e2e22]/70" : "border-[#ADBC9F]/70",
    tabActive:     isDark ? "bg-[#162018] text-white border-[#2e4a34]/50"           : "bg-white text-[#12372A] border-[#ADBC9F] shadow-sm",
    tabInactive:   isDark ? "text-white/35 hover:text-white/60 hover:bg-white/03"   : "text-[#436850] hover:text-[#12372A] hover:bg-[#ADBC9F]/50/50",
    rowHover:      isDark ? "hover:bg-[#162018]/50"                                 : "hover:bg-[#FBFADA]/80",
    monoBlock:     isDark ? "bg-[#060e07] text-[#5B9A6A] border border-[#1e2e22]/60" : "bg-[#436850]/04 text-[#436850] border border-[#436850]/10",
  };
}

// ── Practice Progress Tracking (module-level) ─────────────────────────────────────────────────────────
const PRACTICE_PROGRESS_KEY = "chessotb_practice_progress";
function getPracticeProgress(): Record<string, { count: number; lastPracticed: string }> {
  try {
    return JSON.parse(localStorage.getItem(PRACTICE_PROGRESS_KEY) || "{}");
  } catch { return {}; }
}

// ── Main Component ─────────────────────────────────────────────────────────────────────────────

export default function MatchupPrep() {
  const params = useParams<{ username?: string }>();
  const [, navigate] = useLocation();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const t = useDesignTokens(isDark);

  const { user } = useAuthContext();
  const [searchInput, setSearchInput] = useState(params.username || "");
  const [report, setReport] = useState<PrepReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("scout");

  // Save / saved reports
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<number | null>(null);
  const [savedReports, setSavedReports] = useState<SavedReportMeta[]>([]);
  const [showSavedPanel, setShowSavedPanel] = useState(false);
  const [loadingSaved, setLoadingSaved] = useState(false);

  // Repertoire state (persisted in localStorage)
  const [repertoire] = useState<UserRepertoire>(() => loadUserRepertoire());

  // Time-control filter for prep report
  type TcFilter = "all" | "rapid" | "blitz";
  const [tcFilter, setTcFilter] = useState<TcFilter>("all");

  // Game count filter (server-side param)
  type GameCountFilter = "50" | "100";
  const [gameCountFilter, setGameCountFilter] = useState<GameCountFilter>("50");

  // Color focus filter (client-side)
  type ColorFilter = "both" | "white" | "black";
  const [colorFilter, setColorFilter] = useState<ColorFilter>("both");

  // Enriched prep lines with collision scores
  const enrichedLines = useMemo<EnrichedPrepLine[]>(() => {
    if (!report) return [];
    return enrichPrepLines(report.prepLines, repertoire, {
      firstMoveAsWhite: report.opponent.firstMoveAsWhite,
      blackOpenings: report.opponent.blackOpenings,
      whiteOpenings: report.opponent.whiteOpenings,
      gamesAnalyzed: report.opponent.gamesAnalyzed,
    });
  }, [report, repertoire]);

  // Strategic matchup summary
  const matchupSummary = useMemo(() => {
    if (!report || enrichedLines.length === 0) return null;
    return generateMatchupSummary(repertoire, {
      firstMoveAsWhite: report.opponent.firstMoveAsWhite,
      blackOpenings: report.opponent.blackOpenings.map(o => ({ ...o, moves: o.moves ?? "" })),
      whiteOpenings: report.opponent.whiteOpenings.map(o => ({ ...o, moves: o.moves ?? "" })),
      asWhite: { winRate: report.opponent.asWhite.winRate, games: report.opponent.asWhite.games },
      asBlack: { winRate: report.opponent.asBlack.winRate, games: report.opponent.asBlack.games },
      gamesAnalyzed: report.opponent.gamesAnalyzed,
    }, enrichedLines);
  }, [report, repertoire, enrichedLines]);

  // Opponent profile (avatar, title, country)
  const { profile: opponentProfile } = useOpponentProfile(
    report ? report.opponent.username : null
  );

  // Recently scouted chips
  const [recentlyScouted, setRecentlyScouted] = useState<string[]>(() => getRecentlyScouted());

  // "Practice this line" — jump from Study Lines to Practice tab
  const [practiceLineIndex, setPracticeLineIndex] = useState<number | undefined>(undefined);

  // "Practice this problem line" — jump from Scout Report Problem Lines to Practice tab
  const [practiceCustomLine, setPracticeCustomLine] = useState<{ id: string; name: string; moves: string; eco: string; rationale: string } | null>(null);

  function recordPractice(lineId: string) {
    const progress = getPracticeProgress();
    const existing = progress[lineId] || { count: 0, lastPracticed: "" };
    progress[lineId] = { count: existing.count + 1, lastPracticed: new Date().toISOString() };
    localStorage.setItem(PRACTICE_PROGRESS_KEY, JSON.stringify(progress));
  }

  function handlePracticeProblemLine(pl: ProblemLine) {
    const moveNum = Math.ceil(pl.problemHalfMove / 2);
    const isWhiteMove = pl.problemHalfMove % 2 === 1;
    const problemLabel = isWhiteMove ? `${moveNum}.${pl.problemMove}` : `${moveNum}...${pl.problemMove}`;
    const betterLabel = pl.betterMove
      ? (isWhiteMove ? `${moveNum}.${pl.betterMove}` : `${moveNum}...${pl.betterMove}`)
      : null;
    const lineId = `problem-${pl.eco}-${pl.problemHalfMove}`;
    recordPractice(lineId);
    setPracticeCustomLine({
      id: lineId,
      name: `${pl.name} — Problem at move ${moveNum}`,
      moves: pl.moves,
      eco: pl.eco,
      rationale: betterLabel
        ? `Opponent usually plays ${problemLabel} here. The stronger response is ${betterLabel}. Practice finding the best move.`
        : `Opponent usually goes wrong at move ${moveNum} with ${problemLabel}. Practice the correct continuation.`,
    });
    setPracticeLineIndex(undefined);
    setActiveTab("practice");
  }

  useEffect(() => {
    if (params.username) {
      setSearchInput(params.username);
      fetchReport(params.username);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.username]);

  async function fetchReport(username: string, refresh = false, tc?: "all" | "rapid" | "blitz", games?: string) {
    if (refresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
      setReport(null);
      setActiveTab("scout");
    }
    setError(null);
    try {
      const activeTc = tc ?? tcFilter;
      const activeGames = games ?? gameCountFilter;
      const tcQuery = activeTc !== "all" ? `tc=${activeTc}` : "";
      const refreshQuery = refresh ? "refresh=true" : "";
      const gamesQuery = activeGames !== "50" ? `games=${activeGames}` : "";
      const queryStr = [tcQuery, refreshQuery, gamesQuery].filter(Boolean).join("&");
      const url = `/api/prep/${encodeURIComponent(username.trim())}${queryStr ? `?${queryStr}` : ""}`;
      const res = await authFetch(url);
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(data.error || `Error ${res.status}`);
      }
      const data: PrepReport = await res.json();
      setReport(data);
      // Auto-select TC filter based on opponent's dominant time control
      if (!tc && !refresh && data.opponent.dominantTimeControl && data.opponent.dominantTimeControl !== "mixed") {
        const dominant = data.opponent.dominantTimeControl;
        if (dominant === "rapid" || dominant === "blitz") {
          setTcFilter(dominant);
        }
      }
      // Persist to recently scouted list
      const updated = addRecentlyScouted(username.trim());
      setRecentlyScouted(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to fetch prep report");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  // When a new report loads, check if this opponent is already saved
  useEffect(() => {
    if (report && user) {
      const match = savedReports.find(
        (r) => r.opponentUsername === report.opponent.username.toLowerCase()
      );
      setSavedId(match?.id ?? null);
    } else {
      setSavedId(null);
    }
  }, [report, savedReports, user]);

  const fetchSavedReports = useCallback(async () => {
    if (!user) return;
    setLoadingSaved(true);
    try {
      const res = await authFetch("/api/prep/saved", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setSavedReports(data.reports ?? []);
      }
    } catch { /* non-fatal */ }
    finally { setLoadingSaved(false); }
  }, [user]);

  useEffect(() => { fetchSavedReports(); }, [fetchSavedReports]);

  async function handleSaveReport() {
    if (!report || !user) return;
    setSaving(true);
    try {
      const res = await authFetch("/api/prep/saved", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          opponentUsername: report.opponent.username,
          opponentName: report.opponent.username,
          winRate: report.opponent.overall.winRate,
          gamesAnalyzed: report.opponent.gamesAnalyzed,
          prepLinesCount: report.prepLines.length,
          reportJson: report,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSavedId(data.id);
        await fetchSavedReports();
      }
    } catch { /* non-fatal */ }
    finally { setSaving(false); }
  }

  async function handleDeleteSaved(id: number) {
    try {
      await authFetch(`/api/prep/saved/${id}`, { method: "DELETE", credentials: "include" });
      if (savedId === id) setSavedId(null);
      await fetchSavedReports();
    } catch { /* non-fatal */ }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const u = searchInput.trim();
    if (!u) return;
    navigate(`/prep/${encodeURIComponent(u)}`);
    fetchReport(u);
  }

  // ── Derive top weaknesses from opponent data ──
  function getWeaknesses(r: PrepReport): { label: string; detail: string; severity: "high" | "medium" }[] {
    const weaknesses: { label: string; detail: string; severity: "high" | "medium" }[] = [];
    const opp = r.opponent;

    // Color imbalance
    const whiteWR = Math.round(opp.asWhite.winRate * 100);
    const blackWR = Math.round(opp.asBlack.winRate * 100);
    const whiteDiff = whiteWR - blackWR;
    if (whiteDiff >= 12) {
      weaknesses.push({ label: "Weak as Black", detail: `Only ${blackWR}% win rate (vs ${whiteWR}% as White)`, severity: "high" });
    } else if (whiteDiff <= -12) {
      weaknesses.push({ label: "Weak as White", detail: `Only ${whiteWR}% win rate (vs ${blackWR}% as Black)`, severity: "high" });
    }

    // Endgame tendencies
    const ep = opp.endgameProfile;
    if (ep.total > 0) {
      const resignPct = Math.round((ep.resignations / ep.total) * 100);
      const timeoutPct = Math.round((ep.timeouts / ep.total) * 100);
      if (resignPct >= 40) {
        weaknesses.push({ label: "Resigns under pressure", detail: `${resignPct}% of losses are resignations — apply pressure early`, severity: "high" });
      }
      if (timeoutPct >= 25) {
        weaknesses.push({ label: "Time trouble prone", detail: `${timeoutPct}% of losses are timeouts — play complex positions`, severity: "medium" });
      }
    }

    // Short game tendency
    if (opp.avgGameLength <= 28) {
      weaknesses.push({ label: "Plays too fast", detail: `Avg ${opp.avgGameLength} moves — drag them into longer games`, severity: "medium" });
    }

    // Low win rate openings (as White)
    const weakWhiteOpening = opp.whiteOpenings.find(o => o.winRate < 0.40 && o.count >= 3);
    if (weakWhiteOpening) {
      weaknesses.push({ label: `Struggles in ${weakWhiteOpening.name}`, detail: `${Math.round(weakWhiteOpening.winRate * 100)}% win rate over ${weakWhiteOpening.count} games as White`, severity: "medium" });
    }

    // Low win rate openings (as Black)
    const weakBlackOpening = opp.blackOpenings.find(o => o.winRate < 0.40 && o.count >= 3);
    if (weakBlackOpening) {
      weaknesses.push({ label: `Struggles in ${weakBlackOpening.name}`, detail: `${Math.round(weakBlackOpening.winRate * 100)}% win rate over ${weakBlackOpening.count} games as Black`, severity: "medium" });
    }

    // Overall low win rate
    if (opp.overall.winRate < 0.45 && weaknesses.length < 2) {
      weaknesses.push({ label: "Below 50% overall", detail: `${Math.round(opp.overall.winRate * 100)}% win rate across ${opp.gamesAnalyzed} games`, severity: "medium" });
    }

    return weaknesses.slice(0, 4);
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "scout",    label: "Scout Report", icon: <Eye className="w-3.5 h-3.5" /> },
    { id: "lines",    label: "Study Lines",  icon: <Target className="w-3.5 h-3.5" /> },
    { id: "practice", label: "Practice",     icon: <Dumbbell className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className={`min-h-screen ${t.page}`}>

      {/* ── Sticky Header ── */}
      <div className={`sticky top-0 z-40 backdrop-blur-xl otb-header-safe ${t.header}`}>
        {/* Nav bar row */}
        <div className="max-w-3xl mx-auto px-3 sm:px-6 pt-2 pb-1 flex items-center justify-between">
          <NavLogo />
          <AvatarNavDropdown />
        </div>
        {/* Search row */}
        <div className="max-w-3xl mx-auto px-3 sm:px-6 pb-2 flex items-center gap-2 sm:gap-3">
          <form onSubmit={handleSearch} className="flex-1 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none ${isDark ? "text-white/70" : t.textTertiary}`} />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="chess.com username"
                className={`w-full pl-9 pr-3 py-2 rounded-xl border text-sm transition-colors outline-none prep-input-glow-always ${t.input}`}
                autoComplete="off"
                autoCapitalize="none"
              />
            </div>
            <button
              type="submit"
              disabled={!searchInput.trim() || loading}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all min-h-[40px] shrink-0 ${
                searchInput.trim() && !loading
                  ? isDark
                    ? "bg-[#436850] text-white hover:bg-[#4a8a5a] active:scale-95"
                    : "bg-[#436850] text-white hover:bg-[#2d5237] active:scale-95"
                  : isDark ? "bg-white/05 text-white/20 cursor-not-allowed" : "bg-[#ADBC9F]/40 text-[#436850] cursor-not-allowed"
              }`}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          </form>

          {/* Action buttons — only when report is loaded */}
          {report && (
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => fetchReport(report.opponent.username, true)}
                disabled={refreshing}
                className={`p-2.5 rounded-xl transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center ${
                  isDark ? "hover:bg-white/05 text-white/40 hover:text-white/70" : "hover:bg-[#ADBC9F]/50 text-[#436850] hover:text-[#436850]"
                }`}
                title="Refresh report"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              </button>
              {user && (
                <button
                  onClick={savedId ? () => setShowSavedPanel(p => !p) : handleSaveReport}
                  disabled={saving}
                  className={`p-2.5 rounded-xl transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center ${
                    savedId
                      ? isDark ? "text-[#5B9A6A] hover:bg-[#436850]/10" : "text-[#436850] hover:bg-[#436850]/08"
                      : isDark ? "hover:bg-white/05 text-white/40 hover:text-white/70" : "hover:bg-[#ADBC9F]/50 text-[#436850] hover:text-[#436850]"
                  }`}
                  title={savedId ? "Saved — view saved reports" : "Save this report"}
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : savedId ? <BookmarkCheck className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Smart Filters Row ── */}
        <div className="max-w-3xl mx-auto px-3 sm:px-6 pb-2.5 flex items-center gap-2 flex-wrap">
          {/* Time Control */}
          <span className={`text-[10px] font-semibold uppercase tracking-wider shrink-0 ${t.textTertiary}`}>Format</span>
          <div className={`flex items-center gap-1 p-0.5 rounded-lg ${isDark ? "bg-[#0d1a0f]/80 border border-[#1e2e22]/60" : "bg-[#ADBC9F]/40/80 border border-[#ADBC9F]/60"}`}>
            {(["all", "rapid", "blitz"] as const).map((tc) => (
              <button
                key={tc}
                data-testid={`tc-filter-${tc}`}
                onClick={() => {
                  if (tc === tcFilter) return;
                  setTcFilter(tc);
                  if (report) fetchReport(report.opponent.username, false, tc);
                  else if (searchInput.trim()) fetchReport(searchInput.trim(), false, tc);
                }}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all capitalize ${
                  tcFilter === tc
                    ? "bg-[#436850] text-white shadow-sm"
                    : isDark ? "text-white/40 hover:text-white/70" : "text-[#436850] hover:text-[#12372A]"
                }`}
              >
                {tc === "all" ? "All" : tc === "rapid" ? "Rapid" : "Blitz"}
              </button>
            ))}
          </div>

          {/* Separator */}
          <span className={`hidden sm:block w-px h-4 ${isDark ? "bg-[#1e2e22]" : "bg-[#ADBC9F]"}`} />

          {/* Game Count */}
          <span className={`text-[10px] font-semibold uppercase tracking-wider shrink-0 ${t.textTertiary}`}>Depth</span>
          <div className={`flex items-center gap-1 p-0.5 rounded-lg ${isDark ? "bg-[#0d1a0f]/80 border border-[#1e2e22]/60" : "bg-[#ADBC9F]/40/80 border border-[#ADBC9F]/60"}`}>
            {(["50", "100"] as const).map((gc) => (
              <button
                key={gc}
                onClick={() => {
                  if (gc === gameCountFilter) return;
                  setGameCountFilter(gc);
                  if (report) fetchReport(report.opponent.username, false, undefined, gc);
                  else if (searchInput.trim()) fetchReport(searchInput.trim(), false, undefined, gc);
                }}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                  gameCountFilter === gc
                    ? "bg-[#436850] text-white shadow-sm"
                    : isDark ? "text-white/40 hover:text-white/70" : "text-[#436850] hover:text-[#12372A]"
                }`}
              >
                {gc} games
              </button>
            ))}
          </div>

          {/* Separator */}
          <span className={`hidden sm:block w-px h-4 ${isDark ? "bg-[#1e2e22]" : "bg-[#ADBC9F]"}`} />

          {/* Color Focus */}
          <span className={`text-[10px] font-semibold uppercase tracking-wider shrink-0 ${t.textTertiary}`}>Color</span>
          <div className={`flex items-center gap-1 p-0.5 rounded-lg ${isDark ? "bg-[#0d1a0f]/80 border border-[#1e2e22]/60" : "bg-[#ADBC9F]/40/80 border border-[#ADBC9F]/60"}`}>
            {(["both", "white", "black"] as const).map((c) => (
              <button
                key={c}
                onClick={() => setColorFilter(c)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all capitalize ${
                  colorFilter === c
                    ? "bg-[#436850] text-white shadow-sm"
                    : isDark ? "text-white/40 hover:text-white/70" : "text-[#436850] hover:text-[#12372A]"
                }`}
              >
                {c === "both" ? "Both" : c === "white" ? "♔ White" : "♚ Black"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Page Content ── */}
      <div className="max-w-3xl mx-auto px-3 sm:px-6 py-5 sm:py-7 space-y-4 sm:space-y-5">

        {/* ── Saved Reports Panel ── */}
        {showSavedPanel && user && (
          <SavedReportsPanel
            reports={savedReports}
            loading={loadingSaved}
            savedId={savedId}
            onSelect={(u) => { navigate(`/prep/${encodeURIComponent(u)}`); setShowSavedPanel(false); }}
            onDelete={handleDeleteSaved}
            onClose={() => setShowSavedPanel(false)}
            isDark={isDark}
            t={t}
          />
        )}

        {/* ── Loading State (premium animated, requirement 11) ── */}
        {loading && <PrepLoadingState username={searchInput} isDark={isDark} t={t} />}

        {/* ── Error State (detailed, requirement 11) ── */}
        {error && !loading && (
          <PrepErrorState
            error={error}
            username={searchInput}
            onRetry={() => fetchReport(searchInput)}
            onUseAllFormats={() => { setTcFilter("all"); fetchReport(searchInput); }}
            onAnalyze100={() => { setGameCountFilter("100"); fetchReport(searchInput); }}
            isDark={isDark}
            t={t}
          />
        )}

        {/* ── Report ── */}
        {report && !loading && (
          <div className="space-y-4 sm:space-y-5">

            {/* ── Compact Opponent Hero ── */}
            <OpponentHero report={report} opponentProfile={opponentProfile} isDark={isDark} t={t} />

            {/* ── Tab Navigation ── */}
            <div className={`flex gap-1 p-1 rounded-2xl ${isDark ? "bg-[#0f1c11] border border-[#1e2e22]/70" : "bg-[#ADBC9F]/40/80 border border-[#ADBC9F]/60"}`}>
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-2 sm:px-3 rounded-xl text-xs sm:text-sm font-medium transition-all duration-150 min-h-[44px] ${
                    activeTab === tab.id ? t.tabActive + " border" : t.tabInactive
                  }`}
                >
                  <span className={activeTab === tab.id ? (isDark ? "text-[#5B9A6A]" : "text-[#436850]") : ""}>{tab.icon}</span>
                  <span>{tab.label}</span>
                  {tab.id === "lines" && enrichedLines.length > 0 && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      activeTab === "lines"
                        ? isDark ? "bg-[#436850]/25 text-[#5B9A6A]" : "bg-[#436850]/10 text-[#436850]"
                        : isDark ? "bg-white/06 text-white/30" : "bg-[#ADBC9F]/50 text-[#436850]"
                    }`}>
                      {enrichedLines.length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* ── Tab 1: Scout Report ── */}
            {activeTab === "scout" && (
              <ScoutReportTab
                report={report}
                weaknesses={getWeaknesses(report)}
                matchupSummary={matchupSummary}
                enrichedLines={enrichedLines}
                onViewLines={() => setActiveTab("lines")}
                onPracticeProblemLine={handlePracticeProblemLine}
                isDark={isDark}
                t={t}
              />
            )}

            {/* ── Tab 2: Study Lines ── */}
            {activeTab === "lines" && (
              <StudyLinesTab
                enrichedLines={enrichedLines}
                onPracticeLine={(idx) => { setPracticeLineIndex(idx); setActiveTab("practice"); }}
                onStartPractice={() => setActiveTab("practice")}
                isDark={isDark}
                t={t}
              />
            )}

            {/* ── Tab 3: Practice Board ── */}
            {activeTab === "practice" && (
              <PracticeBoardTab
                enrichedLines={enrichedLines}
                practiceLineIndex={practiceLineIndex}
                practiceCustomLine={practiceCustomLine}
                onClearCustomLine={() => setPracticeCustomLine(null)}
                isDark={isDark}
                t={t}
              />
            )}

          </div>
        )}

        {/* ── Recently Scouted Chips ── */}
        {!report && !loading && !error && recentlyScouted.length > 0 && (
          <RecentlyScoutedChips
            usernames={recentlyScouted}
            onSelect={(u) => { setSearchInput(u); navigate(`/prep/${encodeURIComponent(u)}`); fetchReport(u); }}
            onRemove={(u) => { const updated = removeRecentlyScouted(u); setRecentlyScouted(updated); }}
            isDark={isDark}
            t={t}
          />
        )}

        {/* ── Welcome / Empty State ── */}
        {!report && !loading && !error && (
          <div className={`${t.card} py-12 px-6 sm:py-16 flex flex-col items-center gap-5 text-center`}>
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isDark ? "bg-[#162018]" : "bg-[#436850]/06"}`}>
              <img
                src="https://d2xsxph8kpxj0f.cloudfront.net/117675823/J6FsDoRMH9x5xbUvpyzxyf/otb-logo-exclamation_0b3fa613.png"
                alt="OTB!!"
                className="w-9 h-9 object-contain"
              />
            </div>
            <div className="space-y-2 max-w-xs">
              <h3 className={`text-base sm:text-lg font-bold ${t.textPrimary}`} style={{ fontFamily: "'Clash Display', sans-serif" }}>
                Prepare for your next match
              </h3>
              <p className={`text-sm ${t.textSecondary} leading-relaxed`}>
                Enter your opponent's chess.com username to scout their weaknesses, study counter-lines, and drill them on a real board.
              </p>
            </div>
            <div className={`flex gap-6 text-xs ${t.textTertiary}`}>
              <span className="flex items-center gap-1.5"><Eye className="w-3.5 h-3.5" /> Scout</span>
              <span className="flex items-center gap-1.5"><Target className="w-3.5 h-3.5" /> Study</span>
              <span className="flex items-center gap-1.5"><Dumbbell className="w-3.5 h-3.5" /> Practice</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ── Sub-components ──
// ══════════════════════════════════════════════════════════════════════════════

// ── Opponent Hero ──────────────────────────────────────────────────────────────

function OpponentHero({
  report, opponentProfile, isDark, t
}: {
  report: PrepReport;
  opponentProfile: { avatar?: string | null; name?: string | null; title?: string | null; countryCode?: string | null } | null;
  isDark: boolean;
  t: Tokens;
}) {
  const opp = report.opponent;
  return (
    <div className={`${t.card} p-5 sm:p-6`}>
      <div className="flex items-center gap-3.5">
        {/* Avatar */}
        <div className={`relative shrink-0 w-12 h-12 rounded-xl overflow-hidden ${
          isDark ? "bg-[#162018] border border-[#2e4a34]/40" : "bg-[#436850]/06 border border-[#436850]/15"
        }`}>
          {opponentProfile?.avatar ? (
            <img
              src={`/api/avatar-proxy?url=${encodeURIComponent(opponentProfile.avatar)}`}
              alt={opp.username}
              className="w-full h-full object-cover"
              crossOrigin="anonymous"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              role="presentation"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className={`text-lg font-bold ${isDark ? "text-[#5B9A6A]/60" : "text-[#436850]/40"}`}>
                {opp.username.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          {opponentProfile?.countryCode && (
            <div className="absolute bottom-0 right-0 text-[11px] leading-none select-none">
              {countryCodeToFlag(opponentProfile.countryCode)}
            </div>
          )}
        </div>

        {/* Identity */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className={`text-lg sm:text-xl font-bold truncate ${t.textPrimary}`} style={{ fontFamily: "'Clash Display', sans-serif" }}>
              {opp.username}
            </h2>
            {opponentProfile?.title && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border shrink-0 ${
                isDark ? "bg-amber-500/10 border-amber-500/25 text-amber-400" : "bg-amber-50 border-amber-200 text-amber-700"
              }`}>{opponentProfile.title}</span>
            )}
          </div>
          <p className={`text-xs mt-0.5 ${t.textTertiary}`}>
            {opp.gamesAnalyzed} games analyzed
            {report._cached && <span className="ml-2 opacity-60">· cached</span>}
          </p>
        </div>

        {/* Ratings — compact inline */}
        <div className="flex items-center gap-2 shrink-0">
          {opp.rating.rapid && <RatingChip label="R" value={opp.rating.rapid} isDark={isDark} />}
          {opp.rating.blitz && <RatingChip label="B" value={opp.rating.blitz} isDark={isDark} />}
        </div>
      </div>

      {/* Quick stats row */}
      <div className={`mt-4 pt-3 border-t ${t.divider} grid grid-cols-3 gap-3`}>
        <QuickStat
          label="Win Rate"
          value={`${Math.round(opp.overall.winRate * 100)}%`}
          highlight={opp.overall.winRate >= 0.55}
          isDark={isDark}
          t={t}
        />
        <QuickStat
          label="As White"
          value={`${Math.round(opp.asWhite.winRate * 100)}%`}
          highlight={opp.asWhite.winRate >= 0.55}
          isDark={isDark}
          t={t}
        />
        <QuickStat
          label="As Black"
          value={`${Math.round(opp.asBlack.winRate * 100)}%`}
          highlight={opp.asBlack.winRate >= 0.55}
          isDark={isDark}
          t={t}
        />
      </div>
    </div>
  );
}

function RatingChip({ label, value, isDark }: { label: string; value: number; isDark: boolean }) {
  return (
    <div className={`text-center px-2.5 py-1.5 rounded-lg ${isDark ? "bg-[#0a1409] border border-[#1e2e22]/70" : "bg-[#FBFADA]/70 border border-[#ADBC9F]"}`}>
      <div className={`text-[9px] font-semibold uppercase ${isDark ? "text-white/25" : "text-[#436850]"}`}>{label}</div>
      <div className={`text-sm font-bold ${isDark ? "text-white" : "text-[#12372A]"}`}>{value}</div>
    </div>
  );
}

function QuickStat({ label, value, highlight, isDark, t }: { label: string; value: string; highlight?: boolean; isDark: boolean; t: Tokens }) {
  return (
    <div className="text-center">
      <p className={`text-[10px] font-semibold uppercase tracking-wider ${t.textTertiary}`}>{label}</p>
      <p className={`text-lg font-bold mt-0.5 ${
        highlight ? (isDark ? "text-emerald-400" : "text-emerald-600") : t.textPrimary
      }`}>{value}</p>
    </div>
  );
}

// ── Opening Tree Card with Interactive Chessboard ────────────────────────────────────

function OpeningTreeBranch({
  node, depth, isDark, t, activePath, onSelect
}: {
  node: OpeningTreeNode; depth: number; isDark: boolean; t: Tokens;
  activePath: string[]; onSelect: (moves: string[], node: OpeningTreeNode) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const isActive = activePath.length > depth && activePath[depth] === node.move;
  const wrColor = node.winRate >= 0.55
    ? isDark ? "text-emerald-400" : "text-emerald-600"
    : node.winRate <= 0.40
      ? isDark ? "text-red-400" : "text-red-500"
      : t.textSecondary;

  // Build the move path up to this node
  const pathToHere = [...activePath.slice(0, depth), node.move];

  return (
    <div className={`${depth > 0 ? "ml-4 pl-3 border-l" : ""} ${isDark ? "border-[#1e2e22]/60" : "border-[#ADBC9F]/60"}`}>
      <button
        onClick={() => {
          setExpanded(!expanded);
          onSelect(pathToHere, node);
        }}
        className={`flex items-center gap-2 py-1.5 w-full text-left group transition-colors rounded-lg px-2 -mx-2 ${
          isActive
            ? isDark ? "bg-[#436850]/15 border border-[#436850]/30" : "bg-[#436850]/08 border border-[#436850]/15"
            : isDark ? "hover:bg-white/03" : "hover:bg-[#FBFADA]"
        }`}
      >
        {node.children.length > 0 && (
          <ChevronDown className={`w-3 h-3 shrink-0 transition-transform ${!expanded ? "-rotate-90" : ""} ${t.textTertiary}`} />
        )}
        {node.children.length === 0 && <span className="w-3" />}
        <span className={`font-mono text-sm font-semibold ${isActive ? (isDark ? "text-[#5B9A6A]" : "text-[#436850]") : t.textPrimary}`}>{node.label}</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${isDark ? "bg-white/06" : "bg-[#ADBC9F]/40"} ${t.textTertiary}`}>
          {node.pct}%
        </span>
        <span className={`ml-auto text-[11px] font-semibold ${wrColor}`}>
          {Math.round(node.winRate * 100)}% WR
        </span>
        <span className={`text-[10px] ${t.textTertiary}`}>
          ({node.count})
        </span>
      </button>
      {expanded && node.children.length > 0 && (
        <div className="mt-0.5">
          {node.children.map((child, i) => (
            <OpeningTreeBranch key={`${child.move}-${i}`} node={child} depth={depth + 1} isDark={isDark} t={t} activePath={activePath} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
}

function OpeningTreeCard({ openingTree, isDark, t }: { openingTree: { asWhite: OpeningTreeNode[]; asBlack: OpeningTreeNode[] }; isDark: boolean; t: Tokens }) {
  const [treeColor, setTreeColor] = useState<"white" | "black">("white");
  const [activePath, setActivePath] = useState<string[]>([]);
  const [boardFen, setBoardFen] = useState("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  const [selectedNode, setSelectedNode] = useState<OpeningTreeNode | null>(null);
  const nodes = treeColor === "white" ? openingTree.asWhite : openingTree.asBlack;

  const handleBranchSelect = useCallback((moves: string[], node: OpeningTreeNode) => {
    setActivePath(moves);
    setSelectedNode(node);
    // Build FEN from the move path
    try {
      const chess = new Chess();
      for (const m of moves) {
        const result = chess.move(m);
        if (!result) break;
      }
      setBoardFen(chess.fen());
    } catch {
      // Keep current FEN on error
    }
  }, []);

  const handleReset = useCallback(() => {
    setActivePath([]);
    setSelectedNode(null);
    setBoardFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  }, []);

  // Reset board when switching colors
  useEffect(() => {
    handleReset();
  }, [treeColor, handleReset]);

  return (
    <div className={`${t.card} p-4 sm:p-5`}>
      <div className="flex items-center gap-2 mb-4">
        <GitBranch className={`w-4 h-4 ${isDark ? "text-[#5B9A6A]" : "text-[#436850]"}`} />
        <h3 className={`font-semibold text-sm ${t.textPrimary}`}>Opening Decision Tree</h3>
        <div className="ml-auto flex gap-1">
          <button
            onClick={() => setTreeColor("white")}
            className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg transition-colors ${
              treeColor === "white"
                ? isDark ? "bg-[#436850]/20 text-[#5B9A6A] border border-[#436850]/30" : "bg-[#436850]/10 text-[#436850] border border-[#436850]/20"
                : isDark ? "text-white/40 hover:text-white/60" : "text-[#436850] hover:text-[#436850]"
            }`}
          >As White</button>
          <button
            onClick={() => setTreeColor("black")}
            className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg transition-colors ${
              treeColor === "black"
                ? isDark ? "bg-[#436850]/20 text-[#5B9A6A] border border-[#436850]/30" : "bg-[#436850]/10 text-[#436850] border border-[#436850]/20"
                : isDark ? "text-white/40 hover:text-white/60" : "text-[#436850] hover:text-[#436850]"
            }`}
          >As Black</button>
        </div>
      </div>

      {nodes.length > 0 ? (
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Interactive Chessboard */}
          <div className="shrink-0">
            <div className="w-[200px] h-[200px] sm:w-[240px] sm:h-[240px] mx-auto lg:mx-0">
              <Chessboard
                options={{
                  position: boardFen,
                  boardOrientation: treeColor,
                  allowDragging: false,
                  boardStyle: {
                    borderRadius: "8px",
                    boxShadow: isDark ? "0 2px 8px rgba(0,0,0,0.4)" : "0 2px 8px rgba(0,0,0,0.1)",
                  },
                  darkSquareStyle: { backgroundColor: isDark ? "#4a7c59" : "#779952" },
                  lightSquareStyle: { backgroundColor: isDark ? "#8fbc8f" : "#edeed1" },
                }}
              />
            </div>
            {/* Selected node info */}
            {selectedNode && (
              <div className={`mt-2 text-center p-2 rounded-lg ${isDark ? "bg-[#0a1409] border border-[#1e2e22]/60" : "bg-[#FBFADA]/70 border border-[#ADBC9F]/60"}`}>
                <p className={`text-xs font-semibold ${t.textPrimary}`}>{selectedNode.label}</p>
                <p className={`text-[10px] ${t.textTertiary}`}>
                  {selectedNode.count} games • {Math.round(selectedNode.winRate * 100)}% win rate
                </p>
              </div>
            )}
            {activePath.length > 0 && (
              <button
                onClick={handleReset}
                className={`mt-2 w-full text-[10px] font-semibold py-1.5 rounded-lg transition-colors ${
                  isDark ? "text-white/50 hover:text-white/70 hover:bg-white/05" : "text-[#436850] hover:text-[#436850] hover:bg-[#ADBC9F]/50"
                }`}
              >
                ↺ Reset Board
              </button>
            )}
          </div>

          {/* Tree branches */}
          <div className="flex-1 space-y-0.5 overflow-y-auto max-h-[320px]">
            {nodes.map((node, i) => (
              <OpeningTreeBranch key={`${node.move}-${i}`} node={node} depth={0} isDark={isDark} t={t} activePath={activePath} onSelect={handleBranchSelect} />
            ))}
          </div>
        </div>
      ) : (
        <p className={`text-xs ${t.textTertiary}`}>No games found for this color.</p>
      )}
    </div>
  );
}

// ── Scout Report Tab ──────────────────────────────────────────────────────────────────

function ScoutReportTab({
  report, weaknesses, matchupSummary, enrichedLines, onViewLines, onPracticeProblemLine, isDark, t
}: {
  report: PrepReport;
  weaknesses: { label: string; detail: string; severity: "high" | "medium" }[];
  matchupSummary: {
    likelyBattle: string;
    studyFirst?: string | null;
    prepRisk?: string | null;
    colorAdvice?: string | null;
    whiteTarget?: string | null;
    whiteWhy?: string | null;
    whitePlan?: string | null;
    blackTarget?: string | null;
    blackWhy?: string | null;
    blackPlan?: string | null;
  } | null;
  enrichedLines: EnrichedPrepLine[];
  onViewLines: () => void;
  onPracticeProblemLine: (pl: ProblemLine) => void;
  isDark: boolean;
  t: Tokens;
}) {
  const opp = report.opponent;
  const [showAllProblemLines, setShowAllProblemLines] = useState(false);

  return (
    <div className="space-y-4">

      {/* ── Opening Repertoire (simplified: 2 as White, 2 as Black) ── */}
      <div className={`${t.card} p-4 sm:p-5`}>
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className={`w-4 h-4 ${isDark ? "text-[#5B9A6A]" : "text-[#436850]"}`} />
          <h3 className={`font-semibold text-sm ${t.textPrimary}`}>Opening Repertoire</h3>
        </div>
        <div className="grid grid-cols-2 gap-4">

          {/* As White */}
          <div>
            <p className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${isDark ? "text-white/40" : "text-[#436850]"}`}>
              ♔ As White
            </p>
            <div className="space-y-1.5">
              {opp.whiteOpenings
                .filter(o => !isBlackDefenseUI(o.name))
                .slice(0, 2)
                .map((o, i) => (
                  <div key={i} className={`px-3 py-2 rounded-xl text-xs font-semibold truncate ${
                    isDark ? "bg-[#1e2e22]/60 text-white/80" : "bg-[#ADBC9F]/40 text-[#12372A]"
                  }`}>
                    {o.name}
                  </div>
                ))}
              {opp.whiteOpenings.filter(o => !isBlackDefenseUI(o.name)).length === 0 && (
                <p className={`text-xs ${t.textTertiary}`}>No data</p>
              )}
            </div>
          </div>

          {/* As Black */}
          <div>
            <p className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${isDark ? "text-white/40" : "text-[#436850]"}`}>
              ♚ As Black
            </p>
            <div className="space-y-1.5">
              {(opp.blackOpenings.filter(o => isBlackDefenseUI(o.name)).length > 0
                ? opp.blackOpenings.filter(o => isBlackDefenseUI(o.name))
                : opp.blackOpenings
              ).slice(0, 2).map((o, i) => (
                <div key={i} className={`px-3 py-2 rounded-xl text-xs font-semibold truncate ${
                  isDark ? "bg-[#1e2e22]/60 text-white/80" : "bg-[#ADBC9F]/40 text-[#12372A]"
                }`}>
                  {o.name}
                </div>
              ))}
              {opp.blackOpenings.length === 0 && (
                <p className={`text-xs ${t.textTertiary}`}>No data</p>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* ── Prep Recommendations (replaces "How to Beat This Player") ── */}
      {report.prepRecommendations && report.prepRecommendations.length > 0 && (
        <div className={`${t.card} p-4 sm:p-5 border-2 ${
          isDark ? "border-[#436850]/40 bg-gradient-to-br from-[#0f1c11] to-[#162018]" : "border-[#436850]/20 bg-gradient-to-br from-[#f0fdf4] to-white"
        }`}>
          <div className="flex items-center gap-2 mb-4">
            <Target className={`w-5 h-5 ${isDark ? "text-amber-400" : "text-amber-500"}`} />
            <h3 className={`font-bold text-lg ${t.textPrimary}`}>Prep Recommendations</h3>
          </div>
          <div className="space-y-3">
            {report.prepRecommendations.map((rec, i) => {
              const confColors = {
                high: isDark ? "bg-emerald-500/12 text-emerald-400 border-emerald-500/20" : "bg-emerald-50 text-emerald-700 border-emerald-200",
                moderate: isDark ? "bg-amber-500/12 text-amber-400 border-amber-500/20" : "bg-amber-50 text-amber-700 border-amber-200",
                low: isDark ? "bg-red-500/12 text-red-400 border-red-500/20" : "bg-red-50 text-red-600 border-red-200",
              };
              const sideColors = rec.useAs === "white"
                ? isDark ? "bg-white/08 text-white/80 border-white/15" : "bg-[#ADBC9F]/40 text-[#12372A] border-[#ADBC9F]"
                : isDark ? "bg-[#1a1a2e] text-[#436850]/70 border-[#436850]/40/30" : "bg-[#12372A] text-white border-[#436850]/30";
              return (
                <div key={i} className={`p-3 rounded-xl border ${
                  isDark ? "bg-[#0a1409] border-[#1e2e22]/60" : "bg-white border-[#ADBC9F]/70"
                }`}>
                  {/* Side + Target + Confidence badges */}
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${sideColors}`}>
                      Use as {rec.useAs}
                    </span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${confColors[rec.confidence]}`}>
                      {rec.confidence === "high" ? "High confidence" : rec.confidence === "moderate" ? "Moderate confidence" : "Low confidence"}
                    </span>
                    <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-full border ${
                      rec.category === "opening" ? (isDark ? "bg-emerald-500/08 text-emerald-400/70 border-emerald-500/15" : "bg-emerald-50/60 text-emerald-600 border-emerald-200/60")
                      : rec.category === "middlegame" ? (isDark ? "bg-blue-500/08 text-blue-400/70 border-blue-500/15" : "bg-blue-50/60 text-blue-600 border-blue-200/60")
                      : (isDark ? "bg-purple-500/08 text-purple-400/70 border-purple-500/15" : "bg-purple-50/60 text-purple-600 border-purple-200/60")
                    }`}>
                      {rec.category}
                    </span>
                  </div>
                  {/* Target name */}
                  <p className={`text-sm font-bold mb-1 ${t.textPrimary}`}>{rec.target}</p>
                  {/* Evidence */}
                  <p className={`text-xs mb-2 ${t.textTertiary}`}>{rec.evidence}</p>
                  {/* Plan */}
                  <p className={`text-sm leading-relaxed ${t.textSecondary}`}>{rec.plan}</p>
                  {/* CTA */}
                  <button
                    onClick={onViewLines}
                    className={`mt-2 inline-flex items-center gap-1 text-xs font-medium ${
                      isDark ? "text-[#5B9A6A] hover:text-emerald-400" : "text-[#436850] hover:text-emerald-600"
                    } transition-colors`}
                  >
                    <BookOpen className="w-3 h-3" />
                    Study this line
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Legacy Victory Plan fallback (if no prepRecommendations) ── */}
      {(!report.prepRecommendations || report.prepRecommendations.length === 0) && report.victoryPlan && report.victoryPlan.length > 0 && (
        <div className={`${t.card} p-4 sm:p-5 border-2 ${
          isDark ? "border-[#436850]/40 bg-gradient-to-br from-[#0f1c11] to-[#162018]" : "border-[#436850]/20 bg-gradient-to-br from-[#f0fdf4] to-white"
        }`}>
          <div className="flex items-center gap-2 mb-4">
            <Zap className={`w-5 h-5 ${isDark ? "text-amber-400" : "text-amber-500"}`} />
            <h3 className={`font-bold text-lg ${t.textPrimary}`}>Prep Recommendations</h3>
          </div>
          <div className="space-y-3">
            {report.victoryPlan.map((item, i) => {
              const catColors = {
                opening: isDark ? "bg-emerald-500/12 text-emerald-400 border-emerald-500/20" : "bg-emerald-50 text-emerald-700 border-emerald-200",
                middlegame: isDark ? "bg-blue-500/12 text-blue-400 border-blue-500/20" : "bg-blue-50 text-blue-700 border-blue-200",
                endgame: isDark ? "bg-purple-500/12 text-purple-400 border-purple-500/20" : "bg-purple-50 text-purple-700 border-purple-200",
                psychological: isDark ? "bg-amber-500/12 text-amber-400 border-amber-500/20" : "bg-amber-50 text-amber-700 border-amber-200",
              };
              return (
                <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border ${
                  isDark ? "bg-[#0a1409] border-[#1e2e22]/60" : "bg-white border-[#ADBC9F]/70"
                }`}>
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold ${
                    isDark ? "bg-[#436850]/20 text-[#5B9A6A]" : "bg-[#436850]/10 text-[#436850]"
                  }`}>{i + 1}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`text-sm font-bold ${t.textPrimary}`}>{item.action}</p>
                      <span className={`text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded-full border ${catColors[item.category]}`}>
                        {item.category}
                      </span>
                    </div>
                    <p className={`text-xs mt-1 leading-relaxed ${t.textTertiary}`}>{item.reason}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Weaknesses ── */}
      {weaknesses.length > 0 && (
        <div className={`${t.card} p-4 sm:p-5`}>
          <div className="flex items-center gap-2 mb-3">
            <Crosshair className={`w-4 h-4 ${isDark ? "text-[#5B9A6A]" : "text-[#436850]"}`} />
            <h3 className={`font-semibold text-sm ${t.textPrimary}`}>Exploitable Weaknesses</h3>
          </div>
          <div className="space-y-2">
            {weaknesses.map((w, i) => (
              <div key={i} className={`flex items-start gap-3 p-3 rounded-xl ${
                w.severity === "high"
                  ? isDark ? "bg-red-500/08 border border-red-500/15" : "bg-red-50/80 border border-red-200/60"
                  : isDark ? "bg-amber-500/06 border border-amber-500/12" : "bg-amber-50/60 border border-amber-200/50"
              }`}>
                <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold ${
                  w.severity === "high"
                    ? isDark ? "bg-red-500/15 text-red-400" : "bg-red-100 text-red-600"
                    : isDark ? "bg-amber-500/15 text-amber-400" : "bg-amber-100 text-amber-600"
                }`}>{i + 1}</div>
                <div className="min-w-0">
                  <p className={`text-sm font-semibold ${t.textPrimary}`}>{w.label}</p>
                  <p className={`text-xs mt-0.5 ${t.textTertiary}`}>{w.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Your Game Plan (two-branch format, requirement 5) ── */}
      {matchupSummary && (
        <div className={`${t.card} p-4 sm:p-5`}>
          <div className="flex items-center gap-2 mb-4">
            <Target className={`w-4 h-4 ${isDark ? "text-[#5B9A6A]" : "text-[#436850]"}`} />
            <h3 className={`font-semibold text-sm ${t.textPrimary}`}>Your Game Plan</h3>
          </div>
          <div className="space-y-3">

            {/* Branch 1: If you have White */}
            {matchupSummary.whiteTarget && (
              <div className={`p-3 rounded-xl border ${
                isDark ? "bg-[#0a1409] border-[#1e2e22]/60" : "bg-white border-[#ADBC9F]/70"
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                    isDark ? "bg-white/08 text-white/80 border-white/15" : "bg-[#ADBC9F]/40 text-[#12372A] border-[#ADBC9F]"
                  }`}>♔ If you have White</span>
                </div>
                <p className={`text-sm font-semibold mb-1 ${t.textPrimary}`}>{matchupSummary.whiteTarget}</p>
                {matchupSummary.whiteWhy && (
                  <p className={`text-xs mb-2 ${t.textTertiary}`}>{matchupSummary.whiteWhy}</p>
                )}
                {matchupSummary.whitePlan && (
                  <p className={`text-sm leading-relaxed ${t.textSecondary}`}>{matchupSummary.whitePlan}</p>
                )}
              </div>
            )}

            {/* Branch 2: If you have Black */}
            {matchupSummary.blackTarget && (
              <div className={`p-3 rounded-xl border ${
                isDark ? "bg-[#0a1409] border-[#1e2e22]/60" : "bg-white border-[#ADBC9F]/70"
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                    isDark ? "bg-[#1a1a2e] text-[#436850]/70 border-[#436850]/40/30" : "bg-[#12372A] text-white border-[#436850]/30"
                  }`}>♚ If you have Black</span>
                </div>
                <p className={`text-sm font-semibold mb-1 ${t.textPrimary}`}>{matchupSummary.blackTarget}</p>
                {matchupSummary.blackWhy && (
                  <p className={`text-xs mb-2 ${t.textTertiary}`}>{matchupSummary.blackWhy}</p>
                )}
                {matchupSummary.blackPlan && (
                  <p className={`text-sm leading-relaxed ${t.textSecondary}`}>{matchupSummary.blackPlan}</p>
                )}
              </div>
            )}

            {/* Fallback: likelyBattle if no two-branch data */}
            {!matchupSummary.whiteTarget && !matchupSummary.blackTarget && (
              <p className={`text-sm leading-relaxed ${t.textSecondary}`}>{matchupSummary.likelyBattle}</p>
            )}

            {/* Study First */}
            {matchupSummary.studyFirst && (
              <div className={`flex items-start gap-2.5 p-3 rounded-xl ${
                isDark ? "bg-[#436850]/10 border border-[#436850]/20" : "bg-[#436850]/05 border border-[#436850]/12"
              }`}>
                <Flame className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${isDark ? "text-amber-400" : "text-amber-600"}`} />
                <div className="min-w-0">
                  <p className={`text-[10px] font-semibold uppercase tracking-widest mb-0.5 ${isDark ? "text-amber-400/60" : "text-amber-600/50"}`}>Study First</p>
                  <p className={`text-sm leading-relaxed ${t.textSecondary}`}>{matchupSummary.studyFirst}</p>
                </div>
              </div>
            )}

          </div>
        </div>
      )}



      {/* ── Behavior & Mistake Heatmap ── */}
      {report.behavior && (
        <div className={`${t.card} p-4 sm:p-5`}>
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className={`w-4 h-4 ${isDark ? "text-[#5B9A6A]" : "text-[#436850]"}`} />
            <h3 className={`font-semibold text-sm ${t.textPrimary}`}>Game Behavior & Pressure Points</h3>
          </div>
          {/* Mistake Heatmap */}
          <div className="mb-4">
            <p className={`text-[10px] font-semibold uppercase tracking-widest mb-2 ${t.textTertiary}`}>Where Losses Happen</p>
            <div className="flex rounded-xl overflow-hidden h-6 border border-transparent">
              {report.behavior.lossPhaseDistribution.opening > 0 && (
                <div
                  className={`flex items-center justify-center text-[10px] font-bold ${
                    isDark ? "bg-red-500/25 text-red-300" : "bg-red-100 text-red-700"
                  }`}
                  style={{ width: `${report.behavior.lossPhaseDistribution.opening}%` }}
                >
                  {report.behavior.lossPhaseDistribution.opening >= 15 && `Opening ${report.behavior.lossPhaseDistribution.opening}%`}
                </div>
              )}
              {report.behavior.lossPhaseDistribution.middlegame > 0 && (
                <div
                  className={`flex items-center justify-center text-[10px] font-bold ${
                    isDark ? "bg-amber-500/25 text-amber-300" : "bg-amber-100 text-amber-700"
                  }`}
                  style={{ width: `${report.behavior.lossPhaseDistribution.middlegame}%` }}
                >
                  {report.behavior.lossPhaseDistribution.middlegame >= 15 && `Middlegame ${report.behavior.lossPhaseDistribution.middlegame}%`}
                </div>
              )}
              {report.behavior.lossPhaseDistribution.endgame > 0 && (
                <div
                  className={`flex items-center justify-center text-[10px] font-bold ${
                    isDark ? "bg-purple-500/25 text-purple-300" : "bg-purple-100 text-purple-700"
                  }`}
                  style={{ width: `${report.behavior.lossPhaseDistribution.endgame}%` }}
                >
                  {report.behavior.lossPhaseDistribution.endgame >= 15 && `Endgame ${report.behavior.lossPhaseDistribution.endgame}%`}
                </div>
              )}
            </div>
          </div>
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div className={`text-center p-2 rounded-lg ${isDark ? "bg-[#0a1409] border border-[#1e2e22]/60" : "bg-[#FBFADA]/70 border border-[#ADBC9F]/60"}`}>
              <p className={`text-lg font-bold ${t.textPrimary}`}>{report.behavior.timeoutPct}%</p>
              <p className={`text-[10px] ${t.textTertiary}`}>Time Trouble</p>
            </div>
            <div className={`text-center p-2 rounded-lg ${isDark ? "bg-[#0a1409] border border-[#1e2e22]/60" : "bg-[#FBFADA]/70 border border-[#ADBC9F]/60"}`}>
              <p className={`text-lg font-bold ${t.textPrimary}`}>{report.behavior.resignPct}%</p>
              <p className={`text-[10px] ${t.textTertiary}`}>Resign Rate</p>
            </div>
            <div className={`text-center p-2 rounded-lg ${isDark ? "bg-[#0a1409] border border-[#1e2e22]/60" : "bg-[#FBFADA]/70 border border-[#ADBC9F]/60"}`}>
              <p className={`text-lg font-bold ${t.textPrimary}`}>{report.behavior.avgGameLength}</p>
              <p className={`text-[10px] ${t.textTertiary}`}>Avg Moves</p>
            </div>
          </div>
          {/* Strategy note */}
          <div className={`flex items-start gap-2 p-3 rounded-xl ${isDark ? "bg-amber-500/06 border border-amber-500/12" : "bg-amber-50/60 border border-amber-200/50"}`}>
            <Zap className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${isDark ? "text-amber-400" : "text-amber-600"}`} />
            <p className={`text-xs leading-relaxed ${t.textSecondary}`}>{report.behavior.strategyNote}</p>
          </div>
        </div>
      )}

      {/* ── Interactive Opening Tree ── */}
      {report.openingTree && (report.openingTree.asWhite.length > 0 || report.openingTree.asBlack.length > 0) && (
        <OpeningTreeCard openingTree={report.openingTree} isDark={isDark} t={t} />
      )}

      {/* ── Problem Lines ── */}
      {report.problemLines && report.problemLines.length > 0 && (
        <div className={`${t.card} p-4 sm:p-5`}>
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className={`w-4 h-4 ${isDark ? "text-red-400" : "text-red-500"}`} />
            <h3 className={`font-semibold text-sm ${t.textPrimary}`}>Problem Lines</h3>
            <span className={`ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full ${isDark ? "bg-red-500/12 text-red-400" : "bg-red-50 text-red-600 border border-red-200/60"}`}>
              Based on {report.opponent.gamesAnalyzed} games
            </span>
          </div>
          <div className="space-y-4">
            {(showAllProblemLines ? report.problemLines : report.problemLines.slice(0, 3)).map((pl, i) => {
              const moveNum = Math.ceil(pl.problemHalfMove / 2);
              const isWhiteMove = pl.problemHalfMove % 2 === 1;
              const moveLabel = isWhiteMove ? `${moveNum}.${pl.problemMove}` : `${moveNum}...${pl.problemMove}`;
              const betterLabel = pl.betterMove
                ? (isWhiteMove ? `${moveNum}.${pl.betterMove}` : `${moveNum}...${pl.betterMove}`)
                : null;
              const lossRatePct = Math.round(pl.lossRate * 100);
              const lineId = `problem-${pl.eco}-${pl.problemHalfMove}`;
              const practiceCount = getPracticeProgress()[lineId]?.count || 0;
              return (
                <div key={i} className={`rounded-xl overflow-hidden border ${
                  isDark ? "border-red-500/15 bg-red-500/04" : "border-red-200/60 bg-red-50/40"
                }`}>
                  {/* Header row */}
                  <div className="flex items-start gap-3 p-3 pb-2">
                    <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold ${
                      isDark ? "bg-red-500/15 text-red-400" : "bg-red-100 text-red-600"
                    }`}>{i + 1}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={`text-sm font-semibold ${t.textPrimary}`}>{pl.name}</p>
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${t.monoBlock}`}>{pl.eco}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                          isDark ? "bg-white/06 text-white/40" : "bg-[#ADBC9F]/40 text-[#436850]"
                        }`}>as {pl.color}</span>
                        {practiceCount > 0 && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                            isDark ? "bg-emerald-500/12 text-emerald-400" : "bg-emerald-50 text-emerald-600 border border-emerald-200/60"
                          }`}>✓ Practiced {practiceCount}×</span>
                        )}
                      </div>
                      <p className={`text-xs mt-1 ${t.textTertiary}`}>
                        {pl.lossCount} losses in {pl.gamesCount} games ({lossRatePct}% loss rate)
                      </p>
                    </div>
                  </div>
                  {/* Problem move highlight */}
                  <div className={`mx-3 mb-3 p-3 rounded-lg ${
                    isDark ? "bg-[#0a1409] border border-[#1e2e22]/60" : "bg-white border border-[#ADBC9F]/70"
                  }`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-[10px] font-bold uppercase tracking-widest ${
                        isDark ? "text-red-400/70" : "text-red-500/80"
                      }`}>Problem Move</span>
                      <span className={`text-[10px] ${t.textTertiary}`}>move {moveNum}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-mono text-sm font-bold px-2.5 py-1 rounded-lg ${
                        isDark ? "bg-red-500/15 text-red-400 border border-red-500/20" : "bg-red-50 text-red-600 border border-red-200"
                      }`}>{moveLabel}</span>
                      {betterLabel && (
                        <>
                          <ArrowRight className={`w-3.5 h-3.5 shrink-0 ${t.textTertiary}`} />
                          <span className={`font-mono text-sm font-bold px-2.5 py-1 rounded-lg ${
                            isDark ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20" : "bg-emerald-50 text-emerald-600 border border-emerald-200"
                          }`}>{betterLabel}</span>
                          <span className={`text-xs ${t.textTertiary}`}>is stronger</span>
                        </>
                      )}
                    </div>
                    {/* Move sequence leading to the problem */}
                    <p className={`mt-2 text-[11px] font-mono leading-relaxed ${t.textTertiary}`}>{pl.moves}</p>
                    {/* Coaching note */}
                    {pl.coachingNote && (
                      <p className={`mt-2 text-[11px] leading-relaxed italic ${isDark ? "text-amber-300/70" : "text-amber-700/80"}`}>
                        {pl.coachingNote}
                      </p>
                    )}
                  </div>
                  {/* Practice shortcut */}
                  <div className="px-3 pb-3">
                    <button
                      onClick={() => onPracticeProblemLine(pl)}
                      className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
                        isDark
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/18 hover:border-emerald-500/35"
                          : "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                      }`}
                    >
                      <PlayCircle className="w-3.5 h-3.5" />
                      Practice this problem line
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          {/* Show more / Show less toggle */}
          {report.problemLines.length > 3 && (
            <button
              onClick={() => setShowAllProblemLines(prev => !prev)}
              className={`mt-4 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-colors ${
                isDark
                  ? "text-red-400/70 hover:text-red-400 hover:bg-red-500/06"
                  : "text-red-500/70 hover:text-red-600 hover:bg-red-50/60"
              }`}
            >
              {showAllProblemLines ? (
                <>
                  <ChevronRight className="w-3.5 h-3.5 rotate-[-90deg]" />
                  Show less
                </>
              ) : (
                <>
                  <ChevronRight className="w-3.5 h-3.5 rotate-90" />
                  Show {report.problemLines.length - 3} more problem {report.problemLines.length - 3 === 1 ? "line" : "lines"}
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* ── Engine Analysis Patterns (Stockfish-backed) ── */}
      {report.enginePatterns && report.enginePatterns.patterns.length > 0 && (
        <EnginePatternSection enginePatterns={report.enginePatterns} isDark={isDark} t={t} />
      )}

      {/* ── Next Step Nudge ── */}
      {enrichedLines.length > 0 && (
        <button
          onClick={onViewLines}
          className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl border transition-all active:scale-[0.99] group ${
            isDark
              ? "border-[#2e4a34]/40 hover:border-[#436850]/50 hover:bg-[#162018]/50"
              : "border-[#ADBC9F]/80 hover:border-[#436850]/20 hover:bg-[#436850]/02"
          }`}
        >
          <span className={`text-sm ${t.textTertiary}`}>{enrichedLines.length} counter-lines ready</span>
          <div className={`flex items-center gap-1.5 text-sm font-medium ${isDark ? "text-[#5B9A6A]" : "text-[#436850]"}`}>
            Study Lines
            <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </div>
        </button>
      )}
    </div>
  );
}

// ── Engine Pattern Section ────────────────────────────────────────────────────
// Displays Stockfish-backed pattern detection results with confidence badges,
// severity indicators, expandable evidence, and beginner-friendly descriptions.

function EnginePatternSection({ enginePatterns, isDark, t }: {
  enginePatterns: EnginePatterns;
  isDark: boolean;
  t: Tokens;
}) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const patternTypeIcon = (type: EnginePattern["patternType"]) => {
    switch (type) {
      case "opening_trap":      return <AlertCircle className="w-3.5 h-3.5" />;
      case "tactical_weakness": return <Crosshair className="w-3.5 h-3.5" />;
      case "endgame_weakness":  return <Trophy className="w-3.5 h-3.5" />;
      case "time_pressure":     return <Zap className="w-3.5 h-3.5" />;
      case "phase_blunder":     return <AlertTriangle className="w-3.5 h-3.5" />;
    }
  };

  const confidenceColors = {
    high:     isDark ? "bg-emerald-500/12 text-emerald-400 border-emerald-500/20" : "bg-emerald-50 text-emerald-700 border-emerald-200",
    moderate: isDark ? "bg-amber-500/12 text-amber-400 border-amber-500/20"     : "bg-amber-50 text-amber-700 border-amber-200",
    low:      isDark ? "bg-[#436850]/12 text-[#436850] border-[#436850]/20"        : "bg-[#FBFADA]/70 text-[#436850] border-[#ADBC9F]",
  };

  const severityBar = (score: number) => {
    const pct = Math.min(100, score);
    const color = pct >= 70
      ? "bg-red-500"
      : pct >= 40
        ? "bg-amber-400"
        : "bg-emerald-500";
    return (
      <div className={`h-1 rounded-full overflow-hidden ${isDark ? "bg-white/08" : "bg-[#ADBC9F]"}`}>
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    );
  };

  return (
    <div className={`${t.card} p-4 sm:p-5`}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <Activity className={`w-4 h-4 ${isDark ? "text-[#5B9A6A]" : "text-[#436850]"}`} />
        <h3 className={`font-semibold text-sm ${t.textPrimary}`}>Engine Analysis</h3>
        <span className={`ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
          isDark ? "bg-[#436850]/12 text-[#5B9A6A] border-[#436850]/25" : "bg-[#436850]/08 text-[#436850] border-[#436850]/15"
        }`}>
          Stockfish
        </span>
      </div>
      <p className={`text-[11px] mb-4 ${t.textTertiary}`}>
        {enginePatterns.gamesAnalyzed} games analyzed
        {enginePatterns.positionsAnalyzed > 0 && ` · ${enginePatterns.positionsAnalyzed} positions evaluated`}
      </p>

      {/* Summary stats row */}
      {(enginePatterns.avgBlundersPerGame > 0 || enginePatterns.avgMistakesPerGame > 0) && (
        <div className={`grid grid-cols-3 gap-2 mb-4 p-3 rounded-xl ${
          isDark ? "bg-[#0a1409] border border-[#1e2e22]/60" : "bg-[#FBFADA]/70 border border-[#ADBC9F]/60"
        }`}>
          <div className="text-center">
            <p className={`text-base font-bold ${
              enginePatterns.avgBlundersPerGame >= 1 ? (isDark ? "text-red-400" : "text-red-600") : t.textPrimary
            }`}>{enginePatterns.avgBlundersPerGame.toFixed(1)}</p>
            <p className={`text-[9px] font-semibold uppercase tracking-wider mt-0.5 ${t.textTertiary}`}>Blunders/game</p>
          </div>
          <div className="text-center">
            <p className={`text-base font-bold ${
              enginePatterns.avgMistakesPerGame >= 1.5 ? (isDark ? "text-amber-400" : "text-amber-600") : t.textPrimary
            }`}>{enginePatterns.avgMistakesPerGame.toFixed(1)}</p>
            <p className={`text-[9px] font-semibold uppercase tracking-wider mt-0.5 ${t.textTertiary}`}>Mistakes/game</p>
          </div>
          <div className="text-center">
            <p className={`text-base font-bold capitalize ${
              enginePatterns.worstPhase === "opening" ? (isDark ? "text-red-400" : "text-red-600")
              : enginePatterns.worstPhase === "endgame" ? (isDark ? "text-purple-400" : "text-purple-600")
              : (isDark ? "text-amber-400" : "text-amber-600")
            }`}>{enginePatterns.worstPhase}</p>
            <p className={`text-[9px] font-semibold uppercase tracking-wider mt-0.5 ${t.textTertiary}`}>Worst phase</p>
          </div>
        </div>
      )}

      {/* Pattern cards */}
      <div className="space-y-2.5">
        {enginePatterns.patterns.map((pattern, i) => (
          <div key={i} className={`rounded-xl border overflow-hidden transition-all ${
            isDark ? "border-[#1e2e22]/70 bg-[#0a1409]" : "border-[#ADBC9F]/70 bg-white"
          }`}>
            {/* Pattern header — always visible */}
            <button
              onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}
              className={`w-full flex items-start gap-3 p-3 text-left transition-colors ${
                isDark ? "hover:bg-white/02" : "hover:bg-[#FBFADA]/60"
              }`}
            >
              {/* Pattern type icon */}
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                isDark ? "bg-[#162018] text-[#5B9A6A]" : "bg-[#436850]/08 text-[#436850]"
              }`}>
                {patternTypeIcon(pattern.patternType)}
              </div>

              <div className="flex-1 min-w-0">
                {/* Label + confidence badge */}
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <p className={`text-sm font-semibold ${t.textPrimary}`}>{pattern.label}</p>
                  <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full border ${
                    confidenceColors[pattern.confidence]
                  }`}>
                    {pattern.confidence === "high" ? "High confidence" : pattern.confidence === "moderate" ? "Moderate" : "Low confidence"}
                  </span>
                </div>

                {/* Severity bar */}
                <div className="mb-1.5">{severityBar(pattern.severityScore)}</div>

                {/* Frequency */}
                <p className={`text-[10px] ${t.textTertiary}`}>
                  Observed in {pattern.frequency}/{pattern.totalGames} games
                </p>
              </div>

              {/* Expand chevron */}
              <ChevronDown className={`w-3.5 h-3.5 shrink-0 mt-1.5 transition-transform ${t.textTertiary} ${
                expandedIdx === i ? "rotate-180" : ""
              }`} />
            </button>

            {/* Expanded detail */}
            {expandedIdx === i && (
              <div className={`px-3 pb-3 border-t ${
                isDark ? "border-[#1e2e22]/60" : "border-[#ADBC9F]/60"
              }`}>
                {/* Description */}
                <p className={`text-sm leading-relaxed mt-3 mb-3 ${t.textSecondary}`}>{pattern.description}</p>

                {/* Evidence links */}
                {pattern.evidence && pattern.evidence.length > 0 && (
                  <div className="space-y-1.5">
                    <p className={`text-[10px] font-semibold uppercase tracking-widest mb-1.5 ${t.textTertiary}`}>Evidence</p>
                    {pattern.evidence.map((ev, j) => (
                      <div key={j} className={`flex items-center gap-2 p-2 rounded-lg text-[11px] ${
                        isDark ? "bg-[#162018] border border-[#1e2e22]/60" : "bg-[#FBFADA]/70 border border-[#ADBC9F]/60"
                      }`}>
                        {ev.eco && (
                          <span className={`font-mono font-bold px-1.5 py-0.5 rounded ${t.monoBlock}`}>{ev.eco}</span>
                        )}
                        {ev.phase && (
                          <span className={`capitalize ${t.textTertiary}`}>{ev.phase}</span>
                        )}
                        {ev.gameUrl && (
                          <a
                            href={ev.gameUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`ml-auto flex items-center gap-1 font-medium ${
                              isDark ? "text-[#5B9A6A] hover:text-emerald-400" : "text-[#436850] hover:text-emerald-600"
                            } transition-colors`}
                          >
                            View game
                            <ChevronRight className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function OpeningRow({ name, winRate, count, isDark, t }: { name: string; winRate: number; count: number; isDark: boolean; t: Tokens }) {
  const wr = Math.round(winRate * 100);
  return (
    <div className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg ${t.cardSubtle}`}>
      <span className={`text-xs truncate ${t.textSecondary}`}>{name}</span>
      <div className="flex items-center gap-2 shrink-0">
        <span className={`text-[10px] ${t.textTertiary}`}>{count}g</span>
        <span className={`text-xs font-semibold ${wr >= 55 ? (isDark ? "text-emerald-400" : "text-emerald-600") : wr < 40 ? (isDark ? "text-red-400" : "text-red-500") : t.textTertiary}`}>
          {wr}%
        </span>
      </div>
    </div>
  );
}

function _EndgameBar({ profile, isDark, t }: { profile: { checkmates: number; resignations: number; timeouts: number; draws: number; total: number }; isDark: boolean; t: Tokens }) {
  if (profile.total === 0) return <p className={`text-xs ${t.textTertiary}`}>No endgame data</p>;
  const matePct = Math.round((profile.checkmates / profile.total) * 100);
  const resignPct = Math.round((profile.resignations / profile.total) * 100);
  const timeoutPct = Math.round((profile.timeouts / profile.total) * 100);
  const drawPct = Math.round((profile.draws / profile.total) * 100);

  return (
    <div>
      <div className="h-2 rounded-full overflow-hidden flex gap-px" style={{ background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }}>
        <div className="bg-emerald-500 rounded-l-full transition-all" style={{ width: `${matePct}%` }} title={`Checkmates ${matePct}%`} />
        <div className="bg-red-400 transition-all" style={{ width: `${resignPct}%` }} title={`Resignations ${resignPct}%`} />
        <div className="bg-amber-400 transition-all" style={{ width: `${timeoutPct}%` }} title={`Timeouts ${timeoutPct}%`} />
        <div className="bg-gray-400 rounded-r-full transition-all" style={{ width: `${drawPct}%` }} title={`Draws ${drawPct}%`} />
      </div>
      <div className={`flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs ${t.textTertiary}`}>
        <span><span className="text-emerald-500 font-semibold">{matePct}%</span> Checkmate</span>
        <span><span className="text-red-400 font-semibold">{resignPct}%</span> Resign</span>
        <span><span className="text-amber-400 font-semibold">{timeoutPct}%</span> Timeout</span>
        <span><span className="text-[#436850] font-semibold">{drawPct}%</span> Draw</span>
      </div>
    </div>
  );
}

// ── Study Lines Tab ───────────────────────────────────────────────────────────

function StudyLinesTab({
  enrichedLines, onPracticeLine, onStartPractice, isDark, t
}: {
  enrichedLines: EnrichedPrepLine[];
  onPracticeLine: (idx: number) => void;
  onStartPractice: () => void;
  isDark: boolean;
  t: Tokens;
}) {
  if (enrichedLines.length === 0) {
    return (
      <EmptyState
        icon={<Target className="w-6 h-6 text-[#5B9A6A]" />}
        title="No lines generated"
        description="Not enough opening data was found to generate preparation lines."
        isDark={isDark}
        t={t}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Lines list — each with inline ChessLineViewer */}
      {enrichedLines.map((line, i) => {
        const priority = line.confidence === "high" ? "must-know" : line.confidence === "medium" ? "likely" : "useful";
        const confLabel = line.confidence === "high" ? "High confidence" : line.confidence === "medium" ? "Moderate confidence" : "Low confidence";
        const lineExt = line as typeof line & { useAs?: "white" | "black"; mainIdea?: string; keyPlan?: string; exploits?: string; sampleSize?: number };
        const useAs = lineExt.useAs;
        const mainIdea = lineExt.mainIdea;
        const keyPlan = lineExt.keyPlan;
        const exploits = lineExt.exploits;
        const sampleNote = lineExt.sampleSize ? `Based on ${lineExt.sampleSize} games` : undefined;
        return (
          <div key={i} className={`rounded-2xl border overflow-hidden ${
            isDark ? "border-[#1e2e22]/60 bg-[#0a1409]" : "border-[#ADBC9F]/70 bg-white"
          }`}>
            {/* Header card with metadata */}
            <div className="p-4 space-y-2">
              {/* Priority + metadata row */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] font-bold w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${
                  isDark ? "bg-[#436850]/15 text-[#5B9A6A]" : "bg-[#436850]/06 text-[#436850]"
                }`}>{i + 1}</span>
                {/* Side badge */}
                {useAs && (
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                    useAs === "white"
                      ? isDark ? "bg-white/08 text-white/80 border-white/15" : "bg-[#ADBC9F]/40 text-[#12372A] border-[#ADBC9F]"
                      : isDark ? "bg-[#1a1a2e] text-[#436850]/70 border-[#436850]/40/30" : "bg-[#12372A] text-white border-[#436850]/30"
                  }`}>
                    Use as {useAs}
                  </span>
                )}
                {line.isTrainFirst && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                    isDark ? "bg-amber-500/15 text-amber-400 border border-amber-500/20" : "bg-amber-50 text-amber-700 border border-amber-200"
                  }`}>
                    <Flame className="w-2.5 h-2.5" /> Study First
                  </span>
                )}
                <PriorityBadge priority={priority} isDark={isDark} />
                {line.lineType === "surprise" && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    isDark ? "bg-violet-500/15 text-violet-300 border border-violet-500/25" : "bg-violet-50 text-violet-700 border border-violet-200"
                  }`}>Surprise</span>
                )}
                {line.collisionScore > 0 && (
                  <span className={`text-[10px] font-medium flex items-center gap-1 ml-auto ${
                    line.collisionScore >= 70 ? (isDark ? "text-emerald-400" : "text-emerald-600")
                    : line.collisionScore >= 40 ? (isDark ? "text-amber-400" : "text-amber-600")
                    : t.textTertiary
                  }`}>
                    <Crosshair className="w-2.5 h-2.5" />
                    {line.collisionScore}% match
                  </span>
                )}
              </div>

              {/* Targets / Exploits */}
              {exploits && (
                <div className={`flex items-start gap-2 text-xs ${
                  isDark ? "text-amber-300/70" : "text-amber-700/80"
                }`}>
                  <Crosshair className="w-3 h-3 shrink-0 mt-0.5" />
                  <span>Targets: {exploits}</span>
                </div>
              )}

              {/* Main Idea */}
              {mainIdea && (
                <div className={`p-2.5 rounded-lg ${
                  isDark ? "bg-[#162018] border border-[#1e2e22]/60" : "bg-[#FBFADA]/70 border border-[#ADBC9F]/60"
                }`}>
                  <p className={`text-[10px] font-semibold uppercase tracking-widest mb-1 ${
                    isDark ? "text-[#5B9A6A]/70" : "text-[#436850]/60"
                  }`}>Main Idea</p>
                  <p className={`text-xs leading-relaxed ${t.textSecondary}`}>{mainIdea}</p>
                </div>
              )}

              {/* Key Plan */}
              {keyPlan && (
                <div className={`p-2.5 rounded-lg ${
                  isDark ? "bg-blue-500/05 border border-blue-500/10" : "bg-blue-50/50 border border-blue-200/40"
                }`}>
                  <p className={`text-[10px] font-semibold uppercase tracking-widest mb-1 ${
                    isDark ? "text-blue-400/70" : "text-blue-600/60"
                  }`}>What to Watch For</p>
                  <p className={`text-xs leading-relaxed ${t.textSecondary}`}>{keyPlan}</p>
                </div>
              )}

              {/* Confidence + sample size */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                  line.confidence === "high" ? (isDark ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-emerald-50 text-emerald-700 border-emerald-200")
                  : line.confidence === "medium" ? (isDark ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : "bg-amber-50 text-amber-700 border-amber-200")
                  : (isDark ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-red-50 text-red-600 border-red-200")
                }`}>{confLabel}</span>
                {sampleNote && (
                  <span className={`text-[10px] ${t.textTertiary}`}>{sampleNote}</span>
                )}
                {line.confidence === "low" && (
                  <span className={`text-[10px] italic ${isDark ? "text-red-400/60" : "text-red-500/60"}`}>
                    Use cautiously — limited data
                  </span>
                )}
              </div>
            </div>

            {/* Context header before board (requirement 8) */}
            <div className={`mx-4 mb-2 p-3 rounded-xl border ${
              isDark ? "bg-[#060e07] border-[#1e2e22]/50" : "bg-[#f0fdf4]/70 border-[#436850]/10"
            }`}>
              <p className={`text-[10px] font-semibold uppercase tracking-widest mb-1.5 ${
                isDark ? "text-[#5B9A6A]/70" : "text-[#436850]/60"
              }`}>Why study this line</p>
              <p className={`text-xs leading-relaxed ${t.textSecondary}`}>
                {useAs === "white"
                  ? `You will play as White in this line. The goal is to ${
                      exploits
                        ? `exploit their weakness in the ${exploits}`
                        : `steer the game into positions where your opponent is uncomfortable`
                    }. Study the move order carefully before practicing.`
                  : useAs === "black"
                  ? `You will play as Black in this line. The goal is to ${
                      exploits
                        ? `counter their ${exploits} and reach a comfortable position`
                        : `reach a solid position and look for counterplay`
                    }. Study the move order carefully before practicing.`
                  : `Study the key moves in this line before practicing. The goal is to understand the plan, not just memorize moves.`
                }
              </p>
            </div>

            {/* Interactive board */}
            <div className="px-4 pb-2">
              <ChessLineViewer
                moves={line.moves}
                lineName={line.name}
                rationale={line.rationale}
                eco={line.eco}
                isDark={isDark}
              />
            </div>

            {/* Practice this line button */}
            <div className="px-4 pb-4">
              <button
                data-testid={`practice-line-btn-${i}`}
                onClick={() => {
                  const fullIndex = enrichedLines.findIndex(
                    (el) => el.name === line.name && el.moves === line.moves
                  );
                  onPracticeLine(fullIndex >= 0 ? fullIndex : i);
                }}
                className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                  isDark
                    ? "text-[#5B9A6A] hover:bg-[#5B9A6A]/10 border border-[#5B9A6A]/20 hover:border-[#5B9A6A]/40"
                    : "text-[#436850] hover:bg-[#436850]/08 border border-[#436850]/15 hover:border-[#436850]/30"
                }`}
              >
                <Dumbbell className="w-3 h-3" />
                Practice this line
              </button>
            </div>
          </div>
        );
      })}

      {/* Next step nudge */}
      <button
        onClick={onStartPractice}
        className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl border transition-all active:scale-[0.99] group ${
          isDark
            ? "border-[#2e4a34]/40 hover:border-[#436850]/50 hover:bg-[#162018]/50"
            : "border-[#ADBC9F]/80 hover:border-[#436850]/20 hover:bg-[#436850]/02"
        }`}
      >
        <span className={`text-sm ${t.textTertiary}`}>Ready to drill these lines?</span>
        <div className={`flex items-center gap-1.5 text-sm font-medium ${isDark ? "text-[#5B9A6A]" : "text-[#436850]"}`}>
          Start Practice
          <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
        </div>
      </button>
    </div>
  );
}

function PriorityBadge({ priority, isDark }: { priority: "must-know" | "likely" | "useful"; isDark: boolean }) {
  const config = {
    "must-know": { label: "Must Know", dot: "bg-emerald-500", dark: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400", light: "bg-emerald-50 border-emerald-200 text-emerald-700" },
    "likely":    { label: "Likely",    dot: "bg-amber-500",   dark: "bg-amber-500/10 border-amber-500/20 text-amber-400",     light: "bg-amber-50 border-amber-200 text-amber-700" },
    "useful":    { label: "Useful",    dot: "bg-[#436850]/60",    dark: "bg-white/05 border-white/10 text-white/35",               light: "bg-[#FBFADA]/70 border-[#ADBC9F] text-[#436850]" },
  };
  const c = config[priority];
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1 ${isDark ? c.dark : c.light}`}>
      <span className={`w-1 h-1 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}

// ── Practice Board Tab ────────────────────────────────────────────────────────

function PracticeBoardTab({
  enrichedLines, practiceLineIndex, practiceCustomLine, onClearCustomLine, isDark, t
}: {
  enrichedLines: EnrichedPrepLine[];
  practiceLineIndex: number | undefined;
  practiceCustomLine: { id: string; name: string; moves: string; eco: string; rationale: string } | null;
  onClearCustomLine: () => void;
  isDark: boolean;
  t: Tokens;
}) {
  // If a custom problem line was requested, show it directly
  if (practiceCustomLine) {
    return (
      <div className="space-y-4">
        <div className={`flex items-center gap-2 px-1`}>
          <PlayCircle className={`w-4 h-4 ${isDark ? "text-emerald-400" : "text-emerald-600"}`} />
          <span className={`text-xs font-semibold flex-1 ${isDark ? "text-emerald-400" : "text-emerald-700"}`}>
            Drilling problem line: {practiceCustomLine.name}
          </span>
          {enrichedLines.length > 0 && (
            <button
              onClick={onClearCustomLine}
              className={`flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-lg transition-colors ${
                isDark
                  ? "text-white/40 hover:text-white/70 hover:bg-white/06 border border-white/08"
                  : "text-[#436850] hover:text-[#12372A] hover:bg-[#ADBC9F]/50 border border-[#ADBC9F]"
              }`}
            >
              <ChevronRight className="w-3 h-3 rotate-180" />
              Back to all lines
            </button>
          )}
        </div>
        <ChessPracticeBoard
          lines={[practiceCustomLine]}
          isDark={isDark}
          initialLineIndex={0}
        />
      </div>
    );
  }

  if (enrichedLines.length === 0) {
    return (
      <EmptyState
        icon={<Trophy className="w-6 h-6 text-[#5B9A6A]" />}
        title="No lines to practice"
        description="Generate prep lines first by running a report on an opponent with enough game history."
        isDark={isDark}
        t={t}
      />
    );
  }

  const currentLine = enrichedLines[practiceLineIndex ?? 0];
  type LineExt = typeof currentLine & { useAs?: "white" | "black"; exploits?: string };
  const useAs: "white" | "black" | undefined = currentLine ? (currentLine as LineExt).useAs : undefined;
  const exploits: string | undefined = currentLine ? (currentLine as LineExt).exploits : undefined;

  return (
    <div className="space-y-4">
      {/* Practice context card */}
      <div className={`p-3 rounded-xl border ${
        isDark ? "bg-[#0f1c11] border-[#1e2e22]/60" : "bg-[#FBFADA]/70 border-[#ADBC9F]/60"
      }`}>
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <Dumbbell className={`w-3.5 h-3.5 ${isDark ? "text-[#5B9A6A]" : "text-[#436850]"}`} />
          <span className={`text-xs font-semibold ${t.textPrimary}`}>Practice Mode</span>
          {useAs && (
            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
              useAs === "white"
                ? isDark ? "bg-white/08 text-white/80 border-white/15" : "bg-[#ADBC9F]/40 text-[#12372A] border-[#ADBC9F]"
                : isDark ? "bg-[#1a1a2e] text-[#436850]/70 border-[#436850]/40/30" : "bg-[#12372A] text-white border-[#436850]/30"
            }`}>
              You play as {useAs}
            </span>
          )}
        </div>
        <p className={`text-xs leading-relaxed ${t.textSecondary}`}>
          Find the correct move for each position. The computer plays the opponent's moves automatically.
          {useAs && ` You are practicing as ${useAs.charAt(0).toUpperCase() + useAs.slice(1)}.`}
          {exploits && ` Goal: reach the ${currentLine?.name} setup because this opponent has struggled against it.`}
        </p>
        {currentLine && (
          <p className={`text-[10px] mt-1.5 italic ${t.textTertiary}`}>
            Hint style: hints explain the idea behind the move, not just the notation.
          </p>
        )}
      </div>
      <ChessPracticeBoard
        lines={enrichedLines.map((l, i) => ({
          id: String(i),
          name: l.name,
          moves: l.moves,
          eco: l.eco,
          rationale: l.rationale,
        }))}
        isDark={isDark}
        initialLineIndex={practiceLineIndex}
      />
    </div>
  );
}

// ── Shared Components ─────────────────────────────────────────────────────────

// ── Premium Loading State (requirement 11) ───────────────────────────────────────────────────────────────────────────
function PrepLoadingState({ username, isDark, t }: { username: string; isDark: boolean; t: Tokens }) {
  const [step, setStep] = useState(0);
  const steps = [
    "Fetching recent games…",
    "Classifying openings…",
    "Finding targetable weaknesses…",
    "Building your prep plan…",
  ];
  useEffect(() => {
    const interval = setInterval(() => {
      setStep(s => Math.min(s + 1, steps.length - 1));
    }, 1800);
    return () => clearInterval(interval);
  }, [steps.length]);
  return (
    <div className={`${t.card} py-16 flex flex-col items-center gap-5`}>
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
        isDark ? "bg-[#162018]" : "bg-[#436850]/06"
      }`}>
        <Loader2 className="w-7 h-7 text-[#5B9A6A] animate-spin" />
      </div>
      <div className="text-center space-y-2 max-w-xs">
        <p className={`text-sm font-semibold ${t.textPrimary}`}>Scouting {username}</p>
        <div className="space-y-1.5">
          {steps.map((s, i) => (
            <div key={i} className={`flex items-center gap-2 justify-center transition-all duration-500 ${
              i < step ? "opacity-40" : i === step ? "opacity-100" : "opacity-20"
            }`}>
              {i < step ? (
                <span className="text-[#5B9A6A] text-xs">&#10003;</span>
              ) : i === step ? (
                <span className="w-1.5 h-1.5 rounded-full bg-[#5B9A6A] animate-pulse inline-block" />
              ) : (
                <span className="w-1.5 h-1.5 rounded-full bg-current opacity-20 inline-block" />
              )}
              <span className={`text-xs ${
                i === step ? t.textSecondary : t.textTertiary
              }`}>{s}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Detailed Error State (requirement 11) ───────────────────────────────────────────────────────────────────────────
function PrepErrorState({
  error, username, onRetry, onUseAllFormats, onAnalyze100, isDark, t
}: {
  error: string;
  username: string;
  onRetry: () => void;
  onUseAllFormats: () => void;
  onAnalyze100: () => void;
  isDark: boolean;
  t: Tokens;
}) {
  return (
    <div className={`${t.card} p-5 sm:p-6`}>
      <div className="flex items-start gap-3 mb-4">
        <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
        <div>
          <p className={`text-sm font-semibold ${t.textPrimary}`}>We couldn’t generate a prep report for this username.</p>
          {error && <p className={`text-xs mt-1 ${t.textTertiary}`}>{error}</p>}
        </div>
      </div>
      <div className={`p-3 rounded-xl mb-4 ${
        isDark ? "bg-[#0d1a0f]/60 border border-[#1e2e22]/60" : "bg-[#FBFADA]/70/70 border border-[#ADBC9F]/60"
      }`}>
        <p className={`text-xs font-semibold mb-2 ${t.textTertiary}`}>Possible reasons:</p>
        <ul className={`space-y-1 text-xs ${t.textTertiary}`}>
          <li>• The Chess.com username may not exist — check spelling and try again</li>
          <li>• There may not be enough recent games in this format (try switching to All)</li>
          <li>• Chess.com game data may be temporarily unavailable</li>
          <li>• Try increasing depth to 100 games for players with sparse recent activity</li>
        </ul>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={onRetry}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            isDark ? "bg-[#436850] text-white hover:bg-[#4a7a56]" : "bg-[#436850] text-white hover:bg-[#2e5236]"
          }`}
        >
          <RefreshCw className="w-3 h-3" /> Try again
        </button>
        {username && (
          <button
            onClick={onUseAllFormats}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
              isDark ? "border-[#1e2e22]/60 text-white/70 hover:text-white hover:bg-[#162018]" : "border-[#ADBC9F] text-[#12372A]/85 hover:bg-[#ADBC9F]/50"
            }`}
          >
            Use All formats
          </button>
        )}
        {username && (
          <button
            onClick={onAnalyze100}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
              isDark ? "border-[#1e2e22]/60 text-white/70 hover:text-white hover:bg-[#162018]" : "border-[#ADBC9F] text-[#12372A]/85 hover:bg-[#ADBC9F]/50"
            }`}
          >
            Analyze 100 games
          </button>
        )}
      </div>
    </div>
  );
}

function EmptyState({
  icon, title, description, isDark, t
}: {
  icon: React.ReactNode; title: string; description: string; isDark: boolean; t: Tokens;
}) {
  return (
    <div className={`py-12 px-6 rounded-2xl flex flex-col items-center gap-4 text-center ${isDark ? "bg-[#0f1c11] border border-[#1e2e22]/70" : "bg-white border border-[#ADBC9F]/80 shadow-sm"}`}>
      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${isDark ? "bg-[#162018]" : "bg-[#436850]/06"}`}>
        {icon}
      </div>
      <div>
        <h3 className={`font-semibold text-sm ${t.textPrimary}`}>{title}</h3>
        <p className={`text-sm mt-1 ${t.textTertiary} max-w-xs mx-auto leading-relaxed`}>{description}</p>
      </div>
    </div>
  );
}

function SavedReportsPanel({
  reports, loading, savedId: _savedId, onSelect, onDelete, onClose, isDark, t
}: {
  reports: SavedReportMeta[];
  loading: boolean;
  savedId: number | null;
  onSelect: (username: string) => void;
  onDelete: (id: number) => void;
  onClose: () => void;
  isDark: boolean;
  t: Tokens;
}) {
  return (
    <div className={`${t.card} p-4 sm:p-5`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BookmarkCheck className={`w-4 h-4 ${isDark ? "text-[#5B9A6A]" : "text-[#436850]"}`} />
          <h3 className={`font-semibold text-sm ${t.textPrimary}`}>Saved Reports</h3>
        </div>
        <button onClick={onClose} className={`text-xs ${t.textTertiary} transition-colors`}>Close</button>
      </div>
      {loading ? (
        <div className="flex justify-center py-4"><Loader2 className={`w-5 h-5 animate-spin ${t.textTertiary}`} /></div>
      ) : reports.length === 0 ? (
        <p className={`text-sm text-center py-4 ${t.textTertiary}`}>No saved reports yet.</p>
      ) : (
        <div className="space-y-2">
          {reports.map((r) => (
            <div key={r.id} className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${t.cardSubtle} ${t.rowHover}`}>
              <button className="flex-1 flex items-center gap-3 text-left min-w-0" onClick={() => onSelect(r.opponentUsername)}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isDark ? "bg-[#436850]/15" : "bg-[#436850]/08"}`}>
                  <Target className="w-4 h-4 text-[#5B9A6A]" />
                </div>
                <div className="min-w-0">
                  <p className={`text-sm font-medium truncate ${t.textPrimary}`}>{r.opponentUsername}</p>
                  <div className={`flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs ${t.textTertiary} mt-0.5`}>
                    {r.winRate !== null && <span>{r.winRate}% win rate</span>}
                    {r.gamesAnalyzed !== null && <span>{r.gamesAnalyzed} games</span>}
                    {r.prepLinesCount !== null && r.prepLinesCount > 0 && <span>{r.prepLinesCount} lines</span>}
                  </div>
                </div>
              </button>
              <button
                onClick={() => onDelete(r.id)}
                className={`p-1.5 rounded-lg transition-colors shrink-0 ${isDark ? "hover:bg-red-500/10 text-white/20 hover:text-red-400" : "hover:bg-red-50 text-[#436850]/70 hover:text-red-500"}`}
                title="Delete saved report"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RecentlyScoutedChips({
  usernames, onSelect, onRemove, isDark, t
}: {
  usernames: string[];
  onSelect: (username: string) => void;
  onRemove: (username: string) => void;
  isDark: boolean;
  t: Tokens;
}) {
  if (usernames.length === 0) return null;
  return (
    <div className={`${t.card} p-4`}>
      <p className={`text-[11px] font-semibold uppercase tracking-widest mb-3 ${t.textTertiary}`}>Recently Scouted</p>
      <div className="flex flex-wrap gap-2">
        {usernames.map((username) => (
          <div
            key={username}
            className={`group flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-xl border text-sm font-medium transition-all ${
              isDark
                ? "bg-[#0d1a0f]/60 border-[#1e2e22]/60 text-white/70 hover:border-[#436850]/40 hover:text-white"
                : "bg-[#FBFADA]/70/80 border-[#ADBC9F]/60 text-[#436850] hover:border-[#436850]/30 hover:text-[#12372A]"
            }`}
          >
            <button onClick={() => onSelect(username)} className="flex items-center gap-1.5 min-w-0">
              <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-bold shrink-0 ${
                isDark ? "bg-[#436850]/20 text-[#5B9A6A]" : "bg-[#436850]/08 text-[#436850]"
              }`}>{username.charAt(0).toUpperCase()}</span>
              <span className="truncate max-w-[120px]">{username}</span>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(username); }}
              className={`ml-0.5 w-4 h-4 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity ${
                isDark ? "hover:bg-white/10 text-white/30 hover:text-white/60" : "hover:bg-[#ADBC9F] text-[#436850]/70 hover:text-[#436850]"
              }`}
            >
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1 1l6 6M7 1L1 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
