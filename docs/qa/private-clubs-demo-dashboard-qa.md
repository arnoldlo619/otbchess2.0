# Private Clubs and Demo Dashboard QA

## Scope

This change converts the Club surface from a public directory into private member workspaces and introduces `/clubs/demo` as a separate, read-only product preview. The demo contains only local fixture data and makes no Club API requests.

## Privacy model verified

| Concern | Implemented behavior | Verification |
|---|---|---|
| Existing Clubs | Migration `0019_light_inertia` changes the database default to private and sets every existing `clubs.is_public` value to `0`. | Applied through the WebDev SQL executor. |
| New Clubs | The server ignores a submitted visibility preference and persists `isPublic: 0`; the client wizard and local cache both use the same private invariant. | Source contract and focused test coverage. |
| Workspace reads | Club details, roster, events, feed, attendance, seasons, announcements, albums, and album images resolve through `getAuthorizedClub`, which requires the owner or an active member. Unauthorized access returns a generic not-found response after authentication. | Source contract and unauthenticated `GET /api/clubs/private-boundary-check` response: `401`. |
| Public directory | The public Club index returned zero records after the migration. | Local API check: `GET /api/clubs` contained `0` Club records. |
| Join flow | `/api/clubs/join-preview/:id` exposes only the minimal club identity needed for an explicit QR/direct join path. It does not provide a general workspace read. | Source contract and an unknown join-preview returned `404`. |
| Demo | `/clubs/demo` is static fixture content and does not reference `/api/clubs`. | Source contract and responsive browser review. |

## UI review

The `/clubs` index was reviewed at **1440 × 960** and **375 × 812**. The signed-out state explains the private-workspace model, provides a direct demo entry point, and keeps the sign-in/create action clear. The demo was reviewed at the same widths. Its desktop layout presents a compact, professional workspace shell; the mobile layout collapses to an easy horizontal destination rail with no visible overflow or loss of hierarchy. The existing install banner appears at the bottom of the mobile preview and is outside this change.

## Automated checks

| Check | Result |
|---|---|
| Focused private Club regression suite | **87 passing tests** across 6 files |
| TypeScript | **Passed** (`pnpm exec tsc --noEmit`) |
| Changed-file ESLint | **0 errors**; 122 pre-existing warnings in large legacy Club files |
| Production build | **Passed** (`pnpm run build`) |
| Diff integrity | **Passed** (`git diff --check`) |
| Database migration | **Applied successfully** |

## Remaining scope boundary

The existing `/clubs/leaderboard` page remains registered but the public Club index now has no records because all real Clubs are private. A future dedicated privacy decision can either retire that surface or redefine it as an opt-in, anonymized product metric; it is not used by the new `/clubs` experience.
