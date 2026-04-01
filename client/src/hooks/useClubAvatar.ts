/**
 * useClubAvatar
 *
 * Fetches the avatarUrl for a given club from /api/clubs/:id.
 * Returns undefined while loading and null if the club has no avatar.
 * Gracefully handles network errors and missing club IDs.
 */

import { useState, useEffect } from "react";

interface ClubAvatarState {
  /** undefined = loading, null = no avatar / error, string = URL */
  avatarUrl: string | null | undefined;
}

export function useClubAvatar(clubId: string | null | undefined): ClubAvatarState {
  const [avatarUrl, setAvatarUrl] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (!clubId) {
      setAvatarUrl(null);
      return;
    }

    let cancelled = false;

    async function fetchAvatar() {
      try {
        const res = await fetch(`/api/clubs/${clubId}`, { credentials: "include" });
        if (!res.ok) {
          if (!cancelled) setAvatarUrl(null);
          return;
        }
        const data = await res.json() as { avatarUrl?: string | null };
        if (!cancelled) setAvatarUrl(data.avatarUrl ?? null);
      } catch {
        if (!cancelled) setAvatarUrl(null);
      }
    }

    fetchAvatar();
    return () => { cancelled = true; };
  }, [clubId]);

  return { avatarUrl };
}
