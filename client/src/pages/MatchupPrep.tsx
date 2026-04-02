/**
 * Matchup Prep Page — /prep/:username
 *
 * Fully redesigned with a premium, unified design system:
 * - Summary-first hero panel with key matchup stats
 * - Tab navigation for progressive disclosure
 * - Polished cards, typography hierarchy, and interaction states
 * - Responsive across desktop, tablet, and mobile
 */
import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useTheme } from "@/contexts/ThemeContext";
import {
  ArrowLeft, Search, Swords, Target, BarChart3,
  Shield, Zap, Clock, Crown,
  TrendingUp, BookOpen, Eye, AlertTriangle, Loader2,
  CircleDot, RefreshCw, ChevronRight, Trophy, Flame,
  Activity
} from "lucide-react";

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
}

interface PrepReport {
  opponent: PlayStyleProfile;
  prepLines: PrepLine[];
  insights: string[];
  generatedAt: string;
  _cached?: boolean;
}

type Tab = "overview" | "openings" | "prep";

// ── Design tokens ─────────────────────────────────────────────────────────────

function useDesignTokens(isDark: boolean) {
  return {
    page:      isDark ? "bg-[#0d1a0f]"                                          : "bg-[#f8faf8]",
    card:      isDark ? "bg-[#111f13] border border-[#2a4030]/60 rounded-2xl"  : "bg-white border border-gray-200/80 rounded-2xl shadow-sm",
    cardInner: isDark ? "bg-[#0d1a0f]/70 rounded-xl"                           : "bg-gray-50/80 rounded-xl",
    header:    isDark ? "bg-[#0d1a0f]/92 border-b border-[#2a4030]/50"         : "bg-white/92 border-b border-gray-200/70",
    input:     isDark ? "bg-[#0d1a0f] border-[#2a4030]/60 text-white placeholder:text-white/25 focus:border-[#5B9A6A]/70" : "bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-[#3D6B47]",
    textPrimary: isDark ? "text-white"       : "text-gray-900",
    textSecondary: isDark ? "text-white/60"  : "text-gray-500",
    textTertiary: isDark ? "text-white/35"   : "text-gray-400",
    accent:    "text-[#5B9A6A]",
    accentBg:  isDark ? "bg-[#5B9A6A]/12 text-[#5B9A6A]" : "bg-[#3D6B47]/08 text-[#3D6B47]",
    divider:   isDark ? "border-[#2a4030]/40" : "border-gray-200/70",
    tabActive: isDark ? "bg-[#1a2e1c] text-white border-[#3D6B47]/40"          : "bg-white text-gray-900 border-gray-300 shadow-sm",
    tabInactive: isDark ? "text-white/45 hover:text-white/70 hover:bg-white/04" : "text-gray-500 hover:text-gray-700 hover:bg-gray-100/60",
    rowHover:  isDark ? "hover:bg-[#1a2e1c]/60"                                : "hover:bg-gray-50",
  };
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function MatchupPrep() {
  const params = useParams<{ username?: string }>();
  const [, navigate] = useLocation();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const t = useDesignTokens(isDark);

  const [searchInput, setSearchInput] = useState(params.username || "");
  const [report, setReport] = useState<PrepReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("overview");

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
      setActiveTab("overview");
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to fetch prep report");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const u = searchInput.trim();
    if (!u) return;
    navigate(`/prep/${encodeURIComponent(u)}`);
    fetchReport(u);
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "overview",  label: "Overview",   icon: <BarChart3 className="w-3.5 h-3.5" /> },
    { id: "openings",  label: "Openings",   icon: <BookOpen  className="w-3.5 h-3.5" /> },
    { id: "prep",      label: "Prep Lines", icon: <Zap       className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className={`min-h-screen ${t.page}`}>
      {/* ── Sticky Header ── */}
      <div className={`sticky top-0 z-40 backdrop-blur-xl ${t.header}`}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <button
            onClick={() => navigate("/")}
            className={`p-2 rounded-xl transition-colors ${isDark ? "hover:bg-white/06 text-white/60 hover:text-white" : "hover:bg-gray-100 text-gray-500 hover:text-gray-900"}`}
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isDark ? "bg-[#3D6B47]/25" : "bg-[#3D6B47]/10"}`}>
              <Target className="w-3.5 h-3.5 text-[#5B9A6A]" />
            </div>
            <h1 className={`text-sm font-semibold tracking-tight ${t.textPrimary}`} style={{ fontFamily: "'Clash Display', sans-serif" }}>
              Matchup Prep
            </h1>
          </div>
          {report && (
            <div className="ml-auto flex items-center gap-2">
              <span className={`text-xs ${t.textTertiary}`}>
                {report.opponent.username}
              </span>
              <button
                onClick={() => fetchReport(report.opponent.username, true)}
                disabled={refreshing}
                className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 ${isDark ? "hover:bg-white/06 text-white/40 hover:text-white/70" : "hover:bg-gray-100 text-gray-400 hover:text-gray-600"}`}
                title="Refresh report"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        {/* ── Search Bar ── */}
        <form onSubmit={handleSearch}>
          <div className={`${t.card} p-4`}>
            <div className="flex gap-2.5">
              <div className="relative flex-1">
                <Search className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${t.textTertiary}`} />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Enter chess.com username to analyze..."
                  className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm outline-none transition-all duration-150 ${t.input}`}
                />
              </div>
              <button
                type="submit"
                disabled={loading || !searchInput.trim()}
                className="px-5 py-2.5 rounded-xl bg-[#3D6B47] text-white font-semibold text-sm hover:bg-[#4a7d55] active:scale-[0.97] transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 shrink-0"
              >
                {loading
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Swords className="w-4 h-4" />
                }
                <span className="hidden sm:inline">Analyze</span>
              </button>
            </div>
          </div>
        </form>

        {/* ── Loading State ── */}
        {loading && (
          <div className={`${t.card} p-14 flex flex-col items-center gap-5`}>
            <div className="relative">
              <div className={`w-14 h-14 rounded-full border-2 ${isDark ? "border-[#3D6B47]/20" : "border-[#3D6B47]/15"} border-t-[#5B9A6A] animate-spin`} />
              <div className={`absolute inset-0 flex items-center justify-center`}>
                <Target className="w-5 h-5 text-[#5B9A6A]" />
              </div>
            </div>
            <div className="text-center space-y-1">
              <p className={`font-semibold ${t.textPrimary}`}>Analyzing opponent</p>
              <p className={`text-sm ${t.textSecondary}`}>Fetching recent games and computing play style profile</p>
            </div>
            {/* Skeleton shimmer */}
            <div className="w-full max-w-sm space-y-2 mt-2">
              {[80, 60, 70].map((w, i) => (
                <div key={i} className={`h-2 rounded-full animate-pulse ${isDark ? "bg-white/06" : "bg-gray-200"}`} style={{ width: `${w}%` }} />
              ))}
            </div>
          </div>
        )}

        {/* ── Error State ── */}
        {error && !loading && (
          <div className={`${t.card} p-6`}>
            <div className="flex items-start gap-3.5">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isDark ? "bg-amber-500/12" : "bg-amber-50"}`}>
                <AlertTriangle className="w-4 h-4 text-amber-500" />
              </div>
              <div>
                <p className={`font-semibold text-sm ${t.textPrimary}`}>Could not generate report</p>
                <p className={`text-sm ${t.textSecondary} mt-0.5`}>{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Report ── */}
        {report && !loading && (
          <div className="space-y-5">

            {/* Opponent Hero Card */}
            <div className={`${t.card} overflow-hidden`}>
              {/* Top strip */}
              <div className={`h-1 w-full ${isDark ? "bg-gradient-to-r from-[#3D6B47]/60 via-[#5B9A6A]/40 to-transparent" : "bg-gradient-to-r from-[#3D6B47]/20 via-[#5B9A6A]/10 to-transparent"}`} />
              <div className="p-5 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  {/* Left: identity */}
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${isDark ? "bg-[#3D6B47]/20" : "bg-[#3D6B47]/08"}`}>
                      <Crown className="w-6 h-6 text-[#5B9A6A]" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className={`text-xl font-bold tracking-tight ${t.textPrimary}`} style={{ fontFamily: "'Clash Display', sans-serif" }}>
                          {report.opponent.username}
                        </h2>
                        {report._cached && (
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${t.accentBg}`}>
                            Cached
                          </span>
                        )}
                      </div>
                      <p className={`text-sm ${t.textSecondary} mt-0.5`}>
                        {report.opponent.gamesAnalyzed} games analyzed
                      </p>
                    </div>
                  </div>
                  {/* Right: ratings */}
                  <div className="flex gap-2 flex-wrap">
                    {report.opponent.rating.rapid  && <RatingBadge label="Rapid"  value={report.opponent.rating.rapid}  isDark={isDark} />}
                    {report.opponent.rating.blitz  && <RatingBadge label="Blitz"  value={report.opponent.rating.blitz}  isDark={isDark} />}
                    {report.opponent.rating.bullet && <RatingBadge label="Bullet" value={report.opponent.rating.bullet} isDark={isDark} />}
                  </div>
                </div>

                {/* Summary stat row */}
                <div className={`mt-5 pt-5 border-t ${t.divider} grid grid-cols-3 sm:grid-cols-6 gap-3`}>
                  <SummaryChip
                    label="Win Rate"
                    value={`${report.opponent.overall.winRate}%`}
                    highlight={report.opponent.overall.winRate >= 55}
                    isDark={isDark}
                  />
                  <SummaryChip
                    label="W / D / L"
                    value={`${report.opponent.overall.wins}/${report.opponent.overall.draws}/${report.opponent.overall.losses}`}
                    isDark={isDark}
                  />
                  <SummaryChip
                    label="As White"
                    value={`${report.opponent.asWhite.winRate}%`}
                    highlight={report.opponent.asWhite.winRate >= 55}
                    isDark={isDark}
                  />
                  <SummaryChip
                    label="As Black"
                    value={`${report.opponent.asBlack.winRate}%`}
                    highlight={report.opponent.asBlack.winRate >= 55}
                    isDark={isDark}
                  />
                  <SummaryChip
                    label="Avg Length"
                    value={`${report.opponent.avgGameLength}m`}
                    isDark={isDark}
                  />
                  <SummaryChip
                    label="Prep Lines"
                    value={`${report.prepLines.length}`}
                    highlight={report.prepLines.length > 0}
                    isDark={isDark}
                  />
                </div>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className={`flex gap-1 p-1 rounded-2xl ${isDark ? "bg-[#111f13] border border-[#2a4030]/60" : "bg-gray-100/80 border border-gray-200/60"}`}>
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-sm font-medium transition-all duration-150 ${
                    activeTab === tab.id ? t.tabActive + " border" : t.tabInactive
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                  {tab.id === "prep" && report.prepLines.length > 0 && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      activeTab === "prep"
                        ? isDark ? "bg-[#3D6B47]/30 text-[#5B9A6A]" : "bg-[#3D6B47]/10 text-[#3D6B47]"
                        : isDark ? "bg-white/08 text-white/40" : "bg-gray-300/60 text-gray-500"
                    }`}>
                      {report.prepLines.length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* ── Tab: Overview ── */}
            {activeTab === "overview" && (
              <div className="space-y-5">

                {/* Win/Draw/Loss breakdown */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <ColorStatCard
                    title="Overall Record"
                    icon={<BarChart3 className="w-4 h-4" />}
                    wins={report.opponent.overall.wins}
                    draws={report.opponent.overall.draws}
                    losses={report.opponent.overall.losses}
                    winRate={report.opponent.overall.winRate}
                    isDark={isDark}
                  />
                  <ColorStatCard
                    title="As White"
                    icon={<CircleDot className="w-4 h-4" />}
                    wins={report.opponent.asWhite.wins}
                    draws={report.opponent.asWhite.draws}
                    losses={report.opponent.asWhite.losses}
                    winRate={report.opponent.asWhite.winRate}
                    games={report.opponent.asWhite.games}
                    isDark={isDark}
                  />
                  <ColorStatCard
                    title="As Black"
                    icon={<CircleDot className="w-4 h-4 fill-current opacity-70" />}
                    wins={report.opponent.asBlack.wins}
                    draws={report.opponent.asBlack.draws}
                    losses={report.opponent.asBlack.losses}
                    winRate={report.opponent.asBlack.winRate}
                    games={report.opponent.asBlack.games}
                    isDark={isDark}
                  />
                </div>

                {/* Key Insights */}
                {report.insights.length > 0 && (
                  <div className={`${t.card} p-5`}>
                    <div className="flex items-center gap-2.5 mb-4">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isDark ? "bg-[#3D6B47]/20" : "bg-[#3D6B47]/08"}`}>
                        <Eye className="w-3.5 h-3.5 text-[#5B9A6A]" />
                      </div>
                      <h3 className={`font-semibold text-sm ${t.textPrimary}`} style={{ fontFamily: "'Clash Display', sans-serif" }}>
                        Key Insights
                      </h3>
                      <span className={`text-xs ${t.textTertiary}`}>{report.insights.length} signals</span>
                    </div>
                    <div className="space-y-2">
                      {report.insights.map((insight, i) => (
                        <div
                          key={i}
                          className={`flex items-start gap-3 p-3 rounded-xl transition-colors duration-100 ${t.cardInner} ${t.rowHover}`}
                        >
                          <span className={`text-xs font-bold w-5 h-5 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${isDark ? "bg-[#3D6B47]/20 text-[#5B9A6A]" : "bg-[#3D6B47]/08 text-[#3D6B47]"}`}>
                            {i + 1}
                          </span>
                          <span className={`text-sm leading-relaxed ${t.textPrimary}`}>{insight}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Endgame Profile */}
                <div className={`${t.card} p-5`}>
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isDark ? "bg-[#3D6B47]/20" : "bg-[#3D6B47]/08"}`}>
                      <Shield className="w-3.5 h-3.5 text-[#5B9A6A]" />
                    </div>
                    <h3 className={`font-semibold text-sm ${t.textPrimary}`} style={{ fontFamily: "'Clash Display', sans-serif" }}>
                      Endgame Profile
                    </h3>
                    <span className={`text-xs ${t.textTertiary}`}>{report.opponent.endgameProfile.total} games</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <EndgameBar
                      label="Checkmates"
                      value={report.opponent.endgameProfile.checkmates}
                      total={report.opponent.endgameProfile.total}
                      color="emerald"
                      isDark={isDark}
                    />
                    <EndgameBar
                      label="Resignations"
                      value={report.opponent.endgameProfile.resignations}
                      total={report.opponent.endgameProfile.total}
                      color="blue"
                      isDark={isDark}
                    />
                    <EndgameBar
                      label="Timeouts"
                      value={report.opponent.endgameProfile.timeouts}
                      total={report.opponent.endgameProfile.total}
                      color="amber"
                      isDark={isDark}
                    />
                    <EndgameBar
                      label="Draws"
                      value={report.opponent.endgameProfile.draws}
                      total={report.opponent.endgameProfile.total}
                      color="gray"
                      isDark={isDark}
                    />
                    <AvgLengthStat
                      value={report.opponent.avgGameLength}
                      isDark={isDark}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ── Tab: Openings ── */}
            {activeTab === "openings" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <OpeningPanel
                  title="White Repertoire"
                  openings={report.opponent.whiteOpenings}
                  firstMoves={report.opponent.firstMoveAsWhite}
                  isDark={isDark}
                />
                <OpeningPanel
                  title="Black Repertoire"
                  openings={report.opponent.blackOpenings}
                  isDark={isDark}
                />
              </div>
            )}

            {/* ── Tab: Prep Lines ── */}
            {activeTab === "prep" && (
              <div className="space-y-3">
                {report.prepLines.length === 0 ? (
                  <EmptyState
                    icon={<Zap className="w-7 h-7 text-[#5B9A6A]" />}
                    title="No prep lines generated"
                    description="Not enough opening data was found to generate specific preparation lines."
                    isDark={isDark}
                  />
                ) : (
                  <>
                    <div className={`flex items-center gap-2 px-1`}>
                      <Zap className={`w-4 h-4 ${isDark ? "text-[#5B9A6A]" : "text-[#3D6B47]"}`} />
                      <p className={`text-sm font-medium ${isDark ? "text-white/60" : "text-gray-500"}`}>
                        {report.prepLines.length} suggested lines based on opponent tendencies
                      </p>
                    </div>
                    {report.prepLines.map((line, i) => (
                      <PrepLineCard key={i} line={line} index={i} isDark={isDark} />
                    ))}
                  </>
                )}
              </div>
            )}

          </div>
        )}

        {/* ── Empty State ── */}
        {!report && !loading && !error && (
          <div className={`${t.card} p-14 flex flex-col items-center gap-5 text-center`}>
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${isDark ? "bg-[#1a2e1c]" : "bg-[#3D6B47]/06"}`}>
              <Target className="w-8 h-8 text-[#5B9A6A]" />
            </div>
            <div className="space-y-2">
              <h3 className={`text-lg font-bold ${t.textPrimary}`} style={{ fontFamily: "'Clash Display', sans-serif" }}>
                Prepare for your next match
              </h3>
              <p className={`text-sm ${t.textSecondary} max-w-sm mx-auto leading-relaxed`}>
                Enter your opponent's chess.com username to get a full analysis of their
                opening repertoire, play style tendencies, and strategic preparation lines.
              </p>
            </div>
            <div className={`flex gap-4 mt-2 text-xs ${t.textTertiary}`}>
              <span className="flex items-center gap-1.5"><BookOpen className="w-3.5 h-3.5" /> Opening repertoire</span>
              <span className="flex items-center gap-1.5"><Activity className="w-3.5 h-3.5" /> Play style profile</span>
              <span className="flex items-center gap-1.5"><Zap className="w-3.5 h-3.5" /> Prep lines</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function RatingBadge({ label, value, isDark }: { label: string; value: number; isDark: boolean }) {
  return (
    <div className={`px-3 py-2 rounded-xl text-center min-w-[60px] ${isDark ? "bg-[#0d1a0f] border border-[#2a4030]/60" : "bg-gray-50 border border-gray-200"}`}>
      <div className={`text-[10px] font-medium uppercase tracking-wide ${isDark ? "text-white/35" : "text-gray-400"}`}>{label}</div>
      <div className={`text-base font-bold mt-0.5 ${isDark ? "text-white" : "text-gray-900"}`}>{value}</div>
    </div>
  );
}

function SummaryChip({ label, value, highlight, isDark }: { label: string; value: string; highlight?: boolean; isDark: boolean }) {
  return (
    <div className={`rounded-xl p-3 text-center ${isDark ? "bg-[#0d1a0f]/70" : "bg-gray-50/80"}`}>
      <div className={`text-[10px] font-medium uppercase tracking-wide mb-1 ${isDark ? "text-white/35" : "text-gray-400"}`}>{label}</div>
      <div className={`text-sm font-bold ${
        highlight
          ? "text-[#5B9A6A]"
          : isDark ? "text-white" : "text-gray-900"
      }`}>{value}</div>
    </div>
  );
}

function ColorStatCard({
  title, icon, wins, draws, losses, winRate, games, isDark
}: {
  title: string; icon: React.ReactNode;
  wins: number; draws: number; losses: number; winRate: number;
  games?: number; isDark: boolean;
}) {
  const total = wins + draws + losses;
  const winPct  = total > 0 ? (wins  / total) * 100 : 0;
  const drawPct = total > 0 ? (draws / total) * 100 : 0;
  const lossPct = total > 0 ? (losses / total) * 100 : 0;

  return (
    <div className={`p-4 rounded-2xl ${isDark ? "bg-[#111f13] border border-[#2a4030]/60" : "bg-white border border-gray-200/80 shadow-sm"}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-[#5B9A6A]">{icon}</span>
          <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>{title}</h3>
        </div>
        <span className={`text-lg font-bold ${winRate >= 55 ? "text-[#5B9A6A]" : winRate >= 45 ? (isDark ? "text-white" : "text-gray-900") : "text-red-400"}`}>
          {winRate}%
        </span>
      </div>

      {/* Win/draw/loss bar */}
      <div className="h-1.5 rounded-full overflow-hidden flex mb-3">
        <div className="bg-emerald-500 h-full transition-all" style={{ width: `${winPct}%` }} />
        <div className={`h-full transition-all ${isDark ? "bg-white/20" : "bg-gray-300"}`} style={{ width: `${drawPct}%` }} />
        <div className="bg-red-400 h-full transition-all" style={{ width: `${lossPct}%` }} />
      </div>

      <div className="flex justify-between text-xs">
        <span className="text-emerald-500 font-medium">{wins}W</span>
        <span className={isDark ? "text-white/35" : "text-gray-400"}>{draws}D</span>
        <span className="text-red-400 font-medium">{losses}L</span>
      </div>
      {games !== undefined && (
        <div className={`text-xs mt-2 ${isDark ? "text-white/30" : "text-gray-400"}`}>{games} games</div>
      )}
    </div>
  );
}

function EndgameBar({
  label, value, total, color, isDark
}: {
  label: string; value: number; total: number; color: "emerald" | "blue" | "amber" | "gray"; isDark: boolean;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  const colorMap = {
    emerald: "bg-emerald-500",
    blue:    "bg-blue-400",
    amber:   "bg-amber-400",
    gray:    isDark ? "bg-white/20" : "bg-gray-300",
  };
  const textMap = {
    emerald: "text-emerald-500",
    blue:    "text-blue-400",
    amber:   "text-amber-400",
    gray:    isDark ? "text-white/50" : "text-gray-500",
  };

  return (
    <div className={`p-3 rounded-xl ${isDark ? "bg-[#0d1a0f]/70" : "bg-gray-50/80"}`}>
      <div className={`text-xl font-bold ${textMap[color]}`}>{pct}<span className="text-sm font-normal opacity-60">%</span></div>
      <div className={`text-xs mt-1 mb-2 ${isDark ? "text-white/40" : "text-gray-500"}`}>{label}</div>
      <div className={`h-1 rounded-full ${isDark ? "bg-white/06" : "bg-gray-200"} overflow-hidden`}>
        <div className={`h-full rounded-full ${colorMap[color]} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
      <div className={`text-[10px] mt-1.5 ${isDark ? "text-white/25" : "text-gray-400"}`}>{value} games</div>
    </div>
  );
}

function AvgLengthStat({ value, isDark }: { value: number; isDark: boolean }) {
  return (
    <div className={`p-3 rounded-xl ${isDark ? "bg-[#0d1a0f]/70" : "bg-gray-50/80"}`}>
      <div className={`text-xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>{value}</div>
      <div className={`text-xs mt-1 mb-2 ${isDark ? "text-white/40" : "text-gray-500"}`}>Avg Length</div>
      <div className={`h-1 rounded-full ${isDark ? "bg-white/06" : "bg-gray-200"}`} />
      <div className={`text-[10px] mt-1.5 ${isDark ? "text-white/25" : "text-gray-400"}`}>moves avg</div>
    </div>
  );
}

function OpeningPanel({
  title, openings, firstMoves, isDark
}: {
  title: string; openings: OpeningStat[]; firstMoves?: { move: string; count: number; pct: number }[]; isDark: boolean;
}) {
  return (
    <div className={`p-5 rounded-2xl ${isDark ? "bg-[#111f13] border border-[#2a4030]/60" : "bg-white border border-gray-200/80 shadow-sm"}`}>
      <div className="flex items-center gap-2.5 mb-4">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isDark ? "bg-[#3D6B47]/20" : "bg-[#3D6B47]/08"}`}>
          <BookOpen className="w-3.5 h-3.5 text-[#5B9A6A]" />
        </div>
        <h3 className={`font-semibold text-sm ${isDark ? "text-white" : "text-gray-900"}`} style={{ fontFamily: "'Clash Display', sans-serif" }}>
          {title}
        </h3>
      </div>

      {firstMoves && firstMoves.length > 0 && (
        <div className="mb-4">
          <p className={`text-xs font-medium uppercase tracking-wide mb-2 ${isDark ? "text-white/35" : "text-gray-400"}`}>
            First Move Preference
          </p>
          <div className="flex gap-2 flex-wrap">
            {firstMoves.slice(0, 3).map((fm) => (
              <span
                key={fm.move}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium ${
                  isDark ? "bg-[#0d1a0f] text-[#5B9A6A] border border-[#2a4030]/60" : "bg-[#3D6B47]/06 text-[#3D6B47] border border-[#3D6B47]/15"
                }`}
              >
                1.{fm.move} <span className={isDark ? "text-white/35" : "text-gray-400"}>({fm.pct}%)</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {openings.length === 0 ? (
        <p className={`text-sm ${isDark ? "text-white/35" : "text-gray-400"} py-4 text-center`}>
          No opening data available
        </p>
      ) : (
        <div className="space-y-1.5">
          {openings.slice(0, 6).map((op) => (
            <div
              key={op.name}
              className={`p-3 rounded-xl transition-colors duration-100 cursor-default ${
                isDark ? "hover:bg-[#1a2e1c]/60" : "hover:bg-gray-50"
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <span className={`text-sm font-medium block truncate ${isDark ? "text-white" : "text-gray-900"}`}>{op.name}</span>
                  <span className={`text-[11px] font-mono ${isDark ? "text-white/30" : "text-gray-400"}`}>{op.eco} · {op.count} games</span>
                </div>
                <span className={`text-sm font-bold shrink-0 ${
                  op.winRate >= 60 ? "text-emerald-500" : op.winRate >= 40 ? "text-amber-500" : "text-red-400"
                }`}>
                  {op.winRate}%
                </span>
              </div>
              {/* W/D/L bar */}
              <div className="h-1 rounded-full overflow-hidden flex">
                <div className="bg-emerald-500 h-full" style={{ width: `${(op.wins / op.count) * 100}%` }} />
                <div className={`h-full ${isDark ? "bg-white/15" : "bg-gray-300"}`} style={{ width: `${(op.draws / op.count) * 100}%` }} />
                <div className="bg-red-400 h-full" style={{ width: `${(op.losses / op.count) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PrepLineCard({ line, index, isDark }: { line: PrepLine; index: number; isDark: boolean }) {
  const conf = {
    high:   { bg: isDark ? "bg-emerald-500/12 border-emerald-500/25 text-emerald-400" : "bg-emerald-50 border-emerald-200 text-emerald-700", dot: "bg-emerald-500", label: "High confidence" },
    medium: { bg: isDark ? "bg-amber-500/12 border-amber-500/25 text-amber-400"       : "bg-amber-50 border-amber-200 text-amber-700",       dot: "bg-amber-500",   label: "Medium confidence" },
    low:    { bg: isDark ? "bg-white/06 border-white/12 text-white/40"                : "bg-gray-50 border-gray-200 text-gray-500",           dot: isDark ? "bg-white/30" : "bg-gray-400", label: "Low confidence" },
  }[line.confidence];

  return (
    <div className={`rounded-2xl overflow-hidden ${isDark ? "bg-[#111f13] border border-[#2a4030]/60" : "bg-white border border-gray-200/80 shadow-sm"}`}>
      <div className="p-4 sm:p-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className={`text-xs font-bold w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${isDark ? "bg-[#3D6B47]/20 text-[#5B9A6A]" : "bg-[#3D6B47]/08 text-[#3D6B47]"}`}>
              {index + 1}
            </span>
            <div className="min-w-0">
              <h4 className={`font-semibold text-sm ${isDark ? "text-white" : "text-gray-900"} truncate`} style={{ fontFamily: "'Clash Display', sans-serif" }}>
                {line.name}
              </h4>
              {line.eco !== "---" && (
                <span className={`text-[11px] font-mono ${isDark ? "text-white/30" : "text-gray-400"}`}>{line.eco}</span>
              )}
            </div>
          </div>
          <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border shrink-0 flex items-center gap-1.5 ${conf.bg}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${conf.dot}`} />
            {conf.label}
          </span>
        </div>

        {/* Moves */}
        {line.eco !== "---" && line.moves && (
          <div className={`font-mono text-xs px-3.5 py-2.5 rounded-xl mb-3 ${
            isDark ? "bg-[#0d1a0f] text-[#5B9A6A] border border-[#2a4030]/40" : "bg-[#3D6B47]/04 text-[#3D6B47] border border-[#3D6B47]/12"
          }`}>
            {line.moves}
          </div>
        )}

        {/* Rationale */}
        <p className={`text-sm leading-relaxed ${isDark ? "text-white/60" : "text-gray-600"}`}>
          {line.rationale}
        </p>
      </div>
    </div>
  );
}

function EmptyState({ icon, title, description, isDark }: { icon: React.ReactNode; title: string; description: string; isDark: boolean }) {
  return (
    <div className={`p-12 rounded-2xl flex flex-col items-center gap-4 text-center ${isDark ? "bg-[#111f13] border border-[#2a4030]/60" : "bg-white border border-gray-200/80 shadow-sm"}`}>
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isDark ? "bg-[#1a2e1c]" : "bg-[#3D6B47]/06"}`}>
        {icon}
      </div>
      <div>
        <h3 className={`font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>{title}</h3>
        <p className={`text-sm mt-1 ${isDark ? "text-white/40" : "text-gray-500"} max-w-xs mx-auto`}>{description}</p>
      </div>
    </div>
  );
}
