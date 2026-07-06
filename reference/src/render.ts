// src/render.ts — ScoutReportV3 → markdown prep sheet
import type { ForecastBranch, Insight, ScoutReportV3 } from "./types.ts";

const CONF: Record<Insight["confidence"], string> = { high: "HIGH", medium_high: "MED-HIGH", medium: "MEDIUM", low: "LOW" };
const pct = (x: number) => `${Math.round(x * 100)}%`;

function insightCard(i: Insight): string {
  const links = i.evidence.games.map(g => `[${g.result} ${g.date}](${g.url})`).join(" · ");
  const base = i.baseline ? `\n- **Baseline:** ${i.baseline.metric} ${pct(i.baseline.value)} → delta ${i.baseline.delta >= 0 ? "+" : "−"}${Math.abs(Math.round(i.baseline.delta * 100))}pts` : "";
  const line = i.recommendation.line?.san ? `\n- **Line:** \`${i.recommendation.line.san}\`` : "";
  return `**${i.claim}**
- **Evidence:** ${i.evidence.stat} — ${links}${base}
- **Read:** ${i.interpretation}
- **Prep:** ${i.recommendation.action}${line}
- **Confidence:** ${CONF[i.confidence]} · n=${i.sampleSize}\n`;
}

function tree(branches: ForecastBranch[], depth = 0): string {
  return branches.map(b => {
    const pad = "  ".repeat(depth);
    return `${pad}- \`${b.moveSan}\` — ${b.count} games (${pct(b.pct)}), scores ${pct(b.score)}\n${tree(b.children, depth + 1)}`;
  }).join("");
}

export function renderMarkdown(r: ScoutReportV3): string {
  const by = new Map(r.insights.map(i => [i.id, i]));
  const cards = (ids: string[]) => ids.map(id => insightCard(by.get(id)!)).join("\n");
  const rw = r.opponent.record.white, rb = r.opponent.record.black;
  const tcs = Object.entries(r.opponent.timeControlSplit).map(([k, v]) => `${k} ${v.games} (${pct(v.score)})`).join(" · ");
  const out: string[] = [];
  out.push(`# Scouting Report — ${r.opponent.username}  \n*${r.provider} · engine ${r.engineVersion} · window ${r.dataQuality.window.from} → ${r.dataQuality.window.to} · generated ${r.generatedAt.slice(0, 10)}*\n`);
  out.push(`## Data quality — grade ${r.dataQuality.grade}
${r.dataQuality.parsed} usable of ${r.dataQuality.fetched} fetched (${r.dataQuality.quarantined} quarantined). Rated share ${pct(r.dataQuality.ratedShare)}.
${r.dataQuality.notes.map(n => `- ${n}`).join("\n")}\n`);
  out.push(`## Opponent profile
Record as White ${rw.w}-${rw.d}-${rw.l}, as Black ${rb.w}-${rb.d}-${rb.l}. Avg rating ${r.opponent.avgRating ?? "n/a"}. Time controls: ${tcs}.\n`);
  if (r.sections.matchupSummary.length) out.push(`## Matchup summary\n${cards(r.sections.matchupSummary)}`);
  out.push(`## Opening forecast — they have White\n${tree(r.openingForecast.white) || "_Not enough White games._"}\n## Opening forecast — they have Black\n${tree(r.openingForecast.black) || "_Not enough Black games._"}\n`);
  if (r.sections.weaknesses.length) out.push(`## Weaknesses to target\n${cards(r.sections.weaknesses)}`);
  if (r.sections.strengths.length) out.push(`## Strengths to respect\n${cards(r.sections.strengths)}`);
  if (r.sections.ifYouHaveWhite.length) out.push(`## If you have White\n${cards(r.sections.ifYouHaveWhite)}`);
  if (r.sections.ifYouHaveBlack.length) out.push(`## If you have Black\n${cards(r.sections.ifYouHaveBlack)}`);
  if (r.sections.deviationPoints.length) out.push(`## Deviation points\n${cards(r.sections.deviationPoints)}`);
  if (r.sections.behavior.length) out.push(`## Behavior\n${cards(r.sections.behavior)}`);
  if (r.sections.weakSignals.length) out.push(`## Weak signals (below evidence gates — directional only)\n${r.sections.weakSignals.map(id => `- ${by.get(id)!.claim} *(n=${by.get(id)!.sampleSize}, ${CONF[by.get(id)!.confidence]})*`).join("\n")}\n`);
  if (r.sections.prepChecklist.length) out.push(`## Prep checklist\n${r.sections.prepChecklist.map((c, i) => `${i + 1}. ${c.text}`).join("\n")}\n`);
  out.push(`---\n*Guardrails: ${r.guardLog.droppedInsights} candidate insight(s) dropped (${Object.entries(r.guardLog.reasons).map(([k, v]) => `${k}×${v}`).join(", ") || "none"}). Nothing below the evidence gates was padded with filler.*`);
  return out.join("\n");
}
