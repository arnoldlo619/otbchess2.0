# ChessOTB.club — Scouting Report MVP (reference implementation)

A runnable, end-to-end MVP of the Opponent Matchup / Scouting Report v3 pipeline for **chess.com and Lichess** users.
Purpose: prove the design works, define the quality bar, and give Manus/Codex a working reference to port.

## What it implements
fetch (both providers) → normalize → **legality-validated parse** (chess.js, quarantine) → **EPD opening book**
(3,733 positions, lichess chess-openings) → facts (Wilson CIs, per-color role-safe stats, response tables,
forecast trees, parity-constrained deviation points, true full-move behavior) → **six-field Insight objects** →
**guardrails** (banned lexicon, opponent-independence, baseline floors, headline gates, legality re-check,
ply parity, contradiction scan — drop, never pad) → ScoutReportV3 JSON + markdown prep sheet.

Deliberately out of scope (per the packets): curated counter-plan library content (see the gold-standard
example for what it adds), LLM narration, Stockfish patterns, user-repertoire collision map.

## Run it
```bash
npm install
# live (any machine with internet):
npx tsx src/cli.ts --provider chesscom --user <username>
npx tsx src/cli.ts --provider lichess  --user <username> --tc rapid,blitz --games 100
# offline fixtures (reproduce the example reports):
npx tsx src/cli.ts --user cleanplayer --fixture fixtures/chesscom_cleanplayer.json
npx tsx src/cli.ts --user jobavabot   --fixture fixtures/lichess_jobavabot.ndjson
```
Outputs land in `examples/<user>_<provider>.{json,md}`.

## Files
- `src/types.ts` — Insight + ScoutReportV3 contracts (the wire format from Packet 1 §8)
- `src/providers.ts` — chess.com (archives+PGN) and Lichess (NDJSON) adapters → one normalized shape
- `src/engine.ts` — parse/classify/facts/insights/guards/report (ENGINE_VERSION 3.0.0-mvp)
- `src/render.ts`, `src/cli.ts` — markdown prep sheet + CLI
- `data/ecoByEpd.json` — position-keyed opening book (regen: `python3 build_book.py`)
- `fixtures/` — validated fixtures in BOTH provider formats (regen: `python3 gen_fixtures.py`)
- `examples/` — generated reports + `GOLD_STANDARD_torres.md` (hand-authored target state)

## Verified behaviors (this build, all fixtures)
1. **Provider parity:** the same 24 games via chess.com JSON and Lichess NDJSON produce identical insight claims.
2. **True-positive weakness:** cleanplayer's scripted Scandinavian weakness surfaces as
   "29% in 12 games vs 65% baseline, delta −36pts, CI 11–57%, MED-HIGH" with loss-game links.
3. **Pollution filtering:** mixedsalted 30 → 18 usable; exclusions itemized (5 unrated, 2 variant, 2 abandoned, 3 bullet).
4. **Thin-data honesty:** 7-game account → grade D banner, directional-only output, no fabricated headline plans.
5. **Zero illegal lines / zero parity violations / zero banned phrases** in all generated output (guards enforce).

## Porting notes for Manus
This maps 1:1 onto Packet 2's module plan: `providers.ts` → `server/services/chesscom.ts` + `lichess.ts`;
`engine.ts` splits into `parseGames.ts` / `openingBook.ts` / `facts.ts` / `insightEngine.ts` / `guards.ts`;
`types.ts` → `shared/prepTypes.ts`; `render.ts` logic → the client InsightCard. Known MVP simplifications to
harden in production: recency weighting not yet applied; deviation-point search requires an identical prefix
(conservative — misses transpositions); time-control split shows score not share; behavior phase boundaries
are length-based pending per-ply material heuristics.
