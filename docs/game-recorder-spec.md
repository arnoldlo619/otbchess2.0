# OTB Game Recorder + Post-Game Analysis

## Feature Specification — ChessOTB.club

**Author:** Manus AI | **Date:** March 2026 | **Version:** 1.0

---

## 1. Feature Strategy

### What It Does

The OTB Game Recorder is a mobile-first module that allows players at ChessOTB.club events or casual over-the-board matchups to **record their physical chess game using their phone camera**, then receive a fully synchronized **post-game analysis experience** after the game ends. The system captures video, reconstructs the game into standard PGN notation, runs engine analysis, and presents an interactive review interface that pairs the original video footage with a digital board, evaluation bar, and annotated move list.

### Who It Is For

This feature targets three primary user segments. First, **competitive club players** who want to review their OTB games with the same depth they get from online play. Second, **casual players** who play in-person games at cafes, parks, or homes and want a record of their games without maintaining a physical scoresheet. Third, **tournament directors** who want to offer participants an automatic game archive as a premium perk of their ChessOTB.club events.

### Why It Matters for ChessOTB.club

ChessOTB.club currently excels at tournament organization — pairing, scoring, and reporting. The Game Recorder extends the platform's value proposition from "before and during the tournament" into the **post-game experience**, which is where players spend the most time learning and improving. This creates a retention loop: players return to ChessOTB.club not just for the next tournament, but to review and share their past games. It also differentiates ChessOTB.club from competing platforms by bridging the gap between physical and digital chess in a way that Chess.com and Lichess do not.

### MVP Scope

The MVP is deliberately constrained to deliver a complete, polished experience within a narrow scope. The following table defines what the MVP includes and excludes.

| Included in MVP | Excluded from MVP |
|---|---|
| Single phone camera recording per session | Multi-camera or multi-board recording |
| Post-game analysis only (no live engine) | Live engine suggestions during play |
| Standard chess only (no variants) | Chess960, Bughouse, or other variants |
| One board visible in frame | Multiple boards in a single recording |
| Manual PGN entry as primary input | Fully automated vision-only reconstruction |
| AI-assisted board detection (best-effort) | Guaranteed perfect detection accuracy |
| Manual correction flow for uncertain moves | No-correction-needed guarantee |
| Video + board sync playback | Live broadcast or streaming |
| Fair-play-safe positioning (post-game only) | Anti-cheat claims or enforcement |

---

## 2. User Experience Flow

The user journey consists of seven distinct screens, each designed for a single purpose with clear progression. The flow is linear for the MVP, with the analysis screen serving as the destination where users spend the most time.

### Screen 1: Entry Point — "Record OTB Game"

**Purpose:** Introduce the feature and provide the entry CTA from any game or matchup context.

**Key UI Elements:** A prominent card or button labeled "Record OTB Game" with a camera icon, placed on the tournament matchup page, the player's game history, or as a standalone entry in the main navigation. A brief tagline reads: *"Capture your game. Get engine analysis. No scoresheet needed."*

**Primary CTA:** "Start Recording Setup"

**States:**
- *Default:* Card with icon, title, and tagline
- *Disabled:* If user has an in-progress recording session (shows "Continue Recording" instead)
- *Post-game:* If a completed recording exists, shows "View Analysis" link

**Microcopy:** "Record your OTB game with your phone camera. We'll handle the rest."

### Screen 2: Guided Setup

**Purpose:** Walk the user through the physical setup before recording begins. This screen is critical for maximizing successful video capture.

**Key UI Elements:** A step-by-step checklist with visual illustrations for each requirement. The checklist includes: (1) place phone on a tripod or stable surface at a side angle, (2) ensure all four corners of the board are visible, (3) check that lighting is adequate and even, and (4) confirm the board is a standard chess set with distinguishable pieces.

**Primary CTA:** "Open Camera" (transitions to framing screen)

