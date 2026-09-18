# QR Join Manual ELO Opt-In QA

## Scope and Design

The QR Join enrollment form no longer displays the manual pairing-rating field by default. Players instead see a compact, touch-safe checkbox labelled **I don't have a Chess.com username** beneath the normal Chess.com lookup field. Selecting the checkbox clears any entered provider username, hides the provider field, and reveals a labelled, numeric **Your ELO rating** field. Clearing the checkbox restores the normal provider-lookup path and clears the manually entered rating.

The manual path requires a whole-number rating from 100 through 3500, retains the existing paired-registration safeguards, and marks the submitted player with `ratingSource: "manual"`. A readable generated roster handle allows a no-account player to join without pretending to own a Chess.com account. The server skips Chess.com cache warming for manual-rating registrations, and player-profile rating history also avoids an unnecessary provider request for manual ratings.

## Validation

| Check | Result |
|---|---|
| QR Join, reliability, header, canonical-status, and lookup coverage | Passed: 75 tests |
| Manual identity helper | Verified deterministic readable handles for named and blank-name inputs |
| TypeScript | Passed: `npx tsc --noEmit` |
| Changed-file lint | Passed with 0 errors; 4 existing Join warnings remain |
| Diff integrity | Passed: `git diff --check` |
| Mobile visual review | At 375px, the default form shows the compact checkbox without an exposed manual field; no horizontal overflow observed |
| Interaction review | Selecting the opt-in hides Chess.com username and reveals the numeric ELO field and manual-rating provenance copy; no registration was submitted |
| Project lint | Passed with 0 errors; 236 existing warnings remain |
| Full Vitest suite | 6,970 passing, 2 skipped, and 18 established unrelated source-contract failures in tournament-format-card, accessibility-overlay, native form-label, and retired Wizard payment-toggle coverage |

The normal Chess.com QR Join lookup and its existing manual fallback after a provider failure remain available. The development preview's server-side tournament resolver was intermittently unavailable during visual review, but it showed the established non-destructive recovery state and did not affect the locally verified interaction behavior.
