import { Chess } from "chess.js";
import { useEffect, useState } from "react";
import { AlertCircle, ChevronRight, Database, LockKeyhole } from "lucide-react";

import type { ScoutAction, ScoutReportV3 } from "../../../../shared/prepTypes";
import { projectScoutReport } from "../../../../shared/scoutReportProjection";
import { ForecastWalkthrough } from "./ForecastWalkthrough";
import { DataQualityBanner } from "./DataQualityBanner";
import { buildPositionAnalysisUrl } from "../../lib/analyzeAction";
import { useChessAvatar } from "../../hooks/useChessAvatar";

type Tokens = {
  card: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  divider: string;
  [key: string]: string;
};

interface Props {
  report: ScoutReportV3;
  isDark: boolean;
  t: Tokens;
  reportCacheKey?: string;
}

const ACTION_COPY: Record<ScoutAction["type"], { label: string; number: string }> = {
  expect: { label: "Expect", number: "1" },
  prepare: { label: "Prepare", number: "2" },
  practice: { label: "Practice", number: "3" },
  target: { label: "Practice", number: "3" },
};

function canonicalUciPathFromSanLine(line: string): string[] | null {
  const chess = new Chess();
  const path: string[] = [];
  const tokens = line.trim().split(/\s+/).map(token => token.replace(/^\d+\.(?:\.\.)?/, "")).filter(Boolean);
  for (const token of tokens) {
    if (/^(1-0|0-1|1\/2-1\/2|\*)$/.test(token)) continue;
    try {
      const move = chess.move(token);
      path.push(move.from + move.to + (move.promotion ?? ""));
    } catch {
      return null;
    }
  }
  return path.length > 0 ? path : null;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function formatDateWindow(from: string, to: string): string {
  const start = new Date(from);
  const end = new Date(to);
  if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf())) return `${from} – ${to}`;
  const formatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
  return `${formatter.format(start)} – ${formatter.format(end)}, ${end.getFullYear()}`;
}

function formatTimeControls(breakdown: Array<{ format: string; games: number }>): string {
  const populated = breakdown.filter(entry => entry.games > 0).map(entry => `${entry.games} ${entry.format}`);
  return populated.length > 0 ? populated.join(" · ") : "All formats";
}

function winPercentage(record: { w: number; d: number; l: number }): string {
  const games = record.w + record.d + record.l;
  return games > 0 ? `${Math.round((record.w / games) * 100)}%` : "No eligible games";
}

function actionConfidence(action: ScoutAction): string {
  return action.confidence.replace(/_/g, " ").replace(/^./, letter => letter.toUpperCase());
}

function moverForBranch(move: ScoutReportV3["openingForecast"]["white"][number]): "white" | "black" | null {
  if (move.previewPath?.length) return move.previewPath.length % 2 === 1 ? "white" : "black";
  if (move.sideToMove) return move.sideToMove === "white" ? "black" : "white";
  return null;
}

function formatMove(move: ScoutReportV3["openingForecast"]["white"][number]): string {
  const mover = moverForBranch(move);
  const moveNumber = move.moveNumber ?? (move.previewPath?.length ? Math.ceil(move.previewPath.length / 2) : undefined);
  if (!moveNumber || !mover) return move.moveSan;
  return `${moveNumber}${mover === "black" ? "..." : "."} ${move.moveSan}`;
}

function firstObservedMove(branches: ScoutReportV3["openingForecast"]["white"], color: "white" | "black"): string | null {
  for (const branch of branches) {
    const mover = moverForBranch(branch);
    if (mover === color) return formatMove(branch);
    const nested = firstObservedMove(branch.children, color);
    if (nested) return nested;
  }
  return null;
}

function formatMoveSequence(moves?: string[]): string | null {
  if (!moves?.length) return null;
  return moves.map((move, index) => `${Math.floor(index / 2) + 1}${index % 2 ? "..." : "."} ${move}`).join(" ");
}