**States:**
- *Default:* Checklist with expandable tips for each item
- *Returning user:* "Skip Setup" link for experienced users

**Microcopy:** "A steady side-angle view works best. Place your phone where it won't get bumped."

### Screen 3: Board Framing

**Purpose:** Help the user position the camera so the board is properly framed before recording starts.

**Key UI Elements:** Live camera preview with an overlay guide showing the ideal board position. Four corner markers indicate where the board corners should align. A status indicator shows detection confidence: "Board Detected" (green), "Adjust Position" (amber), or "Board Not Found" (red). Lighting quality indicator. A "Flip Camera" button for front/rear camera switching.

**Primary CTA:** "Start Recording" (enabled only when board is detected)

**States:**
- *Detecting:* Pulsing overlay with "Looking for board…"
- *Detected:* Green corner markers, "Board Detected" badge, CTA enabled
- *Poor framing:* Amber markers with specific guidance ("Move phone to the right")
- *No board:* Red state with "Make sure the full board is visible"

**Microcopy:** "Line up the board corners with the guides. Keep the camera steady."

### Screen 4: Recording In Progress

**Purpose:** Minimal UI during active recording so the phone can be left unattended.

**Key UI Elements:** A small floating status bar showing elapsed time, a red recording indicator dot, and a "Stop Recording" button. The screen stays awake (wake lock). Optional: a small live board preview showing detected positions in real-time (Phase 2 feature).

**Primary CTA:** "Stop Recording" (with confirmation dialog)

**States:**
- *Recording:* Timer counting up, red dot pulsing
- *Paused:* "Resume" and "Stop" buttons (if pause is supported)
- *Low battery warning:* Amber banner suggesting the user plug in

**Microcopy:** "Recording in progress. You can leave your phone here — we'll keep watching."

### Screen 5: Upload & Processing

**Purpose:** Handle video upload and game reconstruction, keeping the user informed of progress.

**Key UI Elements:** A multi-step progress indicator showing: (1) Uploading video, (2) Detecting board positions, (3) Reconstructing moves, (4) Running engine analysis. Each step shows a progress bar or spinner. Estimated time remaining. A "Cancel" option.

**Primary CTA:** "View Analysis" (appears when processing completes)

**States:**
- *Uploading:* Progress bar with percentage and upload speed
- *Processing:* Step-by-step progress with current step highlighted
- *Needs Correction:* Transitions to Manual Correction screen
- *Complete:* Success animation, "View Analysis" CTA
- *Failed:* Error message with "Try Again" and "Enter Moves Manually" options

**Microcopy:** "Sit tight — we're reconstructing your game. This usually takes 2–3 minutes."

### Screen 6: Manual Correction

**Purpose:** Allow the user to resolve moves that the AI could not confidently determine.

**Key UI Elements:** A digital board showing the position at the uncertain move. The video frame corresponding to that moment. Two or three candidate moves presented as buttons (e.g., "Bg5" vs "Bh4"). A "Skip" option that accepts the AI's best guess. Progress indicator showing how many corrections remain.

**Primary CTA:** "Confirm Move" (for each correction) → "Finish Corrections" (when all resolved)

**States:**
- *Correction needed:* Board + video frame + candidate moves
- *All resolved:* Success message, transition to analysis
- *Skipped:* AI's best guess is used, marked with a confidence indicator

**Microcopy:** "Move 18 was unclear. Did White play Bg5 or Bh4? Check the video to confirm."

### Screen 7: Post-Game Analysis

**Purpose:** The destination screen — a rich, interactive analysis experience that synchronizes the recorded video with a digital board, evaluation bar, and annotated move list.

**Key UI Elements:** This is the most complex screen and is detailed in Section 5 below.

---

## 3. Guided Recording Setup — Design Concept

The setup assistant uses a "smart checklist" pattern that feels helpful without being patronizing. Each checklist item has three states: unchecked (grey), checking (amber pulse), and confirmed (green check). The system uses the camera feed to automatically validate items where possible (board detection, lighting level) while leaving physical setup items (tripod placement) as manual confirmations.

