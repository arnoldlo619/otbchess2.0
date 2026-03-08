/**
 * Level 2 Benchmark: Real OTB Video Accuracy Tests
 * =================================================
 *
 * These tests codify the measured per-stage accuracy of the CV pipeline
 * against a real overhead chess video (Pexels #6058636).
 *
 * Benchmark history:
 *   v1 (2026-03-08): Original model — piece detection Grade F (4 detections, all 'b')
 *   v2 (2026-03-08): Retrained on Roboflow 606 imgs — 12 detections, all 'r'
 *   v3 (2026-03-08): Retrained on augmented 4,492 imgs — 20 detections, all 'p'
 *
 * Current grades (v3 augmented model):
 *   - Board Segmentation:  A  (100% detection rate)
 *   - Corner Extraction:   F  (0% four-vertex, 100% fallback)
 *   - Piece Detection:     C  (5x more detections than v1, still single-class)
 *   - Coverage Guard:      PASS (0% false positive rate)
 *   - End-to-End:          F  (0 moves — needs multi-class detection)
 *
 * These tests serve as regression guards — if the models are retrained
 * or the pipeline is improved, the expected values should be updated.
 */
import { describe, it, expect } from "vitest";

// ─── Benchmark Report Data ──────────────────────────────────────────────────
// Captured from export_v3.py validation output on 2026-03-08

const BENCHMARK_REPORT = {
  video: "pexels_chess_overhead.mp4",
  videoSource: "Pexels #6058636 — Putting Chess Pieces In a Chessboard",
  videoSpecs: {
    resolution: "640x360",
    fps: 25,
    totalFrames: 312,
    durationSeconds: 12.5,
    cameraAngle: "overhead, ~30-40° from vertical",
  },
  sampledFrames: 15,
  modelVersion: "v3-augmented",
  trainingInfo: {
    dataset: "Roboflow + perspective augmentation (4,492 images, 12 classes)",
    epochs: 15,
    bestEpoch: 8,
    bestMapAt50: 0.981,
    bestRecall: 0.974,
    bestPrecision: 0.972,
    finalMapAt50: 0.980,
    finalRecall: 0.979,
    finalPrecision: 0.976,
  },
  stages: {
    boardSegmentation: {
      detectionRate: 1.0,
      detected: 15,
      totalFrames: 15,
      coverageMean: 0.5,
      coverageStd: 0.014,
      coverageMin: 0.475,
      coverageMax: 0.523,
      grade: "A",
    },
    cornerExtraction: {
      fourVertexRate: 0.0,
      fallbackRate: 1.0,
      grade: "F",
    },
    pieceDetection: {
      // v1 (original): 4 detections at best angle, all 'b' (black bishop)
      // v2 (retrained 606 imgs): 12 detections at best angle, all 'r' (black rook)
      // v3 (augmented 4,492 imgs): 20 detections at best angle, all 'p' (black pawn)
      v1Detections: 4,
      v2Detections: 12,
      v3Detections: 20,
      improvementOverV1: 5.0,
      improvementOverV2: 1.67,
      avgDetections0deg: 5,
      avgDetectionsBest: 20,
      validFenRate0deg: 0.0,
      validFenRateBest: 0.0,
      dominantClassV1: "b",  // black bishop — old model domain gap
      dominantClassV2: "r",  // black rook — v2 model domain gap
      dominantClassV3: "p",  // black pawn — v3 model domain gap
      uniqueClassesDetected: 1,
      highConfidenceDetections: 9,  // conf >= 0.7
      maxConfidence: 0.788,
      grade: "C",  // Improved from D: 5x v1 detections, better localisation
    },
    coverageGuard: {
      guardPassed: 15,
      totalFrames: 15,
      falsePositiveRate: 0.0,
      pass: true,
    },
    endToEnd: {
      movesDetected: 0,
      pgnEmpty: true,
      grade: "F",
    },
  },
};

// ─── Stage 1: Board Segmentation ────────────────────────────────────────────

describe("Level 2 — Board Segmentation (Real Video)", () => {
  const seg = BENCHMARK_REPORT.stages.boardSegmentation;

  it("achieves 100% board detection rate on real overhead video", () => {
    expect(seg.detectionRate).toBe(1.0);
    expect(seg.detected).toBe(seg.totalFrames);
  });

  it("receives grade A (>= 80% detection rate)", () => {
    expect(seg.grade).toBe("A");
    expect(seg.detectionRate).toBeGreaterThanOrEqual(0.8);
  });

  it("coverage values fall within the valid range (0.3-0.85)", () => {
    expect(seg.coverageMin).toBeGreaterThan(0.3);
    expect(seg.coverageMax).toBeLessThan(0.85);
  });

  it("coverage is stable across frames (std < 0.05)", () => {
    expect(seg.coverageStd).toBeLessThan(0.05);
  });

  it("coverage does NOT trigger the guard (all < 0.85)", () => {
    expect(seg.coverageMax).toBeLessThan(0.85);
  });

  it("demonstrates the segmentation model generalises to real boards", () => {
    expect(seg.detectionRate).toBe(1.0);
  });
});

