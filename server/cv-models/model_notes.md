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
