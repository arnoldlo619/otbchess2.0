# Club Overview logo navigation and action rail QA

**Scope:** Club dashboard and demo overview navigation/Quick Actions refinement.

## Completed behavior

- The fixed OTB!! brand mark in the desktop Club sidebar now always takes users to `/clubs`.
- The same Club-index return behavior is applied in the real Club dashboard, Club Meetup page, and Meetup Check-in page.
- The owner Quick Actions no longer consumes width from the Club Timeline.
  - At desktop widths of 1440px and above, actions render as a compact right-side timeline rail with a guide line and icon nodes.
  - Below that breakpoint, actions become a responsive inline grid beneath the Timeline so no content is clipped or compressed.
- The demo dashboard mirrors the live dashboard’s action-rail geometry and action semantics.

## Automated validation

| Check | Result |
| --- | --- |
| Focused sidebar, overview, compact-rail, and demo contracts | **27 passed** across 4 suites |
| TypeScript | Passed (`pnpm exec tsc --noEmit`) |
| Changed-file ESLint | 0 errors; established warnings only |
| Project ESLint | 0 errors; 234 established warnings |
| Production build | Passed (`pnpm run build`) |
| Diff integrity | Passed (`git diff --check`) |
| Local routes | `/clubs`, `/clubs/demo`, `/clubs/demo?tab=feed`, `/clubs/demo?tab=events` all returned HTTP 200 |
| Full Vitest baseline | 7,168 passed, 2 skipped; 28 established unrelated failures across 17 suites |

## Browser QA

- At **1440×980**, the demo Timeline remained **896px** wide; the action rail rendered to its right at **172px** wide with no overlap or horizontal clipping.
- At **390×844**, the action rail reflowed beneath the Timeline at **358px** wide; Timeline content remained full width and readable.
- Desktop activation of the sidebar OTB!! mark navigated to **`/clubs`**.
- Mobile activation of **Post** changed the demo’s active workspace to **Feed** and rendered three Feed cards.

## Notes

- The brand mark remains visible only in the desktop compact sidebar. Mobile navigation retains its dedicated header/menu controls.
- No data contracts, permissions, Club memberships, or event behavior were changed.
