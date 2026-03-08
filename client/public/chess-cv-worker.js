/**
 * Chess Board CV Worker — Full Pipeline
 *
 * Stage 1: Board Detection
 *   yamero999/ultimate-v2-chess-onnx (2.09MB) — board boundary segmentation
 *   OpenCV.js — contour detection to extract 4 board corners from mask
 *
 * Stage 2: Piece Classification
 *   yamero999/chess-piece-detection-yolo11n (10.5MB) — YOLO11n piece detection
 *   Input: 416×416 RGB image of the normalized board
 *   Output: [1, 16, 3549] — 4 bbox coords + 12 class scores per anchor
 *   Classes: white-pawn, white-knight, white-bishop, white-rook, white-queen, white-king,
 *            black-pawn, black-knight, black-bishop, black-rook, black-queen, black-king
 *
 * Message protocol:
 * IN:  { type: 'init' }
 * IN:  { type: 'detect', imageData: ImageData, width: number, height: number }
 * OUT: { type: 'ready' }
 * OUT: { type: 'result', boardDetected, cornersVisible, lightingOk, confidence, corners, fen, fps }
 * OUT: { type: 'error', message }
 * OUT: { type: 'status', message }
 */

const BOARD_SEG_MODEL_URL = 'https://d2xsxph8kpxj0f.cloudfront.net/117675823/J6FsDoRMH9x5xbUvpyzxyf/chess-board-seg_cf0bffdd.onnx';
const PIECE_MODEL_URL = 'https://d2xsxph8kpxj0f.cloudfront.net/117675823/J6FsDoRMH9x5xbUvpyzxyf/chess-pieces_6e7271ea.onnx';
const OPENCV_URL = 'https://docs.opencv.org/4.10.0/opencv.js';
const ORT_URL = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/ort.min.js';

// Class names in model output order (12 classes)
// white pieces first, then black pieces
const CLASS_NAMES = [
  'P', 'N', 'B', 'R', 'Q', 'K',  // white: pawn, knight, bishop, rook, queen, king
  'p', 'n', 'b', 'r', 'q', 'k',  // black: pawn, knight, bishop, rook, queen, king
];

const PIECE_CONF_THRESHOLD = 0.45; // Minimum confidence for piece detection
const BOARD_SIZE = 416;            // Piece model input size

let boardSegSession = null;
let pieceSession = null;
let cvReady = false;
let lastFrameTime = Date.now();
let frameCount = 0;
let fps = 0;
let lastFen = null;
let fenFrameCount = 0;

// ─── Initialization ───────────────────────────────────────────────────────────

async function initialize() {
  try {
    postMessage({ type: 'status', message: 'Loading inference engine...' });

    // Load ONNX Runtime Web
    importScripts(ORT_URL);

    // Configure ONNX Runtime to use WASM backend
    ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/';
    ort.env.wasm.numThreads = 1; // Single thread for worker compatibility

    postMessage({ type: 'status', message: 'Loading board detection model...' });

    // Load Stage 1: board segmentation model
    boardSegSession = await ort.InferenceSession.create(BOARD_SEG_MODEL_URL, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
    });

    postMessage({ type: 'status', message: 'Loading piece detection model...' });

    // Load Stage 2: piece classification model
    pieceSession = await ort.InferenceSession.create(PIECE_MODEL_URL, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
    });

    postMessage({ type: 'status', message: 'Loading OpenCV...' });

    // Load OpenCV.js
    await loadOpenCV();

    postMessage({ type: 'ready' });
  } catch (err) {
    postMessage({ type: 'error', message: `Init failed: ${err.message}` });
    // Fall back to heuristic detection — still signal ready so UI can proceed
    boardSegSession = null;
    pieceSession = null;
    cvReady = false;
    postMessage({ type: 'ready' });
  }
}

