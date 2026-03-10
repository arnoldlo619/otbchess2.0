# Checkpoint: v7 Model Deployment Complete
**Date**: 2026-03-09 (re-verified 2026-03-10)
**Status**: COMPLETE ✓

## Training Results
| Metric        | Value        |
|---------------|-------------|
| Architecture  | YOLO11n (Ultralytics) |
| Total Epochs  | 20 (best at epoch 19) |
| mAP50         | 0.9949 (99.49%) |
| mAP50-95      | 0.9058 (90.58%) |
| vs v6 mAP50-95 | +12% improvement |
| Dataset       | 2000 synthetic overhead images + 200 val (merged_v7) |
| Augmentation  | ±45° rotation, perspective, HSV, mosaic |

## Deployment
- **Model file**: `server/cv-models/chess_pieces_v7.onnx` (9.99 MB)
- **cv_worker.py**: `PIECE_MODEL = chess_pieces_v7.onnx` ✓
- **Export settings**: ONNX opset 11, imgsz 416, simplified, batch 1, float32

## Full Pipeline Test Results (2026-03-10T20:10:56Z)
| Test | Status |
|------|--------|
| chess_pieces_v7.onnx file exists (9.99 MB) | PASS |
| chess-board-seg.onnx file exists (2.09 MB) | PASS |
| onnxruntime available (v1.24.3) | PASS |
| ONNX model loads successfully | PASS |
| Model input shape (1x3x416x416) | PASS |
| Model output shape (1x16x3549) | PASS |
| Inference smoke test (blank frame, 37ms) | PASS |
| cv_worker PIECE_MODEL = v7 | PASS |
| cv_worker.load_models() integration | PASS |
| CLASS_NAMES (12 chess pieces) | PASS |
| Model output class count (12 classes) | PASS |

**Result: 11/11 PASSED — ALL CLEAR ✓**

## Full Pipeline Test Results (2026-03-10 — Re-verified via playbook run)
| Test | Status |
|------|--------|
| chess_pieces_v7.onnx file exists (9.99 MB) | PASS |
| chess-board-seg.onnx file exists (2.09 MB) | PASS |
| onnxruntime available | PASS |
| ONNX model loads successfully | PASS |
| Model input shape (1x3x416x416) | PASS |
| Model output shape (1x16x3549) | PASS |
| Inference smoke test (blank frame) | PASS |
| cv_worker PIECE_MODEL = v7 | PASS |
| cv_worker.load_models() integration | PASS |
| CLASS_NAMES (12 chess pieces) | PASS |
| Model output class count (12 classes) | PASS |

**Result: 11/11 PASSED — ALL CLEAR ✓**

## Benchmark (Synthetic Val, 100 images)
- Exact FEN rate: 26.0%
- Per-square accuracy: 96.44%

## Next Steps
- Continue with v8/v8c models for real-world generalization
- Address ghost-detection issue in synthetic data (bounding boxes extending across cell boundaries)
- Retrain with tighter synthetic annotations (0.85× cell size)
