# Compact League Banner QA

**Scope:** Reduce the visual weight of the shared Club League header banner while preserving clear League identity, Commissioner access, season metrics, and responsive legibility.

## Design decision

The supplied desktop reference showed a 292px-tall capture where the League title was visually larger than the surrounding operational information. The update uses one compact scale for both the production League Dashboard and public League Demo:

| Surface | Before | After |
|---|---:|---:|
| Desktop banner height | 156px production / 120px demo | 120px |
| Tablet banner height | 144px production / 120px demo | 112px |
| Mobile banner height | 132px production / 120px demo | 104px |
| Hero title scale | Up to 40px production / 36px demo | Up to 32px |

The left-aligned League name remains the highest-emphasis text. Supporting club/format metadata, the centered Commissioner action for authorized users, and right-aligned metrics retain their existing readable hierarchy and interaction targets.

## Implementation

- `LeagueDashboard.tsx`
  - Uses a responsive `104 / 112 / 120px` hero height.
  - Uses `clamp(1.5rem, 4vw, 2rem)` for the League name.
- `LeagueDemo.tsx`
  - Matches the same responsive banner and title scale for visual parity.
- Regression contracts verify the compact shared banner dimensions and typography in both implementations.

## Visual QA

- **Desktop (1440px):** Production and demo headers render as clean 120px identity bars. The League title, subtitle, Commissioner control, and metrics remain visually separated and readable.
- **Mobile (390px):** Headers reduce to 104px without horizontal overflow. League name and supporting metadata remain legible; desktop-only controls and metrics retain their existing responsive behavior.
- The header remains directly adjacent to page content with no reintroduced post-banner inset.

## Validation

| Check | Result |
|---|---|
| Focused League suites | 20 passed / 4 files |
| Targeted compact-banner contract | 1 passed |
| TypeScript (`tsc --noEmit`) | Passed |
| Changed-file ESLint | 0 errors; 1 established hook-dependency warning in `LeagueDashboard.tsx:956` |
| Production build | Passed |
| Project lint | 0 errors / 225 established warnings |
| `git diff --check` | Passed |

## Known baseline note

A broader `leagueBacklogReconciliation` run includes one stale landing-navigation expectation (`"Open your Club Leagues"` vs the existing current label `"Open your League dashboard"`). The compact-banner contract itself passes independently; this change does not modify `Home.tsx` or landing navigation behavior.
