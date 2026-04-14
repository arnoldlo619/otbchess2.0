/**
 * Matchup Prep Page — /prep/:username
 *
 * Phase 4: Opponent Prep Workspace
 * - Guided study flow: Scout → Key Lines → Practice
 * - Opponent snapshot hero with 3 key prep signals
 * - Key Lines with Must Know / Likely / Useful priority tiers
 * - Memorization cues and "why this matters" context
 * - Flashcard-style Practice mode (one line at a time)
 * - "What to study next" nudge at bottom of each tab
 * - Apple-like minimalist design: disciplined whitespace, quiet secondary data
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuthContext } from "@/context/AuthContext";
import {
  ArrowLeft, Search, Target, BookOpen,
  Shield, Clock, Crown,
  TrendingUp, Eye, Loader2,
  CircleDot, RefreshCw, ChevronRight, Trophy,
  Activity, Bookmark, BookmarkCheck,
  Trash2, ChevronLeft, Check, RotateCcw,
  Zap, AlertCircle, Info, Crosshair, Flame
} from "lucide-react";
import { UserRepertoirePanel } from "../components/UserRepertoirePanel";
import ChessLineViewer from "../components/ChessLineViewer";
import ChessPracticeBoard from "../components/ChessPracticeBoard";
import { CoachInsightCard } from "../components/CoachInsightCard";
import {
  UserRepertoire,
  loadUserRepertoire,
  enrichPrepLines,
  generateMatchupSummary,
  type EnrichedPrepLine,
} from "../lib/userRepertoire";
import {
  type InsightContext,
  type QuotaState,
  type CoachInsight,
  getQuotaState,
  getSavedInsights,
  getInsightsForOpponent,
} from "../lib/coachInsight";
import {
  getRecentlyScouted,
  addRecentlyScouted,
  removeRecentlyScouted,
} from "../lib/recentlyScouted";

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
}

interface PrepLine {
  name: string;
  eco: string;
  moves: string;
  rationale: string;
  confidence: "high" | "medium" | "low";
  lineType?: "main" | "surprise";
}

interface PrepReport {
  opponent: PlayStyleProfile;
  prepLines: PrepLine[];
  insights: string[];
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

// Priority tier derived from confidence
type Priority = "must-know" | "likely" | "useful";

function getPriority(confidence: PrepLine["confidence"]): Priority {
  if (confidence === "high") return "must-know";
  if (confidence === "medium") return "likely";
  return "useful";
}

const PRIORITY_CONFIG: Record<Priority, {
  label: string;
  shortLabel: string;
  darkBg: string;
  lightBg: string;
  dot: string;
  order: number;
}> = {
  "must-know": {
    label: "Must Know",
    shortLabel: "Must Know",
    darkBg: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
    lightBg: "bg-emerald-50 border-emerald-200 text-emerald-700",
    dot: "bg-emerald-500",
    order: 0,
  },
  "likely": {
    label: "Likely",
    shortLabel: "Likely",
    darkBg: "bg-amber-500/10 border-amber-500/20 text-amber-400",
    lightBg: "bg-amber-50 border-amber-200 text-amber-700",
    dot: "bg-amber-500",
    order: 1,
  },
  "useful": {
    label: "Useful",
    shortLabel: "Useful",
    darkBg: "bg-white/05 border-white/10 text-white/35",
    lightBg: "bg-gray-50 border-gray-200 text-gray-400",
    dot: "bg-gray-400",
    order: 2,
  },
};

// ── Design tokens ─────────────────────────────────────────────────────────────

function useDesignTokens(isDark: boolean) {
  return {
    page:          isDark ? "bg-[#0a1409]"                                           : "bg-[#f8faf8]",
    card:          isDark ? "bg-[#0f1c11] border border-[#243028]/70 rounded-2xl"   : "bg-white border border-gray-200/80 rounded-2xl shadow-sm",
    cardSubtle:    isDark ? "bg-[#0d1a0f]/60 border border-[#1e2e22]/60 rounded-xl" : "bg-gray-50/70 border border-gray-200/60 rounded-xl",
    header:        isDark ? "bg-[#0a1409]/95 border-b border-[#1e2e22]/80"          : "bg-white/95 border-b border-gray-200/70",
    input:         isDark ? "bg-[#0a1409] border-[#243028]/70 text-white placeholder:text-white/50 focus:border-[#4a8a5a]/60" : "bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-[#3D6B47]",
    textPrimary:   isDark ? "text-white"       : "text-gray-900",
    textSecondary: isDark ? "text-white/55"    : "text-gray-500",
    textTertiary:  isDark ? "text-white/30"    : "text-gray-400",
    accent:        "text-[#5B9A6A]",
    accentBg:      isDark ? "bg-[#5B9A6A]/10 text-[#5B9A6A]" : "bg-[#3D6B47]/08 text-[#3D6B47]",
    divider:       isDark ? "border-[#1e2e22]/70" : "border-gray-200/70",
    tabActive:     isDark ? "bg-[#162018] text-white border-[#2e4a34]/50"           : "bg-white text-gray-900 border-gray-300 shadow-sm",
    tabInactive:   isDark ? "text-white/35 hover:text-white/60 hover:bg-white/03"   : "text-gray-400 hover:text-gray-700 hover:bg-gray-100/50",
    rowHover:      isDark ? "hover:bg-[#162018]/50"                                 : "hover:bg-gray-50/80",
    monoBlock:     isDark ? "bg-[#060e07] text-[#5B9A6A] border border-[#1e2e22]/60" : "bg-[#3D6B47]/04 text-[#3D6B47] border border-[#3D6B47]/10",
  };
}

// ── Main Component ─────────────────────────────────────────────────────────────

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
  const [repertoire, setRepertoire] = useState<UserRepertoire>(() => loadUserRepertoire());

  // Enriched prep lines with collision scores (recomputed when report or repertoire changes)
  const enrichedLines = useMemo<EnrichedPrepLine[]>(() => {
    if (!report) return [];
    return enrichPrepLines(report.prepLines, repertoire, {
      firstMoveAsWhite: report.opponent.firstMoveAsWhite,
      blackOpenings: report.opponent.blackOpenings,
      whiteOpenings: report.opponent.whiteOpenings,
      gamesAnalyzed: report.opponent.gamesAnalyzed,
    });
  }, [report, repertoire]);

  // Strategic matchup summary (recomputed when enrichedLines change)
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

  // Coach insight quota state
  const [quota, setQuota] = useState<QuotaState>(() => getQuotaState("free"));
  const refreshQuota = useCallback(() => {
    setQuota(getQuotaState("free"));
  }, []);

  // Recently scouted chips
  const [recentlyScouted, setRecentlyScouted] = useState<string[]>(() => getRecentlyScouted());

  // Practice mode state
  const [practiceIndex, setPracticeIndex] = useState(0);
  const [practiceRevealed, setPracticeRevealed] = useState(false);
  const [practiceCompleted, setPracticeCompleted] = useState<Set<number>>(new Set());
  const [practiceQueue, setPracticeQueue] = useState<number[]>([]);

  // Re-sort practice queue by collision score when enrichedLines change (repertoire updated)
  useEffect(() => {
    if (enrichedLines.length === 0) return;
    const sorted = enrichedLines
      .map((_, i) => i)
      .sort((a, b) => enrichedLines[b].collisionScore - enrichedLines[a].collisionScore);
    setPracticeQueue(sorted);
    setPracticeIndex(0);
    setPracticeRevealed(false);
    setPracticeCompleted(new Set());
  }, [enrichedLines]);

  useEffect(() => {
    if (params.username) {
      setSearchInput(params.username);
      fetchReport(params.username);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.username]);

  async function fetchReport(username: string, refresh = false) {
    if (refresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
      setReport(null);
      setActiveTab("scout");
    }
    setError(null);
    try {
      const url = `/api/prep/${encodeURIComponent(username.trim())}${refresh ? "?refresh=true" : ""}`;
      const res = await fetch(url);
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(data.error || `Error ${res.status}`);
      }
      const data: PrepReport = await res.json();
      setReport(data);
      // Persist to recently scouted list
      const updated = addRecentlyScouted(username.trim());
      setRecentlyScouted(updated);
      // Initialize practice queue sorted by priority (will be re-sorted by collision after enrichment)
      const sorted = data.prepLines
        .map((_, i) => i)
        .sort((a, b) => PRIORITY_CONFIG[getPriority(data.prepLines[a].confidence)].order
                      - PRIORITY_CONFIG[getPriority(data.prepLines[b].confidence)].order);
      setPracticeQueue(sorted);
      setPracticeIndex(0);
      setPracticeRevealed(false);
      setPracticeCompleted(new Set());
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
      const res = await fetch("/api/prep/saved", { credentials: "include" });
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
      const res = await fetch("/api/prep/saved", {
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
      await fetch(`/api/prep/saved/${id}`, { method: "DELETE", credentials: "include" });
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

  // Practice mode helpers
  function practiceNext() {
    setPracticeRevealed(false);
    if (practiceIndex < practiceQueue.length - 1) {
      setPracticeIndex(i => i + 1);
    }
  }
  function practicePrev() {
    setPracticeRevealed(false);
    if (practiceIndex > 0) {
      setPracticeIndex(i => i - 1);
    }
  }
  function markCompleted(idx: number) {
    setPracticeCompleted(prev => new Set(Array.from(prev).concat(idx)));
    practiceNext();
  }
  function resetPractice() {
    setPracticeCompleted(new Set());
    setPracticeIndex(0);
    setPracticeRevealed(false);
  }

  const tabs: { id: Tab; label: string; step: string }[] = [
    { id: "scout",    label: "Scout",     step: "1" },
    { id: "lines",    label: "Key Lines", step: "2" },
    { id: "practice", label: "Practice",  step: "3" },
  ];

  // Derive 3 key prep signals from the report
  function getKeySignals(r: PrepReport): { icon: React.ReactNode; label: string; value: string; highlight?: boolean }[] {
    const signals: { icon: React.ReactNode; label: string; value: string; highlight?: boolean }[] = [];
    const opp = r.opponent;

    // Signal 1: Dominant color tendency
    const whiteDiff = opp.asWhite.winRate - opp.asBlack.winRate;
    if (Math.abs(whiteDiff) >= 8) {
      signals.push({
        icon: <CircleDot className="w-4 h-4" />,
        label: whiteDiff > 0 ? "Stronger as White" : "Stronger as Black",
        value: whiteDiff > 0
          ? `${opp.asWhite.winRate}% vs ${opp.asBlack.winRate}%`
          : `${opp.asBlack.winRate}% vs ${opp.asWhite.winRate}%`,
        highlight: true,
      });
    } else {
      signals.push({
        icon: <CircleDot className="w-4 h-4" />,
        label: "Balanced both sides",
        value: `W ${opp.asWhite.winRate}% · B ${opp.asBlack.winRate}%`,
      });
    }

    // Signal 2: Game length tendency
    if (opp.avgGameLength <= 30) {
      signals.push({
        icon: <Clock className="w-4 h-4" />,
        label: "Plays short games",
        value: `Avg ${opp.avgGameLength} moves`,
        highlight: true,
      });
    } else if (opp.avgGameLength >= 50) {
      signals.push({
        icon: <Clock className="w-4 h-4" />,
        label: "Plays long games",
        value: `Avg ${opp.avgGameLength} moves`,
      });
    } else {
      signals.push({
        icon: <Clock className="w-4 h-4" />,
        label: "Medium game length",
        value: `Avg ${opp.avgGameLength} moves`,
      });
    }

    // Signal 3: Endgame tendency
    const ep = opp.endgameProfile;
    if (ep.total > 0) {
      const resignPct = Math.round((ep.resignations / ep.total) * 100);
      const matePct = Math.round((ep.checkmates / ep.total) * 100);
      if (resignPct >= 40) {
        signals.push({
          icon: <Shield className="w-4 h-4" />,
          label: "Resigns often",
          value: `${resignPct}% of losses`,
          highlight: resignPct >= 55,
        });
      } else if (matePct >= 20) {
        signals.push({
          icon: <Crown className="w-4 h-4" />,
          label: "Fights to checkmate",
          value: `${matePct}% checkmates`,
        });
      } else {
        signals.push({
          icon: <Activity className="w-4 h-4" />,
          label: "Draw tendency",
          value: `${Math.round((ep.draws / ep.total) * 100)}% draws`,
        });
      }
    }

    return signals.slice(0, 3);
  }

  return (
    <div className={`min-h-screen ${t.page}`}>

      {/* ── Sticky Header ── */}
      <div className={`sticky top-0 z-40 backdrop-blur-xl otb-header-safe ${t.header}`}>
        <div className="max-w-3xl mx-auto px-3 sm:px-6 h-14 flex items-center gap-2 sm:gap-3">

          <button
            onClick={() => navigate("/")}
            className={`p-2.5 rounded-xl transition-colors shrink-0 min-w-[40px] min-h-[40px] flex items-center justify-center ${
              isDark ? "hover:bg-white/05 text-white/50 hover:text-white" : "hover:bg-gray-100 text-gray-400 hover:text-gray-900"
            }`}
            aria-label="Go back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          {/* Search bar */}
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
                    ? "bg-[#3D6B47] text-white hover:bg-[#4a8a5a] active:scale-95"
                    : "bg-[#3D6B47] text-white hover:bg-[#2d5237] active:scale-95"
                  : isDark ? "bg-white/05 text-white/20 cursor-not-allowed" : "bg-gray-100 text-gray-400 cursor-not-allowed"
              }`}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          </form>

          {/* Action buttons — only when report is loaded */}
          {report && (
            <div className="flex items-center gap-1 shrink-0">
              {/* Refresh */}
              <button
                onClick={() => fetchReport(report.opponent.username, true)}
                disabled={refreshing}
                className={`p-2.5 rounded-xl transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center ${
                  isDark ? "hover:bg-white/05 text-white/40 hover:text-white/70" : "hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                }`}
                title="Refresh report"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              </button>

              {/* Save — only for logged-in users */}
              {user && (
                <button
                  onClick={savedId ? () => setShowSavedPanel(p => !p) : handleSaveReport}
                  disabled={saving}
                  className={`p-2.5 rounded-xl transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center ${
                    savedId
                      ? isDark ? "text-[#5B9A6A] hover:bg-[#3D6B47]/10" : "text-[#3D6B47] hover:bg-[#3D6B47]/08"
                      : isDark ? "hover:bg-white/05 text-white/40 hover:text-white/70" : "hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                  }`}
                  title={savedId ? "Saved — view saved reports" : "Save this report"}
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : savedId ? <BookmarkCheck className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Page Content ── */}
      <div className="max-w-3xl mx-auto px-3 sm:px-6 py-5 sm:py-7 space-y-4 sm:space-y-5">

        {/* ── Saved Reports Panel ── */}
        {showSavedPanel && user && (
          <div className={`${t.card} p-4 sm:p-5`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <BookmarkCheck className={`w-4 h-4 ${isDark ? "text-[#5B9A6A]" : "text-[#3D6B47]"}`} />
                <h3 className={`font-semibold text-sm ${t.textPrimary}`}>Saved Reports</h3>
              </div>
              <button
                onClick={() => setShowSavedPanel(false)}
                className={`text-xs ${t.textTertiary} hover:${t.textSecondary} transition-colors`}
              >
                Close
              </button>
            </div>
            {loadingSaved ? (
              <div className="flex justify-center py-4">
                <Loader2 className={`w-5 h-5 animate-spin ${t.textTertiary}`} />
              </div>
            ) : savedReports.length === 0 ? (
              <p className={`text-sm text-center py-4 ${t.textTertiary}`}>No saved reports yet.</p>
            ) : (
              <div className="space-y-2">
                {savedReports.map((r) => (
                  <div
                    key={r.id}
                    className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${t.cardSubtle} ${t.rowHover}`}
                  >
                    <button
                      className="flex-1 flex items-center gap-3 text-left min-w-0"
                      onClick={() => {
                        navigate(`/prep/${encodeURIComponent(r.opponentUsername)}`);
                        setShowSavedPanel(false);
                      }}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isDark ? "bg-[#3D6B47]/15" : "bg-[#3D6B47]/08"}`}>
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
                      onClick={() => handleDeleteSaved(r.id)}
                      className={`p-1.5 rounded-lg transition-colors shrink-0 ${isDark ? "hover:bg-red-500/10 text-white/20 hover:text-red-400" : "hover:bg-red-50 text-gray-300 hover:text-red-500"}`}
                      title="Delete saved report"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Loading State ── */}
        {loading && (
          <div className={`${t.card} py-16 flex flex-col items-center gap-4`}>
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isDark ? "bg-[#162018]" : "bg-[#3D6B47]/06"}`}>
              <Loader2 className="w-6 h-6 text-[#5B9A6A] animate-spin" />
            </div>
            <div className="text-center space-y-1">
              <p className={`text-sm font-medium ${t.textPrimary}`}>Analyzing {searchInput}</p>
              <p className={`text-xs ${t.textTertiary}`}>Fetching games and building prep report…</p>
            </div>
          </div>
        )}

        {/* ── Error State ── */}
        {error && !loading && (
          <div className={`${t.card} p-5 flex items-start gap-3`}>
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className={`text-sm font-medium ${t.textPrimary}`}>Could not load report</p>
              <p className={`text-xs mt-0.5 ${t.textTertiary}`}>{error}</p>
            </div>
          </div>
        )}

        {/* ── Report ── */}
        {report && !loading && (
          <div className="space-y-4 sm:space-y-5">

            {/* Opponent Snapshot Hero */}
            <div className={`${t.card} p-5 sm:p-6`}>
              <div className="flex items-start justify-between gap-4 mb-5">
                <div>
                  <p className={`text-[11px] font-semibold uppercase tracking-widest mb-1 ${t.textTertiary}`}>Opponent</p>
                  <h2 className={`text-xl sm:text-2xl font-bold ${t.textPrimary}`} style={{ fontFamily: "'Clash Display', sans-serif" }}>
                    {report.opponent.username}
                  </h2>
                  <p className={`text-xs mt-1 ${t.textTertiary}`}>
                    {report.opponent.gamesAnalyzed} games analyzed
                    {report._cached && <span className="ml-2 opacity-60">· cached</span>}
                  </p>
                </div>
                {/* Ratings */}
                <div className="flex gap-2 shrink-0">
                  {report.opponent.rating.rapid  && <RatingBadge label="Rapid"  value={report.opponent.rating.rapid}  isDark={isDark} />}
                  {report.opponent.rating.blitz  && <RatingBadge label="Blitz"  value={report.opponent.rating.blitz}  isDark={isDark} />}
                  {report.opponent.rating.bullet && <RatingBadge label="Bullet" value={report.opponent.rating.bullet} isDark={isDark} />}
                </div>
              </div>

              {/* 3 Key Prep Signals */}
              <div className={`pt-4 border-t ${t.divider}`}>
                <p className={`text-[11px] font-semibold uppercase tracking-widest mb-3 ${t.textTertiary}`}>Key Signals</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {getKeySignals(report).map((sig, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-3 px-3.5 py-3 rounded-xl ${
                        sig.highlight
                          ? isDark ? "bg-[#3D6B47]/12 border border-[#3D6B47]/25" : "bg-[#3D6B47]/06 border border-[#3D6B47]/15"
                          : isDark ? "bg-[#0d1a0f]/60 border border-[#1e2e22]/50" : "bg-gray-50/80 border border-gray-200/60"
                      }`}
                    >
                      <span className={sig.highlight ? "text-[#5B9A6A]" : t.textTertiary}>{sig.icon}</span>
                      <div className="min-w-0">
                        <p className={`text-xs font-medium truncate ${sig.highlight ? (isDark ? "text-[#5B9A6A]" : "text-[#3D6B47]") : t.textSecondary}`}>{sig.label}</p>
                        <p className={`text-[11px] truncate ${t.textTertiary}`}>{sig.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Tab Navigation — step-based */}
            <div className={`flex gap-1 p-1 rounded-2xl ${isDark ? "bg-[#0f1c11] border border-[#1e2e22]/70" : "bg-gray-100/80 border border-gray-200/60"}`}>
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-2 sm:px-3 rounded-xl text-xs sm:text-sm font-medium transition-all duration-150 min-h-[44px] ${
                    activeTab === tab.id ? t.tabActive + " border" : t.tabInactive
                  }`}
                >
                  <span className={`w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 ${
                    activeTab === tab.id
                      ? isDark ? "bg-[#3D6B47]/30 text-[#5B9A6A]" : "bg-[#3D6B47]/10 text-[#3D6B47]"
                      : isDark ? "bg-white/06 text-white/30" : "bg-gray-300/60 text-gray-400"
                  }`}>
                    {tab.step}
                  </span>
                  <span>{tab.label}</span>
                  {tab.id === "lines" && report.prepLines.length > 0 && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      activeTab === "lines"
                        ? isDark ? "bg-[#3D6B47]/25 text-[#5B9A6A]" : "bg-[#3D6B47]/10 text-[#3D6B47]"
                        : isDark ? "bg-white/06 text-white/30" : "bg-gray-300/50 text-gray-400"
                    }`}>
                      {report.prepLines.length}
                    </span>
                  )}
                  {tab.id === "practice" && practiceCompleted.size > 0 && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      isDark ? "bg-emerald-500/15 text-emerald-400" : "bg-emerald-50 text-emerald-600"
                    }`}>
                      {practiceCompleted.size}/{report.prepLines.length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* ── Tab 1: Scout ── */}
            {activeTab === "scout" && (
              <div className="space-y-4">

                {/* My Repertoire Panel */}
                <UserRepertoirePanel value={repertoire} onChange={setRepertoire} />

                {/* Strategic Matchup Summary — only when repertoire is set */}
                {matchupSummary && (
                  <div className={`${t.card} p-4 sm:p-5`}>
                    <div className="flex items-center gap-2 mb-3">
                      <Crosshair className={`w-4 h-4 ${isDark ? "text-[#5B9A6A]" : "text-[#3D6B47]"}`} />
                      <h3 className={`font-semibold text-sm ${t.textPrimary}`}>Prep Summary</h3>
                    </div>
                    <div className="space-y-2.5">
                      {/* Likely battle */}
                      <div className={`flex items-start gap-3 p-3 rounded-xl ${isDark ? "bg-[#3D6B47]/10 border border-[#3D6B47]/20" : "bg-[#3D6B47]/05 border border-[#3D6B47]/12"}`}>
                        <Target className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${isDark ? "text-[#5B9A6A]" : "text-[#3D6B47]"}`} />
                        <div className="min-w-0">
                          <p className={`text-[10px] font-semibold uppercase tracking-widest mb-0.5 ${isDark ? "text-[#5B9A6A]/60" : "text-[#3D6B47]/50"}`}>Likely Battle</p>
                          <p className={`text-sm leading-relaxed ${t.textSecondary}`}>{matchupSummary.likelyBattle}</p>
                        </div>
                      </div>
                      {/* Study first */}
                      {matchupSummary.studyFirst && (
                        <div className={`flex items-start gap-3 p-3 rounded-xl ${isDark ? "bg-amber-500/08 border border-amber-500/15" : "bg-amber-50/80 border border-amber-200/60"}`}>
                          <Flame className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${isDark ? "text-amber-400" : "text-amber-600"}`} />
                          <div className="min-w-0">
                            <p className={`text-[10px] font-semibold uppercase tracking-widest mb-0.5 ${isDark ? "text-amber-400/60" : "text-amber-600/50"}`}>Study First</p>
                            <p className={`text-sm leading-relaxed ${t.textSecondary}`}>{matchupSummary.studyFirst}</p>
                          </div>
                        </div>
                      )}
                      {/* Prep risk */}
                      {matchupSummary.prepRisk && (
                        <div className={`flex items-start gap-3 p-3 rounded-xl ${isDark ? "bg-red-500/08 border border-red-500/15" : "bg-red-50/80 border border-red-200/60"}`}>
                          <AlertCircle className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${isDark ? "text-red-400" : "text-red-600"}`} />
                          <div className="min-w-0">
                            <p className={`text-[10px] font-semibold uppercase tracking-widest mb-0.5 ${isDark ? "text-red-400/60" : "text-red-600/50"}`}>Prep Risk</p>
                            <p className={`text-sm leading-relaxed ${t.textSecondary}`}>{matchupSummary.prepRisk}</p>
                          </div>
                        </div>
                      )}
                      {/* Color advice */}
                      {matchupSummary.colorAdvice && (
                        <div className={`flex items-start gap-3 p-3 rounded-xl ${t.cardSubtle}`}>
                          <Info className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${t.textTertiary}`} />
                          <p className={`text-sm leading-relaxed ${t.textSecondary}`}>{matchupSummary.colorAdvice}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Win/Draw/Loss by color — compact 2-col */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <ColorStatCard
                    title="As White"
                    icon={<CircleDot className="w-3.5 h-3.5" />}
                    wins={report.opponent.asWhite.wins}
                    draws={report.opponent.asWhite.draws}
                    losses={report.opponent.asWhite.losses}
                    winRate={report.opponent.asWhite.winRate}
                    games={report.opponent.asWhite.games}
                    isDark={isDark}
                    t={t}
                  />
                  <ColorStatCard
                    title="As Black"
                    icon={<CircleDot className="w-3.5 h-3.5 fill-current opacity-60" />}
                    wins={report.opponent.asBlack.wins}
                    draws={report.opponent.asBlack.draws}
                    losses={report.opponent.asBlack.losses}
                    winRate={report.opponent.asBlack.winRate}
                    games={report.opponent.asBlack.games}
                    isDark={isDark}
                    t={t}
                  />
                </div>

                {/* Opening tendencies — top 3 each side */}
                {(report.opponent.whiteOpenings.length > 0 || report.opponent.blackOpenings.length > 0) && (
                  <div className={`${t.card} p-4 sm:p-5`}>
                    <div className="flex items-center gap-2 mb-4">
                      <BookOpen className={`w-4 h-4 ${isDark ? "text-[#5B9A6A]" : "text-[#3D6B47]"}`} />
                      <h3 className={`font-semibold text-sm ${t.textPrimary}`}>Opening Tendencies</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <OpeningMiniList
                        title="Plays as White"
                        openings={report.opponent.whiteOpenings.slice(0, 3)}
                        firstMoves={report.opponent.firstMoveAsWhite}
                        isDark={isDark}
                        t={t}
                      />
                      <OpeningMiniList
                        title="Plays as Black"
                        openings={report.opponent.blackOpenings.slice(0, 3)}
                        isDark={isDark}
                        t={t}
                      />
                    </div>
                  </div>
                )}

                {/* Key Insights */}
                {report.insights.length > 0 && (
                  <div className={`${t.card} p-4 sm:p-5`}>
                    <div className="flex items-center gap-2 mb-3">
                      <Eye className={`w-4 h-4 ${isDark ? "text-[#5B9A6A]" : "text-[#3D6B47]"}`} />
                      <h3 className={`font-semibold text-sm ${t.textPrimary}`}>Scouting Notes</h3>
                    </div>
                    <div className="space-y-2">
                      {report.insights.map((insight, i) => (
                        <div key={i} className={`flex items-start gap-3 p-3 rounded-xl ${t.cardSubtle}`}>
                          <span className={`text-[10px] font-bold w-4 h-4 rounded-md flex items-center justify-center shrink-0 mt-0.5 ${isDark ? "bg-[#3D6B47]/20 text-[#5B9A6A]" : "bg-[#3D6B47]/08 text-[#3D6B47]"}`}>
                            {i + 1}
                          </span>
                          <span className={`text-sm leading-relaxed ${t.textSecondary}`}>{insight}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Coach Insight Card — only when report is loaded */}
                {report && (
                  <CoachInsightCard
                    context={{
                      opponentUsername: report.opponent.username,
                      insightType: "matchup_overview",
                      gamesAnalyzed: report.opponent.gamesAnalyzed,
                      overallWinRate: report.opponent.overall.winRate,
                      asWhiteWinRate: report.opponent.asWhite.winRate,
                      asBlackWinRate: report.opponent.asBlack.winRate,
                      avgGameLength: report.opponent.avgGameLength,
                      topWhiteOpenings: report.opponent.whiteOpenings.slice(0, 3).map(o => ({
                        name: o.name, count: o.count, winRate: o.winRate, moves: o.moves ?? "",
                      })),
                      topBlackOpenings: report.opponent.blackOpenings.slice(0, 3).map(o => ({
                        name: o.name, count: o.count, winRate: o.winRate, moves: o.moves ?? "",
                      })),
                      firstMoveAsWhite: report.opponent.firstMoveAsWhite.map(m => ({
                        move: m.move, pct: m.pct,
                      })),
                      endgameProfile: {
                        checkmates: report.opponent.endgameProfile.checkmates,
                        resignations: report.opponent.endgameProfile.resignations,
                        timeouts: report.opponent.endgameProfile.timeouts,
                        total: report.opponent.endgameProfile.total,
                      },
                      userRepertoire: repertoire.whiteFirstMove !== null ? {
                        whiteFirstMove: repertoire.whiteFirstMove,
                        blackVsE4: repertoire.blackVsE4,
                        blackVsD4: repertoire.blackVsD4,
                        expectedColor: repertoire.expectedColor,
                      } : undefined,
                      topPrepLines: enrichedLines.slice(0, 3).map(l => ({
                        name: l.name, moves: l.moves, rationale: l.rationale,
                        confidence: l.confidence, collisionScore: l.collisionScore,
                      })),
                      matchupSummary: matchupSummary ? {
                        likelyBattle: matchupSummary.likelyBattle,
                        studyFirst: matchupSummary.studyFirst ?? "",
                        prepRisk: matchupSummary.prepRisk ?? "",
                        colorAdvice: matchupSummary.colorAdvice ?? "",
                      } : undefined,
                    }}
                    quota={quota}
                    onQuotaConsumed={refreshQuota}
                    existingInsight={
                      getInsightsForOpponent(report.opponent.username)
                        .find(i => i.insightType === "matchup_overview") ?? null
                    }
                  />
                )}

                {/* Next step nudge */}
                <NextStepNudge
                  label="Ready to study key lines?"
                  action="Go to Key Lines"
                  onClick={() => setActiveTab("lines")}
                  isDark={isDark}
                  t={t}
                />
              </div>
            )}

            {/* ── Tab 2: Key Lines ── */}
            {activeTab === "lines" && (
              <div className="space-y-4">
                {enrichedLines.length === 0 ? (
                  <EmptyState
                    icon={<Target className="w-6 h-6 text-[#5B9A6A]" />}
                    title="No key lines generated"
                    description="Not enough opening data was found to generate preparation lines."
                    isDark={isDark}
                    t={t}
                  />
                ) : (
                  <>
                    {/* Legend: priority + collision */}
                    <div className={`flex items-center gap-3 px-1 flex-wrap`}>
                      {(["must-know", "likely", "useful"] as Priority[]).map((p) => {
                        const cfg = PRIORITY_CONFIG[p];
                        const count = enrichedLines.filter(l => getPriority(l.confidence) === p).length;
                        if (count === 0) return null;
                        return (
                          <div key={p} className="flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                            <span className={`text-xs ${t.textTertiary}`}>{cfg.label} <span className={t.textTertiary}>({count})</span></span>
                          </div>
                        );
                      })}
                      {enrichedLines.some(l => l.collisionScore > 0) && (
                        <div className="flex items-center gap-1.5 ml-auto">
                          <Crosshair className={`w-3 h-3 ${t.textTertiary}`} />
                          <span className={`text-xs ${t.textTertiary}`}>Sorted by collision</span>
                        </div>
                      )}
                    </div>

                    {/* Interactive chessboard viewers — one per line */}
                    <div className="space-y-4">
                      {enrichedLines.map((line, i) => (
                        <div key={i} className="space-y-2">
                          {/* Priority badge row */}
                          <div className="flex items-center gap-2 px-1">
                            <span className={`text-[10px] font-bold w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${isDark ? "bg-[#3D6B47]/15 text-[#5B9A6A]" : "bg-[#3D6B47]/06 text-[#3D6B47]"}`}>
                              {i + 1}
                            </span>
                            {line.isTrainFirst && (
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${isDark ? "bg-amber-500/15 text-amber-400 border border-amber-500/20" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
                                <Flame className="w-2.5 h-2.5" /> Train First
                              </span>
                            )}
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1 ${isDark ? PRIORITY_CONFIG[getPriority(line.confidence)].darkBg : PRIORITY_CONFIG[getPriority(line.confidence)].lightBg}`}>
                              <span className={`w-1 h-1 rounded-full ${PRIORITY_CONFIG[getPriority(line.confidence)].dot}`} />
                              {PRIORITY_CONFIG[getPriority(line.confidence)].shortLabel}
                            </span>
                          </div>
                          {/* Interactive board */}
                          <ChessLineViewer
                            moves={line.moves}
                            lineName={line.name}
                            rationale={line.rationale}
                            eco={line.eco}
                            isDark={isDark}
                          />
                        </div>
                      ))}
                    </div>

                    {/* Coach Insight for top Train First line */}
                    {report && enrichedLines.length > 0 && (() => {
                      const topLine = enrichedLines[0];
                      return (
                        <CoachInsightCard
                          context={{
                            opponentUsername: report.opponent.username,
                            insightType: "key_line",
                            gamesAnalyzed: report.opponent.gamesAnalyzed,
                            overallWinRate: report.opponent.overall.winRate,
                            asWhiteWinRate: report.opponent.asWhite.winRate,
                            asBlackWinRate: report.opponent.asBlack.winRate,
                            avgGameLength: report.opponent.avgGameLength,
                            topWhiteOpenings: report.opponent.whiteOpenings.slice(0, 2).map(o => ({
                              name: o.name, count: o.count, winRate: o.winRate, moves: o.moves ?? "",
                            })),
                            topBlackOpenings: report.opponent.blackOpenings.slice(0, 2).map(o => ({
                              name: o.name, count: o.count, winRate: o.winRate, moves: o.moves ?? "",
                            })),
                            firstMoveAsWhite: report.opponent.firstMoveAsWhite.map(m => ({ move: m.move, pct: m.pct })),
                            endgameProfile: {
                              checkmates: report.opponent.endgameProfile.checkmates,
                              resignations: report.opponent.endgameProfile.resignations,
                              timeouts: report.opponent.endgameProfile.timeouts,
                              total: report.opponent.endgameProfile.total,
                            },
                            userRepertoire: repertoire.whiteFirstMove !== null ? {
                              whiteFirstMove: repertoire.whiteFirstMove,
                              blackVsE4: repertoire.blackVsE4,
                              blackVsD4: repertoire.blackVsD4,
                              expectedColor: repertoire.expectedColor,
                            } : undefined,
                            focusLine: { name: topLine.name, moves: topLine.moves, rationale: topLine.rationale },
                          }}
                          quota={quota}
                          onQuotaConsumed={refreshQuota}
                          existingInsight={
                            getInsightsForOpponent(report.opponent.username)
                              .find(i => i.insightType === "key_line") ?? null
                          }
                        />
                      );
                    })()}

                    {/* Next step nudge */}
                    <NextStepNudge
                      label="Ready to practice these lines?"
                      action="Start Practice"
                      onClick={() => setActiveTab("practice")}
                      isDark={isDark}
                      t={t}
                    />
                  </>
                )}
              </div>
            )}

            {/* ── Tab 3: Practice ── */}
            {activeTab === "practice" && (
              <div className="space-y-4">
                {enrichedLines.length === 0 ? (
                  <EmptyState
                    icon={<Trophy className="w-6 h-6 text-[#5B9A6A]" />}
                    title="No lines to practice"
                    description="Generate prep lines first by running a report on an opponent with enough game history."
                    isDark={isDark}
                    t={t}
                  />
                ) : (
                  <>
                    {/* Intro strip */}
                    <div className={`flex items-center gap-3 px-1`}>
                      <span className={`text-xs ${t.textSecondary}`}>
                        Find the correct move for each position. The computer plays the opponent's moves automatically.
                      </span>
                    </div>
                    {/* Interactive SRS practice board */}
                    <ChessPracticeBoard
                      lines={enrichedLines.map((l, i) => ({
                        id: String(i),
                        name: l.name,
                        moves: l.moves,
                        eco: l.eco,
                        rationale: l.rationale,
                      }))}
                      isDark={isDark}
                    />
                  </>
                )}
              </div>
            )}

          </div>
        )}

        {/* ── Recently Scouted Chips ── */}
        {!report && !loading && !error && recentlyScouted.length > 0 && (
          <RecentlyScoutedChips
            usernames={recentlyScouted}
            onSelect={(u) => {
              setSearchInput(u);
              navigate(`/prep/${encodeURIComponent(u)}`);
              fetchReport(u);
            }}
            onRemove={(u) => {
              const updated = removeRecentlyScouted(u);
              setRecentlyScouted(updated);
            }}
            isDark={isDark}
            t={t}
          />
        )}

        {/* ── Welcome / Empty State ── */}
        {!report && !loading && !error && (
          <div className={`${t.card} py-12 px-6 sm:py-16 flex flex-col items-center gap-5 text-center`}>
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isDark ? "bg-[#162018]" : "bg-[#3D6B47]/06"}`}>
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
                Enter your opponent's chess.com username to scout their tendencies, study key lines, and practice before match day.
              </p>
            </div>
            <div className={`flex flex-wrap justify-center gap-4 text-xs ${t.textTertiary}`}>
              <span className="flex items-center gap-1.5"><Eye className="w-3.5 h-3.5" /> Scout</span>
              <span className="flex items-center gap-1.5"><Target className="w-3.5 h-3.5" /> Key Lines</span>
              <span className="flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5" /> Practice</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

type Tokens = ReturnType<typeof useDesignTokens>;

function RatingBadge({ label, value, isDark }: { label: string; value: number; isDark: boolean }) {
  return (
    <div className={`px-2.5 py-1.5 rounded-xl text-center min-w-[50px] ${isDark ? "bg-[#0a1409] border border-[#1e2e22]/70" : "bg-gray-50 border border-gray-200"}`}>
      <div className={`text-[9px] font-semibold uppercase tracking-wide ${isDark ? "text-white/25" : "text-gray-400"}`}>{label}</div>
      <div className={`text-sm font-bold mt-0.5 ${isDark ? "text-white" : "text-gray-900"}`}>{value}</div>
    </div>
  );
}

function ColorStatCard({
  title, icon, wins, draws, losses, winRate, games, isDark, t
}: {
  title: string; icon: React.ReactNode;
  wins: number; draws: number; losses: number; winRate: number; games?: number;
  isDark: boolean; t: Tokens;
}) {
  const total = wins + draws + losses;
  const wPct = total > 0 ? (wins / total) * 100 : 0;
  const dPct = total > 0 ? (draws / total) * 100 : 0;
  const lPct = total > 0 ? (losses / total) * 100 : 0;

  return (
    <div className={`${t.card} p-4`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={t.textTertiary}>{icon}</span>
          <span className={`text-sm font-semibold ${t.textPrimary}`}>{title}</span>
        </div>
        <span className={`text-lg font-bold ${winRate >= 55 ? (isDark ? "text-emerald-400" : "text-emerald-600") : t.textPrimary}`}>
          {winRate}%
        </span>
      </div>
      {/* Bar */}
      <div className="h-1.5 rounded-full overflow-hidden flex gap-px mb-2.5" style={{ background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }}>
        <div className="bg-emerald-500 rounded-l-full transition-all" style={{ width: `${wPct}%` }} />
        <div className="bg-amber-400 transition-all" style={{ width: `${dPct}%` }} />
        <div className="bg-red-400 rounded-r-full transition-all" style={{ width: `${lPct}%` }} />
      </div>
      <div className={`flex gap-3 text-xs ${t.textTertiary}`}>
        <span><span className="text-emerald-500 font-semibold">{wins}</span> W</span>
        <span><span className="text-amber-400 font-semibold">{draws}</span> D</span>
        <span><span className="text-red-400 font-semibold">{losses}</span> L</span>
        {games !== undefined && <span className="ml-auto">{games} games</span>}
      </div>
    </div>
  );
}

function OpeningMiniList({
  title, openings, firstMoves, isDark, t
}: {
  title: string;
  openings: OpeningStat[];
  firstMoves?: { move: string; count: number; pct: number }[];
  isDark: boolean;
  t: Tokens;
}) {
  if (openings.length === 0 && (!firstMoves || firstMoves.length === 0)) {
    return (
      <div>
        <p className={`text-xs font-semibold mb-2 ${t.textTertiary}`}>{title}</p>
        <p className={`text-xs ${t.textTertiary}`}>No data</p>
      </div>
    );
  }
  return (
    <div>
      <p className={`text-xs font-semibold mb-2.5 ${t.textTertiary}`}>{title}</p>
      {firstMoves && firstMoves.length > 0 && (
        <div className="flex gap-1.5 mb-2.5 flex-wrap">
          {firstMoves.slice(0, 3).map((fm) => (
            <span
              key={fm.move}
              className={`font-mono text-[11px] px-2 py-1 rounded-lg font-semibold ${isDark ? "bg-[#3D6B47]/15 text-[#5B9A6A]" : "bg-[#3D6B47]/08 text-[#3D6B47]"}`}
            >
              {fm.move} <span className={`font-normal ${t.textTertiary}`}>{fm.pct}%</span>
            </span>
          ))}
        </div>
      )}
      <div className="space-y-1.5">
        {openings.map((o, i) => (
          <div key={i} className={`flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg ${t.cardSubtle}`}>
            <span className={`text-xs truncate ${t.textSecondary}`}>{o.name}</span>
            <span className={`text-xs font-semibold shrink-0 ${o.winRate >= 55 ? (isDark ? "text-emerald-400" : "text-emerald-600") : t.textTertiary}`}>
              {o.winRate}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function KeyLineCard({
  line, index, priority, isDark, t
}: {
  line: PrepLine; index: number; priority: Priority; isDark: boolean; t: Tokens;
}) {
  const [expanded, setExpanded] = useState(false);
  const cfg = PRIORITY_CONFIG[priority];
  const priorityStyle = isDark ? cfg.darkBg : cfg.lightBg;

  return (
    <div className={`rounded-2xl overflow-hidden border transition-all duration-150 ${
      isDark ? "bg-[#0f1c11] border-[#1e2e22]/70" : "bg-white border-gray-200/80 shadow-sm"
    }`}>
      <button
        className={`w-full text-left p-4 sm:p-5 transition-colors ${t.rowHover}`}
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-start gap-3">
          <span className={`text-[10px] font-bold w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5 ${isDark ? "bg-[#3D6B47]/15 text-[#5B9A6A]" : "bg-[#3D6B47]/06 text-[#3D6B47]"}`}>
            {index + 1}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h4 className={`font-semibold text-sm ${t.textPrimary}`} style={{ fontFamily: "'Clash Display', sans-serif" }}>
                {line.name}
              </h4>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1 ${priorityStyle}`}>
                <span className={`w-1 h-1 rounded-full ${cfg.dot}`} />
                {cfg.shortLabel}
              </span>
              {line.lineType === "surprise" ? (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                  isDark
                    ? "bg-violet-500/15 text-violet-300 border border-violet-500/25"
                    : "bg-violet-50 text-violet-700 border border-violet-200"
                }`}>
                  ⚡ Surprise
                </span>
              ) : line.lineType === "main" ? (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                  isDark
                    ? "bg-sky-500/12 text-sky-300 border border-sky-500/20"
                    : "bg-sky-50 text-sky-700 border border-sky-200"
                }`}>
                  ✦ Main Line
                </span>
              ) : null}
            </div>
            {line.eco !== "---" && (
              <span className={`text-[11px] font-mono ${t.textTertiary}`}>{line.eco}</span>
            )}
          </div>
          <ChevronRight className={`w-4 h-4 shrink-0 transition-transform duration-150 ${t.textTertiary} ${expanded ? "rotate-90" : ""}`} />
        </div>
      </button>

      {expanded && (
        <div className={`px-4 sm:px-5 pb-4 sm:pb-5 pt-0 space-y-3 border-t ${t.divider}`}>
          {/* Move sequence */}
          {line.eco !== "---" && line.moves && (
            <div className={`font-mono text-xs px-3.5 py-2.5 rounded-xl overflow-x-auto whitespace-nowrap mt-3 ${t.monoBlock}`}>
              {line.moves}
            </div>
          )}

          {/* Why this matters */}
          <div className={`flex items-start gap-2.5 p-3 rounded-xl ${isDark ? "bg-[#0a1409]/80" : "bg-gray-50/80"}`}>
            <Info className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${isDark ? "text-[#5B9A6A]/60" : "text-[#3D6B47]/50"}`} />
            <p className={`text-sm leading-relaxed ${t.textSecondary}`}>{line.rationale}</p>
          </div>

          {/* Memorization cue */}
          {priority === "must-know" && (
            <div className={`flex items-center gap-2 text-xs ${isDark ? "text-emerald-400/70" : "text-emerald-700/70"}`}>
              <Zap className="w-3 h-3" />
              <span>Memorize this line — it's the most likely scenario you'll face.</span>
            </div>
          )}
          {priority === "likely" && (
            <div className={`flex items-center gap-2 text-xs ${isDark ? "text-amber-400/70" : "text-amber-700/70"}`}>
              <Eye className="w-3 h-3" />
              <span>Review this line — you'll probably encounter it.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EnrichedKeyLineCard({
  line, index, priority, isDark, t
}: {
  line: EnrichedPrepLine; index: number; priority: Priority; isDark: boolean; t: Tokens;
}) {
  const [expanded, setExpanded] = useState(false);
  const cfg = PRIORITY_CONFIG[priority];
  const priorityStyle = isDark ? cfg.darkBg : cfg.lightBg;

  const fitColor = line.repertoireFit === "core"
    ? isDark ? "text-emerald-400" : "text-emerald-600"
    : line.repertoireFit === "adjacent"
    ? isDark ? "text-amber-400" : "text-amber-600"
    : isDark ? "text-white/30" : "text-gray-400";

  const fitLabel = line.repertoireFit === "core" ? "In repertoire"
    : line.repertoireFit === "adjacent" ? "Adjacent"
    : "Outside";

  return (
    <div className={`rounded-2xl overflow-hidden border transition-all duration-150 ${
      line.isTrainFirst
        ? isDark ? "bg-[#0f1c11] border-[#3D6B47]/50 ring-1 ring-[#3D6B47]/20" : "bg-white border-[#3D6B47]/30 shadow-sm ring-1 ring-[#3D6B47]/10"
        : isDark ? "bg-[#0f1c11] border-[#1e2e22]/70" : "bg-white border-gray-200/80 shadow-sm"
    }`}>
      <button
        className={`w-full text-left p-4 sm:p-5 transition-colors ${t.rowHover}`}
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-start gap-3">
          <span className={`text-[10px] font-bold w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5 ${isDark ? "bg-[#3D6B47]/15 text-[#5B9A6A]" : "bg-[#3D6B47]/06 text-[#3D6B47]"}`}>
            {index + 1}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h4 className={`font-semibold text-sm ${t.textPrimary}`} style={{ fontFamily: "'Clash Display', sans-serif" }}>
                {line.name}
              </h4>
              {line.isTrainFirst && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                  isDark ? "bg-amber-500/15 text-amber-400 border border-amber-500/20" : "bg-amber-50 text-amber-700 border border-amber-200"
                }`}>
                  <Flame className="w-2.5 h-2.5" /> Train First
                </span>
              )}
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1 ${priorityStyle}`}>
                <span className={`w-1 h-1 rounded-full ${cfg.dot}`} />
                {cfg.shortLabel}
              </span>
              {line.lineType === "surprise" ? (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                  isDark
                    ? "bg-violet-500/15 text-violet-300 border border-violet-500/25"
                    : "bg-violet-50 text-violet-700 border border-violet-200"
                }`}>
                  ⚡ Surprise
                </span>
              ) : line.lineType === "main" ? (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                  isDark
                    ? "bg-sky-500/12 text-sky-300 border border-sky-500/20"
                    : "bg-sky-50 text-sky-700 border border-sky-200"
                }`}>
                  ✦ Main Line
                </span>
              ) : null}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {line.eco !== "---" && (
                <span className={`text-[11px] font-mono ${t.textTertiary}`}>{line.eco}</span>
              )}
              {line.structureLabel && (
                <span className={`text-[10px] ${t.textTertiary}`}>· {line.structureLabel}</span>
              )}
              {line.collisionScore > 0 && (
                <span className={`text-[10px] font-medium flex items-center gap-1 ${fitColor}`}>
                  <Crosshair className="w-2.5 h-2.5" />
                  {fitLabel}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {line.collisionScore > 0 && (
              <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                line.collisionScore >= 70 ? isDark ? "bg-emerald-500/15 text-emerald-400" : "bg-emerald-50 text-emerald-700"
                : line.collisionScore >= 40 ? isDark ? "bg-amber-500/12 text-amber-400" : "bg-amber-50 text-amber-700"
                : isDark ? "bg-white/06 text-white/30" : "bg-gray-100 text-gray-400"
              }`}>
                {line.collisionScore}%
              </div>
            )}
            <ChevronRight className={`w-4 h-4 transition-transform duration-150 ${t.textTertiary} ${expanded ? "rotate-90" : ""}`} />
          </div>
        </div>
      </button>

      {expanded && (
        <div className={`px-4 sm:px-5 pb-4 sm:pb-5 pt-0 space-y-3 border-t ${t.divider}`}>
          {line.eco !== "---" && line.moves && (
            <div className={`font-mono text-xs px-3.5 py-2.5 rounded-xl overflow-x-auto whitespace-nowrap mt-3 ${t.monoBlock}`}>
              {line.moves}
            </div>
          )}
          <div className={`flex items-start gap-2.5 p-3 rounded-xl ${isDark ? "bg-[#0a1409]/80" : "bg-gray-50/80"}`}>
            <Info className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${isDark ? "text-[#5B9A6A]/60" : "text-[#3D6B47]/50"}`} />
            <p className={`text-sm leading-relaxed ${t.textSecondary}`}>{line.rationale}</p>
          </div>
          {priority === "must-know" && (
            <div className={`flex items-center gap-2 text-xs ${isDark ? "text-emerald-400/70" : "text-emerald-700/70"}`}>
              <Zap className="w-3 h-3" />
              <span>Memorize this line — it's the most likely scenario you'll face.</span>
            </div>
          )}
          {priority === "likely" && (
            <div className={`flex items-center gap-2 text-xs ${isDark ? "text-amber-400/70" : "text-amber-700/70"}`}>
              <Eye className="w-3 h-3" />
              <span>Review this line — you'll probably encounter it.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PracticeMode({
  lines, queue, currentIndex, revealed, completed,
  onReveal, onGotIt, onReviewAgain, onPrev, onNext, onReset,
  isDark, t
}: {
  lines: (PrepLine | EnrichedPrepLine)[];
  queue: number[];
  currentIndex: number;
  revealed: boolean;
  completed: Set<number>;
  onReveal: () => void;
  onGotIt: () => void;
  onReviewAgain: () => void;
  onPrev: () => void;
  onNext: () => void;
  onReset: () => void;
  isDark: boolean;
  t: Tokens;
}) {
  const totalLines = queue.length;
  const completedCount = completed.size;
  const allDone = completedCount >= totalLines;

  if (allDone) {
    return (
      <div className={`${t.card} py-14 px-6 flex flex-col items-center gap-5 text-center`}>
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isDark ? "bg-emerald-500/10" : "bg-emerald-50"}`}>
          <Trophy className="w-7 h-7 text-emerald-500" />
        </div>
        <div className="space-y-2">
          <h3 className={`text-lg font-bold ${t.textPrimary}`} style={{ fontFamily: "'Clash Display', sans-serif" }}>
            Prep complete
          </h3>
          <p className={`text-sm ${t.textSecondary} max-w-xs mx-auto`}>
            You've reviewed all {totalLines} lines. You're ready for this matchup.
          </p>
        </div>
        <button
          onClick={onReset}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-95 ${
            isDark ? "bg-[#162018] border border-[#2e4a34]/50 text-white hover:bg-[#1e2e22]" : "bg-gray-100 border border-gray-200 text-gray-700 hover:bg-gray-200"
          }`}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Practice again
        </button>
      </div>
    );
  }

  const lineIndex = queue[currentIndex];
  const line = lines[lineIndex];
  const priority = getPriority(line.confidence);
  const cfg = PRIORITY_CONFIG[priority];
  const priorityStyle = isDark ? cfg.darkBg : cfg.lightBg;
  const isCompleted = completed.has(lineIndex);

  return (
    <div className="space-y-3">
      {/* Progress bar */}
      <div className="flex items-center gap-3 px-1">
        <div className={`flex-1 h-1 rounded-full overflow-hidden ${isDark ? "bg-white/06" : "bg-gray-200"}`}>
          <div
            className="h-full bg-emerald-500 rounded-full transition-all duration-300"
            style={{ width: `${(completedCount / totalLines) * 100}%` }}
          />
        </div>
        <span className={`text-xs font-medium shrink-0 ${t.textTertiary}`}>
          {completedCount}/{totalLines}
        </span>
      </div>

      {/* Card */}
      <div className={`${t.card} overflow-hidden`}>
        {/* Card header */}
        <div className={`px-5 pt-5 pb-4 border-b ${t.divider}`}>
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-bold w-5 h-5 rounded-md flex items-center justify-center ${isDark ? "bg-[#3D6B47]/15 text-[#5B9A6A]" : "bg-[#3D6B47]/06 text-[#3D6B47]"}`}>
                {lineIndex + 1}
              </span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1 ${priorityStyle}`}>
                <span className={`w-1 h-1 rounded-full ${cfg.dot}`} />
                {cfg.label}
              </span>
              {isCompleted && (
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${isDark ? "bg-emerald-500/10 text-emerald-400" : "bg-emerald-50 text-emerald-600"}`}>
                  <Check className="w-2.5 h-2.5" /> Done
                </span>
              )}
            </div>
            <span className={`text-xs ${t.textTertiary}`}>{currentIndex + 1} of {totalLines}</span>
          </div>
          <h3 className={`text-base sm:text-lg font-bold ${t.textPrimary}`} style={{ fontFamily: "'Clash Display', sans-serif" }}>
            {line.name}
          </h3>
          {line.eco !== "---" && (
            <span className={`text-xs font-mono ${t.textTertiary}`}>{line.eco}</span>
          )}
        </div>

        {/* Move sequence — always visible */}
        {line.eco !== "---" && line.moves && (
          <div className="px-5 py-4">
            <p className={`text-[10px] font-semibold uppercase tracking-widest mb-2 ${t.textTertiary}`}>Moves</p>
            <div className={`font-mono text-sm px-4 py-3 rounded-xl overflow-x-auto whitespace-nowrap ${t.monoBlock}`}>
              {line.moves}
            </div>
          </div>
        )}

        {/* Rationale — hidden until revealed */}
        {!revealed ? (
          <div className="px-5 pb-5">
            <button
              onClick={onReveal}
              className={`w-full py-3 rounded-xl text-sm font-medium transition-all active:scale-[0.98] border ${
                isDark
                  ? "border-[#2e4a34]/50 text-[#5B9A6A] hover:bg-[#162018]"
                  : "border-[#3D6B47]/20 text-[#3D6B47] hover:bg-[#3D6B47]/04"
              }`}
            >
              Why does this matter?
            </button>
          </div>
        ) : (
          <div className="px-5 pb-5 space-y-4">
            <div className={`flex items-start gap-2.5 p-3.5 rounded-xl ${isDark ? "bg-[#0a1409]/80" : "bg-gray-50/80"}`}>
              <Info className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${isDark ? "text-[#5B9A6A]/60" : "text-[#3D6B47]/50"}`} />
              <p className={`text-sm leading-relaxed ${t.textSecondary}`}>{line.rationale}</p>
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={onReviewAgain}
                className={`py-3 rounded-xl text-sm font-medium transition-all active:scale-[0.98] border ${
                  isDark
                    ? "border-[#2e4a34]/40 text-white/50 hover:bg-[#162018] hover:text-white/70"
                    : "border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                }`}
              >
                Review again
              </button>
              <button
                onClick={onGotIt}
                className={`py-3 rounded-xl text-sm font-semibold transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${
                  isDark
                    ? "bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/20"
                    : "bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                }`}
              >
                <Check className="w-4 h-4" />
                Got it
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between px-1">
        <button
          onClick={onPrev}
          disabled={currentIndex === 0}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
            currentIndex === 0
              ? `${t.textTertiary} opacity-30 cursor-not-allowed`
              : `${t.textSecondary} hover:${t.textPrimary} ${t.rowHover}`
          }`}
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Previous
        </button>
        <button
          onClick={onNext}
          disabled={currentIndex >= queue.length - 1}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
            currentIndex >= queue.length - 1
              ? `${t.textTertiary} opacity-30 cursor-not-allowed`
              : `${t.textSecondary} hover:${t.textPrimary} ${t.rowHover}`
          }`}
        >
          Next
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function NextStepNudge({
  label, action, onClick, isDark, t
}: {
  label: string; action: string; onClick: () => void; isDark: boolean; t: Tokens;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl border transition-all active:scale-[0.99] group ${
        isDark
          ? "border-[#2e4a34]/40 hover:border-[#3D6B47]/50 hover:bg-[#162018]/50"
          : "border-gray-200/80 hover:border-[#3D6B47]/20 hover:bg-[#3D6B47]/02"
      }`}
    >
      <span className={`text-sm ${t.textTertiary} group-hover:${t.textSecondary} transition-colors`}>{label}</span>
      <div className={`flex items-center gap-1.5 text-sm font-medium ${isDark ? "text-[#5B9A6A]" : "text-[#3D6B47]"}`}>
        {action}
        <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
      </div>
    </button>
  );
}

function EmptyState({
  icon, title, description, isDark, t
}: {
  icon: React.ReactNode; title: string; description: string; isDark: boolean; t: Tokens;
}) {
  return (
    <div className={`py-12 px-6 rounded-2xl flex flex-col items-center gap-4 text-center ${isDark ? "bg-[#0f1c11] border border-[#1e2e22]/70" : "bg-white border border-gray-200/80 shadow-sm"}`}>
      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${isDark ? "bg-[#162018]" : "bg-[#3D6B47]/06"}`}>
        {icon}
      </div>
      <div>
        <h3 className={`font-semibold text-sm ${t.textPrimary}`}>{title}</h3>
        <p className={`text-sm mt-1 ${t.textTertiary} max-w-xs mx-auto leading-relaxed`}>{description}</p>
      </div>
    </div>
  );
}

