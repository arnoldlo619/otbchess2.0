import type { ActiveScoutRequest, Provider, ScoutFormat, ScoutMode } from "./prepTypes";

export type SavedScoutIdentity = Pick<ActiveScoutRequest, "platform" | "normalizedUsername" | "formats" | "mode" | "maxGames" | "schemaVersion">;

const VALID_FORMATS = new Set<ScoutFormat>(["rapid", "blitz", "bullet"]);

function parsePayload(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return null; }
}

/**
 * Legacy saved reports without a complete report snapshot are intentionally
 * non-restorable: inferring provider or filters from a username could mix data.
 */
export function savedScoutIdentityFromReport(value: unknown): SavedScoutIdentity | null {
  const payload = parsePayload(value);
  if (typeof payload !== "object" || payload === null) return null;
  const active = (payload as { reportSnapshot?: { activeRequest?: unknown } }).reportSnapshot?.activeRequest;
  if (typeof active !== "object" || active === null) return null;
  const request = active as Record<string, unknown>;
  if ((request.platform !== "chesscom" && request.platform !== "lichess") || typeof request.normalizedUsername !== "string" || !request.normalizedUsername.trim()) return null;
  if (!Array.isArray(request.formats) || request.formats.length === 0 || !request.formats.every((format): format is ScoutFormat => typeof format === "string" && VALID_FORMATS.has(format as ScoutFormat))) return null;
  if (request.mode !== "standard" || request.maxGames !== 30 || typeof request.schemaVersion !== "string" || !request.schemaVersion) return null;
  return {
    platform: request.platform as Provider,
    normalizedUsername: request.normalizedUsername.trim().toLowerCase(),
    formats: Array.from(new Set(request.formats)).sort(),
    mode: request.mode as ScoutMode,
    maxGames: 30,
    schemaVersion: request.schemaVersion,
  };
}

export function savedScoutIdentityKey(identity: SavedScoutIdentity): string {
  return [identity.platform, identity.normalizedUsername, [...identity.formats].sort().join(","), identity.mode, identity.maxGames, identity.schemaVersion].join(":");
}
