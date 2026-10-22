# ClubProfile Shared Rail Migration — QA

**Scope:** The member-facing `ClubProfile` desktop route (`/clubs/:id`) only. Mobile navigation remains intentionally unchanged.

## Delivered

- Replaced the legacy, independently maintained desktop ClubProfile sidebar with the shared `ClubDashboardSidebar` used by the current Club and League dashboards.
- Preserved the current rail behavior and brand system:
  - compact **72px** rail by default;
  - pointer-hover and keyboard-focus expansion to **264px**;
  - animated OTB thumbnail in compact mode and the shared retro wordmark on expansion;
  - active, hover, focus-visible, badge, reduced-motion, and branded return behaviors inherited from the canonical component.
- Reserved rail width in the ClubProfile layout as it expands, preventing its labels from covering the page content.
- Kept member/visitor information architecture intact by sourcing destinations from `clubProfileNavigationTabs(joined)`:
  - visitors: Home, Feed, Events, Members;
  - members: adds Album and Leagues.
- Preserved unread feed/event/league badges and moved owner/director Settings into the shared rail's management group.
- Added an optional shared-rail footer slot so the ClubProfile account menu remains available without recreating a second sidebar footer.
- Left the existing mobile bottom navigation untouched.

## Focused validation

```text
pnpm vitest run \
  tests/club-home-profile-layout.test.ts \
  tests/club-profile-sidebar-navigation.test.ts \
  client/src/__tests__/clubProfileSidebarFooter.test.ts \
  client/src/__tests__/clubDashboardSidebarCompactRail.test.ts \
  tests/club-dashboard-sidebar.test.tsx
```

Result: **5 files / 30 tests passed**.

## Browser QA

A disposable authenticated ClubProfile fixture was created solely to inspect the real member-facing route, then removed along with its temporary Club, membership, and account records.

| Check | Result |
| --- | --- |
| Compact desktop rail | Confirmed 72px thumbnail rail with icon-only navigation. |
| Pointer expansion | Confirmed smooth expansion to 264px with the 80px retro wordmark and readable labels. |
| Keyboard expansion | Focusing `Home` expanded the rail to 264px after the transition, preserving keyboard access. |
| Content clearance | The expanding rail's reserved layout column kept content visually clear of rail labels. |
| Mobile | Existing bottom navigation markup was preserved and covered by the focused source contract; no mobile navigation code was changed. |
| Fixture cleanup | Post-QA database check returned `club: 0`, `member: 0`, `user: 0`. Browser session was logged out. |

## Release validation

| Check | Result |
| --- | --- |
| Production build | Passed (`pnpm run build`) |
| TypeScript | Passed (`pnpm exec tsc --noEmit --pretty false`) |
| Changed-file ESLint | 0 errors; 51 pre-existing warnings in `ClubProfile.tsx` |
| Project lint | 0 errors; 223 established warnings |
| Diff integrity | Passed (`git diff --check`) |
| Full Vitest baseline | **7,312 passed, 2 skipped, 25 established unrelated failures across 17 legacy suites** |

The full-suite run contains no failure in `club-home-profile-layout`, `club-profile-sidebar-navigation`, `clubProfileSidebarFooter`, `clubDashboardSidebarCompactRail`, or `club-dashboard-sidebar`.