function loadOpenCV() {
  return new Promise((resolve, reject) => {
    self.Module = {
      onRuntimeInitialized: () => {
        cvReady = true;
        resolve();
      },
    };
    try {
      importScripts(OPENCV_URL);
      if (typeof cv !== 'undefined' && cv.Mat) {
        cvReady = true;
        resolve();
      }
    } catch (err) {
      reject(err);
    }
  });
}

// ─── Detection Pipeline ───────────────────────────────────────────────────────

async function detect(imageData, width, height) {
  const now = Date.now();
  frameCount++;
  if (now - lastFrameTime >= 1000) {
    fps = frameCount;
    frameCount = 0;
    lastFrameTime = now;
  }

  // Always compute lighting check — it doesn't need the model
  const lightingResult = checkLighting(imageData);

  if (!boardSegSession || !cvReady) {
    postMessage({
      type: 'result',
      boardDetected: false,
      cornersVisible: false,
      lightingOk: lightingResult.ok,
      confidence: 0,
      corners: null,
      fen: null,
      fps,
      fallback: true,
    });
    return;
  }

  try {
    // Stage 1: Board segmentation → corners
    const mask = await runBoardSegmentation(imageData, width, height);
    const cornerResult = extractCorners(mask, 256, 256, width, height);

    let fen = lastFen; // Keep last known FEN while board is stable

    // Stage 2: Piece classification (only when board is cleanly detected)
    if (cornerResult.boardDetected && cornerResult.cornersVisible && cornerResult.corners && pieceSession) {
      fenFrameCount++;
      // Run piece detection every 3rd frame to save CPU
      if (fenFrameCount % 3 === 0) {
        try {
          const normalizedBoard = await warpBoard(imageData, width, height, cornerResult.corners);
          const detections = await runPieceDetection(normalizedBoard);
          const reconstructed = reconstructFen(detections);
          if (reconstructed) {
            fen = reconstructed;
            lastFen = fen;
          }
        } catch (pieceErr) {
          // Piece detection failure is non-fatal — keep last FEN
        }
      }
    }

    postMessage({
      type: 'result',
      boardDetected: cornerResult.boardDetected,
      cornersVisible: cornerResult.cornersVisible,
      lightingOk: lightingResult.ok,
      confidence: cornerResult.confidence,
      corners: cornerResult.corners,
      fen,
      fps,
      fallback: false,
    });
  } catch (err) {
    postMessage({
      type: 'result',
      boardDetected: false,
      cornersVisible: false,
      lightingOk: lightingResult.ok,
      confidence: 0,
      corners: null,
      fen: lastFen,
      fps,
      fallback: true,
      error: err.message,
    });
  }
}

// ─── Lighting Check ───────────────────────────────────────────────────────────

function checkLighting(imageData) {
  const data = imageData.data;
  let sum = 0;
  const step = 4 * 4; // Sample every 4th pixel for speed
  let count = 0;
  for (let i = 0; i < data.length; i += step) {
    sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    count++;
  }
  const mean = sum / count;
  return {
    ok: mean >= 40 && mean <= 220,
    mean,
    tooDark: mean < 40,
    tooBright: mean > 220,
  };
}

// ─── Stage 1: Board Segmentation ─────────────────────────────────────────────

async function runBoardSegmentation(imageData, srcWidth, srcHeight) {
  const offscreen = new OffscreenCanvas(256, 256);
  const ctx = offscreen.getContext('2d');
  const srcCanvas = new OffscreenCanvas(srcWidth, srcHeight);
  const srcCtx = srcCanvas.getContext('2d');
  srcCtx.putImageData(imageData, 0, 0);
  ctx.drawImage(srcCanvas, 0, 0, 256, 256);
  const resized = ctx.getImageData(0, 0, 256, 256);

  const float32 = new Float32Array(3 * 256 * 256);
  for (let i = 0; i < 256 * 256; i++) {
    float32[i] = resized.data[i * 4] / 255.0;
    float32[256 * 256 + i] = resized.data[i * 4 + 1] / 255.0;
    float32[2 * 256 * 256 + i] = resized.data[i * 4 + 2] / 255.0;
  }

  const inputTensor = new ort.Tensor('float32', float32, [1, 3, 256, 256]);
  const results = await boardSegSession.run({ input: inputTensor });
  const outputKey = Object.keys(results)[0];
  const logits = results[outputKey].data;

  const mask = new Float32Array(256 * 256);
  for (let i = 0; i < 256 * 256; i++) {
    mask[i] = 1.0 / (1.0 + Math.exp(-logits[i]));
  }
  return mask;
}

