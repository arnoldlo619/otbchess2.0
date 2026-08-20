import { describe, expect, it } from "vitest";
import { formatFriendlyOpeningName } from "../lib/openingNames";

describe("formatFriendlyOpeningName", () => {
  it("uses familiar names for common first moves", () => {
    expect(formatFriendlyOpeningName(undefined, "B00", "e4")).toBe("King's Pawn Opening");
    expect(formatFriendlyOpeningName(undefined, "D00", "d4")).toBe("Queen's Pawn Opening");
    expect(formatFriendlyOpeningName(undefined, "A20", "c4")).toBe("English Opening");
    expect(formatFriendlyOpeningName(undefined, "A07", "Nf3")).toBe("Reti Opening");
  });

  it("removes raw setup and move-list labels in favor of opening families", () => {
    expect(formatFriendlyOpeningName("Main Setup: d4-Nc3-Bf4", "D00", "d4")).toBe("Queen's Pawn Opening");
    expect(formatFriendlyOpeningName("Gambit Accepted: 3...exf4", "C33", "e4")).toBe("King's Gambit Accepted");
  });

  it("keeps established opening families recognizable to casual players", () => {
    expect(formatFriendlyOpeningName("English: Four Knights", "A29", "c4")).toBe("English Opening");
    expect(formatFriendlyOpeningName("Réti: King's Indian Attack", "A07", "Nf3")).toBe("Reti Opening");
    expect(formatFriendlyOpeningName("Catalan: Open Variation", "E06", "d4")).toBe("Catalan Opening");
    expect(formatFriendlyOpeningName("Scandinavian: Mieses-Kotrc", "B01", "e4")).toBe("Scandinavian Defense");
  });
});
