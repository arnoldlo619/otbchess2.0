// server/prep/parseGames.ts — filter raw games, quarantine illegal sequences,
// classify openings via EPD book lookup.
// Ported from reference/src/engine.ts (parseGames section) — identical behavior.

import { Chess } from "chess.js";
import type { Color, FetchOpts, ParsedGame, RawGame } from "../../shared/prepTypes.js";
import { lookupEpd } from "./openingBook.js";

const epdOf = (c: Chess): string => c.fen().split(" ").slice(0, 4).join(" ");

export interface ParseResult {
  parsed: ParsedGame[];
  excluded: Record<string, number>;
  quarantined: number;
}

export function parseGames(raw: RawGame[], scouted: string, o: FetchOpts): ParseResult {
  const excluded: Record<string, number> = {};
  const bump = (k: string) => { excluded[k] = (excluded[k] ?? 0) + 1; };
  const parsed: ParsedGame[] = [];
  let quarantined = 0;
  const lname = scouted.toLowerCase();

  for (const g of raw) {
    // ── Filters (bump excluded, never quarantine) ──────────────────────────
    if (g.rules !== "chess") { bump("variant_rules"); continue; }
    if (o.ratedOnly && !g.rated) { bump("unrated"); continue; }
    if (!o.timeClasses.includes(g.timeClass)) { bump(`time_class_${g.timeClass}`); continue; }

    const isW = g.white.name.toLowerCase() === lname;
    const isB = g.black.name.toLowerCase() === lname;
    if (!isW && !isB) { bump("scouted_player_absent"); continue; }
    if (g.sans.length < 10) { bump("too_short_or_abandoned"); continue; }
    if (g.result === "*") { bump("no_result"); continue; }

    // ── Replay with chess.js — quarantine on any illegal move ─────────────
    const chess = new Chess();
    const plies: ParsedGame["plies"] = [];
    let legal = true;

    for (const san of g.sans) {
      const by: Color = chess.turn() === "w" ? "white" : "black";
      try {
        chess.move(san);
      } catch {
        legal = false;
        break;
      }
      plies.push({ san, epd: epdOf(chess), by });
    }

    if (!legal) { quarantined++; continue; }

    // ── Opening classification via EPD book ────────────────────────────────
    let opening = { eco: "?", name: "Unclassified", bookExitPly: 0 };
    for (let i = 0; i < plies.length; i++) {
      const hit = lookupEpd(plies[i].epd);
      if (hit) opening = { eco: hit.eco, name: hit.name, bookExitPly: i + 1 };
    }

    // ── Score from scouted player's perspective ────────────────────────────
    const scoutedColor: Color = isW ? "white" : "black";
    const scoutedScore: 0 | 0.5 | 1 =
      g.result === "1/2-1/2" ? 0.5
      : ((g.result === "1-0") === (scoutedColor === "white") ? 1 : 0);

    parsed.push({
      ...g,
      plies,
      fullMoves: Math.ceil(plies.length / 2),
      opening,
      scoutedColor,
      scoutedScore,
    });
  }

  return { parsed, excluded, quarantined };
}
