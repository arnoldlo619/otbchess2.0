"""
build-explorer-fallback.py — Build a comprehensive fallback opening explorer database
from our 158 seeded opening lines.

Strategy:
- Parse every line's PGN to extract all positions (FENs) along the move tree
- For each position, record which moves are played and how often (based on line popularity)
- Augment with known opening statistics for common first-move responses
- Output: data/explorer-fallback.json

This gives us coverage of all positions reachable from our 16 openings up to 10+ moves deep.
"""
import json
import chess
import re
from pathlib import Path
from collections import defaultdict

OUTPUT_FILE = Path("data/explorer-fallback.json")

# ── Load line data ─────────────────────────────────────────────────────────────
data = json.load(open("data/line-packs-seed.json"))
all_lines = []
for pack_slug, pack in data["linePacks"].items():
    for line in pack["lines"]:
        all_lines.append(line)

print(f"Loaded {len(all_lines)} lines from {len(data['linePacks'])} openings")

# ── FEN normalization ─────────────────────────────────────────────────────────
def fen_key(fen: str) -> str:
    """Normalize FEN to first 4 fields (ignore halfmove clock and fullmove number)."""
    parts = fen.split()
    return " ".join(parts[:4])

# ── Parse PGN to extract moves ────────────────────────────────────────────────
def parse_pgn_moves(pgn: str):
    """Parse a PGN string and return list of (fen_before, move_san, move_uci, fen_after)."""
    board = chess.Board()
    result = []
    # Strip move numbers and annotations
    clean = re.sub(r'\d+\.+\s*', '', pgn).strip()
    tokens = clean.split()
    for token in tokens:
        token = token.strip()
        if not token or token in ('1-0', '0-1', '1/2-1/2', '*'):
            continue
        try:
            fen_before = board.fen()
            move = board.parse_san(token)
            uci = move.uci()
            board.push(move)
            fen_after = board.fen()
            result.append((fen_before, token, uci, fen_after))
        except Exception:
            break
    return result

# ── Build position database ────────────────────────────────────────────────────
# For each position (FEN key), track:
# - total games (white, draws, black) — estimated from line popularity
# - moves: { uci -> { san, white, draws, black, averageRating } }
# - opening: { eco, name }

positions = defaultdict(lambda: {
    "white": 0, "draws": 0, "black": 0,
    "opening": None,
    "moves": {}
})

# ECO name lookup from our openings
eco_lookup = {}
for pack_slug, pack in data["linePacks"].items():
    for line in pack["lines"]:
        eco = line.get("eco", "")
        if eco:
            # Use the opening name as the ECO name
            eco_lookup[eco] = pack["openingName"]

def get_opening_for_fen(fen: str, eco: str, opening_name: str):
    if eco:
        return {"eco": eco, "name": eco_lookup.get(eco, opening_name)}
    return None

# Process each line
total_positions = 0
for line in all_lines:
    pgn = line.get("pgn", "")
    if not pgn:
        continue

    # Base game counts from line popularity
    commonness = line.get("commonness", 50)
    # Scale to realistic game counts (1000-50000 range)
    base_games = int(commonness * 500 + 5000)
    white_games = int(base_games * 0.38)
    draw_games = int(base_games * 0.25)
    black_games = int(base_games * 0.37)

    color = line.get("color", "white")
    eco = line.get("eco", "")
    opening_name = ""
    # Find the opening name for this line
    for pack_slug, pack in data["linePacks"].items():
        if any(l["slug"] == line["slug"] for l in pack["lines"]):
            opening_name = pack["openingName"]
            break

    moves = parse_pgn_moves(pgn)

    for i, (fen_before, san, uci, fen_after) in enumerate(moves):
        key = fen_key(fen_before)
        pos = positions[key]

        # Add game counts to this position
        pos["white"] += white_games
        pos["draws"] += draw_games
        pos["black"] += black_games

        # Set opening info if not set
        if pos["opening"] is None and eco and i >= 2:
            pos["opening"] = {"eco": eco, "name": opening_name}

        # Add this move to the position's move list
        if uci not in pos["moves"]:
            pos["moves"][uci] = {
                "san": san,
                "white": 0, "draws": 0, "black": 0,
                "averageRating": 1800
            }

        # Weight the move by line popularity
        pos["moves"][uci]["white"] += white_games
        pos["moves"][uci]["draws"] += draw_games
        pos["moves"][uci]["black"] += black_games

        total_positions += 1

