// server/prep/insightEngine.ts — Wilson interval, confidence tiers, insight synthesis.
// Ported from reference/src/engine.ts (synthesize + wilson + confidence sections).
// Improvement over reference: recency weighting (games in last 90 days count ~1.5× in
// confidence tiers). All other behavior is identical to the reference.

import type { Color, FetchOpts, Insight, ParsedGame } from "../../shared/prepTypes.js";
import { buildFacts, familyOf, forecast, grp, sample } from "./facts.js";

const pct = (x: number): string => `${Math.round(x * 100)}%`;
const dateOf = (t: number): string => new Date(t * 1000).toISOString().slice(0, 10);

/* ---------------- Wilson 95% interval ----------------------------------------- */
export function wilson(
  scoreSum: number,
  n: number
): { lo: number; hi: number; width: number } {
  if (!n) return { lo: 0, hi: 1, width: 1 };
  const z = 1.96, p = scoreSum / n, d = 1 + (z * z) / n;
  const mid = (p + (z * z) / (2 * n)) / d;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return { lo: Math.max(0, mid - half), hi: Math.min(1, mid + half), width: 2 * half };
}

/* ---------------- Confidence tiers with recency weighting ----------------------
   Improvement over reference: games in the last 90 days count ~1.5× in the
   effective-n calculation for confidence tier assignment only (not for score/CI).
   This makes fresh data promote confidence faster while keeping stats honest.
----------------------------------------------------------------------------- */
const NINETY_DAYS_S = 90 * 24 * 3600;

export function effectiveN(games: ParsedGame[], nowS?: number): number {
  const now = nowS ?? Math.floor(Date.now() / 1000);
  return games.reduce((sum, g) => {
    const age = now - g.endTime;
    return sum + (age <= NINETY_DAYS_S ? 1.5 : 1);
  }, 0);
}

export function confidence(
  games: ParsedGame[],
  width: number
): Insight["confidence"] {
  const en = effectiveN(games);
  if (en >= 15 && width <= 0.30) return "high";
  if (en >= 10) return "medium_high";
  if (en >= 6) return "medium";
  return "low";
}

/* ---------------- Deviation points -------------------------------------------- */
function deviationInsight(
  color: Color,
  opening: string,
  gs: ParsedGame[],
  windowMeta: Insight["evidence"]["window"]
): Insight | null {
  const wins = gs.filter(g => g.scoutedScore === 1);
  const losses = gs.filter(g => g.scoutedScore === 0);
  if (gs.length < 5 || wins.length < 2 || losses.length < 2) return null;

  const startParity = color === "white" ? 0 : 1;
  const maxPly = Math.min(16, ...gs.map(g => g.plies.length));

  for (let ply = startParity; ply < maxPly; ply += 2) {
    const plur = (set: ParsedGame[]): { move: string; n: number } => {
      const m = new Map<string, number>();
      for (const g of set) {
        const s = g.plies[ply]?.san;
        if (s) m.set(s, (m.get(s) ?? 0) + 1);
      }
      let best = "", bn = 0;
      for (const [k, v] of Array.from(m.entries())) if (v > bn) { best = k; bn = v; }
      return { move: best, n: bn };
    };

    // Require identical prefix across the whole group so the branch point is real
    const prefixSame = gs.every(g =>
      g.plies.slice(0, ply).every((p, i) => p.san === gs[0].plies[i]?.san)
    );
    if (!prefixSame) return null;

    const w = plur(wins), l = plur(losses);
    if (w.move && l.move && w.move !== l.move && w.n >= 2 && l.n >= 2) {
      const moveNo = Math.floor(ply / 2) + 1;
      const prefix = gs[0].plies
        .slice(0, ply)
        .map((p, i) => (i % 2 === 0 ? `${i / 2 + 1}.${p.san}` : p.san))
        .join(" ");

      const wi = wilson(gs.reduce((s, g) => s + g.scoutedScore, 0), gs.length);
      return {
        id: `dev:${color}:${opening}:${ply}`,
        kind: "deviation_point",
        color,
        role: "plays",
        claim: `In the ${opening} as ${color}, their move ${moveNo} splits results: ${l.move} appears in ${l.n} of their losses, while ${w.move} appears in ${w.n} of their wins.`,
        evidence: {
          stat: `${gs.length} games in this line (${wins.length}W/${losses.length}L among decisive); branch at move ${moveNo} after ${prefix || "the start position"}`,
          games: sample([...losses, ...wins]),
          window: windowMeta,
        },
        interpretation: `The position before move ${moveNo} is a decision point they handle inconsistently; the ${l.move} branch is where their results collapse.`,
        recommendation: {
          action: `Steer toward the position after ${prefix || "move 1"} and study both branches: punish ${l.move}, and have a plan ready against ${w.move}.`,
          line: { san: prefix, validated: true },
        },
        confidence: confidence(gs, wi.width),
        sampleSize: gs.length,
        ply,
      };
    }
  }
  return null;
}

