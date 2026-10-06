# Swiss Elimination Player Bracket Transition — QA

**Scope:** Player-facing tournament live page (`/tournament/:id`) when a Swiss + elimination event moves from its Swiss phase to the generated elimination bracket.

## Product behavior

- A connected player is moved to the mobile **Bracket** tab when the authoritative state reaches `elimPhase: "elimination"` with advancing players.
- A player who opens the event after the bracket is already live receives the same bracket-first handoff.
- Legacy `cutoff → elimination` transitions remain supported.
- The handoff occurs once per page session, preserving a player’s subsequent manual tab selection.
- Desktop users are scrolled to the existing bracket region; no separate route or duplicated bracket UI is introduced.
- Non-Swiss-elimination events and incomplete bracket payloads do not trigger the handoff.

## Implementation

- Extracted the eligibility decision to `client/src/lib/swissEliminationNavigation.ts` so the player-facing state transition is deterministic and directly testable.
- `Tournament.tsx` continues to consume the server/SSE lifecycle, switches the mobile tab, and scrolls desktop users to the existing bracket anchor.
- Removed the transition toast’s sword emoji and replaced standings podium emoji markers with restrained numbered ranks (`#1`, `#2`, `#3`) while preserving rank color hierarchy.

## Validation

- Focused Vitest: **64 passed** across Swiss elimination transition, automatic bracket generation, and public bracket rendering.
- TypeScript: `pnpm exec tsc --noEmit` completed with **0 errors**.
- Changed-file ESLint completed with **0 errors**; established `Tournament.tsx` warnings remain limited to existing complex hook dependencies and explicit `any` usages.
- Project lint: **0 errors**, with 234 pre-existing warnings across the broader codebase.
- Production build completed successfully. The live Tournament route returned HTTP **200** locally and through the public sandbox preview.
- Full Vitest baseline: **7,122 passed, 2 skipped, 30 unrelated legacy failures across 16 suites**. The Swiss-elimination transition suites all pass.
- Diff integrity: `git diff --check` passes.

## Regression coverage

`tests/swiss-elimination-bracket-transition.test.ts` covers:

1. Live Swiss-to-elimination handoff.
2. Late-joining player handoff.
3. Legacy cutoff transition.
4. Missing advancing roster guard.
5. One-time switch guard.
6. Non-Swiss-elimination exclusion.
