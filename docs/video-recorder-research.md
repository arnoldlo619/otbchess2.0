# Video Recorder Research Notes

## ChessCam (chesscam.net) — Key Technical Findings

### Camera Setup Requirements
- Camera placed **to the side** of the board (not overhead)
- Camera must see **all 4 corners** of the board
- Stand must be **stable** — camera movement mid-game breaks detection
- 0.5x zoom recommended for wider field of view
- Tallest piece (king/queen) must be visible even on far squares

### Illegal Moves
- Illegal moves are currently **ignored** (silently skipped)
- Plans to raise alert when illegal move detected

### Architecture (from open source repo: dinatamas/chesscam)
- Python-based CV application
- Detects chessboard on video feed
- Follows moves made during game
- Uses frame-by-frame analysis

### Processing Pipeline (inferred)
1. Board corner detection (Hough lines + homography)
2. Perspective transform to top-down view
3. Square-by-square piece classification
4. Move detection by comparing consecutive frames
5. FEN reconstruction → PGN generation

## MediaRecorder API — Key Constraints

### Mobile Browser Support
- `getUserMedia({ video: { facingMode: 'environment' } })` → rear camera
- Works in Chrome, Safari (iOS 14.3+), Firefox Android
- **HTTPS required** (or localhost)
- **PWA standalone mode**: some WebKit bugs with camera in standalone mode
  - Workaround: use `display: minimal-ui` in manifest instead of `standalone`

### Video Quality Constraints
- Can request specific resolution: `{ width: { ideal: 1920 }, height: { ideal: 1080 } }`
- Can request frame rate: `{ frameRate: { ideal: 30 } }`
- Actual resolution depends on device capabilities

### MediaRecorder
- Records to Blob (webm/mp4 depending on browser)
- `ondataavailable` fires at specified intervals for chunked upload
- `onstop` fires when recording ends
- File size: ~100MB per hour at 1080p

### Wake Lock API
- `navigator.wakeLock.request('screen')` prevents screen sleep during recording
- Must be re-acquired after page visibility change

## CV Architecture Options

### Option A: Server-Side Processing (Recommended for MVP)
- User records video → uploads to S3
- Python FastAPI microservice processes video
- Returns PGN + confidence scores
- Pros: No client-side compute, works on any device
- Cons: Upload time, processing latency (5-15 min for 1hr game)

### Option B: Real-Time Client-Side (Future)
- TensorFlow.js with ONNX model in browser
- Process frames in real-time during recording
- Pros: Instant results, no upload
- Cons: Battery drain, requires powerful device, model size (~50MB)

### Option C: Hybrid (Best Long-Term)
- Client-side: board detection + framing guide (lightweight)
- Server-side: piece classification + move extraction (heavy)

## YOLOv8 for Chess Pieces
- YOLOv8-nano: ~6MB model, fast inference
- Pre-trained chess piece datasets available on Roboflow
- 13 classes: empty, wP, wN, wB, wR, wQ, wK, bP, bN, bB, bR, bQ, bK
- Accuracy: ~95% on standard sets, ~80% on unusual/wooden sets
- Failure modes: hands, reflections, unusual piece designs, low light

## Board Detection (OpenCV)
- Canny edge detection → Hough line transform → find grid
- Homography to normalize perspective
- Works well from side angle (45-60 degrees)
- Fails when: board partially obscured, extreme angles, poor lighting

## Frame Sampling Strategy
- Don't process every frame (too slow)
- Sample at 1-2 fps for move detection
- Detect "stable" frames (no motion blur, no hands)
- Compare stable frames to detect piece changes

## Confidence Scoring
- Per-move confidence based on:
  - Board detection confidence (corner visibility)
  - Piece classification confidence (YOLOv8 score)
  - Move legality (chess.js validation)
- Low confidence → flag for manual correction

## Existing Tools
- ChessCam (chesscam.net): Upload video → get PGN
- Chessify Scanner: Photo → position
- Chessvision.ai: Browser extension for position analysis
- chess-snapshot-api: REST API for board detection

## Key UX Insights from ChessCam
- Side-view (not overhead) is the recommended angle
- 0.5x wide-angle zoom helps capture full board
- Stable mount is critical — movement breaks detection
- All 4 corners must be visible throughout
- Processing happens after game ends (not real-time)