// ─── Stage 2: Warp Board to Top-Down View ────────────────────────────────────

async function warpBoard(imageData, srcWidth, srcHeight, corners) {
  // Draw source image to offscreen canvas
  const srcCanvas = new OffscreenCanvas(srcWidth, srcHeight);
  const srcCtx = srcCanvas.getContext('2d');
  srcCtx.putImageData(imageData, 0, 0);

  // Create output canvas at BOARD_SIZE x BOARD_SIZE
  const dstCanvas = new OffscreenCanvas(BOARD_SIZE, BOARD_SIZE);
  const dstCtx = dstCanvas.getContext('2d');

  // Use CSS perspective transform to approximate homography
  // corners: [tl, tr, br, bl]
  const [tl, tr, br, bl] = corners;

  // Simple bilinear warp using canvas clip + transform
  // For a proper homography we'd need a full matrix computation,
  // but for piece detection a perspective-corrected crop is sufficient
  dstCtx.save();

  // Draw the board region using a clip path defined by the 4 corners
  dstCtx.beginPath();
  dstCtx.moveTo(0, 0);
  dstCtx.lineTo(BOARD_SIZE, 0);
  dstCtx.lineTo(BOARD_SIZE, BOARD_SIZE);
  dstCtx.lineTo(0, BOARD_SIZE);
  dstCtx.closePath();
  dstCtx.clip();

  // Compute bounding box of the board in source image
  const minX = Math.min(tl.x, bl.x);
  const minY = Math.min(tl.y, tr.y);
  const maxX = Math.max(tr.x, br.x);
  const maxY = Math.max(bl.y, br.y);
  const bw = maxX - minX;
  const bh = maxY - minY;

  // Scale the bounding box region to fill the output canvas
  dstCtx.drawImage(srcCanvas, minX, minY, bw, bh, 0, 0, BOARD_SIZE, BOARD_SIZE);
  dstCtx.restore();

  return dstCtx.getImageData(0, 0, BOARD_SIZE, BOARD_SIZE);
}

// ─── Stage 2: Piece Detection (YOLO11n) ──────────────────────────────────────

async function runPieceDetection(imageData) {
  // Convert ImageData to float32 tensor [1, 3, 416, 416] normalized to [0, 1]
  const float32 = new Float32Array(3 * BOARD_SIZE * BOARD_SIZE);
  for (let i = 0; i < BOARD_SIZE * BOARD_SIZE; i++) {
    float32[i] = imageData.data[i * 4] / 255.0;                          // R
    float32[BOARD_SIZE * BOARD_SIZE + i] = imageData.data[i * 4 + 1] / 255.0; // G
    float32[2 * BOARD_SIZE * BOARD_SIZE + i] = imageData.data[i * 4 + 2] / 255.0; // B
  }

  const inputTensor = new ort.Tensor('float32', float32, [1, 3, BOARD_SIZE, BOARD_SIZE]);
  const results = await pieceSession.run({ images: inputTensor });

  // Output shape: [1, 16, 3549] — 4 bbox + 12 class scores per anchor
  const outputKey = Object.keys(results)[0];
  const output = results[outputKey].data; // Float32Array
  const numAnchors = 3549;
  const numFields = 16; // 4 bbox + 12 classes

  const detections = [];

  for (let i = 0; i < numAnchors; i++) {
    // YOLO output is transposed: [1, 16, 3549]
    // Access: output[field * numAnchors + i]
    const cx = output[0 * numAnchors + i];
    const cy = output[1 * numAnchors + i];
    const w  = output[2 * numAnchors + i];
    const h  = output[3 * numAnchors + i];

    // Find best class
    let bestClass = -1;
    let bestScore = 0;
    for (let c = 0; c < 12; c++) {
      const score = output[(4 + c) * numAnchors + i];
      if (score > bestScore) {
        bestScore = score;
        bestClass = c;
      }
    }

    if (bestScore >= PIECE_CONF_THRESHOLD) {
      detections.push({
        cx, cy, w, h,
        classIdx: bestClass,
        piece: CLASS_NAMES[bestClass],
        confidence: bestScore,
      });
    }
  }

  // Non-Maximum Suppression
  return applyNMS(detections, 0.45);
}