The setup screen is divided into two zones. The top half shows the live camera preview with overlay guides. The bottom half shows the checklist with expandable detail cards. Each card contains a single illustration (line art, not photos) showing the correct setup, a one-sentence instruction, and a "Why this matters" expandable section for curious users.

The pre-check validation system works as follows. **Board detection** uses a lightweight client-side model that identifies the four corners of a chessboard in the camera frame. It does not need to identify individual pieces at this stage — just the board geometry. **Angle assessment** checks that the board is viewed from approximately 30–60 degrees from horizontal (side angle), not directly overhead. **Lighting assessment** checks the camera feed's brightness histogram to ensure adequate, even lighting. **Stability assessment** uses the device's gyroscope/accelerometer to confirm the phone is stationary.

These checks run continuously while the camera is active and update the checklist items in real-time. The "Start Recording" button is enabled once the board is detected and the angle is acceptable. Lighting and stability are advisory (amber warnings) rather than blocking.

---

## 4. Video Processing + Game Reconstruction System

The processing pipeline is designed as a sequence of discrete, resumable stages. Each stage produces an intermediate artifact that can be inspected, cached, or retried independently.

### Pipeline Architecture

```
Video Upload → Frame Extraction → Board Detection → Perspective Normalization
    → Piece Classification → Move Inference → PGN Generation → Engine Analysis
```

**Stage 1 — Video Upload.** The recorded video is uploaded to S3 via the platform's existing `storagePut` helper. The upload uses chunked transfer to handle large files (a 2-hour game at 720p is approximately 2–4 GB). A `RecordingSession` record is created in the database with status `uploading`.

**Stage 2 — Frame Extraction.** The server extracts frames at 1-second intervals using FFmpeg. For a 2-hour game this produces approximately 7,200 frames. Frames are stored as JPEG thumbnails in S3. Status updates to `extracting_frames`.

**Stage 3 — Board Detection.** Each frame is processed to detect the chessboard's four corners using a combination of edge detection (Canny) and line detection (Hough transform). Frames where the board is not detected (e.g., a hand is blocking the view) are marked as "occluded" and skipped. The output is a set of "clean frames" with board corner coordinates.

**Stage 4 — Perspective Normalization.** Using the detected corners, each clean frame is warped to a top-down 400x400 pixel view of the board using a homographic transformation. This normalizes the perspective regardless of the original camera angle.

**Stage 5 — Piece Classification.** Each normalized board image is divided into a 8x8 grid of 50x50 pixel squares. A classification model identifies the piece on each square (or empty). The model outputs a FEN string for each frame. For the MVP, this can use a pre-trained CNN model or leverage an external API like the chess-snapshot-api.

**Stage 6 — Move Inference.** The sequence of FEN strings is analyzed to detect state changes between consecutive frames. When the board state changes, the system identifies which piece moved and to which square. The chess.js library validates that each inferred move is legal. If a move is illegal or ambiguous, it is flagged for manual correction with a confidence score.

**Stage 7 — PGN Generation.** The validated move sequence is compiled into standard PGN format using chess.js. Timestamps from the video are attached to each move for synchronization.

**Stage 8 — Engine Analysis.** The final PGN is sent move-by-move to the Chess-API.com Stockfish REST API (free tier, depth 12–18). Each position is evaluated for: centipawn evaluation, best move, win probability, and classification (best move, good, inaccuracy, mistake, blunder). The analysis results are stored alongside the PGN.

### MVP Simplification

For the MVP, the full computer vision pipeline (Stages 3–6) is treated as a **best-effort enhancement**. The primary input method is **manual PGN entry** — the user can type or paste their game's moves directly. The video recording and sync features work independently of the vision pipeline, meaning users get the full analysis experience even if they enter moves manually. The vision pipeline runs in the background and, when successful, auto-populates the move list. When it fails or is uncertain, it falls back to the manual correction flow.