function OpponentProfileAvatar({ username, provider, isDark }: { username: string; provider: ScoutReportV3["provider"]; isDark: boolean }) {
  const isChesscom = provider === "chesscom";
  const { url, status } = useChessAvatar(isChesscom ? username : null);
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => setImageFailed(false), [url, username]);
  const initial = username.trim().charAt(0).toUpperCase() || "?";
  const showImage = isChesscom && Boolean(url) && !imageFailed;

  return (
    <div data-testid="scout-report-opponent-avatar" className={`relative grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full border shadow-[0_12px_32px_rgba(4,26,16,0.16)] sm:h-16 sm:w-16 ${isDark ? "border-[#aeea91]/45 bg-[#173d2c]" : "border-[#8cad7f] bg-[#e5f0df]"}`}>
      {isChesscom && status === "loading" ? <span aria-label="Loading Chess.com profile image" className={`h-full w-full animate-pulse ${isDark ? "bg-white/10" : "bg-[#cfe1c8]"}`} /> : null}
      {showImage ? (
        // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- the load error switches to the visible initials fallback.
        <img src={url!} alt={`${username}'s Chess.com profile`} className="relative z-10 h-full w-full object-cover" onError={() => setImageFailed(true)} />
      ) : null}
      <span aria-hidden={showImage} aria-label={showImage ? undefined : `${username} initials`} className={`absolute inset-0 grid place-items-center text-lg font-black uppercase ${isDark ? "text-[#d7ffbc]" : "text-[#234f31]"}`}>{initial}</span>
    </div>
  );
}

function ActionCard({ action, index, isDark, t, analysisHref, expectedMoves }: { action: ScoutAction; index: number; isDark: boolean; t: Tokens; analysisHref: string | null; expectedMoves: { white: string | null; black: string | null } }) {
  const copy = ACTION_COPY[action.type];
  const denominator = action.evidence.parentGames ?? action.evidence.relevantGames;
  const isExpectCard = action.type === "expect";
  return (
    <article className={`flex min-h-[258px] flex-col rounded-lg border p-5 sm:p-6 ${isDark ? "border-white/10 bg-[#0b2a20]" : "border-[#c8d8c1] bg-white"}`}>
      <div className="flex items-center justify-between gap-3">
        <span className={`text-xs font-bold uppercase tracking-[0.16em] ${isDark ? "text-[#aeea91]" : "text-[#315640]"}`}>{copy.label}</span>
        <span className={`grid h-8 w-8 place-items-center rounded-full border text-xs font-bold ${isDark ? "border-white/15 text-white/65" : "border-[#b8cdb0] text-[#315640]"}`}>{copy.number ?? index + 1}</span>
      </div>
      <h3 className={`mt-6 text-xl font-bold leading-tight tracking-tight ${t.textPrimary}`}>{isExpectCard ? "Expect these opening moves" : action.title}</h3>
      {isExpectCard ? <dl className={`mt-4 space-y-2 rounded-md border px-3 py-3 text-sm ${isDark ? "border-white/10 bg-black/10" : "border-[#d8e1d3] bg-[#f7faf5]"}`}><div className="flex items-baseline justify-between gap-3"><dt data-testid="scout-brief-as-white" className={`scout-brief-move-label text-base font-bold tracking-[-0.01em] ${isDark ? "text-[#d7ffbc]" : "text-[#234f31]"}`}>As White:</dt><dd className={`font-mono font-bold ${t.textPrimary}`}>{expectedMoves.white ?? "No repeated first move"}</dd></div><div className="flex items-baseline justify-between gap-3"><dt data-testid="scout-brief-as-black" className={`scout-brief-move-label text-base font-bold tracking-[-0.01em] ${isDark ? "text-[#d7ffbc]" : "text-[#234f31]"}`}>As Black:</dt><dd className={`font-mono font-bold ${t.textPrimary}`}>{expectedMoves.black ?? "No repeated first move"}</dd></div></dl> : <><p className={`mt-3 text-sm leading-relaxed ${t.textSecondary}`}>{action.whyItMatters}</p>{action.action.legalLine?.length ? <p className={`mt-4 font-mono text-sm font-bold ${isDark ? "text-[#FFF598]" : "text-[#6f6500]"}`}>{action.action.legalLine.join(" ")}</p> : null}</>}
      <div className={`mt-auto flex flex-wrap items-center justify-between gap-2 border-t pt-4 text-xs ${isDark ? "border-white/10" : "border-[#d8e1d3]"} ${t.textTertiary}`}>
        <span><strong className={t.textPrimary}>{action.evidence.relevantGames} of {denominator}</strong> observed games</span>
        <span>{actionConfidence(action)}</span>
      </div>
      {analysisHref && <a href={analysisHref} className={`mt-4 inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7ED957] ${isDark ? "bg-[#7ED957]/10 text-[#b9f29c] hover:bg-[#7ED957]/15" : "bg-[#e5f2df] text-[#315640] hover:bg-[#d8ebd1]"}`}>Open analysis <ChevronRight aria-hidden="true" className="h-4 w-4" /></a>}
    </article>
  );
}

