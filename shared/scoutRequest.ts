import type {
  ActiveScoutRequest,
  Color,
  DraftScoutRequest,
  Provider,
  ScoutFormat,
  ScoutFormatFilter,
} from "./prepTypes.js";

export const SCOUT_SCHEMA_VERSION = "launch-2";
export const SCOUT_MAX_GAMES = 30 as const;
export const SCOUT_PROVIDER_PAGE_SIZE = 100 as const;
export const SCOUT_ARCHIVE_MONTHS = 24;
export const ALL_SCOUT_FORMATS: ScoutFormat[] = ["rapid", "blitz", "bullet"];


function readProvider(value: string | null | undefined): Provider {
  return value === "lichess" ? "lichess" : "chesscom";
}

function readColor(value: string | null | undefined): Color {
  return value === "black" ? "black" : "white";
}

function readFormat(value: string | null | undefined): ScoutFormatFilter {
  return value === "rapid" || value === "blitz" || value === "bullet" ? value : "all";
}

export function formatsForFilter(filter: ScoutFormatFilter): ScoutFormat[] {
  return filter === "all" ? [...ALL_SCOUT_FORMATS] : [filter];
}

export function formatFilterForFormats(formats: ScoutFormat[]): ScoutFormatFilter {
  return formats.length === 1 ? formats[0] : "all";
}

export function normalizeScoutUsername(username: string): string {
  return username.trim().toLowerCase();
}

export function createActiveScoutRequest(
  draft: DraftScoutRequest,
  requestedAt = new Date().toISOString(),
): ActiveScoutRequest {
  const displayUsername = draft.displayUsername.trim();
  return {
    platform: draft.platform,
    normalizedUsername: normalizeScoutUsername(displayUsername),
    displayUsername,
    myColor: draft.myColor,
    formats: formatsForFilter(draft.format),
    mode: "standard",
    maxGames: SCOUT_MAX_GAMES,
    schemaVersion: SCOUT_SCHEMA_VERSION,
    requestedAt,
  };
}

export function activeScoutRequestFromQuery(
  username: string,
  query: URLSearchParams | Record<string, string | string[] | undefined>,
  requestedAt = new Date().toISOString(),
): ActiveScoutRequest {
  const read = (key: string): string | undefined => {
    if (query instanceof URLSearchParams) return query.get(key) ?? undefined;
    const value = query[key];
    return Array.isArray(value) ? value[0] : value;
  };
  return createActiveScoutRequest({
    platform: readProvider(read("provider") ?? read("platform")),
    displayUsername: username,
    myColor: readColor(read("myColor") ?? read("color")),
    format: readFormat(read("tc") ?? read("format")),
  }, requestedAt);
}

export function scoutRequestCacheKey(request: ActiveScoutRequest): string {
  const formatKey = request.formats.join("+");
  return [
    "v4",
    request.platform,
    request.normalizedUsername,
    `c${request.myColor}`,
    `f${formatKey}`,
    `m${request.mode}`,
    `g${request.maxGames}`,
    `s${request.schemaVersion}`,
  ].join(":");
}

export function scoutRequestSearchParams(request: ActiveScoutRequest): URLSearchParams {
  return new URLSearchParams({
    provider: request.platform,
    myColor: request.myColor,
    tc: formatFilterForFormats(request.formats),
  });
}

export function scoutRequestRoute(request: ActiveScoutRequest): string {
  return `/prep/${encodeURIComponent(request.displayUsername)}?${scoutRequestSearchParams(request).toString()}`;
}
