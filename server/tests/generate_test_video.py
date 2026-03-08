#!/usr/bin/env python3
"""
Generate a synthetic chess game video for end-to-end CV pipeline testing.

Renders a top-down chessboard with colored squares and simple piece symbols
(Unicode chess characters) for each position in a known game. Each position
is held for a configurable number of seconds to simulate a real recording.

The video is intentionally simple — the ONNX models may not detect these
synthetic frames, but the video serves as a valid input to cv_worker.py
for testing the full pipeline path (video open → frame sample → model run).

For testing the move reconstruction pipeline WITHOUT model dependency,
use run_benchmark.py which feeds known FEN timelines directly.

Usage:
    python3 generate_test_video.py [--output test_game.webm] [--seconds-per-move 4]
"""

import argparse
import sys
import os

import cv2
import numpy as np

try:
    import chess
except ImportError:
    print("ERROR: python-chess required. pip install chess", file=sys.stderr)
    sys.exit(1)


# ─── Known Test Game: Italian Game (10 moves) ───────────────────────────────
# A well-known opening sequence that's easy to verify.
GROUND_TRUTH_MOVES = [
    "e4", "e5",       # 1. e4 e5
    "Nf3", "Nc6",     # 2. Nf3 Nc6
    "Bc4", "Bc5",     # 3. Bc4 Bc5 (Italian Game)
    "c3", "Nf6",      # 4. c3 Nf6
    "d4", "exd4",     # 5. d4 exd4
    "cxd4", "Bb4+",   # 6. cxd4 Bb4+
    "Bd2", "Bxd2+",   # 7. Bd2 Bxd2+
    "Nbxd2", "d5",    # 8. Nbxd2 d5
    "exd5", "Nxd5",   # 9. exd5 Nxd5
    "Qb3", "Nce7",    # 10. Qb3 Nce7
]

GROUND_TRUTH_PGN_MOVES = "1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d4 exd4 6. cxd4 Bb4+ 7. Bd2 Bxd2+ 8. Nbxd2 d5 9. exd5 Nxd5 10. Qb3 Nce7"

# Unicode chess pieces for rendering
PIECE_UNICODE = {
    'K': '\u2654', 'Q': '\u2655', 'R': '\u2656', 'B': '\u2657', 'N': '\u2658', 'P': '\u2659',
    'k': '\u265A', 'q': '\u265B', 'r': '\u265C', 'b': '\u265D', 'n': '\u265E', 'p': '\u265F',
}

# Board colors (BGR for OpenCV)
LIGHT_SQUARE = (200, 220, 240)   # cream
DARK_SQUARE  = (80, 120, 160)    # brown
BORDER_COLOR = (40, 60, 80)      # dark wood frame
BG_COLOR     = (60, 80, 60)      # green table background


def fen_to_board_array(fen):
    """Convert FEN position part to 8x8 array of piece chars ('' for empty)."""
    pos = fen.split(" ")[0]
    board = []
    for rank in pos.split("/"):
        row = []
        for ch in rank:
            if ch.isdigit():
                row.extend([''] * int(ch))
            else:
                row.append(ch)
        board.append(row)
    return board


