# Performance Report Brand and Tournament Form QA

**Scope:** Tournament performance report player cards and the shared report header.

## Delivered behavior

- Replaced externally hosted OTB image references with one local, production-bundled asset: `/brand/otb-logo-exclamation.webp`.
  - The shared `NavLogo` used in the report header now uses this asset.
  - Every player-card footer uses the same asset, including export-quality cards.
- Replaced remote Chess.com recent-history fetches with the report's existing `roundHistory` data.
  - The card now shows **Recent Tournament Form**.
  - It reports aggregate `W / D / L` totals and the last five recorded tournament results as readable result tokens.
  - No external Chess.com analysis request is made solely to populate player-card form.
- Increased compact performance-card typography for metadata, stat labels, W/D/L counts, form detail, footer labels, and player result detail.
- Reworked achievement chips to use a larger, wrapping-safe identity-stack treatment. Labels are clean text (for example, `Quad 1 Champion` and `Giant Killer`) without decorative emoji glyphs or header overlap.

## Automated validation

| Check | Result |
|---|---|
| Focused performance suites | **69 passed** across PlayerStatsCard, accent controls, report appearance, tournament-integrity, performance stats, and Quads report coverage |
| TypeScript | `pnpm exec tsc --noEmit` passed |
| Changed-file ESLint | 0 errors; 3 established warnings in `Report.tsx` |
| Production build | `pnpm run build` passed |
| Project lint | 0 errors; 233 established warnings |
| Route and asset health | `/tournament/otb-demo-2026/report`, `/tournament/otb-demo-2026/manage`, and `/brand/otb-logo-exclamation.webp` returned HTTP 200 |
| Production bundle asset | Local OTB mark present in `dist/public/brand/otb-logo-exclamation.webp` (256×171 RGBA) |
| Diff integrity | `git diff --check` passed |

## Browser QA

Validated the demo performance report at desktop (1440px) and mobile (390px) widths.

- Header logo and all 36 rendered card-footer logo instances loaded from `/brand/otb-logo-exclamation.webp` with a non-zero natural width.
- The visible card form reads tournament data (for example: `Recent Tournament Form · 3W 1D 0L · W D W W · Last 4 tournament rounds`).
- Visible card geometry: 540px wide desktop card, 639px height; no card, achievement badge, or page-level horizontal overflow.
- Achievement badge rendered at 11px / 26px high on the visible card; result tokens rendered at 12px for clear scanning.

## Full-suite baseline

`pnpm vitest run` completed with **7,244 passed, 2 skipped, and 27 failures across 18 established unrelated legacy suites**. The focused performance-report suites introduced or updated in this change all pass. The image-loading aggregate source-contract threshold remains stale at 34 optimized images versus its expectation of 35 and is outside this scope.
