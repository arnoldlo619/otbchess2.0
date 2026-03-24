# Live Notation Mode — Clock Behaviour Analysis

**Companion to:** Live Notation Mode Feature Strategy
**Scope:** Detailed comparison of the two clock behaviour options during move notation input

---

## 1. The Core Tension

The chess clock and the notation board serve opposite masters. The clock is adversarial — it punishes slowness and creates urgency. The notation board is cooperative — it asks both players to pause their competitive mindset for a moment and accurately record what just happened. Asking these two systems to coexist on the same shared device without a clear protocol for how they interact is the central design problem this document addresses.

The existing `ChessClock` component already contains a `paused` boolean state and a `handlePauseResume()` function. The `requestAnimationFrame` tick loop checks `paused` on every frame and simply stops decrementing when it is `true`. This means the infrastructure for pausing already exists — the question is not *whether* it is technically feasible, but *which behaviour produces the better experience* for players who are recording a live OTB game.

---

## 2. Option A — Clock Continues Running

Under this model, activating Live Notation Mode has no effect on the clock. The `active` side continues to count down while the player mirrors their move on the app board. The clock only switches sides when the player taps their physical clock button — exactly as it does today, independent of LNM.

### 2.1 How It Works

The clock and the notation board operate as two entirely separate systems. The clock is driven by physical clock taps (as it is today). The notation board is driven by tapping source and destination squares on the app board. Neither system knows about the other. The only shared context is the battle room code.

This means the player's workflow becomes:

