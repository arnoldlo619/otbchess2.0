# ChessOTB Canonical Route Inventory

**Owner:** ChessOTB Product Engineering  
**Router source of truth:** `client/src/App.tsx`  
**Navigation source of truth:** `client/src/lib/navRegistry.ts`

This inventory documents the production-facing route contract. Static pages should resolve directly, dynamic pages must provide a local missing-data or access fallback, and legacy aliases must terminate at one canonical destination without a redirect loop.

## Public and account routes

| Canonical route | Surface | Access or fallback expectation |
|---|---|---|
| `/` | Landing page | Public; primary platform entry |
| `/auth` | Sign in and registration | Public; authenticated users may continue to their intended destination |
| `/pricing` | Pricing | Public |
| `/terms` | Terms of Use | Public |
| `/pro/success` | Pro confirmation | Public route with account-aware state |
| `/profile` | Player account and tournament history | Auth-aware inline sign-in recovery |
| `/404` | Explicit not-found preview | Public recovery page |
| `*` | Unknown route fallback | Renders `NotFound` without redirecting |

## Tournament routes

| Canonical route | Surface | Access or fallback expectation |
|---|---|---|
| `/tournaments` | Public tournament archive | Public |
| `/tournaments/new` | Tournament creation entry | Canonical alias that opens the landing-page wizard |
| `/tournament/:id` | Participant tournament view | Missing tournament state is handled in-page |
| `/tournament/:id/manage` | Director workspace | Director access or recovery state |
| `/tournament/:id/play` | Player dashboard | Missing player/tournament recovery state |
| `/tournament/:id/print` | Print pairings and standings | Missing tournament recovery state |
| `/tournament/:id/report` | Full tournament report | Missing tournament recovery state |
| `/tournament/:id/results` | Final standings | Missing tournament recovery state |
| `/tournament/:id/overview` | Tournament overview | Missing tournament recovery state |
| `/tournament/:id/clock` | Tournament clock | Missing tournament recovery state |
| `/tournament/:id/analytics` | Tournament analytics | Director access or recovery state |
| `/tournament/:id/broadcast-console` | Broadcast console | Director access or recovery state |
| `/tournament/:id/connect-board` | Electronic-board connection | Director access or recovery state |
| `/tournament/:id/broadcast/:boardNumber` | Board broadcast control | Missing board recovery state |
| `/clock` | Standalone chess clock | Public |
| `/join` | Tournament join entry | Public |
| `/join/:code` | Invite-code registration | Invalid code recovery state |
| `/director-access` | Director-code entry | Public |
| `/live/:slug` | Public tournament results | Invalid slug recovery state |
| `/recap/:slug` | Public tournament recap | Invalid slug recovery state |
| `/live/board/:slug` | Public live board | Invalid slug recovery state |
| `/live/board/:slug/display` | Venue board display | Invalid slug recovery state |

## Club, meetup, RSVP, and league routes

| Canonical route | Surface | Access or fallback expectation |
|---|---|---|
| `/clubs` | Club discovery and memberships | Public with auth-aware controls |
| `/clubs/leaderboard` | Club leaderboard | Public |
| `/clubs/:id` | Public club profile | Invalid club recovery state |
| `/clubs/:id/home` | Member club dashboard | Membership gate |
| `/clubs/:id/manage` | Club management | Owner/admin gate |
| `/clubs/:id/messages` | Club messages | Membership gate |
| `/join-club/:clubId` | Club join entry | Invalid club recovery state |
| `/clubs/:clubId/meetup/:eventId` | Meetup event | Invalid event recovery state |
| `/clubs/:clubId/meetup/:eventId/rsvp-form/builder` | RSVP form builder | Owner/admin gate |
| `/checkin/:eventId` | Meetup check-in | Invalid event recovery state |
| `/rsvp/:slug` | Public RSVP form | Invalid slug recovery state |
| `/league` | League overview | Public |
| `/league/new` | League creation | Auth-aware commissioner gate |
| `/league-demo` | Public league demo | Public |
| `/league/:leagueId` | League dashboard | Invalid league recovery state |
| `/league/:leagueId/history` | League history | Invalid league recovery state |
| `/leagues/:leagueId` | Backward-compatible league dashboard alias | Same component as canonical singular route |
| `/leagues/:leagueId/history` | Backward-compatible history alias | Same component as canonical singular route |

## Training, game, opening, and repertoire routes

| Canonical route | Surface | Access or fallback expectation |
|---|---|---|
| `/training` | Training tools index | Public |
| `/prep` | Matchup Prep entry | Auth-aware usage limits |
| `/prep/:username` | Opponent report | Provider and invalid-user recovery states |
| `/prep/analysis` | Prep analysis workspace | Auth-aware recovery state |
| `/games` | Game history | Auth-aware empty state |
| `/record` | Manual game recorder | Public/auth-aware save |
| `/record/camera` | Camera recorder | Camera-permission recovery state |
| `/game/join/:token` | Shared game join | Invalid token recovery state |
| `/game/:gameId/analysis` | Game analysis | Missing game recovery state |
| `/otb/leaderboard` | OTB leaderboard | Public |
| `/openings` | Opening library | Public |
| `/openings/:slug` | Opening detail | Invalid opening recovery state |
| `/openings/:openingSlug/study/:lineSlug` | Opening study mode | Invalid line recovery state |
| `/openings/demo` | Opening library demo | Public |
| `/openings/demo/:slug` | Opening detail demo | Invalid demo slug recovery state |
| `/repertoire` | Repertoire list | Auth-aware empty state |
| `/repertoire/:id` | Repertoire builder | Missing repertoire recovery state |
| `/tools` | Legacy tools alias | Redirects once to `/training` |

## Content, invitations, and administration

| Canonical route | Surface | Access or fallback expectation |
|---|---|---|
| `/blog` | Journal index | Public |
| `/blog/:slug` | Journal article | Invalid slug recovery state |
| `/invite/:token` | Invitation acceptance | Invalid/expired token recovery state |
| `/admin/staff` | Staff administration | Staff gate |
| `/admin/openings` | Opening administration | Staff gate |
| `/dashboard/tools/chessnut-bluetooth-test-lab` | Hardware test lab | Internal/auth-aware access |

## Redirect aliases

| Alias | Canonical destination | Query/hash behavior |
|---|---|---|
| `/create` | `/tournaments/new` → `/?action=create` | Preserves source/campaign query parameters and hash |
| `/tournaments/new` | `/?action=create` | Opens the tournament wizard and removes only the internal action flag |
| `/tools` | `/training` | Preserves unrelated query parameters and hash |

## Automated verification

The source-level contract lives in `client/src/__tests__/routeInventoryAudit.test.ts`. Browser-level checks live in `e2e/core-entry-flows.spec.ts` and `e2e/route-audit.spec.ts`. The checks cover route uniqueness, literal navigation destinations, alias termination, public route rendering, blog/training entry points, unknown-route recovery, and representative invalid dynamic-route fallbacks.
