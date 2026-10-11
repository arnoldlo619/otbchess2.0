# Instagram Story Recap Layout QA

## Scope

Refined the Instagram Story recap export templates in `InstagramCarouselModal` so 1080×1920 Story posts use the available vertical canvas intentionally rather than inheriting square-carousel proportions.

## Layout coverage

| Slide | Story treatment validated |
| --- | --- |
| Cover | Larger champion image and type, elevated metadata, expanded runner-up summary, branded lower safe zone |
| Podium | Taller 1st/2nd/3rd podium blocks, larger score hierarchy, dedicated vertical placement |
| Standings | Enlarged heading, column labels, row typography, and Story-safe footer reserve |
| Stats | Larger metric tiles and supporting insight rows with expanded vertical rhythm |
| CTA | Larger OTB watermark, headline, CTA action, and scan/join prompt |
| Round results | Larger Story table rows, outcomes, labels, and score cells |
| Elimination results | Taller champion/runner-up/finalist cards with the same safe-area system |

## Automated validation

- Focused Story/carousel suite: **121 passed** across five files:
  - `instagramStoryComposition.test.ts`
  - `instagramStoryFormat.test.ts`
  - `instagramCarousel.test.ts`
  - `instagramCarouselEditorControls.test.ts`
  - `pngExport.test.ts`
- TypeScript: `pnpm exec tsc --noEmit` passed.
- Changed-file ESLint: **0 errors**; 10 established warnings in `InstagramCarouselModal.tsx`.
- Project lint: **0 errors / 233 established warnings**.
- Production build: `pnpm run build` passed.
- Route health: HTTP 200 for the completed recap entry point, results, and report routes.
- Diff integrity: `git diff --check` passed.

## Rendered browser QA

Validated the completed Quads recap workflow in Story mode at its actual **1080×1920** output dimensions:

- Switched through Cover, Podium, Standings, Stats, CTA, and Rounds.
- Confirmed every standard Story slide retained an in-bounds 1080×1920 render surface.
- Inspected cover and podium geometry to confirm larger Story elements sit inside the safe composition area.
- Confirmed standings and round-ledger density remains readable and fits within the branded footer boundary.

## Full baseline note

Full Vitest baseline completed with **7,255 passed / 2 skipped / 27 failures across 18 legacy suites**. The Story/carousel suites added and touched in this change pass; the displayed baseline failure sample is an existing `tournamentWizardPaymentToggle` source-contract mismatch outside this scope.
