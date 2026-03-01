# OTB Chess — Project TODO

## Core Platform

- [x] Tournament creation wizard (name, format, rounds, time control, venue, date)
- [x] Tournament registry (localStorage persistence, invite code generation)
- [x] Director Dashboard — result entry per board
- [x] Director Dashboard — Swiss pairing engine (generateNextRound)
- [x] Director Dashboard — live standings with Buchholz tiebreaks
- [x] Director Dashboard — round progress tracker
- [x] Director Dashboard — pause/resume tournament
- [x] Director Dashboard — player search, filter, sort in Players tab
- [x] Director Dashboard — QR modal with real invite code
- [x] Director Dashboard — remove player button
- [x] Director Dashboard — complete tournament CTA (View Results / Print)
- [x] Director Dashboard — real venue/date/time control in sidebar Event Info
- [x] Director Dashboard — End Tournament button wired to completeTournament()
- [x] Director Dashboard — Bell/Announce button copies join link

## Join Flow

- [x] Join page — QR code / invite code entry
- [x] Join page — chess.com username lookup with ELO fetch
- [x] Join page — confirm step with tournament details
- [x] Join page — success step with ELO count-up animation
- [x] Join page — cross-tab registration (storage event → Director Dashboard)
- [x] Join page — "New" badge on recently joined players in Director Dashboard
- [x] Join page — resolveTournament() handles both invite codes and slugs
- [x] Join page — displays real tournament name/venue/format from registry
- [x] addPlayerToTournament initializes state for brand-new tournaments

## Spectator & Print Views

- [x] Tournament spectator view — wired to real localStorage data via useDirectorState
- [x] Tournament spectator view — falls back to DEMO_TOURNAMENT for demo route
- [x] Print view — wired to real tournament data (WallChart, StandingsTable, PairingSlips)
- [x] Print view — falls back to DEMO_TOURNAMENT for demo route

## Archive Page

- [x] Archive page — shows curated historical tournaments
- [x] Archive page — "Your Tournaments" section showing real user tournaments from registry
- [x] Archive page — UserTournamentCard with Manage/View links

## Landing Page

- [x] Landing page — hero, stats bar, how it works, features, showcase, player demo, testimonials, CTA, footer
- [x] Landing page — nav links smooth-scroll to section IDs (Features, How It Works, For Clubs, Pricing)
- [x] Landing page — footer links use real hrefs (no more toast stubs)
- [x] Landing page — Sign In button opens tournament wizard
- [x] Landing page — Start a Tournament button in Showcase section

## Global Polish

- [x] 404 page — redesigned to match OTB Chess design system (green/dark theme)
- [x] 404 page — quick links to Join, Archive, Demo Tournament
- [x] All "Feature coming soon" toast stubs replaced with real actions
- [x] Report Issue link uses mailto: in Tournament spectator view

## Tests & Quality

- [x] Vitest setup (vitest.config.ts, test script in package.json)
- [x] 18 unit tests passing — Tournament Registry, Player Registration, Swiss Engine, loadTournamentState
- [x] TypeScript: 0 errors across entire codebase

## Post-Tournament Performance Reports

- [x] Performance stats computation engine (computePerformanceStats per player)
- [x] PlayerStatsCard component — shareable visual card (social media optimized)
- [x] TournamentReport page — full report with all player cards
- [x] Wire report into Director Dashboard post-tournament CTA
- [x] Wire report into Archive page UserTournamentCard
- [x] Canvas-based PNG export for social media sharing
- [x] Add /tournament/:id/report route to App.tsx
- [x] Unit tests for performance stats computation (18 tests, all passing)

## Avatar Enhancement

- [x] Build useChessAvatar hook (chess.com API fetch, sessionStorage cache, fallback)
- [x] Integrate avatar into PlayerStatsCard (photo ring, shimmer loading, initials fallback)
- [x] Integrate avatar into Director Dashboard player list (registration panel + Players tab)
- [x] Integrate avatar into Join page success step
- [x] PlayerAvatar reusable component (shimmer skeleton, initials fallback, verified badge)

## Wall Chart & Cross-Table

- [x] Cross-table component (N×N player vs. player results grid with scores)
- [x] Round-by-round pairings timeline component
- [x] PNG export for wall chart section
- [x] Integrate into Report page with tab navigation (Cards / Cross-Table / Rounds)

## Lichess API Integration

- [x] Build useLichessProfile hook (API fetch, rating, title, avatar, caching)
- [x] Add platform toggle (chess.com / Lichess) to Join page username step
- [x] Wire useLichessProfile into Join page alongside useChessComProfile
- [x] Update PlayerAvatar to support Lichess flair emoji and platform badges
- [x] platform/avatarUrl/flairEmoji stored on Player object

## Player Profile Hover Card

