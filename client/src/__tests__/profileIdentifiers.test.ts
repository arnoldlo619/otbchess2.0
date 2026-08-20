import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { validateProfileIdentifiers } from "../pages/Profile";

const profileSource = readFileSync(resolve(process.cwd(), "client/src/pages/Profile.tsx"), "utf8");

describe("Profile linked-account identifiers", () => {
  it("accepts conservative chess-platform handles and a numeric FIDE ID", () => {
    expect(validateProfileIdentifiers({
      chesscomUsername: "Chess_OTB-Club",
      lichessUsername: "otbchess",
      fideId: "1503014",
    })).toBeNull();
  });

  it("rejects whitespace and URL-shaped platform handles", () => {
    expect(validateProfileIdentifiers({ chesscomUsername: "chess player", lichessUsername: "", fideId: "" }))
      .toContain("Chess.com usernames");
    expect(validateProfileIdentifiers({ chesscomUsername: "", lichessUsername: "https://lichess.org/user", fideId: "" }))
      .toContain("Lichess usernames");
  });

  it("requires a numeric FIDE identifier within a practical length range", () => {
    expect(validateProfileIdentifiers({ chesscomUsername: "", lichessUsername: "", fideId: "FIDE-123" }))
      .toBe("FIDE ID must contain 5 to 10 digits.");
    expect(validateProfileIdentifiers({ chesscomUsername: "", lichessUsername: "", fideId: "1234" }))
      .toBe("FIDE ID must contain 5 to 10 digits.");
  });

  it("shows linked-account management without implying unsupported external verification", () => {
    expect(profileSource).toContain("Linked chess accounts");
    expect(profileSource).toContain("Clear a field and save to remove that connection.");
    expect(profileSource).toContain("linkedAccountCount");
    expect(profileSource).toContain(">Connected</span>");
    expect(profileSource).toContain("Manage");
  });
});
