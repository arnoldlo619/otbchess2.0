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
- [x] Add tournament_players DB table (id, tournament_id, player_json, joined_at)
- [x] Add POST /api/tournament/:id/players endpoint (called by Join page on registration)
- [x] Add GET /api/tournament/:id/players endpoint (polled by Director dashboard)
- [x] Update Join.tsx handleQrJoin and handleConfirm to POST player to server after local addPlayerToTournament
- [x] Update Director.tsx useDirectorState to poll /api/tournament/:id/players every 5s and merge into state.players
- [x] Schema migration applied via direct SQL (pnpm db:push had push_subscriptions conflict)

## Director Mobile Header — Premium Redesign

- [x] Audit full Director header markup and identify all cramped elements
- [x] Redesign mobile header: single row with status dot + QR icon + ThemeToggle + overflow menu
- [x] Move invite code chip off the header nav row on mobile (now in overflow dropdown + desktop only)
- [x] Collapse Pause/Resume, Capacity badge, Invite code into overflow menu on mobile
- [x] Ensure no overlapping or text truncation on screens < 390px wide

## Server-Side Player Sync

- [x] Add tournament_players table to schema.ts (id, tournament_id, player_json, joined_at)
- [x] Run pnpm db:push to migrate the new table (via direct SQL)
- [x] Add POST /api/tournament/:id/players endpoint (upsert by username)
- [x] Add GET /api/tournament/:id/players endpoint (returns all players for a tournament)
- [x] Add DELETE /api/tournament/:id/players/:username endpoint (director remove player)
- [x] Update Join.tsx to POST player to server after successful registration
- [x] Update Director.tsx to poll GET /api/tournament/:id/players every 5s during registration phase
- [x] Merge server players into director state.players (deduplicate by username via addPlayer)

## SSE Real-Time Player Sync (Replace Polling)

- [x] Add GET /api/tournament/:id/players/stream SSE endpoint on the server
- [x] In-memory subscriber map: tournamentId → Set<Response> for fan-out
- [x] Broadcast helper: broadcastPlayerJoined(tournamentId, player) called from POST endpoint
- [x] SSE keepalive ping every 25s to prevent proxy timeouts
- [x] Clean up subscriber on client disconnect (res.on("close"))
- [x] Update Join.tsx: server POST already triggers broadcast — no client change needed
- [x] Replace Director.tsx 5s poll useEffect with EventSource SSE listener
- [x] SSE listener: on "player_joined" event, call addPlayer(player)
- [x] SSE listener: reconnect automatically on error (EventSource built-in)
- [x] Removed the setInterval polling useEffect from Director.tsx

## Tournament State Persistence (Server-Side)

- [x] Add tournament_state DB table (tournament_id PK, state_json TEXT, updated_at TIMESTAMP)
- [x] Add GET /api/tournament/:id/state endpoint — returns full state JSON
- [x] Add PUT /api/tournament/:id/state endpoint — upserts full state JSON
- [x] Update useDirectorState: debounced auto-save to server on every state change (1500ms debounce)
- [x] Hydrate from server on mount — prefer server state if newer than localStorage
- [x] Skip server save/load for demo tournament (otb-demo-2026)

## Tournament Wizard Layout — Fix Sidebar Gap

- [x] Fix two-column layout: sidebar and form panel must fill full viewport width with no gap
- [x] Sidebar is fixed-width left column (lg:w-[32%] xl:w-[34%]), form panel takes flex-1
- [x] Removed max-w-3xl mx-auto constraint from inner content wrapper — form now fills full right panel with px-16 xl:px-20 padding

## Tournament Wizard — Larger Desktop Form Fields

- [ ] Increase input height to lg:h-14 (56px) on desktop, keep h-11 on mobile
- [ ] Increase label font size to lg:text-base on desktop
- [ ] Increase input font size to lg:text-base on desktop
- [ ] Increase vertical gap between form fields to lg:gap-6 on desktop
- [ ] Increase section title / step heading size on desktop

## Fix: API Routes Not Reachable in Dev (SSE/Player Sync Broken)