function OpeningSnapshot({ report, isDark, t }: { report: ScoutReportV3; isDark: boolean; t: Tokens }) {
  const view = projectScoutReport(report);
  return (
    <section className={`${t.card} p-4 sm:p-6`} aria-labelledby="opening-snapshot-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className={`text-[11px] font-bold uppercase tracking-[0.15em] ${t.textTertiary}`}>Opening snapshot</p>
          <h2 id="opening-snapshot-title" className={`mt-1 text-xl font-bold tracking-tight ${t.textPrimary}`}>Most-played familiar openings</h2>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.13em] ${isDark ? "bg-white/[0.06] text-white/65" : "bg-[#edf2e9] text-[#315640]"}`}>Free brief</span>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2" data-testid="simple-opening-brief">
        {(["white", "black"] as const).map(color => {
          const openings = view.openingSummary[color];
          return (
            <section key={color} className={`rounded-lg border p-4 ${isDark ? "border-white/10 bg-black/15" : "border-[#d8e1d3] bg-[#f7faf5]"}`} aria-labelledby={`openings-as-${color}`}>
              <div className="flex items-center justify-between gap-3">
                <h3 id={`openings-as-${color}`} className={`text-base font-bold ${t.textPrimary}`}>As {color === "white" ? "White" : "Black"}</h3>
                <span className={`text-[10px] font-bold uppercase tracking-[0.12em] ${t.textTertiary}`}>Top 2</span>
              </div>
              {openings.length > 0 ? (
                <ol className="mt-4 space-y-3">
                  {openings.map((opening, index) => { const moves = formatMoveSequence(opening.moves); return <li key={opening.name} className="flex items-start gap-3"><span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${isDark ? "bg-[#7ED957]/10 text-[#aeea91]" : "bg-[#e2ecde] text-[#315640]"}`}>{index + 1}</span><div className="min-w-0 flex-1"><p className={`text-base font-semibold leading-snug ${t.textPrimary}`}>{opening.name}{moves ? <span className={`font-normal ${t.textSecondary}`}> ({moves})</span> : null}</p><p className={`mt-0.5 text-xs ${t.textTertiary}`}>{opening.games} game{opening.games === 1 ? "" : "s"} · {Math.round(opening.share * 100)}%</p></div></li>; })}
                </ol>
              ) : <p className={`mt-4 text-sm ${t.textSecondary}`}>No eligible {color} games in this report.</p>}
            </section>
          );
        })}
      </div>
    </section>
  );
}