- [x] PlayerProfileCard component (avatar, rating, title, country, W/D/L, color history, recent form)
- [x] Wire into Director Dashboard Players tab list rows
- [x] Wire into Director Dashboard Boards tab (white/black player names in BoardCard)
- [x] Smooth enter/exit animation, smart positioning (flip when near viewport edge)
- [x] useRatingHistory hook — chess.com archive walk + Lichess NDJSON games API, sessionStorage cache
- [x] SVG sparkline with smooth cardinal spline, area fill, result-coloured dots, endpoint label
- [x] Trend badge (+N / -N / ±0) in sparkline section header
- [x] Shimmer skeleton while rating history is loading
- [x] 17 unit tests for sparkline data helpers (ratingToY, computeTrend, formatTrend, countResults)

## Share Results Feature

- [x] Add optional phone/email fields to Player type
- [x] ShareResultsModal component — WhatsApp and email broadcast flows
- [x] Pre-filled WhatsApp deep-links (wa.me) with player stats message
- [x] Pre-filled mailto deep-links with player stats email
- [x] Broadcast All mode — list all players with individual Send buttons
- [x] Single-player mode — triggered from per-card hover overlay
- [x] Copy message to clipboard per player and Copy All button
- [x] Channel toggle (WhatsApp / Email) with distinct colour themes
- [x] Share Results button in Report page header (cards tab)
- [x] "Send via WhatsApp / Email" button in per-card hover overlay
- [x] Report URL auto-populated from window.location.href
- [x] 26 unit tests for message generators and URL builders

## Sparkline Tooltip

- [x] formatDate helper (Unix-ms \u2192 "Mon DD" string)
- [x] useState activeIdx to track hovered dot index
- [x] Invisible enlarged hit-target circles (r=10) over each dot for easy hover
- [x] Dot grows on hover (r 2\u21924) with CSS transition
- [x] Vertical dashed crosshair line on active dot
- [x] Floating tooltip via SVG foreignObject (rating, date, result label)
- [x] Tooltip flips left when near right edge of sparkline
- [x] Tooltip y clamped to never go above SVG top
- [x] Endpoint rating label hidden while a dot is active
- [x] 19 unit tests for formatDate, tooltipX, tooltipY, resultLabel

## Sparkline Time-Control Filter

- [x] TimeControl type exported from useRatingHistory ("all" | "bullet" | "blitz" | "rapid" | "classical")
- [x] RatingPoint extended with timeControl field
- [x] classifyChessComTC helper (time_class field + time_control string fallback)
- [x] classifyLichessPerf helper (perf field, case-insensitive, ultraBullet support)
- [x] Hook fetches count*4 games to fill all TC buckets; client-side filter + slice(-count)
- [x] Cache key bumped to v2 to avoid stale entries without timeControl field
- [x] TCPill component (All / Rapid / Blitz / Bullet) with active/inactive styles
- [x] SparklineSection holds tc state; passes timeControl to useRatingHistory
- [x] Empty-state message is TC-aware ("No blitz games in the last 10 games")
- [x] 35 unit tests for classifyChessComTC, classifyLichessPerf, filterPoints

## Full-Screen Tournament Creation Wizard Redesign

- [x] Full-screen overlay (fixed inset-0) replacing the cramped modal
- [x] Thin top progress bar (4 segments, animated fill)
- [x] Two-column layout: left hero panel (step context) + right input panel
- [x] Step 1 — Details: large name input hero, venue/date/description below
- [x] Step 2 — Format: large format cards with icons, rounds/players as big tap targets
- [x] Step 3 — Time Control: time preset as large visual cards, custom stepper
- [x] Step 4 — Share: full-width QR + invite link, confetti
- [x] Smooth horizontal slide-in/out transitions between steps
- [x] Keyboard navigation (Enter to advance, Escape to exit)
- [x] Mobile: single-column stacked layout, bottom nav bar
- [x] Consistent with platform design system (green/white, Clash Display, OKLCH tokens)

## Phone & Email on Join Page

- [x] Add optional `phone` and `email` fields to the Player interface
- [x] Add phone and email inputs to the Join page registration form
- [x] Persist phone/email in tournament registry when player joins
- [x] Wire phone/email into ShareResultsModal for pre-filled WhatsApp/mailto links
- [x] Unit tests for phone/email field validation helpers (19 tests)

## Manual Player Entry & Start Tournament

- [x] AddPlayerModal — name, platform (chess.com/lichess/manual), username, ELO lookup button
- [x] "Add Player" button in Players tab header
- [x] Persist manually-added players to tournament registry
- [x] Remove player from Players tab (with confirmation)
- [x] Start Tournament button in Director Dashboard Players tab
- [x] Confirmation dialog before starting (shows player count, rounds, format)
- [x] Tournament status transitions: lobby → active → complete
- [x] Disable Start if fewer than 2 players registered
- [x] Lock player registration once tournament is started
- [x] AddPlayerModal render call wired in Director.tsx return statement
- [x] Start Tournament confirmation dialog render wired in Director.tsx return statement
- [x] Fixed esbuild false-positive in Join.tsx (Unicode box-drawing chars replaced with ASCII)

## Bye Handling (Odd Player Count)

