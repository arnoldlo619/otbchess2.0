# Remaining Quads Audit Items

## Phase 4 — Director UX Refinement (partially done)

### Already completed:
- Cross-table view added (Matrix tab)
- Mobile UX improvements (touch targets, typography, contrast)
- Auto-advance to next pending match after result entry

### Still needed:
1. **Auto-focus current round** — when advancing rounds, auto-select new round tab, scroll workspace into view
2. **Quads summary header** — show "QUADS · [SECTION COUNT] · [PLAYER COUNT] PLAYERS · 3 ROUNDS · [TIME CONTROL]" instead of Swiss-style header
3. **Completion design** — each quad card shows all 4 players with rank, name, rating, score, W/D/L, tiebreak applied, champion status
4. **Celebration behavior** — keep brief, respect prefers-reduced-motion, only trigger after finalization not on load
5. **Roster accessibility** — check-in controls with accessible names, 44px targets (already done in mobile pass)
6. **Divisible-by-4 blocking message** — show "Quads requires complete groups of four. Add or remove [N] player(s)" if not divisible by 4

## Phase 5 — Performance

Key items:
- Route-level code splitting (React.lazy for Director, TournamentWizard, LeagueDashboard, etc.)
- Skeleton loading states instead of blank "Loading" screens
- Memoized Quads standings/pairing calculations (useMemo already used in QuadsDirectorPanel)
- Cached Chess.com profile responses with TTL (sessionStorage already used)
- Nonzero cached/fallback landing statistics (prevent 0+ flash)

## Phase 6 — Automated Testing

Unit tests needed:
- Unicode-safe tournament serialization (encodeMetaParam/decodeMetaParam)
- Fractional score formatting
- Draw-rate calculation
- Direct-encounter tiebreak
- Sonneborn-Berger calculation
- Co-champion fallback
- Tournament-state transitions (canStart with 4 players for quads)

Pairing tests for 4, 8, 16 players:
- Exactly 3 rounds
- Every player plays once per round
- Every player faces all 3 section opponents
- No duplicate opponents
- No self-pairings
- Balanced colors

## Phase 7 — Final Verification
- TypeScript: 0 errors
- All tests pass
- Checkpoint saved
