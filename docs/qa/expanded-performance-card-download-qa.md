# Expanded Performance Card Download QA

**Scope:** the detailed player performance card opened by **View Full Card** from the Tournament Performance Report and Tournament Overview.

## Delivered behavior

- Added an always-visible **Download** action beside the close control in the expanded performance-card modal.
  - Desktop shows the Download label.
  - Compact mobile layouts retain a 44px icon target with a descriptive accessible label.
  - The action has loading, disabled, focus-visible, error, and success feedback states.
- Created a dedicated off-screen full-card export surface rather than exporting the responsive modal itself.
  - Canvas: **540×675 CSS pixels**.
  - Rasterization: **2×**.
  - Output: a genuine **1080×1350 PNG** in Instagram's 4:5 feed/carousel ratio.
- The export has the same dark OTB visual system, player identity, achievement, W/D/L record, performance stats, color balance, score progression, up to five recorded rounds, and local ChessOTB footer branding.
- Uses the existing `html-to-image` CORS-safe rendering strategy, so proxied player avatars and the local OTB asset export reliably.
- Both Report and Tournament Overview pass the actual tournament name into the exported card for accurate title and filename context.

## Automated validation

| Check | Result |
|---|---|
| Focused suites | **57 passed** across expanded-download, PNG export, PlayerStatsCard, appearance, and tournament-integrity coverage |
| TypeScript | `pnpm exec tsc --noEmit` passed |
| Changed-file ESLint | 0 errors; 3 established `Report.tsx` warnings |
| Production build | `pnpm run build` passed |
| Project lint | 0 errors; 233 established warnings |
| Route health | Report, Overview, and local OTB logo asset returned HTTP 200 |
| Diff integrity | `git diff --check` passed |

## Browser and visual QA

- Verified desktop and 390px mobile report layouts with no page horizontal overflow.
- Opened a real player full card in the browser; the Download control is visible, legible, keyboard-labelled, and separated from Close.
- Export card geometry: **540×675** CSS pixels, no internal horizontal overflow, all export avatars and the OTB mark loaded successfully.
- Intercepted the actual browser download action and verified a valid PNG data URL named `gothamchess-full-performance-card-otb-open-2026.png`.
- Loaded the generated PNG in-browser and confirmed final intrinsic dimensions: **1080×1350**.

## Full-suite baseline

`pnpm vitest run` completed with **7,248 passed, 2 skipped, and 27 failures across 18 established unrelated legacy suites**. All focused performance-card download coverage passed. The legacy failures are outside this scope (including stale Tournament Wizard source-contract expectations).
