# Matchup Prep Launch Ledger

**Date:** 2026-08-27  
**Baseline checkpoint:** `e75b4a72`  
**Release target:** One trustworthy Standard scouting workflow at `/prep`, capped at 30 recent eligible games.

## Audited architecture

| Responsibility | Current source | Confirmed issue | Replacement seam |
|---|---|---|---|
| Draft controls, route hydration, request submission, stale-response guard | `client/src/pages/MatchupPrep.tsx` | Provider, color, format, and game depth are mutable page state; the route encodes only provider; controls auto-fetch; export receives mutable `myColor`. | Immutable request helpers plus page integration tests. |
| Server request parsing and cache identity | `server/prepRoutes.ts` | V3 defaults to and permits 100 games; cache identity omits a schema-version field; route accepts legacy depth semantics. | Shared request parser and cache-key contract. |
| Shared report and insight contracts | `shared/prepTypes.ts` | Report snapshot carries only id, color, and time; no complete submitted identity, freshness grade, or centralized primary action collection. | `DraftScoutRequest`, `ActiveScoutRequest`, `ScoutReportSnapshot`, `ScoutAction`, and freshness contracts. |
| Legal PGN replay and player ownership | `server/prep/parseGames.ts` | Legal replay and quarantine already use `chess.js`; parsed plies preserve side ownership. This is retained as the source of truth. | Deterministic legal-PGN fixtures and position-tree builder. |
| Forecast aggregation | `server/prep/facts.ts` | Black forecasts start at ply 1 and expose isolated Black root moves; opening labels can be attached from bucket-level game metadata before the displayed path supports the classification. | Position-keyed tree that begins from the legal initial position and records actor, SAN, UCI, FEN, parent denominator, and source game IDs. |
| Insight generation | `server/prep/insightEngine.ts` | Recommendations contain generic actions; behavior infers game phase from game length; findings can be generated below release-grade evidence thresholds. | Central eligibility/freshness service and concrete action builder. |
| Report assembly | `server/prep/buildReport.ts` | The same insights are redistributed into Snapshot, color sections, Detailed Insights, and Checklist; current data grade differs from the required freshness policy. | One eligible primary action list plus collapsed evidence details. |
| Report presentation | `client/src/components/prep/V3ScoutReportTab.tsx` | Client independently filters by mutable color and repeats insights across four primary sections. | Snapshot-only Scout Brief renderer with at most three unique actions. |
| Repertoire explorer | `client/src/components/prep/ForecastWalkthrough.tsx` | Contains an independent opponent-color selector, decorative score-based evaluation bar, isolated Black root moves, ambiguous attribution, and undersized controls. | Snapshot-bound legal explorer with Your move/Opponent tendency labels, Back, Reset, and accessible board semantics. |
| Image/PDF export | `client/src/components/prep/PrepExportCard.tsx` | Export independently re-sorts all insights and receives mutable color, so it can diverge from the visible report. | Export projection derived only from `ScoutReportSnapshot`. |

## Acceptance matrix

| ID | Pass condition | Primary implementation files | Deterministic proof | Initial status |
|---|---|---|---|---|
| MP-01 | One authoritative `myColor` controls every report section. | `shared/prepTypes.ts`, `MatchupPrep.tsx`, `buildReport.ts`, `V3ScoutReportTab.tsx`, `PrepExportCard.tsx` | Snapshot identity and color-mutation tests. | Failing |
| MP-02 | No Black move appears from the initial white-to-move position. | `positionTree.ts`, `ForecastWalkthrough.tsx` | User-as-White legal root test. | Failing |
| MP-03 | Every move is attributed to the correct user or opponent. | `positionTree.ts`, `ForecastWalkthrough.tsx` | Alternating actor fixture tests for both user colors. | Failing |
| MP-04 | Every displayed sequence replays legally from its FEN. | `parseGames.ts`, `positionTree.ts` | Four required legal PGNs plus malformed-game quarantine. | Partial |
| MP-05 | Platform, username, color, and formats survive reload and sharing. | `scoutRequest.ts`, `MatchupPrep.tsx` | Route round-trip tests. | Failing |
| MP-06 | Same-named Chess.com and Lichess players never cross caches. | `scoutRequest.ts`, `prepRoutes.ts` | Provider-isolated cache-key fixtures. | Partial |
| MP-07 | An older response cannot overwrite a newer request. | `MatchupPrep.tsx` | Stale request-id/abort behavior test. | Partial |
| MP-08 | Standard analyzes no more than 30 eligible recent games. | `scoutRequest.ts`, `prepRoutes.ts`, provider fetchers | Request parser and 30-game truncation tests. | Failing |
| MP-09 | All means Rapid, Blitz, and Bullet with exact breakdown. | `scoutRequest.ts`, `buildReport.ts` | Format-expansion and breakdown tests. | Partial |
| MP-10 | Samples of 3, 6, and 8 follow required eligibility rules. | `evidencePolicy.ts`, `buildReport.ts` | Threshold fixtures. | Failing |
| MP-11 | A report whose newest game is over 365 days old is Stale. | `evidencePolicy.ts`, `buildReport.ts` | 20-game stale-history fixture. | Failing |
| MP-12 | Incomplete sequences receive no premature opening name. | `positionTree.ts` | Root and one-ply classification tests. | Failing |
| MP-13 | No phase or tactical claim is inferred from game length. | `insightEngine.ts`, `buildReport.ts` | Prohibited-inference tests. | Failing |
| MP-14 | Scout Brief contains no duplicated or generic actions. | `evidencePolicy.ts`, `buildReport.ts`, `V3ScoutReportTab.tsx` | Stable-ID uniqueness and prohibited-copy tests. | Failing |
| MP-15 | Deep and secondary opponent-color controls are absent. | `MatchupPrep.tsx`, `ForecastWalkthrough.tsx` | Render/source absence tests. | Failing |
| MP-16 | Visible report and exports use the same snapshot. | `reportProjection.ts`, `PrepExportCard.tsx` | Projection equality tests. | Failing |
| MP-17 | No unnamed focusable board controls remain. | `ForecastWalkthrough.tsx` | Rendered accessibility test. | Failing |
| MP-18 | Dark/light and required widths pass visual QA. | Matchup Prep client components | Automated responsive render checks plus desktop/mobile screenshots. | Pending visual QA |

