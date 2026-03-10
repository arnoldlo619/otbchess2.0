#!/usr/bin/env python3
"""
Test harness for postprocess_board heuristics.
Called from vitest with a test name argument.
Outputs JSON to stdout.
"""
import sys, json, os, re

os.chdir(os.path.join(os.path.dirname(__file__), '..'))

# Read cv_worker.py and extract the constants + postprocess_board function
with open('server/cv_worker.py', 'r') as f:
    source = f.read()

# We need: _MAX_PIECES_PER_SIDE, _STARTING_COUNTS, _COLOR_FLIP,
# _count_pieces, _is_white, _side_total, postprocess_board

_MAX_PIECES_PER_SIDE = {
    'K': 1, 'Q': 9, 'R': 10, 'B': 10, 'N': 10, 'P': 8,
    'k': 1, 'q': 9, 'r': 10, 'b': 10, 'n': 10, 'p': 8,
}
_STARTING_COUNTS = {
    'K': 1, 'Q': 1, 'R': 2, 'B': 2, 'N': 2, 'P': 8,
    'k': 1, 'q': 1, 'r': 2, 'b': 2, 'n': 2, 'p': 8,
}
_COLOR_FLIP = {
    'K': 'k', 'Q': 'q', 'R': 'r', 'B': 'b', 'N': 'n', 'P': 'p',
    'k': 'K', 'q': 'Q', 'r': 'R', 'b': 'B', 'n': 'N', 'p': 'P',
}

def _count_pieces(board):
    counts = {}
    for r in range(8):
        for c in range(8):
            if board[r][c] is not None:
                p = board[r][c][0]
                counts[p] = counts.get(p, 0) + 1
    return counts

def _is_white(piece):
    return piece.isupper()

def _side_total(counts, white=True):
    return sum(v for k, v in counts.items() if k.isupper() == white)

# Extract postprocess_board from cv_worker.py
match = re.search(r'(def postprocess_board\(board\):.*?)(?=\n# ─── FEN Validation)', source, re.DOTALL)
if match:
    exec(match.group(1))
else:
    print(json.dumps({"error": "Could not find postprocess_board in cv_worker.py"}))
    sys.exit(1)

def make_board():
    return [[None]*8 for _ in range(8)]


# ── Test functions ──────────────────────────────────────────────────────────

def test_pawn_rank8_with_alt():
    board = make_board()
    board[0][3] = ('P', 0.8, [{'piece': 'Q', 'confidence': 0.3}])
    result = postprocess_board(board)
    return {"piece": result[0][3][0], "conf": result[0][3][1]}

def test_pawn_rank1_with_alt():
    board = make_board()
    board[7][3] = ('p', 0.7, [{'piece': 'q', 'confidence': 0.4}])
    result = postprocess_board(board)
    return {"piece": result[7][3][0]}

def test_pawn_rank8_no_alt():
    board = make_board()
    board[0][5] = ('P', 0.6, [])
    result = postprocess_board(board)
    return {"piece": result[0][5][0], "conf": result[0][5][1]}

def test_pawn_valid_rank():
    board = make_board()
    board[3][3] = ('P', 0.9, [])
    board[5][5] = ('p', 0.85, [])
    result = postprocess_board(board)
    return {"p1": result[3][3][0], "p2": result[5][5][0]}

def test_excess_pawn_reclassify():
    board = make_board()
    for i in range(8):
        board[1][i] = ('P', 0.9, [{'piece': 'N', 'confidence': 0.3}])
    board[2][0] = ('P', 0.5, [{'piece': 'B', 'confidence': 0.4}])
    result = postprocess_board(board)
    counts = _count_pieces(result)
    cell = result[2][0][0] if result[2][0] else None
    return {"pawns": counts.get('P', 0), "cell": cell}

def test_two_kings():
    board = make_board()
    board[0][4] = ('K', 0.95, [{'piece': 'Q', 'confidence': 0.4}])
    board[3][3] = ('K', 0.6, [{'piece': 'Q', 'confidence': 0.5}])
    result = postprocess_board(board)
    counts = _count_pieces(result)
    return {
        "kings": counts.get('K', 0),
        "cell_0_4": result[0][4][0],
        "cell_3_3": result[3][3][0] if result[3][3] else None
    }

