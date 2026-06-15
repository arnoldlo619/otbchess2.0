# MATCH_PREP_AUDIT.md

## Executive summary

Match Prep is one of ChessOTB.club's highest-potential premium features. The technical foundation is already substantial: it has a dedicated page, server prep engine, opening detection, saved reports, recently scouted opponents, practice lines, coach insight, and Chess.com/Lichess proxy support. The biggest opportunity is to make reports **faster, clearer, more actionable, and more resilient to upstream data failures**.

## Current feature map

### User-facing UI

- `client/src/pages/MatchupPrep.tsx`: 3-tab workspace: Scout Report, Study Lines, Practice Board.
- `client/src/components/PreRoundQuickReview.tsx`: tournament-adjacent prep summary.
- `client/src/components/ChessPracticeBoard.tsx`, `ChessLineViewer.tsx`, `MoveTreePanel.tsx`, `UserRepertoirePanel.tsx`, `CoachInsightCard.tsx`.
- `client/src/lib/recentlyScouted.ts` and local practice progress in `MatchupPrep.tsx`.

### Server/data pipeline

- `server/index.ts` `/api/prep/:username`, `/api/prep/:username/openings`, `/api/prep/saved`, `/api/prep/coach-insight`.
- `server/prepEngine.ts` report generation and Chess.com monthly archive fetch.
- `server/prepAnalysisEngine.ts` deeper analysis support.
- `server/openingDetection.ts` opening classification.
- `shared/schema.ts` `prepCache`, `savedPrepReports`, `chessPlayerCache`.

## Technical audit

### MP-1: Upstream error states need explicit taxonomy

**Current pattern:** `MatchupPrep.tsx` calls `/api/prep/:username` and displays `data.error` or generic failure. `server/prepEngine.ts` skips failed Chess.com monthly archive requests and returns whatever games it can collect.

**Risk:** Users cannot tell if the username is invalid, Chess.com is temporarily rate-limiting, games are private/unavailable, or there are simply not enough recent rapid/blitz games.

**Recommendation:** Add structured prep errors:

```ts
type PrepErrorCode =
  | "username_not_found"
  | "profile_private_or_unavailable"
  | "rate_limited"
  | "upstream_timeout"
  | "not_enough_games"
  | "no_games_for_filter"
  | "partial_data";
```

UI copy should include next action: try another time control, reduce game count, check spelling, retry in 60 seconds, or save a manual scouting note.

**Complexity:** Small/Medium.

### MP-2: Cache identity should include report inputs

**Current pattern:** `prepCache` is username-keyed in `shared/schema.ts`; `MatchupPrep.tsx` supports time-control and game-count filters.

**Risk:** A cached all-games report could be returned for a rapid/blitz-filtered report unless endpoint logic fully separates them. Even if code handles refresh, the schema shape encourages cache ambiguity.

**Recommendation:** Cache by `username`, `timeControlFilter`, `gameCount`, and `engineVersion`, or store filter metadata inside report rows and validate before reuse.

**Complexity:** Medium with migration.

### MP-3: Chess.com fetching should be centralized

**Current pattern:** Chess.com requests exist in `server/prepEngine.ts`, `server/index.ts`, `server/auth.ts`, and `server/leagues.ts`.

**Risk:** Rate limits, timeout behavior, user-agent strings, and error handling diverge.

**Recommendation:** Add `server/services/chesscom.ts` with:

- `getPlayerProfile(username)`
- `getPlayerStats(username)`
- `getRecentGames(username, { months, maxGames, timeClasses })`
- shared retry/backoff/timeout
- structured error classes
- cache hooks

**Complexity:** Medium.

### MP-4: Report display model should be separate from raw report

**Current pattern:** `MatchupPrep.tsx` contains report interfaces, fetching, derived summaries, practice conversion, tabs, and rendering.

**Risk:** UI refactors can break report logic; report language is hard to test.

**Recommendation:** Extract:

