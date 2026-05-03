"""
merge-and-generate.py — Merge all new opening parts into line-packs-seed.json
and generate node trees with accurate FEN positions.
"""
import json
import chess
import re
from pathlib import Path

def parse_pgn_to_moves(pgn_str):
    """Parse a PGN move string into a list of SAN moves."""
    cleaned = re.sub(r'\d+\.+\s*', ' ', pgn_str)
    cleaned = re.sub(r'(1-0|0-1|1/2-1/2|\*)', '', cleaned)
    moves = cleaned.split()
    return [m.strip() for m in moves if m.strip()]

def generate_nodes(pgn_str):
    """Generate a full node tree from a PGN string."""
    board = chess.Board()
    nodes = []
    
    nodes.append({
        "ply": 0,
        "moveSan": None,
        "moveUci": None,
        "fen": board.fen(),
        "isMainLine": True
    })
    
    moves = parse_pgn_to_moves(pgn_str)
    
    for i, san_move in enumerate(moves):
        try:
            move = board.parse_san(san_move)
            uci = move.uci()
            board.push(move)
            nodes.append({
                "ply": i + 1,
                "moveSan": san_move,
                "moveUci": uci,
                "fen": board.fen(),
                "isMainLine": True
            })
        except (chess.InvalidMoveError, chess.IllegalMoveError, chess.AmbiguousMoveError) as e:
            print(f"  ERROR at ply {i+1}: '{san_move}' — {e}")
            print(f"  Board: {board.fen()}")
            return nodes, None
    
    return nodes, board.fen()

def main():
    # Load existing line-packs-seed.json
    seed_path = Path("data/line-packs-seed.json")
    with open(seed_path) as f:
        data = json.load(f)
    
    # Load all new parts
    parts = []
    for i in range(1, 6):
        part_path = Path(f"data/new-openings-part{i}.json")
        if part_path.exists():
            with open(part_path) as f:
                parts.append(json.load(f))
            print(f"Loaded part {i}")
    
    # Merge new openings into the main data
    for part in parts:
        for slug, pack in part["linePacks"].items():
            if slug in data["linePacks"]:
                print(f"  SKIP (already exists): {slug}")
            else:
                data["linePacks"][slug] = pack
                print(f"  ADDED: {slug} ({len(pack['lines'])} lines)")
    
    # Generate nodes for ALL lines (including newly added ones)
    total_lines = 0
    total_nodes = 0
    errors = 0
    
    for pack_slug, pack in data["linePacks"].items():
        print(f"\n=== {pack.get('openingName', pack_slug)} ({len(pack['lines'])} lines) ===")
        
        for line in pack["lines"]:
            pgn = line.get("pgn", "")
            if not pgn:
                print(f"  SKIP (no PGN): {line['slug']}")
                continue
            
            nodes, final_fen = generate_nodes(pgn)
            
            if len(nodes) <= 1:
                print(f"  ERROR: {line['slug']} — no moves parsed")
                errors += 1
                continue
            
            line["nodes"] = nodes
            if final_fen:
                line["finalFen"] = final_fen
            
            # Ensure plyCount is set
            line["plyCount"] = len(nodes) - 1
            
            # Ensure lineCount is updated
            total_lines += 1
            total_nodes += len(nodes)
            print(f"  ✓ {line['slug']}: {len(nodes)} nodes")
    
    # Update lineCount for each pack
    for slug, pack in data["linePacks"].items():
        pack["lineCount"] = len(pack["lines"])
    
    # Write the final merged file
    with open(seed_path, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    print(f"\n{'='*60}")
    print(f"Total openings: {len(data['linePacks'])}")
    print(f"Total lines processed: {total_lines}")
    print(f"Total nodes generated: {total_nodes}")
    print(f"Errors: {errors}")
    print(f"Output: {seed_path}")

if __name__ == "__main__":
    main()
