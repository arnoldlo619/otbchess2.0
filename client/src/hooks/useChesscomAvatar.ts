/**
 * useChesscomAvatar
 *
 * Given a PlayerProfile, returns the best available avatar URL:
 *  1. player.avatarUrl (already stored in DB)
 *  2. Fetched from the server chess.com proxy (/api/chess/player/:username)
 *  3. null (render initials fallback)
 *
 * Results are cached in a module-level Map so repeated renders don't
 * re-fetch the same username.
 */

import { useState, useEffect } from "react";

interface PlayerProfile {
  id: string;
  displayName: string;
  chesscomUsername: string | null;
  avatarUrl: string | null;
  chesscomElo: number | null;
}

// Module-level cache: username → avatar URL (or "" if not found)
const avatarCache = new Map<string, string>();

export function useChesscomAvatar(player: PlayerProfile | null): string | null {
  const [fetchedUrl, setFetchedUrl] = useState<string | null>(null);

  useEffect(() => {
    // If the player already has an avatarUrl stored, use it directly
    if (!player) {
      setFetchedUrl(null);
      return;
    }
    if (player.avatarUrl) {
      setFetchedUrl(player.avatarUrl);
      return;
    }
    // If no chess.com username, nothing to fetch
    if (!player.chesscomUsername) {
      setFetchedUrl(null);
      return;
    }

    const username = player.chesscomUsername.toLowerCase().trim();

    // Return cached result immediately
    if (avatarCache.has(username)) {
      setFetchedUrl(avatarCache.get(username) || null);
      return;
    }

    let cancelled = false;

    async function fetchAvatar() {
      try {
        // Use the correct server proxy endpoint: /api/chess/player/:username
        const res = await fetch(`/api/chess/player/${encodeURIComponent(username)}`);
        if (!res.ok) {
          avatarCache.set(username, "");
          return;
        }
        const data = await res.json() as { profile?: { avatar?: string } };
        const url = data?.profile?.avatar ?? "";
        avatarCache.set(username, url);
        if (!cancelled) {
          setFetchedUrl(url || null);
        }
      } catch {
        avatarCache.set(username, "");
      }
    }

    fetchAvatar();
    return () => { cancelled = true; };
  }, [player?.id, player?.avatarUrl, player?.chesscomUsername]);

  if (!player) return null;
  return fetchedUrl;
}
