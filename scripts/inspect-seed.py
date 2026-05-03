import json

with open("data/openings-seed.json") as f:
    data = json.load(f)

for o in data.get("openings", []):
    print(f"\nOpening: {o['name']} ({o['slug']})")
    for l in o.get("lines", []):
        print(f"  Line: {l['title']} ({l['slug']})")
        print(f"    PGN: {l.get('pgn','')[:80]}")
        print(f"    Nodes: {len(l.get('nodes',[]))}")
        print(f"    strategicSummary: {'YES' if l.get('strategicSummary') else 'NO'}")
        print(f"    hintText: {'YES' if l.get('hintText') else 'NO'}")
        print(f"    punishmentIdea: {'YES' if l.get('punishmentIdea') else 'NO'}")
        nodes = l.get("nodes", [])
        if nodes:
            n = nodes[0]
            print(f"    First node keys: {list(n.keys())}")
            print(f"    First node: ply={n.get('ply')}, moveSan={n.get('moveSan')}, fen={n.get('fen','')[:40]}...")
