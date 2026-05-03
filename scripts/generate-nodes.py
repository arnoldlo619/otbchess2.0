"""
generate-nodes.py — Generate full node trees with accurate FEN positions for all opening lines.

This script:
1. Reads line-packs-seed.json (existing 56 lines without nodes)
2. Generates node trees using python-chess for accurate FEN computation
3. Outputs an updated line-packs-seed.json with nodes included

Usage: python3 scripts/generate-nodes.py
"""
import json
import chess
import re
import sys
from pathlib import Path

def parse_pgn_to_moves(pgn_str):
    """Parse a PGN move string into a list of SAN moves."""
    # Remove move numbers and results
    cleaned = re.sub(r'\d+\.+\s*', ' ', pgn_str)
    cleaned = re.sub(r'(1-0|0-1|1/2-1/2|\*)', '', cleaned)
    moves = cleaned.split()
    return [m.strip() for m in moves if m.strip()]

def generate_nodes(pgn_str):
    """Generate a full node tree from a PGN string.
    Returns a list of node dicts with ply, moveSan, moveUci, fen, isMainLine."""
    board = chess.Board()
    nodes = []
    
    # Ply 0: starting position
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
            print(f"  ERROR at ply {i+1}: '{san_move}' — {e}", file=sys.stderr)
            print(f"  Board state: {board.fen()}", file=sys.stderr)
            break
    
    return nodes, board.fen()

def main():
    seed_path = Path("data/line-packs-seed.json")
    with open(seed_path) as f:
        data = json.load(f)
    
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
                print(f"  ERROR: {line['slug']} — no moves parsed from: {pgn}")
                errors += 1
                continue
            
            line["nodes"] = nodes
            # Update finalFen if it was computed
            if final_fen:
                line["finalFen"] = final_fen
            
            total_lines += 1
            total_nodes += len(nodes)
            print(f"  ✓ {line['slug']}: {len(nodes)} nodes")
    
    # Write back
    output_path = Path("data/line-packs-seed.json")
    with open(output_path, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    print(f"\n{'='*50}")
    print(f"Total lines processed: {total_lines}")
    print(f"Total nodes generated: {total_nodes}")
    print(f"Errors: {errors}")
    print(f"Output: {output_path}")

if __name__ == "__main__":
    main()
