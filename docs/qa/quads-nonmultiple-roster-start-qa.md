# Quads Non-Multiple Roster Start Repair — QA Record

**Scope:** Tournament Director start eligibility and section generation for Quads rosters that are not a multiple of four.

## Defect and root cause

An 18-player Quads roster was blocked by the shared format policy because it enforced a `multipleOf: 4` requirement. That conflicted with the Quads engine, which already supports a balanced mixed layout: complete four-player Quads plus a 4–7 player bottom Swiss section.

The result was a false *“Needs at least 2 players to start”* / disabled-start state even though the roster could be paired safely.

## Delivered behavior

- Quads now permit any roster of **four or more** players.
- A single four-player roster remains one normal Quad.
- Five to seven players form a bottom Swiss section.
- Eight or more players form as many four-player Quads as possible, with a four- to seven-player remainder retained as one bottom Swiss section.
- An 18-player roster produces:
  - **3 four-player Quads**
  - **1 six-player bottom Swiss section**
  - **9 first-round games** total
- Tournament setup, settings, bracket preview, Director status copy, Director start validation, and generation now use the same allocation policy.
- The Director start transition persists `in_progress`, Round 1, and the generated Quads section state.

## Automated validation

| Validation | Result |
| --- | --- |
| Focused Quads policy, generation, Director-start, configuration, and source-contract tests | **191 passed** across 7 files |
| New 18-player Director start-flow regression | **Passed** — validates `canStart`, start transition, 3 Quads + 6-player bottom Swiss, 3 rounds, and 9 Round-1 games |
| TypeScript (`pnpm exec tsc --noEmit`) | **Passed** |
| Changed-file and project lint | **0 errors**; **233 established warnings** |
| Production build (`pnpm run build`) | **Passed** |
| Diff integrity (`git diff --check`) | **Passed** |
| Local Director routes (`/tournament/otb-demo-2026/manage`, `/tournament/otb-open/manage`) | **200** |
| Full Vitest baseline | **7,196 passed, 2 skipped; 31 unrelated legacy failures in 19 suites** |

## Regression boundary retained

The correction initially classified exactly four players as bottom Swiss during broad validation. That boundary was repaired before final validation; the dedicated Quads unit suite confirms a four-player roster remains a normal Quad with its expected six games across three rounds.

## Operational note

No production tournament records were changed during validation. The 18-player flow is exercised through an isolated persisted-state test harness.
