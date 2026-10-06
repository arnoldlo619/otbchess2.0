# High-Rotation Chessboard Corner Detection QA

**Scope:** Correct degenerate board corner ordering when a segmented chessboard is rotated roughly 45° in frame.

## Root cause

`sort_corners()` previously assigned vertices to strict centroid quadrants. At approximately 45°, a top or bottom vertex can lie directly on the centroid axis, miss its intended quadrant, and activate the fallback point. The result could repeat a vertex—for example, returning the top corner for both top-left and top-right—which collapses the perspective transform.

## Correction

The worker now orders four vertices by their centroid angle and rotates the clockwise polygon to begin at the visually top-most, then left-most, vertex. The result is a unique `[top/left, top/right, bottom/right, bottom/left]` source quadrilateral for `warp_board()` across normal and highly rotated masks.

## Validation

| Check | Result |
|---|---|
| Python geometry regression | 2 passed |
| Python syntax compilation | passed |
| Existing square-map/FEN and rotated-corner contracts | 43 passed |
| Synthetic board masks | 30°, 35°, 40°, 45°, 50°, and 60° each produced 4 unique clockwise corners |
| 45° mask | signed area 45,369 px²; no repeated vertex |

The verification uses deterministic synthetic segmentation masks; it does not alter any user recording or production video. A full video-model benchmark remains a separate task because this fix protects the geometric warp boundary rather than changing the detection model.