- `client/src/features/match-prep/types.ts`
- `client/src/features/match-prep/lib/reportDisplayModel.ts`
- `client/src/features/match-prep/hooks/useMatchPrepReport.ts`
- `client/src/features/match-prep/components/ScoutReportTab.tsx`
- `StudyLinesTab.tsx`, `PracticeTab.tsx`, `PrepErrorState.tsx`

**Complexity:** Medium.

### MP-5: Practice tab should be lazy-loaded

**Current pattern:** The page imports practice/line components directly.

**Risk:** Initial scout report route can load chessboard-heavy code before needed.

**Recommendation:** Lazy-load practice board and move tree tab content.

**Complexity:** Small/Medium.

## Product quality audit

### Current strengths

- Three-tab mental model is strong: Scout Report → Study Lines → Practice Board.
- Recently scouted and saved reports support repeated tournament use.
- Time-control filters are important and already present.
- Practice progress adds habit/premium value.

### Current product risks

- Opening/scouting terminology can become too technical for club players.
- Users need a crisp “what should I do in the next 10 minutes?” summary.
- Reports should avoid overclaiming from small samples.
- Recommendations should distinguish high-confidence patterns from weak signals.

## Recommended premium report structure

### 1. Executive card: “How to play them”

Use plain language:

- **Primary plan:** “As White, steer toward X; they score poorly against Y.”
- **Biggest trap to avoid:** “Do not autopilot into Z; they know the first 8 moves.”
- **Clock strategy:** “They slow down in closed middlegames” or “Expect fast opening moves.”
- **Confidence:** High/Medium/Low based on games analyzed and recency.

### 2. Opening dashboard

Separate by color:

- When they are White: likely first moves, top systems, what you should prepare.
- When they are Black vs 1.e4/1.d4: likely defenses, safer sideline, critical move order.
- Add “sample size” next to every claim.

### 3. Actionable prep lines

Each line card should answer:

- What position are we aiming for?
- Why is this good against this opponent?
- What is the one move to remember?
- What is the common mistake?
- Practice button.

### 4. Weakness patterns

Phrase as club-player advice:

- “Often misses tactics after early queen trades.”
- “Struggles when opponents avoid their main Sicilian line.”
- “Draws often from equal rook endings; push earlier if you need a win.”

Avoid vague labels such as “low conversion in B12 structures” unless accompanied by explanation.

### 5. Tournament mode quick sheet

For directors/players before a round:

- 3 bullet plan.
- 2 lines to review.
- One “if surprised” fallback setup.
- Estimated prep time: 5/10/20 minutes.

## UI recommendations

| Area | Recommendation | Why |
|---|---|---|
| Empty state | Show username examples and explain data source. | Reduces confusion. |
| Loading | Show stages: profile → games → openings → recommendations. | Feels premium and transparent. |
| Error | Use structured error cards with retry and filter actions. | Avoids generic failure. |
| Saved reports | Show “last analyzed” and engine version. | Builds trust. |
| Confidence | Add badges based on games analyzed/sample size. | Prevents overclaiming. |
| Mobile | Sticky search/filter bar and bottom tab switcher. | Useful before rounds. |
| Practice | Lazy-load and show “Practice top 3 lines” CTA from report. | Faster and more actionable. |

## Data model recommendations

Short-term additions to report JSON:

```ts
interface PrepReportMeta {
  engineVersion: string;
  generatedAt: string;
  filters: { timeControl: "all" | "rapid" | "blitz"; maxGames: number };
  dataQuality: {
    gamesRequested: number;
    gamesAnalyzed: number;
    monthsScanned: number;
    partialData: boolean;
    confidence: "low" | "medium" | "high";
    warnings: PrepErrorCode[];
  };
}
```

Medium-term DB changes:

- Cache key includes username + filter + game count + engine version.
- Saved reports store metadata fields outside JSON for listing/filtering.
- Store upstream fetch status to support “retry failed months” later.

## Recommended Match Prep PRs

1. Add structured error codes and premium error states.
2. Extract report display model and tests for wording/confidence.
3. Lazy-load practice/move-tree tab.
4. Centralize Chess.com service and cache semantics.
5. Add tournament quick-sheet / pre-round card.

