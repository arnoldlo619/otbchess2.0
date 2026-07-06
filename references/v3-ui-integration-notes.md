# V3 UI Integration Notes (Step 5)

## Current MatchupPrep.tsx State
- 2406 lines, V2 PrepReport shape
- `report` state is `PrepReport | null`
- `fetchReport()` at line 358 calls `/api/prep/:username` with tc/refresh/games params
- `OpponentHero` uses: `opp.username`, `opp.gamesAnalyzed`, `opp.rating.rapid/blitz`, `opp.overall.winRate`, `opp.asWhite.winRate`, `opp.asBlack.winRate`
- `ScoutReportTab` uses: `opp.whiteOpenings`, `opp.blackOpenings`, `report.prepRecommendations`, `report.victoryPlan`, `report.insights` (string[]), `report.behavior`, `report.openingTree`, `report.problemLines`, `report.enginePatterns`
- `enrichedLines` derived from `report.prepLines` via `enrichPrepLines()`
- `matchupSummary` derived from `report.opponent.firstMoveAsWhite/blackOpenings/whiteOpenings/asWhite/asBlack/gamesAnalyzed`

## V3 ScoutReportV3 Shape (from shared/prepTypes.ts)
```
opponent: { username, record: Record<Color, {w,d,l}>, avgRating, timeControlSplit }
dataQuality: { requested, fetched, parsed, quarantined, excluded, ratedShare, window, grade, notes }
openingForecast: Record<Color, ForecastBranch[]>
insights: Insight[] — each has: claim, evidence.{stat, games[]}, interpretation, recommendation.{action, line?}, confidence, sampleSize, kind, color, family, ply?, baseline?
sections: { matchupSummary[], strengths[], weaknesses[], weakSignals[], ifYouHaveWhite[], ifYouHaveBlack[], deviationPoints[], behavior[], prepChecklist[{text, insightId}] }
guardLog: { droppedInsights, reasons }
generatedAt: string
```

## Integration Strategy
The spec says to add `?schema=3` support while keeping V2 as default.
The cleanest approach: add a `provider` state and `useV3` toggle in the UI.
When `useV3=true`, fetch `?schema=3&provider={provider}` and render V3 components.
When `useV3=false`, fetch legacy and render V2 components (unchanged).

## New Components Needed
1. **DataQualityBanner** — shows grade, parsed/quarantined counts, notes
2. **InsightCard** — renders one Insight with all 6 fields
3. **OpeningForecastSection** — renders ForecastBranch trees for white/black
4. **V3ScoutReportTab** — replaces ScoutReportTab when V3 is active
5. **V3OpponentHero** — uses record/avgRating/timeControlSplit instead of V2 fields

## Key V3 Opponent Stats
- Win rate = record.white.w / (record.white.w + record.white.d + record.white.l) for white
- Total games = sum of all record values
- avgRating from opponent.avgRating
- timeControlSplit: { "rapid": {games, score}, "blitz": {games, score} }

## Provider Selector
Add `?provider=chesscom|lichess` to the filter bar
Default: chesscom
Lichess: shows NDJSON-sourced data

## Error Handling
V3 returns PrepErrorPayload: { error: PrepErrorCode, message: string }
PrepErrorCode: "invalid_username" | "not_found" | "no_recent_games" | "all_filtered" | "upstream_rate_limited"
Map these to user-friendly messages in PrepErrorState component.

## Files to Touch
- client/src/pages/MatchupPrep.tsx — add V3 state, provider selector, V3 fetch path, V3 render path
- New: client/src/components/prep/DataQualityBanner.tsx
- New: client/src/components/prep/InsightCard.tsx
- New: client/src/components/prep/V3ScoutReportTab.tsx (or inline in MatchupPrep)
