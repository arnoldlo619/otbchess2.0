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