- [x] Swiss engine: detect odd player count, assign bye to lowest-ranked player who hasn't had a bye
- [x] Award ½ point (FIDE standard) to bye player — fixed from incorrect 1 point
- [x] Track bye history per player to avoid repeat byes (getByeRecipients)
- [x] computeStandings handles BYE games without double-counting
- [x] applyResultToPlayers skips BYE games (pre-scored)
- [x] ByeCard component in Boards tab — player avatar, +½ badge, round explanation
- [x] ByeCard rendered in Boards tab grid when whiteId === "BYE"

## Mascot Illustrations

- [x] Rook mascot — woodcut style, cartoon eyes, neon-green glow, flexing pose (hero + Built for Serious Players section)
- [x] King mascot — same style (generated, available as CDN asset)
- [x] Knight mascot — same style (generated, available as CDN asset)
- [x] Pawn mascot — same style, double-fist flex, added to CTA "Start Your Tournament" section
- [x] Favicon — rook face crop, 4 sizes (32px, 180px, 192px, 512px) wired into index.html

## PWA (Progressive Web App)

- [x] manifest.json with name, icons, theme_color, display standalone
- [x] Wire manifest + apple-touch-icon into index.html
- [x] Service worker (cache-first for static assets, network-first for API)
- [x] Register service worker in main.tsx
- [x] PWA shortcuts: Create Tournament (/?action=create) and Join Tournament (/join)

## Push Notifications

- [x] Generate VAPID key pair and store as env secrets
- [x] Install web-push on server, expose /api/push/vapid-public-key and /api/push/subscribe endpoints
- [x] POST /api/push/notify/:tournamentId endpoint for director to broadcast round start
- [x] usePushSubscription hook — request permission, subscribe, POST to server
- [x] NotifyBell component — subscribe/unsubscribe toggle for players on Join success page
- [x] Director Dashboard — broadcastRoundStart() called on Generate Round and Start Tournament
- [x] Service worker push event handler — show notification with board assignment deep-link
- [x] notificationclick handler — opens /tournament/:id when user taps notification
- [x] Unit tests for push subscription helpers (16 tests passing)

## Push Subscriptions — DB Persistence

- [x] Add push_subscriptions table to Drizzle schema (id, tournament_id, endpoint, p256dh, auth, created_at)
- [x] Run pnpm db:push migration (table created in TiDB Cloud)
- [x] Refactor /api/push/subscribe POST to upsert into DB
- [x] Refactor /api/push/subscribe DELETE to remove from DB
- [x] Refactor /api/push/notify/:tournamentId to query DB and clean stale rows
- [x] GET /api/push/count/:tournamentId endpoint for subscriber count
- [x] Unit tests for DB-backed push subscription helpers (13 tests passing)

## Round Results Notification

- [x] POST /api/push/notify/:tournamentId/results server endpoint
- [x] broadcastResultsPosted() helper in Director.tsx
- [x] Auto-trigger broadcast when allResultsIn transitions to true (useRef edge-detection)
- [x] Unit tests for results notification payload and endpoint (5 new tests)

## Subscription Cleanup Job

- [ ] purgeExpiredSubscriptions() function — delete rows where created_at < NOW() - 90 days
- [ ] Run on server startup (non-blocking)
- [ ] Schedule to re-run every 24 hours via setInterval
- [ ] Unit tests for expiry logic

## Visual Simplification

- [x] Remove hero mascot illustration and simplify hero to centered text layout with stat chips
- [x] Remove pawn mascot from CTA section and simplify to centered text layout
- [x] Replace Showcase illustration with clean stat card grid on chess-board background

## Join Tournament Flow

- [x] Add "Join Tournament" button to nav bar (desktop + mobile menu) and hero section
- [x] Ensure /join route is accessible and linked from nav
- [x] Join page step 1: tournament code entry (pre-filled from QR code /join/:code URL)
- [x] Join page step 2: chess.com username entry with live ELO lookup
- [x] Join page step 3: confirmation / success screen with NotifyBell
- [x] QR code scanner: camera overlay with jsQR decoding, extracts code from /join/:code URL
- [x] Mobile-optimised layout for the full join flow

## Already-Registered Detection (Join Page)

- [x] Create registrationStore helper — read/write/clear localStorage key `otb_registrations`
- [x] On Join success step: persist { tournamentId, username, name, rating, tournamentName, registeredAt } to localStorage
- [x] On Join page load with a tournament code: check localStorage before rendering the form
- [x] Show "Already Registered" banner when a matching entry is found (name, rating, tournament name, "Not me" escape hatch)
- [x] pruneOldRegistrations(90) called on mount to keep localStorage tidy
- [x] Unit tests for registrationStore (14 tests passing)

## Director Code System

- [x] Generate a unique director code (DIR-XXXXXX format) when a tournament is created and store it in TournamentConfig
- [x] Add resolveByDirectorCode() helper to tournamentRegistry (case-insensitive)
- [x] Add /director-access route — clean code entry page with amber shield icon
- [x] Validate director code, resolve tournament, grant director session, redirect to /tournament/:id/manage
- [x] grantDirectorSession() / hasDirectorSession() / clearDirectorSession() helpers
- [x] Auto-grant director session after tournament creation in wizard
- [x] Surface director code in wizard Share step (amber card, Private badge, reveal/copy toggle)
- [x] Unit tests for director code system (10 tests passing)

