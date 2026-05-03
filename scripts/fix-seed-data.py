"""Fix line-packs-seed.json:
1. Update _meta to reflect 16 packs / 158 lines
2. Add studyMode to all lines that don't have it
3. Fix the duplicate title 'Advance: 3.e5 Main Line'
4. Add missing fields (moveSequenceSan, moveSequenceUci, chapterName, branchLabel) to new lines
"""
import json
import chess

data = json.load(open("data/line-packs-seed.json"))

# 1. Fix meta
data["_meta"]["openingCount"] = len(data["linePacks"])
data["_meta"]["totalLines"] = sum(p["lineCount"] for p in data["linePacks"].values())
data["_meta"]["description"] = "Complete line packs for ChessOTB.club openings database. Contains practical, club-friendly lines for 16 openings."

# 2. Add studyMode and missing fields to lines that don't have them
for pack_slug, pack in data["linePacks"].items():
    for i, line in enumerate(pack["lines"]):
        # Add studyMode if missing
        if "studyMode" not in line:
            is_trap = line.get("isTrap", False)
            is_must_know = line.get("isMustKnow", False)
            learn_first = is_must_know and i < 3
            line["studyMode"] = {
                "unlockOrder": min(i + 1, 10),
                "learnFirst": learn_first,
                "drillReady": True,
                "trapFocused": is_trap
            }

        # Add chapterName if missing
        if "chapterName" not in line:
            lt = line.get("lineType", "main")
            if lt == "trap":
                line["chapterName"] = "Traps & Punishments"
            elif lt == "gambit":
                line["chapterName"] = "Gambit Lines"
            elif lt == "sideline":
                line["chapterName"] = "Sidelines"
            else:
                line["chapterName"] = "Main Lines"

        # Add branchLabel if missing
        if "branchLabel" not in line:
            line["branchLabel"] = line.get("lineType", "main")

        # Generate moveSequenceSan and moveSequenceUci from PGN if missing
        if "moveSequenceSan" not in line or "moveSequenceUci" not in line:
            pgn = line.get("pgn", "")
            board = chess.Board()
            san_moves = []
            uci_moves = []
            # Parse PGN moves
            import re
            moves_str = re.sub(r'\d+\.+\s*', '', pgn).strip()
            tokens = moves_str.split()
            for token in tokens:
                token = token.strip()
                if not token or token in ('1-0', '0-1', '1/2-1/2', '*'):
                    continue
                try:
                    move = board.parse_san(token)
                    san_moves.append(token)
                    uci_moves.append(move.uci())
                    board.push(move)
                except Exception:
                    break
            line["moveSequenceSan"] = " ".join(san_moves)
            line["moveSequenceUci"] = " ".join(uci_moves)
            # Update plyCount to match
            line["plyCount"] = len(san_moves)

        # Ensure finalFen is set
        if not line.get("finalFen"):
            pgn = line.get("pgn", "")
            board = chess.Board()
            import re
            moves_str = re.sub(r'\d+\.+\s*', '', pgn).strip()
            tokens = moves_str.split()
            for token in tokens:
                token = token.strip()
                if not token or token in ('1-0', '0-1', '1/2-1/2', '*'):
                    continue
                try:
                    move = board.parse_san(token)
                    board.push(move)
                except Exception:
                    break
            line["finalFen"] = board.fen()

# 3. Fix duplicate title
# Find which packs have "Advance: 3.e5 Main Line"
for pack_slug, pack in data["linePacks"].items():
    for line in pack["lines"]:
        if line["title"] == "Advance: 3.e5 Main Line" and pack_slug == "caro-kann-defense":
            line["title"] = "Caro-Kann Advance: 3.e5 Main Line"
            break

# 4. Ensure lineType values are valid
allowed_types = {"main", "sideline", "gambit", "surprise", "trap"}
for pack_slug, pack in data["linePacks"].items():
    for line in pack["lines"]:
        if line.get("lineType") not in allowed_types:
            line["lineType"] = "main"

# Verify
total = sum(p["lineCount"] for p in data["linePacks"].values())
all_titles = []
for pack in data["linePacks"].values():
    for line in pack["lines"]:
        all_titles.append(line["title"])
dupes = [t for t in all_titles if all_titles.count(t) > 1]
print(f"Packs: {len(data['linePacks'])}")
print(f"Total lines: {total}")
print(f"Duplicate titles: {set(dupes) if dupes else 'None'}")

# Check studyMode coverage
no_study = sum(1 for p in data["linePacks"].values() for l in p["lines"] if "studyMode" not in l)
print(f"Lines without studyMode: {no_study}")

# Check missing fields
missing_fields = 0
for pack in data["linePacks"].values():
    for line in pack["lines"]:
        for f in ["moveSequenceSan", "moveSequenceUci", "chapterName", "branchLabel"]:
            if f not in line:
                missing_fields += 1
print(f"Missing required fields: {missing_fields}")

# Save
with open("data/line-packs-seed.json", "w") as f:
    json.dump(data, f, indent=2)
print("✅ Saved updated line-packs-seed.json")