1. Make physical move on the real board.
2. Tap physical clock button (clock switches to opponent's time).
3. Pick up the shared device and mirror the move on the app board.
4. Pass the device to the opponent.

Steps 2 and 3 can happen in either order — the systems are decoupled.

### 2.2 Advantages

The primary advantage is **zero added complexity**. No new state, no new API calls, no synchronisation problem. The clock behaves identically whether LNM is active or not. This is also the closest analogue to how paper scoresheets work in real OTB tournaments: the clock runs continuously, and players record moves on their own time without any formal pause mechanism.

There is also a **competitive integrity argument** for this approach. In FIDE-rated play, players are required to record moves while the clock is running. Allowing the clock to pause for notation would create an artificial time advantage — players could take as long as they liked to input moves without any time cost. For players who care about the integrity of their time control, the continuous clock is the more authentic option.

Finally, this option **eliminates a coordination problem**. If the clock pauses automatically when LNM is activated, both players need to agree on when it resumes. In a tense game, this could become a source of dispute.

### 2.3 Disadvantages

The main disadvantage is **cognitive load**. After making a physical move, the active player must tap the clock, then pick up the device, then find the source square, then tap the destination square — all while their opponent's clock is now running and the pressure of the game continues. For faster time controls (bullet: 1+0, 2+1; blitz: 3+0, 5+0), this is a realistic problem. A player on 30 seconds cannot afford to spend 5 seconds mirroring a move on the app board.

This creates a **time control dependency**: the continuous clock is viable for rapid (10+ minutes) but becomes increasingly impractical as the time control shortens. The feature would effectively be self-selecting — only rapid players would use it, while bullet and blitz players would disable LNM or ignore it.

There is also a **notation accuracy risk**. Under time pressure, players may rush the notation input, increasing the likelihood of tapping the wrong square. An incorrect move entered into the app board is worse than no record at all, because it corrupts the PGN and makes post-game analysis meaningless.

---

## 3. Option B — Clock Auto-Pauses During Notation Input

Under this model, the clock automatically pauses the moment a player begins mirroring a move on the app board (specifically, when they tap the source square on the `<LiveNotationBoard>`). The clock resumes the moment the move is validated and the board flips to the opponent's orientation.

### 3.1 How It Works

The `useNotationMode` hook exposes an `inputting` boolean that is `true` from the moment the source square is selected until the move is validated or cancelled. The `ChessClock` component accepts a new optional prop, `externalPause: boolean`, which is ORed with the internal `paused` state in the tick loop:

```typescript
// Modified tick condition in ChessClock
if (active && !(paused || externalPause) && !flagFallen) {
  // decrement active side
}
```

The `inputting` value from `useNotationMode` is passed as `externalPause` to `ChessClock`. This keeps the pause logic entirely within the clock component — the notation hook does not need to know anything about the clock's internal state.

The player's workflow becomes:

1. Make physical move on the real board.
2. Tap physical clock button (clock switches to opponent's time — or this step is skipped entirely; see Section 3.4).
3. Pick up the shared device and tap the source square on the app board. **Clock pauses.**
4. Tap the destination square. Move validates. Board flips. **Clock resumes on the opponent's time.**
5. Pass the device to the opponent.

### 3.2 Advantages

The dominant advantage is **time pressure elimination during input**. Players can take the time they need to accurately mirror their move without burning clock time. This is especially valuable for complex positions where the piece that moved might not be immediately obvious on a small phone screen.

This also makes LNM **viable across all time controls**, including blitz. A player on 2 minutes can activate LNM without feeling that notation is costing them the game. This directly expands the addressable user base for the feature.

From an accuracy standpoint, removing time pressure during input is expected to significantly reduce the undo rate. The LNM strategy document targets fewer than 1.5 undos per game on average — auto-pause is the mechanism most likely to achieve that target.

### 3.3 Disadvantages

The principal disadvantage is **implementation complexity**. The `externalPause` prop must be threaded through `ChessClock` and, critically, through `FullScreenClock` as well — since the full-screen overlay has its own independent `requestAnimationFrame` loop and its own `paused` state. The `onStateChange` callback that currently syncs state from `FullScreenClock` back to `ChessClock` would need to be extended, or the `externalPause` signal would need to be passed as a prop to `FullScreenClock` directly.

There is also a **pause abuse risk** in competitive contexts. A player who is losing on time could theoretically tap the source square on the app board and hold it there, keeping the clock paused indefinitely. This is mitigated by a **maximum pause duration** — if the source square is selected but no destination is tapped within, say, 10 seconds, the clock resumes and the selection is cancelled. This timeout is configurable and should be surfaced as a setting for competitive use.

Finally, there is a subtle **clock-switching ambiguity**. Under the continuous clock model, the physical clock tap is the canonical signal for switching sides. Under auto-pause, the app board move validation also implicitly switches the active clock side (because the board flips to the opponent's orientation, and the clock should now be running on the opponent's time). If the player also taps the physical clock, the clock would switch twice. The resolution is that **LNM and the physical clock tap are mutually exclusive signals**: when LNM is active, the app board move validation is the clock-switch trigger, and the physical clock tap buttons in the app UI are hidden or disabled during LNM.

### 3.4 The Clock-Switch Unification Opportunity

Auto-pause opens a more elegant design: **move validation as the clock-switch event**. When a player validates a move on the app board, the clock automatically switches to the opponent's side at the same moment the board flips. The player no longer needs to tap the physical clock button and then mirror the move — the two actions are collapsed into one. The workflow becomes:

1. Make physical move on the real board.
2. Mirror the move on the app board. **Clock switches and board flips simultaneously.**
3. Pass the device to the opponent.

This is a meaningfully simpler interaction model. It also eliminates the risk of a player forgetting to tap the physical clock after mirroring, which would leave the wrong player's time running.

The trade-off is that it **decouples the app clock from the physical clock**. If the physical clock on the table is also running (which it often is in informal play), the two clocks will diverge slightly because the app clock switches on move validation rather than on the physical tap. For players who care about clock accuracy, this is a problem. For players who are using the app clock as their primary timekeeper, it is a feature.

---

## 4. Comparison Summary

| Dimension | Option A: Clock Continues | Option B: Clock Auto-Pauses |
|---|---|---|
| **Implementation effort** | Minimal — no changes to ChessClock | Moderate — `externalPause` prop + FullScreenClock sync |
| **Viable for bullet/blitz** | No — notation takes too long under pressure | Yes — pause eliminates time cost |
| **Viable for rapid** | Yes | Yes |
| **Notation accuracy** | Lower — time pressure causes rushed input | Higher — no time pressure during input |
| **Competitive integrity** | High — matches FIDE scoresheet rules | Lower — introduces a pause mechanism |
| **Pause abuse risk** | None | Present — mitigated by 10s timeout |
| **Clock-switch unification** | Not applicable | Possible — move validation triggers switch |
| **Coordination required** | None | Clock-switch model must be agreed upfront |
| **Undo rate (estimated)** | Higher | Lower |

---

## 5. Recommended Approach

The recommended approach is **Option B with clock-switch unification**, implemented with a 10-second input timeout as an abuse safeguard. The reasoning is straightforward: Live Notation Mode's primary value proposition is the PGN it produces for post-game analysis. A corrupted PGN — caused by rushed input under time pressure — destroys that value entirely. Auto-pause is the mechanism that protects PGN accuracy, and PGN accuracy is the feature's reason for existing.

The implementation is not significantly more complex than Option A. The `externalPause` prop is a single boolean that threads through two components. The `FullScreenClock` already receives all its initial state via props and reports changes via `onStateChange` — adding `externalPause` to that contract is a small, well-contained change.

The competitive integrity concern is real but contextually limited. LNM is designed for informal 1v1 battles, not FIDE-rated play. Players who want strict clock discipline can simply not activate LNM. The feature is opt-in, and the pause behaviour is transparent — both players see the clock freeze during input, so there is no hidden advantage.

---

## 6. Implementation Checklist

The following changes are required to implement Option B with clock-switch unification.

| File | Change |
|---|---|
| `ChessClock.tsx` | Add `externalPause?: boolean` prop; OR it into the tick loop condition and the warning tick condition |
| `FullScreenClock.tsx` | Add `externalPause?: boolean` prop; pass it through to its own tick loop |
| `useNotationMode.ts` | Expose `inputting: boolean` (true from source-square tap until move validates or 10s timeout) |
| `NotationModeOverlay.tsx` | Pass `inputting` as `externalPause` to `<ChessClock>`; hide clock-tap buttons while LNM is active |
| `Battle.tsx` | Wire `externalPause` from `useNotationMode` into the `<ChessClock>` instance in the battle room screen |

The 10-second input timeout is implemented inside `useNotationMode` using a `useEffect` that clears the source-square selection and sets `inputting = false` if no destination is tapped within the window. The timeout duration should be stored as a named constant (`LNM_INPUT_TIMEOUT_MS = 10_000`) so it can be adjusted without a code search.
