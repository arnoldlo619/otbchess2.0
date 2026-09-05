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

## Scout Brief reliability

- Root cause: the original brief accepted only primary insights carrying a rare legal-line payload. Common, evidence-backed opening tendencies and responses were discarded, causing a false empty plan.
- Eligible Pro reports now assemble exactly three cards: **Expect**, **Prepare**, and **Practice**. They use observed opening lines, matched source games, and the report’s actual time-control/date window. The existing Pro projection remains server-enforced; free responses retain only the simple opening snapshot.
- Stale reports remain recommendation-free. Reports without at least two verified games in one common opening sequence receive an honest evidence-limit state instead of invented guidance.

## Move-specific Scout Brief

- The Expect card now reads **“Expect these opening moves”** and presents the opponent’s actual earliest observed move as White and as Black, each in correctly numbered chess notation.
- The opening snapshot now appends a compact two-to-four-ply observed sequence to each opening family. Move patterns promote broad provider labels to recognizable names such as Queen’s Gambit, London System, Pirc Defense, Sicilian Defense, and Scandinavian Defense only when the recorded moves support that label.

## Expect-card move perspective

- The Expect card determines the mover from each forecast branch’s canonical path before reading legacy metadata. The Black value therefore reports the first observed Black reply (for example, `1... c5`) and cannot mistakenly repeat White’s `1. e4`.
- The As White and As Black labels are larger, brighter, and use a low-amplitude glow only when motion is allowed. Reduced-motion users receive the same high-contrast labels without animation.
