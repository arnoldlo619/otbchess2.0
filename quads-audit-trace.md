# Quads Audit — Phase 1 Trace Findings

## Key Files
- `client/src/lib/quads.ts` (1006 lines) — Quads engine: sections, pairings, standings, tiebreaks, validation
- `client/src/lib/directorState.ts` — useDirectorState hook; quads-specific logic at lines 122, 479-496, 589, 925-951, 982-1011
- `client/src/lib/tournamentRegistry.ts` — TournamentConfig type, makeSlug(), registerTournament()
- `client/src/lib/mockQuadsData.ts` — Mock data generators for testing
- `client/src/components/tournament/QuadsDirectorPanel.tsx` — Quads director UI (1196 lines)
- `client/src/components/TournamentWizard.tsx` — Tournament creation wizard
- `client/src/pages/Director.tsx` — Main director page (renders QuadsDirectorPanel when format=quads)
- `client/src/pages/PublicTournament.tsx` — Public tournament view
- `client/src/pages/Join.tsx` — Join page with btoa/atob encoding

## Bug 1: Unicode Crash (btoa)
**Location:** TournamentWizard.tsx:3166, Director.tsx:2234, Join.tsx:339
**Root cause:** `btoa(JSON.stringify(embeddedMeta))` — btoa only handles Latin-1 characters. Unicode chars in tournament name crash with "Failed to execute 'btoa': The string to be encoded contains characters outside of the Latin1 range"
**Fix:** Replace with `btoa(unescape(encodeURIComponent(JSON.stringify(meta))))` or use a proper UTF-8→base64 helper. Join.tsx:321 `atob()` needs matching decode: `decodeURIComponent(escape(atob(b64)))`.

## Bug 2: Date Timezone Shift
**Location:** TournamentWizard.tsx:1751 — `new Date(data.date + "T00:00:00").toLocaleDateString(...)`
**Root cause:** `new Date("2026-07-14T00:00:00")` is parsed as LOCAL time, which is correct. But other places may use `new Date("2026-07-14")` which is parsed as UTC midnight — in PDT (UTC-7) that shows as July 13.
**Key insight:** The date is stored as `YYYY-MM-DD` string in TournamentConfig.date. The wizard's `todayIso()` correctly uses local date. Display in PublicTournament.tsx:881 just renders `{data.date}` as raw string (safe). The issue may be in the wizard's share step or other display points that parse the date string through `new Date()` without the T00:00:00 suffix.

## Bug 3: Swiss References in Quads
**Location:** Director.tsx:2649-2652 — format label logic doesn't include "quads" case
```
const fmtLabel = state.format === "swiss" ? `Swiss · ${state.totalRounds}R`
  : state.format === "elimination" ? "Elimination"
  : state.format === "roundrobin" ? "Round Robin"
  : state.format === "doubleswiss" ? `Double Swiss · ${state.totalRounds}R`
```
This falls through to undefined for quads format.
Also Director.tsx:2714-2716 same pattern.
**Other Swiss leakage:** "Choose which rating to use for Swiss pairings" in Settings panel, Style-Aware Pairings toggle, Generate Balanced Matchups button.

## Bug 4: State Machine
**Current model:** `state.status` is "lobby" | "active" | "complete" (from directorState.ts:33)
**Issue:** No intermediate states (ROUND_1_ACTIVE, ROUND_1_COMPLETE, etc.). The current round is tracked by `state.currentRound` and completion is checked by counting results. The "Finalize Tournament" button in QuadsDirectorPanel may not properly transition to "complete" status.

## Bug 5: Fractional Scoring
**Location:** quads.ts:506 `calculateQuadStandings` — scores are computed as 1/0.5/0 per game result. Display uses `s.score.toFixed(1)` or `s.score % 1 === 0 ? s.score : s.score.toFixed(1)` in QuadsDirectorPanel.

## Bug 6: Draw Rate
**Location:** Need to find where draw rate is calculated — likely in PublicTournament.tsx or a stats helper.

## Bug 7: Tiebreaks
**Location:** quads.ts:93-100 DEFAULT_TIEBREAK_ORDER, quads.ts:664 `rankStandings()`
Current order: Need to verify it matches the spec (points → direct encounter → SB → wins → co-champion).

## Bug 8: Trophy Unicode
**Location:** Need to find `\uD83C\uDFC6` or escaped trophy text in the codebase.

## Architecture Notes
- Quads generates ALL rounds upfront at startTournament (directorState.ts:479-496)
- Round advancement just increments currentRound (directorState.ts:589)
- QuadsDirectorPanel handles its own section selection, round tabs, result entry
- The Director.tsx page conditionally renders QuadsDirectorPanel when format==="quads"
- Registration lobby, player management, settings are shared with Swiss in Director.tsx
