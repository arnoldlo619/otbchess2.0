/**
 * PrepExportCard.tsx
 *
 * A clean, self-contained export card for the Matchup Prep report.
 * Rendered off-screen (or in a modal preview) and captured via html-to-image.
 *
 * Layout (1080px wide, dark theme):
 *   - Header: ChessOTB.Club logo + opponent username + data quality grade
 *   - Prep Snapshot: top 3 insights
 *   - Game Plan: If White / If Black
 *   - Prep Checklist
 *   - Footer: generated timestamp + chessotb.club branding
 */

import React from "react";
import type { ScoutReportV3, Insight } from "../../../../shared/prepTypes";

const LOGO_URL = "https://d2xsxph8kpxj0f.cloudfront.net/117675823/J6FsDoRMH9x5xbUvpyzxyf/otb-logo-exclamation_0b3fa613.png";
const CHESSOTB_LOGO = "https://d2xsxph8kpxj0f.cloudfront.net/117675823/J6FsDoRMH9x5xbUvpyzxyf/otb-logo-exclamation_0b3fa613.png";

const DARK_BG = "#0a1a0c";
const CARD_BG = "#0d1a0f";
const BORDER = "#1e2e22";
const GREEN = "#4ade80";
const GREEN_DIM = "#2d6a3f";
const TEXT_PRIMARY = "#f0fdf4";
const TEXT_SECONDARY = "rgba(240,253,244,0.65)";
const TEXT_TERTIARY = "rgba(240,253,244,0.40)";

function gradeColor(grade: string) {
  if (grade === "A") return "#4ade80";
  if (grade === "B") return "#86efac";
  if (grade === "C") return "#fbbf24";
  return "#f87171";
}

function confidenceColor(conf: string) {
  if (conf === "high") return "#4ade80";
  if (conf === "medium") return "#86efac";
  return "#6b7280";
}

function InsightRow({ ins }: { ins: Insight }) {
  const kindLabel: Record<string, string> = {
    tendency: "Tendency",
    strength: "Strength",
    weakness: "Weakness",
    deviation_point: "Deviation",
    response_pattern: "Pattern",
    time_pressure: "Time",
  };
  return (
    <div style={{
      display: "flex",
      gap: 12,
      padding: "12px 16px",
      background: CARD_BG,
      borderRadius: 10,
      border: `1px solid ${BORDER}`,
      marginBottom: 8,
    }}>
      <div style={{
        width: 4,
        borderRadius: 2,
        background: confidenceColor(ins.confidence),
        flexShrink: 0,
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: confidenceColor(ins.confidence),
            background: `${confidenceColor(ins.confidence)}20`,
            padding: "2px 6px",
            borderRadius: 4,
          }}>{kindLabel[ins.kind] ?? ins.kind}</span>
          <span style={{ fontSize: 10, color: TEXT_TERTIARY }}>{ins.evidence.stat}</span>
        </div>
        <p style={{ fontSize: 14, color: TEXT_PRIMARY, margin: 0, lineHeight: 1.5, fontWeight: 500 }}>{ins.claim}</p>
        <p style={{ fontSize: 12, color: TEXT_SECONDARY, margin: "4px 0 0", lineHeight: 1.4 }}>{ins.recommendation.action}</p>
      </div>
    </div>
  );
}

interface PrepExportCardProps {
  report: ScoutReportV3;
  myColor?: "white" | "black";
  /** Ref to attach to the root div for html-to-image capture */
  cardRef?: React.RefObject<HTMLDivElement | null>;
}