def test_two_kings_no_alt():
    board = make_board()
    board[0][4] = ('K', 0.95, [])
    board[3][3] = ('K', 0.6, [])
    result = postprocess_board(board)
    counts = _count_pieces(result)
    return {"kings": counts.get('K', 0), "cell_3_3_is_none": result[3][3] is None}

def test_promotion_budget_violated():
    board = make_board()
    for i in range(8):
        board[1][i] = ('P', 0.9, [])
    board[0][3] = ('Q', 0.95, [])
    board[3][0] = ('Q', 0.7, [])
    board[3][7] = ('Q', 0.6, [])
    result = postprocess_board(board)
    counts = _count_pieces(result)
    extra_q = max(0, counts.get('Q', 0) - 1)
    missing_p = max(0, 8 - counts.get('P', 0))
    return {"queens": counts.get('Q', 0), "pawns": counts.get('P', 0), "budget_ok": extra_q <= missing_p}

def test_promotion_budget_ok():
    board = make_board()
    for i in range(5):
        board[1][i] = ('P', 0.9, [])
    board[0][3] = ('Q', 0.95, [])
    board[3][0] = ('Q', 0.85, [])
    board[3][7] = ('Q', 0.80, [])
    board[4][0] = ('Q', 0.75, [])
    result = postprocess_board(board)
    counts = _count_pieces(result)
    extra_q = max(0, counts.get('Q', 0) - 1)
    missing_p = max(0, 8 - counts.get('P', 0))
    return {"queens": counts.get('Q', 0), "pawns": counts.get('P', 0), "budget_ok": extra_q <= missing_p}

def test_color_flip():
    board = make_board()
    back_rank = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
    for i in range(8):
        board[6][i] = ('P', 0.9, [])
        board[7][i] = (back_rank[i], 0.9, [])
    board[3][3] = ('P', 0.4, [])
    result = postprocess_board(board)
    counts = _count_pieces(result)
    white_total = _side_total(counts, white=True)
    return {"white_total": white_total}

def test_starting_position():
    board = make_board()
    back_w = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
    back_b = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r']
    for i in range(8):
        board[0][i] = (back_b[i], 0.9, [])
        board[1][i] = ('p', 0.9, [])
        board[6][i] = ('P', 0.9, [])
        board[7][i] = (back_w[i], 0.9, [])
    result = postprocess_board(board)
    counts = _count_pieces(result)
    return counts

def test_empty_board():
    board = make_board()
    result = postprocess_board(board)
    total = sum(1 for r in range(8) for c in range(8) if result[r][c] is not None)
    return {"total": total}

def test_only_kings():
    board = make_board()
    board[0][4] = ('K', 0.95, [])
    board[7][4] = ('k', 0.95, [])
    result = postprocess_board(board)
    counts = _count_pieces(result)
    return counts

def test_alternatives_preserved():
    board = make_board()
    alts = [{'piece': 'N', 'confidence': 0.3}, {'piece': 'R', 'confidence': 0.2}]
    board[3][3] = ('B', 0.8, alts)
    result = postprocess_board(board)
    cell = result[3][3]
    return {"piece": cell[0], "has_alts": len(cell[2]) > 0}


# ── Main dispatcher ─────────────────────────────────────────────────────────

TESTS = {
    "pawn_rank8_with_alt": test_pawn_rank8_with_alt,
    "pawn_rank1_with_alt": test_pawn_rank1_with_alt,
    "pawn_rank8_no_alt": test_pawn_rank8_no_alt,
    "pawn_valid_rank": test_pawn_valid_rank,
    "excess_pawn_reclassify": test_excess_pawn_reclassify,
    "two_kings": test_two_kings,
    "two_kings_no_alt": test_two_kings_no_alt,
    "promotion_budget_violated": test_promotion_budget_violated,
    "promotion_budget_ok": test_promotion_budget_ok,
    "color_flip": test_color_flip,
    "starting_position": test_starting_position,
    "empty_board": test_empty_board,
    "only_kings": test_only_kings,
    "alternatives_preserved": test_alternatives_preserved,
}

if __name__ == "__main__":
    test_name = sys.argv[1] if len(sys.argv) > 1 else None
    if test_name and test_name in TESTS:
        result = TESTS[test_name]()
        print(json.dumps(result))
    elif test_name == "list":
        print(json.dumps(list(TESTS.keys())))
    else:
        print(json.dumps({"error": f"Unknown test: {test_name}", "available": list(TESTS.keys())}))
        sys.exit(1)