- [x] Root cause: Vite dev server only ran Vite, not Express — all /api/* calls returned HTML index.html
- [x] Refactor server/index.ts: extract createApp() function that builds the Express app without starting an HTTP server
- [x] Add vitePluginExpressApi() Vite plugin: mounts createApp() as middleware in configureServer body (before Vite's htmlFallbackMiddleware)
- [x] Guard startServer() with isMain check so it only runs when executed directly, not when imported
- [x] Remove vitePluginChessProxy() — chess.com/lichess proxies now handled by Express (no duplicate)
- [x] Verified: POST /api/tournament/:id/players → 200 JSON, SSE stream delivers player_joined events
- [x] All 528 tests passing

## Player Lobby & My Board (Post-Join Mobile Experience)

- [x] Server: add POST /api/tournament/:id/start endpoint — broadcasts tournament_started SSE event with Round 1 pairings
- [x] Server: tournament_started payload includes { round: 1, games: Game[], players: Player[] }
- [x] Director.tsx: call POST /api/tournament/:id/start when startTournament() is invoked
- [x] Join.tsx: after success step, transition to Lobby screen (waiting for tournament to start)
- [x] Lobby screen: animated waiting UI — pulsing chess piece, player count, tournament name
- [x] Lobby screen: open SSE stream for /api/tournament/:id/players/stream
- [x] Lobby screen: on tournament_started event, transition to My Board screen
- [x] Lobby screen: if tournament already started (poll state on mount), go straight to My Board
- [x] My Board screen: show board number, color (White/Black), opponent name/ELO/avatar
- [x] My Board screen: result submission buttons (I Won / Draw / I Lost)
- [x] My Board screen: submitted result calls POST /api/tournament/:id/result (new endpoint)
- [x] My Board screen: after result submitted, show confirmation + standings link
- [x] New route: /tournament/:id/play?username=xxx (player view, mobile-first)
- [x] Unit tests for player board lookup helper (findMyBoard)

## Round Started SSE Push

- [x] Server: add POST /api/tournament/:id/round endpoint — broadcasts round_started SSE event with new round pairings
- [x] Server: round_started payload includes { round: number; games: Game[]; players: Player[] }
- [x] Director.tsx: call POST /api/tournament/:id/round when nextRound() is invoked
- [x] PlayerView: listen for round_started SSE event on the My Board screen
- [x] PlayerView: on round_started, animate transition to new board assignment (brief "New Round!" flash)
- [x] PlayerView: reset result-submitted state when new round starts
- [x] PlayerView: show round number badge updating in real time
- [x] Unit tests for round_started SSE handler in PlayerView

## Tournament Complete Screen

- [x] Server: add POST /api/tournament/:id/end endpoint — broadcasts tournament_ended SSE event with final standings
- [x] Server: tournament_ended payload includes { players: Player[] } sorted by points desc
- [x] Director.tsx: call POST /api/tournament/:id/end when the tournament is ended/completed
- [x] PlayerView: add tournament_complete screen type to PlayerScreen union
- [x] PlayerView: listen for tournament_ended SSE event and transition to tournament_complete screen
- [x] PlayerView: on mount, if tournament status is "completed", go straight to tournament_complete screen
- [x] TournamentComplete screen: animated trophy/confetti hero
- [x] TournamentComplete screen: top-3 podium (1st/2nd/3rd) with avatar, name, score
- [x] TournamentComplete screen: full standings table (rank, name, points, W/D/L)
- [x] TournamentComplete screen: highlight the current player's row in the standings
- [x] TournamentComplete screen: "View Full Standings" link to the public tournament page
- [x] Unit tests for tournament_ended SSE handler and standings sorting

## Auth & User Profiles

- [x] Audit existing auth scaffolding and Sign In button
- [x] DB schema: users table (id, email, passwordHash, displayName, chesscomUsername, lichessUsername, avatarUrl, createdAt)
- [x] API: POST /api/auth/register — create account, return JWT
- [x] API: POST /api/auth/login — verify credentials, return JWT
- [x] API: POST /api/auth/logout — clear session
- [x] API: GET /api/auth/me — return current user from JWT
- [x] API: PATCH /api/auth/me — update profile fields
- [x] AuthContext: React context providing user state, login/logout helpers
- [x] Sign In / Sign Up modal: tabbed UI, email + password fields, validation
- [x] Sign In / Sign Up modal: chess.com username field (optional, pulls ELO on save)
- [x] Header nav: replace Sign In button with user avatar + dropdown when signed in
- [x] Header nav dropdown: Profile, My Tournaments, Sign Out
- [x] User profile page /profile: display name, avatar, chess.com ELO, tournament history
- [x] Wire director tournament creation to attach userId to tournament
- [x] Unit tests for auth API helpers

## Bug Fix: Player Stuck on Public Tournament Page

- [x] Find where Join.tsx redirects after registration and fix it to go to /tournament/:id/play?username=xxx
- [x] Fix the public tournament page to detect if the user is already registered and redirect to PlayerView
- [x] Ensure the SSE connection is established on the PlayerView lobby (not the public page)

## Rejoin Deep Link

- [x] Join page: read ?u= param on mount; if present and tournament is resolved, skip registration and navigate directly to /tournament/:id/play?username=xxx
- [x] Join page: if ?u= player is already in the tournament player list, show a "Rejoin" confirmation screen instead of the full form
- [x] PlayerView My Board screen: show a "Your Rejoin Link" section with a copy-link button and a small personal QR code
- [x] PlayerView Lobby screen: also show the rejoin link so players can bookmark it while waiting
- [x] Unit tests for the ?u= auto-rejoin logic

## Auth & User Profiles

- [x] Server: auth.ts — POST /api/auth/register (email, password, displayName, chessUsername)
- [x] Server: auth.ts — POST /api/auth/login (email, password) → JWT cookie
- [x] Server: auth.ts — POST /api/auth/logout (clear cookie)
- [x] Server: auth.ts — GET /api/auth/me (verify JWT, return user)
- [x] Server: mount auth router in index.ts with cookie-parser
- [x] DB: users table (id, email, passwordHash, displayName, chessUsername, platform, createdAt)
- [x] Client: useAuth hook (user state, login, logout, register, loading)
- [x] Client: AuthContext provider wrapping the app
- [x] Client: AuthModal component (Sign In / Sign Up tabs, form validation, error display)
- [x] Client: Header nav — Sign In button opens AuthModal
- [x] Client: Header nav — when signed in, show avatar + display name + dropdown (Profile, Sign Out)
- [x] Client: /profile page — avatar, display name, chess username, ELO, tournament history
- [x] Client: /profile route added to App.tsx
- [x] Unit tests for auth helpers (password hashing, JWT verify, form validation)

## Google OAuth (Continue with Google)

- [ ] Audit OAUTH_SERVER_URL and Manus OAuth portal flow
- [ ] Server: GET /api/auth/google — redirect to Google OAuth via Manus OAuth portal
- [ ] Server: GET /api/auth/google/callback — exchange code for user info, upsert user, set JWT cookie
- [ ] AuthModal: add "Continue with Google" button above the email/password form
- [ ] AuthModal: show a divider ("or") between Google button and email form
- [ ] Client: handle OAuth redirect back to app and update auth state
- [ ] Unit tests for OAuth callback user upsert logic

## AuthModal UX Polish

- [x] Auto-focus email field when modal opens
- [x] Inline field-level error messages (email, password, display name)
- [x] Password strength indicator (weak / fair / strong bar)
- [x] Show/hide password toggle button
- [x] Remember Me checkbox (extends JWT expiry to 30 days)
- [x] Improved loading state (spinner inside submit button)
- [x] Success state animation after sign-in/sign-up
- [x] Tab switch clears errors and resets form
- [x] Enter key submits form from any field
- [x] Unit tests for password strength scorer and field validators

## My Tournaments History

- [x] Add ownerId (nullable int, FK → users.id) to TournamentConfig in shared types
- [x] TournamentWizard: read auth context and attach ownerId when saving to registry
- [x] Server: POST /api/user/tournaments — save tournament ownership record to DB
- [x] Server: GET /api/user/tournaments — return all tournaments owned by the JWT user
- [x] DB: user_tournaments table (id, userId, tournamentId, createdAt)
- [x] Profile page: replace static placeholder with real My Tournaments list from API
- [x] Profile page: each tournament card shows name, date, format, player count, status
- [x] Profile page: "Manage" button links to /director/:id
- [x] Profile page: empty state when user has no tournaments yet
- [x] Unit tests for tournament ownership helpers

## My Tournaments Status Pills

- [x] Add `status` field to user_tournaments DB table (lobby | active | complete)
- [x] Persist tournament status when saving to user_tournaments on creation (defaults to "lobby")
- [x] Server: GET /api/user/tournaments returns status field
- [x] Profile page: render a status pill on each tournament card (Lobby / Active / Complete)
- [x] Status pill colours: Lobby = amber, Active = green, Complete = gray/muted
- [x] Unit tests for status pill label/colour helpers

## Director Result Confirmation Badges

- [ ] Server: in-memory store for player-reported results per tournament (boardId → {result, reportedBy, timestamp})
- [ ] Server: POST /api/tournament/:id/report-result endpoint (player submits result)
- [ ] Server: SSE broadcast `result_reported` event to director when a player submits
- [ ] Director: listen for `result_reported` SSE events and store pending reports in state
- [ ] Director: BoardCard shows confirmation badge when a player has reported a result ("Alice reported: 1-0 ✓")
- [ ] Director: one-tap confirm button on the badge applies the result via enterResult()
- [ ] Director: badge dismissed after director confirms or manually enters a different result
- [ ] PlayerView: wire result submission to POST /api/tournament/:id/report-result
- [ ] Unit tests for result report store helpers and badge display logic

## Real-Time Sync Overhaul (Live Tournament Experience)

- [ ] Server: broadcast `standings_updated` SSE event whenever director enters/changes a result
- [ ] Server: broadcast `round_generated` SSE event when director generates the next round
- [ ] Server: GET /api/tournament/:id/live-state endpoint returns full live state (round, games, players/standings) for catch-up on connect
- [ ] PlayerView: replace localStorage-only state with server-authoritative live state fetched on mount
- [ ] PlayerView: open persistent SSE connection on mount (no account required — keyed by tournamentId + username in localStorage)
- [ ] PlayerView: handle `tournament_started`, `round_started`, `round_generated`, `standings_updated`, `tournament_ended` SSE events
- [ ] PlayerView: live standings tab showing all players ranked with score, W/D/L, and highlight for current player
- [ ] PlayerView: board assignment card auto-updates when new round is generated (no manual refresh)
- [ ] PlayerView: "Waiting for next round" state shown between rounds with live standings
- [ ] PlayerView: smooth animated transition when new round pairings arrive
- [ ] Director: broadcast standings_updated after every enterResult() call
- [ ] Director: broadcast round_generated after generateNextRound() completes
- [ ] Unit tests for SSE event handling and live state reconciliation

## Real-Time Sync Overhaul — Mar 2026

- [x] Audit SSE pipeline: identified dead-end result-submitted screen, missing standings_updated event, 1.5s debounce lag
- [x] Server: add standings_updated SSE broadcast to state PUT endpoint
- [x] Server: add GET /api/tournament/:id/live-state catch-up endpoint (no debounce lag)
- [x] Server: add in-memory pending results store + GET /pending-results endpoint
- [x] PlayerView: full rebuild — lobby, my_board, waiting_round, new_round_flash, tournament_complete screens
- [x] PlayerView: SSE listener works from ALL screens (round_started, standings_updated, tournament_ended)
- [x] PlayerView: live standings tab on My Board screen (shows rank, points, W/D/L)
- [x] PlayerView: waiting_round screen shows live standings between rounds
- [x] PlayerView: connection status badge (Live / Reconnecting)
- [x] PlayerView: catch-up fetch on mount so reconnecting players see current state immediately
- [x] Director: pushStandingsNow helper bypasses 1.5s debounce after every result entry
- [x] Director: pushStandingsNow called after recordWithUndo so SSE fires immediately
- [x] Unit tests: playerViewLiveSync.test.ts (13 tests — findMyBoard, myRank, standings merging)

## Live Spectator View — Mar 2026

- [ ] Audit existing /tournament/:id spectator page and SSE infrastructure
- [ ] Spectator page: connect to standings_updated + round_started + tournament_ended SSE events
- [ ] Spectator page: live standings table (rank, name, ELO, points, W/D/L, Buchholz)
- [ ] Spectator page: current round boards panel (all pairings, live result badges)
- [ ] Spectator page: round progress bar (X/N results in)
- [ ] Spectator page: connection status badge (Live / Reconnecting)
- [ ] Spectator page: catch-up fetch on mount via /live-state endpoint
- [ ] Spectator page: tournament header (name, format, round, status pill)
- [ ] Spectator page: auto-scroll / highlight when standings change
- [ ] Spectator page: tournament_complete screen with final podium
- [ ] Unit tests for spectator SSE state transitions

## Live Spectator View — Completed Mar 2026

- [x] Audit existing /tournament/:id spectator page and SSE infrastructure
- [x] Spectator page: connect to standings_updated + round_started + tournament_ended SSE events
- [x] Spectator page: catch-up fetch on mount via /live-state endpoint
- [x] Spectator page: SSE connection badge (Live / Reconnecting) in green banner
- [x] Spectator page: round progress bar (X/N boards completed) in green banner
- [x] Spectator page: new round flash notification banner (auto-dismisses after 5s)
- [x] Spectator page: standings and pairings auto-update on standings_updated SSE event
- [x] Spectator page: pairings panel auto-adds new round on round_started SSE event
- [x] Spectator page: tournament_complete status on tournament_ended SSE event
- [x] localStorage storage-event fallback preserved for same-device director/spectator
- [x] Unit tests: spectatorSSE.test.ts (20 tests — mergeLiveState, mergeStandingsUpdated, mergeRoundStarted, mergeTournamentEnded, progress pct)

## Web Push Notifications — Mar 2026

- [ ] Audit VAPID keys and existing push subscription infrastructure
- [ ] Server: store push subscriptions per tournament in DB (tournament_id, player_id, subscription JSON)
- [ ] Server: POST /api/tournament/:id/push-subscribe endpoint
- [ ] Server: send Web Push to all subscribed players when round_started fires
- [ ] Client: PlayerView — "Enable Notifications" prompt after player joins
- [ ] Client: usePushSubscription hook — subscribe and POST to server
- [ ] Service worker: handle push event and show notification with round number and board
- [ ] Service worker: notification click → navigate to /tournament/:id/play/:username
- [ ] Unit tests for push dispatch helpers

## Delete Tournament — Mar 2026

- [x] Server: DELETE /api/auth/user/tournaments/:id endpoint (auth-gated, owner-only)
- [x] Profile.tsx: trash icon button on each tournament card
- [x] Profile.tsx: confirmation dialog before deleting
- [x] Profile.tsx: optimistic removal from list on success
- [x] Unit tests for delete endpoint and UI helper

## Shareable Spectator QR Code — Mar 2026

- [x] Install qrcode.react package
- [x] Build ShareModal component: QR code + copyable spectator URL + "Open in new tab" link
- [x] Add "Share / Watch Live" button to director dashboard header
- [x] QR code encodes the public /tournament/:id spectator URL
- [x] Copy-to-clipboard with visual feedback (Copied!)
- [x] Unit tests for URL construction helper

## Share Spectator Link Wizard Step — Mar 2026

- [x] Audit TournamentWizard step structure and current final step
- [x] Add spectator section to Step 4 (Share): QR code + copyable URL + open link
- [x] Spectator URL derived from tournamentId (makeSlug) at creation time
- [x] Distinct from player join QR: blue accent, Tv2 icon, "Live" pulse badge
- [x] Unit tests for wizard spectator URL construction helper

## Full-Screen Spectator QR Mode — Mar 2026

- [x] Audit existing announce/projection screen and QR modal in Director.tsx
- [x] Build SpectatorQRScreen component: full-screen, large QR, URL, animated Live badge
- [x] Add "Project QR" toggle button to director dashboard header (sm+ screens)
- [x] Escape key dismisses the full-screen overlay
- [x] Unit tests for spectator QR screen URL and display logic

## Director Result Confirmation Badges — Mar 2026

- [x] Audit pending-results server store and result_submitted SSE event payload
- [x] Director listens for result_submitted SSE and stores pending reports in state
- [x] Director fetches existing pending reports on mount (catch-up after reconnect)
- [x] BoardCard: show confirmation badge when a player report exists for that game
- [x] Badge shows: reporter name, reported result, Confirm (✓) and Dismiss (✗) buttons
- [x] Confirm tap: calls onResult with the reported result and clears the pending report
- [x] Dismiss tap: clears the pending report without entering a result
- [x] Server: DELETE /api/tournament/:id/pending-results/:gameId endpoint
- [x] Unit tests for pending report state helpers (725 tests pass)

## Remove Player Self-Reporting — Mar 2026

- [ ] Remove submit-result UI from PlayerView (result buttons, submit handler, result_submitted fetch)
- [ ] Remove pending-results in-memory store from server/index.ts
- [ ] Remove POST /api/tournament/:id/result endpoint
- [ ] Remove GET /api/tournament/:id/pending-results endpoint
- [ ] Remove DELETE /api/tournament/:id/pending-results/:gameId endpoint
- [ ] Remove result_submitted SSE broadcast from server
- [ ] Remove Director SSE listener for result_submitted
- [ ] Remove pendingReports state, clearPendingReport helper from Director.tsx
- [ ] Remove confirmation badge UI from BoardCard
- [ ] Update PlayerView waiting/post-game screen copy: "Report your result to the director at the registration table"
- [ ] Update unit tests to remove result-submission test cases

## Remove Player Self-Reporting — Completed Mar 2026

- [x] Remove submitResult function and result submission UI from PlayerView MyBoardScreen
- [x] Replace result submission section with "report to director at registration table" instruction card
- [x] Remove handleResultSubmitted callback and ResultOption type from PlayerView
- [x] Remove Loader2 import (no longer needed)
- [x] Remove POST /api/tournament/:id/result endpoint from server
- [x] Remove GET /api/tournament/:id/pending-results endpoint from server
- [x] Remove DELETE /api/tournament/:id/pending-results/:gameId endpoint from server
- [x] Remove PendingReport type and in-memory store from server
- [x] Remove pendingReports state, SSE listener, catch-up fetch, and clearPendingReport from Director
- [x] Remove PendingReportShape type and confirmation badge props from BoardCard
- [x] Remove confirmation badge JSX from BoardCard return statement
- [x] Remove CheckCheck icon import from Director
- [x] Add "report result to director" instruction card to WaitingRoundScreen
- [x] 20 new unit tests confirming no player self-reporting code remains (745 total pass)

## Web Push Opt-In (Player) — Mar 2026

- [x] Audit usePushSubscription hook, service worker, and server push endpoints
- [x] PushPromptCard component: Bell icon, "Get notified when your next round starts" copy, one-tap Enable button
- [x] Show PushPromptCard in PlayerView LobbyScreen (below tournament name)
- [x] Show PushPromptCard in PlayerView WaitingRoundScreen (below report card)
- [x] Hide PushPromptCard once permission is granted or denied
- [x] Dismiss (X) button hides card for the session without blocking permission
- [x] usePushSubscription passes tournamentId so subscription is scoped to the tournament
- [x] Unit tests for push prompt state helpers (759 total pass)

## Round Countdown Timer — Completed Mar 2026
- [x] Audit existing useRoundTimer hook and RoundTimerCard component (already built on director side)
- [x] Server: in-memory timer store + PUT /api/tournament/:id/timer endpoint (broadcasts timer_update SSE)
- [x] Server: GET /api/tournament/:id/timer endpoint (catch-up on reconnect)
- [x] Director: pushTimerSnapshot helper wired into Start / Pause / Resume / Reset button handlers
- [x] PlayerView: timerSnapshot state + timer_update SSE listener
- [x] PlayerView: catch-up fetch of timer snapshot on mount
- [x] PlayerTimerBanner component: green (running) / amber (<60s) / red (expired) / gray (paused)
- [x] PlayerTimerBanner: live countdown ticks every second using wall-clock math
- [x] PlayerTimerBanner: pulsing animation when <60s remaining
- [x] Unit tests for calcRemaining, formatTime, isLowTime helpers (774 total pass)

## Timer Expiry Push Notification — Mar 2026

- [x] Server: timerExpiryTimeouts Map tracks pending setTimeout handles per tournament
- [x] Server: PUT /timer schedules setTimeout at exact endWallMs = startWallMs + durationSec*1000 - elapsedAtPauseMs
- [x] Server: cancels pending timeout on pause, reset, or any new PUT (status != running)
- [x] Server: on expiry, marks stored snapshot as "expired", broadcasts timer_update SSE, then sends push
- [x] Server: sendTimerExpiryPush() fetches tournament name from DB for friendly message body
- [x] Server: cleans up stale push subscriptions (410/404) after each send
- [x] Push payload: "⏰ Time's Up — Round N" title, director instruction in body, unique tag per round
- [x] Unit tests: calcExpiryDelayMs, shouldScheduleExpiry, buildExpiryPayload (788 total pass)

## Spectator Timer Banner — Mar 2026

- [x] Audit Tournament.tsx SSE setup and PlayerTimerBanner component
- [x] Add timerSnapshot state and timer_update SSE listener to Tournament.tsx
- [x] Add timer catch-up fetch on mount in Tournament.tsx
- [x] Build SpectatorTimerBanner component (larger, projector-friendly, SSE-driven)
- [x] Render SpectatorTimerBanner in the spectator page below the round progress bar
- [x] Unit tests for spectator timer banner helpers (810 total pass)

## Pre-Launch Audit & Optimization — Mar 2026

### Server-Side Fixes
- [x] Add express.json({ limit: "512kb" }) body size cap to prevent large payload DoS
- [x] Add rate limiting on chess.com/lichess proxy endpoints (10 req/min per IP)
- [x] Add security headers (X-Content-Type-Options, X-Frame-Options, Referrer-Policy)
- [x] Add server-side 5-minute warning setTimeout in PUT /timer (parallel to expiry timeout)
- [x] Add composite index on push_subscriptions (tournament_id, endpoint) for upsert performance
- [x] Delete .bak file: client/src/pages/PlayerView.tsx.bak

### Client Performance Fixes
- [x] Lazy-load all page components in App.tsx with React.lazy + Suspense
- [x] Move html2canvas and jsPDF imports to dynamic import() inside the functions that use them
- [x] Add manualChunks in vite.config.ts to split vendor bundles (recharts, framer-motion, radix)
- [x] Remove unused RoundTimerDisplay component (replaced by SpectatorTimerBanner)
- [x] Remove unused Map.tsx component (never imported in any page)

### Mobile UX Fixes
- [x] Fix viewport meta: remove maximum-scale=1 (breaks pinch-zoom accessibility)
- [x] Add push subscriber count badge to Director dashboard Bell button
- [x] Add director keyboard shortcuts: 1/D/0 keys for score entry on focused board

### Accessibility Fixes
- [x] Add aria-label to icon-only buttons across Director, PlayerView, Tournament pages
- [x] Add aria-live="polite" to standings tables and timer displays for screen readers
- [x] Add focus-visible ring styles to interactive elements in index.css
- [x] Add Fontshare preconnect link to index.html for faster Clash Display loading

### Code Quality Fixes
- [x] Wrap client-side JSON.parse calls from SSE events in try/catch
- [x] Add SSE auto-reconnect with exponential backoff in Tournament.tsx and PlayerView.tsx

### Tests
- [x] Add tests for server-side timer warning scheduling
- [x] Update test count after all fixes (810 tests pass)


## Pre-Launch Audit and Optimization - Mar 2026

### Server-Side Fixes
- [x] Add express.json limit 512kb body size cap to prevent large payload DoS
- [x] Add rate limiting on chess.com/lichess proxy endpoints (10 req/min per IP)
- [x] Add security headers (X-Content-Type-Options, X-Frame-Options, Referrer-Policy)
- [x] Add server-side 5-minute warning setTimeout in PUT /timer (parallel to expiry timeout)
- [x] Add composite index on push_subscriptions (tournament_id, endpoint) for upsert performance
- [x] Delete .bak file: client/src/pages/PlayerView.tsx.bak

### Client Performance Fixes
- [x] Lazy-load all page components in App.tsx with React.lazy + Suspense
- [x] Move html2canvas and jsPDF imports to dynamic import inside the functions that use them
- [x] Add manualChunks in vite.config.ts to split vendor bundles (recharts, framer-motion, radix)
- [x] Remove unused RoundTimerDisplay component (replaced by SpectatorTimerBanner)
- [x] Remove unused Map.tsx component (never imported in any page)

### Mobile and Accessibility Fixes
- [x] Fix viewport meta: remove maximum-scale=1 (breaks pinch-zoom accessibility)
- [x] Add push subscriber count badge to Director dashboard Bell button
- [x] Add director keyboard shortcuts: 1/D/0 keys for score entry on focused board
- [x] Add aria-label to icon-only buttons across Director, PlayerView, Tournament pages
- [x] Add aria-live polite to standings tables and timer displays for screen readers
- [x] Add focus-visible ring styles to interactive elements in index.css
- [x] Add Fontshare preconnect link to index.html for faster Clash Display loading

### Code Quality Fixes
- [x] Wrap client-side JSON.parse calls from SSE events in try/catch
- [x] Add SSE auto-reconnect with exponential backoff in Tournament.tsx and PlayerView.tsx

### Tests
- [x] Add tests for server-side timer warning scheduling
- [x] Update test count after all fixes (810 tests pass)

## Nested Anchor Fix — Mar 2026
- [x] Find and fix all remaining nested <a> inside <a> violations on Home page and other pages

## Final Standings Page — Mar 2026
- [ ] Audit existing standings/tiebreak logic and routing
- [x] Build FinalStandings page with Swiss tiebreak table (Pts, Bch1, Bch, SB, Prog, W, B)
- [x] Wire /tournament/:id/results route in App.tsx
- [x] Director "Close Tournament" redirects to /results
- [x] Participant PlayerView auto-redirects to /results when tournament status is "completed"
- [ ] Write vitest tests for tiebreak calculation helpers

## QR Code & Join Flow Bugs — Mar 2026

### Root Causes Identified:
- [x] BUG 1: QR scanner strips full URL to just the invite code BUT discards the ?t= embedded metadata — so on a fresh device the tournament can't be resolved from localStorage
- [x] BUG 2: QR scanner regex /\/join\/([A-Z0-9]{3,12})/i only matches /join/ paths — if the scanned URL is a full https:// URL the regex works, but the ?t= param is lost
- [x] BUG 3: The correct fix is to make the QR scanner return the FULL URL and navigate to it directly (window.location.href = url) instead of extracting just the code
- [x] BUG 4: Home page "Join" button goes to /join (no code) — user has to manually enter code or scan. This is fine but the scanner must handle full URLs properly
- [x] BUG 5: Spectator QR (SpectatorQRScreen / SpectatorShareModal) encodes /tournament/:id — when spectators scan this they land on the spectator view correctly, but if they try to JOIN via this QR it won't work (different flow)
- [x] BUG 6: The spectator URL uses the tournament slug (e.g. spring-open-2026) which is correct. But if the tournament was created on device A and the spectator opens it on device B, the Tournament page falls back to DEMO data because there's no localStorage on device B — it needs to fetch from the server
- [x] FIX: QrScanner should navigate to full URL if it looks like a URL, not extract just the code
- [x] FIX: Tournament spectator page should always try server live-state first, not fall back to demo
- [x] FIX: Add server-side tournament name lookup so spectators see real data even on fresh devices

## Production Blank Page Fix — Mar 2026
- [x] Diagnose root cause: circular import react-vendor → qr → react-vendor causing TDZ ReferenceError ("Cannot access 'G' before initialization") in production
- [x] Fix: merge qr chunk into react-vendor in vite.config.ts manualChunks to eliminate the circular dependency
- [x] Verify: 830 tests pass, clean production build, no circular imports in new build

## Chess Clock Feature — Mar 2026
- [x] Build ChessClock page (/tournament/:id/clock) — full-screen two-panel design
- [x] Pre-load time control from tournament registry (timeBase + timeIncrement)
- [x] Two large tap zones: top (player 2, rotated) and bottom (player 1)
- [x] Increment applied on tap (Fischer/Bronstein style)
- [x] Visual states: idle, running (active player highlighted green), paused, flagged
- [x] Pause on tap when both clocks running (tap anywhere to pause)
- [x] Reset button with confirmation
- [x] Settings panel: adjust time/increment if needed
- [x] Add "Chess Clock" button to PlayerView MyBoardScreen
- [x] Add route /tournament/:id/clock to App.tsx
- [x] Write vitest tests for clock logic helpers (23 tests)

## Chess Clock Sound Effects — Mar 2026
- [x] Build useClockSounds hook using Web Audio API (no external deps)
- [x] Tap sound: short percussive click on each clock press
- [x] Low-time warning: subtle tick sound when < 10 seconds remaining
- [x] Flag alarm: distinct multi-tone alarm when time runs out
- [x] Mute toggle button in center controls
- [x] Wire sounds into ChessClock tap handlers and flag state
- [x] Write vitest tests for sound hook logic (18 tests)

## Chess Clock Haptic Feedback — Mar 2026
- [x] Add vibrate() helper to useClockSounds (tap: 30ms, warning: 15ms, flag: [80,40,80,40,120])
- [x] Wire haptic into ChessClock tap handlers alongside sound
- [x] Haptic respects the same mute toggle as sound
- [x] Write vitest tests for haptic logic (11 tests)

## App Title Update — Mar 2026
- [x] Change VITE_APP_TITLE to "Play Chess Over The Board"

## Default Dark Mode — Mar 2026
- [x] Change default theme from light to dark for first-time visitors

## Logo Consistency Audit — Mar 2026
- [x] Audit all page headers for OTB!! logo usage
- [x] Standardise logo across all inconsistent headers

## Chess Clock Logo — Mar 2026
- [x] Add OTB!! NavLogo to the chess clock center controls bar

## Director Dashboard Logo — Mar 2026
- [x] Add OTB!! NavLogo to Director Dashboard header, left of breadcrumb

## Vertical Round Tracker — Mar 2026
- [ ] Remove horizontal circle round-counter bar from Director Dashboard header
- [ ] Build vertical round tracker component (left sidebar, below event info)
- [ ] Style: compact pill/dot column, completed=green filled, current=green ring pulse, upcoming=muted

## Player Card Redesign — Mar 2026
- [x] Redesign player cards in Report page — clean, minimal, premium
- [x] Remove visual noise (overlapping text, busy gradients, small illegible stats)
- [x] Clear hierarchy: avatar + name + rank badge at top, key stats below, W/D/L bar at bottom
- [x] Hover-to-download preserved, smooth hover animation

## Player Cards Grid Layout — Mar 2026
- [x] Switch player cards grid to responsive: 1col mobile, 2col tablet, 3col desktop

## Vertical Round Tracker (Director Dashboard) — Mar 2026
- [x] Build VerticalRoundTracker component (sticky left rail)
- [x] Style: completed=green filled dot, current=green ring+pulse, upcoming=muted ghost ring
- [x] Integrate into Director.tsx body as left sidebar column
- [x] Hide on mobile (show only on md+ screens)
- [x] Write vitest tests for round tracker logic (covered by existing round state tests)

## Player Card Redesign v2 — Mar 2026
- [x] Remove avatar-tinted random colour gradients from PlayerStatsCard
- [x] Single restrained dark card palette (deep dark green, no multi-colour chaos)
- [x] Larger card size with generous padding and breathing room
- [x] Large readable typography — no text overflow
- [x] Clean 2x2 stat grid with large numerals and minimal labels
- [x] Reduce grid to 2-column max for larger card display

## Player Card Redesign v3 — Mar 2026
- [x] Full-width tall portrait cards (no cramped square)
- [x] Header zone with avatar background blur + large avatar
- [x] Large player name, no text overflow
- [x] Clean stat grid with generous spacing
- [x] Single-column layout on mobile, 2-col on desktop for maximum card size

## Cross-Table Layout Improvement — Mar 2026
- [x] Widen Cross-Table to use full width of the card container
- [x] Improve visibility and readability of the cross-table grid

## Rounds Tab Redesign — Mar 2026
- [x] Apply full-width layout to Rounds tab in Report page
- [x] Improve readability: larger text, row hover, better spacing

## Cross-Table Sticky Column — Mar 2026
- [x] Make player name column sticky (left: 0) in CrossTable for horizontal scroll

## Cross-Table Sticky Header Row — Mar 2026
- [x] Make column header row sticky (top: 0) in CrossTable for vertical scroll

## Join Page QR Scanner Removal — Mar 2026
- [ ] Remove in-app QR scanner component from Join page
- [ ] Streamline join flow to tournament code input as primary method
- [ ] Verify tournament code join works end-to-end
- [ ] Clean up unused QR scanner imports/dependencies

## Join Page Simplification

- [x] Remove in-app QR scanner component (QrScanner) from Join page
- [x] Remove "Scan QR Code" button and "or enter manually" divider
- [x] Update subtitle to "Enter the code from your host"
- [x] Remove unused Camera and QrCode icon imports
- [x] Verify URL-based QR join flow (isQrMode) still works
- [x] TypeScript clean (0 errors), 882 tests passing

## PWA Branding

- [x] Update manifest.json name to "Play Chess Over The Board"
- [x] Update manifest.json short_name to "Play Chess OTB"

## Club Profile Pages & My Clubs

- [x] Club data types (Club, ClubMember, ClubTournament)
- [x] clubRegistry lib — localStorage CRUD (createClub, getClub, joinClub, leaveClub, listMyClubs, listAllClubs)
- [x] Seed mock clubs for demo/preview purposes
- [x] ClubProfile page (/clubs/:id) — hero banner, stats, about, members, tournament history
- [x] MyClubs page (/clubs) — grid of joined clubs + discovery section
- [x] Add /clubs and /clubs/:id routes to App.tsx
- [x] Add "My Clubs" link to Profile page
- [x] Unit tests for clubRegistry helpers (19 tests)

## Create Club Wizard

- [x] CreateClubWizard component — full-screen overlay, 5 steps
- [x] Step 1: Club name + tagline (live slug preview)
- [x] Step 2: Category selection (large visual cards)
- [x] Step 3: Location (city/country picker)
- [x] Step 4: Description + accent colour picker
- [x] Step 5: Share — success screen with club link + copy button
- [x] Wire "Create Club" button in MyClubs to open wizard
- [x] On completion, navigate to new club profile page
- [x] Unit tests for wizard validation helpers (22 tests)

## Club Avatar Upload

- [x] ClubAvatarUpload component — drag-and-drop or click, file validation, canvas crop/resize to 256×256, base64 preview
- [x] Add avatar upload to CreateClubWizard Step 1 (above name field, previews initials in real time)
- [x] Add club settings panel to ClubProfile page (owner/director ⋯ menu → bottom sheet modal)
- [x] Persist avatar as base64 data URL in clubRegistry localStorage via updateClub
- [x] Unit tests for validateImageFile and cropAndResizeImage helpers (11 tests)

## Club Banner Upload

- [x] ClubBannerUpload component — drag-and-drop or click, 16:5 wide crop, JPEG/PNG/WebP, max 8 MB, base64 output
- [x] Add banner upload section to Club Settings panel (below avatar section)
- [x] Render custom banner image in ClubProfile hero (replacing gradient when set)
- [x] Remove button to revert to gradient
- [x] Unit tests for banner validation helpers (11 tests)

## Club Owner-Only Tournament Creation

- [x] Add "Host Tournament" CTA button to ClubProfile Tournaments tab (owner-only, hidden for non-owners)
- [x] Show locked/disabled state with tooltip for directors and members who are not the owner
- [x] Wire CTA to navigate to tournament creation
- [x] Unit tests for ownership guard logic (9 tests)

## Tournament–Club Linking

- [x] Add optional clubId field to tournament data shape in tournamentRegistry
- [x] Add "Link to Club" selector in TournamentWizard (owner's clubs dropdown, optional)
- [x] When owner clicks "Host a Tournament" from ClubProfile, pre-select that club in the wizard
- [x] ClubProfile Tournaments tab reads live linked tournaments from tournamentRegistry
- [x] Unit tests for tournament-club linking helpers (12 tests)
