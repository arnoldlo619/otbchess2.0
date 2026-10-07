# Full Season League QA

## Scope

Implemented a durable **Full Season League** format as the default Club League experience while retaining Classic Round Robin for legacy/simple seasons.

## Functional contract

- Creation supports `Full Season League` (recommended) and `Classic Round Robin`.
- Full Season rosters are constrained to **even 4–28 player** fields.
- Structure is calculated from the selected roster size: `N - 1` opponents, two color-reversed games per opponent, weekly Match Sets of up to three opponents, and recommended 5/7/9 regular-season weeks for 16/20/28 players.
- The roster locks on season start. A complete circle factorization guarantees every pair meets once; weekly selection uses whole unscheduled rounds and current standings to choose competitive Match Sets without duplicate encounters.
- Each encounter is two games. Game points use 1 / ½ / 0; encounter Season Points use 1 / ½ / 0; League Rating updates once only when the encounter resolves.
- Standings follow: Season Points → Game Points → head-to-head encounter → Sonneborn-Berger → matchup wins → League Rating → original seed.
- Top 4/6/8/12 qualify for Championship Day. Top 6 grants seeds 1–2 a bye. Playoff sets use rapid, then blitz, then Armageddon only if needed.

## Durability and security

- Added `league_encounters`, `league_playoff_matches`, and `league_playoff_games`, plus Full Season league/player/standing/week fields in migration `0027_curved_nightshade.sql`.
- Verified the active database contains all three tables, **9/9** required `leagues` columns, and **5/5** required `league_standings` columns.
- Lifecycle APIs require an organizer role for publishing/starting Match Sets and Championship Day result reporting. Match reporting is validated against membership, week state, and persisted player identities.
- No real League, tournament, or player data was inserted for QA.

## Client UX verification

- Club Dashboard’s **New League** action now opens the shared creation wizard; legacy Club Profile triggers route to the same wizard.
- Full Season dashboard renders a phase-aware overview, grouped Match Sets (rather than one large game list), per-game reports, encounter result/Season Point summaries, responsive standings, and Championship Day bracket state.
- Desktop and 390px mobile visual QA confirmed the shared wizard’s fixed overlay, step indicator, empty eligible-club state, and disabled Continue state. Full-page screenshots intentionally omit fixed overlays, so viewport capture was used.
- Local route health: `/league/new`, `/league-demo`, and `/clubs/demo?tab=leagues` each returned **200**.

## Automated validation

| Check | Result |
|---|---:|
| Full Season rules, coverage, scoring, rating, and bracket tests | 10 passed |
| Full Season lifecycle/API/UI source-contract tests | 5 passed |
| League creation wizard regressions | 19 passed |
| Club League navigation / Events workspace regressions | 10 passed |
| TypeScript (`pnpm exec tsc --noEmit`) | passed |
| Production build (`pnpm run build`) | passed |
| Diff integrity (`git diff --check`) | passed |
| Full Vitest baseline | 7,145 passed, 2 skipped; 27 unrelated legacy failures across 18 suites |

## Remaining validation boundary

No authenticated club in the sandbox was used to create or run a live season. The durable schema, lifecycle endpoint contracts, pure scheduling/scoring rules, dashboard composition, and unauthenticated responsive creator state are covered; a final production smoke test should create a short 4- or 6-player Full Season League and report one two-game encounter. The full-suite failures are outside this scope; the newly surfaced Tournament Wizard payment-toggle source-contract failure is unchanged from checkpoint `c8a75ec8`.