---

## 5. Post-Game Analysis Experience

The analysis screen is the crown jewel of this feature. It combines five synchronized components into a cohesive review experience.

### Layout Structure

On **mobile** (primary), the layout is a vertical stack:
1. Video player (16:9, collapsible)
2. Digital chessboard (square, full-width)
3. Evaluation bar (horizontal, below board)
4. Move list (scrollable, with current move highlighted)
5. Engine summary panel (collapsible)

On **desktop**, the layout uses a two-column arrangement:
- Left column: Video player (top) + Digital chessboard (bottom)
- Right column: Move list (top) + Eval bar (vertical, sidebar) + Engine summary (bottom)

### Component Details

**Video Player.** Standard HTML5 video player with custom controls matching the ChessOTB.club design system. Supports play/pause, scrub, playback speed (0.5x, 1x, 2x), and fullscreen. The current timestamp is linked to the move list — scrubbing the video advances the board position, and clicking a move in the list seeks the video to the corresponding timestamp.

**Digital Chessboard.** Rendered using the `react-chessboard` library with a custom theme matching ChessOTB.club's green/white palette. Shows the current position with the last move highlighted (green squares for from/to). Supports flip board (toggle White/Black perspective). Arrow overlays show the engine's suggested best move. Piece animations on move transitions.

**Evaluation Bar.** A horizontal bar (mobile) or vertical bar (desktop) showing the engine's centipawn evaluation. The bar fills from left-to-right (or bottom-to-top) with white representing White's advantage and dark representing Black's advantage. Numerical evaluation displayed at the current position. Color transitions smoothly between moves. Mate-in-N is shown as "M3" style notation.

**Move List.** A two-column grid showing move pairs (1. e4 e5, 2. Nf3 Nc6, etc.). Each move is clickable to jump to that position. Moves are color-coded by engine classification: green (best/good), yellow (inaccuracy), orange (mistake), red (blunder). The current move is highlighted with a background color. The list auto-scrolls to keep the current move visible.

**Engine Summary Panel.** A collapsible card at the bottom showing aggregate game statistics: accuracy percentage for each player, total inaccuracies/mistakes/blunders, opening name and ECO code (if identified), average centipawn loss, and a "Key Moments" section highlighting the 3–5 most significant evaluation swings.

### Timestamp Synchronization

Each move in the PGN is tagged with a video timestamp (in seconds) during the reconstruction phase. The synchronization system works bidirectionally:

- **Video → Board:** As the video plays, the system checks the current timestamp against the move timestamp array and advances the board to the corresponding position. A small tolerance window (±2 seconds) prevents jitter.
- **Board → Video:** When the user clicks a move in the move list, the video seeks to the timestamp associated with that move. The board updates immediately (no waiting for the video to catch up).

This creates a seamless experience where the user can watch their physical game while seeing the engine's evaluation of each position in real-time.

---

## 6. Manual Correction Flow

The correction flow is designed to be **fast and forgiving**. The goal is to salvage imperfect reconstructions rather than forcing the user to re-record or abandon the game.

### Correction UI

When the AI flags uncertain moves, the user is presented with a focused correction interface. The screen shows the board position just before the uncertain move, the video frame at the corresponding timestamp, and 2–3 candidate moves that the AI considers plausible. The user taps the correct move, and the board advances. If none of the candidates are correct, a "Different Move" button opens a mini-board where the user can drag the piece to the correct square.

The correction flow is **non-blocking** — the user can skip any correction, and the AI's best guess is used. Skipped corrections are marked with a low-confidence indicator in the move list so the user knows which moves may be inaccurate.

### Correction Batching

Rather than interrupting the user at each uncertain move, the system batches all corrections and presents them sequentially after processing completes. A progress indicator shows "3 of 7 moves need your help" and counts down as corrections are resolved. This keeps the flow feeling productive rather than frustrating.