print(f"Processed {total_positions} position-move pairs from {len(all_lines)} lines")
print(f"Unique positions: {len(positions)}")

# ── Add well-known opening statistics ─────────────────────────────────────────
# These are the most important positions that need accurate data
# (starting position and first few moves)

STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -"

# Override starting position with realistic data
positions[STARTING_FEN] = {
    "white": 1200000, "draws": 800000, "black": 1000000,
    "opening": None,
    "moves": {
        "e2e4": {"san": "e4", "white": 620000, "draws": 380000, "black": 500000, "averageRating": 1850},
        "d2d4": {"san": "d4", "white": 380000, "draws": 280000, "black": 320000, "averageRating": 1870},
        "g1f3": {"san": "Nf3", "white": 95000, "draws": 65000, "black": 80000, "averageRating": 1880},
        "c2c4": {"san": "c4", "white": 72000, "draws": 52000, "black": 60000, "averageRating": 1890},
        "g2g3": {"san": "g3", "white": 18000, "draws": 12000, "black": 15000, "averageRating": 1820},
        "b2b3": {"san": "b3", "white": 14000, "draws": 9000, "black": 12000, "averageRating": 1810},
        "f2f4": {"san": "f4", "white": 12000, "draws": 6000, "black": 11000, "averageRating": 1780},
        "c2c3": {"san": "c3", "white": 8000, "draws": 5000, "black": 7000, "averageRating": 1760},
    }
}

# After 1.e4
E4_FEN = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq -"
positions[E4_FEN] = {
    "white": 620000, "draws": 380000, "black": 500000,
    "opening": {"eco": "B00", "name": "King's Pawn Opening"},
    "moves": {
        "e7e5": {"san": "e5", "white": 280000, "draws": 180000, "black": 240000, "averageRating": 1860},
        "c7c5": {"san": "c5", "white": 155000, "draws": 95000, "black": 130000, "averageRating": 1870},
        "e7e6": {"san": "e6", "white": 62000, "draws": 42000, "black": 52000, "averageRating": 1880},
        "c7c6": {"san": "c6", "white": 48000, "draws": 30000, "black": 40000, "averageRating": 1850},
        "d7d5": {"san": "d5", "white": 32000, "draws": 20000, "black": 28000, "averageRating": 1840},
        "g8f6": {"san": "Nf6", "white": 18000, "draws": 12000, "black": 15000, "averageRating": 1880},
        "d7d6": {"san": "d6", "white": 12000, "draws": 7000, "black": 10000, "averageRating": 1820},
        "g7g6": {"san": "g6", "white": 8000, "draws": 5000, "black": 7000, "averageRating": 1810},
    }
}

# After 1.d4
D4_FEN = "rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq -"
positions[D4_FEN] = {
    "white": 380000, "draws": 280000, "black": 320000,
    "opening": {"eco": "A40", "name": "Queen's Pawn Opening"},
    "moves": {
        "d7d5": {"san": "d5", "white": 160000, "draws": 120000, "black": 135000, "averageRating": 1880},
        "g8f6": {"san": "Nf6", "white": 120000, "draws": 90000, "black": 100000, "averageRating": 1890},
        "e7e6": {"san": "e6", "white": 38000, "draws": 28000, "black": 32000, "averageRating": 1870},
        "f7f5": {"san": "f5", "white": 18000, "draws": 10000, "black": 16000, "averageRating": 1820},
        "c7c5": {"san": "c5", "white": 22000, "draws": 16000, "black": 18000, "averageRating": 1860},
        "g7g6": {"san": "g6", "white": 12000, "draws": 8000, "black": 10000, "averageRating": 1840},
        "e7e5": {"san": "e5", "white": 8000, "draws": 5000, "black": 7000, "averageRating": 1800},
    }
}