## Home Page Hover Animations

- [x] Add soft shiny hover animations to feature cards, stat cards, How It Works steps, and testimonial cards (shineSweep diagonal highlight + lift + glow)

## Logo Hover Animation

- [x] Add soft hover animation to OTB!! nav logo (scale 1.06 + green drop-shadow glow, dark mode variant, reduced-motion safe)

## PWA Install Banner

- [x] usePwaInstall hook — capture beforeinstallprompt, detect iOS Safari, check standalone mode
- [x] InstallBanner component — bottom-anchored mobile strip with OTB logo, install CTA, dismiss button
- [x] iOS variant — shows Share icon + step-by-step instruction sheet (bottom sheet)
- [x] localStorage dismissal — remember dismiss for 14 days, never show in standalone mode
- [x] Wire InstallBanner into App.tsx layout (renders on all routes, hidden on md+)
- [x] Unit tests for usePwaInstall hook logic (12 tests passing)

## Director Session Guard

- [x] Check hasDirectorSession(tournamentId) at the top of Director.tsx
- [x] Redirect to /director-access?next=/tournament/:id/manage if session is missing
- [x] Show a brief "Checking director access…" loading screen with animated Shield icon
- [x] Demo tournament (otb-demo-2026) bypasses the guard for open exploration
- [x] Unit tests for the session guard logic (10 tests passing)

## Forgot Director Code Recovery

- [x] listTournaments() used to read all local tournaments with their director codes
- [x] "Forgot your director code?" link on DirectorAccess page opens a recovery modal
- [x] Recovery modal — lists tournaments, reveal/hide toggle, copy button, "Use this" fills main input
- [x] Empty state — friendly message with Trophy icon if no tournaments found on this device
- [x] Modal animates in with slideUpModal spring keyframe
- [x] Unit tests for forgot-code flow (9 tests passing)

## Tournament Archive Page

- [x] /tournaments route — full archive page with card grid
- [x] UserTournamentCard — shows name, date, venue, format, round count, player count, winner badge
- [x] Standings drawer — expandable card with final standings (rank, name, score, ELO, wins/draws/losses)
- [x] Empty state — friendly Trophy icon prompt to create first tournament
- [x] Search + format filter + sort bar (date / players / ELO)
- [x] Route wired in App.tsx, Archive link in Home.tsx nav (desktop + mobile)
- [x] Unit tests for archive data integrity and listTournaments helper (12 tests passing)

## Archive → Report Link

- [x] "View Report" button on UserTournamentCard links to /tournament/:id/report for all tournaments (green accent for completed, muted for in-progress)

## CSV Export

- [x] Create exportStandings utility in client/src/lib/exportCsv.ts
- [x] Add Download CSV button to UserTournamentCard (completed tournaments only)
- [x] Write unit tests for exportStandings CSV utility (27 tests passing)

## Two-Path Onboarding (Quickstart vs Schedule Tournament)

- [x] Add mode-selection screen to TournamentWizard (Quickstart card + Schedule Tournament card)
- [x] Build Quickstart single-screen form: name, location, auto-filled today's date
- [x] Apply smart defaults for Quickstart: Swiss, 5 rounds, 16 players, 10+5 time, chess.com
- [x] Rename existing 4-step wizard path to "Schedule Tournament"
- [x] Wire both paths so they share the same Share/confirmation step

## Tournament Settings Panel (Director Dashboard)

- [x] Add updateTournamentConfig() helper to tournamentRegistry.ts
- [x] Build TournamentSettingsPanel component (editable fields: name, venue, date, description, format, rounds, max players, time control, rating system)
- [x] Lock editing once tournament is active (rounds > 0 or status !== registration)
- [x] Wire panel into Director Dashboard Settings tab (replace static read-only display)
- [x] Sync name/rounds changes back to directorState (tournamentName, totalRounds)
- [x] Unit tests for updateTournamentConfig helper (20 tests passing)

## Recommended Rounds Hint

- [x] Add recommendedRoundsHint() helper that returns optimal rounds count and label based on player count
- [x] Show dynamic hint inside the rounds picker on the Quickstart form, updating live based on maxPlayers
- [x] Unit tests for recommendedRoundsHint helper (25 tests passing)

## Quickstart Enter Key Submission

- [x] Add onKeyDown prop to TextInput so Enter on name/location/date fields fires handleNext
- [x] Guard picker buttons so Enter on them doesn't bubble to the global handler (e.preventDefault in handleFieldEnter)
- [x] Unit test: Enter key fires handleNext when name is filled (covered by existing canAdvance tests)

## Quickstart Player Cap Picker

- [x] Add collapsible player cap picker (8/12/16/24/32) to QuickstartForm
- [x] Update Smart Defaults card to show live max players value
- [x] Update recommended rounds hint to react to selected player cap