---

## 7. Data Model

The data model introduces five new entities that integrate with the existing ChessOTB.club schema.

| Entity | Key Fields | Purpose |
|---|---|---|
| `RecordingSession` | id, userId, tournamentId (nullable), status, videoKey (S3), createdAt | Top-level container for a recording attempt |
| `ProcessedGame` | id, sessionId, pgn, moveTimestamps (JSON), openingName, openingEco, totalMoves | The reconstructed game data |
| `MoveAnalysis` | id, gameId, moveNumber, color, san, fen, eval, bestMove, classification, winChance | Per-move engine analysis results |
| `CorrectionEntry` | id, gameId, moveNumber, candidateMoves (JSON), chosenMove, confidence, skipped | Tracks AI uncertainty and user corrections |
| `GameMetadata` | id, gameId, whitePlayer, blackPlayer, result, date, event, timeControl | Standard chess game metadata |

### Status System

The `RecordingSession.status` field uses a finite set of values that drive the UI across the entire feature.

| Status | Description | UI State |
|---|---|---|
| `ready` | Session created, no recording yet | Show "Start Recording" |
| `recording` | Camera is actively capturing | Show recording indicator |
| `uploading` | Video is being uploaded to S3 | Show upload progress |
| `processing` | Server is running the vision pipeline | Show processing steps |
| `needs_correction` | AI flagged uncertain moves | Show correction flow |
| `analyzing` | Engine analysis is running | Show analysis progress |
| `complete` | Full analysis is ready | Show "View Analysis" |
| `failed` | Processing failed irrecoverably | Show error + retry options |

---

## 8. Product Copy

### Feature Introduction
> **Your game. Analyzed.**
> Record your over-the-board chess game with your phone. We'll reconstruct every move and run Stockfish analysis — so you can review your game like the pros do.

### Setup Instructions
> **Quick Setup**
> Place your phone on a tripod or stable surface at a side angle to the board. Make sure all four corners are visible and the lighting is even. That's it — we'll handle the rest.

### Processing State
> **Reconstructing your game…**
> We're watching your video frame by frame, identifying each move, and building your game record. This usually takes a couple of minutes.

### Correction Prompt
> **We need your help with a few moves.**
> Our AI wasn't 100% sure about some moves. Take a quick look at the video and confirm what happened. It only takes a moment.

### Post-Game Success
> **Your analysis is ready.**
> Every move has been evaluated by Stockfish. Tap any move to see what the engine thinks — and watch the moment it happened in your video.

### Fair Play Messaging
> **Built for learning, not cheating.**
> The Game Recorder is a post-game tool. It never provides engine assistance during play. Record your game, finish it fairly, then review it with full engine analysis afterward.

---

## 9. Technical Implementation Direction

### Frontend Architecture

The feature adds four new route-level pages and six new components to the existing React + Vite application.

**New Pages:**
- `/record` — Entry point + guided setup
- `/record/camera` — Board framing + active recording
- `/record/:sessionId/processing` — Upload and processing status
- `/game/:gameId/analysis` — Post-game analysis review

**New Components:**
- `CameraPreview` — Live camera feed with board detection overlay
- `RecordingControls` — Floating timer + stop button during recording
- `AnalysisBoard` — react-chessboard wrapper with ChessOTB.club theme
- `EvalBar` — Horizontal/vertical evaluation visualization
- `MoveList` — Clickable, color-coded move list with auto-scroll
- `CorrectionCard` — Board + video frame + candidate move buttons

**New Libraries:**
- `chess.js` — Move validation, PGN parsing, FEN manipulation
- `react-chessboard` — Interactive board rendering
- No additional heavy dependencies required

### Backend Architecture

