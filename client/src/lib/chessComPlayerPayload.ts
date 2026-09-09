export type ChessComPlayerProfile = Record<string, unknown> & {
  username: string;
};

export type ChessComPlayerPayload = {
  profile: ChessComPlayerProfile;
  stats: Record<string, unknown>;
};

/**
 * Player identity and ratings are live tournament inputs. Keep this URL versioned
 * so a service worker from an older release cannot replay the former nested
 * payload contract to Add Player, RSVP import, or QR registration.
 */
export function chessComPlayerEndpoint(username: string): string {
  return `/api/chess/player/${encodeURIComponent(username.trim().toLowerCase())}?v=player-v2`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

/**
 * The Chess.com proxy now returns the provider profile at the top level with a
 * sibling `stats` object. This normalizer deliberately also accepts the former
 * `{ profile, stats }` shape so cached or older responses cannot break player
 * registration flows during a rolling deployment.
 */
export function normalizeChessComPlayerPayload(payload: unknown, fallbackUsername = ""): ChessComPlayerPayload {
  const body = asRecord(payload);
  if (!body) throw new Error("Chess.com returned an invalid player profile. Please retry.");

  const nestedProfile = asRecord(body.profile);
  const source = nestedProfile ?? body;
  const suppliedUsername = typeof source.username === "string" ? source.username.trim() : "";
  const username = suppliedUsername || fallbackUsername.trim();
  if (!username) throw new Error("Chess.com returned an incomplete player profile. Please retry.");

  return {
    profile: { ...source, username },
    stats: asRecord(body.stats) ?? {},
  };
}