/* ---------------- Main synthesis ---------------------------------------------- */
export function synthesize(parsed: ParsedGame[], o: FetchOpts): Insight[] {
  const windowMeta: Insight["evidence"]["window"] = {
    from: dateOf(Math.min(...parsed.map(g => g.endTime))),
    to: dateOf(Math.max(...parsed.map(g => g.endTime))),
    timeClasses: o.timeClasses,
    ratedOnly: o.ratedOnly,
  };

  const { byColor, fam, responses, firstMoves } = buildFacts(parsed);
  const out: Insight[] = [];

  const overall: Record<Color, number> = {
    white: byColor.white.length ? grp(byColor.white).score / byColor.white.length : 0.5,
    black: byColor.black.length ? grp(byColor.black).score / byColor.black.length : 0.5,
  };

  // 1) First-move tendency as White
    const fmSorted = Array.from(firstMoves.entries() as IterableIterator<[string, ParsedGame[]]>).sort((a, b) => b[1].length - a[1].length);
  if (fmSorted.length && byColor.white.length >= 4) {
    const [mv, gs] = fmSorted[0];
    const g = grp(gs);
    const w = wilson(g.score, g.n);
    out.push({
      id: `tend:white:1.${mv}`,
      kind: "opening_tendency",
      color: "white",
      role: "plays",
      claim: `As White they open 1.${mv} in ${g.n} of ${byColor.white.length} games (${pct(g.n / byColor.white.length)}), scoring ${pct(g.score / g.n)}.`,
      evidence: {
        stat: `${g.n}/${byColor.white.length} White games begin 1.${mv}`,
        games: sample(gs),
        window: windowMeta,
      },
      interpretation: `Your Black preparation can be narrowed to 1.${mv} systems with ${pct(g.n / byColor.white.length)} coverage of their White games.`,
      recommendation: {
        action: `Prepare one reliable defense to 1.${mv} and rehearse it to move 8–10; skim their secondary tries only briefly.`,
      },
      confidence: confidence(gs, w.width),
      sampleSize: g.n,
    });
  }

  // 2) Response patterns as Black (vs 1.e4 / 1.d4 / 1.c4 / 1.Nf3) — plays by construction
  for (const first of Object.keys(responses)) {
    const table = Array.from(responses[first].entries() as IterableIterator<[string, ParsedGame[]]>).sort((a, b) => b[1].length - a[1].length);
    const total = table.reduce((s, [, v]) => s + v.length, 0);
    if (!table.length || total < 4) continue;

    const [reply, gs] = table[0];
    const g = grp(gs);
    const w = wilson(g.score, g.n);
    const base = overall.black;
    const delta = g.score / g.n - base;
    const isWeak = g.n >= 6 && g.score / g.n <= 0.45 && delta <= -0.12;
    const isStrong = g.n >= 6 && g.score / g.n >= 0.55 && delta >= 0.12;

    out.push({
      id: `resp:black:1.${first}:${reply}`,
      kind: isWeak ? "weakness" : isStrong ? "strength" : "response_pattern",
      color: "black",
      role: "plays",
      claim: `Against 1.${first} they choose 1...${reply} in ${g.n} of ${total} games (${pct(g.n / total)}), scoring ${pct(g.score / g.n)}.`,
      evidence: {
        stat: `${g.n}/${total} games vs 1.${first}; score ${g.score}/${g.n} (95% CI ${pct(w.lo)}–${pct(w.hi)})`,
        games: sample(gs),
        window: windowMeta,
      },
      interpretation: isWeak
        ? `This is their default reply to 1.${first} and it underperforms their overall Black score (${pct(base)}) by ${Math.round(-delta * 100)} points — a preparable target.`
        : isStrong
        ? `They are comfortable here — ${Math.round(delta * 100)} points above their Black baseline (${pct(base)}). Avoid their main strength unless you have something concrete.`
        : `Predictable first branch: with 1.${first} you will reach 1...${reply} positions most of the time.`,
      recommendation: {
        action: isWeak
          ? `Open 1.${first} and prepare your main line against 1...${reply} to move 10; their record says the pressure point is real.`
          : `Know your setup against 1...${reply} after 1.${first}; expect it ${pct(g.n / total)} of the time.`,
      },
      confidence: confidence(gs, w.width),
      sampleSize: g.n,
      ...(isWeak || isStrong ? { baseline: { metric: "overall score as Black", value: base, delta } } : {}),
    });
  }

  // 3) Per-family weakness/strength scan (both colors), baseline-relative
  for (const c of ["white", "black"] as Color[]) {
    for (const [name, gs] of Array.from(fam[c].entries())) {
      if (name === "Other / irregular") continue;
      const g = grp(gs);
      if (g.n < 6) continue;
      const p = g.score / g.n;
      const base = overall[c];
      const delta = p - base;
      const w = wilson(g.score, g.n);

      if (p <= 0.45 && delta <= -0.12) {
        out.push({
          id: `weak:${c}:${name}`,
          kind: "weakness",
          color: c,
          role: "plays",
          claim: `They score ${pct(p)} in ${name} positions as ${c} (${g.n} games) versus ${pct(base)} overall as ${c}.`,
          evidence: {
            stat: `score ${g.score}/${g.n}; 95% CI ${pct(w.lo)}–${pct(w.hi)}; baseline delta −${Math.round(-delta * 100)}pts`,
            games: sample(gs.filter((x: ParsedGame) => x.scoutedScore === 0).concat(gs)),
            window: windowMeta,
          },
          interpretation: `A repeatable structure where their results drop well below their own level — the highest-value prep target in this report.`,
          recommendation: {
            action: `Steer the game toward ${name} structures when you have the ${c === "white" ? "Black" : "White"} pieces; rehearse the first 10 moves of your chosen line.`,
          },
          confidence: confidence(gs, w.width),
          sampleSize: g.n,
          baseline: { metric: `overall score as ${c}`, value: base, delta },
        });
      } else if (p >= 0.62 && delta >= 0.12) {
        out.push({
          id: `str:${c}:${name}`,
          kind: "strength",
          color: c,
          role: "plays",
          claim: `They score ${pct(p)} in ${name} positions as ${c} (${g.n} games), ${Math.round(delta * 100)} points above their ${c} baseline.`,
          evidence: {
            stat: `score ${g.score}/${g.n}; 95% CI ${pct(w.lo)}–${pct(w.hi)}`,
            games: sample(gs),
            window: windowMeta,
          },
          interpretation: `Their comfort zone. Entering it hands them familiarity for free.`,
          recommendation: {
            action: `Choose a move order that sidesteps ${name} structures rather than testing them in it.`,
          },
          confidence: confidence(gs, w.width),
          sampleSize: g.n,
          baseline: { metric: `overall score as ${c}`, value: base, delta },
        });
      }
    }
  }

  // 4) Deviation points per (color, family)
  for (const c of ["white", "black"] as Color[]) {
    for (const [name, gs] of Array.from(fam[c].entries())) {
      if (name === "Other / irregular") continue;
      const ins = deviationInsight(c, name, gs, windowMeta);
      if (ins) out.push(ins);
    }
  }

  // 5) Behavior insight
  const avgMoves = parsed.reduce((s, g) => s + g.fullMoves, 0) / parsed.length;
  const losses = parsed.filter(g => g.scoutedScore === 0);
  const timeouts = losses.filter(g =>
    (g.scoutedColor === "white" ? g.white.result : g.black.result) === "timeout"
  ).length;

  if (losses.length >= 5) {
    const phase = { opening: 0, middlegame: 0, endgame: 0 };
    for (const g of losses) {
      const fm = g.fullMoves;
      phase[fm <= 15 ? "opening" : fm <= 34 ? "middlegame" : "endgame"]++;
    }
    const top = (Object.entries(phase).sort((a, b) => b[1] - a[1]))[0] as [string, number];
    const wi = wilson(top[1], losses.length);
    out.push({
      id: "beh:phases",
      kind: "behavior",
      color: "white",
      role: "plays",
      claim: `Their games average ${avgMoves.toFixed(0)} moves; ${top[1]} of ${losses.length} losses (${pct(top[1] / losses.length)}) end in the ${top[0]} (by game length), ${timeouts} on time.`,
      evidence: {
        stat: `losses by phase — opening ${phase.opening}, middlegame ${phase.middlegame}, endgame ${phase.endgame}; timeouts ${timeouts}`,
        games: sample(losses),
        window: windowMeta,
      },
      interpretation:
        top[0] === "endgame"
          ? `They survive the opening but convertible endings are where they lose — length favors you.`
          : top[0] === "opening"
          ? `A meaningful share of losses end early — prepared lines carry extra weight in this matchup.`
          : `Most losses are decided in the middlegame fight rather than in preparation or technique phases.`,
      recommendation: {
        action:
          top[0] === "endgame"
            ? `Keep tension and steer toward simplified positions when better; avoid bailing out into early draws.`
            : `Budget your prep time toward the phase where their losses cluster (${top[0]}).`,
      },
      confidence: confidence(losses, wi.width),
      sampleSize: losses.length,
    });
  }

  return out;
}

/** Build opening forecast trees for both colors */
export function buildForecasts(
  parsed: ParsedGame[]
): Record<Color, import("../../shared/prepTypes.js").ForecastBranch[]> {
  const byColor: Record<Color, ParsedGame[]> = { white: [], black: [] };
  for (const g of parsed) byColor[g.scoutedColor].push(g);
  return {
    white: forecast(byColor.white, "white"),
    black: forecast(byColor.black, "black"),
  };
}
