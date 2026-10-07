import { CalendarDays, CheckCircle2, Clock3 } from "lucide-react";

export interface FullSeasonGame {
  id: number;
  gameNumber: number;
  playerWhiteId: string;
  playerWhiteName: string;
  playerBlackId: string;
  playerBlackName: string;
  resultStatus: "pending" | "awaiting_confirmation" | "disputed" | "completed";
  result?: "white_win" | "black_win" | "draw" | null;
}

export interface FullSeasonEncounter {
  id: string;
  weekId: number;
  weekNumber: number;
  playerAId: string;
  playerBId: string;
  playerAName: string;
  playerBName: string;
  status: "generated" | "published" | "in_progress" | "complete" | "postponed" | "forfeit";
  playerAGamePoints: number;
  playerBGamePoints: number;
  playerASeasonPoints: number;
  playerBSeasonPoints: number;
  games: FullSeasonGame[];
}

export interface FullSeasonWeek {
  id: number;
  weekNumber: number;
  isComplete: number;
  state: "generated" | "published" | "in_progress" | "finalized";
  encounters: FullSeasonEncounter[];
}

export interface FullSeasonPlayoffGame {
  id: string;
  phase: "rapid" | "blitz" | "armageddon";
  gameNumber: number;
  playerWhiteId: string;
  playerBlackId: string;
  resultStatus: "pending" | "completed";
  result?: "white_win" | "black_win" | "draw" | null;
}

export interface FullSeasonPlayoffMatch {
  id: string;
  roundLabel: string;
  matchNumber: number;
  playerAId?: string | null;
  playerBId?: string | null;
  playerASeed?: number | null;
  playerBSeed?: number | null;
  status: "pending" | "ready" | "tiebreak" | "complete";
  games: FullSeasonPlayoffGame[];
}

export interface FullSeasonDetail {
  weeks: FullSeasonWeek[];
  playoffs: FullSeasonPlayoffMatch[];
}

export interface FullSeasonStanding {
  playerId: string;
  displayName: string;
  rank: number;
  points: number;
  seasonPoints?: number;
  gamePoints?: number;
  encounterWins?: number;
  encounterDraws?: number;
  encounterLosses?: number;
  gamesPlayed?: number;
  encountersPlayed?: number;
  sonnebornBerger?: number;
  leagueRating?: number;
  ratingChange?: number;
  movement?: string;
  lastResults?: string;
}

export type FullSeasonLeagueMeta = {
  currentWeek: number;
  totalWeeks: number;
  seasonPhase?: string;
  playoffQualifierCount?: number;
  players: Array<{ playerId: string; displayName: string }>;
};

type ThemeProps = {
  textMain: string;
  textMuted: string;
  cardBg: string;
  cardBorder: string;
  accent: string;
  isDark: boolean;
};

function gameResult(game: Pick<FullSeasonGame, "resultStatus" | "result">): string {
  if (game.resultStatus !== "completed" || !game.result) return "—";
  return game.result === "white_win" ? "1–0" : game.result === "black_win" ? "0–1" : "½–½";
}

function parseForm(raw?: string): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return raw.split("-").filter(Boolean);
  }
}

