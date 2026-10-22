# Club League Mobile Dashboard Audit — QA Record

**Scope:** Live `LeagueDashboard` and interactive `LeagueDemo` at 360px, 390px, and 430px in light and dark appearance modes. This audit preserves desktop workflows and all existing League result, reporting, and advancement behavior.

## Findings and implemented refinements

| Area | Mobile risk found | Delivered refinement |
| --- | --- | --- |
| Navigation | Six destinations were compressed into a fixed row, risking crowded labels and small targets. | Replaced both inline docks with a shared `LeagueMobileTabBar`: four priority destinations plus an accessible **More** sheet. Every target is at least 48px tall, with full accessible tab names despite concise visual labels. Current Matchup remains a direct destination. |
| Demo entry state | The Demo opened on the playoff bracket, not the player’s current match. | Demo now opens on the player-first Overview; Standings defaults to its readable table. The bracket remains an explicit Standings option. |
| Fixed mobile surfaces | Completed-week advance CTAs could compete with the phone dock. | Live and Demo advance surfaces now clear the dock using a safe-area-aware offset and use a full-width primary action on phones. |
| PWA prompt coexistence | The optional install prompt could visually cover the League dock. | When a League dock is present, the install prompt is raised above it and terminal League content receives extra clearance only while that prompt is visible. |
| Player Overview | The Week/deadline header could compete horizontally at narrow widths. | The live overview header stacks title and deadline below `sm`, then returns to the prior centered desktop treatment. |
| Commissioner reporting | Three outcomes were cramped into one phone row. | Live and Demo result choices stack to one clear, 44px-minimum control per row on phones; they retain the three-column desktop layout. Full-season rows also put the report action on its own phone row. |
| Schedule | The active week was not given enough priority on narrow screens. | The selected week now leads the single-column phone schedule, carries a clearer attention state, and returns to grid ordering from 420px up. |
| Demo shell | Fixed navigation and browser safe areas could reduce usable vertical space. | Demo uses `100dvh`, a mobile top-safe inset, horizontal containment, and dock-aware scroll clearance. |

## Accessibility and interaction checks

- The overflow panel is a labelled modal dialog, closes with the shared accessible-overlay behavior, and returns focus to its trigger.
- Full semantic names remain available for all compact dock controls: for example, visual `Manage` retains the accessible name **Commissioner**.
- The active destination exposes `aria-current="page"`.
- Touch targets measured at **48px high** at 360px, 390px, and 430px.
- Reduced-motion behavior remains governed by existing shared League motion rules; no new decorative motion was introduced.

## Browser and responsive QA

### Rendered tab audit

Using local Chromium with fresh theme state, all six Demo tabs were opened at each target viewport and in both appearance modes:

- **36 tab checks:** 6 tabs × 3 widths × 2 themes.
- **0 horizontal document overflows.**
- **0 hidden mobile docks.**
- The More sheet opened successfully at all viewport widths and themes.
- Theme verification confirmed both dark and light render modes.

### 360px interaction flow

At 360px dark appearance, the Demo:

1. opened on the player Overview;
2. presented the compact visible dock as `Home`, `Manage`, `Match`, `Ranks`, and `More`;
3. opened **Matchup** directly from the dock;
4. opened **Schedule** from More; and
5. maintained no horizontal overflow.

The completed-week Commissioner smoke test reported the seven remaining boards, revealed `Week 14 complete`, and displayed the advance footer from **490px–644px**, safely above the dock at **783px–844px**. The CTA read **Advance to Week 15** and remained fully visible/tappable.

## Automated validation

- Focused League suites: **48 tests passed / 8 files**
  - `leagueMobileNavigation`
  - `leagueDemoResponsive`
  - `leagueContentReadability`
  - `leagueCommissionerWorkspace`
  - `leagueScheduleCalendar`
  - `leagueCurrentMatchupAvatar`
  - `leagueMatchupCardMotion`
  - `leagueBacklogReconciliation`
- TypeScript: `pnpm exec tsc --noEmit --pretty false` passed.
- Production build: `pnpm run build` passed.
- Project lint: **0 errors / 223 established warnings**. Changed-file lint has **0 errors** and retains only the established `LeagueDashboard.tsx:981` effect-dependency warning.
- Full Vitest baseline: **7,318 passed / 2 skipped / 25 known unrelated failures across 17 suites**. None of the affected League mobile suites appear in those failures.

## Files in scope

- `client/src/components/league/LeagueMobileTabBar.tsx` — new shared mobile dock and accessible More sheet.
- `client/src/pages/LeagueDashboard.tsx` — live dock integration, Overview header responsiveness, and mobile-safe advance CTA.
- `client/src/pages/LeagueDemo.tsx` — Demo dock integration, player-first defaults, dynamic viewport shell, and phone-safe Commissioner controls.
- `client/src/components/league/FullSeasonLeaguePanels.tsx` — phone-first matchup/report rows.
- `client/src/components/league/LeagueMonthCalendar.tsx` — selected-week-first phone hierarchy.
- `client/src/styles/leagueContentReadability.css` — PWA prompt/dock coexistence and terminal-content clearance.
- Focused League regression tests listed above.
