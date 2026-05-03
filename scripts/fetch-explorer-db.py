"""
fetch-explorer-db.py — Build a comprehensive fallback opening explorer database
by fetching real frequency data from the Lichess Opening Explorer API.

Strategy:
- BFS traversal starting from the initial position
- Fetch top moves for each position (speeds: rapid,classical; ratings: 1600-2500)
- Stop expanding a branch when:
  * Depth >= MAX_DEPTH (10 half-moves)
  * Total games < MIN_GAMES (position is too rare)
  * Position already visited
- Store results keyed by FEN (first 4 fields only, ignoring move clocks)
- Output: data/explorer-fallback.json

Expected output: ~3,000-6,000 positions covering all major openings
"""
import json
import time
import chess
import requests
from collections import deque
from pathlib import Path

# ── Config ────────────────────────────────────────────────────────────────────
MAX_DEPTH = 10          # half-moves (plies) deep
MIN_GAMES = 1000        # minimum total games to expand a position
MAX_POSITIONS = 8000    # safety cap
RATE_LIMIT_DELAY = 0.35 # seconds between requests (Lichess allows ~2-3/sec)
OUTPUT_FILE = Path("data/explorer-fallback.json")

# Lichess explorer API params
SPEEDS = "rapid,classical,blitz"
RATINGS = "1600,1800,2000,2200,2500"
VARIANT = "standard"
MOVES = 15  # top N moves to return per position

HEADERS = {
    "Accept": "application/json",
    "User-Agent": "ChessOTB.club/1.0 (opening-repertoire-builder; contact@chessotb.club)",
}

# ── FEN normalization ─────────────────────────────────────────────────────────
def fen_key(fen: str) -> str:
    """Normalize FEN to first 4 fields (ignore halfmove clock and fullmove number)."""
    parts = fen.split()
    return " ".join(parts[:4])

# ── Fetch from Lichess ────────────────────────────────────────────────────────
def fetch_position(fen: str, retries: int = 3) -> dict | None:
    url = "https://explorer.lichess.ovh/lichess"
    params = {
        "variant": VARIANT,
        "speeds": SPEEDS,
        "ratings": RATINGS,
        "fen": fen,
        "moves": MOVES,
        "topGames": 0,
        "recentGames": 0,
    }
    for attempt in range(retries):
        try:
            resp = requests.get(url, params=params, headers=HEADERS, timeout=10)
            if resp.status_code == 200:
                return resp.json()
            elif resp.status_code == 429:
                wait = 5 * (attempt + 1)
                print(f"  ⚠️  Rate limited, waiting {wait}s...")
                time.sleep(wait)
            else:
                print(f"  ⚠️  HTTP {resp.status_code} for FEN: {fen[:40]}")
                return None
        except Exception as e:
            print(f"  ⚠️  Error fetching (attempt {attempt+1}): {e}")
            time.sleep(2)
    return None

# ── Main BFS ──────────────────────────────────────────────────────────────────
def build_explorer_db():
    db = {}
    visited = set()
    queue = deque()

    # Start from initial position
    start_board = chess.Board()
    start_fen = start_board.fen()
    queue.append((start_fen, 0))
    visited.add(fen_key(start_fen))

    total_fetched = 0
    total_skipped = 0

    print(f"🚀 Starting BFS explorer fetch (max depth={MAX_DEPTH}, min games={MIN_GAMES})")
    print(f"   Output: {OUTPUT_FILE}")

    while queue and len(db) < MAX_POSITIONS:
        fen, depth = queue.popleft()
        key = fen_key(fen)

        # Fetch from Lichess
        data = fetch_position(fen)
        time.sleep(RATE_LIMIT_DELAY)
        total_fetched += 1

        if not data:
            total_skipped += 1
            continue

        total_games = data.get("white", 0) + data.get("draws", 0) + data.get("black", 0)
        moves = data.get("moves", [])

        # Store this position
        db[key] = {
            "white": data.get("white", 0),
            "draws": data.get("draws", 0),
            "black": data.get("black", 0),
            "opening": data.get("opening"),
            "moves": [
                {
                    "uci": m["uci"],
                    "san": m["san"],
                    "white": m.get("white", 0),
                    "draws": m.get("draws", 0),
                    "black": m.get("black", 0),
                    "averageRating": m.get("averageRating", 1800),
                }
                for m in moves
                if m.get("white", 0) + m.get("draws", 0) + m.get("black", 0) > 0
            ],
        }

        if total_fetched % 50 == 0 or total_fetched <= 10:
            print(f"  [{total_fetched:4d}] depth={depth} positions={len(db)} queue={len(queue)} | {fen[:50]}")

        # Expand children if not too deep and has enough games
        if depth < MAX_DEPTH and total_games >= MIN_GAMES:
            board = chess.Board(fen)
            for move_data in moves[:8]:  # Only expand top 8 moves
                move_games = move_data.get("white", 0) + move_data.get("draws", 0) + move_data.get("black", 0)
                if move_games < MIN_GAMES:
                    continue
                try:
                    move = chess.Move.from_uci(move_data["uci"])
                    if move not in board.legal_moves:
                        continue
                    board.push(move)
                    child_fen = board.fen()
                    child_key = fen_key(child_fen)
                    if child_key not in visited:
                        visited.add(child_key)
                        queue.append((child_fen, depth + 1))
                    board.pop()
                except Exception:
                    pass

    # Save
    meta = {
        "_meta": {
            "version": "1.0.0",
            "description": "Fallback opening explorer database fetched from Lichess API",
            "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "positionCount": len(db),
            "maxDepth": MAX_DEPTH,
            "minGames": MIN_GAMES,
            "speeds": SPEEDS,
            "ratings": RATINGS,
        }
    }
    output = {**meta, "positions": db}

    OUTPUT_FILE.parent.mkdir(exist_ok=True)
    with open(OUTPUT_FILE, "w") as f:
        json.dump(output, f, separators=(",", ":"))  # compact JSON

    size_mb = OUTPUT_FILE.stat().st_size / 1024 / 1024
    print(f"\n{'═' * 60}")
    print(f"✅ Done! Fetched {total_fetched} positions, stored {len(db)}")
    print(f"   Skipped: {total_skipped}")
    print(f"   File size: {size_mb:.2f} MB")
    print(f"   Output: {OUTPUT_FILE}")

if __name__ == "__main__":
    build_explorer_db()
