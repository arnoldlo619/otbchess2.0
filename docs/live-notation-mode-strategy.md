# Live Notation Mode — Feature Strategy

**Feature codename:** Live Notation Mode (LNM)
**Target surface:** Battle feature (`/battle` → `battle_room` screen)
**Document status:** Strategy & Design Specification

---

## 1. Executive Summary

Live Notation Mode is a shared-device move recorder that layers on top of the existing 1v1 Battle feature. When both players are locked into a battle room, either player can activate LNM to turn the app into a physical scoresheet replacement. The device is placed between the two players on the table. After each over-the-board move, the player whose turn it is mirrors that move on the in-app chessboard. The board automatically flips to the opponent's perspective the moment the move registers, creating a seamless pass-and-play notation flow. The completed PGN is stored against the battle record and becomes the foundation for post-game Stockfish analysis, opening identification, and shareable game reports.

---

## 2. Problem Statement

OTB chess players currently have no lightweight, purpose-built tool for recording moves during a casual battle. Paper scoresheets are slow, error-prone, and produce data that cannot be digitally analysed. The existing Battle feature already syncs two players, tracks the result, and persists history — but it captures no game content beyond the final score. Live Notation Mode closes this gap by converting the shared device into an intelligent scoresheet that is fast enough to use mid-game without disrupting the natural rhythm of play.

---

## 3. User Flow

The flow is designed around a single shared device placed flat on the table between the two players.

**Step 1 — Activation.** During an active battle room (both players joined, clock optionally running), a **"Record Moves"** toggle button appears in the battle room UI. Either player can tap it. A brief onboarding tooltip explains the pass-and-play mechanic and can be dismissed permanently.

**Step 2 — White's first move.** The board launches in White's orientation (White pieces at the bottom). White makes their physical move on the real board, then mirrors it on the app board by tapping the source square then the destination square. Standard chess rules are enforced — illegal moves are rejected with a subtle shake animation.

**Step 3 — Auto-flip.** The instant White's move is validated, the board animates a 180° flip to Black's orientation. A clear visual indicator ("Black to move") and a soft haptic pulse (where supported) signal the handoff. The device is now ready for Black to mirror their response.

**Step 4 — Repeat.** Players alternate mirroring moves. The move list (in algebraic notation) scrolls in a compact panel beside the board, giving both players a running game record.

**Step 5 — Game end.** When the game concludes — by checkmate, resignation, draw agreement, or clock flag-fall — LNM displays the completed PGN and a summary card showing move count, opening name, and a prompt to run post-game analysis.

**Step 6 — Analysis.** The PGN is saved to the battle record. A **"Analyse Game"** button navigates to the existing Game Analysis page (`/analysis`) pre-loaded with the recorded game.

---

## 4. UX Design Principles

The design must satisfy three constraints simultaneously: it must be fast enough to keep pace with a live game, large enough to be tappable under pressure, and unambiguous enough that neither player accidentally inputs the wrong move.

| Principle | Implementation |
|---|---|
| **Minimum taps per move** | Tap source square → tap destination square. No drag required. Promotion auto-selects Queen (most common); a one-tap override appears only when promotion is detected. |
| **Board orientation clarity** | The active player's colour is always at the bottom. A large coloured banner ("WHITE TO MOVE" / "BLACK TO MOVE") spans the top of the board area in the respective piece colour. |
| **Flip animation** | A 300 ms CSS 3D Y-axis rotation. Fast enough to feel instant, slow enough to communicate the handoff visually. Reduced-motion OS setting skips the animation and cross-fades instead. |
| **Undo safety** | A single "Undo Last Move" button is always visible. It requires a two-tap confirmation (tap → confirm) to prevent accidental undos during a tense game. |
| **Error feedback** | Illegal move attempts produce a red square highlight and a subtle shake on the selected piece. No modal or blocking dialog — the board stays interactive immediately. |
| **Distraction-free layout** | During LNM, the VS header, player cards, and result-reporting buttons are hidden. The screen is dominated by the board and the move list. A small "Exit Notation" button sits in the top-right corner. |

---

## 5. Technical Architecture

### 5.1 Client-side State

A new `useNotationMode` hook manages all LNM state locally during the game. It wraps the `chess.js` library (already available in the project via the Game Analysis page) to enforce rules, generate SAN notation, and produce the final PGN.

```
useNotationMode(battleCode, hostId, guestId)
  → { active, toggle, position, turn, moves, pgn, makeMove, undoMove, reset }
```

The hook exposes `position` as a FEN string (consumed by the board renderer) and `moves` as an array of `{ san, color, fen }` objects for the move list panel.

### 5.2 Board Renderer

The existing project uses a custom board component in the Game Analysis page. LNM will reuse or adapt this component as `<LiveNotationBoard>`, accepting:

| Prop | Type | Purpose |
|---|---|---|
| `fen` | `string` | Current position |
| `orientation` | `"white" \| "black"` | Which colour is at the bottom |
| `onMove` | `(from, to, promo?) => boolean` | Called on user tap; returns false if illegal |
| `lastMove` | `{ from, to } \| null` | Highlights the last move squares |
| `disabled` | `boolean` | Locks the board during flip animation |

### 5.3 Board Flip Logic

