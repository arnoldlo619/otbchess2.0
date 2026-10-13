# Compact League Header and Prep Scout QA

**Scope:** Further reduce the visual weight of the shared Club League header while preserving readable League identity, Commissioner access, and season metrics. Add intentional separation before the working surface and simplify the player matchup preparation action.

## Design decision

The supplied reference showed the League identity banner still reading as too tall for an operations dashboard. The current treatment makes it a compact identity bar rather than a hero surface:

| Surface | Previous compact version | Current version |
|---|---:|---:|
| Desktop banner height | 120px | 96px |
| Tablet banner height | 112px | 88px |
| Mobile banner height | 104px | 84px |
| League title cap | 32px | 26px |
| Content separation below banner | None | 16px mobile / 20px desktop |

The name remains the primary label. Supporting club/format metadata, the centered Commissioner control for authorized users, and right-aligned season metrics retain their established hierarchy without expanding the banner.

## Implementation

- `LeagueDashboard.tsx`
  - Uses `84 / 88 / 96px` hero height and a `clamp(1.25rem, 2.4vw, 1.625rem)` League title.
  - Adds a responsive `16 / 20px` inset before the dashboard working surface.
  - Replaces the oversized green preparation block with a 44px minimum-height, pastel-yellow, bordered **Prep Scout** button. It preserves the existing opponent-scoped prep route, visible keyboard focus, descriptive accessible name, and restrained hover/reduced-motion behavior.
- `LeagueDemo.tsx`
  - Uses the same banner and post-banner spacing values for parity with production League dashboards.
- League source contracts protect the banner scale, spacing, and Scout action semantics.

## Visual QA

- **Desktop (1440px):** The live League header reads as a 96px compact identity bar; title, metadata, right-side metrics, and surrounding surface remain readable. The new content gap clearly separates identity from the first dashboard card.
- **Mobile (390px):** The header reduces to 84px, keeps the League title and format metadata legible, and preserves a clear 16px transition before the match surface. No horizontal overflow or clipping observed.
- **Demo parity:** Desktop and mobile `/league-demo` use the same compact header scale and deliberate content separation.
- **Prep Scout:** Source-level regression coverage confirms the existing opponent-specific navigation now uses the concise label, pastel-yellow outline treatment, and accessible `Open Prep Scout for …` name. The live visual QA account had no attached current-week matchup, so the conditional CTA did not render in-browser for that route.

## Validation

| Check | Result |
|---|---|
| Focused League suites | 20 passed / 4 files |
| Targeted compact-header contract | 1 passed |
| TypeScript (`tsc --noEmit`) | Passed |
| Changed-file ESLint | 0 errors; 1 established hook-dependency warning in `LeagueDashboard.tsx:956` |
| Production build | Passed |
| Project lint | 0 errors / 225 established warnings |
| Full Vitest baseline | 7,282 passed / 2 skipped / 27 established unrelated failures across 19 suites |
| `git diff --check` | Passed |

## Baseline note

The broader `leagueBacklogReconciliation` suite contains one established stale landing-navigation expectation (a retired landing-page tooltip string). The compact-header contract itself passes independently; this change does not modify `Home.tsx` or landing navigation behavior. All focused League header, readability, Commissioner, and responsive suites pass.
