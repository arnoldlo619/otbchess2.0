// src/engine.ts — parse → classify → facts → insights → guards → ScoutReportV3
import { Chess } from "chess.js";
import { readFileSync } from "node:fs";
import type { Color, ForecastBranch, Insight, ParsedGame, Provider, RawGame, ScoutReportV3 } from "./types.ts";
import type { FetchOpts } from "./providers.ts";

export const ENGINE_VERSION = "3.0.0-mvp";
const BOOK: Record<string, { eco: string; name: string; ply: number }> =
  JSON.parse(readFileSync(new URL("../data/ecoByEpd.json", import.meta.url), "utf-8")).book;

const epdOf = (c: Chess) => c.fen().split(" ").slice(0, 4).join(" ");
const dateOf = (t: number) => new Date(t * 1000).toISOString().slice(0, 10);
const pct = (x: number) => `${Math.round(x * 100)}%`;

/* ---------------- Wilson 95% interval + confidence tiers --------------------------------------- */
export function wilson(scoreSum: number, n: number): { lo: number; hi: number; width: number } {
  if (!n) return { lo: 0, hi: 1, width: 1 };
  const z = 1.96, p = scoreSum / n, d = 1 + z * z / n;
  const mid = (p + z * z / (2 * n)) / d, half = (z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / d;
  return { lo: Math.max(0, mid - half), hi: Math.min(1, mid + half), width: 2 * half };
}
export function confidence(n: number, width: number): Insight["confidence"] {
  if (n >= 15 && width <= 0.30) return "high";
  if (n >= 10) return "medium_high";
  if (n >= 6) return "medium";
  return "low";
}

/* ---------------- Parse + quarantine ------------------------------------------------------------ */
export function parseGames(raw: RawGame[], scouted: string, o: FetchOpts) {
  const excluded: Record<string, number> = {};
  const bump = (k: string) => (excluded[k] = (excluded[k] ?? 0) + 1);
  const parsed: ParsedGame[] = [];
  let quarantined = 0;
  const lname = scouted.toLowerCase();

  for (const g of raw) {
    if (g.rules !== "chess") { bump("variant_rules"); continue; }
    if (o.ratedOnly && !g.rated) { bump("unrated"); continue; }
    if (!o.timeClasses.includes(g.timeClass)) { bump(`time_class_${g.timeClass}`); continue; }
    const isW = g.white.name.toLowerCase() === lname, isB = g.black.name.toLowerCase() === lname;
    if (!isW && !isB) { bump("scouted_player_absent"); continue; }
    if (g.sans.length < 10) { bump("too_short_or_abandoned"); continue; }
    if (g.result === "*") { bump("no_result"); continue; }

    const chess = new Chess();
    const plies: ParsedGame["plies"] = [];
    let legal = true;
    for (const san of g.sans) {
      const by: Color = chess.turn() === "w" ? "white" : "black";
      try { chess.move(san); } catch { legal = false; break; }
      plies.push({ san, epd: epdOf(chess), by });
    }
    if (!legal) { quarantined++; continue; }

    let opening = { eco: "?", name: "Unclassified", bookExitPly: 0 };
    for (let i = 0; i < plies.length; i++) {
      const hit = BOOK[plies[i].epd];
      if (hit) opening = { eco: hit.eco, name: hit.name, bookExitPly: i + 1 };
    }
    const scoutedColor: Color = isW ? "white" : "black";
    const scoutedScore = g.result === "1/2-1/2" ? 0.5
      : ((g.result === "1-0") === (scoutedColor === "white") ? 1 : 0);
    parsed.push({ ...g, plies, fullMoves: Math.ceil(plies.length / 2), opening, scoutedColor, scoutedScore });
  }
  return { parsed, excluded, quarantined };
}

/* ---------------- Facts -------------------------------------------------------------------------- */
type Group = { games: ParsedGame[]; n: number; score: number };
const grp = (gs: ParsedGame[]): Group => ({ games: gs, n: gs.length, score: gs.reduce((s, g) => s + g.scoutedScore, 0) });
const familyOf = (name: string) => name.split(":")[0].trim();
const sample = (gs: ParsedGame[], k = 4) =>
  gs.slice(0, k).map(g => ({ url: g.url, date: dateOf(g.endTime), result: (g.scoutedScore === 1 ? "W" : g.scoutedScore === 0.5 ? "D" : "L") as "W"|"D"|"L" }));

export function buildFacts(parsed: ParsedGame[]) {
  const byColor: Record<Color, ParsedGame[]> = { white: [], black: [] };
  for (const g of parsed) byColor[g.scoutedColor].push(g);

  // opening families per color (min bookExitPly 2 so "Unclassified"/1-ply junk aggregates)
  const fam: Record<Color, Map<string, ParsedGame[]>> = { white: new Map(), black: new Map() };
  for (const c of ["white", "black"] as Color[])
    for (const g of byColor[c]) {
      const key = g.opening.bookExitPly >= 2 ? familyOf(g.opening.name) : "Other / irregular";
      (fam[c].get(key) ?? fam[c].set(key, []).get(key)!).push(g);
    }

  // response tables: scouted player's FIRST OWN CHOICE after 1.e4/1.d4/1.c4/1.Nf3 (role=plays by construction)
  const responses: Record<string, Map<string, ParsedGame[]>> = {};
  for (const first of ["e4", "d4", "c4", "Nf3"]) responses[first] = new Map();
  for (const g of byColor.black) {
    const w1 = g.plies[0]?.san, b1 = g.plies[1]?.san;
    if (w1 && b1 && responses[w1]) (responses[w1].get(b1) ?? responses[w1].set(b1, []).get(b1)!).push(g);
  }
  // first-move distribution as White (role=plays by construction)
  const firstMoves = new Map<string, ParsedGame[]>();
  for (const g of byColor.white) {
    const m = g.plies[0]?.san; if (!m) continue;
    (firstMoves.get(m) ?? firstMoves.set(m, []).get(m)!).push(g);
  }
  return { byColor, fam, responses, firstMoves };
}

/* ---------------- Forecast tree (per color, depth 3 full moves of scouted side) ------------------ */
export function forecast(games: ParsedGame[], color: Color, maxDepth = 4): ForecastBranch[] {
  const build = (gs: ParsedGame[], ply: number, depth: number): ForecastBranch[] => {
    if (depth >= maxDepth || gs.length < 3) return [];
    const buckets = new Map<string, ParsedGame[]>();
    for (const g of gs) { const s = g.plies[ply]?.san; if (s) (buckets.get(s) ?? buckets.set(s, []).get(s)!).push(g); }
    return [...buckets.entries()]
      .filter(([, v]) => v.length >= 2)
      .sort((a, b) => b[1].length - a[1].length).slice(0, 3)
      .map(([san, v]) => ({
        moveSan: san, count: v.length, pct: v.length / gs.length,
        score: v.reduce((s, g) => s + g.scoutedScore, 0) / v.length,
        children: build(v, ply + 1, depth + 1),
      }));
  };
  return build(games, 0, 0);
}

/* ---------------- Deviation points (scouted-player plies ONLY) ----------------------------------- */
function deviationInsight(color: Color, opening: string, gs: ParsedGame[], win: FetchOpts, windowMeta: Insight["evidence"]["window"]): Insight | null {
  const wins = gs.filter(g => g.scoutedScore === 1), losses = gs.filter(g => g.scoutedScore === 0);
  if (gs.length < 5 || wins.length < 2 || losses.length < 2) return null;
  const startParity = color === "white" ? 0 : 1;
  const maxPly = Math.min(16, ...gs.map(g => g.plies.length));
  for (let ply = startParity; ply < maxPly; ply += 2) {
    const plur = (set: ParsedGame[]) => {
      const m = new Map<string, number>();
      for (const g of set) { const s = g.plies[ply]?.san; if (s) m.set(s, (m.get(s) ?? 0) + 1); }
      let best = "", bn = 0; for (const [k, v] of m) if (v > bn) { best = k; bn = v; }
      return { move: best, n: bn };
    };
    // require identical prefix across the whole group so the branch point is real, not noise
    const prefixSame = gs.every(g => g.plies.slice(0, ply).every((p, i) => p.san === gs[0].plies[i]?.san));
    if (!prefixSame) return null;
    const w = plur(wins), l = plur(losses);
    if (w.move && l.move && w.move !== l.move && w.n >= 2 && l.n >= 2) {
      const moveNo = Math.floor(ply / 2) + 1;
      const prefix = gs[0].plies.slice(0, ply).map((p, i) => (i % 2 === 0 ? `${i / 2 + 1}.${p.san}` : p.san)).join(" ");
      return {
        id: `dev:${color}:${opening}:${ply}`, kind: "deviation_point", color, role: "plays",
        claim: `In the ${opening} as ${color}, their move ${moveNo} splits results: ${l.move} appears in ${l.n} of their losses, while ${w.move} appears in ${w.n} of their wins.`,
        evidence: { stat: `${gs.length} games in this line (${wins.length}W/${losses.length}L among decisive); branch at move ${moveNo} after ${prefix || "the start position"}`,
          games: sample([...losses, ...wins]), window: windowMeta },
        interpretation: `The position before move ${moveNo} is a decision point they handle inconsistently; the ${l.move} branch is where their results collapse.`,
        recommendation: { action: `Steer toward the position after ${prefix || "move 1"} and study both branches: punish ${l.move}, and have a plan ready against ${w.move}.`,
          line: { san: prefix, validated: true } },
        confidence: confidence(gs.length, wilson(gs.reduce((s, g) => s + g.scoutedScore, 0), gs.length).width),
        sampleSize: gs.length, ply,
      };
    }
  }
  return null;
}

/* ---------------- Insight synthesis --------------------------------------------------------------- */
export function synthesize(parsed: ParsedGame[], o: FetchOpts): Insight[] {
  const windowMeta = {
    from: dateOf(Math.min(...parsed.map(g => g.endTime))), to: dateOf(Math.max(...parsed.map(g => g.endTime))),
    timeClasses: o.timeClasses, ratedOnly: o.ratedOnly,
  };
  const { byColor, fam, responses, firstMoves } = buildFacts(parsed);
  const out: Insight[] = [];
  const overall: Record<Color, number> = {
    white: byColor.white.length ? grp(byColor.white).score / byColor.white.length : 0.5,
    black: byColor.black.length ? grp(byColor.black).score / byColor.black.length : 0.5,
  };

  // 1) first-move tendency as White
  const fmSorted = [...firstMoves.entries()].sort((a, b) => b[1].length - a[1].length);
  if (fmSorted.length && byColor.white.length >= 4) {
    const [mv, gs] = fmSorted[0]; const g = grp(gs);
    out.push({
      id: `tend:white:1.${mv}`, kind: "opening_tendency", color: "white", role: "plays",
      claim: `As White they open 1.${mv} in ${g.n} of ${byColor.white.length} games (${pct(g.n / byColor.white.length)}), scoring ${pct(g.score / g.n)}.`,
      evidence: { stat: `${g.n}/${byColor.white.length} White games begin 1.${mv}`, games: sample(gs), window: windowMeta },
      interpretation: `Your Black preparation can be narrowed to 1.${mv} systems with ${pct(g.n / byColor.white.length)} coverage of their White games.`,
      recommendation: { action: `Prepare one reliable defense to 1.${mv} and rehearse it to move 8–10; skim their secondary tries only briefly.` },
      confidence: confidence(g.n, wilson(g.score, g.n).width), sampleSize: g.n,
    });
  }

  // 2) response patterns as Black (vs 1.e4 / 1.d4 / 1.c4 / 1.Nf3) — plays by construction
  for (const first of Object.keys(responses)) {
    const table = [...responses[first].entries()].sort((a, b) => b[1].length - a[1].length);
    const total = table.reduce((s, [, v]) => s + v.length, 0);
    if (!table.length || total < 4) continue;
    const [reply, gs] = table[0]; const g = grp(gs);
    const w = wilson(g.score, g.n);
    const base = overall.black; const delta = g.score / g.n - base;
    const isWeak = g.n >= 6 && g.score / g.n <= 0.45 && delta <= -0.12;
    const isStrong = g.n >= 6 && g.score / g.n >= 0.55 && delta >= 0.12;
    out.push({
      id: `resp:black:1.${first}:${reply}`, kind: isWeak ? "weakness" : isStrong ? "strength" : "response_pattern",
      color: "black", role: "plays",
      claim: `Against 1.${first} they choose 1...${reply} in ${g.n} of ${total} games (${pct(g.n / total)}), scoring ${pct(g.score / g.n)}.`,
      evidence: { stat: `${g.n}/${total} games vs 1.${first}; score ${g.score}/${g.n} (95% CI ${pct(w.lo)}–${pct(w.hi)})`, games: sample(gs), window: windowMeta },
      interpretation: isWeak
        ? `This is their default reply to 1.${first} and it underperforms their overall Black score (${pct(base)}) by ${Math.round(-delta * 100)} points — a preparable target.`
        : isStrong
        ? `They are comfortable here — ${Math.round(delta * 100)} points above their Black baseline (${pct(base)}). Avoid their main strength unless you have something concrete.`
        : `Predictable first branch: with 1.${first} you will reach 1...${reply} positions most of the time.`,
      recommendation: { action: isWeak
        ? `Open 1.${first} and prepare your main line against 1...${reply} to move 10; their record says the pressure point is real.`
        : `Know your setup against 1...${reply} after 1.${first}; expect it ${pct(g.n / total)} of the time.` },
      confidence: confidence(g.n, w.width), sampleSize: g.n,
      ...(isWeak || isStrong ? { baseline: { metric: "overall score as Black", value: base, delta } } : {}),
    });
  }

  // 3) per-family weakness/strength scan (both colors), baseline-relative
  for (const c of ["white", "black"] as Color[]) {
    for (const [name, gs] of fam[c]) {
      if (name === "Other / irregular") continue;
      const g = grp(gs); if (g.n < 6) continue;
      const p = g.score / g.n, base = overall[c], delta = p - base;
      const w = wilson(g.score, g.n);
      if (p <= 0.45 && delta <= -0.12) {
        out.push({
          id: `weak:${c}:${name}`, kind: "weakness", color: c, role: "plays",
          claim: `They score ${pct(p)} in ${name} positions as ${c} (${g.n} games) versus ${pct(base)} overall as ${c}.`,
          evidence: { stat: `score ${g.score}/${g.n}; 95% CI ${pct(w.lo)}–${pct(w.hi)}; baseline delta −${Math.round(-delta * 100)}pts`, games: sample(gs.filter(x => x.scoutedScore === 0).concat(gs)), window: windowMeta },
          interpretation: `A repeatable structure where their results drop well below their own level — the highest-value prep target in this report.`,
          recommendation: { action: `Steer the game toward ${name} structures when you have the ${c === "white" ? "Black" : "White"} pieces; rehearse the first 10 moves of your chosen line.` },
          confidence: confidence(g.n, w.width), sampleSize: g.n,
          baseline: { metric: `overall score as ${c}`, value: base, delta },
        });
      } else if (p >= 0.62 && delta >= 0.12) {
        out.push({
          id: `str:${c}:${name}`, kind: "strength", color: c, role: "plays",
          claim: `They score ${pct(p)} in ${name} positions as ${c} (${g.n} games), ${Math.round(delta * 100)} points above their ${c} baseline.`,
          evidence: { stat: `score ${g.score}/${g.n}; 95% CI ${pct(w.lo)}–${pct(w.hi)}`, games: sample(gs), window: windowMeta },
          interpretation: `Their comfort zone. Entering it hands them familiarity for free.`,
          recommendation: { action: `Choose a move order that sidesteps ${name} structures rather than testing them in it.` },
          confidence: confidence(g.n, w.width), sampleSize: g.n,
          baseline: { metric: `overall score as ${c}`, value: base, delta },
        });
      }
    }
  }

  // 4) deviation points per (color, family)
  for (const c of ["white", "black"] as Color[])
    for (const [name, gs] of fam[c]) {
      if (name === "Other / irregular") continue;
      const ins = deviationInsight(c, name, gs, o, windowMeta);
      if (ins) out.push(ins);
    }

  // 5) behavior
  const avgMoves = parsed.reduce((s, g) => s + g.fullMoves, 0) / parsed.length;
  const losses = parsed.filter(g => g.scoutedScore === 0);
  const timeouts = losses.filter(g => (g.scoutedColor === "white" ? g.white.result : g.black.result) === "timeout").length;
  if (losses.length >= 5) {
    const phase = { opening: 0, middlegame: 0, endgame: 0 };
    for (const g of losses) { const fm = g.fullMoves; phase[fm <= 15 ? "opening" : fm <= 34 ? "middlegame" : "endgame"]++; }
    const top = (Object.entries(phase).sort((a, b) => b[1] - a[1]))[0];
    out.push({
      id: "beh:phases", kind: "behavior", color: "white", role: "plays",
      claim: `Their games average ${avgMoves.toFixed(0)} moves; ${top[1]} of ${losses.length} losses (${pct(top[1] / losses.length)}) end in the ${top[0]} (by game length), ${timeouts} on time.`,
      evidence: { stat: `losses by phase — opening ${phase.opening}, middlegame ${phase.middlegame}, endgame ${phase.endgame}; timeouts ${timeouts}`, games: sample(losses), window: windowMeta },
      interpretation: top[0] === "endgame"
        ? `They survive the opening but convertible endings are where they lose — length favors you.`
        : top[0] === "opening" ? `A meaningful share of losses end early — prepared lines carry extra weight in this matchup.`
        : `Most losses are decided in the middlegame fight rather than in preparation or technique phases.`,
      recommendation: { action: top[0] === "endgame"
        ? `Keep tension and steer toward simplified positions when better; avoid bailing out into early draws.`
        : `Budget your prep time toward the phase where their losses cluster (${top[0]}).` },
      confidence: confidence(losses.length, wilson(top[1], losses.length).width), sampleSize: losses.length,
    });
  }
  return out;
}

/* ---------------- Guards (drop or demote — never pad) --------------------------------------------- */
const BANNED = [/control the cent/i, /develop your pieces/i, /avoid blunders/i, /watch out for tactics/i,
  /play solidly/i, /be careful in the opening/i, /look for weaknesses/i, /prepare for common openings/i,
  /let them make the mistakes/i, /piece coordination/i, /avoid mistakes/i, /\bis aggressive\b/i];

export function runGuards(insights: Insight[]): { kept: Insight[]; reasons: Record<string, number> } {
  const reasons: Record<string, number> = {};
  const drop = (k: string) => { reasons[k] = (reasons[k] ?? 0) + 1; };
  const kept: Insight[] = [];
  const subjects = new Map<string, Insight["kind"]>();

  for (const ins of insights) {
    const text = [ins.claim, ins.interpretation, ins.recommendation.action].join(" ");
    if (BANNED.some(r => r.test(text))) { drop("banned_phrase"); continue; }
    // opponent-independence: must contain a digit AND (a SAN-ish token or an opening name capitalized phrase)
    if (!/\d/.test(ins.claim) || !/\d/.test(ins.evidence.stat)) { drop("opponent_independence"); continue; }
    if (!ins.evidence.games.length) { drop("no_game_links"); continue; }
    if ((ins.kind === "weakness" || ins.kind === "strength") && !ins.baseline) { drop("missing_baseline"); continue; }
    if (ins.kind === "weakness" && ins.baseline!.delta > -0.12) { drop("weak_delta_floor"); continue; }
    if (ins.kind === "deviation_point") {
      const parityOK = ins.ply! % 2 === (ins.color === "white" ? 0 : 1);
      if (!parityOK) { drop("ply_parity"); continue; }
      if (ins.recommendation.line) {
        const c = new Chess(); let ok = true;
        for (const t of ins.recommendation.line.san.replace(/\d+\./g, " ").split(/\s+/).filter(Boolean)) {
          try { c.move(t); } catch { ok = false; break; }
        }
        if (!ok) { drop("illegal_line"); continue; }
      }
    }
    const key = `${ins.kind === "strength" || ins.kind === "weakness" ? "sw" : ins.kind}:${ins.color}:${ins.id.split(":").slice(2).join(":")}`;
    const prev = subjects.get(key);
    if (prev && prev !== ins.kind && (ins.kind === "weakness" || ins.kind === "strength")) { drop("contradiction"); continue; }
    subjects.set(key, ins.kind);
    kept.push(ins);
  }
  return { kept, reasons };
}

/* ---------------- Assemble report ----------------------------------------------------------------- */
export function buildReport(provider: Provider, username: string, raw: RawGame[], o: FetchOpts): ScoutReportV3 {
  const { parsed, excluded, quarantined } = parseGames(raw, username, o);
  if (!parsed.length) throw new Error(`NoUsableGames: ${username} (fetched ${raw.length}, all excluded/quarantined)`);
  const insightsAll = synthesize(parsed, o);
  const { kept, reasons } = runGuards(insightsAll);

  const headlineOK = (i: Insight) => i.sampleSize >= 8 && i.confidence !== "low";
  const byKind = (k: Insight["kind"]) => kept.filter(i => i.kind === k);
  const ids = (a: Insight[]) => a.map(i => i.id);
  const weaknesses = byKind("weakness").sort((a, b) => (a.baseline!.delta) - (b.baseline!.delta));
  const strengths = byKind("strength").sort((a, b) => (b.baseline!.delta) - (a.baseline!.delta));

  const rec: Record<Color, { w: number; d: number; l: number }> = { white: { w: 0, d: 0, l: 0 }, black: { w: 0, d: 0, l: 0 } };
  const tcs: Record<string, { games: number; score: number }> = {};
  for (const g of parsed) {
    const r = rec[g.scoutedColor];
    g.scoutedScore === 1 ? r.w++ : g.scoutedScore === 0.5 ? r.d++ : r.l++;
    const t = (tcs[g.timeClass] ??= { games: 0, score: 0 }); t.games++; t.score += g.scoutedScore;
  }
  for (const k of Object.keys(tcs)) tcs[k].score = tcs[k].score / tcs[k].games;

  const usable = parsed.length;
  const grade = usable >= 60 ? "A" : usable >= 30 ? "B" : usable >= 15 ? "C" : "D";
  const notes: string[] = Object.entries(excluded).map(([k, v]) => `${v} game(s) excluded: ${k.replace(/_/g, " ")}`);
  if (quarantined) notes.push(`${quarantined} game(s) quarantined: illegal or corrupt move data`);
  if (grade === "D") notes.push(`Thin data: only ${usable} usable games — treat every item below as directional, not conclusive.`);

  const planFor = (userColor: Color): string[] => {
    const oppColor: Color = userColor === "white" ? "black" : "white";
    const pool = kept.filter(i => i.color === oppColor && headlineOK(i) &&
      ["weakness", "response_pattern", "opening_tendency", "deviation_point"].includes(i.kind));
    return ids(pool.sort((a, b) => (a.kind === "weakness" ? -1 : 0) - (b.kind === "weakness" ? -1 : 0)).slice(0, 3));
  };

  const ratings = parsed.map(g => (g.scoutedColor === "white" ? g.white.rating : g.black.rating)).filter((x): x is number => x != null);

  return {
    version: 3, engineVersion: ENGINE_VERSION, provider,
    opponent: {
      username, record: rec,
      avgRating: ratings.length ? Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length) : null,
      timeControlSplit: tcs,
    },
    dataQuality: {
      requested: o.maxGames, fetched: raw.length, parsed: usable, quarantined, excluded,
      ratedShare: raw.length ? raw.filter(g => g.rated).length / raw.length : 0,
      window: { from: dateOf(Math.min(...parsed.map(g => g.endTime))), to: dateOf(Math.max(...parsed.map(g => g.endTime))) },
      grade, notes,
    },
    openingForecast: {
      white: forecast(parsed.filter(g => g.scoutedColor === "white"), "white"),
      black: forecast(parsed.filter(g => g.scoutedColor === "black"), "black"),
    },
    insights: kept,
    sections: {
      matchupSummary: ids(kept.filter(headlineOK).slice(0, 4)),
      strengths: ids(strengths.filter(headlineOK)),
      weaknesses: ids(weaknesses.filter(headlineOK)),
      weakSignals: ids(kept.filter(i => !headlineOK(i))),
      ifYouHaveWhite: planFor("white"), ifYouHaveBlack: planFor("black"),
      deviationPoints: ids(byKind("deviation_point")),
      behavior: ids(byKind("behavior")),
      prepChecklist: kept.filter(headlineOK).slice(0, 5).map(i => ({ text: i.recommendation.action, insightId: i.id })),
    },
    guardLog: { droppedInsights: insightsAll.length - kept.length, reasons },
    generatedAt: new Date().toISOString(),
  };
}