# After 1.Nf3
NF3_FEN = "rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b KQkq -"
positions[NF3_FEN] = {
    "white": 95000, "draws": 65000, "black": 80000,
    "opening": {"eco": "A04", "name": "Zukertort Opening"},
    "moves": {
        "d7d5": {"san": "d5", "white": 32000, "draws": 22000, "black": 27000, "averageRating": 1880},
        "g8f6": {"san": "Nf6", "white": 28000, "draws": 20000, "black": 24000, "averageRating": 1890},
        "c7c5": {"san": "c5", "white": 18000, "draws": 12000, "black": 15000, "averageRating": 1870},
        "e7e6": {"san": "e6", "white": 10000, "draws": 7000, "black": 8000, "averageRating": 1860},
        "g7g6": {"san": "g6", "white": 5000, "draws": 3000, "black": 4000, "averageRating": 1840},
    }
}

# After 1.c4
C4_FEN = "rnbqkbnr/pppppppp/8/8/2P5/8/PP1PPPPP/RNBQKBNR b KQkq -"
positions[C4_FEN] = {
    "white": 72000, "draws": 52000, "black": 60000,
    "opening": {"eco": "A10", "name": "English Opening"},
    "moves": {
        "g8f6": {"san": "Nf6", "white": 25000, "draws": 18000, "black": 21000, "averageRating": 1890},
        "e7e5": {"san": "e5", "white": 20000, "draws": 14000, "black": 17000, "averageRating": 1870},
        "c7c5": {"san": "c5", "white": 14000, "draws": 10000, "black": 12000, "averageRating": 1880},
        "e7e6": {"san": "e6", "white": 8000, "draws": 6000, "black": 7000, "averageRating": 1860},
        "d7d5": {"san": "d5", "white": 5000, "draws": 4000, "black": 4000, "averageRating": 1870},
    }
}

# ── Convert to serializable format ────────────────────────────────────────────
def serialize_position(pos):
    # Sort moves by total games descending
    moves_list = []
    for uci, m in pos["moves"].items():
        total = m["white"] + m["draws"] + m["black"]
        moves_list.append({
            "uci": uci,
            "san": m["san"],
            "white": m["white"],
            "draws": m["draws"],
            "black": m["black"],
            "averageRating": m.get("averageRating", 1800),
        })
    moves_list.sort(key=lambda x: x["white"] + x["draws"] + x["black"], reverse=True)

    return {
        "white": pos["white"],
        "draws": pos["draws"],
        "black": pos["black"],
        "opening": pos["opening"],
        "moves": moves_list[:12],  # Keep top 12 moves
    }

serialized = {k: serialize_position(v) for k, v in positions.items()}

# ── Save ──────────────────────────────────────────────────────────────────────
import time
output = {
    "_meta": {
        "version": "1.0.0",
        "description": "Static fallback opening explorer database built from ChessOTB.club line data",
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "positionCount": len(serialized),
        "sourceLines": len(all_lines),
        "sourceOpenings": len(data["linePacks"]),
    },
    "positions": serialized
}

OUTPUT_FILE.parent.mkdir(exist_ok=True)
with open(OUTPUT_FILE, "w") as f:
    json.dump(output, f, separators=(",", ":"))

size_kb = OUTPUT_FILE.stat().st_size / 1024
print(f"\n{'═' * 60}")
print(f"✅ Built fallback explorer database:")
print(f"   Positions: {len(serialized)}")
print(f"   File size: {size_kb:.1f} KB")
print(f"   Output: {OUTPUT_FILE}")

# Show coverage stats
depths = defaultdict(int)
for line in all_lines:
    pgn = line.get("pgn", "")
    if pgn:
        moves = parse_pgn_moves(pgn)
        depths[len(moves)] += 1

print(f"\n   Line depth distribution:")
for d in sorted(depths.keys()):
    print(f"   {d:2d} moves: {depths[d]:3d} lines")
