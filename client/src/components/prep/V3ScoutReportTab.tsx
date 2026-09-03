import { Chess } from "chess.js";
import { useState } from "react";
import { AlertCircle, ChevronRight, Crown, Crosshair, Database, LockKeyhole, ShieldCheck } from "lucide-react";

import type { Insight, ScoutReportV3 } from "../../../../shared/prepTypes";
import { projectScoutReport } from "../../../../shared/scoutReportProjection";
import { ForecastWalkthrough } from "./ForecastWalkthrough";
import { DataQualityBanner } from "./DataQualityBanner";
import { buildPositionAnalysisUrl } from "../../lib/analyzeAction";

type Tokens = {
  card: string;
  cardSubtle: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  divider: string;
  monoBlock: string;
  [key: string]: string;
};

interface Props {
  report: ScoutReportV3;
  isDark: boolean;
  t: Tokens;
  reportCacheKey?: string;
}

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

function displayConfidence(value: string): string {
  return value.replace("_", " ").replace(/^./, letter => letter.toUpperCase());
}

function ProFindingCard({
  insight,
  index,
  analysisHref,
  isDark,
  t,
}: {
  insight: Insight;
  index: number;
  analysisHref: string | null;
  isDark: boolean;
  t: Tokens;
}) {
  return (
    <article className={`rounded-2xl border p-4 sm:p-5 ${isDark ? "border-[#25342a] bg-[#101b12]" : "border-[#cdd8c6] bg-white"}`}>
      <div className="flex items-center justify-between gap-3">
        <span className={`text-[10px] font-bold uppercase tracking-[0.14em] ${isDark ? "text-[#8dcc9b]" : "text-[#315640]"}`}>Prep target {index + 1}</span>
        <span className={`text-[11px] font-semibold ${t.textTertiary}`}>{displayConfidence(insight.confidence)} · n={insight.sampleSize}</span>
      </div>
      <h3 className={`mt-3 text-base font-bold leading-tight ${t.textPrimary}`}>{insight.kind === "weakness" ? "Lowest-scoring opening" : "Key decision point"}</h3>
      <p className={`mt-2 text-sm font-medium leading-relaxed ${t.textPrimary}`}>{insight.claim}</p>
      <p className={`mt-3 text-xs leading-relaxed ${t.textSecondary}`}>{insight.recommendation.action}</p>
      {analysisHref && (
        <a
          href={analysisHref}
          className={`mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B9A6A] ${isDark ? "bg-[#436850]/20 text-[#a7d8b1] hover:bg-[#436850]/30" : "bg-[#e8f0e5] text-[#23482f] hover:bg-[#dce9d8]"}`}
        >
          Analyze this line <ChevronRight aria-hidden="true" className="h-4 w-4" />
        </a>
      )}
    </article>
  );
}

