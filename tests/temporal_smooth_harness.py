#!/usr/bin/env python3.11
"""
Test harness for temporal_smooth_board().
Called by vitest via: python3.11 temporal_smooth_harness.py <test_name>
Exits 0 on pass, 1 on fail.
"""
import sys
import os

# Add the server directory to the path so we can import cv_worker
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'server'))

from cv_worker import temporal_smooth_board, fen_to_board_grid, _TEMPORAL_CONF_THRESHOLD


def make_cell(piece, conf, alts=None):
    """Helper: create a board cell tuple."""
    if alts is None:
        alts = []
    return (piece, conf, alts)


def make_empty_board():
    """Create an 8x8 board of None cells."""
    return [[None for _ in range(8)] for _ in range(8)]


def board_piece(board, row, col):
    """Get piece char from board cell, or '' if empty."""
    cell = board[row][col]
    return cell[0] if cell is not None else ''


# ── Test 1: High-confidence detection is never overridden ─────────────────────
def test_high_confidence_not_overridden():
    board = make_empty_board()
    # Place a Knight at (0,0) with high confidence
    board[0][0] = make_cell('N', 0.85, [{'piece': 'B', 'confidence': 0.30}])
    # Prior says Bishop at (0,0)
    prior_fen = 'B7/8/8/8/8/8/8/8 w - - 0 1'
    result = temporal_smooth_board(board, prior_fen)
    assert board_piece(result, 0, 0) == 'N', \
        f"Expected N (high conf), got {board_piece(result, 0, 0)}"
    print("PASS: high confidence not overridden")


# ── Test 2: Low-confidence detection is corrected when prior matches alternative ──
def test_low_confidence_corrected_by_prior():
    board = make_empty_board()
    # Place a Bishop at (0,0) with LOW confidence; Knight is in alternatives
    board[0][0] = make_cell('B', 0.45, [
        {'piece': 'N', 'confidence': 0.40},
        {'piece': 'P', 'confidence': 0.10},
    ])
    # Prior says Knight at (0,0)
    prior_fen = 'N7/8/8/8/8/8/8/8 w - - 0 1'
    result = temporal_smooth_board(board, prior_fen)
    assert board_piece(result, 0, 0) == 'N', \
        f"Expected N (prior correction), got {board_piece(result, 0, 0)}"
    print("PASS: low confidence corrected by prior")


# ── Test 3: Prior piece NOT in alternatives → no override ─────────────────────
def test_prior_not_in_alternatives_no_override():
    board = make_empty_board()
    # Bishop with low confidence; alternatives are Pawn and Rook (NOT Knight)
    board[0][0] = make_cell('B', 0.40, [
        {'piece': 'P', 'confidence': 0.35},
        {'piece': 'R', 'confidence': 0.20},
    ])
    # Prior says Knight — but Knight is not in alternatives
    prior_fen = 'N7/8/8/8/8/8/8/8 w - - 0 1'
    result = temporal_smooth_board(board, prior_fen)
    assert board_piece(result, 0, 0) == 'B', \
        f"Expected B (prior not in alts), got {board_piece(result, 0, 0)}"
    print("PASS: prior not in alternatives, no override")


# ── Test 4: No hallucination — empty current square stays empty ───────────────
def test_no_hallucination_empty_square():
    board = make_empty_board()
    # Square (0,0) is empty in current detection
    board[0][0] = None
    # Prior says Knight at (0,0)
    prior_fen = 'N7/8/8/8/8/8/8/8 w - - 0 1'
    result = temporal_smooth_board(board, prior_fen)
    assert board_piece(result, 0, 0) == '', \
        f"Expected empty (no hallucination), got {board_piece(result, 0, 0)}"
    print("PASS: no hallucination on empty square")


