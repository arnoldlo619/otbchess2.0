import { nanoid } from "nanoid";
import { authFetch } from "@/lib/apiFetch";
import type { Player } from "@/lib/tournamentData";
import {
  chessComPlayerEndpoint,
  extractChessComRatings,
  normalizeChessComPlayerPayload,
  resolveChessComRating,
} from "@/lib/chessComPlayerPayload";

export interface ChessComLookupResult {
  name: string;
  username: string;
  elo: number;
  rapid?: number;
  blitz?: number;
  bullet?: number;
  daily?: number;
  rapidElo?: number;
  blitzElo?: number;
  avatar?: string;
  country?: string;
  title?: string;
}

/** Retry transient player-profile responses without duplicating lookup behavior across entry points. */
export async function fetchPlayerLookupWithRetry(
  url: string,
  fetchFn: (url: string) => Promise<Response> = fetch,
  maxRetries = 3,
): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const res = await fetchFn(url);
    if (res.status === 429 || res.status === 503) {
      const delay = Math.min(1000 * Math.pow(2, attempt), 8000);
      await new Promise((resolve) => setTimeout(resolve, delay));
      continue;
    }
    return res;
  }
  return fetchFn(url);
}

/** Resolve a public Chess.com profile through the server proxy used by the Director Add Player workflow. */
export async function lookupChessCom(username: string): Promise<ChessComLookupResult> {
  const res = await fetchPlayerLookupWithRetry(chessComPlayerEndpoint(username), authFetch);
  if (res.status === 404) throw new Error("Player not found on chess.com");
  if (res.status === 429) throw new Error("Rate limited — try again in a moment");
  if (!res.ok) throw new Error(`chess.com lookup failed (${res.status})`);

  const { profile, stats } = normalizeChessComPlayerPayload(await res.json(), username);
  const ratings = extractChessComRatings(stats);
  return {
    name: (profile.name as string) || (profile.username as string),
    username: profile.username as string,
    ...ratings,
    elo: resolveChessComRating(ratings),
    avatar: profile.avatar as string | undefined,
    country: (profile.country as string | undefined)?.split("/").pop()?.toUpperCase(),
    title: profile.title as string | undefined,
  };
}

/** Build the exact roster record used for a verified Chess.com lookup. */
export function createChessComTournamentPlayer(
  lookup: ChessComLookupResult,
  ratingType: "rapid" | "blitz" = "rapid",
): Player {
  const elo = resolveChessComRating(lookup, ratingType);
  return {
    id: nanoid(),
    name: lookup.name || lookup.username,
    username: lookup.username,
    elo,
    ...(lookup.rapid ? { rapidElo: lookup.rapid } : {}),
    ...(lookup.blitz ? { blitzElo: lookup.blitz } : {}),
    platform: "chesscom",
    country: lookup.country ?? "Unknown",
    title: lookup.title as Player["title"],
    avatarUrl: lookup.avatar,
    wins: 0,
    draws: 0,
    losses: 0,
    points: 0,
    buchholz: 0,
    colorHistory: [],
  };
}
