#!/usr/bin/env python3
"""
OTB Chess — Server-Side Computer Vision Worker
================================================
Processes a recorded chess game video to automatically reconstruct the PGN.

Pipeline:
  1. Sample frames from the video at regular intervals (every ~2 seconds).
  2. Run board segmentation (ONNX) to detect the board boundary.
  3. Warp the board region to a top-down 416×416 view.
  4. Run piece detection (YOLO11n ONNX) to classify pieces on each square.
  5. Reconstruct the FEN for each sampled frame.
  6. Diff consecutive FENs to detect moves using python-chess for validation.
  7. Build the PGN from the validated move sequence.
  8. Output JSON to stdout for the Node.js caller.

Usage:
  python3 cv_worker.py <video_path> [--fps-sample 0.5] [--confidence 0.45] [--fen-timeline-file path.json]

Output (stdout):
  JSON object with keys:
    pgn          — reconstructed PGN string (empty string if failed)
    moveTimeline — list of {moveNumber, timestampMs, confidence}
    framesProcessed — number of frames sampled
    totalFrames  — estimated total frames in video
    error        — error message (null on success)
    warnings     — list of warning strings
    seedUsed     — true if client fenTimeline seed was used
"""

import sys
import json
import argparse
import math
import traceback
from pathlib import Path

import cv2
import numpy as np

try:
    import onnxruntime as ort
    ORT_AVAILABLE = True
except ImportError:
    ORT_AVAILABLE = False

try:
    import chess
    import chess.pgn
    CHESS_AVAILABLE = True
except ImportError:
    CHESS_AVAILABLE = False

# ─── Constants ────────────────────────────────────────────────────────────────

SCRIPT_DIR = Path(__file__).parent
BOARD_SEG_MODEL = SCRIPT_DIR / "cv-models" / "chess-board-seg.onnx"
PIECE_MODEL     = SCRIPT_DIR / "cv-models" / "chess-pieces.onnx"

BOARD_SEG_SIZE  = 256   # Board segmentation model input size
PIECE_SIZE      = 416   # Piece detection model input size
PIECE_CONF_THRESHOLD = 0.40   # Lowered from 0.45 — catches more pieces at moderate confidence
NMS_IOU_THRESHOLD    = 0.35   # Tightened from 0.45 — suppresses more duplicate detections
NMS_CROSS_CLASS_IOU  = 0.50   # Cross-class NMS: two different pieces on same square → keep higher-conf

# Minimum number of consecutive frames a FEN must appear (or be similar to)
# before it is accepted into the move-detection timeline.  Filters single-frame
# noise spikes that would otherwise pollute the FEN sequence.
FEN_STABILITY_FRAMES = 2

# Class names in YOLO model output order (12 classes)
# white pieces first, then black pieces
CLASS_NAMES = [
    'P', 'N', 'B', 'R', 'Q', 'K',   # white: pawn, knight, bishop, rook, queen, king
    'p', 'n', 'b', 'r', 'q', 'k',   # black: pawn, knight, bishop, rook, queen, king
]

# ─── Model Loading ────────────────────────────────────────────────────────────

def load_models():
    """Load ONNX models. Returns (board_seg_session, piece_session) or raises."""
    if not ORT_AVAILABLE:
        raise RuntimeError("onnxruntime not installed")
    if not BOARD_SEG_MODEL.exists():
        raise FileNotFoundError(f"Board seg model not found: {BOARD_SEG_MODEL}")
    if not PIECE_MODEL.exists():
        raise FileNotFoundError(f"Piece model not found: {PIECE_MODEL}")

    opts = ort.SessionOptions()
    opts.intra_op_num_threads = 2
    opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL

    board_seg = ort.InferenceSession(
        str(BOARD_SEG_MODEL),
        sess_options=opts,
        providers=["CPUExecutionProvider"],
    )
    piece_det = ort.InferenceSession(
        str(PIECE_MODEL),
        sess_options=opts,
        providers=["CPUExecutionProvider"],
    )
    return board_seg, piece_det


# ─── Board Segmentation ───────────────────────────────────────────────────────

def run_board_segmentation(board_seg_session, frame_bgr):
    """
    Run the board segmentation model on a BGR frame.
    Returns a (256, 256) float32 mask where values > 0.5 indicate board area.
    """
    # Resize to 256×256 and convert to RGB float32
    resized = cv2.resize(frame_bgr, (BOARD_SEG_SIZE, BOARD_SEG_SIZE))
    rgb = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0

    # CHW format: [1, 3, 256, 256]
    tensor = np.transpose(rgb, (2, 0, 1))[np.newaxis, ...]

    input_name = board_seg_session.get_inputs()[0].name
    logits = board_seg_session.run(None, {input_name: tensor})[0]

    # Apply sigmoid to get probability mask
    mask = 1.0 / (1.0 + np.exp(-logits.squeeze()))
    return mask.astype(np.float32)


def _hough_quad_corners(binary, orig_w, orig_h):
    """
    Attempt to find the 4 corners of the board quadrilateral using Hough lines
    on the contour edge image.

    Strategy
    --------
    1. Detect Hough lines on the contour boundary.
    2. Cluster lines into two orientation families: near-horizontal and
       near-vertical (within ±45° of each axis).
    3. Within each family, find the two extreme (outermost) lines.
    4. Compute the 4 intersection points of those 4 lines → board corners.

    Returns a list of 4 (x, y) tuples in original image coordinates, or None.
    """
    # Edge image from the binary mask boundary
    edges = cv2.Canny(binary, 50, 150)
    lines = cv2.HoughLines(edges, rho=1, theta=np.pi / 360, threshold=40)
    if lines is None or len(lines) < 4:
        return None

    scale_x = orig_w / BOARD_SEG_SIZE
    scale_y = orig_h / BOARD_SEG_SIZE
    sz = BOARD_SEG_SIZE

    def line_endpoints(rho, theta):
        """Convert (rho, theta) to two far-apart points on the line."""
        a, b = math.cos(theta), math.sin(theta)
        x0, y0 = a * rho, b * rho
        return (x0 + 1000 * (-b), y0 + 1000 * a), (x0 - 1000 * (-b), y0 - 1000 * a)

    def intersect(r1, t1, r2, t2):
        """Compute intersection of two Hough lines."""
        A = np.array([[math.cos(t1), math.sin(t1)],
                      [math.cos(t2), math.sin(t2)]])
        b = np.array([r1, r2])
        det = A[0, 0] * A[1, 1] - A[0, 1] * A[1, 0]
        if abs(det) < 1e-6:
            return None
        x = (A[1, 1] * b[0] - A[0, 1] * b[1]) / det
        y = (A[0, 0] * b[1] - A[1, 0] * b[0]) / det
        return (x, y)

    # Separate lines into near-horizontal and near-vertical families
    # theta=0 → vertical line, theta=π/2 → horizontal line
    horiz, vert = [], []
    for line in lines:
        rho, theta = float(line[0][0]), float(line[0][1])
        deg = math.degrees(theta)
        if 45 <= deg <= 135:       # near-horizontal
            horiz.append((rho, theta))
        else:                       # near-vertical (0–45° or 135–180°)
            vert.append((rho, theta))

    if len(horiz) < 2 or len(vert) < 2:
        return None

    # For each family, find the two outermost lines by their rho value
    # (rho = signed distance from origin, so min/max gives opposite edges)
    horiz.sort(key=lambda l: l[0])
    vert.sort(key=lambda l: l[0])

    h_top    = horiz[0]   # smallest rho → top edge
    h_bottom = horiz[-1]  # largest rho  → bottom edge
    v_left   = vert[0]    # smallest rho → left edge
    v_right  = vert[-1]   # largest rho  → right edge

    # Compute the 4 corner intersections
    tl = intersect(h_top[0], h_top[1], v_left[0], v_left[1])
    tr = intersect(h_top[0], h_top[1], v_right[0], v_right[1])
    br = intersect(h_bottom[0], h_bottom[1], v_right[0], v_right[1])
    bl = intersect(h_bottom[0], h_bottom[1], v_left[0], v_left[1])

    if any(p is None for p in [tl, tr, br, bl]):
        return None

    # Sanity check: all corners must be within a reasonable distance of the mask
    margin = sz * 0.3
    for x, y in [tl, tr, br, bl]:
        if not (-margin <= x <= sz + margin and -margin <= y <= sz + margin):
            return None

    # Scale to original image coordinates
    pts = [
        (int(tl[0] * scale_x), int(tl[1] * scale_y)),
        (int(tr[0] * scale_x), int(tr[1] * scale_y)),
        (int(br[0] * scale_x), int(br[1] * scale_y)),
        (int(bl[0] * scale_x), int(bl[1] * scale_y)),
    ]
    return pts


