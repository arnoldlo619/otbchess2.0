// server/prep/guards.ts — post-synthesis guards: drop or demote, never pad.
// Ported from reference/src/engine.ts (runGuards section) — identical behavior.
// Violations are bugs, not style choices.

import { Chess } from "chess.js";
import type { Insight } from "../../shared/prepTypes.js";

const BANNED = [
  /control the cent/i,
  /develop your pieces/i,
  /avoid blunders/i,
  /watch out for tactics/i,
  /play solidly/i,
  /be careful in the opening/i,
  /look for weaknesses/i,
  /prepare for common openings/i,
  /let them make the mistakes/i,
  /piece coordination/i,
  /avoid mistakes/i,
  /\bis aggressive\b/i,
];

export interface GuardResult {
  kept: Insight[];
  reasons: Record<string, number>;
}

export function runGuards(insights: Insight[]): GuardResult {
  const reasons: Record<string, number> = {};
  const drop = (k: string) => { reasons[k] = (reasons[k] ?? 0) + 1; };
  const kept: Insight[] = [];
  const subjects = new Map<string, Insight["kind"]>();

  for (const ins of insights) {
    const text = [ins.claim, ins.interpretation, ins.recommendation.action].join(" ");

    // 1) Banned phrases
    if (BANNED.some(r => r.test(text))) { drop("banned_phrase"); continue; }

    // 2) Opponent-independence: must contain a digit AND a stat with a digit
    if (!/\d/.test(ins.claim) || !/\d/.test(ins.evidence.stat)) {
      drop("opponent_independence");
      continue;
    }

    // 3) Must have at least one game link
    if (!ins.evidence.games.length) { drop("no_game_links"); continue; }

    // 4) Weakness/strength must have baseline
    if ((ins.kind === "weakness" || ins.kind === "strength") && !ins.baseline) {
      drop("missing_baseline");
      continue;
    }

    // 5) Weakness delta floor
    if (ins.kind === "weakness" && ins.baseline!.delta > -0.12) {
      drop("weak_delta_floor");
      continue;
    }

    // 6) Deviation point checks
    if (ins.kind === "deviation_point") {
      // Ply parity: white moves are even plies (0,2,4...), black moves are odd (1,3,5...)
      const parityOK = ins.ply! % 2 === (ins.color === "white" ? 0 : 1);
      if (!parityOK) { drop("ply_parity"); continue; }

      // Validate any suggested line with chess.js
      if (ins.recommendation.line) {
        const c = new Chess();
        let ok = true;
        const tokens = ins.recommendation.line.san
          .replace(/\d+\./g, " ")
          .split(/\s+/)
          .filter(Boolean);
        for (const t of tokens) {
          try { c.move(t); } catch { ok = false; break; }
        }
        if (!ok) { drop("illegal_line"); continue; }
      }
    }

    // 7) Contradiction check: same subject can't be both weakness and strength
    const key = `${ins.kind === "strength" || ins.kind === "weakness" ? "sw" : ins.kind}:${ins.color}:${ins.id.split(":").slice(2).join(":")}`;
    const prev = subjects.get(key);
    if (prev && prev !== ins.kind && (ins.kind === "weakness" || ins.kind === "strength")) {
      drop("contradiction");
      continue;
    }
    subjects.set(key, ins.kind);
    kept.push(ins);
  }

  return { kept, reasons };
}
