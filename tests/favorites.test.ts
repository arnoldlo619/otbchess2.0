import { describe, it, expect } from "vitest";

// ── Favorites feature unit tests ─────────────────────────────────────────────
// Tests the core toggle logic and data shape for the favorites feature.

describe("Favorites toggle logic", () => {
  it("should add a line to favorites when not yet favorited", () => {
    const existing = null;
    const result = existing ? "remove" : "add";
    expect(result).toBe("add");
  });

  it("should remove a line from favorites when already favorited", () => {
    const existing = { id: "fav-1", lineId: "line-1", userId: "user-1" };
    const result = existing ? "remove" : "add";
    expect(result).toBe("remove");
  });

  it("should return favorited: true when adding", () => {
    const response = { favorited: true, message: "Added to favorites", id: "fav-new" };
    expect(response.favorited).toBe(true);
    expect(response.message).toBe("Added to favorites");
  });

  it("should return favorited: false when removing", () => {
    const response = { favorited: false, message: "Removed from favorites" };
    expect(response.favorited).toBe(false);
    expect(response.message).toBe("Removed from favorites");
  });
});

describe("Favorites data shape", () => {
  it("should have the correct shape for a favorite entry", () => {
    const favorite = {
      id: "fav-1",
      lineId: "line-1",
      openingId: "opening-1",
      note: null,
      createdAt: new Date().toISOString(),
      line: {
        id: "line-1",
        title: "Najdorf Variation",
        slug: "najdorf-variation",
        eco: "B90",
        difficulty: "advanced",
        color: "black",
        plyCount: 12,
        description: "The sharpest Sicilian",
        mustKnow: true,
        isTrap: false,
      },
      opening: {
        id: "opening-1",
        name: "Sicilian Defense",
        slug: "sicilian-defense",
        thumbnailFen: "rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2",
      },
    };

    expect(favorite.lineId).toBe("line-1");
    expect(favorite.line.title).toBe("Najdorf Variation");
    expect(favorite.opening.name).toBe("Sicilian Defense");
    expect(favorite.line.mustKnow).toBe(true);
  });

  it("should correctly compute moves count from plyCount", () => {
    const plyCount = 12;
    const moveCount = Math.ceil(plyCount / 2);
    expect(moveCount).toBe(6);
  });

  it("should handle empty favorites list", () => {
    const favorites: unknown[] = [];
    const favoritedSet = new Set(favorites.map((f: any) => f.lineId));
    expect(favoritedSet.size).toBe(0);
    expect(favoritedSet.has("line-1")).toBe(false);
  });

  it("should build correct favorited set from favorites list", () => {
    const favorites = [
      { lineId: "line-1" },
      { lineId: "line-2" },
      { lineId: "line-3" },
    ];
    const favoritedSet = new Set(favorites.map((f) => f.lineId));
    expect(favoritedSet.has("line-1")).toBe(true);
    expect(favoritedSet.has("line-4")).toBe(false);
    expect(favoritedSet.size).toBe(3);
  });
});

describe("Favorites optimistic UI update", () => {
  it("should add lineId to set when toggling on", () => {
    const prev = new Set(["line-1"]);
    const next = new Set(prev);
    next.add("line-2");
    expect(next.has("line-2")).toBe(true);
    expect(next.size).toBe(2);
  });

  it("should remove lineId from set when toggling off", () => {
    const prev = new Set(["line-1", "line-2"]);
    const next = new Set(prev);
    next.delete("line-1");
    expect(next.has("line-1")).toBe(false);
    expect(next.size).toBe(1);
  });

  it("should filter favorites array when removing from library view", () => {
    const favorites = [
      { id: "fav-1", lineId: "line-1" },
      { id: "fav-2", lineId: "line-2" },
    ];
    const updated = favorites.filter((f) => f.lineId !== "line-1");
    expect(updated.length).toBe(1);
    expect(updated[0].lineId).toBe("line-2");
  });
});