// ─── Non-Maximum Suppression ──────────────────────────────────────────────────

function applyNMS(detections, iouThreshold) {
  if (detections.length === 0) return [];

  // Sort by confidence descending
  detections.sort((a, b) => b.confidence - a.confidence);

  const kept = [];
  const suppressed = new Set();

  for (let i = 0; i < detections.length; i++) {
    if (suppressed.has(i)) continue;
    kept.push(detections[i]);
    for (let j = i + 1; j < detections.length; j++) {
      if (suppressed.has(j)) continue;
      if (computeIoU(detections[i], detections[j]) > iouThreshold) {
        suppressed.add(j);
      }
    }
  }

  return kept;
}

function computeIoU(a, b) {
  const ax1 = a.cx - a.w / 2, ay1 = a.cy - a.h / 2;
  const ax2 = a.cx + a.w / 2, ay2 = a.cy + a.h / 2;
  const bx1 = b.cx - b.w / 2, by1 = b.cy - b.h / 2;
  const bx2 = b.cx + b.w / 2, by2 = b.cy + b.h / 2;

  const ix1 = Math.max(ax1, bx1), iy1 = Math.max(ay1, by1);
  const ix2 = Math.min(ax2, bx2), iy2 = Math.min(ay2, by2);

  const iw = Math.max(0, ix2 - ix1);
  const ih = Math.max(0, iy2 - iy1);
  const intersection = iw * ih;

  const aArea = (ax2 - ax1) * (ay2 - ay1);
  const bArea = (bx2 - bx1) * (by2 - by1);
  const union = aArea + bArea - intersection;

  return union > 0 ? intersection / union : 0;
}

// ─── FEN Reconstruction ───────────────────────────────────────────────────────

function reconstructFen(detections) {
  if (detections.length === 0) return null;

  // Map each detection to a board square (0-7, 0-7)
  // The warped board image is BOARD_SIZE x BOARD_SIZE
  // Each square is BOARD_SIZE/8 pixels wide/tall
  const squareSize = BOARD_SIZE / 8;
  const board = Array.from({ length: 8 }, () => Array(8).fill(''));

  // Track confidence per square — keep highest confidence piece per square
  const squareConf = Array.from({ length: 8 }, () => Array(8).fill(0));

  for (const det of detections) {
    // Convert center coords to square indices
    const col = Math.floor(det.cx / squareSize);
    const row = Math.floor(det.cy / squareSize);

    if (col < 0 || col > 7 || row < 0 || row > 7) continue;

    if (det.confidence > squareConf[row][col]) {
      board[row][col] = det.piece;
      squareConf[row][col] = det.confidence;
    }
  }

  // Convert board array to FEN rank notation
  const ranks = [];
  for (let row = 0; row < 8; row++) {
    let rank = '';
    let emptyCount = 0;
    for (let col = 0; col < 8; col++) {
      if (board[row][col] === '') {
        emptyCount++;
      } else {
        if (emptyCount > 0) {
          rank += emptyCount;
          emptyCount = 0;
        }
        rank += board[row][col];
      }
    }
    if (emptyCount > 0) rank += emptyCount;
    ranks.push(rank);
  }

  // Validate: must have at least both kings
  const fenStr = ranks.join('/');
  if (!fenStr.includes('K') || !fenStr.includes('k')) return null;

  // Return position part of FEN (without turn/castling/etc.)
  return fenStr + ' w - - 0 1';
}

