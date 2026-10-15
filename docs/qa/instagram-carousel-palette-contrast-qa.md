# Instagram Carousel Palette Contrast QA

## Scope

Audited all built-in Tournament Recap Instagram carousel palettes and every remaining secondary/tertiary export-text treatment after the Classic palette contrast refinement.

## Findings and changes

### Palette secondary accents

The audit measured each `accentLight` value against the brightest color in its default theme canvas (`theme.bg`). Three palette accents did not meet WCAG AA for normal-size text and were corrected with lighter, palette-faithful pastel values.

| Theme | Previous `accentLight` | Previous ratio | Updated `accentLight` | Updated ratio |
| --- | --- | ---: | --- | ---: |
| Classic | `#FBFADA` | 9.32:1 | unchanged | 9.32:1 |
| Midnight | `#5B8DD9` | 4.24:1 | `#AFCBFF` | 8.69:1 |
| Crimson | `#D95B5B` | 3.85:1 | `#FFB8B8` | 8.80:1 |
| Gold | `#D4A017` | 5.83:1 | `#F9D984` | 10.09:1 |
| Mono | `#B0B0B0` | 6.62:1 | `#E0E0E0` | 10.87:1 |
| Purple | `#9B5BD9` | 3.64:1 | `#D1B5FF` | 8.75:1 |
| Pitch | `#4CAF50` | 7.33:1 | `#B7F7A9` | 16.39:1 |
| Chalk | `#FFFFFF` | 12.59:1 | unchanged | 12.59:1 |
| Neon | `#39FF14` | 14.77:1 | `#B7FFAA` | 17.07:1 |

### Other low-contrast text corrections

- Updated the bronze ranking token to `#E9B36B`. Gold, silver, bronze, and white placement text now remain at or above **5.24:1** against every built-in theme canvas.
- Replaced weak white-alpha standings/rank/ELO values with the active palette’s readable `accentLight` token.
- Increased podium block rank numerals from translucent medal color to solid medal color.
- Improved the W/L round-result cell foregrounds:
  - Win: `#8BE8AF` on `#2D5A3A` (**5.41:1**)
  - Loss: `#FF8F8F` on `#5A2D2D` (**5.18:1**)
  - Draw remained `#F2C94C` on `#3A3A1A` (**7.35:1**)
- Replaced the inactive round-marker text’s `white/15` treatment with the current palette’s readable secondary token.
- Strengthened user-uploaded image backgrounds with an 80% black readability scrim. This guarantees the built-in palette secondary accents remain above **7:1** even over a worst-case bright image beneath the scrim.

## Visual QA

Validated the completed Quads flow at:

`/tournament/otb-demo-2026/manage?mockQuads=complete`

1. Opened **Create Recap**.
2. Iterated every palette: Classic, Midnight, Crimson, Gold, Mono, Purple, Pitch, Chalk, and Neon.
3. Confirmed all core export labels—**Tournament Recap**, **Players**, **registered**, **Rounds**, **Swiss**, **Avg ELO**, **rating**, **Games**, **played**, **Most Wins**, and **Highest Rated**—resolve to each palette’s updated high-contrast secondary token.
4. Reviewed the Purple **Stats** preview directly, verifying the upgraded lavender label system is clear against the dark purple canvas while white figures retain primary emphasis.

## Automated validation

| Check | Result |
| --- | --- |
| Carousel focused suites | **169 passed** across 8 files |
| Palette-wide contrast assertions | **6 passed** |
| Built-in palette secondary text | All 9 palettes meet **WCAG AA (≥4.5:1)** on their brightest default canvas tone |
| TypeScript | Passed |
| Production build | Passed |
| Project lint | Passed — 0 errors, 224 established warnings |
| Diff integrity | Passed |
| Full Vitest baseline | 7,288 passed / 2 skipped / 27 established unrelated failures across 19 suites; all carousel suites passed |

## Notes

- The audit covers every shipped palette, curated default, standard export slide, theme/gradient preset, and the image-background safety layer.
- The editor intentionally retains a freeform heading color picker. Deliberately selecting a very dark custom heading color is an author-controlled choice and is not auto-overridden.
