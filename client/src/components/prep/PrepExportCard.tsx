import React from "react";
import type { ScoutReportV3 } from "../../../../shared/prepTypes";
import { projectScoutReport } from "../../../../shared/scoutReportProjection";

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

export function PrepExportCard({ report, cardRef }: PrepExportCardProps) {
  if (!report.reportSnapshot) return null;
  const view = projectScoutReport(report);
  const request = view.snapshot.activeRequest;
  const generated = new Date(view.snapshot.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <div
      ref={cardRef}
      style={{ width: 1080, minHeight: 680, padding: 48, boxSizing: "border-box", background: COLORS.page, color: COLORS.primary, fontFamily: "Inter, Helvetica Neue, Arial, sans-serif" }}
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
          <p style={{ margin: 0, color: COLORS.secondary, fontSize: 13 }}>{view.opponent.provider === "lichess" ? "Lichess" : "Chess.com"} · You play {titleCase(request.myColor)}</p>
          <p style={{ margin: "5px 0 0", color: COLORS.tertiary, fontSize: 11 }}>{view.gamesAnalyzed} games · {titleCase(view.freshness)} evidence</p>
        </div>
      </header>

      <div style={{ height: 1, background: COLORS.border, margin: "28px 0" }} />

      <section>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 13, letterSpacing: "0.1em", textTransform: "uppercase", color: COLORS.green }}>Three actions for this matchup</h2>
          <span style={{ color: COLORS.tertiary, fontSize: 11 }}>{view.gameWindow.from} – {view.gameWindow.to}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.max(1, Math.min(3, view.actions.length))}, minmax(0, 1fr))`, gap: 14 }}>
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
        </div>
      </section>

      <section style={{ display: "flex", gap: 12, marginTop: 22, padding: 16, borderRadius: 12, border: `1px solid ${COLORS.border}` }}>
        {view.formatBreakdown.map(item => (
          <div key={item.format} style={{ flex: 1 }}>
            <p style={{ margin: 0, color: COLORS.tertiary, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>{item.format}</p>
            <p style={{ margin: "4px 0 0", color: COLORS.secondary, fontSize: 13, fontWeight: 700 }}>{item.games} games</p>
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
