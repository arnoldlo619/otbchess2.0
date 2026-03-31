import { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "wouter";
import {
  Trophy, Crown, ArrowLeft, ChevronDown, ChevronUp,
  Swords, TrendingUp, Users, BarChart3, Target, Shield, ExternalLink
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────
interface SeasonHistory {
  league: {
    id: string;
    name: string;
    description: string | null;
    status: string;
    clubId: string;
    formatType: string;
    maxPlayers: number;
    totalWeeks: number;
    createdAt: string;
  };
  champion: {
    playerId: string;
    displayName: string;
    avatarUrl: string | null;
    points: number;
    wins: number;
    losses: number;
    draws: number;
    chesscomUsername: string | null;
    chesscomRating: number | null;
  } | null;
  standings: Array<{
    playerId: string;
    displayName: string;
    avatarUrl: string | null;
    wins: number;
    losses: number;
    draws: number;
    points: number;
    rank: number;
    streak: string;
    movement: string;
    lastResults: string;
    chesscomUsername: string | null;
    chesscomRating: number | null;
    gamesPlayed: number;
  }>;
  weeks: Array<{
    weekNumber: number;
    isComplete: number;
    deadline: string | null;
    matches: Array<{
      id: number;
      whiteName: string;
      whiteId: string;
      blackName: string;
      blackId: string;
      result: string | null;
      resultStatus: string;
      completedAt: string | null;
    }>;
  }>;
  headToHead: Record<string, Record<string, { wins: number; draws: number; losses: number }>>;
  seasonStats: {
    totalMatches: number;
    whiteWins: number;
    blackWins: number;
    draws: number;
    whiteWinPct: number;
    blackWinPct: number;
    drawPct: number;
  };
}

type Tab = "standings" | "weeks" | "h2h" | "stats";

// ── Component ────────────────────────────────────────────────────────────────
export default function LeagueHistory() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const [data, setData] = useState<SeasonHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("standings");
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null);
  const [h2hPlayer, setH2hPlayer] = useState<string | null>(null);

  useEffect(() => {
    if (!leagueId) return;
    setLoading(true);
    fetch(`/api/leagues/${leagueId}/history`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load history");
        return r.json();
      })
      .then((d) => {
        setData(d);
        setError(null);
        if (d.standings?.length) setH2hPlayer(d.standings[0].playerId);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [leagueId]);

  const h2hRows = useMemo(() => {
    if (!data || !h2hPlayer || !data.headToHead[h2hPlayer]) return [];
    const records = data.headToHead[h2hPlayer];
    return Object.entries(records).map(([opponentId, record]) => {
      const opponent = data.standings.find((s) => s.playerId === opponentId);
      return {
        opponentId,
        opponentName: opponent?.displayName ?? "Unknown",
        opponentAvatar: opponent?.avatarUrl,
        ...record,
        total: record.wins + record.draws + record.losses,
        score: record.wins + record.draws * 0.5,
      };
    }).sort((a, b) => b.score - a.score);
  }, [data, h2hPlayer]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#0d1a0f]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-[#3D6B47] border-t-transparent animate-spin" />
          <span className="text-sm text-gray-400">Loading season history…</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#0d1a0f]">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error ?? "No data available"}</p>
          <Link href={`/leagues/${leagueId}`}>
            <button className="px-4 py-2 bg-[#3D6B47] text-white rounded-lg">Back to League</button>
          </Link>
        </div>
      </div>
    );
  }

  const { league, champion, standings, weeks, seasonStats } = data;
  const isCompleted = league.status === "completed";

  const resultLabel = (r: string | null) => {
    if (r === "white_win") return "1-0";
    if (r === "black_win") return "0-1";
    if (r === "draw") return "½-½";
    return "—";
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "standings", label: "Standings", icon: <Trophy className="w-4 h-4" /> },
    { id: "weeks", label: "Rounds", icon: <Swords className="w-4 h-4" /> },
    { id: "h2h", label: "Head-to-Head", icon: <Target className="w-4 h-4" /> },
    { id: "stats", label: "Stats", icon: <BarChart3 className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-[#0d1a0f] text-gray-900 dark:text-gray-100">

      {/* ── Hero Banner ─────────────────────────────────────────────────────── */}
      <div className="relative h-44 sm:h-52 overflow-hidden bg-[#0d1a0f]">
        {/* Micro-grid chess pattern */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `
              linear-gradient(rgba(61,107,71,0.4) 1px, transparent 1px),
              linear-gradient(90deg, rgba(61,107,71,0.4) 1px, transparent 1px)
            `,
            backgroundSize: "32px 32px",
          }}
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0d1a0f]/30 via-transparent to-[#0d1a0f]" />
        {/* Back button */}
        <div className="absolute top-4 left-4">
          <Link href={`/leagues/${leagueId}`}>
            <button className="flex items-center gap-1.5 text-sm text-gray-300 hover:text-white bg-black/30 backdrop-blur-sm px-3 py-1.5 rounded-lg transition-colors">
              <ArrowLeft className="w-4 h-4" /> Back to League
            </button>
          </Link>
        </div>
        {/* Season badge */}
        <div className="absolute top-4 right-4">
          <span className={`px-2.5 py-1 text-xs font-semibold rounded-full backdrop-blur-sm ${
            isCompleted
              ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
              : "bg-green-500/20 text-green-300 border border-green-500/30"
          }`}>
            {isCompleted ? "Season Complete" : "In Progress"}
          </span>
        </div>
      </div>

      {/* ── Floating Identity Card ───────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4">
        <div className="relative -mt-10 mb-6 bg-white dark:bg-[#162118] border border-gray-200 dark:border-[#2a3d2e] rounded-2xl shadow-xl p-5">
          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
            {/* Icon */}
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#3D6B47] to-[#2a4d33] flex items-center justify-center flex-shrink-0 shadow-lg">
              <Trophy className="w-7 h-7 text-white" />
            </div>
            {/* Name + meta */}
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold truncate">{league.name}</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {league.formatType.replace(/_/g, " ")}
                {league.description && ` · ${league.description}`}
              </p>
            </div>
          </div>

          {/* 4-stat row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 pt-4 border-t border-gray-100 dark:border-[#2a3d2e]">
            {[
              { label: "Players", value: league.maxPlayers, icon: <Users className="w-4 h-4" /> },
              { label: "Rounds", value: league.totalWeeks, icon: <Swords className="w-4 h-4" /> },
              { label: "Total Matches", value: seasonStats.totalMatches, icon: <Shield className="w-4 h-4" /> },
              { label: "Champion", value: champion?.displayName ?? "TBD", icon: <Crown className="w-4 h-4" /> },
            ].map((stat) => (
              <div key={stat.label} className="flex flex-col gap-0.5">
                <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  {stat.icon} {stat.label}
                </span>
                <span className="text-base font-bold truncate">{stat.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Two-column layout ─────────────────────────────────────────────── */}
        <div className="flex gap-6 items-start pb-12">

          {/* ── Main content ──────────────────────────────────────────────── */}
          <div className="flex-1 min-w-0">
            {/* Tab bar */}
            <div className="flex gap-1 bg-gray-100 dark:bg-[#162118] rounded-xl p-1 mb-6">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium rounded-lg transition-all ${
                    tab === t.id
                      ? "bg-white dark:bg-[#1e3322] text-[#3D6B47] shadow-sm"
                      : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  }`}
                >
                  {t.icon}
                  <span className="hidden sm:inline">{t.label}</span>
                </button>
              ))}
            </div>

            {/* ── Standings Tab ─────────────────────────────────────────── */}
            {tab === "standings" && (
              <div className="space-y-2 mb-8">
                {standings.map((s, i) => (
                  <div
                    key={s.playerId}
                    className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                      i === 0 && isCompleted
                        ? "bg-amber-500/5 border border-amber-500/20"
                        : "bg-gray-50 dark:bg-[#162118] border border-transparent"
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                      i === 0 ? "bg-amber-500 text-white" : i === 1 ? "bg-gray-400 text-white" : i === 2 ? "bg-amber-700 text-white" : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                    }`}>
                      {i === 0 && isCompleted ? <Crown className="w-4 h-4" /> : s.rank}
                    </div>
                    <div className="w-9 h-9 rounded-full bg-[#3D6B47]/20 flex items-center justify-center text-sm font-bold flex-shrink-0">
                      {s.avatarUrl
                        ? <img src={s.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                        : s.displayName.charAt(0).toUpperCase()
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold truncate">{s.displayName}</span>
                        {i === 0 && isCompleted && <Crown className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />}
                      </div>
                      <div className="flex gap-2 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        <span>{s.wins}W-{s.draws}D-{s.losses}L</span>
                        {s.chesscomRating && <span className="text-green-500">{s.chesscomRating}</span>}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-lg font-bold text-[#3D6B47]">{s.points}</div>
                      <div className="text-xs text-gray-400">pts</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Rounds Tab ────────────────────────────────────────────── */}
            {tab === "weeks" && (
              <div className="space-y-3 mb-8">
                {weeks.map((w) => (
                  <div key={w.weekNumber} className="bg-gray-50 dark:bg-[#162118] rounded-xl overflow-hidden border border-gray-100 dark:border-[#2a3d2e]">
                    <button
                      className="w-full flex items-center justify-between p-4 hover:bg-gray-100 dark:hover:bg-[#1e3322] transition-colors"
                      onClick={() => setExpandedWeek(expandedWeek === w.weekNumber ? null : w.weekNumber)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${w.isComplete ? "bg-green-400" : "bg-amber-400"}`} />
                        <span className="font-semibold">Round {w.weekNumber}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {w.matches.filter((m) => m.result).length}/{w.matches.length} complete
                        </span>
                      </div>
                      {expandedWeek === w.weekNumber
                        ? <ChevronUp className="w-4 h-4 text-gray-400" />
                        : <ChevronDown className="w-4 h-4 text-gray-400" />
                      }
                    </button>
                    {expandedWeek === w.weekNumber && (
                      <div className="border-t border-gray-100 dark:border-[#2a3d2e] divide-y divide-gray-100 dark:divide-[#2a3d2e]">
                        {w.matches.map((m) => (
                          <div key={m.id} className="flex items-center justify-between px-4 py-3 text-sm">
                            <span className="flex-1 truncate text-right pr-3">{m.whiteName}</span>
                            <span className={`px-2.5 py-0.5 rounded-md font-mono text-xs font-bold flex-shrink-0 ${
                              m.result
                                ? "bg-[#3D6B47]/10 text-[#3D6B47]"
                                : "bg-gray-100 dark:bg-gray-700 text-gray-400"
                            }`}>
                              {resultLabel(m.result)}
                            </span>
                            <span className="flex-1 truncate pl-3">{m.blackName}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* ── Head-to-Head Tab ──────────────────────────────────────── */}
            {tab === "h2h" && (
              <div className="mb-8">
                <div className="mb-4">
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                    Select Player
                  </label>
                  <select
                    value={h2hPlayer ?? ""}
                    onChange={(e) => setH2hPlayer(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-[#162118] border border-gray-200 dark:border-[#2a3d2e] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#3D6B47]/50"
                  >
                    {standings.map((s) => (
                      <option key={s.playerId} value={s.playerId}>{s.displayName}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  {h2hRows.length === 0 ? (
                    <p className="text-center text-gray-400 py-8">No head-to-head records yet</p>
                  ) : (
                    h2hRows.map((row) => (
                      <div key={row.opponentId} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-[#162118] rounded-xl border border-gray-100 dark:border-[#2a3d2e]">
                        <div className="w-9 h-9 rounded-full bg-[#3D6B47]/20 flex items-center justify-center text-sm font-bold flex-shrink-0">
                          {row.opponentAvatar
                            ? <img src={row.opponentAvatar} alt="" className="w-full h-full rounded-full object-cover" />
                            : row.opponentName.charAt(0).toUpperCase()
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="font-semibold truncate block">{row.opponentName}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">{row.total} games</span>
                        </div>
                        <div className="flex gap-1.5 text-xs font-semibold flex-shrink-0">
                          <span className="px-2 py-0.5 bg-green-500/10 text-green-500 rounded">{row.wins}W</span>
                          <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-500 rounded">{row.draws}D</span>
                          <span className="px-2 py-0.5 bg-red-500/10 text-red-400 rounded">{row.losses}L</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* ── Stats Tab ─────────────────────────────────────────────── */}
            {tab === "stats" && (
              <div className="space-y-4 mb-8">
                {/* Result distribution */}
                <div className="bg-gray-50 dark:bg-[#162118] rounded-xl p-4 border border-gray-100 dark:border-[#2a3d2e]">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-[#3D6B47]" /> Result Distribution
                  </h3>
                  <div className="space-y-2.5">
                    {[
                      { label: "White Wins", pct: seasonStats.whiteWinPct, count: seasonStats.whiteWins, color: "bg-white border border-gray-300" },
                      { label: "Black Wins", pct: seasonStats.blackWinPct, count: seasonStats.blackWins, color: "bg-gray-800" },
                      { label: "Draws", pct: seasonStats.drawPct, count: seasonStats.draws, color: "bg-[#3D6B47]" },
                    ].map((row) => (
                      <div key={row.label}>
                        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                          <span>{row.label}</span>
                          <span>{row.count} ({row.pct.toFixed(1)}%)</span>
                        </div>
                        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${row.color}`}
                            style={{ width: `${row.pct}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Top performers */}
                <div className="bg-gray-50 dark:bg-[#162118] rounded-xl p-4 border border-gray-100 dark:border-[#2a3d2e]">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-[#3D6B47]" /> Top Performers
                  </h3>
                  <div className="space-y-2">
                    {standings.slice(0, 3).map((s, i) => (
                      <div key={s.playerId} className="flex items-center gap-3">
                        <span className="text-xs font-bold text-gray-400 w-4">#{i + 1}</span>
                        <div className="w-7 h-7 rounded-full bg-[#3D6B47]/20 flex items-center justify-center text-xs font-bold">
                          {s.avatarUrl
                            ? <img src={s.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                            : s.displayName.charAt(0).toUpperCase()
                          }
                        </div>
                        <span className="flex-1 text-sm font-medium truncate">{s.displayName}</span>
                        <span className="text-sm font-bold text-[#3D6B47]">{s.points} pts</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Season summary */}
                <div className="bg-gray-50 dark:bg-[#162118] rounded-xl p-4 border border-gray-100 dark:border-[#2a3d2e]">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Swords className="w-4 h-4 text-[#3D6B47]" /> Season Summary
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Format</span>
                      <span className="font-medium">{league.formatType.replace("_", " ")}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Players</span>
                      <span className="font-medium">{league.maxPlayers}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Rounds</span>
                      <span className="font-medium">{league.totalWeeks}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Total Matches</span>
                      <span className="font-medium">{seasonStats.totalMatches}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Sidebar ───────────────────────────────────────────────────── */}
          <aside className="hidden lg:flex flex-col gap-4 w-72 flex-shrink-0">

            {/* Champion card */}
            {champion && isCompleted && (
              <div className="bg-gradient-to-br from-amber-500/10 via-yellow-500/5 to-amber-500/10 border border-amber-500/30 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Crown className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">Season Champion</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center text-xl font-bold text-white shadow-lg overflow-hidden">
                      {champion.avatarUrl
                        ? <img src={champion.avatarUrl} alt="" className="w-full h-full object-cover" />
                        : champion.displayName.charAt(0).toUpperCase()
                      }
                    </div>
                    <Crown className="w-5 h-5 text-amber-400 absolute -top-2 -right-1 drop-shadow" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 dark:text-white">{champion.displayName}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{champion.points} pts · {champion.wins}W-{champion.draws}D-{champion.losses}L</p>
                    {champion.chesscomRating && (
                      <p className="text-xs text-green-500 font-medium mt-0.5">{champion.chesscomRating} ELO</p>
                    )}
                  </div>
                </div>
                {champion.chesscomUsername && (
                  <a
                    href={`https://chess.com/member/${champion.chesscomUsername}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 flex items-center gap-1.5 text-xs text-[#3D6B47] hover:text-[#4a8057] transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" /> View on chess.com
                  </a>
                )}
              </div>
            )}

            {/* Final Standings mini-table */}
            <div className="bg-white dark:bg-[#162118] border border-gray-200 dark:border-[#2a3d2e] rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="w-4 h-4 text-[#3D6B47]" />
                <span className="text-sm font-semibold">Final Standings</span>
              </div>
              <div className="space-y-2">
                {standings.slice(0, 8).map((s, i) => (
                  <div key={s.playerId} className="flex items-center gap-2 text-sm">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      i === 0 ? "bg-amber-500 text-white" : i === 1 ? "bg-gray-400 text-white" : i === 2 ? "bg-amber-700 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-500"
                    }`}>
                      {s.rank}
                    </span>
                    <span className="flex-1 truncate text-gray-700 dark:text-gray-300">{s.displayName}</span>
                    <span className="font-bold text-[#3D6B47] flex-shrink-0">{s.points}</span>
                  </div>
                ))}
                {standings.length > 8 && (
                  <button
                    onClick={() => setTab("standings")}
                    className="w-full text-xs text-[#3D6B47] hover:text-[#4a8057] pt-1 transition-colors"
                  >
                    View all {standings.length} players →
                  </button>
                )}
              </div>
            </div>

            {/* Season quick stats */}
            <div className="bg-white dark:bg-[#162118] border border-gray-200 dark:border-[#2a3d2e] rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="w-4 h-4 text-[#3D6B47]" />
                <span className="text-sm font-semibold">Season Stats</span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Total Matches</span>
                  <span className="font-semibold">{seasonStats.totalMatches}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">White Wins</span>
                  <span className="font-semibold">{seasonStats.whiteWinPct.toFixed(0)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Black Wins</span>
                  <span className="font-semibold">{seasonStats.blackWinPct.toFixed(0)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Draws</span>
                  <span className="font-semibold">{seasonStats.drawPct.toFixed(0)}%</span>
                </div>
              </div>
            </div>

            {/* Back to league */}
            <Link href={`/leagues/${leagueId}`}>
              <button className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-[#3D6B47] hover:bg-[#4a8057] text-white text-sm font-medium rounded-xl transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back to League Dashboard
              </button>
            </Link>
          </aside>

        </div>
      </div>
    </div>
  );
}
