# Analysis Workspace Browser QA Notes

- 2026-08-12: The first `/prep` navigation briefly rendered a blank shell while the development server was restarting. A reload rendered the Matchup Prep page normally.
- The visible form exposes chess.com/Lichess source selection, format/depth choices, and only White/Black perspective controls; the deprecated "Not sure" control is absent.
- The live analysis-launch workflow still requires a completed report with eligible evidence before it can be exercised in-browser.
- 2026-08-12: Entering `DrNykterstein` and switching the provider to Lichess started the expected report-loading skeleton and changed the input placeholder to "Lichess username". The result is being monitored before exercising an eligible evidence action.
- 2026-08-12: The first completed Lichess selection exposed a stale-provider regression: the visible Lichess badge was paired with Chess.com evidence URLs. The fetch path was corrected to receive the selected provider explicitly; the page has been reset for a fresh validation run.
- 2026-08-12: The corrected fresh run entered the expected Lichess-specific loading state. The final report response is being checked before recording provider/evidence consistency.
- 2026-08-12: The corrected provider path timed out under the original 12-second player-export deadline. The shared request deadline was raised to a still-bounded 30 seconds, and the page is reset for a final live retest.
- 2026-08-12: The final retest correctly entered the Lichess loading state with the extended bounded export deadline. The result will be recorded after the request completes or times out.
- 2026-08-12: With the 30-second bounded export deadline, the live request progressed through fetching, opening classification, and weakness scoring; report construction remained in progress at the final observation.
- 2026-08-12: The live Lichess report completed successfully with 108 games and Lichess-only evidence URLs. The first Analyze action resolves to a trusted `lichess:hQh8KffH` source-game subject under the provider-scoped report cache key.
- 2026-08-12: The unauthenticated analysis route correctly blocks resolution and now presents the explicit message that sign-in is required, with a safe return to Matchup Prep rather than exposing a raw 401.
