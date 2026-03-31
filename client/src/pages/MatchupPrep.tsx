/**
 * Matchup Prep Page — /prep/:username
 * 
 * Fetches a full matchup preparation report from /api/prep/:username
 * and displays the opponent's play style profile, opening repertoire,
 * insights, and recommended preparation lines.
 */
import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useTheme } from "@/contexts/ThemeContext";
import {
  ArrowLeft, Search, Swords, Target, BarChart3,
  ChevronRight, Shield, Zap, Clock, Crown,
  TrendingUp, BookOpen, Eye, AlertTriangle, Loader2,
  CircleDot, Percent, Hash
} from "lucide-react";

// ── Types (mirrors server PrepReport) ────────────────────────────────────────

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
}

// ── Component ────────────────────────────────────────────────────────────────

export default function MatchupPrep() {
  const params = useParams<{ username?: string }>();
  const [, navigate] = useLocation();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [searchInput, setSearchInput] = useState(params.username || "");
  const [report, setReport] = useState<PrepReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-fetch if username is in URL
  useEffect(() => {
    if (params.username) {
      setSearchInput(params.username);
      fetchReport(params.username);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.username]);

  async function fetchReport(username: string) {
    setLoading(true);
    setError(null);
    setReport(null);
    try {
      const res = await fetch(`/api/prep/${encodeURIComponent(username.trim())}`);
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
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const u = searchInput.trim();
    if (!u) return;
    navigate(`/prep/${encodeURIComponent(u)}`);
    fetchReport(u);
  }

  const cardClass = isDark
    ? "bg-[#1a2e1c]/80 border border-[#3D6B47]/30 rounded-xl"
    : "bg-white border border-gray-200 rounded-xl shadow-sm";
  const textMuted = isDark ? "text-gray-400" : "text-gray-500";
  const textPrimary = isDark ? "text-white" : "text-gray-900";
  const accent = "text-[#5B9A6A]";

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0d1a0f]" : "bg-gray-50"}`}>
      {/* Header */}
      <div className={`sticky top-0 z-40 backdrop-blur-xl ${isDark ? "bg-[#0d1a0f]/90 border-b border-[#3D6B47]/20" : "bg-white/90 border-b border-gray-200"}`}>
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate("/")}
            className={`p-2 rounded-lg transition-colors ${isDark ? "hover:bg-[#1a2e1c]" : "hover:bg-gray-100"}`}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Target className={`w-5 h-5 ${accent}`} />
            <h1 className={`text-lg font-bold ${textPrimary}`}>Matchup Prep</h1>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Search Bar */}
        <form onSubmit={handleSearch} className={`${cardClass} p-4`}>
          <label className={`text-sm font-medium ${textMuted} mb-2 block`}>
            Enter a chess.com username to analyze
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${textMuted}`} />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="e.g. hikaru, gothamchess"
                className={`w-full pl-10 pr-4 py-2.5 rounded-lg border text-sm ${
                  isDark
                    ? "bg-[#0d1a0f] border-[#3D6B47]/30 text-white placeholder:text-gray-500 focus:border-[#5B9A6A]"
                    : "bg-gray-50 border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-[#3D6B47]"
                } outline-none transition-colors`}
              />
            </div>
            <button
              type="submit"
              disabled={loading || !searchInput.trim()}
              className="px-5 py-2.5 rounded-lg bg-[#3D6B47] text-white font-medium text-sm hover:bg-[#4a7d55] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Swords className="w-4 h-4" />}
              Analyze
            </button>
          </div>
        </form>

        {/* Loading State */}
        {loading && (
          <div className={`${cardClass} p-12 flex flex-col items-center gap-4`}>
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-3 border-[#3D6B47]/20 border-t-[#5B9A6A] animate-spin" />
              <Target className="w-6 h-6 text-[#5B9A6A] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
            <div className="text-center">
              <p className={`font-medium ${textPrimary}`}>Analyzing opponent...</p>
              <p className={`text-sm ${textMuted} mt-1`}>
                Fetching games from chess.com and computing play style profile
              </p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className={`${cardClass} p-6 flex items-start gap-3`}>
            <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className={`font-medium ${textPrimary}`}>Could not generate report</p>
              <p className={`text-sm ${textMuted} mt-1`}>{error}</p>
            </div>
          </div>
        )}

        {/* Report */}
        {report && !loading && (
          <div className="space-y-6">
            {/* Opponent Header */}
            <div className={`${cardClass} p-5`}>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Crown className={`w-5 h-5 ${accent}`} />
                    <h2 className={`text-xl font-bold ${textPrimary}`}>
                      {report.opponent.username}
                    </h2>
                  </div>
                  <p className={`text-sm ${textMuted}`}>
                    {report.opponent.gamesAnalyzed} recent games analyzed
                  </p>
                </div>
                <div className="flex gap-3">
                  {report.opponent.rating.rapid && (
                    <RatingBadge label="Rapid" value={report.opponent.rating.rapid} isDark={isDark} />
                  )}
                  {report.opponent.rating.blitz && (
                    <RatingBadge label="Blitz" value={report.opponent.rating.blitz} isDark={isDark} />
                  )}
                  {report.opponent.rating.bullet && (
                    <RatingBadge label="Bullet" value={report.opponent.rating.bullet} isDark={isDark} />
                  )}
                </div>
              </div>
            </div>

            {/* Win/Draw/Loss Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard
                title="Overall"
                icon={<BarChart3 className="w-4 h-4" />}
                isDark={isDark}
                stats={[
                  { label: "Win Rate", value: `${report.opponent.overall.winRate}%` },
                  { label: "W / D / L", value: `${report.opponent.overall.wins} / ${report.opponent.overall.draws} / ${report.opponent.overall.losses}` },
                ]}
              />
              <StatCard
                title="As White"
                icon={<CircleDot className="w-4 h-4" />}
                isDark={isDark}
                stats={[
                  { label: "Win Rate", value: `${report.opponent.asWhite.winRate}%` },
                  { label: "Games", value: `${report.opponent.asWhite.games}` },
                ]}
              />
              <StatCard
                title="As Black"
                icon={<CircleDot className="w-4 h-4 fill-current" />}
                isDark={isDark}
                stats={[
                  { label: "Win Rate", value: `${report.opponent.asBlack.winRate}%` },
                  { label: "Games", value: `${report.opponent.asBlack.games}` },
                ]}
              />
            </div>

            {/* Key Insights */}
            {report.insights.length > 0 && (
              <div className={`${cardClass} p-5`}>
                <div className="flex items-center gap-2 mb-4">
                  <Eye className={`w-4 h-4 ${accent}`} />
                  <h3 className={`font-semibold ${textPrimary}`}>Key Insights</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {report.insights.map((insight, i) => (
                    <div
                      key={i}
                      className={`flex items-start gap-2 p-3 rounded-lg ${
                        isDark ? "bg-[#0d1a0f]/60" : "bg-gray-50"
                      }`}
                    >
                      <ChevronRight className={`w-4 h-4 ${accent} mt-0.5 shrink-0`} />
                      <span className={`text-sm ${textPrimary}`}>{insight}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Opening Repertoire */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <OpeningTable
                title="White Repertoire"
                openings={report.opponent.whiteOpenings}
                isDark={isDark}
                firstMoves={report.opponent.firstMoveAsWhite}
              />
              <OpeningTable
                title="Black Repertoire"
                openings={report.opponent.blackOpenings}
                isDark={isDark}
              />
            </div>

            {/* Endgame Profile */}
            <div className={`${cardClass} p-5`}>
              <div className="flex items-center gap-2 mb-4">
                <Shield className={`w-4 h-4 ${accent}`} />
                <h3 className={`font-semibold ${textPrimary}`}>Endgame Profile</h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <EndgameStat label="Checkmates" value={report.opponent.endgameProfile.checkmates} total={report.opponent.endgameProfile.total} isDark={isDark} />
                <EndgameStat label="Resignations" value={report.opponent.endgameProfile.resignations} total={report.opponent.endgameProfile.total} isDark={isDark} />
                <EndgameStat label="Timeouts" value={report.opponent.endgameProfile.timeouts} total={report.opponent.endgameProfile.total} isDark={isDark} />
                <EndgameStat label="Draws" value={report.opponent.endgameProfile.draws} total={report.opponent.endgameProfile.total} isDark={isDark} />
                <EndgameStat label="Avg Length" value={report.opponent.avgGameLength} total={0} isDark={isDark} isMoves />
              </div>
            </div>

            {/* Suggested Prep Lines */}
            {report.prepLines.length > 0 && (
              <div className={`${cardClass} p-5`}>
                <div className="flex items-center gap-2 mb-4">
                  <BookOpen className={`w-4 h-4 ${accent}`} />
                  <h3 className={`font-semibold ${textPrimary}`}>Suggested Preparation Lines</h3>
                </div>
                <div className="space-y-3">
                  {report.prepLines.map((line, i) => (
                    <PrepLineCard key={i} line={line} isDark={isDark} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {!report && !loading && !error && (
          <div className={`${cardClass} p-12 flex flex-col items-center gap-4 text-center`}>
            <div className={`w-16 h-16 rounded-full flex items-center justify-center ${isDark ? "bg-[#1a2e1c]" : "bg-gray-100"}`}>
              <Target className={`w-8 h-8 ${accent}`} />
            </div>
            <div>
              <h3 className={`text-lg font-semibold ${textPrimary}`}>Prepare for your next match</h3>
              <p className={`text-sm ${textMuted} mt-2 max-w-md`}>
                Enter your opponent's chess.com username above to get a full analysis of their
                opening repertoire, play style tendencies, and strategic preparation lines.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function RatingBadge({ label, value, isDark }: { label: string; value: number; isDark: boolean }) {
  return (
    <div className={`px-3 py-1.5 rounded-lg text-center ${isDark ? "bg-[#0d1a0f] border border-[#3D6B47]/30" : "bg-gray-50 border border-gray-200"}`}>
      <div className="text-xs text-gray-400">{label}</div>
      <div className={`text-lg font-bold ${isDark ? "text-white" : "text-gray-900"}`}>{value}</div>
    </div>
  );
}

function StatCard({
  title,
  icon,
  isDark,
  stats,
}: {
  title: string;
  icon: React.ReactNode;
  isDark: boolean;
  stats: { label: string; value: string }[];
}) {
  return (
    <div className={`p-4 rounded-xl ${isDark ? "bg-[#1a2e1c]/80 border border-[#3D6B47]/30" : "bg-white border border-gray-200 shadow-sm"}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[#5B9A6A]">{icon}</span>
        <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>{title}</h3>
      </div>
      {stats.map((s, i) => (
        <div key={i} className="flex justify-between items-center py-1">
          <span className={`text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}>{s.label}</span>
          <span className={`text-sm font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>{s.value}</span>
        </div>
      ))}
    </div>
  );
}

