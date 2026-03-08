# CV Pipeline Research Findings

## Key Decision: Architecture Strategy

### Board Detection (Stage 1)
**Winner: yamero999/ultimate-v2-chess-onnx**
- 2.09MB ONNX model — perfect for browser delivery
- 15ms inference time on CPU — real-time capable
- Segmentation mask output (256x256) — gives us board boundary, not just a bounding box
- Apache 2.0 license — commercial use OK
- Input: 256x256 RGB, Output: 256x256 segmentation mask
- From mask → extract board corners via contour detection (OpenCV.js)

**Alternative considered: OpenCV.js Canny + Hough lines**
- No model download required
- Works for clean, well-lit boards with standard sets
- Fails on: unusual piece sets, reflections, hands covering board
- Decision: Use as fallback if ONNX model fails to load

### Piece Classification (Stage 2)
**Problem: No suitable small ONNX model found**
- NAKSTStudio/yolov8m-chess-piece-detection: 104MB — too large for browser
- No yolov8n chess piece ONNX model found publicly
- truekendor uses TensorflowJS (not ONNX Runtime Web)

**Decision: Two-phase approach**
- Phase 2A (this sprint): Board detection only with yamero999 model
  - Gives us: board found ✓, corners visible ✓, lighting OK ✓
  - Does NOT give us: piece positions (FEN reconstruction)
- Phase 2B (future sprint): Piece classification
  - Option A: Train our own yolov8n on Roboflow chess dataset, export to ONNX
  - Option B: Use Roboflow hosted API for piece detection (server-side)
  - Option C: Use Chess-API.com to submit video frames for position extraction

## Implementation Plan for This Sprint

### What we build:
1. Download yamero999 ONNX model (2.09MB) and host via S3/CDN
2. Load onnxruntime-web in a Web Worker (no main thread blocking)
3. Run board segmentation at 5fps on video frames
4. Extract board corners from segmentation mask using contour detection
5. Compute lighting check from raw frame luminance
6. Replace simulated detection in VideoRecorder with real CV results
7. Show green quadrilateral overlay on detected board corners

### What we defer:
- Piece classification (FEN reconstruction) — Phase 2B
- Move detection from video — Phase 2B
- Full game reconstruction from video — Phase 2B

### ONNX Runtime Web CDN
- CDN: https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/ort.min.js
- WASM backend files also needed from CDN
- Load in Web Worker using importScripts()

### Model hosting
- Download model from Hugging Face
- Upload to S3 via manus-upload-file --webdev
- Reference via CDN URL in Web Worker

## OpenCV.js for Contour Detection
- CDN: https://docs.opencv.org/4.10.0/opencv.js
- Use for: extracting board corners from segmentation mask
- cv.findContours() → cv.approxPolyDP() → 4-point quadrilateral
- This replaces the simulated corner detection

## Lighting Check Algorithm
- Convert frame to grayscale
- Compute mean pixel value
- Flag: too dark if mean < 40, too bright if mean > 220
- Optimal range: 40-220 (maps to "Lighting OK" indicator)
