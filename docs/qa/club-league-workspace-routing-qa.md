# Club League Discovery and Navigation QA

**Date:** 2026-10-06  
**Scope:** Club Dashboard Events → Leagues list and League navigation from the global and landing-page headers.

## Root cause

Two independent implementation gaps created the reported experience:

1. `ClubDashboard` only fetched `/api/leagues/club/:clubId` after the current session created a League. Entering the Events → Leagues workspace with pre-existing records left the client state empty and rendered the false **No leagues yet** state.
2. Header League links navigated to a generic League route or selected a direct League dashboard from an incomplete personal query. That bypassed the Club workspace, where the user needs to see and select their Club's League list.

## Delivered behavior

- The Events → Leagues workspace now loads the canonical, authenticated Club League list every time it opens.
- Loading, error, and real empty states are distinct; the false empty state is not shown while retrieval is in progress.
- `GET /api/leagues/club/:clubId` requires an owner or active Club member, returns player counts and week totals, and orders active → draft → completed.
- `GET /api/leagues/mine` now includes commissioner-managed Leagues even before the commissioner is included on a roster.
- A new authenticated workspace resolver selects the most relevant owned/joined Club (prioritizing active Leagues) and returns a deep link to:
  - `/clubs/:clubId/home?tab=events&view=leagues`
- The landing-page header, shared App navigation, mobile drawer, and League dropdown now route through the Club League workspace rather than directly opening an arbitrary historical League.
- Club dashboard deep links apply the Events + Leagues state from the URL.
- Dropdown item clicks stop propagation so selecting a listed League does not get replaced by the parent navigation action.

## Affected data verification

The configured database contains three League records for `1904 Chess Club` (`w3m342vs`):

| Priority | League | Status | Players |
|---:|---|---|---:|
| 1 | Demo League | Active | 4/4 |
| 2 | SD Chess League | Draft | 4/4 |
| 3 | 1904 Sunday League | Completed | 4/4 |

The workspace resolver therefore selects the Club containing the active League, while the Club Events → Leagues view exposes the full list for selection.

## Validation

| Check | Result |
|---|---|
| Focused League routing tests | **84 passed** across 5 suites |
| TypeScript (`pnpm exec tsc --noEmit`) | **Passed** |
| Changed-file ESLint | **0 errors**; pre-existing warnings remain in ClubDashboard and MobileNavDrawer |
| Project lint (`pnpm lint`) | **Passed before full test run** |
| Production build (`pnpm run build`) | **Passed before full test run** |
| Local home and deep-link shell | HTTP 200 |
| Unauthenticated workspace/list APIs | HTTP 401 as intended for private Club data |
| Database association query | Confirmed active, draft, and completed League records for the affected Club |

## Full-suite baseline

`pnpm vitest run` completed with **7,048 passed, 2 skipped, 33 failed across 18 existing suites**. The Club League routing suites passed; the remaining failures are unrelated legacy source-contract/UI tests, including tournament wizard payment-toggle assertions.

## Browser limitation

The sandbox browser has no authenticated Club member session, so it correctly redirects the private Club deep link to `/clubs`. Authenticated rendering is covered by the server authorization, deep-link, and source-contract tests without modifying production data.
