import { describe, expect, it } from "vitest";

describe("Lichess server token", () => {
  it("authenticates to the lightweight official account endpoint", async () => {
    const token = process.env.LICHESS_API_TOKEN?.trim();
    expect(token, "LICHESS_API_TOKEN must be configured server-side").toBeTruthy();
    const response = await fetch("https://lichess.org/api/account", {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "User-Agent": "ChessOTB.club token validation (support@chessotb.club)" },
      signal: AbortSignal.timeout(10_000),
    });
    expect(response.status).toBe(200);
  }, 15_000);
});