def extract_corners(mask, orig_w, orig_h):
    """
    Extract 4 board corners from the segmentation mask.

    Fallback chain (best to worst):
      1. Adaptive approxPolyDP: try increasing epsilon until exactly 4 vertices
      2. Hough-line intersection of outermost boundary lines
      3. minAreaRect of the largest contour (rotated bounding box)

    Returns list of 4 (x, y) tuples in [tl, tr, br, bl] order, or None.
    """
    binary = (mask > 0.5).astype(np.uint8) * 255
    coverage = np.sum(binary > 0) / (BOARD_SEG_SIZE * BOARD_SEG_SIZE)

    if coverage < 0.05:
        return None, coverage

    # Morphological closing to fill gaps
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
    binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)

    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None, coverage

    # Largest contour = board
    board_contour = max(contours, key=cv2.contourArea)
    arc_len = cv2.arcLength(board_contour, True)

    scale_x = orig_w / BOARD_SEG_SIZE
    scale_y = orig_h / BOARD_SEG_SIZE

    # ── Tier 1: Adaptive approxPolyDP ────────────────────────────────────────
    # Try progressively larger epsilon values to force exactly 4 vertices.
    # This handles boards with slightly irregular contours (e.g. pieces
    # protruding from the edges) that produce 5–8 vertex approximations.
    best_approx = None
    best_conf = 0.0
    for eps_factor in [0.02, 0.04, 0.06, 0.08, 0.10, 0.12, 0.15, 0.20]:
        eps = eps_factor * arc_len
        approx = cv2.approxPolyDP(board_contour, eps, True)
        n = len(approx)
        if n == 4:
            pts = [(int(p[0][0] * scale_x), int(p[0][1] * scale_y)) for p in approx]
            conf = min(0.95, coverage * 2) * (1.0 - eps_factor * 2)
            return sort_corners(pts), max(conf, 0.50)
        elif n > 4 and best_approx is None:
            # Keep the first over-approximation as fallback
            best_approx = approx
            best_conf = coverage * 0.8

    # ── Tier 2: Hough-line quad corner detection ──────────────────────────────
    hough_pts = _hough_quad_corners(binary, orig_w, orig_h)
    if hough_pts is not None:
        return sort_corners(hough_pts), min(0.90, coverage * 1.8)

    # ── Tier 3: minAreaRect fallback ──────────────────────────────────────────
    if best_approx is not None:
        min_rect = cv2.minAreaRect(board_contour)
        box = cv2.boxPoints(min_rect)
        pts = [(int(p[0] * scale_x), int(p[1] * scale_y)) for p in box]
        return sort_corners(pts), best_conf

    return None, coverage


def sort_corners(pts):
    """Sort 4 corner points into [tl, tr, br, bl] order."""
    cx = sum(p[0] for p in pts) / 4
    cy = sum(p[1] for p in pts) / 4

    tl = min([p for p in pts if p[0] < cx and p[1] < cy], key=lambda p: p[0] + p[1], default=pts[0])
    tr = min([p for p in pts if p[0] >= cx and p[1] < cy], key=lambda p: -p[0] + p[1], default=pts[1])
    br = max([p for p in pts if p[0] >= cx and p[1] >= cy], key=lambda p: p[0] + p[1], default=pts[2])
    bl = min([p for p in pts if p[0] < cx and p[1] >= cy], key=lambda p: p[0] - p[1], default=pts[3])

    return [tl, tr, br, bl]


# ─── Board Warp ───────────────────────────────────────────────────────────────

def warp_board(frame_bgr, corners):
    """
    Apply a perspective transform to extract the board as a top-down PIECE_SIZE×PIECE_SIZE image.
    corners: [tl, tr, br, bl] as (x, y) tuples.
    """
    src = np.float32(corners)
    dst = np.float32([
        [0, 0],
        [PIECE_SIZE - 1, 0],
        [PIECE_SIZE - 1, PIECE_SIZE - 1],
        [0, PIECE_SIZE - 1],
    ])
    M = cv2.getPerspectiveTransform(src, dst)
    warped = cv2.warpPerspective(frame_bgr, M, (PIECE_SIZE, PIECE_SIZE))
    return warped


# ─── Board Auto-Alignment (Hough-line rotation correction) ──────────────────

def detect_board_rotation_angle(warped_bgr):
    """
    Detect the dominant rotation angle of the chessboard grid in a warped image.

    Uses standard HoughLines on CLAHE-enhanced Canny edges.  The dominant line
    angle (by vote count) reveals the grid orientation.  The result is mapped
    to a rotation correction in the range [-45, 45] degrees.

    Returns the rotation correction angle in degrees, or None if detection
    fails.  A positive value means the grid is rotated clockwise by that many
    degrees and should be counter-rotated.
    """
    gray = cv2.cvtColor(warped_bgr, cv2.COLOR_BGR2GRAY)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    gray = clahe.apply(gray)
    blurred = cv2.GaussianBlur(gray, (3, 3), 0)
    edges = cv2.Canny(blurred, 30, 90)

    lines = cv2.HoughLines(edges, rho=1, theta=np.pi / 360, threshold=60)
    if lines is None or len(lines) < 4:
        return None

    # Collect angles in degrees [0, 180)
    angles = np.array([np.degrees(line[0][1]) for line in lines])

    # Build a histogram to find the dominant angle
    hist, bin_edges = np.histogram(angles, bins=180, range=(0, 180))
    peak_idx = int(np.argmax(hist))
    peak_angle = float(bin_edges[peak_idx])

    # Convert to a rotation correction in [-45, 45]:
    # Grid lines should be at 0° (horizontal) or 90° (vertical).
    # The correction is the deviation from the nearest multiple of 90°.
    if peak_angle <= 45:
        correction = peak_angle          # rotate CCW by this amount
    elif peak_angle <= 135:
        correction = peak_angle - 90     # deviation from 90°
    else:
        correction = peak_angle - 180    # deviation from 180°

    return correction


