# Matchup Prep Eligibility and Opening-Label Repair QA

## Scope

This repair re-validated the reported Chess.com account `humblelowkey` against the live provider and the ChessOTB Matchup Prep endpoint. The live provider data contains rated, standard-chess Blitz games with complete PGNs and the correct player identity; the prior “not enough eligible recent games” result is therefore not valid for the active report path.

The endpoint now produces a successful report with **30 eligible Blitz games**, a **Strong** evidence grade, and a current date window. The browser report was also loaded directly on the Matchup Prep route and rendered the successful report rather than the prior eligibility error state. After cache invalidation, its opening snapshot reads **Queen's Pawn Opening**, **Modern Defense**, and **Scandinavian Defense** instead of the retired generic move-position labels.

The same live review exposed generic `Common position after …` titles for short-prefix opening summaries. These have been replaced with broad, familiar opening families such as **Queen's Pawn Opening** and **Modern Defense**. Existing specific recognition, including Scandinavian Defense, Sicilian Defense, Caro-Kann Defense, Italian Game, Ruy Lopez, London System, and Queen's Gambit, remains intact. The Matchup Prep report engine version is bumped to `5.0.1-opening-labels`, invalidating any cached reports that contain retired generic-position labels.

## Validation

| Check | Result |
|---|---|
| Live Chess.com profile and archive verification | Passed; account, archives, rated Blitz PGNs, player identity, and completed results confirmed. |
| Local `/api/prep/humblelowkey?provider=chesscom&tc=all&refresh=true` | Passed; 200 response, 30 parsed/eligible Blitz games, Strong evidence. |
| Browser report route | Passed; rendered Matchup Prep report with 30 eligible games, no eligibility error state, and familiar opening labels after cache refresh. |
| Focused Matchup Prep tests | Passed: 52 tests across opening labels, fixtures, and Chess.com collection. Includes a deterministic fixture proving 120 recent Daily games are skipped while 30 older rated Blitz games backfill the Standard report. |
| TypeScript | Passed: `pnpm exec tsc --noEmit`. |
| Changed-file ESLint | Passed with 0 errors. |
| Cache safety | Passed by review: the V3 report engine version is incremented so stale cached opening labels rebuild automatically. |
| Full suite | 6,987 passed, 2 skipped; 25 failures in 15 pre-existing unrelated source-contract suites: accessibility overlays, native form labels, global/landmark semantics, Tournament Wizard payment toggle, and tournament-format cards. |
| Project lint | Passed with 0 errors; 235 existing warnings. |
| Production build | Passed. |

## Evidence

See [provider evidence](./matchup-prep-eligible-games-provider-evidence.md) for the live public-provider checks performed against the reported account.
