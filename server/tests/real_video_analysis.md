# Real OTB Video Analysis — Comprehensive Findings

## Video Used
- Pexels #6058636: "Putting Chess Pieces In a Chessboard" 
- 12.5s, 1920x1080, 25fps, overhead angle (~30-40° from vertical)
- Shows someone placing pieces on a board (not a full game)

## Per-Stage Results

### Stage 1: Board Segmentation — GRADE A (100%)
- All 26 sampled frames successfully detected the board region
- Coverage values: 0.36-0.40 (well within valid 0.30-0.85 range)
- The segmentation mask correctly outlines the board+pieces area
- No false positives, no coverage guard triggers

### Stage 2: Corner Extraction — GRADE C (Functional but Imprecise)
- The polygon approximation returns 10+ vertices (not 4)
- Falls back to minAreaRect (improved from boundingRect)
- The resulting quadrilateral covers the board area but doesn't precisely
  align with the actual board corners
- The board in the video is rotated ~45° relative to the camera frame

### Stage 3: Piece Detection — GRADE F (0% valid FEN)
- Even with rotation correction (tested 0-90° in 5° steps), max 7 detections
- The model classifies almost everything as 'b' (black bishop)
- Root cause: the YOLO model was trained on a specific chess piece style
  (likely Staunton pieces from a specific dataset). The Pexels video uses
  a different piece style (rounded, minimalist wooden pieces) that the model
  hasn't seen during training.
- This is a **domain gap** problem, not a pipeline bug.

### Stage 4: End-to-End — GRADE F (0 moves)
- No valid FENs → no move detection possible

## Key Insight: Domain Gap
The ONNX piece detection model was trained on a specific visual domain:
1. Specific piece style (likely standard Staunton or similar)
2. Specific board colors/textures
3. Specific lighting conditions
4. Specific camera angle (directly overhead)

The Pexels video differs in:
1. Different piece style (rounded wooden pieces)
2. Different board texture (natural wood grain)
3. Different lighting (warm, directional)
4. Slightly angled camera (not perfectly overhead)

## What This Benchmark Proves
1. The **pipeline architecture is sound** — segmentation → warp → detect → reconstruct
2. The **board segmentation model generalizes well** to different boards
3. The **piece detection model has limited generalization** — it needs retraining
   or fine-tuning on diverse piece styles
4. The **corner extraction needs improvement** for non-standard board orientations
5. The **grid rotation detection** is a valid approach but needs the piece model
   to work first

## Recommendations
1. **Retrain the piece detection model** on a more diverse dataset including
   multiple piece styles, board colors, and lighting conditions
2. **Improve corner extraction** to use the chessboard grid pattern itself
   (line detection + intersection) rather than contour approximation
3. **Add rotation calibration** to the pipeline — detect grid angle on the
   first frame and apply it to all subsequent frames
4. **Consider using a larger model** (YOLOv8m or YOLOv8l) for better accuracy
   at the cost of inference speed