function OpeningTable({
  title,
  openings,
  isDark,
  firstMoves,
}: {
  title: string;
  openings: OpeningStat[];
  isDark: boolean;
  firstMoves?: { move: string; count: number; pct: number }[];
}) {
  const textMuted = isDark ? "text-gray-400" : "text-gray-500";
  const textPrimary = isDark ? "text-white" : "text-gray-900";

  return (
    <div className={`p-5 rounded-xl ${isDark ? "bg-[#1a2e1c]/80 border border-[#3D6B47]/30" : "bg-white border border-gray-200 shadow-sm"}`}>
      <div className="flex items-center gap-2 mb-4">
        <BookOpen className="w-4 h-4 text-[#5B9A6A]" />
        <h3 className={`font-semibold ${textPrimary}`}>{title}</h3>
      </div>

      {firstMoves && firstMoves.length > 0 && (
        <div className="mb-4">
          <p className={`text-xs ${textMuted} mb-2`}>First Move Preference</p>
          <div className="flex gap-2 flex-wrap">
            {firstMoves.slice(0, 3).map((fm) => (
              <span
                key={fm.move}
                className={`px-2 py-1 rounded text-xs font-mono ${
                  isDark ? "bg-[#0d1a0f] text-[#5B9A6A] border border-[#3D6B47]/30" : "bg-green-50 text-green-700 border border-green-200"
                }`}
              >
                1.{fm.move} ({fm.pct}%)
              </span>
            ))}
          </div>
        </div>
      )}

      {openings.length === 0 ? (
        <p className={`text-sm ${textMuted}`}>No opening data available</p>
      ) : (
        <div className="space-y-2">
          {openings.slice(0, 6).map((op) => (
            <div
              key={op.name}
              className={`p-2.5 rounded-lg ${isDark ? "bg-[#0d1a0f]/60" : "bg-gray-50"}`}
            >
              <div className="flex justify-between items-start mb-1">
                <div className="flex-1 min-w-0">
                  <span className={`text-sm font-medium ${textPrimary} block truncate`}>{op.name}</span>
                  <span className={`text-xs font-mono ${textMuted}`}>{op.eco}</span>
                </div>
                <span className={`text-sm font-bold ${
                  op.winRate >= 60 ? "text-green-500" : op.winRate >= 40 ? "text-amber-500" : "text-red-400"
                }`}>
                  {op.winRate}%
                </span>
              </div>
              <div className="flex items-center gap-3 mt-1">
                <span className={`text-xs ${textMuted}`}>{op.count} games</span>
                <div className="flex-1 h-1.5 rounded-full bg-gray-700/30 overflow-hidden">
                  <div className="h-full flex">
                    <div className="bg-green-500 h-full" style={{ width: `${(op.wins / op.count) * 100}%` }} />
                    <div className="bg-gray-400 h-full" style={{ width: `${(op.draws / op.count) * 100}%` }} />
                    <div className="bg-red-400 h-full" style={{ width: `${(op.losses / op.count) * 100}%` }} />
                  </div>
                </div>
                <span className={`text-xs ${textMuted}`}>
                  {op.wins}W {op.draws}D {op.losses}L
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EndgameStat({
  label,
  value,
  total,
  isDark,
  isMoves,
}: {
  label: string;
  value: number;
  total: number;
  isDark: boolean;
  isMoves?: boolean;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className={`p-3 rounded-lg text-center ${isDark ? "bg-[#0d1a0f]/60" : "bg-gray-50"}`}>
      <div className={`text-2xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
        {isMoves ? value : pct}
        {!isMoves && <span className="text-sm text-gray-400">%</span>}
      </div>
      <div className={`text-xs mt-1 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
        {label}
        {isMoves && <span className="block text-[10px]">moves avg</span>}
      </div>
    </div>
  );
}

function PrepLineCard({ line, isDark }: { line: PrepLine; isDark: boolean }) {
  const confidenceColor =
    line.confidence === "high"
      ? "bg-green-500/20 text-green-400 border-green-500/30"
      : line.confidence === "medium"
      ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
      : "bg-gray-500/20 text-gray-400 border-gray-500/30";

  return (
    <div className={`p-4 rounded-lg ${isDark ? "bg-[#0d1a0f]/60 border border-[#3D6B47]/20" : "bg-gray-50 border border-gray-200"}`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-[#5B9A6A] shrink-0" />
          <h4 className={`font-semibold text-sm ${isDark ? "text-white" : "text-gray-900"}`}>
            {line.name}
          </h4>
          {line.eco !== "---" && (
            <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${isDark ? "bg-[#1a2e1c] text-gray-400" : "bg-gray-200 text-gray-600"}`}>
              {line.eco}
            </span>
          )}
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full border ${confidenceColor}`}>
          {line.confidence}
        </span>
      </div>
      {line.eco !== "---" && (
        <div className={`font-mono text-xs px-3 py-2 rounded mb-2 ${isDark ? "bg-[#1a2e1c] text-[#5B9A6A]" : "bg-green-50 text-green-700"}`}>
          {line.moves}
        </div>
      )}
      <p className={`text-sm ${isDark ? "text-gray-300" : "text-gray-600"}`}>
        {line.rationale}
      </p>
    </div>
  );
}
