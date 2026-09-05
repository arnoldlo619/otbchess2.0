# Matchup Prep Launch Remediation Ledger

## Scope and invariants

The report identity is provider, normalized username, selected format set, Standard mode, fixed 30-game cap, and schema version. Explorer orientation and the user’s playing color are local board state only. The report remains opponent-centered and summarizes both White and Black samples.

| Acceptance area | Responsible modules | Deterministic proof |
| --- | --- | --- |
| `PERF-01` to `PERF-04` | `server/services/chesscom.ts`, `server/services/lichess.ts`, `server/prepRoutes.ts`, `server/prep/parseGames.ts` | Provider deadline, incremental fetch, cancellation, and cache tests |
| `ERR-01` to `ERR-02` | `shared/prepTypes.ts`, `server/prepRoutes.ts`, `client/src/lib/prepErrorPresentation.ts`, `client/src/pages/MatchupPrep.tsx` | Typed error and recovery presentation tests |
| `DATE-01` to `DATE-02` | `server/prep/buildReport.ts`, export and saved-report paths | Timezone-safe report, saved, and export date tests |
| `OPEN-01` to `OPEN-02` | `shared/simpleOpeningNames.ts`, `server/prep/buildReport.ts`, `server/prep/parseGames.ts` | Known mismatch fixture and legal SAN replay tests |
| `DATA-01` to `DATA-02` | `server/prep/evidencePolicy.ts`, `server/prep/buildReport.ts`, report renderer | Threshold and freshness disclosure tests |
| `ID-01` to `ID-02` | `shared/scoutRequest.ts`, `client/src/lib/recentlyScouted.ts`, `server/prepRoutes.ts`, saved-report UI | Cross-provider cache, saved, and Recent restoration tests |
| `COLOR-01` to `COLOR-03` | `shared/scoutRequest.ts`, `server/prep/buildReport.ts`, `client/src/pages/MatchupPrep.tsx`, `client/src/components/prep/V3ScoutReportTab.tsx` | Dual-color summary and explorer-only color-control tests |
| `LINE-01` to `LINE-02` | `server/prep/positionTree.ts`, `server/prep/insightEngine.ts`, `client/src/components/prep/V3ScoutReportTab.tsx` | Legal replay, move owner, FEN, and denominator tests |
| `UX-01` to `UX-02`, `A11Y-01` to `A11Y-02`, `RESP-01` | Matchup Prep page and Scout Report components | Rendered interaction, accessibility, and viewport review |

## Baseline findings

The V3 cache key currently includes the legacy global `myColor`, so reports can be needlessly duplicated by player perspective. Both provider adapters re-run the complete parser on accumulated pages and may retry requests past the desired end-to-end budget. The route presently collapses unknown upstream failures into the misleading `all_filtered` error. Date-only display derives from a UTC ISO conversion, which is unsafe for source calendar dates. The V3 report assembler still generates several legacy perspective-specific sections that conflict with an opponent-centered overview.

## Acceptance matrix

| Area | Verdict | Evidence |
| --- | --- | --- |
| `PERF-01` to `PERF-04` | Pass | Provider calls share a 30-second deadline, propagate aborts, retry only once where allowed, queue Lichess at concurrency one, and parse each provider page once while seeking 30 eligible games. Lichess pages are capped at 60 raw games. |
| `ERR-01` to `ERR-02` | Pass | Stable typed backend codes reach the recovery UI. Provider timeout, rate limit, cancellation, not-found, no-eligible-games, and filtered-data states retain distinct actionable copy. |
| `DATE-01` to `DATE-02` | Pass | Date-only values use UTC calendar conversion; the deterministic boundary test locks the report date window. |
| `OPEN-01` to `OPEN-02` | Pass | Opening labels derive from the displayed legal prefix, with neutral position labels when a broad provider/ECO label would overstate the evidence. |
| `DATA-01` to `DATA-02` | Pass | The report stays opponent-centered across both colors; practical Scout Brief actions require eight eligible games, two repeated matching games, and non-stale data. |
| `ID-01` to `ID-02` | Pass | Cache identity is provider, normalized username, requested formats, Standard mode, fixed cap, and schema. Explorer orientation is excluded from report identity. |
| `COLOR-01` to `COLOR-03` | Pass | Global scouting controls no longer include player color. White/Black opponent summaries persist, while the Legal Line Explorer owns its local orientation control. |
| `LINE-01` to `LINE-02` | Pass | Existing legal replay, FEN-copy, branch, and move-owner regressions plus explorer-local color switching pass. |
| `UX-01` to `UX-02`, `A11Y-01` to `A11Y-02`, `RESP-01` | Pass | Rendered menu, Escape/focus, action, export, tier, and mobile/desktop layout tests pass; live review confirms visible provider/filter context. |

**Release verdict: verified for the scoped Matchup Prep launch remediation.**

## Live smoke evidence

| Timestamp | Provider | Username | Result observed |
| --- | --- | --- | --- |
| 2026-09-05 | Chess.com | humblelowkey | Request entered the bounded report-loading state, then produced a 30-game report with Chess.com identity, provider avatar, dynamic White/Black win rates, format split, UTC-safe date window, and opening summaries. The Free tier correctly showed the locked Pro Scout Brief boundary. |
| 2026-09-05 | Lichess | thibault | Request entered the bounded report-loading state, then produced a distinct 30-game Lichess report with Lichess identity, dynamic White/Black rates, a 29-blitz/1-bullet format split, an independent date window, and Lichess opening summaries. The Free tier correctly showed the locked Pro Scout Brief boundary. |

## Responsive review

The verified desktop report keeps identity, color-split performance, requested evidence context, and the Free/Pro boundary in a clear single hierarchy. At 375px, the search controls stack into full-width touch targets; profile identity, data-quality badges, color split, key stats, opening sequences, and upgrade boundary remain legible without horizontal overflow.

The compact live Scout Opponent menu exposes provider and time-control radio choices plus a run action, without a global player-color choice. Escape dismissal was exercised after opening the menu; the rendered interaction suite separately verifies focus restoration and keyboard behavior deterministically.
