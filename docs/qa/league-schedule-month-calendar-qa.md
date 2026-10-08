# League Schedule — Monthly Glass Calendar QA

## Scope

Replaced the stacked weekly Schedule cards with a shared, **monthly-only** League calendar for both the persisted League Dashboard and the League Demo.

## Delivered behavior

- One responsive calendar surface uses **four columns on desktop** (four rows for a 16-week season), two columns on tablet, and one readable column on mobile.
- Each week is a semantic keyboard-accessible button with selection state, completion/current/upcoming status, matchup count, and real reporting progress.
- Real League schedules map persisted `weeks[].matches` data into the calendar; selecting a week updates the detail ledger and retains an **Open matchups** route to reporting tools.
- The demo uses the same component, selection behavior, status hierarchy, and current-week detail treatment—without random completion values.
- The supplied overhead chess-board image is staged at `client/public/images/league-schedule-chess-lawn.jpg` and rendered as a deliberately subdued decorative backdrop beneath the frosted calendar surface.
- No weekly/monthly mode switch, fake event creation, or unused placeholder controls were introduced.

## Visual and responsive QA

- Desktop: inspected the Demo League at 1280px and the persisted **SD Chess League** Schedule. The calendar fills the Schedule workspace, preserves the League hero, presents real schedule data, and shows the selected-week detail ledger immediately below.
- Mobile (390×844): verified the Demo calendar collapses to one clear column with no horizontal overflow, all 16 weeks remain readable/tappable, and selecting Week 15 updates the ledger.
- Standard League: selected Week 2 in the real SD Chess League; the selection updated to its actual stored pairings (`Arnold Lo vs MagnusCarlsen`, `AJ vs Hansontwitchh`).

## Automated validation

| Check | Result |
|---|---:|
| Focused Schedule, Demo responsive, header, and lifecycle tests | 56 passed / 4 files |
| TypeScript (`pnpm exec tsc --noEmit`) | Passed |
| Changed-file ESLint | 0 errors; established warnings only |
| Project lint (`pnpm lint`) | 0 errors / 233 established warnings |
| Production build (`pnpm run build`) | Passed |
| Route health | Local/public Demo, real League, new League, and background image returned HTTP 200 |
| Diff integrity | `git diff --check` passed |
| Full Vitest baseline | 7,179 passed, 2 skipped; 29 known unrelated failures across 17 legacy suites |

## Accessibility notes

- Calendar cells use native buttons, a descriptive `aria-label`, `aria-pressed`, and visible keyboard focus rings.
- The image is CSS decoration rather than content, so it does not add a redundant image announcement.
- The selected-week detail section uses an associated heading and retains readable text contrast in both appearances.
