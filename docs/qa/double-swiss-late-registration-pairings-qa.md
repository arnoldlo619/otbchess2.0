# Double Swiss late-registration pairing QA

## Scope

Resolve the Round 1 Double Swiss failure where adding a walk-in rebuilt each game independently, splitting Game A and Game B across different board numbers. The Director then saw only stray or bye board rows instead of reportable two-game matchups.

## Implementation checks

- Late registration now uses `generateDoubleSwissPairings` for Double Swiss, rather than the single-game Swiss generator.
- Refresh board numbers are remapped per source board, keeping color-swapped Game A and Game B on the same card.
- A Double Swiss board with either game already reported is treated as one locked mini-match; both games remain intact.
- Unreported automatic byes remain eligible to refresh when a later walk-in creates a possible pairing.
- The transition is computed from a current state snapshot and committed atomically, so the add-player feedback matches the persisted board state on consecutive walk-ins.
- The Round 1 status band clarifies that unreported boards refresh while reported boards remain intact.

## Automated validation

- Focused Director/Double Swiss suite: **21 passed / 4 files**.
  - Consecutive walk-ins preserve reportable two-game boards.
  - A partially reported Double Swiss board preserves both color games.
  - Consecutive walk-in success feedback remains accurate.
  - Existing Double Swiss pairing, one-round correction, and persistence suites remain green.
- TypeScript: `pnpm exec tsc --noEmit` passed.
- Changed-file ESLint: **0 errors**; one established `no-explicit-any` warning remains in `directorState.ts` outside this change.
- `git diff --check` passed.

## Browser QA

Using a seeded 8-player Round 1 Double Swiss state in the Director dashboard:

1. Added **Walk-in Nine** through the actual manual Add Player modal.
   - The Director received the expected bye feedback.
   - The dashboard retained four `2× Games` board cards plus one bye row.
2. Added **Walk-in Ten** through the same modal.
   - The Director received **“paired with QA Player 5 on Board 5”** feedback.
   - The dashboard rendered **five `2× Games` board cards**, with both Game A and Game B available on every board.
   - No board assignments disappeared, and the updated status copy remained legible in the Round 1 control band.

## Release validation

`pnpm lint` completed with **0 errors and 233 established warnings**. The production build completed successfully, and the Director routes for the demo manager, public tournament, and access page each returned HTTP 200.

The full Vitest baseline completed with **7,256 passed, 2 skipped, and 28 known unrelated failures in 19 legacy suites**. The new late-registration suite and all affected Double Swiss, prior-round correction, Director lookup, and state-persistence suites passed.