## Premium Dashboard UI Redesign

- [x] Director Dashboard: upgrade header — larger tournament name, bolder status badge, generous padding
- [x] Director Dashboard: upgrade sidebar — larger type, bigger icon targets, section dividers
- [x] Director Dashboard: upgrade tab bar — pill tabs with larger text, bolder active state
- [x] Director Dashboard: upgrade board cards — bigger board number, larger player names, bolder result buttons
- [x] Director Dashboard: upgrade standings sidebar — larger rank numbers, player name hierarchy
- [x] Director Dashboard: upgrade Generate Round CTA — full-width primary button, confident sizing
- [x] Tournament (participant) page: upgrade hero header — editorial tournament name, meta pill row
- [x] Tournament page: upgrade pairings cards — bigger player names, cleaner board header, bolder result pills
- [x] Tournament page: upgrade standings panel — larger rank, name, score hierarchy
- [x] Tournament page: upgrade round tab bar — larger tabs, clearer active/completed/upcoming states
- [x] Tournament page: upgrade live clock banner — bolder, more prominent
- [x] Apply consistent spacing tokens and remove all text-[10px] / text-xs from primary content

## Mobile Layout Audit (Director Dashboard — 375px)

- [x] Tab bar + Generate Round: stack tab bar full-width on mobile, button below on xs
- [x] BoardCard: truncate player name, prevent overflow on 375px
- [x] BoardCard result buttons: ensure 4-button row (3 results + clear) doesn't overflow
- [x] Previous rounds summary: upgrade from text-[10px] to text-xs, improve grid layout
- [x] Registration panel: fix join URL overflow, ensure copy+QR buttons don't get squished
- [x] Players tab toolbar: fix search input min-width overflow at 375px
- [x] Tournament Complete buttons: stack or wrap on mobile

## Mobile Layout Audit (Participant Dashboard — 375px)

- [x] TournamentHeader: reduce meta row gap and font size on mobile, prevent 5-item wrap
- [x] TournamentHeader: hide progress widget on mobile (xs/sm), show only on md+
- [x] Round tab bar: add overflow-x-auto scroll so 7+ round tabs don't overflow 375px
- [x] Game card player row: add min-w-0 + truncate to prevent name overflow
- [x] Live clock banner: hide elapsed clock on mobile, keep status text + LiveBadge only
- [x] PerformanceSection: reduce player name column width on mobile (w-20 instead of w-28)

## Haptic Feedback on Result Entry

- [x] Add vibration API haptic pulse to result entry buttons in BoardCard (Director Dashboard)
- [x] Add scale-pulse animation on the selected result button after recording (scale-[1.03] + coloured shadow)

## Participant "My Game" Highlight

- [x] Read registered username from registrationStore for the current tournamentId
- [x] Find the player object whose username matches the registered username
- [x] Pass myPlayerId down to PairingsPanel and GameCard
- [x] Auto-scroll to the participant's game card on mount (useEffect + scrollIntoView)
- [x] Add green ring + "Your Game" badge to the participant's game card
- [x] Add keyframe pulse animation that fades after 3s (myGamePulse plays twice then settles to static ring)
- [x] Unit tests for findMyGame helper (21 tests passing)

## Participant "My Standing" Row Highlight

- [x] Pass myPlayerId to StandingsPanel (desktop) and MobileStandingsAccordion
- [x] Apply green left-border + green-tinted bg to participant's own row in StandingsPanel
- [x] Apply same highlight to participant's row in MobileStandingsAccordion
- [x] Pass myPlayerId from TournamentPage to both components

## Player Cap Enforcement

- [x] addPlayerToTournament returns { success, reason } instead of void — "full" | "duplicate" | "ok"
- [x] Join page handleConfirm checks return value and shows toast if reason === "full"
- [x] Toast banner: amber warning, "Tournament Full", player count + max shown
- [x] Confirm button disabled on the confirm step if tournament is already full
- [x] Unit tests for cap enforcement in addPlayerToTournament (13 tests passing)

## Mobile Overlay & Accessibility Fixes

- [x] ModeSelect: make content scrollable on short screens (overflow-y-auto, remove items-center justify-center)
- [x] ModeSelect: reduce py-12 gap-10 to py-6 gap-6 on mobile, keep desktop spacing
- [x] Wizard: add body scroll lock (overflow:hidden on document.body) when open, restore on close
- [x] Wizard: add env(safe-area-inset-bottom) padding to mobile bottom nav bar
- [x] InstallBanner: raise z-index to z-[80] (iOS sheet z-[90]) so it doesn't conflict with Join page action bar
- [x] Join page: mobile-action-bar CSS raised to z-index 85, above InstallBanner
- [x] QuickstartForm: step content scroll area has pb-6 so pickers don't get clipped behind mobile bottom nav

## Offline Resilience — visibilitychange Re-sync

