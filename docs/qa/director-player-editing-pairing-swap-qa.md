# Director Player Editing & Pairing Swap QA

## Scope

- Player name, active rating, alternate Chess.com rating retrieval, and manual pairing-rating override.
- Safe cross-board player swaps for an active round.
- Optimistic, revision-protected persistence through `PUT /api/tournament/:id/state`.

## Validation

- **Focused regression coverage:** 38 tests pass across Director modal logic, pairing helper logic, canonical tournament completion integration, and state persistence.
- **Persistence:** a rendered `useDirectorState` harness loads revision `7`, performs both a player edit and board swap, advances the debounce, and verifies one `PUT` payload containing both changes with `baseRevision: 7`.
- **Browser QA:** opened `/tournament/otb-demo-2026/manage`, then opened **Swap Pairings**. Confirmed the responsive overlay, search, player-row selection affordances, close/cancel controls, and disabled confirmation state before two players are selected.
- **Build:** production build passes.
- **Lint:** project lint passes with **0 errors** and 235 established warnings.
- **TypeScript:** passes with 0 errors.
- **Source review:** no emoji glyphs in the updated editor/swap components or their new tests.
- **Full Vitest baseline:** 7,112 passed, 2 skipped, and 30 unrelated legacy failures across 16 suites. The focused Director editing, modal, persistence, and tournament-status suites pass cleanly.

## Architecture decision

The implementation intentionally uses whole-state, revision-protected persistence rather than a competing targeted player PATCH endpoint. Both player edits and pairing swaps are durable after the standard debounce and retain the existing conflict-recovery behavior.
