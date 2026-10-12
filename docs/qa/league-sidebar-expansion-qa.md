# League Sidebar Expansion QA

## Scope

Applied the Club Dashboard's compact-to-expanded rail pattern to both League surfaces:

- Live League Dashboard: `/league/:leagueId`
- Public League Demo: `/league-demo`

The existing League destinations, mobile navigation, and Club-style visual language are preserved.

## Delivered behavior

- Desktop rail starts as a **72px icon rail** and expands smoothly to **264px** on pointer hover or keyboard focus.
- Item labels reveal with the existing restrained Club Dashboard choreography; the active destination retains its branded frame.
- The expanded rail uses an opaque, isolated surface at a high layer. The desktop content shell simultaneously reserves the same 264px width, preventing visual or interactive overlap.
- The League and Demo rails retain their existing Back action as a footer control, while the OTB mark remains the primary return affordance.
- Commissioner uses the shield-based Commissioner icon in both live and demo rail navigation; Settings remains separate in the live Commissioner footer.
- Mobile navigation is unchanged because the expanding desktop rail and spacer remain `lg`-only.
- Existing focus-visible, touch-safe, and reduced-motion behavior is inherited from the shared Club Dashboard rail.

## Visual and interaction QA

| Check | Result |
| --- | --- |
| Live League compact rail | Verified at `/league/NlGsu0f5XroLQNzk` |
| Live League expanded rail | Verified through browser hover and DOM geometry: rail 264px; content begins at 264px; opaque background confirmed |
| Demo compact rail | Verified at `/league-demo` |
| Demo expanded rail | Verified through browser hover and DOM geometry: rail 264px; content begins at 264px; opaque background confirmed |
| Mobile League surfaces | Verified at 390×844; desktop rail remains hidden and mobile header/navigation behavior remains intact |
| Accessibility behavior | Shared rail preserves keyboard focus expansion, focus-visible rings, touch filtering, and reduced-motion transition removal |

## Automated validation

- Focused sidebar and League regression suites: **42 passed / 8 files**
  - `clubDashboardSidebarCompactRail`
  - `leagueCommissionerWorkspace`
  - `leagueContentReadability`
  - `leagueCurrentMatchupAvatar`
  - `leagueDemoResponsive`
  - `leagueHeaderActionCluster`
  - `leagueMatchupCardMotion`
  - `leagueScheduleCalendar`
- TypeScript: `pnpm exec tsc --noEmit --pretty false` passed.

## Final release validation

- Production build: passed.
- TypeScript: passed.
- Changed-file ESLint: 0 errors; one pre-existing `LeagueDashboard` hook-dependency warning remains.
- Project ESLint: 0 errors; 225 established warnings.
- Diff integrity: `git diff --check` passed.
- Full Vitest baseline: **7,280 passed / 2 skipped / 27 known failures across 19 unrelated suites**. The only League-labelled failure is a pre-existing stale assertion: it expects the signed-in landing tooltip to say `Open your Club Leagues`, while the current committed landing behavior correctly says `Open your League dashboard`. All changed League/sidebar suites pass.
