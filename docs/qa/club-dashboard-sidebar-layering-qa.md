# Club Dashboard Sidebar Layering QA

**Scope:** Shared desktop Club navigation across the live Club Dashboard and read-only demo, including the compact rail and hover/focus-expanded sidebar states.

## Change

- Added an optional `expandedBackground` surface to the shared `ClubDashboardSidebar`.
- Preserved the compact rail’s existing surface while switching the expanded sidebar to a fully opaque Club-tinted surface, preventing translucent header chrome from visually bleeding through the revealed navigation.
- Raised and isolated the shared sidebar layer (`z-[60]`) so its expanded state consistently renders above the semi-transparent header.
- Applied the explicit opaque expanded surface in both live `ClubDashboard` and `ClubDashboardDemo` without changing the compact rail, mobile drawer, header controls, or navigation destinations.

## Regression coverage

- `client/src/__tests__/clubDashboardSidebarCompactRail.test.ts`
  - Guards the shared elevated/isolated layer, expanded state marker, opaque-surface selection, and live/demo integrations.
- `tests/club-dashboard-sidebar.test.tsx`
  - Renders the expanded sidebar and verifies the supplied opaque background wins over a translucent compact-rail background.

## Validation

| Check | Result |
| --- | --- |
| Focused Club navigation suites | **26 passed** across shared sidebar component, compact-rail source contracts, and private/demo workspace contracts |
| TypeScript | `pnpm exec tsc --noEmit` passed |
| Changed-file ESLint | 0 errors; existing warnings only in established large Club surfaces |
| Project lint | 0 errors; 229 established warnings |
| Production build | `pnpm run build` passed |
| Route health | `/clubs/demo`, live Club dashboard, and live League-tab route returned HTTP 200 |
| Desktop visual QA | 1440px demo dashboard retains the compact rail and clean header boundary |
| Mobile visual QA | 390px demo dashboard retains the existing mobile header and drawer trigger with no horizontal clipping |
| Expanded-sidebar interaction QA | At desktop hover, the sidebar measured 264px, reported `z-index: 60` and `isolation: isolate`, used an opaque `oklch(0.115 0.025 145)` surface, and won the header-overlap hit test |
| Diff integrity | `git diff --check` passed |

### Full regression baseline

`pnpm vitest run` completed with **7,267 passed, 2 skipped, and 27 existing unrelated failures across 18 suites**. The focused Club sidebar suites are green; the aggregate failures remain outside this sidebar refinement (including legacy Tournament Wizard source-contract expectations).

## Notes

The fix deliberately does not change the mobile navigation model or make the compact desktop rail opaque. The visual hardening occurs only while the desktop sidebar is expanded, which removes the perceived header overlap without changing the existing Club Dashboard layout or interaction model.
