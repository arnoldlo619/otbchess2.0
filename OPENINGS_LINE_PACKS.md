# Openings Line Packs — Study Content Guide

This document describes the starter line packs for ChessOTB.club's openings study system. It covers the content structure, study mode metadata, and UI rendering guidance for the 56 launch lines across 6 openings.

## Content Overview

| Opening | Side | Lines | Must-Know | Traps | Difficulty Range |
|---------|------|-------|-----------|-------|------------------|
| Jobava London | White | 10 | 4 | 2 | Beginner–Intermediate |
| Vienna Gambit | White | 10 | 3 | 3 | Beginner–Intermediate |
| Scotch Game | White | 9 | 4 | 2 | Beginner–Intermediate |
| Caro-Kann Defense | Black | 10 | 4 | 2 | Beginner–Advanced |
| King's Indian Defense | Black | 9 | 4 | 1 | Beginner–Advanced |
| Anti-London System | Black | 8 | 3 | 2 | Beginner–Intermediate |

**Total: 56 lines, 22 must-know, 12 trap lines.**

## Study Mode Metadata

Every line includes a `studyMode` object with four fields that power the study experience:

```json
{
  "unlockOrder": 1,
  "learnFirst": true,
  "drillReady": true,
  "trapFocused": false
}
```

### Field Definitions

**`unlockOrder`** (integer, 1–10) controls the sequence in which lines become available. Lines with `unlockOrder: 1` are unlocked immediately; higher numbers unlock as the user progresses. This prevents overwhelming new users with 10 lines at once.

**`learnFirst`** (boolean) marks lines that should appear in the initial Learn mode queue. These are the foundational lines a user must understand before drilling. Typically 3–4 per opening.

**`drillReady`** (boolean) marks lines suitable for the Drill mode (timed recall practice). Lines that are too long, too complex, or too positional are marked `false` — they're better suited for Learn mode only.

**`trapFocused`** (boolean) marks lines that contain a tactical trap or punishment. These power the future Trap/Puzzle mode where users practice punishing common mistakes.

## Unlock Order by Opening

### Jobava London (White)

| Order | Line | Type | Learn | Drill | Trap |
|-------|------|------|-------|-------|------|
| 1 | Main Setup: d4-Nc3-Bf4 | main | Yes | Yes | — |
| 2 | vs ...Bf5: Nb5 Attack | main | Yes | Yes | — |
| 3 | e4 Pawn Break | main | Yes | Yes | — |
| 3 | vs ...e6: Quiet Approach | main | Yes | Yes | — |
| 4 | Trap: ...Bg4 Blunder | trap | — | Yes | Yes |
| 5 | vs ...Bf5 ...c6: Central Buildup | main | — | Yes | — |
| 6 | vs ...c5: Gambit Line | gambit | — | Yes | — |
| 7 | Trap: ...e5 Premature | trap | — | Yes | Yes |
| 8 | vs ...g6 Fianchetto | sideline | — | — | — |
| 9 | vs ...Nbd7: Flexible Response | sideline | — | — | — |

### Vienna Gambit (White)

| Order | Line | Type | Learn | Drill | Trap |
|-------|------|------|-------|-------|------|
| 1 | Gambit Accepted: 3...exf4 | main | Yes | Yes | — |
| 2 | Gambit Declined: 3...d6 | main | Yes | Yes | — |
| 3 | Trap: 3...Nxe4 Grab | trap | Yes | Yes | Yes |
| 4 | Gambit Declined: 3...d5 (Falkbeer) | main | — | Yes | — |
| 5 | Trap: Copycat 3...f4? | trap | — | Yes | Yes |
| 6 | Trap: ...Qe7 Pin Attempt | trap | — | Yes | Yes |
| 7 | Accepted: 3...exf4 4.e5 Bc5 | main | — | Yes | — |
| 8 | Accepted: 3...exf4 4.e5 d6 | main | — | — | — |
| 9 | vs 2...Nc6: Transposition | gambit | — | — | — |
| 10 | Quiet Setup: 3.f4 d6 4.Nf3 | sideline | — | — | — |

### Scotch Game (White)

| Order | Line | Type | Learn | Drill | Trap |
|-------|------|------|-------|-------|------|
| 1 | Main Line: 3...exd4 4.Nxd4 | main | Yes | Yes | — |
| 2 | vs ...Bc5: Classical Response | main | Yes | Yes | — |
| 3 | vs ...Qh4: Aggressive Queen | main | Yes | Yes | — |
| 4 | vs ...Nf6: Classical 5.Nc3 | main | — | Yes | — |
| 5 | Trap: e5 Knight Chase | trap | — | Yes | Yes |
| 6 | Trap: Mate Threat after ...Qf6 | trap | — | Yes | Yes |
| 7 | vs ...d5: Counter-Gambit | gambit | — | Yes | — |
| 8 | vs ...d6: Passive Decline | sideline | — | — | — |
| 10 | vs ...g6: Modern Approach | sideline | — | — | — |

### Caro-Kann Defense (Black)

