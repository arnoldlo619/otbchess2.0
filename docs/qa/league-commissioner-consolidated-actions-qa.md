# League Commissioner Action Consolidation QA

**Scope:** Standard Club League dashboards and `/league-demo`.

## Change

- Replaced the active League hero's separate Commissioner, Report, and Advance controls with one explicit **Commissioner** entry point.
- Replaced the operational crown treatment with the existing Lucide Settings glyph, preserving an accessible name and the established restrained green hover glow.
- Kept a single 44px mobile tap target that opens the same workspace.
- Added an in-flow sticky **Advance to next week** footer that appears only once every current-week board is reported.
- The live footer opens the existing irreversible advance confirmation. The demo footer routes to the selected Week 15 schedule after all demo results are reported.
- Added focus-visible and reduced-motion-safe treatment to the new next-week CTA.

## UX checks

| Check | Result |
| --- | --- |
| Header hierarchy | One desktop Commissioner control remains in the active League hero; redundant Report and Advance controls are removed. |
| Mobile reachability | The compact header retains one labeled, 44px Commissioner target. |
| Completion state | The live footer requires a non-empty current week and every match to have `resultStatus === "completed"`. |
| Next step clarity | The footer explicitly confirms the completed week and presents the next-week action without a persistent or looping animation. |
| Demo flow | Completed all seven pending demo boards; the footer rendered at 12/12 reports and its action moved the demo to the Week 15 schedule. |
| Visual review | Checked demo and active League routes at 1440px and 390px. No horizontal overflow or header-cluster regression observed. |
| Route health | `/league-demo`, `/league/NlGsu0f5XroLQNzk`, and `/league/LEXTY-W_TW2YuLY8` returned HTTP 200. |

## Automated validation

| Check | Result |
| --- | --- |
| Focused League suites | **60 passed** across 5 suites. |
| TypeScript | `pnpm exec tsc --noEmit` passed. |
| Changed-file ESLint | 0 errors; one established `LeagueDashboard.tsx` hook-dependency warning. |
| Project lint | 0 errors; 225 established warnings. |
| Production build | `pnpm run build` passed. |
| Diff integrity | `git diff --check` passed. |
| Full Vitest baseline | **7,277 passed, 2 skipped, 26 existing unrelated failures across 18 suites**. All affected League suites pass. |

## Regression coverage

- `client/src/__tests__/leagueCommissionerWorkspace.test.ts`
- `client/src/__tests__/leagueHeaderActionCluster.test.ts`
- Existing League lifecycle, responsive, and matchup motion suites.