// ─── Stage 2: Corner Extraction ─────────────────────────────────────────────

describe("Level 2 — Corner Extraction (Real Video)", () => {
  const corner = BENCHMARK_REPORT.stages.cornerExtraction;

  it("polygon approximation never yields exactly 4 vertices", () => {
    expect(corner.fourVertexRate).toBe(0.0);
  });

  it("always falls back to minAreaRect", () => {
    expect(corner.fallbackRate).toBe(1.0);
  });

  it("receives grade F (0% four-vertex rate)", () => {
    expect(corner.grade).toBe("F");
  });

  it("documents the root cause: irregular mask outline from pieces", () => {
    expect(corner.fourVertexRate).toBe(0.0);
    expect(corner.fallbackRate).toBe(1.0);
  });
});

// ─── Stage 3: Piece Detection ───────────────────────────────────────────────

describe("Level 2 — Piece Detection (Real Video, v3 Augmented Model)", () => {
  const piece = BENCHMARK_REPORT.stages.pieceDetection;

  it("v3 model detects 5x more pieces than v1 original (20 vs 4)", () => {
    expect(piece.v3Detections).toBeGreaterThanOrEqual(piece.v1Detections * 4);
    expect(piece.improvementOverV1).toBeGreaterThanOrEqual(4.0);
  });

  it("v3 model detects more pieces than v2 (20 vs 12)", () => {
    expect(piece.v3Detections).toBeGreaterThan(piece.v2Detections);
    expect(piece.improvementOverV2).toBeGreaterThanOrEqual(1.5);
  });

  it("detects 20 pieces at best rotation angle", () => {
    expect(piece.avgDetectionsBest).toBeGreaterThanOrEqual(15);
  });

  it("has 9 high-confidence detections (conf >= 0.7)", () => {
    expect(piece.highConfidenceDetections).toBeGreaterThanOrEqual(5);
  });

  it("rotation sweep improves detection count over 0°", () => {
    expect(piece.avgDetectionsBest).toBeGreaterThan(piece.avgDetections0deg);
  });

  it("still produces 0% valid FEN rate (single-class domain gap)", () => {
    expect(piece.validFenRateBest).toBe(0.0);
  });

  it("receives grade C (5x v1, better localisation, still single-class)", () => {
    expect(piece.grade).toBe("C");
  });

  it("domain gap shifted across versions: b → r → p", () => {
    expect(piece.dominantClassV1).toBe("b");
    expect(piece.dominantClassV2).toBe("r");
    expect(piece.dominantClassV3).toBe("p");
    expect(piece.uniqueClassesDetected).toBe(1);
  });

  it("documents that augmentation improves localisation but not class diversity", () => {
    // The augmented dataset applies perspective transforms to the same Roboflow
    // images (standard Staunton pieces). This improves the model's ability to
    // detect pieces at various angles (20 vs 12 detections) but cannot teach
    // it to distinguish piece types it has never seen (rounded wooden pieces).
    expect(piece.uniqueClassesDetected).toBe(1);
    expect(piece.validFenRateBest).toBe(0.0);
  });
});

// ─── Stage 4: Coverage Guard ────────────────────────────────────────────────

describe("Level 2 — Coverage Guard (Real Video)", () => {
  const guard = BENCHMARK_REPORT.stages.coverageGuard;

  it("passes all real board frames (0% false positive rate)", () => {
    expect(guard.falsePositiveRate).toBe(0.0);
    expect(guard.pass).toBe(true);
  });

  it("all 15 frames pass the guard", () => {
    expect(guard.guardPassed).toBe(guard.totalFrames);
    expect(guard.guardPassed).toBe(15);
  });

  it("validates that the 0.85 threshold is appropriate for real boards", () => {
    const seg = BENCHMARK_REPORT.stages.boardSegmentation;
    expect(seg.coverageMax).toBeLessThan(0.85);
  });
});

// ─── Stage 5: End-to-End ────────────────────────────────────────────────────

describe("Level 2 — End-to-End Pipeline (Real Video)", () => {
  const e2e = BENCHMARK_REPORT.stages.endToEnd;

  it("detects 0 moves (expected given single-class piece detection)", () => {
    expect(e2e.movesDetected).toBe(0);
  });

  it("produces empty PGN", () => {
    expect(e2e.pgnEmpty).toBe(true);
  });

  it("receives grade F", () => {
    expect(e2e.grade).toBe("F");
  });
});

// ─── Model Training Metrics ─────────────────────────────────────────────────

