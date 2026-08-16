# Repertoire Modal QA Notes

- **Route:** `/prep/humblelowkey?provider=chesscom`
- **Report contract:** Fresh response uses cache key `v3.2:chesscom:humblelowkey:all:g100:cwhite`, confirming legacy top-opening data is bypassed.
- **Triggers:** The Prep Snapshot exposes accessible opening-card buttons for Scandinavian Defense (28 games) and Rapport-Jobava System (12 games), both with explicit win/draw/loss modal labels.
- **Dialog verification:** Opening Scandinavian Defense renders a modal with 28 games and the expected scoped outcome totals: 8 wins (29%), 1 draw (4%), and 19 losses (68%). The modal has a visible Close control and darkened overlay.
- **Pie-chart verification:** The live Scandinavian Defense modal renders a clear doughnut-style outcome pie chart with a 28-game center total, plus its compact distribution bar and numeric W/D/L cards. The dominant loss segment, small draw segment, colors, labels, and dark-mode spacing all render correctly.
