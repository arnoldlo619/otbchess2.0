# Quads Live Repair — Executive Readout

## Decision

**Quads can now use a single section-aware standings projection across the repaired Director, public spectator snapshot, final results, Report, Print, and PDF export paths.** The critical section-ranking defect, stale completion banner, and ambiguous spectator route are addressed. The signed-host lifecycle and capacity policy are now server-enforced for modern wizard-created tournaments, while legacy local-only events retain a deliberately bounded compatibility path.

## What was repaired

| Area | Previous risk | Implemented correction |
|---|---|---|
| Standings authority | Multiple consumers recalculated or re-sorted Quads independently; public views could see no standings because the global Quads array is intentionally empty. | Added `shared/quadsProjection.ts` as the canonical, read-only section standings projection. The client Quads engine, public snapshot builder, Final Results, Report performance ranks, Print tables, and PDF export use its ordering. |
| Section-local results | A Quads competition could be visually represented as a tournament-wide ranking. | Public snapshots retain `standings: []` at the global Quads level and provide ordered rows only under `quadSections[].standings`. Final Results now renders one independent table and champion per section. |
| Legacy Quads data | Historical games may lack `sectionId`, which previously made repaired read models appear empty. | The projection only reconstructs a game when both players belong to the same persisted section; it never joins players across sections. |
| Completion integrity | The completed Director banner read stale flattened player points and falsely rendered all players as zero-point co-champions. | The banner now uses the canonical section projection and configured tiebreak order. Direct visual review confirmed one correct champion in each completed mock Quad. |
| Public route | Spectator sharing targeted `/tournament/:id`, which is a distinct participant dashboard route. | Director-generated spectator URLs now target the canonical server-backed `/live/:slug-or-id` route. |
| Registration and capacity | Browser-side state was the only practical gate for many registrations; capacity was not stored in the host registry. | Added nullable `user_tournaments.max_players`, persisted it from the Wizard, applied the safe migration, and serialised modern registrations behind the host record lock. Duplicate refreshes do not consume an extra place. |
| Lifecycle writes | Start, state persistence, and finalization could be triggered before durable status/snapshot updates. | Modern persisted tournaments now verify the owner for lifecycle commands. The start command writes state and registration status before broadcasting; the end command writes terminal state, status, cache invalidation, and revision before notifying observers. |
| Demo fallbacks | An unresolved real Director route fell back to the demo tournament state. | Unknown real IDs now render a neutral unresolved state while server hydration proceeds. |

## Quads operational contract

> A Quads tournament is a collection of independent sections. It has **section champions**, not a fabricated tournament-wide podium.

The canonical projection applies persisted `tiebreakOrder`, beginning with score and supporting direct encounter, Sonneborn-Berger, wins, Black games, and rating. It returns only section-local `finalRank` values. The server snapshot is the public read model; it is cache-invalidated after start and finalization.

## Validation record

| Check | Result |
|---|---|
| Canonical projection, client Quads engine, server snapshot, and consumer contracts | **180 passing focused tests** across 8 Quads and Final Results suites. |
| TypeScript | `pnpm exec tsc --noEmit` passed. |
| Production build | `pnpm build` passed. |
| Project lint | **0 errors**; legacy repository warnings remain. |
| Browser QA | Completed Quads Director mock reviewed directly. The section cards and corrected completion banner showed Danny Montenegro, Kevin Park, Priya Nair, and Raj Patel as the four correct 2½-point section champions. |
| Database migration | `user_tournaments.max_players` migration generated as `0018_yummy_nehzno.sql` and applied successfully. |

The full Vitest run currently reports 6,975 passing tests and 21 failures across 15 files. The Quads section-awareness failure introduced by the persisted-tiebreak refinement was repaired and passes in focused validation. The remaining failures are pre-existing source-contract/UI baseline debt, including the retired Wizard payment-toggle coverage; they are outside this Quads repair and should be handled as a separate CI-baseline cleanup task.

## Remaining operational limits

The repair does not retrospectively create server registry rows for anonymous legacy tournaments. Those events remain compatible through the legacy state fallback, but they do not gain the modern host-owner lifecycle policy or persisted capacity until migrated or recreated. There was no production database event supplied for end-to-end verification of owner authentication, concurrent final-slot registration, custom-slug spectator resolution, or final-result persistence; these flows are covered by code contracts and require a controlled production-like smoke event before announcing a broad Quads launch.

## Recommended next step

Run one controlled, signed-in Quads smoke tournament with eight players and two sections: fill one capacity slot concurrently from two mobile devices, start, enter all results, verify `/live/:slug`, reload Final Results/Report/Print from a fresh browser profile, generate the PDF, and confirm post-finalization QR registration returns `registration_closed`. Capture the resulting event ID and screenshots as the launch acceptance record.
