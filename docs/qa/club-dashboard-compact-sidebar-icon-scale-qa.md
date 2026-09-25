# Club Dashboard Compact Sidebar Icon Scale QA

## Scope

This refinement completes the compact-rail visibility task. The 72px desktop Club Dashboard rail uses 46px icon controls with a 36px centered inner frame and 21px icon. The selected compact destination receives a static, brand-toned outer and inner border frame rather than a tracing animation. Hover- or keyboard-expanded navigation now retains the same 46px control height, 36px icon frame, and 21px icon, so its visual scale does not contract while labels appear. Expanded labels use the 16px system text size for improved visibility.

## Direct browser review

A live Club Dashboard review at `/clubs/w3m342vs/home` confirmed the compact sidebar renders with the requested scale. A DOM geometry check verified each compact control is **46×46px**, the inner frame is **36×36px**, and both horizontal and vertical centering deltas are **0px**. The active destination retains `aria-current="page"`, a 1px outer brand frame, and a 1px inner frame. Existing tooltips retain the accessible names for compact controls.

The shared sidebar was subsequently reviewed in the public Club demo at desktop width with its pointer-triggered expanded state active. The expanded controls retain the same **46px** row height, **36px** icon frame, and **21px** SVG icon as the compact rail; only the sidebar width and label visibility change. The enlarged 16px labels remain clear without affecting the retained compact-only tooltip behavior.

The Club brand trigger was then reviewed in both states. It preserves the compact mark’s 64px visual anchor while the original OTB!! mark crossfades and lightly scales down as the supplied green checkered OTB!! wordmark fades and translates into a more restrained **112px × 48px** expanded visual field. In its expanded state, the wordmark is left-aligned to the same 4px inset used by the compact trigger rather than centered in the wider rail. The reveal starts after a short 75ms delay, so the rail begins opening before the wordmark appears; collapse reverses immediately. Both image layers are decorative within the already-labelled **Back to all clubs** button, and `prefers-reduced-motion` continues to remove the transition.

## Preserved behavior

The rail remains vertically centered in its usable navigation area; pointer and keyboard expansion still reveal labels, tooltips remain compact-only, visible focus rings remain, press feedback is preserved, and reduced-motion continues to disable transitions.

## Validation

| Check | Result |
|---|---|
| Focused compact-rail tests | Passed: 5 tests across compact-rail and related sidebar coverage. |
| TypeScript | Passed: `pnpm exec tsc --noEmit`. |
| Changed-file lint | Passed with 0 errors and 0 warnings. |
| Production build | Passed: `pnpm build`. |
| Project lint | 0 errors; 235 established repository warnings remain. |
| Full Vitest suite | 6,982 passing, 2 skipped, 22 failures in established unrelated accessibility/form-label/Tournament Wizard source-contract suites. The new compact-rail suite is absent from failures. |
| Diff integrity | Passed: `git diff --check`. |