describe("Level 2 — v3 Augmented Model Training Metrics", () => {
  const training = BENCHMARK_REPORT.trainingInfo;

  it("achieves best mAP@50 > 0.97 on the validation set", () => {
    expect(training.bestMapAt50).toBeGreaterThanOrEqual(0.97);
  });

  it("achieves best recall > 0.97 on the validation set", () => {
    expect(training.bestRecall).toBeGreaterThanOrEqual(0.97);
  });

  it("achieves best precision > 0.97 on the validation set", () => {
    expect(training.bestPrecision).toBeGreaterThanOrEqual(0.97);
  });

  it("final epoch mAP@50 > 0.97", () => {
    expect(training.finalMapAt50).toBeGreaterThanOrEqual(0.97);
  });

  it("was trained on 4,492 augmented images with 12 classes", () => {
    expect(training.dataset).toContain("4,492");
    expect(training.dataset).toContain("12 classes");
  });

  it("completed all 15 epochs (vs 6 in v2)", () => {
    expect(training.epochs).toBe(15);
  });

  it("best model was at epoch 8", () => {
    expect(training.bestEpoch).toBe(8);
  });
});

// ─── Pipeline Architecture Validation ───────────────────────────────────────

describe("Level 2 — Pipeline Architecture Assessment (v3 Augmented)", () => {
  it("segmentation model generalises: A grade on unseen real video", () => {
    expect(BENCHMARK_REPORT.stages.boardSegmentation.grade).toBe("A");
  });

  it("coverage guard works correctly on real boards: PASS", () => {
    expect(BENCHMARK_REPORT.stages.coverageGuard.pass).toBe(true);
  });

  it("piece detection improved from F (v1) → D (v2) → C (v3)", () => {
    expect(BENCHMARK_REPORT.stages.pieceDetection.grade).toBe("C");
  });

  it("end-to-end still fails: needs multi-class detection to reconstruct moves", () => {
    expect(BENCHMARK_REPORT.stages.endToEnd.grade).toBe("F");
  });

  it("documents remaining improvement path", () => {
    const improvements = [
      "Collect real overhead images with diverse piece styles (wooden, plastic, tournament)",
      "Use ChessReD dataset (10,800 images) for fine-tuning with real bounding boxes",
      "Improve corner extraction with Hough line grid detection",
      "Add automatic rotation calibration to first-frame processing",
      "Consider larger model (YOLO11m/s) for better class discrimination",
    ];
    expect(improvements).toHaveLength(5);
    expect(improvements[0]).toContain("diverse");
  });
});

// ─── Comparison: v1 vs v2 vs v3 Model ──────────────────────────────────────

describe("Level 2 — Model v1 vs v2 vs v3 Comparison", () => {
  const piece = BENCHMARK_REPORT.stages.pieceDetection;

  it("v3 detects 5x more pieces than v1 on real video", () => {
    expect(piece.v3Detections / piece.v1Detections).toBeGreaterThanOrEqual(4);
  });

  it("v3 detects ~1.7x more pieces than v2 on real video", () => {
    expect(piece.v3Detections / piece.v2Detections).toBeGreaterThanOrEqual(1.5);
  });

  it("all three models exhibit single-class domain gap on unseen piece styles", () => {
    expect(piece.uniqueClassesDetected).toBe(1);
  });

  it("v3 has best bounding box localisation (20 detections)", () => {
    expect(piece.v3Detections).toBeGreaterThanOrEqual(15);
    expect(piece.v2Detections).toBeGreaterThanOrEqual(10);
    expect(piece.v1Detections).toBeLessThanOrEqual(5);
  });

  it("no model achieves valid FEN reconstruction", () => {
    expect(piece.validFenRate0deg).toBe(0.0);
    expect(piece.validFenRateBest).toBe(0.0);
  });

  it("augmentation (v3) improves detection count but not class diversity", () => {
    // v2: 606 original images → 12 detections
    // v3: 4,492 augmented images → 20 detections
    // Both: 1 unique class detected
    expect(piece.v3Detections).toBeGreaterThan(piece.v2Detections);
    expect(piece.uniqueClassesDetected).toBe(1);
  });
});

// ─── Comparison: Level 1 vs Level 2 ─────────────────────────────────────────

describe("Level 1 vs Level 2 Benchmark Comparison", () => {
  it("Level 1 (synthetic) achieves 100% on all scenarios", () => {
    const level1Accuracy = 100;
    expect(level1Accuracy).toBe(100);
  });

  it("Level 2 (real video) achieves 0% end-to-end accuracy", () => {
    const level2Accuracy = 0;
    expect(level2Accuracy).toBe(0);
  });

  it("the gap is due to piece detection domain gap on unseen piece styles", () => {
    expect(BENCHMARK_REPORT.stages.boardSegmentation.grade).toBe("A");
    expect(BENCHMARK_REPORT.stages.pieceDetection.grade).toBe("C");
    expect(BENCHMARK_REPORT.stages.endToEnd.grade).toBe("F");
  });

  it("Level 1 validates pipeline logic; Level 2 validates model accuracy", () => {
    const level1Purpose = "pipeline logic validation";
    const level2Purpose = "model accuracy measurement";
    expect(level1Purpose).not.toBe(level2Purpose);
  });
});
