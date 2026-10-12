import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthUser } from "@/hooks/useAuth";

const { authFetchMock } = vi.hoisted(() => ({ authFetchMock: vi.fn() }));

vi.mock("./apiFetch", () => ({
  authFetch: authFetchMock,
}));

import { resolveLeagueWorkspaceDestination } from "./leagueWorkspaceNavigation";

const signedInUser = { id: "member_1", isGuest: false } as AuthUser;

function workspaceResponse(payload: object, ok = true): Response {
  return {
    ok,
    json: vi.fn().mockResolvedValue(payload),
  } as unknown as Response;
}

describe("League workspace navigation resolver", () => {
  beforeEach(() => {
    authFetchMock.mockReset();
  });

  it("sends a signed-in member directly to their preferred League dashboard", async () => {
    authFetchMock.mockResolvedValue(workspaceResponse({ clubId: "club_1", leagueId: "league_active" }));

    await expect(resolveLeagueWorkspaceDestination(signedInUser)).resolves.toBe("/league/league_active");
    expect(authFetchMock).toHaveBeenCalledWith("/api/leagues/workspace", { credentials: "include" });
  });

  it("uses the Club League listing only when the account has no League dashboard to open", async () => {
    authFetchMock.mockResolvedValue(workspaceResponse({ clubId: "club_1", leagueId: null }));

    await expect(resolveLeagueWorkspaceDestination(signedInUser)).resolves.toBe("/clubs/club_1/home?tab=leagues");
  });

  it("preserves public and no-workspace fallbacks", async () => {
    await expect(resolveLeagueWorkspaceDestination(null)).resolves.toBe("/league-demo");

    authFetchMock.mockResolvedValue(workspaceResponse({ clubId: null, leagueId: null }));
    await expect(resolveLeagueWorkspaceDestination(signedInUser)).resolves.toBe("/league");
  });
});
