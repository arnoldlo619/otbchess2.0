import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearDraft, hasDraft, readDraft, sanitizeDraftUrl, writeDraft } from "./draftStorage";

const key = "test-draft";
const values = new Map<string, string>();
const storage: Storage = {
  get length() { return values.size; },
  clear: () => values.clear(),
  getItem: (storageKey) => values.get(storageKey) ?? null,
  key: (index) => Array.from(values.keys())[index] ?? null,
  removeItem: (storageKey) => { values.delete(storageKey); },
  setItem: (storageKey, value) => { values.set(storageKey, value); },
};

describe("draftStorage", () => {
  beforeEach(() => {
    storage.clear();
    vi.restoreAllMocks();
  });

  it("round-trips versioned draft data and clears it explicitly", () => {
    expect(writeDraft(key, { name: "Friday Knights", step: 2 }, storage)).toBe(true);
    expect(readDraft<{ name: string; step: number }>(key, storage)).toEqual({ name: "Friday Knights", step: 2 });
    expect(hasDraft(key, storage)).toBe(true);
    clearDraft(key, storage);
    expect(readDraft(key, storage)).toBeNull();
  });

  it("removes malformed and expired draft envelopes", () => {
    storage.setItem(key, "not-json");
    expect(readDraft(key, storage)).toBeNull();
    expect(storage.getItem(key)).toBeNull();

    vi.spyOn(Date, "now").mockReturnValue(10_000);
    storage.setItem(key, JSON.stringify({ version: 1, updatedAt: 1, data: { name: "Old" } }));
    expect(readDraft(key, storage, 100)).toBeNull();
  });

  it("omits transient data and blob URLs while retaining remote URLs", () => {
    expect(sanitizeDraftUrl("data:image/png;base64,large-payload")).toBeNull();
    expect(sanitizeDraftUrl(" blob:https://chessotb.club/temporary-upload")).toBeNull();
    expect(sanitizeDraftUrl("https://cdn.chessotb.club/club/avatar.webp")).toBe("https://cdn.chessotb.club/club/avatar.webp");
    expect(sanitizeDraftUrl(null)).toBeNull();
  });
});
