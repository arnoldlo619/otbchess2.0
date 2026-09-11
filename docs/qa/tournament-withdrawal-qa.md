# Tournament Withdrawal QA

## Initial safe-demo review

The built-in Director demo was available after the withdrawal feature restart, but it loads a completed Quads scenario. Withdrawal is intentionally unavailable for Quads because all round pairings are preconstructed. No tournament data was changed during this review. Standard Swiss and Double Swiss lifecycle coverage is verified through the pairing-engine regression suite; active-format visual verification remains in progress.

## Responsive safe-demo review

Fresh desktop and 375px preview sessions rendered the standard Swiss Director dashboard cleanly after the lifecycle change. The demo’s Home tab shows active round pairings but does not expose a disposable registration or Player-tab action sequence in automated preview, so it could not safely exercise the withdrawal confirmation in-browser. Direct hook tests cover persisted withdrawal and reinstatement; pure pairing tests cover the actual standard Swiss and Double Swiss future-round exclusion contract. No live or demo results were modified.

## Lifecycle and pairing validation

The new Director state-hook coverage verifies that withdrawal persists the player record and its historical points, and that reinstatement restores future-round eligibility. Swiss lifecycle coverage verifies a withdrawn player is absent from the next generated round while their completed-round score remains in standings. Double Swiss coverage verifies the player is absent from both color-swapped games for every later board. The withdrawal control is restricted to Swiss, Double Swiss, and the Swiss phase of Swiss-elimination events; it is intentionally unavailable for Quads, round-robin, and active elimination brackets where future pairings are prebuilt. If the player’s current board is still open, the confirmation dialog warns the director to resolve that result before advancing the round.

Focused coverage passed (64 tests), TypeScript passed, and changed-file lint reported no errors. Project lint reported 0 errors with the established warning baseline. The full suite reports 6,933 passing tests and 13 unrelated existing failures in three source-contract files: accessibility overlay coverage, form-label semantics, and the removed Wizard payment-toggle layout.
