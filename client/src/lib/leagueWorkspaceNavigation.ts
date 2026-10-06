import { useCallback, useEffect, useState } from "react";
import type { AuthUser } from "@/hooks/useAuth";
import { authFetch } from "./apiFetch";

const GUEST_LEAGUE_FALLBACK = "/league-demo";
const MEMBER_LEAGUE_FALLBACK = "/league";

interface LeagueWorkspaceResponse {
  clubId?: string | null;
}

export function getClubLeagueWorkspacePath(clubId: string): string {
  return `/clubs/${encodeURIComponent(clubId)}/home?tab=events&view=leagues`;
}

function getFallbackLeagueDestination(user: AuthUser | null | undefined): string {
  return !user || user.isGuest ? GUEST_LEAGUE_FALLBACK : MEMBER_LEAGUE_FALLBACK;
}

/**
 * Resolves the most relevant Club Events → Leagues workspace for the signed-in
 * member. The server scopes the decision to owned/joined clubs and prioritizes
 * active leagues before drafts and completed history.
 */
export async function resolveLeagueWorkspaceDestination(
  user: AuthUser | null | undefined,
): Promise<string> {
  const fallback = getFallbackLeagueDestination(user);
  if (!user || user.isGuest) return fallback;

  try {
    const response = await authFetch("/api/leagues/workspace", { credentials: "include" });
    if (!response.ok) return fallback;
    const workspace = await response.json() as LeagueWorkspaceResponse;
    return workspace.clubId ? getClubLeagueWorkspacePath(workspace.clubId) : fallback;
  } catch {
    return fallback;
  }
}

export function useLeagueWorkspaceNavigation(user: AuthUser | null | undefined) {
  const fallback = getFallbackLeagueDestination(user);
  const [leagueWorkspaceUrl, setLeagueWorkspaceUrl] = useState(fallback);

  const refreshLeagueWorkspaceUrl = useCallback(async () => {
    const destination = await resolveLeagueWorkspaceDestination(user);
    setLeagueWorkspaceUrl(destination);
    return destination;
  }, [user]);

  useEffect(() => {
    setLeagueWorkspaceUrl(fallback);
    void refreshLeagueWorkspaceUrl();
  }, [fallback, refreshLeagueWorkspaceUrl]);

  return { leagueWorkspaceUrl, refreshLeagueWorkspaceUrl };
}
