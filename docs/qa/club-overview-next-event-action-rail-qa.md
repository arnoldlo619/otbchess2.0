# Club Overview: Next Event Card + Action Rail QA

**Date:** 2026-10-08  
**Scope:** Club Owner Overview in the real Club Dashboard and read-only Club Dashboard demo.

## Delivered

- Rebuilt **Next Event** as the same editorial media-row system used by **Recent Activity**:
  - Section header with `Club schedule`, `Next Event`, and a named `View all` action.
  - Larger, responsive image treatment (`116×96` on compact layouts; `136×112` from `sm`).
  - Event-kind overlay, event title, date/time, optional venue, and compact RSVP action.
  - Real dashboard uses the event cover, then the Club banner, then a chess-pattern fallback.
  - Demo uses the existing Club banner image so its visual language matches the live workspace.
- Moved the desktop Quick Actions rail farther right without reducing or reformatting the central Next Event / Club Timeline content:
  - Gap increased to `3.5rem`.
  - Rail widened to `224px` and its internal guide offset increased for legibility.
  - Desktop rail stays sticky; compact breakpoints retain the existing inline grid.

## Automated validation

| Check | Result |
|---|---|
| Targeted Vitest | **17 passed** across 3 suites |
| TypeScript | `pnpm exec tsc --noEmit` passed |
| Changed-file ESLint | 0 errors; existing warnings only |
| Project ESLint | 0 errors; 233 established warnings |
| Production build | `pnpm run build` passed |
| Diff integrity | `git diff --check` passed |
| Local routes | `/clubs/demo`, Events, Feed, and `/clubs` returned HTTP 200 |
| Public routes | Same routes returned HTTP 200 |

## Browser QA

- Desktop (1600px): Next Event and Club Timeline remained `896px` wide; the `224px` action rail begins `56px` after the content edge. No horizontal overflow.
- Mobile (390px): media card stacks naturally, the action rail remains inline after the timeline, and no horizontal overflow occurred.
- Demo interaction checks passed:
  - Next Event **View all** opens the Events workspace.
  - Next Event **RSVPs** opens the Events workspace.
  - No unexpected browser errors occurred. The Vite development WebSocket close notice was excluded as non-application transport noise.

## Full-suite baseline

`pnpm vitest run` completed with **7,182 passing**, **2 skipped**, and **29 pre-existing failures across 17 suites**. The changed Club Overview suites passed. The known unrelated `tournamentWizardPaymentToggle` source-contract failure remains unchanged.

## Accessibility / UX notes

- Controls use semantic buttons with explicit RSVP labels.
- Image fallback remains decorative when no meaningful event image is available.
- Focus rings, minimum-size action controls, light/dark surface tokens, and reduced-motion-safe transitions are retained.
