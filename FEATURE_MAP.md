# FEATURE_MAP.md — ChessOTB.club Feature Map

## 1. Tournament mode

### User-facing routes

- `/tournament/:id`: public/player tournament page with pairings, standings, players, brackets, live state, and mobile tabs.
- `/tournament/:id/manage`: director console for running a tournament.
- `/tournament/:id/play`: player-focused view.
- `/join` and `/join/:code`: player registration/join flow.
- `/director-access`: director-code access recovery/entry.
- `/tournament/:id/print`: printable pairings/standings assets.
- `/tournament/:id/report`: post-event report/export surface.
- `/tournament/:id/results`: final standings page.
- `/tournament/:id/clock` and `/clock`: standalone/tournament clock.
- `/live/:slug`: public live tournament snapshot.
- `/tournament/:id/analytics`: tournament analytics dashboard.

### Core modules

- `client/src/lib/tournamentRegistry.ts`: tournament config registry, invite/director codes, club linking, localStorage persistence.
- `client/src/lib/directorState.ts`: mutable tournament state, localStorage persistence, server hydration/sync, pairings/results/standings lifecycle.
- `client/src/lib/tournamentData.ts`: tournament data types, demo tournament, standings helpers, scoring/tiebreak behavior.
- `client/src/lib/swiss.ts`: Swiss pairing utilities.
- `client/src/lib/styleAwarePairings.ts`: style-aware pairing support.
- `client/src/components/TournamentWizard.tsx`: tournament creation UI.
- `client/src/components/TournamentSettingsPanel.tsx`: mutable tournament settings.
- `client/src/components/SwissStandingsPanel.tsx`, `CrossTable.tsx`, `CrossTableGuide.tsx`, `TiebreakTooltip.tsx`: standings/tiebreak display.
- `client/src/components/EliminationBracketView.tsx`, `PublicBracketView.tsx`, `MobileBracketCarousel.tsx`, `BracketPrintSection.tsx`: bracket/elimination display and export.
- `client/src/components/RoundTimer.tsx`, `RoundTimerCard.tsx`, `SpectatorTimerBanner.tsx`, `FullScreenClock.tsx`: timing surfaces.
- `server/index.ts`: tournament player/state/live/public/timer/push/analytics endpoints.

### Supported concepts visible in code

- Registration and player management.
- Director sessions/codes.
- Swiss rounds, double-Swiss tests, elimination brackets, automatic bracket transitions.
- Manual result entry, undo/snackbar, pairing swaps, cutoffs, byes, standings, Buchholz/tiebreak tooltips.
- Round timers, push notifications, SSE live updates.
- Public mode and spectator QR/share flows.
- CSV/PDF/PNG/social sharing exports.
- Club-linked tournaments.

## 2. Matchup prep

### User-facing routes

- `/prep`: matchup prep workspace without a prefilled username.
- `/prep/:username`: matchup prep workspace for a specific online chess opponent.

### Core modules

- `client/src/pages/MatchupPrep.tsx`: 3-tab workspace: Scout Report, Study Lines, Practice Board.
- `server/prepEngine.ts`: prep report generation and engine versioning.
- `server/prepAnalysisEngine.ts`: deeper prep/analysis support.
- `server/openingDetection.ts`: opening classification helpers.
- `client/src/components/PreRoundQuickReview.tsx`: quick review before tournament rounds.
- `client/src/components/ChessPracticeBoard.tsx`, `ChessLineViewer.tsx`, `MoveTreePanel.tsx`, `UserRepertoirePanel.tsx`, `CoachInsightCard.tsx`: study/practice UI.
- `client/src/lib/recentlyScouted.ts`, `client/src/lib/userRepertoire.ts`, `server/repertoireBuilder.ts`: saved/reusable prep and repertoire surfaces.

### Server/API concepts

- `/api/prep/:username` builds or returns prep reports.
- `/api/prep/:username/openings` returns opening-focused data.
- `/api/prep/saved` supports authenticated saved reports.
- `/api/prep/coach-insight` supports coach-style recommendations.
- Chess.com and Lichess player/game proxy routes support upstream data collection.
- `chessPlayerCache` and `prepCache` tables reduce repeated external calls.

### Product concepts

- Opponent profile and rating context.
- Opening frequencies and weak/problem lines.
- Practice line tracking.
- Time-control and color filters.
- Saved reports and recently scouted opponents.
- Pro/upgrade gates around advanced prep features.

## 3. Club and event pages

### User-facing routes

- `/clubs`: My Clubs and Discover page.
- `/clubs/:id`: public club profile.
- `/clubs/:id/home`: club dashboard/admin home.
- `/clubs/:clubId/meetup/:eventId`: meetup/event detail page.
- `/checkin/:eventId`: event check-in page.
- `/clubs/:id/messages`: club messaging.
- `/clubs/leaderboard`: club leaderboard.
- `/invite/:token`: club invite acceptance.

### Core modules

