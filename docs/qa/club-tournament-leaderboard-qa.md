# Club Tournament Leaderboard QA

**Scope:** Replace the Club Members **Battles** workflow with a tournament-results leaderboard. Completed, Club-linked tournaments contribute their final player points to a durable per-tournament ledger.

## Delivered behavior

- Members navigation now has only **Members**, **Leaderboard**, and owner/director-only **Attendance**.
- The legacy nested `Leaderboard / Battles / + Record` controls and manual battle-recording path are removed from the Members workspace.
- Finalizing a Club-linked tournament calls the ledger materializer after the authoritative completed state is saved.
- Each materialization replaces that tournament's ledger slice in a transaction, making retries and later result corrections idempotent rather than additive.
- Eligible players are matched only by normalized Club Chess.com usernames. Unmatched players are excluded and surfaced to organizers when they refresh results.
- The member leaderboard aggregates active Club members by final **points** first, then wins, most recent earned date, and display name. Equal totals receive competition ranks.
- Members can read private Club standings; only Club owners/directors can reconcile completed tournament results.

## Database verification

- Applied migration: `0025_club_tournament_score_ledger.sql`.
- Verified `club_tournament_score_entries` exists with the primary key, Club-points index, unique Club/tournament/member index, tournament index, and member index.
- Current verification found no fabricated ledger rows; actual entries will be created only after linked Club tournaments complete or an authorized organizer runs reconciliation.
- `pnpm db:migrate` remains blocked by the repository's pre-existing migration-ledger drift at the already-existing `push_subscriptions` table. The leaderboard migration itself was applied and verified via the managed database query path.

## Automated coverage

Focused suite: **59 passing tests across 6 files**

- Ledger materialization writes only matched members, reports unmatched players, and replaces the prior tournament slice.
- Standalone/unlinked tournaments are skipped.
- Aggregation preserves points, tie-breaks, competition ranks, current-member filtering, and viewer labeling.
- Leaderboard component verifies loaded, loading, empty, and organizer-refresh states.
- Source contracts cover private APIs, owner/director reconciliation, no client-provided points, finalization wiring, extracted Feed composer header action, and removal of the Members Battle subtab.
- Existing Club leaderboard and canonical tournament lifecycle coverage remains green.

## Visual QA

Rendered isolated, production-component previews at **1440×960** and **375×812** in both dark and light appearance:

- Desktop: compact three-tab Members navigation, restrained summary strip, readable tabular standings, and one secondary refresh control.
- Mobile: summary cards stack without overflow; secondary table columns collapse into the player subline; rank, player, and points stay visible and legible.
- Light/dark: contrast and green accent remain clear; no emoji or novelty podium treatment is used.

## Validation commands

- `pnpm vitest run tests/club-tournament-leaderboard-service.test.ts tests/club-tournament-leaderboard-ui.test.tsx tests/club-tournament-leaderboard-contract.test.ts client/src/__tests__/clubLeaderboard.test.ts client/src/__tests__/canonicalTournamentStatusIntegration.test.ts`
- `pnpm exec tsc --noEmit`
- Changed-file ESLint: 0 errors; established repository warnings remain in `ClubDashboard.tsx` and `server/clubs.ts`.
- `pnpm lint`: 0 errors, 235 established warnings.
- `pnpm run build`: passed.
- The full Vitest run before the stale workspace-header source contract was corrected reported 31 pre-existing unrelated failures across 17 files. The corrected workspace-header contract and all leaderboard-related suites pass in the final focused run.