- [x] Create useVisibilitySync hook that re-reads localStorage on visibilitychange (document.hidden === false)
- [x] Wire useVisibilitySync into directorState.ts so Director Dashboard re-syncs on tab focus
- [x] Wire useVisibilitySync into Tournament.tsx participant page so pairings/standings re-sync on tab focus
- [x] Show a subtle "Synced" toast when state is refreshed after returning from background
- [x] Unit tests for useVisibilitySync hook — 11 tests passing (410 total)

## "My Rank" Sticky Chip (Mobile Standings)

- [x] Compute myRankRow from standingRows where player.id === myPlayerId
- [x] Show sticky chip only when: myPlayerId is set, myRankRow exists, and accordion is open
- [x] Chip floats at the bottom of the MobileStandingsAccordion card (sticky bottom-0 inside the expanded panel)
- [x] Chip displays: rank medal/number, player name (truncated), score pill
- [x] Chip is hidden when the participant's own row is already visible in the viewport (IntersectionObserver)
- [x] Tapping the chip scrolls the participant's row into view
- [x] Unit tests for myRankRow derivation helper — 13 tests passing (423 total)

## Favicon & PWA Icon Replacement

- [x] Generate all icon sizes from !! logo (16, 32, 180, 192, 512px + favicon.ico)
- [x] Upload icons to CDN via manus-upload-file --webdev
- [x] Update index.html: favicon.ico, favicon-16/32, apple-touch-icon, theme-color meta
- [x] Update manifest.json: icons array with 192 and 512 CDN URLs

## Open Graph Banner (1200×630)

- [x] Generate 1200×630 OG banner with !! logo, OTB Chess branding, chess board texture
- [x] Upload banner to CDN
- [x] Update og:image and twitter:image in index.html

## Director Dashboard — Player Capacity Badge

- [x] Create CapacityBadge component: shows "X / Y players", fill bar, colour states (green/amber/red)
- [x] Wire badge into Director Dashboard header (next to tournament name / status)
- [x] Colour thresholds: green <75%, amber 75–99%, red 100% (full)
- [x] Show "Full" label when at capacity
- [x] Unit tests for capacity colour/label logic — 17 tests passing (440 total)

## Undo Result Snackbar

- [x] Create UndoSnackbar component: floating bottom-centre, countdown ring, Undo + Dismiss buttons
- [x] Create useUndoResult hook: stores previous result, 5s timer, auto-dismiss, undo callback
- [x] Wire into Director.tsx setResult flow: capture previous result before applying, show snackbar
- [x] Undo reverts the game result back to pending (*) and hides snackbar immediately
- [x] New result entry while snackbar is visible replaces the pending undo (no stacking)
- [x] Unit tests for useUndoResult hook — 12 tests passing (452 total)

## Per-Round Countdown Clock

- [x] Create useRoundTimer hook: duration config, start/pause/reset, elapsed tracking, near-end flag
- [x] RoundTimerCard component: large circular progress ring, MM:SS display, start/pause/reset buttons, duration selector
- [x] Wire RoundTimerCard into Director Dashboard sidebar (below Round Progress card)
- [x] Near-end threshold: trigger push notification broadcast at 5 minutes remaining (configurable)
- [x] Push notification: "⏰ 5 minutes left in Round N — finish your games!" to all tournament subscribers
- [x] Timer resets automatically when director generates next round
- [x] Unit tests for useRoundTimer hook — 19 tests passing (471 total)

## Download Results PDF

- [x] Install jsPDF + jspdf-autotable for client-side PDF generation
- [x] Create generateResultsPdf helper: tournament header, final standings table, cross-table
- [x] Standings table columns: Rank, Name, ELO, Points, W/D/L, Buchholz
- [x] Cross-table: players as rows and columns, result cells (1/0/½/–), diagonal greyed out
- [x] "Download Results" button in Director Dashboard Quick Actions (visible when tournament has ≥1 completed round)
- [x] Filename: otb-{tournamentName}-results.pdf
- [x] Unit tests for generateResultsPdf helpers — 19 tests passing (490 total)

## Participant Round Timer (Read-Only)

- [x] Persist timer state (startWallMs, elapsedAtPauseMs, status, durationSec) to localStorage in useRoundTimer on every tick
- [x] Create useParticipantTimer hook: reads timer snapshot from localStorage, re-computes remaining time locally via rAF
- [x] RoundTimerDisplay component: compact read-only ring + MM:SS, near-end amber state, "Time's Up" red state
- [x] Wire RoundTimerDisplay into Tournament.tsx participant page (below round header, hidden when no timer is running)
- [x] Unit tests for useParticipantTimer snapshot-to-remaining computation — 19 tests passing (509 total)

## Landing Page Nav & Hero Refinement

- [x] Remove "Join Tournament" and "Start Tournament" buttons from header nav bar (keep only Sign In + theme toggle)
- [x] Rename hero primary button from "Start a Tournament" → "Host Tournament"
- [x] Rename hero secondary button from "Join a Tournament" → "Join"
- [x] Add soft gradient glow hover animation to the four feature pills (Setup in <3 min, 99.9% ELO accuracy, Swiss & Round Robin, 80+ clubs worldwide)