export function V3ScoutReportTab({ report, isDark, t, reportCacheKey }: Props) {
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  if (!report.reportSnapshot) {
    return <div className={`${t.card} flex items-start gap-3 p-5`} role="status"><AlertCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" /><div><h2 className={`text-base font-bold ${t.textPrimary}`}>Update this report</h2><p className={`mt-1 text-sm ${t.textSecondary}`}>This saved report predates immutable scouting snapshots. Run the scout again before using its recommendations or exports.</p></div></div>;
  }

  const view = projectScoutReport(report);
  const request = view.snapshot.activeRequest;
  const opponentColor = request.myColor === "white" ? "black" : "white";
  const hasProAccess = view.tier === "pro";
  const actions = view.actions.slice(0, 3);
  const supportingFacts = report.insights
    .filter(insight => insight.color === opponentColor && insight.sampleSize >= 6)
    .filter(insight => !new Set(view.actions.map(action => action.sourceInsightId)).has(insight.id));
  const providerLabel = view.opponent.provider === "lichess" ? "Lichess" : "Chess.com";
  const opposingRecord = report.opponent.record[opponentColor];
  const whiteWinPercentage = winPercentage(report.opponent.record.white);
  const blackWinPercentage = winPercentage(report.opponent.record.black);
  const expectedMoves = { white: firstObservedMove(report.openingForecast.white, "white"), black: firstObservedMove(report.openingForecast.black, "black") };
  const actionHref = (action: ScoutAction): string | null => {
    if (!reportCacheKey || !action.action.legalLine?.length || action.action.source !== "recentEvidence") return null;
    const path = canonicalUciPathFromSanLine(action.action.legalLine.join(" "));
    return path ? buildPositionAnalysisUrl({ reportCacheKey, canonicalUciPath: path, evidenceClaimId: action.sourceInsightId, returnPath: `${window.location.pathname}${window.location.search}#scout-brief` }) : null;
  };
  const progressAction = actions[0];
  const progressTotal = progressAction?.evidence.parentGames ?? progressAction?.evidence.relevantGames ?? 0;
  const progressValue = progressAction && progressTotal ? Math.min(100, Math.round((progressAction.evidence.relevantGames / progressTotal) * 100)) : 0;

  return (
    <div className="space-y-5 sm:space-y-6">
      <section className={`${t.card} overflow-hidden p-4 sm:p-6`} aria-labelledby="scout-report-title">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <OpponentProfileAvatar username={report.opponent.username} provider={report.provider} isDark={isDark} />
            <div className="min-w-0">
              <p className={`text-[11px] font-bold uppercase tracking-[0.18em] ${isDark ? "text-[#aeea91]" : "text-[#315640]"}`}>Scout report / {providerLabel}</p>
              <h1 id="scout-report-title" className={`mt-2 break-words text-3xl font-black uppercase italic tracking-[-0.05em] sm:text-5xl ${t.textPrimary}`} style={{ fontFamily: "'Clash Display', sans-serif" }}>{report.opponent.username}</h1>
              <p className={`mt-2 text-base sm:text-lg ${t.textSecondary}`}><strong className={t.textPrimary}>{whiteWinPercentage} as White</strong> <span aria-hidden="true">·</span> <strong className={t.textPrimary}>{blackWinPercentage} as Black</strong></p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${isDark ? "border-white/15 text-white/70" : "border-[#c8d8c1] text-[#315640]"}`}>{providerLabel}</span>
            <span className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${report.dataQuality.grade === "A" || report.dataQuality.grade === "B" ? (isDark ? "border-[#7ED957]/35 bg-[#7ED957]/10 text-[#aeea91]" : "border-[#6da05d]/40 bg-[#edf7e8] text-[#315640]") : (isDark ? "border-amber-300/35 bg-amber-300/10 text-amber-200" : "border-amber-500/35 bg-amber-50 text-amber-800")}`}>{report.dataQuality.grade === "A" ? "Strong data" : report.dataQuality.grade === "B" ? "Fair data" : "Limited data"}</span>
          </div>
        </header>

        <dl className={`mt-6 grid overflow-hidden rounded-lg border sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 ${isDark ? "border-white/10 bg-[#0b2a20]" : "border-[#c8d8c1] bg-[#f7faf5]"}`}>
          <div className="border-b border-r border-current/10 p-4"><dt className={`text-[10px] font-bold uppercase tracking-[0.12em] ${t.textTertiary}`}>Opponent rating</dt><dd className={`mt-2 text-base font-bold ${t.textPrimary}`}>{view.opponent.avgRating ? `${view.opponent.avgRating} avg` : "Unavailable"}</dd></div>
          <div className="border-b border-r border-current/10 p-4"><dt className={`text-[10px] font-bold uppercase tracking-[0.12em] ${t.textTertiary}`}>Games analyzed</dt><dd className={`mt-2 text-base font-bold ${t.textPrimary}`}>{view.gamesAnalyzed} eligible</dd></div>
          <div className="border-b border-r border-current/10 p-4"><dt className={`text-[10px] font-bold uppercase tracking-[0.12em] ${t.textTertiary}`}>Time controls</dt><dd className={`mt-2 text-sm font-bold leading-snug ${t.textPrimary}`}>{formatTimeControls(view.formatBreakdown)}</dd></div>
          <div className="border-b border-r border-current/10 p-4"><dt className={`text-[10px] font-bold uppercase tracking-[0.12em] ${t.textTertiary}`}>Date window</dt><dd className={`mt-2 text-sm font-bold leading-snug ${t.textPrimary}`}>{formatDateWindow(view.gameWindow.from, view.gameWindow.to)}</dd></div>
          <div className="border-b border-r border-current/10 p-4"><dt className={`text-[10px] font-bold uppercase tracking-[0.12em] ${t.textTertiary}`}>Opponent record</dt><dd className={`mt-2 text-base font-bold ${t.textPrimary}`}>{opposingRecord ? `${opposingRecord.w}–${opposingRecord.d}–${opposingRecord.l}` : "Unavailable"}</dd></div>
          <div className="p-4"><dt className={`text-[10px] font-bold uppercase tracking-[0.12em] ${t.textTertiary}`}>Report checked</dt><dd className={`mt-2 text-sm font-bold ${t.textPrimary}`}>{formatDate(report.generatedAt)}</dd></div>
        </dl>
      </section>

      {hasProAccess ? (
        <>
          <section id="scout-brief" aria-labelledby="scout-brief-title">
            <header className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className={`text-[11px] font-bold uppercase tracking-[0.18em] ${isDark ? "text-[#aeea91]" : "text-[#315640]"}`}>Your scout brief</p>
                <h2 id="scout-brief-title" className={`mt-1 text-2xl font-bold tracking-tight sm:text-3xl ${t.textPrimary}`}>The 30-second plan</h2>
              </div>
              <p className={`text-sm ${t.textSecondary}`}>{actions.length > 0 ? `${actions.length} actions. No repeated filler.` : "No action card meets the evidence threshold yet."}</p>
            </header>
            {actions.length > 0 ? <div className="mt-5 grid gap-3 lg:grid-cols-3">{actions.map((action, index) => <ActionCard key={action.id} action={action} index={index} isDark={isDark} t={t} analysisHref={actionHref(action)} expectedMoves={expectedMoves} />)}</div> : <div className={`${t.card} mt-5 p-5`}><h3 className={`text-base font-bold ${t.textPrimary}`}>No repeated opening line yet</h3><p className={`mt-2 text-sm leading-relaxed ${t.textSecondary}`}>This report needs at least two verified games in the same opening sequence before it can create a practical plan.</p></div>}
          </section>
          {progressAction && <section className={`rounded-lg border px-4 py-4 sm:px-5 ${isDark ? "border-[#7ED957]/25 bg-[#7ED957]/[0.045]" : "border-[#b8d2ae] bg-[#f2f8ee]"}`} aria-label="Primary opening evidence share"><div className="flex flex-wrap items-center justify-between gap-3"><span className={`text-sm font-bold ${t.textPrimary}`}>{progressAction.title}</span><span className={`text-xs font-semibold ${t.textSecondary}`}>{progressAction.evidence.relevantGames} of {progressTotal} observed games</span></div><div className={`mt-3 h-2 overflow-hidden rounded-full ${isDark ? "bg-white/10" : "bg-[#dcebd6]"}`}><div className="h-full rounded-full bg-[#7ED957] transition-[width] duration-300" style={{ width: `${progressValue}%` }} /></div></section>}
          <OpeningSnapshot report={report} isDark={isDark} t={t} />
          <ForecastWalkthrough openingForecast={report.openingForecast} myColor={request.myColor} isDark={isDark} t={t} opponentUsername={report.opponent.username} opponentRating={report.opponent.avgRating} analysisHrefForUciPath={reportCacheKey ? canonicalUciPath => buildPositionAnalysisUrl({ reportCacheKey, canonicalUciPath, returnPath: `${window.location.pathname}${window.location.search}#opening-forecast` }) : undefined} />
          <details className={`${t.card} group overflow-hidden`} open={evidenceOpen} onToggle={event => setEvidenceOpen(event.currentTarget.open)}>
            <summary aria-expanded={evidenceOpen} className={`flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#7ED957] sm:px-5 ${isDark ? "hover:bg-white/[0.025]" : "hover:bg-[#f7faf5]"}`}><Database aria-hidden="true" className={`h-4 w-4 ${t.textTertiary}`} /><span className={`flex-1 text-sm font-semibold ${t.textPrimary}`}>Evidence summary</span><span className={`text-xs ${t.textTertiary}`}>{supportingFacts.length} supporting fact{supportingFacts.length === 1 ? "" : "s"}</span><ChevronRight aria-hidden="true" className={`h-4 w-4 transition-transform group-open:rotate-90 ${t.textTertiary}`} /></summary>
            <div className={`border-t px-4 py-4 sm:px-5 ${t.divider}`}><DataQualityBanner dataQuality={report.dataQuality} isDark={isDark} />{supportingFacts.length > 0 && <ul className="mt-4 space-y-2">{supportingFacts.map(fact => <li key={fact.id} className={`rounded-lg border p-3 text-sm ${isDark ? "border-white/10 bg-black/15" : "border-[#d8e1d3] bg-[#f7faf5]"}`}><p className={`font-semibold leading-relaxed ${t.textPrimary}`}>{fact.claim}</p><p className={`mt-1 text-xs ${t.textTertiary}`}>{fact.evidence.stat} · {fact.confidence.replace("_", " ")} confidence</p></li>)}</ul>}</div>
          </details>
        </>
      ) : (
        <>
          <OpeningSnapshot report={report} isDark={isDark} t={t} />
          <aside className={`${t.card} flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6`} aria-labelledby="pro-upgrade-title"><div className="flex items-start gap-3"><div className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${isDark ? "bg-[#FFF598]/10 text-[#FFF598]" : "bg-amber-50 text-amber-700"}`}><LockKeyhole aria-hidden="true" className="h-5 w-5" /></div><div><h2 id="pro-upgrade-title" className={`text-lg font-bold ${t.textPrimary}`}>Unlock the full scout plan</h2><p className={`mt-1 text-sm leading-relaxed ${t.textSecondary}`}>Pro adds weakest lines, legal decision points, focused practice positions, and board-based preparation.</p></div></div><a href="/pricing" className={`inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7ED957] ${isDark ? "bg-[#7ED957] text-[#08241a] hover:bg-[#a0e87d]" : "bg-[#315640] text-white hover:bg-[#23482f]"}`}>View Pro <ChevronRight aria-hidden="true" className="h-4 w-4" /></a></aside>
        </>
      )}
    </div>
  );
}
