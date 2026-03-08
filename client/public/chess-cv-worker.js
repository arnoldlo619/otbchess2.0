/**
 * Chess Board CV Worker
 * Runs board detection using:
 * 1. yamero999/ultimate-v2-chess-onnx (2.09MB) — board segmentation
 * 2. OpenCV.js — contour detection to extract 4 board corners from mask
 * 3. Lighting check — frame luminance analysis
 *
 * Message protocol:
 * IN:  { type: 'init' }
 * IN:  { type: 'detect', imageData: ImageData, width: number, height: number }
 * OUT: { type: 'ready' }
 * OUT: { type: 'result', boardDetected, cornersVisible, lightingOk, confidence, corners, fps }
 * OUT: { type: 'error', message }
 * OUT: { type: 'status', message }
 */

const MODEL_URL = 'https://d2xsxph8kpxj0f.cloudfront.net/117675823/J6FsDoRMH9x5xbUvpyzxyf/chess-board-seg_cf0bffdd.onnx';
const OPENCV_URL = 'https://docs.opencv.org/4.10.0/opencv.js';
const ORT_URL = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/ort.min.js';

let ortSession = null;
let cvReady = false;
let lastFrameTime = Date.now();
let frameCount = 0;
let fps = 0;

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

    // Load the chess board segmentation model
    ortSession = await ort.InferenceSession.create(MODEL_URL, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
    });

    postMessage({ type: 'status', message: 'Loading OpenCV...' });

    // Load OpenCV.js
    await loadOpenCV();

    postMessage({ type: 'ready' });
  } catch (err) {
    postMessage({ type: 'error', message: `Init failed: ${err.message}` });
    // Fall back to heuristic detection
    ortSession = null;
    cvReady = false;
    postMessage({ type: 'ready' }); // Still signal ready so UI can proceed
  }
}

