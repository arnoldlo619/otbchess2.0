# Club Dashboard Sidebar Standardization — QA Record

**Date:** 2026-10-07  
**Scope:** Desktop Club workspace sidebar treatment across the primary Club Dashboard, public Club profile, Meetup detail, QR Check-in, and the read-only Club demo.

## Delivered

- Reused `ClubDashboardSidebar` for primary Club, Meetup, and Check-in workspace rails.
- Standardized the compact rail at 72px and expanded panel at 264px.
- Enlarged desktop destination controls to 52px with 40px icon surfaces for better visual weight and touch-adjacent pointer targets.
- Kept the destination stack vertically centered; labels reveal on pointer hover and keyboard focus.
- Moved Settings into the centered primary stack for root and child Club workspaces.
- Added the contextual `Back to Club` footer action on root, Meetup, and Check-in surfaces.
- Displays each Club’s uploaded avatar in the sidebar header; a broken or unavailable image safely falls back to the supplied OTB!! thumbnail.
- Updated the legacy public Club profile header brand to apply the same Club-avatar-first / OTB fallback rule.
- Retained vector icons, `aria-current`, tooltips in compact mode, visible focus rings, and reduced-motion safeguards.

## Visual QA

- **Desktop compact:** `/clubs/demo`, 1440×900 — 72px checker-textured rail, centered destinations, clear selected state, OTB fallback correctly rendered for the demo.
- **Desktop expanded:** `/clubs/demo` hovered in the browser — 264px panel, no icon shift, labels aligned, active frame remains contained, no content overlap.
- **Mobile:** `/clubs/demo`, 390×844 — existing mobile header/menu flow remains intact; desktop sidebar remains hidden at the mobile breakpoint.

## Automated validation

| Check | Result |
|---|---:|
| Focused sidebar/profile/demo Vitest suites | 23 passed / 4 files |
| TypeScript | Passed (`pnpm exec tsc --noEmit`) |
| Changed-file ESLint | Passed with 0 errors |
| Project ESLint | Passed with 0 errors; 233 established warnings |
| Production build | Passed (`pnpm run build`) |
| Diff integrity | Passed (`git diff --check`) |
| Local and public Club demo routes | HTTP 200 for `/clubs/demo`, Events, and Feed |

## Known limitation

The read-only demo has no uploaded Club avatar by design, so its sidebar intentionally exercises the OTB!! fallback. Live Club, Meetup, Check-in, and profile screens pass their persisted `avatarUrl` into the shared sidebar.
