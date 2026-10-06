# Club Tournament Leaderboard — Implementation Plan

**Status:** Proposed; no leaderboard code or data has been changed in this planning pass.

## Objective

Replace the unused **Battles** workflow in the Club Members area with one primary **Leaderboard** tab. The leaderboard ranks current club members by their cumulative **tournament points** from completed tournaments linked to that club.

> A player who scores 2.0 points in a completed Club tournament receives **+2.0 Club Ranking points**. Draws therefore contribute 0.5, consistent with the tournament standings already used by directors.

The final Members navigation becomes:

1. Members
2. Leaderboard
3. Attendance

There is no nested Battles/Leaderboard switch and no manual “Record” action.

---

## Audit findings

| Area | Current behavior | Implication |
|---|---|---|
| Members UI | The Battles tab contains a nested `Leaderboard / Battles / + Record` control. | It is redundant and should be replaced, not relabeled. |
| Battle records | Existing Battle APIs store manual 1v1 outcomes. | They are unrelated to tournament standings and must not affect Club rankings. |
| Tournament results | Final player `points`, `wins`, `draws`, and `losses` are already maintained in the persisted Director state. | The authoritative scoring source already exists. |
| Club linkage | Server-backed `club_events.tournament_id` links a Club tournament to its Club. | This is the authoritative Club-to-tournament join; `user_tournaments` has no persisted `club_id` column. |
| Identity | Tournament players are keyed by normalized chess.com username; Club members may have `chesscom_username`. | Automatic ranking can safely match on normalized chess.com username; players without a Club username cannot be credited automatically. |
| Existing data | The database has multiple Club-linked tournaments with `completed` Director state. | A safe one-time backfill can seed rankings for historical completed Club tournaments. |

### Critical correction

The leaderboard must **not** derive Club ownership from `user_tournaments`. It must join completed tournament state through the canonical `club_events.tournament_id` record. This preserves the private Club boundary and works for all Club-created tournaments.

---

## Recommended data model

Use an **immutable per-tournament score ledger** rather than a mutable `totalWins` column.

### New table: `club_tournament_score_entries`

One row per eligible Club member per completed Club tournament.

| Field | Purpose |
|---|---|
| `id` | Primary key |
| `club_id` | Ranking scope |
| `tournament_id` | Tournament source; part of uniqueness constraint |
| `club_member_user_id` | Current Club member account receiving the credit |
| `chesscom_username` | Normalized identity snapshot used for matching/audit |
| `player_name` / `avatar_url` | Display snapshot for historical integrity |
| `points` | Final tournament points, stored as decimal-safe numeric string/value |
| `wins`, `draws`, `losses` | Supporting stat snapshots, not the ranking metric |
| `final_rank` | Tournament placement snapshot |
| `finalized_at` | Time the tournament result was materialized |
| `created_at`, `updated_at` | Audit fields |

**Constraints and indexes**

- Unique `(club_id, tournament_id, club_member_user_id)` — makes finalization and backfill idempotent.
- Index `(club_id, points)` — supports aggregate leaderboard reads.
- Index `(tournament_id)` — supports repair/rebuild for one tournament.

### Why a ledger, not an aggregate

- Safe retries: tournament finalization can run more than once without double-counting.
- Correct corrections: a director can repair final results and regenerate only that tournament’s rows.
- Auditable: every leaderboard total has a transparent event source.
- Future-ready: season filters and tournament history require no destructive data migration.

The displayed total is computed server-side as `SUM(points)` for the Club, with `SUM(wins)` available as supporting context. **Points are the ranking source of truth.**

---

## Identity and eligibility rules

1. A tournament must have a canonical Club Event with `eventType === "tournament"` and a matching `tournamentId`.
2. Its persisted Director state must be `completed`.
3. The player’s normalized chess.com username must match a current `club_members.chesscom_username` within that Club.
4. Only matched active Club members receive Club Ranking points.
5. Players without a chess.com username match are excluded rather than guessed by display name.
6. A player who later leaves the Club is hidden from the default current-members leaderboard but their ledger entry remains for auditing; an owner-only historical endpoint can retain the full record if needed.
7. Bye points follow the already-finalized tournament standings exactly; the leaderboard does not independently recalculate game outcomes.

### Identity recovery UX

If a member has no chess.com username on file, show a quiet, non-blocking message in the empty/eligibility state:

> Add your Chess.com username to be credited automatically for Club tournament results.

Do **not** invent a manual score-entry tool. Any identity correction should be an owner/director action to link the member’s verified chess.com username, after which the server can run a safe recompute for affected completed tournaments.

---

## Server lifecycle

### 1. Finalize a tournament

At the same authoritative point where the Director workflow successfully persists the completed state:

1. Persist completed Director state with the normal revision guard.
2. Resolve the unique `club_events` record by `tournament_id`.
3. If no Club Event exists, do nothing; standalone tournaments do not alter Club rankings.
4. Parse final standings from the just-persisted state.
5. Normalize player usernames and match them to Club member usernames.
6. In one transaction, upsert that tournament’s ledger rows.
7. Return success only after leaderboard materialization succeeds, or queue/retry a recoverable reconciliation job while making the failure observable to the director.

### 2. Correct final results

Any authorized final-score correction must call a single `rebuildClubTournamentScores(tournamentId)` service that:

