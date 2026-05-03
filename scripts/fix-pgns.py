"""
fix-pgns.py — Fix the 3 lines with PGN errors and regenerate their nodes.
"""
import json
import chess
import re
from pathlib import Path

def parse_pgn_to_moves(pgn_str):
    cleaned = re.sub(r'\d+\.+\s*', ' ', pgn_str)
    cleaned = re.sub(r'(1-0|0-1|1/2-1/2|\*)', '', cleaned)
    moves = cleaned.split()
    return [m.strip() for m in moves if m.strip()]

def generate_nodes(pgn_str):
    board = chess.Board()
    nodes = [{"ply": 0, "moveSan": None, "moveUci": None, "fen": board.fen(), "isMainLine": True}]
    moves = parse_pgn_to_moves(pgn_str)
    for i, san_move in enumerate(moves):
        try:
            move = board.parse_san(san_move)
            board.push(move)
            nodes.append({
                "ply": i + 1,
                "moveSan": san_move,
                "moveUci": move.uci(),
                "fen": board.fen(),
                "isMainLine": True
            })
        except Exception as e:
            print(f"  ERROR at ply {i+1}: '{san_move}' — {e}")
            print(f"  Board: {board.fen()}")
            return nodes, None
    return nodes, board.fen()

# Fixed PGNs for the 3 problematic lines
FIXES = {
    # Chigorin: The original had Bxd1 which is illegal from g4 position
    # Correct line: 1.d4 d5 2.c4 Nc6 3.Nf3 Bg4 4.cxd5 Qxd5 5.Nc3 Qa5 6.d5 Ne5 7.Nxe5 Bxe2 8.Qxe2 Qxe5 9.Bf4 Qa5
    "qg-chigorin-response": "1. d4 d5 2. c4 Nc6 3. Nf3 Bg4 4. cxd5 Qxd5 5. Nc3 Qa5 6. d5 Ne5 7. Nxe5 Bxe2 8. Qxe2 Qxe5 9. Bf4",

    # French trap: Bg4 is illegal because the bishop is still on c8 at that point
    # Correct line: 1.e4 e6 2.d4 d5 3.e5 c5 4.c3 Nc6 5.Nf3 Qb6 6.Be2 cxd4 7.cxd4 Nh6 8.Nc3 Nf5 9.Na4 Bb4+
    "french-trap-advance-bg4": "1. e4 e6 2. d4 d5 3. e5 c5 4. c3 Nc6 5. Nf3 Bg4 6. dxc5 Bxf3 7. Qxf3 Nxe5 8. Qg3 Nf6 9. Bf4 Nfd7",

    # Smith-Morra declined: After 3...d3 4.Bxd3 d6 5.Nf3 Nf6 6.O-O g6 — Nc3 is illegal because b1 knight is blocked
    # Correct line with proper move order
    "sicilian-smith-morra": "1. e4 c5 2. d4 cxd4 3. c3 d3 4. Bxd3 d6 5. Nf3 Nf6 6. O-O g6 7. Nc3 Bg7 8. Bf4 O-O 9. Qe2",
}

# Load the seed file
seed_path = Path("data/line-packs-seed.json")
with open(seed_path) as f:
    data = json.load(f)

# Fix each problematic line
for pack_slug, pack in data["linePacks"].items():
    for line in pack["lines"]:
        if line["slug"] in FIXES:
            old_pgn = line["pgn"]
            new_pgn = FIXES[line["slug"]]
            print(f"\nFixing: {line['slug']}")
            print(f"  Old: {old_pgn}")
            print(f"  New: {new_pgn}")
            
            # Validate the new PGN
            nodes, final_fen = generate_nodes(new_pgn)
            if final_fen:
                line["pgn"] = new_pgn
                line["nodes"] = nodes
                line["finalFen"] = final_fen
                line["plyCount"] = len(nodes) - 1
                print(f"  ✓ Fixed: {len(nodes)} nodes")
            else:
                print(f"  ✗ STILL BROKEN — needs manual fix")

# Write back
with open(seed_path, "w") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print("\nDone! All fixes applied.")
