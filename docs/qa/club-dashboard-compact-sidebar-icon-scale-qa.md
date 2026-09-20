# Club Dashboard Compact Sidebar Icon Scale QA

## Scope

This refinement completes the compact-rail visibility task. The 72px desktop Club Dashboard rail now uses 46px icon controls with a 36px centered inner frame and 21px icon. The selected compact destination receives a static, brand-toned outer and inner border frame rather than a tracing animation. Expanded controls retain the previous label-first geometry.

## Direct browser review

A live Club Dashboard review at `/clubs/w3m342vs/home` confirmed the compact sidebar renders with the requested scale. A DOM geometry check verified each compact control is **46×46px**, the inner frame is **36×36px**, and both horizontal and vertical centering deltas are **0px**. The active destination retains `aria-current="page"`, a 1px outer brand frame, and a 1px inner frame. Existing tooltips retain the accessible names for compact controls.

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
