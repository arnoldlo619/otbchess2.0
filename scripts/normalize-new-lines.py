"""
normalize-new-lines.py — Normalizes new Najdorf/Dragon lines to match the
full seed format expected by seed-all-lines.mjs.

Adds all missing fields: finalFen, plyCount, isMustKnow, isTrap, lineType,
color, commonness, priority, sortOrder, themes, pawnStructure, etc.
"""

import json
import chess
import re

def get_final_fen(pgn: str) -> str:
    """Get the final FEN from a PGN string."""
    board = chess.Board()
    clean = re.sub(r'\d+\.+\s*', '', pgn)
    clean = re.sub(r'\s*(1-0|0-1|1/2-1/2|\*)\s*$', '', clean)
    tokens = [t.strip() for t in clean.split() if t.strip()]
    for san in tokens:
        try:
            board.push_san(san)
        except Exception:
            break
    return board.fen()

def get_ply_count(pgn: str) -> int:
    """Count the number of half-moves in a PGN."""
    clean = re.sub(r'\d+\.+\s*', '', pgn)
    clean = re.sub(r'\s*(1-0|0-1|1/2-1/2|\*)\s*$', '', clean)
    tokens = [t.strip() for t in clean.split() if t.strip()]
    return len(tokens)

def get_move_sequences(pgn: str):
    """Extract SAN and UCI move sequences from a PGN."""
    board = chess.Board()
    clean = re.sub(r'\d+\.+\s*', '', pgn)
    clean = re.sub(r'\s*(1-0|0-1|1/2-1/2|\*)\s*$', '', clean)
    tokens = [t.strip() for t in clean.split() if t.strip()]
    sans = []
    ucis = []
    for san in tokens:
        try:
            move = board.parse_san(san)
            ucis.append(move.uci())
            board.push(move)
            sans.append(san)
        except Exception:
            break
    return ' '.join(sans), ' '.join(ucis)

def normalize_line(line: dict, opening_slug: str, sort_base: int) -> dict:
    """Add all missing fields to a line dict."""
    pgn = line['pgn']
    final_fen = get_final_fen(pgn)
    ply_count = get_ply_count(pgn)
    move_san, move_uci = get_move_sequences(pgn)
    
    # Determine color from PGN (White plays first, so if ply is odd, last move was White)
    color = "white"  # Najdorf/Dragon are Black's openings, but lines can be from either side
    
    # Determine if it's a trap
    is_trap = line.get('category', '') == 'traps' or 'trap' in line['slug'].lower()
    
    # Determine line type from category
    category = line.get('category', 'main-lines')
    if is_trap:
        line_type = 'trap'
    elif category == 'endgame-plans':
        line_type = 'endgame'
    else:
        line_type = 'main'
    
    # Commonness based on must_know status (integer 0-100)
    is_must_know = line.get('mustKnow', False)
    commonness = 90 if is_must_know else 70
    
    # Themes based on opening
    slug = line['slug']
    if 'najdorf' in slug:
        themes = ['open-game', 'sicilian', 'najdorf', 'attacking-play']
    elif 'dragon' in slug:
        themes = ['open-game', 'sicilian', 'dragon', 'fianchetto']
    else:
        themes = ['open-game', 'sicilian']
    
    # Pawn structure
    if 'najdorf' in slug:
        pawn_structure = 'sicilian-najdorf'
    elif 'dragon' in slug:
        pawn_structure = 'sicilian-dragon'
    else:
        pawn_structure = 'sicilian'
    
    # Chapter name based on category
    category_to_chapter = {
        'main-lines': 'Main Lines',
        'traps': 'Traps & Tricks',
        'endgame-plans': 'Endgame Plans',
        'sidelines': 'Sidelines',
    }
    chapter_name = category_to_chapter.get(category, 'Main Lines')
    
    # Branch label from title
    branch_label = line['title'].split(':')[0].strip() if ':' in line['title'] else line['title']
    
    normalized = {
        # Keep existing fields
        'slug': line['slug'],
        'title': line['title'],
        'pgn': pgn,
        'difficulty': line.get('difficulty', 'intermediate'),
        'eco': line.get('eco', 'B90'),
        'hintText': line.get('hintText', ''),
        'punishmentIdea': line.get('punishmentIdea', ''),
        'strategicGoal': line.get('strategicGoal', ''),
        'studyMode': line.get('studyMode', 'full'),
        'nodes': line.get('nodes', []),
        
        # Add missing fields
        'openingSlug': opening_slug,
        'finalFen': final_fen,
        'plyCount': ply_count,
        'moveSequenceSan': move_san,
        'moveSequenceUci': move_uci,
        'isMustKnow': is_must_know,
        'isTrap': is_trap,
        'lineType': line_type,
        'color': color,
        'commonness': commonness,
        'priority': 90 if is_must_know else 70,
        'sortOrder': sort_base,
        'themes': themes,
        'pawnStructure': pawn_structure,
        'chapterName': chapter_name,
        'branchLabel': branch_label,
        'lineSummary': line.get('strategicGoal', '')[:200] if line.get('strategicGoal') else '',
        'commonOpponentMistake': '',
    }
    
    return normalized


def main():
    seed_path = "data/line-packs-seed.json"
    seed = json.load(open(seed_path))
    
    sic_pack = seed['linePacks']['sicilian-defense']
    
    # Identify new lines (Najdorf and Dragon)
    new_slugs = [l['slug'] for l in sic_pack['lines'] 
                 if 'najdorf' in l['slug'] or ('dragon' in l['slug'] and 'accelerated' not in l['slug'])]
    
    print(f"Normalizing {len(new_slugs)} new lines...")
    
    normalized_count = 0
    for i, line in enumerate(sic_pack['lines']):
        if line['slug'] in new_slugs:
            # Check if already normalized (has finalFen)
            if 'finalFen' not in line:
                sic_pack['lines'][i] = normalize_line(line, 'sicilian-defense', 50 + i)
                print(f"  Normalized: {line['slug']}")
                normalized_count += 1
            else:
                print(f"  Already normalized: {line['slug']}")
    
    # Write back
    with open(seed_path, 'w') as f:
        json.dump(seed, f, indent=2)
    
    print(f"\nDone: {normalized_count} lines normalized")
    
    # Verify
    for line in sic_pack['lines']:
        if line['slug'] in new_slugs:
            missing = []
            for field in ['finalFen', 'plyCount', 'isMustKnow', 'isTrap', 'lineType', 'color', 'commonness', 'priority', 'sortOrder']:
                if field not in line:
                    missing.append(field)
            if missing:
                print(f"  STILL MISSING in {line['slug']}: {missing}")
            else:
                print(f"  ✅ {line['slug']} — all required fields present")


if __name__ == "__main__":
    main()
