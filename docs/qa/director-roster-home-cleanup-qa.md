# Director Roster Home Cleanup QA

The stale visual-edit targets were manually located in the Home registration footer rather than at their obsolete JSX locations. That footer contained the `Walk-in name` control, a duplicate `Add Player` action, and the `Add players to start` disabled start state. The edit removes the entire footer and places the functional walk-in check-in action in the registration-only Players tab, where manual add and RSVP import actions already live.

A sandbox Director route without a valid code redirected to Director Access as designed. The local demo route retained a previously loaded completed Quads mock state, which does not render the registration-only control. Direct browser verification of the new registration state therefore requires resetting the sandbox demo state; source contracts and focused behavior tests cover the relocated control in the meantime.

After clearing the prior mock state, the demo route correctly restored its normal in-progress tournament. Because the built-in demo starts in Round 5, it still cannot exercise the registration-only walk-in form without a temporary sandbox-only persisted state.

## Direct visual verification

A temporary sandbox-only registration state confirmed the Home tab now contains only the compact Check-In Roster empty state, with no walk-in input, manual-add CTA, bracket assignment prompt, or disabled `Add players to start` copy. The Players tab renders the replacement **Check in a walk-in** surface above the roster toolbar, alongside the existing Upload RSVPs and Add Player actions. It has a visible labeled helper, a 44px name input, and a 44px Check in button in the same responsive row.

The relocated control was exercised through its Enter-key path with a temporary `QA Walk-In` player. The player appeared in the Players roster, received the success announcement, and was automatically checked in. Returning to Home showed the clean read-and-manage Check-In Roster with the new checked-in player, while enrollment controls remained absent.

## Validation

| Check | Result |
|---|---|
| Focused Director regression tests | Passed: 92 tests across console, editing, and scoring suites. |
| TypeScript | Passed: `pnpm exec tsc --noEmit`. |
| Changed-file lint | Passed with 0 errors; six existing Director warnings remain unchanged. |
| Project lint | Passed with 0 errors; 236 pre-existing repository warnings remain. |
| Diff integrity | Passed: `git diff --check`. |
| Full Vitest suite | 6,977 passing, 2 skipped, 20 established failures in unrelated baseline source-contract/UI suites, including retired Wizard payment-toggle coverage. No Director roster cleanup failure was reported. |
| Browser QA | Confirmed Home cleanup, Players placement, and an Enter-key walk-in registration/check-in in a sandbox-only registration state. |