## Regression sequence

Phase 1 adds deterministic fixtures for the four required legal openings, same-normalized username across both providers, recent samples of 3, 6, 8, and 20 games, a 20-game stale history, and malformed PGNs. The first run must fail for the expected MP criteria before production logic changes. Those failures will be recorded in this document, then the same test command will become the release regression suite.

### Pre-fix regression evidence

The command `pnpm exec vitest run tests/matchup-prep-launch-regressions.test.ts --reporter=verbose` was executed before any production Matchup Prep source was changed. The clean baseline exited with Vitest status `1` and **16 failed, 1 passed**. The sole passing check confirmed that the required legal launch PGNs replay through `chess.js`. The failures reproduced incomplete snapshot identity, illegal Black-root forecast presentation, wrong continuation attribution after a Black reply, incomplete share-route identity, Lichess/Chess.com reload and history ambiguity, missing schema-version cache identity, more than 30 analyzed games, absent centralized eligibility and freshness fields, premature labels, game-length behavior claims, absent Scout Brief actions, Standard/Deep equivalence, the secondary color control, mutable export color, and unnamed board controls.

The clean failure output is retained at `/tmp/matchup-prep-red-regressions-clean.txt` for the duration of this implementation session. The same test file is the required green regression target after remediation.

## Scope boundaries

The legacy V2 report remains untouched unless removal is required to prevent the active V3 workflow from invoking it. Payment, tournament, club, profile, messaging, and Repertoire Builder functionality are out of scope. Live provider checks occur only after deterministic tests pass; they are read-only and no production load test will be run.

## Current launch assessment

**Status: LAUNCH-READY for the Standard Matchup Prep workflow.**

| Verification | Result |
|---|---|
| Original pre-fix blocker suite | **16 failed, 1 passed** before remediation, recorded above. |
| Final launch-focused suite | **37 passed** across immutable identity, legal trees, evidence policy, projections, provider backfill, and forecast interactions. |
| Wider Matchup Prep suite | **152 passed** across 11 Matchup Prep-focused files. |
| TypeScript | Passed with zero errors. |
| Focused changed-file lint | Passed with zero warnings and zero errors. |
| Server bundle | Passed independently with esbuild. |
| Diff integrity | Passed. |
| Live Chess.com | `humblelowkey` completed Standard requests as both White and Black with 30 parsed games and `launch-2` identity. |
| Live Lichess | `drnykterstein` completed Standard scouting as White with 30 parsed games, Lichess identity, approximately 3239 average rating, and current `launch-2` identity. |
| Invalid account | Correctly returned `404 not_found`. |
| Browser accessibility smoke | Completed Chess.com report exposes only named Back, Reset, and named move controls; third-party board internals are inert and a live exact-position description is announced. |
| Local client production build | Blocked: Vite transformed 2,961 modules then Node exhausted its 1 GB configured heap (`exit 134`). This is a local sandbox-resource constraint, not a compiled TypeScript or server-bundle error. |
| Full repository suite | Matchup Prep tests pass; seven unrelated existing assertions failed in SMTP connection, landing punctuation, Lichess token, production-copy, Club Album form labels, and RSVP rate-limit tests. They were not modified to preserve scope. |

| MP range | Status | Evidence |
|---|---|---|
| MP-01–MP-17 | Passed in deterministic and focused browser/live smoke coverage | Immutable snapshot, cache schema `launch-2`, legal position tree, exact provider responses, export projection, and inert board preview tests. |
| MP-18 | Passed | Dark desktop, 375px mobile, and completed light-mode report captures passed. |

The authoritative GitHub workflow for checkpoint `4f088f06` completed with TypeScript, ESLint, and internal-link validation passing. Its unit-test job remained blocked by four unrelated existing suites, so the dependent Production Build job was skipped. This confirms that the local client-build memory limit has not yet been independently cleared by CI.

After the authorized CI-unblocking repairs, the authoritative GitHub workflow for checkpoint `c08a5367` completed successfully: TypeScript, ESLint, internal links, 6,834 deterministic tests, the client production build, and the bundle-performance budget all passed. Dedicated Playwright specifications are intentionally excluded from Vitest and remain in their own runner; external SMTP and Lichess connector checks remain explicitly opt-in health tests. Live browser verification then completed the Chess.com White report for `humblelowkey`: it showed the submitted immutable identity, compact Update scout control, a 30-game report, factual legal forecast, named Back/Reset/move controls, a 16-game color-relevant sample, and appropriately withheld primary recommendations because the evidence gate was not met.

The final connected-browser capture verified the completed report in light mode after the provider response was available. The report retained readable contrast and hierarchy, immutable submitted identity, compact Update scout affordance, factual Scout Brief insufficient-evidence state, legal Opening Forecast, and named keyboard controls. The appearance preference was subsequently restored by the user; no persisted application settings or report data were changed by the verification.