## "How it Works" Scroll-Reveal Animations

- [x] Add scroll-reveal CSS keyframes (fade-in-up, 0.6s cubic-bezier ease-out) to index.css
- [x] Per-element IntersectionObserver wired directly in HowItWorks component (threshold 0.15, fires once)
- [x] Cards stagger at 160ms, 270ms, 380ms; heading at 80ms; label at 0ms
- [x] Section heading and label badge also fade in on scroll
- [x] Respects prefers-reduced-motion (elements made immediately visible, no animation)

## Nav Bar — Archive Link Reorder

- [x] Remove Archive from centre desktop nav links section
- [x] Add Archive to right-side desktop CTA group, ordered: Sign In → Archive → Theme Toggle
- [x] Update mobile menu to show Archive below Sign In

## Director Dashboard — Home Page Redesign

- [ ] Add "Home" as the default/first tab in the Director Dashboard tab bar
- [ ] Home tab: centred Event Info card as the sole focal component, with tab buttons (Boards, Players, Standings, Settings) aligned to the right
- [ ] Unified tab bar: Home | Boards | Players | Standings | Settings (remove separate sidebar)
- [ ] Move Round Progress out of sidebar into a subtle inline strip in the header, directly under the tournament title (shows registered player count + time control + round progress bar)
- [ ] Live Standings becomes a tab (not a sidebar card)
- [ ] Remove the old sidebar layout entirely when on the Home tab
- [ ] Header nav: tournament title left, round-progress strip centre, action buttons right

## Logo Nav Link & Tournament Dashboard Button

- [x] Make the header logo (!! image) a clickable link to the landing page (/) in Home.tsx nav
- [x] Detect active tournament registration from localStorage (otb_registrations key)
- [x] Show "Tournament Dashboard" button on far right of landing page nav for registered users
- [x] Button navigates to /tournament/{config.id} for the most recent active tournament
- [x] Button is hidden when no active tournament session exists
- [x] Added getAllRegistrations() export to registrationStore.ts

## Director Dashboard Home Page Redesign

- [x] Add "home" and "standings" to activeTab union type, default to "home"
- [x] Replace old 3-tab bar (boards/players/settings) with unified 5-tab bar (Home · Boards · Players · Standings · Settings)
- [x] Home tab: centred Event Info card + Quick Actions column to the right (lg:flex-row layout)
- [x] Standings tab: full StandingsPanel content (moved from sidebar)
- [x] Remove the left sidebar entirely (aside element)
- [x] Main panel becomes full-width (max-w-5xl, no flex gap-8 with sidebar)
- [x] Round Progress strip stays in header (already done)
- [x] RoundTimerCard moves into Home tab right column

## Round in Progress Summary Card (Home Tab)

- [x] Show compact RoundStatusCard on Home tab only when tournament is active (not registration phase)
- [x] Card shows: Round N / Total, boards completed (X/Y), completion progress bar
- [x] Card shows: time remaining from round timer (if running), or "No timer" / "Time's up"
- [x] Card shows: top 3 standings preview (rank, name, points)
- [x] "View Boards →" quick-action button switches to Boards tab
- [x] Card is hidden during registration phase (isRegistration === true)
- [x] "Generate Round N" CTA appears when all results are in (canGenerateNext)
- [x] Unit tests for RoundStatusCard helpers — 19 tests passing (528 total)

## QR Code Fix & Join Page Streamline

- [x] Audit QR URL generation in Director.tsx — QR encodes window.location.origin/join/{inviteCode} (correct)
- [x] Join page route /join/:code pre-fills tournament code from URL param and skips code step
- [x] QR mode: single-screen form with Name + Chess.com username + "Join Tournament" button
- [x] Auto-fetch ELO from chess.com API on join submit (existing useChessComProfile hook)
- [x] On successful QR join, navigate directly to /tournament/{config.id} participant view
- [x] Success screen Standings button now resolves to actual tournament URL (not hardcoded demo)
- [x] Manual flow (/join without code) still uses full multi-step flow unchanged

## Director Dashboard Home — Hero Redesign

- [x] Build unified TournamentHeroCard: large MM:SS clock left, minute input + Start/Pause/Reset right, event meta row below
- [x] Remove duration preset buttons from timer — replaced with single clean minute input field
- [x] Wide Round Status card below hero (full-width, clear board completion + standings preview)
- [x] Move Show QR, Copy Join Link, Manage Players, Pairings & Print Sheet, Download Results PDF to Settings tab Quick Actions card
- [x] Remove Quick Actions column from Home tab right column
- [x] Responsive: stacks vertically on mobile, side-by-side on desktop
- [x] RoundTimerCard component replaced by inline timer inside TournamentHeroCard

## Director Home Tab — Registration Phase View

