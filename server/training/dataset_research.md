# Chess Piece Detection Dataset Research

## Roboflow chess-full-pda2e (Primary Candidate)
- **URL**: https://universe.roboflow.com/richards-workspace-kh3oa/chess-full-pda2e
- **Images**: 289 images, 2894 labels
- **Classes (13)**: bishop, black-bishop, black-king, black-knight, black-pawn, black-queen, black-rook, white-bishop, white-king, white-knight, white-pawn, white-queen, white-rook
- **Note**: Has 13 classes (extra "bishop" class) — need to map to our 12 classes
- **Metrics**: mAP@50 98.9%, Precision 97.2%, Recall 98.5%
- **License**: Public Domain
- **Camera angle**: Constant angle, tripod to left of board
- **Limitation**: Single camera angle, single piece style

## Other Datasets Found
- Chess-Project-YOLO-v5: 692 images
- ChessReD (arxiv 2310.04086): First real-image chess recognition dataset, high viewing angle variability
- Kaggle chess pieces dataset by ninadaithal
- GTS.ai chess pieces detection dataset

## Strategy
Need to combine multiple datasets for diversity in:
1. Piece styles (Staunton, wooden, plastic, tournament)
2. Camera angles (overhead, angled, side)
3. Lighting conditions
4. Board textures and colors
