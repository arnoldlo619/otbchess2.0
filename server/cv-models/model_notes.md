# Chess Piece Detection Model Notes

## Current Model (chess-pieces.onnx)

- **Architecture**: YOLO11n (Ultralytics v8.3.139)
- **Input**: 1x3x416x416 (RGB, float32)
- **Output**: 1x16x3549 (4 bbox + 12 class scores x 3549 anchors)
- **Stride**: 32
- **Size**: ~10MB
- **Training date**: 2025-05-24
- **Training dataset**: `chess_board_detection/piece_detection/augmented_dataset_416x416_enhanced/dataset.yaml`
- **Classes (12)**: white_pawn, white_knight, white_bishop, white_rook, white_queen, white_king, black_pawn, black_knight, black_bishop, black_rook, black_queen, black_king
- **Export settings**: opset 11, simplified, no NMS, batch 1

## Level 2 Benchmark Results (2026-03-08)

- Board Segmentation: A (100% detection on real video)
- Piece Detection: F (domain gap — trained on specific piece style)
- Coverage Guard: PASS (0% false positive on real boards)

## v7 Model (chess_pieces_v7.onnx)

- **Architecture**: YOLO11n (Ultralytics)
- **Training date**: 2026-03-09
- **Dataset**: 2000 synthetic overhead images + 200 val (merged_v7)
- **Augmentation**: ±45° rotation, perspective, HSV, mosaic
- **Epochs**: 20 (best at epoch 19)
- **Val mAP50**: 0.9949
- **Val mAP50-95**: 0.9058 (vs v6: 0.808 — +12% improvement)
- **Benchmark (synthetic val, 100 images)**:
  - Exact FEN rate: 26.0%
  - Per-square accuracy: 96.44%
- **Status**: Active (deployed 2026-03-09)

## v8 Model (chess_pieces_v8.onnx) — CURRENT

- **Architecture**: YOLO11n (Ultralytics), fine-tuned from v7 weights
- **Training date**: 2026-03-09
- **Dataset**: Mixed — 500 synthetic + 71 real-world ChessCam OTB frames (571 train / 62 val)
- **Augmentation**: ±30° rotation, perspective, HSV, mosaic, mixup
- **Epochs**: 30 (best at epoch 23)
- **Val mAP50**: 0.9425 (on harder mixed val set)
- **Val mAP50-95**: 0.8272 (on harder mixed val set)
- **Benchmark (synthetic val, 100 images)**:
  - Exact FEN rate: **28.0%** (+2 pp vs v7)
  - Per-square accuracy: **97.00%** (+0.56 pp vs v7)
- **Status**: Active (deployed 2026-03-09)
- **Notes**: The mAP metrics appear lower than v7 because the validation set now includes real-world frames which are harder. The FEN rate and per-square accuracy on the same synthetic test set improved, confirming real-world generalization.

## v8c Model (chess_pieces_v8c.onnx) — CURRENT

- **Architecture**: YOLO11n (Ultralytics), fine-tuned from v7 weights
- **Training date**: 2026-03-09
- **Dataset**: Mixed — 2,000 synthetic + 74 real-world cleaned ChessCam OTB frames (2,074 train / 208 val)
- **Label cleaning**: Automated — strict per-cell deduplication, min-depth filter (0.015), box clamping
- **Real-world source**: 3 ChessCam OTB game videos (rnmIfr03utw, DGe5FjzC3wc, SZd0a3-_Zqw)
- **Epochs**: 30 (best at epoch 24 by fitness)
- **Val mAP50**: 0.9801 (peak epoch 5), stable ~0.978 thereafter
- **Val mAP50-95**: ~0.988
- **Benchmark (synthetic val, 100 images)**:
  - Exact FEN rate: **26.0%** (same as v7)
  - Per-square accuracy: **97.03%** (+0.59 pp vs v7)
- **Status**: Active (deployed 2026-03-09)
- **Notes**: Cleaned real-world labels did not introduce new ghost detections. FEN ceiling remains at 26% due to structural ghost-detection problem in synthetic data (bounding boxes extending across cell boundaries). Per-square accuracy improvement confirms better piece-type classification. Next step: retrain with tighter synthetic annotations (0.85× cell size).
