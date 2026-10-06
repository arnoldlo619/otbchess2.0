export type ChessComPlayerProfile = Record<string, unknown> & {
  username: string;
};

export type ChessComPlayerPayload = {
  profile: ChessComPlayerProfile;
  stats: Record<string, unknown>;
};

export type ChessComRatingCategory = "rapid" | "blitz" | "bullet" | "daily";

export type ChessComRatings = Record<ChessComRatingCategory, number>;

export const DEFAULT_CHESS_COM_RATING = 1200;

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

function toUsableRating(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

function ratingFromStats(stats: Record<string, unknown>, key: `chess_${ChessComRatingCategory}`): number {
  const category = asRecord(stats[key]);
  const last = category ? asRecord(category.last) : null;
  return toUsableRating(last?.rating);
}

/**
 * Extract the four usable live ratings exposed by Chess.com's stats API.
 * Invalid, stale, zero, and malformed values normalize to 0 so every
 * registration flow makes the same safe fallback decision.
 */
export function extractChessComRatings(stats: unknown): ChessComRatings {
  const source = asRecord(stats) ?? {};
  return {
    rapid: ratingFromStats(source, "chess_rapid"),
    blitz: ratingFromStats(source, "chess_blitz"),
    bullet: ratingFromStats(source, "chess_bullet"),
    daily: ratingFromStats(source, "chess_daily"),
  };
}

/**
 * Resolve an eligible tournament rating from a Chess.com rating snapshot.
 * The default public fallback order is rapid → blitz → bullet → daily → 1200.
 * Blitz tournaments may prefer Blitz first while preserving the same safe
 * fallback order for every unavailable category.
 */
export function resolveChessComRating(
  ratings: Partial<ChessComRatings>,
  preferred: "rapid" | "blitz" = "rapid",
): number {
  const order: ChessComRatingCategory[] = preferred === "blitz"
    ? ["blitz", "rapid", "bullet", "daily"]
    : ["rapid", "blitz", "bullet", "daily"];

  for (const category of order) {
    const rating = toUsableRating(ratings[category]);
    if (rating) return rating;
  }

  return DEFAULT_CHESS_COM_RATING;
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
