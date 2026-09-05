// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchAvatar } from "../client/src/hooks/useChessAvatar.js";

describe("Chess.com avatar lookup", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    sessionStorage.clear();
  });

  it("reads the real avatar field returned at the top level by the Chess.com proxy", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ avatar: "https://images.chess.com/profile.png" }), { status: 200 })));
    await expect(fetchAvatar("profile-contract-test")).resolves.toBe("https://images.chess.com/profile.png");
  });
});