The `orientation` prop is derived directly from `chess.js`'s `turn()` method: `"white"` when it is White's move, `"black"` when it is Black's. This is a single derived value — no separate flip state is needed. The board re-renders with the new orientation immediately after `makeMove()` resolves, and the CSS flip animation runs on the board wrapper element.

### 5.4 PGN Persistence

When the game ends (or when the user taps "Save & Exit"), the client calls a new server endpoint:

```
PATCH /api/battles/:code/pgn
Body: { pgn: string }
```

The server writes the PGN to a new `pgn` column on the `battle_rooms` table. The existing `GET /api/battles/:code` polling endpoint is extended to return the `pgn` field, making it available to both players immediately after save.

### 5.5 Schema Change

One new column is added to `battle_rooms`:

```sql
ALTER TABLE battle_rooms ADD COLUMN pgn TEXT;
```

In Drizzle schema terms:

```typescript
pgn: text("pgn"),
```

No new table is required. The PGN string is the canonical game record — it encodes the full move history, result, and metadata in a standard format that the existing Game Analysis page already consumes.

### 5.6 Post-Game Analysis Integration

The Game Analysis page (`/analysis`) already accepts a PGN via URL query parameter or localStorage. After LNM saves the PGN, the "Analyse Game" button navigates to:

```
/analysis?source=battle&code=XXXX
```

The analysis page reads the PGN from the battle record via `GET /api/battles/:code` and loads it into the Stockfish engine. No changes to the analysis page are required for the initial release.

---

## 6. Feature Scope — Phase 1 (MVP)

The following scope is recommended for the initial build to keep the feature shippable in a single sprint.

| In Scope | Out of Scope (future) |
|---|---|
| Shared-device pass-and-play notation | Multi-device real-time sync of moves |
| Full legal move enforcement via chess.js | Premove support |
| Auto-flip on move registration | Manual flip button |
| SAN move list with scroll | PGN export to file |
| Queen auto-promotion with override | Promotion piece selector on first move |
| Undo last move (two-tap confirm) | Full move history navigation |
| PGN save to battle record | Automatic Stockfish analysis on save |
| "Analyse Game" deep-link to analysis page | In-LNM engine hints |
| Opening name display (from ECO lookup) | Opening explorer |
| Clock continues running during LNM | Clock pause during LNM |

---

## 7. Component Breakdown

The feature decomposes into five discrete, independently testable units.

| Component / Module | Responsibility |
|---|---|
| `useNotationMode` hook | chess.js wrapper; move validation; PGN generation; undo |
| `<LiveNotationBoard>` | Touch-friendly board renderer with flip animation |
| `<MoveListPanel>` | Scrolling SAN move list with last-move highlight |
| `<NotationModeOverlay>` | Full-screen LNM layout (board + move list + controls) |
| `PATCH /api/battles/:code/pgn` | Server endpoint for PGN persistence |

---

## 8. Accessibility & Edge Cases

**Screen rotation.** The board should be locked to portrait orientation during LNM using the Screen Orientation API where available. This prevents accidental landscape flips when the device is passed across the table.

**Accidental taps.** A 300 ms debounce is applied after each move registration to prevent a double-tap from registering two moves in rapid succession.

**Disconnection.** LNM state is held entirely client-side. If the browser tab is closed mid-game, the PGN up to that point is stored in `sessionStorage` under the key `otb_lnm_pgn_<battleCode>`. On re-opening the battle room, the user is offered the option to resume the saved game or start fresh.

**Checkmate / stalemate detection.** chess.js detects terminal positions automatically. LNM surfaces a clear end-state banner ("Checkmate — White wins" / "Stalemate — Draw") and disables the board, prompting the user to confirm the result and save.

**Promotion.** When a pawn reaches the back rank, LNM auto-selects Queen and registers the move immediately. A small "Change promotion piece" button appears for 3 seconds, allowing the player to override to Rook, Bishop, or Knight if needed.

---

## 9. Success Metrics

| Metric | Target |
|---|---|
| LNM activation rate among active battle rooms | ≥ 20% within 30 days of launch |
| PGN save completion rate (activated → saved) | ≥ 70% |
| "Analyse Game" click-through rate from LNM end screen | ≥ 40% |
| Undo usage per game (proxy for input error rate) | < 1.5 undos / game on average |
| User-reported input errors (support tickets) | < 5% of LNM sessions |

---

## 10. Recommended Build Order

The following sequence minimises integration risk and allows each step to be tested in isolation before the next begins.

1. **Schema migration** — add `pgn` column to `battle_rooms`, run `pnpm db:push`.
2. **Server endpoint** — `PATCH /api/battles/:code/pgn` with host-or-guest auth check.
3. **`useNotationMode` hook** — chess.js integration, move validation, PGN output, unit tests.
4. **`<LiveNotationBoard>`** — board renderer with flip animation, touch input, illegal move feedback.
5. **`<MoveListPanel>`** — scrolling notation list.
6. **`<NotationModeOverlay>`** — full-screen layout composing the above.
7. **Battle room integration** — "Record Moves" toggle, overlay mount/unmount, PGN save on exit.
8. **Post-game analysis deep-link** — "Analyse Game" button wired to `/analysis?source=battle&code=`.
9. **Unit tests** — hook logic, flip derivation, undo, promotion, terminal position detection.
10. **End-to-end smoke test** — full game from activation to analysis page.
