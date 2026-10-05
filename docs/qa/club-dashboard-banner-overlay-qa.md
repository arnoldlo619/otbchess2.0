# Club Dashboard Banner Overlay QA

**Date:** 2026-10-05  
**Scope:** Live Club Dashboard and public Club Dashboard demo banner header

## Delivered

- Replaced the stacked banner scrims with a single, even `rgba(2,12,6,0.68)` readability overlay spanning every pixel of an uploaded banner.
- Removed the lower identity-rail gradient that caused the hard transparent-to-opaque seam in the banner image.
- Removed the redundant **Private Club** and **Public Club** identity labels from the live and demo dashboard headers.
- Preserved the full-bleed image, avatar overlap, club title, location/count metadata, and owner-only banner upload action.

## Visual QA

- Reviewed `/clubs/demo` at **1440×900** and **375×812**.
- Confirmed a single continuous dark treatment across the complete card, readable white metadata, no privacy tag beside the title, and no visible horizontal transition seam.

## Validation

| Check | Result |
|---|---:|
| Banner overlay regression suite | 3 passed / 1 file |
| TypeScript | Passed |
| Changed-file ESLint | 0 errors; established warnings only |
| Project lint | 0 errors; 234 established warnings |
| Production build | Passed |
| Local and public preview health | HTTP 200 |

## Baseline note

`tests/club-home-profile-layout.test.ts` has one unrelated pre-existing stale source-contract expectation for Club Profile tab markup. It fails independently of this dashboard-only banner patch; it was not broadened or modified.
