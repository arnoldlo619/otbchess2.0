# Phase 5 Audit — Architecture Plan

## Existing Pages & Routes

| Route | File | Lines | Purpose |
|---|---|---|---|
| /clubs | MyClubs.tsx | 1338 | Clubs discovery + my clubs |
| /clubs/:id | ClubProfile.tsx | 5521 | Public club profile (massive) |
| /clubs/:id/home | ClubDashboard.tsx | 8064 | Club owner workspace |
| /clubs/:id/manage | ClubManage.tsx | 488 | Club settings redirect |
| /league | LeagueOverview.tsx | ? | League overview |
| /league/:leagueId | LeagueDashboard.tsx | 4368 | League dashboard |
| /league-demo | LeagueDemo.tsx | 1171 | League demo |
| /training | Training.tsx | 371 | Tools hub |
| /openings | OpeningsLibrary.tsx | 814 | Openings library |
| /prep | MatchupPrep.tsx | 2534 | Matchup prep |
| /repertoire | RepertoireList.tsx | 674 | Repertoire list |

## Design System Tokens (from index.css)

### Light Mode
- Page BG: #FBFADA (nature cream-white) — `--otb-surface-page`
- Card: #F0F5E8 (sage-tinted cream) — `--otb-surface-card`
- Elevated: slightly lighter — `--otb-surface-elevated`
- Text Primary: #12372A (dark forest) — `--otb-text-primary`
- Text Secondary: medium forest — `--otb-text-secondary`
- Text Muted: #436850 (forest) — `--otb-text-muted`
- Border: sage green 50% — `--otb-border`
- Accent: #436850 forest green — `--otb-accent`
- Primary: #436850 (forest green) — `--chess-green`
- Chess Green Dark: #12372A — `--chess-green-dark`
- Chess Green Light: #ADBC9F (sage) — `--chess-green-light`

### Dark Mode
- Page BG: deep forest green — `--otb-surface-page`
- Card: slightly lighter — `--otb-surface-card`
- Elevated: even lighter — `--otb-surface-elevated`
- Text Primary: near-white cream — `--otb-text-primary`

## Key Components Available
- FeaturedClubsCarousel
- CreateClubWizard
- CreateClubAuthGate
- ClubAvatarUpload, ClubBannerUpload, ClubBackgroundPicker
- ClubSettingsPanel, ClubShareModal, EditClubDetailsModal
- CreateLeagueWizard
- AppNavBar
- NavLogo
- AvatarNavDropdown

## Phase 5 Strategy

### A. Clubs Discovery (/clubs)
- Rewrite MyClubs.tsx with single unified search/filter bar
- URL-encoded search params
- Filters: country, type, sort, verified
- Mobile filter drawer
- Consistent card aspect ratios
- Virtualized list for 100+ clubs

### B. Public Club Profile (/clubs/:id)
- Refactor ClubProfile.tsx (5521 lines) into tabbed layout
- Tabs: Home, Feed, Events, Tournaments, League, Members, About
- Clean hero/banner that doesn't collide with nav
- Public vs owner action separation
- Mobile tab scroll

### C. Club Owner Workspace (/clubs/:id/home)
- Refactor ClubDashboard.tsx (8064 lines) into app shell with sidebar
- Dashboard hierarchy: status → upcoming → tasks → activity → growth
- Not equally-weighted metric cards

### D. Club Feed
- Improve post hierarchy, author identity, media, polls, composer
- Already part of ClubProfile/ClubDashboard

### E. Club Creation
- CreateClubWizard already exists — enhance with progressive flow
- Slug preview, duplicate feedback, image crop, success state

### F. League Dashboard
- Refactor LeagueDashboard.tsx (4368 lines)
- Fix nested scrollbars, cramped panels, tiny text
- Main + side panel desktop, stacked mobile

### G. League Standings
- Semantic responsive table with mobile card format
- Scoring explanation, movement indicators

### H. Matchups, Schedule, History
- Matchup cards with board, players, ratings, color, status
- Week grouping, current week highlight

### I. Tools Hub (/training)
- Redesign Training.tsx (371 lines) as curated workspace
- Bento grid with proper hierarchy
- Tool cards: what, who, input, outcome, status

### J. Openings Library
- Migrate to design system, both themes
- Search, filters, white/black groups, difficulty

### K. Matchup Prep
- Coherent workspace: input → loading → report
- Evidence and limitations clearly communicated

### L. Repertoire & Video Entry Points
- Shared app shell, tool identity, navigation

## Implementation Order
1. Start with smallest/highest-impact: Tools Hub (371 lines)
2. Clubs Discovery (1338 lines)
3. League Dashboard (4368 lines) — fix scrollbars, standings
4. Public Club Profile (5521 lines) — tab refactor
5. Club Owner Workspace (8064 lines) — app shell
6. Openings Library, Matchup Prep, Feed, Creation
