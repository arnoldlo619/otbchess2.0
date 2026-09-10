# Director Dashboard Readability QA

## Scope

Raised the operational type scale on the Director Home dashboard’s normal and Double Swiss pairing cards, byes, check-in roster, pairing status row, and completed-round rows. The Standings tab now uses a matching player-name, score, stat, header, and mobile-card scale while retaining its semantic table and responsive card layout.

## Verification — 2026-09-10

The normal Swiss Director demo was reviewed at desktop width and at 375px. Board titles, player names, ratings, scores, result controls, and completed-round rows remained legible without visible horizontal overflow. The mobile capture retained readable primary player text above the PWA installation prompt.

The current connected-browser demo was in a Quads state, where Standings is intentionally absent. Direct Standings visual selection was therefore not performed against a user tournament. The rendered-source regression contract verifies the Standings tab keeps 16px player names and points, 12px secondary data and headers, increased table row padding, and matching mobile ranking-card typography. The focused Director suite, TypeScript check, and lint completed without new errors.
