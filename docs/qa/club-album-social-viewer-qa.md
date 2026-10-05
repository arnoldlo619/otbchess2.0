# Club Album Social Viewer QA

**Date:** 2026-10-05  
**Scope:** Club Dashboard and Club Profile Album viewer only  
**Visual direction:** Premium, minimal Facebook-style photo-post viewer adapted to ChessOTB’s forest-green system.

## Research note

Mobbin connector research was attempted before implementation but was unavailable in this session because the connector requires a paid plan. The implementation therefore follows the supplied Facebook-style reference and the existing ChessOTB social interaction conventions without introducing generic social UI or emoji glyphs.

## Delivered behavior

- Album cards continue to open the established full-screen carousel.
- Desktop uses a restrained media canvas with a stable **right interaction rail** for club/photo context, likes, comments, and comment composer.
- Mobile keeps the image first and stacks a safe-area-aware interaction panel below the media rather than compressing the photo.
- Existing Escape/Radix close behavior, ArrowLeft/ArrowRight carousel navigation, upload controls, delete-photo controls, captions, and default album-cover viewing remain intact.
- Like state is per photo and persistent. The database enforces one like per `(photo_id, user_id)`.
- Comments are persistent, max 500 characters, and attributed from the authenticated server-side user profile. A comment may be removed by its author, the club owner, or a club director.
- All interaction reads and writes are scoped to the authorized private club workspace; likes and comments require full, non-guest authentication plus active membership.
- Removing a photo or album removes its associated likes and comments before removing the photo references.
- Guest/signed-out interaction surfaces are intentionally non-posting and explain the account requirement.

## Database migration

Generated and reviewed: `drizzle/0020_club_album_photo_social.sql`.

The non-destructive migration was applied to the configured project database after review. Verification confirmed:

- `club_album_photo_likes` exists.
- `capl_photo_user_idx` uniquely scopes reactions per photo and user.
- `club_album_photo_comments` exists with the expected club, album, photo, author, body, and created-at fields.
- Like and comment query indexes exist.

No user photos, reactions, or comments were fabricated or modified for QA.

## Automated validation

| Check | Result |
| --- | --- |
| Focused Album UI/API/source contracts | **42 passed** across 3 test files |
| TypeScript (`pnpm exec tsc --noEmit`) | **Passed** |
| Changed-file ESLint | **0 errors**; existing unrelated warnings only |
| Project lint (`pnpm lint`) | **0 errors**; 234 established warnings |
| Production build (`pnpm run build`) | **Passed** |
| Diff whitespace (`git diff --check`) | **Passed** |
| Local dev root HTTP | **200** |
| Public sandbox preview root HTTP | **200** |
| New Album source emoji scan | **0 emoji glyphs** |

Focused UI coverage verifies the full persisted client lifecycle with mocked server contracts: like/unlike state, post comment, photo-specific comment state during carousel navigation, and permitted comment removal. Server API coverage verifies the scoped member mutation payloads and cleanup behavior.

## Browser QA boundary

The sandbox browser does not have an authenticated private-club member session, so the real private Club Album endpoint cannot be exercised visually without touching a user account or data. Desktop and mobile public demo shell screenshots were reviewed for existing club layout health; the authenticated viewer itself is protected by the focused rendered UI tests and source contracts. No production user data was altered to bypass that boundary.

## Follow-up recommendation

Perform one authenticated staging smoke test with a disposable member account before a broad release: open an existing photo, like/unlike it, post and remove a comment, then confirm the photo-specific state after navigating away and back.