- [x] Show registration-phase layout on Home tab when tournament is in lobby (isRegistration === true)
- [x] Prominent "Start Tournament" CTA button (large, green, full-width on mobile)
- [x] Live player list showing all registered players with name, ELO, chess.com username, avatar
- [x] Player count badge showing X / maxPlayers (or X registered if no cap)
- [x] Remove player button (×) on each row for the director
- [x] Minimum players warning if count < 2 (disable Start button)

## Consolidate "Generate Next Round" Button

- [x] Remove compact "Generate R{N}" button from the header round-progress strip (line ~820)
- [x] Remove "Generate Round N" button from the top-right of the Round title row (line ~866)
- [x] Remove "Generate Round N" button from the Home tab Round Status card (line ~1316)
- [x] Keep single "Generate Round N" CTA in the Boards tab status banner (full-width, prominent)
- [x] Boards tab: make the status banner CTA the canonical action (inline with the "All results in" message)

## Boards Tab — Auto-scroll to Generate CTA

- [x] Add useRef to the Generate Next Round CTA element in the Boards tab
- [x] Add useEffect that fires when allResultsIn flips true while activeTab === "boards"
- [x] Smooth-scroll the CTA into view with a small delay (so the last result animation settles first)

## Bug Fix — QR Code Points to Wrong Tournament

- [x] Audit joinUrl construction in Director.tsx and QR modal
- [x] Audit resolveTournament / invite code lookup to ensure real tournamentId is used
- [x] Fix: QR code must encode the real live tournament's invite code / slug, not a demo ID
- [x] Fix Director.tsx inviteCode fallback — use tournamentId directly instead of "OTB2026" when config is missing
- [x] Fix TournamentWizard.tsx — replace hardcoded https://otbchess.app with window.location.origin

## Header Logo Size — Minimalist Refinement

- [x] Reduce Home.tsx header logo from h-14 to h-8 for a sleek, minimal look
- [x] Ensure Join.tsx header logo is consistent (already h-8, keep as-is)

## Critical Bug Fix — QR Code Join Flow (Root Cause Analysis)

### Root Cause: localStorage is device-local — tournament registry not shared across devices

The tournament registry (invite codes, tournament configs) is stored in the **director's device localStorage only**.
When a player scans the QR code on their phone, they land on a **different device** with an empty registry.
`resolveTournament(inviteCode)` returns `null` because the player's phone has never seen this tournament.
The Join page then shows "Tournament not found" or silently falls back to demo data.

### Fixes applied:
- [x] Embed tournament metadata as ?t=<base64json> in QR URL — Join page bootstraps registry from URL on any device
- [x] TournamentWizard: register tournament when share step is shown (not just on "Go to Tournament")
- [x] Director.tsx: joinUrl now includes ?t= metadata param
- [x] TournamentWizard StepShare: inviteUrl now includes ?t= metadata param
- [x] Join.tsx: decodeEmbeddedMeta() + bootstrap useEffect registers tournament on player device
- [x] Fix: isValidCode now requires resolvedConfig !== null OR embeddedMeta match (no more length-only check)
- [x] Fix: isTournamentFull now reads from correct key otb-director-state-v2-{id}
- [x] Fix: tournamentDisplay no longer falls back to DEMO_TOURNAMENT — uses embeddedMeta as intermediate fallback

## Director Header — Invite Code Chip

- [x] Display invite code as a copyable chip in the Director Dashboard header
- [x] One-click copy with toast confirmation
- [x] Monospace font, clearly readable at a glance for read-aloud use

## Director — Full-Screen Announce Modal

- [x] AnnounceModal component: full-screen overlay, dark green background, large QR code, giant invite code text
- [x] Wire to Bell button in Director header (replaces old copy-link behaviour)
- [x] Tournament name displayed prominently at the top
- [x] Join URL shown below the QR code in small monospace text
- [x] Close button (Escape key + X button)
- [x] Copy invite code button inside the modal

## Critical Bug — Player Join Not Appearing on Director Dashboard

- [x] Audit full join → registration → director dashboard data flow
- [x] Identify root cause: addPlayerToTournament writes to player's device localStorage; director reads from director's device localStorage — two separate storage spaces, no cross-device sync
- [ ] Add tournament_players DB table (id, tournament_id, player_json, joined_at)
- [ ] Add POST /api/tournament/:id/players endpoint (called by Join page on registration)
- [ ] Add GET /api/tournament/:id/players endpoint (polled by Director dashboard)
- [ ] Update Join.tsx handleQrJoin and handleConfirm to POST player to server after local addPlayerToTournament
- [ ] Update Director.tsx useDirectorState to poll /api/tournament/:id/players every 5s and merge into state.players
- [ ] Add pnpm db:push to apply schema migration

## Director Mobile Header — Premium Redesign

- [x] Audit full Director header markup and identify all cramped elements
- [x] Redesign mobile header: single row with status dot + QR icon + ThemeToggle + overflow menu
- [x] Move invite code chip off the header nav row on mobile (now in overflow dropdown + desktop only)
- [x] Collapse Pause/Resume, Capacity badge, Invite code into overflow menu on mobile
- [x] Ensure no overlapping or text truncation on screens < 390px wide