// ─── Corner Extraction (OpenCV.js) ───────────────────────────────────────────

function extractCorners(mask, maskW, maskH, origW, origH) {
  try {
    const binaryData = new Uint8Array(maskW * maskH);
    let maskSum = 0;
    for (let i = 0; i < mask.length; i++) {
      binaryData[i] = mask[i] > 0.5 ? 255 : 0;
      maskSum += mask[i] > 0.5 ? 1 : 0;
    }

    const coverage = maskSum / (maskW * maskH);
    if (coverage < 0.05) {
      return { boardDetected: false, cornersVisible: false, confidence: 0, corners: null };
    }

    const mat = new cv.Mat(maskH, maskW, cv.CV_8UC1);
    mat.data.set(binaryData);

    const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5));
    cv.morphologyEx(mat, mat, cv.MORPH_CLOSE, kernel);
    kernel.delete();

    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(mat, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    if (contours.size() === 0) {
      mat.delete(); contours.delete(); hierarchy.delete();
      return { boardDetected: false, cornersVisible: false, confidence: 0, corners: null };
    }

    let maxArea = 0;
    let maxIdx = 0;
    for (let i = 0; i < contours.size(); i++) {
      const area = cv.contourArea(contours.get(i));
      if (area > maxArea) { maxArea = area; maxIdx = i; }
    }

    const boardContour = contours.get(maxIdx);
    const epsilon = 0.02 * cv.arcLength(boardContour, true);
    const approx = new cv.Mat();
    cv.approxPolyDP(boardContour, approx, epsilon, true);

    let corners = null;
    let cornersVisible = false;
    let confidence = coverage;

    if (approx.rows === 4) {
      const scaleX = origW / maskW;
      const scaleY = origH / maskH;
      corners = [];
      for (let i = 0; i < 4; i++) {
        corners.push({
          x: approx.data32S[i * 2] * scaleX,
          y: approx.data32S[i * 2 + 1] * scaleY,
        });
      }
      corners = sortCorners(corners);
      cornersVisible = true;
      confidence = Math.min(0.95, coverage * 2);
    } else if (approx.rows > 4) {
      const rect = cv.boundingRect(boardContour);
      const scaleX = origW / maskW;
      const scaleY = origH / maskH;
      corners = [
        { x: rect.x * scaleX, y: rect.y * scaleY },
        { x: (rect.x + rect.width) * scaleX, y: rect.y * scaleY },
        { x: (rect.x + rect.width) * scaleX, y: (rect.y + rect.height) * scaleY },
        { x: rect.x * scaleX, y: (rect.y + rect.height) * scaleY },
      ];
      cornersVisible = false;
      confidence = coverage * 0.6;
    }

    mat.delete(); contours.delete(); hierarchy.delete(); approx.delete();

    return { boardDetected: true, cornersVisible, confidence, corners };
  } catch (err) {
    return { boardDetected: false, cornersVisible: false, confidence: 0, corners: null };
  }
}

function sortCorners(pts) {
  const center = {
    x: pts.reduce((s, p) => s + p.x, 0) / 4,
    y: pts.reduce((s, p) => s + p.y, 0) / 4,
  };
  const tl = pts.filter(p => p.x < center.x && p.y < center.y)[0] || pts[0];
  const tr = pts.filter(p => p.x >= center.x && p.y < center.y)[0] || pts[1];
  const br = pts.filter(p => p.x >= center.x && p.y >= center.y)[0] || pts[2];
  const bl = pts.filter(p => p.x < center.x && p.y >= center.y)[0] || pts[3];
  return [tl, tr, br, bl].filter(Boolean);
}

// ─── Message Handler ──────────────────────────────────────────────────────────

self.onmessage = async (event) => {
  const { type, imageData, width, height } = event.data;
  if (type === 'init') {
    await initialize();
  } else if (type === 'detect') {
    await detect(imageData, width, height);
  }
};