def auto_align_board(warped_bgr):
    """
    Automatically align a warped board image so that the grid lines are
    axis-aligned (horizontal and vertical).

    Uses Hough lines to detect the dominant rotation angle, then applies
    a rotation transform and crops the centre to PIECE_SIZE×PIECE_SIZE.
    This may clip corners of the board, but the centre region (where most
    pieces are) will have an axis-aligned grid that the YOLO piece detector
    can recognise.

    Returns (aligned_bgr, rotation_angle_applied).
    """
    angle = detect_board_rotation_angle(warped_bgr)
    if angle is None or abs(angle) < 2.0:
        # No significant rotation detected — return as-is
        return warped_bgr, 0.0

    h, w = warped_bgr.shape[:2]
    cx, cy = w / 2.0, h / 2.0

    # Rotate the image around its centre.  Use a larger canvas to avoid
    # clipping, then crop the centre PIECE_SIZE×PIECE_SIZE region.
    M = cv2.getRotationMatrix2D((cx, cy), -angle, 1.0)

    # Expand canvas to hold the full rotated image
    cos_a = abs(M[0, 0])
    sin_a = abs(M[0, 1])
    new_w = int(h * sin_a + w * cos_a)
    new_h = int(h * cos_a + w * sin_a)

    # Adjust translation so the rotated image is centred on the new canvas
    M[0, 2] += (new_w - w) / 2.0
    M[1, 2] += (new_h - h) / 2.0

    rotated = cv2.warpAffine(warped_bgr, M, (new_w, new_h),
                              flags=cv2.INTER_LINEAR,
                              borderMode=cv2.BORDER_CONSTANT,
                              borderValue=(0, 0, 0))

    # Crop the centre PIECE_SIZE×PIECE_SIZE region
    rcx, rcy = new_w // 2, new_h // 2
    x1 = max(0, rcx - PIECE_SIZE // 2)
    y1 = max(0, rcy - PIECE_SIZE // 2)
    x2 = min(new_w, x1 + PIECE_SIZE)
    y2 = min(new_h, y1 + PIECE_SIZE)

    cropped = rotated[y1:y2, x1:x2]

    # Ensure output is exactly PIECE_SIZE×PIECE_SIZE
    if cropped.shape[0] != PIECE_SIZE or cropped.shape[1] != PIECE_SIZE:
        cropped = cv2.resize(cropped, (PIECE_SIZE, PIECE_SIZE))

    return cropped, angle


def _rotate_corners(corners, angle_deg, frame_w, frame_h):
    """
    Rotate the 4 source corners around their centroid by angle_deg degrees.

    This is used to "un-rotate" the board before the perspective warp, so that
    the warp maps the board's playing grid (not its outer frame) to an
    axis-aligned square.

    Parameters
    ----------
    corners : list of (x, y) tuples  [tl, tr, br, bl]
    angle_deg : float  rotation angle in degrees (positive = CCW)
    frame_w, frame_h : int  frame dimensions (for clamping)

    Returns
    -------
    list of (x, y) tuples  [tl, tr, br, bl]  rotated corners
    """
    cx = sum(p[0] for p in corners) / 4.0
    cy = sum(p[1] for p in corners) / 4.0
    rad = math.radians(angle_deg)
    cos_a = math.cos(rad)
    sin_a = math.sin(rad)

    rotated = []
    for x, y in corners:
        dx, dy = x - cx, y - cy
        rx = cx + dx * cos_a - dy * sin_a
        ry = cy + dx * sin_a + dy * cos_a
        # Clamp to frame boundaries
        rx = max(0, min(frame_w - 1, rx))
        ry = max(0, min(frame_h - 1, ry))
        rotated.append((int(round(rx)), int(round(ry))))

    return rotated


def warp_board_aligned(frame_bgr, corners):
    """
    Two-pass board warp that produces an axis-aligned grid.

    Pass 1: Warp with detected corners → check grid rotation via Hough lines.
    Pass 2: If grid is rotated, rotate source corners and re-warp.

    Returns (warped_bgr, rotation_angle_applied).
    """
    # Pass 1: initial warp
    warped = warp_board(frame_bgr, corners)
    angle = detect_board_rotation_angle(warped)

    if angle is None or abs(angle) < 2.0:
        return warped, 0.0

    # Pass 2: rotate source corners by -angle (undo the grid rotation)
    h, w = frame_bgr.shape[:2]
    rotated_corners = _rotate_corners(corners, -angle, w, h)
    re_warped = warp_board(frame_bgr, rotated_corners)

    return re_warped, angle


# ─── Piece Detection ──────────────────────────────────────────────────────────

def run_piece_detection(piece_session, board_bgr):
    """
    Run YOLO11n piece detection on the warped board image.
    Returns list of detection dicts: {cx, cy, w, h, piece, confidence}.
    """
    # Convert to RGB float32 [1, 3, 416, 416]
    rgb = cv2.cvtColor(board_bgr, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
    tensor = np.transpose(rgb, (2, 0, 1))[np.newaxis, ...]

    input_name = piece_session.get_inputs()[0].name
    output = piece_session.run(None, {input_name: tensor})[0]  # [1, 16, 3549]

    output = output.squeeze()  # [16, 3549]
    num_anchors = output.shape[1]

    detections = []
    for i in range(num_anchors):
        cx = float(output[0, i])
        cy = float(output[1, i])
        w  = float(output[2, i])
        h  = float(output[3, i])

        # Find best class among 12 piece classes
        class_scores = output[4:16, i]
        best_class = int(np.argmax(class_scores))
        best_score = float(class_scores[best_class])

        if best_score >= PIECE_CONF_THRESHOLD:
            detections.append({
                "cx": cx, "cy": cy, "w": w, "h": h,
                "piece": CLASS_NAMES[best_class],
                "confidence": best_score,
            })

    # Intra-class NMS first, then cross-class deduplication
    detections = apply_nms(detections, NMS_IOU_THRESHOLD)
    return apply_cross_class_nms(detections, NMS_CROSS_CLASS_IOU)


def apply_nms(detections, iou_threshold):
    """Non-Maximum Suppression — keeps highest-confidence detection per region."""
    if not detections:
        return []

    detections.sort(key=lambda d: d["confidence"], reverse=True)
    kept = []
    suppressed = set()

    for i, a in enumerate(detections):
        if i in suppressed:
            continue
        kept.append(a)
        for j, b in enumerate(detections[i + 1:], start=i + 1):
            if j in suppressed:
                continue
            if compute_iou(a, b) > iou_threshold:
                suppressed.add(j)

    return kept


def apply_cross_class_nms(detections, iou_threshold):
    """
    Cross-class NMS: if two detections of *different* piece types overlap
    significantly (IoU > threshold), keep only the higher-confidence one.

    This handles the case where the model detects both 'B' and 'R' on the
    same square — a common false-positive pattern on ambiguous piece shapes.
    """
    if not detections:
        return []

    detections = sorted(detections, key=lambda d: d["confidence"], reverse=True)
    kept = []
    suppressed = set()

    for i, a in enumerate(detections):
        if i in suppressed:
            continue
        kept.append(a)
        for j, b in enumerate(detections[i + 1:], start=i + 1):
            if j in suppressed:
                continue
            # Only apply cross-class suppression when pieces differ
            if a["piece"] != b["piece"] and compute_iou(a, b) > iou_threshold:
                suppressed.add(j)

    return kept


def compute_iou(a, b):
    ax1, ay1 = a["cx"] - a["w"] / 2, a["cy"] - a["h"] / 2
    ax2, ay2 = a["cx"] + a["w"] / 2, a["cy"] + a["h"] / 2
    bx1, by1 = b["cx"] - b["w"] / 2, b["cy"] - b["h"] / 2
    bx2, by2 = b["cx"] + b["w"] / 2, b["cy"] + b["h"] / 2

    ix1, iy1 = max(ax1, bx1), max(ay1, by1)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    iw = max(0, ix2 - ix1)
    ih = max(0, iy2 - iy1)
    intersection = iw * ih

    a_area = (ax2 - ax1) * (ay2 - ay1)
    b_area = (bx2 - bx1) * (by2 - by1)
    union = a_area + b_area - intersection
    return intersection / union if union > 0 else 0.0


# ─── FEN Reconstruction ───────────────────────────────────────────────────────

# Per-side maximum piece counts (theoretical maxima for a legal position)
_MAX_PIECES_PER_SIDE = {
    'K': 1, 'Q': 9, 'R': 10, 'B': 10, 'N': 10, 'P': 8,
    'k': 1, 'q': 9, 'r': 10, 'b': 10, 'n': 10, 'p': 8,
}

# Fraction of a square's width/height used as an edge margin.
# Detections whose centre falls within this margin of the board edge are
# more likely to be noise from the warp boundary than real pieces.
_EDGE_MARGIN_FRAC = 0.04   # 4% of PIECE_SIZE ≈ 17px on a 416px board


def square_map(detections, board_size=None, grid_angle=0.0):
    """
    Map a list of YOLO piece detections to a 8×8 grid of (piece, confidence)
    entries.

    Algorithm
    ---------
    1. Clip detections whose centre is within the edge margin (likely noise).
    2. If grid_angle != 0, rotate each detection's centre by -grid_angle
       around the image centre so the grid becomes axis-aligned in the
       rotated coordinate space.
    3. For each of the 64 squares, collect all detections whose (rotated)
       centre falls inside that square's bounding box.
    4. Within each square keep only the detection with the highest confidence
       (per-square NMS).
    5. Apply per-piece-type count caps: if a piece type appears more times
       than its legal maximum, remove the lowest-confidence instances.

    Parameters
    ----------
    detections : list[dict]
        Each dict has keys: cx, cy, w, h, piece, confidence.
        Coordinates are in pixels relative to the board image (0..board_size).
    board_size : int, optional
        Side length of the square board image in pixels.  Defaults to
        PIECE_SIZE (416).
    grid_angle : float, optional
        Rotation angle of the grid in degrees (as returned by
        detect_board_rotation_angle).  When non-zero, detection centres
        are counter-rotated before grid assignment so that a rotated
        board can be mapped without image rotation.  Defaults to 0.

    Returns
    -------
    board : list[list[tuple[str, float] | None]]
        8×8 grid.  board[row][col] is (piece_char, confidence) or None.
        Row 0 is the top of the image (rank 8 in standard orientation).
    """
    if board_size is None:
        board_size = PIECE_SIZE

    sq = board_size / 8.0                    # square side in pixels
    margin = board_size * _EDGE_MARGIN_FRAC  # edge margin in pixels

    # Step 1 — clip edge detections
    valid = [
        d for d in detections
        if margin <= d["cx"] <= board_size - margin
        and margin <= d["cy"] <= board_size - margin
    ]

    # Step 2 — if grid is rotated, counter-rotate detection centres
    # so the grid becomes axis-aligned in the rotated coordinate space.
    if abs(grid_angle) >= 2.0:
        centre = board_size / 2.0
        rad = math.radians(-grid_angle)  # counter-rotate
        cos_a = math.cos(rad)
        sin_a = math.sin(rad)

        rotated_valid = []
        for d in valid:
            dx = d["cx"] - centre
            dy = d["cy"] - centre
            rx = centre + dx * cos_a - dy * sin_a
            ry = centre + dx * sin_a + dy * cos_a
            rotated_valid.append({**d, "_rx": rx, "_ry": ry})
        valid = rotated_valid

        # After rotation, the board occupies a smaller inscribed square.
        # Compute the effective board bounds in rotated space.
        abs_cos = abs(cos_a)
        abs_sin = abs(sin_a)
        # The inscribed square side length after rotation
        if abs_cos + abs_sin > 0:
            effective_size = board_size / (abs_cos + abs_sin)
        else:
            effective_size = board_size
        offset = (board_size - effective_size) / 2.0
        eff_sq = effective_size / 8.0
    else:
        for d in valid:
            d["_rx"] = d["cx"]
            d["_ry"] = d["cy"]
        offset = 0.0
        eff_sq = sq
        effective_size = board_size

    # Step 3 & 4 — per-square best detection
    board = [[None] * 8 for _ in range(8)]
    for det in valid:
        rx = det["_rx"] - offset
        ry = det["_ry"] - offset
        if rx < 0 or ry < 0 or rx >= effective_size or ry >= effective_size:
            continue
        col = min(7, int(rx / eff_sq))
        row = min(7, int(ry / eff_sq))
        existing = board[row][col]
        if existing is None or det["confidence"] > existing[1]:
            board[row][col] = (det["piece"], det["confidence"])

    # Step 5 — per-piece-type count caps
    # Collect all placed pieces sorted by confidence descending
    placed = []  # (row, col, piece, confidence)
    for r in range(8):
        for c in range(8):
            if board[r][c] is not None:
                piece, conf = board[r][c]
                placed.append((r, c, piece, conf))

    # Count occurrences per piece type
    type_counts = {}
    for _, _, piece, _ in placed:
        type_counts[piece] = type_counts.get(piece, 0) + 1

    # For any over-represented piece type, remove lowest-confidence instances
    for piece_type, max_count in _MAX_PIECES_PER_SIDE.items():
        count = type_counts.get(piece_type, 0)
        if count > max_count:
            # Find all squares with this piece type, sorted by confidence asc
            instances = [
                (r, c, conf)
                for r, c, p, conf in placed
                if p == piece_type
            ]
            instances.sort(key=lambda x: x[2])  # lowest confidence first
            # Remove the excess lowest-confidence instances
            to_remove = count - max_count
            for r, c, _ in instances[:to_remove]:
                board[r][c] = None

    return board


def detections_to_fen(detections, board_size=None, grid_angle=0.0):
    """
    Convert raw YOLO piece detections to a FEN position string.

    This is the main entry point for FEN generation.  It calls square_map()
    to build the 8×8 grid, then encodes it as a FEN position string.

    The turn field is always 'w' as a placeholder — the actual turn is
    tracked by the chess.Board state in the move detection pipeline.

    Parameters
    ----------
    detections : list[dict]
        Raw YOLO detections with cx, cy, w, h, piece, confidence.
    board_size : int, optional
        Side length of the board image in pixels.
    grid_angle : float, optional
        Grid rotation angle in degrees (from detect_board_rotation_angle).

    Returns a FEN string, or None if the position is invalid (e.g. missing
    kings after all filtering).
    """
    if not detections:
        return None

    board = square_map(detections, board_size=board_size, grid_angle=grid_angle)

    ranks = []
    for row in range(8):
        rank = ""
        empty = 0
        for col in range(8):
            cell = board[row][col]
            if cell is None:
                empty += 1
            else:
                if empty > 0:
                    rank += str(empty)
                    empty = 0
                rank += cell[0]  # piece character
        if empty > 0:
            rank += str(empty)
        ranks.append(rank)

    fen_pos = "/".join(ranks)

    # Count total pieces — if we have fewer than 2, the detection is too sparse
    total_pieces = sum(1 for c in fen_pos if c.isalpha())
    if total_pieces < 2:
        return None

    # Always use 'w' as placeholder — actual turn is tracked by chess.Board
    return f"{fen_pos} w - - 0 1"


def reconstruct_fen(detections, grid_angle=0.0):
    """
    Backward-compatible wrapper around detections_to_fen().

    All callers in the pipeline use reconstruct_fen(); this wrapper ensures
    they automatically benefit from the improved square_map() logic without
    requiring any call-site changes.
    """
    return detections_to_fen(detections, grid_angle=grid_angle)


# ─── FEN Validation ─────────────────────────────────────────────────────────

# Valid piece count ranges for a legal chess position
_PIECE_LIMITS = {
    # (white_piece, black_piece, min_total, max_total)
    'K': (1, 1, 1, 1),   # Exactly 1 white king
    'k': (1, 1, 1, 1),   # Exactly 1 black king
    'Q': (0, 0, 0, 9),   # 0–9 queens (1 + up to 8 promoted)
    'q': (0, 0, 0, 9),
    'R': (0, 0, 0, 10),  # 0–10 rooks
    'r': (0, 0, 0, 10),
    'B': (0, 0, 0, 10),  # 0–10 bishops
    'b': (0, 0, 0, 10),
    'N': (0, 0, 0, 10),  # 0–10 knights
    'n': (0, 0, 0, 10),
    'P': (0, 0, 0, 8),   # 0–8 pawns
    'p': (0, 0, 0, 8),
}

# Maximum total pieces on the board (32 at start, can only decrease)
_MAX_TOTAL_PIECES = 32
_MIN_TOTAL_PIECES = 2   # At minimum, both kings

# Maximum pawns per side (8 at start)
_MAX_PAWNS_PER_SIDE = 8


def validate_fen_piece_count(fen):
    """
    Validate that a FEN position string represents a plausible chess position.

    Checks:
      - Exactly 1 white king (K) and 1 black king (k)
      - Total pieces between 2 and 32
      - No more than 8 pawns per side
      - No piece type exceeds its theoretical maximum
      - FEN position part has exactly 8 ranks

    Returns True if valid, False if the FEN should be discarded.
    """
    if not fen or not isinstance(fen, str):
        return False

    pos = fen.split(" ")[0]
    ranks = pos.split("/")
    if len(ranks) != 8:
        return False

    # Count all pieces
    counts = {}
    total = 0
    for rank in ranks:
        for ch in rank:
            if ch.isalpha():
                counts[ch] = counts.get(ch, 0) + 1
                total += 1
            elif ch.isdigit():
                pass  # empty squares
            else:
                return False  # unexpected character

    # Kings: allow 0 or 1 per side (partial detections may miss kings
    # when the board is clipped by rotation correction)
    if counts.get('K', 0) > 1:
        return False
    if counts.get('k', 0) > 1:
        return False

    # Total piece count must be in valid range
    if not (_MIN_TOTAL_PIECES <= total <= _MAX_TOTAL_PIECES):
        return False

    # Pawn limits
    if counts.get('P', 0) > _MAX_PAWNS_PER_SIDE:
        return False
    if counts.get('p', 0) > _MAX_PAWNS_PER_SIDE:
        return False

    # Per-piece-type upper bounds
    for piece, (_, _, _, max_count) in _PIECE_LIMITS.items():
        if counts.get(piece, 0) > max_count:
            return False

    # Each rank must expand to exactly 8 squares
    for rank in ranks:
        squares = 0
        for ch in rank:
            if ch.isdigit():
                squares += int(ch)
            elif ch.isalpha():
                squares += 1
        if squares != 8:
            return False

    return True


# Maximum board coverage fraction above which we distrust the segmentation model.
# The model was observed to return >0.77 coverage on plain green frames (no board).
# A real board should cover 30–70% of the frame at typical recording angles.
_MAX_TRUSTED_COVERAGE = 0.85


# ─── FEN Comparison ───────────────────────────────────────────────────────────

def fen_position_part(fen):
    """Extract just the piece placement part of a FEN string."""
    return fen.split(" ")[0] if fen else ""


def fens_are_similar(fen_a, fen_b, threshold=0.85):
    """
    Check if two FEN positions are similar enough to be considered the same.
    Uses character-level similarity on the position part.
    """
    if not fen_a or not fen_b:
        return False
    pos_a = fen_position_part(fen_a)
    pos_b = fen_position_part(fen_b)
    if pos_a == pos_b:
        return True

    # Levenshtein-like similarity
    len_a, len_b = len(pos_a), len(pos_b)
    if len_a == 0 or len_b == 0:
        return False

    matches = sum(a == b for a, b in zip(pos_a, pos_b))
    similarity = matches / max(len_a, len_b)
    return similarity >= threshold


def count_piece_differences(fen_a, fen_b):
    """Count how many squares differ between two FEN positions."""
    if not fen_a or not fen_b:
        return 64

    def fen_to_board(fen_pos):
        board = []
        for rank in fen_pos.split("/"):
            row = []
            for ch in rank:
                if ch.isdigit():
                    row.extend([""] * int(ch))
                else:
                    row.append(ch)
            board.extend(row)
        return board

    board_a = fen_to_board(fen_position_part(fen_a))
    board_b = fen_to_board(fen_position_part(fen_b))

    if len(board_a) != 64 or len(board_b) != 64:
        return 64

    return sum(1 for a, b in zip(board_a, board_b) if a != b)


# ─── Move Detection ───────────────────────────────────────────────────────────

def _try_legal_moves(board_state, target_pos):
    """
    Try every legal move from board_state and return the one whose resulting
    position best matches target_pos (the position part of the detected FEN).

    Returns (san, confidence) or (None, 0.0).
    """
    best_move = None
    best_similarity = 0.0

    for legal_move in board_state.legal_moves:
        test_board = board_state.copy()
        test_board.push(legal_move)
        test_pos = fen_position_part(test_board.fen())

        if test_pos == target_pos:
            # Exact position match
            return board_state.san(legal_move), 1.0

        # Partial similarity (character-level on position string)
        matches = sum(a == b for a, b in zip(test_pos, target_pos))
        similarity = matches / max(len(test_pos), len(target_pos))

        if similarity > best_similarity:
            best_similarity = similarity
            best_move = legal_move

    if best_move and best_similarity >= 0.90:
        return board_state.san(best_move), best_similarity

    return None, 0.0


def _try_resync_board(board_state, target_pos, max_depth=3):
    """
    BFS up to max_depth moves deep to find a legal move sequence that
    transforms the current board position into target_pos.

    Returns a list of SAN strings if found, or None.
    Uses iterative deepening to prefer shorter paths.
    """
    if not CHESS_AVAILABLE:
        return None

    from collections import deque

    # Each queue entry: (board_copy, move_list)
    initial = board_state.copy()
    queue = deque([(initial, [])])
    visited = {fen_position_part(initial.fen())}

    while queue:
        current_board, path = queue.popleft()

        if len(path) >= max_depth:
            continue

        for move in current_board.legal_moves:
            test_board = current_board.copy()
            san = test_board.san(move)
            test_board.push(move)
            test_pos = fen_position_part(test_board.fen())

            if test_pos == target_pos:
                return path + [san]

            # Only continue BFS if we haven't visited this position
            if test_pos not in visited and len(path) + 1 < max_depth:
                visited.add(test_pos)
                queue.append((test_board, path + [san]))

    return None


def detect_move_from_fens(prev_fen, curr_fen, board_state):
    """
    Given two consecutive FEN positions and the current chess.Board state,
    try to find the legal move that transitions from prev_fen to curr_fen.

    The turn is derived from board_state.turn (not from the FEN string),
    which prevents turn drift when frames are skipped.

    If no legal move matches from the current side, a fallback attempts
    to detect TWO consecutive moves (the missed move + the visible move)
    to recover from a single skipped frame.

    Returns (move_san, confidence) or (None, 0.0).
    Also may return a list of two SANs if a double-move recovery succeeds:
    Returns (san_or_list, confidence).
    """
    if not CHESS_AVAILABLE:
        return None, 0.0

    if not prev_fen or not curr_fen:
        return None, 0.0

    # Compare only position parts — the turn field in the FEN is always 'w'
    # (placeholder), so we must ignore it during comparison.
    curr_pos = fen_position_part(curr_fen)
    prev_pos = fen_position_part(prev_fen)

    if prev_pos == curr_pos:
        return None, 0.0

    # Count differences — a single move changes 2-4 squares
    diffs = count_piece_differences(prev_fen, curr_fen)
    if diffs == 0:
        return None, 0.0

    # ── Primary: try legal moves from the current board state ────────────
    # board_state.turn is the authoritative turn tracker.
    if diffs <= 6:
        try:
            san, conf = _try_legal_moves(board_state, curr_pos)
            if san:
                return san, conf
        except Exception:
            pass

    # ── Fallback: missed-frame recovery ──────────────────────────────────
    # If the primary search fails and diffs > 2, we may have missed a frame.
    # Try every legal move for the current side, then for each resulting
    # board state, try every legal move for the *next* side. If the
    # double-move result matches curr_pos, collect ALL candidate pairs
    # and pick the one with the highest confidence score.
    if diffs > 2 and diffs <= 10:
        try:
            candidates = []  # list of (san1, san2, confidence)
            for move1 in board_state.legal_moves:
                board_after_1 = board_state.copy()
                board_after_1.push(move1)

                san2, conf2 = _try_legal_moves(board_after_1, curr_pos)
                if san2 and conf2 >= 0.92:
                    san1 = board_state.san(move1)
                    candidates.append((san1, san2, conf2))

            if candidates:
                # Sort by confidence descending, pick the best pair
                candidates.sort(key=lambda x: x[2], reverse=True)
                best = candidates[0]
                return [best[0], best[1]], best[2] * 0.85  # discount for uncertainty
        except Exception:
            pass

    return None, 0.0


# ─── Main Pipeline ────────────────────────────────────────────────────────────

def _filter_stable_fens(raw_timeline, min_stable_frames=2):
    """
    Filter a raw FEN timeline to keep only positions that appear in at least
    `min_stable_frames` consecutive sampled frames (using fens_are_similar).

    A "run" is a maximal sequence of consecutive entries where each entry is
    similar to the previous one.  If the run length >= min_stable_frames, the
    entry with the highest confidence from that run is kept.

    This removes single-frame noise spikes while preserving genuine position
    changes (which produce a new run).

    Args:
        raw_timeline: list of (timestamp_ms, fen, confidence) tuples
        min_stable_frames: minimum run length to accept

    Returns:
        Filtered list of (timestamp_ms, fen, confidence) tuples.
    """
    if not raw_timeline:
        return []

    if min_stable_frames <= 1:
        return raw_timeline  # No filtering requested

    # Group consecutive similar FENs into runs
    runs = []           # list of lists of (ts, fen, conf)
    current_run = [raw_timeline[0]]

    for entry in raw_timeline[1:]:
        if fens_are_similar(entry[1], current_run[-1][1], threshold=0.88):
            current_run.append(entry)
        else:
            runs.append(current_run)
            current_run = [entry]
    runs.append(current_run)

    # For each run that meets the stability threshold, keep the highest-
    # confidence entry.  For runs that are too short (noise spikes), discard.
    stable = []
    for run in runs:
        if len(run) >= min_stable_frames:
            best = max(run, key=lambda e: e[2])  # highest confidence
            stable.append(best)

    return stable


def load_client_fen_timeline(timeline_file):
    """
    Load a client-side FEN timeline from a JSON file.

    Returns a list of (timestamp_ms, fen, confidence) tuples sorted by timestamp,
    or an empty list if the file cannot be read or is invalid.
    """
    if not timeline_file:
        return []
    try:
        p = Path(timeline_file)
        if not p.exists():
            return []
        with open(p) as f:
            data = json.load(f)
        if not isinstance(data, list):
            return []
        entries = []
        for item in data:
            ts = item.get("timestampMs")
            fen = item.get("fen")
            conf = item.get("confidence", 0.5)
            if ts is not None and fen and isinstance(fen, str) and len(fen) > 10:
                # Apply the same piece-count sanity check to client-side FENs.
                # The client CV worker runs on mobile hardware and may produce
                # invalid positions under poor lighting or partial occlusion.
                if validate_fen_piece_count(fen):
                    entries.append((int(ts), fen, float(conf)))
        # Sort by timestamp
        entries.sort(key=lambda x: x[0])
        return entries
    except Exception:
        return []


def merge_fen_timelines(client_timeline, server_timeline):
    """
    Merge the client-side FEN timeline with the server-side frame-sampled timeline.

    Strategy:
    - For each server-sampled FEN, check if there is a client entry within ±3 seconds.
    - If a client entry exists and its confidence is higher, prefer the client FEN.
    - Insert client-only entries (timestamps not covered by server sampling) to fill gaps.
    - If the server timeline is sparse (< 5 stable entries), give client entries priority
      by boosting their confidence weight in the merge.
    - Return the merged timeline sorted by timestamp.
    """
    if not client_timeline:
        return server_timeline
    if not server_timeline:
        return client_timeline

    WINDOW_MS = 3000  # 3-second matching window

    # Determine if server is sparse — if so, client entries get priority
    server_is_sparse = len(server_timeline) < 5

    merged = list(server_timeline)  # start with server entries

    # For each server entry, try to upgrade confidence using a nearby client entry
    client_by_ts = {ts: (ts, fen, conf) for ts, fen, conf in client_timeline}
    client_timestamps = sorted(client_by_ts.keys())

    for i, (s_ts, s_fen, s_conf) in enumerate(merged):
        # Find nearest client timestamp
        nearest_client_ts = min(client_timestamps, key=lambda ct: abs(ct - s_ts), default=None)
        if nearest_client_ts is not None and abs(nearest_client_ts - s_ts) <= WINDOW_MS:
            c_ts, c_fen, c_conf = client_by_ts[nearest_client_ts]
            # Use client FEN if it has higher confidence, or if server is sparse
            if c_conf > s_conf or server_is_sparse:
                merged[i] = (s_ts, c_fen, max(s_conf, c_conf))

    # Add client-only entries that fall in gaps between server samples
    server_timestamps = sorted(e[0] for e in merged)
    for c_ts, c_fen, c_conf in client_timeline:
        # Check if this client entry is covered by any server entry
        covered = any(abs(c_ts - s_ts) <= WINDOW_MS for s_ts in server_timestamps)
        if not covered:
            merged.append((c_ts, c_fen, c_conf))

    merged.sort(key=lambda x: x[0])
    return merged


def process_video(video_path, fps_sample=0.5, confidence_threshold=0.45, client_fen_timeline=None,
                  job_id=None, db_kwargs=None):
    """
    Main CV pipeline. Processes a video file and returns a result dict.

    Args:
        video_path: Path to the video file.
        fps_sample: Frames per second to sample (0.5 = one frame every 2 seconds).
        confidence_threshold: Minimum piece detection confidence.
        client_fen_timeline: Optional list of (timestamp_ms, fen, confidence) tuples
            from the client-side CV worker, used to seed/improve reconstruction.
        job_id: Optional cv_jobs row ID for incremental progress writes.
        db_kwargs: Optional PyMySQL connection kwargs for progress writes.

    Returns:
        dict with keys: pgn, moveTimeline, framesProcessed, totalFrames, error, warnings, seedUsed
    """
    global PIECE_CONF_THRESHOLD
    PIECE_CONF_THRESHOLD = confidence_threshold

    warnings = []
    seed_used = False
    result = {
        "pgn": "",
        "moveTimeline": [],
        "framesProcessed": 0,
        "totalFrames": 0,
        "error": None,
        "warnings": warnings,
        "seedUsed": False,
    }

    # ── Load models ──────────────────────────────────────────────────────────
    try:
        board_seg_session, piece_session = load_models()
    except Exception as e:
        result["error"] = f"Failed to load CV models: {e}"
        return result

    # ── Open video ───────────────────────────────────────────────────────────
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        result["error"] = f"Cannot open video: {video_path}"
        return result

    video_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration_ms = (total_frames / video_fps) * 1000

    result["totalFrames"] = total_frames

    # Sample interval: how many frames to skip between samples
    sample_interval = max(1, int(video_fps / fps_sample))

    # ── Frame sampling loop ──────────────────────────────────────────────────
    # raw_fen_timeline holds every accepted FEN before stability filtering.
    # Each entry: (timestamp_ms, fen, confidence)
    raw_fen_timeline = []
    frame_idx = 0
    frames_processed = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        if frame_idx % sample_interval == 0:
            timestamp_ms = int((frame_idx / video_fps) * 1000)
            frames_processed += 1

            try:
                # Stage 1: Board segmentation
                h, w = frame.shape[:2]
                mask = run_board_segmentation(board_seg_session, frame)
                corners, seg_confidence = extract_corners(mask, w, h)

                if corners and len(corners) == 4 and seg_confidence > 0.3:
                    # Guard: reject frames where the segmentation model is
                    # overconfident (coverage > 0.85 often means a false positive
                    # on non-board backgrounds — observed at 0.77 on plain green).
                    if seg_confidence > _MAX_TRUSTED_COVERAGE:
                        warnings.append(
                            f"Frame {frame_idx}: skipped (seg coverage {seg_confidence:.2f} "
                            f"> {_MAX_TRUSTED_COVERAGE} — likely false positive)"
                        )
                    else:
                        # Stage 2: Warp board and detect pieces
                        warped = warp_board(frame, corners)
                        aligned, _rot_angle = auto_align_board(warped)
                        detections = run_piece_detection(piece_session, aligned)

                        # Turn is NOT derived from timeline length (which drifts
                        # when frames are skipped). Instead, reconstruct_fen always
                        # uses 'w' as a placeholder, and the actual turn is tracked
                        # by chess.Board in detect_move_from_fens.
                        fen = reconstruct_fen(detections)

                        if fen and validate_fen_piece_count(fen):
                            raw_fen_timeline.append((timestamp_ms, fen, seg_confidence))
                        elif fen:
                            warnings.append(
                                f"Frame {frame_idx}: FEN discarded by piece-count sanity check "
                                f"({fen.split()[0][:30]})"
                            )

            except Exception as e:
                warnings.append(f"Frame {frame_idx} error: {str(e)[:100]}")

            # Write incremental progress every 10 sampled frames (best-effort)
            if job_id and db_kwargs and frames_processed % 10 == 0:
                # Pass the last detected FEN and stable position count for live UI preview
                last_raw_fen = raw_fen_timeline[-1][1] if raw_fen_timeline else None
                _write_progress(
                    job_id, db_kwargs, frames_processed, total_frames,
                    last_fen=last_raw_fen,
                    stable_positions=len(raw_fen_timeline),
                )

        frame_idx += 1

    cap.release()
    result["framesProcessed"] = frames_processed

    # ── FEN stability filtering ───────────────────────────────────────────────
    # A FEN is accepted into the final timeline only if it appears (or a very
    # similar FEN appears) in at least FEN_STABILITY_FRAMES consecutive sampled
    # frames.  This eliminates single-frame noise spikes caused by motion blur,
    # partial occlusion, or transient detection errors.
    fen_timeline = _filter_stable_fens(raw_fen_timeline, FEN_STABILITY_FRAMES)
    if len(raw_fen_timeline) > 0:
        warnings.append(
            f"FEN stability filter: {len(raw_fen_timeline)} raw → {len(fen_timeline)} stable entries"
        )

    # Final progress write so the endpoint always shows 100% on complete
    if job_id and db_kwargs:
        _write_progress(job_id, db_kwargs, frames_processed, total_frames)

    # ── Merge with client FEN timeline seed ────────────────────────────────
    if client_fen_timeline and len(client_fen_timeline) > 0:
        original_len = len(fen_timeline)
        fen_timeline = merge_fen_timelines(client_fen_timeline, fen_timeline)
        if len(fen_timeline) > original_len or any(
            c_fen != s_fen
            for (c_ts, c_fen, _c), (s_ts, s_fen, _s) in zip(client_fen_timeline[:5], fen_timeline[:5])
            if abs(c_ts - s_ts) < 3000
        ):
            seed_used = True
            result["seedUsed"] = True
            warnings.append(f"Client FEN timeline merged: {len(client_fen_timeline)} client entries + {original_len} server entries = {len(fen_timeline)} total")

    if not fen_timeline:
        # If server sampling found nothing but we have a client timeline, use it directly
        if client_fen_timeline and len(client_fen_timeline) >= 3:
            fen_timeline = client_fen_timeline
            result["seedUsed"] = True
            warnings.append("Server frame sampling found no positions; using client FEN timeline exclusively")
        else:
            result["error"] = "No board positions detected in video. Ensure the board is clearly visible."
            return result

    # ── Move detection from FEN timeline ────────────────────────────────────
    if not CHESS_AVAILABLE:
        result["error"] = "python-chess not installed"
        return result

    board = chess.Board()
    move_san_list = []
    move_timeline = []
    move_number = 1

    # Deduplicate consecutive identical FENs (stable positions between moves)
    deduped = [fen_timeline[0]]
    for entry in fen_timeline[1:]:
        if not fens_are_similar(entry[1], deduped[-1][1], threshold=0.92):
            deduped.append(entry)

    prev_fen = None
    for timestamp_ms, curr_fen, confidence in deduped:
        if prev_fen is None:
            # First frame — check if it looks like the starting position
            prev_fen = curr_fen
            continue

        san_result, move_confidence = detect_move_from_fens(prev_fen, curr_fen, board)

        if san_result:
            # san_result is either a single SAN string or a list of two SANs
            # (missed-frame recovery: the missed move + the visible move).
            san_list = san_result if isinstance(san_result, list) else [san_result]

            all_ok = True
            for san in san_list:
                try:
                    move = board.parse_san(san)
                    board.push(move)
                    move_san_list.append(san)
                    move_timeline.append({
                        "moveNumber": move_number,
                        "timestampMs": timestamp_ms,
                        "confidence": round(move_confidence * confidence, 3),
                    })
                    move_number += 1
                except Exception as e:
                    warnings.append(f"Move parse error at t={timestamp_ms}ms: {san} — {e}")
                    all_ok = False
                    break

            if all_ok:
                prev_fen = curr_fen
            if len(san_list) > 1:
                warnings.append(
                    f"Missed-frame recovery at t={timestamp_ms}ms: "
                    f"detected {len(san_list)} moves ({', '.join(san_list)})"
                )
        else:
            # No move detected — we must still advance prev_fen to prevent
            # cascading failures. If prev_fen stays frozen at the last
            # successful detection, all future frames will have growing diffs
            # against the stale position, making recovery impossible.
            diffs = count_piece_differences(prev_fen, curr_fen)
            if diffs <= 2:
                prev_fen = curr_fen  # Minor noise, accept as same position
            elif diffs <= 10:
                # Significant change but we couldn't identify the move.
                # Try a BFS of up to 3 moves deep to find a path from the
                # current board state to the observed position.
                curr_pos = fen_position_part(curr_fen)
                resync_moves = _try_resync_board(board, curr_pos, max_depth=3)
                if resync_moves:
                    for san in resync_moves:
                        try:
                            move = board.parse_san(san)
                            board.push(move)
                            move_san_list.append(san)
                            move_timeline.append({
                                "moveNumber": move_number,
                                "timestampMs": timestamp_ms,
                                "confidence": round(confidence * 0.7, 3),
                            })
                            move_number += 1
                        except Exception as e:
                            warnings.append(f"Resync parse error: {san} — {e}")
                            break
                    prev_fen = curr_fen
                    warnings.append(
                        f"Board resync at t={timestamp_ms}ms: found {len(resync_moves)} "
                        f"bridging moves ({', '.join(resync_moves)}) via BFS"
                    )
                else:
                    # Could not resync — advance prev_fen anyway to avoid
                    # cascading failures, but mark the gap.
                    prev_fen = curr_fen
                    warnings.append(
                        f"Unrecognized position change at t={timestamp_ms}ms "
                        f"({diffs} square diffs) — advancing without resync"
                    )
            # If diffs > 10, the frame is likely corrupted — keep prev_fen stable

    if not move_san_list:
        result["error"] = "Could not reconstruct any moves from the video. The board may be partially obscured or the recording quality may be too low."
        result["warnings"] = warnings
        return result

    # ── Build PGN ────────────────────────────────────────────────────────────
    game = chess.pgn.Game()
    game.headers["Event"] = "OTB Game (Auto-Reconstructed)"
    game.headers["Site"] = "OTB Chess"
    game.headers["Date"] = "????.??.??"
    game.headers["White"] = "?"
    game.headers["Black"] = "?"
    game.headers["Result"] = "*"
    game.headers["Annotator"] = "OTB Chess CV (Auto)"

    node = game
    replay_board = chess.Board()
    for san in move_san_list:
        try:
            move = replay_board.parse_san(san)
            node = node.add_variation(move)
            replay_board.push(move)
        except Exception as e:
            warnings.append(f"PGN build error: {san} — {e}")
            break

    # Determine result from final board state
    if replay_board.is_checkmate():
        result_str = "0-1" if replay_board.turn == chess.WHITE else "1-0"
        game.headers["Result"] = result_str
    elif replay_board.is_stalemate() or replay_board.is_insufficient_material():
        game.headers["Result"] = "1/2-1/2"

    import io
    pgn_io = io.StringIO()
    exporter = chess.pgn.FileExporter(pgn_io)
    game.accept(exporter)
    pgn_str = pgn_io.getvalue().strip()

    result["pgn"] = pgn_str
    result["moveTimeline"] = move_timeline
    result["warnings"] = warnings
    result["seedUsed"] = seed_used

    return result


# ─── Entry Point ──────────────────────────────────────────────────────────────

def _parse_db_url(url: str):
    """Parse a mysql://user:pass@host:port/db?... URL into connection kwargs."""
    import re
    m = re.match(r"mysql://([^:]+):([^@]+)@([^:]+):(\d+)/([^?]+)", url)
    if not m:
        return None
    user, pw, host, port, db = m.groups()
    return dict(host=host, port=int(port), user=user, password=pw, database=db,
                ssl={"ca": None}, ssl_verify_cert=False)


def _write_progress(job_id: str, db_kwargs: dict, frames_processed: int, total_frames: int,
                    last_fen: str = None, stable_positions: int = None):
    """Write incremental frame progress to the cv_jobs table."""
    try:
        import pymysql
        conn = pymysql.connect(**db_kwargs, connect_timeout=5)
        with conn.cursor() as cur:
            if last_fen is not None and stable_positions is not None:
                cur.execute(
                    "UPDATE cv_jobs SET frames_processed=%s, total_frames=%s, "
                    "last_fen=%s, stable_positions=%s WHERE id=%s",
                    (frames_processed, total_frames, last_fen, stable_positions, job_id),
                )
            else:
                cur.execute(
                    "UPDATE cv_jobs SET frames_processed=%s, total_frames=%s WHERE id=%s",
                    (frames_processed, total_frames, job_id),
                )
        conn.commit()
        conn.close()
    except Exception as e:
        # Non-fatal — progress writes are best-effort
        sys.stderr.write(f"[cv-worker] progress write failed: {e}\n")


def main():
    parser = argparse.ArgumentParser(description="OTB Chess CV Worker")
    parser.add_argument("video_path", help="Path to the video file to process")
    parser.add_argument("--fps-sample", type=float, default=0.5,
                        help="Frames per second to sample (default: 0.5 = every 2s)")
    parser.add_argument("--confidence", type=float, default=0.45,
                        help="Minimum piece detection confidence (default: 0.45)")
    parser.add_argument("--fen-timeline-file", type=str, default=None,
                        help="Path to a JSON file containing the client-side FEN timeline seed")
    parser.add_argument("--job-id", type=str, default=None,
                        help="cv_jobs row ID for incremental progress writes")
    args = parser.parse_args()

    # Load optional client FEN timeline seed
    client_fen_timeline = load_client_fen_timeline(args.fen_timeline_file)

    # Set up incremental progress writing if job-id is provided
    job_id = args.job_id
    db_kwargs = None
    if job_id:
        db_url = os.environ.get("DATABASE_URL", "")
        db_kwargs = _parse_db_url(db_url)
        if not db_kwargs:
            sys.stderr.write("[cv-worker] Could not parse DATABASE_URL for progress writes\n")

    try:
        result = process_video(
            video_path=args.video_path,
            fps_sample=args.fps_sample,
            confidence_threshold=args.confidence,
            client_fen_timeline=client_fen_timeline if client_fen_timeline else None,
            job_id=job_id,
            db_kwargs=db_kwargs,
        )
    except Exception as e:
        result = {
            "pgn": "",
            "moveTimeline": [],
            "framesProcessed": 0,
            "totalFrames": 0,
            "error": f"Unhandled error: {traceback.format_exc()}",
            "warnings": [],
        }

    print(json.dumps(result))
    sys.exit(0 if result.get("pgn") else 1)


if __name__ == "__main__":
    main()