function loadOpenCV() {
  return new Promise((resolve, reject) => {
    // OpenCV.js sets Module.onRuntimeInitialized when ready
    self.Module = {
      onRuntimeInitialized: () => {
        cvReady = true;
        resolve();
      },
    };
    try {
      importScripts(OPENCV_URL);
      // If onRuntimeInitialized was already called synchronously
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

  if (!ortSession || !cvReady) {
    // Fallback: heuristic detection without model
    postMessage({
      type: 'result',
      boardDetected: false,
      cornersVisible: false,
      lightingOk: lightingResult.ok,
      confidence: 0,
      corners: null,
      fps,
      fallback: true,
    });
    return;
  }

  try {
    // Stage 1: Run board segmentation model
    const mask = await runSegmentation(imageData, width, height);

    // Stage 2: Extract board corners from mask using OpenCV.js
    const cornerResult = extractCorners(mask, 256, 256, width, height);

    postMessage({
      type: 'result',
      boardDetected: cornerResult.boardDetected,
      cornersVisible: cornerResult.cornersVisible,
      lightingOk: lightingResult.ok,
      confidence: cornerResult.confidence,
      corners: cornerResult.corners, // [{x,y}, {x,y}, {x,y}, {x,y}] in original image coords
      fps,
      fallback: false,
    });
  } catch (err) {
    // On inference error, report partial result
    postMessage({
      type: 'result',
      boardDetected: false,
      cornersVisible: false,
      lightingOk: lightingResult.ok,
      confidence: 0,
      corners: null,
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
    // Luminance = 0.299R + 0.587G + 0.114B
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

// ─── ONNX Segmentation ────────────────────────────────────────────────────────

async function runSegmentation(imageData, srcWidth, srcHeight) {
  // Resize imageData to 256x256 using an OffscreenCanvas
  const offscreen = new OffscreenCanvas(256, 256);
  const ctx = offscreen.getContext('2d');

  // Draw original frame scaled to 256x256
  const srcCanvas = new OffscreenCanvas(srcWidth, srcHeight);
  const srcCtx = srcCanvas.getContext('2d');
  srcCtx.putImageData(imageData, 0, 0);
  ctx.drawImage(srcCanvas, 0, 0, 256, 256);

  const resized = ctx.getImageData(0, 0, 256, 256);

  // Convert to float32 tensor [1, 3, 256, 256] normalized to [0, 1]
  const float32 = new Float32Array(3 * 256 * 256);
  for (let i = 0; i < 256 * 256; i++) {
    float32[i] = resized.data[i * 4] / 255.0;           // R
    float32[256 * 256 + i] = resized.data[i * 4 + 1] / 255.0; // G
    float32[2 * 256 * 256 + i] = resized.data[i * 4 + 2] / 255.0; // B
  }

  const inputTensor = new ort.Tensor('float32', float32, [1, 3, 256, 256]);
  const feeds = { input: inputTensor };
  const results = await ortSession.run(feeds);

  // Get the output tensor (segmentation logits)
  const outputKey = Object.keys(results)[0];
  const output = results[outputKey];
  const logits = output.data; // Float32Array [1, 1, 256, 256]

  // Apply sigmoid to get probability mask
  const mask = new Float32Array(256 * 256);
  for (let i = 0; i < 256 * 256; i++) {
    mask[i] = 1.0 / (1.0 + Math.exp(-logits[i]));
  }

  return mask;
}

// ─── Corner Extraction (OpenCV.js) ───────────────────────────────────────────

function extractCorners(mask, maskW, maskH, origW, origH) {
  try {
    // Convert float mask to binary uint8 Mat
    const binaryData = new Uint8Array(maskW * maskH);
    let maskSum = 0;
    for (let i = 0; i < mask.length; i++) {
      binaryData[i] = mask[i] > 0.5 ? 255 : 0;
      maskSum += mask[i] > 0.5 ? 1 : 0;
    }

    // If less than 5% of pixels are board, board not detected
    const coverage = maskSum / (maskW * maskH);
    if (coverage < 0.05) {
      return { boardDetected: false, cornersVisible: false, confidence: 0, corners: null };
    }

    // Create OpenCV Mat from binary data
    const mat = new cv.Mat(maskH, maskW, cv.CV_8UC1);
    mat.data.set(binaryData);

    // Morphological closing to fill gaps
    const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5));
    cv.morphologyEx(mat, mat, cv.MORPH_CLOSE, kernel);
    kernel.delete();

    // Find contours
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(mat, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    if (contours.size() === 0) {
      mat.delete(); contours.delete(); hierarchy.delete();
      return { boardDetected: false, cornersVisible: false, confidence: 0, corners: null };
    }

    // Find the largest contour (the board)
    let maxArea = 0;
    let maxIdx = 0;
    for (let i = 0; i < contours.size(); i++) {
      const area = cv.contourArea(contours.get(i));
      if (area > maxArea) { maxArea = area; maxIdx = i; }
    }

    const boardContour = contours.get(maxIdx);

    // Approximate to polygon
    const epsilon = 0.02 * cv.arcLength(boardContour, true);
    const approx = new cv.Mat();
    cv.approxPolyDP(boardContour, approx, epsilon, true);

    let corners = null;
    let cornersVisible = false;
    let confidence = coverage;

    if (approx.rows === 4) {
      // Perfect quadrilateral — extract 4 corners
      const scaleX = origW / maskW;
      const scaleY = origH / maskH;
      corners = [];
      for (let i = 0; i < 4; i++) {
        corners.push({
          x: approx.data32S[i * 2] * scaleX,
          y: approx.data32S[i * 2 + 1] * scaleY,
        });
      }
      // Sort corners: top-left, top-right, bottom-right, bottom-left
      corners = sortCorners(corners);
      cornersVisible = true;
      confidence = Math.min(0.95, coverage * 2); // Boost confidence for clean quad
    } else if (approx.rows > 4) {
      // More than 4 corners — board partially visible or occluded
      // Use bounding rect as fallback corners
      const rect = cv.boundingRect(boardContour);
      const scaleX = origW / maskW;
      const scaleY = origH / maskH;
      corners = [
        { x: rect.x * scaleX, y: rect.y * scaleY },
        { x: (rect.x + rect.width) * scaleX, y: rect.y * scaleY },
        { x: (rect.x + rect.width) * scaleX, y: (rect.y + rect.height) * scaleY },
        { x: rect.x * scaleX, y: (rect.y + rect.height) * scaleY },
      ];
      cornersVisible = false; // Not a clean quad — corners may be cut off
      confidence = coverage * 0.6;
    }

    // Cleanup
    mat.delete(); contours.delete(); hierarchy.delete(); approx.delete();

    return {
      boardDetected: true,
      cornersVisible,
      confidence,
      corners,
    };
  } catch (err) {
    return { boardDetected: false, cornersVisible: false, confidence: 0, corners: null };
  }
}

// Sort 4 corners into: top-left, top-right, bottom-right, bottom-left
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
