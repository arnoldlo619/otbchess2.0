# OTB Game Recorder — Research Notes

## Chess Board Detection / Vision APIs

### ChessCam (chesscam.net)
- **Open source** (GitHub), free to use
- Records video of OTB chess game, processes to PGN
- Requires static video with all 4 corners visible
- Side-angle recording recommended
- Uses phone camera with cheap tripod
- Processes at ~6 FPS on mid-end devices
- Features: corner detection, manual corner adjustment, PGN export, live 2D board display
- Can export to Lichess study
- **Key limitation**: runs client-side in browser, not an API service

### Chessvision.ai
- Commercial product, subscription-based
- Scans chess positions from images, videos, websites, books
- Browser extension + mobile app
- Not a developer API — consumer product
- Good for reference but not for integration

### chess-snapshot-api (GitHub: tbtiberiu)
- REST API for detecting chess positions from images
- Uses Chess Position Detector model
- Could be self-hosted
- Returns FEN from image

### CVChess (academic)
- Deep learning framework for converting chessboard images to FEN
- Academic paper (arxiv), not a production API
- Uses smartphone-captured images

### chesscog (GitHub: georg-wolflein)
- Combines traditional CV + deep learning
- Recognizes chess positions from photos
- Academic/research project

## Chess Engine Analysis APIs

### Chess-API.com (Stockfish REST API)
- **Free** Stockfish 18 NNUE REST API
- POST to https://chess-api.com/v1 with FEN
- WebSocket support: wss://chess-api.com/v1
- Returns: eval, best move, continuation, win chance, mate detection, SAN/LAN notation
- Depth up to 18 (free), higher for supporters
- Up to 80 MNPS calculation power
- Progressive analysis via WebSocket
- Response includes: eval, move, depth, winChance, continuationArr, mate, san, lan, piece info
- **Perfect for our use case** — no CPU cost, free tier sufficient for MVP

### StockfishOnline (stockfish.online)
- Another Stockfish REST API
- Send FEN + depth + mode, get best move/eval
- Simpler than chess-api.com

## Frontend Libraries

### chess.js (npm)
- Standard JS chess library
- Move generation, validation, PGN parsing
- FEN support
- Two parsers (permissive and strict)
- **Essential for our implementation**

### react-chessboard (npm)
- v5.10.0, actively maintained
- Customizable interactive chessboard component
- Drag-and-drop support
- Move validation
- **Perfect for analysis board UI**

### react-chess-analysis-board (GitHub)
- Drop-in React component for PGN analysis
- Import PGN to create analysis tree
- Good reference but may want custom implementation

## Architecture Decision

### MVP Approach
1. **Video Recording**: Use MediaRecorder API (browser-native) for phone camera capture
2. **Board Detection**: Use a lightweight client-side approach OR server-side processing
   - Option A: Integrate with chess-snapshot-api (self-hosted) for frame-by-frame FEN extraction
   - Option B: Use AI/ML model via server endpoint (e.g., OpenAI Vision API or similar)
   - Option C: Manual PGN entry as fallback (always available)
3. **Game Reconstruction**: chess.js for move validation and PGN generation
4. **Engine Analysis**: Chess-API.com (free Stockfish REST API) for position evaluation
5. **Analysis UI**: react-chessboard + custom eval bar + move list + video sync

### Realistic MVP Scope
Given complexity of real-time board detection from video:
- **Phase 1 (MVP)**: Manual PGN input + full analysis experience + video recording/playback sync
- **Phase 2**: AI-assisted board detection from uploaded video frames
- **Phase 3**: Real-time board detection during recording