- `client/src/lib/clubRegistry.ts`: local club registry and membership state.
- `client/src/lib/clubsApi.ts`: server API wrapper for clubs.
- `client/src/lib/clubEventRegistry.ts`: localStorage-backed event, RSVP, and comment registry with server sync.
- `client/src/lib/clubFeedRegistry.ts`: club feed items.
- `client/src/lib/clubBattleRegistry.ts` and `client/src/lib/clubBattleApi.ts`: club battle/race flows.
- `server/clubs.ts`: club CRUD, events, RSVPs, ownership/admin checks, upload-backed club media.
- `server/clubInvites.ts`: invite creation/acceptance.
- `server/clubMessaging.ts`: club conversations/messages.
- `server/clubBattles.ts`: club battle APIs.
- `client/src/components/CreateClubWizard.tsx`, `EditClubDetailsModal.tsx`, `ClubSettingsPanel.tsx`, `ClubMeetupWizard.tsx`, `UploadRSVPModal.tsx`, `ContactOwnerModal.tsx`, `ClubAvatarUpload.tsx`, `ClubBannerUpload.tsx`: club creation/admin/event UI.

### Product concepts

- Public club discovery and profile pages.
- Club ownership/admin/member roles.
- Club events/meetups with RSVPs, comments, recurrence-like form fields, check-ins, and linked tournaments.
- Club feeds with announcements, polls, RSVP forms, results, tournament/event items, and media-oriented layouts.
- Club dashboards for owner/admin operations.
- Club invites and member onboarding.
- Club battles and leaderboards.
- Club branding through avatar/banner/accent color.

## 4. Dashboard and account flows

### User-facing routes

- `/profile`: user profile and chess account linking.
- `/games`: analysed game history dashboard.
- `/game/:gameId/analysis`: individual game analysis.
- `/record`: game recorder.
- `/record/camera`: video/camera recorder.
- `/game/join/:token`: join shared game recording/session.
- `/otb/leaderboard`: OTB leaderboard.
- `/pricing` and `/pro/success`: Pro billing flow.
- `/training`: training dashboard.

### Core modules

- `client/src/context/AuthContext.tsx`: SPA auth provider.
- `server/auth.ts`: auth API and middleware.
- `client/src/hooks/useGameHistory.ts`, `client/src/hooks/useMyAnalysedGames.ts` if present in the working tree, and game-analysis components.
- `server/recordings.ts`, `server/otbGames.ts`, `server/accuracyCalc.ts`: game storage, OTB games, and accuracy analysis.
- `server/billing.ts`: Stripe/Pro subscription integration.
- `client/src/components/AvatarNavDropdown.tsx`, `DashboardDropdown.tsx`, `ProUpgradeModal.tsx`, `AnalysedGameCard.tsx`, `GameHighlightCard.tsx`, `RatingProgressChart.tsx`, `OtbRatingCard.tsx`, `PlayerStatsCard.tsx`: dashboard/account widgets.

### Product concepts

- Full and guest auth.
- Profile display names, avatars, chess.com/Lichess usernames, FIDE ID, cached ratings.
- Pro/staff access flags.
- Game recording, analysis, accuracy, highlights, and history.
- OTB ratings and leaderboards.
- Dashboard navigation components shared across authenticated surfaces.

## 5. Leagues

### User-facing routes

- `/league/new`: create league.
- `/league-demo`: demo league.
- `/leagues/:leagueId`: league dashboard.
- `/leagues/:leagueId/history`: league history.

### Core modules

- `client/src/pages/LeagueDashboard.tsx`: large league workspace with standings, weeks, matches, invites, requests, reporting, disputes, settings, and push subscription management.
- `client/src/pages/CreateLeague.tsx`, `client/src/components/CreateLeagueWizard.tsx`.
- `server/leagues.ts`: league API routes.

### Product concepts

- League membership and invites.
- Weekly match schedules.
- Result reporting and disputes.
- Standings, movements, deadlines, history, and club-linked league contexts.

## 6. Openings, repertoire, and study

### User-facing routes

- `/openings`: openings library.
- `/openings/:slug`: opening detail.
- `/openings/:openingSlug/study/:lineSlug`: study mode.
- `/openings/demo` and `/openings/demo/:slug`: demo openings views.
- `/repertoire`: repertoire list.
- `/repertoire/:id`: repertoire builder.
- `/admin/openings`: openings admin.

### Core modules and docs

- `OPENINGS_ARCHITECTURE.md`, `OPENINGS_CATALOG.md`, `OPENINGS_LINE_PACKS.md`.
- `server/openingsPublic.ts`, `server/openingsAdmin.ts`, `server/repertoireBuilder.ts`.
- `data/*openings*`, `data/*line*`, `data/node-trees-seed.json`.
- `scripts/seed-*`, `scripts/migrate-openings.mjs`, and related openings maintenance scripts.
- `client/src/components/TrainingDropdown.tsx`, `OpeningsProGate.tsx`, `ChessNotationRace.tsx`, `ContinueStudying.tsx`.

