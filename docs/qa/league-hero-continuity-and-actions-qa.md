# League Hero Continuity and Action Controls QA

## Scope

Refine the Club League desktop header so the League hero is the continuous identity surface, move the commissioner controls into that hero, and replace the remaining overview icon treatments with Lucide SVGs.

## Implemented

- Hid the separate desktop top bar in both `LeagueDashboard` and `LeagueDemo`; the compact header remains available below the desktop breakpoint.
- Moved the active commissioner action cluster into the center of the live League hero:
  - **Report** (renamed from “Report Results”)
  - **Advance**
  - Commissioner context remains visible without a detached container.
- Kept the status fallback inside the hero for draft and completed leagues.
- Moved desktop share and draft-notification controls onto the hero rather than dropping access when the top bar is hidden.
- Reserved desktop hero space for the League title, operational controls, and metrics to prevent collisions.
- Replaced overview iconography with Lucide SVGs:
  - `Binoculars` for **Prep for Next Round**
  - `Medal` for **My Standing**
  - `Trophy` for **Standings**
  - `Trophy` for the demo League’s standings preview

## Validation

- Focused Vitest: **51 passed** across League header, responsive, and lifecycle suites.
- TypeScript: `pnpm exec tsc --noEmit` passed.
- Changed-file ESLint: **0 errors**; six established warnings in the two large League pages.
- Project lint: **0 errors, 234 established warnings**.
- Production build: passed.
- Diff integrity: `git diff --check` passed.
- Route health: local and public `/league-demo`, plus local `/league/new`, returned HTTP 200.
- Visual QA: reviewed desktop and 390px mobile `/league-demo`; the desktop hero reaches the top of the content area without the former bar/seam, while the mobile compact header remains readable and intact.

## Baseline note

The full Vitest baseline completed with **7,175 passed, 2 skipped, and 28 established failures across 17 unrelated suites**. The focused League header, responsive, and lifecycle suites pass cleanly. The historical `leagueBacklogReconciliation` landing-page destination assertion remains unrelated to this UI change; its header-specific stale contract was updated to require the desktop-hidden top bar and hero-contained controls.
