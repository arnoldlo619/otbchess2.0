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

The `/clubs` index was reviewed at **1440 × 960** and **375 × 812**. The signed-out state is now a purpose-built, Mobbin-informed conversion surface rather than a dashboard empty-state stack: it has a single primary **Start a club** action, a restrained **Explore the workspace** secondary path, and a concise three-part feature rail for Events, Feed, and Album. The guest header no longer duplicates the primary create action; the previous count, nested empty-state card, and second sign-in callout are absent. It uses only established OTB/Lucide SVG icons and no emoji-derived interface imagery. Signed-in users retain their functional personal-club index and a distinct, minimal no-clubs state. The demo was then rebuilt around the production Club workspace primitives: the shared shader background, compact desktop `ClubDashboardSidebar`, banner hierarchy, tab transition, card system, and a matching mobile hamburger drawer. Fixture-only content demonstrates Overview, Feed, Album, Events, Members, and Settings without making Club API requests or presenting writable controls. The mobile quick actions stack icon and label within their compact cards to avoid text collision at 375 px. The existing install banner appears at the bottom of the mobile preview and is outside this change.

## Automated checks

| Check | Result |
|---|---|
| Focused private Club regression suite | **19 passing tests** across guest-landing, private-workspace, and route-contract files |
| Guest landing visual QA | **Passed** — desktop 1440 × 960 and mobile 375 × 812 reviews confirmed responsive hierarchy, visible CTA text, and no horizontal overflow |
| Demo navigation interaction | **Passed** — desktop Overview-to-Feed interaction rendered the read-only Feed state |
| Desktop visual QA | **Passed** — 1440 × 960 workspace shell aligned with the production sidebar and card hierarchy |
| Mobile visual QA | **Passed** — 375 × 812 hamburger header, banner, quick actions, and timeline showed no horizontal overflow or clipped labels |
| TypeScript | **Passed** (`pnpm exec tsc --noEmit`) |
| Changed-file ESLint | **0 errors, 0 warnings** in the demo and its focused source contract |
| Production build | **Passed** (`pnpm run build`) |
| Diff integrity | **Passed** (`git diff --check`) |
| Database migration | **Applied successfully** |

## Remaining scope boundary

The existing `/clubs/leaderboard` page remains registered but the public Club index now has no records because all real Clubs are private. A future dedicated privacy decision can either retire that surface or redefine it as an opt-in, anonymized product metric; it is not used by the new `/clubs` experience.