### Product concepts

- Opening catalog and detail pages.
- Deep theory/study lines.
- Practice boards and notation race.
- Repertoire building and user repertoire panels.
- Staff/admin openings maintenance.

## 7. Live boards, broadcasts, and hardware

### User-facing routes

- `/tournament/:id/broadcast-console`: broadcast console.
- `/tournament/:id/connect-board`: board connection setup.
- `/tournament/:id/broadcast/:boardNumber`: board broadcast control.
- `/live/board/:slug`: live board page.
- `/live/board/:slug/display`: venue display.
- `/dashboard/tools/chessnut-bluetooth-test-lab`: Chessnut test lab.

### Core modules

- `server/broadcasts.ts`: broadcast APIs.
- `client/src/lib/broadcastUtils.ts`: broadcast helpers.
- `client/src/lib/ChessnutWebBluetoothAdapter.ts`, `client/src/lib/chessnut/*`: Chessnut integration.
- `client/src/components/BoardBroadcastPlayer.tsx`, `LiveBoardsSection.tsx`, `BroadcastSettingsPanel.tsx`, `LiveNotationBoard.tsx`, `ChessnutBoardPanel.tsx`, `ChessnutProPanel.tsx`, `ChessnutChromeBTPanel.tsx`, `ChessnutProAdapter.tsx`.
- `chessnut-bridge/` and root `bridge.mjs`/`BRIDGE_README.md`: bridge tooling.

### Product concepts

- Live physical board publishing.
- Venue display pages.
- Bluetooth and bridge-based board connectivity.
- Broadcast settings and public live boards.

## 8. Game recorder, video, and CV pipeline

### User-facing routes

- `/record`: game recorder.
- `/record/camera`: camera/video recorder.
- `/game/join/:token`: join game recording.
- `/game/:gameId/analysis`: game analysis.

### Core modules and docs

- `docs/game-recorder-spec.md`, `docs/live-notation-mode-strategy.md`, `docs/video-recorder-strategy.md`, `docs/cv-pipeline-research.md`, and related build-pack docs.
- `server/cvJobQueue.ts`, `server/cv_worker.py`, `server/tests/*`, `server/training/*`.
- `client/public/chess-cv-worker.js`.
- `client/src/components/GameVideoPlayer.tsx`, `FenScrubber.tsx`, `LiveNotationBoard.tsx`, `FilmGameSheet.tsx`, `NotationModeOverlay.tsx`, `LnmOnboardingTooltip.tsx`.

### Product concepts

- Manual/live notation recording.
- Camera/video-based board recognition experiments.
- CV job queue and progress reporting.
- FEN scrubber and move correction.
- Saved analysed games and video storage.

## 9. Admin, billing, notifications, and platform services

### Admin/billing routes

- `/admin/staff`: staff admin.
- `/admin/openings`: openings admin.
- `/pricing`, `/pro/success`: billing surfaces.

### Server modules

- `server/adminStaff.ts`.
- `server/billing.ts`.
- `server/email.ts`, `server/platformEmail.ts`.
- Push routes in `server/index.ts`.
- `server/storageProxy.ts`.

### Product concepts

- Staff flags and Pro entitlement.
- Stripe checkout/customer handling.
- SMTP/platform email configuration.
- Web Push subscriptions and tournament notifications.
- Storage proxying for assets served through `/manus-storage/*`.

## 10. Test coverage map

The repository has broad Vitest coverage. Useful areas to search first:

- Tournament lifecycle/pairings: `client/src/__tests__/*tournament*`, `*swiss*`, `*elimination*`, `*director*`.
- Club/event flows: `*club*`, `*rsvp*`, `*invite*`, `*contactOwner*`.
- Prep/openings: `*prep*`, `*openings*`, `*repertoire*`, `*explorer*`, `*line*`.
- Auth/billing: `*auth*`, `*guest*`, `*pro*`, `server/platformEmail.test.ts`.
- Broadcast/hardware/CV: `*broadcast*`, `*chessnut*`, `*liveNotation*`, `*cv*`, `tests/*`.

## Key opportunities

- Extract very large route pages into smaller feature components and hooks.
- Move additional server routes out of `server/index.ts` into focused routers.
- Define explicit conflict-resolution rules for localStorage/server state merges.
- Normalize more persisted tournament/club state once behavior stabilizes.
- Strengthen server-side authorization for any local-first flow that becomes production-critical.
- Add operational documentation for required environment variables by feature.

## Key risks

- Local-first and server-backed state can diverge across devices.
- In-memory SSE/timer registries will not scale horizontally without shared infrastructure.
- External API rate limits can degrade matchup prep, ratings, avatars, and game imports.
- Large page components increase change risk and make ownership boundaries harder.
- Feature breadth is high; changes in shared auth, theme, or tournament types can affect many unrelated modules.