| Order | Line | Type | Learn | Drill | Trap |
|-------|------|------|-------|-------|------|
| 1 | Classical: 4...Bf5 Main Line | main | Yes | Yes | — |
| 2 | Advance: 3.e5 Main Line | main | Yes | Yes | — |
| 3 | Exchange: 3.exd5 cxd5 | main | Yes | Yes | — |
| 4 | Panov Attack: 3.exd5 cxd5 4.c4 | main | Yes | Yes | — |
| 5 | Classical: ...Nd7 Flexible Setup | main | — | Yes | — |
| 6 | Fantasy: 3.f3 | sideline | — | Yes | — |
| 7 | Two Knights: Nxf6 gxf6 | sideline | — | Yes | — |
| 8 | Trap: Advance ...c5 Break | trap | — | Yes | Yes |
| 9 | Trap: Punishing Scholar's Mate | trap | — | Yes | Yes |
| 10 | Short Advance: 3.e5 Bf5 4.Nc3 | sideline | — | — | — |

### King's Indian Defense (Black)

| Order | Line | Type | Learn | Drill | Trap |
|-------|------|------|-------|-------|------|
| 1 | Classical: ...e5 Main Line | main | Yes | Yes | — |
| 2 | Fianchetto: 3.Nf3 Bg7 4.g3 | main | Yes | Yes | — |
| 3 | vs London: 2.Bf4 System | sideline | Yes | Yes | — |
| 4 | Saemisch: 5.f3 System | main | — | Yes | — |
| 5 | Four Pawns Attack: 5.f4 | main | — | Yes | — |
| 6 | Trap: Premature dxe5 | trap | — | Yes | Yes |
| 7 | Averbakh: 5.Be2 O-O 6.Bg5 | sideline | — | Yes | — |
| 8 | Mar del Plata: ...f5 Attack | main | — | — | — |
| 9 | Bayonet Attack: 9.b4 | main | — | — | — |

### Anti-London System (Black)

| Order | Line | Type | Learn | Drill | Trap |
|-------|------|------|-------|-------|------|
| 1 | Main Idea: ...c5 Challenge | main | Yes | Yes | — |
| 2 | Bishop Exchange: ...Bd6 Plan | main | Yes | Yes | — |
| 3 | ...Qb6 Pressure Line | main | Yes | Yes | — |
| 4 | vs d5 Close: Solid Approach | main | — | Yes | — |
| 5 | Trap: b2 Pawn Grab | trap | — | Yes | Yes |
| 6 | ...Bf5 Mirror | sideline | — | — | — |
| 7 | Open Center: ...cxd4 Lines | main | — | Yes | — |
| 8 | Trap: ...h5 Bishop Chase | trap | — | Yes | Yes |

## Content Per Line

Each line in the seed JSON includes the following study-relevant fields:

| Field | Purpose | Example |
|-------|---------|---------|
| `lineSummary` | Card-level description of what the line is about | "The foundational Jobava London position..." |
| `strategicGoal` | What the player should aim for in this line | "Establish the Jobava triangle and maintain central tension." |
| `commonOpponentMistake` | What opponents typically do wrong | "Black plays ...Bf5 thinking it's a normal London..." |
| `punishmentIdea` | How to exploit the mistake | "After ...Bf5, White can play Nb5 targeting c7..." |
| `hintText` | Shown during practice before revealing the move | "Develop Nc3 before e3 — this is what makes it the Jobava." |
| `branchLabel` | Where this line branches from the main tree | "After 1.d4 d5" |

## Line Type Distribution

| Type | Count | Description |
|------|-------|-------------|
| `main` | 33 | Core theory lines — the backbone of each opening |
| `trap` | 12 | Lines containing tactical traps or punishment ideas |
| `sideline` | 7 | Less common but important to know |
| `gambit` | 4 | Lines involving material sacrifice for initiative |

## Difficulty Distribution

| Difficulty | Count | Target Audience |
|------------|-------|-----------------|
| `beginner` | 22 | Club players 800–1400 |
| `intermediate` | 28 | Club players 1400–1800 |
| `advanced` | 6 | Tournament players 1800+ |

## Recommended UI Rendering

### Learn Mode Queue

Display lines in `unlockOrder` sequence. Show only lines with `learnFirst: true` initially. As the user completes those, unlock the next batch. Each line shows:

1. The line title and chapter name
2. A mini chessboard with the starting position
3. The strategic goal as a brief intro
4. Step-through moves with annotations (from `hintText`)
5. A "Got it" button to mark as learned

### Drill Mode Queue

Show only lines with `drillReady: true`. Present the starting position and ask the user to play the correct moves from memory. Show `hintText` if the user requests a hint. Track accuracy and time for spaced repetition scheduling.

### Trap/Puzzle Mode

Filter lines with `trapFocused: true`. Present the opponent's mistake position and ask the user to find the punishment. Show `commonOpponentMistake` as the setup and `punishmentIdea` as the solution explanation.

### Opening Detail Page — Lines Tab

Group lines by `chapterName` (e.g., "Core System", "Traps & Tactics", "Sideline Responses"). Within each chapter, sort by `sortOrder`. Show difficulty badges, must-know flags, and trap indicators.

## Data Integrity

All move sequences are verified by `python-chess` during generation. Every line has:

- Verified FEN computed from the actual move sequence (not manually entered)
- UCI moves generated from SAN (not manually translated)
- PGN formatted with proper move numbers
- Ply count computed from the actual number of half-moves

This ensures zero discrepancies between the displayed moves and the board position.
