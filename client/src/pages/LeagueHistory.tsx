import { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "wouter";
import {
  Trophy, Crown, ArrowLeft, ChevronDown, ChevronUp,
  Swords, TrendingUp, Users, BarChart3, Target, Shield
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
        // Default H2H player to champion or first standing
        if (d.standings?.length) {
          setH2hPlayer(d.standings[0].playerId);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [leagueId]);

  // Build H2H table for selected player
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
      {/* Header */}
      <div className="bg-gradient-to-b from-[#1a2e1c] to-[#0d1a0f] text-white">
        <div className="max-w-4xl mx-auto px-4 pt-6 pb-8">
          <Link href={`/leagues/${leagueId}`}>
            <button className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white mb-4 transition-colors">
              <ArrowLeft className="w-4 h-4" /> Back to League
            </button>
          </Link>

          <div className="flex items-center gap-2 mb-1">
            <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
              isCompleted ? "bg-amber-500/20 text-amber-400" : "bg-green-500/20 text-green-400"
            }`}>
              {isCompleted ? "Season Complete" : "In Progress"}
            </span>
            <span className="text-xs text-gray-500">{league.formatType.replace("_", " ")}</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold mb-1">{league.name}</h1>
          {league.description && (
            <p className="text-sm text-gray-400 mb-4">{league.description}</p>
          )}

          <div className="flex gap-4 text-sm text-gray-400">
            <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {league.maxPlayers} players</span>
            <span className="flex items-center gap-1"><Swords className="w-3.5 h-3.5" /> {league.totalWeeks} rounds</span>
            <span className="flex items-center gap-1"><BarChart3 className="w-3.5 h-3.5" /> {seasonStats.totalMatches} matches</span>
          </div>
        </div>
      </div>

      {/* Champion Banner */}
      {champion && isCompleted && (
        <div className="max-w-4xl mx-auto px-4 -mt-4 mb-6">
          <div className="bg-gradient-to-r from-amber-500/10 via-yellow-500/10 to-amber-500/10 border border-amber-500/30 rounded-2xl p-5 flex items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center text-2xl font-bold text-white shadow-lg">
                {champion.avatarUrl ? (
                  <img src={champion.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                ) : (
                  champion.displayName.charAt(0).toUpperCase()
                )}
              </div>
              <Crown className="w-6 h-6 text-amber-400 absolute -top-2 -right-1 drop-shadow" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">League Champion</span>
                <Trophy className="w-4 h-4 text-amber-400" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">{champion.displayName}</h3>
              <div className="flex gap-3 text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                <span>{champion.points} pts</span>
                <span>{champion.wins}W-{champion.draws}D-{champion.losses}L</span>
                {champion.chesscomRating && (
                  <span className="text-green-500">{champion.chesscomRating} ELO</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="max-w-4xl mx-auto px-4">
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

        {/* ── Standings Tab ──────────────────────────────────────────────────── */}
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
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  i === 0 ? "bg-amber-500 text-white" : i === 1 ? "bg-gray-400 text-white" : i === 2 ? "bg-amber-700 text-white" : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                }`}>
                  {s.rank}
                </div>

                <div className="w-10 h-10 rounded-full bg-[#3D6B47]/20 flex items-center justify-center text-sm font-bold text-[#3D6B47] overflow-hidden">
                  {s.avatarUrl ? (
                    <img src={s.avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    s.displayName.charAt(0).toUpperCase()
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold truncate">{s.displayName}</span>
                    {i === 0 && isCompleted && <Crown className="w-4 h-4 text-amber-400 flex-shrink-0" />}
                  </div>
                  <div className="flex gap-2 text-xs text-gray-500">
                    <span>{s.gamesPlayed} games</span>
                    {s.chesscomRating && <span className="text-green-500">{s.chesscomRating} ELO</span>}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-lg font-bold text-[#3D6B47]">{s.points}</div>
                  <div className="text-xs text-gray-500">{s.wins}W-{s.draws}D-{s.losses}L</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Rounds Tab ─────────────────────────────────────────────────────── */}
        {tab === "weeks" && (
          <div className="space-y-3 mb-8">
            {weeks.map((w) => (
              <div key={w.weekNumber} className="bg-gray-50 dark:bg-[#162118] rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                <button
                  onClick={() => setExpandedWeek(expandedWeek === w.weekNumber ? null : w.weekNumber)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-100 dark:hover:bg-[#1e3322] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">Round {w.weekNumber}</span>
                    <span className={`px-2 py-0.5 text-xs rounded-full ${
                      w.isComplete ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"
                    }`}>
                      {w.isComplete ? "Complete" : "In Progress"}
                    </span>
                  </div>
                  {expandedWeek === w.weekNumber ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {expandedWeek === w.weekNumber && (
                  <div className="px-4 pb-4 space-y-2">
                    {w.matches.map((m) => (
                      <div key={m.id} className="flex items-center gap-2 p-3 bg-white dark:bg-[#0d1a0f] rounded-lg">
                        <div className="flex-1 text-right">
                          <span className={`text-sm font-medium ${m.result === "white_win" ? "text-[#3D6B47] font-bold" : ""}`}>
                            {m.whiteName}
                          </span>
                          <div className="flex items-center justify-end gap-1 mt-0.5">
                            <div className="w-3 h-3 rounded-full bg-white border border-gray-300" />
                            <span className="text-[10px] text-gray-400">White</span>
                          </div>
                        </div>

                        <div className={`px-3 py-1.5 rounded-lg text-sm font-bold min-w-[50px] text-center ${
                          m.resultStatus === "completed"
                            ? "bg-[#3D6B47]/10 text-[#3D6B47]"
                            : "bg-gray-200 dark:bg-gray-700 text-gray-500"
                        }`}>
                          {resultLabel(m.result)}
                        </div>

                        <div className="flex-1">
                          <span className={`text-sm font-medium ${m.result === "black_win" ? "text-[#3D6B47] font-bold" : ""}`}>
                            {m.blackName}
                          </span>
                          <div className="flex items-center gap-1 mt-0.5">
                            <div className="w-3 h-3 rounded-full bg-gray-800 dark:bg-gray-200 border border-gray-400" />
                            <span className="text-[10px] text-gray-400">Black</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── Head-to-Head Tab ────────────────────────────────────────────────── */}
        {tab === "h2h" && (
          <div className="mb-8">
            {/* Player selector */}
            <div className="mb-4">
              <label className="text-sm text-gray-500 mb-2 block">Select a player to view their head-to-head records:</label>
              <select
                value={h2hPlayer ?? ""}
                onChange={(e) => setH2hPlayer(e.target.value)}
                className="w-full sm:w-auto px-4 py-2.5 bg-gray-50 dark:bg-[#162118] border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#3D6B47]/50"
              >
                {standings.map((s) => (
                  <option key={s.playerId} value={s.playerId}>
                    #{s.rank} {s.displayName} ({s.points} pts)
                  </option>
                ))}
              </select>
            </div>

            {h2hRows.length > 0 ? (
              <div className="space-y-2">
                {h2hRows.map((row) => (
                  <div key={row.opponentId} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-[#162118] rounded-xl">
                    <div className="w-9 h-9 rounded-full bg-[#3D6B47]/20 flex items-center justify-center text-sm font-bold text-[#3D6B47] overflow-hidden">
                      {row.opponentAvatar ? (
                        <img src={row.opponentAvatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        row.opponentName.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium truncate block">{row.opponentName}</span>
                      <span className="text-xs text-gray-500">{row.total} game{row.total !== 1 ? "s" : ""}</span>
                    </div>
                    <div className="flex gap-2 text-sm">
                      <span className="px-2 py-1 bg-green-500/10 text-green-500 rounded-md font-semibold">{row.wins}W</span>
                      <span className="px-2 py-1 bg-gray-500/10 text-gray-400 rounded-md font-semibold">{row.draws}D</span>
                      <span className="px-2 py-1 bg-red-500/10 text-red-400 rounded-md font-semibold">{row.losses}L</span>
                    </div>
                    <div className="text-right min-w-[40px]">
                      <div className="text-sm font-bold text-[#3D6B47]">{row.score}/{row.total}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Shield className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No completed matches yet for this player.</p>
              </div>
            )}
          </div>
        )}

        {/* ── Stats Tab ──────────────────────────────────────────────────────── */}
        {tab === "stats" && (
          <div className="mb-8 space-y-6">
            {/* Result Distribution */}
            <div className="bg-gray-50 dark:bg-[#162118] rounded-2xl p-5">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#3D6B47]" /> Result Distribution
              </h3>

              <div className="flex gap-4 mb-4">
                <div className="flex-1 text-center">
                  <div className="text-2xl font-bold text-white">{seasonStats.whiteWins}</div>
                  <div className="text-xs text-gray-500">White Wins</div>
                  <div className="text-sm font-semibold text-gray-400">{seasonStats.whiteWinPct}%</div>
                </div>
                <div className="flex-1 text-center">
                  <div className="text-2xl font-bold text-gray-400">{seasonStats.draws}</div>
                  <div className="text-xs text-gray-500">Draws</div>
                  <div className="text-sm font-semibold text-gray-400">{seasonStats.drawPct}%</div>
                </div>
                <div className="flex-1 text-center">
                  <div className="text-2xl font-bold text-gray-800 dark:text-gray-200">{seasonStats.blackWins}</div>
                  <div className="text-xs text-gray-500">Black Wins</div>
                  <div className="text-sm font-semibold text-gray-400">{seasonStats.blackWinPct}%</div>
                </div>
              </div>

              {/* Visual bar */}
              <div className="flex h-4 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700">
                {seasonStats.whiteWinPct > 0 && (
                  <div className="bg-white border border-gray-300" style={{ width: `${seasonStats.whiteWinPct}%` }} />
                )}
                {seasonStats.drawPct > 0 && (
                  <div className="bg-gray-400" style={{ width: `${seasonStats.drawPct}%` }} />
                )}
                {seasonStats.blackWinPct > 0 && (
                  <div className="bg-gray-800 dark:bg-gray-200" style={{ width: `${seasonStats.blackWinPct}%` }} />
                )}
              </div>
            </div>

            {/* Top Performers */}
            <div className="bg-gray-50 dark:bg-[#162118] rounded-2xl p-5">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#3D6B47]" /> Top Performers
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Most Wins */}
                {standings.length > 0 && (() => {
                  const topWinner = [...standings].sort((a, b) => b.wins - a.wins)[0];
                  return (
                    <div className="bg-white dark:bg-[#0d1a0f] rounded-xl p-3 text-center">
                      <div className="text-xs text-gray-500 mb-1">Most Wins</div>
                      <div className="font-bold">{topWinner.displayName}</div>
                      <div className="text-lg font-bold text-green-500">{topWinner.wins}</div>
                    </div>
                  );
                })()}

                {/* Most Draws */}
                {standings.length > 0 && (() => {
                  const topDrawer = [...standings].sort((a, b) => b.draws - a.draws)[0];
                  return (
                    <div className="bg-white dark:bg-[#0d1a0f] rounded-xl p-3 text-center">
                      <div className="text-xs text-gray-500 mb-1">Most Draws</div>
                      <div className="font-bold">{topDrawer.displayName}</div>
                      <div className="text-lg font-bold text-gray-400">{topDrawer.draws}</div>
                    </div>
                  );
                })()}

                {/* Highest Win Rate */}
                {standings.length > 0 && (() => {
                  const topRate = [...standings]
                    .filter((s) => s.gamesPlayed > 0)
                    .sort((a, b) => (b.wins / b.gamesPlayed) - (a.wins / a.gamesPlayed))[0];
                  if (!topRate) return null;
                  const pct = Math.round((topRate.wins / topRate.gamesPlayed) * 100);
                  return (
                    <div className="bg-white dark:bg-[#0d1a0f] rounded-xl p-3 text-center">
                      <div className="text-xs text-gray-500 mb-1">Highest Win Rate</div>
                      <div className="font-bold">{topRate.displayName}</div>
                      <div className="text-lg font-bold text-[#3D6B47]">{pct}%</div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Season Summary */}
            <div className="bg-gray-50 dark:bg-[#162118] rounded-2xl p-5">
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
    </div>
  );
}
