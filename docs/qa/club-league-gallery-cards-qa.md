# Club League Gallery Cards QA

**Scope:** Club Dashboard League tab (`/clubs/:id/home?tab=leagues`) and read-only demo (`/clubs/demo`).

## Change

- Replaced the live Club League tab’s compact list rows with the same cover-led gallery-card hierarchy used by scheduled Events.
- Added a typed `ClubLeagueSummary` model and a reusable `ClubLeagueGalleryCard` that preserves live League name, description, status, roster count, week/roster progress, and the existing `/leagues/:id` destination.
- Each card uses the Event card’s 16:10 cover, overlay treatment, editorial title hierarchy, full-card navigation affordance, arrow cue, restrained lift/cover zoom, focus-visible ring, and reduced-motion handling.
- Status remains semantically distinct: active uses the Club accent, draft uses amber, and completed uses a neutral finish treatment. Draft and active cards expose real progress; completed seasons retain their completion label without a misleading progress meter.
- Mirrored the gallery system in the demo with active and draft fixtures, then added `/clubs/demo?tab=leagues` as a directly addressable demo view for repeatable review.
- Updated stale Quick Actions source-contract assertions to cover the current implementation rather than restoring prior, superseded layout assumptions.

## Regression coverage

`client/src/__tests__/clubLeagueGalleryCards.test.ts`

- Guards the live Events-aligned gallery layout, image proportion, hierarchy, click destination, visible status/progress context, reduced-motion classes, and responsive grid.
- Guards the demo cards and the direct `?tab=leagues` entry path.

## Validation

| Check | Result |
| --- | --- |
| Focused Club suites | **12 passed** across the new League gallery, Club Events workspace, and overview cleanup contracts |
| TypeScript | `pnpm exec tsc --noEmit` passed |
| Changed-file ESLint | 0 errors; 70 existing warnings in the large Club Dashboard surfaces |
| Project lint | 0 errors; 233 established warnings |
| Production build | `pnpm run build` passed |
| Route health | Local `/clubs/demo?tab=leagues`, live Club League, and Clubs routes returned HTTP 200 |
| Desktop visual QA | 1440px direct demo League route rendered two aligned, unclipped cards with consistent cover, status, metadata, and progress hierarchy |
| Mobile visual QA | 390px direct demo League route rendered a single-column gallery with no horizontal clipping; the second card continues below the viewport as intended |
| Browser interaction QA | Demo sidebar opens League cards; two cards measured 436×471px at 1280px with no horizontal overflow; the full-card control navigated to `/league-demo` |
| Diff integrity | `git diff --check` passed |

### Full regression baseline

`pnpm vitest run` completed with **7,208 passed, 2 skipped, and 27 existing unrelated failures across 18 suites**. The focused Club League and Events suites are green. The baseline failures are outside the changed Club League card files, including legacy source-contract expectations in Tournament Wizard coverage.

## Notes

The visual remodel does not change League creation, roster state, progress calculation, permissions, or live League data loading. It only elevates the entry cards into the established Club Events visual system while keeping the original League route and season metadata intact.