// ── Recently Scouted Chips ─────────────────────────────────────────────────────

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
      <p className={`text-[11px] font-semibold uppercase tracking-widest mb-3 ${t.textTertiary}`}>
        Recently Scouted
      </p>
      <div className="flex flex-wrap gap-2">
        {usernames.map((username) => (
          <div
            key={username}
            className={`group flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-xl border text-sm font-medium transition-all ${
              isDark
                ? "bg-[#0d1a0f]/60 border-[#1e2e22]/60 text-white/70 hover:border-[#3D6B47]/40 hover:text-white"
                : "bg-gray-50/80 border-gray-200/60 text-gray-600 hover:border-[#3D6B47]/30 hover:text-gray-900"
            }`}
          >
            {/* Clickable username area */}
            <button
              onClick={() => onSelect(username)}
              className="flex items-center gap-1.5 min-w-0"
              aria-label={`Scout ${username}`}
            >
              <span
                className={`w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-bold shrink-0 ${
                  isDark ? "bg-[#3D6B47]/20 text-[#5B9A6A]" : "bg-[#3D6B47]/08 text-[#3D6B47]"
                }`}
              >
                {username.charAt(0).toUpperCase()}
              </span>
              <span className="truncate max-w-[120px]">{username}</span>
            </button>
            {/* Remove button */}
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(username); }}
              className={`ml-0.5 w-4 h-4 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity ${
                isDark ? "hover:bg-white/10 text-white/30 hover:text-white/60" : "hover:bg-gray-200 text-gray-300 hover:text-gray-500"
              }`}
              aria-label={`Remove ${username} from recent`}
            >
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                <path d="M1 1l6 6M7 1L1 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
