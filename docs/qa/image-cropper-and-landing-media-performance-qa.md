# Image Cropper and Landing Media Performance QA

**Scope:** user-directed image framing for primary profile, Club, event, tournament, meetup, and RSVP header uploads; reduced landing-page media work on mobile.

## Implemented behavior

- Added a shared `ImageCropDialog` using `react-easy-crop`:
  - Drag to reposition.
  - Slider plus explicit 44px Zoom out / Zoom in controls to scale from 1x to 3x in 10% increments.
  - Announces the current scale percentage and disables the applicable control at each bound.
  - Uses each destination's correct aspect ratio and output dimensions.
  - Uses focus-visible actions, escape/outside dismissal, and canvas-generated JPEG output.
- Wired the dialog into:
  - profile navigation avatar;
  - Club logo and Club banner;
  - live Club dashboard banner and Club profile/banner/event cover;
  - tournament cover, Club meetup cover, and RSVP form header;
  - the active seven-step tournament onboarding path as well as the retained legacy details path.
- Elevated the shared crop dialog and backdrop above full-screen workflows. This fixes the verified case where the tournament wizard (`z-index: 200`) otherwise covered the crop editor.
- Deferred the decorative landing divider video until it approaches the viewport, paused it when off-screen, and reduced mobile decorative headline paint work. The video remains available to desktop views without competing for initial mobile rendering.

## Visual/runtime checks

- Desktop landing: hero remains legible and structurally unchanged.
- 390px mobile landing: no horizontal overflow; the decorative divider media is not fetched above the fold.
- Live tournament wizard: opened the active Name step, uploaded an in-memory SVG, opened the crop editor, confirmed the elevated backdrop/editor, adjusted crop availability, applied the crop, and verified the banner preview rendered.
- Zoom controls: verified a Zoom in click changes scale from 100% to 110%, a Zoom out click returns it to 100%, and the lower-bound Zoom out control becomes disabled with accessible scale text present.

## Automated validation

| Check | Result |
|---|---|
| Focused crop/media regressions | 50 passing tests across 7 files |
| TypeScript | Passed (`pnpm exec tsc --noEmit`) |
| Changed-file ESLint | 0 errors; existing warnings in legacy files only |
| Production build | Passed (`pnpm run build`) |
| Project lint | Passed before full tests continued; established warnings only |
| Diff integrity | Passed (`git diff --check`) |
| Full Vitest baseline | 7,265 passing, 2 skipped, 27 known unrelated failures across 18 legacy suites |
| Zoom-control regression subset | 25 passing tests across 3 relevant suites |

## Known baseline note

The full suite failures predate this change and are unrelated to crop/media behavior. The final visible example is the stale `tournamentWizardPaymentToggle` source contract. The new image-cropper, hero-pattern, landing-divider, Club avatar/banner, and RSVP regression suites all pass.
