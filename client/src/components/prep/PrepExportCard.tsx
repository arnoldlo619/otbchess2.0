import React from "react";
import type { ScoutReportV3 } from "../../../../shared/prepTypes";
import { projectScoutReport } from "../../../../shared/scoutReportProjection";
import { formatScoutDateUtc, formatScoutDateWindowUtc } from "../../lib/scoutDateDisplay";

const LOGO_URL = "https://d2xsxph8kpxj0f.cloudfront.net/117675823/J6FsDoRMH9x5xbUvpyzxyf/otb-logo-exclamation_0b3fa613.png";
const COLORS = {
  page: "#09120b",
  surface: "#0f1c11",
  border: "#25342a",
  green: "#86c995",
  primary: "#f4f8f2",
  secondary: "#b6c1b5",
  tertiary: "#788579",
};

interface PrepExportCardProps {
  report: ScoutReportV3;
  cardRef?: React.RefObject<HTMLDivElement | null>;
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function winRate(record: { w: number; d: number; l: number }): number | null {
  const total = record.w + record.d + record.l;
  return total > 0 ? Math.round((record.w / total) * 100) : null;
}

type OpeningFrequency = {
  color: "white" | "black";
  games: number;
  name: string;
  share: number;
};

function mostPlayedOpenings(openingSummary: ReturnType<typeof projectScoutReport>["openingSummary"]): OpeningFrequency[] {
  return (["white", "black"] as const)
    .flatMap(color => openingSummary[color].map(opening => ({ color, games: opening.games, name: opening.name, share: opening.share })))
    .filter(opening => opening.games > 0)
    .sort((a, b) => b.games - a.games || b.share - a.share || a.name.localeCompare(b.name))
    .slice(0, 4);
}

export function PrepExportCard({ report, cardRef }: PrepExportCardProps) {
  if (!report.reportSnapshot) return null;
  const view = projectScoutReport(report);
  const generated = formatScoutDateUtc(view.snapshot.createdAt);
  const avgRating = view.opponent.avgRating;
  const whiteWinRate = winRate(report.opponent.record.white);
  const blackWinRate = winRate(report.opponent.record.black);
  const colorSummary = `${whiteWinRate ?? "—"}% as White · ${blackWinRate ?? "—"}% as Black`;
  const summaryStats = [["Opponent win rate", colorSummary], ["Avg rating", avgRating ?? "Not available"]] as const;
  const isPro = view.tier === "pro";
  const openingFrequencies = mostPlayedOpenings(view.openingSummary);
  const maxOpeningGames = Math.max(1, ...openingFrequencies.map(opening => opening.games));

  return (
    <div
      ref={cardRef}
      style={{ width: 1080, minHeight: 900, padding: 48, boxSizing: "border-box", background: COLORS.page, color: COLORS.primary, fontFamily: "Inter, Helvetica Neue, Arial, sans-serif" }}
    >
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <img src={LOGO_URL} alt="ChessOTB.Club" style={{ width: 44, height: 44, borderRadius: 11 }} />
          <div>
            <p style={{ margin: 0, color: COLORS.tertiary, fontSize: 11, fontWeight: 700, letterSpacing: "0.13em", textTransform: "uppercase" }}>Matchup Prep · Scout Brief</p>
            <h1 style={{ margin: "5px 0 0", fontSize: 27, lineHeight: 1.1 }}>vs. {view.opponent.username}</h1>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ margin: 0, color: COLORS.secondary, fontSize: 13 }}>{view.opponent.provider === "lichess" ? "Lichess" : "Chess.com"} · Opponent overview</p>
          <p style={{ margin: "5px 0 0", color: COLORS.tertiary, fontSize: 11 }}>{view.gamesAnalyzed} games · {titleCase(view.freshness)} evidence</p>
        </div>
      </header>

      <div style={{ height: 1, background: COLORS.border, margin: "28px 0" }} />

