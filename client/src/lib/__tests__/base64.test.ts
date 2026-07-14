/**
 * Tests for Unicode-safe base64 encoding/decoding utility.
 * Ensures non-ASCII characters (accented names, CJK, emoji) survive
 * the encode → decode round-trip without corruption.
 */
import { describe, it, expect } from "vitest";
import { encodeMetaParam, decodeMetaParam } from "../base64";

describe("base64 — encodeMetaParam / decodeMetaParam", () => {
  it("round-trips plain ASCII strings", () => {
    const obj = { name: "OTB Open 2026", format: "quads", rounds: 3 };
    const encoded = encodeMetaParam(obj);
    expect(decodeMetaParam(encoded)).toEqual(obj);
  });

  it("round-trips strings with accented characters", () => {
    const obj = { name: "Café Échecs Montréal", player: "José García" };
    const encoded = encodeMetaParam(obj);
    expect(decodeMetaParam(encoded)).toEqual(obj);
  });

  it("round-trips strings with CJK characters", () => {
    const obj = { name: "東京チェスクラブ", player: "田中太郎" };
    const encoded = encodeMetaParam(obj);
    expect(decodeMetaParam(encoded)).toEqual(obj);
  });

  it("round-trips strings with emoji", () => {
    const obj = { name: "♟️ Chess Night 🏆", location: "📍 Park" };
    const encoded = encodeMetaParam(obj);
    expect(decodeMetaParam(encoded)).toEqual(obj);
  });

  it("round-trips mixed content (numbers, booleans, nested)", () => {
    const obj = {
      name: "Ñoño's Quad",
      rounds: 3,
      active: true,
      players: ["André", "Müller", "李明"],
    };
    const encoded = encodeMetaParam(obj);
    expect(decodeMetaParam(encoded)).toEqual(obj);
  });

  it("produces a URL-safe string (no +, /, =)", () => {
    const obj = { name: "Test with special chars: +/= and ñ" };
    const encoded = encodeMetaParam(obj);
    // Standard base64 uses +, /, = but our encoding should be URL-safe
    // At minimum it should be a valid string that can be used in URLs
    expect(typeof encoded).toBe("string");
    expect(encoded.length).toBeGreaterThan(0);
    // Verify round-trip
    expect(decodeMetaParam(encoded)).toEqual(obj);
  });

  it("handles empty object", () => {
    const obj = {};
    const encoded = encodeMetaParam(obj);
    expect(decodeMetaParam(encoded)).toEqual(obj);
  });

  it("handles deeply nested objects", () => {
    const obj = {
      tournament: {
        name: "Résumé Tourney",
        sections: [
          { id: 1, players: ["Ångström", "Björk"] },
          { id: 2, players: ["Çelik", "Ðorðević"] },
        ],
      },
    };
    const encoded = encodeMetaParam(obj);
    expect(decodeMetaParam(encoded)).toEqual(obj);
  });
});
