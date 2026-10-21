// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

import { fetchAvatar, useChessAvatars } from "../client/src/hooks/useChessAvatar.js";

describe("Chess.com avatar lookup", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    sessionStorage.clear();
  });

  it("reads the real avatar field returned at the top level by the Chess.com proxy", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ avatar: "https://images.chess.com/profile.png" }), { status: 200 })));
    await expect(fetchAvatar("profile-contract-test")).resolves.toBe("https://images.chess.com/profile.png");
  });

  it("hydrates a cached profile photo when a League roster arrives after mount", async () => {
    const username = "late-league-roster-avatar";
    const avatarUrl = "https://images.chess.com/cached-league-avatar.png";
    sessionStorage.setItem(`otb_avatar_${username}`, avatarUrl);
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const { result, rerender } = renderHook(
      ({ usernames }) => useChessAvatars(usernames),
      { initialProps: { usernames: [] as string[] } },
    );

    expect(result.current.allLoaded).toBe(true);
    expect(result.current.avatars.size).toBe(0);

    rerender({ usernames: [username] });

    await waitFor(() => {
      expect(result.current.avatars.get(username)).toBe(avatarUrl);
      expect(result.current.allLoaded).toBe(true);
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