      <section>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 13, letterSpacing: "0.1em", textTransform: "uppercase", color: COLORS.green }}>{isPro ? "Detailed prep targets" : "Top openings"}</h2>
          <span style={{ color: COLORS.tertiary, fontSize: 11 }}>{formatScoutDateWindowUtc(view.gameWindow.from, view.gameWindow.to)}</span>
        </div>
        {isPro ? <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.max(1, Math.min(3, view.actions.length))}, minmax(0, 1fr))`, gap: 14 }}>
          {view.actions.length > 0 ? view.actions.map((action, index) => (
            <article key={action.id} style={{ minHeight: 250, padding: 20, borderRadius: 14, border: `1px solid ${COLORS.border}`, background: COLORS.surface }}>
              <p style={{ margin: 0, color: COLORS.green, fontSize: 11, fontWeight: 800, letterSpacing: "0.08em" }}>ACTION {index + 1}</p>
              <h3 style={{ margin: "12px 0 0", fontSize: 17, lineHeight: 1.3 }}>{action.title}</h3>
              <p style={{ margin: "14px 0 0", color: COLORS.primary, fontSize: 14, lineHeight: 1.55 }}>{action.action.label}</p>
              <p style={{ margin: "14px 0 0", color: COLORS.secondary, fontSize: 12, lineHeight: 1.5 }}>{action.whyItMatters}</p>
              <p style={{ margin: "16px 0 0", color: COLORS.tertiary, fontSize: 11 }}>n={action.evidence.relevantGames} · {titleCase(action.confidence.replace("_", " "))} confidence</p>
            </article>
          )) : (
            <div style={{ gridColumn: "1 / -1", padding: 24, borderRadius: 14, border: `1px solid ${COLORS.border}`, background: COLORS.surface }}>
              <p style={{ margin: 0, color: COLORS.secondary, fontSize: 14 }}>Insufficient current evidence for a primary recommendation.</p>
            </div>
          )}
        </div> : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 14 }}>
            {(["white", "black"] as const).map(color => (
              <article key={color} style={{ minHeight: 190, padding: 20, borderRadius: 14, border: `1px solid ${COLORS.border}`, background: COLORS.surface }}>
                <p style={{ margin: 0, color: COLORS.green, fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>As {titleCase(color)}</p>
                {view.openingSummary[color].length > 0 ? view.openingSummary[color].map((opening, index) => (
                  <div key={opening.name} style={{ display: "flex", alignItems: "center", gap: 12, marginTop: index === 0 ? 18 : 14 }}>
                    <span style={{ display: "grid", width: 25, height: 25, placeItems: "center", borderRadius: "50%", background: "#17301d", color: COLORS.green, fontSize: 11, fontWeight: 800 }}>{index + 1}</span>
                    <div><p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{opening.name}</p><p style={{ margin: "4px 0 0", color: COLORS.tertiary, fontSize: 11 }}>{opening.games} game{opening.games === 1 ? "" : "s"} · {Math.round(opening.share * 100)}%</p></div>
                  </div>
                )) : <p style={{ margin: "18px 0 0", color: COLORS.secondary, fontSize: 13 }}>No eligible games in this report.</p>}
              </article>
            ))}
          </div>
        )}
      </section>

      <section style={{ marginTop: 22, padding: 20, borderRadius: 14, border: `1px solid ${COLORS.border}`, background: COLORS.surface }} aria-labelledby="opening-frequency-chart-title">
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, marginBottom: 16 }}>
          <div>
            <p style={{ margin: 0, color: COLORS.green, fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>Opening frequency</p>
            <h2 id="opening-frequency-chart-title" style={{ margin: "5px 0 0", fontSize: 18, lineHeight: 1.2 }}>Most-played openings</h2>
          </div>
          <span style={{ color: COLORS.tertiary, fontSize: 11 }}>Top {openingFrequencies.length || 0} observed</span>
        </div>
        {openingFrequencies.length > 0 ? (
          <div role="img" aria-label={`Opening frequency chart for ${view.opponent.username}: ${openingFrequencies.map(opening => `${opening.name} as ${titleCase(opening.color)}, ${opening.games} games`).join("; ")}`}>
            {openingFrequencies.map(opening => {
              const width = `${Math.max(8, Math.round((opening.games / maxOpeningGames) * 100))}%`;
              const colorLabel = titleCase(opening.color);
              const barColor = opening.color === "white" ? COLORS.green : "#9ab8eb";
              return (
                <div key={`${opening.color}:${opening.name}`} style={{ display: "grid", gridTemplateColumns: "minmax(240px, 0.9fr) minmax(250px, 1.3fr) 118px", alignItems: "center", gap: 16, marginTop: 13 }}>
                  <div>
                    <p style={{ margin: 0, color: COLORS.primary, fontSize: 14, fontWeight: 700 }}>{opening.name}</p>
                    <p style={{ margin: "4px 0 0", color: COLORS.secondary, fontSize: 11 }}>{colorLabel} · {opening.games} game{opening.games === 1 ? "" : "s"} · {Math.round(opening.share * 100)}%</p>
                  </div>
                  <div style={{ height: 10, overflow: "hidden", borderRadius: 999, background: COLORS.border }} aria-hidden="true">
                    <div data-testid="opening-frequency-bar" style={{ width, height: "100%", borderRadius: 999, background: barColor }} />
                  </div>
                  <p style={{ margin: 0, color: COLORS.primary, fontSize: 12, fontWeight: 700, textAlign: "right" }}>{opening.games} game{opening.games === 1 ? "" : "s"} · {Math.round(opening.share * 100)}%</p>
                </div>
              );
            })}
          </div>
        ) : <p style={{ margin: 0, color: COLORS.secondary, fontSize: 13 }}>No opening-frequency data is available in this report.</p>}
      </section>

      <section style={{ display: "flex", gap: 12, marginTop: 22, padding: 16, borderRadius: 12, border: `1px solid ${COLORS.border}` }}>
        {view.formatBreakdown.map(item => (
          <div key={item.format} style={{ flex: 1 }}>
            <p style={{ margin: 0, color: COLORS.tertiary, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>{item.format}</p>
            <p style={{ margin: "4px 0 0", color: COLORS.secondary, fontSize: 13, fontWeight: 700 }}>{item.games} games</p>
          </div>
        ))}
        {summaryStats.map(([label, value]) => (
          <div key={label} style={{ flex: 1 }}>
            <p style={{ margin: 0, color: COLORS.tertiary, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</p>
            <p style={{ margin: "4px 0 0", color: COLORS.secondary, fontSize: 13, fontWeight: 700 }}>{value}</p>
          </div>
        ))}
      </section>

      <footer style={{ display: "flex", justifyContent: "space-between", marginTop: 28, paddingTop: 18, borderTop: `1px solid ${COLORS.border}`, color: COLORS.tertiary, fontSize: 11 }}>
        <span>Generated {generated} · Snapshot {view.snapshot.id}</span>
        <span>ChessOTB.Club</span>
      </footer>
    </div>
  );
}
