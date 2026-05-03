"""
fix-pgns-v2.py — Fix the 3 lines with corrected PGNs based on position analysis.
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

# Fixed PGNs:
# 1. Chigorin: After 7.Nxe5, Bg4 is still on g4. Black can play ...Bxe2 (legal), then Qxe2, ...Qxd5
# 2. French trap: After 3.e5 c5 4.c3 Nc6 5.Nf3, Bg4 is NOT legal (bishop blocked by e6 pawn).
#    Use a different French trap: the ...Nh6-f5 attacking d4 trap
# 3. Smith-Morra: After 3...d3 4.Bxd3, the c3 pawn blocks Nc3. Need Nbd2 instead.

FIXES = {
    "qg-chigorin-response": {
        "pgn": "1. d4 d5 2. c4 Nc6 3. Nf3 Bg4 4. cxd5 Qxd5 5. Nc3 Qa5 6. d5 Ne5 7. Nxe5 Bxe2 8. Qxe2 Qxd5 9. Bf4 e6",
    },
    "french-trap-advance-bg4": {
        "pgn": "1. e4 e6 2. d4 d5 3. e5 c5 4. c3 Nc6 5. Nf3 Qb6 6. Be2 Nh6 7. O-O cxd4 8. cxd4 Nf5 9. Nc3 Bb4 10. Na4 Qa5",
        "title": "Trap: Advance ...Nf5 Pressure",
        "lineSummary": "A tactical trap in the Advance where Black uses ...Nh6-f5 to pressure d4 and pin pieces.",
        "strategicGoal": "Reroute the knight via h6 to f5, attacking d4. Combined with ...Bb4 and ...Qa5, create tactical threats.",
        "commonOpponentMistake": "White plays Na4 trying to hit the queen, but ...Qa5 pins the knight to the king.",
        "punishmentIdea": "After ...Bb4 and ...Qa5, the Na4 is pinned and d4 is under heavy pressure.",
        "hintText": "In the Advance, ...Nh6-f5 attacks d4 directly. Combine with ...Bb4 and ...Qa5 for tactical pressure.",
    },
    "sicilian-smith-morra": {
        "pgn": "1. e4 c5 2. d4 cxd4 3. c3 d3 4. Bxd3 d6 5. Nf3 Nf6 6. O-O g6 7. Nbd2 Bg7 8. Nc4 O-O 9. Bf4 Nc6",
    },
}

# Load the seed file
seed_path = Path("data/line-packs-seed.json")
with open(seed_path) as f:
    data = json.load(f)

# Fix each problematic line
fixed = 0
for pack_slug, pack in data["linePacks"].items():
    for line in pack["lines"]:
        if line["slug"] in FIXES:
            fix = FIXES[line["slug"]]
            new_pgn = fix["pgn"]
            print(f"\nFixing: {line['slug']}")
            print(f"  New PGN: {new_pgn}")
            
            nodes, final_fen = generate_nodes(new_pgn)
            if final_fen:
                line["pgn"] = new_pgn
                line["nodes"] = nodes
                line["finalFen"] = final_fen
                line["plyCount"] = len(nodes) - 1
                # Update any extra fields
                for key in fix:
                    if key != "pgn":
                        line[key] = fix[key]
                print(f"  ✓ Fixed: {len(nodes)} nodes, final FEN: {final_fen}")
                fixed += 1
            else:
                print(f"  ✗ STILL BROKEN")

# Write back
with open(seed_path, "w") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print(f"\nDone! Fixed {fixed}/3 lines.")
