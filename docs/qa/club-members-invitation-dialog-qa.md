# Club Members Invitation Dialog — QA

**Date:** 2026-10-05  
**Scope:** Replace the inline Members-tab invitation drawer with a focused, responsive dialog.

## Outcome

- Removed the inline **Invite Members** dropdown/input panel from the Members tab.
- The compact Members-header action, new-club growth action, and Growth Toolkit action now open one shared invitation dialog.
- Preserved the existing server-backed invitation lifecycle: create link, copy link, view pending invitations, refresh, and revoke.
- Kept the interaction owner/director-only.

## UX and accessibility checks

- Desktop dialog is centered; mobile uses a bottom-sheet entry with rounded top corners and safe viewport sizing.
- Initial focus moves to the email input; focus is trapped and restored by the existing `useAccessibleOverlay` hook.
- Escape, close control, and backdrop dismiss all close the dialog.
- Input has a visible associated label, `type="email"`, `inputMode="email"`, and autocomplete support.
- Primary action has a 44px minimum touch target, loading/disabled feedback, and visible focus treatment.
- Pending invitation management remains available without adding clutter to the Members roster page.
- Uses existing Lucide SVG icons only; no new emoji glyphs were added.

## Validation

| Check | Result |
|---|---|
| Focused Vitest: workspace header + Events workspace | 9 passed / 0 failed |
| TypeScript | Passed (`pnpm exec tsc --noEmit`) |
| Changed-file ESLint | 0 errors; 67 established `ClubDashboard` warnings |
| Project ESLint | 0 errors; 234 established project warnings |
| Production build | Passed (`pnpm run build`) |
| Local preview health | `/`, `/clubs`, and `/clubs/demo` returned HTTP 200 |
| Diff integrity | Passed (`git diff --check`) |
| Private-workspace browser QA | Blocked intentionally: browser session is unauthenticated and redirects private Club routes to `/clubs`; no production Club data was changed |
| Full Vitest baseline | 7,049 passed, 2 skipped, 33 pre-existing failures across 18 suites; the new focused invitation coverage passes |

## Regression coverage

`tests/club-dashboard-workspace-headers.test.ts` now asserts:

- the header action opens the dialog flow;
- legacy inline invitation state and DOM identifiers are absent;
- the dialog exposes semantic modal attributes, email input semantics, focus management, responsive bottom-sheet geometry, and pending-invite management;
- the existing compact workspace header hierarchy remains intact.
