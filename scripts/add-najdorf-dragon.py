"""
add-najdorf-dragon.py — Adds Najdorf and Dragon Sicilian variations to line-packs-seed.json.

New lines added (12 total):
  Najdorf (6 lines):
    1. Najdorf: 6.Bg5 Classical (English Attack)
    2. Najdorf: 6.Be3 English Attack
    3. Najdorf: 6.Bc4 Sozin Attack
    4. Najdorf: 6.f4 Fischer Attack
    5. Najdorf: 6.g3 Fianchetto
    6. Najdorf: Trap — Poisoned Pawn (6.Bg5 e6 7.f4 Qb6)

  Dragon (6 lines):
    1. Dragon: Yugoslav Attack 9.Bc4 Main Line
    2. Dragon: Yugoslav Attack 9.0-0-0 Soltis Variation
    3. Dragon: Classical Dragon 6.Be2
    4. Dragon: Levenfish Attack 6.f4
    5. Dragon: Chinese Dragon 6.Be3 Bg7 7.f3
    6. Dragon: Trap — Dragon Poisoned Pawn (h-file attack)
"""

import json
import chess
import re
import sys

# ── FEN generation helpers ────────────────────────────────────────────────────

def pgn_to_nodes(pgn: str, opening_name: str, eco: str) -> list[dict]:
    """Convert a PGN string to a list of node dicts with accurate FEN positions."""
    board = chess.Board()
    nodes = []
    
    # Strip move numbers and result
    clean = re.sub(r'\d+\.+\s*', '', pgn)
    clean = re.sub(r'\s*(1-0|0-1|1/2-1/2|\*)\s*$', '', clean)
    tokens = [t.strip() for t in clean.split() if t.strip()]
    
    parent_id = None
    node_id = 1
    
    for i, san in enumerate(tokens):
        if not san:
            continue
        try:
            move = board.parse_san(san)
        except Exception as e:
            print(f"  ERROR parsing '{san}' in '{opening_name}': {e}", file=sys.stderr)
            return nodes
        
        uci = move.uci()
        board.push(move)
        fen = board.fen()
        fen_key = ' '.join(fen.split()[:4])
        
        node = {
            "id": node_id,
            "parentId": parent_id,
            "move": san,
            "uci": uci,
            "fen": fen,
            "fenKey": fen_key,
            "isMainLine": True,
            "moveNumber": (i // 2) + 1,
            "color": "black" if board.turn == chess.WHITE else "white",  # color who just moved
            "annotation": None,
            "comment": None,
        }
        nodes.append(node)
        parent_id = node_id
        node_id += 1
    
    return nodes


def make_line(slug, title, pgn, difficulty, category, study_mode,
              strategic_goal, hint_text, punishment_idea, eco, opening_name,
              must_know=False, learn_first=False):
    """Build a complete line dict with node tree."""
    nodes = pgn_to_nodes(pgn, title, eco)
    move_count = len(pgn.split('.')) - 1  # rough estimate
    
    return {
        "slug": slug,
        "title": title,
        "pgn": pgn,
        "difficulty": difficulty,
        "category": category,
        "studyMode": study_mode,
        "mustKnow": must_know,
        "learnFirst": learn_first,
        "estimatedMinutes": max(5, len(nodes) // 3),
        "strategicGoal": strategic_goal,
        "hintText": hint_text,
        "punishmentIdea": punishment_idea,
        "eco": eco,
        "openingName": opening_name,
        "nodes": nodes,
    }


# ── Najdorf Lines ─────────────────────────────────────────────────────────────

najdorf_lines = [
    make_line(
        slug="sicilian-najdorf-bg5-classical",
        title="Najdorf: 6.Bg5 Classical",
        pgn="1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 6. Bg5 e6 7. f4 Be7 8. Qf3 Qc7 9. O-O-O Nbd7 10. g4 b5 11. Bxf6 Nxf6 12. g5 Nd7 13. f5 Ne5",
        difficulty="advanced",
        category="main-lines",
        study_mode="full",
        strategic_goal="Play for queenside counterplay with ...b5-b4 while White launches a kingside pawn storm. The race between attacks decides the game.",
        hint_text="After 6.Bg5, Black must decide between the Poisoned Pawn (6...e6 7.f4 Qb6) and the solid ...e6 ...Be7 setup. The solid setup avoids complications but requires precise defense.",
        punishment_idea="If Black plays ...b4 too early without completing development, White's g5-f5 pawn storm crashes through before Black's queenside attack lands.",
        eco="B96",
        opening_name="Sicilian Najdorf",
        must_know=True,
        learn_first=True,
    ),
    make_line(
        slug="sicilian-najdorf-english-attack",
        title="Najdorf: 6.Be3 English Attack",
        pgn="1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 6. Be3 e5 7. Nb3 Be6 8. f3 Be7 9. Qd2 O-O 10. O-O-O Nbd7 11. g4 b5 12. g5 Nh5 13. Nd5 Bxd5 14. exd5",
        difficulty="advanced",
        category="main-lines",
        study_mode="full",
        strategic_goal="The English Attack (6.Be3 + f3 + g4) is White's most popular modern weapon. Black counters with ...e5 to gain space and ...b5-b4 to attack the queenside.",
        hint_text="After 6.Be3, Black's best response is 6...e5 to fight for the center. The knight retreats to b3 and White prepares a kingside pawn storm with f3-g4.",
        punishment_idea="If Black plays passively with ...Nbd7 without ...e5, White's g4-g5 pawn storm comes with tempo and Black has no counterplay.",
        eco="B90",
        opening_name="Sicilian Najdorf, English Attack",
        must_know=True,
    ),
    make_line(
        slug="sicilian-najdorf-sozin",
        title="Najdorf: 6.Bc4 Sozin Attack",
        pgn="1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 6. Bc4 e6 7. Bb3 b5 8. O-O Be7 9. Qf3 Qc7 10. Qg3 O-O 11. Bh6 Ne8 12. f4 Bb7 13. f5 Nd7",
        difficulty="advanced",
        category="main-lines",
        study_mode="full",
        strategic_goal="The Sozin Attack aims the bishop at f7 and launches a direct kingside attack. Black must play precisely with ...b5 and ...Bb7 to create queenside counterplay.",
        hint_text="After 6.Bc4, Black plays 6...e6 to stop the bishop from targeting f7. The key is to play ...b5 quickly to gain queenside space before White's attack becomes too dangerous.",
        punishment_idea="If Black plays ...Nbd7 without ...b5, White plays Qg3 followed by Bh6 and f4-f5 with a devastating kingside attack.",
        eco="B87",
        opening_name="Sicilian Najdorf, Sozin Attack",
    ),
    make_line(
        slug="sicilian-najdorf-fischer-attack",
        title="Najdorf: 6.f4 Fischer Attack",
        pgn="1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 6. f4 e5 7. Nf3 Nbd7 8. a4 Be7 9. Bd3 O-O 10. O-O b6 11. Kh1 Bb7 12. Qe1 exf4 13. Bxf4 Ne5",
        difficulty="intermediate",
        category="main-lines",
        study_mode="full",
        strategic_goal="Fischer's 6.f4 grabs space and prepares e5. Black counters with 6...e5 to challenge the center. The resulting positions are dynamic with chances for both sides.",
        hint_text="After 6.f4, play 6...e5 immediately to challenge White's center. If White plays Nf3, the knight is misplaced and Black can develop comfortably.",
        punishment_idea="If Black plays 6...Nc6 instead of 6...e5, White plays 7.Nxc6 bxc6 8.e5 and Black's pawn structure is damaged with no compensation.",
        eco="B94",
        opening_name="Sicilian Najdorf",
    ),
    make_line(
        slug="sicilian-najdorf-fianchetto",
        title="Najdorf: 6.g3 Fianchetto",
        pgn="1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 6. g3 e5 7. Nde2 Be7 8. Bg2 O-O 9. O-O b5 10. a3 Bb7 11. Nd5 Nxd5 12. exd5 Nd7 13. c3 f5",
        difficulty="intermediate",
        category="main-lines",
        study_mode="full",
        strategic_goal="The fianchetto system is a quieter approach where White builds a solid structure. Black can play ...e5 and ...b5 for active counterplay on both wings.",
        hint_text="After 6.g3, Black plays 6...e5 to seize central space. The knight retreats to e2 and Black can develop naturally with ...Be7, ...O-O, ...b5.",
        punishment_idea="If Black plays passively without ...b5, White's Bg2 bishop becomes dominant and White can build a slow positional squeeze.",
        eco="B92",
        opening_name="Sicilian Najdorf",
    ),
    make_line(
        slug="sicilian-najdorf-poisoned-pawn",
        title="Trap: Poisoned Pawn Variation",
        pgn="1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 6. Bg5 e6 7. f4 Qb6 8. Qd2 Qxb2 9. Rb1 Qa3 10. f5 Nc6 11. fxe6 fxe6 12. Nxc6 bxc6 13. e5 dxe5 14. Bxf6 gxf6",
        difficulty="advanced",
        category="traps",
        study_mode="traps",
        strategic_goal="The Poisoned Pawn is one of chess's most famous gambits. Black grabs the b2 pawn but must navigate a minefield of tactical complications to survive.",
        hint_text="After 8...Qxb2, Black's queen is temporarily trapped but will escape. The key is to know the exact sequence: 9...Qa3 10.f5 Nc6 and Black can survive if they know the theory.",
        punishment_idea="If Black plays 10...Nc6 incorrectly or deviates from the main line, White's attack with f5-fxe6 is crushing and Black's king gets caught in the center.",
        eco="B97",
        opening_name="Sicilian Najdorf, Poisoned Pawn",
        must_know=True,
    ),
]

# ── Dragon Lines ──────────────────────────────────────────────────────────────

dragon_lines = [
    make_line(
        slug="sicilian-dragon-yugoslav-bc4",
        title="Dragon: Yugoslav Attack 9.Bc4",
        pgn="1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 g6 6. Be3 Bg7 7. f3 O-O 8. Qd2 Nc6 9. Bc4 Bd7 10. O-O-O Rc8 11. Bb3 Ne5 12. h4 h5 13. Bg5 Rc5 14. Kb1",
        difficulty="advanced",
        category="main-lines",
        study_mode="full",
        strategic_goal="The Yugoslav Attack is White's sharpest weapon against the Dragon. Black must launch queenside counterplay with ...Rc8 and ...Nc6-e5 before White's h-pawn storm crashes through.",
        hint_text="After 9.Bc4, Black plays ...Bd7 and ...Rc8 to prepare queenside counterplay. The key is to get the rook to c5 to support ...b5-b4 and attack White's king.",
        punishment_idea="If Black plays passively without ...Rc8 and ...Ne5, White's h4-h5 pawn storm arrives with full force and Black's kingside is demolished.",
        eco="B78",
        opening_name="Sicilian Dragon, Yugoslav Attack",
        must_know=True,
        learn_first=True,
    ),
    make_line(
        slug="sicilian-dragon-yugoslav-soltis",
        title="Dragon: Soltis Variation (9.Bc4 d5)",
        pgn="1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 g6 6. Be3 Bg7 7. f3 O-O 8. Qd2 Nc6 9. Bc4 Bd7 10. O-O-O Rc8 11. Bb3 Ne5 12. h4 h5 13. Bg5 Rc5 14. Bxf6 Bxf6 15. Nd5 Rxd5 16. exd5 Nd3+",
        difficulty="advanced",
        category="main-lines",
        study_mode="full",
        strategic_goal="The Soltis Variation is Black's most aggressive counter to the Yugoslav Attack. Black sacrifices the exchange with ...Rxd5 to expose White's king and launch a devastating attack.",
        hint_text="After 14.Bxf6 Bxf6 15.Nd5, Black plays the stunning 15...Rxd5! sacrificing the exchange. After 16.exd5 Nd3+, Black has tremendous compensation with the active knight on d3.",
        punishment_idea="If Black plays 15...Bxd5 instead of the exchange sacrifice, White recaptures with the bishop and maintains a solid position with the extra exchange.",
        eco="B79",
        opening_name="Sicilian Dragon, Yugoslav Attack, Soltis Variation",
        must_know=True,
    ),
    make_line(
        slug="sicilian-dragon-classical",
        title="Dragon: Classical System 6.Be2",
        pgn="1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 g6 6. Be2 Bg7 7. O-O O-O 8. Be3 Nc6 9. Nb3 Be6 10. f4 Na5 11. Nxa5 Qxa5 12. Bf3 Rfc8 13. Qd2 Bc4 14. Rfe1",
        difficulty="intermediate",
        category="main-lines",
        study_mode="full",
        strategic_goal="The Classical System is a positional approach where White avoids the sharp Yugoslav Attack. Black plays ...Nc6-a5 to exchange the knight and gain the bishop pair.",
        hint_text="After 6.Be2, Black develops normally with ...Bg7, ...O-O, ...Nc6. The key plan is ...Na5 to exchange White's knight and then ...Bc4 to pressure the queenside.",
        punishment_idea="If Black plays ...d5 prematurely without completing development, White plays e5 and Black's knight on f6 is attacked with no good square to go to.",
        eco="B70",
        opening_name="Sicilian Dragon, Classical Variation",
    ),
    make_line(
        slug="sicilian-dragon-levenfish",
        title="Dragon: Levenfish Attack 6.f4",
        pgn="1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 g6 6. f4 Bg7 7. e5 dxe5 8. fxe5 Nd5 9. Nxd5 Qxd5 10. Bb5+ Kf8 11. O-O Nc6 12. Nxc6 bxc6 13. Be3 Qd8 14. Qd4",
        difficulty="intermediate",
        category="main-lines",
        study_mode="full",
        strategic_goal="The Levenfish Attack with 6.f4 is an aggressive attempt to refute the Dragon. Black must play 6...Bg7 and be ready for 7.e5 with the counter-sacrifice ...dxe5.",
        hint_text="After 6.f4, Black plays 6...Bg7 and if White plays 7.e5, Black responds with 7...dxe5 8.fxe5 Nd5 to challenge the center. The resulting endgame is roughly equal.",
        punishment_idea="If Black plays 6...Nc6 instead of 6...Bg7, White plays 7.Nxc6 bxc6 8.e5 and Black's pawn structure is compromised.",
        eco="B75",
        opening_name="Sicilian Dragon, Levenfish Variation",
    ),
    make_line(
        slug="sicilian-dragon-chinese",
        title="Dragon: Chinese Dragon 6.Be3 Bg7 7.f3",
        pgn="1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 g6 6. Be3 Bg7 7. f3 Nc6 8. Qd2 O-O 9. O-O-O d5 10. exd5 Nxd5 11. Nxc6 bxc6 12. Bd4 e5 13. Bc5 Re8 14. Bc4",
        difficulty="advanced",
        category="main-lines",
        study_mode="full",
        strategic_goal="The Chinese Dragon (7...Nc6 instead of 7...O-O) is a dynamic variation where Black plays ...d5 immediately to challenge White's center before castling.",
        hint_text="After 7.f3, Black plays 7...Nc6 and then 9...d5 to immediately challenge the center. This is more aggressive than the standard Dragon and leads to sharp tactical play.",
        punishment_idea="If Black plays 9...Nxd4 instead of 9...d5, White recaptures and maintains a solid position with no weaknesses, making Black's counterplay much harder.",
        eco="B76",
        opening_name="Sicilian Dragon, Yugoslav Attack",
    ),
    make_line(
        slug="sicilian-dragon-trap-h-file",
        title="Trap: Dragon h-file Attack",
        pgn="1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 g6 6. Be3 Bg7 7. f3 O-O 8. Qd2 Nc6 9. O-O-O d5 10. exd5 Nxd5 11. Nxc6 bxc6 12. Nxd5 cxd5 13. Qxd5 Qc7 14. Qxa8 Bf5 15. Qxf8+ Kxf8",
        difficulty="advanced",
        category="traps",
        study_mode="traps",
        strategic_goal="This trap demonstrates what happens when White gets greedy and captures too many pawns in the Dragon. Black sacrifices material for a devastating attack on the exposed White king.",
        hint_text="After 13...Qc7, if White plays 14.Qxa8 grabbing the rook, Black plays 14...Bf5! threatening ...Bxc2 and ...Qa5 with a winning attack. White's queen is trapped on a8.",
        punishment_idea="If Black plays 14...Bxc2 immediately instead of 14...Bf5, White plays 15.Qxf8+ and escapes the trap. The move order matters — Bf5 first is the key.",
        eco="B76",
        opening_name="Sicilian Dragon",
        must_know=True,
    ),
]

# ── Merge into seed data ──────────────────────────────────────────────────────

def main():
    seed_path = "data/line-packs-seed.json"
    seed = json.load(open(seed_path))
    
    sic_pack = seed["linePacks"]["sicilian-defense"]
    existing_slugs = {line["slug"] for line in sic_pack["lines"]}
    
    added = 0
    errors = 0
    
    all_new_lines = najdorf_lines + dragon_lines
    
    for line in all_new_lines:
        if line["slug"] in existing_slugs:
            print(f"  SKIP (already exists): {line['slug']}")
            continue
        
        node_count = len(line.get("nodes", []))
        if node_count == 0:
            print(f"  ERROR (0 nodes): {line['slug']}")
            errors += 1
            continue
        
        sic_pack["lines"].append(line)
        existing_slugs.add(line["slug"])
        print(f"  ADDED: {line['slug']} ({node_count} nodes) — {line['title']}")
        added += 1
    
    # Update meta
    total_lines = sum(len(p["lines"]) for p in seed["linePacks"].values())
    seed["_meta"]["totalLines"] = total_lines
    seed["_meta"]["lastUpdated"] = "2026-05-03"
    
    # Write back
    with open(seed_path, "w") as f:
        json.dump(seed, f, indent=2)
    
    print(f"\nDone: {added} lines added, {errors} errors")
    print(f"Sicilian Defense now has {len(sic_pack['lines'])} lines")
    print(f"Total lines across all openings: {total_lines}")
    
    # Validate node counts
    total_nodes = sum(
        len(line.get("nodes", []))
        for pack in seed["linePacks"].values()
        for line in pack["lines"]
    )
    print(f"Total nodes: {total_nodes}")


if __name__ == "__main__":
    main()
