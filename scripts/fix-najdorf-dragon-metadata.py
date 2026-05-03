"""
fix-najdorf-dragon-metadata.py — Fixes the remaining metadata issues for
Najdorf/Dragon lines:
1. Add studyMode object (unlockOrder, learnFirst, drillReady, trapFocused)
2. Fix color to 'black' (Sicilian is a Black opening)
3. Fix sortOrder to be unique within the Sicilian pack
"""

import json

def make_study_mode(unlock_order: int, learn_first: bool, drill_ready: bool, trap_focused: bool) -> dict:
    return {
        "unlockOrder": unlock_order,
        "learnFirst": learn_first,
        "drillReady": drill_ready,
        "trapFocused": trap_focused,
    }

# Study mode assignments for each new line
STUDY_MODES = {
    "sicilian-najdorf-bg5-classical": make_study_mode(1, True, True, False),
    "sicilian-najdorf-english-attack": make_study_mode(2, True, True, False),
    "sicilian-najdorf-sozin": make_study_mode(3, False, True, False),
    "sicilian-najdorf-fischer-attack": make_study_mode(4, False, True, False),
    "sicilian-najdorf-fianchetto": make_study_mode(5, False, True, False),
    "sicilian-najdorf-poisoned-pawn": make_study_mode(6, False, True, True),
    "sicilian-dragon-yugoslav-bc4": make_study_mode(1, True, True, False),
    "sicilian-dragon-yugoslav-soltis": make_study_mode(2, True, True, False),
    "sicilian-dragon-classical": make_study_mode(3, False, True, False),
    "sicilian-dragon-chinese": make_study_mode(4, False, True, False),
    "sicilian-dragon-trap-h-file": make_study_mode(5, False, True, True),
    "sicilian-dragon-levenfish": make_study_mode(6, False, True, False),
}

def main():
    seed_path = "data/line-packs-seed.json"
    seed = json.load(open(seed_path))
    
    sic_pack = seed["linePacks"]["sicilian-defense"]
    
    # Get current max sortOrder from existing (non-new) lines
    existing_slugs = [l["slug"] for l in sic_pack["lines"] if l["slug"] not in STUDY_MODES]
    existing_sort_orders = [l.get("sortOrder", 0) for l in sic_pack["lines"] if l["slug"] in existing_slugs]
    max_existing_sort = max(existing_sort_orders) if existing_sort_orders else 0
    
    print(f"Max existing sortOrder: {max_existing_sort}")
    
    # Assign new unique sortOrders starting after existing ones
    new_sort_start = max_existing_sort + 1
    new_slug_list = list(STUDY_MODES.keys())
    
    fixed = 0
    for i, line in enumerate(sic_pack["lines"]):
        slug = line["slug"]
        if slug not in STUDY_MODES:
            continue
        
        # Fix color to 'black' (Sicilian is a Black opening)
        sic_pack["lines"][i]["color"] = "black"
        
        # Add studyMode
        sic_pack["lines"][i]["studyMode"] = STUDY_MODES[slug]
        
        # Fix sortOrder to be unique
        new_sort = new_sort_start + new_slug_list.index(slug)
        sic_pack["lines"][i]["sortOrder"] = new_sort
        
        print(f"  Fixed: {slug} (color=black, sortOrder={new_sort}, studyMode.unlockOrder={STUDY_MODES[slug]['unlockOrder']})")
        fixed += 1
    
    # Write back
    with open(seed_path, "w") as f:
        json.dump(seed, f, indent=2)
    
    print(f"\nDone: {fixed} lines fixed")
    
    # Verify sort orders are unique
    all_sort_orders = [l.get("sortOrder", 0) for l in sic_pack["lines"]]
    if len(set(all_sort_orders)) == len(all_sort_orders):
        print("✅ All sortOrders are unique")
    else:
        dupes = [s for s in all_sort_orders if all_sort_orders.count(s) > 1]
        print(f"❌ Duplicate sortOrders: {set(dupes)}")


if __name__ == "__main__":
    main()
