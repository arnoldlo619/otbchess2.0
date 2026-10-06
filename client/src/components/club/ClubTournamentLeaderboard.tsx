import { Info, RefreshCw, Trophy, Users } from "lucide-react";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import type { ClubTournamentLeaderboard as ClubTournamentLeaderboardData } from "@/lib/clubsApi";

interface ClubTournamentLeaderboardProps {
  leaderboard: ClubTournamentLeaderboardData | null;
  loading: boolean;
  isDark: boolean;
  accent: string;
  viewerHasChesscomUsername: boolean;
  canReconcile: boolean;
  reconciling: boolean;
  onReconcile: () => void;
}

function formatPoints(value: number): string {
  return `${Number.isInteger(value) ? value : value.toFixed(1)} ${value === 1 ? "point" : "points"}`;
}

export function ClubTournamentLeaderboard({
  leaderboard,
  loading,
  isDark,
  accent,
  viewerHasChesscomUsername,
  canReconcile,
  reconciling,
  onReconcile,
}: ClubTournamentLeaderboardProps) {
  const entries = leaderboard?.entries ?? [];
  const muted = isDark ? "rgba(255,255,255,0.52)" : "rgba(21,41,28,0.58)";
  const soft = isDark ? "rgba(255,255,255,0.08)" : "rgba(21,41,28,0.10)";
  const foreground = isDark ? "rgba(255,255,255,0.94)" : "#15291c";

  return (
    <section className="space-y-4" aria-labelledby="club-tournament-rankings-title">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4" style={{ color: accent }} aria-hidden="true" />
            <p className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: muted }}>Club rankings</p>
          </div>
          <h2 id="club-tournament-rankings-title" className="mt-1 text-xl font-bold sm:text-2xl" style={{ color: foreground }}>Tournament Leaderboard</h2>
          <p className="mt-1 text-sm leading-6" style={{ color: muted }}>Tournament points from completed Club events.</p>
        </div>
        {canReconcile && (
          <button
            type="button"
            onClick={onReconcile}
            disabled={reconciling}
            className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-xl border px-3.5 text-sm font-semibold transition-colors disabled:cursor-wait disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-[#4CAF50] sm:self-auto"
            style={{ borderColor: soft, color: foreground }}
          >
            <RefreshCw className={`h-4 w-4 ${reconciling ? "animate-spin" : ""}`} aria-hidden="true" />
            {reconciling ? "Refreshing results" : "Refresh results"}
          </button>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-3" aria-label="Leaderboard summary">
        {[
          { label: "Players ranked", value: leaderboard?.playersRankedCount ?? 0, icon: Users },
          { label: "Completed tournaments", value: leaderboard?.completedTournamentsCount ?? 0, icon: Trophy },
          { label: "Scoring", value: "1 win = 1 point", icon: Info },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="flex min-h-16 items-center gap-3 rounded-2xl border px-4 py-3" style={{ borderColor: soft, background: isDark ? "rgba(255,255,255,0.025)" : "rgba(255,255,255,0.56)" }}>
            <Icon className="h-4 w-4 shrink-0" style={{ color: accent }} aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.13em]" style={{ color: muted }}>{label}</p>
              <p className="mt-0.5 truncate text-sm font-bold" style={{ color: foreground }}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2" aria-label="Loading tournament leaderboard">
          {[0, 1, 2].map((index) => <div key={index} className="h-[68px] animate-pulse rounded-2xl" style={{ background: isDark ? "rgba(255,255,255,0.06)" : "rgba(21,41,28,0.07)" }} />)}
        </div>
      ) : entries.length === 0 ? (
        <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed px-6 text-center" style={{ borderColor: soft, background: isDark ? "rgba(255,255,255,0.018)" : "rgba(255,255,255,0.46)" }}>
          <Trophy className="h-8 w-8" style={{ color: accent }} aria-hidden="true" />
          <h3 className="mt-3 text-base font-bold" style={{ color: foreground }}>No tournament points yet</h3>
          <p className="mt-1 max-w-sm text-sm leading-6" style={{ color: muted }}>Standings appear after a Club tournament is completed and its final results are saved.</p>
          {!viewerHasChesscomUsername && (
            <p className="mt-3 max-w-sm text-xs leading-5" style={{ color: muted }}>Add your Chess.com username to be credited automatically for Club tournament results.</p>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border" style={{ borderColor: soft, background: isDark ? "rgba(4,20,10,0.28)" : "rgba(255,255,255,0.62)" }}>
          <div className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 border-b px-4 py-3 text-[10px] font-bold uppercase tracking-[0.13em] sm:grid-cols-[2.25rem_minmax(0,1fr)_6rem_5.5rem_6rem]" style={{ borderColor: soft, color: muted }}>
            <span className="text-center">Rank</span>
            <span>Player</span>
            <span className="hidden text-right sm:block">Tournaments</span>
            <span className="hidden text-right sm:block">Wins</span>
            <span className="text-right">Points</span>
          </div>
          <div className="divide-y" style={{ borderColor: soft }}>
            {entries.map((entry) => (
              <article key={entry.memberUserId} className="grid min-h-[68px] grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-black/[0.025] dark:hover:bg-white/[0.025] sm:grid-cols-[2.25rem_minmax(0,1fr)_6rem_5.5rem_6rem]" aria-label={`Rank ${entry.rank}: ${entry.displayName}, ${formatPoints(entry.totalPoints)}`}>
                <span className="text-center text-sm font-bold" style={{ color: entry.rank === 1 ? accent : muted }}>{entry.rank}</span>
                <div className="flex min-w-0 items-center gap-3">
                  <PlayerAvatar username={entry.displayName} name={entry.displayName} avatarUrl={entry.avatarUrl ?? undefined} size={36} className="h-9 w-9 shrink-0 rounded-full" />
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <p className="truncate text-sm font-bold" style={{ color: foreground }}>{entry.displayName}</p>
                      {entry.isViewer && <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={{ color: accent, background: `${accent}18` }}>You</span>}
                    </div>
                    <p className="mt-0.5 text-xs sm:hidden" style={{ color: muted }}>{entry.totalWins} wins · {entry.tournamentsPlayed} tournaments</p>
                  </div>
                </div>
                <span className="hidden text-right text-sm sm:block" style={{ color: muted }}>{entry.tournamentsPlayed}</span>
                <span className="hidden text-right text-sm sm:block" style={{ color: muted }}>{entry.totalWins}</span>
                <span className="text-right text-sm font-bold" style={{ color: foreground }}>{formatPoints(entry.totalPoints)}</span>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