- deletes/replaces only rows for that Club + tournament,
- rebuilds from the latest finalized state,
- never increments an aggregate directly.

### 3. Historical backfill

Migration/reconciliation script:

- Find every `club_events` row with a `tournament_id`.
- Read only tournament states marked `completed`.
- Reuse the same materialization service.
- Report counts: scanned tournaments, completed sources, entries created/updated, unmatched players, skipped malformed states.
- Run idempotently in dry-run mode first, then once in production.

No fabricated ranking data and no mutation of tournament results.

---

## API contract

### Member-visible leaderboard

`GET /api/clubs/:clubId/leaderboard`

- `authMiddleware` + Club membership authorization.
- Returns current active Club members only, sorted by:
  1. `totalPoints DESC`
  2. `totalWins DESC`
  3. `latestEarnedAt DESC`
  4. normalized display name ascending
- Uses competition ranking: equal totals share a rank and the following rank skips appropriately.
- Payload includes `rank`, `memberUserId`, display name/avatar, `totalPoints`, `totalWins`, `tournamentsPlayed`, and `latestEarnedAt`.

### Owner/director reconciliation

`POST /api/clubs/:clubId/leaderboard/reconcile`

- `requireFullAuth` and Club owner/director authorization.
- Rebuilds a requested completed tournament or all completed Club tournaments.
- Returns exact reconciliation summary; no client-provided points accepted.

### Optional member history

`GET /api/clubs/:clubId/leaderboard/:memberUserId/history`

- Member-only Club authorization; only the requester or Club owner/director may inspect a member’s detailed history.
- Returns the tournament source and points for transparency.

---

## UI plan

### Members sub-navigation

Replace the current `Members | Battles | Attendance` tabs with:

- **Members** — unchanged roster and invitation flow.
- **Leaderboard** — the only tournament-ranking surface.
- **Attendance** — unchanged.

Remove all Battle-specific controls, copy, empty states, registry/API calls, and “Record” action from this workspace.

### Leaderboard composition

- Compact header: **Club Rankings** and `Tournament points from completed Club events`.
- Summary strip: `Players ranked`, `Completed tournaments counted`, and a `How points work` disclosure.
- Top three: restrained ranked rows, not novelty podium art.
- Remaining entries: responsive list/table with rank, player identity, `points`, `wins`, and tournaments played.
- Current viewer: subtle “You” marker only when present.
- Empty state: explains that standings appear after a completed Club tournament; no dead CTA.
- Missing-identity note: only to the affected logged-in member, never exposed publicly.

Use existing ChessOTB green surfaces, Lucide SVG icons, 44px touch targets, focus rings, light/dark contrast, and reduced-motion-respecting transitions. Do not use emoji or a gold/podium visual trope.

---

## Delivery sequence

| Phase | Scope | Acceptance criteria |
|---|---|---|
| 1 | Retire Battles from Club Members UI | Exactly three primary tabs; no nested Battle controls or manual record path remains. |
| 2 | Add score ledger and materialization service | Idempotent transaction; no client can submit points. |
| 3 | Wire finalization and correction lifecycle | A completed linked tournament writes one score entry per eligible member; repeat finalization does not double count. |
| 4 | Backfill completed linked tournaments | Dry run is reviewed; live run reports entries and unmatched usernames. |
| 5 | Add leaderboard API and responsive UI | Active members see rank, total points, wins, and tournament count; private Club access is preserved. |
| 6 | QA and safeguards | Unit/API/UI tests, authorization tests, correction/rebuild tests, desktop/mobile/light/dark visual QA, migration verification. |

---

## Test matrix

- One win adds **1.0** point; a draw adds **0.5**; a 2-point finish adds exactly **+2.0**.
- A completed tournament finalized twice does not double-count.
- Editing final results replaces the tournament ledger snapshot instead of accumulating stale points.
- Standalone and unlinked tournaments never affect a Club leaderboard.
- Players without a matching Club chess.com username are excluded and surfaced in reconciliation diagnostics.
- A member cannot read another private Club’s leaderboard or trigger reconciliation.
- Owner/director can reconcile; ordinary members cannot.
- Equal totals receive deterministic competition ranks and stable secondary ordering.
- Departed members do not remain in the default active roster but historical ledger is preserved.
- Member tab shows only `Members`, `Leaderboard`, and `Attendance` at desktop and mobile widths.

---

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Some Club members lack a saved chess.com username. | Never guess by name; show an attribution prompt and report unmatched players to organizers. |
| Historical Club events are not linked canonically. | Reuse the existing idempotent Club Event backfill before leaderboard reconciliation. |
| A director changes results after completion. | Rebuild a single immutable tournament ledger slice, never mutate a global counter. |
| Finalization network retry. | Unique ledger constraint and transactional upsert make the operation safe to repeat. |
| Old Battle routes/data remain elsewhere. | First delivery removes the Members workspace integration only; a follow-up cleanup can retire battle infrastructure after confirming there are no other product consumers. |

## Recommended first release boundary

Ship **automatic points totals for completed, linked Club tournaments**, backed by the immutable ledger and username matching. Do not include manual adjustments, seasonal awards, Battle results, or cross-Club leaderboards in v1. This is the smallest reliable end-to-end release and matches the requested scoring model exactly.
