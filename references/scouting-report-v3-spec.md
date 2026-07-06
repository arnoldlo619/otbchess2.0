# Scouting Report V3 — Reference Implementation Notes
# Source: /home/ubuntu/upload/scouting-report-mvp/scouting-mvp/src/
# Task spec: /home/ubuntu/upload/pasted_content_4.txt
# Fixtures: /home/ubuntu/upload/packet-4/

## Task Summary
Port the verified scouting-report-mvp reference into the OTB Chess codebase.
Replace the broken server/prepEngine.ts v2.1.0 with a correct V3 pipeline.

## Hard Rules
1. Every rendered insight has 6 fields: claim, evidence (stat + 1-5 game links + window), interpretation, recommendation, confidence, sampleSize
2. BANNED phrases (never appear in any rendered field):
   - "control the center", "develop your pieces", "avoid blunders", "watch out for tactics"
   - "play solidly", "be careful in the opening", "look for weaknesses", "prepare for common openings"
   - "let them make the mistakes", "maintains better piece coordination", "the opponent is aggressive"
3. Every displayed move sequence must replay legally with chess.js — if not, drop it
4. Confidence computed via Wilson interval:
   - high = n≥15 & CI width ≤0.30
   - medium_high = n≥10
   - medium = n≥6
   - low = else
5. Weakness requires: n≥6, score ≤45%, delta ≤ −12pts below same-color baseline
6. Headline sections require n≥8 and confidence ≥ medium
7. Thin data → show less, never pad with filler

## File Structure to Create
- shared/prepTypes.ts ← types.ts (Insight + ScoutReportV3)
- server/services/chesscom.ts ← providers.ts (chess.com provider)
- server/services/lichess.ts ← providers.ts (lichess provider)
- server/prep/parseGames.ts ← engine.ts parseGames section
- server/prep/openingBook.ts ← engine.ts book loading
- server/prep/facts.ts ← engine.ts buildFacts section
- server/prep/insightEngine.ts ← engine.ts synthesize section
- server/prep/guards.ts ← engine.ts runGuards section
- data/ecoByEpd.json ← packet-4/data/ecoByEpd.json (3,733 positions)
- server/prep/__fixtures__/ ← packet-4/fixtures/

## Key Types (from types.ts)
```ts
type Color = "white" | "black"
type Provider = "chesscom" | "lichess"

interface Insight {
  id: string
  kind: "opening_tendency" | "weakness" | "strength" | "response_pattern" | "deviation_point" | "behavior" | "weak_signal"
  color: Color
  role: "plays" | "faces"
  claim: string
  evidence: {
    stat: string
    games: Array<{ url: string; date: string; result: "W"|"D"|"L" }>
    window: { from: string; to: string; timeClasses: string[]; ratedOnly: boolean }
  }
  interpretation: string
  recommendation: { action: string; line?: { san: string; validated: boolean } }
  confidence: "high" | "medium_high" | "medium" | "low"
  sampleSize: number
  ply?: number
  baseline?: { metric: string; value: number; delta: number }
}

interface ScoutReportV3 {
  version: "3"
  username: string
  provider: Provider
  generatedAt: string
  engineVersion: string
  dataQuality: {
    fetched: number
    usable: number
    excluded: Record<string, number>
    quarantined: number
    grade: "A"|"B"|"C"|"D"
    notes: string[]
  }
  record: Record<Color, { w: number; d: number; l: number }>
  timeClassBreakdown: Record<string, { games: number; score: number }>
  forecastWhite: ForecastBranch[]
  forecastBlack: ForecastBranch[]
  insights: Insight[]
  sections: {
    openingForecast: string[]
    weaknesses: string[]
    strengths: string[]
    deviationPoints: string[]
    behavior: string[]
    weakSignals: string[]
  }
  guardLog: Record<string, number>
}
```

## Engine Pipeline (engine.ts)
1. parseGames() — filters, quarantines illegal games, classifies openings via EPD book lookup
2. buildFacts() — groups by color, opening family, response patterns, first moves
3. forecast() — builds move tree (depth 4, min 3 games per branch)
4. synthesize() — generates Insight[] from facts
5. runGuards() — drops banned phrases, illegal lines, missing baselines, ply parity violations
6. buildReport() — assembles ScoutReportV3 with grade, sections, guardLog

## Recency Weighting (improvement over reference)
Games in last 90 days count ~1.5× in confidence tiers (add to port)

## Fixture Expectations
- cleanplayer: weakness insight "29% in Scandinavian as Black, 12 games, baseline delta ≈ −36pts"
- jobavabot: chess.com JSON and Lichess NDJSON produce identical claims
- mixedsalted: exactly 18 of 30 games usable; 5 unrated, 2 variant, 2 short/abandoned, 3 bullet excluded
- thinaccount: grade D, zero headline items, thin-data note
- corrupt_*.pgn: quarantined, never rendered

## API Changes (Step 4)
- GET /api/prep/:username?schema=3 → ScoutReportV3
- &provider=lichess support
- Cache key: username + provider + time-control filter + game count + engine version
- Error payloads: invalid_username / not_found / no_recent_games / all_filtered / upstream_rate_limited
- ENGINE_VERSION = "3.0.0"

## UI Sections Order (Step 5)
1. Matchup Summary
2. Opening Forecast (their White / their Black tabs)
3. Weaknesses to Target
4. Strengths to Respect
5. If You Have White
6. If You Have Black
7. Deviation Points
8. Behavior
9. Weak Signals (labeled "below evidence gates — directional only")
10. Prep Checklist

## Security Fix (Step 6)
- POST /api/prep/coach-insight: only accepts { username, insightIds, type }
- Server builds LLM prompt itself from validated insights
- Old route returns 410
- LLM output: JSON, temperature ≤0.3, post-validated against supplied insights
- Fallback to deterministic report on LLM failure

## Reference Files Locations
- Engine: /home/ubuntu/upload/scouting-report-mvp/scouting-mvp/src/engine.ts
- Types: /home/ubuntu/upload/scouting-report-mvp/scouting-mvp/src/types.ts
- Providers: /home/ubuntu/upload/scouting-report-mvp/scouting-mvp/src/providers.ts
- Fixtures (packet-4): /home/ubuntu/upload/packet-4/fixtures/
- Opening book: /home/ubuntu/upload/packet-4/data/ecoByEpd.json
- Raw PGN: /home/ubuntu/upload/packet-4/fixtures/raw_pgn/
- Examples: /home/ubuntu/upload/scouting-report-mvp/scouting-mvp/examples/