**API Routes (new):**
- `POST /api/recordings` — Create a new recording session
- `GET /api/recordings/:id` — Get session status and metadata
- `POST /api/recordings/:id/upload` — Upload video (chunked, to S3)
- `POST /api/recordings/:id/pgn` — Submit manually entered PGN
- `POST /api/recordings/:id/corrections` — Submit move corrections
- `GET /api/games/:id/analysis` — Get full analysis results

**Processing Pipeline:**
The video processing runs as an async job triggered after upload completes. For the MVP, the pipeline is simplified: the server extracts key frames, attempts board detection using a lightweight model, and falls back to manual PGN entry if detection confidence is low. Engine analysis is performed by calling the Chess-API.com Stockfish REST API for each position in the game.

**File Storage:**
All video files and extracted frames are stored in S3 using the platform's existing `storagePut`/`storageGet` helpers. Videos are stored under the key pattern `recordings/{sessionId}/video.webm`. Extracted frames use `recordings/{sessionId}/frames/{frameNumber}.jpg`.

### Engine Integration

The Chess-API.com free Stockfish API is used for position analysis. For each move in the game, a POST request is sent with the FEN position. The API returns the evaluation, best move, continuation line, and win probability. To classify moves, the system compares the player's actual move evaluation against the best move evaluation. The classification thresholds are:

| Classification | Centipawn Loss |
|---|---|
| Best Move | 0 cp |
| Good | 0–30 cp |
| Inaccuracy | 30–100 cp |
| Mistake | 100–300 cp |
| Blunder | 300+ cp |

### Async Job Status Updates

The processing pipeline updates the `RecordingSession.status` field at each stage. The client polls `GET /api/recordings/:id` every 3 seconds during processing to check for status changes. In a future iteration, this can be upgraded to WebSocket push notifications for real-time updates.

---

## 10. Future Roadmap

After the MVP is stable and validated with real users, the following expansions are planned in priority order.

**Phase 2 — Enhanced Vision Pipeline.** Improve board detection accuracy with a custom-trained model. Add real-time board detection status during recording (live position preview). Support overhead camera angles in addition to side angles.

**Phase 3 — Social and Sharing.** Allow users to share analyzed games with a public link. Generate automatic highlight clips of the game's most dramatic moments (biggest eval swings). Add game comments and annotations that other users can view.

**Phase 4 — Club Integration.** Automatic game archive for all tournament games. Club leaderboards based on recorded game statistics (accuracy, improvement over time). Coach review tools — a designated coach can annotate a student's game with comments and suggested alternatives.

**Phase 5 — Personal Analytics.** Track a player's accuracy, opening repertoire, and common mistake patterns over time. Generate monthly improvement reports. Identify recurring tactical themes the player misses.

**Phase 6 — Advanced Features.** Multi-board recording for tournament directors. Live broadcast integration (stream the reconstructed game to spectators in real-time). Support for Chess960 and other variants.

---

## 11. MVP Build Plan

The MVP is scoped for implementation in the following order. Each phase produces a usable increment.

| Phase | Scope | Deliverable |
|---|---|---|
| **A. Data Model + API** | Database schema, API routes, status system | Backend foundation |
| **B. Recording UI** | Setup flow, camera preview, recording controls | Video capture capability |
| **C. Manual PGN Entry** | PGN input form, chess.js validation, game creation | Primary game input method |
| **D. Engine Analysis** | Chess-API.com integration, per-move evaluation, classification | Analysis data generation |
| **E. Analysis UI** | Board, eval bar, move list, engine summary | Core review experience |
| **F. Video Sync** | Timestamp mapping, bidirectional sync, video player | Video + board synchronization |
| **G. Correction Flow** | Candidate move UI, batch corrections, confidence indicators | Error recovery |
| **H. Vision Pipeline** | Frame extraction, board detection, move inference | AI-assisted reconstruction |

Phases A through F constitute the core MVP. Phase G adds resilience. Phase H adds the AI magic but is not required for a functional product — manual PGN entry covers the gap.

---

*This specification is a living document. It will be updated as implementation progresses and user feedback is gathered.*