# ── Test 5: Board changed significantly → skip smoothing ──────────────────────
def test_large_diff_skips_smoothing():
    board = make_empty_board()
    # Many pieces on the board with low confidence
    pieces = [('B', 0, 0), ('N', 0, 1), ('R', 0, 2), ('Q', 0, 3),
              ('B', 1, 0), ('N', 1, 1), ('R', 1, 2), ('Q', 1, 3)]
    for piece, r, c in pieces:
        board[r][c] = make_cell(piece, 0.40, [
            {'piece': 'P', 'confidence': 0.35},
        ])
    # Prior is completely different (many squares differ)
    prior_fen = 'pppppppp/pppppppp/8/8/8/8/PPPPPPPP/PPPPPPPP w - - 0 1'
    result = temporal_smooth_board(board, prior_fen)
    # All pieces should remain unchanged (smoothing skipped due to large diff)
    for piece, r, c in pieces:
        assert board_piece(result, r, c) == piece, \
            f"Expected {piece} at ({r},{c}), got {board_piece(result, r, c)}"
    print("PASS: large diff skips smoothing")


# ── Test 6: None prior_fen → board unchanged ──────────────────────────────────
def test_none_prior_fen_unchanged():
    board = make_empty_board()
    board[3][3] = make_cell('K', 0.30, [{'piece': 'Q', 'confidence': 0.28}])
    result = temporal_smooth_board(board, None)
    assert board_piece(result, 3, 3) == 'K', \
        f"Expected K (no prior), got {board_piece(result, 3, 3)}"
    print("PASS: None prior_fen leaves board unchanged")


# ── Test 7: fen_to_board_grid parses correctly ────────────────────────────────
def test_fen_to_board_grid():
    fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    grid = fen_to_board_grid(fen)
    assert grid is not None, "Expected non-None grid"
    assert len(grid) == 8, f"Expected 8 rows, got {len(grid)}"
    assert grid[0][0] == 'r', f"Expected r at (0,0), got {grid[0][0]}"
    assert grid[7][0] == 'R', f"Expected R at (7,0), got {grid[7][0]}"
    assert grid[2][0] == '', f"Expected empty at (2,0), got {grid[2][0]}"
    print("PASS: fen_to_board_grid parses starting position correctly")


# ── Test 8: Prior agrees with current → no change ────────────────────────────
def test_prior_agrees_no_change():
    board = make_empty_board()
    board[4][4] = make_cell('Q', 0.50, [{'piece': 'R', 'confidence': 0.45}])
    # Prior also has Queen at (4,4)
    prior_fen = '8/8/8/8/4Q3/8/8/8 w - - 0 1'
    result = temporal_smooth_board(board, prior_fen)
    assert board_piece(result, 4, 4) == 'Q', \
        f"Expected Q (prior agrees), got {board_piece(result, 4, 4)}"
    print("PASS: prior agrees with current, no change")


if __name__ == '__main__':
    test_name = sys.argv[1] if len(sys.argv) > 1 else 'all'

    tests = [
        ('test_high_confidence_not_overridden', test_high_confidence_not_overridden),
        ('test_low_confidence_corrected_by_prior', test_low_confidence_corrected_by_prior),
        ('test_prior_not_in_alternatives_no_override', test_prior_not_in_alternatives_no_override),
        ('test_no_hallucination_empty_square', test_no_hallucination_empty_square),
        ('test_large_diff_skips_smoothing', test_large_diff_skips_smoothing),
        ('test_none_prior_fen_unchanged', test_none_prior_fen_unchanged),
        ('test_fen_to_board_grid', test_fen_to_board_grid),
        ('test_prior_agrees_no_change', test_prior_agrees_no_change),
    ]

    if test_name == 'all':
        failed = 0
        for name, fn in tests:
            try:
                fn()
            except AssertionError as e:
                print(f"FAIL: {name}: {e}")
                failed += 1
            except Exception as e:
                print(f"ERROR: {name}: {e}")
                failed += 1
        if failed:
            print(f"\n{failed}/{len(tests)} tests FAILED")
            sys.exit(1)
        else:
            print(f"\nAll {len(tests)} tests PASSED")
            sys.exit(0)
    else:
        # Run a specific test
        for name, fn in tests:
            if name == test_name:
                try:
                    fn()
                    sys.exit(0)
                except AssertionError as e:
                    print(f"FAIL: {e}")
                    sys.exit(1)
        print(f"Unknown test: {test_name}")
        sys.exit(1)