export function V3ScoutReportTab({ report, isDark, t, reportCacheKey }: Props) {
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  if (!report.reportSnapshot) {
    return (
      <div className={`${t.card} flex items-start gap-3 p-5`} role="status">
        <AlertCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
        <div>
          <h2 className={`text-sm font-bold ${t.textPrimary}`}>Update this report</h2>
          <p className={`mt-1 text-sm ${t.textSecondary}`}>This saved report predates immutable scouting snapshots. Run the scout again before using its recommendations or exports.</p>
        </div>
      </div>
    );
  }

  const view = projectScoutReport(report);
  const request = view.snapshot.activeRequest;
  const opponentColor = request.myColor === "white" ? "black" : "white";
  const opponentRecord = report.opponent.record[opponentColor];
  const opponentGames = opponentRecord.w + opponentRecord.d + opponentRecord.l;
  const supportingFacts = report.insights
    .filter(insight => insight.color === opponentColor && insight.sampleSize >= 6)
    .filter(insight => !new Set(view.actions.map(action => action.sourceInsightId)).has(insight.id));
  const analysisHrefForInsight = (insight: Insight): string | null => {
    if (!reportCacheKey || !insight.recommendation.line?.san) return null;
    const canonicalUciPath = canonicalUciPathFromSanLine(insight.recommendation.line.san);
    return canonicalUciPath ? buildPositionAnalysisUrl({
      reportCacheKey,
      canonicalUciPath,
      evidenceClaimId: insight.id,
      returnPath: `${window.location.pathname}${window.location.search}#scout-brief`,
    }) : null;
  };

  const contextLine = view.formatBreakdown.filter(item => item.games > 0).map(item => `${item.games} ${item.format}`).join(" · ") || "No eligible format breakdown";
  const hasProAccess = view.tier === "pro";
  const proFindings = report.insights
    .filter(insight => insight.kind === "weakness" || insight.kind === "deviation_point")
    .sort((a, b) => (a.baseline?.delta ?? 0) - (b.baseline?.delta ?? 0) || b.sampleSize - a.sampleSize)
    .slice(0, 3);

  return (
    <div className="space-y-4">
      <section id="scout-brief" className={`${t.card} p-4 sm:p-5`} aria-labelledby="scout-brief-title">
        <header className="flex flex-wrap items-start gap-3 border-b border-current/10 pb-4">
          <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${isDark ? "bg-[#436850]/15 text-[#8dcc9b]" : "bg-[#e8f0e5] text-[#315640]"}`}>
            <Crosshair aria-hidden="true" className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="scout-brief-title" className={`text-lg font-bold tracking-tight ${t.textPrimary}`}>Scout Brief</h2>
            <p className={`mt-1 text-sm ${t.textSecondary}`}>Their two most-played openings with each color, using familiar opening names.</p>
          </div>
          <div className="text-right">
            <p className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${hasProAccess ? (isDark ? "bg-amber-400/10 text-amber-300" : "bg-amber-50 text-amber-700") : (isDark ? "bg-white/[0.07] text-white/65" : "bg-[#edf2e9] text-[#315640]")}`}>
              {hasProAccess ? <Crown aria-hidden="true" className="h-3 w-3" /> : null}
              {hasProAccess ? "Pro analysis" : "Free brief"}
            </p>
            <p className={`mt-1 text-[11px] ${t.textTertiary}`}>{view.gamesAnalyzed} games · {displayConfidence(view.freshness)} evidence</p>
          </div>
        </header>

        <div className={`mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border px-3 py-2.5 text-xs ${isDark ? "border-[#25342a] bg-black/10" : "border-[#d8e1d3] bg-[#f7faf5]"}`}>
          <ShieldCheck aria-hidden="true" className={`h-4 w-4 ${isDark ? "text-[#8dcc9b]" : "text-[#315640]"}`} />
          <span className={`font-semibold ${t.textPrimary}`}>{report.opponent.username} as {opponentColor === "white" ? "White" : "Black"}</span>
          <span className={t.textTertiary}>{opponentGames >= 8 ? `${opponentGames} eligible games` : "Insufficient evidence for primary recommendations"}</span>
          <span className={t.textTertiary}>{contextLine}</span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2" data-testid="simple-opening-brief">
          {(["white", "black"] as const).map(color => {
            const openings = view.openingSummary[color];
            return (
              <section key={color} className={`rounded-2xl border p-4 ${isDark ? "border-[#25342a] bg-black/10" : "border-[#d8e1d3] bg-[#f7faf5]"}`} aria-labelledby={`openings-as-${color}`}>
                <div className="flex items-center justify-between gap-3">
                  <h3 id={`openings-as-${color}`} className={`text-sm font-bold ${t.textPrimary}`}>As {color === "white" ? "White" : "Black"}</h3>
                  <span className={`text-[10px] font-bold uppercase tracking-[0.12em] ${t.textTertiary}`}>Top 2</span>
                </div>
                {openings.length > 0 ? (
                  <ol className="mt-3 space-y-2">
                    {openings.map((opening, index) => (
                      <li key={opening.name} className="flex items-center gap-3">
                        <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold ${isDark ? "bg-[#436850]/20 text-[#a7d8b1]" : "bg-[#e2ecde] text-[#315640]"}`}>{index + 1}</span>
                        <div className="min-w-0 flex-1">
                          <p className={`truncate text-sm font-semibold ${t.textPrimary}`}>{opening.name}</p>
                          <p className={`mt-0.5 text-[11px] ${t.textTertiary}`}>{opening.games} game{opening.games === 1 ? "" : "s"} · {Math.round(opening.share * 100)}%</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className={`mt-3 text-sm ${t.textSecondary}`}>No eligible {color} games in this report.</p>
                )}
              </section>
            );
          })}
        </div>
      </section>

      {hasProAccess ? (
        <>
          <section className={`${t.card} p-4 sm:p-5`} aria-labelledby="pro-analysis-title">
            <header className="flex flex-wrap items-start gap-3 border-b border-current/10 pb-4">
              <div className={`grid h-10 w-10 place-items-center rounded-xl ${isDark ? "bg-amber-400/10 text-amber-300" : "bg-amber-50 text-amber-700"}`}><Crown aria-hidden="true" className="h-5 w-5" /></div>
              <div className="min-w-0 flex-1">
                <h2 id="pro-analysis-title" className={`text-lg font-bold tracking-tight ${t.textPrimary}`}>Pro analysis</h2>
                <p className={`mt-1 text-sm ${t.textSecondary}`}>The lines and decision points where recent results fall furthest below their baseline.</p>
              </div>
            </header>
            {proFindings.length > 0 ? (
              <div className="mt-4 grid gap-3 lg:grid-cols-3">
                {proFindings.map((insight, index) => <ProFindingCard key={insight.id} insight={insight} index={index} analysisHref={analysisHrefForInsight(insight)} isDark={isDark} t={t} />)}
              </div>
            ) : (
              <div className={`mt-4 rounded-2xl border p-5 ${isDark ? "border-[#25342a] bg-[#101b12]" : "border-[#cdd8c6] bg-white"}`}>
                <h3 className={`text-sm font-bold ${t.textPrimary}`}>No high-confidence struggling line yet</h3>
                <p className={`mt-1 text-sm leading-relaxed ${t.textSecondary}`}>This sample does not yet support a reliable line-specific weakness. The opening overview above remains available.</p>
              </div>
            )}
          </section>

          <ForecastWalkthrough
            openingForecast={report.openingForecast}
            myColor={request.myColor}
            isDark={isDark}
            t={t}
            opponentUsername={report.opponent.username}
            analysisHrefForUciPath={reportCacheKey ? canonicalUciPath => buildPositionAnalysisUrl({
              reportCacheKey,
              canonicalUciPath,
              returnPath: `${window.location.pathname}${window.location.search}#opening-forecast`,
            }) : undefined}
          />

          <details className={`${t.card} group overflow-hidden`} open={evidenceOpen} onToggle={event => setEvidenceOpen(event.currentTarget.open)}>
            <summary aria-expanded={evidenceOpen} className={`flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#5B9A6A] sm:px-5 ${isDark ? "hover:bg-white/[0.025]" : "hover:bg-[#f7faf5]"}`}>
              <Database aria-hidden="true" className={`h-4 w-4 ${t.textTertiary}`} />
              <span className={`flex-1 text-sm font-semibold ${t.textPrimary}`}>Evidence summary</span>
              <span className={`text-[11px] ${t.textTertiary}`}>{supportingFacts.length} supporting fact{supportingFacts.length === 1 ? "" : "s"}</span>
              <ChevronRight aria-hidden="true" className={`h-4 w-4 transition-transform group-open:rotate-90 ${t.textTertiary}`} />
            </summary>
            <div className={`border-t px-4 py-4 sm:px-5 ${t.divider}`}>
              <DataQualityBanner dataQuality={report.dataQuality} isDark={isDark} />
              {supportingFacts.length > 0 && <ul className="mt-4 space-y-2">{supportingFacts.map(fact => <li key={fact.id} className={`rounded-xl border p-3 text-xs ${isDark ? "border-[#25342a] bg-black/10" : "border-[#d8e1d3] bg-[#f7faf5]"}`}><p className={`font-semibold leading-relaxed ${t.textPrimary}`}>{fact.claim}</p><p className={`mt-1 ${t.textTertiary}`}>{fact.evidence.stat} · {displayConfidence(fact.confidence)} confidence</p></li>)}</ul>}
            </div>
          </details>
        </>
      ) : (
        <aside className={`${t.card} flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5`} aria-labelledby="pro-upgrade-title">
          <div className="flex items-start gap-3">
            <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${isDark ? "bg-amber-400/10 text-amber-300" : "bg-amber-50 text-amber-700"}`}><LockKeyhole aria-hidden="true" className="h-5 w-5" /></div>
            <div><h2 id="pro-upgrade-title" className={`text-sm font-bold ${t.textPrimary}`}>Unlock detailed opponent prep</h2><p className={`mt-1 text-sm leading-relaxed ${t.textSecondary}`}>Pro adds the opponent's lowest-scoring lines, exact decision points, and board-based study paths.</p></div>
          </div>
          <a href="/pricing" className={`inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B9A6A] ${isDark ? "bg-[#436850] text-white hover:bg-[#537a5d]" : "bg-[#315640] text-white hover:bg-[#23482f]"}`}>View Pro <ChevronRight aria-hidden="true" className="h-4 w-4" /></a>
        </aside>
      )}
    </div>
  );
}
