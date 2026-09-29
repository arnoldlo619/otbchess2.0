# Club Dashboard Social Header QA

## Scope

Updated the shared Club Dashboard header on every non-Album dashboard tab to use the Album tab’s social-profile hierarchy while retaining each club’s existing banner image. The fixture-only public demo uses the same composition so it accurately previews live Club workspaces.

## Design changes

- Kept `club.bannerUrl` as the cover image, now framed as a compact 108px / 144px social-profile cover instead of a large text-over-photo hero.
- Moved club identity into a dedicated surface below the image: a 72px overlapping avatar, club name, visibility label, member/event counts, location, and description.
- Replaced country-flag decoration with consistent Lucide visibility and location iconography.
- Preserved banner crop position, owner drag-and-drop upload, change/upload action, upload state, and the Album tab’s independent header.
- Updated the public Club Dashboard demo to the same header model.

## Validation

| Check | Result |
| --- | --- |
| Focused Club header, private-workspace, banner-save, overview tests | Passed — 29 tests across 4 files |
| TypeScript | Passed — 0 errors |
| Changed-file ESLint | Passed — 0 errors; existing warnings only |
| Project lint | Passed — 0 errors; 236 established warnings |
| Production build | Passed |
| Diff integrity | Passed |

## Visual QA

- Desktop: reviewed `/clubs/demo` at **1440×900**. The image cover remains visually prominent; the profile identity surface follows the Album system and stays legible.
- Mobile: reviewed `/clubs/demo` at **375×812**. The cover, overlapping avatar, metadata, description, and owner-ready layout fit without horizontal overflow.
- Live dashboards use the same shared `ClubDashboard.tsx` implementation and retain real banner/avatar data plus owner upload behavior. The public demo is intentionally fixture-only and cannot access a real private club.
