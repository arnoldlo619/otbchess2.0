import { beforeEach, describe, expect, it } from "vitest";
import {
  addRecentlyScouted,
  clearRecentlyScouted,
  getRecentlyScouted,
  MAX_ENTRIES,
  removeRecentlyScouted,
  type RecentScoutEntry,
} from "../lib/recentlyScouted";

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(globalThis, "localStorage", { value: localStorageMock, writable: true });
beforeEach(() => localStorageMock.clear());

const makeEntry = (
  username: string,
  provider: "chesscom" | "lichess" = "chesscom",
  formats: RecentScoutEntry["formats"] = ["rapid", "blitz", "bullet"],
): Omit<RecentScoutEntry, "scoutedAt"> => ({
  username, provider, formats, mode: "standard", maxGames: 30, schemaVersion: "launch-3", explorerColor: "white",
});

describe("recent Matchup Prep reports", () => {
  it("persists the complete immutable report identity", () => {
    addRecentlyScouted(makeEntry("hikaru"));
    expect(getRecentlyScouted()).toMatchObject([{
      username: "hikaru", provider: "chesscom", formats: ["blitz", "bullet", "rapid"], mode: "standard", maxGames: 30, schemaVersion: "launch-3",
    }]);
  });

  it("migrates a provider-known legacy entry without restoring global color semantics", () => {
    localStorage.setItem("otb_recently_scouted_v3", JSON.stringify([{ username: "Hikaru", provider: "chesscom", myColor: "black", tcFilter: "all", scoutedAt: "2026-09-07T00:00:00.000Z" }]));
    expect(getRecentlyScouted()).toMatchObject([{
      username: "Hikaru", provider: "chesscom", formats: ["rapid", "blitz", "bullet"], explorerColor: "black", mode: "standard", maxGames: 30,
    }]);
  });

  it("keeps same-named accounts and distinct format sets separate", () => {
    addRecentlyScouted(makeEntry("hikaru", "chesscom", ["rapid"]));
    addRecentlyScouted(makeEntry("hikaru", "chesscom", ["blitz"]));
    addRecentlyScouted(makeEntry("hikaru", "lichess", ["rapid"]));
    expect(getRecentlyScouted()).toHaveLength(3);
  });

  it("deduplicates only the same immutable identity and keeps the newest entry first", () => {
    addRecentlyScouted(makeEntry("Hikaru", "chesscom", ["rapid"]));
    addRecentlyScouted(makeEntry("magnus", "lichess", ["blitz"]));
    const updated = addRecentlyScouted(makeEntry("hikaru", "chesscom", ["rapid"]));
    expect(updated).toHaveLength(2);
    expect(updated[0].username).toBe("hikaru");
  });

  it("removes only the matching immutable identity", () => {
    const rapid = makeEntry("hikaru", "chesscom", ["rapid"]);
    addRecentlyScouted(rapid);
    addRecentlyScouted(makeEntry("hikaru", "chesscom", ["blitz"]));
    const updated = removeRecentlyScouted(rapid);
    expect(updated).toHaveLength(1);
    expect(updated[0].formats).toEqual(["blitz"]);
  });

  it("caps history at five entries and clears safely", () => {
    for (let index = 0; index < MAX_ENTRIES + 3; index += 1) addRecentlyScouted(makeEntry(`player${index}`));
    expect(getRecentlyScouted()).toHaveLength(MAX_ENTRIES);
    clearRecentlyScouted();
    expect(getRecentlyScouted()).toEqual([]);
  });
});
