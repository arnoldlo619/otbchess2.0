# Instagram Carousel Accent Contrast QA

## Scope

Improved readability across the Tournament Recap Instagram carousel’s default Classic export palette. The formerly muted gray secondary text is now the warm ChessOTB pastel yellow/off-white token (`#FBFADA`).

## Delivered behavior

- Updated the default **Classic** slide theme’s semantic secondary accent from muted green-gray to `BRAND.offWhite` (`#FBFADA`).
- Routed secondary text through the selected theme’s `accentLight` token across every standard export surface:
  - Cover metadata and champion details
  - Podium labels and ELO/points context
  - Standings headers, usernames, W-D-L data, and overflow count
  - **By the Numbers** labels and supporting values including **registered**, **Double Swiss/format**, **rating**, and **played**
  - CTA support copy and invite metadata
  - Round results headers, usernames, legend, and BYE state
  - Elimination results metadata
  - Slide counters and the shared footer club name
- Preserved color flexibility: non-Classic palette selections retain their own readable `accentLight` color rather than receiving a forced yellow treatment.

## Visual QA

Validated the live completed Quads tournament flow at:

`/tournament/otb-demo-2026/manage?mockQuads=complete`

1. Opened **Create Recap**.
2. Switched to **Stats** (Slide 4 of 6) under the default Classic theme.
3. Confirmed the rendered texts **Players**, **registered**, **Rounds**, **Swiss**, **Avg ELO**, **rating**, **Games**, **played**, **Most Wins**, and **Highest Rated** all compute to `rgb(251, 250, 218)` / `#FBFADA`.
4. Confirmed the white numeric values and names remain distinct, preserving the intended two-level hierarchy while removing the low-contrast gray treatment.

## Automated validation

| Check | Result |
| --- | --- |
| Focused carousel suites | **166 passed** across 8 files |
| New accent-contrast regression coverage | **3 passed** |
| TypeScript | `pnpm exec tsc --noEmit --pretty false` passed |
| Changed-file ESLint | **0 errors**; 9 established unused-value warnings in `InstagramCarouselModal.tsx` |
| Production build | `pnpm run build` passed |
| Project lint | **0 errors / 224 established warnings** |
| Diff integrity | `git diff --check` passed |

## Full-suite baseline

`pnpm vitest run` completed with **7,285 passed / 2 skipped / 27 failed** across **19 established unrelated legacy suites**. The updated carousel suites all pass; no Carousel/Instagram regression is among the failures.
