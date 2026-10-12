# Landing League Header Navigation QA

## Scope

Signed-in users selecting **League** from the landing or shared application header should open their preferred League dashboard instead of landing on the Club Overview page.

## Delivered behavior

- `GET /api/leagues/workspace` now returns both the authorized fallback `clubId` and the preferred `leagueId`.
- The preferred League remains deterministic: active first, then draft, then completed; within a status, newest first.
- `resolveLeagueWorkspaceDestination` now routes a returned `leagueId` to `/league/:leagueId`.
- If an eligible Club has no League yet, the existing Club League tab fallback remains `/clubs/:clubId/home?tab=leagues`.
- Public and guest navigation remain unchanged and continue to open `/league-demo`.
- Landing and shared-header tooltips now accurately say **Open your League dashboard** for signed-in users.

## Validation

| Check | Result |
| --- | --- |
| Focused navigation + League lifecycle tests | 56 passed across 4 files |
| TypeScript | Passed (`pnpm exec tsc --noEmit`) |
| Changed-file ESLint | Passed with 0 errors |
| Project lint | Passed with 0 errors; 225 established warnings |
| Production build | Passed |
| Diff integrity | Passed (`git diff --check`) |
| Route health | HTTP 200 for `/league-demo`, `/league/NlGsu0f5XroLQNzk`, `/league`, and the Club League fallback route |
| Visual QA | Desktop captures verified the direct League dashboard and the Club fallback surface render cleanly at 1280×720 |
| Full Vitest baseline | 7,276 passed, 2 skipped, 26 failures in 18 unrelated suites; no League workspace/navigation failure was reported |

## Coverage added

`client/src/lib/leagueWorkspaceNavigation.test.ts` proves the resolver opens a preferred League dashboard, preserves the Club fallback when no League exists, and keeps public fallback behavior intact.

## Remaining validation boundary

The browser QA session was unauthenticated (the workspace API correctly returned 401), so the personalized redirect was verified through the authenticated resolver contract/unit coverage rather than a real Club-owner session. The server response and client destination contract are both covered.
