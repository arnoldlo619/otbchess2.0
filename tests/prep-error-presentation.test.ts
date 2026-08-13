import { describe, expect, it } from "vitest";
import { describePrepError } from "../client/src/lib/prepErrorPresentation";

describe("describePrepError", () => {
  it("makes a provider 404 explicit and avoids irrelevant retry controls", () => {
    const state = describePrepError({
      code: "not_found",
      username: "Pircunset",
      provider: "chesscom",
    });

    expect(state.title).toBe("We couldn’t find Pircunset on Chess.com.");
    expect(state.supportsRetry).toBe(false);
    expect(state.supportsFilterControls).toBe(false);
    expect(state.detail).toContain("exact Chess.com username");
  });

  it("keeps an upstream outage retryable and provider-specific", () => {
    const state = describePrepError({
      code: "upstream_unavailable",
      username: "example",
      provider: "lichess",
    });

    expect(state.supportsRetry).toBe(true);
    expect(state.title).toContain("Lichess");
  });
});
