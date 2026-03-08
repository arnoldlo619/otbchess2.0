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
  python3 cv_worker.py <video_path> [--fps-sample 0.5] [--confidence 0.45]

Output (stdout):
  JSON object with keys:
    pgn          — reconstructed PGN string (empty string if failed)
    moveTimeline — list of {moveNumber, timestampMs, confidence}
    framesProcessed — number of frames sampled
    totalFrames  — estimated total frames in video
    error        — error message (null on success)
    warnings     — list of warning strings
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
PIECE_CONF_THRESHOLD = 0.45
NMS_IOU_THRESHOLD    = 0.45

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


def extract_corners(mask, orig_w, orig_h):
    """
    Extract 4 board corners from the segmentation mask using OpenCV contours.
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
    epsilon = 0.02 * cv2.arcLength(board_contour, True)
    approx = cv2.approxPolyDP(board_contour, epsilon, True)

    scale_x = orig_w / BOARD_SEG_SIZE
    scale_y = orig_h / BOARD_SEG_SIZE

    if len(approx) == 4:
        pts = [(int(p[0][0] * scale_x), int(p[0][1] * scale_y)) for p in approx]
        return sort_corners(pts), min(0.95, coverage * 2)
    elif len(approx) > 4:
        rect = cv2.boundingRect(board_contour)
        x, y, w, h = rect
        pts = [
            (int(x * scale_x), int(y * scale_y)),
            (int((x + w) * scale_x), int(y * scale_y)),
            (int((x + w) * scale_x), int((y + h) * scale_y)),
            (int(x * scale_x), int((y + h) * scale_y)),
        ]
        return pts, coverage * 0.6

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

    return apply_nms(detections, NMS_IOU_THRESHOLD)


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

def reconstruct_fen(detections, turn="w"):
    """
    Map piece detections to board squares and build a FEN position string.
    Returns FEN string or None if invalid.
    """
    if not detections:
        return None

    square_size = PIECE_SIZE / 8
    board = [[""] * 8 for _ in range(8)]
    square_conf = [[0.0] * 8 for _ in range(8)]

    for det in detections:
        col = int(det["cx"] / square_size)
        row = int(det["cy"] / square_size)
        if not (0 <= col <= 7 and 0 <= row <= 7):
            continue
        if det["confidence"] > square_conf[row][col]:
            board[row][col] = det["piece"]
            square_conf[row][col] = det["confidence"]

    ranks = []
    for row in range(8):
        rank = ""
        empty = 0
        for col in range(8):
            if board[row][col] == "":
                empty += 1
            else:
                if empty > 0:
                    rank += str(empty)
                    empty = 0
                rank += board[row][col]
        if empty > 0:
            rank += str(empty)
        ranks.append(rank)

    fen_pos = "/".join(ranks)

    # Must have both kings
    if "K" not in fen_pos or "k" not in fen_pos:
        return None

    return f"{fen_pos} {turn} - - 0 1"


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

def detect_move_from_fens(prev_fen, curr_fen, board_state):
    """
    Given two consecutive FEN positions and the current chess.Board state,
    try to find the legal move that transitions from prev_fen to curr_fen.

    Returns (move_san, confidence) or (None, 0.0).
    """
    if not CHESS_AVAILABLE:
        return None, 0.0

    if not prev_fen or not curr_fen:
        return None, 0.0

    # Check if position actually changed
    if fen_position_part(prev_fen) == fen_position_part(curr_fen):
        return None, 0.0

    # Count differences — a single move changes 2-4 squares
    diffs = count_piece_differences(prev_fen, curr_fen)
    if diffs == 0 or diffs > 6:
        return None, 0.0

    # Try each legal move from the current board state
    # and find which one produces the closest FEN to curr_fen
    best_move = None
    best_similarity = 0.0

    try:
        for legal_move in board_state.legal_moves:
            test_board = board_state.copy()
            test_board.push(legal_move)
            test_fen = test_board.fen()

            # Compare position parts
            test_pos = fen_position_part(test_fen)
            curr_pos = fen_position_part(curr_fen)

            if test_pos == curr_pos:
                # Exact match
                san = board_state.san(legal_move)
                return san, 1.0

            # Partial similarity
            matches = sum(a == b for a, b in zip(test_pos, curr_pos))
            similarity = matches / max(len(test_pos), len(curr_pos))

            if similarity > best_similarity:
                best_similarity = similarity
                best_move = legal_move

        if best_move and best_similarity >= 0.90:
            san = board_state.san(best_move)
            return san, best_similarity

    except Exception:
        pass

    return None, 0.0


# ─── Main Pipeline ────────────────────────────────────────────────────────────

def process_video(video_path, fps_sample=0.5, confidence_threshold=0.45):
    """
    Main CV pipeline. Processes a video file and returns a result dict.

    Args:
        video_path: Path to the video file.
        fps_sample: Frames per second to sample (0.5 = one frame every 2 seconds).
        confidence_threshold: Minimum piece detection confidence.

    Returns:
        dict with keys: pgn, moveTimeline, framesProcessed, totalFrames, error, warnings
    """
    global PIECE_CONF_THRESHOLD
    PIECE_CONF_THRESHOLD = confidence_threshold

    warnings = []
    result = {
        "pgn": "",
        "moveTimeline": [],
        "framesProcessed": 0,
        "totalFrames": 0,
        "error": None,
        "warnings": warnings,
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
    fen_timeline = []   # List of (timestamp_ms, fen, confidence)
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
                    # Stage 2: Warp board and detect pieces
                    warped = warp_board(frame, corners)
                    detections = run_piece_detection(piece_session, warped)

                    # Determine turn from timeline
                    turn = "w" if len(fen_timeline) % 2 == 0 else "b"
                    fen = reconstruct_fen(detections, turn)

                    if fen:
                        fen_timeline.append((timestamp_ms, fen, seg_confidence))

            except Exception as e:
                warnings.append(f"Frame {frame_idx} error: {str(e)[:100]}")

        frame_idx += 1

    cap.release()
    result["framesProcessed"] = frames_processed

    if not fen_timeline:
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

        san, move_confidence = detect_move_from_fens(prev_fen, curr_fen, board)

        if san:
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
                prev_fen = curr_fen
            except Exception as e:
                warnings.append(f"Move parse error at t={timestamp_ms}ms: {san} — {e}")
                # Don't update prev_fen — keep trying from the last valid position
        else:
            # No move detected — update prev_fen if position changed significantly
            diffs = count_piece_differences(prev_fen, curr_fen)
            if diffs <= 2:
                prev_fen = curr_fen  # Minor noise, accept as same position

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

    return result


# ─── Entry Point ──────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="OTB Chess CV Worker")
    parser.add_argument("video_path", help="Path to the video file to process")
    parser.add_argument("--fps-sample", type=float, default=0.5,
                        help="Frames per second to sample (default: 0.5 = every 2s)")
    parser.add_argument("--confidence", type=float, default=0.45,
                        help="Minimum piece detection confidence (default: 0.45)")
    args = parser.parse_args()

    try:
        result = process_video(
            video_path=args.video_path,
            fps_sample=args.fps_sample,
            confidence_threshold=args.confidence,
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