export function PrepExportCard({ report, myColor, cardRef }: PrepExportCardProps) {
  const topInsights = [...report.insights]
    .sort((a, b) => {
      const confOrder = { high: 3, medium: 2, low: 1 };
      return (confOrder[b.confidence as keyof typeof confOrder] ?? 0) - (confOrder[a.confidence as keyof typeof confOrder] ?? 0);
    })
    .slice(0, 4);

  const ifWhiteIds = new Set(report.sections.ifYouHaveWhite);
  const ifBlackIds = new Set(report.sections.ifYouHaveBlack);
  const ifWhiteInsights = report.insights.filter(i => ifWhiteIds.has(i.id)).slice(0, 3);
  const ifBlackInsights = report.insights.filter(i => ifBlackIds.has(i.id)).slice(0, 3);
  const checklist = report.sections.prepChecklist.slice(0, 6);

  const grade = report.dataQuality.grade;
  const opponent = report.opponent.username;
  const providerLabel = report.provider === "lichess" ? "Lichess" : "Chess.com";
  const avgRating = report.opponent.avgRating;
  const parsedGames = report.dataQuality.parsed;
  const generatedAt = new Date(report.generatedAt).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric"
  });

  const colorLabel = myColor === "white" ? "You play White" : myColor === "black" ? "You play Black" : undefined;

  return (
    <div
      ref={cardRef}
      style={{
        width: 1080,
        background: DARK_BG,
        fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
        color: TEXT_PRIMARY,
        padding: 48,
        boxSizing: "border-box",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* ── Subtle center watermark ── */}
      <div style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        pointerEvents: "none",
        userSelect: "none",
        opacity: 0.03,
        zIndex: 0,
      }}>
        <img
          src={CHESSOTB_LOGO}
          alt=""
          style={{ width: 320, height: 320, borderRadius: 48 }}
        />
      </div>

      {/* ── All content sits above watermark ── */}
      <div style={{ position: "relative", zIndex: 1 }}>
      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <img src={LOGO_URL} alt="ChessOTB.Club" style={{ width: 40, height: 40, borderRadius: 8 }} />
          <div>
            <div style={{ fontSize: 11, color: TEXT_TERTIARY, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 2 }}>
              Matchup Prep Report
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: TEXT_PRIMARY }}>
              vs. {opponent}
              <span style={{ fontSize: 13, fontWeight: 400, color: TEXT_SECONDARY, marginLeft: 10 }}>
                {providerLabel}{avgRating ? ` · ~${avgRating} avg` : ""}
              </span>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {colorLabel && (
            <div style={{
              fontSize: 12, fontWeight: 600,
              background: myColor === "white" ? "#f0fdf4" : "#1a1a1a",
              border: `1px solid ${BORDER}`,
              padding: "4px 10px", borderRadius: 6,
              color: myColor === "white" ? "#1a1a1a" : "#f0fdf4",
            }}>{colorLabel}</div>
          )}
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            background: `${gradeColor(grade)}15`,
            border: `1px solid ${gradeColor(grade)}40`,
            borderRadius: 10, padding: "8px 16px",
          }}>
            <span style={{ fontSize: 28, fontWeight: 800, color: gradeColor(grade), lineHeight: 1 }}>{grade}</span>
            <span style={{ fontSize: 10, color: TEXT_TERTIARY, marginTop: 2 }}>{parsedGames} games</span>
          </div>
        </div>
      </div>

      {/* ── Divider ── */}
      <div style={{ height: 1, background: BORDER, marginBottom: 32 }} />

      {/* ── Two-column layout ── */}
      <div style={{ display: "flex", gap: 24 }}>
        {/* Left column: Prep Snapshot + Game Plan */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Prep Snapshot */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <div style={{ width: 3, height: 16, background: GREEN, borderRadius: 2 }} />
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: TEXT_TERTIARY }}>
                Prep Snapshot
              </span>
            </div>
            {topInsights.map(ins => <InsightRow key={ins.id} ins={ins} />)}
          </div>

          {/* Game Plan: If White */}
          {ifWhiteInsights.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <div style={{ width: 3, height: 16, background: "#f0fdf4", borderRadius: 2 }} />
                <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: TEXT_TERTIARY }}>
                  If You Have White
                </span>
              </div>
              {ifWhiteInsights.map(ins => <InsightRow key={ins.id} ins={ins} />)}
            </div>
          )}

          {/* Game Plan: If Black */}
          {ifBlackInsights.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <div style={{ width: 3, height: 16, background: "#6b7280", borderRadius: 2 }} />
                <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: TEXT_TERTIARY }}>
                  If You Have Black
                </span>
              </div>
              {ifBlackInsights.map(ins => <InsightRow key={ins.id} ins={ins} />)}
            </div>
          )}
        </div>

        {/* Right column: Prep Checklist + Data Quality */}
        <div style={{ width: 320, flexShrink: 0 }}>
          {/* Prep Checklist */}
          {checklist.length > 0 && (
            <div style={{
              background: CARD_BG,
              border: `1px solid ${BORDER}`,
              borderRadius: 12,
              padding: 20,
              marginBottom: 20,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <div style={{ width: 3, height: 16, background: GREEN, borderRadius: 2 }} />
                <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: TEXT_TERTIARY }}>
                  Prep Checklist
                </span>
              </div>
              {checklist.map((item, i) => (
                <div key={i} style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: 4,
                    border: `1.5px solid ${GREEN_DIM}`,
                    flexShrink: 0, marginTop: 1,
                  }} />
                  <span style={{ fontSize: 13, color: TEXT_SECONDARY, lineHeight: 1.4 }}>{item.text}</span>
                </div>
              ))}
            </div>
          )}

          {/* Data Quality */}
          <div style={{
            background: CARD_BG,
            border: `1px solid ${BORDER}`,
            borderRadius: 12,
            padding: 20,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <div style={{ width: 3, height: 16, background: TEXT_TERTIARY, borderRadius: 2 }} />
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: TEXT_TERTIARY }}>
                Data Quality
              </span>
            </div>
            {[
              ["Games analyzed", parsedGames],
              ["Data grade", grade],
              ["Avg rating", avgRating ?? "N/A"],
              ["Window", `${report.dataQuality.window.from} – ${report.dataQuality.window.to}`],
            ].map(([label, value]) => (
              <div key={String(label)} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: TEXT_TERTIARY }}>{label}</span>
                <span style={{ fontSize: 12, color: TEXT_SECONDARY, fontWeight: 600 }}>{String(value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <div style={{ height: 1, background: BORDER, margin: "32px 0 20px" }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        {/* Logo + wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img
            src={CHESSOTB_LOGO}
            alt="ChessOTB.Club"
            style={{ width: 28, height: 28, borderRadius: 6, flexShrink: 0 }}
          />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: TEXT_PRIMARY, letterSpacing: "0.02em" }}>
              ChessOTB.Club
            </div>
            <div style={{ fontSize: 10, color: TEXT_TERTIARY, marginTop: 1 }}>
              Matchup Prep Report
            </div>
          </div>
        </div>
        {/* Right: timestamp + URL */}
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, color: TEXT_TERTIARY }}>Generated {generatedAt}</div>
          <div style={{ fontSize: 10, color: TEXT_TERTIARY, marginTop: 2, letterSpacing: "0.04em" }}>
            chessotb.club/prep
          </div>
        </div>
      </div>

      {/* ── Bottom accent bar ── */}
      <div style={{
        height: 3,
        background: `linear-gradient(90deg, ${GREEN} 0%, #22c55e 50%, transparent 100%)`,
        borderRadius: "0 0 4px 4px",
        marginTop: 20,
        opacity: 0.7,
      }} />
      </div>{/* close content z-index wrapper */}
    </div>
  );
}
