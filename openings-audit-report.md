# Openings Library Database Audit Report
**Date:** April 27, 2026

## Summary

| Metric | Count |
|---|---|
| Published openings | 17 |
| Published lines | 103 |
| Openings with missing data | 0 |
| Lines with missing data | 43 |
| Lines without nodes | 0 |
| Lines with < 5 nodes | 0 |
| Openings with no published lines | 0 |

## Structural Health: PASS

All 103 published lines have move nodes. All 17 published openings have at least one published line. The database structure is sound — no empty boards, no broken navigation.

## Data Quality: 43 Lines Need Content

43 out of 103 lines are missing `strategicSummary` and `hintText`. These fields power the "Strategic Goal" coaching panel and the hint system in StudyMode. A server-side fallback has been added so users always see useful text, but the fallback is generic — the lines below should be updated with specific, expert-written content via the Admin panel.

### Lines Missing strategicSummary + hintText

| Line Title | Slug |
|---|---|
| Sicilian: 2.Nf3 Nc6 3.d4 cxd4 | sicilian-open-main |
| Dragon: 6.Be3 Main Line | sicilian-dragon-main |
| Najdorf: 6.Bg5 English Attack | sicilian-najdorf-english |
| King's Indian: Classical 6.Be2 | kings-indian-classical |
| Grünfeld: Exchange 7.Bc4 | grunfeld-exchange-bc4 |
| QGD: 2...e6 Declined | qgd-e6 |
| Open Variation: 5...Nxe4 | ruy-lopez-open |
| Classical: 4.Qc2 Main Line | nimzo-classical-qc2 |
| Giuoco Pianissimo: 4.c3 d3 Slow System | italian-giuoco-pianissimo |
| Smith-Morra Gambit: 2.d4 cxd4 3.c3 | sicilian-smith-morra-gambit |
| Exchange: 3.exd5 exd5 | french-exchange |
| Tarrasch Defense: Main Line (3...c5) | qg-tarrasch-main-line |
| Orthodox: 7.Rc1 Main Line | qgd-orthodox-rc1 |
| Tarrasch: Schara-Hennig Gambit (4...cxd4) | qg-tarrasch-schara-hennig |
| Exchange Variation: 4.Bxc6 | ruy-lopez-exchange |
| QGD Exchange Variation: 4.cxd5 | qgd-exchange-variation |
| Classical: Sozin Attack (6.Bc4) | sicilian-classical-sozin |
| Catalan Opening: Open Catalan (4...dxc4) | qg-catalan-open |
| Marshall Attack: 8...d5 Gambit | ruy-lopez-marshall-attack |
| Winawer: 3.Nc3 Bb4 | french-winawer |
| QGA: 2...dxc4 Accepted | qga-accepted |
| Rubinstein: 4.e3 b6 | nimzo-rubinstein-e3 |
| Main Line: d5, Nf6, e6 | london-main-d5-nf6-e6 |
| QGD Vienna Variation: 4...dxc4 5.e4 | qgd-vienna-variation |
| Grand Prix Attack: 2.Nc3 f4 | sicilian-grand-prix-attack |
| Two Knights: Traxler Counter-Attack (4...Bc5) | italian-two-knights-traxler |
| Solid: 2...Nc6 3.g3 | vienna-solid-g3 |
| Berlin Defense: The Berlin Wall | ruy-lopez-berlin-wall |
| Closed: Chigorin Variation (9...Na5) | ruy-lopez-closed-chigorin |
| Modern: 2...Nf6 Icelandic | scandinavian-icelandic |
| Scheveningen: English Attack | sicilian-scheveningen-english-attack |
| Two Knights: Modern 4.d3 (Quiet System) | italian-two-knights-modern-d3 |
| Evans Gambit Declined: 4...Bb6 | italian-evans-gambit-declined |
| Anti-Marshall: 8.a4 | ruy-lopez-anti-marshall |
| Main Line: 2...Qxd5 3.Nc3 Qa5 | scandinavian-main-qa5 |
| Main Line: 4.Nc3 dxc4 | slav-main-dxc4 |
| Main Line: 2...Nf6 3.f4 | vienna-main-nf6 |
| Classical: 3.Nc3 Nf6 | french-classical-nf6 |
| Catalan Opening: Closed Catalan (4...Be7) | qg-catalan-closed |
| Semi-Slav: Meran Variation (7...b5) | qg-semi-slav-meran |
| vs King's Indian Setup: ...g6 | london-vs-kings-indian |
| Two Knights: Fried Liver Attack (6.Bxf7+) | italian-two-knights-fried-liver |
| Advance: 3.e5 Main Line | french-advance-main |
| Semi-Slav: Moscow/Anti-Moscow (5.Bg5) | qg-semi-slav-moscow |
| Closed Sicilian: 2.Nc3 g3 | sicilian-closed |
| Giuoco Piano: Italian Attack (5.d4) | italian-giuoco-piano-attack |
| Evans Gambit Accepted: 4...Bxb4 | italian-evans-gambit-accepted |

## Fix Applied

A server-side fallback was added to `openingsPublic.ts`. When `strategicSummary` or `hintText` is null, the API now generates a generic coaching message using the line title, opening name, and first move. This prevents empty coaching panels in StudyMode immediately.

**Recommended action:** Use the Admin panel to add specific, expert-written strategic summaries and hints for the 43 lines above. The fallback text is functional but not as valuable as hand-crafted coaching content.