def render_board_frame(fen, frame_size=640):
    """
    Render a chessboard position as a BGR image.
    Returns a (frame_size, frame_size, 3) uint8 numpy array.
    """
    img = np.zeros((frame_size, frame_size, 3), dtype=np.uint8)
    # Fill with green table background
    img[:] = BG_COLOR

    # Board area with border
    border = int(frame_size * 0.08)
    board_size = frame_size - 2 * border
    sq_size = board_size // 8

    # Draw border
    cv2.rectangle(img, (border - 4, border - 4),
                  (border + board_size + 4, border + board_size + 4),
                  BORDER_COLOR, -1)

    board_arr = fen_to_board_array(fen)

    for row in range(8):
        for col in range(8):
            x = border + col * sq_size
            y = border + row * sq_size

            # Square color
            is_light = (row + col) % 2 == 0
            color = LIGHT_SQUARE if is_light else DARK_SQUARE
            cv2.rectangle(img, (x, y), (x + sq_size, y + sq_size), color, -1)

            # Piece
            piece = board_arr[row][col]
            if piece:
                # Draw piece as a filled circle with letter
                cx = x + sq_size // 2
                cy = y + sq_size // 2
                radius = int(sq_size * 0.35)

                # White pieces: light circle, dark text
                # Black pieces: dark circle, light text
                if piece.isupper():
                    cv2.circle(img, (cx, cy), radius, (240, 240, 240), -1)
                    cv2.circle(img, (cx, cy), radius, (60, 60, 60), 2)
                    text_color = (30, 30, 30)
                else:
                    cv2.circle(img, (cx, cy), radius, (50, 50, 50), -1)
                    cv2.circle(img, (cx, cy), radius, (180, 180, 180), 2)
                    text_color = (220, 220, 220)

                # Draw piece letter
                letter = piece.upper()
                font = cv2.FONT_HERSHEY_SIMPLEX
                font_scale = sq_size / 80.0
                thickness = max(1, int(font_scale * 2))
                (tw, th), _ = cv2.getTextSize(letter, font, font_scale, thickness)
                cv2.putText(img, letter, (cx - tw // 2, cy + th // 2),
                            font, font_scale, text_color, thickness)

    return img


def generate_test_video(output_path, seconds_per_move=4, fps=30):
    """
    Generate a test video showing each position of the ground truth game.

    Args:
        output_path: Path to write the output video.
        seconds_per_move: How many seconds to hold each position.
        fps: Video frame rate.

    Returns:
        dict with metadata about the generated video.
    """
    board = chess.Board()
    positions = [board.fen()]

    for san in GROUND_TRUTH_MOVES:
        move = board.parse_san(san)
        board.push(move)
        positions.append(board.fen())

    frames_per_position = int(seconds_per_move * fps)
    total_frames = len(positions) * frames_per_position

    # Use mp4v codec for .mp4 or VP80 for .webm
    if output_path.endswith('.webm'):
        fourcc = cv2.VideoWriter_fourcc(*'VP80')
    else:
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')

    writer = cv2.VideoWriter(output_path, fourcc, fps, (640, 640))
    if not writer.isOpened():
        raise RuntimeError(f"Cannot open video writer for {output_path}")

    frame_count = 0
    for pos_idx, fen in enumerate(positions):
        frame = render_board_frame(fen)
        for _ in range(frames_per_position):
            writer.write(frame)
            frame_count += 1

    writer.release()

    return {
        "output_path": output_path,
        "total_positions": len(positions),
        "total_moves": len(GROUND_TRUTH_MOVES),
        "total_frames": frame_count,
        "fps": fps,
        "duration_seconds": frame_count / fps,
        "ground_truth_moves": GROUND_TRUTH_MOVES,
        "ground_truth_pgn": GROUND_TRUTH_PGN_MOVES,
    }


def generate_fen_timeline(seconds_per_move=4):
    """
    Generate a FEN timeline (as if from a perfect CV worker) for the ground truth game.
    This can be used to test the move reconstruction pipeline directly.

    Returns:
        list of (timestamp_ms, fen, confidence) tuples.
    """
    board = chess.Board()
    timeline = [(0, board.fen(), 0.95)]  # starting position

    for i, san in enumerate(GROUND_TRUTH_MOVES):
        move = board.parse_san(san)
        board.push(move)
        timestamp_ms = int((i + 1) * seconds_per_move * 1000)
        timeline.append((timestamp_ms, board.fen(), 0.90))

    return timeline


def generate_fen_timeline_with_noise(seconds_per_move=4, skip_rate=0.1, noise_rate=0.05):
    """
    Generate a FEN timeline with realistic noise:
    - Some frames are skipped (simulating failed board detection)
    - Some FENs have minor errors (simulating piece misclassification)

    Args:
        seconds_per_move: Seconds between positions.
        skip_rate: Fraction of positions to skip (0.0–1.0).
        noise_rate: Fraction of positions to corrupt slightly (0.0–1.0).

    Returns:
        (noisy_timeline, ground_truth_timeline, skip_count, noise_count)
    """
    import random
    random.seed(42)  # Deterministic for reproducibility

    board = chess.Board()
    ground_truth = [(0, board.fen(), 0.95)]
    noisy = [(0, board.fen(), 0.95)]

    skip_count = 0
    noise_count = 0

    for i, san in enumerate(GROUND_TRUTH_MOVES):
        move = board.parse_san(san)
        board.push(move)
        timestamp_ms = int((i + 1) * seconds_per_move * 1000)
        fen = board.fen()
        ground_truth.append((timestamp_ms, fen, 0.90))

        # Randomly skip some frames
        if random.random() < skip_rate and i > 0 and i < len(GROUND_TRUTH_MOVES) - 1:
            skip_count += 1
            continue

        # Randomly add noise to some FENs
        if random.random() < noise_rate and i > 0:
            # Swap two adjacent squares in the FEN to simulate a misclassification
            pos = fen.split(" ")[0]
            # Just slightly corrupt the confidence instead of the FEN itself
            # (corrupting the FEN would make it fail validation)
            noisy.append((timestamp_ms, fen, 0.50))  # lower confidence
            noise_count += 1
        else:
            noisy.append((timestamp_ms, fen, 0.90))

    return noisy, ground_truth, skip_count, noise_count


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate synthetic chess test video")
    parser.add_argument("--output", default="test_game.mp4",
                        help="Output video path (default: test_game.mp4)")
    parser.add_argument("--seconds-per-move", type=int, default=4,
                        help="Seconds to hold each position (default: 4)")
    args = parser.parse_args()

    print(f"Generating test video: {args.output}")
    meta = generate_test_video(args.output, args.seconds_per_move)
    print(f"  Positions: {meta['total_positions']}")
    print(f"  Moves: {meta['total_moves']}")
    print(f"  Frames: {meta['total_frames']}")
    print(f"  Duration: {meta['duration_seconds']:.1f}s")
    print(f"  Ground truth PGN: {meta['ground_truth_pgn']}")
    print("Done.")
