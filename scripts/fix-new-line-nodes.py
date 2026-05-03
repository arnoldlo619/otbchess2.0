"""
fix-new-line-nodes.py — Regenerates node trees for Najdorf/Dragon lines
using the correct node format: {ply, moveSan, moveUci, fen, isMainLine}

The generate-nodes.py script used a different format with {id, parentId, move, uci, ...}
This script replaces those nodes with the correct format.
"""

import json
import chess
import re

def pgn_to_correct_nodes(pgn: str) -> list[dict]:
    """Convert PGN to nodes in the correct format for seed-all-lines.mjs."""
    board = chess.Board()
    nodes = []
    
    # Root node (starting position)
    nodes.append({
        "ply": 0,
        "moveSan": None,
        "moveUci": None,
        "fen": board.fen(),
        "isMainLine": True,
    })
    
    # Strip move numbers and result
    clean = re.sub(r'\d+\.+\s*', '', pgn)
    clean = re.sub(r'\s*(1-0|0-1|1/2-1/2|\*)\s*$', '', clean)
    tokens = [t.strip() for t in clean.split() if t.strip()]
    
    for ply, san in enumerate(tokens, start=1):
        if not san:
            continue
        try:
            move = board.parse_san(san)
        except Exception as e:
            print(f"  ERROR at ply {ply} '{san}': {e}")
            return nodes
        
        uci = move.uci()
        board.push(move)
        
        nodes.append({
            "ply": ply,
            "moveSan": san,
            "moveUci": uci,
            "fen": board.fen(),
            "isMainLine": True,
        })
    
    return nodes


def main():
    seed_path = "data/line-packs-seed.json"
    seed = json.load(open(seed_path))
    
    sic_pack = seed["linePacks"]["sicilian-defense"]
    
    # Target: all Najdorf and Dragon lines (not Accelerated Dragon which was already correct)
    target_slugs = [
        l["slug"] for l in sic_pack["lines"]
        if ("najdorf" in l["slug"] or "dragon" in l["slug"])
        and "accelerated" not in l["slug"]
    ]
    
    print(f"Fixing nodes for {len(target_slugs)} lines...")
    
    fixed = 0
    errors = 0
    
    for i, line in enumerate(sic_pack["lines"]):
        if line["slug"] not in target_slugs:
            continue
        
        # Check if nodes are in wrong format
        existing_nodes = line.get("nodes", [])
        if existing_nodes and "moveSan" in existing_nodes[0]:
            print(f"  Already correct format: {line['slug']}")
            continue
        
        # Regenerate nodes in correct format
        new_nodes = pgn_to_correct_nodes(line["pgn"])
        
        if len(new_nodes) <= 1:
            print(f"  ERROR (only root node): {line['slug']}")
            errors += 1
            continue
        
        sic_pack["lines"][i]["nodes"] = new_nodes
        print(f"  Fixed: {line['slug']} ({len(new_nodes)} nodes, including root)")
        fixed += 1
    
    # Write back
    with open(seed_path, "w") as f:
        json.dump(seed, f, indent=2)
    
    print(f"\nDone: {fixed} fixed, {errors} errors")
    
    # Verify
    for line in sic_pack["lines"]:
        if line["slug"] in target_slugs:
            nodes = line.get("nodes", [])
            if nodes and "moveSan" in nodes[0]:
                print(f"  ✅ {line['slug']} — {len(nodes)} nodes (correct format)")
            else:
                print(f"  ❌ {line['slug']} — wrong format or no nodes")


if __name__ == "__main__":
    main()