export function FullSeasonMatchSet({
  league,
  detail,
  selectedWeek,
  onSelectWeek,
  isCommissioner,
  isBusy,
  onWeekAction,
  onReport,
  ...theme
}: ThemeProps & {
  league: FullSeasonLeagueMeta;
  detail: FullSeasonDetail;
  selectedWeek: number;
  onSelectWeek: (week: number) => void;
  isCommissioner: boolean;
  isBusy: boolean;
  onWeekAction: (action: "publish" | "start", week: number) => void;
  onReport: (game: FullSeasonGame) => void;
}) {
  const week = detail.weeks.find((candidate) => candidate.weekNumber === selectedWeek) ?? detail.weeks[0];
  const isPlayoffs = league.seasonPhase === "playoffs" || league.seasonPhase === "complete";
  const playerName = (playerId?: string | null) => league.players.find((player) => player.playerId === playerId)?.displayName ?? "TBD";

  if (isPlayoffs) {
    const roundLabels = Array.from(new Set(detail.playoffs.map((match) => match.roundLabel)));
    return <div className="space-y-4">
      <section className="rounded-2xl px-5 py-6 text-center" style={{ background: `linear-gradient(135deg, ${theme.accent}22, ${theme.cardBg})`, border: `1px solid ${theme.accent}35` }}>
        <p className="text-[11px] font-bold uppercase tracking-[.16em]" style={{ color: theme.accent }}>Championship Day</p>
        <h2 className="mt-2 text-2xl font-black" style={{ color: theme.textMain }}>{league.seasonPhase === "complete" ? "League Champion Crowned" : "Playoff Field Set"}</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm" style={{ color: theme.textMuted }}>Every matchup is a color-reversed rapid set. Ties continue through two blitz games, then Armageddon.</p>
      </section>
      {roundLabels.map((round) => <section key={round} className="rounded-2xl p-4" style={{ background: theme.cardBg, border: `1px solid ${theme.cardBorder}` }}>
        <h3 className="mb-3 text-xs font-bold uppercase tracking-[.14em]" style={{ color: theme.accent }}>{round}</h3>
        <div className="grid gap-3 md:grid-cols-2">{detail.playoffs.filter((match) => match.roundLabel === round).map((match) => <article key={match.id} className="rounded-xl border p-3" style={{ borderColor: theme.cardBorder }}>
          <div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-bold" style={{ color: theme.textMain }}>{match.playerAId ? `#${match.playerASeed ?? ""} ${playerName(match.playerAId)}` : "Winner advances"}</p><p className="my-1 text-xs" style={{ color: theme.textMuted }}>vs</p><p className="truncate text-sm font-bold" style={{ color: theme.textMain }}>{match.playerBId ? `#${match.playerBSeed ?? ""} ${playerName(match.playerBId)}` : "Winner advances"}</p></div><span className="rounded-full px-2 py-1 text-[10px] font-bold uppercase" style={{ background: `${theme.accent}12`, color: theme.accent }}>{match.status.replace(/_/g, " ")}</span></div>
          {match.games.length > 0 && <p className="mt-3 border-t pt-2 text-xs" style={{ borderColor: theme.cardBorder, color: theme.textMuted }}>{match.games.map((game) => `${game.phase === "armageddon" ? "Armageddon" : game.phase === "blitz" ? "Blitz" : "Rapid"} ${game.gameNumber}: ${gameResult(game)}`).join(" · ")}</p>}
        </article>)}</div>
      </section>)}
    </div>;
  }

  const completed = week?.encounters.filter((encounter) => encounter.status === "complete").length ?? 0;
  const total = week?.encounters.length ?? 0;
  return <div className="space-y-4">
    <section className="overflow-hidden rounded-2xl" style={{ background: theme.cardBg, border: `1px solid ${theme.cardBorder}` }}>
      <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: theme.accent }}>Full Season League</p><h2 className="mt-1 text-xl font-bold" style={{ color: theme.textMain }}>Week {week?.weekNumber ?? league.currentWeek} Match Set</h2><p className="mt-1 text-sm" style={{ color: theme.textMuted }}>Up to 3 opponents · 6 games · 3 Season Points</p></div><div className="rounded-xl px-3 py-2 text-right" style={{ background: `${theme.accent}12` }}><p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: theme.textMuted }}>Progress</p><p className="mt-0.5 text-sm font-bold" style={{ color: theme.accent }}>{completed}/{total} matchups</p></div></div>
      <div className="flex gap-2 overflow-x-auto border-t px-4 py-3" style={{ borderColor: theme.cardBorder }}>{detail.weeks.map((candidate) => <button key={candidate.weekNumber} type="button" onClick={() => onSelectWeek(candidate.weekNumber)} className="min-h-10 flex-none rounded-lg px-3 text-sm font-semibold" style={{ background: selectedWeek === candidate.weekNumber ? theme.accent : theme.isDark ? "oklch(0.24 0.06 145)" : "oklch(0.94 0.02 145)", color: selectedWeek === candidate.weekNumber ? "#fff" : theme.textMuted }}>{`W${candidate.weekNumber}`}{candidate.state === "finalized" ? " · Final" : ""}</button>)}</div>
    </section>
    {isCommissioner && week && (week.state === "generated" || week.state === "published") && <section className="flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between" style={{ background: `${theme.accent}0d`, border: `1px solid ${theme.accent}33` }}><div><p className="text-sm font-semibold" style={{ color: theme.textMain }}>{week.state === "generated" ? "Review the locked Match Set" : "Match Set is published"}</p><p className="mt-0.5 text-xs leading-5" style={{ color: theme.textMuted }}>{week.state === "generated" ? "Publish to lock every opponent and make the schedule visible." : "Start League Night once boards are ready."}</p></div><button type="button" disabled={isBusy} onClick={() => onWeekAction(week.state === "generated" ? "publish" : "start", week.weekNumber)} className="inline-flex min-h-11 flex-none items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold disabled:opacity-50" style={{ background: theme.accent, color: "#fff" }}>{isBusy ? <Clock3 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}{week.state === "generated" ? "Publish Match Set" : "Start League Night"}</button></section>}
    {!week?.encounters.length ? <div className="rounded-2xl px-6 py-12 text-center" style={{ background: theme.cardBg, border: `1px solid ${theme.cardBorder}` }}><CalendarDays size={30} className="mx-auto mb-3" style={{ color: theme.textMuted }} /><p className="font-semibold" style={{ color: theme.textMain }}>Next Match Set is not generated yet</p><p className="mt-1 text-sm" style={{ color: theme.textMuted }}>Finish every encounter in the active week to create the next adaptive set.</p></div> : week.encounters.map((encounter, index) => {
      const complete = encounter.status === "complete";
      const winner = encounter.playerAGamePoints > encounter.playerBGamePoints ? encounter.playerAName : encounter.playerBGamePoints > encounter.playerAGamePoints ? encounter.playerBName : null;
      return <article key={encounter.id} className="overflow-hidden rounded-2xl" style={{ background: theme.cardBg, border: `1px solid ${complete ? `${theme.accent}55` : theme.cardBorder}` }}><header className="flex items-center justify-between gap-3 border-b px-4 py-3" style={{ borderColor: theme.cardBorder, background: theme.isDark ? "oklch(0.17 0.05 145)" : "oklch(0.98 0.01 145)" }}><div><p className="text-[10px] font-bold uppercase tracking-[.14em]" style={{ color: theme.accent }}>Matchup {index + 1} of {total}</p><h3 className="mt-0.5 text-base font-bold" style={{ color: theme.textMain }}>{encounter.playerAName} <span className="font-medium" style={{ color: theme.textMuted }}>vs</span> {encounter.playerBName}</h3></div><span className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide" style={{ background: complete ? `${theme.accent}1a` : "rgba(245,158,11,.12)", color: complete ? theme.accent : "oklch(0.72 0.16 75)" }}>{complete ? "Final" : encounter.status.replace(/_/g, " ")}</span></header>
        <div className="divide-y" style={{ borderColor: theme.cardBorder }}>{encounter.games.map((game) => <div key={game.id} className="grid grid-cols-[3.5rem_minmax(0,1fr)_3.5rem_minmax(0,1fr)_4.5rem] items-center gap-2 px-3 py-3 sm:px-4"><span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: theme.textMuted }}>Game {game.gameNumber}</span><div className="min-w-0 text-right"><p className="truncate text-sm font-semibold" style={{ color: theme.textMain }}>{game.playerWhiteName}</p><p className="text-[10px] font-bold uppercase tracking-wide text-white/45">White</p></div><p className="text-center text-sm font-black" style={{ color: game.resultStatus === "completed" ? theme.accent : theme.textMuted }}>{gameResult(game)}</p><div className="min-w-0"><p className="truncate text-sm font-semibold" style={{ color: theme.textMain }}>{game.playerBlackName}</p><p className="text-[10px] font-bold uppercase tracking-wide text-white/45">Black</p></div>{isCommissioner && game.resultStatus !== "completed" && week.state !== "generated" ? <button type="button" onClick={() => onReport(game)} className="min-h-10 rounded-lg px-2 text-xs font-bold" style={{ background: `${theme.accent}18`, color: theme.accent }}>Report</button> : <span className="text-right text-xs" style={{ color: theme.textMuted }}>{game.resultStatus === "completed" ? "Recorded" : "Pending"}</span>}</div>)}</div>
        <footer className="flex flex-wrap items-center justify-between gap-2 px-4 py-3" style={{ background: `${theme.accent}08` }}><div><span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: theme.textMuted }}>Match result</span><p className="mt-0.5 text-sm font-bold" style={{ color: winner ? theme.accent : theme.textMain }}>{complete ? `${winner ? `${winner} wins · ` : "Draw · "}${encounter.playerAGamePoints}–${encounter.playerBGamePoints}` : "Complete both games to score this matchup"}</p></div>{complete && <div className="text-right"><p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: theme.textMuted }}>Season points</p><p className="mt-0.5 text-sm font-bold" style={{ color: theme.accent }}>{encounter.playerASeasonPoints} · {encounter.playerBSeasonPoints}</p></div>}</footer></article>;
    })}
  </div>;
}

