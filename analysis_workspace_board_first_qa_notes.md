# Matchup Prep Analysis Workspace — Board-First QA

The live Chess.com report for `humblelowkey` successfully rebuilt and exposes trusted **Analyze** links for source games. The updated workspace keeps the report launch contract intact. Next verification targets the analysis route itself, where the native replay board should occupy up to 740px of the wider 7xl canvas and the move navigator should remain a supporting desktop panel.

The sandbox browser session does not currently hold the authenticated session required by the trusted resolver, so the direct analysis route correctly displayed its sign-in guard instead of workspace data. The implemented layout is therefore validated through source-level contracts and TypeScript; authenticated live visual verification can be repeated from the user’s signed-in browser session without changing the route or data flow.

The workspace has since been elevated from a widened page to a full-screen chess workstation. Native replays use a viewport-height board-and-sidebar grid, with an aspect-ratio-limited dominant board, persistent replay controls, and a compact mobile fallback. Both Lichess-powered tabs now receive viewport-oriented 820px and 860px work surfaces. The full-screen layout contracts, analysis contracts, and TypeScript all pass; lint completed without errors (pre-existing warnings only).
