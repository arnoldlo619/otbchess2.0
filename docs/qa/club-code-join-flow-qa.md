# Club Code Join Flow — QA Record

**Date:** 2026-10-21  
**Scope:** Private Club discovery and membership invitation flow

## Delivered behavior

- Every Club has a unique, human-shareable `OTB-XXXX` Club Code, excluding ambiguous characters and protected with a database unique index.
- New Clubs receive a Code during creation; existing Clubs are backfilled safely when the Clubs API starts after the migration is available.
- Signed-in members with no memberships now see both **Create a club** and **Join a club** actions on `/clubs`.
- **Join a club** opens an accessible two-step dialog:
  1. Enter and normalize a Club Code.
  2. Preview the invited Club and explicitly confirm membership.
- Club Code redemption is authenticated, rejects guest accounts, is idempotent for existing members, and updates membership through the server-side membership path.
- Owners and directors can view the Code from **Settings → Join** and in the full-screen **Join Club QR** surface. Owners can copy or rotate it; rotation invalidates the prior Code immediately.
- Club QR links now resolve through `/join-club/code/:code`, with legacy `/join-club/:id` links retained for backward compatibility.
- QR render/copy/download actions wait for the Code-backed URL instead of briefly emitting a legacy direct invitation URL while the Code is loading.

## Implementation surfaces

| Area | Implementation |
| --- | --- |
| Persistence | `clubs.join_code` migration and unique index in `drizzle/0028_club_join_codes.sql` |
| Server | Code generation, legacy backfill, preview, redemption, owner Code lookup, and owner rotation in `server/clubs.ts` |
| Member UX | `JoinClubByCodeDialog` on `/clubs`; Code deep-link handling in `JoinClub.tsx` and `App.tsx` |
| Owner UX | Code display/copy/rotate in Club Settings and Code-backed QR links in Dashboard, Profile projection, and QR projection modal |
| Regression coverage | API, source-contract, routing, accessibility, and My Clubs empty-state tests |

## Browser QA

An isolated temporary owner and two isolated registered member accounts were used to verify the complete flow, then removed with the temporary Club and its child records.

1. Created a Club as a temporary owner and confirmed owner-only Code lookup returned a valid `OTB-XXXX` Code.
2. Opened the Code QR deep link as a different registered member; the invite resolved and joined the member successfully.
3. Opened `/clubs` as a zero-membership registered member; **Join a club** was visible alongside **Create a club**.
4. Entered the same Code, verified the Club name and member count in the confirmation step, confirmed join, and landed in the Club dashboard with the membership count updated.
5. Confirmed temporary QA data was removed after verification.

## Database validation

The development database schema includes `clubs.join_code` and the unique index. At validation time:

- 16 / 16 Clubs had a populated Code.
- 16 / 16 Codes were distinct.
- `clubs_join_code_unique` was present.

## Automated validation

| Check | Result |
| --- | --- |
| Focused Club Code / Club API / My Clubs / route tests | **43 passed** across 5 files |
| TypeScript | Passed (`tsc --noEmit`) |
| Changed-file ESLint | 0 errors; established warnings only in large pre-existing files |
| Project lint | 0 errors, 225 established warnings |
| Production build | Passed |
| Diff integrity | Passed (`git diff --check`) |
| Full Vitest baseline | 7,307 passed, 2 skipped, 26 known unrelated failures across 18 suites |

The final full-suite failure set contains no Club Code, Club API, Club join, or My Clubs failure. The remaining 26 failures are established unrelated source-contract/infrastructure expectations, concentrated in tournament-format-card, legacy Club layout, loader, accessibility-landmark, route-inventory, and service-worker suites.

## Deployment note

`drizzle/0028_club_join_codes.sql` must be applied to each deployment database before the new server path is enabled. The current development database has the column and unique index applied; the project’s aggregate migration runner also encounters pre-existing historical migration state outside this feature, so deployment migration execution should use the platform’s normal migration process or apply this idempotently reviewed migration through its database release step.