export function FullSeasonStandings({ standings, qualifierCount, seasonPhase, currentUserId, ...theme }: ThemeProps & { standings: FullSeasonStanding[]; qualifierCount: number; seasonPhase?: string; currentUserId?: string; }) {
  return <div className="space-y-4"><section className="overflow-hidden rounded-2xl" style={{ background: theme.cardBg, border: `1px solid ${theme.cardBorder}` }}><header className="flex flex-col gap-2 border-b px-4 py-4 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: theme.cardBorder }}><div><p className="text-[11px] font-bold uppercase tracking-[.14em]" style={{ color: theme.accent }}>Full Season standings</p><h2 className="mt-1 text-xl font-bold" style={{ color: theme.textMain }}>Season Points lead the table</h2></div><p className="text-xs" style={{ color: theme.textMuted }}>{seasonPhase === "playoffs" ? "Playoff field set" : `Top ${qualifierCount} qualify for Championship Day`}</p></header><div className="hidden grid-cols-[3rem_minmax(12rem,1fr)_4rem_4.75rem_4rem_4rem_4rem_5rem] gap-2 border-b px-4 py-3 text-[10px] font-bold uppercase tracking-[.1em] lg:grid" style={{ borderColor: theme.cardBorder, color: theme.textMuted }}><span>Rank</span><span>Player</span><span>MP</span><span>Record</span><span>Season</span><span>Game</span><span>SB</span><span>League Rating</span></div>{standings.map((standing, index) => { const qualifying = standing.rank <= qualifierCount; const isMe = standing.playerId === currentUserId; const form = parseForm(standing.lastResults); return <div key={standing.playerId}><div className="hidden grid-cols-[3rem_minmax(12rem,1fr)_4rem_4.75rem_4rem_4rem_4rem_5rem] items-center gap-2 px-4 py-3.5 lg:grid" style={{ borderBottom: index < standings.length - 1 ? `1px solid ${theme.cardBorder}` : undefined, background: isMe ? `${theme.accent}0c` : qualifying ? `${theme.accent}05` : "transparent" }}><div className="flex items-center gap-1"><span className="font-bold" style={{ color: qualifying ? theme.accent : theme.textMain }}>#{standing.rank}</span><span className="text-xs" style={{ color: standing.movement === "up" ? "#4ade80" : standing.movement === "down" ? "#f87171" : theme.textMuted }}>{standing.movement === "up" ? "↑" : standing.movement === "down" ? "↓" : "—"}</span></div><div className="min-w-0"><p className="truncate text-sm font-semibold" style={{ color: isMe ? theme.accent : theme.textMain }}>{standing.displayName}{isMe ? " (you)" : ""}</p><div className="mt-1 flex gap-1">{form.map((result, formIndex) => <span key={formIndex} className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold" style={{ background: result === "W" ? "#4ade8022" : result === "L" ? "#f8717122" : "#facc1522", color: result === "W" ? "#4ade80" : result === "L" ? "#f87171" : "#facc15" }}>{result}</span>)}</div></div><span className="text-sm" style={{ color: theme.textMuted }}>{standing.encountersPlayed ?? 0}</span><span className="text-sm" style={{ color: theme.textMain }}>{standing.encounterWins ?? 0}-{standing.encounterDraws ?? 0}-{standing.encounterLosses ?? 0}</span><span className="text-sm font-bold" style={{ color: theme.accent }}>{standing.seasonPoints ?? standing.points}</span><span className="text-sm font-semibold" style={{ color: theme.textMain }}>{standing.gamePoints ?? 0}</span><span className="text-sm" style={{ color: theme.textMuted }}>{(standing.sonnebornBerger ?? 0).toFixed(2)}</span><div><span className="text-sm font-bold" style={{ color: theme.textMain }}>{standing.leagueRating ?? "—"}</span>{standing.ratingChange ? <span className="ml-1 text-xs" style={{ color: standing.ratingChange > 0 ? "#4ade80" : "#f87171" }}>{standing.ratingChange > 0 ? "+" : ""}{standing.ratingChange}</span> : null}</div></div><div className="px-4 py-4 lg:hidden" style={{ borderBottom: index < standings.length - 1 ? `1px solid ${theme.cardBorder}` : undefined, background: isMe ? `${theme.accent}0c` : qualifying ? `${theme.accent}05` : "transparent" }}><div className="flex items-start gap-3"><span className="mt-0.5 min-w-8 text-sm font-bold" style={{ color: qualifying ? theme.accent : theme.textMain }}>#{standing.rank}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold" style={{ color: isMe ? theme.accent : theme.textMain }}>{standing.displayName}</p><p className="mt-1 text-xs" style={{ color: theme.textMuted }}>{standing.encountersPlayed ?? 0} matchups · {standing.gamesPlayed ?? 0} games · {standing.encounterWins ?? 0}-{standing.encounterDraws ?? 0}-{standing.encounterLosses ?? 0}</p><div className="mt-2 flex gap-1">{form.map((result, formIndex) => <span key={formIndex} className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold" style={{ background: result === "W" ? "#4ade8022" : result === "L" ? "#f8717122" : "#facc1522", color: result === "W" ? "#4ade80" : result === "L" ? "#f87171" : "#facc15" }}>{result}</span>)}</div></div><div className="text-right"><p className="text-lg font-black" style={{ color: theme.accent }}>{standing.seasonPoints ?? standing.points}</p><p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: theme.textMuted }}>Season pts</p></div></div><div className="mt-3 grid grid-cols-3 gap-2 border-t pt-3 text-xs" style={{ borderColor: theme.cardBorder }}><span style={{ color: theme.textMuted }}>Game <strong style={{ color: theme.textMain }}>{standing.gamePoints ?? 0}</strong></span><span style={{ color: theme.textMuted }}>SB <strong style={{ color: theme.textMain }}>{(standing.sonnebornBerger ?? 0).toFixed(2)}</strong></span><span className="text-right" style={{ color: theme.textMuted }}>Rating <strong style={{ color: theme.textMain }}>{standing.leagueRating ?? "—"}</strong></span></div></div>{qualifying && index === qualifierCount - 1 && <div className="border-y px-4 py-2 text-center text-[10px] font-bold uppercase tracking-[.14em]" style={{ color: theme.accent, background: `${theme.accent}10`, borderColor: `${theme.accent}25` }}>Playoff cutoff · Top {qualifierCount} qualify</div>}</div>; })}</section><p className="px-1 text-xs leading-5" style={{ color: theme.textMuted }}>Tiebreak order: Season Points, Game Points, head-to-head encounter, Sonneborn-Berger, matchup wins, League Rating, then original seed.</p></div>;
}
