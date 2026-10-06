# League Player Season Card QA

## Scope

Completed the FCL Phase 5 player-season card flow for completed League seasons:

- Server-rendered, deterministic PNG cards at `GET /api/leagues/:leagueId/player-card/:playerId`
- Per-standing **Card** actions in the completed Season Summary
- Accessible preview modal before download/share
- Downloadable image output and native image sharing, with a copy-link or new-tab fallback

## Product behavior verified

- The endpoint rejects missing leagues, active seasons, and players without a final standing.
- Final cards use persisted League standings only and render a first-party 1200×630 PNG.
- Cards include OTB branding, club and League context, season format/week count, player identity, rank badge, points, W/D/L, and a rank-derived best result.
- The completed Season Summary adds a compact per-player Card action without changing the standings hierarchy.
- A signed-in player whose `user.id` matches a standing sees **Your Card**; other rows show **Card**.
- The preview modal provides a labelled close control, focus trapping, Escape dismissal, Download Card, and Share Card actions.

## Automated validation

| Check | Result |
| --- | --- |
| `pnpm exec tsc --noEmit` | Passed |
| `pnpm vitest run tests/league-season-card.test.ts tests/league-season-card-contract.test.ts client/src/__tests__/leagueLifecycle.test.ts` | Passed — 3 files, 49 tests |
| Changed-file ESLint | Passed — 0 errors; 5 established `LeagueDashboard.tsx` warnings only |
| `pnpm lint` | Passed — 0 errors, 235 established warnings |
| `pnpm run build` | Passed |
| `git diff --check` | Passed |
| Real completed-season endpoint | Passed — HTTP 200, PNG signature, 1200×630, 103,302 bytes |

## Visual QA

- Opened the completed 1904 Sunday League Season Summary in the browser.
- Confirmed every final-standing row exposes a compact Card action.
- Opened MagnusCarlsen’s card preview and confirmed the rendered image, overlay focus surface, close control, Download Card, and Share Card actions.
- Inspected the generated image directly: restrained forest background, readable hierarchy, rank badge, and no emoji/UI-glyph substitution.

## Full-suite baseline

`pnpm vitest run` reports **421 passed, 2 skipped, 16 failed files / 30 failed tests**. The failures are pre-existing source-contract and stale visual expectations in unrelated sidebar, Club Home, forecast, service worker, tournament wizard, and global accessibility suites. The League player-card-focused suites pass cleanly.
