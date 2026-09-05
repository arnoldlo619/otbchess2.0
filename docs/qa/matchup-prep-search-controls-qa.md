# Matchup Prep Search Controls QA

## Desktop blank state

- The sticky top bar is limited to brand and account/report actions; the opponent username input is in the dedicated Scout opponent content header.
- The Scout opponent menu opens as a compact, labelled panel with Source, Format, and I’m playing radio choices plus a disabled Run scout action until a username is present. Escape dismisses it cleanly after its reserved close transition.
- The empty state no longer repeats the Scout, Study, and Practice feature strip.

## Mobile and report-state checks

- At 375px, the username input and Scout opponent trigger stack cleanly inside the section header, with full-width touch targets and no sticky-header overlap.
- The focused rendered suite verifies source, time-control, and player-color selection; Enter/Escape menu behavior; immutable route submission; and the report-state image/PDF export menu.

## Visual-edit follow-up

- The desktop header now centrally aligns the compact Matchup Prep and Scout opponent identity while keeping brand and account/report actions at opposing edges. The mobile header stays intentionally uncluttered.
- The Scout Report uses the real parsed provider-game record to calculate and render the opponent’s White and Black win percentages. Its component regression fixture verifies the displayed values without relying on generated percentages.
